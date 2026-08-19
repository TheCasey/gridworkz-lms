import { buildResolvedRewardCatalogForStudent } from './rewardRedemptionUtils.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export const TRUSTED_CHORE_CONTRACT = 'trusted_chore_operations_v1';

export const CHORE_FREQUENCY_POOLS = Object.freeze({
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
});

export const CHORE_CLAIM_STATUSES = Object.freeze({
  CLAIMED: 'claimed',
  COMPLETED: 'completed',
  RELEASED: 'released',
  EXPIRED: 'expired',
  CANCELED: 'canceled',
});

export const CHORE_COMPLETION_STATUSES = Object.freeze({
  COMPLETED: 'completed',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  RETURNED: 'returned',
});

export const REWARD_CATALOG_ITEM_TYPES = Object.freeze({
  BUILT_IN: 'built_in',
  PARENT_CREATED: 'parent_created',
});

export const REWARD_REDEMPTION_STATUSES = Object.freeze({
  REQUESTED: 'requested',
  APPROVED: 'approved',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected',
  CANCELED: 'canceled',
});

export const DEFAULT_TRUSTED_CHORE_SETTINGS = Object.freeze({
  claim_expiration_hours: 24,
  week_reset_day: 1,
  week_reset_hour: 0,
  week_reset_minute: 0,
  timezone: 'America/Chicago',
});

const COMPLETION_STATUSES_HOLDING_AVAILABILITY = new Set([
  CHORE_COMPLETION_STATUSES.COMPLETED,
  CHORE_COMPLETION_STATUSES.APPROVED,
]);

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

const isPlainObject = (value) => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

const hasOwn = (value, key) => (
  isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, key)
);

const toBoolean = (value, fallback = false) => (
  typeof value === 'boolean' ? value : fallback
);

const toNonNegativeInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const toBoundedInteger = (value, { min, max, fallback }) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
};

