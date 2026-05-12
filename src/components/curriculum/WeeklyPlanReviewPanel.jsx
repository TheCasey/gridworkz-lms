import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
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
      label: 'Preview Only',
      detail: hasUnsavedEdits
        ? 'Local edits are ready to save or publish.'
        : 'Generated from current subject assignments but not saved yet.',
      backgroundColor: '#f0eaff',
      borderColor: '#cbb7fb',
      textColor: '#714cb6',
    };
  }

  if (weeklyPlan.status === WeeklyPlanStatuses.PUBLISHED) {
    return {
      label: hasUnsavedEdits ? 'Published + Local Edits' : 'Published',
      detail: hasUnsavedEdits
        ? 'You have unpublished local edits that can be re-published.'
        : 'This student-week already has a published weekly plan.',
      backgroundColor: '#eef8f1',
      borderColor: '#b9dfc3',
      textColor: '#23693f',
    };
  }

  if (weeklyPlan.status === WeeklyPlanStatuses.ARCHIVED) {
    return {
      label: 'Archived',
      detail: 'Archived weekly plans are read-only in this phase.',
      backgroundColor: '#f4f0eb',
      borderColor: '#dcd7d3',
      textColor: '#6b625a',
    };
  }

  return {
    label: hasUnsavedEdits ? 'Draft + Local Edits' : 'Draft Saved',
    detail: hasUnsavedEdits
      ? 'Draft changes are local until you save or publish them.'
      : 'This student-week has a saved draft plan.',
    backgroundColor: '#fbfaf8',
    borderColor: '#dcd7d3',
    textColor: '#292827',
  };
};

