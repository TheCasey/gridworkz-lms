// Render server-issued timer context against the receiving device's clock.
// Commands and completion validity remain server-owned; local ticks are display only.
export const normalizeTrustedSchoolTimer = (timer, { serverNowMs, localNowMs = Date.now() } = {}) => {
  if (!timer || !['running', 'paused'].includes(timer.status)) return null;
  if (!Number.isFinite(serverNowMs) || !Number.isFinite(localNowMs)
    || !Number.isFinite(timer.duration_ms) || !Number.isFinite(timer.elapsed_ms)) return null;
  const elapsedMs = Math.min(timer.duration_ms, Math.max(0, timer.elapsed_ms
    + (timer.status === 'running' ? Math.max(0, serverNowMs - timer.started_at_ms) : 0)));
  const remainingTime = Math.max(0, timer.duration_ms - elapsedMs);
  return {
    subjectId: timer.subject_id, blockIndex: timer.block_index,
    blockId: timer.weekly_block_id, weeklyPlanId: timer.weekly_plan_id, weekKey: timer.week_key,
    sessionId: timer.session_id, authorityVersion: 1, stateRevision: timer.state_revision,
    initialDurationMs: timer.duration_ms, remainingTime,
    targetEndTime: timer.status === 'running' ? localNowMs + remainingTime : null,
    isRunning: timer.status === 'running' && remainingTime > 0,
    isFinished: remainingTime === 0, savedAt: localNowMs,
  };
};

export const schoolSafeCompletedBlocks = (states = []) => states.reduce((result, state) => {
  if (state.status === 'completed' && state.legacy_subject_id && Number.isInteger(state.legacy_block_index)) {
    (result[state.legacy_subject_id] ||= []).push(state.legacy_block_index);
  }
  return result;
}, {});
