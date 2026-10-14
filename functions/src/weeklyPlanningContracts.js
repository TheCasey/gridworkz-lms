import {
  adoptLegacyWeeklyBlockInstances,
  assertRetainedBlockIdentities,
  buildStableWeeklyBlockId,
  buildStudentDefaultWeekWrite,
  buildWeeklyPlanPublishWrites,
  nextContractRevision,
  projectPublicWeeklyBlocks,
  validatePrivateWeeklyPlanDraft,
} from './weeklyPlanningFoundation.js';

export const WEEKLY_PLANNING_COLLECTIONS = Object.freeze({ DRAFTS: 'weeklyPlanDrafts', PLANS: 'weeklyPlans', DEFAULTS: 'studentDefaultWeeks', RECEIPTS: 'weeklyPlanningReceipts' });
export const requireWeeklyPlanning = (condition, code) => {
  if (!condition) { const error = new Error(code); error.code = code; throw error; }
};
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value === value.trim() && value.length > 0;
const revision = (value) => Number.isSafeInteger(value) && value >= 0;
export const validatePlanningId = (id) => requireWeeklyPlanning(text(id) && !id.includes('/') && id.length <= 300 && !['.', '..'].includes(id), 'invalid-identity');
const validDateKey = (key) => text(key) && /^\d{4}-\d{2}-\d{2}$/.test(key)
  && Number.isFinite(new Date(`${key}T00:00:00Z`).getTime()) && new Date(`${key}T00:00:00Z`).toISOString().slice(0, 10) === key;
export const weeklyPlanningPlanId = ({ parentId, studentId, weekKey }) => {
  validatePlanningId(parentId); validatePlanningId(studentId);
  requireWeeklyPlanning(validDateKey(weekKey), 'invalid-date-key');
  const id = `${parentId}_${studentId}_${weekKey}`;
  requireWeeklyPlanning(id.length <= 1500, 'identity-too-long'); return id;
};
export const validatePlanningPayload = (payload, action) => {
  const fields = action === 'defaults'
    ? ['student_id', 'default_block_quantities', 'expected_revision', 'idempotency_key']
    : action === 'archive' ? ['student_id', 'week_key', 'expected_published_revision', 'idempotency_key']
      : ['student_id', 'week_key', 'candidate', 'expected_draft_revision', 'expected_published_revision', 'idempotency_key'];
  requireWeeklyPlanning(record(payload) && Object.keys(payload).every((key) => fields.includes(key)), 'unsupported-request-field');
  validatePlanningId(payload.student_id); validatePlanningId(payload.idempotency_key);
  const revisions = action === 'defaults' ? ['expected_revision'] : action === 'archive' ? ['expected_published_revision'] : ['expected_draft_revision', 'expected_published_revision'];
  requireWeeklyPlanning(revisions.every((key) => revision(payload[key])), 'invalid-revision');
  if (action !== 'defaults') requireWeeklyPlanning(validDateKey(payload.week_key), 'invalid-date-key');
  if (['save', 'publish'].includes(action)) requireWeeklyPlanning(record(payload.candidate), 'invalid-candidate');
  return true;
};
const assertVersion = (document) => {
  if (!document) return;
  requireWeeklyPlanning(document.schema_version == null || document.schema_version === 1, 'unsupported-contract-version');
  requireWeeklyPlanning(document.schema_version === 1 ? revision(document.revision) && document.revision > 0 : document.revision == null, 'invalid-revision');
};
export const getPlanningRevision = (document) => { assertVersion(document); return document?.revision ?? 0; };
export const assertPlanningScope = (document, { parentId, studentId, weekKey, planId }) => {
  if (!document) return;
  requireWeeklyPlanning(document.parent_id === parentId && document.student_id === studentId && document.week_key === weekKey && document.id === planId, 'scope-mismatch');
  assertVersion(document);
};

