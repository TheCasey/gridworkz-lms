import {
  ChoreClaimStatuses,
  ChoreCompletionStatuses,
  ChoreFrequencyPools,
} from '../constants/schema.js';
import {
  buildDateFromTimeZoneParts,
  getCurrentWeekRange,
  getDateTimePartsInTimeZone,
  getWeekConfig,
} from './weekUtils.js';
import { buildStudentSafeRewardState } from './rewardUtils.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const COMPLETION_STATUSES_HOLDING_AVAILABILITY = new Set([
  ChoreCompletionStatuses.COMPLETED,
  ChoreCompletionStatuses.APPROVED,
]);

const toComparableDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === 'function') {
    const resolved = value.toDate();
    return Number.isNaN(resolved?.getTime?.()) ? null : resolved;
  }

  const resolved = new Date(value);
  return Number.isNaN(resolved.getTime()) ? null : resolved;
};

const toNonNegativeInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const toBoolean = (value, fallback = false) => (
  typeof value === 'boolean' ? value : fallback
);

const toStringArray = (value) => (
  Array.isArray(value)
    ? value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    : []
);

const getChoreDefinitionId = (value = {}) => (
  value.chore_definition_id
  || value.chore_id
  || value.id
  || ''
);

const getChoreTimestamp = (value = {}) => (
  toComparableDate(
    value.completed_at
    || value.claimed_at
    || value.created_at
    || value.updated_at
  )
);

const getCompletionTimestamp = (completion) => (
  toComparableDate(completion?.completed_at || completion?.created_at)
);

const getClaimTimestamp = (claim) => (
  toComparableDate(claim?.claimed_at || claim?.created_at)
);

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

const getMonthPartsAfter = (parts) => {
  if (parts.month === 12) {
    return {
      year: parts.year + 1,
      month: 1,
      day: 1,
    };
  }

  return {
    year: parts.year,
    month: parts.month + 1,
    day: 1,
  };
};

const isClaimStatusActive = (status) => (
  (status || ChoreClaimStatuses.CLAIMED) === ChoreClaimStatuses.CLAIMED
);

const doesCompletionHoldAvailability = (completion) => (
  COMPLETION_STATUSES_HOLDING_AVAILABILITY.has(
    completion?.status || ChoreCompletionStatuses.COMPLETED
  )
);

export const DEFAULT_CHORE_SETTINGS = Object.freeze({
  claim_expiration_hours: 24,
  week_reset_day: 1,
  week_reset_hour: 0,
  week_reset_minute: 0,
  timezone: '',
});

export const getRoutineDateKey = (referenceDate = new Date(), timezone = '') => (
  getDateTimePartsInTimeZone(referenceDate, timezone).localDate
);

export const getRoutinePeriod = (routineTemplate = {}) => {
  const explicitPeriod = String(routineTemplate?.routine_period || '').trim().toLowerCase();
  if (['morning', 'afternoon', 'evening'].includes(explicitPeriod)) {
    return explicitPeriod;
  }

  const title = String(routineTemplate?.title || '').trim().toLowerCase();
  if (title.includes('afternoon')) return 'afternoon';
  if (title.includes('evening') || title.includes('night')) return 'evening';
  return 'morning';
};

export const resolveRoutineTemplatesForStudent = ({
  routineTemplates = [],
  studentId = '',
} = {}) => {
  const assignedTemplates = (Array.isArray(routineTemplates) ? routineTemplates : [])
    .filter((routineTemplate) => {
      const studentIds = toStringArray(routineTemplate?.student_ids);
      return routineTemplate?.is_active !== false
        && (studentIds.length === 0 || studentIds.includes(studentId));
    });
  const canonicalPeriods = new Set(
    assignedTemplates
      .filter((routineTemplate) => {
        const studentIds = toStringArray(routineTemplate?.student_ids);
        return String(routineTemplate?.routine_period || '').trim()
          && studentIds.length === 1
          && studentIds[0] === studentId;
      })
      .map(getRoutinePeriod)
  );

  return assignedTemplates.filter((routineTemplate) => {
    const checklistItems = Array.isArray(routineTemplate?.checklist_items)
      ? routineTemplate.checklist_items.filter((item) => String(item?.label || '').trim())
      : [];
    if (!checklistItems.length) return false;

    const period = getRoutinePeriod(routineTemplate);
    if (!canonicalPeriods.has(period)) return true;

    const studentIds = toStringArray(routineTemplate?.student_ids);
    return String(routineTemplate?.routine_period || '').trim() !== ''
      && studentIds.length === 1
      && studentIds[0] === studentId;
  });
};