const toStringArray = (value) => (
  Array.isArray(value)
    ? Array.from(new Set(
      value.map((entry) => trimString(entry)).filter(Boolean)
    ))
    : []
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

const toIsoString = (value) => (
  toComparableDate(value)?.toISOString?.() || null
);

const getRecordId = (record = {}) => (
  trimString(record?.id || record?.ref?.id)
);

const getChoreDefinitionId = (value = {}) => (
  trimString(
    value.chore_definition_id ||
    value.choreDefinitionId ||
    value.chore_id ||
    value.choreId ||
    value.id
  )
);

const getClaimTimestamp = (claim = {}) => (
  toComparableDate(claim.claimed_at || claim.created_at || claim.updated_at)
);

const getCompletionTimestamp = (completion = {}) => (
  toComparableDate(completion.completed_at || completion.created_at || completion.updated_at)
);

const isClaimStatusActive = (status) => (
  (status || CHORE_CLAIM_STATUSES.CLAIMED) === CHORE_CLAIM_STATUSES.CLAIMED
);

const doesCompletionHoldAvailability = (completion = {}) => (
  COMPLETION_STATUSES_HOLDING_AVAILABILITY.has(
    completion.status || CHORE_COMPLETION_STATUSES.COMPLETED
  )
);

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
  const normalizedConfig = normalizeTrustedChoreWeekConfig(config);
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

const getNextWeeklyBoundary = (referenceDate, weekConfig = {}) => (
  new Date(getWeekBoundaryForDate(referenceDate, weekConfig).getTime() + WEEK_MS)
);

const getNextMonthlyBoundary = (referenceDate, weekConfig = {}) => {
  const parts = getDateTimePartsInTimeZone(referenceDate, weekConfig.timezone);
  const nextMonthParts = parts.month === 12
    ? { year: parts.year + 1, month: 1, day: 1 }
    : { year: parts.year, month: parts.month + 1, day: 1 };

  return buildDateFromTimeZoneParts({
    ...nextMonthParts,
    hour: 0,
    minute: 0,
    second: 0,
  }, weekConfig.timezone);
};

export const normalizeTrustedChoreWeekConfig = (settings = {}) => ({
  week_reset_day: toBoundedInteger(settings.week_reset_day, {
    min: 0,
    max: 6,
    fallback: DEFAULT_TRUSTED_CHORE_SETTINGS.week_reset_day,
  }),
  week_reset_hour: toBoundedInteger(settings.week_reset_hour, {
    min: 0,
    max: 23,
    fallback: DEFAULT_TRUSTED_CHORE_SETTINGS.week_reset_hour,
  }),
  week_reset_minute: toBoundedInteger(settings.week_reset_minute, {
    min: 0,
    max: 59,
    fallback: DEFAULT_TRUSTED_CHORE_SETTINGS.week_reset_minute,
  }),
  timezone: trimString(settings.timezone) || DEFAULT_TRUSTED_CHORE_SETTINGS.timezone,
});

export const getTrustedClaimExpiresAt = ({
  claimedAt,
  claimExpirationHours = DEFAULT_TRUSTED_CHORE_SETTINGS.claim_expiration_hours,
} = {}) => {
  const resolvedClaimedAt = toComparableDate(claimedAt);
  const expirationHours = toNonNegativeInteger(
    claimExpirationHours,
    DEFAULT_TRUSTED_CHORE_SETTINGS.claim_expiration_hours
  );

  if (!resolvedClaimedAt || expirationHours <= 0) {
    return null;
  }

  return new Date(resolvedClaimedAt.getTime() + (expirationHours * HOUR_MS));
};

export const isTrustedClaimExpired = ({
  claimedAt,
  expiresAt,
  claimExpirationHours = DEFAULT_TRUSTED_CHORE_SETTINGS.claim_expiration_hours,
  now = new Date(),
} = {}) => {
  const resolvedNow = toComparableDate(now);
  const resolvedExpiresAt = toComparableDate(expiresAt) || getTrustedClaimExpiresAt({
    claimedAt,
    claimExpirationHours,
  });

  return Boolean(resolvedNow && resolvedExpiresAt && resolvedNow >= resolvedExpiresAt);
};

export const getTrustedNextEligibleTime = ({
  frequencyPool,
  completedAt,
  minimumCooldownDays = 0,
  weekConfig = {},
} = {}) => {
  const resolvedCompletedAt = toComparableDate(completedAt);

  if (!resolvedCompletedAt) {
    return null;
  }

  const nextPeriodBoundary = frequencyPool === CHORE_FREQUENCY_POOLS.MONTHLY
    ? getNextMonthlyBoundary(resolvedCompletedAt, weekConfig)
    : getNextWeeklyBoundary(resolvedCompletedAt, weekConfig);
  const cooldownEndsAt = new Date(
    resolvedCompletedAt.getTime() + (toNonNegativeInteger(minimumCooldownDays, 0) * DAY_MS)
  );

  return nextPeriodBoundary > cooldownEndsAt ? nextPeriodBoundary : cooldownEndsAt;
};

export const normalizeTrustedChoreSettingsPayload = (payload = {}, defaults = {}) => {
  const source = isPlainObject(payload) ? payload : {};
  const defaultWeekConfig = normalizeTrustedChoreWeekConfig(defaults);

  return {
    claim_expiration_hours: toBoundedInteger(source.claim_expiration_hours, {
      min: 1,
      max: 168,
      fallback: toNonNegativeInteger(
        defaults.claim_expiration_hours,
        DEFAULT_TRUSTED_CHORE_SETTINGS.claim_expiration_hours
      ),
    }),
    ...normalizeTrustedChoreWeekConfig({
      ...defaultWeekConfig,
      ...source,
    }),
    quotas: normalizeTrustedQuotaMap(source.quotas),
    allowance_policy: normalizeTrustedAllowancePolicy(source.allowance_policy),
  };
};

export const normalizeTrustedQuotaMap = (value = {}) => {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([studentId, quota]) => {
      const normalizedStudentId = trimString(studentId);
      if (!normalizedStudentId || !isPlainObject(quota)) {
        return [];
      }

      return [[normalizedStudentId, {
        required_routine_days: toNonNegativeInteger(quota.required_routine_days, 0),
        required_weekly_chore_blocks: toNonNegativeInteger(quota.required_weekly_chore_blocks, 0),
        required_monthly_chore_blocks: toNonNegativeInteger(quota.required_monthly_chore_blocks, 0),
      }]];
    })
  );
};

