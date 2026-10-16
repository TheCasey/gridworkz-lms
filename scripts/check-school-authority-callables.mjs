import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { buildDirectionFixture } from './product-direction-fixtures.mjs';
import { createDirectionAdmin, callDirectionFunction as call, signInDirectionParent, directionStudentContext } from './product-direction-emulator-api.mjs';
import { buildTrustedSchoolPolicyTimers } from '../functions/src/schoolLockdownFoundation.js';
const { app, db } = createDirectionAdmin();
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { deleteApp } = require('firebase-admin/app');
const { Timestamp } = require('firebase-admin/firestore');
const fixture = buildDirectionFixture({ scenario: 'corrections' });
const student = fixture.students[0]; const sibling = fixture.students[1];
const context = directionStudentContext(student);
const initial = fixture.documents.find((item) => item.collection === 'weeklyPlans' && item.data.student_id === student.id);
const week = initial.data.week_key;
let token; let serial = 0;
const nonce = () => `school-runtime-${++serial}`;
const ok = (body) => { assert.ok(body.result, JSON.stringify(body)); return body.result; };
const deny = (body, status, code) => { assert.equal(body.error?.status, status, JSON.stringify(body)); if (code) assert.equal(body.error.details?.code, code, JSON.stringify(body)); };
const read = async (collection, id) => (await db.collection(collection).doc(id).get()).data();
const school = async () => ok(await call('getStudentSchoolState', context));
const target = (state, timed = false) => state.weekly_plan.blocks.find((block) => block.require_timer === timed);
const correct = (state, block, status = 'completed') => ({ student_id: student.id, week_key: week, weekly_block_id: block.id,
  expected_revision: state.blocks.find((item) => item.weekly_block_id === block.id).revision, new_status: status, reason: 'Parent observed practice', note: 'Preserve student evidence', idempotency_key: nonce() });
const submission = (state, block) => ({ ...context, week_key: week, weekly_block_id: block.id,
  expected_revision: state.blocks.find((item) => item.weekly_block_id === block.id).revision, idempotency_key: nonce(),
  summary_text: block.require_input ? 'A complete student reflection about the work and what was learned. '.repeat(4) : '', resources_used: [], custom_field_responses: {} });
const publish = async (plan, links) => call('publishWeeklyPlan', { student_id: student.id, week_key: week,
  expected_draft_revision: (await read('weeklyPlanDrafts', initial.id))?.revision || 0,
  expected_published_revision: (await read('weeklyPlans', initial.id))?.revision || 0, idempotency_key: nonce(),
  candidate: { id: initial.id, parent_id: fixture.parentId, student_id: student.id, week_key: week,
    blocks: plan.blocks, assignment_ids: [...new Set(plan.blocks.map((item) => item.assignment_id))], weekly_exceptions: [], ...(links ? { legacy_source_links: links } : {}) } }, token);
before(async () => {
  await promisify(execFile)(process.execPath, ['scripts/seed-product-direction-fixtures.mjs', '--scenario=corrections', '--write'], { env: process.env });
  token = await signInDirectionParent(fixture);
});
beforeEach(async () => {
  await promisify(execFile)(process.execPath, ['scripts/seed-product-direction-fixtures.mjs', '--scenario=corrections', '--write'], { env: process.env });
});
after(() => deleteApp(app));

test('school reads require correct PIN and bound student context; corrections require owner identity', async () => {
  deny(await call('getStudentSchoolState', { ...context, access_pin: '0000' }), 'PERMISSION_DENIED');
  deny(await call('getStudentSchoolState', { ...context, student_id: sibling.id }), 'PERMISSION_DENIED');
  const state = await school(); const block = target(state);
  const request = correct(state, block);
  deny(await call('correctSchoolBlock', request), 'UNAUTHENTICATED');
  deny(await call('correctSchoolBlock', { ...request, student_id: 'foreign_student' }, token), 'PERMISSION_DENIED');
  deny(await call('correctSchoolBlock', { ...request, actor_id: student.id }, token), 'INVALID_ARGUMENT');
  deny(await call('submitSchoolBlock', { ...submission(state, block), trusted_elapsed_ms: 60000 }), 'INVALID_ARGUMENT');
});

