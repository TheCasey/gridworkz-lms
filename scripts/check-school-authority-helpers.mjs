import { createWeeklyPlanningService } from '../functions/src/weeklyPlanningAuthority.js';
import { buildSchoolPublicationBridge, resolveSchoolPublicationLinks, getInheritedSchoolPublicationState,
  resolveSchoolReportCorrectionTarget } from '../functions/src/schoolPublicationBridge.js';
import assert from 'node:assert/strict';
import * as canonical from '../functions/src/schoolCompletionFoundation.js';
import * as frontend from '../src/utils/productDirectionContracts.js';
import * as legacy from '../functions/src/schoolLegacyFoundation.js';
import * as compat from '../src/utils/planningCompatibilityUtils.js';
import { buildLegacySchoolExecution, buildHistoricalSchoolExecution, validateSchoolPayload } from '../functions/src/schoolCompletionContracts.js';
import { createSchoolCompletionService, amendSchoolReportSnapshot } from '../functions/src/schoolCompletionAuthority.js';
const throws = (code, fn) => assert.throws(fn, (error) => error.code === code);
const parentId = 'parent'; const studentId = 'student'; const weekKey = '2026-10-12';
const block = { id: 'block-a', assignment_id: 'assignment', student_id: studentId, legacy_subject_id: 'math', legacy_block_index: 0,
  title: 'Math', instruction: '', resources: [{ name: 'Book', url: 'https://example.com' }], custom_fields: [{ id: 'answer', type: 'text', required: true }],
  category: 'lesson', completion_mode: 'task_complete', require_timer: false, require_input: true, planned_duration_minutes: 1 };
const plan = { id: `${parentId}_${studentId}_${weekKey}`, parent_id: parentId, student_id: studentId, week_key: weekKey, status: 'published', blocks: [block] };
const original = { id: 'legacy-evidence', parent_id: parentId, student_id: studentId, subject_id: 'math', block_index: 0, manual_override: true, timestamp: new Date('2026-10-13T00:00Z') };
const state = canonical.resolveEffectiveSchoolBlockState({ plan, block, evidence: [original] });
assert.equal(state.provenance, 'legacy_parent'); assert.equal(state.actor_id, null);
const request = { new_status: 'incomplete', expected_revision: 0, reason: 'Correction', note: 'Private parent note', idempotency_key: 'undo' };
const scope = Object.fromEntries(['parent_id', 'student_id', 'week_key', 'weekly_plan_id', 'weekly_block_id'].map((key) => [key, state[key]]));
const options = { plan, request, currentState: state, originalEvidence: [{ ...original, ...scope }], actorId: parentId, serverTime: new Date() };
assert.deepEqual(canonical.buildParentCorrection(options), frontend.buildParentCorrection(options), 'Canonical/browser correction parity');
const correction = canonical.buildParentCorrection(options);
assert.equal(correction.state.status, 'incomplete'); assert.deepEqual(correction.state.original_evidence_ids, ['legacy-evidence']);
assert.equal(canonical.resolveEffectiveSchoolBlockState({ plan, block, state: correction.state, evidence: [original] }).status, 'incomplete');
assert.equal(JSON.stringify(canonical.projectStudentSchoolBlockState(correction.state, block)).includes('Private parent note'), false);
throws('unsupported-contract-version', () => canonical.resolveEffectiveSchoolBlockState({ plan, block, state: { ...state, schema_version: 2 } }));
throws('invalid-state-identity', () => canonical.resolveEffectiveSchoolBlockState({ plan, block, state: { ...state, id: 'forged' } }));
throws('invalid-evidence-references', () => canonical.resolveEffectiveSchoolBlockState({ plan, block, state: { ...state, original_evidence_ids: ['same', 'same'] } }));
throws('revision-conflict', () => canonical.buildParentCorrection({ ...options, currentState: correction.state }));
throws('unsupported-correction-field', () => canonical.buildParentCorrection({ ...options, request: { ...request, actor_id: parentId } }));
throws('unsupported-request-field', () => validateSchoolPayload({ student_id: studentId, week_key: weekKey, actor_id: parentId }, 'read'));
const response = { summary_text: 'Completed practice. '.repeat(10), custom_field_responses: { answer: '42' }, resources_used: [0] };
canonical.validateSchoolStudentResponse(response, block);
throws('missing-required-response', () => canonical.validateSchoolStudentResponse({ ...response, custom_field_responses: {} }, block));
throws('invalid-resources', () => canonical.validateSchoolStudentResponse({ ...response, resources_used: [1] }, block));
const timedBlock = { ...block, require_timer: true };
const initial = canonical.resolveEffectiveSchoolBlockState({ plan, block });
const timer = canonical.buildSchoolTimerCommand({ action: 'start', sessionId: 'issued', currentTimer: null, plan, block: timedBlock, state: initial, nowMs: 100000 });
assert.equal(timer.target_end_ms, 160000);
assert.equal(canonical.trustedSchoolTimerElapsedMs(timer, 130000), 30000);
const paused = canonical.buildSchoolTimerCommand({ action: 'pause', sessionId: 'issued', currentTimer: timer, plan, block: timedBlock, state: initial, nowMs: 130000 });
assert.equal(canonical.trustedSchoolTimerElapsedMs(paused, 200000), 30000);
const resumed = canonical.buildSchoolTimerCommand({ action: 'resume', sessionId: 'issued', currentTimer: paused, plan, block: timedBlock, state: initial, nowMs: 200000 });
assert.equal(resumed.target_end_ms, 230000);
assert.equal(canonical.schoolTimerContext(plan, timedBlock, 0), canonical.schoolTimerContext({ ...plan, revision: 900 }, timedBlock, 0));
throws('stale-timer-context', () => canonical.buildSchoolTimerCommand({ action: 'resume', sessionId: 'issued', currentTimer: paused, plan, block: { ...timedBlock, planned_duration_minutes: 2 }, state: initial, nowMs: 200000 }));
throws('another-timer-active', () => canonical.buildSchoolTimerCommand({ action: 'start', sessionId: 'b', currentTimer: timer, plan, block: { ...timedBlock, id: 'block-b' }, state: initial, nowMs: 200000 }));
const subjects = [{ id: 'math', parent_id: parentId, student_ids: [studentId], require_timer: false, require_input: false, block_count: 2, block_length: 5 }];
assert.deepEqual(legacy.buildLegacySubjectWeeklyBlockSeeds({ subject: subjects[0], studentId }), compat.buildLegacySubjectWeeklyBlockSeeds({ subject: subjects[0], studentId }));
const execution = buildLegacySchoolExecution({ parentId, studentId, weekKey, subjects, serverTime: new Date(), range: { weekStart: new Date(), weekEnd: new Date() } });
assert.equal(execution.blocks.length, 2);
throws('historical-assignment-review-required', () => buildHistoricalSchoolExecution({ parentId, studentId, weekKey, reports: [], serverTime: new Date() }));
const originalReport = { id: 'report', parent_id: parentId, student_id: studentId, week_key: weekKey, weekly_plan_id: plan.id, snapshot_model: 'weekly_plan',
  total_blocks: 1, total_hours: 1, subjects_data: { math: { totalBlocks: 1, totalMinutes: 60, summaries: ['keep'] } },
  assigned_blocks_snapshot: [{ blockId: block.id, legacySubjectId: 'math', legacyBlockIndex: 0, completed: true, matchedSubmissionSummary: { summaryText: 'original' } }] };