export const normalizeTrustedAllowancePolicy = (value = {}) => {
  const source = isPlainObject(value) ? value : {};
  const periodType = ['weekly', 'biweekly', 'monthly'].includes(source.period_type)
    ? source.period_type
    : 'weekly';
  const completionPolicy = ['all_or_nothing', 'prorated'].includes(source.completion_policy)
    ? source.completion_policy
    : 'all_or_nothing';

  return {
    period_type: periodType,
    allowance_amount: Math.max(0, Number(source.allowance_amount) || 0),
    completion_policy: completionPolicy,
    include_routines: toBoolean(source.include_routines, false),
  };
};

export const normalizeTrustedAllowanceLedgerPayload = (payload = {}) => {
  const source = isPlainObject(payload) ? payload : {};
  const referenceDate = toComparableDate(source.reference_date || source.referenceDate);

  return {
    student_id: trimString(source.student_id || source.studentId),
    reference_date: referenceDate ? referenceDate.toISOString() : '',
    parent_adjustment_amount: Number(source.parent_adjustment_amount),
    paid_amount: Number(source.paid_amount),
    mark_paid_at: toBoolean(source.mark_paid_at, false),
  };
};

export const normalizeTrustedRoutineTemplatePayload = (payload = {}) => {
  const source = isPlainObject(payload) ? payload : {};
  const checklistItems = Array.isArray(source.checklist_items)
    ? source.checklist_items.map((item) => ({
      id: trimString(item?.id),
      label: trimString(item?.label),
    })).filter((item) => item.label)
    : [];

  return {
    id: trimString(source.id || source.routine_template_id),
    title: trimString(source.title),
    student_ids: toStringArray(source.student_ids),
    checklist_items: checklistItems,
    counts_toward_allowance: toBoolean(source.counts_toward_allowance, false),
    counts_toward_points: toBoolean(source.counts_toward_points, false),
    is_active: source.is_active !== false,
  };
};

export const normalizeTrustedChoreDefinitionPayload = (payload = {}) => {
  const source = isPlainObject(payload) ? payload : {};
  const frequencyPool = Object.values(CHORE_FREQUENCY_POOLS).includes(source.frequency_pool)
    ? source.frequency_pool
    : CHORE_FREQUENCY_POOLS.WEEKLY;

  return {
    id: getChoreDefinitionId(source),
    title: trimString(source.title),
    frequency_pool: frequencyPool,
    eligible_student_ids: toStringArray(source.eligible_student_ids),
    all_students_eligible: toBoolean(source.all_students_eligible, false),
    instructions: trimString(source.instructions),
    definition_of_done: trimString(source.definition_of_done),
    proof_requirement: trimString(source.proof_requirement),
    effort_label: trimString(source.effort_label),
    minimum_cooldown_days: toBoundedInteger(source.minimum_cooldown_days, {
      min: 0,
      max: 365,
      fallback: 0,
    }),
    requires_parent_approval: source.requires_parent_approval === true,
    is_active: source.is_active !== false,
  };
};

export const normalizeTrustedRewardSettingsPayload = (payload = {}) => {
  const source = isPlainObject(payload) ? payload : {};

  return {
    school_block_points: toNonNegativeInteger(source.school_block_points, 0),
    chore_block_points: toNonNegativeInteger(source.chore_block_points, 0),
    routine_day_points: toNonNegativeInteger(source.routine_day_points, 0),
    routine_points_enabled: toBoolean(source.routine_points_enabled, false),
  };
};