export const getNextWeeklyBoundary = (referenceDate = new Date(), weekConfig = {}) => {
  const { weekStart } = getCurrentWeekRange(referenceDate, weekConfig);
  return new Date(weekStart.getTime() + WEEK_MS);
};

export const getNextMonthlyBoundary = (referenceDate = new Date(), { timezone = '' } = {}) => {
  const localParts = getDateTimePartsInTimeZone(referenceDate, timezone);
  const nextMonthParts = getMonthPartsAfter(localParts);

  return buildDateFromTimeZoneParts({
    ...nextMonthParts,
    hour: 0,
    minute: 0,
    second: 0,
  }, timezone);
};

export const getNextChorePeriodBoundary = ({
  frequencyPool,
  referenceDate = new Date(),
  weekConfig = {},
} = {}) => {
  if (frequencyPool === ChoreFrequencyPools.MONTHLY) {
    return getNextMonthlyBoundary(referenceDate, weekConfig);
  }

  return getNextWeeklyBoundary(referenceDate, weekConfig);
};

export const getClaimExpiresAt = ({
  claimedAt,
  claimExpirationHours = DEFAULT_CHORE_SETTINGS.claim_expiration_hours,
} = {}) => {
  const resolvedClaimedAt = toComparableDate(claimedAt);
  const expirationHours = toNonNegativeInteger(claimExpirationHours, 0);

  if (!resolvedClaimedAt || expirationHours <= 0) {
    return null;
  }

  return new Date(resolvedClaimedAt.getTime() + (expirationHours * HOUR_MS));
};

export const isClaimExpired = ({
  claimedAt,
  expiresAt,
  claimExpirationHours = DEFAULT_CHORE_SETTINGS.claim_expiration_hours,
  now = new Date(),
} = {}) => {
  const resolvedNow = toComparableDate(now);
  const resolvedExpiresAt = toComparableDate(expiresAt)
    || getClaimExpiresAt({ claimedAt, claimExpirationHours });

  if (!resolvedNow || !resolvedExpiresAt) {
    return false;
  }

  return resolvedNow >= resolvedExpiresAt;
};

export const getNextEligibleTime = ({
  frequencyPool,
  completedAt,
  minimumCooldownDays = 0,
  weekConfig = {},
} = {}) => {
  const resolvedCompletedAt = toComparableDate(completedAt);

  if (!resolvedCompletedAt) {
    return null;
  }

  const nextPeriodBoundary = getNextChorePeriodBoundary({
    frequencyPool,
    referenceDate: resolvedCompletedAt,
    weekConfig,
  });
  const cooldownEndsAt = new Date(
    resolvedCompletedAt.getTime() + (toNonNegativeInteger(minimumCooldownDays, 0) * DAY_MS)
  );

  return nextPeriodBoundary > cooldownEndsAt ? nextPeriodBoundary : cooldownEndsAt;
};

export const isStudentEligibleForChore = (choreDefinition, studentId) => {
  if (!studentId) {
    return false;
  }

  if (toBoolean(choreDefinition?.all_students_eligible, false)) {
    return true;
  }

  return toStringArray(choreDefinition?.eligible_student_ids).includes(studentId);
};

export const getActiveChoreClaim = ({
  choreDefinitionId,
  claims = [],
  now = new Date(),
  claimExpirationHours = DEFAULT_CHORE_SETTINGS.claim_expiration_hours,
} = {}) => (
  (Array.isArray(claims) ? claims : [])
    .filter((claim) => (
      getChoreDefinitionId(claim) === choreDefinitionId
      && isClaimStatusActive(claim?.status)
      && !isClaimExpired({
        claimedAt: claim?.claimed_at || getClaimTimestamp(claim),
        expiresAt: claim?.expires_at,
        claimExpirationHours: claim?.claim_expiration_hours ?? claimExpirationHours,
        now,
      })
    ))
    .sort((left, right) => {
      const leftTime = getClaimTimestamp(left)?.getTime() || 0;
      const rightTime = getClaimTimestamp(right)?.getTime() || 0;
      return rightTime - leftTime;
    })[0] || null
);

