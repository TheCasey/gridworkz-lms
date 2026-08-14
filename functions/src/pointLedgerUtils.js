import { createHash } from 'node:crypto';

export const POINT_SOURCE_TYPES = Object.freeze({
  SCHOOL_BLOCK: 'school_block',
  CHORE_COMPLETION: 'chore_completion',
  ROUTINE_COMPLETION: 'routine_completion',
  ADJUSTMENT: 'adjustment',
  REWARD_REDEMPTION_RESERVATION: 'reward_redemption_reservation',
  REWARD_REDEMPTION_REFUND: 'reward_redemption_refund',
  REWARD_BUILT_IN_UNLOCK: 'reward_built_in_unlock',
});

// Phase 7 keeps school point settings configurable, but automatic school awards
// stay deferred until school completions move onto a trusted server-owned path.
export const SCHOOL_BLOCK_POINT_AWARD_MODE = 'deferred_pending_trusted_completion';

export const DEFAULT_POINT_SETTINGS = Object.freeze({
  school_block_points: 0,
  chore_block_points: 0,
  routine_day_points: 0,
  routine_points_enabled: false,
});

const trimString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNonNegativeInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const toBoolean = (value, fallback = false) => (
  typeof value === 'boolean' ? value : fallback
);

const clonePlainObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {}
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
    const weekdayIndexes = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
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
      weekday: weekdayIndexes[parts.weekday] ?? date.getDay(),
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

const getWeekBoundaryForDate = (dateInput, weekConfig = {}) => {
  const date = toComparableDate(dateInput) || new Date();
  const normalizedWeekConfig = {
    week_reset_day: toNonNegativeInteger(weekConfig.week_reset_day, 1) % 7,
    week_reset_hour: Math.min(23, Math.max(0, toNonNegativeInteger(weekConfig.week_reset_hour, 0))),
    week_reset_minute: Math.min(59, Math.max(0, toNonNegativeInteger(weekConfig.week_reset_minute, 0))),
    timezone: trimString(weekConfig.timezone) || 'America/Chicago',
  };
  const parts = getDateTimePartsInTimeZone(date, normalizedWeekConfig.timezone);
  const daysSinceReset = (parts.weekday - normalizedWeekConfig.week_reset_day + 7) % 7;
  let boundaryDateParts = shiftLocalDatePartsByDays(parts, -daysSinceReset);
  const beforeBoundary = daysSinceReset === 0 && (
    parts.hour < normalizedWeekConfig.week_reset_hour ||
    (
      parts.hour === normalizedWeekConfig.week_reset_hour &&
      parts.minute < normalizedWeekConfig.week_reset_minute
    )
  );

  if (beforeBoundary) {
    boundaryDateParts = shiftLocalDatePartsByDays(boundaryDateParts, -7);
  }

  return buildDateFromTimeZoneParts({
    ...boundaryDateParts,
    hour: normalizedWeekConfig.week_reset_hour,
    minute: normalizedWeekConfig.week_reset_minute,
    second: 0,
  }, normalizedWeekConfig.timezone);
};

export const normalizePointSettings = (value = {}) => ({
  school_block_points: toNonNegativeInteger(
    value.school_block_points,
    DEFAULT_POINT_SETTINGS.school_block_points
  ),
  chore_block_points: toNonNegativeInteger(
    value.chore_block_points,
    DEFAULT_POINT_SETTINGS.chore_block_points
  ),
  routine_day_points: toNonNegativeInteger(
    value.routine_day_points,
    DEFAULT_POINT_SETTINGS.routine_day_points
  ),
  routine_points_enabled: toBoolean(
    value.routine_points_enabled,
    DEFAULT_POINT_SETTINGS.routine_points_enabled
  ),
});

export const getPointValueForSource = ({
  sourceType,
  rewardSettings = {},
  routineTemplate = null,
} = {}) => {
  const normalizedSettings = normalizePointSettings(rewardSettings);

  switch (sourceType) {
    case POINT_SOURCE_TYPES.SCHOOL_BLOCK:
      return normalizedSettings.school_block_points;
    case POINT_SOURCE_TYPES.CHORE_COMPLETION:
      return normalizedSettings.chore_block_points;
    case POINT_SOURCE_TYPES.ROUTINE_COMPLETION:
      return normalizedSettings.routine_points_enabled && routineTemplate?.counts_toward_points === true
        ? normalizedSettings.routine_day_points
        : 0;
    default:
      return 0;
  }
};

