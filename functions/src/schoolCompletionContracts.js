import { buildStableWeeklyBlockId, projectPublicWeeklyBlocks } from './weeklyPlanningFoundation.js';
import { buildLegacySubjectWeeklyBlockSeeds } from './schoolLegacyFoundation.js';
import { requireWeeklyPlanning as requireValue, validatePlanningId, weeklyPlanningPlanId } from './weeklyPlanningContracts.js';
export { requireValue as requireSchoolAuthority };
export const SCHOOL_COLLECTIONS = Object.freeze({ STATES: 'blockCompletionStates', EVENTS: 'parentCorrectionEvents', HISTORY: 'schoolStateHistory',
  RECEIPTS: 'schoolOperationReceipts', EXECUTIONS: 'schoolExecutionSnapshots', AMENDMENTS: 'weeklyReportAmendments', REPORT_HEADS: 'schoolReportAmendmentHeads' });
export const schoolExecutionSnapshotId = (scope) => `legacy-execution:${weeklyPlanningPlanId(scope)}`;
export const validateSchoolPayload = (payload, action) => {
  const context = ['student_id', 'slug', 'access_pin'];
  const scope = ['week_key', 'weekly_block_id', 'expected_revision', 'idempotency_key'];
  const fields = action === 'report' ? ['student_id', 'week_key', 'source', 'idempotency_key'] : action === 'read' ? [...context, 'week_key'] : action === 'correct' ? ['student_id', ...scope, 'new_status', 'reason', 'note']
    : action === 'submit' ? [...context, ...scope, 'summary_text', 'resources_used', 'custom_field_responses', 'timer_session_id']
      : [...context, ...scope, 'action', 'timer_session_id'];
  requireValue(payload && typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload).every((key) => fields.includes(key)), 'unsupported-request-field');
  requireValue(JSON.stringify(payload).length <= 100000, 'request-size-limit');
  if (payload.student_id || ['correct', 'report'].includes(action)) validatePlanningId(payload.student_id);
  if (action === 'report') {
    validatePlanningId(payload.idempotency_key);
    requireValue(['manual', 'auto_rollover', 'automatic', 'official'].includes(payload.source), 'invalid-report-source');
  }
  if (!['read', 'report'].includes(action)) {
    validatePlanningId(payload.idempotency_key); validatePlanningId(payload.weekly_block_id);
    requireValue(Number.isSafeInteger(payload.expected_revision) && payload.expected_revision >= 0, 'invalid-revision');
    requireValue(typeof payload.week_key === 'string', 'invalid-date-key');
  }
  if (action === 'correct') {
    requireValue(['completed', 'incomplete'].includes(payload.new_status) && typeof payload.reason === 'string' && payload.reason.trim().length > 0
      && payload.reason.length <= 500 && typeof payload.note === 'string' && payload.note.length <= 5000, 'invalid-correction-request');
  }
  if (action === 'timer') requireValue(['start', 'pause', 'resume', 'reset'].includes(payload.action), 'invalid-timer-action');
};
export const buildLegacySchoolExecution = ({ parentId, studentId, weekKey, subjects, serverTime, range }) => {
  const blocks = subjects.filter((subject) => subject.parent_id === parentId && subject.is_active !== false && subject.is_archived !== true
    && subject.archived !== true && subject.status !== 'archived' && subject.archived_at == null
    && (subject.student_ids?.length ? subject.student_ids.includes(studentId) : subject.student_id === studentId))
    .flatMap((subject) => buildLegacySubjectWeeklyBlockSeeds({ subject, studentId }).map((seed) => {
      const assignment = `legacy-assignment_${studentId}_${subject.id}`;
      return { ...seed, assignment_id: assignment, instance_key: `legacy-index:${seed.legacy_block_index}`,
        id: buildStableWeeklyBlockId({ assignmentId: assignment, instanceKey: `legacy-index:${seed.legacy_block_index}` }) };
    }));
  requireValue(blocks.length <= 500, 'execution-block-limit');
  return { id: schoolExecutionSnapshotId({ parentId, studentId, weekKey }), parent_id: parentId, student_id: studentId, week_key: weekKey,
    status: 'published', authority_kind: 'legacy_execution', schema_version: 1, blocks: projectPublicWeeklyBlocks(blocks),
    week_start: range.weekStart, week_end: range.weekEnd, recorded_at: serverTime };
};
export const buildHistoricalSchoolExecution = ({ parentId, studentId, weekKey, reports, serverTime }) => {
  requireValue(reports.length > 0, 'historical-assignment-review-required');
  const candidates = reports.map((report) => report.assigned_blocks_snapshot || []);
  requireValue(candidates.every((blocks) => blocks.length > 0), 'historical-assignment-review-required');
  const signatures = candidates.map((blocks) => JSON.stringify(blocks.map((block) => [block.blockId, block.legacySubjectId, block.legacyBlockIndex]).sort()));
  requireValue(signatures.every((signature) => signature === signatures[0]), 'historical-assignment-review-required');
  const blocks = candidates[0].map((block) => ({ id: block.blockId, assignment_id: block.assignmentId || `legacy-assignment_${studentId}_${block.legacySubjectId}`,
    student_id: studentId, legacy_subject_id: block.legacySubjectId, legacy_block_index: block.legacyBlockIndex,
    title: block.title || '', instruction: block.instruction || '', resources: block.resources || [], custom_fields: [], category: block.category || 'lesson',
    completion_mode: block.completionMode || 'task_complete', planned_duration_minutes: block.plannedDurationMinutes || 0,
    require_timer: Boolean(block.requireTimer), require_input: Boolean(block.requireInput) }));
  requireValue(blocks.every((block) => typeof block.id === 'string' && block.id && typeof block.legacy_subject_id === 'string' && block.legacy_subject_id && Number.isInteger(block.legacy_block_index))
    && new Set(blocks.map((block) => block.id)).size === blocks.length
    && new Set(blocks.map((block) => `${block.legacy_subject_id}:${block.legacy_block_index}`)).size === blocks.length, 'historical-assignment-review-required');
  return { id: schoolExecutionSnapshotId({ parentId, studentId, weekKey }), parent_id: parentId, student_id: studentId, week_key: weekKey,
    status: 'archived', authority_kind: 'legacy_execution', schema_version: 1, blocks, original_report_ids: reports.map((report) => report.id), recorded_at: serverTime };
};
export const projectSafeSchoolPlan = (plan) => plan ? ({ id: plan.id, week_key: plan.week_key, status: plan.status,
  authority_kind: plan.authority_kind || 'published', ...(plan.school_completion_version === 1 ? { school_completion_version: 1 } : {}), blocks: projectPublicWeeklyBlocks(plan.blocks) }) : null;
