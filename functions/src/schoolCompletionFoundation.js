// Canonical browser-safe completion/correction foundation; packaged with Functions.
import { nextContractRevision } from './weeklyPlanningFoundation.js';
const ProductDirectionContractVersion = 1;
const EffectiveBlockStatuses = { COMPLETED: 'completed', INCOMPLETE: 'incomplete' };
const WeeklyPlanStatuses = { PUBLISHED: 'published', ARCHIVED: 'archived' };
const fail = (code, message) => {
  const error = new Error(message);
  error.code = code;
  throw error;
};
const requireValue = (condition, code, message = code) => {
  if (!condition) fail(code, message);
};
const text = (value) => typeof value === 'string' && value.length > 0 && value === value.trim();
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const clone = (value) => {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(clone);
  if (record(value)) {
    // Firestore Timestamp/sentinel values supplied by the trusted adapter are opaque.
    if (Object.getPrototypeOf(value) !== Object.prototype) return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  }
  return value;
};
const pick = (value, keys) => Object.fromEntries(
  keys.filter((key) => Object.hasOwn(value, key)).map((key) => [key, clone(value[key])])
);
const dateKey = (value) => {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const scopedId = (prefix, parts) => {
  requireValue(parts.every(text), 'invalid-identity');
  const id = `${prefix}:${parts.map(encodeURIComponent).join(':')}`;
  requireValue(id.length <= 1500, 'identity-too-long');
  return id;
};
const scopeKeys = ['parent_id', 'student_id', 'week_key', 'weekly_plan_id'];
const blockScopeKeys = [...scopeKeys, 'weekly_block_id'];
const assertSameScope = (left, right, keys = scopeKeys) => {
  requireValue(keys.every((key) => text(left?.[key]) && left[key] === right?.[key]), 'scope-mismatch');
};
const assertVersion = (value) => requireValue(
  value?.schema_version === ProductDirectionContractVersion, 'unsupported-contract-version'
);
const assertTrustedContext = (parentId, actorId, serverTime) => {
  requireValue(text(parentId) && actorId === parentId, 'unauthorized-actor');
  requireValue(serverTime !== null && serverTime !== undefined, 'missing-server-time');
};
const assertUniqueStrings = (values, code) => requireValue(
  Array.isArray(values) && values.every(text) && new Set(values).size === values.length, code
);

export const buildBlockCompletionStateId = ({ planId, blockId }) => scopedId('block-state', [planId, blockId]);
export const buildParentCorrectionEventId = ({ parentId, idempotencyKey }) => scopedId('correction', [parentId, idempotencyKey]);
export const buildRoutineDaySnapshotId = ({ parentId, studentId, date }) => {
  requireValue(dateKey(date), 'invalid-date-key');
  return scopedId('routine-day', [parentId, studentId, date]);
};
export const buildStudentCosmeticStateId = ({ parentId, studentId }) => scopedId('cosmetics', [parentId, studentId]);

export const resolveLegacyWeeklyBlock = ({ plan, studentId, weekKey, subjectId, blockIndex }) => {
  requireValue(text(studentId) && dateKey(weekKey) && text(subjectId) && integer(blockIndex), 'invalid-legacy-reference');
  requireValue(plan?.student_id === studentId && plan?.week_key === weekKey, 'scope-mismatch');
  const matches = (Array.isArray(plan.blocks) ? plan.blocks : []).filter((block) => (
    block.student_id === studentId && block.legacy_subject_id === subjectId && block.legacy_block_index === blockIndex
  ));
  if (matches.length !== 1) return { status: matches.length ? 'ambiguous' : 'missing', block: null, candidate_ids: matches.map((block) => block.id) };
  requireValue(text(matches[0].id), 'missing-stable-block-identity');
  return { status: 'matched', block: clone(matches[0]), candidate_ids: [matches[0].id] };
};

export const buildParentCorrection = ({ request, plan, currentState, originalEvidence = [], actorId, serverTime, existingEvent = null }) => {
  requireValue(record(request), 'invalid-correction-request');
  const requestKeys = ['new_status', 'reason', 'note', 'idempotency_key', 'expected_revision'];
  requireValue(Object.keys(request).every((key) => requestKeys.includes(key)), 'unsupported-correction-field');
  requireValue(Object.values(EffectiveBlockStatuses).includes(request.new_status), 'invalid-block-status');
  requireValue(text(request.reason) && typeof request.note === 'string' && text(request.idempotency_key), 'invalid-correction-request');
  requireValue(integer(request.expected_revision), 'invalid-revision');
  assertTrustedContext(plan?.parent_id, actorId, serverTime);
  assertVersion(currentState);
  const scope = { parent_id: plan.parent_id, student_id: plan.student_id, week_key: plan.week_key, weekly_plan_id: plan.id };
  assertSameScope(currentState, scope);
  requireValue([WeeklyPlanStatuses.PUBLISHED, WeeklyPlanStatuses.ARCHIVED].includes(plan.status), 'unpublished-correction-target');
  requireValue(Array.isArray(plan.blocks), 'invalid-blocks');
  const matches = plan.blocks.filter((block) => block.id === currentState.weekly_block_id && block.student_id === plan.student_id);
  requireValue(matches.length === 1, 'invalid-correction-block');
  requireValue(currentState.id === buildBlockCompletionStateId({ planId: plan.id, blockId: matches[0].id }), 'invalid-state-identity');
  requireValue(Object.values(EffectiveBlockStatuses).includes(currentState.status) && integer(currentState.revision), 'invalid-block-state');
  assertUniqueStrings(currentState.original_evidence_ids, 'invalid-evidence-references');
  const id = buildParentCorrectionEventId({ parentId: actorId, idempotencyKey: request.idempotency_key });
  if (existingEvent) {
    assertVersion(existingEvent);
    assertSameScope(existingEvent, currentState, blockScopeKeys);
    requireValue(existingEvent.id === id && existingEvent.actor_id === actorId
      && existingEvent.new_status === request.new_status && existingEvent.reason === request.reason
      && existingEvent.note === request.note && existingEvent.idempotency_key === request.idempotency_key
      && existingEvent.prior_revision === request.expected_revision, 'idempotency-conflict');
    return { event: clone(existingEvent), state: clone(currentState), replayed: true };
  }
  requireValue(Array.isArray(originalEvidence), 'invalid-evidence-references');
  assertUniqueStrings(originalEvidence.map((evidence) => evidence?.id), 'invalid-evidence-references');
  originalEvidence.forEach((evidence) => assertSameScope(evidence, currentState, blockScopeKeys));
  requireValue(currentState.original_evidence_ids.every((id) => originalEvidence.some((evidence) => evidence.id === id))
    && originalEvidence.every((evidence) => currentState.original_evidence_ids.includes(evidence.id)), 'evidence-reference-mismatch');
  const revision = nextContractRevision({ expectedRevision: request.expected_revision, currentRevision: currentState.revision });
  const event = {
    ...pick(currentState, blockScopeKeys), id, schema_version: ProductDirectionContractVersion,
    actor_id: actorId, recorded_at: serverTime, revision, prior_revision: currentState.revision,
    prior_status: currentState.status, new_status: request.new_status,
    reason: request.reason, note: request.note, idempotency_key: request.idempotency_key,
    original_evidence_ids: [...currentState.original_evidence_ids],
  };
  return { event, state: { ...clone(currentState), status: request.new_status, revision, last_correction_event_id: id, updated_at: serverTime }, replayed: false };
};

export const buildReportAmendment = ({ originalReport, previousAmendment = null, correctionEvents, amendedSnapshot, expectedVersion, actorId, serverTime, reportLineage = null }) => {
  assertTrustedContext(originalReport?.parent_id, actorId, serverTime);
  const subjectSnapshot = originalReport.snapshot_model === 'subjects';
  const planId = originalReport.weekly_plan_id ?? '';
  requireValue(text(originalReport.id) && dateKey(originalReport.week_key)
    && (subjectSnapshot ? planId === '' : text(planId)), 'invalid-original-report');
  requireValue((originalReport.report_version == null || originalReport.report_version === 1)
    && (originalReport.original_report_id == null || originalReport.original_report_id === originalReport.id), 'invalid-original-report');
  const scope = { ...pick(originalReport, scopeKeys), weekly_plan_id: planId };
  const assertReportScope = (value) => {
    assertSameScope(value, scope, ['parent_id', 'student_id', 'week_key']);
    requireValue((value.weekly_plan_id ?? '') === planId, 'scope-mismatch');
  };
  requireValue(text(originalReport.student_id), 'invalid-original-report');
  requireValue(record(amendedSnapshot), 'invalid-report-snapshot');
  assertReportScope(amendedSnapshot);
  requireValue(!subjectSnapshot || amendedSnapshot.snapshot_model === 'subjects', 'report-model-mismatch');
  let previousId = originalReport.id;
  let previousVersion = 1;
  if (previousAmendment) {
    assertVersion(previousAmendment);
    assertReportScope(previousAmendment);
    requireValue(previousAmendment.original_report_id === originalReport.id
      && integer(previousAmendment.report_version, 2)
      && previousAmendment.id === scopedId('report-amendment', [originalReport.id, String(previousAmendment.report_version)]), 'invalid-amendment-chain');
    previousId = previousAmendment.id;
    previousVersion = previousAmendment.report_version;
  }
  const version = nextContractRevision({ expectedRevision: expectedVersion, currentRevision: previousVersion });
  requireValue(Array.isArray(correctionEvents) && correctionEvents.length > 0, 'missing-report-corrections');
  assertUniqueStrings(correctionEvents.map((event) => event?.id), 'invalid-report-corrections');
  correctionEvents.forEach((event) => {
    assertVersion(event);
    if (subjectSnapshot) {
      // A legacy report predates the plan link. Its correction can still come from
      // an authoritative plan for that same household/student/week; retain the
      // event unchanged and link it by id rather than clearing its plan reference.
      assertSameScope(event, scope, ['parent_id', 'student_id', 'week_key']);
      requireValue(typeof event.weekly_plan_id === 'string', 'invalid-report-corrections');
    } else if (reportLineage) {
      assertSameScope(event, scope, ['parent_id', 'student_id', 'week_key']);
      requireValue(reportLineage.source_execution_id === planId && reportLineage.target_weekly_plan_id === event.weekly_plan_id
        && reportLineage.target_weekly_block_id === event.weekly_block_id && text(reportLineage.publication_bridge_id)
        && text(reportLineage.source_weekly_block_id)
        && (originalReport.assigned_blocks_snapshot || []).filter((block) => block.blockId === reportLineage.source_weekly_block_id).length === 1,
      'invalid-report-lineage');
    } else {
      assertReportScope(event);
    }
  });
  return {
    ...scope, id: scopedId('report-amendment', [originalReport.id, String(version)]),
    schema_version: ProductDirectionContractVersion, original_report_id: originalReport.id,
    previous_report_version_id: previousId, report_version: version,
    correction_event_ids: correctionEvents.map((event) => event.id), snapshot: clone(amendedSnapshot),
    actor_id: actorId, recorded_at: serverTime, ...(reportLineage ? { correction_lineage: clone(reportLineage) } : {}),
  };
};

// Legacy evidence remains evidence. Manual records never acquire a fabricated actor.
export const resolveEffectiveSchoolBlockState = ({ plan, block, state = null, inheritedState = null, evidence = [] }) => {
  const scope = { parent_id: plan.parent_id, student_id: plan.student_id, week_key: plan.week_key, weekly_plan_id: plan.id, weekly_block_id: block.id };
  state = state || inheritedState;
  if (state) {
    assertSameScope(state, scope, blockScopeKeys);
    assertVersion(state);
    requireValue(state.id === buildBlockCompletionStateId({ planId: plan.id, blockId: block.id }), 'invalid-state-identity');
    assertUniqueStrings(state.original_evidence_ids, 'invalid-evidence-references');
    requireValue(integer(state.revision) && ['completed', 'incomplete'].includes(state.status), 'invalid-block-state');
    return clone(state);
  }
  const relevant = evidence.filter((item) => item.student_id === plan.student_id && item.parent_id === plan.parent_id
    && (item.weekly_block_id ? item.weekly_block_id === block.id && item.weekly_plan_id === plan.id
      : plan.school_completion_version !== 1 && item.subject_id === block.legacy_subject_id && item.block_index === block.legacy_block_index));
  const latest = relevant.at(-1);
  return { ...scope, id: buildBlockCompletionStateId({ planId: plan.id, blockId: block.id }), schema_version: 1, revision: 0,
    status: relevant.length ? 'completed' : 'incomplete', original_evidence_ids: relevant.map((item) => item.id),
    provenance: latest ? latest.manual_override ? 'legacy_parent' : latest.authority_version === 1 ? 'student' : 'legacy_student' : null,
    actor_id: latest?.authority_version === 1 ? plan.student_id : null, completed_at: latest?.timestamp ?? null,
    updated_at: null, last_correction_event_id: null };
};
export const projectStudentSchoolBlockState = (state, block = {}) => ({
  weekly_block_id: state.weekly_block_id, legacy_subject_id: block.legacy_subject_id ?? '', legacy_block_index: block.legacy_block_index ?? null,
  status: state.status, revision: state.revision, provenance: state.provenance ?? null,
  completed_at: state.status === 'completed' ? state.completed_at ?? null : null, evidence_count: state.original_evidence_ids?.length ?? 0,
});
export const validateSchoolStudentResponse = (payload, block) => {
  requireValue(typeof payload.summary_text === 'string' && payload.summary_text.length <= 20000, 'invalid-response');
  requireValue(record(payload.custom_field_responses) && Array.isArray(payload.resources_used), 'invalid-response');
  const fields = block.custom_fields || [];
  requireValue(Object.keys(payload.custom_field_responses).every((key) => fields.some((field) => field.id === key)), 'invalid-custom-field');
  const present = (value) => typeof value === 'string' ? Boolean(value.trim()) : Array.isArray(value) ? value.length > 0 : typeof value === 'number' || typeof value === 'boolean';
  requireValue(Object.values(payload.custom_field_responses).every((value) => typeof value === 'string' || typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean' || Array.isArray(value) && value.every((item) => typeof item === 'string')), 'invalid-custom-field');
  requireValue(fields.every((field) => !field.required || present(payload.custom_field_responses[field.id])), 'missing-required-response');
  requireValue(!block.require_input || payload.summary_text.trim().length >= 150, 'missing-required-response');
  requireValue(payload.resources_used.every((index) => integer(index) && index < (block.resources || []).length)
    && new Set(payload.resources_used).size === payload.resources_used.length, 'invalid-resources');
  return true;
};
export const schoolTimerContext = (plan, block, revision) => JSON.stringify({
  plan_id: plan.id, week_key: plan.week_key, block_id: block.id, revision,
  duration: block.planned_duration_minutes, require_timer: block.require_timer,
  require_input: block.require_input, fields: block.custom_fields, resources: block.resources,
});
export const trustedSchoolTimerElapsedMs = (timer, nowMs) => Math.max(0, timer.elapsed_ms + (timer.status === 'running' ? nowMs - timer.started_at_ms : 0));
export const projectStudentSchoolTimer = (timer) => !timer || timer.status === 'reset' || timer.status === 'released' ? null : pick(timer, [
  'id', 'session_id', 'student_id', 'week_key', 'weekly_plan_id', 'weekly_block_id', 'subject_id', 'block_index', 'state_revision',
  'status', 'duration_ms', 'elapsed_ms', 'started_at_ms', 'target_end_ms', 'authority_version', 'context_signature',
]);
export const buildSchoolTimerCommand = ({ action, sessionId, currentTimer, plan, block, state, nowMs }) => {
  requireValue(state.status !== 'completed' && block.require_timer === true, 'timer-not-required');
  requireValue(Number.isFinite(block.planned_duration_minutes) && block.planned_duration_minutes > 0 && block.planned_duration_minutes <= 1440, 'invalid-timer-duration');
  const context = schoolTimerContext(plan, block, state.revision);
  const valid = currentTimer?.authority_version === 1 && currentTimer.context_signature === context && currentTimer.session_id === sessionId
    && ['running', 'paused'].includes(currentTimer.status);
  if (action === 'start') {
    requireValue(!currentTimer || !['running', 'paused'].includes(currentTimer.status) || currentTimer.context_signature === context, 'another-timer-active');
    if (currentTimer?.context_signature === context && ['running', 'paused'].includes(currentTimer.status)) return clone(currentTimer);
    return { id: plan.student_id, session_id: sessionId, parent_id: plan.parent_id, student_id: plan.student_id, week_key: plan.week_key,
      weekly_plan_id: plan.id, weekly_block_id: block.id, subject_id: block.legacy_subject_id, block_index: block.legacy_block_index,
      state_revision: state.revision, authority_version: 1, context_signature: context, status: 'running',
      duration_ms: block.planned_duration_minutes * 60000, elapsed_ms: 0, started_at_ms: nowMs,
      target_end_ms: nowMs + block.planned_duration_minutes * 60000 };
  }
  requireValue(valid, 'stale-timer-context');
  const elapsed = Math.min(currentTimer.duration_ms, trustedSchoolTimerElapsedMs(currentTimer, nowMs));
  if (action === 'pause') return { ...currentTimer, status: 'paused', elapsed_ms: elapsed, started_at_ms: null, target_end_ms: null };
  if (action === 'resume') return { ...currentTimer, status: 'running', elapsed_ms: elapsed, started_at_ms: nowMs, target_end_ms: nowMs + currentTimer.duration_ms - elapsed };
  requireValue(action === 'reset', 'invalid-timer-action');
  return { ...currentTimer, status: 'reset', elapsed_ms: 0, started_at_ms: null, target_end_ms: null };
};
