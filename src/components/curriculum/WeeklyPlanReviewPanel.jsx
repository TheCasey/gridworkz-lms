import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  FilePenLine,
  RefreshCw,
  Save,
  Send,
} from 'lucide-react';
import useWeeklyPlanRecord from '../../hooks/useWeeklyPlanRecord';
import { WeeklyPlanStatuses } from '../../constants/schema';
import {
  formatWeekRange,
  getWeekLabel,
  getWeekPickerOptions,
  getWeekRangeByOffset,
} from '../../utils/weekUtils';

const STATUS_TONES = {
  preview: {
    label: 'Preview Only',
    accent: '#cbb7fb',
    surface: 'rgba(203, 183, 251, 0.1)',
    text: 'rgba(238, 234, 248, 0.76)',
  },
  published: {
    label: 'Published',
    accent: '#34d399',
    surface: 'rgba(52, 211, 153, 0.1)',
    text: 'rgba(211, 255, 232, 0.84)',
  },
  archived: {
    label: 'Archived',
    accent: '#8f8aaa',
    surface: 'rgba(238, 234, 248, 0.06)',
    text: 'rgba(238, 234, 248, 0.56)',
  },
  draft: {
    label: 'Draft Saved',
    accent: '#60a5fa',
    surface: 'rgba(96, 165, 250, 0.1)',
    text: 'rgba(219, 234, 254, 0.84)',
  },
  warning: {
    accent: '#f59e0b',
    surface: 'rgba(245, 158, 11, 0.1)',
    text: 'rgba(254, 243, 199, 0.86)',
  },
  error: {
    accent: '#f87171',
    surface: 'rgba(248, 113, 113, 0.1)',
    text: 'rgba(254, 226, 226, 0.9)',
  },
};

const clonePlanValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(clonePlanValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, clonePlanValue(nestedValue)])
    );
  }

  return value;
};

const clonePlanBlocks = (blocks) => clonePlanValue(Array.isArray(blocks) ? blocks : []);

const normalizeEditableBlocks = (blocks) => clonePlanBlocks(blocks).map((block, index) => ({
  ...block,
  title: typeof block?.title === 'string' && block.title.trim().length > 0
    ? block.title.trim()
    : (block?.legacy_subject_title || `Block ${index + 1}`),
  instruction: typeof block?.instruction === 'string' ? block.instruction.trim() : '',
}));

