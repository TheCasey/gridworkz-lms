import {
  AllowanceCompletionPolicies,
  AllowancePeriodCadences,
  ChoreCompletionStatuses,
  ChoreFrequencyPools,
} from '../constants/schema.js';
import {
  buildDateFromTimeZoneParts,
  getCurrentWeekRange,
  getDateTimePartsInTimeZone,
  getWeekConfig,
  getWeekKey,
} from './weekUtils.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BIWEEK_MS = 2 * WEEK_MS;
const ACTIVE_CHORE_STATUSES = new Set([
  ChoreCompletionStatuses.COMPLETED,
  ChoreCompletionStatuses.APPROVED,
]);

export const DEFAULT_ALLOWANCE_POLICY = Object.freeze({
  period_type: AllowancePeriodCadences.WEEKLY,
  allowance_amount: 0,
  completion_policy: AllowanceCompletionPolicies.ALL_OR_NOTHING,
  include_routines: false,
});

export const AllowancePaidStatuses = Object.freeze({
  UNPAID: 'unpaid',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
});

const trimString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const toBoolean = (value, fallback = false) => (
  typeof value === 'boolean' ? value : fallback
);

const toComparableDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === 'function') {
    const resolved = value.toDate();
    return Number.isNaN(resolved?.getTime?.()) ? null : resolved;
  }

  if (typeof value?.toMillis === 'function') {
    const resolved = new Date(value.toMillis());
    return Number.isNaN(resolved.getTime()) ? null : resolved;
  }

  const resolved = new Date(value);
  return Number.isNaN(resolved.getTime()) ? null : resolved;
};

const toMoney = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100) / 100;
};

const toNonNegativeInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const getMonthStart = (referenceDate = new Date(), timezone = '') => {
  const parts = getDateTimePartsInTimeZone(referenceDate, timezone);
  return buildDateFromTimeZoneParts({
    year: parts.year,
    month: parts.month,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  }, timezone);
};

const getNextMonthStart = (referenceDate = new Date(), timezone = '') => {
  const parts = getDateTimePartsInTimeZone(referenceDate, timezone);
  const year = parts.month === 12 ? parts.year + 1 : parts.year;
  const month = parts.month === 12 ? 1 : parts.month + 1;

  return buildDateFromTimeZoneParts({
    year,
    month,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  }, timezone);
};

const isWithinPeriod = (value, periodStart, periodEnd) => {
  const date = toComparableDate(value);
  if (!date || !periodStart || !periodEnd) {
    return false;
  }

  return date >= periodStart && date <= periodEnd;
};

const getBiweeklyAnchorStart = (weekConfig = {}) => (
  getCurrentWeekRange(new Date('2024-01-01T12:00:00.000Z'), weekConfig).weekStart
);

const getBiweeklyRange = (referenceDate = new Date(), weekConfig = {}) => {
  const { weekStart } = getCurrentWeekRange(referenceDate, weekConfig);
  const anchorStart = getBiweeklyAnchorStart(weekConfig);
  const periodIndex = Math.floor((weekStart.getTime() - anchorStart.getTime()) / BIWEEK_MS);
  const periodStart = new Date(anchorStart.getTime() + (periodIndex * BIWEEK_MS));
  const periodEnd = new Date(periodStart.getTime() + BIWEEK_MS - 1);

  return {
    periodStart,
    periodEnd,
  };
};

const getMonthlyKey = (referenceDate = new Date(), timezone = '') => {
  const parts = getDateTimePartsInTimeZone(referenceDate, timezone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}`;
};

const buildPeriodLabel = ({ periodType, periodStart, periodEnd } = {}) => {
  const start = toComparableDate(periodStart);
  const end = toComparableDate(periodEnd);

  if (!start || !end) {
    return '';
  }

  if (periodType === AllowancePeriodCadences.MONTHLY) {
    return start.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  const startLabel = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endLabel = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${startLabel} - ${endLabel}`;
};

export const normalizeAllowancePolicy = (value = {}) => {
  const source = value && typeof value === 'object' ? value : {};
  const periodType = Object.values(AllowancePeriodCadences).includes(source.period_type)
    ? source.period_type
    : DEFAULT_ALLOWANCE_POLICY.period_type;
  const completionPolicy = Object.values(AllowanceCompletionPolicies).includes(source.completion_policy)
    ? source.completion_policy
    : DEFAULT_ALLOWANCE_POLICY.completion_policy;

  return {
    period_type: periodType,
    allowance_amount: Math.max(0, toMoney(source.allowance_amount)),
    completion_policy: completionPolicy,
    include_routines: toBoolean(source.include_routines, DEFAULT_ALLOWANCE_POLICY.include_routines),
  };
};

