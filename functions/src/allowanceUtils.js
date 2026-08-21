const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BIWEEK_MS = 2 * WEEK_MS;

export const ALLOWANCE_PERIOD_CADENCES = Object.freeze({
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
});

export const ALLOWANCE_COMPLETION_POLICIES = Object.freeze({
  ALL_OR_NOTHING: 'all_or_nothing',
  PRORATED: 'prorated',
});

export const ALLOWANCE_PAID_STATUSES = Object.freeze({
  UNPAID: 'unpaid',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
});

export const ACTIVE_ALLOWANCE_CHORE_STATUSES = new Set(['completed', 'approved']);

export const DEFAULT_ALLOWANCE_POLICY = Object.freeze({
  period_type: ALLOWANCE_PERIOD_CADENCES.WEEKLY,
  allowance_amount: 0,
  completion_policy: ALLOWANCE_COMPLETION_POLICIES.ALL_OR_NOTHING,
  include_routines: false,
});

const WEEKDAY_NAME_TO_INDEX = Object.freeze({
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
});

const trimString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const toBoolean = (value, fallback = false) => (
  typeof value === 'boolean' ? value : fallback
);

const toMoney = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100) / 100;
};

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

const toNonNegativeInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const getDateTimePartsInTimeZone = (dateInput, timeZone) => {
  const date = toComparableDate(dateInput) || new Date();

  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
      weekday: date.getDay(),
    };
  }

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    }).formatToParts(date).reduce((resolved, part) => {
      if (part.type !== 'literal') {
        resolved[part.type] = part.value;
      }
      return resolved;
    }, {});

    return {
      year: Number.parseInt(parts.year, 10),
      month: Number.parseInt(parts.month, 10),
      day: Number.parseInt(parts.day, 10),
      hour: Number.parseInt(parts.hour, 10),
      minute: Number.parseInt(parts.minute, 10),
      second: Number.parseInt(parts.second, 10),
      weekday: WEEKDAY_NAME_TO_INDEX[parts.weekday] ?? date.getDay(),
    };
  } catch {
    return getDateTimePartsInTimeZone(date, '');
  }
};

const buildDateFromTimeZoneParts = (parts, timeZone) => {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour || 0,
    parts.minute || 0,
    parts.second || 0,
    0
  );

  if (!timeZone) {
    return new Date(utcGuess);
  }

  const resolvedParts = getDateTimePartsInTimeZone(new Date(utcGuess), timeZone);
  const resolvedAsUtc = Date.UTC(
    resolvedParts.year,
    resolvedParts.month - 1,
    resolvedParts.day,
    resolvedParts.hour,
    resolvedParts.minute,
    resolvedParts.second,
    0
  );
  const requestedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour || 0,
    parts.minute || 0,
    parts.second || 0,
    0
  );

  return new Date(utcGuess - (resolvedAsUtc - requestedAsUtc));
};

const shiftLocalDatePartsByDays = (parts, dayOffset) => {
  const shiftedDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + dayOffset);

  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth() + 1,
    day: shiftedDate.getUTCDate(),
  };
};

const getWeekBoundaryForDate = (dateInput, config = {}) => {
  const date = toComparableDate(dateInput) || new Date();
  const normalizedConfig = {
    week_reset_day: Number.isInteger(config.week_reset_day) ? config.week_reset_day : 1,
    week_reset_hour: Number.isInteger(config.week_reset_hour) ? config.week_reset_hour : 0,
    week_reset_minute: Number.isInteger(config.week_reset_minute) ? config.week_reset_minute : 0,
    timezone: trimString(config.timezone),
  };
  const parts = getDateTimePartsInTimeZone(date, normalizedConfig.timezone);
  const daysSinceReset = (parts.weekday - normalizedConfig.week_reset_day + 7) % 7;
  let boundaryDateParts = shiftLocalDatePartsByDays(parts, -daysSinceReset);
  const beforeBoundary = daysSinceReset === 0 && (
    parts.hour < normalizedConfig.week_reset_hour ||
    (
      parts.hour === normalizedConfig.week_reset_hour &&
      parts.minute < normalizedConfig.week_reset_minute
    )
  );

  if (beforeBoundary) {
    boundaryDateParts = shiftLocalDatePartsByDays(boundaryDateParts, -7);
  }

  return buildDateFromTimeZoneParts({
    ...boundaryDateParts,
    hour: normalizedConfig.week_reset_hour,
    minute: normalizedConfig.week_reset_minute,
    second: 0,
  }, normalizedConfig.timezone);
};

