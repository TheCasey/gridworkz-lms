import assert from 'node:assert/strict';
import {
  ROUTINE_REWARD_CATALOG, ROUTINE_REWARD_COLLECTIONS, PRODUCT_DIRECTION_VERSION,
  ROUTINE_REWARD_MIGRATION_VERSION, ROUTINE_REWARD_BASE_COSMETIC_ID,
  assertRoutineScopedRecord, buildAllowanceHistorySettlement, buildFrozenRoutineDaySnapshot,
  buildFrozenRoutineDayAwardDecision,
  buildHouseholdHistoryEventId, buildRoutineCosmeticSelection, buildRoutineCosmeticState,
  buildRoutineCosmeticStateId, buildRoutineCosmeticUnlock, buildRoutineDayPointerId,
  buildRoutineDaySnapshotId, getRoutineCatalogItem, isFrozenRoutineDayComplete,
  isProductDirectionActive, normalizeRoutineRewardSettings, preserveProductDirectionMarkers,
  resolveRoutineRewardAccess, routineLocalDateKey, routineLocalDayWindow,
  selectRoutineSnapshotTemplates, validateRoutineCompletionItems, validateRoutineRewardSettingsPayload,
} from '../functions/src/routineRewardContracts.js';
import { buildPointLedgerEntryId, POINT_SOURCE_TYPES } from '../functions/src/pointLedgerUtils.js';
import {
  buildEntitlementBillingState, buildEntitlementWriteForBillingSync,
  buildEntitlementWriteForManualOverride, buildEntitlementWriteForOverrideClear,
  buildFeatureSet, buildRoutineFirstEntitlementPatch, resolveEntitlementRecord,
} from '../functions/src/index.js';

let count = 0;
const equal = (actual, expected) => { assert.deepEqual(actual, expected); count += 1; };
const check = (value) => { assert.ok(value); count += 1; };
const rejects = (code, fn) => { assert.throws(fn, (error) => error.code === code); count += 1; };
const now = new Date('2026-10-13T16:00:00Z');
const parentId = 'helper-parent';
const studentId = 'helper-student';
const template = (id, period, studentIds = [studentId]) => ({
  id, parent_id: parentId, student_ids: studentIds, routine_period: period,
  title: period ? `${period} routine` : 'Daily care', is_active: true,
  checklist_items: [{ id: `${id}-one`, label: 'First item' }, { id: `${id}-two`, label: 'Second item' }],
});
const morning = template('morning', 'morning');
const evening = template('evening', 'evening');
const unknown = template('legacy-extra', '', []);
const frozen = buildFrozenRoutineDaySnapshot({ parentId, studentId, now, timezone: 'America/Chicago', templates: [morning, evening, unknown] });
equal(PRODUCT_DIRECTION_VERSION, 1);
equal(ROUTINE_REWARD_MIGRATION_VERSION, 1);
equal(ROUTINE_REWARD_COLLECTIONS.DAY_SNAPSHOTS, 'routineDaySnapshots');
equal(frozen.date_key, '2026-10-13');
equal(frozen.routine_day_points, 10);
equal(frozen.routine_points_enabled, true);
equal(frozen.templates.map((entry) => entry.routine_period), ['morning', 'evening', 'legacy:legacy-extra']);
equal(frozen.day_start.toISOString(), '2026-10-13T05:00:00.000Z');
equal(frozen.day_end.toISOString(), '2026-10-14T05:00:00.000Z');
equal(routineLocalDateKey(new Date('2026-10-13T02:00:00Z'), 'America/Chicago'), '2026-10-12');
equal(routineLocalDateKey(new Date('2026-10-13T02:00:00Z'), 'UTC'), '2026-10-13');
const dstSpring = routineLocalDayWindow('2026-03-08', 'America/Chicago');
const dstFall = routineLocalDayWindow('2026-11-01', 'America/Chicago');
equal((dstSpring.day_end - dstSpring.day_start) / 3600000, 23);
equal((dstFall.day_end - dstFall.day_start) / 3600000, 25);
const santiagoSpring = routineLocalDayWindow('2026-09-06', 'America/Santiago');
equal(santiagoSpring.day_start.toISOString(), '2026-09-06T04:00:00.000Z');
equal(santiagoSpring.day_end.toISOString(), '2026-09-07T03:00:00.000Z');
equal((santiagoSpring.day_end - santiagoSpring.day_start) / 3600000, 23);
equal(routineLocalDateKey(santiagoSpring.day_start, 'America/Santiago'), '2026-09-06');
equal(routineLocalDateKey(new Date(santiagoSpring.day_start.getTime() - 1), 'America/Santiago'), '2026-09-05');
const apiaBeforeSkip = routineLocalDayWindow('2011-12-29', 'Pacific/Apia');
equal(routineLocalDateKey(apiaBeforeSkip.day_end, 'Pacific/Apia'), '2011-12-31');
equal((apiaBeforeSkip.day_end - apiaBeforeSkip.day_start) / 3600000, 24);
rejects('invalid-day-context', () => routineLocalDayWindow('2011-12-30', 'Pacific/Apia'));
rejects('invalid-date-key', () => buildRoutineDaySnapshotId({ parentId, studentId, dateKey: '2026-02-30' }));
rejects('invalid-timezone', () => routineLocalDateKey(now, 'Fake/Zone'));
rejects('invalid-identity', () => buildRoutineCosmeticStateId({ parentId: '', studentId }));
check(buildRoutineCosmeticStateId({ parentId: 'a:b', studentId: 'c' }) !== buildRoutineCosmeticStateId({ parentId: 'a', studentId: 'b:c' }));
check(buildRoutineDaySnapshotId({ parentId, studentId, dateKey: '2026-10-13' }) !== buildRoutineDaySnapshotId({ parentId, studentId: 'sibling', dateKey: '2026-10-13' }));
equal(buildRoutineDayPointerId({ parentId, studentId }), `routine-day-active:${parentId}:${studentId}`);
check(buildHouseholdHistoryEventId({ parentId, idempotencyKey: 'one' }) !== buildHouseholdHistoryEventId({ parentId: 'other-parent', idempotencyKey: 'one' }));
equal(buildHouseholdHistoryEventId({ parentId, idempotencyKey: 'one' }), buildHouseholdHistoryEventId({ parentId, idempotencyKey: 'one' }));

