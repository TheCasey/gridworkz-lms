import assert from 'node:assert/strict';
import { buildStudentWeeklySnapshot, buildWeeklyReportPayload } from '../src/utils/reportUtils.js';
import { buildBlockCompletionStateId, resolveEffectiveSchoolBlockState } from '../functions/src/schoolCompletionFoundation.js';
import { buildTrustedSchoolPolicyTimers } from '../functions/src/schoolLockdownFoundation.js';
const start = new Date('2026-10-12T05:00Z'); const end = new Date('2026-10-19T04:59:59.999Z');
const student = { id: 'student', parent_id: 'parent', name: 'Student' };
const block = { id: 'block', student_id: 'student', assignment_id: 'assignment', legacy_subject_id: 'subject', legacy_block_index: 0,
  title: 'Practice', require_input: false, require_timer: true, planned_duration_minutes: 1 };
const plan = { id: 'plan', parent_id: 'parent', student_id: 'student', week_key: '2026-10-12', status: 'published', school_completion_version: 1, blocks: [block] };
const evidence = { id: 'evidence', parent_id: 'parent', student_id: 'student', subject_id: 'subject', block_index: 0,
  weekly_plan_id: 'plan', weekly_block_id: 'block', authority_version: 1, timestamp: start, summary_text: 'Original summary', block_duration: 1 };
const initial = resolveEffectiveSchoolBlockState({ plan, block, evidence: [evidence] });
const incomplete = { ...initial, status: 'incomplete', revision: 1, provenance: 'parent_correction', actor_id: 'parent', completed_at: null };
const options = { student, subjects: [], submissions: [evidence], weeklyPlan: plan, weekStart: start, weekEnd: end };
const snapshot = buildStudentWeeklySnapshot({ ...options, completionStates: [incomplete] });
assert.equal(snapshot.totalBlocks, 0); assert.equal(snapshot.totalMinutes, 1); assert.equal(snapshot.goalBlocks, 1);
assert.equal(snapshot.assignedBlocksSnapshot[0].matchedSubmissionSummary.summaryText, 'Original summary');
assert.equal(snapshot.assignedBlocksSnapshot[0].completionProvenance, 'parent_correction');
assert.equal(snapshot.subjectData[0].blocks.length, 1);
const payload = buildWeeklyReportPayload({ student, snapshot, weekStart: start, weekEnd: end, parentId: 'parent', parentSettings: { timezone: 'America/Chicago' } });
assert.equal(payload.total_blocks, 0); assert.equal(payload.subjects_data.subject.summaries[0].text, 'Original summary');
const parentComplete = { ...initial, status: 'completed', revision: 1, original_evidence_ids: [], provenance: 'parent_correction', actor_id: 'parent', completed_at: start };
const parentSnapshot = buildStudentWeeklySnapshot({ ...options, submissions: [], completionStates: [parentComplete] });
assert.equal(parentSnapshot.totalBlocks, 1); assert.equal(parentSnapshot.totalMinutes, 0); assert.equal(parentSnapshot.assignedBlocksSnapshot[0].matchedSubmissionSummary, null);
const copy = { ...block, id: 'new-copy' };
const copied = buildStudentWeeklySnapshot({ ...options, weeklyPlan: { ...plan, blocks: [copy] } });
assert.equal(copied.totalBlocks, 0); assert.equal(copied.totalMinutes, 0);
const zero = buildStudentWeeklySnapshot({ ...options, submissions: [{ ...evidence, block_duration: 0 }] });
assert.equal(zero.totalMinutes, 0); assert.equal(zero.assignedBlocksSnapshot[0].matchedSubmissionSummary.durationMinutes, 0);
const schoolState = { student_id: 'student', week_key: plan.week_key, weekly_plan: plan, blocks: [{ weekly_block_id: 'block', status: 'incomplete', revision: 1 }],
  timer: { authority_version: 1, session_id: 'session', student_id: 'student', weekly_plan_id: 'plan', week_key: plan.week_key,
    weekly_block_id: 'block', state_revision: 1, duration_ms: 60000, elapsed_ms: 0, started_at_ms: 1000, target_end_ms: 61000, status: 'running' } };
