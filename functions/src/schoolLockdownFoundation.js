// Convert only the singleton server-issued school timer into policy input.
// A stale legacy timer can never reactivate corrected or replaced work.
export const buildTrustedSchoolPolicyTimers = ({ schoolState, studentId, nowMs }) => {
  const timer = schoolState?.timer;
  const plan = schoolState?.weekly_plan;
  const block = plan?.blocks?.find((item) => item.id === timer?.weekly_block_id);
  const state = schoolState?.blocks?.find((item) => item.weekly_block_id === block?.id);
  if (schoolState?.student_id !== studentId || !block || !state || state.status === 'completed'
    || timer.authority_version !== 1 || timer.student_id !== studentId || timer.weekly_plan_id !== plan.id
    || timer.week_key !== schoolState.week_key || timer.state_revision !== state.revision
    || !['running', 'paused'].includes(timer.status)) return [];
  const elapsed = Math.max(0, timer.elapsed_ms + (timer.status === 'running' ? nowMs - timer.started_at_ms : 0));
  const remaining = Math.max(0, timer.duration_ms - elapsed);
  return [{ ...timer, id: timer.session_id, block_id: block.id, block_index: block.legacy_block_index,
    subject_id: block.legacy_subject_id, is_running: timer.status === 'running' && remaining > 0,
    // A finished timer stays associated until a valid submission or correction.
    status: timer.status === 'paused' ? 'paused' : 'active', remaining_time: remaining,
    target_end_time: timer.target_end_ms, start_time: timer.started_at_ms, saved_at: nowMs }];
};