const amended = amendSchoolReportSnapshot(originalReport, block, correction.state);
assert.equal(amended.total_blocks, 0); assert.equal(originalReport.total_blocks, 1); assert.equal(amended.total_hours, 1);
assert.equal(amended.assigned_blocks_snapshot[0].matchedSubmissionSummary.summaryText, 'original');
const amendmentOptions = { originalReport, correctionEvents: [correction.event], amendedSnapshot: amended, expectedVersion: 1, actorId: parentId, serverTime: new Date() };
assert.deepEqual(canonical.buildReportAmendment(amendmentOptions), frontend.buildReportAmendment(amendmentOptions));
const subjectOnly = { ...originalReport, snapshot_model: 'subjects', weekly_plan_id: '', assigned_blocks_snapshot: [] };
assert.equal(amendSchoolReportSnapshot(subjectOnly, block, correction.state).completion_counts_require_review, true);

// Adapter contract harness: atomic writes, no reads after writes, bounded queries and immutable creates.
class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
let date = new Date('2026-10-14T17:00:00Z');
const stamp = (value) => ({ toDate: () => value, toMillis: () => value.getTime() });
const Timestamp = { now: () => stamp(date), fromDate: stamp };
const store = new Map([['parents/parent', { timezone: 'America/Chicago' }], ['students/student', { parent_id: parentId, access_pin: '1234', weekly_planning_version: 1 }], [`weeklyPlans/${plan.id}`, plan]]);
const snapshot = (id, value) => ({ id, exists: value !== undefined, data: () => value });
const query = (collection, predicates = [], maximum = Infinity) => ({ collection, predicates, maximum,
  doc: (id) => ({ path: `${collection}/${id}`, id }),
  where: (key, op, value) => query(collection, [...predicates, [key, op, value]], maximum), limit: (limit) => query(collection, predicates, limit) });
