import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { formatRemainingTime } from '../../utils/timerUtils';

const buildSchoolGroups = ({ hasPublishedWeeklyPlan, publishedWorkItems, subjects }) => {
  if (!hasPublishedWeeklyPlan) {
    return subjects.map((subject) => ({
      id: subject.id,
      title: subject.title || 'Untitled subject',
      subject,
      items: Array.from({ length: subject.block_count || 0 }, (_, blockIndex) => ({
        id: `${subject.id}_${blockIndex}`,
        blockIndex,
        title: subject.block_objectives?.[blockIndex]?.title || `Block ${blockIndex + 1}`,
        instruction: subject.block_objectives?.[blockIndex]?.instruction || '',
        resources: subject.resources || [],
        customFields: subject.block_objectives?.[blockIndex]?.custom_fields || subject.custom_fields || [],
        duration: subject.block_length || 30,
        requireTimer: Boolean(subject.require_timer),
        subject,
        workItem: null,
      })),
    }));
  }

  const groups = new Map();
  publishedWorkItems.forEach((workItem) => {
    const subject = workItem.compatibilitySubject;
    if (!subject?.id) return;
    if (!groups.has(subject.id)) {
      groups.set(subject.id, {
        id: subject.id,
        title: workItem.legacySubjectTitle || subject.legacy_subject_title || subject.title || 'Untitled subject',
        subject,
        items: [],
      });
    }
    groups.get(subject.id).items.push({
      id: workItem.id,
      blockIndex: workItem.compatibilityBlockIndex,
      title: workItem.title || `Block ${workItem.compatibilityBlockIndex + 1}`,
      instruction: workItem.instruction || '',
      resources: workItem.resources || [],
      customFields: workItem.customFields || [],
      duration: workItem.plannedDurationMinutes || subject.block_length || 30,
      requireTimer: Boolean(workItem.requireTimer),
      subject,
      workItem,
    });
  });
  return [...groups.values()];
};

