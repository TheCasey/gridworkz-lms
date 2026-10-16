// Canonical browser-safe foundation v1 planning contracts. Packaged with Functions.
const Collections = {"WEEKLY_PLANS": "weeklyPlans", "WEEKLY_PLAN_DRAFTS": "weeklyPlanDrafts", "STUDENT_DEFAULT_WEEKS": "studentDefaultWeeks"};
const CustomFieldSchema = {"id": "string", "type": "string", "label": "string", "placeholder": "string", "required": "boolean"};
const ProductDirectionContractVersion = 1;
const ResourceSchema = {"name": "string", "url": "string", "lockdown_origin": "string", "youtube_channel_id": "string", "youtube_channel_title": "string", "youtube_channel_handle": "string"};
const WeeklyBlockCategoryValues = ["lesson", "review", "practice", "assessment", "project_work"];
const WeeklyBlockCompletionModeValues = ["time_boxed", "task_complete", "hybrid"];
const WeeklyBlockInstanceSchema = {"id": "string", "assignment_id": "string", "student_id": "string", "title": "string", "instruction": "string", "resources": "array", "custom_fields": "array", "category": "string", "completion_mode": "string", "planned_duration_minutes": "number", "require_timer": "boolean", "require_input": "boolean", "legacy_subject_id": "string", "legacy_subject_title": "string", "legacy_block_index": "number", "curriculum_block_id": "string", "curriculum_block_title": "string", "curriculum_block_type": "string", "curriculum_block_source_index": "number", "curriculum_block_occurrence": "number", "instance_key": "string"};
const WeeklyPlanStatuses = {"DRAFT": "draft", "PUBLISHED": "published", "ARCHIVED": "archived"};
const buildWeeklyPlanDocumentId = ({ parentId, studentId, weekKey }) => [parentId, studentId, weekKey].join("_");
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

export const projectPublicWeeklyBlocks = (blocks) => blocks.map((block) => ({
  ...projectTypedFields(block, WeeklyBlockInstanceSchema),
  resources: block.resources.map((resource) => projectTypedFields(resource, ResourceSchema)),
  custom_fields: block.custom_fields.map((field) => projectTypedFields(field, CustomFieldSchema)),
}));

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
    blocks: projectPublicWeeklyBlocks(draft.blocks),
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