const queryReads = [];
let transactionRetries = 0;
const matchingEntries = (target) => [...store].filter(([path, value]) => path.startsWith(`${target.collection}/`) && target.predicates.every(([key, op, expected]) => {
  const left = value[key]?.toMillis?.() ?? value[key]; const right = expected?.toMillis?.() ?? expected;
  return op === 'array-contains' ? Array.isArray(left) && left.includes(right) : op === '==' ? left === right : op === '>=' ? left >= right : left <= right;
})).slice(0, target.maximum);
const db = { collection: query, runTransaction: async (fn) => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const writes = []; const reads = new Map(); const queries = [];
    const tx = { get: async (target) => {
      assert.equal(writes.length, 0, 'All reads precede writes');
      if (target.path) { const value = store.get(target.path); reads.set(target.path, value); return snapshot(target.id, value); }
      queryReads.push(target);
      const entries = matchingEntries(target); queries.push([target, entries]);
      const docs = entries.map(([path, value]) => snapshot(path.slice(path.indexOf('/') + 1), value));
      return { docs, size: docs.length };
    }, create: (target, value) => writes.push([target.path, value, true]),
    set: (target, value) => writes.push([target.path, value]), update: (target, value) => writes.push([target.path, { ...store.get(target.path), ...value }]) };
    const result = await fn(tx);
    const changed = [...reads].some(([path, value]) => store.get(path) !== value) || queries.some(([target, entries]) => {
      const current = matchingEntries(target); return current.length !== entries.length || current.some(([path, value], index) => path !== entries[index][0] || value !== entries[index][1]);
    });
    if (changed) { transactionRetries++; continue; }
    writes.forEach(([path, , create]) => { if (create) assert.equal(store.has(path), false, 'Immutable create'); });
    writes.forEach(([path, value]) => store.set(path, value)); return result;
  }
  throw new Error('Transaction harness retry limit');
} };
const service = createSchoolCompletionService({ db, Timestamp, HttpsError, resolveTrustedStudentContext: async (payload) => {
  if (payload.access_pin !== '1234') throw new HttpsError('permission-denied', 'PIN denied');
  return { parentId, studentId, studentRecord: store.get('students/student') };
} });
const context = { student_id: studentId, access_pin: '1234' };
const firstRead = await service.read({ payload: context }); assert.equal(firstRead.blocks[0].revision, 0); assert.equal(firstRead.school_state_revision, 1);
assert.equal((await service.read({ payload: context })).school_state_revision, 1, 'Read does not cause refresh loops');
store.set('weeklyReports/report', originalReport);
const submitPayload = { ...context, week_key: weekKey, weekly_block_id: block.id, expected_revision: 0, idempotency_key: 'submit-a', ...response };
const submitted = await service.submit({ payload: submitPayload }); assert.equal(submitted.revision, 1);
assert.equal((await service.submit({ payload: submitPayload })).replayed, true);
const correctionPayload = { student_id: studentId, week_key: weekKey, weekly_block_id: block.id, ...request, expected_revision: 1 };
const undone = await service.correct({ parentId, payload: correctionPayload }); assert.equal(undone.revision, 2);
assert.equal((await service.correct({ parentId, payload: correctionPayload })).replayed, true);
assert.equal(store.get('weeklyReports/report').total_blocks, 1, 'Original report unchanged');
assert.equal(store.get('schoolReportAmendmentHeads/report').report_version, 2);
assert.equal(store.get(`weeklyReportAmendments/${undone.amendment_ids[0]}`).snapshot.total_blocks, 0);
assert.equal((await service.read({ payload: context })).blocks[0].status, 'incomplete');
await assert.rejects(service.submit({ payload: { ...submitPayload, idempotency_key: 'stale' } }), (error) => error.details.code === 'revision-conflict');
const resubmitted = await service.submit({ payload: { ...submitPayload, expected_revision: 2, idempotency_key: 'submit-b' } });
assert.equal(resubmitted.revision, 3); assert.notEqual(resubmitted.submission_id, submitted.submission_id);
assert.equal([...store].filter(([path]) => path.startsWith('submissions/')).length, 2);
await assert.rejects(service.correct({ parentId: 'attacker', payload: correctionPayload }), (error) => error.code === 'permission-denied');
await assert.rejects(service.read({ payload: { ...context, access_pin: 'wrong' } }), (error) => error.code === 'permission-denied');
await assert.rejects(service.submit({ payload: { ...submitPayload, actor_id: studentId } }), (error) => error.details.code === 'unsupported-request-field');
// Server elapsed proof cannot be replaced by forged mutable timerSessions.
store.set(`weeklyPlans/${plan.id}`, { ...plan, blocks: [timedBlock] });
const timedState = await service.correct({ parentId, payload: { ...correctionPayload, expected_revision: 3, idempotency_key: 'undo-timed' } });
const timerPayload = { ...context, week_key: weekKey, weekly_block_id: block.id, expected_revision: timedState.revision, idempotency_key: 'timer-start', action: 'start' };
const started = await service.timer({ payload: timerPayload }); assert.equal(started.timer.duration_ms, 60000);
await assert.rejects(service.submit({ payload: { ...submitPayload, expected_revision: timedState.revision, idempotency_key: 'too-early', timer_session_id: started.timer.session_id } }), (error) => error.details.code === 'timer-not-complete');
date = new Date(date.getTime() + 61000);
await service.submit({ payload: { ...submitPayload, expected_revision: timedState.revision, idempotency_key: 'timer-done', timer_session_id: started.timer.session_id } });
assert.equal(store.get('timerSessions/student').status, 'released');
store.set(`weeklyPlans/${plan.id}`, { ...plan, blocks: [] });
const empty = await service.read({ payload: context }); assert.deepEqual(empty.blocks, []); assert.equal(empty.timer, null);
store.set(`weeklyPlans/${plan.id}`, { ...plan, status: 'archived' });
assert.deepEqual((await service.read({ payload: context })).blocks, [], 'Archived current work never reopens');
assert.equal([...store].some(([path]) => path.startsWith('pointLedgerEntries/')), false);
console.log('School authority helpers passed: canonical parity, provenance, scope, safe projection, response validation, trusted timers, atomic revision/replay/undo/resubmit, PIN/owner/forged-field denial, report preservation, empty authority. Pure harness only; persisted runtime tests remain separate.');