const grouped = template('legacy-morning', '', [studentId, 'sibling']);
grouped.title = 'Morning routine';
const selected = selectRoutineSnapshotTemplates({ parentId, studentId, templates: [grouped, morning, unknown, template('sibling-only', 'afternoon', ['sibling']), { ...evening, is_active: false }] });
equal(selected.map((entry) => entry.id), ['morning', 'legacy-extra']);
// An unrelated canonical morning never silently discards an unknown legacy template.
equal(selected[1].routine_period, 'legacy:legacy-extra');
const multipleShared = selectRoutineSnapshotTemplates({ parentId, studentId, templates: [grouped, { ...grouped, id: 'second-shared' }] });
equal(multipleShared.map((entry) => entry.routine_period), ['legacy:legacy-morning', 'legacy:second-shared']);
rejects('ambiguous-routine-templates', () => selectRoutineSnapshotTemplates({ parentId, studentId, templates: [morning, { ...morning, id: 'second-morning' }] }));
rejects('invalid-checklist', () => selectRoutineSnapshotTemplates({ parentId, studentId, templates: [{ ...morning, checklist_items: [{ id: '', label: 'Task' }] }] }));
rejects('scope-mismatch', () => selectRoutineSnapshotTemplates({ parentId, studentId, templates: [{ ...morning, parent_id: 'other-parent' }] }));
equal(selectRoutineSnapshotTemplates({ parentId, studentId, templates: [{ ...morning, checklist_items: [] }] }), []);
equal(selectRoutineSnapshotTemplates({ parentId, studentId, templates: [grouped, { ...morning, checklist_items: [] }] }), [], 'Intentional empty canonical period supersedes shared fallback');
equal(selectRoutineSnapshotTemplates({ parentId, studentId, templates: [grouped, { ...morning, checklist_items: [], is_active: false }] }).map((entry) => entry.id), [grouped.id]);
const complete = (entry) => ({ parent_id: parentId, student_id: studentId, date_key: frozen.date_key, routine_template_id: entry.id, completed_item_ids: entry.checklist_items.map((item) => item.id), completed_at: now });
const completions = frozen.templates.map(complete);
equal(isFrozenRoutineDayComplete(frozen, completions), true);
equal(buildFrozenRoutineDayAwardDecision({ snapshot: frozen, completions, canUseRoutineRewards: true }), { complete: true, should_award: true, delta_points: 10 });
equal(buildFrozenRoutineDayAwardDecision({ snapshot: frozen, completions, canUseRoutineRewards: true, existingLedger: { id: 'existing-legacy-award' } }), { complete: true, should_award: false, delta_points: 0 });
equal(buildFrozenRoutineDayAwardDecision({ snapshot: frozen, completions, canUseRoutineRewards: false }).should_award, false);
equal(buildFrozenRoutineDayAwardDecision({ snapshot: { ...frozen, routine_points_enabled: false }, completions, canUseRoutineRewards: true }).should_award, false);
equal(buildFrozenRoutineDayAwardDecision({ snapshot: frozen, completions: completions.slice(0, 2), canUseRoutineRewards: true }).should_award, false);
equal(buildFrozenRoutineDayAwardDecision({ snapshot: { ...frozen, templates: [] }, completions: [], canUseRoutineRewards: true }).should_award, false);
equal(isFrozenRoutineDayComplete(frozen, completions.slice(0, 2)), false);
equal(isFrozenRoutineDayComplete({ ...frozen, templates: [] }, []), false);
equal(isFrozenRoutineDayComplete(frozen, [{ ...completions[0], completed_item_ids: ['fake'] }, ...completions.slice(1)]), false);
equal(isFrozenRoutineDayComplete(frozen, [{ ...completions[0], completed_item_ids: [completions[0].completed_item_ids[0]] }, ...completions.slice(1)]), false);
equal(isFrozenRoutineDayComplete(frozen, [{ ...completions[0], student_id: 'sibling' }, ...completions.slice(1)]), false);
equal(isFrozenRoutineDayComplete(frozen, [{ ...completions[0], date_key: '2026-10-12' }, ...completions.slice(1)]), false);
rejects('invalid-checklist-completion', () => validateRoutineCompletionItems(morning, ['morning-one', 'morning-one']));
rejects('incomplete-checklist', () => validateRoutineCompletionItems(morning, ['morning-one', 'fake']));
rejects('incomplete-checklist', () => validateRoutineCompletionItems(morning, ['morning-one']));
equal(validateRoutineCompletionItems(morning, ['morning-two', 'morning-one']), ['morning-two', 'morning-one']);
morning.checklist_items.push({ id: 'added-after-first-use', label: 'Later task' });
equal(frozen.templates[0].checklist_items.length, 2);
equal(isFrozenRoutineDayComplete(frozen, completions), true);
equal(normalizeRoutineRewardSettings({}), { routine_day_points: 10, routine_points_enabled: true });
equal(normalizeRoutineRewardSettings({ routine_day_points: 0, routine_points_enabled: false }), { routine_day_points: 0, routine_points_enabled: false });
equal(normalizeRoutineRewardSettings({ routine_day_points: 7, routine_points_enabled: true }), { routine_day_points: 7, routine_points_enabled: true });
equal(normalizeRoutineRewardSettings({ routine_day_points: '7', routine_points_enabled: 'yes' }), { routine_day_points: 10, routine_points_enabled: true });
equal(validateRoutineRewardSettingsPayload({ routine_day_points: 8, routine_points_enabled: false }), { routine_day_points: 8, routine_points_enabled: false });
rejects('invalid-settings', () => validateRoutineRewardSettingsPayload({ routine_day_points: 10, routine_points_enabled: true, school_block_points: 100 }));
rejects('invalid-settings', () => validateRoutineRewardSettingsPayload({ routine_day_points: -1, routine_points_enabled: true }));
rejects('invalid-settings', () => validateRoutineRewardSettingsPayload({ routine_day_points: 1.5, routine_points_enabled: true }));
const legacyRedemption = { parent_id: parentId, student_id: studentId, status: 'fulfilled', reward_type_snapshot: 'built_in', reward_catalog_item_id: 'builtin_avatar_stargazer', built_in_key_snapshot: 'avatar_stargazer', unlock_type_snapshot: 'avatar', unlock_key_snapshot: 'stargazer' };
const state = buildRoutineCosmeticState({ parentId, studentId, now, legacyRedemptions: [legacyRedemption] });
check(state.owned_cosmetic_ids.includes(ROUTINE_REWARD_BASE_COSMETIC_ID));
check(state.owned_cosmetic_ids.includes('builtin_avatar_stargazer'));
check(state.owned_cosmetic_ids.includes('avatar_stargazer'));
equal(state.selected_cosmetic_ids, { avatar: ROUTINE_REWARD_BASE_COSMETIC_ID });
const oldTypeState = buildRoutineCosmeticState({ parentId, studentId, now, legacyRedemptions: [{ ...legacyRedemption, reward_type_snapshot: undefined, type: 'built_in' }] });
check(oldTypeState.owned_cosmetic_ids.includes('builtin_avatar_stargazer'));
const pendingState = buildRoutineCosmeticState({ parentId, studentId, now, legacyRedemptions: [{ ...legacyRedemption, status: 'requested' }] });
check(!pendingState.owned_cosmetic_ids.includes('builtin_avatar_stargazer'));
const historyState = buildRoutineCosmeticState({ parentId, studentId, now, existingState: { ...state, owned_cosmetic_ids: [...state.owned_cosmetic_ids, 'legacy_badge_not_in_catalog'] } });
check(historyState.owned_cosmetic_ids.includes('legacy_badge_not_in_catalog'));
rejects('scope-mismatch', () => buildRoutineCosmeticState({ parentId, studentId, now, legacyRedemptions: [{ ...legacyRedemption, student_id: 'sibling' }] }));
rejects('scope-mismatch', () => assertRoutineScopedRecord({ parent_id: parentId, student_id: 'sibling' }, parentId, studentId));
rejects('invalid-cosmetic-state', () => buildRoutineCosmeticState({ parentId, studentId, now, existingState: { parent_id: parentId, student_id: studentId, owned_cosmetic_ids: 'fake' } }));
equal(ROUTINE_REWARD_CATALOG.length, 4);
equal(ROUTINE_REWARD_CATALOG.map((item) => item.point_cost), [0, 20, 10, 30]);
check(ROUTINE_REWARD_CATALOG.every((item) => !Object.hasOwn(item, 'asset_url') && item.type === 'built_in'));
equal(getRoutineCatalogItem('builtin_badge_comet').unlock_type, 'badge');
rejects('unknown-cosmetic', () => getRoutineCatalogItem('parent-created-reward'));
rejects('unknown-cosmetic', () => getRoutineCatalogItem('https://fake.test/art'));
const replay = buildRoutineCosmeticUnlock({ state, wallet: { total_points: 0 }, cosmeticId: 'builtin_avatar_stargazer' });
equal(replay.already_owned, true);
equal(replay.delta_points, 0);
const unlock = buildRoutineCosmeticUnlock({ state, wallet: { total_points: 11 }, cosmeticId: 'builtin_badge_comet' });
equal(unlock.delta_points, -10);
equal(unlock.state.revision, 2);
check(unlock.state.owned_cosmetic_ids.includes('builtin_badge_comet'));
check(!state.owned_cosmetic_ids.includes('builtin_badge_comet'));
rejects('insufficient-points', () => buildRoutineCosmeticUnlock({ state, wallet: { total_points: 9 }, cosmeticId: 'builtin_badge_comet' }));
const selection = buildRoutineCosmeticSelection({ state: unlock.state, expectedRevision: 2, selectedCosmeticIds: { avatar: 'builtin_avatar_stargazer', badge: 'builtin_badge_comet', profile_theme: '' } });
equal(selection.revision, 3);
equal(selection.selected_cosmetic_ids.badge, 'builtin_badge_comet');
rejects('revision-conflict', () => buildRoutineCosmeticSelection({ state: unlock.state, expectedRevision: 1, selectedCosmeticIds: {} }));
rejects('cosmetic-not-owned', () => buildRoutineCosmeticSelection({ state, expectedRevision: 1, selectedCosmeticIds: { badge: 'builtin_badge_comet' } }));
rejects('cosmetic-not-owned', () => buildRoutineCosmeticSelection({ state, expectedRevision: 1, selectedCosmeticIds: { badge: 'builtin_avatar_stargazer' } }));
rejects('invalid-cosmetic-selection', () => buildRoutineCosmeticSelection({ state, expectedRevision: 1, selectedCosmeticIds: { arbitrary_asset: 'https://fake.test' } }));
const ledger = buildPointLedgerEntryId({ studentId, sourceType: POINT_SOURCE_TYPES.ROUTINE_COMPLETION, sourceId: `routine_day:${frozen.date_key}` });
equal(ledger, buildPointLedgerEntryId({ studentId, sourceType: 'routine_completion', sourceId: 'routine_day:2026-10-13' }));
check(ledger !== buildPointLedgerEntryId({ studentId: 'sibling', sourceType: POINT_SOURCE_TYPES.ROUTINE_COMPLETION, sourceId: `routine_day:${frozen.date_key}` }));
equal(buildAllowanceHistorySettlement({ paid_amount: 2, adjusted_earned_amount: 7 }), { paid_amount: 7, remaining_amount: 0, paid_status: 'paid' });
equal(buildAllowanceHistorySettlement({ paid_amount: 0, calculated_earned_amount: 5 }), { paid_amount: 5, remaining_amount: 0, paid_status: 'paid' });
equal(buildAllowanceHistorySettlement({ paid_amount: 2, calculated_earned_amount: 5, parent_adjustment_amount: -1 }), { paid_amount: 4, remaining_amount: 0, paid_status: 'paid' });
equal(buildAllowanceHistorySettlement({ paid_amount: 2, calculated_earned_amount: 5, parent_adjustment_amount: 2.5 }), { paid_amount: 7.5, remaining_amount: 0, paid_status: 'paid' });
rejects('obligation-already-settled', () => buildAllowanceHistorySettlement({ paid_amount: 7, adjusted_earned_amount: 7 }));
rejects('invalid-obligation', () => buildAllowanceHistorySettlement({ paid_amount: -1, adjusted_earned_amount: 7 }));

