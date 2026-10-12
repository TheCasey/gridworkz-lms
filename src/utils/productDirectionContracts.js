import {
  Collections,
  CustomFieldSchema,
  EffectiveBlockStatuses,
  ProductDirectionContractVersion,
  ResourceSchema,
  WeeklyBlockCategoryValues,
  WeeklyBlockCompletionModeValues,
  WeeklyBlockInstanceSchema,
  WeeklyPlanStatuses,
} from '../constants/schema.js';
import { buildWeeklyPlanDocumentId } from './weeklyPlanUtils.js';

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
const projectTypedFields = (value, schema) => {
  requireValue(record(value), 'invalid-public-field');
  const result = pick(value, Object.keys(schema));
  Object.entries(result).forEach(([key, item]) => {
    const type = schema[key];
    requireValue(type === 'array' ? Array.isArray(item) : typeof item === type, 'invalid-public-field');
  });
  return result;
};
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

export const buildStudentDefaultWeekId = ({ parentId, studentId }) => {
  requireValue(text(parentId) && text(studentId) && !parentId.includes('/') && !studentId.includes('/'), 'invalid-identity');
  return `${parentId}_${studentId}`;
};
export const buildStableWeeklyBlockId = ({ assignmentId, instanceKey }) => scopedId('block', [assignmentId, instanceKey]);
export const buildBlockCompletionStateId = ({ planId, blockId }) => scopedId('block-state', [planId, blockId]);
export const buildParentCorrectionEventId = ({ parentId, idempotencyKey }) => scopedId('correction', [parentId, idempotencyKey]);
export const buildRoutineDaySnapshotId = ({ parentId, studentId, date }) => {
  requireValue(dateKey(date), 'invalid-date-key');
  return scopedId('routine-day', [parentId, studentId, date]);
};
export const buildStudentCosmeticStateId = ({ parentId, studentId }) => scopedId('cosmetics', [parentId, studentId]);

export const nextContractRevision = ({ expectedRevision, currentRevision }) => {
  requireValue(integer(expectedRevision) && integer(currentRevision), 'invalid-revision');
  requireValue(expectedRevision === currentRevision, 'revision-conflict');
  requireValue(currentRevision < Number.MAX_SAFE_INTEGER, 'revision-overflow');
  return currentRevision + 1;
};

export const validateStudentDefaultWeek = (defaults, { parentId, studentId } = {}) => {
  assertVersion(defaults);
  requireValue(text(parentId) && text(studentId), 'invalid-identity');
  requireValue(defaults.parent_id === parentId && defaults.student_id === studentId, 'scope-mismatch');
  requireValue(integer(defaults.revision, 1), 'invalid-revision');
  requireValue(record(defaults.default_block_quantities), 'invalid-default-quantities');
  Object.entries(defaults.default_block_quantities).forEach(([subjectId, quantities]) => {
    requireValue(text(subjectId) && record(quantities), 'invalid-default-quantities');
    requireValue(Object.entries(quantities).every(([blockId, quantity]) => text(blockId) && integer(quantity)), 'invalid-default-quantities');
  });
  return true;
};

export const buildStudentDefaultWeekWrite = ({ parentId, studentId, defaultBlockQuantities, currentDefaults = null, expectedRevision, actorId, serverTime }) => {
  assertTrustedContext(parentId, actorId, serverTime);
  if (currentDefaults) validateStudentDefaultWeek(currentDefaults, { parentId, studentId });
  const data = {
    parent_id: parentId, student_id: studentId, schema_version: ProductDirectionContractVersion,
    revision: nextContractRevision({ expectedRevision, currentRevision: currentDefaults?.revision ?? 0 }),
    default_block_quantities: clone(defaultBlockQuantities),
    created_at: currentDefaults?.created_at ?? serverTime, updated_at: serverTime,
  };
  validateStudentDefaultWeek(data, { parentId, studentId });
  return { collection: Collections.STUDENT_DEFAULT_WEEKS, id: buildStudentDefaultWeekId({ parentId, studentId }), data };
};

export const validateWeeklyBlockInstances = (blocks, studentId) => {
  requireValue(Array.isArray(blocks) && text(studentId), 'invalid-blocks');
  const ids = new Set();
  const instances = new Set();
  blocks.forEach((block) => {
    requireValue(record(block) && text(block.id) && text(block.assignment_id) && text(block.instance_key), 'missing-stable-block-identity');
    requireValue(block.student_id === studentId, 'scope-mismatch');
    const instance = buildStableWeeklyBlockId({ assignmentId: block.assignment_id, instanceKey: block.instance_key });
    requireValue(!ids.has(block.id) && !instances.has(instance), 'duplicate-block-identity');
    ids.add(block.id);
    instances.add(instance);
    requireValue(WeeklyBlockCategoryValues.includes(block.category), 'invalid-block-category');
    requireValue(WeeklyBlockCompletionModeValues.includes(block.completion_mode), 'invalid-completion-mode');
    requireValue(integer(block.planned_duration_minutes, 1), 'invalid-block-duration');
    requireValue(typeof block.require_timer === 'boolean' && typeof block.require_input === 'boolean', 'invalid-block-requirements');
    requireValue(typeof block.title === 'string' && typeof block.instruction === 'string', 'invalid-block-copy');
    requireValue(Array.isArray(block.resources) && Array.isArray(block.custom_fields), 'invalid-block-inputs');
  });
  return true;
};