export const getLatestChoreCompletion = ({ choreDefinitionId, completions = [] } = {}) => (
  (Array.isArray(completions) ? completions : [])
    .filter((completion) => (
      getChoreDefinitionId(completion) === choreDefinitionId
      && doesCompletionHoldAvailability(completion)
    ))
    .sort((left, right) => {
      const leftTime = getCompletionTimestamp(left)?.getTime() || 0;
      const rightTime = getCompletionTimestamp(right)?.getTime() || 0;
      return rightTime - leftTime;
    })[0] || null
);

export const getChoreAvailability = ({
  choreDefinition,
  studentId,
  claims = [],
  completions = [],
  now = new Date(),
  weekConfig = {},
  claimExpirationHours = DEFAULT_CHORE_SETTINGS.claim_expiration_hours,
} = {}) => {
  const normalizedWeekConfig = getWeekConfig({
    ...DEFAULT_CHORE_SETTINGS,
    ...weekConfig,
  });
  const choreDefinitionId = getChoreDefinitionId(choreDefinition);
  const activeClaim = getActiveChoreClaim({
    choreDefinitionId,
    claims,
    now,
    claimExpirationHours,
  });
  const latestCompletion = getLatestChoreCompletion({
    choreDefinitionId,
    completions,
  });
  const nextEligibleAt = latestCompletion
    ? getNextEligibleTime({
        frequencyPool: choreDefinition?.frequency_pool || ChoreFrequencyPools.WEEKLY,
        completedAt: latestCompletion.completed_at || getCompletionTimestamp(latestCompletion),
        minimumCooldownDays: choreDefinition?.minimum_cooldown_days,
        weekConfig: normalizedWeekConfig,
      })
    : null;
  const claimedByStudent = activeClaim?.student_id === studentId;
  const claimedBySibling = Boolean(activeClaim) && activeClaim?.student_id !== studentId;
  const isEligible = isStudentEligibleForChore(choreDefinition, studentId);
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
    unavailableReason = 'claimed';
  } else if (isCoolingDown) {
    unavailableReason = 'cooldown';
  }

  return {
    id: choreDefinitionId,
    title: choreDefinition?.title || '',
    frequency_pool: choreDefinition?.frequency_pool || ChoreFrequencyPools.WEEKLY,
    instructions: choreDefinition?.instructions || '',
    definition_of_done: choreDefinition?.definition_of_done || '',
    proof_requirement: choreDefinition?.proof_requirement || '',
    effort_label: choreDefinition?.effort_label || '',
    minimum_cooldown_days: toNonNegativeInteger(choreDefinition?.minimum_cooldown_days, 0),
    is_active: isActive,
    is_eligible: isEligible,
    is_claimed_by_student: claimedByStudent,
    is_claimed_by_sibling: claimedBySibling,
    active_claim_id: activeClaim?.id || '',
    claim_expires_at: activeClaim
      ? toComparableDate(activeClaim?.expires_at)
        || getClaimExpiresAt({
          claimedAt: activeClaim?.claimed_at || getClaimTimestamp(activeClaim),
          claimExpirationHours: activeClaim?.claim_expiration_hours ?? claimExpirationHours,
        })
      : null,
    next_eligible_at: nextEligibleAt,
    unavailable_reason: unavailableReason,
    is_available: !unavailableReason,
  };
};