export const buildSchoolWeekKey = ({
  completedAt,
  weekConfig = {},
} = {}) => {
  const weekStart = getWeekBoundaryForDate(completedAt, weekConfig);
  const parts = getDateTimePartsInTimeZone(weekStart, trimString(weekConfig.timezone) || 'America/Chicago');
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

export const buildSchoolPointSourceId = ({
  studentId = '',
  subjectId = '',
  blockIndex = 0,
  weekKey = '',
} = {}) => (
  [
    POINT_SOURCE_TYPES.SCHOOL_BLOCK,
    trimString(studentId),
    trimString(subjectId),
    toNonNegativeInteger(blockIndex, 0),
    trimString(weekKey),
  ].join(':')
);

export const buildPointLedgerEntryId = ({
  studentId = '',
  sourceType = '',
  sourceId = '',
} = {}) => {
  const digest = createHash('sha256')
    .update(`${trimString(studentId)}|${trimString(sourceType)}|${trimString(sourceId)}`)
    .digest('hex')
    .slice(0, 24);

  return `points_${digest}`;
};

export const normalizePointWallet = (value = {}, fallbackStudentId = '') => ({
  id: trimString(value.id || value.wallet_id) || fallbackStudentId,
  parent_id: trimString(value.parent_id),
  student_id: trimString(value.student_id) || fallbackStudentId,
  total_points: toNonNegativeInteger(value.total_points, 0),
  lifetime_points: toNonNegativeInteger(value.lifetime_points, 0),
  updated_at: value.updated_at || null,
});

export const normalizePointLedgerEntry = (value = {}) => ({
  id: trimString(value.id),
  parent_id: trimString(value.parent_id),
  student_id: trimString(value.student_id),
  wallet_id: trimString(value.wallet_id || value.student_id),
  source_type: trimString(value.source_type),
  source_id: trimString(value.source_id),
  delta_points: toInteger(value.delta_points, 0),
  balance_after: toInteger(value.balance_after, 0),
  description: trimString(value.description),
  metadata: clonePlainObject(value.metadata),
  created_at: value.created_at || null,
});

export const applyPointLedgerMutation = ({
  pointWallets = [],
  pointLedgerEntries = [],
  parentId = '',
  studentId = '',
  sourceType = '',
  sourceId = '',
  deltaPoints = 0,
  description = '',
  metadata = {},
  createdAt = null,
  entryId = '',
} = {}) => {
  const normalizedStudentId = trimString(studentId);
  const normalizedSourceId = trimString(sourceId);
  const normalizedDelta = toInteger(deltaPoints, 0);

  if (!normalizedStudentId || !trimString(sourceType) || !normalizedSourceId || normalizedDelta === 0) {
    return {
      applied: false,
      code: 'invalid_entry',
      pointWallets,
      pointLedgerEntries,
      wallet: null,
      ledgerEntry: null,
    };
  }

  const existingLedgerEntry = (Array.isArray(pointLedgerEntries) ? pointLedgerEntries : []).find(
    (entry) => (
      trimString(entry?.student_id) === normalizedStudentId &&
      trimString(entry?.source_type) === trimString(sourceType) &&
      trimString(entry?.source_id) === normalizedSourceId
    )
  );

  if (existingLedgerEntry) {
    return {
      applied: false,
      code: 'already_awarded',
      pointWallets,
      pointLedgerEntries,
      wallet: normalizePointWallet(
        (Array.isArray(pointWallets) ? pointWallets : []).find(
          (entry) => trimString(entry?.student_id) === normalizedStudentId
        ) || {},
        normalizedStudentId
      ),
      ledgerEntry: normalizePointLedgerEntry(existingLedgerEntry),
    };
  }

  const currentWallet = normalizePointWallet(
    (Array.isArray(pointWallets) ? pointWallets : []).find(
      (entry) => trimString(entry?.student_id) === normalizedStudentId
    ) || {},
    normalizedStudentId
  );
  const nextTotalPoints = currentWallet.total_points + normalizedDelta;

  if (nextTotalPoints < 0) {
    return {
      applied: false,
      code: 'insufficient_points',
      pointWallets,
      pointLedgerEntries,
      wallet: currentWallet,
      ledgerEntry: null,
    };
  }

  const nextWallet = normalizePointWallet({
    ...currentWallet,
    parent_id: trimString(parentId) || currentWallet.parent_id,
    student_id: normalizedStudentId,
    total_points: nextTotalPoints,
    lifetime_points: currentWallet.lifetime_points + (normalizedDelta > 0 ? normalizedDelta : 0),
    updated_at: createdAt,
  }, normalizedStudentId);
  const ledgerEntry = normalizePointLedgerEntry({
    id: trimString(entryId) || buildPointLedgerEntryId({
      studentId: normalizedStudentId,
      sourceType,
      sourceId: normalizedSourceId,
    }),
    parent_id: trimString(parentId),
    student_id: normalizedStudentId,
    wallet_id: nextWallet.id || normalizedStudentId,
    source_type: sourceType,
    source_id: normalizedSourceId,
    delta_points: normalizedDelta,
    balance_after: nextWallet.total_points,
    description,
    metadata,
    created_at: createdAt,
  });

  return {
    applied: true,
    code: 'applied',
    pointWallets: [
      ...(Array.isArray(pointWallets) ? pointWallets : []).filter(
        (entry) => trimString(entry?.student_id) !== normalizedStudentId
      ),
      nextWallet,
    ],
    pointLedgerEntries: [
      ...(Array.isArray(pointLedgerEntries) ? pointLedgerEntries : []),
      ledgerEntry,
    ],
    wallet: nextWallet,
    ledgerEntry,
  };
};
