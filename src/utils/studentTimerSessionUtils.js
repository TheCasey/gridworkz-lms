const toNonEmptyString = (value) => (
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : ''
);

const toBlockIndex = (value) => {
  if (Number.isInteger(value)) return value;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const toTimestampMillis = (value) => {
  if (Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
  return null;
};

const getLegacySubjectBlockIndices = (subject = {}) => {
  const totalBlocks = Number.parseInt(subject?.block_count, 10);
  if (!Number.isInteger(totalBlocks) || totalBlocks <= 0) return [];
  return Array.from({ length: totalBlocks }, (_, blockIndex) => blockIndex);
};

export const buildPortalTimerBlockContext = ({
  hasPublishedWeeklyPlan = false,
  publishedWorkItems = [],
  subjects = [],
} = {}) => {
  const blockIdsBySubject = {};
  const blockIndicesBySubject = {};
  const timerRequirementsBySubject = {};

  if (hasPublishedWeeklyPlan) {
    publishedWorkItems.forEach((workItem) => {
      const subjectId = toNonEmptyString(workItem?.legacySubjectId);
      const blockIndex = toBlockIndex(workItem?.compatibilityBlockIndex);
      if (!subjectId || blockIndex === null) return;

      blockIndicesBySubject[subjectId] ||= [];
      blockIndicesBySubject[subjectId].push(blockIndex);
      blockIdsBySubject[subjectId] ||= {};
      blockIdsBySubject[subjectId][blockIndex] = toNonEmptyString(workItem?.id);
      timerRequirementsBySubject[subjectId] ||= {};
      timerRequirementsBySubject[subjectId][blockIndex] = {
        required: Boolean(workItem.requireTimer),
        durationMs: Number(workItem.plannedDurationMinutes) * 60_000,
      };
    });
  } else {
    subjects.forEach((subject) => {
      const subjectId = toNonEmptyString(subject?.id);
      if (!subjectId) return;
      blockIndicesBySubject[subjectId] = Array.isArray(subject?.portal_block_indices)
        ? subject.portal_block_indices.map(toBlockIndex).filter(Number.isInteger)
        : getLegacySubjectBlockIndices(subject);
      timerRequirementsBySubject[subjectId] = Object.fromEntries(
        blockIndicesBySubject[subjectId].map((index) => [index, {
          required: Boolean(subject.require_timer),
          durationMs: Number(subject.block_length || 30) * 60_000,
        }])
      );
    });
  }

  Object.keys(blockIndicesBySubject).forEach((subjectId) => {
    blockIndicesBySubject[subjectId] = [...new Set(blockIndicesBySubject[subjectId])]
      .sort((left, right) => left - right);
  });

  return {
    blockIdsBySubject,
    blockIndicesBySubject,
    timerRequirementsBySubject,
  };
};

export const getPortalTimerInvalidReason = ({
  timer = null,
  subjectId = '',
  blockContext = {},
  completedBlocks = {},
  weeklyPlanId = '',
  weekKey = '',
  weekStart = null,
} = {}) => {
  if (!timer) return 'missing_timer';

  const normalizedSubjectId = toNonEmptyString(subjectId)
    || toNonEmptyString(timer?.subjectId)
    || toNonEmptyString(timer?.subject_id);
  const blockIndex = toBlockIndex(timer?.blockIndex ?? timer?.block_index);
  const availableBlockIndices = blockContext?.blockIndicesBySubject?.[normalizedSubjectId];

  if (!normalizedSubjectId || !Array.isArray(availableBlockIndices)) {
    return 'subject_unavailable';
  }
  if (blockIndex === null || !availableBlockIndices.includes(blockIndex)) {
    return 'block_unavailable';
  }
  if (completedBlocks?.[normalizedSubjectId]?.includes(blockIndex)) {
    return 'block_completed';
  }
  const requirement = blockContext?.timerRequirementsBySubject?.[normalizedSubjectId]?.[blockIndex];
  if (requirement?.required === false) return 'timer_not_required';
  const duration = timer.initialDurationMs ?? timer.initial_duration_ms
    ?? timer.durationMs ?? timer.duration_ms;
  if (Number.isFinite(duration) && Number.isFinite(requirement?.durationMs)
    && duration !== requirement.durationMs) return 'timer_duration_changed';

  const storedWeeklyPlanId = toNonEmptyString(timer?.weeklyPlanId ?? timer?.weekly_plan_id);
  const storedWeekKey = toNonEmptyString(timer?.weekKey ?? timer?.week_key);
  const expectedWeeklyPlanId = toNonEmptyString(weeklyPlanId);
  const expectedWeekKey = toNonEmptyString(weekKey);

  if (storedWeeklyPlanId && storedWeeklyPlanId !== expectedWeeklyPlanId) {
    return 'weekly_plan_changed';
  }
  if (storedWeekKey && storedWeekKey !== expectedWeekKey) {
    return 'week_changed';
  }

  const expectedBlockId = toNonEmptyString(
    blockContext?.blockIdsBySubject?.[normalizedSubjectId]?.[blockIndex]
  );
  const storedBlockId = toNonEmptyString(timer?.blockId ?? timer?.block_id);
  if (storedBlockId && expectedBlockId && storedBlockId !== expectedBlockId) {
    return 'block_changed';
  }

  if (!storedWeeklyPlanId && !storedWeekKey) {
    const savedAt = toTimestampMillis(timer?.savedAt ?? timer?.saved_at);
    const currentWeekStart = toTimestampMillis(weekStart);
    if (savedAt !== null && currentWeekStart !== null && savedAt < currentWeekStart) {
      return 'week_changed';
    }
  }

  return null;
};

export const partitionPortalTimers = ({
  activeTimers = {},
  ...validationContext
} = {}) => Object.entries(activeTimers).reduce((partition, [subjectId, timer]) => {
  const invalidReason = getPortalTimerInvalidReason({
    ...validationContext,
    subjectId,
    timer,
  });

  if (invalidReason) {
    partition.staleTimers[subjectId] = {
      reason: invalidReason,
      timer,
    };
  } else {
    partition.currentTimers[subjectId] = timer;
  }

  return partition;
}, {
  currentTimers: {},
  staleTimers: {},
});