export const normalizeTrustedRewardCatalogItemPayload = (payload = {}) => {
  const source = isPlainObject(payload) ? payload : {};
  const type = REWARD_CATALOG_ITEM_TYPES.PARENT_CREATED;
  const stockQuantity = toNonNegativeInteger(source.stock_quantity, 0);

  return {
    id: trimString(source.id || source.reward_catalog_item_id),
    type,
    title: trimString(source.title),
    description: trimString(source.description),
    point_cost: toNonNegativeInteger(source.point_cost, 0),
    stock_quantity: stockQuantity,
    available_quantity: toNonNegativeInteger(source.available_quantity, stockQuantity),
    eligible_student_ids: toStringArray(source.eligible_student_ids),
    redemption_requires_approval: toBoolean(
      source.redemption_requires_approval,
      type === REWARD_CATALOG_ITEM_TYPES.PARENT_CREATED
    ),
    fulfillment_terms: trimString(source.fulfillment_terms),
    built_in_key: '',
    unlock_type: '',
    unlock_key: '',
    is_active: source.is_active !== false,
    restock_quantity: toNonNegativeInteger(source.restock_quantity, 0),
  };
};

export const normalizeTrustedStudentChoreContextPayload = (payload = {}) => {
  const source = isPlainObject(payload) ? payload : {};

  return {
    student_id: trimString(source.student_id || source.studentId),
    slug: trimString(source.slug || source.student_slug || source.studentSlug),
    access_pin: trimString(source.access_pin || source.accessPin || source.pin),
  };
};

export const validateTrustedStudentPinContext = ({ payload = {}, studentRecord = {} } = {}) => {
  const context = normalizeTrustedStudentChoreContextPayload(payload);
  const storedPin = trimString(studentRecord.access_pin);

  if (!storedPin) {
    return {
      ok: false,
      code: 'missing_pin',
      message: 'A verified student PIN is required for chore access.',
    };
  }

  if (!context.access_pin) {
    return {
      ok: false,
      code: 'missing_pin',
      message: 'A verified student PIN is required for chore access.',
    };
  }

  if (!storedPin || context.access_pin !== storedPin) {
    return {
      ok: false,
      code: 'pin_mismatch',
      message: 'The student PIN did not match.',
    };
  }

  if (context.student_id && context.student_id !== getRecordId(studentRecord)) {
    return {
      ok: false,
      code: 'student_mismatch',
      message: 'The student context does not match the verified PIN.',
    };
  }

  if (context.slug && context.slug !== trimString(studentRecord.slug)) {
    return {
      ok: false,
      code: 'student_mismatch',
      message: 'The student context does not match the verified PIN.',
    };
  }

  return {
    ok: true,
    code: 'verified',
    student_id: getRecordId(studentRecord),
    parent_id: trimString(studentRecord.parent_id),
  };
};

export const isTrustedStudentEligibleForChore = (choreDefinition, studentId) => {
  if (!studentId) {
    return false;
  }

  if (toBoolean(choreDefinition?.all_students_eligible, false)) {
    return true;
  }

  return toStringArray(choreDefinition?.eligible_student_ids).includes(studentId);
};

export const getTrustedActiveChoreClaim = ({
  choreDefinitionId,
  claims = [],
  now = new Date(),
  claimExpirationHours = DEFAULT_TRUSTED_CHORE_SETTINGS.claim_expiration_hours,
} = {}) => (
  (Array.isArray(claims) ? claims : [])
    .filter((claim) => (
      getChoreDefinitionId(claim) === choreDefinitionId &&
      isClaimStatusActive(claim.status) &&
      !isTrustedClaimExpired({
        claimedAt: claim.claimed_at || getClaimTimestamp(claim),
        expiresAt: claim.expires_at,
        claimExpirationHours: claim.claim_expiration_hours ?? claimExpirationHours,
        now,
      })
    ))
    .sort((left, right) => (
      (getClaimTimestamp(right)?.getTime() || 0) -
      (getClaimTimestamp(left)?.getTime() || 0)
    ))[0] || null
);