export const countAvailableChoreBlocksForStudent = ({
  choreDefinitions = [],
  studentId,
  claims = [],
  completions = [],
  now = new Date(),
  weekConfig = {},
  claimExpirationHours = DEFAULT_CHORE_SETTINGS.claim_expiration_hours,
} = {}) => (
  (Array.isArray(choreDefinitions) ? choreDefinitions : []).reduce((counts, choreDefinition) => {
    const availability = getChoreAvailability({
      choreDefinition,
      studentId,
      claims,
      completions,
      now,
      weekConfig,
      claimExpirationHours,
    });

    if (!availability.is_available) {
      return counts;
    }

    const nextCounts = {
      ...counts,
      total: counts.total + 1,
    };

    if (availability.frequency_pool === ChoreFrequencyPools.MONTHLY) {
      nextCounts.monthly += 1;
    } else {
      nextCounts.weekly += 1;
    }

    return nextCounts;
  }, {
    total: 0,
    weekly: 0,
    monthly: 0,
  })
);

export const buildStudentSafeChoreView = ({
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
  claimExpirationHours = DEFAULT_CHORE_SETTINGS.claim_expiration_hours,
} = {}) => {
  const normalizedWeekConfig = getWeekConfig({
    ...DEFAULT_CHORE_SETTINGS,
    ...weekConfig,
  });
  const routineDateKey = getRoutineDateKey(now, normalizedWeekConfig.timezone);
  const routineLookup = new Map(
    (Array.isArray(routineCompletions) ? routineCompletions : [])
      .filter((routineCompletion) => (
        routineCompletion?.student_id === studentId
        && routineCompletion?.date_key === routineDateKey
      ))
      .map((routineCompletion) => [
        `${routineCompletion.routine_template_id}_${routineCompletion.date_key}`,
        routineCompletion,
      ])
  );
  const choreAvailabilities = (Array.isArray(choreDefinitions) ? choreDefinitions : []).map(
    (choreDefinition) => getChoreAvailability({
      choreDefinition,
      studentId,
      claims: choreClaims,
      completions: choreCompletions,
      now,
      weekConfig: normalizedWeekConfig,
      claimExpirationHours,
    })
  );

  return {
    student_id: studentId,
    routine_date_key: routineDateKey,
    routines: resolveRoutineTemplatesForStudent({ routineTemplates, studentId })
      .map((routineTemplate) => {
        const routineId = routineTemplate.id || '';
        const matchingCompletions = (Array.isArray(routineCompletions) ? routineCompletions : [])
          .filter((routineCompletion) => (
            routineCompletion?.student_id === studentId
            && routineCompletion?.routine_template_id === routineId
          ));
        const completion = routineLookup.get(`${routineId}_${routineDateKey}`) || null;

        return {
          id: routineId,
          title: routineTemplate.title || '',
          routine_period: getRoutinePeriod(routineTemplate),
          checklist_items: Array.isArray(routineTemplate.checklist_items)
            ? routineTemplate.checklist_items.map((checklistItem) => ({
                id: checklistItem?.id || '',
                label: checklistItem?.label || '',
              }))
            : [],
          counts_toward_allowance: toBoolean(routineTemplate?.counts_toward_allowance, false),
          counts_toward_points: toBoolean(routineTemplate?.counts_toward_points, false),
          is_completed_today: Boolean(completion),
          completed_at: completion?.completed_at || null,
          completions: matchingCompletions.map((routineCompletion) => ({
            id: routineCompletion?.id || '',
            date_key: routineCompletion?.date_key || '',
            completed_item_ids: toStringArray(routineCompletion?.completed_item_ids),
            completed_at: routineCompletion?.completed_at || null,
          })),
        };
      }),
    chores: {
      available: choreAvailabilities
        .filter((availability) => availability.is_available)
        .map(sanitizeStudentVisibleChore),
      claimed: choreAvailabilities
        .filter((availability) => availability.is_claimed_by_student)
        .map(sanitizeStudentVisibleChore),
      available_counts: countAvailableChoreBlocksForStudent({
        choreDefinitions,
        studentId,
        claims: choreClaims,
        completions: choreCompletions,
        now,
        weekConfig: normalizedWeekConfig,
        claimExpirationHours,
      }),
    },
    allowance: {
      periods: [],
    },
    rewards: buildStudentSafeRewardState({
      studentId,
      pointWallets,
      rewardCatalogItems,
      rewardRedemptions,
    }),
  };
};

