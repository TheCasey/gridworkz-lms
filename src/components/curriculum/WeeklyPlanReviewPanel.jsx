import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
import SchoolBlockDetails from '../school/SchoolBlockDetails';
import useWeeklyActivity from '../../hooks/useWeeklyActivity';
import { schoolExecutionContentSignature } from '../../../functions/src/schoolPublicationBridge.js';
import useWeeklyPlanRecord from '../../hooks/useWeeklyPlanRecord';
import {
  WeeklyPlanStatuses,
} from '../../constants/schema';
import {
  formatWeekRange,
  getWeekPickerOptions,
  getWeekRangeByOffset,
} from '../../utils/weekUtils';
import {
  getSubjectBlockLengthMinutes,
  getSubjectCurriculumBlocks,
  getSubjectDefaultBlockQuantities,
} from '../../utils/planningCompatibilityUtils';
import {
  buildStudentDefaultQuantities,
  buildDefaultWeekQuantitiesWrite,
  deriveWeeklyPlanBlocks,
  weeklyPlanContentSignature,
  weeklyPlanValueSignature,
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
        : 'Generated from this student’s default week; not saved yet.',
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
      detail: 'Archived weekly plans are read-only.',
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
      getSubjectCurriculumBlocks(subject).filter((block) => block.is_active !== false).map((block) => [block.id, 0])
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

const WeeklyPlanReviewPanel = ({
  activeSubjects = [],
  currentUser = null,
  parentSettings = {},
  students = [],
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [editableBlocks, setEditableBlocks] = useState([]);
  const [blockQuantities, setBlockQuantities] = useState({});
  const [expandedSubjectIds, setExpandedSubjectIds] = useState(() => new Set());
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const baseline = useRef({ draft: 0, published: 0, defaults: 0 });
  const localIdentityHistory = useRef([]);
  const editorScope = useRef('');
  const editorCandidate = useRef(null);

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
      parentSettings?.timezone,
      selectedWeekOffset,
    ]
  );
  const weekPickerOptions = useMemo(
    () => getWeekPickerOptions(parentSettings),
    [
      parentSettings?.week_reset_day,
      parentSettings?.week_reset_hour,
      parentSettings?.week_reset_minute,
      parentSettings?.timezone,
    ]
  );
  const {
    buildDraftPreview,
    frozenExecution,
    clearError,
    draftPlan,
    studentDefaultWeek,
    saveDefaultWeek,
    savingDefaultWeek,
    planId,
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

  const [legacySourceLinks, setLegacySourceLinks] = useState({});
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
  const schoolStudents = useMemo(() => selectedStudent ? [selectedStudent] : [], [selectedStudent]);
  const { schoolWeeksByStudentId, reloadSchoolState, loading: schoolLoading, error: schoolError } = useWeeklyActivity({ currentUser,
    students: schoolStudents, subjects: activeSubjects, weekConfig: parentSettings, weekOffset: selectedWeekOffset, enabled: Boolean(selectedStudent) });
  const schoolWeek = schoolWeeksByStudentId[selectedStudentId];
  const reconciliationSource = weeklyPlan && weeklyPlan.school_completion_version !== 1 && weeklyPlan.status === 'published'
    ? weeklyPlan : !weeklyPlan ? frozenExecution || (schoolWeek?.plan?.authority_kind === 'legacy_execution' ? schoolWeek.plan : null) : null;
  const initialLegacyPreview = useMemo(() => !studentDefaultWeek && reconciliationSource?.authority_kind === 'legacy_execution'
    ? { ...reconciliationSource, id: planId, status: 'draft' } : generatedPlanPreview, [studentDefaultWeek, reconciliationSource, planId, generatedPlanPreview]);
  const sourcePlan = weeklyPlan?.status === WeeklyPlanStatuses.ARCHIVED ? weeklyPlan : draftPlan || weeklyPlan || initialLegacyPreview;
  const defaultQuantities = useMemo(() => buildStudentDefaultQuantities({ subjects: selectedStudentSubjects, defaults: studentDefaultWeek }), [selectedStudentSubjects, studentDefaultWeek]);
  const differsFromDefaults = weeklyPlanValueSignature(blockQuantities) !== weeklyPlanValueSignature(defaultQuantities);
  const differsFromPublished = weeklyPlan?.status !== WeeklyPlanStatuses.PUBLISHED || weeklyPlanContentSignature({ ...sourcePlan, blocks: editableBlocks, parent_notes: '' }) !== weeklyPlanContentSignature({ ...weeklyPlan, parent_notes: '' });
  const savedDraftDiffersFromPublished = Boolean(draftPlan) && (weeklyPlan?.status !== WeeklyPlanStatuses.PUBLISHED || weeklyPlanContentSignature({ ...draftPlan, parent_notes: '' }) !== weeklyPlanContentSignature({ ...weeklyPlan, parent_notes: '' }));
  const planStatusMeta = useMemo(
    () => buildStatusMeta({ weeklyPlan: weeklyPlan || draftPlan, hasUnsavedEdits }),
    [hasUnsavedEdits, weeklyPlan, draftPlan]
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
  const planUpdatedAt = formatPlanTimestamp(draftPlan?.updated_at || weeklyPlan?.updated_at);
  const planPublishedAt = formatPlanTimestamp(weeklyPlan?.published_at);
  const isArchived = weeklyPlan?.status === WeeklyPlanStatuses.ARCHIVED;
  const isPersistedPlan = Boolean(weeklyPlan || draftPlan);
  const busy = loading || savingPlan || publishingPlan || savingDefaultWeek;
  const conflict = error?.code === 'functions/aborted' || error?.code === 'aborted';
  const hasRemoteChanges = !loading && (baseline.current.draft !== (draftPlan?.revision || 0) || baseline.current.published !== (weeklyPlan?.revision || 0) || baseline.current.defaults !== (studentDefaultWeek?.revision || 0));
  const blocksAreEditable = Boolean(sourcePlan) && !isArchived;
  const hasUnavailableBlocks = editableBlocks.some((block) => !selectedStudentSubjects.some((subject) => subject.id === block.legacy_subject_id && getSubjectCurriculumBlocks(subject).some((definition, index) => definition.is_active !== false && (definition.id === block.curriculum_block_id || (!block.curriculum_block_id && index === block.legacy_block_index)))));
  const hasSubjectCountVariance = selectedStudentSubjects.some((subject) => {
    const assignedCount = getSubjectCurriculumBlocks(subject).reduce((total, block) => (
      total + toNonNegativeInt(blockQuantities[subject.id]?.[block.id])
    ), 0);
    const target = Object.values(defaultQuantities[subject.id] || {}).reduce((total, quantity) => total + toNonNegativeInt(quantity), 0);
    return assignedCount !== target;
  });

  useEffect(() => {
    if (busy || !sourcePlan) return;
    const scopeChanged = editorScope.current !== planId;
    if (!scopeChanged && (hasUnsavedEdits || error)) return;
    editorScope.current = planId;
    editorCandidate.current = sourcePlan;
    baseline.current = { draft: draftPlan?.revision || 0, published: weeklyPlan?.revision || 0, defaults: studentDefaultWeek?.revision || 0 };
    localIdentityHistory.current = [
      ...(sourcePlan.blocks || []),
      ...(weeklyPlan?.blocks || []),
      ...Object.entries(draftPlan?.block_identity_history || {}).map(([id, identity]) => ({ ...identity, id })),
    ];
    setLegacySourceLinks(sourcePlan.legacy_source_links || {});
    setEditableBlocks(normalizeEditableBlocks(sourcePlan.blocks).map((block) => ({ ...block, instance_key: block.instance_key ?? `legacy:${block.id}` })));
    setBlockQuantities(deriveQuantitiesFromBlocks({ blocks: sourcePlan.blocks, subjects: selectedStudentSubjects }));
    setHasUnsavedEdits(false);
    if (scopeChanged) setFeedback(null);
  }, [busy, error, sourcePlan, selectedStudentSubjects, hasUnsavedEdits, planId, draftPlan, weeklyPlan, studentDefaultWeek]);

  const reloadAndReview = () => {
    clearError();
    setHasUnsavedEdits(false);
    setFeedback({ tone: 'info', text: 'Reloaded the latest saved week. Review it before saving or publishing.' });
    editorScope.current = planId;
    editorCandidate.current = sourcePlan;
    baseline.current = { draft: draftPlan?.revision || 0, published: weeklyPlan?.revision || 0, defaults: studentDefaultWeek?.revision || 0 };
    localIdentityHistory.current = [...(sourcePlan?.blocks || []), ...(weeklyPlan?.blocks || []), ...Object.entries(draftPlan?.block_identity_history || {}).map(([id, identity]) => ({ ...identity, id }))];
    setLegacySourceLinks(sourcePlan?.legacy_source_links || {});
    setEditableBlocks(normalizeEditableBlocks(sourcePlan?.blocks).map((block) => ({ ...block, instance_key: block.instance_key ?? `legacy:${block.id}` })));
    setBlockQuantities(deriveQuantitiesFromBlocks({ blocks: sourcePlan?.blocks, subjects: selectedStudentSubjects }));
  };

  useEffect(() => {
    setExpandedSubjectIds((currentValue) => {
      const nextValue = new Set(currentValue);

      selectedStudentSubjects.slice(0, 2).forEach((subject) => {
        nextValue.add(subject.id);
      });

      return nextValue;
    });
  }, [selectedStudentSubjects]);

  const applyQuantities = (nextQuantities) => {
    if (!blocksAreEditable || busy) return;
    const nextBlocks = deriveWeeklyPlanBlocks({
      subjects: selectedStudentSubjects, studentId: selectedStudentId,
      quantitiesBySubjectId: nextQuantities, previousBlocks: editableBlocks,
      identityHistory: localIdentityHistory.current,
    });
    localIdentityHistory.current = [...localIdentityHistory.current, ...nextBlocks];
    setBlockQuantities(nextQuantities);
    setEditableBlocks(nextBlocks);
    setHasUnsavedEdits(true);
    setFeedback(null);
  };

  const handleRefreshFromSubjects = () => {
    applyQuantities(defaultQuantities);
    setFeedback({ tone: 'info', text: 'Reset to this student’s default week. Save Draft or Publish This Week to keep these selections.' });
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
      ? Object.fromEntries(getSubjectCurriculumBlocks(subject).filter((block) => block.is_active !== false).map((block) => [block.id, 0]))
      : defaultQuantities[subject.id] || getSubjectDefaultBlockQuantities(subject);

    applyQuantities({
      ...blockQuantities,
      [subject.id]: nextSubjectQuantities,
    });
  };

  const handleSaveAsDefaultWeek = async () => {
    if (!blocksAreEditable || busy) return;
    const quantities = buildDefaultWeekQuantitiesWrite({ currentDefaults: studentDefaultWeek, subjects: selectedStudentSubjects, quantities: blockQuantities });
    const result = await saveDefaultWeek({ defaultBlockQuantities: quantities, expectedRevision: baseline.current.defaults });
    if (!result) return;
    baseline.current.defaults = result.revision;
    setFeedback({ tone: 'success', text: `Default week saved for ${selectedStudent?.name}. Future generated weeks will use these selections; this week still needs its own save or publication.` });
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

  const mutationOptions = () => ({
    candidate: editorCandidate.current,
    expectedDraftRevision: baseline.current.draft,
    expectedPublishedRevision: baseline.current.published,
    planOverrides: { blocks: normalizeEditableBlocks(editableBlocks), legacy_source_links: legacySourceLinks },
  });
  const studentWeekLabel = `${selectedStudent?.name} · ${selectedWeekOption?.displayText || formatWeekRange(selectedWeekRange.weekStart, selectedWeekRange.weekEnd)}`;

  const handleSaveDraft = async () => {
    const result = await saveDraftWeeklyPlan(mutationOptions());
    if (!result) return;
    baseline.current.draft = result.draft_revision;
    baseline.current.published = result.published_revision;
    setHasUnsavedEdits(false);
    setFeedback({ tone: 'success', text: `Draft saved for ${studentWeekLabel}. ${weeklyPlan?.status === 'published' ? 'Students continue to see the published week.' : 'Ready to publish when you choose.'}` });
  };

  const handlePublish = async () => {
    if (reconciliationSource && editableBlocks.some((block) => !Object.hasOwn(legacySourceLinks, block.id) && !reconciliationSource.blocks.some((source) => source.id === block.id && schoolExecutionContentSignature(source) === schoolExecutionContentSignature(block)))) {
      setFeedback({ tone: 'error', text: 'Review the earlier assignment link for every block, or explicitly choose new work, before publishing.' }); return;
    }
    const empty = editableBlocks.length === 0;
    if (!window.confirm(`Publish ${studentWeekLabel}? ${empty ? 'This is an empty week. The student will have no schoolwork blocks for this week.' : `${editableBlocks.length} blocks from the current selections will become the student’s week.`}`)) return;
    const result = await publishWeeklyPlan(mutationOptions());
    if (!result) return;
    baseline.current.draft = result.draft_revision;
    baseline.current.published = result.published_revision;
    setHasUnsavedEdits(false);
    setFeedback({ tone: 'success', text: `${empty ? 'Empty week' : 'Week'} published for ${studentWeekLabel}. ${empty ? 'No schoolwork blocks are assigned.' : `${editableBlocks.length} blocks are available to the student.`}` });
  };

  const renderMessage = () => {
    const message = error
      ? {
          tone: 'error',
          text: conflict ? 'This week or default changed in another tab. Your edits are still here. Reload and review the latest saved version before trying again.' : `${error.message || 'Unable to load or save the weekly plan.'} You can retry the same action.`,
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
        role={message.tone === 'error' ? 'alert' : 'status'}
        className="mt-5 flex items-start gap-3 border px-4 py-3"
        style={{
          backgroundColor: tone.surface,
          borderColor: tone.accent,
          color: tone.text,
        }}
      >
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div><p className="text-[13px] font-body leading-5">{message.text}</p>{conflict ? <button type="button" className="op-proto-btn mt-2" onClick={reloadAndReview}>Reload and review</button> : null}</div>
      </div>
    );
  };

  return (
    <section className="op-weekly-proto">
      <div className="op-proto-topbar sticky top-0 z-20 flex-wrap" style={{ backgroundColor: '#241d38' }} role="region" aria-label="Weekly Plan actions" aria-busy={busy}>
        <div className="min-w-0 flex-1 basis-full sm:basis-0">
          <p className="text-[14px] font-label text-white">Weekly Plan</p>
          <p className="mt-1 truncate text-[10px] text-[rgba(238,234,248,0.42)]">
            {selectedStudent?.name || 'Select a student'} · {selectedWeekOption?.displayText || formatWeekRange(selectedWeekRange.weekStart, selectedWeekRange.weekEnd)} · {planStatusMeta.label}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={handleRefreshFromSubjects}
            disabled={!blocksAreEditable || busy}
            className="op-proto-btn"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Reset to default
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={!blocksAreEditable || busy || conflict}
            className="op-proto-btn"
          >
            <Save className="h-3.5 w-3.5" />
            Save Draft
          </button>
          <button type="button" onClick={handleSaveAsDefaultWeek} disabled={!blocksAreEditable || busy || conflict} className="op-proto-btn">
            <Star className="h-3.5 w-3.5" />Save as Default Week
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!blocksAreEditable || busy || conflict}
            className="op-proto-btn op-proto-btn-primary"
          >
            <Send className="h-3.5 w-3.5" />
            Publish This Week
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
          <div className="px-4 py-2 text-[11px] text-[rgba(238,234,248,0.76)]" role="status">
            {hasUnsavedEdits ? 'Unsaved changes' : 'No unsaved changes'} · {savedDraftDiffersFromPublished ? 'Saved draft differs from published week' : draftPlan ? 'Saved draft matches published week' : 'No saved private draft'} · {differsFromPublished ? 'Current selections differ from published week' : 'Current selections match published week'} · {differsFromDefaults ? 'Different from default week' : 'Matches default week'}
            {hasRemoteChanges && hasUnsavedEdits ? ' · A saved version changed; your edits are preserved.' : ''}
            {editableBlocks.length === 0 ? ' · Empty week: no schoolwork blocks.' : ''}
          </div>
          <div className="op-weekly-controls">
            <label className="text-[11px] text-white">Student
              <select aria-label="Student" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} className="ml-2 bg-[#241d38] text-white">
                {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-white">Week
              <select aria-label="Week" value={selectedWeekOffset} onChange={(event) => setSelectedWeekOffset(Number(event.target.value))} className="ml-2 bg-[#241d38] text-white">
                {weekPickerOptions.map((option) => <option key={option.value} value={option.value}>{option.displayText || option.label}</option>)}
              </select>
            </label>
            <div className="op-weekly-student-tabs">
              {students.map((student) => {
                const isActive = student.id === selectedStudentId;

                return (
                  <button
                    type="button"
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`op-proto-tab ${isActive ? 'is-active' : ''}`}
                  >
                    <span className="op-proto-tab-name">{student.name}</span>
                    <span className="op-proto-tab-meta">{isActive ? 'Selected student' : 'View week'}</span>
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
                      : 'Previewing this student’s default week.'}
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
              {reconciliationSource && editableBlocks.length > 0 && (
                <section className="mt-3 rounded-lg border border-parchment bg-white text-charcoal-ink p-4" aria-label="Legacy completion reconciliation">
                  <h3 className="text-sm font-display">Preserve this week’s completion history</h3>
                  <p className="text-xs my-2">Review each link to the frozen assignment before first publication. Choose new work when completion should start empty. Each earlier block can be linked once.</p>
                  {editableBlocks.map((block) => {
                    const exact = reconciliationSource.blocks.find((source) => source.id === block.id && schoolExecutionContentSignature(source) === schoolExecutionContentSignature(block));
                    const hasChoice = Object.hasOwn(legacySourceLinks, block.id);
                    const value = hasChoice ? legacySourceLinks[block.id] === null ? '__new__' : legacySourceLinks[block.id] : exact?.id || '';
                    const choices = reconciliationSource.blocks.filter((source) => schoolExecutionContentSignature(source) === schoolExecutionContentSignature(block));
                    return <label key={block.id} className="block text-xs my-3">{block.title || 'School block'} · {(block.legacy_block_index ?? 0) + 1}
                      <select aria-label={`Earlier assignment for ${block.title || 'block'} ${(block.legacy_block_index ?? 0) + 1}`} value={value} disabled={busy}
                        onChange={(event) => { setLegacySourceLinks((previous) => ({ ...previous, [block.id]: event.target.value === '__new__' ? null : event.target.value })); setHasUnsavedEdits(true); }} className="block border border-parchment rounded w-full p-2 mt-1">
                        <option value="" disabled>Choose earlier assignment or new work</option>
                        <option value="__new__">New work — no earlier completion</option>
                        {choices.map((source) => <option key={source.id} value={source.id} disabled={editableBlocks.some((other) => other.id !== block.id && (Object.hasOwn(legacySourceLinks, other.id) ? legacySourceLinks[other.id] : reconciliationSource.blocks.find((earlier) => earlier.id === other.id && schoolExecutionContentSignature(earlier) === schoolExecutionContentSignature(other))?.id) === source.id)}>{source.title || 'School block'} · earlier block {(source.legacy_block_index ?? 0) + 1}{exact?.id === source.id ? ' (same identity)' : ''}</option>)}
                      </select>
                    </label>;
                  })}
                </section>
              )}

              {hasUnavailableBlocks && blocksAreEditable ? (
                <div className="mt-3 border-l-2 border-[#f59e0b] px-3 py-2 text-[11px] text-[#f59e0b]" role="status">
                  Some saved blocks are no longer available in Curriculum. Their published history is retained.
                  <button type="button" onClick={() => applyQuantities(blockQuantities)} className="op-proto-btn ml-2" disabled={busy}>Remove unavailable blocks</button>
                </div>
              ) : null}

              {!selectedStudentSubjects.length ? (
                <div className="op-proto-empty min-h-[280px]">
                  <p className="text-[14px] font-label text-white">No active subject blocks are available.</p>
                  <p className="mt-2 text-[12px] text-[rgba(238,234,248,0.54)]">You can publish an empty week, or add reusable blocks in Curriculum.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedStudentSubjects.map((subject, groupIndex) => {
                    const isOpen = expandedSubjectIds.has(subject.id);
                    const accent = subject?.color || getBlockAccent(groupIndex);
                    const subjectBlocks = getSubjectCurriculumBlocks(subject).filter((block) => block.is_active !== false);
                    const subjectQuantities = blockQuantities[subject.id] || {};
                    const totalAssigned = subjectBlocks.reduce((total, block) => total + toNonNegativeInt(subjectQuantities[block.id]), 0);
                    const target = Object.values(defaultQuantities[subject.id] || {}).reduce((total, quantity) => total + toNonNegativeInt(quantity), 0);
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
                            disabled={!blocksAreEditable || busy || subjectBlocks.length === 0}
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
                                        {block.require_timer ?? subject.require_timer ? `${getSubjectBlockLengthMinutes(subject)}m timer` : 'No timer'}
                                      </span>
                                      {fieldCount > 0 ? (
                                        <span className="op-weekly-field-count">{fieldCount}</span>
                                      ) : null}
                                      <span className="qty-inline">
                                        <button
                                          type="button"
                                          aria-label={`Remove ${block.title || subject.title} block`}
                                          onClick={() => handleBlockQuantityChange({ subjectId: subject.id, blockId: block.id, delta: -1 })}
                                          disabled={!blocksAreEditable || busy}
                                          className="qi-btn"
                                        >
                                          -
                                        </button>
                                        <span className="qi-val">{quantity}</span>
                                        <button
                                          type="button"
                                          aria-label={`Add ${block.title || subject.title} block`}
                                          onClick={() => handleBlockQuantityChange({ subjectId: subject.id, blockId: block.id, delta: 1 })}
                                          disabled={!blocksAreEditable || busy}
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
              {schoolError && <p role="alert" className="text-sm mt-3">Unable to load completion history: {schoolError.message}</p>}
              <SchoolBlockDetails schoolWeek={schoolWeeksByStudentId[selectedStudentId]} onReload={reloadSchoolState} disabled={schoolLoading || Boolean(schoolError)} />
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
                    const subjectBlocks = getSubjectCurriculumBlocks(subject).filter((block) => block.is_active !== false);
                    const assignedCount = subjectBlocks.reduce((total, block) => (
                      total + toNonNegativeInt(blockQuantities[subject.id]?.[block.id])
                    ), 0);
                    const target = Object.values(defaultQuantities[subject.id] || {}).reduce((total, quantity) => total + toNonNegativeInt(quantity), 0);
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
                    ? 'Some subjects differ from this student’s default week.'
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

              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
};

export default WeeklyPlanReviewPanel;