for (const value of [undefined, null, '1', -1, 0, 1.1]) equal(isProductDirectionActive({ product_direction_version: value }), false);
for (const value of [1, 2]) equal(isProductDirectionActive({ product_direction_version: value }), true);
for (const planId of ['free', 'core', 'lockdown', 'pro']) {
  const features = buildFeatureSet(planId);
  equal(features.can_use_routine_rewards, true);
  const activeAccess = resolveRoutineRewardAccess({ features, entitlementDoc: { product_direction_version: 1 } });
  equal(activeAccess.canUseRoutineRewards, true);
  equal(activeAccess.canUseChores, false);
  equal(activeAccess.canUseRewards, false);
  const inactiveAccess = resolveRoutineRewardAccess({ features, entitlementDoc: {} });
  equal(inactiveAccess.canUseRoutineRewards, false);
  equal(inactiveAccess.canUseRewards, planId !== 'free');
  equal(resolveEntitlementRecord({ parentId, entitlementDoc: { plan_id: planId } }).limits.maxStudents, planId === 'free' ? 2 : null);
}
equal(resolveRoutineRewardAccess({ features: buildFeatureSet('core', { can_use_routine_rewards: false }), entitlementDoc: { product_direction_version: 1 } }).canUseRoutineRewards, false);
equal(resolveRoutineRewardAccess({ features: buildFeatureSet('core', { can_use_routine_rewards: false }), entitlementDoc: { product_direction_version: 1 } }).canUseDailyRoutines, true);
const dailyOptOut = resolveRoutineRewardAccess({ features: buildFeatureSet('core', { can_use_daily_routines: false }), entitlementDoc: { product_direction_version: 1 } });
equal(dailyOptOut.canUseDailyRoutines, false);
equal(dailyOptOut.canUseRoutineRewards, false);
equal(resolveRoutineRewardAccess({ features: buildFeatureSet('core', { can_use_daily_routines: false }), entitlementDoc: {} }).canUseDailyRoutines, true);
const markers = { product_direction_version: 1, product_direction_migration_version: 1, product_direction_migrated_at: now };
equal(preserveProductDirectionMarkers({ ...markers, plan_id: 'core' }), markers);
const entitlementDoc = { parent_id: parentId, plan_id: 'core', subscription_status: 'active', ...markers,
  usage_snapshot: { students: 15, curriculum_items: 8 }, provider_customer_id: 'preserved_customer', provider_price_id: 'preserved_price',
  billing_state: buildEntitlementBillingState({ planId: 'core', billingProvider: 'stripe', subscriptionStatus: 'active' }),
  manual_override: { is_active: true, plan_id: 'lockdown', subscription_status: 'active', feature_overrides: { can_use_routine_rewards: false }, expires_at: new Date('2027-01-01T00:00:00Z') } };
