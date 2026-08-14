import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FilePenLine,
  RefreshCw,
  Save,
  Send,
  Star,
} from 'lucide-react';
import useWeeklyPlanRecord from '../../hooks/useWeeklyPlanRecord';
import { WeeklyPlanStatuses } from '../../constants/schema';
import {
  formatWeekRange,
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

const getConfiguredFieldCount = (fields) => (
  Array.isArray(fields)
    ? fields.filter((field) => typeof field?.label === 'string' && field.label.trim().length > 0).length
    : 0
);

const getSubjectStudentIds = (subject) => (
  Array.isArray(subject?.student_ids) && subject.student_ids.length > 0
    ? subject.student_ids
    : [subject?.student_id].filter(Boolean)
);

const getStudentSubjects = (subjects, studentId) => (
  (Array.isArray(subjects) ? subjects : []).filter((subject) => getSubjectStudentIds(subject).includes(studentId))
);

const getStudentDefaultHours = (subjects, studentId) => (
  getStudentSubjects(subjects, studentId).reduce((minutes, subject) => (
    minutes + Number(subject?.block_count || 10) * Number(subject?.block_length || 30)
  ), 0) / 60
);

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
  const subjectsById = useMemo(
    () => Object.fromEntries((Array.isArray(activeSubjects) ? activeSubjects : []).map((subject) => [subject.id, subject])),
    [activeSubjects]
  );
  const selectedWeekOption = useMemo(
    () => weekPickerOptions.find((option) => option.value === selectedWeekOffset) || null,
    [selectedWeekOffset, weekPickerOptions]
  );
  const visibleWeekOptions = useMemo(() => {
    if (weekPickerOptions.length <= 5) {
      return weekPickerOptions;
    }

    const selectedIndex = Math.max(0, weekPickerOptions.findIndex((option) => option.value === selectedWeekOffset));
    const startIndex = Math.max(0, Math.min(selectedIndex - 2, weekPickerOptions.length - 5));
    return weekPickerOptions.slice(startIndex, startIndex + 5);
  }, [selectedWeekOffset, weekPickerOptions]);
  const totalMinutes = editableBlocks.reduce(
    (total, block) => total + Number(block?.planned_duration_minutes || 0),
    0
  );
  const planUpdatedAt = formatPlanTimestamp(weeklyPlan?.updated_at);
  const planPublishedAt = formatPlanTimestamp(weeklyPlan?.published_at);
  const isArchived = weeklyPlan?.status === WeeklyPlanStatuses.ARCHIVED;
  const isPublished = weeklyPlan?.status === WeeklyPlanStatuses.PUBLISHED;
  const isPersistedPlan = Boolean(weeklyPlan);
  const saveButtonLabel = isPublished ? 'Save as Draft' : 'Save Draft';
  const publishButtonLabel = isPublished ? 'Publish Updates' : 'Publish Week';
  const blocksAreEditable = Boolean(sourcePlan) && !isArchived;
  const hasSubjectCountVariance = groupedBlocks.some((group) => {
    const subject = subjectsById[group.id];
    const target = Number(subject?.block_count || group.blocks.length);
    return group.blocks.length !== target;
  });

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
    <section className="op-weekly-proto">
      <div className="op-proto-topbar">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-label text-white">Weekly Blocking</p>
          <p className="mt-1 truncate text-[10px] text-[rgba(238,234,248,0.42)]">
            {selectedStudent?.name || 'Select a student'} · {selectedWeekOption?.displayText || formatWeekRange(selectedWeekRange.weekStart, selectedWeekRange.weekEnd)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={handleRefreshFromSubjects}
            disabled={!blocksAreEditable || loading || savingPlan || publishingPlan}
            className="op-proto-btn"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={!blocksAreEditable || !editableBlocks.length || loading || savingPlan || publishingPlan}
            className="op-proto-btn"
          >
            <Save className="h-3.5 w-3.5" />
            {savingPlan ? 'Saving...' : saveButtonLabel}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!blocksAreEditable || !editableBlocks.length || loading || savingPlan || publishingPlan}
            className="op-proto-btn op-proto-btn-primary"
          >
            <Send className="h-3.5 w-3.5" />
            {publishingPlan ? 'Publishing...' : publishButtonLabel}
          </button>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="op-proto-empty">
          <CalendarDays className="mx-auto h-9 w-9 text-[#b8adff]" />
          <h3 className="mt-4 text-[18px] font-label text-white">No students available</h3>
          <p className="mt-2 text-[12px] text-[rgba(238,234,248,0.54)]">Add a student before planning a weekly block schedule.</p>
        </div>
      ) : (
        <>
          <div className="op-weekly-controls">
            <div className="op-weekly-student-tabs">
              {students.map((student) => {
                const isActive = student.id === selectedStudentId;
                const defaultHours = getStudentDefaultHours(activeSubjects, student.id);

                return (
                  <button
                    type="button"
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`op-proto-tab ${isActive ? 'is-active' : ''}`}
                  >
                    <span className="op-proto-tab-name">{student.name}</span>
                    <span className="op-proto-tab-meta">~{defaultHours.toFixed(1)}h default</span>
                  </button>
                );
              })}
            </div>

            <div className="op-weekly-week-nav">
              <button
                type="button"
                onClick={() => setSelectedWeekOffset((value) => Math.max(-12, value - 1))}
                className="op-weekly-nav-btn"
                title="Previous week"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className="op-weekly-week-chips">
                {visibleWeekOptions.map((option) => {
                  const isActive = option.value === selectedWeekOffset;
                  const isModified = Boolean(weeklyPlan && option.value === selectedWeekOffset);

                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setSelectedWeekOffset(option.value)}
                      className={`op-weekly-chip ${isActive ? 'is-active' : ''} ${option.value === 0 ? 'is-current' : ''} ${isModified ? 'is-modified' : ''}`}
                    >
                      {option.value === 0 ? 'Current' : option.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setSelectedWeekOffset((value) => Math.min(4, value + 1))}
                className="op-weekly-nav-btn"
                title="Next week"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="op-weekly-body">
            <main className="op-weekly-schedule">
              <div
                className={`op-weekly-banner ${isPersistedPlan || hasUnsavedEdits ? 'is-modified' : ''}`}
              >
                <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  {isPersistedPlan
                    ? 'This student-week is saved. Regenerate after Curriculum changes before saving or publishing updates.'
                    : hasUnsavedEdits
                      ? 'This week has local edits. Save or publish to persist them.'
                      : 'Using current subject blocks as the default schedule preview.'}
                </span>
              </div>

              {renderMessage()}

              {!editableBlocks.length ? (
                <div className="op-proto-empty min-h-[280px]">
                  <p className="text-[14px] font-label text-white">No active subject blocks are available.</p>
                  <p className="mt-2 text-[12px] text-[rgba(238,234,248,0.54)]">Assign at least one active subject, then regenerate the weekly preview.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupedBlocks.map((group, groupIndex) => {
                    const isOpen = expandedSubjectIds.has(group.id);
                    const accent = getBlockAccent(groupIndex);
                    const subject = subjectsById[group.id];
                    const target = Number(subject?.block_count || group.blocks.length);
                    const diff = group.blocks.length - target;

                    return (
                      <article
                        key={group.id}
                        className="op-weekly-subject-row"
                        style={{ borderLeftColor: subject?.color || accent }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSubjectGroup(group.id)}
                          className="op-weekly-subject-header"
                        >
                          <span className="h-2 w-2 flex-shrink-0" style={{ backgroundColor: subject?.color || accent }} />
                          <span className="min-w-0 flex-1 truncate text-[12px] font-label text-white">{group.title}</span>
                          <span className="text-[10px] text-[rgba(238,234,248,0.46)]">{subject?.block_length || group.blocks[0]?.block?.planned_duration_minutes || 0}m/block</span>
                          <span
                            className="text-[11px] font-label"
                            style={{ color: diff === 0 ? '#34d399' : '#f59e0b' }}
                          >
                            {group.blocks.length}/{target}
                          </span>
                          {diff !== 0 ? (
                            <span className={`op-weekly-diff ${diff > 0 ? 'is-plus' : 'is-minus'}`}>{diff > 0 ? '+' : ''}{diff}</span>
                          ) : null}
                          <ChevronDown className={`h-3.5 w-3.5 text-[rgba(238,234,248,0.36)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isOpen ? (
                          <div className="op-weekly-subject-body">
                            <div className="op-weekly-pill-row">
                              {group.blocks.map(({ block, index }) => {
                                const fieldCount = getConfiguredFieldCount(block.custom_fields);

                                return (
                                  <div
                                    key={block.id}
                                    className="op-weekly-block-pill"
                                    style={{ borderColor: block.instruction ? `${accent}88` : 'rgba(255,255,255,0.14)' }}
                                  >
                                    <span className={`op-weekly-block-type ${block.instruction ? 'is-guided' : ''}`}>
                                      {block.instruction ? 'OBJ' : 'STD'}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">
                                      {block.title || block.legacy_subject_title || `Block ${index + 1}`}
                                    </span>
                                    <span className="text-[9px] text-[rgba(238,234,248,0.38)]">
                                      {block.planned_duration_minutes || 0}m
                                    </span>
                                    {fieldCount > 0 ? (
                                      <span className="op-weekly-field-count">{fieldCount}</span>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="grid gap-2 pt-2">
                              {group.blocks.map(({ block, index }) => (
                                <div key={`${block.id}_edit`} className="op-weekly-edit-row">
                                  <span className="op-weekly-edit-index">
                                    {Number.isInteger(block.legacy_block_index) ? block.legacy_block_index + 1 : index + 1}
                                  </span>
                                  <input
                                    type="text"
                                    value={block.title || ''}
                                    onChange={(event) => handleBlockFieldChange(block.id, 'title', event.target.value)}
                                    disabled={!blocksAreEditable}
                                    className="op-weekly-inline-input"
                                    placeholder={block.legacy_subject_title || `Block ${index + 1}`}
                                  />
                                  <input
                                    type="text"
                                    value={block.instruction || ''}
                                    onChange={(event) => handleBlockFieldChange(block.id, 'instruction', event.target.value)}
                                    disabled={!blocksAreEditable}
                                    className="op-weekly-inline-input"
                                    placeholder="Student-facing note"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </main>

            <aside className="op-weekly-summary">
              <div className="op-weekly-summary-header">This week</div>
              <div className="op-weekly-summary-body">
                <div className="op-proto-tray-stat">
                  <span>{editableBlocks.length}</span>
                  <p>blocks this week</p>
                </div>
                <div className="op-proto-tray-stat">
                  <span>~{(totalMinutes / 60).toFixed(1)}h</span>
                  <p>estimated study time</p>
                </div>
                <div className="h-px bg-[rgba(255,255,255,0.08)]" />
                <div className="space-y-1.5">
                  {groupedBlocks.map((group, index) => {
                    const subject = subjectsById[group.id];
                    const target = Number(subject?.block_count || group.blocks.length);
                    const diff = group.blocks.length - target;

                    return (
                      <div key={group.id} className="op-weekly-summary-subject">
                        <span className="h-1.5 w-1.5 flex-shrink-0" style={{ backgroundColor: subject?.color || getBlockAccent(index) }} />
                        <span className="min-w-0 flex-1 truncate">{group.title}</span>
                        <span className="font-label text-[rgba(238,234,248,0.8)]">{group.blocks.length}</span>
                        {diff !== 0 ? (
                          <span style={{ color: diff > 0 ? '#f87171' : '#f59e0b' }}>{diff > 0 ? '+' : ''}{diff}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div
                  className="border-l-2 px-2 py-1.5 text-[9px] leading-4"
                  style={{
                    backgroundColor: hasSubjectCountVariance ? 'rgba(245,158,11,0.1)' : planStatusMeta.surface,
                    borderLeftColor: hasSubjectCountVariance ? '#f59e0b' : planStatusMeta.accent,
                    color: hasSubjectCountVariance ? '#f59e0b' : planStatusMeta.text,
                  }}
                >
                  {hasSubjectCountVariance
                    ? 'Some subjects differ from their current weekly target.'
                    : `${planStatusMeta.label}: ${planStatusMeta.detail}`}
                </div>
                <div className="text-[9px] leading-4 text-[rgba(238,234,248,0.42)]">
                  Published: {planPublishedAt || 'Not published'}<br />
                  Last save: {planUpdatedAt || 'none'}
                </div>
              </div>
              <div className="op-weekly-summary-actions">
                <button type="button" className="op-proto-btn w-full" disabled>
                  <Copy className="h-3.5 w-3.5" />
                  Copy to another week
                </button>
                <button type="button" className="op-proto-btn w-full" disabled>
                  <Star className="h-3.5 w-3.5" />
                  Save as default week
                </button>
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
};

export default WeeklyPlanReviewPanel;