export const getTrustedExpiredActiveClaimIds = ({
  choreDefinitionId,
  claims = [],
  now = new Date(),
  claimExpirationHours = DEFAULT_TRUSTED_CHORE_SETTINGS.claim_expiration_hours,
} = {}) => (
  (Array.isArray(claims) ? claims : [])
    .filter((claim) => (
      getChoreDefinitionId(claim) === choreDefinitionId &&
      isClaimStatusActive(claim.status) &&
      isTrustedClaimExpired({
        claimedAt: claim.claimed_at || getClaimTimestamp(claim),
        expiresAt: claim.expires_at,
        claimExpirationHours: claim.claim_expiration_hours ?? claimExpirationHours,
        now,
      })
    ))
    .map((claim) => getRecordId(claim))
    .filter(Boolean)
);

export const getTrustedLatestChoreCompletion = ({
  choreDefinitionId,
  completions = [],
} = {}) => (
  (Array.isArray(completions) ? completions : [])
    .filter((completion) => (
      getChoreDefinitionId(completion) === choreDefinitionId &&
      doesCompletionHoldAvailability(completion)
    ))
    .sort((left, right) => (
      (getCompletionTimestamp(right)?.getTime() || 0) -
      (getCompletionTimestamp(left)?.getTime() || 0)
    ))[0] || null
);

export const getTrustedChoreAvailability = ({
  choreDefinition,
  studentId,
  claims = [],
  completions = [],
  now = new Date(),
  weekConfig = {},
  claimExpirationHours = DEFAULT_TRUSTED_CHORE_SETTINGS.claim_expiration_hours,
} = {}) => {
  const choreDefinitionId = getChoreDefinitionId(choreDefinition);
  const activeClaim = getTrustedActiveChoreClaim({
    choreDefinitionId,
    claims,
    now,
    claimExpirationHours,
  });
  const latestCompletion = getTrustedLatestChoreCompletion({
    choreDefinitionId,
    completions,
  });
  const nextEligibleAt = latestCompletion
    ? getTrustedNextEligibleTime({
      frequencyPool: choreDefinition?.frequency_pool || CHORE_FREQUENCY_POOLS.WEEKLY,
      completedAt: latestCompletion.completed_at || getCompletionTimestamp(latestCompletion),
      minimumCooldownDays: choreDefinition?.minimum_cooldown_days,
      weekConfig,
    })
    : null;
  const claimedByStudent = activeClaim?.student_id === studentId;
  const claimedBySibling = Boolean(activeClaim) && activeClaim?.student_id !== studentId;
  const isEligible = isTrustedStudentEligibleForChore(choreDefinition, studentId);
  const isActive = choreDefinition?.is_active !== false;
  const resolvedNow = toComparableDate(now) || new Date();
  const isCoolingDown = Boolean(nextEligibleAt) && resolvedNow < nextEligibleAt;
  let unavailableReason = '';

  if (!isActive) {
    unavailableReason = 'inactive';
  } else if (!isEligible) {
    unavailableReason = 'ineligible';
  } else if (claimedByStudent) {
    unavailableReason = 'claimed_by_student';
  } else if (claimedBySibling) {
    unavailableReason = 'claimed_by_sibling';
  } else if (isCoolingDown) {
    unavailableReason = 'cooldown';
  }

  return {
    id: choreDefinitionId,
    title: trimString(choreDefinition?.title),
    frequency_pool: choreDefinition?.frequency_pool || CHORE_FREQUENCY_POOLS.WEEKLY,
    instructions: trimString(choreDefinition?.instructions),
    definition_of_done: trimString(choreDefinition?.definition_of_done),
    proof_requirement: trimString(choreDefinition?.proof_requirement),
    effort_label: trimString(choreDefinition?.effort_label),
    minimum_cooldown_days: toNonNegativeInteger(choreDefinition?.minimum_cooldown_days, 0),
    is_active: isActive,
    is_eligible: isEligible,
    is_claimed_by_student: claimedByStudent,
    is_claimed_by_sibling: claimedBySibling,
    claim_expires_at: activeClaim
      ? toIsoString(activeClaim.expires_at || getTrustedClaimExpiresAt({
        claimedAt: activeClaim.claimed_at || getClaimTimestamp(activeClaim),
        claimExpirationHours: activeClaim.claim_expiration_hours ?? claimExpirationHours,
      }))
      : null,
    next_eligible_at: toIsoString(nextEligibleAt),
    unavailable_reason: unavailableReason,
    is_available: !unavailableReason,
    active_claim_id: getRecordId(activeClaim),
  };
};

