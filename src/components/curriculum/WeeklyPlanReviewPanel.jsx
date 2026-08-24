import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  doc,
  getFirestore,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
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
import { app } from '../../firebase/firebaseConfig';
import useWeeklyPlanRecord from '../../hooks/useWeeklyPlanRecord';
import {
  WeeklyBlockCategories,
  WeeklyBlockCompletionModes,
  WeeklyPlanStatuses,
} from '../../constants/schema';
import {
  formatWeekRange,
  getWeekPickerOptions,
  getWeekRangeByOffset,
} from '../../utils/weekUtils';
import {
  getSubjectBlockCount,
  getSubjectBlockLengthMinutes,
  getSubjectCurriculumBlocks,
  getSubjectDefaultBlockQuantities,
} from '../../utils/planningCompatibilityUtils';
import {
  buildLegacyAssignmentId,
  buildWeeklyPlanBlockId,
} from '../../utils/weeklyPlanUtils';

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

const getBlockAccent = (index) => {
  const accents = ['#cbb7fb', '#34d399', '#60a5fa', '#f59e0b', '#f87171'];
  return accents[index % accents.length];
};

const getConfiguredFieldCount = (fields) => (
  Array.isArray(fields)
    ? fields.filter((field) => typeof field?.label === 'string' && field.label.trim().length > 0).length
    : 0
);

const toNonNegativeInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const getBlockCategory = (block) => {
  if (block?.type === 'project') return WeeklyBlockCategories.PROJECT_WORK;
  if (block?.type === 'test') return WeeklyBlockCategories.ASSESSMENT;
  if (block?.type === 'parent_led') return WeeklyBlockCategories.LESSON;
  return WeeklyBlockCategories.PRACTICE;
};

const getBlockTypeLabel = (block) => {
  if (block?.type === 'project') return 'PROJ';
  if (block?.type === 'test') return 'TEST';
  if (block?.type === 'parent_led') return 'P.LED';
  if (block?.type === 'custom') return 'CUSTOM';
  return 'STD';
};

const getSubjectStudentIds = (subject) => (
  Array.isArray(subject?.student_ids) && subject.student_ids.length > 0
    ? subject.student_ids
    : [subject?.student_id].filter(Boolean)
);

const getStudentSubjects = (subjects, studentId) => (
  (Array.isArray(subjects) ? subjects : []).filter((subject) => getSubjectStudentIds(subject).includes(studentId))
);

const getStudentDefaultHours = (subjects, studentId) => (
  getStudentSubjects(subjects, studentId).reduce((minutes, subject) => {
    return minutes + getSubjectBlockCount(subject) * getSubjectBlockLengthMinutes(subject);
  }, 0) / 60
);

const buildDefaultQuantitiesForSubjects = (subjects = []) => (
  Object.fromEntries((Array.isArray(subjects) ? subjects : []).map((subject) => [
    subject.id,
    getSubjectDefaultBlockQuantities(subject),
  ]))
);

const deriveQuantitiesFromBlocks = ({ blocks = [], subjects = [] } = {}) => {
  const subjectBlocksById = Object.fromEntries(subjects.map((subject) => [
    subject.id,
    getSubjectCurriculumBlocks(subject),
  ]));
  const quantities = buildDefaultQuantitiesForSubjects(subjects);

  subjects.forEach((subject) => {
    quantities[subject.id] = Object.fromEntries(
      getSubjectCurriculumBlocks(subject).map((block) => [block.id, 0])
    );
  });

  (Array.isArray(blocks) ? blocks : []).forEach((block) => {
    const subjectId = getSubjectIdForBlock(block);
    const libraryBlocks = subjectBlocksById[subjectId] || [];
    const curriculumBlockId = typeof block?.curriculum_block_id === 'string' && block.curriculum_block_id
      ? block.curriculum_block_id
      : libraryBlocks[Number.isInteger(block?.curriculum_block_source_index) ? block.curriculum_block_source_index : block?.legacy_block_index]?.id;

    if (!subjectId || !curriculumBlockId) return;

    quantities[subjectId] = {
      ...(quantities[subjectId] || {}),
      [curriculumBlockId]: toNonNegativeInt(quantities[subjectId]?.[curriculumBlockId]) + 1,
    };
  });

  return quantities;
};