const StudentSchoolWorkspace = ({
  student,
  hasPublishedWeeklyPlan,
  publishedWorkItems,
  subjects,
  portalAccess,
  totalCompletedBlocks,
  totalBlocks,
  weeklyPct,
  error,
  activeTimers,
  expandedSubjectId,
  expandedBlockIndex,
  submitting,
  currentWorkGuidance,
  isBlockCompleted,
  isSubmissionLocked,
  getSubjectPolicy,
  getWorkItemPolicy,
  getEffectiveInstruction,
  getEffectiveCustomFields,
  onToggleSubject,
  onSelectBlock,
  onSelectWorkItem,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  onCompleteSubject,
  onCompleteWorkItem,
}) => {
  const hasRunningTimer = useMemo(() => Object.values(activeTimers).some((timer) => (
    timer?.isRunning && !timer?.pausedAt && timer?.remainingTime > 0
  )), [activeTimers]);
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hasRunningTimer) return undefined;
    setClockNow(Date.now());
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [hasRunningTimer]);

  const displayTimers = useMemo(() => Object.fromEntries(
    Object.entries(activeTimers).map(([subjectId, timer]) => [
      subjectId,
      timer?.isRunning && !timer?.pausedAt
        ? { ...timer, remainingTime: Math.max(0, timer.targetEndTime - clockNow) }
        : timer,
    ])
  ), [activeTimers, clockNow]);

  const groups = useMemo(() => buildSchoolGroups({
    hasPublishedWeeklyPlan,
    publishedWorkItems,
    subjects,
  }), [hasPublishedWeeklyPlan, publishedWorkItems, subjects]);

  const selectedGroup = groups.find((group) => group.id === expandedSubjectId) || null;
  const selectedItem = selectedGroup?.items.find((item) => item.blockIndex === expandedBlockIndex) || null;
  const selectedSubject = selectedItem?.subject || selectedGroup?.subject || null;
  const selectedTimer = selectedSubject ? displayTimers[selectedSubject.id] : null;
  const timerMatchesSelection = Boolean(selectedTimer && selectedTimer.blockIndex === selectedItem?.blockIndex);
  const timerOnOtherBlock = Boolean(selectedTimer && !timerMatchesSelection);
  const selectedPolicy = selectedItem
    ? (selectedItem.workItem ? getWorkItemPolicy(selectedItem.workItem) : getSubjectPolicy(selectedSubject, { blockIndex: selectedItem.blockIndex }))
    : null;
  const timerPolicy = timerMatchesSelection
    ? (selectedItem.workItem
      ? getWorkItemPolicy(selectedItem.workItem, { blockIndex: selectedTimer.blockIndex })
      : getSubjectPolicy(selectedSubject, { blockIndex: selectedTimer.blockIndex }))
    : null;
  const selectedCompleted = selectedItem ? isBlockCompleted(selectedSubject, selectedItem.blockIndex) : false;
  const selectedInstruction = selectedItem
    ? (selectedItem.instruction || getEffectiveInstruction(selectedSubject, selectedItem.blockIndex))
    : '';
  const selectedFields = selectedItem
    ? (selectedItem.customFields.length > 0 ? selectedItem.customFields : getEffectiveCustomFields(selectedSubject, selectedItem.blockIndex))
    : [];
  const canStartTimer = Boolean(
    selectedItem
    && !selectedCompleted
    && !timerOnOtherBlock
    && (selectedItem.workItem
      ? (selectedItem.workItem.launch_state?.can_start ?? selectedPolicy?.canStartTimer?.allowed)
      : selectedPolicy?.canStartTimer?.allowed)
  );
  const canSubmit = Boolean(selectedPolicy?.canSubmitBlock?.allowed);

  const selectItem = (group, item) => {
    if (item.workItem) onSelectWorkItem(item.workItem);
    else onSelectBlock(group.subject, item.blockIndex);
  };

  const completeSelected = () => {
    if (!selectedItem) return;
    if (selectedItem.workItem) onCompleteWorkItem(selectedItem.workItem);
    else onCompleteSubject(selectedSubject);
  };

  return (
    <div className="student-workspace-layout" data-testid="student-school-workspace">
      <section className="student-workspace-main">
        <header className="student-page-heading">
          <div>
            <h1>This week&apos;s school</h1>
            <p>{hasPublishedWeeklyPlan ? 'Published weekly plan' : 'Current subject plan'} · Choose any available block in any order</p>
          </div>
          <span className="student-status-chip">Current week</span>
        </header>

        {error ? <div className="student-error" role="alert">{error}</div> : null}

        <div className="student-week-summary">
          <div><strong>{totalCompletedBlocks} / {totalBlocks}</strong><span>blocks complete</span></div>
          <div><strong>{groups.length}</strong><span>subjects this week</span></div>
          <div><strong>{weeklyPct}%</strong><span>weekly progress</span></div>
        </div>

        {!portalAccess.canViewSubjects.allowed || groups.length === 0 ? (
          <div className="student-empty-state">
            <BookOpen />
            <h2>{hasPublishedWeeklyPlan ? 'No blocks available' : 'No subjects available'}</h2>
            <p>{portalAccess.canViewSubjects.allowed
              ? (hasPublishedWeeklyPlan ? 'This published week does not contain any live blocks yet.' : 'Your parent needs to set up your subjects first.')
              : portalAccess.canViewSubjects.blockedReason?.message}</p>
          </div>
        ) : (
          <div className="student-subject-list">
            {groups.map((group) => {
              const isOpen = expandedSubjectId === group.id;
              const completedCount = group.items.filter((item) => isBlockCompleted(item.subject, item.blockIndex)).length;
              const timer = displayTimers[group.id];
              return (
                <article key={group.id} className={`student-subject-row ${isOpen ? 'is-open' : ''}`}>
                  <button className="student-subject-toggle" type="button" onClick={() => onToggleSubject(group.id)} aria-expanded={isOpen}>
                    <span className="student-subject-icon"><BookOpen /></span>
                    <span className="student-subject-copy"><strong>{group.title}</strong><small>{completedCount} of {group.items.length} blocks complete</small></span>
                    {timer ? <span className="student-active-label">Timer · Block {timer.blockIndex + 1}</span> : null}
                    {isOpen ? <ChevronDown /> : <ChevronRight />}
                  </button>

                  {isOpen ? (
                    <div className="student-block-picker" aria-label={`${group.title} weekly blocks`}>
                      {group.items.map((item, index) => {
                        const completed = isBlockCompleted(item.subject, item.blockIndex);
                        const policy = item.workItem ? getWorkItemPolicy(item.workItem) : getSubjectPolicy(item.subject, { blockIndex: item.blockIndex });
                        const locked = !completed && !policy.subjectAvailability.allowed;
                        const selected = expandedBlockIndex === item.blockIndex;
                        const blockedByTimer = Boolean(timer && timer.blockIndex !== item.blockIndex);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`student-block-chip ${completed ? 'is-complete' : ''} ${selected ? 'is-selected' : ''}`}
                            onClick={() => selectItem(group, item)}
                            disabled={completed || locked || blockedByTimer || isSubmissionLocked(item.subject.id, item.blockIndex)}
                            title={item.title}
                          >
                            {completed ? <Check /> : index + 1}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {isOpen && selectedItem && selectedGroup?.id === group.id ? (
                    <div className="student-inline-block">
                      <div className="student-block-card">
                        <div className="student-block-copy">
                          <p className="student-eyebrow">{group.title} · Block {group.items.findIndex((item) => item.id === selectedItem.id) + 1} of {group.items.length}</p>
                          <h2>{selectedItem.title}</h2>
                          <div className="student-block-meta">
                            <span><Clock3 /> {selectedItem.duration} minutes</span>
                            <span>{selectedItem.requireTimer ? 'Timer required' : 'Timer optional'}</span>
                            <span>{selectedFields.length} response{selectedFields.length === 1 ? '' : 's'}</span>
                          </div>
                          {selectedInstruction ? <p className="student-block-instruction">{selectedInstruction}</p> : null}
                        </div>

                        <div className="student-timer-panel">
                          <span>Block timer</span>
                          <strong>{timerMatchesSelection ? formatRemainingTime(selectedTimer.remainingTime) : `${String(selectedItem.duration).padStart(2, '0')}:00`}</strong>
                          <div>
                            {!timerMatchesSelection ? (
                              <button type="button" className="student-button is-primary" disabled={!canStartTimer} onClick={() => onStartTimer(selectedSubject, selectedItem.blockIndex)}><Play /> Start</button>
                            ) : selectedTimer.remainingTime > 0 ? (
                              <>
                                <button type="button" className="student-button is-primary" onClick={() => selectedTimer.isRunning ? onPauseTimer(selectedSubject) : onResumeTimer(selectedSubject)}>{selectedTimer.isRunning ? <Pause /> : <Play />}{selectedTimer.isRunning ? 'Pause' : 'Resume'}</button>
                                <button type="button" className="student-button is-icon" onClick={() => onResetTimer(selectedSubject)} aria-label="Reset timer"><RotateCcw /></button>
                              </>
                            ) : (
                              <>
                                <button type="button" className="student-button is-success" disabled={!timerPolicy?.canSubmitBlock?.allowed || submitting} onClick={completeSelected}>Complete</button>
                                <button type="button" className="student-button is-icon" onClick={() => onResetTimer(selectedSubject)} aria-label="Reset timer"><RotateCcw /></button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {timerOnOtherBlock ? <p className="student-inline-notice">Finish or reset the timer on Block {selectedTimer.blockIndex + 1} before switching.</p> : null}

                      <div className="student-block-actions">
                        {selectedItem.resources.map((resource, index) => resource.url ? (
                          <a key={`${resource.url}_${index}`} className="student-button" href={resource.url} target="_blank" rel="noreferrer"><ExternalLink />{resource.name || 'Open resource'}</a>
                        ) : (
                          <span key={`${resource.name}_${index}`} className="student-resource-label"><BookOpen />{resource.name}</span>
                        ))}
                        {!selectedItem.requireTimer ? <button type="button" className="student-button is-success" disabled={!canSubmit || selectedCompleted || timerOnOtherBlock || submitting} onClick={completeSelected}>Complete block</button> : null}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <aside className="student-workspace-rail">
        <div className="student-rail-section">
          <p className="student-eyebrow">This week</p>
          <strong className="student-rail-big">{totalCompletedBlocks} / {totalBlocks}</strong>
          <span className="student-muted">school blocks complete</span>
          <div className="student-progress"><span style={{ width: `${weeklyPct}%` }} /></div>
        </div>
        <div className="student-rail-section">
          <p className="student-eyebrow">Choose your path</p>
          <p className="student-rail-copy">Complete blocks in any order. Finish several from one subject today or spread them across the week.</p>
        </div>
        <div className="student-rail-section">
          <p className="student-eyebrow">Current work</p>
          <strong className="student-rail-title">{currentWorkGuidance.title}</strong>
          <p className="student-rail-copy">{currentWorkGuidance.copy}</p>
        </div>
        <div className="student-rail-section">
          <p className="student-eyebrow">Student</p>
          <p className="student-rail-copy">{student.name}</p>
        </div>
      </aside>
    </div>
  );
};

export default StudentSchoolWorkspace;