test('parent completion is idempotent zero-time provenance without fabricated student submissions or points', async () => {
  const state = await school(); const block = target(state); const request = correct(state, block);
  const wallet = await read('studentPointWallets', student.id);
  const result = ok(await call('correctSchoolBlock', request, token));
  assert.equal(result.revision, 1);
  assert.equal(ok(await call('correctSchoolBlock', request, token)).replayed, true);
  deny(await call('correctSchoolBlock', { ...request, note: 'changed retry' }, token), 'ABORTED', 'idempotency-conflict');
  const current = await school();
  assert.equal(current.blocks.find((item) => item.weekly_block_id === block.id).provenance, 'parent_correction');
  assert.equal((await db.collection('submissions').where('student_id', '==', student.id).get()).size, 0);
  assert.deepEqual(await read('studentPointWallets', student.id), wallet);
  const event = await read('parentCorrectionEvents', result.event_id);
  assert.equal(event.actor_id, fixture.parentId); assert.ok(event.recorded_at.toMillis() > 0);
});

test('student evidence survives undo and resubmission; two parent devices cannot commit a stale revision', async () => {
  let state = await school(); const block = target(state);
  const first = ok(await call('submitSchoolBlock', submission(state, block)));
  const evidence = await read('submissions', first.submission_id);
  state = await school();
  const undo = correct(state, block, 'incomplete');
  const race = await Promise.all([call('correctSchoolBlock', undo, token), call('correctSchoolBlock', { ...undo, idempotency_key: nonce() }, token)]);
  assert.equal(race.filter((item) => item.result).length, 1);
  deny(race.find((item) => item.error), 'ABORTED', 'revision-conflict');
  state = await school();
  assert.equal(state.blocks.find((item) => item.weekly_block_id === block.id).status, 'incomplete');
  assert.deepEqual(await read('submissions', first.submission_id), evidence);
  const second = ok(await call('submitSchoolBlock', submission(state, block)));
  assert.notEqual(second.submission_id, first.submission_id);
  const final = (await school()).blocks.find((item) => item.weekly_block_id === block.id);
  assert.equal(final.revision, 3); assert.equal(final.status, 'completed'); assert.equal(final.evidence_count, 2);
});

test('server timer blocks early completion, survives non-timed work and preserves elapsed time across pause/resume', async () => {
  let state = await school(); const timed = target(state, true); const untimed = target(state);
  const command = (action, timer) => ({ ...context, week_key: week, weekly_block_id: timed.id, expected_revision: 0,
    idempotency_key: nonce(), action, ...(timer ? { timer_session_id: timer.session_id } : {}) });
  const start = ok(await call('commandStudentSchoolTimer', command('start')));
  const submit = { ...submission(state, timed), timer_session_id: start.timer.session_id };
  deny(await call('submitSchoolBlock', submit), 'FAILED_PRECONDITION', 'timer-not-complete');
  ok(await call('submitSchoolBlock', submission(state, untimed)));
  assert.equal((await school()).timer.session_id, start.timer.session_id);
  const paused = ok(await call('commandStudentSchoolTimer', command('pause', start.timer)));
  assert.equal(paused.timer.status, 'paused');
  const resumed = ok(await call('commandStudentSchoolTimer', command('resume', paused.timer)));
  assert.ok(resumed.timer.elapsed_ms >= paused.timer.elapsed_ms);
  // Only Admin backdates this emulator fixture. Client clock/elapsed fields are rejected above.
  await db.collection('timerSessions').doc(student.id).update({ started_at_ms: Date.now() - 61000, target_end_ms: Date.now() - 1000 });
  const submitted = ok(await call('submitSchoolBlock', { ...submit, idempotency_key: nonce() }));
  assert.equal((await read('submissions', submitted.submission_id)).block_duration, 1);
  assert.equal((await school()).timer, null);
  state = await school();
  ok(await call('correctSchoolBlock', correct(state, timed, 'incomplete'), token));
  deny(await call('submitSchoolBlock', { ...submit, expected_revision: 2, idempotency_key: nonce() }), 'FAILED_PRECONDITION', 'timer-not-complete');
});

