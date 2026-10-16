// Synthetic, stable print fixtures. No production household identifiers or text.
const weekStart = new Date('2026-10-12T05:00:00Z');
const weekEnd = new Date('2026-10-19T04:59:59.999Z');
const generatedAt = new Date('2026-10-20T17:00:00Z');
const dangerous = '<script>window.__reportInjected = true</script> & "quoted" <img src=x onerror=alert(1)>';
const resource = `https://example.test/${'long-reference-'.repeat(45)}`;
export const buildDirectionReportVisualFixtures = () => {
  const subjects = {}; const assigned = [];
  for (let subjectIndex = 0; subjectIndex < 8; subjectIndex++) {
    const subjectId = `print-subject-${subjectIndex}`;
    const summaries = [];
    for (let index = 0; index < 4; index++) {
      const completed = index % 2 === 0;
      const text = subjectIndex === 0 && index === 0
        ? `${dangerous}\n${'This long student reflection explains a method, an example, a correction, and the evidence used to check the work. '.repeat(35)}\nFinal reflection line stays visible.`
        : `Student reflection for subject ${subjectIndex + 1}, block ${index + 1}: I explained the steps and checked the answer with a worked example.`;
      const evidence = completed ? [{ submissionId: `evidence-${subjectIndex}-${index}`, summaryText: text, submittedAt: generatedAt,
        durationMinutes: index === 0 ? 12 : 0, manualOverride: false, provenance: 'student', actorId: 'print-student',
        resourcesUsed: subjectIndex === 0 ? [0] : [], customFieldResponses: { explanation: `Worked example\n${dangerous}` } }] : [];
      if (evidence.length) summaries.push({ text, blockNumber: index + 1, date: generatedAt, duration: evidence[0].durationMinutes, submissionId: evidence[0].submissionId });
      assigned.push({ blockId: `print-block-${subjectIndex}-${index}`, assignmentId: `assignment-${subjectIndex}`, legacySubjectId: subjectId,
        legacySubjectTitle: `Subject ${subjectIndex + 1}: a detailed curriculum title`, legacyBlockIndex: index,
        title: `Block ${index + 1}: ${subjectIndex === 0 ? dangerous : 'Practice and explanation'}`, instruction: 'Explain your reasoning and preserve the original evidence.',
        completed, completionStatus: completed ? 'completed' : 'incomplete', completionProvenance: completed ? 'student' : null,
        completionActorId: completed ? 'print-student' : null, completedAt: completed ? generatedAt : null,
        stateRevision: Number(completed), requireInput: true, requireTimer: index === 0, customFields: [{ id: 'explanation', label: 'Explain the steps', required: true }],
        plannedDurationMinutes: 12, evidenceIds: evidence.map((item) => item.submissionId), originalEvidence: evidence, matchedSubmissionSummary: evidence[0] || null,
        resources: [{ name: 'A long evidence reference', url: resource }] });
    }
    subjects[subjectId] = { subjectId, subjectTitle: `Subject ${subjectIndex + 1}: a detailed curriculum title`, totalBlocks: 2, goalBlocks: 4, totalMinutes: 12, summaries };
  }
  const original = { id: 'print-original', parent_id: 'print-parent', student_id: 'print-student',
    student_name: `Avery Alexandra ${'Long-Student-Name '.repeat(5).trim()}`, week_key: '2026-10-12', week_start: weekStart, week_end: weekEnd, week_ending: weekEnd,
    weekly_plan_id: 'print-plan', published_revision: 3, school_authority_kind: 'published', school_state_revision: 16,
    report_version: 1, original_report_id: 'print-original', authority_version: 1, timezone: 'America/Chicago',
    snapshot_model: 'weekly_plan', weekly_goal: assigned.length, total_blocks: 16, total_hours: 1.6, subjects_data: subjects,
    assigned_blocks_snapshot: assigned, subject_ids: Object.keys(subjects), subject_titles: Object.values(subjects).map((item) => item.subjectTitle),
    correction_events: [], correction_watermark: { school_state_revision: 16, event_ids: [] },
    parent_notes: `Parent observation: ${dangerous}\nA separate note remains legible and does not alter the student's original reflection.`, created_at: generatedAt };
  const correction = { id: 'print-undo-event', weekly_plan_id: 'print-plan', weekly_block_id: assigned[0].blockId,
    prior_status: 'completed', new_status: 'incomplete', reason: `Review another example ${dangerous}`, note: 'Original response and recorded minutes remain part of the evidence.\nComplete a new attempt after review.',
    actor_id: 'print-parent', recorded_at: generatedAt, revision: 2 };
  const changedSubject = { ...subjects['print-subject-0'], totalBlocks: 1 };
  const amendment = { id: 'print-amendment-2', original_report_id: original.id, previous_report_version_id: original.id,
    parent_id: original.parent_id, student_id: original.student_id, weekly_plan_id: original.weekly_plan_id, week_key: original.week_key,
    report_version: 2, actor_id: 'print-parent', recorded_at: generatedAt, correction_event_ids: [correction.id],
    snapshot: { ...original, total_blocks: 15, school_state_revision: 17, subjects_data: { ...subjects, 'print-subject-0': changedSubject },
      assigned_blocks_snapshot: assigned.map((item, index) => index === 0 ? { ...item, completed: false, completionStatus: 'incomplete', completionProvenance: 'parent_correction',
        completionActorId: 'print-parent', completedAt: null, stateRevision: 2, correctionEventId: correction.id } : item),
      correction_events: [correction], correction_watermark: { school_state_revision: 17, event_ids: [correction.id] } } };
  const zero = { ...original, id: 'print-zero', original_report_id: 'print-zero', student_name: 'Zero completion student',
    total_blocks: 0, total_hours: 0, subjects_data: Object.fromEntries(Object.entries(subjects).slice(0, 2).map(([id, item]) => [id, { ...item, totalBlocks: 0, totalMinutes: 0, summaries: [] }])),
    assigned_blocks_snapshot: assigned.slice(0, 8).map((item) => ({ ...item, completed: false, completionStatus: 'incomplete', completionProvenance: null, completionActorId: null,
      originalEvidence: [], matchedSubmissionSummary: null, evidenceIds: [] })), weekly_goal: 8 };
  const legacy = { ...original, id: 'print-legacy', original_report_id: 'print-legacy', student_name: 'Legacy household record', snapshot_model: 'subjects', weekly_plan_id: '',
    assigned_blocks_snapshot: [], weekly_goal: 8, total_blocks: 1, total_hours: 0, subjects_data: { history: { subjectId: 'history', subjectTitle: 'Historical subject', totalBlocks: 1, goalBlocks: 8, totalMinutes: 0,
      summaries: [{ text: `Legacy parent note with unknown actor/time/duration. ${dangerous}`, blockNumber: 1, date: null, duration: null, manualOverride: true }] } } };
  const legacyAmendment = { ...amendment, id: 'print-legacy-amendment', original_report_id: legacy.id, previous_report_version_id: legacy.id,
    snapshot: { ...legacy, completion_counts_require_review: true, correction_events: [correction], block_completion_overrides: { 'legacy-unknown-block': { subject_id: 'history', block_index: 0, status: 'incomplete', revision: 1, provenance: 'parent_correction' } } } };
  return { generatedAt, cases: [
    { key: 'long-original', original, amendment: null },
    { key: 'long-amendment', original, amendment },
    { key: 'zero', original: zero, amendment: null },
    { key: 'legacy-review', original: legacy, amendment: legacyAmendment },
  ] };
};