export const validatePrivateWeeklyPlanDraft = (draft) => {
  assertVersion(draft);
  requireValue(text(draft?.parent_id) && text(draft?.student_id) && dateKey(draft?.week_key), 'invalid-plan-scope');
  requireValue(draft.id === buildWeeklyPlanDocumentId({ parentId: draft.parent_id, studentId: draft.student_id, weekKey: draft.week_key }), 'invalid-plan-identity');
  requireValue(draft.status === WeeklyPlanStatuses.DRAFT, 'draft-status-required');
  requireValue(integer(draft.revision, 1) && integer(draft.base_published_revision), 'invalid-revision');
  requireValue(draft.published_at == null && draft.archived_at == null, 'draft-publish-separation');
  requireValue(draft.week_start != null && draft.week_end != null, 'missing-week-range');
  assertUniqueStrings(draft.assignment_ids, 'invalid-assignment-ids');
  requireValue(Array.isArray(draft.weekly_exceptions), 'invalid-weekly-exceptions');
  validateWeeklyBlockInstances(draft.blocks, draft.student_id);
  requireValue(draft.blocks.every((block) => draft.assignment_ids.includes(block.assignment_id)), 'missing-assignment-reference');
  return true;
};

export const assertRetainedBlockIdentities = (previousBlocks, nextBlocks) => {
  const previousById = new Map(previousBlocks.map((block) => [block.id, block]));
  const previousByInstance = new Map(previousBlocks.map((block) => [
    buildStableWeeklyBlockId({ assignmentId: block.assignment_id, instanceKey: block.instance_key }), block,
  ]));
  nextBlocks.forEach((block) => {
    const previous = previousById.get(block.id);
    requireValue(!previous || (previous.assignment_id === block.assignment_id
      && previous.instance_key === block.instance_key
      && previous.curriculum_block_id === block.curriculum_block_id), 'block-identity-reused');
    const sameInstance = previousByInstance.get(buildStableWeeklyBlockId({ assignmentId: block.assignment_id, instanceKey: block.instance_key }));
    requireValue(!sameInstance || sameInstance.id === block.id, 'block-identity-renumbered');
  });
  return true;
};

// Preserve existing persisted ids; never regenerate them from a new quantity/order.
export const adoptLegacyWeeklyBlockInstances = (plan) => {
  requireValue(Array.isArray(plan?.blocks), 'invalid-blocks');
  const blocks = plan.blocks.map((block) => {
    requireValue(text(block?.id), 'missing-stable-block-identity');
    return { ...clone(block), instance_key: block.instance_key ?? `legacy:${block.id}` };
  });
  validateWeeklyBlockInstances(blocks, plan.student_id);
  return blocks;
};

// One transaction must read both documents and apply both writes. This only builds intent.
export const buildWeeklyPlanPublishWrites = ({ draft, currentPublished = null, expectedDraftRevision, expectedPublishedRevision, actorId, serverTime }) => {
  validatePrivateWeeklyPlanDraft(draft);
  assertTrustedContext(draft.parent_id, actorId, serverTime);
  const draftRevision = nextContractRevision({ expectedRevision: expectedDraftRevision, currentRevision: draft.revision });
  const currentRevision = currentPublished?.revision ?? 0;
  const publishedRevision = nextContractRevision({ expectedRevision: expectedPublishedRevision, currentRevision });
  requireValue(draft.base_published_revision === currentRevision, 'published-base-conflict');
  if (currentPublished) {
    assertVersion(currentPublished);
    requireValue(integer(currentPublished.revision, 1), 'invalid-revision');
    requireValue(currentPublished.id === draft.id, 'scope-mismatch');
    assertSameScope(draft, currentPublished, ['parent_id', 'student_id', 'week_key']);
    requireValue(currentPublished.status === WeeklyPlanStatuses.PUBLISHED, 'archived-plan-immutable');
    validateWeeklyBlockInstances(currentPublished.blocks, draft.student_id);
    assertRetainedBlockIdentities(currentPublished.blocks, draft.blocks);
  }
  // Structured exceptions do not yet have a public schema; fail closed until one is adopted.
  requireValue(draft.weekly_exceptions.every((item) => typeof item === 'string'), 'unsupported-weekly-exception');
  const published = {
    ...pick(draft, ['id', 'parent_id', 'student_id', 'week_key', 'week_start', 'week_end', 'assignment_ids', 'weekly_exceptions']),
    schema_version: ProductDirectionContractVersion,
    revision: publishedRevision,
    status: WeeklyPlanStatuses.PUBLISHED,
    blocks: draft.blocks.map((block) => ({
      ...projectTypedFields(block, WeeklyBlockInstanceSchema),
      resources: block.resources.map((resource) => projectTypedFields(resource, ResourceSchema)),
      custom_fields: block.custom_fields.map((field) => projectTypedFields(field, CustomFieldSchema)),
    })),
    published_at: serverTime,
    archived_at: null,
    created_at: currentPublished?.created_at ?? serverTime,
    updated_at: serverTime,
  };
  return [
    { collection: Collections.WEEKLY_PLAN_DRAFTS, id: draft.id, data: { ...clone(draft), revision: draftRevision, base_published_revision: publishedRevision, updated_at: serverTime } },
    { collection: Collections.WEEKLY_PLANS, id: draft.id, data: published },
  ];
};