export const countStudentVisibleChoresByFrequency = (chores = []) => (
  (Array.isArray(chores) ? chores : []).reduce((counts, chore) => {
    const nextCounts = {
      ...counts,
      total: counts.total + 1,
    };

    if (chore?.frequency_pool === ChoreFrequencyPools.MONTHLY) {
      nextCounts.monthly += 1;
    } else {
      nextCounts.weekly += 1;
    }

    return nextCounts;
  }, {
    total: 0,
    weekly: 0,
    monthly: 0,
  })
);

export const buildStudentChoreWorkspaceModel = ({
  choreState = null,
  enabled = true,
  hasStudentContext = true,
  now = new Date(),
  weekConfig = {},
} = {}) => {
  const normalizedWeekConfig = getWeekConfig({
    ...DEFAULT_CHORE_SETTINGS,
    ...weekConfig,
  });
  const routineDateKey = getRoutineDateKey(now, normalizedWeekConfig.timezone);
  const routines = (Array.isArray(choreState?.routines) ? choreState.routines : []).map((routine) => {
    const completion = (Array.isArray(routine?.completions) ? routine.completions : []).find(
      (entry) => entry?.date_key === routineDateKey
    ) || null;

    return {
      id: routine?.id || '',
      title: routine?.title || '',
      checklist_items: Array.isArray(routine?.checklist_items) ? routine.checklist_items : [],
      counts_toward_allowance: toBoolean(routine?.counts_toward_allowance, false),
      counts_toward_points: toBoolean(routine?.counts_toward_points, false),
      is_completed_today: Boolean(completion),
      completed_at: completion?.completed_at || null,
      completed_item_ids: toStringArray(completion?.completed_item_ids),
    };
  });
  const availableChores = Array.isArray(choreState?.chores?.available) ? choreState.chores.available : [];
  const claimedChores = Array.isArray(choreState?.chores?.claimed) ? choreState.chores.claimed : [];
  const rewardWallet = choreState?.rewards?.wallet || null;
  const hasVisibleContent = routines.length > 0 || availableChores.length > 0 || claimedChores.length > 0;
  const allRoutinesCompleted = routines.length > 0 && routines.every((routine) => routine.is_completed_today);
  const allChoresDone = availableChores.length === 0 && claimedChores.length === 0;

  let accessState = 'ready';
  if (!enabled) {
    accessState = 'hidden';
  } else if (!hasStudentContext) {
    accessState = 'locked';
  } else if (!hasVisibleContent) {
    accessState = 'empty';
  } else if (allChoresDone && (routines.length === 0 || allRoutinesCompleted)) {
    accessState = 'all_done';
  }

  return {
    accessState,
    canShowArea: enabled,
    canInteract: enabled && hasStudentContext,
    canUseChorePools: choreState?.access?.can_use_chores === true,
    routineDateKey,
    routines,
    availableChores,
    claimedChores,
    rewardWallet,
    counts: {
      available: countStudentVisibleChoresByFrequency(availableChores),
      claimed: countStudentVisibleChoresByFrequency(claimedChores),
      remaining: countStudentVisibleChoresByFrequency([
        ...availableChores,
        ...claimedChores,
      ]),
    },
  };
};

export const buildChoreCapacitySummary = ({
  choreDefinitions = [],
  students = [],
  claims = [],
  completions = [],
  now = new Date(),
  weekConfig = {},
  claimExpirationHours = DEFAULT_CHORE_SETTINGS.claim_expiration_hours,
} = {}) => (
  toStringArray(students.map((student) => student?.id || student))
    .reduce((summary, studentId) => ({
      ...summary,
      [studentId]: countAvailableChoreBlocksForStudent({
        choreDefinitions,
        studentId,
        claims,
        completions,
        now,
        weekConfig,
        claimExpirationHours,
      }),
    }), {})
);

export const sortChoreRecordsByTimestampDesc = (records = []) => (
  [...(Array.isArray(records) ? records : [])].sort((left, right) => {
    const leftTime = getChoreTimestamp(left)?.getTime() || 0;
    const rightTime = getChoreTimestamp(right)?.getTime() || 0;
    return rightTime - leftTime;
  })
);