// First-publication continuity: frozen source, immutable inherited baseline,
// explicit reconciliation of differing draft IDs, and canonical override wins.
store.clear(); date = new Date('2026-10-14T17:00:00Z');
store.set('parents/parent', { timezone: 'America/Chicago' });
store.set('students/student', { parent_id: parentId, access_pin: '1234' });
const legacySubject = { id: 'math', parent_id: parentId, student_ids: [studentId], student_id: studentId,
  title: 'Math', require_timer: false, require_input: false, block_length: 5,
  curriculum_blocks: [{ id: 'practice', title: 'Practice', default_quantity: 2, require_timer: false, require_input: false }] };
store.set('subjects/math', legacySubject);
for (let index = 0; index < 201; index++) store.set(`subjects/unrelated-${index}`, { ...legacySubject, id: `unrelated-${index}`, student_ids: ['sibling'], student_id: 'sibling' });
const legacyRead = await service.read({ payload: context });
assert.equal(legacyRead.weekly_plan.blocks.length, 2, 'Assigned queries deduplicate legacy and multi-student assignment');
const frozen = store.get(`schoolExecutionSnapshots/${legacyRead.weekly_plan_id}`);
const sourceA = frozen.blocks[0]; const sourceB = frozen.blocks[1];
const legacyComplete = await service.correct({ parentId, payload: { ...correctionPayload, weekly_block_id: sourceA.id, expected_revision: 0, new_status: 'completed', idempotency_key: 'legacy-parent-complete' } });
assert.equal(legacyComplete.revision, 1);
const legacyStudentEvidence = await service.submit({ payload: { ...submitPayload, weekly_block_id: sourceB.id, idempotency_key: 'legacy-evidence', expected_revision: 0, summary_text: '', custom_field_responses: {}, resources_used: [] } });
const targetA = { ...sourceA, id: 'target-a', instance_key: 'target-a' };
const targetB = { ...sourceB, id: 'target-b', instance_key: 'target-b' };
const publishCandidate = { id: plan.id, parent_id: parentId, student_id: studentId, week_key: weekKey,
  blocks: [targetA, targetB], assignment_ids: [sourceA.assignment_id], weekly_exceptions: [] };
const planning = createWeeklyPlanningService({ db, Timestamp, HttpsError });
const publishPayload = { student_id: studentId, week_key: weekKey, candidate: publishCandidate,
  expected_draft_revision: 0, expected_published_revision: 0, idempotency_key: 'bridge-publish' };