test('parent correction releases its timer and trusted policy never revives old timer rows', async () => {
  const state = await school(); const block = target(state, true);
  ok(await call('commandStudentSchoolTimer', { ...context, week_key: week, weekly_block_id: block.id, expected_revision: 0, idempotency_key: nonce(), action: 'start' }));
  const running = await school();
  assert.equal(buildTrustedSchoolPolicyTimers({ schoolState: running, studentId: student.id, nowMs: Date.now() }).length, 1);
  ok(await call('correctSchoolBlock', correct(running, block), token));
  const completed = await school(); assert.equal(completed.timer, null);
  assert.deepEqual(buildTrustedSchoolPolicyTimers({ schoolState: { ...completed, timer: running.timer }, studentId: student.id, nowMs: Date.now() }), []);
});

test('saved reports remain byte-identical as linked amendments reflect corrections', async () => {
  const state = await school(); const block = target(state);
  const id = `${fixture.parentId}_school_report`;
  const original = { id, parent_id: fixture.parentId, student_id: student.id, week_key: week, weekly_plan_id: state.weekly_plan_id,
    snapshot_model: 'weekly_plan', report_version: 1, total_blocks: 0, weekly_goal: state.blocks.length, total_hours: 0,
    subjects_data: { [block.legacy_subject_id]: { totalBlocks: 0, summaries: [] } },
    assigned_blocks_snapshot: [{ blockId: block.id, assignmentId: block.assignment_id, legacySubjectId: block.legacy_subject_id, legacyBlockIndex: block.legacy_block_index, completed: false }] };
  await db.collection('weeklyReports').doc(id).set(original);
  const result = ok(await call('correctSchoolBlock', correct(state, block), token));
  assert.deepEqual(await read('weeklyReports', id), original);
  const amendment = await read('weeklyReportAmendments', result.amendment_ids[0]);
  assert.equal(amendment.report_version, 2); assert.equal(amendment.snapshot.total_blocks, 1); assert.equal(amendment.snapshot.total_hours, 0);
  assert.equal((await read('schoolReportAmendmentHeads', id)).latest_amendment_id, amendment.id);
});

test('first publication requires explicit identity reconciliation and preserves prior correction and student evidence', async () => {
  await db.collection('weeklyPlans').doc(initial.id).delete(); await db.collection('weeklyPlanDrafts').doc(initial.id).delete();
  let state = await school(); const block = target(state); const timed = target(state, true);
  const event = ok(await call('correctSchoolBlock', correct(state, timed), token));
  const evidence = ok(await call('submitSchoolBlock', submission(state, block)));
  const originalEvent = await read('parentCorrectionEvents', event.event_id); const originalEvidence = await read('submissions', evidence.submission_id);
  const before = await school();
  deny(await publish(initial.data), 'FAILED_PRECONDITION', 'legacy-link-review-required');
  const links = Object.fromEntries(initial.data.blocks.map((candidate) => {
    const source = state.weekly_plan.blocks.find((item) => item.legacy_subject_id === candidate.legacy_subject_id && item.legacy_block_index === candidate.legacy_block_index);
    // Test fixture explicitly knows the correspondence; production UI requires a parent choice.
    return [candidate.id, source.id];
  }));
  ok(await publish(initial.data, links));
  state = await school();
  for (const item of state.blocks) {
    const prior = before.blocks.find((source) => source.weekly_block_id === links[item.weekly_block_id]);
    assert.equal(item.status, prior.status); assert.equal(item.revision, prior.revision); assert.equal(item.evidence_count, prior.evidence_count);
  }
  assert.deepEqual(await read('parentCorrectionEvents', event.event_id), originalEvent);
  assert.deepEqual(await read('submissions', evidence.submission_id), originalEvidence);
  const bridge = await read('schoolPublicationBridges', initial.id); assert.ok(bridge.inherited_states);
  assert.equal((await read('weeklyPlans', initial.id)).legacy_source_links, undefined);
  assert.equal((await read('weeklyPlans', initial.id)).school_completion_version, 1);
});

