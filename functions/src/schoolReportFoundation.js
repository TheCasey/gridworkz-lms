// Build an official snapshot from the transaction's authoritative assignments,
// effective states and original evidence. Never accept client status/time totals.
const millis = (value) => value?.toMillis?.() ?? value?.getTime?.() ?? new Date(value).getTime();
const recordedMinutes = (item) => Number.isFinite(item?.block_duration) && item.block_duration >= 0 ? item.block_duration : 0;
const schoolYearMetadata = (date, settings) => {
  const startKey = settings.school_year_start; const endKey = settings.school_year_end;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey || '') || !/^\d{4}-\d{2}-\d{2}$/.test(endKey || '')) return {};
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: settings.timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const key = `${parts.year}-${parts.month}-${parts.day}`;
  if (key < startKey || key > endKey) return {};
  const start = Date.parse(`${startKey}T00:00:00Z`); const end = Date.parse(`${endKey}T00:00:00Z`); const day = Date.parse(`${key}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return {};
  const days = Math.floor((end - start) / 86400000) + 1; const base = Math.floor(days / 4); const extra = days % 4;
  let cursor = start; let quarter = null;
  for (let index = 0; index < 4; index++) { const size = base + Number(index < extra); if (day >= cursor && day < cursor + size * 86400000) quarter = index + 1; cursor += size * 86400000; }
  return { school_year_label: startKey.slice(0, 4) === endKey.slice(0, 4) ? startKey.slice(0, 4) : `${startKey.slice(0, 4)}-${endKey.slice(0, 4)}`,
    school_year_start: new Date(start), school_year_end: new Date(end + 86399999), school_quarter: quarter, school_quarter_label: quarter ? `Q${quarter}` : '' };
};
export const buildTrustedSchoolReport = ({ id, parent, student, plan, states, evidence, weekStart, weekEnd, schoolRevision, serverTime, source }) => {
  const byEvidence = new Map(evidence.map((item) => [item.id, item]));
  const subjects = {};
  const assigned = plan.blocks.map((block) => {
    const state = states.find((item) => item.weekly_block_id === block.id);
    const originals = state.original_evidence_ids.map((key) => byEvidence.get(key)).filter(Boolean).sort((a, b) => millis(a.timestamp) - millis(b.timestamp));
    const latest = originals.at(-1);
    const subjectId = block.legacy_subject_id;
    subjects[subjectId] ||= { subjectId, subjectTitle: block.legacy_subject_title || block.title || 'School work', totalBlocks: 0, goalBlocks: 0, totalMinutes: 0, summaries: [], evidence: new Set() };
    const subject = subjects[subjectId]; subject.goalBlocks++; subject.totalBlocks += Number(state.status === 'completed');
    originals.forEach((item) => {
      if (subject.evidence.has(item.id)) return;
      subject.evidence.add(item.id); subject.totalMinutes += recordedMinutes(item);
      if (item.summary_text) subject.summaries.push({ text: item.summary_text, blockNumber: (item.block_index ?? 0) + 1, date: item.timestamp,
        duration: Number.isFinite(item.block_duration) ? item.block_duration : null, manualOverride: Boolean(item.manual_override), submissionId: item.id });
    });
    return { blockId: block.id, assignmentId: block.assignment_id, title: block.title || '', instruction: block.instruction || '', category: block.category || '',
      completionMode: block.completion_mode || '', plannedDurationMinutes: block.planned_duration_minutes || 0, requireTimer: Boolean(block.require_timer), requireInput: Boolean(block.require_input),
      customFields: block.custom_fields || [], resources: block.resources || [], legacySubjectId: subjectId, legacySubjectTitle: block.legacy_subject_title || '', legacyBlockIndex: block.legacy_block_index,
      completed: state.status === 'completed', completionStatus: state.status, completionProvenance: state.provenance, completionActorId: state.actor_id,
      completedAt: state.completed_at, stateRevision: state.revision, correctionEventId: state.last_correction_event_id,
      evidenceIds: [...state.original_evidence_ids], matchedSubmissionSummary: latest ? { submissionId: latest.id, summaryText: latest.summary_text || '', submittedAt: latest.timestamp,
        durationMinutes: Number.isFinite(latest.block_duration) ? latest.block_duration : null, manualOverride: Boolean(latest.manual_override), resourcesUsed: latest.resources_used || [], customFieldResponses: latest.custom_field_responses || {} } : null };
  });
  const subjectValues = Object.values(subjects);
  return { id, parent_id: plan.parent_id, student_id: student.id, student_name: student.name || '', week_key: plan.week_key, weekly_plan_id: plan.id,
    week_start: weekStart, week_end: weekEnd, week_ending: weekEnd, weekly_goal: assigned.length, total_blocks: assigned.filter((item) => item.completed).length,
    total_hours: Math.round(subjectValues.reduce((sum, item) => sum + item.totalMinutes, 0) / 60 * 10) / 10,
    subject_ids: Object.keys(subjects), subject_titles: subjectValues.map((item) => item.subjectTitle),
    subjects_data: Object.fromEntries(Object.entries(subjects).map(([key, { evidence: refs, ...item }]) => [key, item])),
    assigned_blocks_snapshot: assigned, summaries: subjectValues.flatMap((item) => item.summaries.map((summary) => summary.text)), attachments: [], snapshot_model: 'weekly_plan',
    school_year_label: '', school_year_start: null, school_year_end: null, school_quarter: null, school_quarter_label: '', ...schoolYearMetadata(weekEnd, parent),
    report_version: 1, original_report_id: id, school_state_revision: schoolRevision, authority_version: 1, record_source: source, created_at: serverTime };
};