await assert.rejects(planning.publish({ parentId, payload: publishPayload }), (error) => error.details.code === 'legacy-link-review-required');
assert.equal(store.has(`weeklyPlans/${plan.id}`), false, 'Unreconciled draft does not publish');
const explicitCandidate = { ...publishCandidate, legacy_source_links: { [targetA.id]: sourceA.id, [targetB.id]: sourceB.id } };
const explicitPayload = { ...publishPayload, candidate: explicitCandidate };
const publishedResult = await planning.publish({ parentId, payload: explicitPayload });
assert.equal(publishedResult.published_revision, 1);
const bridge = store.get(`schoolPublicationBridges/${plan.id}`);
assert.equal(bridge.source_execution_id, frozen.id);
assert.equal(store.get(`weeklyPlans/${plan.id}`).legacy_source_links, undefined, 'Reconciliation stays parent private');
assert.equal(store.get(`weeklyPlanDrafts/${plan.id}`).legacy_source_links[targetA.id], sourceA.id);
const inheritedRead = await service.read({ payload: context });
assert.deepEqual(inheritedRead.blocks.map((item) => [item.status, item.revision]), [['completed', 1], ['completed', 1]]);
assert.equal(inheritedRead.server_now_ms, date.getTime());
assert.equal((await planning.publish({ parentId, payload: explicitPayload })).replayed, true);
assert.equal(store.get(`schoolPublicationBridges/${plan.id}`), bridge, 'Retry never rewrites bridge');
const inheritedA = getInheritedSchoolPublicationState({ bridge, plan: store.get(`weeklyPlans/${plan.id}`), block: targetA });
assert.equal(inheritedA.actor_id, parentId);
const inheritedB = getInheritedSchoolPublicationState({ bridge, plan: store.get(`weeklyPlans/${plan.id}`), block: targetB });
assert.deepEqual(inheritedB.original_evidence_ids, [legacyStudentEvidence.submission_id]);
assert.equal(store.get(`parentCorrectionEvents/${legacyComplete.event_id}`).weekly_plan_id, frozen.id, 'Original event stays scoped to original execution');
// A legacy saved report is amended by validated source lineage, without re-scoping the event/report.
const sourceReport = { ...originalReport, id: 'source-report', weekly_plan_id: frozen.id, assigned_blocks_snapshot: frozen.blocks.map((item) => ({
  blockId: item.id, assignmentId: item.assignment_id, legacySubjectId: item.legacy_subject_id, legacyBlockIndex: item.legacy_block_index, completed: true,
})), total_blocks: 2 };
store.set('weeklyReports/source-report', sourceReport);
const canonicalUndo = await service.correct({ parentId, payload: { ...correctionPayload, weekly_block_id: targetB.id, expected_revision: 1, idempotency_key: 'canonical-undo' } });
assert.equal(canonicalUndo.revision, 2);
const amendedLegacy = store.get(`weeklyReportAmendments/${canonicalUndo.amendment_ids[0]}`);
assert.equal(amendedLegacy.weekly_plan_id, frozen.id);
assert.equal(amendedLegacy.snapshot.assigned_blocks_snapshot[1].completed, false);
assert.equal(amendedLegacy.snapshot.assigned_blocks_snapshot[0].completed, true);
assert.equal(amendedLegacy.correction_lineage.target_weekly_block_id, targetB.id);
assert.equal(store.get(`parentCorrectionEvents/${canonicalUndo.event_id}`).weekly_plan_id, plan.id);
assert.equal(store.get('weeklyReports/source-report').assigned_blocks_snapshot[1].completed, true);
assert.equal((await service.read({ payload: context })).blocks[1].status, 'incomplete', 'Canonical undo supersedes completed inherited baseline');
await service.submit({ payload: { ...submitPayload, weekly_block_id: targetB.id, expected_revision: 2, idempotency_key: 'canonical-resubmit', summary_text: '', custom_field_responses: {}, resources_used: [] } });
assert.equal((await service.read({ payload: context })).blocks[1].revision, 3);
assert.deepEqual(bridge.inherited_states[inheritedB.id].original_evidence_ids, [legacyStudentEvidence.submission_id], 'Inherited baseline is frozen after resubmission');
// Same block ID can exist in different scopes without masking either exact state.
assert.equal(resolveSchoolPublicationLinks({ plan: { ...publishCandidate, blocks: [sourceA] }, sourceExecution: frozen, firstPublication: true })[sourceA.id], sourceA.id, 'Exact stable identity plus equivalent content can auto-link');
const sameIdPlan = { ...plan, blocks: [sourceA], school_completion_version: 1 };
const sameIdBridge = buildSchoolPublicationBridge({ plan: sameIdPlan, sourceExecution: frozen, sourceStates: [...store].filter(([path]) => path.startsWith('blockCompletionStates/')).map(([, value]) => value),
  legacySourceLinks: { [sourceA.id]: sourceA.id }, serverTime: date });