assert.equal(buildTrustedSchoolPolicyTimers({ schoolState, studentId: 'student', nowMs: 2000 })[0].remaining_time, 59000);
for (const timer of [{ ...schoolState.timer, authority_version: 0 }, { ...schoolState.timer, state_revision: 0 }, { ...schoolState.timer, weekly_plan_id: 'foreign' }]) {
  assert.deepEqual(buildTrustedSchoolPolicyTimers({ schoolState: { ...schoolState, timer }, studentId: 'student', nowMs: 2000 }), []);
}
assert.equal(buildBlockCompletionStateId({ planId: 'plan', blockId: 'block' }), initial.id);
console.log('School report view: effective counts, immutable summary/time, parent zero-time, copy isolation and trusted Lockdown timer scope passed.');

const { buildTrustedSchoolReport } = await import('../functions/src/schoolReportFoundation.js');
const filed = buildTrustedSchoolReport({ id: 'report', parent: { timezone: 'America/Chicago', school_year_start: '2026-01-01', school_year_end: '2026-12-31' },
  student, plan, states: [incomplete], evidence: [evidence], weekStart: start, weekEnd: new Date('2026-04-03T02:00Z'), schoolRevision: 3, serverTime: start, source: 'manual' });
assert.equal(filed.total_blocks, 0); assert.equal(filed.school_state_revision, 3); assert.equal(filed.school_quarter, 1);
assert.equal(filed.subjects_data.subject.summaries[0].text, evidence.summary_text);
const unknown = buildTrustedSchoolReport({ id: 'report', parent: { timezone: 'America/Chicago' }, student, plan, states: [initial],
  evidence: [{ ...evidence, block_duration: undefined, manual_override: true }], weekStart: start, weekEnd: end, schoolRevision: 0, serverTime: start, source: 'manual' });
assert.equal(unknown.total_hours, 0); assert.equal(unknown.assigned_blocks_snapshot[0].matchedSubmissionSummary.durationMinutes, null);
assert.equal(unknown.subjects_data.subject.summaries[0].duration, null);
console.log('Trusted report filing view: canonical status/revision, original evidence, unknown duration and household-local quarter boundary passed.');

const legacyManualView = buildStudentWeeklySnapshot({ ...options, submissions: [{ ...evidence, block_duration: undefined, manual_override: true }] });
assert.equal(legacyManualView.totalMinutes, 0);
assert.equal(legacyManualView.assignedBlocksSnapshot[0].matchedSubmissionSummary.durationMinutes, null);

const { buildWeeklyReportReadinessSummary } = await import('../src/utils/reportUtils.js');
assert.equal(snapshot.assignedBlocksSnapshot[0].originalEvidence.length, 1);
const parentRequired = { ...parentSnapshot, assignedBlocksSnapshot: parentSnapshot.assignedBlocksSnapshot.map((item) => ({ ...item, requireInput: true })) };
assert.equal(buildWeeklyReportReadinessSummary(parentRequired).parentCorrectionCount, 1);
assert.equal(buildWeeklyReportReadinessSummary(parentRequired).missingRequiredDetailCount, 0);
const requiredFields = { ...zero, assignedBlocksSnapshot: zero.assignedBlocksSnapshot.map((item) => ({ ...item,
  requireInput: true, customFields: [{ id: 'explanation', required: true }], matchedSubmissionSummary: { summaryText: '', customFieldResponses: { explanation: 'A response' } } })) };
assert.equal(buildWeeklyReportReadinessSummary(requiredFields).missingRequiredDetailCount, 1);
const event = { id: 'correction', weekly_plan_id: 'plan', weekly_block_id: 'block', prior_status: 'completed', new_status: 'incomplete', reason: 'More practice', note: 'Preserve evidence', actor_id: 'parent', recorded_at: start, revision: 1 };
const withAudit = buildTrustedSchoolReport({ id: 'report', parent: { timezone: 'America/Chicago' }, student, plan: { ...plan, revision: 4 }, states: [incomplete], evidence: [evidence],
  weekStart: start, weekEnd: end, schoolRevision: 3, serverTime: start, source: 'manual', correctionEvents: [event] });
assert.equal(withAudit.published_revision, 4); assert.equal(withAudit.timezone, 'America/Chicago');
assert.deepEqual(withAudit.correction_watermark, { school_state_revision: 3, event_ids: ['correction'] });
assert.equal(withAudit.correction_events[0].reason, event.reason); assert.equal(withAudit.assigned_blocks_snapshot[0].originalEvidence[0].submissionId, 'evidence');
console.log('Report metadata/readiness: preserved complete evidence, parent response bypass, required student detail, publication revision and frozen correction watermark passed.');
