import { buildBlockCompletionStateId, resolveEffectiveSchoolBlockState } from '../../functions/src/schoolCompletionFoundation.js';
import { buildHistoricalSchoolExecution, buildLegacySchoolExecution } from '../../functions/src/schoolCompletionContracts.js';
import { getInheritedSchoolPublicationState } from '../../functions/src/schoolPublicationBridge.js';
import { buildWeeklyPlanDocumentId } from './weeklyPlanUtils.js';

export const schoolTimestampMillis = (value) => value?.toMillis?.() ?? value?.toDate?.().getTime() ?? new Date(value || 0).getTime();

// This is an owner preview only. The first trusted student read/correction freezes
// legacy execution on the server; a parent never fabricates a student read/PIN.
export const resolveParentSchoolWeek = ({ parentId, student, weekKey, weekStart, weekEnd, currentWeekKey,
  subjects = [], submissions = [], plans = [], executions = [], states = [], bridges = [], reports = [], events = [], history = [] }) => {
  const planId = buildWeeklyPlanDocumentId({ parentId, studentId: student.id, weekKey });
  const published = plans.find((plan) => plan.id === planId);
  let plan = ['published', 'archived'].includes(published?.status) ? published : null;
  let preview = false;
  let reviewRequired = false;
  const adoptedAt = schoolTimestampMillis(student.weekly_planning_adopted_at);
  const fallbackSuppressed = student.weekly_planning_version >= 1 && !(adoptedAt && adoptedAt > weekEnd.getTime());
  if (!plan && !fallbackSuppressed) {
    plan = executions.find((item) => item.id === `legacy-execution:${planId}`) || null;
    if (!plan) {
      try {
        if (weekKey === currentWeekKey) {
          plan = buildLegacySchoolExecution({ parentId, studentId: student.id, weekKey, subjects, serverTime: null, range: { weekStart, weekEnd } });
          preview = true;
        } else {
          plan = buildHistoricalSchoolExecution({ parentId, studentId: student.id, weekKey, reports, serverTime: null });
          preview = true;
        }
      } catch { reviewRequired = true; }
    }
  }
  const historicalReport = reports.find((report) => !report.weekly_plan_id || report.weekly_plan_id === plan?.id);
  const recordedStart = plan?.week_start ?? historicalReport?.week_start;
  const recordedEnd = plan?.week_end ?? historicalReport?.week_end ?? historicalReport?.week_ending;
  const evidenceStart = recordedStart ? schoolTimestampMillis(recordedStart) : weekStart.getTime();
  const evidenceEnd = recordedEnd ? schoolTimestampMillis(recordedEnd) : weekEnd.getTime();
  const evidence = submissions.filter((item) => item.parent_id === parentId && item.student_id === student.id
    && schoolTimestampMillis(item.timestamp) >= evidenceStart && schoolTimestampMillis(item.timestamp) <= evidenceEnd)
    .sort((a, b) => schoolTimestampMillis(a.timestamp) - schoolTimestampMillis(b.timestamp));
  const bridge = bridges.find((item) => item.id === plan?.id) || null;
  const entries = (plan?.blocks || []).map((block) => {
    const state = resolveEffectiveSchoolBlockState({ plan, block,
      state: states.find((item) => item.id === buildBlockCompletionStateId({ planId: plan.id, blockId: block.id })),
      inheritedState: getInheritedSchoolPublicationState({ bridge, plan, block }), evidence });
    const sourcePlanId = state.source_execution_id;
    const sourceBlockId = state.source_weekly_block_id;
    const matches = (item) => item.weekly_plan_id === plan.id && item.weekly_block_id === block.id
      || sourcePlanId && item.weekly_plan_id === sourcePlanId && item.weekly_block_id === sourceBlockId;
    return { block, state, evidence: evidence.filter((item) => state.original_evidence_ids.includes(item.id)),
      events: events.filter(matches).sort((a, b) => schoolTimestampMillis(a.recorded_at) - schoolTimestampMillis(b.recorded_at)),
      history: history.filter(matches).sort((a, b) => schoolTimestampMillis(a.recorded_at) - schoolTimestampMillis(b.recorded_at)) };
  });
  return { plan, publicationBridge: bridge, completionStates: states, entries, preview, reviewRequired,
    completed: entries.filter((item) => item.state.status === 'completed').length, total: entries.length };
};
