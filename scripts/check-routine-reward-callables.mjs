import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { buildDirectionFixture, DIRECTION_PROJECT_ID } from './product-direction-fixtures.mjs';
import { createDirectionAdmin, callDirectionFunction as call, directionStudentContext as context, signInDirectionParent as signIn } from './product-direction-emulator-api.mjs';

const { app, db } = createDirectionAdmin();
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { deleteApp } = require('firebase-admin/app');
after(() => deleteApp(app));
const routines = buildDirectionFixture({ scenario: 'routines' });
const legacy = buildDirectionFixture({ scenario: 'legacy' });
const disabled = buildDirectionFixture({ scenario: 'routine_disabled' });
const core = buildDirectionFixture({ scenario: 'core' });
const free = buildDirectionFixture({ scenario: 'free' });
const student = routines.students[0];
const read = (s = student) => call('readStudentRoutineRewards', context(s));
const success = (body) => { assert.ok(body.result, JSON.stringify(body.error)); return body.result; };
const denied = (body, status) => { assert.equal(body.error?.status, status, JSON.stringify(body)); };
const record = async (collection, id) => (await db.collection(collection).doc(id).get()).data();
const scoped = (collection, s = student) => db.collection(collection).where('student_id', '==', s.id).get();
const complete = (routine, dateKey, s = student, extra = {}) => call('completeRoutine', {
  ...context(s), routine_template_id: routine.id, date_key: dateKey,
  completed_item_ids: routine.checklist_items.map((item) => item.id), ...extra,
});

let frozen;
test('activated Free reads narrow own state; inactive, PIN and mixed identities are denied', async () => {
  frozen = success(await read());
  assert.equal(frozen.contract, 'routine_rewards_v1');
  assert.equal(frozen.routine_rewards.wallet.total_points, 40);
  assert.equal(frozen.access.can_use_rewards, false);
  assert.equal(frozen.access.can_use_chores, false);
  assert.equal(frozen.routines.length, 3);
  assert.ok(frozen.routine_rewards.catalog.every((item) => item.type === 'built_in'));
  assert.ok(frozen.routine_rewards.cosmetics.owned_cosmetic_ids.includes('direction_starlight'));
  assert.equal(success(await read(routines.students[1])).routine_rewards.wallet.total_points, 20);
  denied(await read(free.students[0]), 'PERMISSION_DENIED');
  denied(await call('readStudentRoutineRewards', { ...context(student), access_pin: '0000' }), 'PERMISSION_DENIED');
  denied(await call('readStudentRoutineRewards', { ...context(student), slug: routines.students[1].slug }), 'PERMISSION_DENIED');
  const unchanged = await record('studentCosmeticStates', frozen.routine_rewards.cosmetics.id);
  await read();
  assert.deepEqual(await record('studentCosmeticStates', unchanged.id), unchanged, 'unchanged reads do not rewrite cosmetic state');
});

test('invalid checklists/date/sibling templates persist no completion; snapshot freezes template/settings/timezone', async () => {
  const routine = frozen.routines[0];
  const date = frozen.routine_rewards.day.date_key;
  denied(await complete(routine, date, student, { completed_item_ids: [] }), 'INVALID_ARGUMENT');
  denied(await complete(routine, date, student, { completed_item_ids: ['forged'] }), 'INVALID_ARGUMENT');
  denied(await complete(routine, '2099-01-01'), 'INVALID_ARGUMENT');
  denied(await complete(routine, date, routines.students[1]), 'FAILED_PRECONDITION');
  assert.equal((await scoped('routineCompletions')).size, 0);
  await db.collection('routineTemplates').doc(routine.id).update({ checklist_items: [{ id: 'changed', label: 'Changed after first use' }] });
  await db.collection('rewardSettings').doc(routines.parentId).set({ parent_id: routines.parentId, routine_day_points: 99, routine_points_enabled: true });
  await db.collection('choreSettings').doc(routines.parentId).set({ parent_id: routines.parentId, timezone: 'Pacific/Kiritimati' });
  const again = success(await read());
  assert.deepEqual(again.routines, frozen.routines);
  assert.deepEqual(again.routine_rewards.day, frozen.routine_rewards.day);
  denied(await complete(routine, date, student, { completed_item_ids: ['changed'] }), 'INVALID_ARGUMENT');
});