const WeeklyPlanReviewPanel = ({
  activeSubjects = [],
  colors,
  currentUser = null,
  parentSettings = {},
  students = [],
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [editableBlocks, setEditableBlocks] = useState([]);
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
  const planUpdatedAt = formatPlanTimestamp(weeklyPlan?.updated_at);
  const planPublishedAt = formatPlanTimestamp(weeklyPlan?.published_at);
  const planSubjectCount = useMemo(
    () => new Set(
      editableBlocks
        .map((block) => block?.legacy_subject_id)
        .filter(Boolean)
    ).size,
    [editableBlocks]
  );
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

    const toneStyles = {
      error: {
        backgroundColor: '#fff1f1',
        borderColor: '#f3c2c2',
        textColor: '#8f3030',
        Icon: AlertCircle,
      },
      info: {
        backgroundColor: '#f0eaff',
        borderColor: '#cbb7fb',
        textColor: '#714cb6',
        Icon: FilePenLine,
      },
      success: {
        backgroundColor: '#eef8f1',
        borderColor: '#b9dfc3',
        textColor: '#23693f',
        Icon: CheckCircle2,
      },
    };
    const tone = toneStyles[message.tone] || toneStyles.info;
    const Icon = tone.Icon;

    return (
      <div
        className="mt-5 flex items-start gap-3 rounded-2xl px-4 py-3"
        style={{
          backgroundColor: tone.backgroundColor,
          border: `1px solid ${tone.borderColor}`,
          color: tone.textColor,
        }}
      >
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p className="text-[13px] font-body">{message.text}</p>
      </div>
    );
  };

  return (
    <section
      className="mb-8 rounded-[28px] bg-white p-6"
      style={{ border: `1px solid ${colors.parchment}` }}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p
            className="mb-2 inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em] font-label"
            style={{ backgroundColor: colors.lavenderTint, color: colors.amethyst }}
          >
            Parent Weekly Plan Review
          </p>
          <h3 className="text-[22px] font-display text-charcoal-ink" style={{ lineHeight: 1.08 }}>
            Review one student-week before it goes live
          </h3>
          <p className="mt-2 max-w-3xl text-[14px] font-body text-charcoal-ink/55">
            This panel stays thin on purpose. It generates a weekly plan from the current subject editor,
            lets you adjust block titles or instructions, then saves a draft or publishes that student-week.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRefreshFromSubjects}
            disabled={!blocksAreEditable || loading || savingPlan || publishingPlan}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-label transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: colors.cream, color: colors.charcoal }}
            onMouseEnter={(event) => { if (!event.currentTarget.disabled) event.currentTarget.style.backgroundColor = colors.parchment; }}
            onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = colors.cream; }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh From Subjects
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={!blocksAreEditable || !editableBlocks.length || loading || savingPlan || publishingPlan}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-label transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: '#fbfaf8', color: colors.charcoal, border: `1px solid ${colors.parchment}` }}
            onMouseEnter={(event) => { if (!event.currentTarget.disabled) event.currentTarget.style.backgroundColor = colors.cream; }}
            onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = '#fbfaf8'; }}
          >
            <Save className="h-4 w-4" />
            {savingPlan ? 'Saving...' : saveButtonLabel}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!blocksAreEditable || !editableBlocks.length || loading || savingPlan || publishingPlan}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-label transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: colors.charcoal, color: '#ffffff' }}
            onMouseEnter={(event) => { if (!event.currentTarget.disabled) event.currentTarget.style.backgroundColor = '#3a3937'; }}
            onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = colors.charcoal; }}
          >
            <Send className="h-4 w-4" />
            {publishingPlan ? 'Publishing...' : publishButtonLabel}
          </button>
        </div>
      </div>

      {students.length === 0 ? (
        <div
          className="mt-5 rounded-2xl px-5 py-4"
          style={{ backgroundColor: '#fbfaf8', border: `1px solid ${colors.parchment}` }}
        >
          <p className="text-[14px] font-body text-charcoal-ink/70">
            Add a student before planning a weekly review surface.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_1.15fr_0.95fr]">
            <div
              className="rounded-2xl px-4 py-4"
              style={{ backgroundColor: '#fbfaf8', border: `1px solid ${colors.parchment}` }}
            >
              <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] font-label text-charcoal-ink/45">
                Student
              </label>
              <select
                value={selectedStudentId}
                onChange={(event) => setSelectedStudentId(event.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-[14px] font-body focus:outline-none"
                style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal, backgroundColor: '#ffffff' }}
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[12px] font-body text-charcoal-ink/45">
                Plans stay scoped to one student-week in this phase.
              </p>
            </div>

            <div
              className="rounded-2xl px-4 py-4"
              style={{ backgroundColor: '#fbfaf8', border: `1px solid ${colors.parchment}` }}
            >
              <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] font-label text-charcoal-ink/45">
                Week
              </label>
              <select
                value={selectedWeekOffset}
                onChange={(event) => setSelectedWeekOffset(Number.parseInt(event.target.value, 10))}
                className="w-full rounded-xl px-3 py-2.5 text-[14px] font-body focus:outline-none"
                style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal, backgroundColor: '#ffffff' }}
              >
                {weekPickerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.displayText})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[12px] font-body text-charcoal-ink/45">
                {formatWeekRange(selectedWeekRange.weekStart, selectedWeekRange.weekEnd)}
              </p>
            </div>

            <div
              className="rounded-2xl px-4 py-4"
              style={{
                backgroundColor: planStatusMeta.backgroundColor,
                border: `1px solid ${planStatusMeta.borderColor}`,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.16em] font-label" style={{ color: planStatusMeta.textColor }}>
                  Status
                </p>
                {planRequiresAttention ? (
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] font-label"
                    style={{ backgroundColor: '#ffffff90', color: planStatusMeta.textColor }}
                  >
                    Needs Review
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[18px] font-display" style={{ color: planStatusMeta.textColor }}>
                {planStatusMeta.label}
              </p>
              <p className="mt-1 text-[12px] font-body" style={{ color: planStatusMeta.textColor }}>
                {planStatusMeta.detail}
              </p>
            </div>
          </div>

          {renderMessage()}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div
              className="rounded-2xl px-4 py-3"
              style={{ backgroundColor: '#fbfaf8', border: `1px solid ${colors.parchment}` }}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] font-label text-charcoal-ink/40">
                Student-Week
              </p>
              <p className="mt-1 text-[15px] font-display text-charcoal-ink">
                {selectedStudent?.name || 'Select a student'}
              </p>
              <p className="mt-1 text-[12px] font-body text-charcoal-ink/45">
                {getWeekLabel(selectedWeekOffset)}
              </p>
            </div>

            <div
              className="rounded-2xl px-4 py-3"
              style={{ backgroundColor: '#fbfaf8', border: `1px solid ${colors.parchment}` }}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] font-label text-charcoal-ink/40">
                Blocks In Plan
              </p>
              <p className="mt-1 text-[15px] font-display text-charcoal-ink">
                {editableBlocks.length}
              </p>
              <p className="mt-1 text-[12px] font-body text-charcoal-ink/45">
                {planSubjectCount} active subject{planSubjectCount === 1 ? '' : 's'} feeding this week
              </p>
            </div>

            <div
              className="rounded-2xl px-4 py-3"
              style={{ backgroundColor: '#fbfaf8', border: `1px solid ${colors.parchment}` }}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] font-label text-charcoal-ink/40">
                Last Draft Save
              </p>
              <p className="mt-1 text-[15px] font-display text-charcoal-ink">
                {planUpdatedAt || 'Not saved yet'}
              </p>
              <p className="mt-1 text-[12px] font-body text-charcoal-ink/45">
                Drafts preserve your light block edits.
              </p>
            </div>

            <div
              className="rounded-2xl px-4 py-3"
              style={{ backgroundColor: '#fbfaf8', border: `1px solid ${colors.parchment}` }}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] font-label text-charcoal-ink/40">
                Published
              </p>
              <p className="mt-1 text-[15px] font-display text-charcoal-ink">
                {planPublishedAt || 'Not published'}
              </p>
              <p className="mt-1 text-[12px] font-body text-charcoal-ink/45">
                Publish is the only live approval action in this phase.
              </p>
            </div>
          </div>

          <div
            className="mt-5 rounded-2xl px-4 py-3"
            style={{ backgroundColor: '#fbfaf8', border: `1px solid ${colors.parchment}` }}
          >
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: colors.amethyst }} />
              <div>
                <p className="text-[13px] font-body text-charcoal-ink">
                  The subject editor below remains the compatibility input path. After changing subjects,
                  use <span style={{ color: colors.amethyst }}>Refresh From Subjects</span> here to regenerate the weekly preview.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-[17px] font-display text-charcoal-ink">
                  Weekly Blocks
                </h4>
                <p className="mt-1 text-[13px] font-body text-charcoal-ink/45">
                  Edit only what needs attention before publish. This first surface is intentionally narrow.
                </p>
              </div>
              {loading ? (
                <div className="text-[12px] font-label uppercase tracking-[0.16em]" style={{ color: colors.amethyst }}>
                  Loading...
                </div>
              ) : null}
            </div>

            {!editableBlocks.length ? (
              <div
                className="rounded-2xl px-5 py-5"
                style={{ backgroundColor: '#fbfaf8', border: `1px solid ${colors.parchment}` }}
              >
                <p className="text-[14px] font-body text-charcoal-ink">
                  No active subject blocks are available for this student-week yet.
                </p>
                <p className="mt-1 text-[13px] font-body text-charcoal-ink/50">
                  Assign at least one active subject below, then refresh this weekly-plan surface.
                </p>
              </div>
            ) : (
              <div
                className="space-y-3 overflow-y-auto pr-1"
                style={{ maxHeight: '34rem' }}
              >
                {editableBlocks.map((block, index) => (
                  <div
                    key={block.id}
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: '#fbfaf8', border: `1px solid ${colors.parchment}` }}
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] font-label"
                        style={{ backgroundColor: colors.lavenderTint, color: colors.amethyst }}
                      >
                        {block.legacy_subject_title || 'Subject'}
                      </span>
                      <span className="text-[12px] font-body text-charcoal-ink/45">
                        Block {Number.isInteger(block.legacy_block_index) ? block.legacy_block_index + 1 : index + 1}
                      </span>
                      <span className="text-[12px] font-body text-charcoal-ink/45">
                        {block.planned_duration_minutes || 0} min
                      </span>
                      <span className="text-[12px] font-body text-charcoal-ink/45">
                        {block.completion_mode || 'time_boxed'}
                      </span>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
                      <div>
                        <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] font-label text-charcoal-ink/40">
                          Block Title
                        </label>
                        <input
                          type="text"
                          value={block.title || ''}
                          onChange={(event) => handleBlockFieldChange(block.id, 'title', event.target.value)}
                          disabled={!blocksAreEditable}
                          className="w-full rounded-xl px-3 py-2.5 text-[14px] font-body focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                          style={{ border: `1px solid ${colors.parchment}`, backgroundColor: '#ffffff', color: colors.charcoal }}
                          placeholder={block.legacy_subject_title || `Block ${index + 1}`}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] font-label text-charcoal-ink/40">
                          Instruction
                        </label>
                        <textarea
                          value={block.instruction || ''}
                          onChange={(event) => handleBlockFieldChange(block.id, 'instruction', event.target.value)}
                          disabled={!blocksAreEditable}
                          rows={3}
                          className="w-full rounded-xl px-3 py-2.5 text-[14px] font-body focus:outline-none resize-none disabled:cursor-not-allowed disabled:opacity-70"
                          style={{ border: `1px solid ${colors.parchment}`, backgroundColor: '#ffffff', color: colors.charcoal }}
                          placeholder="Add a student-facing note only when this week needs one."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default WeeklyPlanReviewPanel;