const buildPlanBlocksFromQuantities = ({ subjects = [], studentId = '', quantitiesBySubjectId = {} } = {}) => (
  subjects.flatMap((subject) => {
    const assignmentId = buildLegacyAssignmentId({
      studentId,
      legacySubjectId: subject.id,
    });
    let subjectBlockIndex = 0;

    return getSubjectCurriculumBlocks(subject).flatMap((block, blockDefinitionIndex) => {
      const quantity = toNonNegativeInt(quantitiesBySubjectId?.[subject.id]?.[block.id]);

      return Array.from({ length: quantity }, (_, occurrenceIndex) => {
        const legacyBlockIndex = subjectBlockIndex;
        subjectBlockIndex += 1;
        const customFields = Array.isArray(block.custom_fields) && block.custom_fields.length
          ? block.custom_fields
          : (Array.isArray(subject.custom_fields) ? subject.custom_fields : []);
        const requireInput = typeof block.require_input === 'boolean'
          ? block.require_input
          : subject.require_input !== false;
        const requireTimer = typeof block.require_timer === 'boolean'
          ? block.require_timer
          : Boolean(subject.require_timer);
        const blockResources = Array.isArray(block.resources) && block.resources.length
          ? block.resources
          : (Array.isArray(subject.resources) ? subject.resources : []);

        return {
          id: buildWeeklyPlanBlockId({
            assignmentId,
            legacyBlockIndex,
          }),
          assignment_id: assignmentId,
          student_id: studentId,
          title: block.title || subject.title || `Block ${legacyBlockIndex + 1}`,
          color: subject.color || '#3B82F6',
          planned_duration_minutes: getSubjectBlockLengthMinutes(subject),
          category: getBlockCategory(block),
          completion_mode: requireInput || customFields.length > 0
            ? WeeklyBlockCompletionModes.HYBRID
            : WeeklyBlockCompletionModes.TIME_BOXED,
          require_timer: requireTimer,
          require_input: requireInput,
          instruction: block.instruction || '',
          resources: blockResources,
          custom_fields: customFields,
          legacy_subject_id: subject.id,
          legacy_subject_title: subject.title || '',
          legacy_block_index: legacyBlockIndex,
          curriculum_block_id: block.id,
          curriculum_block_title: block.title,
          curriculum_block_type: block.type,
          curriculum_block_source_index: blockDefinitionIndex,
          curriculum_block_occurrence: occurrenceIndex,
        };
      });
    });
  })
);