assert.equal(getInheritedSchoolPublicationState({ bridge: sameIdBridge, plan: sameIdPlan, block: sourceA }).revision, 1);
const canonicalSameId = { ...getInheritedSchoolPublicationState({ bridge: sameIdBridge, plan: sameIdPlan, block: sourceA }), status: 'incomplete', revision: 2 };
assert.equal(canonical.resolveEffectiveSchoolBlockState({ plan: sameIdPlan, block: sourceA, state: canonicalSameId,
  inheritedState: getInheritedSchoolPublicationState({ bridge: sameIdBridge, plan: sameIdPlan, block: sourceA }) }).status, 'incomplete');
throws('legacy-source-reused', () => resolveSchoolPublicationLinks({ plan: publishCandidate, sourceExecution: frozen,
  requestedLinks: { [targetA.id]: sourceA.id, [targetB.id]: sourceA.id }, firstPublication: true }));
throws('legacy-link-review-required', () => resolveSchoolPublicationLinks({ plan: { ...publishCandidate, blocks: [{ ...targetA, planned_duration_minutes: 10 }] }, sourceExecution: frozen,
  requestedLinks: { [targetA.id]: sourceA.id }, firstPublication: true }));
throws('scope-mismatch', () => buildSchoolPublicationBridge({ plan: { ...sameIdPlan, student_id: 'sibling' }, sourceExecution: frozen, sourceStates: [], legacySourceLinks: {}, serverTime: date }));
throws('legacy-source-remap', () => resolveSchoolPublicationLinks({ plan: publishCandidate, existingBridge: bridge,
  retainedLinks: bridge.legacy_source_links, requestedLinks: { [targetA.id]: null }, firstPublication: false }));
const newCopy = { ...targetA, id: 'new-copy', instance_key: 'new-copy', legacy_block_index: 2 };
const laterLinks = resolveSchoolPublicationLinks({ plan: { ...publishCandidate, blocks: [newCopy] }, existingBridge: bridge, retainedLinks: bridge.legacy_source_links });
assert.equal(laterLinks[newCopy.id], null);
assert.equal(laterLinks[targetA.id], sourceA.id, 'Retired mapping remains reserved');
throws('legacy-source-remap', () => resolveSchoolPublicationLinks({ plan: { ...publishCandidate, blocks: [newCopy] }, existingBridge: bridge,
  retainedLinks: bridge.legacy_source_links, requestedLinks: { [newCopy.id]: sourceA.id } }));
const explicitNew = resolveSchoolPublicationLinks({ plan: publishCandidate, sourceExecution: frozen, requestedLinks: { [targetA.id]: null, [targetB.id]: null }, firstPublication: true });
assert.equal(explicitNew[targetA.id], null);
assert.equal(canonical.resolveEffectiveSchoolBlockState({ plan: { ...publishCandidate, school_completion_version: 1 }, block: targetA, evidence: [{ ...original, timestamp: date }] }).status, 'incomplete', 'New publication-era work never inherits raw subject/index evidence');
assert.equal(resolveSchoolReportCorrectionTarget({ report: sourceReport, plan: publishCandidate, block: newCopy, bridge }), null, 'Unlinked repeated work cannot amend legacy report');
throws('report-lineage-review-required', () => resolveSchoolReportCorrectionTarget({ report: { ...sourceReport, assigned_blocks_snapshot: [...sourceReport.assigned_blocks_snapshot, sourceReport.assigned_blocks_snapshot[0]] },
  plan: publishCandidate, block: targetA, bridge }));
// Source undo is frozen into a first publication; later source mutations cannot overwrite it.
const sourceUndone = { ...store.get([...store.keys()].find((path) => path.startsWith('blockCompletionStates/') && store.get(path).weekly_plan_id === frozen.id && store.get(path).weekly_block_id === sourceA.id)),
  status: 'incomplete', revision: 2 };