equal(resolveEntitlementRecord({ parentId, entitlementDoc, nowMillis: now.getTime() }).product_direction_version, 1);
equal(resolveEntitlementRecord({ parentId, entitlementDoc, nowMillis: now.getTime() }).features.can_use_routine_rewards, false);
equal(buildEntitlementWriteForManualOverride({ parentId, existingEntitlement: entitlementDoc, overridePayload: { plan_id: 'free' } }).product_direction_version, 1);
equal(buildEntitlementWriteForOverrideClear({ parentId, existingEntitlement: entitlementDoc }).product_direction_version, 1);
const synced = buildEntitlementWriteForBillingSync({ parentId, existingEntitlement: entitlementDoc, billingState: buildEntitlementBillingState({ planId: 'free' }), nowMillis: now.getTime() });
equal(synced.entitlementDoc.product_direction_version, 1);
equal(synced.entitlementDoc.product_direction_migrated_at, now);
const patch = buildRoutineFirstEntitlementPatch({ parentId, entitlementDoc, activate: true, nowMillis: now.getTime() });
equal(patch.product_direction_version, 1);
equal(patch.limits.maxStudents, null);
equal(patch.features.can_use_routine_rewards, false);
check(!('billing_state' in patch) && !('manual_override' in patch) && !('usage_snapshot' in patch) && !('provider_customer_id' in patch));
equal(patch.product_direction_migrated_at, now);
const replayPatch = buildRoutineFirstEntitlementPatch({ parentId, entitlementDoc: { ...entitlementDoc, ...patch }, activate: true, nowMillis: now.getTime() + 1000 });
equal(replayPatch, patch);
equal(entitlementDoc.provider_customer_id, 'preserved_customer');
equal(entitlementDoc.manual_override.plan_id, 'lockdown');
const dormant = buildRoutineFirstEntitlementPatch({ parentId, entitlementDoc: { parent_id: parentId, plan_id: 'pro' }, activate: false, nowMillis: now.getTime() });
equal(dormant.product_direction_version, 0);
equal(dormant.plan_id, 'core');
const legacyTemporaryOverride = { parent_id: parentId, plan_id: 'free', manual_override: {
  is_active: true, plan_id: 'core', feature_overrides: {}, expires_at: new Date(now.getTime() + 1000),
} };
equal(resolveEntitlementRecord({ parentId, entitlementDoc: legacyTemporaryOverride, nowMillis: now.getTime() }).plan_id, 'core');
const legacyOverridePatch = buildRoutineFirstEntitlementPatch({ parentId, entitlementDoc: legacyTemporaryOverride, activate: true, nowMillis: now.getTime() });
equal(legacyOverridePatch.plan_id, 'free');
equal(legacyOverridePatch.limits.maxStudents, null);
equal(resolveEntitlementRecord({ parentId, entitlementDoc: { ...legacyTemporaryOverride, ...legacyOverridePatch }, nowMillis: now.getTime() + 2000 }).plan_id, 'free');
check(!('billing_state' in legacyOverridePatch));
rejects('invalid-entitlement-migration', () => buildRoutineFirstEntitlementPatch({ parentId: 'other-parent', entitlementDoc }));
console.log(`Routine reward backend helpers passed (${count} assertions; no backend reads/writes).`);