test('concurrent final periods create exactly one daily award and preserve wallet on retries', async () => {
  const replies = await Promise.all(frozen.routines.map((routine) => complete(routine, frozen.routine_rewards.day.date_key)));
  assert.equal(replies.map(success).filter((value) => value.routine_rewards.awarded).length, 1);
  assert.equal((await record('studentPointWallets', student.id)).total_points, 50);
  assert.equal((await scoped('routineCompletions')).size, 3);
  const ledger = await scoped('pointLedgerEntries');
  assert.equal(ledger.size, 1);
  assert.equal(ledger.docs[0].data().source_id, `routine_day:${frozen.routine_rewards.day.date_key}`);
  for (const routine of frozen.routines) assert.equal(success(await complete(routine, frozen.routine_rewards.day.date_key)).routine_rewards.awarded, false);
  assert.equal(success(await read()).routine_rewards.wallet.total_points, 50);
});

test('cosmetic debit is atomic/idempotent, selection checks ownership/slots/revision and persists', async () => {
  denied(await call('unlockRoutineCosmetic', { ...context(student), cosmetic_id: 'builtin_avatar_stargazer', point_cost: 0 }), 'INVALID_ARGUMENT');
  const replies = await Promise.all([1, 2].map(() => call('unlockRoutineCosmetic', { ...context(student), cosmetic_id: 'builtin_avatar_stargazer' })));
  assert.equal(replies.map(success).filter((value) => !value.already_owned).length, 1);
  assert.equal((await record('studentPointWallets', student.id)).total_points, 30);
  const before = success(await read()).routine_rewards.cosmetics;
  denied(await call('selectRoutineCosmetics', { ...context(student), expected_revision: before.revision, selected_cosmetic_ids: { badge: 'builtin_avatar_stargazer' } }), 'FAILED_PRECONDITION');
  denied(await call('selectRoutineCosmetics', { ...context(student), expected_revision: before.revision, selected_cosmetic_ids: { badge: 'builtin_badge_comet' } }), 'FAILED_PRECONDITION');
  const selected = success(await call('selectRoutineCosmetics', { ...context(student), expected_revision: before.revision, selected_cosmetic_ids: { avatar: 'builtin_avatar_stargazer' } }));
  denied(await call('selectRoutineCosmetics', { ...context(student), expected_revision: before.revision, selected_cosmetic_ids: {} }), 'FAILED_PRECONDITION');
  assert.deepEqual(success(await read()).routine_rewards.cosmetics, selected.cosmetics);
  const sibling = routines.students[1];
  denied(await call('unlockRoutineCosmetic', { ...context(sibling), cosmetic_id: 'builtin_theme_twilight' }), 'FAILED_PRECONDITION');
  assert.equal((await record('studentPointWallets', sibling.id)).total_points, 20);
  assert.ok(!success(await read(sibling)).routine_rewards.cosmetics.owned_cosmetic_ids.includes('builtin_avatar_stargazer'));
});

test('disabled routine points preserve opt-out and full-day completion without credit', async () => {
  const s = disabled.students[0];
  const day = success(await read(s));
  for (const routine of day.routines) assert.equal(success(await complete(routine, day.routine_rewards.day.date_key, s)).routine_rewards.awarded, false);
  assert.equal((await record('studentPointWallets', s.id)).total_points, 40);
  assert.equal((await scoped('pointLedgerEntries', s)).size, 0);
});

