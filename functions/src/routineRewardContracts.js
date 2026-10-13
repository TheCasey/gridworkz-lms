import { createHash } from 'node:crypto';
import { calculateAllowanceBalance } from './allowanceUtils.js';
import {
  PRODUCT_DIRECTION_VERSION,
  ROUTINE_REWARD_BASE_COSMETIC_ID,
  ROUTINE_REWARD_CATALOG,
  ROUTINE_REWARD_DEFAULTS,
  ROUTINE_REWARD_SLOTS,
} from './routineRewardCatalog.js';
export * from './routineRewardCatalog.js';

const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value) => typeof value === 'string' && value.length > 0 && value === value.trim();
const int = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
export const requireRoutineReward = (condition, code, message = code) => {
  if (!condition) { const error = new Error(message); error.code = code; throw error; }
};
const ids = (values) => Array.isArray(values) && values.every(string) && new Set(values).size === values.length;
const encodedId = (prefix, values) => {
  requireRoutineReward(values.every(string), 'invalid-identity');
  const result = `${prefix}:${values.map(encodeURIComponent).join(':')}`;
  requireRoutineReward(result.length <= 1500, 'invalid-identity');
  return result;
};
export const isProductDirectionActive = (entitlement = {}) => int(entitlement.product_direction_version, PRODUCT_DIRECTION_VERSION);
export const preserveProductDirectionMarkers = (entitlement = {}) => Object.fromEntries(
  ['product_direction_version', 'product_direction_migration_version', 'product_direction_migrated_at']
    .filter((key) => Object.hasOwn(entitlement, key)).map((key) => [key, entitlement[key]])
);
export const resolveRoutineRewardAccess = ({ features = {}, entitlementDoc = {} } = {}) => {
  const active = isProductDirectionActive(entitlementDoc);
  const canUseDailyRoutines = active ? features.can_use_daily_routines === true
    : features.can_use_daily_routines === true || features.can_use_chores === true;
  const canUseChores = !active && features.can_use_chores === true;
  const canUseRewards = !active && features.can_use_rewards === true;
  return {
    productDirectionActive: active,
    canUseDailyRoutines,
    canUseRoutineRewards: active && canUseDailyRoutines && features.can_use_routine_rewards === true,
    canUseChores, canUseRewards, canUsePaidModule: canUseChores || canUseRewards,
  };
};
export const normalizeRoutineRewardSettings = (settings = {}) => ({
  routine_day_points: int(settings.routine_day_points) ? settings.routine_day_points : ROUTINE_REWARD_DEFAULTS.routine_day_points,
  routine_points_enabled: typeof settings.routine_points_enabled === 'boolean' ? settings.routine_points_enabled : ROUTINE_REWARD_DEFAULTS.routine_points_enabled,
});
export const validateRoutineRewardSettingsPayload = (payload) => {
  requireRoutineReward(plain(payload) && Object.keys(payload).every((key) => ['routine_day_points', 'routine_points_enabled'].includes(key)), 'invalid-settings');
  requireRoutineReward(int(payload.routine_day_points) && typeof payload.routine_points_enabled === 'boolean', 'invalid-settings');
  return { routine_day_points: payload.routine_day_points, routine_points_enabled: payload.routine_points_enabled };
};
export const buildRoutineDaySnapshotId = ({ parentId, studentId, dateKey }) => {
  const date = typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? new Date(`${dateKey}T00:00:00Z`) : new Date(NaN);
  requireRoutineReward(Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateKey, 'invalid-date-key');
  return encodedId('routine-day', [parentId, studentId, dateKey]);
};
export const buildRoutineDayPointerId = ({ parentId, studentId }) => encodedId('routine-day-active', [parentId, studentId]);
export const buildRoutineCosmeticStateId = ({ parentId, studentId }) => encodedId('cosmetics', [parentId, studentId]);
export const buildHouseholdHistoryEventId = ({ parentId, idempotencyKey }) => {
  requireRoutineReward(string(parentId) && string(idempotencyKey), 'invalid-identity');
  return `history_${createHash('sha256').update(JSON.stringify([parentId, idempotencyKey])).digest('hex').slice(0, 32)}`;
};
const localParts = (date, timezone) => {
  requireRoutineReward(date instanceof Date && Number.isFinite(date.getTime()) && string(timezone), 'invalid-day-context');
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  } catch { requireRoutineReward(false, 'invalid-timezone'); }
};
export const routineLocalDateKey = (date, timezone) => {
  const parts = localParts(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const firstInstantForLocalDate = (dateKey, timezone) => {
  const target = Date.parse(`${dateKey}T00:00:00Z`);
  requireRoutineReward(Number.isFinite(target) && new Date(target).toISOString().slice(0, 10) === dateKey, 'invalid-date-key');
  // Midnight can be skipped by DST. Find the calendar boundary rather than
  // requiring local 00:00 to exist; a skipped following date is also valid here.
  let lower = target - 36 * 3600000;
  let upper = target + 36 * 3600000;
  requireRoutineReward(routineLocalDateKey(new Date(lower), timezone) < dateKey
    && routineLocalDateKey(new Date(upper), timezone) >= dateKey, 'invalid-day-context');
  while (upper - lower > 1) {
    const middle = Math.floor((lower + upper) / 2);
    if (routineLocalDateKey(new Date(middle), timezone) >= dateKey) upper = middle;
    else lower = middle;
  }
  return new Date(upper);
};
export const routineLocalDayWindow = (dateKey, timezone) => {
  const nextDate = new Date(`${dateKey}T00:00:00Z`);
  requireRoutineReward(Number.isFinite(nextDate.getTime()) && nextDate.toISOString().slice(0, 10) === dateKey, 'invalid-date-key');
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const start = firstInstantForLocalDate(dateKey, timezone);
  requireRoutineReward(routineLocalDateKey(start, timezone) === dateKey, 'invalid-day-context');
  return { day_start: start, day_end: firstInstantForLocalDate(nextDate.toISOString().slice(0, 10), timezone) };
};
const canonicalPeriods = ['morning', 'afternoon', 'evening'];
const inferredLegacyPeriod = (template) => {
  if (canonicalPeriods.includes(template.routine_period)) return template.routine_period;
  const title = typeof template.title === 'string' ? template.title.toLowerCase() : '';
  if (title.includes('morning')) return 'morning';
  if (title.includes('afternoon')) return 'afternoon';
  if (title.includes('evening') || title.includes('night')) return 'evening';
  return '';
};
export const selectRoutineSnapshotTemplates = ({ templates, parentId, studentId }) => {
  requireRoutineReward(Array.isArray(templates) && string(parentId) && string(studentId), 'invalid-templates');
  const assigned = templates.filter((template) => {
    requireRoutineReward(template.parent_id === parentId, 'scope-mismatch');
    const assignedIds = Array.isArray(template.student_ids) ? template.student_ids : [];
    return template.is_active !== false && (assignedIds.length === 0 || assignedIds.includes(studentId));
  });
  const isCanonical = (template) => Array.isArray(template.student_ids) && template.student_ids.length === 1
    && template.student_ids[0] === studentId && canonicalPeriods.includes(template.routine_period);
  const populated = assigned.filter((template) => Array.isArray(template.checklist_items) && template.checklist_items.some((item) => string(item?.label)));
  const replacedPeriods = new Set(populated.filter(isCanonical).map((template) => template.routine_period));
  const result = populated.filter((template) => isCanonical(template) || !replacedPeriods.has(inferredLegacyPeriod(template))).map((template) => {
    requireRoutineReward(string(template.id), 'invalid-template-identity');
    const items = template.checklist_items.filter((item) => string(item?.label)).map((item) => ({ id: item.id, label: item.label }));
    requireRoutineReward(ids(items.map((item) => item.id)), 'invalid-checklist');
    return {
      id: template.id, title: typeof template.title === 'string' ? template.title : '',
      routine_period: isCanonical(template) ? template.routine_period : `legacy:${template.id}`,
      legacy_routine_period: isCanonical(template) ? '' : inferredLegacyPeriod(template), checklist_items: items,
    };
  });
  requireRoutineReward(ids(result.map((template) => template.id)) && ids(result.map((template) => template.routine_period)), 'ambiguous-routine-templates');
  return result;
};
export const buildFrozenRoutineDaySnapshot = ({ parentId, studentId, now, timezone, templates, rewardSettings = {} }) => {
  const dateKey = routineLocalDateKey(now, timezone);
  return {
    id: buildRoutineDaySnapshotId({ parentId, studentId, dateKey }), parent_id: parentId, student_id: studentId,
    schema_version: 1, date_key: dateKey, timezone, ...routineLocalDayWindow(dateKey, timezone), recorded_at: now,
    ...normalizeRoutineRewardSettings(rewardSettings),
    templates: selectRoutineSnapshotTemplates({ templates, parentId, studentId }),
  };
};
export const validateRoutineCompletionItems = (template, completedItemIds) => {
  const required = template?.checklist_items?.map((item) => item.id);
  requireRoutineReward(ids(required) && required.length > 0 && ids(completedItemIds), 'invalid-checklist-completion');
  requireRoutineReward(required.length === completedItemIds.length && required.every((id) => completedItemIds.includes(id)), 'incomplete-checklist');
  return [...completedItemIds];
};
export const isFrozenRoutineDayComplete = (snapshot, completions) => snapshot.templates.length > 0 && snapshot.templates.every((template) => {
  const completion = completions.find((value) => value.routine_template_id === template.id);
  if (!completion || completion.parent_id !== snapshot.parent_id || completion.student_id !== snapshot.student_id || completion.date_key !== snapshot.date_key) return false;
  try { validateRoutineCompletionItems(template, completion.completed_item_ids); return Boolean(completion.completed_at); } catch { return false; }
});
export const buildFrozenRoutineDayAwardDecision = ({ snapshot, completions, canUseRoutineRewards, existingLedger = null }) => {
  const complete = isFrozenRoutineDayComplete(snapshot, completions);
  const enabled = canUseRoutineRewards && snapshot.routine_points_enabled && int(snapshot.routine_day_points, 1);
  return { complete, should_award: Boolean(complete && enabled && !existingLedger),
    delta_points: complete && enabled && !existingLedger ? snapshot.routine_day_points : 0 };
};
export const assertRoutineScopedRecord = (value, parentId, studentId) => requireRoutineReward(
  value.parent_id === parentId && value.student_id === studentId, 'scope-mismatch'
);
export const buildRoutineCosmeticState = ({ existingState = null, legacyRedemptions = [], parentId, studentId, now }) => {
  requireRoutineReward(string(parentId) && string(studentId), 'invalid-identity');
  if (existingState) assertRoutineScopedRecord(existingState, parentId, studentId);
  requireRoutineReward(!existingState || (Array.isArray(existingState.owned_cosmetic_ids) && plain(existingState.selected_cosmetic_ids)), 'invalid-cosmetic-state');
  const owned = new Set([ROUTINE_REWARD_BASE_COSMETIC_ID]);
  (existingState?.owned_cosmetic_ids || []).forEach((id) => { requireRoutineReward(string(id), 'invalid-cosmetic-state'); owned.add(id); });
  legacyRedemptions.forEach((redemption) => {
    assertRoutineScopedRecord(redemption, parentId, studentId);
    if (redemption.status !== 'fulfilled' || (redemption.reward_type_snapshot || redemption.type || redemption.reward_type) !== 'built_in') return;
    [redemption.reward_catalog_item_id, redemption.built_in_key_snapshot].filter(string).forEach((id) => owned.add(id));
    const alias = ROUTINE_REWARD_CATALOG.find((item) => item.unlock_type === redemption.unlock_type_snapshot && item.unlock_key === redemption.unlock_key_snapshot);
    if (alias) owned.add(alias.id);
  });
  const selection = existingState?.selected_cosmetic_ids || { avatar: ROUTINE_REWARD_BASE_COSMETIC_ID };
  const ownershipChanged = existingState && JSON.stringify(existingState.owned_cosmetic_ids) !== JSON.stringify([...owned]);
  const revision = int(existingState?.revision, 1) ? existingState.revision : 1;
  requireRoutineReward(!ownershipChanged || revision < Number.MAX_SAFE_INTEGER, 'invalid-revision');
  return {
    id: buildRoutineCosmeticStateId({ parentId, studentId }), parent_id: parentId, student_id: studentId,
    schema_version: 1, revision: ownershipChanged ? revision + 1 : revision,
    owned_cosmetic_ids: [...owned], selected_cosmetic_ids: { ...selection }, updated_at: existingState?.updated_at || now,
  };
};
export const getRoutineCatalogItem = (cosmeticId) => {
  const item = ROUTINE_REWARD_CATALOG.find((candidate) => candidate.id === cosmeticId && candidate.is_active);
  requireRoutineReward(Boolean(item), 'unknown-cosmetic');
  return item;
};
export const buildRoutineCosmeticUnlock = ({ state, wallet, cosmeticId }) => {
  const item = getRoutineCatalogItem(cosmeticId);
  if (state.owned_cosmetic_ids.includes(item.id)) return { state, item, already_owned: true, delta_points: 0 };
  requireRoutineReward(int(wallet.total_points) && wallet.total_points >= item.point_cost, 'insufficient-points');
  requireRoutineReward(int(state.revision, 1) && state.revision < Number.MAX_SAFE_INTEGER, 'invalid-revision');
  return { item, already_owned: false, delta_points: -item.point_cost,
    state: { ...state, owned_cosmetic_ids: [...state.owned_cosmetic_ids, item.id], revision: state.revision + 1 } };
};
export const buildRoutineCosmeticSelection = ({ state, selectedCosmeticIds, expectedRevision }) => {
  requireRoutineReward(plain(selectedCosmeticIds) && Object.keys(selectedCosmeticIds).every((slot) => ROUTINE_REWARD_SLOTS.includes(slot)), 'invalid-cosmetic-selection');
  requireRoutineReward(int(expectedRevision, 1) && state.revision === expectedRevision, 'revision-conflict');
  Object.entries(selectedCosmeticIds).forEach(([slot, id]) => {
    requireRoutineReward(typeof id === 'string', 'invalid-cosmetic-selection');
    if (id === '') return;
    const item = getRoutineCatalogItem(id);
    requireRoutineReward(item.unlock_type === slot && state.owned_cosmetic_ids.includes(id), 'cosmetic-not-owned');
  });
  requireRoutineReward(state.revision < Number.MAX_SAFE_INTEGER, 'invalid-revision');
  return { ...state, revision: state.revision + 1, selected_cosmetic_ids: { ...selectedCosmeticIds } };
};
export const buildAllowanceHistorySettlement = (record) => {
  const paidAmount = Number(record.paid_amount ?? 0);
  const calculated = Number(record.calculated_earned_amount);
  const adjustment = Number(record.parent_adjustment_amount ?? 0);
  requireRoutineReward(Number.isFinite(paidAmount) && paidAmount >= 0 && int(Math.round(paidAmount * 100)), 'invalid-obligation');
  let earnedAmount;
  if (record.calculated_earned_amount !== undefined) {
    requireRoutineReward(Number.isFinite(calculated) && calculated >= 0 && Number.isFinite(adjustment), 'invalid-obligation');
    // Reconcile the existing earned snapshot only; never evaluate a new policy/day.
    earnedAmount = calculateAllowanceBalance({ calculatedEarnedAmount: calculated, parentAdjustmentAmount: adjustment, paidAmount }).adjusted_earned_amount;
  } else {
    earnedAmount = Number(record.adjusted_earned_amount);
  }
  requireRoutineReward(Number.isFinite(earnedAmount) && earnedAmount >= 0 && int(Math.round(earnedAmount * 100)), 'invalid-obligation');
  requireRoutineReward(earnedAmount > paidAmount, 'obligation-already-settled');
  return { paid_amount: Math.round(earnedAmount * 100) / 100, remaining_amount: 0, paid_status: 'paid' };
};