// No arbitrary first-match: callers must route ambiguous/missing legacy evidence to review.
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

export const buildReportAmendment = ({ originalReport, previousAmendment = null, correctionEvents, amendedSnapshot, expectedVersion, actorId, serverTime }) => {
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
    } else {
      assertReportScope(event);
    }
  });
  return {
    ...scope, id: scopedId('report-amendment', [originalReport.id, String(version)]),
    schema_version: ProductDirectionContractVersion, original_report_id: originalReport.id,
    previous_report_version_id: previousId, report_version: version,
    correction_event_ids: correctionEvents.map((event) => event.id), snapshot: clone(amendedSnapshot),
    actor_id: actorId, recorded_at: serverTime,
  };
};

export const validateRoutineDaySnapshot = (snapshot, { parentId, studentId } = {}) => {
  assertVersion(snapshot);
  requireValue(snapshot.parent_id === parentId && snapshot.student_id === studentId, 'scope-mismatch');
  requireValue(snapshot.id === buildRoutineDaySnapshotId({ parentId, studentId, date: snapshot.date_key }), 'invalid-snapshot-identity');
  requireValue(text(snapshot.timezone), 'invalid-timezone');
  try { new Intl.DateTimeFormat('en-US', { timeZone: snapshot.timezone }); } catch { fail('invalid-timezone', 'Invalid household timezone'); }
  requireValue(integer(snapshot.routine_day_points) && typeof snapshot.routine_points_enabled === 'boolean', 'invalid-routine-reward');
  requireValue(Array.isArray(snapshot.templates), 'invalid-routine-templates');
  const periods = new Set();
  assertUniqueStrings(snapshot.templates.map((template) => template?.id), 'invalid-routine-templates');
  snapshot.templates.forEach((template) => {
    requireValue(text(template.id) && ['morning', 'afternoon', 'evening'].includes(template.routine_period)
      && !periods.has(template.routine_period), 'invalid-routine-templates');
    periods.add(template.routine_period);
    requireValue(Array.isArray(template.checklist_items) && template.checklist_items.length > 0, 'empty-routine-period');
    assertUniqueStrings(template.checklist_items.map((item) => item?.id), 'invalid-routine-items');
    requireValue(template.checklist_items.every((item) => text(item.label)), 'invalid-routine-items');
  });
  return true;
};

export const isRoutineDaySnapshotComplete = (snapshot, completedItemIdsByTemplate) => {
  validateRoutineDaySnapshot(snapshot, { parentId: snapshot.parent_id, studentId: snapshot.student_id });
  return snapshot.templates.length > 0 && snapshot.templates.every((template) => (
    Array.isArray(completedItemIdsByTemplate?.[template.id])
    && template.checklist_items.every((item) => completedItemIdsByTemplate[template.id].includes(item.id))
  ));
};

export const validateStudentCosmeticState = (state, { parentId, studentId, catalog } = {}) => {
  assertVersion(state);
  requireValue(state.parent_id === parentId && state.student_id === studentId, 'scope-mismatch');
  requireValue(state.id === buildStudentCosmeticStateId({ parentId, studentId }) && integer(state.revision, 1), 'invalid-cosmetic-state');
  assertUniqueStrings(state.owned_cosmetic_ids, 'invalid-cosmetic-ownership');
  requireValue(record(state.selected_cosmetic_ids) && Array.isArray(catalog), 'invalid-cosmetic-selection');
  assertUniqueStrings(catalog.map((item) => item?.id), 'invalid-cosmetic-catalog');
  Object.entries(state.selected_cosmetic_ids).forEach(([slot, id]) => {
    requireValue(text(slot) && typeof id === 'string', 'invalid-cosmetic-selection');
    if (id === '') return;
    const item = catalog.find((entry) => entry.id === id);
    requireValue(state.owned_cosmetic_ids.includes(id), 'cosmetic-not-owned');
    requireValue(item?.type === 'built_in' && item.unlock_type === slot && item.is_active !== false, 'invalid-cosmetic-selection');
  });
  return true;
};