test('activated read reconciles pre-existing valid Free completions once', async () => {
  const s = free.students[1];
  await db.collection('accountEntitlements').doc(free.parentId).update({ product_direction_version: 1 });
  const day = success(await read(s));
  for (const routine of day.routines) await db.collection('routineCompletions').doc(`${routine.id}_${s.id}_${day.routine_rewards.day.date_key}`).set({
    parent_id: free.parentId, student_id: s.id, routine_template_id: routine.id, date_key: day.routine_rewards.day.date_key,
    completed_item_ids: ['ready'], completed_at: new Date(),
  });
  const responses = await Promise.all([read(s), read(s)]);
  assert.equal(responses.map(success).filter((value) => value.routine_rewards.awarded).length, 1);
  assert.equal((await record('studentPointWallets', s.id)).total_points, 30);
  assert.equal((await scoped('pointLedgerEntries', s)).size, 1);
});

test('owner routine settings cannot change school/chore settings; active paid broad mutations deny', async () => {
  const token = await signIn(routines);
  await db.collection('rewardSettings').doc(routines.parentId).set({ parent_id: routines.parentId, school_block_points: 7, chore_points: 3 }, { merge: true });
  denied(await call('upsertRoutineRewardSettings', { routine_day_points: 12, routine_points_enabled: true }), 'UNAUTHENTICATED');
  denied(await call('upsertRoutineRewardSettings', { routine_day_points: 12, routine_points_enabled: true, school_block_points: 100 }, token), 'INVALID_ARGUMENT');
  success(await call('upsertRoutineRewardSettings', { routine_day_points: 12, routine_points_enabled: true }, token));
  assert.equal((await record('rewardSettings', routines.parentId)).school_block_points, 7);
  await db.collection('accountEntitlements').doc(core.parentId).update({ product_direction_version: 1 });
  const coreToken = await signIn(core);
  denied(await call('upsertRewardSettings', { routine_day_points: 500 }, coreToken), 'PERMISSION_DENIED');
  denied(await call('requestRewardRedemption', { ...context(core.students[0]), reward_catalog_item_id: 'anything' }), 'PERMISSION_DENIED');
  success(await call('createStudent', { name: 'Twelfth Core Student' }, coreToken));
  assert.equal((await db.collection('students').where('parent_id', '==', core.parentId).get()).size, 12);
  denied(await call('createStudent', { name: 'Third Free Student' }, await signIn(routines)), 'RESOURCE_EXHAUSTED');
});

test('existing household obligations settle owner-only, preserve evidence, refund once and reject replay conflict', async () => {
  await db.collection('accountEntitlements').doc(legacy.parentId).update({ product_direction_version: 1, plan_id: 'free' });
  const token = await signIn(legacy);
  const payload = { obligation_type: 'redemption', obligation_id: `${legacy.parentId}_pending`, action: 'cancel_refund', idempotency_key: 'cancel-history' };
  denied(await call('settleHouseholdHistory', payload, await signIn(routines)), 'PERMISSION_DENIED');
  const responses = await Promise.all([call('settleHouseholdHistory', payload, token), call('settleHouseholdHistory', payload, token)]);
  assert.equal(responses.map(success).filter((value) => !value.replayed).length, 1);
  assert.equal((await record('studentPointWallets', legacy.students[0].id)).total_points, 40);
  assert.equal((await record('rewardCatalogItems', `${legacy.parentId}_history_reward`)).available_quantity, 1);
  const events = await db.collection('householdHistoryEvents').where('parent_id', '==', legacy.parentId).get();
  assert.equal(events.size, 1);
  assert.equal(events.docs[0].data().original_obligation.status, 'requested');
  denied(await call('settleHouseholdHistory', { ...payload, action: 'fulfill' }, token), 'FAILED_PRECONDITION');
  denied(await call('settleHouseholdHistory', { ...payload, idempotency_key: 'second-refund' }, token), 'FAILED_PRECONDITION');
  success(await call('settleHouseholdHistory', { obligation_type: 'allowance', obligation_id: `${legacy.parentId}_unpaid`, action: 'acknowledge_payment', idempotency_key: 'allowance-paid' }, token));
  assert.equal((await record('allowancePeriods', `${legacy.parentId}_unpaid`)).paid_amount, 5);
});

