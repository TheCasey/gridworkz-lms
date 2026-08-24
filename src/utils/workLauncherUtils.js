import { WeeklyPlanStatuses } from '../constants/schema.js';
import {
  buildLegacySubjectWeeklyBlockSeeds,
  getSubjectBlockCount,
  getSubjectBlockLengthMinutes,
  getStudentSubjectsFromLegacyRecords,
} from './planningCompatibilityUtils.js';
import {
  buildPublishedWeeklyPlanPortalSubjects,
  buildPublishedWeeklyPlanPortalWorkItems,
  sortSubjectsForWeeklyPlanning,
} from './weeklyPlanUtils.js';
import {
  LOCKDOWN_DERIVED_WEEKLY_PLAN_POLICY_SOURCE_KIND,
  LockdownActiveWorkSessionKinds,
  deriveCurrentLockdownPolicyPreview,
  normalizeLockdownActiveWorkSession,
  selectActiveLockdownWeeklyPlanBlock,
} from './lockdownPolicyUtils.js';
import { summarizeAllowedResources } from '../../extensions/chrome-lockdown-poc/guidance.js';

const WORK_LAUNCHER_SOURCE_KINDS = Object.freeze({
  PUBLISHED_WEEKLY_PLAN: 'published_weekly_plan',
  LEGACY_SUBJECT_BRIDGE: 'legacy_subject_bridge',
});

const cloneLauncherValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(cloneLauncherValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneLauncherValue(nestedValue)])
    );
  }

  return value;
};

const toNonEmptyString = (value) => (
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : ''
);