const frozenUndoBridge = buildSchoolPublicationBridge({ plan: sameIdPlan, sourceExecution: frozen, sourceStates: [sourceUndone], legacySourceLinks: { [sourceA.id]: sourceA.id }, serverTime: date });
sourceUndone.status = 'completed'; sourceUndone.revision = 3;
assert.equal(getInheritedSchoolPublicationState({ bridge: frozenUndoBridge, plan: sameIdPlan, block: sourceA }).status, 'incomplete');
assert.equal(getInheritedSchoolPublicationState({ bridge: frozenUndoBridge, plan: sameIdPlan, block: sourceA }).revision, 2);
const queryIndex = queryReads.length;
await service.read({ payload: context });
assert.equal(queryReads.slice(queryIndex).some((query) => query.collection === 'subjects'), false, 'Published authority ignores 201 unrelated subjects');
console.log('School publication bridge helpers passed: explicit/automatic mappings, frozen parent and student baselines, canonical undo/resubmit, exact scoped IDs, repeated/new work, changed definitions/remap denials, report lineage, idempotent first publication, unrelated-curriculum isolation.');

// Both operations share student/public-plan/source-state reads. An actual overlap
// retries one transaction and keeps the accepted correction in either authority.
store.clear(); store.set('parents/parent', { timezone: 'America/Chicago' });
store.set('students/student', { parent_id: parentId, access_pin: '1234' }); store.set('subjects/math', legacySubject);
const raceLegacy = await service.read({ payload: context });
const raceCandidate = { id: plan.id, parent_id: parentId, student_id: studentId, week_key: weekKey,
  blocks: raceLegacy.weekly_plan.blocks, assignment_ids: [sourceA.assignment_id], weekly_exceptions: [] };
const retriesBefore = transactionRetries;
await Promise.all([
  service.correct({ parentId, payload: { ...correctionPayload, weekly_block_id: raceCandidate.blocks[0].id, expected_revision: 0, new_status: 'completed', idempotency_key: 'racing-correction' } }),
  planning.publish({ parentId, payload: { ...publishPayload, candidate: raceCandidate, idempotency_key: 'racing-publish' } }),
]);
assert.equal(transactionRetries > retriesBefore, true, 'Concurrent publication/correction observes a shared read conflict');
assert.equal((await service.read({ payload: context })).blocks[0].status, 'completed');
assert.equal([...store].filter(([path]) => path.startsWith('parentCorrectionEvents/')).length, 1);
console.log('School publication/correction optimistic transaction race passed with a shared-read retry. Persisted emulator concurrency remains independently required.');

// Independent-QA migration A: no server execution has been read/frozen yet.
// Publication itself must capture the applicable legacy source and raw evidence.
const resetMigration = ({ oldPublication = null } = {}) => {
  store.clear(); store.set('parents/parent', { timezone: 'America/Chicago' });
  store.set('students/student', { parent_id: parentId, access_pin: '1234', ...(oldPublication ? { weekly_planning_version: 1 } : {}) });
  store.set('subjects/math', legacySubject);
  if (oldPublication) store.set(`weeklyPlans/${plan.id}`, oldPublication);
  for (let index = 0; index < 2; index++) store.set(`submissions/raw-${index}`, { id: `raw-${index}`, parent_id: parentId, student_id: studentId,
    subject_id: 'math', block_index: index, timestamp: stamp(date), summary_text: 'Original student work', block_duration: 5 });
};
const previewCandidate = { ...raceCandidate, blocks: frozen.blocks };
resetMigration();
await assert.rejects(planning.publish({ parentId, payload: { ...publishPayload, candidate: publishCandidate, idempotency_key: 'raw-unreconciled' } }),
  (error) => error.details.code === 'legacy-link-review-required');
assert.equal([...store].some(([path]) => path.startsWith('schoolExecutionSnapshots/')), false, 'Refused publish does not partially freeze source');
await planning.publish({ parentId, payload: { ...publishPayload, candidate: previewCandidate, idempotency_key: 'raw-first-publish' } });
const rawPublished = store.get(`weeklyPlans/${plan.id}`);
const rawBridge = store.get(`schoolPublicationBridges/${plan.id}`);
assert.equal(rawBridge.source_kind, 'legacy_execution');
assert.equal(store.has(`schoolExecutionSnapshots/${rawBridge.source_execution_id}`), true, 'First publication atomically freezes missing legacy source');
assert.deepEqual((await service.read({ payload: context })).blocks.map((item) => item.status), ['completed', 'completed']);
assert.equal([...store].filter(([path]) => path.startsWith('submissions/')).length, 2, 'Migration creates no student evidence');
assert.equal([...store].filter(([path]) => path.startsWith('parentCorrectionEvents/')).length, 0, 'Migration creates no correction events');
// Independent-QA migration B: old Phase4 publication is already canonical.
const { school_completion_version: removedMarker, ...oldPublished } = rawPublished;
resetMigration({ oldPublication: oldPublished });
const oldUndo = await service.correct({ parentId, payload: { ...correctionPayload, weekly_block_id: oldPublished.blocks[0].id,
  expected_revision: 0, new_status: 'incomplete', idempotency_key: 'old-publication-undo' } });
