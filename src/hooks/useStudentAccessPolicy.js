import { useCallback, useMemo } from 'react';

export const StudentAccessPolicyReasonCodes = Object.freeze({
  STUDENT_UNAVAILABLE: 'student_unavailable',
  SUBJECT_COMPLETE: 'subject_complete',
  NO_AVAILABLE_BLOCKS: 'no_available_blocks',
  ANOTHER_SUBJECT_TIMER_EXISTS: 'another_subject_timer_exists',
  TIMER_ALREADY_EXISTS: 'timer_already_exists',
  NO_BLOCK_SELECTED: 'no_block_selected',
  SUBMISSION_IN_PROGRESS: 'submission_in_progress',
  BLOCK_ALREADY_COMPLETED: 'block_already_completed',
  TIMER_REQUIRED: 'timer_required',
  TIMER_ASSIGNED_TO_OTHER_BLOCK: 'timer_assigned_to_other_block',
  TIMER_IN_PROGRESS: 'timer_in_progress',
});

const createDecision = ({
  allowed,
  status,
  blockedReason = null,
  resolutionPath = null,
  meta = {},
}) => ({
  allowed,
  status,
  blockedReason,
  resolutionPath,
  meta,
});

const allowDecision = ({ status = 'available', meta = {} } = {}) => createDecision({
  allowed: true,
  status,
  meta,
});

const denyDecision = ({
  code,
  message,
  resolutionType,
  resolutionLabel,
  status = 'blocked',
  meta = {},
}) => createDecision({
  allowed: false,
  status,
  blockedReason: {
    code,
    message,
  },
  resolutionPath: resolutionType ? {
    type: resolutionType,
    label: resolutionLabel,
  } : null,
  meta,
});

const extendDecisionMeta = (decision, meta = {}) => ({
  ...decision,
  meta: {
    ...(decision?.meta || {}),
    ...meta,
  },
});