test('migration dry-run, activation, replay and deactivation preserve billing/support/data', async () => {
  const id = core.parentId;
  await db.collection('accountEntitlements').doc(id).set({ product_direction_version: 0, stripe_customer_id: 'retained',
    billing_state: { plan_id: 'core', subscription_status: 'active', billing_provider: 'stripe' },
    manual_override: { is_active: true, plan_id: 'lockdown', expires_at: new Date(Date.now() + 3600000) }, usage_snapshot: { students: 12 },
  }, { merge: true });
  const before = await record('accountEntitlements', id);
  const wallets = await scoped('studentPointWallets', core.students[0]);
  const run = async (...args) => {
    const { stdout } = await promisify(execFile)(process.execPath, ['scripts/migrate-routine-first-entitlements.mjs', `--project=${DIRECTION_PROJECT_ID}`, '--target=emulator', `--parents=${id}`, ...args], { env: process.env });
    return JSON.parse(stdout);
  };
  assert.equal((await run('--activate')).changed, 1);
  assert.deepEqual(await record('accountEntitlements', id), before);
  assert.equal((await run('--write')).changed, 1);
  assert.equal((await record('accountEntitlements', id)).product_direction_version, 0);
  assert.equal((await run('--write', '--activate')).changed, 1);
  const active = await record('accountEntitlements', id);
  assert.equal(active.limits.maxStudents, null);
  assert.equal(active.product_direction_version, 1);
  assert.equal((await run('--write', '--activate')).unchanged, 1);
  assert.equal((await run('--write', '--deactivate')).changed, 1);
  const after = await record('accountEntitlements', id);
  for (const key of ['billing_state', 'manual_override', 'usage_snapshot', 'stripe_customer_id']) assert.deepEqual(after[key], before[key]);
  assert.equal(after.product_direction_version, 0);
  assert.deepEqual((await scoped('studentPointWallets', core.students[0])).docs.map((doc) => doc.data()), wallets.docs.map((doc) => doc.data()));
});