assert.equal(oldUndo.revision, 1);
await planning.publish({ parentId, payload: { ...publishPayload, candidate: previewCandidate, expected_published_revision: 1, idempotency_key: 'old-publication-republish' } });
const canonicalBridge = store.get(`schoolPublicationBridges/${plan.id}`);
assert.equal(canonicalBridge.source_kind, 'published');
assert.equal(canonicalBridge.source_execution_id, plan.id, 'Existing publication retains its actual source plan ID');
assert.equal(canonicalBridge.source_revision, 1);
assert.equal([...store].some(([path]) => path.startsWith('schoolExecutionSnapshots/')), false, 'Existing public source is not fabricated as a legacy execution');
const preservedOld = await service.read({ payload: context });
assert.deepEqual(preservedOld.blocks.map((item) => [item.status, item.revision]), [['incomplete', 1], ['completed', 0]]);
const oldStateId = canonical.buildBlockCompletionStateId({ planId: plan.id, blockId: oldPublished.blocks[0].id });
assert.equal(canonicalBridge.inherited_states[oldStateId].source_state_id, oldStateId);
assert.equal(canonicalBridge.inherited_states[oldStateId].status, 'incomplete', 'Canonical undo is captured before raw legacy evidence');
// Same-plan differing stable IDs use explicit one-to-one links; old reports
// must reach bridge lineage rather than stopping at the shared plan ID.
resetMigration({ oldPublication: oldPublished });
const samePlanReport = { ...sourceReport, id: 'same-plan-report', weekly_plan_id: plan.id,
  assigned_blocks_snapshot: oldPublished.blocks.map((item) => ({ blockId: item.id, assignmentId: item.assignment_id,
    legacySubjectId: item.legacy_subject_id, legacyBlockIndex: item.legacy_block_index, completed: true })) };
store.set('weeklyReports/same-plan-report', samePlanReport);
const renamedBlocks = oldPublished.blocks.map((item, index) => ({ ...item, id: `renamed-${index}`, instance_key: `renamed-${index}`, legacy_block_index: index + 2 }));
const renamedCandidate = { ...previewCandidate, blocks: renamedBlocks, legacy_source_links: Object.fromEntries(renamedBlocks.map((item, index) => [item.id, oldPublished.blocks[index].id])) };
await planning.publish({ parentId, payload: { ...publishPayload, candidate: renamedCandidate, expected_published_revision: 1, idempotency_key: 'same-plan-renamed' } });
assert.deepEqual((await service.read({ payload: context })).blocks.map((item) => item.status), ['completed', 'completed']);
const samePlanBridge = store.get(`schoolPublicationBridges/${plan.id}`);
const samePlanTarget = resolveSchoolReportCorrectionTarget({ report: samePlanReport, plan: store.get(`weeklyPlans/${plan.id}`), block: renamedBlocks[1], bridge: samePlanBridge });
assert.equal(samePlanTarget.block.id, oldPublished.blocks[1].id);
assert.equal(samePlanTarget.lineage.source_execution_id, plan.id);
const renamedUndo = await service.correct({ parentId, payload: { ...correctionPayload, weekly_block_id: renamedBlocks[1].id,
  expected_revision: 0, new_status: 'incomplete', idempotency_key: 'same-plan-renamed-undo' } });
assert.equal(renamedUndo.amendment_ids.length, 1);
const samePlanAmendment = store.get(`weeklyReportAmendments/${renamedUndo.amendment_ids[0]}`);
assert.equal(samePlanAmendment.snapshot.assigned_blocks_snapshot[1].blockId, oldPublished.blocks[1].id);
assert.equal(samePlanAmendment.snapshot.assigned_blocks_snapshot[1].completed, false);
assert.equal(samePlanAmendment.snapshot.assigned_blocks_snapshot[0].completed, true);
assert.equal(samePlanAmendment.correction_lineage.target_weekly_block_id, renamedBlocks[1].id);
assert.equal(store.get('weeklyReports/same-plan-report').assigned_blocks_snapshot[1].completed, true);
assert.equal(store.get(`parentCorrectionEvents/${renamedUndo.event_id}`).weekly_block_id, renamedBlocks[1].id);
console.log('QA migration regressions passed: raw legacy first publish without prior freeze; old canonical publication republish with undo/raw evidence; actual source IDs; same-plan renamed block/report lineage; no fabricated events/evidence.');