export const buildTrustedChoreClaimDecision = ({
  choreDefinition,
  studentId,
  claims = [],
  completions = [],
  now = new Date(),
  weekConfig = {},
  claimExpirationHours = DEFAULT_TRUSTED_CHORE_SETTINGS.claim_expiration_hours,
} = {}) => {
  const choreDefinitionId = getChoreDefinitionId(choreDefinition);
  const expiredClaimIds = getTrustedExpiredActiveClaimIds({
    choreDefinitionId,
    claims,
    now,
    claimExpirationHours,
  });
  const availability = getTrustedChoreAvailability({
    choreDefinition,
    studentId,
    claims,
    completions,
    now,
    weekConfig,
    claimExpirationHours,
  });

  if (!availability.is_available) {
    return {
      ok: false,
      code: availability.unavailable_reason || 'unavailable',
      expired_claim_ids: expiredClaimIds,
      availability,
    };
  }

  return {
    ok: true,
    code: 'claim_allowed',
    expired_claim_ids: expiredClaimIds,
    availability,
    claim_expiration_hours: toNonNegativeInteger(
      claimExpirationHours,
      DEFAULT_TRUSTED_CHORE_SETTINGS.claim_expiration_hours
    ),
    expires_at: toIsoString(getTrustedClaimExpiresAt({
      claimedAt: now,
      claimExpirationHours,
    })),
  };
};

export const buildTrustedChoreCompletionDecision = ({
  claim,
  choreDefinition,
  studentId,
  now = new Date(),
  claimExpirationHours = DEFAULT_TRUSTED_CHORE_SETTINGS.claim_expiration_hours,
} = {}) => {
  if (!claim || getRecordId(claim) === '') {
    return {
      ok: false,
      code: 'claim_not_found',
    };
  }

  if (claim.student_id !== studentId) {
    return {
      ok: false,
      code: 'student_mismatch',
    };
  }

  if (!isClaimStatusActive(claim.status)) {
    return {
      ok: false,
      code: 'claim_not_active',
    };
  }

  if (isTrustedClaimExpired({
    claimedAt: claim.claimed_at || getClaimTimestamp(claim),
    expiresAt: claim.expires_at,
    claimExpirationHours: claim.claim_expiration_hours ?? claimExpirationHours,
    now,
  })) {
    return {
      ok: false,
      code: 'claim_expired',
      expired_claim_ids: [getRecordId(claim)].filter(Boolean),
    };
  }

  const requiresParentApproval = choreDefinition?.requires_parent_approval === true;

  return {
    ok: true,
    code: requiresParentApproval ? 'completion_pending_parent_review' : 'completion_auto_approved',
    status: requiresParentApproval
      ? CHORE_COMPLETION_STATUSES.COMPLETED
      : CHORE_COMPLETION_STATUSES.APPROVED,
    final: !requiresParentApproval,
    approved_at: requiresParentApproval ? null : toIsoString(now),
    quota_blocks: 1,
  };
};

export const normalizeTrustedChoreReviewPayload = (payload = {}) => {
  const source = isPlainObject(payload) ? payload : {};
  const action = trimString(source.action || source.review_action);

  return {
    completion_id: trimString(source.completion_id || source.chore_completion_id),
    action: ['approve', 'reject', 'return'].includes(action) ? action : '',
    review_note: trimString(source.review_note || source.note),
  };
};

export const buildTrustedChoreReviewDecision = ({ completion, reviewPayload } = {}) => {
  const normalizedReview = normalizeTrustedChoreReviewPayload(reviewPayload);

  if (!completion || !getRecordId(completion)) {
    return {
      ok: false,
      code: 'completion_not_found',
    };
  }

  if (!normalizedReview.action) {
    return {
      ok: false,
      code: 'invalid_review_action',
    };
  }

  if (completion.status !== CHORE_COMPLETION_STATUSES.COMPLETED) {
    return {
      ok: false,
      code: 'completion_not_pending_review',
    };
  }

  const status = normalizedReview.action === 'approve'
    ? CHORE_COMPLETION_STATUSES.APPROVED
    : normalizedReview.action === 'reject'
      ? CHORE_COMPLETION_STATUSES.REJECTED
      : CHORE_COMPLETION_STATUSES.RETURNED;

  return {
    ok: true,
    code: `review_${normalizedReview.action}`,
    status,
    review_note: normalizedReview.review_note,
  };
};