export const resolveAllowancePeriod = ({
  referenceDate = new Date(),
  allowancePolicy = {},
  weekConfig = {},
} = {}) => {
  const normalizedPolicy = normalizeAllowancePolicy(allowancePolicy);
  const normalizedWeekConfig = getWeekConfig(weekConfig);

  if (normalizedPolicy.period_type === AllowancePeriodCadences.MONTHLY) {
    const periodStart = getMonthStart(referenceDate, normalizedWeekConfig.timezone);
    const nextMonthStart = getNextMonthStart(referenceDate, normalizedWeekConfig.timezone);

    return {
      period_type: normalizedPolicy.period_type,
      period_key: getMonthlyKey(referenceDate, normalizedWeekConfig.timezone),
      period_start: periodStart,
      period_end: new Date(nextMonthStart.getTime() - 1),
      period_label: buildPeriodLabel({
        periodType: normalizedPolicy.period_type,
        periodStart,
        periodEnd: new Date(nextMonthStart.getTime() - 1),
      }),
    };
  }

  if (normalizedPolicy.period_type === AllowancePeriodCadences.BIWEEKLY) {
    const { periodStart, periodEnd } = getBiweeklyRange(referenceDate, normalizedWeekConfig);

    return {
      period_type: normalizedPolicy.period_type,
      period_key: getWeekKey(periodStart, normalizedWeekConfig),
      period_start: periodStart,
      period_end: periodEnd,
      period_label: buildPeriodLabel({
        periodType: normalizedPolicy.period_type,
        periodStart,
        periodEnd,
      }),
    };
  }

  const { weekStart, weekEnd } = getCurrentWeekRange(referenceDate, normalizedWeekConfig);

  return {
    period_type: normalizedPolicy.period_type,
    period_key: getWeekKey(weekStart, normalizedWeekConfig),
    period_start: weekStart,
    period_end: weekEnd,
    period_label: buildPeriodLabel({
      periodType: normalizedPolicy.period_type,
      periodStart: weekStart,
      periodEnd: weekEnd,
    }),
  };
};

export const calculateAllowanceBaseAmount = ({
  allowanceAmount = 0,
  completionPolicy = AllowanceCompletionPolicies.ALL_OR_NOTHING,
  completionRatio = 0,
} = {}) => {
  const normalizedRatio = Math.max(0, Math.min(Number(completionRatio) || 0, 1));
  const normalizedAmount = Math.max(0, toMoney(allowanceAmount));

  if (completionPolicy === AllowanceCompletionPolicies.PRORATED) {
    return toMoney(normalizedAmount * normalizedRatio);
  }

  return normalizedRatio >= 1 ? normalizedAmount : 0;
};

export const calculateAllowanceBalance = ({
  calculatedEarnedAmount = 0,
  parentAdjustmentAmount = 0,
  paidAmount = 0,
} = {}) => {
  const adjustedEarnedAmount = Math.max(0, toMoney(calculatedEarnedAmount) + toMoney(parentAdjustmentAmount));
  const normalizedPaidAmount = Math.max(0, toMoney(paidAmount));
  const remainingAmount = Math.max(0, toMoney(adjustedEarnedAmount - normalizedPaidAmount));

  let paidStatus = AllowancePaidStatuses.UNPAID;
  if (remainingAmount <= 0 && (normalizedPaidAmount > 0 || adjustedEarnedAmount <= 0)) {
    paidStatus = AllowancePaidStatuses.PAID;
  } else if (normalizedPaidAmount > 0) {
    paidStatus = AllowancePaidStatuses.PARTIALLY_PAID;
  }

  return {
    adjusted_earned_amount: adjustedEarnedAmount,
    remaining_amount: remainingAmount,
    paid_status: paidStatus,
  };
};