const getWeekKey = (dateInput, config = {}) => {
  const date = toComparableDate(dateInput);
  if (!date) {
    return '';
  }

  const parts = getDateTimePartsInTimeZone(date, trimString(config.timezone));
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

const getCurrentWeekRange = (referenceDate = new Date(), config = {}) => {
  const weekStart = getWeekBoundaryForDate(referenceDate, config);
  return {
    weekStart,
    weekEnd: new Date(weekStart.getTime() + WEEK_MS - 1),
  };
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

const getBiweeklyAnchorStart = (weekConfig = {}) => (
  getCurrentWeekRange(new Date('2024-01-01T12:00:00.000Z'), weekConfig).weekStart
);

const getBiweeklyRange = (referenceDate = new Date(), weekConfig = {}) => {
  const { weekStart } = getCurrentWeekRange(referenceDate, weekConfig);
  const anchorStart = getBiweeklyAnchorStart(weekConfig);
  const periodIndex = Math.floor((weekStart.getTime() - anchorStart.getTime()) / BIWEEK_MS);
  const periodStart = new Date(anchorStart.getTime() + (periodIndex * BIWEEK_MS));

  return {
    periodStart,
    periodEnd: new Date(periodStart.getTime() + BIWEEK_MS - 1),
  };
};

const isWithinPeriod = (value, periodStart, periodEnd) => {
  const date = toComparableDate(value);
  return Boolean(date && periodStart && periodEnd && date >= periodStart && date <= periodEnd);
};

export const normalizeAllowancePolicy = (value = {}) => {
  const source = value && typeof value === 'object' ? value : {};
  const periodType = Object.values(ALLOWANCE_PERIOD_CADENCES).includes(source.period_type)
    ? source.period_type
    : DEFAULT_ALLOWANCE_POLICY.period_type;
  const completionPolicy = Object.values(ALLOWANCE_COMPLETION_POLICIES).includes(source.completion_policy)
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

  if (normalizedPolicy.period_type === ALLOWANCE_PERIOD_CADENCES.MONTHLY) {
    const periodStart = getMonthStart(referenceDate, trimString(weekConfig.timezone));
    const nextMonthStart = getNextMonthStart(referenceDate, trimString(weekConfig.timezone));
    const parts = getDateTimePartsInTimeZone(referenceDate, trimString(weekConfig.timezone));

    return {
      period_type: normalizedPolicy.period_type,
      period_key: `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}`,
      period_start: periodStart,
      period_end: new Date(nextMonthStart.getTime() - 1),
    };
  }

  if (normalizedPolicy.period_type === ALLOWANCE_PERIOD_CADENCES.BIWEEKLY) {
    const { periodStart, periodEnd } = getBiweeklyRange(referenceDate, weekConfig);
    return {
      period_type: normalizedPolicy.period_type,
      period_key: getWeekKey(periodStart, weekConfig),
      period_start: periodStart,
      period_end: periodEnd,
    };
  }

  const { weekStart, weekEnd } = getCurrentWeekRange(referenceDate, weekConfig);
  return {
    period_type: normalizedPolicy.period_type,
    period_key: getWeekKey(weekStart, weekConfig),
    period_start: weekStart,
    period_end: weekEnd,
  };
};

export const calculateAllowanceBaseAmount = ({
  allowanceAmount = 0,
  completionPolicy = ALLOWANCE_COMPLETION_POLICIES.ALL_OR_NOTHING,
  completionRatio = 0,
} = {}) => {
  const normalizedRatio = Math.max(0, Math.min(Number(completionRatio) || 0, 1));
  const normalizedAmount = Math.max(0, toMoney(allowanceAmount));

  if (completionPolicy === ALLOWANCE_COMPLETION_POLICIES.PRORATED) {
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

  let paidStatus = ALLOWANCE_PAID_STATUSES.UNPAID;
  if (remainingAmount <= 0 && (normalizedPaidAmount > 0 || adjustedEarnedAmount <= 0)) {
    paidStatus = ALLOWANCE_PAID_STATUSES.PAID;
  } else if (normalizedPaidAmount > 0) {
    paidStatus = ALLOWANCE_PAID_STATUSES.PARTIALLY_PAID;
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
  const assignedRoutineTemplates = (Array.isArray(routineTemplates) ? routineTemplates : [])
    .filter((template) => {
      const studentIds = Array.isArray(template?.student_ids) ? template.student_ids.filter(Boolean) : [];
      return template?.is_active !== false
        && (studentIds.length === 0 || studentIds.includes(studentId));
    });
  const canonicalPeriods = new Set(
    assignedRoutineTemplates
      .filter((template) => {
        const studentIds = Array.isArray(template?.student_ids) ? template.student_ids.filter(Boolean) : [];
        return trimString(template?.routine_period) && studentIds.length === 1 && studentIds[0] === studentId;
      })
      .map((template) => trimString(template.routine_period).toLowerCase())
  );
  const effectiveRoutineTemplates = assignedRoutineTemplates.filter((template) => {
    if (
      !Array.isArray(template?.checklist_items)
      || !template.checklist_items.some((item) => trimString(item?.label))
    ) return false;
    const explicitPeriod = trimString(template?.routine_period).toLowerCase();
    const title = trimString(template?.title).toLowerCase();
    const period = ['morning', 'afternoon', 'evening'].includes(explicitPeriod)
      ? explicitPeriod
      : title.includes('afternoon')
        ? 'afternoon'
        : (title.includes('evening') || title.includes('night')) ? 'evening' : 'morning';
    if (!canonicalPeriods.has(period)) return true;
    const studentIds = Array.isArray(template?.student_ids) ? template.student_ids.filter(Boolean) : [];
    return Boolean(explicitPeriod) && studentIds.length === 1 && studentIds[0] === studentId;
  });
  const choreDefinitionLookup = new Map(
    (Array.isArray(choreDefinitions) ? choreDefinitions : []).map((definition) => [definition.id, definition])
  );
  const routineCompletionIdsByDay = new Map();
  if (normalizedPolicy.include_routines) {
    (Array.isArray(routineCompletions) ? routineCompletions : []).forEach((completion) => {
      if (
        completion?.student_id !== studentId
        || !isWithinPeriod(completion?.completed_at || completion?.created_at, periodStart, periodEnd)
      ) return;
      const dateKey = trimString(completion?.date_key);
      if (!dateKey) return;
      const completedIds = routineCompletionIdsByDay.get(dateKey) || new Set();
      completedIds.add(trimString(completion?.routine_template_id));
      routineCompletionIdsByDay.set(dateKey, completedIds);
    });
  }
  const countedRoutineDays = new Set(
    effectiveRoutineTemplates.length > 0
      ? [...routineCompletionIdsByDay.entries()]
        .filter(([, completedIds]) => (
          effectiveRoutineTemplates.every((template) => completedIds.has(trimString(template.id)))
        ))
        .map(([dateKey]) => dateKey)
      : []
  );
  const countedChoreCompletions = (Array.isArray(choreCompletions) ? choreCompletions : [])
    .filter((completion) => {
      if (completion?.student_id !== studentId) {
        return false;
      }

      if (!ACTIVE_ALLOWANCE_CHORE_STATUSES.has(trimString(completion?.status) || 'completed')) {
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
    if (definition?.frequency_pool !== 'weekly') {
      return sum;
    }

    return sum + toNonNegativeInteger(completion?.quota_blocks, 1);
  }, 0);
  const monthlyBlocksCompleted = countedChoreCompletions.reduce((sum, completion) => {
    const definition = choreDefinitionLookup.get(completion?.chore_definition_id);
    if (definition?.frequency_pool !== 'monthly') {
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