const WeeklyPlanReviewPanel = ({
  activeSubjects = [],
  currentUser = null,
  parentSettings = {},
  students = [],
}) => {
  const db = getFirestore(app);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [editableBlocks, setEditableBlocks] = useState([]);
  const [blockQuantities, setBlockQuantities] = useState({});
  const [expandedSubjectIds, setExpandedSubjectIds] = useState(() => new Set());
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [savingDefaultWeek, setSavingDefaultWeek] = useState(false);

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
  const selectedStudentSubjects = useMemo(
    () => getStudentSubjects(activeSubjects, selectedStudentId),
    [activeSubjects, selectedStudentId]
  );
  const sourcePlan = weeklyPlan || generatedPlanPreview;
  const planStatusMeta = useMemo(
    () => buildStatusMeta({ weeklyPlan, hasUnsavedEdits }),
    [hasUnsavedEdits, weeklyPlan]
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
  const hasSubjectCountVariance = selectedStudentSubjects.some((subject) => {
    const assignedCount = getSubjectCurriculumBlocks(subject).reduce((total, block) => (
      total + toNonNegativeInt(blockQuantities[subject.id]?.[block.id])
    ), 0);
    const target = getSubjectBlockCount(subject);
    return assignedCount !== target;
  });

  useEffect(() => {
    setHasUnsavedEdits(false);
    setFeedback(null);
  }, [selectedStudentId, selectedWeekOffset]);

  useEffect(() => {
    if (!sourcePlan) {
      if (!hasUnsavedEdits) {
        setEditableBlocks([]);
        setBlockQuantities(buildDefaultQuantitiesForSubjects(selectedStudentSubjects));
      }
      return;
    }

    if (hasUnsavedEdits) {
      return;
    }

    setEditableBlocks(clonePlanBlocks(sourcePlan.blocks));
    setBlockQuantities(deriveQuantitiesFromBlocks({
      blocks: sourcePlan.blocks,
      subjects: selectedStudentSubjects,
    }));
  }, [hasUnsavedEdits, selectedStudentSubjects, sourcePlan]);

  useEffect(() => {
    setExpandedSubjectIds((currentValue) => {
      const nextValue = new Set(currentValue);

      selectedStudentSubjects.slice(0, 2).forEach((subject) => {
        nextValue.add(subject.id);
      });

      return nextValue;
    });
  }, [selectedStudentSubjects]);

  const handleRefreshFromSubjects = () => {
    const nextQuantities = buildDefaultQuantitiesForSubjects(selectedStudentSubjects);
    const refreshedBlocks = buildPlanBlocksFromQuantities({
      subjects: selectedStudentSubjects,
      studentId: selectedStudentId,
      quantitiesBySubjectId: nextQuantities,
    });

    setBlockQuantities(nextQuantities);
    setEditableBlocks(refreshedBlocks);
    setHasUnsavedEdits(true);
    setFeedback({
      tone: 'info',
      text: 'Week reset to the current subject defaults. Save draft or publish to keep the regenerated plan.',
    });
  };

  const applyQuantities = (nextQuantities, { markUnsaved = true } = {}) => {
    setBlockQuantities(nextQuantities);
    setEditableBlocks(buildPlanBlocksFromQuantities({
      subjects: selectedStudentSubjects,
      studentId: selectedStudentId,
      quantitiesBySubjectId: nextQuantities,
    }));
    setHasUnsavedEdits(markUnsaved);
    setFeedback(null);
  };

  const handleBlockQuantityChange = ({ subjectId, blockId, delta }) => {
    const nextQuantities = {
      ...blockQuantities,
      [subjectId]: {
        ...(blockQuantities[subjectId] || {}),
        [blockId]: Math.max(0, toNonNegativeInt(blockQuantities[subjectId]?.[blockId]) + delta),
      },
    };

    applyQuantities(nextQuantities);
  };

  const handleToggleSubjectEnabled = (subject) => {
    const currentSubjectQuantities = blockQuantities[subject.id] || {};
    const hasAnyEnabled = Object.values(currentSubjectQuantities).some((quantity) => toNonNegativeInt(quantity) > 0);
    const nextSubjectQuantities = hasAnyEnabled
      ? Object.fromEntries(getSubjectCurriculumBlocks(subject).map((block) => [block.id, 0]))
      : getSubjectDefaultBlockQuantities(subject);

    applyQuantities({
      ...blockQuantities,
      [subject.id]: nextSubjectQuantities,
    });
  };

  const handleSaveAsDefaultWeek = async () => {
    if (!currentUser?.uid || !selectedStudentSubjects.length) return;

    setSavingDefaultWeek(true);
    try {
      await Promise.all(selectedStudentSubjects.map((subject) => {
        const nextSubjectQuantities = Object.fromEntries(
          getSubjectCurriculumBlocks(subject).map((block) => [
            block.id,
            toNonNegativeInt(blockQuantities[subject.id]?.[block.id]),
          ])
        );
        const nextCurriculumBlocks = getSubjectCurriculumBlocks(subject).map((block) => ({
          ...block,
          default_quantity: toNonNegativeInt(nextSubjectQuantities[block.id]),
        }));
        const nextBlockCount = Object.values(nextSubjectQuantities).reduce((total, quantity) => total + toNonNegativeInt(quantity), 0);

        return updateDoc(doc(db, 'subjects', subject.id), {
          curriculum_blocks: nextCurriculumBlocks,
          default_block_quantities: nextSubjectQuantities,
          block_count: nextBlockCount,
          updated_at: serverTimestamp(),
        });
      }));

      setHasUnsavedEdits(true);
      setFeedback({
        tone: 'success',
        text: 'Default week saved from the current block selections. Save or publish this week separately if you want this specific week persisted too.',
      });
    } catch (nextError) {
      console.error('Error saving default week:', nextError);
      setFeedback({
        tone: 'error',
        text: 'Unable to save the default week block selections.',
      });
    } finally {
      setSavingDefaultWeek(false);
    }
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
            Reset to default
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={!blocksAreEditable || !selectedStudentSubjects.length || loading || savingPlan || publishingPlan}
            className="op-proto-btn"
          >
            <Save className="h-3.5 w-3.5" />
            {savingPlan ? 'Saving...' : saveButtonLabel}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!blocksAreEditable || !selectedStudentSubjects.length || loading || savingPlan || publishingPlan}
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
                    ? 'This student-week is saved.'
                    : hasUnsavedEdits
                      ? 'This week has been customized.'
                      : 'Using current subject blocks as the default schedule preview.'}
                </span>
                {(isPersistedPlan || hasUnsavedEdits) && blocksAreEditable ? (
                  <button
                    type="button"
                    onClick={handleRefreshFromSubjects}
                    className="op-weekly-banner-action"
                    disabled={loading || savingPlan || publishingPlan}
                  >
                    Reset to default
                  </button>
                ) : null}
              </div>

              {renderMessage()}

              {!selectedStudentSubjects.length ? (
                <div className="op-proto-empty min-h-[280px]">
                  <p className="text-[14px] font-label text-white">No active subject blocks are available.</p>
                  <p className="mt-2 text-[12px] text-[rgba(238,234,248,0.54)]">Assign at least one active subject, then build reusable blocks in Curriculum.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedStudentSubjects.map((subject, groupIndex) => {
                    const isOpen = expandedSubjectIds.has(subject.id);
                    const accent = subject?.color || getBlockAccent(groupIndex);
                    const subjectBlocks = getSubjectCurriculumBlocks(subject);
                    const subjectQuantities = blockQuantities[subject.id] || {};
                    const totalAssigned = subjectBlocks.reduce((total, block) => total + toNonNegativeInt(subjectQuantities[block.id]), 0);
                    const target = getSubjectBlockCount(subject);
                    const diff = totalAssigned - target;

                    return (
                      <article
                        key={subject.id}
                        className="op-weekly-subject-row"
                        style={{ borderLeftColor: totalAssigned > 0 ? accent : 'rgba(255,255,255,0.08)' }}
                      >
                        <div className="op-weekly-subject-header">
                          <button
                            type="button"
                            onClick={() => toggleSubjectGroup(subject.id)}
                            className="op-weekly-subject-expand"
                          >
                            <span className="h-2 w-2 flex-shrink-0" style={{ backgroundColor: accent }} />
                            <span className="min-w-0 flex-1 truncate text-[12px] font-label text-white">{subject.title}</span>
                            <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-[rgba(238,234,248,0.36)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleSubjectEnabled(subject)}
                            className={`op-weekly-enable-chip ${totalAssigned > 0 ? 'is-on' : ''}`}
                            disabled={subjectBlocks.length === 0}
                          >
                            {subjectBlocks.length === 0 ? 'Needs blocks' : totalAssigned > 0 ? 'Enabled' : 'Disabled'}
                          </button>
                          <span className="text-[10px] text-[rgba(238,234,248,0.46)]">{getSubjectBlockLengthMinutes(subject)}m/block</span>
                          <span
                            className="text-[11px] font-label"
                            style={{ color: diff === 0 ? '#34d399' : '#f59e0b' }}
                          >
                            {totalAssigned}/{target}
                          </span>
                          {diff !== 0 ? (
                            <span className={`op-weekly-diff ${diff > 0 ? 'is-plus' : 'is-minus'}`}>{diff > 0 ? '+' : ''}{diff}</span>
                          ) : null}
                        </div>

                        {isOpen ? (
                          <div className="op-weekly-subject-body">
                            {subjectBlocks.length === 0 ? (
                              <div className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-[#f59e0b] bg-[rgba(245,158,11,0.08)] px-3 py-2">
                                <p className="text-[10px] leading-4 text-[#f59e0b]">
                                  Add a reusable block before assigning weekly quantities.
                                </p>
                                <Link to="/dashboard/curriculum" className="op-proto-btn">
                                  Go to Curriculum
                                </Link>
                              </div>
                            ) : (
                              <div className="op-weekly-pill-row">
                                {subjectBlocks.map((block) => {
                                  const fieldCount = getConfiguredFieldCount(block.custom_fields);
                                  const quantity = toNonNegativeInt(subjectQuantities[block.id]);

                                  return (
                                    <div
                                      key={block.id}
                                      className={`op-weekly-block-pill ${quantity === 0 ? 'is-muted' : ''}`}
                                      style={{ borderColor: quantity > 0 ? `${accent}88` : 'rgba(255,255,255,0.14)' }}
                                    >
                                      <span className={`op-weekly-block-type ${block.instruction ? 'is-guided' : ''}`}>
                                        {getBlockTypeLabel(block)}
                                      </span>
                                      <span className="min-w-0 flex-1 truncate">
                                        {block.title || subject.title}
                                      </span>
                                      <span className="text-[9px] text-[rgba(238,234,248,0.38)]">
                                        {getSubjectBlockLengthMinutes(subject)}m
                                      </span>
                                      {fieldCount > 0 ? (
                                        <span className="op-weekly-field-count">{fieldCount}</span>
                                      ) : null}
                                      <span className="qty-inline">
                                        <button
                                          type="button"
                                          onClick={() => handleBlockQuantityChange({ subjectId: subject.id, blockId: block.id, delta: -1 })}
                                          className="qi-btn"
                                        >
                                          -
                                        </button>
                                        <span className="qi-val">{quantity}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleBlockQuantityChange({ subjectId: subject.id, blockId: block.id, delta: 1 })}
                                          className="qi-btn"
                                        >
                                          +
                                        </button>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

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
                  {selectedStudentSubjects.map((subject, index) => {
                    const subjectBlocks = getSubjectCurriculumBlocks(subject);
                    const assignedCount = subjectBlocks.reduce((total, block) => (
                      total + toNonNegativeInt(blockQuantities[subject.id]?.[block.id])
                    ), 0);
                    const target = getSubjectBlockCount(subject);
                    const diff = assignedCount - target;

                    return (
                      <div key={subject.id} className="op-weekly-summary-subject">
                        <span className="h-1.5 w-1.5 flex-shrink-0" style={{ backgroundColor: subject?.color || getBlockAccent(index) }} />
                        <span className="min-w-0 flex-1 truncate">{subject.title}</span>
                        <span className="font-label text-[rgba(238,234,248,0.8)]">{assignedCount}</span>
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
                <button
                  type="button"
                  className="op-proto-btn w-full"
                  onClick={handleSaveAsDefaultWeek}
                  disabled={savingDefaultWeek || loading || savingPlan || publishingPlan}
                >
                  <Star className="h-3.5 w-3.5" />
                  {savingDefaultWeek ? 'Saving default...' : 'Save as default week'}
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