export const useStudentAccessPolicy = ({
  student,
  subjects = [],
  completedBlocks = {},
  activeTimers = {},
  submissionLocksRef,
} = {}) => {
  const portalAccess = useMemo(() => ({
    canViewSubjects: student
      ? allowDecision({
        status: 'available',
        meta: {
          studentId: student.id,
          subjectCount: subjects.length,
        },
      })
      : denyDecision({
        code: StudentAccessPolicyReasonCodes.STUDENT_UNAVAILABLE,
        message: 'Student portal is still loading.',
        resolutionType: 'reload_portal',
        resolutionLabel: 'Reload the portal after the student record finishes loading.',
        meta: {
          subjectCount: subjects.length,
        },
      }),
  }), [student, subjects.length]);

  const getNextAvailableBlock = useCallback((subject) => {
    if (!subject) return null;

    const totalBlocks = subject?.block_count || 10;
    const completedForSubject = completedBlocks[subject.id] || [];

    for (let blockIndex = 0; blockIndex < totalBlocks; blockIndex += 1) {
      if (!completedForSubject.includes(blockIndex)) {
        return blockIndex;
      }
    }

    return null;
  }, [completedBlocks]);

  const isBlockCompleted = useCallback((subject, blockIndex) => {
    if (!subject || blockIndex === null || blockIndex === undefined) {
      return false;
    }

    return completedBlocks[subject.id]?.includes(blockIndex) || false;
  }, [completedBlocks]);

  const isSubmissionLocked = useCallback((subjectId, blockIndex) => {
    if (!subjectId || blockIndex === null || blockIndex === undefined) {
      return false;
    }

    return Boolean(submissionLocksRef?.current?.[`${subjectId}_${blockIndex}`]);
  }, [submissionLocksRef]);

  const getSubjectPolicy = useCallback((subject, {
    blockIndex = null,
    ignoreSubmissionLock = false,
  } = {}) => {
    const baseAccess = portalAccess.canViewSubjects;

    if (!subject) {
      return {
        canViewSubjects: baseAccess,
        subjectAvailability: denyDecision({
          code: StudentAccessPolicyReasonCodes.STUDENT_UNAVAILABLE,
          message: 'Subject access is not ready yet.',
          resolutionType: 'reload_portal',
          resolutionLabel: 'Reload the portal after the subject list finishes loading.',
        }),
        canStartTimer: denyDecision({
          code: StudentAccessPolicyReasonCodes.STUDENT_UNAVAILABLE,
          message: 'Timer access is not ready yet.',
          resolutionType: 'reload_portal',
          resolutionLabel: 'Reload the portal after the subject list finishes loading.',
        }),
        canSubmitBlock: denyDecision({
          code: StudentAccessPolicyReasonCodes.STUDENT_UNAVAILABLE,
          message: 'Submission access is not ready yet.',
          resolutionType: 'reload_portal',
          resolutionLabel: 'Reload the portal after the subject list finishes loading.',
        }),
      };
    }

    const totalBlocks = subject?.block_count || 4;
    const completedCount = completedBlocks[subject.id]?.length || 0;
    const nextAvailableBlock = getNextAvailableBlock(subject);
    const preferredBlockAvailable = blockIndex !== null
      && blockIndex !== undefined
      && !isBlockCompleted(subject, blockIndex);
    const candidateBlockIndex = preferredBlockAvailable ? blockIndex : nextAvailableBlock;
    const subjectTimer = activeTimers[subject.id] || null;
    const otherSubjectTimerEntry = Object.entries(activeTimers).find(([subjectId, timer]) => (
      subjectId !== subject.id && Boolean(timer)
    ));

    const subjectMeta = {
      studentId: student?.id || null,
      subjectId: subject.id,
      totalBlocks,
      completedCount,
      nextAvailableBlock,
      requestedBlockIndex: blockIndex,
    };

    const subjectAvailability = completedCount >= totalBlocks
      ? denyDecision({
        code: StudentAccessPolicyReasonCodes.SUBJECT_COMPLETE,
        message: 'All blocks completed this week!',
        resolutionType: 'wait_for_next_week',
        resolutionLabel: 'Wait for the next weekly reset to unlock more blocks.',
        status: 'completed',
        meta: subjectMeta,
      })
      : allowDecision({
        status: completedCount > 0 ? 'in_progress' : 'available',
        meta: subjectMeta,
      });

    let canStartTimer = allowDecision({
      status: 'available',
      meta: {
        ...subjectMeta,
        candidateBlockIndex,
      },
    });

    if (!baseAccess.allowed) {
      canStartTimer = extendDecisionMeta(baseAccess, {
        ...subjectMeta,
        candidateBlockIndex,
      });
    } else if (!subjectAvailability.allowed) {
      canStartTimer = extendDecisionMeta(subjectAvailability, {
        ...subjectMeta,
        candidateBlockIndex,
      });
    } else if (subjectTimer) {
      canStartTimer = denyDecision({
        code: StudentAccessPolicyReasonCodes.TIMER_ALREADY_EXISTS,
        message: 'A timer already exists for this subject.',
        resolutionType: 'use_existing_timer',
        resolutionLabel: 'Resume or reset the current subject timer before starting a new one.',
        meta: {
          ...subjectMeta,
          candidateBlockIndex,
          timerBlockIndex: subjectTimer.blockIndex ?? null,
        },
      });
    } else if (candidateBlockIndex === null || candidateBlockIndex === undefined) {
      canStartTimer = denyDecision({
        code: StudentAccessPolicyReasonCodes.NO_AVAILABLE_BLOCKS,
        message: 'All blocks completed this week!',
        resolutionType: 'wait_for_next_week',
        resolutionLabel: 'Wait for the next weekly reset to unlock more blocks.',
        status: 'completed',
        meta: {
          ...subjectMeta,
          candidateBlockIndex,
        },
      });
    } else if (otherSubjectTimerEntry) {
      canStartTimer = denyDecision({
        code: StudentAccessPolicyReasonCodes.ANOTHER_SUBJECT_TIMER_EXISTS,
        message: 'Finish or reset the other subject timer before starting this block.',
        resolutionType: 'finish_other_timer',
        resolutionLabel: 'Finish, resume, or reset the timer on the other subject first.',
        meta: {
          ...subjectMeta,
          candidateBlockIndex,
          blockingSubjectId: otherSubjectTimerEntry[0],
        },
      });
    }

    let canSubmitBlock = allowDecision({
      status: 'available',
      meta: {
        ...subjectMeta,
        blockIndex,
        timerRequired: Boolean(subject.require_timer),
      },
    });

    if (!baseAccess.allowed) {
      canSubmitBlock = extendDecisionMeta(baseAccess, {
        ...subjectMeta,
        blockIndex,
      });
    } else if (!subjectAvailability.allowed) {
      canSubmitBlock = extendDecisionMeta(subjectAvailability, {
        ...subjectMeta,
        blockIndex,
      });
    } else if (blockIndex === null || blockIndex === undefined) {
      canSubmitBlock = denyDecision({
        code: StudentAccessPolicyReasonCodes.NO_BLOCK_SELECTED,
        message: 'Choose a block before submitting.',
        resolutionType: 'select_block',
        resolutionLabel: 'Select a block first, then complete it.',
        meta: {
          ...subjectMeta,
          blockIndex,
        },
      });
    } else if (!ignoreSubmissionLock && isSubmissionLocked(subject.id, blockIndex)) {
      canSubmitBlock = denyDecision({
        code: StudentAccessPolicyReasonCodes.SUBMISSION_IN_PROGRESS,
        message: 'Submission in progress...',
        resolutionType: 'wait_for_submission',
        resolutionLabel: 'Wait for the current submission to finish.',
        meta: {
          ...subjectMeta,
          blockIndex,
        },
      });
    } else if (isBlockCompleted(subject, blockIndex)) {
      canSubmitBlock = denyDecision({
        code: StudentAccessPolicyReasonCodes.BLOCK_ALREADY_COMPLETED,
        message: 'Block already completed!',
        resolutionType: 'choose_next_block',
        resolutionLabel: 'Choose the next available block instead.',
        meta: {
          ...subjectMeta,
          blockIndex,
        },
      });
    } else if (subject.require_timer && !subjectTimer) {
      canSubmitBlock = denyDecision({
        code: StudentAccessPolicyReasonCodes.TIMER_REQUIRED,
        message: 'Finish this block timer before submitting.',
        resolutionType: 'start_timer',
        resolutionLabel: 'Start and finish the timer for this block before submitting it.',
        meta: {
          ...subjectMeta,
          blockIndex,
        },
      });
    } else if (subject.require_timer && subjectTimer?.blockIndex !== blockIndex) {
      canSubmitBlock = denyDecision({
        code: StudentAccessPolicyReasonCodes.TIMER_ASSIGNED_TO_OTHER_BLOCK,
        message: 'Finish this block timer before submitting.',
        resolutionType: 'complete_active_block',
        resolutionLabel: 'Finish or reset the timer on the active block before switching blocks.',
        meta: {
          ...subjectMeta,
          blockIndex,
          timerBlockIndex: subjectTimer?.blockIndex ?? null,
        },
      });
    } else if (subject.require_timer && subjectTimer?.remainingTime > 0) {
      canSubmitBlock = denyDecision({
        code: StudentAccessPolicyReasonCodes.TIMER_IN_PROGRESS,
        message: 'Finish this block timer before submitting.',
        resolutionType: 'finish_timer',
        resolutionLabel: 'Let the timer finish before submitting this block.',
        meta: {
          ...subjectMeta,
          blockIndex,
          remainingTime: subjectTimer.remainingTime,
        },
      });
    }

    return {
      canViewSubjects: baseAccess,
      subjectAvailability,
      canStartTimer,
      canSubmitBlock,
    };
  }, [
    activeTimers,
    completedBlocks,
    getNextAvailableBlock,
    isBlockCompleted,
    isSubmissionLocked,
    portalAccess.canViewSubjects,
    student?.id,
  ]);

  return {
    portalAccess,
    getNextAvailableBlock,
    getSubjectPolicy,
  };
};

export default useStudentAccessPolicy;
