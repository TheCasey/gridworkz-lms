import {
  ProductDirectionContractVersion,
} from '../constants/schema.js';
export {
  buildStudentDefaultWeekId, buildStableWeeklyBlockId, nextContractRevision,
  validateStudentDefaultWeek, buildStudentDefaultWeekWrite, validateWeeklyBlockInstances,
  validatePrivateWeeklyPlanDraft, assertRetainedBlockIdentities,
  adoptLegacyWeeklyBlockInstances, buildWeeklyPlanPublishWrites,
} from '../../functions/src/weeklyPlanningFoundation.js';

export {
  buildBlockCompletionStateId, buildParentCorrectionEventId, resolveLegacyWeeklyBlock,
  buildParentCorrection, buildReportAmendment, resolveEffectiveSchoolBlockState,
  projectStudentSchoolBlockState,
} from '../../functions/src/schoolCompletionFoundation.js';

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
const assertVersion = (value) => requireValue(
  value?.schema_version === ProductDirectionContractVersion, 'unsupported-contract-version'
);
const assertUniqueStrings = (values, code) => requireValue(
  Array.isArray(values) && values.every(text) && new Set(values).size === values.length, code
);

export const buildRoutineDaySnapshotId = ({ parentId, studentId, date }) => {
  requireValue(dateKey(date), 'invalid-date-key');
  return scopedId('routine-day', [parentId, studentId, date]);
};
export const buildStudentCosmeticStateId = ({ parentId, studentId }) => scopedId('cosmetics', [parentId, studentId]);

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
    requireValue(text(template.id) && (['morning', 'afternoon', 'evening'].includes(template.routine_period)
      || template.routine_period === `legacy:${template.id}`)
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