test('empty publication and adoption suppress legacy execution and missing current-week fallback', async () => {
  await school(); ok(await publish({ ...initial.data, blocks: [] }));
  assert.deepEqual((await school()).blocks, []);
  await db.collection('weeklyPlans').doc(initial.id).delete();
  const empty = await school(); assert.equal(empty.authority_kind, 'empty'); assert.deepEqual(empty.blocks, []);
});

test('historical reports without assignment attribution refuse correction rather than inventing block history', async () => {
  const past = new Date(`${week}T12:00Z`); past.setUTCDate(past.getUTCDate() - 7); const pastKey = past.toISOString().slice(0, 10);
  await db.collection('weeklyReports').doc(`${fixture.parentId}_ambiguous`).set({ parent_id: fixture.parentId, student_id: student.id, week_key: pastKey,
    snapshot_model: 'subjects', weekly_plan_id: '', subjects_data: { [fixture.subjects[0].id]: { totalBlocks: 1 } }, week_start: Timestamp.fromDate(past), week_end: Timestamp.fromMillis(past.getTime() + 60000) });
  deny(await call('correctSchoolBlock', { student_id: student.id, week_key: pastKey, weekly_block_id: initial.data.blocks[0].id,
    expected_revision: 0, new_status: 'incomplete', reason: 'Review', note: '', idempotency_key: nonce() }, token), 'FAILED_PRECONDITION', 'historical-assignment-review-required');
  assert.equal((await db.collection('parentCorrectionEvents').where('parent_id', '==', fixture.parentId).get()).size, 0);
});

test('raw legacy evidence survives direct first publish without a prior trusted read', async () => {
  await db.collection('weeklyPlans').doc(initial.id).delete(); await db.collection('weeklyPlanDrafts').doc(initial.id).delete();
  const subject = fixture.subjects[1];
  await db.collection('submissions').doc('school-raw-before-first-read').set({ parent_id: fixture.parentId, student_id: student.id,
    subject_id: subject.id, block_index: 0, timestamp: Timestamp.now(), summary_text: 'Actual legacy evidence', block_duration: 0 });
  const { buildLegacySchoolExecution } = await import('../functions/src/schoolCompletionContracts.js');
  const { resolvePlanningWeek } = await import('../functions/src/weeklyPlanningContracts.js');
  const source = buildLegacySchoolExecution({ parentId: fixture.parentId, studentId: student.id, weekKey: week, subjects: fixture.subjects,
    serverTime: Timestamp.now(), range: resolvePlanningWeek({ weekKey: week, settings: fixture.settings, now: new Date() }) });
  const candidate = { ...source, blocks: source.blocks.map((block) => ({ ...block, instance_key: `legacy-index:${block.legacy_block_index}` })) };
  ok(await publish(candidate));
  const state = await school();
  assert.equal(state.blocks.find((item) => item.legacy_subject_id === subject.id && item.legacy_block_index === 0).status, 'completed');
  assert.equal((await read('schoolPublicationBridges', initial.id)).source_kind, 'legacy_execution');
});

test('Phase4 publication keeps legacy evidence on first authority republish without inventing events', async () => {
  const old = { ...initial.data }; delete old.school_completion_version;
  await db.collection('weeklyPlans').doc(initial.id).set(old);
  await db.collection('students').doc(student.id).update({ weekly_planning_version: 1 });
  const block = old.blocks.find((item) => !item.require_timer);
  await db.collection('submissions').doc('school-raw-before-republish').set({ parent_id: fixture.parentId, student_id: student.id,
    subject_id: block.legacy_subject_id, block_index: block.legacy_block_index, timestamp: Timestamp.now(), summary_text: 'Old published evidence', block_duration: 5 });
  ok(await publish(old));
  const state = await school(); assert.equal(state.blocks.find((item) => item.weekly_block_id === block.id).status, 'completed');
  const bridge = await read('schoolPublicationBridges', initial.id);
  assert.equal(bridge.source_kind, 'published'); assert.equal(bridge.source_execution_id, initial.id);
  assert.equal((await db.collection('parentCorrectionEvents').where('parent_id', '==', fixture.parentId).get()).size, 0);
});