test('support-denied narrow rewards still allow routines without wallet exposure; daily denial blocks completion', async () => {
  const s = routines.students[1];
  const entitlementRef = db.collection('accountEntitlements').doc(routines.parentId);
  await entitlementRef.update({ feature_overrides: { can_use_routine_rewards: false } });
  denied(await read(s), 'PERMISSION_DENIED');
  const state = success(await call('readStudentChoreState', context(s)));
  assert.equal(state.routine_rewards, null);
  assert.match(state.routine_day.date_key, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(state.routine_day.timezone, 'America/Chicago');
  assert.equal(state.routines.length, 3);
  const result = success(await complete(state.routines[0], state.routine_day.date_key, s));
  assert.equal(result.routine_rewards, null);
  assert.equal(result.routine_day.date_key, state.routine_day.date_key);
  assert.equal((await scoped('pointLedgerEntries', s)).size, 0);
  await entitlementRef.update({ feature_overrides: { can_use_daily_routines: false } });
  denied(await complete(state.routines[1], undefined, s), 'PERMISSION_DENIED');
  denied(await read(s), 'PERMISSION_DENIED');
  await entitlementRef.update({ feature_overrides: {} });
});

test('empty routine day never awards and an evening-only day earns the configured amount', async () => {
  const s = core.students[1];
  const entitlementRef = db.collection('accountEntitlements').doc(core.parentId);
  await entitlementRef.update({ product_direction_version: 1, manual_override: { is_active: false } });
  const templates = await db.collection('routineTemplates').where('parent_id', '==', core.parentId).get();
  for (const doc of templates.docs.filter((item) => item.data().student_ids.includes(s.id))) await doc.ref.update({ is_active: false });
  const empty = success(await read(s));
  assert.equal(empty.routines.length, 0);
  assert.equal(empty.routine_rewards.day.complete, false);
  assert.equal(empty.routine_rewards.awarded, false);
  assert.equal((await scoped('pointLedgerEntries', s)).size, 0);
  // A different student's first use has only an evening period and a configured household award.
  const eveningStudent = core.students[2];
  for (const period of ['morning', 'afternoon']) await db.collection('routineTemplates').doc(`${eveningStudent.id}_${period}`).update({ is_active: false });
  await db.collection('rewardSettings').doc(core.parentId).set({ parent_id: core.parentId, routine_day_points: 7, routine_points_enabled: true });
  const evening = success(await read(eveningStudent));
  assert.equal(evening.routines.length, 1);
  const result = success(await complete(evening.routines[0], evening.routine_rewards.day.date_key, eveningStudent));
  assert.equal(result.routine_rewards.awarded, true);
  assert.equal(result.routine_rewards.wallet.total_points, 27);
});


test('legacy migration preserves base Free plan beneath temporary paid support override', async () => {
  const id = disabled.parentId;
  await db.collection('accountEntitlements').doc(id).set({ plan_id: 'free', product_direction_version: 0,
    manual_override: { is_active: true, plan_id: 'core', expires_at: new Date(Date.now() + 60000) } });
  await promisify(execFile)(process.execPath, ['scripts/migrate-routine-first-entitlements.mjs', `--project=${DIRECTION_PROJECT_ID}`, '--target=emulator', `--parents=${id}`, '--write', '--activate'], { env: process.env });
  const migrated = await record('accountEntitlements', id);
  assert.equal(migrated.plan_id, 'free', 'legacy fallback billing source remains Free after override expires');
  assert.equal(migrated.limits.maxStudents, null, 'effective temporary override still resolves paid scale');
  assert.equal(migrated.manual_override.plan_id, 'core');
});

test('new-account bootstrap uses a private release gate, derives Free and preserves existing support records', async () => {
  const fixture = buildDirectionFixture({ scenario: 'empty' });
  const accountRef = db.collection('accountEntitlements').doc(fixture.parentId);
  await accountRef.delete();
  const token = await signIn(fixture);
  const configRef = db.collection('productDirectionConfig').doc('routineFirst');
  await configRef.delete();
  denied(await call('initializeRoutineFirstAccount', {}), 'UNAUTHENTICATED');
  assert.equal(success(await call('initializeRoutineFirstAccount', {}, token)).initialized, false);
  assert.equal((await accountRef.get()).exists, false);
  const run = async (...args) => {
    const { stdout } = await promisify(execFile)(process.execPath, ['scripts/migrate-routine-first-entitlements.mjs', `--project=${DIRECTION_PROJECT_ID}`, '--target=emulator', `--parents=${fixture.parentId}`, '--activate', '--enable-new-accounts', ...args], { env: process.env });
    return JSON.parse(stdout);
  };
  assert.equal((await run()).new_accounts_changed, true);
  assert.equal((await configRef.get()).exists, false, 'rollout dry-run does not enable future accounts');
  await run('--write');
  denied(await call('initializeRoutineFirstAccount', { plan_id: 'core', parent_id: core.parentId }, token), 'INVALID_ARGUMENT');
  const results = await Promise.all([call('initializeRoutineFirstAccount', {}, token), call('initializeRoutineFirstAccount', {}, token)]);
  assert.equal(results.map(success).filter((value) => value.initialized).length, 1);
  const initial = (await accountRef.get()).data();
  assert.equal(initial.product_direction_version, 1);
  assert.equal(initial.plan_id, 'free');
  assert.equal(initial.limits.maxStudents, 2);
  await accountRef.update({ manual_override: { is_active: true, plan_id: 'core' }, product_direction_version: 0 });
  const before = (await accountRef.get()).data();
  assert.equal(success(await call('initializeRoutineFirstAccount', {}, token)).initialized, false);
  assert.deepEqual((await accountRef.get()).data(), before);
  await configRef.set({ version: 1, new_accounts_enabled: false });
});