const shiftDate = (key, days) => { const date = new Date(`${key}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
export const normalizePlanningWeekConfig = (settings = {}) => {
  const config = {
    week_reset_day: settings.week_reset_day ?? 1,
    week_reset_hour: settings.week_reset_hour ?? 0,
    week_reset_minute: settings.week_reset_minute ?? 0,
    timezone: settings.timezone || 'America/Chicago',
  };
  requireWeeklyPlanning(Number.isInteger(config.week_reset_day) && config.week_reset_day >= 0 && config.week_reset_day <= 6
    && Number.isInteger(config.week_reset_hour) && config.week_reset_hour >= 0 && config.week_reset_hour <= 23
    && Number.isInteger(config.week_reset_minute) && config.week_reset_minute >= 0 && config.week_reset_minute <= 59, 'invalid-week-reset');
  try { new Intl.DateTimeFormat('en-US', { timeZone: config.timezone }).format(new Date()); } catch { requireWeeklyPlanning(false, 'invalid-timezone'); }
  return config;
};
const formatterCache = new Map();
const localParts = (date, timezone) => {
  if (!formatterCache.has(timezone)) formatterCache.set(timezone, new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }));
  const parts = Object.fromEntries(formatterCache.get(timezone).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return { key: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute), second: Number(parts.second) };
};
// Resolve local reset wall time by comparing real instants. On a DST gap reset
// occurs at the first available local minute; on a fold it occurs only once.
const resetInstant = (key, config) => {
  const utc = new Date(`${key}T00:00:00Z`).getTime();
  const desiredMinute = config.week_reset_hour * 60 + config.week_reset_minute;
  for (let minute = -24 * 60; minute <= 48 * 60; minute++) {
    const instant = new Date(utc + minute * 60000);
    const local = localParts(instant, config.timezone);
    if (local.key === key && local.minute >= desiredMinute) return instant;
  }
  requireWeeklyPlanning(false, 'invalid-week-boundary');
};
export const resolvePlanningWeek = ({ weekKey, settings, now }) => {
  requireWeeklyPlanning(validDateKey(weekKey) && now instanceof Date && Number.isFinite(now.getTime()), 'invalid-date-key');
  const config = normalizePlanningWeekConfig(settings);
  const localNow = localParts(now, config.timezone);
  const weekday = new Date(`${localNow.key}T00:00:00Z`).getUTCDay();
  let currentKey = shiftDate(localNow.key, -((weekday - config.week_reset_day + 7) % 7));
  if (now < resetInstant(currentKey, config)) currentKey = shiftDate(currentKey, -7);
  const start = resetInstant(weekKey, config);
  const end = new Date(resetInstant(shiftDate(weekKey, 7), config).getTime() - 1);
  return { currentKey, weekStart: start, weekEnd: end, config };
};
export const assertPlanningWeekEditable = (weekKey, range) => {
  requireWeeklyPlanning(weekKey >= range.currentKey, 'past-week-immutable');
  requireWeeklyPlanning(new Date(`${weekKey}T00:00:00Z`).getUTCDay() === range.config.week_reset_day, 'invalid-week-key');
};

const sourceActive = (source) => source && source.is_active !== false && source.is_archived !== true && source.archived !== true && source.status !== 'archived' && source.archived_at == null;
const ownedAssignment = (subject, parentId, studentId) => subject?.parent_id === parentId
  && (Array.isArray(subject.student_ids) && subject.student_ids.length > 0 ? subject.student_ids.includes(studentId) : subject.student_id === studentId);
const definitionIds = (subject) => Array.isArray(subject.curriculum_blocks)
  ? subject.curriculum_blocks.map((block, index) => ({ ...block, id: block.id || `block_${index + 1}` }))
  : Array.from({ length: Math.max(1, Number.parseInt(subject.block_count, 10) || 10) }, (_, index) => ({ id: `legacy_${index + 1}` }));
export const assertPlanningAssignments = ({ candidate, subjects, parentId, studentId }) => {
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const assignments = new Set(subjects.filter((subject) => ownedAssignment(subject, parentId, studentId) && sourceActive(subject))
    .map((subject) => `legacy-assignment_${studentId}_${subject.id}`));
  requireWeeklyPlanning(candidate.assignment_ids.every((id) => assignments.has(id)), 'invalid-assignment-reference');
  candidate.blocks.forEach((block) => {
    const subject = byId.get(block.legacy_subject_id);
    requireWeeklyPlanning(ownedAssignment(subject, parentId, studentId) && sourceActive(subject), 'invalid-assignment-reference');
    requireWeeklyPlanning(block.assignment_id === `legacy-assignment_${studentId}_${subject.id}`, 'invalid-assignment-reference');
    requireWeeklyPlanning(Number.isSafeInteger(block.legacy_block_index) && block.legacy_block_index >= 0, 'invalid-compatibility-reference');
    if (block.curriculum_block_id) requireWeeklyPlanning(definitionIds(subject).some((definition) => definition.id === block.curriculum_block_id && sourceActive(definition)), 'invalid-curriculum-reference');
  });
  const compatibility = candidate.blocks.map((block) => `${block.legacy_subject_id}:${block.legacy_block_index}`);
  requireWeeklyPlanning(new Set(compatibility).size === compatibility.length, 'duplicate-compatibility-reference');
};
const sameIdentity = (left, right) => ['assignment_id', 'instance_key', 'curriculum_block_id', 'legacy_subject_id', 'legacy_block_index'].every((key) => left[key] === right[key]);
const identity = (block) => Object.fromEntries(['assignment_id', 'instance_key', 'curriculum_block_id', 'legacy_subject_id', 'legacy_block_index'].filter((key) => block[key] !== undefined).map((key) => [key, block[key]]));
export const retainPlanningIdentityHistory = ({ currentDraft, currentPublished, blocks }) => {
  const history = Object.assign(Object.create(null), currentDraft?.block_identity_history || {});
  const previous = [currentDraft, currentPublished].filter(Boolean).flatMap((plan) => adoptLegacyWeeklyBlockInstances(plan));
  previous.forEach((block) => { requireWeeklyPlanning(!history[block.id] || sameIdentity(history[block.id], block), 'block-identity-reused'); history[block.id] = identity(block); });
  const retained = Object.entries(history).map(([id, value]) => ({ id, ...value }));
  assertRetainedBlockIdentities(retained, blocks);
  blocks.forEach((block) => {
    requireWeeklyPlanning(!history[block.id] || sameIdentity(history[block.id], block), 'block-identity-reused');
    requireWeeklyPlanning(!retained.some((previous) => previous.id !== block.id
      && previous.legacy_subject_id === block.legacy_subject_id && previous.legacy_block_index === block.legacy_block_index), 'block-compatibility-reused');
    history[block.id] = identity(block);
  });
  requireWeeklyPlanning(Object.keys(history).length <= 2000, 'identity-history-limit');
  return Object.fromEntries(Object.entries(history));
};

export const buildPlanningCandidate = ({ candidate, currentDraft, currentPublished, parentId, studentId, weekKey, planId, expectedDraftRevision, expectedPublishedRevision, range, serverTime, subjects }) => {
  assertPlanningScope(currentDraft, { parentId, studentId, weekKey, planId });
  assertPlanningScope(currentPublished, { parentId, studentId, weekKey, planId });
  requireWeeklyPlanning(currentDraft?.status !== 'archived' && currentPublished?.status !== 'archived', 'archived-plan-immutable');
  requireWeeklyPlanning(!currentPublished || ['draft', 'published'].includes(currentPublished.status), 'invalid-plan-status');
  const draftRevision = getPlanningRevision(currentDraft);
  const publishedRevision = getPlanningRevision(currentPublished);
  nextContractRevision({ expectedRevision: expectedDraftRevision, currentRevision: draftRevision });
  nextContractRevision({ expectedRevision: expectedPublishedRevision, currentRevision: publishedRevision });
  if (currentDraft) requireWeeklyPlanning(currentDraft.base_published_revision === publishedRevision, 'published-base-conflict');
  assertPlanningWeekEditable(weekKey, range);
  const allowed = ['id', 'parent_id', 'student_id', 'week_key', 'week_start', 'week_end', 'status', 'schema_version', 'revision', 'base_published_revision', 'assignment_ids', 'weekly_exceptions', 'blocks', 'parent_notes', 'published_at', 'archived_at', 'created_at', 'updated_at'];
  requireWeeklyPlanning(record(candidate) && Object.keys(candidate).every((key) => allowed.includes(key)), 'unsupported-candidate-field');
  assertPlanningScope({ ...candidate, schema_version: undefined, revision: undefined }, { parentId, studentId, weekKey, planId });
  requireWeeklyPlanning(candidate.schema_version == null || candidate.schema_version === 1, 'unsupported-contract-version');
  requireWeeklyPlanning(candidate.parent_notes == null || typeof candidate.parent_notes === 'string', 'invalid-parent-notes');
  requireWeeklyPlanning(Array.isArray(candidate.blocks) && candidate.blocks.length <= 500, 'invalid-blocks');
  const persistedBlocks = [currentDraft, currentPublished].filter(Boolean).flatMap((plan) => plan.blocks || []);
  candidate.blocks.forEach((block) => {
    if (block?.instance_key == null) {
      const previous = persistedBlocks.find((stored) => stored.id === block?.id);
      requireWeeklyPlanning(Boolean(previous), 'missing-stable-block-identity');
      requireWeeklyPlanning(previous.instance_key == null || previous.instance_key === `legacy:${previous.id}`, 'missing-stable-block-identity');
    }
  });
  const blocks = adoptLegacyWeeklyBlockInstances(candidate);
  const draft = {
    id: planId, parent_id: parentId, student_id: studentId, week_key: weekKey,
    week_start: range.weekStart, week_end: range.weekEnd, status: 'draft', schema_version: 1,
    revision: draftRevision || 1, base_published_revision: publishedRevision,
    assignment_ids: candidate.assignment_ids, weekly_exceptions: candidate.weekly_exceptions,
    blocks, parent_notes: candidate.parent_notes ?? '', published_at: null, archived_at: null,
    created_at: currentDraft?.created_at ?? serverTime, updated_at: serverTime,
  };
  validatePrivateWeeklyPlanDraft(draft);
  projectPublicWeeklyBlocks(draft.blocks);
  requireWeeklyPlanning(draft.weekly_exceptions.every((item) => typeof item === 'string'), 'unsupported-weekly-exception');
  assertPlanningAssignments({ candidate: draft, subjects, parentId, studentId });
  draft.block_identity_history = retainPlanningIdentityHistory({ currentDraft, currentPublished, blocks });
  return draft;
};
export const buildPlanningSaveWrite = (options) => {
  const draft = buildPlanningCandidate(options);
  draft.revision = nextContractRevision({ expectedRevision: options.expectedDraftRevision, currentRevision: getPlanningRevision(options.currentDraft) });
  return { collection: WEEKLY_PLANNING_COLLECTIONS.DRAFTS, id: draft.id, data: draft };
};
export const buildPlanningPublishWrites = (options) => {
  const draft = buildPlanningCandidate(options);
  const storedDraftRevision = getPlanningRevision(options.currentDraft);
  const storedPublishedRevision = getPlanningRevision(options.currentPublished);
  const legacyPublished = options.currentPublished && options.currentPublished.schema_version == null;
  // Foundation requires positive persisted drafts. A first publish has no private
  // draft yet; virtual revision 1 is normalized back to committed revision 1.
  const writes = buildWeeklyPlanPublishWrites({
    draft: { ...draft, base_published_revision: legacyPublished ? 0 : storedPublishedRevision },
    currentPublished: legacyPublished ? null : options.currentPublished,
    expectedDraftRevision: storedDraftRevision || 1,
    expectedPublishedRevision: legacyPublished ? 0 : options.expectedPublishedRevision,
    actorId: options.parentId, serverTime: options.serverTime,
  });
  writes[0].data.revision = storedDraftRevision + 1;
  if (legacyPublished) writes[1].data.created_at = options.currentPublished.created_at ?? options.serverTime;
  return writes;
};
export const buildPlanningDefaultWrite = ({ parentId, studentId, defaultBlockQuantities, currentDefaults, expectedRevision, serverTime, subjects }) => {
  requireWeeklyPlanning(record(defaultBlockQuantities) && Object.keys(defaultBlockQuantities).length <= 200, 'invalid-default-quantities');
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  Object.entries(defaultBlockQuantities).forEach(([subjectId, quantities]) => {
    const subject = byId.get(subjectId);
    requireWeeklyPlanning(record(quantities), 'invalid-default-quantities');
    if (!ownedAssignment(subject, parentId, studentId) || !sourceActive(subject)) {
      const previous = currentDefaults?.default_block_quantities?.[subjectId];
      requireWeeklyPlanning(record(previous) && Object.keys(previous).length === Object.keys(quantities).length
        && Object.entries(previous).every(([id, quantity]) => quantities[id] === quantity), 'invalid-assignment-reference');
      return;
    }
    Object.entries(quantities).forEach(([blockId, quantity]) => {
      requireWeeklyPlanning(Number.isSafeInteger(quantity) && quantity >= 0 && quantity <= 20, 'invalid-default-quantities');
      requireWeeklyPlanning(definitionIds(subject).some((block) => block.id === blockId && sourceActive(block))
        || currentDefaults?.default_block_quantities?.[subjectId]?.[blockId] === quantity, 'invalid-curriculum-reference');
    });
  });
  return buildStudentDefaultWeekWrite({ parentId, studentId, defaultBlockQuantities, currentDefaults, expectedRevision, actorId: parentId, serverTime });
};
export const buildPlanningArchiveWrite = ({ currentPublished, parentId, studentId, weekKey, planId, expectedPublishedRevision, range, serverTime }) => {
  requireWeeklyPlanning(Boolean(currentPublished), 'missing-published-plan');
  assertPlanningScope(currentPublished, { parentId, studentId, weekKey, planId });
  requireWeeklyPlanning(weekKey < range.currentKey, 'current-or-future-week');
  requireWeeklyPlanning(expectedPublishedRevision === getPlanningRevision(currentPublished), 'revision-conflict');
  requireWeeklyPlanning(['published', 'archived'].includes(currentPublished.status), 'unpublished-archive-target');
  if (currentPublished.status === 'archived') return null;
  // Content, revision, evidence references and the historical calendar survive.
  return { collection: WEEKLY_PLANNING_COLLECTIONS.PLANS, id: planId, data: { ...currentPublished, status: 'archived', archived_at: serverTime, updated_at: serverTime } };
};
export const planningInstanceIdentityKey = (block) => buildStableWeeklyBlockId({ assignmentId: block.assignment_id, instanceKey: block.instance_key });