const sanitizeStudentVisibleChore = (availability) => ({
  id: availability.id,
  title: availability.title,
  frequency_pool: availability.frequency_pool,
  instructions: availability.instructions,
  definition_of_done: availability.definition_of_done,
  proof_requirement: availability.proof_requirement,
  effort_label: availability.effort_label,
  minimum_cooldown_days: availability.minimum_cooldown_days,
  is_claimed_by_student: availability.is_claimed_by_student,
  claim_expires_at: availability.claim_expires_at,
  next_eligible_at: availability.next_eligible_at,
  unavailable_reason: availability.unavailable_reason,
  active_claim_id: availability.active_claim_id,
});

export const buildTrustedStudentSafeChoreView = ({
  studentId,
  routineTemplates = [],
  routineCompletions = [],
  choreDefinitions = [],
  choreClaims = [],
  choreCompletions = [],
  pointWallets = [],
  rewardCatalogItems = [],
  rewardRedemptions = [],
  now = new Date(),
  weekConfig = {},
  claimExpirationHours = DEFAULT_TRUSTED_CHORE_SETTINGS.claim_expiration_hours,
} = {}) => {
  const choreAvailabilities = (Array.isArray(choreDefinitions) ? choreDefinitions : []).map(
    (choreDefinition) => getTrustedChoreAvailability({
      choreDefinition,
      studentId,
      claims: choreClaims,
      completions: choreCompletions,
      now,
      weekConfig,
      claimExpirationHours,
    })
  );
  const wallet = (Array.isArray(pointWallets) ? pointWallets : []).find(
    (entry) => entry.student_id === studentId
  ) || {
    id: studentId,
    student_id: studentId,
    total_points: 0,
    lifetime_points: 0,
    updated_at: null,
  };

  return {
    contract: TRUSTED_CHORE_CONTRACT,
    student_id: studentId,
    routines: (Array.isArray(routineTemplates) ? routineTemplates : [])
      .filter((routineTemplate) => {
        const studentIds = toStringArray(routineTemplate.student_ids);
        return routineTemplate.is_active !== false &&
          (studentIds.length === 0 || studentIds.includes(studentId));
      })
      .map((routineTemplate) => ({
        id: getRecordId(routineTemplate),
        title: trimString(routineTemplate.title),
        checklist_items: Array.isArray(routineTemplate.checklist_items)
          ? routineTemplate.checklist_items.map((item) => ({
            id: trimString(item.id),
            label: trimString(item.label),
          })).filter((item) => item.label)
          : [],
        counts_toward_allowance: toBoolean(routineTemplate.counts_toward_allowance, false),
        counts_toward_points: toBoolean(routineTemplate.counts_toward_points, false),
        completions: (Array.isArray(routineCompletions) ? routineCompletions : [])
          .filter((completion) => (
            completion.student_id === studentId &&
            completion.routine_template_id === getRecordId(routineTemplate)
          ))
          .map((completion) => ({
            id: getRecordId(completion),
            date_key: trimString(completion.date_key),
            completed_item_ids: toStringArray(completion.completed_item_ids),
            completed_at: toIsoString(completion.completed_at),
          })),
      })),
    chores: {
      available: choreAvailabilities
        .filter((availability) => availability.is_available)
        .map(sanitizeStudentVisibleChore),
      claimed: choreAvailabilities
        .filter((availability) => availability.is_claimed_by_student)
        .map(sanitizeStudentVisibleChore),
    },
    allowance: {
      periods: [],
    },
    rewards: {
      wallet: {
        id: getRecordId(wallet) || studentId,
        student_id: studentId,
        total_points: toNonNegativeInteger(wallet.total_points, 0),
        lifetime_points: toNonNegativeInteger(wallet.lifetime_points, 0),
        updated_at: toIsoString(wallet.updated_at),
      },
      catalog: buildResolvedRewardCatalogForStudent({
        rewardCatalogItems,
        rewardRedemptions,
        studentId,
      }).map((reward) => ({
        id: getRecordId(reward),
        type: reward.type || REWARD_CATALOG_ITEM_TYPES.PARENT_CREATED,
        title: trimString(reward.title),
        description: trimString(reward.description),
        point_cost: toNonNegativeInteger(reward.point_cost, 0),
        stock_quantity: toNonNegativeInteger(reward.stock_quantity, 0),
        available_quantity: toNonNegativeInteger(reward.available_quantity, 0),
        redemption_requires_approval: toBoolean(reward.redemption_requires_approval, false),
        fulfillment_terms: trimString(reward.fulfillment_terms),
        built_in_key: trimString(reward.built_in_key),
        unlock_type: trimString(reward.unlock_type),
        unlock_key: trimString(reward.unlock_key),
        is_unlocked: reward.is_unlocked === true,
      })),
      myRedemptions: (Array.isArray(rewardRedemptions) ? rewardRedemptions : [])
        .filter((redemption) => redemption.student_id === studentId)
        .map((redemption) => ({
          id: getRecordId(redemption),
          reward_catalog_item_id: trimString(redemption.reward_catalog_item_id),
          status: redemption.status || REWARD_REDEMPTION_STATUSES.REQUESTED,
          reward_type_snapshot: trimString(redemption.reward_type_snapshot || redemption.type),
          title_snapshot: trimString(redemption.title_snapshot),
          point_cost_snapshot: toNonNegativeInteger(redemption.point_cost_snapshot, 0),
          stock_quantity_snapshot: toNonNegativeInteger(redemption.stock_quantity_snapshot, 0),
          available_quantity_snapshot: toNonNegativeInteger(redemption.available_quantity_snapshot, 0),
          fulfillment_terms_snapshot: trimString(redemption.fulfillment_terms_snapshot),
          built_in_key_snapshot: trimString(redemption.built_in_key_snapshot),
          unlock_type_snapshot: trimString(redemption.unlock_type_snapshot),
          unlock_key_snapshot: trimString(redemption.unlock_key_snapshot),
          requested_at: toIsoString(redemption.requested_at),
          approved_at: toIsoString(redemption.approved_at),
          fulfilled_at: toIsoString(redemption.fulfilled_at),
          rejected_at: toIsoString(redemption.rejected_at),
          canceled_at: toIsoString(redemption.canceled_at),
        })),
    },
  };
};