const toIntegerOrNull = (value) => {
  if (Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const getCompletedBlockIndices = (completedBlocks = {}, subjectId = '') => (
  Array.isArray(completedBlocks?.[subjectId])
    ? completedBlocks[subjectId].filter((value) => Number.isInteger(value))
    : []
);

const isRunningTimerSession = (timerSession = {}) => (
  timerSession?.is_running === true
  || timerSession?.status === 'active'
  || timerSession?.status === 'running'
);

const isInactiveTimerSession = (timerSession = {}) => (
  timerSession?.is_running === false
  || timerSession?.status === 'paused'
  || timerSession?.status === 'completed'
  || timerSession?.status === 'archived'
  || timerSession?.status === 'inactive'
);

const findTimerSessionForWorkItem = (workItem = {}, timerSessions = []) => (
  (Array.isArray(timerSessions) ? timerSessions : []).find((timerSession) => (
    toNonEmptyString(timerSession?.subject_id) === toNonEmptyString(workItem?.legacySubjectId)
    && toIntegerOrNull(timerSession?.block_index) === toIntegerOrNull(workItem?.compatibilityBlockIndex)
  )) || null
);

const hasAnyOtherRunningTimerSession = (timerSessions = [], workItem = {}) => (
  (Array.isArray(timerSessions) ? timerSessions : []).some((timerSession) => {
    if (!timerSession || !isRunningTimerSession(timerSession)) {
      return false;
    }

    return !(
      toNonEmptyString(timerSession?.subject_id) === toNonEmptyString(workItem?.legacySubjectId)
      && toIntegerOrNull(timerSession?.block_index) === toIntegerOrNull(workItem?.compatibilityBlockIndex)
    );
  })
);

const buildLegacyBridgeWorkItems = ({ subjects = [], studentId = '' } = {}) => (
  sortSubjectsForWeeklyPlanning(
    getStudentSubjectsFromLegacyRecords(subjects, studentId).filter((subject) => subject?.is_active !== false)
  ).flatMap((subject) => {
    const totalBlocks = getSubjectBlockCount(subject);
    const blockLength = getSubjectBlockLengthMinutes(subject);
    const blockSeeds = buildLegacySubjectWeeklyBlockSeeds({ subject, studentId });

    return blockSeeds.map((blockSeed, blockIndex) => ({
      id: `${subject.id}_block_${blockIndex}`,
      title: toNonEmptyString(blockSeed.title) || toNonEmptyString(subject.title) || `Block ${blockIndex + 1}`,
      legacySubjectId: subject.id,
      legacySubjectTitle: toNonEmptyString(subject.title),
      compatibilityBlockIndex: blockIndex,
      plannedDurationMinutes: blockLength,
      requireTimer: Boolean(subject?.require_timer),
      requireInput: subject?.require_input !== false,
      resources: cloneLauncherValue(blockSeed.resources),
      customFields: cloneLauncherValue(blockSeed.custom_fields),
      instruction: toNonEmptyString(blockSeed.instruction) || null,
      color: toNonEmptyString(subject?.color),
      compatibilitySubject: {
        ...subject,
        id: subject.id,
        title: toNonEmptyString(subject.title),
        portal_display_title: toNonEmptyString(subject.title),
        legacy_subject_id: subject.id,
        legacy_subject_title: toNonEmptyString(subject.title),
        block_count: totalBlocks,
        block_length: blockLength,
      },
      source_kind: WORK_LAUNCHER_SOURCE_KINDS.LEGACY_SUBJECT_BRIDGE,
    }));
  })
);

const buildActiveSelectionBlocks = (workItems = []) => (
  (Array.isArray(workItems) ? workItems : []).map((workItem) => ({
    ...workItem,
    legacy_subject_id: toNonEmptyString(workItem?.legacySubjectId),
    legacy_subject_title: toNonEmptyString(workItem?.legacySubjectTitle),
    legacy_block_index: toIntegerOrNull(workItem?.compatibilityBlockIndex),
  }))
);

const normalizeActiveWorkSessionKind = (workItem = {}, timerSession = null) => {
  if (!timerSession) {
    return '';
  }

  return toNonEmptyString(workItem?.completion_mode || workItem?.completionMode) === 'task_complete'
    ? LockdownActiveWorkSessionKinds.TASK_COMPLETE
    : LockdownActiveWorkSessionKinds.TIMER;
};

export const getPublishedWeeklyPlanBlockLaunchState = ({
  workItem = null,
  timerSessions = [],
  completedBlocks = {},
} = {}) => {
  const compatibilitySubject = workItem?.compatibilitySubject || null;
  const compatibilityBlockIndex = toIntegerOrNull(workItem?.compatibilityBlockIndex);
  const legacySubjectId = toNonEmptyString(workItem?.legacySubjectId);
  const completedBlockIndices = getCompletedBlockIndices(completedBlocks, legacySubjectId);
  const timerSession = findTimerSessionForWorkItem(workItem, timerSessions);
  const blockedByOtherTimer = !timerSession && hasAnyOtherRunningTimerSession(timerSessions, workItem);
  const isCompleted = Boolean(
    compatibilitySubject
    && Number.isInteger(compatibilityBlockIndex)
    && completedBlockIndices.includes(compatibilityBlockIndex)
  );
  const isUnavailable = !compatibilitySubject || !legacySubjectId || !Number.isInteger(compatibilityBlockIndex);
  const canResume = Boolean(timerSession && isRunningTimerSession(timerSession) === false && !isCompleted);
  const canStart = Boolean(
    !isUnavailable
    && !isCompleted
    && !timerSession
    && !blockedByOtherTimer
  );
  const canComplete = Boolean(timerSession && !isCompleted);

  return {
    source_kind: workItem?.source_kind || WORK_LAUNCHER_SOURCE_KINDS.PUBLISHED_WEEKLY_PLAN,
    completed: isCompleted,
    unavailable: isUnavailable,
    blocked_by_other_timer: blockedByOtherTimer,
    timer_session: timerSession ? cloneLauncherValue(timerSession) : null,
    can_start: canStart,
    can_resume: canResume,
    can_complete: canComplete,
    status: isCompleted
      ? 'completed'
      : isUnavailable
        ? 'unavailable'
        : timerSession
          ? (isRunningTimerSession(timerSession) ? 'active' : 'paused')
          : blockedByOtherTimer
            ? 'blocked'
            : 'ready',
    blocked_reason: isCompleted
      ? 'completed'
      : isUnavailable
        ? 'unavailable'
        : blockedByOtherTimer
          ? 'active_timer_on_other_block'
          : null,
  };
};

export const buildWorkLauncherActiveWorkSession = ({
  studentRecord = null,
  weeklyPlan = null,
  workItem = null,
  timerSession = null,
} = {}) => {
  if (!workItem || !timerSession) {
    return null;
  }

  return normalizeLockdownActiveWorkSession({
    id: timerSession.id || workItem.id || '',
    kind: normalizeActiveWorkSessionKind(workItem, timerSession),
    status: isInactiveTimerSession(timerSession) ? 'paused' : 'active',
    source_kind: weeklyPlan?.status === WeeklyPlanStatuses.PUBLISHED
      ? LOCKDOWN_DERIVED_WEEKLY_PLAN_POLICY_SOURCE_KIND
      : WORK_LAUNCHER_SOURCE_KINDS.LEGACY_SUBJECT_BRIDGE,
    parent_id: toNonEmptyString(studentRecord?.parent_id),
    student_id: toNonEmptyString(studentRecord?.id),
    subject_id: toNonEmptyString(timerSession?.subject_id) || toNonEmptyString(workItem?.legacySubjectId),
    subject_title: toNonEmptyString(workItem?.title) || toNonEmptyString(workItem?.legacySubjectTitle),
    assignment_id: toNonEmptyString(workItem?.assignment_id) || toNonEmptyString(workItem?.compatibilitySubject?.assignment_id),
    weekly_plan_id: toNonEmptyString(weeklyPlan?.id),
    block_id: toNonEmptyString(workItem?.id),
    block_index: toIntegerOrNull(workItem?.compatibilityBlockIndex),
    block_title: toNonEmptyString(workItem?.title),
    legacy_subject_id: toNonEmptyString(workItem?.legacySubjectId),
    legacy_subject_title: toNonEmptyString(workItem?.legacySubjectTitle) || toNonEmptyString(workItem?.title),
    legacy_block_index: toIntegerOrNull(workItem?.compatibilityBlockIndex),
    timer_session_id: toNonEmptyString(timerSession?.id),
    started_at: timerSession?.start_time ?? null,
    updated_at: timerSession?.updated_at ?? null,
    completed_at: timerSession?.completed_at ?? null,
    target_end_time: timerSession?.target_end_time ?? null,
    duration_ms: timerSession?.duration_ms ?? null,
    remaining_time: timerSession?.remaining_time ?? null,
    is_running: Boolean(timerSession?.is_running),
    metadata: {
      source: 'timer_session',
    },
  });
};

export const buildWorkLauncherTimerSessionPayload = ({
  studentRecord = null,
  weeklyPlan = null,
  weekKey = '',
  workItem = null,
  timer = null,
  includeCreatedAt = false,
} = {}) => {
  if (!studentRecord || !workItem || !timer) {
    return null;
  }

  const payload = {
    student_id: studentRecord.id,
    parent_id: studentRecord.parent_id,
    subject_id: workItem.legacySubjectId,
    block_index: workItem.compatibilityBlockIndex,
    block_id: toNonEmptyString(workItem.id),
    weekly_plan_id: toNonEmptyString(weeklyPlan?.id),
    week_key: toNonEmptyString(weeklyPlan?.week_key) || toNonEmptyString(weekKey),
    start_time: timer.startTime,
    duration_ms: timer.durationMs,
    duration_minutes: timer.durationMinutes,
    target_end_time: timer.targetEndTime,
    initial_duration_ms: timer.initialDurationMs,
    remaining_time: timer.remainingTime ?? null,
    is_running: Boolean(timer.isRunning),
    paused_at: timer.pausedAt ?? null,
    resumed_at: timer.resumedAt ?? null,
    completed_at: timer.remainingTime === 0 ? (timer.completedAt ?? Date.now()) : null,
    saved_at: Date.now(),
  };

  if (includeCreatedAt) {
    payload.created_at = Date.now();
  }

  return payload;
};

export const buildPublishedWeeklyPlanWorkLauncherContract = ({
  studentRecord = null,
  weeklyPlan = null,
  subjectsById = {},
  timerSessions = [],
  completedBlocks = {},
  entitlementActive = true,
  referenceDate = new Date(),
} = {}) => {
  const subjectList = Object.values(subjectsById || {});
  const publishedWorkItems = weeklyPlan?.status === WeeklyPlanStatuses.PUBLISHED
    ? buildPublishedWeeklyPlanPortalWorkItems({
      weeklyPlan,
      subjectsById,
    })
    : buildLegacyBridgeWorkItems({
      subjects: subjectList,
      studentId: studentRecord?.id || '',
    });
  const bridgeSubjects = weeklyPlan?.status === WeeklyPlanStatuses.PUBLISHED
    ? buildPublishedWeeklyPlanPortalSubjects(publishedWorkItems)
    : sortSubjectsForWeeklyPlanning(
      getStudentSubjectsFromLegacyRecords(subjectList, studentRecord?.id || '').filter((subject) => subject?.is_active !== false)
    );
  const launcherPlan = {
    ...(weeklyPlan?.status === WeeklyPlanStatuses.PUBLISHED ? weeklyPlan : {}),
    blocks: publishedWorkItems,
  };
  const rawPlanBlocks = Array.isArray(weeklyPlan?.blocks) ? weeklyPlan.blocks : [];
  const activeSelectionPlan = weeklyPlan?.status === WeeklyPlanStatuses.PUBLISHED
    ? weeklyPlan
    : {
      ...launcherPlan,
      blocks: buildActiveSelectionBlocks(publishedWorkItems),
    };
  const activeSelection = selectActiveLockdownWeeklyPlanBlock({
    weeklyPlan: activeSelectionPlan,
    timerSessions,
  });
  const policyPreview = deriveCurrentLockdownPolicyPreview({
    entitlementActive,
    parentId: studentRecord?.parent_id || '',
    studentRecord,
    weeklyPlan: weeklyPlan?.status === WeeklyPlanStatuses.PUBLISHED ? weeklyPlan : null,
    timerSessions,
    referenceDate,
  });
  const activeBlock = activeSelection.activeBlock || null;
  const activeTimerSession = activeSelection.activeTimerSession || null;

  const blocks = publishedWorkItems.map((workItem, index) => {
    const rawBlock = rawPlanBlocks[index] || {};
    const enrichedWorkItem = {
      ...workItem,
      display_order: index + 1,
      assignment_id: toNonEmptyString(rawBlock.assignment_id),
      completion_mode: toNonEmptyString(rawBlock.completion_mode),
    };
    const launchState = getPublishedWeeklyPlanBlockLaunchState({
      workItem: enrichedWorkItem,
      timerSessions,
      completedBlocks,
    });

    return {
      ...enrichedWorkItem,
      launch_state: launchState,
      active_timer_session: launchState.timer_session,
      active_work_session: buildWorkLauncherActiveWorkSession({
        studentRecord,
        weeklyPlan,
        workItem: enrichedWorkItem,
        timerSession: launchState.timer_session,
      }),
    };
  });
  const enrichedActiveBlock = activeBlock
    ? blocks.find((block) => block.id === activeBlock.id) || activeBlock
    : null;

  return {
    contract_version: 1,
    source_kind: weeklyPlan?.status === WeeklyPlanStatuses.PUBLISHED
      ? WORK_LAUNCHER_SOURCE_KINDS.PUBLISHED_WEEKLY_PLAN
      : WORK_LAUNCHER_SOURCE_KINDS.LEGACY_SUBJECT_BRIDGE,
    bridge_kind: WORK_LAUNCHER_SOURCE_KINDS.LEGACY_SUBJECT_BRIDGE,
    has_published_weekly_plan: weeklyPlan?.status === WeeklyPlanStatuses.PUBLISHED,
    parent_id: toNonEmptyString(studentRecord?.parent_id),
    student_id: toNonEmptyString(studentRecord?.id),
    weekly_plan_id: toNonEmptyString(weeklyPlan?.id),
    blocks,
    bridge_subjects: bridgeSubjects,
    active_block: enrichedActiveBlock,
    active_timer_session: activeTimerSession,
    active_work_session: buildWorkLauncherActiveWorkSession({
      studentRecord,
      weeklyPlan,
      workItem: enrichedActiveBlock,
      timerSession: activeTimerSession,
    }),
    policy_preview: policyPreview,
    allowed_resources: summarizeAllowedResources(policyPreview.policy || {}),
    system_resources: cloneLauncherValue(policyPreview.policy?.system_resources || []),
  };
};