export const buildAllowanceLedgerEntry = ({
  studentId = '',
  quota = {},
  allowancePolicy = {},
  weekConfig = {},
  routineTemplates = [],
  routineCompletions = [],
  choreDefinitions = [],
  choreCompletions = [],
  existingRecord = null,
  overrides = {},
  referenceDate = new Date(),
} = {}) => {
  const normalizedPolicy = normalizeAllowancePolicy(allowancePolicy);
  const period = resolveAllowancePeriod({
    referenceDate,
    allowancePolicy: normalizedPolicy,
    weekConfig,
  });
  const periodStart = period.period_start;
  const periodEnd = period.period_end;
  const routineTemplateLookup = new Map(
    (Array.isArray(routineTemplates) ? routineTemplates : []).map((template) => [template.id, template])
  );
  const choreDefinitionLookup = new Map(
    (Array.isArray(choreDefinitions) ? choreDefinitions : []).map((definition) => [definition.id, definition])
  );
  const countedRoutineDays = new Set(
    normalizedPolicy.include_routines
      ? (Array.isArray(routineCompletions) ? routineCompletions : [])
        .filter((completion) => {
          if (completion?.student_id !== studentId) {
            return false;
          }

          const template = routineTemplateLookup.get(completion?.routine_template_id);
          if (!template || template?.counts_toward_allowance !== true) {
            return false;
          }

          return isWithinPeriod(
            completion?.completed_at || completion?.created_at,
            periodStart,
            periodEnd
          );
        })
        .map((completion) => trimString(completion?.date_key))
        .filter(Boolean)
      : []
  );

  const countedChoreCompletions = (Array.isArray(choreCompletions) ? choreCompletions : [])
    .filter((completion) => {
      if (completion?.student_id !== studentId) {
        return false;
      }

      if (!ACTIVE_CHORE_STATUSES.has(completion?.status || ChoreCompletionStatuses.COMPLETED)) {
        return false;
      }

      return isWithinPeriod(
        completion?.completed_at || completion?.created_at,
        periodStart,
        periodEnd
      );
    });

  const weeklyBlocksCompleted = countedChoreCompletions.reduce((sum, completion) => {
    const definition = choreDefinitionLookup.get(completion?.chore_definition_id);
    if (definition?.frequency_pool !== ChoreFrequencyPools.WEEKLY) {
      return sum;
    }

    return sum + toNonNegativeInteger(completion?.quota_blocks, 1);
  }, 0);

  const monthlyBlocksCompleted = countedChoreCompletions.reduce((sum, completion) => {
    const definition = choreDefinitionLookup.get(completion?.chore_definition_id);
    if (definition?.frequency_pool !== ChoreFrequencyPools.MONTHLY) {
      return sum;
    }

    return sum + toNonNegativeInteger(completion?.quota_blocks, 1);
  }, 0);

  const requiredCounts = {
    routine_days: normalizedPolicy.include_routines
      ? toNonNegativeInteger(quota?.required_routine_days, 0)
      : 0,
    weekly_chore_blocks: toNonNegativeInteger(quota?.required_weekly_chore_blocks, 0),
    monthly_chore_blocks: toNonNegativeInteger(quota?.required_monthly_chore_blocks, 0),
  };
  const completedCounts = {
    routine_days: countedRoutineDays.size,
    weekly_chore_blocks: weeklyBlocksCompleted,
    monthly_chore_blocks: monthlyBlocksCompleted,
  };
  const requiredBlockTotal = requiredCounts.routine_days
    + requiredCounts.weekly_chore_blocks
    + requiredCounts.monthly_chore_blocks;
  const completedBlockTotal = completedCounts.routine_days
    + completedCounts.weekly_chore_blocks
    + completedCounts.monthly_chore_blocks;
  const completionRatio = requiredBlockTotal > 0
    ? Math.min(completedBlockTotal / requiredBlockTotal, 1)
    : 0;
  const calculatedEarnedAmount = calculateAllowanceBaseAmount({
    allowanceAmount: normalizedPolicy.allowance_amount,
    completionPolicy: normalizedPolicy.completion_policy,
    completionRatio,
  });
  const parentAdjustmentAmount = overrides.parent_adjustment_amount ?? existingRecord?.parent_adjustment_amount ?? 0;
  const paidAmount = overrides.paid_amount ?? existingRecord?.paid_amount ?? 0;
  const paidAt = Object.prototype.hasOwnProperty.call(overrides, 'paid_at')
    ? overrides.paid_at
    : (existingRecord?.paid_at || null);
  const balance = calculateAllowanceBalance({
    calculatedEarnedAmount,
    parentAdjustmentAmount,
    paidAmount,
  });

  return {
    id: existingRecord?.id || '',
    student_id: studentId,
    period_type: period.period_type,
    period_key: period.period_key,
    period_start: period.period_start,
    period_end: period.period_end,
    period_label: period.period_label,
    required_counts: {
      ...requiredCounts,
      total_blocks: requiredBlockTotal,
    },
    completed_counts: {
      ...completedCounts,
      total_blocks: completedBlockTotal,
      completion_ratio: completionRatio,
    },
    calculated_earned_amount: calculatedEarnedAmount,
    parent_adjustment_amount: toMoney(parentAdjustmentAmount),
    paid_amount: Math.max(0, toMoney(paidAmount)),
    paid_status: balance.paid_status,
    paid_at: paidAt,
    adjusted_earned_amount: balance.adjusted_earned_amount,
    remaining_amount: balance.remaining_amount,
    policy_snapshot: {
      ...normalizedPolicy,
    },
  };
};