const formatPlanTimestamp = (value) => {
  if (!value) {
    return null;
  }

  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const buildStatusMeta = ({ weeklyPlan, hasUnsavedEdits }) => {
  if (!weeklyPlan) {
    return {
      ...STATUS_TONES.preview,
      detail: hasUnsavedEdits
        ? 'Local edits are ready to save or publish.'
        : 'Generated from current subject assignments but not saved yet.',
    };
  }

  if (weeklyPlan.status === WeeklyPlanStatuses.PUBLISHED) {
    return {
      ...STATUS_TONES.published,
      label: hasUnsavedEdits ? 'Published + Local Edits' : STATUS_TONES.published.label,
      detail: hasUnsavedEdits
        ? 'Unpublished local edits can be re-published.'
        : 'This student-week already has a published weekly plan.',
    };
  }

  if (weeklyPlan.status === WeeklyPlanStatuses.ARCHIVED) {
    return {
      ...STATUS_TONES.archived,
      detail: 'Archived weekly plans are read-only in this phase.',
    };
  }

  return {
    ...STATUS_TONES.draft,
    label: hasUnsavedEdits ? 'Draft + Local Edits' : STATUS_TONES.draft.label,
    detail: hasUnsavedEdits
      ? 'Draft changes are local until you save or publish them.'
      : 'This student-week has a saved draft plan.',
  };
};

const getSubjectIdForBlock = (block) => (
  typeof block?.legacy_subject_id === 'string' && block.legacy_subject_id.trim().length > 0
    ? block.legacy_subject_id.trim()
    : 'unassigned'
);

const getSubjectTitleForBlock = (block) => (
  typeof block?.legacy_subject_title === 'string' && block.legacy_subject_title.trim().length > 0
    ? block.legacy_subject_title.trim()
    : 'Unassigned'
);

const buildGroupedBlocks = (blocks) => {
  const groups = new Map();

  blocks.forEach((block, index) => {
    const subjectId = getSubjectIdForBlock(block);

    if (!groups.has(subjectId)) {
      groups.set(subjectId, {
        id: subjectId,
        title: getSubjectTitleForBlock(block),
        blocks: [],
        minutes: 0,
      });
    }

    const group = groups.get(subjectId);
    group.blocks.push({ block, index });
    group.minutes += Number(block?.planned_duration_minutes || 0);
  });

  return [...groups.values()];
};

const getBlockAccent = (index) => {
  const accents = ['#cbb7fb', '#34d399', '#60a5fa', '#f59e0b', '#f87171'];
  return accents[index % accents.length];
};

const WeeklyPlanReviewPanel = ({
  activeSubjects = [],
  currentUser = null,
  parentSettings = {},
  students = [],
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [editableBlocks, setEditableBlocks] = useState([]);
  const [expandedSubjectIds, setExpandedSubjectIds] = useState(() => new Set());
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!students.length) {
      setSelectedStudentId('');
      return;
    }

    setSelectedStudentId((currentValue) => (
      currentValue && students.some((student) => student.id === currentValue)
        ? currentValue
        : students[0].id
    ));
  }, [students]);

  const selectedWeekRange = useMemo(
    () => getWeekRangeByOffset(selectedWeekOffset, parentSettings),
    [
      parentSettings?.week_reset_day,
      parentSettings?.week_reset_hour,
      parentSettings?.week_reset_minute,
      selectedWeekOffset,
    ]
  );
  const weekPickerOptions = useMemo(
    () => getWeekPickerOptions(parentSettings),
    [
      parentSettings?.week_reset_day,
      parentSettings?.week_reset_hour,
      parentSettings?.week_reset_minute,
    ]
  );
  const {
    buildDraftPreview,
    error,
    loading,
    publishWeeklyPlan,
    publishingPlan,
    saveDraftWeeklyPlan,
    savingPlan,
    weeklyPlan,
  } = useWeeklyPlanRecord({
    currentUser,
    studentId: selectedStudentId,
    subjects: activeSubjects,
    parentSettings,
    referenceDate: selectedWeekRange.weekStart,
    enabled: Boolean(currentUser && selectedStudentId),
  });

  const generatedPlanPreview = useMemo(
    () => buildDraftPreview() || null,
    [buildDraftPreview]
  );
  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || null,
    [selectedStudentId, students]
  );
  const sourcePlan = weeklyPlan || generatedPlanPreview;
  const planStatusMeta = useMemo(
    () => buildStatusMeta({ weeklyPlan, hasUnsavedEdits }),
    [hasUnsavedEdits, weeklyPlan]
  );
  const groupedBlocks = useMemo(() => buildGroupedBlocks(editableBlocks), [editableBlocks]);
  const planSubjectCount = groupedBlocks.length;
  const totalMinutes = editableBlocks.reduce(
    (total, block) => total + Number(block?.planned_duration_minutes || 0),
    0
  );
  const planUpdatedAt = formatPlanTimestamp(weeklyPlan?.updated_at);
  const planPublishedAt = formatPlanTimestamp(weeklyPlan?.published_at);
  const planRequiresAttention = Boolean(hasUnsavedEdits || !weeklyPlan);
  const isArchived = weeklyPlan?.status === WeeklyPlanStatuses.ARCHIVED;
  const isPublished = weeklyPlan?.status === WeeklyPlanStatuses.PUBLISHED;
  const saveButtonLabel = isPublished ? 'Save as Draft' : 'Save Draft';
  const publishButtonLabel = isPublished ? 'Publish Updates' : 'Publish Week';
  const blocksAreEditable = Boolean(sourcePlan) && !isArchived;

  useEffect(() => {
    setHasUnsavedEdits(false);
    setFeedback(null);
  }, [selectedStudentId, selectedWeekOffset]);

  useEffect(() => {
    if (!sourcePlan) {
      if (!hasUnsavedEdits) {
        setEditableBlocks([]);
      }
      return;
    }

    if (hasUnsavedEdits) {
      return;
    }

    setEditableBlocks(clonePlanBlocks(sourcePlan.blocks));
  }, [hasUnsavedEdits, sourcePlan]);

  useEffect(() => {
    setExpandedSubjectIds((currentValue) => {
      const nextValue = new Set(currentValue);

      groupedBlocks.slice(0, 2).forEach((group) => {
        nextValue.add(group.id);
      });

      return nextValue;
    });
  }, [groupedBlocks]);

  const handleBlockFieldChange = (blockId, field, value) => {
    setEditableBlocks((currentBlocks) => currentBlocks.map((block) => (
      block.id === blockId
        ? { ...block, [field]: value }
        : block
    )));
    setHasUnsavedEdits(true);
    setFeedback(null);
  };

  const handleRefreshFromSubjects = () => {
    const refreshedPlan = buildDraftPreview({ existingPlan: weeklyPlan });

    if (!refreshedPlan) {
      return;
    }

    setEditableBlocks(clonePlanBlocks(refreshedPlan.blocks));
    setHasUnsavedEdits(true);
    setFeedback({
      tone: 'info',
      text: 'Preview refreshed from the current subject editor. Save draft or publish to keep the regenerated plan.',
    });
  };

  const toggleSubjectGroup = (subjectId) => {
    setExpandedSubjectIds((currentValue) => {
      const nextValue = new Set(currentValue);

      if (nextValue.has(subjectId)) {
        nextValue.delete(subjectId);
      } else {
        nextValue.add(subjectId);
      }

      return nextValue;
    });
  };

  const handleSaveDraft = async () => {
    const savedPlan = await saveDraftWeeklyPlan({
      overwritePublished: isPublished,
      planOverrides: {
        blocks: normalizeEditableBlocks(editableBlocks),
      },
    });

    if (!savedPlan) {
      return;
    }

    setHasUnsavedEdits(false);
    setFeedback({
      tone: 'success',
      text: isPublished
        ? 'Published week moved back to draft with your edits.'
        : 'Weekly plan draft saved.',
    });
  };

  const handlePublish = async () => {
    const publishedPlan = await publishWeeklyPlan({
      planOverrides: {
        blocks: normalizeEditableBlocks(editableBlocks),
      },
    });

    if (!publishedPlan) {
      return;
    }

    setHasUnsavedEdits(false);
    setFeedback({
      tone: 'success',
      text: isPublished
        ? 'Published weekly plan updated.'
        : 'Weekly plan published for this student-week.',
    });
  };

  const renderMessage = () => {
    const message = error
      ? {
          tone: 'error',
          text: error.message || 'Unable to load or save the weekly plan.',
        }
      : feedback;

    if (!message) {
      return null;
    }

    const tone = message.tone === 'error'
      ? STATUS_TONES.error
      : message.tone === 'success'
        ? STATUS_TONES.published
        : STATUS_TONES.preview;
    const Icon = message.tone === 'error'
      ? AlertCircle
      : message.tone === 'success'
        ? CheckCircle2
        : FilePenLine;

    return (
      <div
        className="mt-5 flex items-start gap-3 border px-4 py-3"
        style={{
          backgroundColor: tone.surface,
          borderColor: tone.accent,
          color: tone.text,
        }}
      >
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p className="text-[13px] font-body leading-5">{message.text}</p>
      </div>
    );
  };

  return (
    <section className="op-panel p-5 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="op-eyebrow">Weekly Blocking</p>
          <h2 className="mt-3 text-[28px] font-display leading-none text-white">
            Build the student-week before it goes live
          </h2>
          <p className="op-subtle mt-3 text-[13px] font-body leading-6">
            This route uses current per-student subject assignments as the default block source, then saves or publishes the selected student-week.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRefreshFromSubjects}
            disabled={!blocksAreEditable || loading || savingPlan || publishingPlan}
            className="op-button op-button-secondary"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Reset to Default
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={!blocksAreEditable || !editableBlocks.length || loading || savingPlan || publishingPlan}
            className="op-button op-button-secondary"
          >
            <Save className="h-4 w-4" />
            {savingPlan ? 'Saving...' : saveButtonLabel}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!blocksAreEditable || !editableBlocks.length || loading || savingPlan || publishingPlan}
            className="op-button"
          >
            <Send className="h-4 w-4" />
            {publishingPlan ? 'Publishing...' : publishButtonLabel}
          </button>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="op-surface mt-5 px-5 py-4">
          <p className="op-subtle text-[14px] font-body">
            Add a student before planning a weekly block schedule.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_1.05fr_0.9fr]">
            <div className="op-surface px-4 py-4">
              <label className="op-eyebrow mb-2 block">Student</label>
              <select
                value={selectedStudentId}
                onChange={(event) => setSelectedStudentId(event.target.value)}
                className="op-input"
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
              <p className="op-subtle mt-2 text-[12px] font-body">
                Planning stays scoped to one student-week.
              </p>
            </div>

            <div className="op-surface px-4 py-4">
              <label className="op-eyebrow mb-2 block">Week</label>
              <select
                value={selectedWeekOffset}
                onChange={(event) => setSelectedWeekOffset(Number.parseInt(event.target.value, 10))}
                className="op-input"
              >
                {weekPickerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.displayText})
                  </option>
                ))}
              </select>
              <p className="op-subtle mt-2 text-[12px] font-body">
                {formatWeekRange(selectedWeekRange.weekStart, selectedWeekRange.weekEnd)}
              </p>
            </div>

            <div
              className="border border-l-[3px] px-4 py-4"
              style={{
                backgroundColor: planStatusMeta.surface,
                borderColor: 'rgba(238, 234, 248, 0.14)',
                borderLeftColor: planStatusMeta.accent,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="op-eyebrow" style={{ color: planStatusMeta.accent }}>
                  Status
                </p>
                {planRequiresAttention ? (
                  <span className="op-pill">Needs Review</span>
                ) : null}
              </div>
              <p className="mt-2 text-[18px] font-display text-white">
                {planStatusMeta.label}
              </p>
              <p className="mt-1 text-[12px] font-body leading-5" style={{ color: planStatusMeta.text }}>
                {planStatusMeta.detail}
              </p>
            </div>
          </div>

          {renderMessage()}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="op-stat px-4 py-3">
              <p className="op-eyebrow">Student-Week</p>
              <p className="mt-2 truncate text-[16px] font-display text-white">
                {selectedStudent?.name || 'Select a student'}
              </p>
              <p className="op-subtle mt-1 text-[12px] font-body">
                {getWeekLabel(selectedWeekOffset)}
              </p>
            </div>

            <div className="op-stat px-4 py-3">
              <p className="op-eyebrow">Blocks</p>
              <p className="mt-2 text-[16px] font-display text-white">
                {editableBlocks.length}
              </p>
              <p className="op-subtle mt-1 text-[12px] font-body">
                {planSubjectCount} active subject{planSubjectCount === 1 ? '' : 's'}
              </p>
            </div>

            <div className="op-stat px-4 py-3">
              <p className="op-eyebrow">Study Time</p>
              <p className="mt-2 text-[16px] font-display text-white">
                {totalMinutes ? `${(totalMinutes / 60).toFixed(1)}h` : '0h'}
              </p>
              <p className="op-subtle mt-1 text-[12px] font-body">
                Estimated from block durations.
              </p>
            </div>

            <div className="op-stat px-4 py-3">
              <p className="op-eyebrow">Published</p>
              <p className="mt-2 truncate text-[16px] font-display text-white">
                {planPublishedAt || 'Not published'}
              </p>
              <p className="op-subtle mt-1 text-[12px] font-body">
                Last save: {planUpdatedAt || 'none'}
              </p>
            </div>
          </div>

          <div
            className="mt-5 flex items-start gap-3 border border-l-[3px] px-4 py-3"
            style={{
              backgroundColor: STATUS_TONES.preview.surface,
              borderColor: 'rgba(238, 234, 248, 0.14)',
              borderLeftColor: STATUS_TONES.preview.accent,
            }}
          >
            <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#cbb7fb]" />
            <p className="op-subtle text-[13px] font-body leading-5">
              Subject records remain the compatibility input path. After changing subjects, reset to default here before saving or publishing this week.
            </p>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="op-eyebrow">Assignment Rows</p>
                <h3 className="mt-2 text-[24px] font-display leading-none text-white">
                  Weekly blocks
                </h3>
              </div>
              {loading ? (
                <div className="op-pill">Loading</div>
              ) : null}
            </div>

            {!editableBlocks.length ? (
              <div className="op-surface px-5 py-5">
                <p className="text-[14px] font-body text-white">
                  No active subject blocks are available for this student-week yet.
                </p>
                <p className="op-subtle mt-1 text-[13px] font-body">
                  Assign at least one active subject, then reset the weekly preview.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {groupedBlocks.map((group, groupIndex) => {
                  const isOpen = expandedSubjectIds.has(group.id);
                  const accent = getBlockAccent(groupIndex);

                  return (
                    <article
                      key={group.id}
                      className="border border-l-[3px]"
                      style={{
                        backgroundColor: '#202034',
                        borderColor: 'rgba(238, 234, 248, 0.12)',
                        borderLeftColor: accent,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSubjectGroup(group.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[rgba(238,234,248,0.04)]"
                      >
                        <span className="h-2.5 w-2.5 flex-shrink-0" style={{ backgroundColor: accent }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-label text-white">
                            {group.title}
                          </span>
                          <span className="op-subtle mt-1 block text-[12px] font-body">
                            {group.blocks.length} block{group.blocks.length === 1 ? '' : 's'} · {group.minutes} min
                          </span>
                        </span>
                        <span className="op-pill">{group.blocks.length}</span>
                        <ChevronDown className={`h-4 w-4 text-[rgba(238,234,248,0.5)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isOpen ? (
                        <div className="space-y-3 border-t border-[rgba(238,234,248,0.1)] px-4 py-4">
                          {group.blocks.map(({ block, index }) => (
                            <div key={block.id} className="op-surface p-4">
                              <div className="mb-3 flex flex-wrap items-center gap-2">
                                <span className="op-pill">
                                  Block {Number.isInteger(block.legacy_block_index) ? block.legacy_block_index + 1 : index + 1}
                                </span>
                                <span className="op-pill">{block.planned_duration_minutes || 0} min</span>
                                <span className="op-pill">{block.completion_mode || 'time_boxed'}</span>
                              </div>

                              <div className="grid gap-3 lg:grid-cols-[1fr_1.35fr]">
                                <div>
                                  <label className="op-eyebrow mb-2 block">Block Title</label>
                                  <input
                                    type="text"
                                    value={block.title || ''}
                                    onChange={(event) => handleBlockFieldChange(block.id, 'title', event.target.value)}
                                    disabled={!blocksAreEditable}
                                    className="op-input disabled:cursor-not-allowed disabled:opacity-60"
                                    placeholder={block.legacy_subject_title || `Block ${index + 1}`}
                                  />
                                </div>

                                <div>
                                  <label className="op-eyebrow mb-2 block">Instruction</label>
                                  <textarea
                                    value={block.instruction || ''}
                                    onChange={(event) => handleBlockFieldChange(block.id, 'instruction', event.target.value)}
                                    disabled={!blocksAreEditable}
                                    rows={3}
                                    className="op-input resize-none disabled:cursor-not-allowed disabled:opacity-60"
                                    placeholder="Add a student-facing note only when this week needs one."
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default WeeklyPlanReviewPanel;