export const normalizeTrustedRoutineCompletionPayload = (payload = {}) => {
  const source = isPlainObject(payload) ? payload : {};

  return {
    routine_template_id: trimString(source.routine_template_id || source.routineTemplateId),
    date_key: trimString(source.date_key || source.dateKey),
    completed_item_ids: toStringArray(source.completed_item_ids),
  };
};

export const normalizeTrustedChoreClaimPayload = (payload = {}) => ({
  chore_definition_id: getChoreDefinitionId(payload),
});

export const normalizeTrustedChoreCompletionPayload = (payload = {}) => ({
  claim_id: trimString(payload?.claim_id || payload?.claimId),
  proof_note: trimString(payload?.proof_note || payload?.proofNote),
  proof_attachments: Array.isArray(payload?.proof_attachments) ? payload.proof_attachments : [],
});

export const collectReferencedStudentIdsFromSetup = (records = []) => (
  toStringArray(
    (Array.isArray(records) ? records : [])
      .flatMap((record) => {
        if (!isPlainObject(record)) {
          return [];
        }

        return [
          ...toStringArray(record.student_ids),
          ...toStringArray(record.eligible_student_ids),
          ...Object.keys(isPlainObject(record.quotas) ? record.quotas : {}),
        ];
      })
  )
);

export const validateRequiredTrustedFields = (record, requiredFields = []) => (
  requiredFields.filter((field) => !hasOwn(record, field) || record[field] === '')
);