test('trusted report filing serializes with a simultaneous correction and preserves the original on replay', async () => {
  const state = await school(); const block = target(state);
  const file = { student_id: student.id, week_key: week, source: 'manual', idempotency_key: nonce() };
  deny(await call('fileSchoolWeeklyReport', file), 'UNAUTHENTICATED');
  const [filed] = await Promise.all([call('fileSchoolWeeklyReport', file, token), call('correctSchoolBlock', correct(state, block), token)]);
  ok(filed);
  const original = await read('weeklyReports', initial.id);
  const head = await read('schoolReportAmendmentHeads', initial.id);
  const latest = head ? (await read('weeklyReportAmendments', head.latest_amendment_id)).snapshot : original;
  assert.equal(latest.total_blocks, 1); assert.equal(latest.total_hours, 0);
  assert.equal(original.authority_version, 1); assert.equal(original.assigned_blocks_snapshot.length, state.blocks.length);
  assert.equal(original.total_minutes, 0); assert.equal(original.timezone, fixture.settings.timezone);
  assert.equal(original.published_revision, initial.data.revision);
  assert.equal(latest.correction_events[0].reason, 'Parent observed practice');
  assert.ok(latest.correction_watermark.event_ids.length);
  assert.equal(ok(await call('fileSchoolWeeklyReport', file, token)).replayed, true);
  assert.deepEqual(await read('weeklyReports', initial.id), original);
});

test('archived corrections create explicit amendments without reactivating archived work', async () => {
  const currentSchool = await school(); const currentBlock = target(currentSchool, true);
  ok(await call('commandStudentSchoolTimer', { ...context, week_key: week, weekly_block_id: currentBlock.id, expected_revision: 0, action: 'start', idempotency_key: nonce() }));
  const runningTimer = await read('timerSessions', student.id);
  const past = new Date(`${week}T12:00Z`); past.setUTCDate(past.getUTCDate() - 7); const pastKey = past.toISOString().slice(0, 10);
  const { resolvePlanningWeek } = await import('../functions/src/weeklyPlanningContracts.js');
  const range = resolvePlanningWeek({ weekKey: pastKey, settings: fixture.settings, now: new Date() });
  const id = `${fixture.parentId}_${student.id}_${pastKey}`;
  await db.collection('weeklyPlans').doc(id).set({ ...initial.data, id, week_key: pastKey, week_start: range.weekStart, week_end: range.weekEnd, status: 'archived' });
  ok(await call('fileSchoolWeeklyReport', { student_id: student.id, week_key: pastKey, source: 'manual', idempotency_key: nonce() }, token));
  const original = await read('weeklyReports', id);
  const block = initial.data.blocks[0];
  const result = ok(await call('correctSchoolBlock', { student_id: student.id, week_key: pastKey, weekly_block_id: block.id,
    expected_revision: 0, new_status: 'completed', reason: 'Historical parent correction', note: '', idempotency_key: nonce() }, token));
  assert.deepEqual(await read('weeklyReports', id), original);
  assert.equal((await read('weeklyReportAmendments', result.amendment_ids[0])).snapshot.total_blocks, 1);
  assert.equal((await read('weeklyPlans', id)).status, 'archived');
  assert.deepEqual(await read('timerSessions', student.id), runningTimer);
  const current = await school(); assert.equal(current.week_key, week); assert.equal(current.blocks[0].status, 'incomplete');
});


test('new filing intents can file newly published work after empty filing or deliberate original deletion', async () => {
  ok(await publish({ ...initial.data, blocks: [] }));
  const request = () => ({ student_id: student.id, week_key: week, source: 'manual', idempotency_key: nonce() });
  assert.equal(ok(await call('fileSchoolWeeklyReport', request(), token)).created, false);
  ok(await publish(initial.data));
  assert.equal(ok(await call('fileSchoolWeeklyReport', request(), token)).created, true);
  await db.collection('weeklyReports').doc(initial.id).delete();
  assert.equal(ok(await call('fileSchoolWeeklyReport', request(), token)).created, true);
  assert.ok(await read('weeklyReports', initial.id));
});
