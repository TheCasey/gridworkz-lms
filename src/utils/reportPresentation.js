// Browser-safe presentation shared by the Reports screen and every print path.
// Inputs are structured records only: record content never enters HTML unescaped.
export const escapeReportText = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const array = (value) => Array.isArray(value) ? value : [];
const number = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
const duration = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const string = (value) => typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
export const reportDate = (value) => {
  if (value == null || value === '') return null;
  const date = value?.toDate?.() || (typeof value?.seconds === 'number' ? new Date(value.seconds * 1000) : new Date(value));
  return Number.isFinite(date.getTime()) ? date : null;
};
export const formatReportDate = (value, timeZone = 'UTC', dateOnly = false) => {
  const date = reportDate(value);
  if (!date) return 'Not recorded';
  const options = { timeZone, year: 'numeric', month: 'short', day: 'numeric', ...(dateOnly ? {} : { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) };
  try { return new Intl.DateTimeFormat('en-US', options).format(date); }
  catch { return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date); }
};
const evidenceItem = (item = {}) => ({
  id: item.submissionId || item.id || '', text: item.summaryText ?? item.summary_text ?? item.text ?? '',
  date: item.submittedAt ?? item.timestamp ?? item.date ?? null,
  minutes: duration(item.durationMinutes ?? item.block_duration ?? item.duration),
  manual: Boolean(item.manualOverride ?? item.manual_override), blockNumber: item.blockNumber ?? (Number.isInteger(item.block_index) ? item.block_index + 1 : null),
  responses: item.customFieldResponses || item.custom_field_responses || {}, resources: array(item.resourcesUsed || item.resources_used),
});
const correctionItem = (item = {}) => ({ id: item.id || '', blockId: item.weekly_block_id || '',
  before: item.prior_status || '', after: item.new_status || '', reason: item.reason || '', note: item.note || '',
  actor: item.actor_id || '', date: item.recorded_at || null, evidenceIds: array(item.original_evidence_ids) });
const assignedItem = (item, subjects) => ({
  id: item.blockId, subjectId: item.legacySubjectId || '',
  subjectTitle: item.legacySubjectTitle || subjects.find((subject) => subject.id === item.legacySubjectId)?.title || 'School work',
  title: item.title || item.legacySubjectTitle || subjects.find((subject) => subject.id === item.legacySubjectId)?.title || 'School block',
  number: Number.isInteger(item.legacyBlockIndex) ? item.legacyBlockIndex + 1 : null,
  instruction: item.instruction || '', completed: Boolean(item.completed), provenance: item.completionProvenance || '',
  resources: array(item.resources), requireInput: Boolean(item.requireInput), customFields: array(item.customFields), correctionId: item.correctionEventId || '',
  evidenceIds: array(item.evidenceIds), evidence: array(item.originalEvidence).length ? item.originalEvidence.map(evidenceItem)
    : item.matchedSubmissionSummary ? [evidenceItem(item.matchedSubmissionSummary)] : [],
});
// Older report writers stored both a summary projection without an ID and a
// richer assigned-block projection with the submission ID. Pair only an exact,
// timestamped same-block projection; ambiguous or unmatched history stays visible.
const sameLegacyEvidenceProjection = (legacy, evidence) => !legacy.id && evidence.id
  && Number.isInteger(legacy.blockNumber) && legacy.blockNumber === evidence.blockNumber
  && reportDate(legacy.date) !== null && reportDate(legacy.date)?.getTime() === reportDate(evidence.date)?.getTime()
  && legacy.text === evidence.text && legacy.minutes === evidence.minutes && legacy.manual === evidence.manual;
const finish = (model) => {
  for (const block of model.blocks) {
    block.evidence = block.evidence.map((item) => ({ ...item, blockNumber: item.blockNumber ?? block.number, resources: item.resources.map((resource) => Number.isInteger(resource) && block.resources[resource] ? block.resources[resource] : resource) }));
  }
  // Prefer richer frozen evidence by immutable ID or an exact legacy projection.
  // Presentation pairing never assigns completion state or a new block identity.
  for (const subject of model.subjects) {
    const entries = [...subject.evidence];
    for (const item of model.blocks.filter((block) => block.subjectId === subject.id).flatMap((block) => block.evidence)) {
      const identityIndex = item.id ? entries.findIndex((entry) => entry.id === item.id) : -1;
      const index = identityIndex >= 0 ? identityIndex : entries.findIndex((entry) => sameLegacyEvidenceProjection(entry, item));
      if (index >= 0) entries[index] = item;
      else entries.push(item);
    }
    subject.evidence = entries;
  }
  const evidence = [...model.subjects.flatMap((subject) => subject.evidence), ...model.blocks.filter((block) => !model.subjects.some((subject) => subject.id === block.subjectId)).flatMap((block) => block.evidence)];
  const unknown = evidence.filter((item) => item.minutes === null).length;
  const allUnknown = evidence.length > 0 && evidence.every((item) => item.minutes === null) && model.recordedMinutes === 0;
  return { ...model, incomplete: Math.max(0, model.assigned - model.completed), unknownDurationCount: unknown,
    timeLabel: allUnknown || !model.hasRecordedTimeTotal ? 'Duration not recorded' : `${model.recordedMinutes} recorded min${unknown ? ' · some durations not recorded' : ''}` };
};
export const buildLiveReportPresentation = ({ student, snapshot, weekStart, weekEnd, schoolWeek, timeZone = 'UTC' }) => {
  const subjects = array(snapshot?.subjectData).map(({ subject, blocks, completedCount, totalCount }) => ({
    id: subject.id, title: subject.title, completed: number(completedCount), assigned: number(totalCount), evidence: array(blocks).map(evidenceItem),
  }));
  const blocks = array(snapshot?.assignedBlocksSnapshot).map((block) => assignedItem(block, subjects));
  // The canonical parent read contains all original evidence, including non-summary responses.
  for (const block of blocks) {
    const entry = schoolWeek?.entries?.find((item) => item.block.id === block.id);
    if (entry) block.evidence = array(entry.evidence).map(evidenceItem);
  }
  const events = [...new Map(array(schoolWeek?.entries).flatMap((entry) => array(entry.events)).map((event) => [event.id, event])).values()];
  return finish({ studentName: student.name || '', studentId: student.id,
    weekStart: schoolWeek?.plan?.week_start || weekStart, weekEnd: schoolWeek?.plan?.week_end || schoolWeek?.plan?.week_ending || weekEnd,
    timeZone: schoolWeek?.plan?.timezone || timeZone,
    versionLabel: 'Live weekly view', version: null, versionActor: '', versionDate: null, originalDate: null, originalId: '', notes: [],
    assigned: number(snapshot?.goalBlocks), completed: number(snapshot?.totalBlocks), recordedMinutes: number(snapshot?.totalMinutes),
    hasRecordedTimeTotal: true, countsRequireReview: false, subjects, blocks, corrections: events.map(correctionItem), correctionIds: events.map((item) => item.id),
    overlays: [], attachments: [], publishedRevision: snapshot?.publishedRevision ?? schoolWeek?.plan?.published_revision ?? null,
    correctionWatermark: snapshot?.correctionWatermark ?? { school_state_revision: null, event_ids: events.map((item) => item.id) },
  });
};
export const buildSavedReportPresentation = ({ original, amendment = null, timeZone = 'UTC' }) => {
  const selected = amendment?.snapshot || original;
  const subjects = Object.entries(selected.subjects_data || {}).map(([id, item]) => ({ id, title: item.subjectTitle || 'School work',
    completed: number(item.totalBlocks), assigned: number(item.goalBlocks), evidence: array(item.evidence_snapshot).length
      ? item.evidence_snapshot.map(evidenceItem) : array(item.summaries).map(evidenceItem) }));
  if (!subjects.length && array(selected.summaries).length) subjects.push({ id: '__legacy_summaries__', title: 'Recorded work', completed: number(selected.total_blocks), assigned: number(selected.weekly_goal), evidence: selected.summaries.map((text) => evidenceItem(typeof text === 'string' ? { text } : text)) });
  const blocks = array(selected.assigned_blocks_snapshot).map((block) => assignedItem(block, subjects));
  const events = array(amendment?.correction_events || selected.correction_events || selected.correction_events_snapshot);
  return finish({ studentName: selected.student_name || original.student_name || '', studentId: original.student_id,
    weekStart: selected.week_start || original.week_start, weekEnd: selected.week_end || selected.week_ending || original.week_end || original.week_ending,
    timeZone: selected.timezone || selected.report_timezone || selected.household_timezone || timeZone,
    versionLabel: amendment ? `Amendment · Version ${amendment.report_version}` : 'Original saved report · Version 1',
    version: amendment?.report_version || 1, versionActor: amendment?.actor_id || '', notes: selected.parent_notes ? [string(selected.parent_notes)] : [], versionDate: amendment?.recorded_at || original.created_at, originalDate: original.created_at,
    originalId: original.id || original.original_report_id || '',
    assigned: number(selected.weekly_goal), completed: number(selected.total_blocks),
    recordedMinutes: typeof selected.total_minutes === 'number' ? number(selected.total_minutes)
      : Object.values(selected.subjects_data || {}).some((item) => typeof item.totalMinutes === 'number')
        ? Object.values(selected.subjects_data || {}).reduce((sum, item) => sum + number(item.totalMinutes), 0) : Math.round(number(selected.total_hours) * 60),
    hasRecordedTimeTotal: typeof selected.total_minutes === 'number' || typeof selected.total_hours === 'number' || Object.values(selected.subjects_data || {}).some((item) => typeof item.totalMinutes === 'number'), countsRequireReview: Boolean(selected.completion_counts_require_review), subjects, blocks,
    corrections: events.map(correctionItem), correctionIds: array(amendment?.correction_event_ids || selected.correction_event_ids),
    overlays: Object.entries(selected.block_completion_overrides || {}).map(([id, item]) => ({ id, ...item })),
    attachments: array(selected.attachments), publishedRevision: selected.published_revision ?? null,
    correctionWatermark: selected.correction_watermark ?? selected.school_state_revision ?? null,
  });
};
export const reportEvidenceText = (item) => {
  if (!item || typeof item !== 'object') return string(item);
  const label = item.label ?? item.title ?? item.name;
  const reference = item.url ?? item.id;
  return [label, reference].filter((value) => value != null).map(string).join(' · ') || string(item);
};
export const reportHasRequiredResponse = (block) => {
  if (['parent_correction', 'legacy_parent'].includes(block.provenance)) return true;
  const latest = block.evidence.at(-1);
  const present = (value) => typeof value === 'string' ? Boolean(value.trim()) : Array.isArray(value) ? value.length > 0 : typeof value === 'number' || typeof value === 'boolean';
  return (!block.requireInput || Boolean(String(latest?.text || '').trim()))
    && !array(block.customFields).some((field) => field.required && !present(latest?.responses[field.id]));
};

// Keep bounded entries intact, but never make a long response/resource section
// unbreakable. Newline limits also cover short strings with many visual rows.
export const isShortReportEvidence = (item) => {
  const content = [item.text, item.id, ...Object.entries(item.responses).flatMap(([key, value]) => [key, string(value)]), ...item.resources.map(reportEvidenceText)].map(string).join('\n');
  return content.length <= 1000 && content.split('\n').length <= 12 && Object.keys(item.responses).length <= 5;
};
const renderEvidence = (item, report, subjectTitle) => `<div class="evidence${isShortReportEvidence(item) ? ' is-short' : ''}"><p class="evidence-context">${escapeReportText(report.studentName)} · ${escapeReportText(formatReportDate(report.weekStart, report.timeZone, true))} · ${escapeReportText(subjectTitle)}${item.blockNumber ? ` · Block ${escapeReportText(item.blockNumber)}` : ''}</p><p class="meta">${item.manual ? 'Legacy parent record (actor not recorded)' : 'Student evidence'} · ${escapeReportText(formatReportDate(item.date, report.timeZone))} · ${item.minutes === null ? 'Duration not recorded' : `${escapeReportText(item.minutes)} recorded minutes`}</p>
${item.id ? `<p class="reference">Evidence ref: ${escapeReportText(item.id)}</p>` : ''}<p class="response">${escapeReportText(item.text || 'No written response')}</p>
${Object.entries(item.responses).map(([key, value]) => `<p class="response"><strong>${escapeReportText(key)}:</strong> ${escapeReportText(string(value))}</p>`).join('')}
${item.resources.length ? `<p class="reference">Resources used: ${item.resources.map((value) => escapeReportText(reportEvidenceText(value))).join('; ')}</p>` : ''}</div>`;
const renderReport = (report) => {
  const date = (value) => escapeReportText(formatReportDate(value, report.timeZone));
  const corrections = report.corrections.map((event) => `<div class="correction${isShortReportEvidence({ text: [event.reason, event.note, event.actor].join("\n"), id: event.id, responses: {}, resources: event.evidenceIds }) ? ' is-short' : ''}"><p><strong>Parent correction:</strong> ${escapeReportText(event.before)} → ${escapeReportText(event.after)}</p>
<p class="response">Reason: ${escapeReportText(event.reason || 'Not recorded')}</p>${event.note ? `<p class="response">Parent note: ${escapeReportText(event.note)}</p>` : ''}
<p class="meta">Parent ${escapeReportText(event.actor || 'Not recorded')} · ${date(event.date)}</p><p class="reference">Correction ref: ${escapeReportText(event.id)}${event.evidenceIds.length ? ` · Evidence refs: ${event.evidenceIds.map(escapeReportText).join(', ')}` : ''}</p></div>`).join('');
  const linkedIds = report.correctionIds.filter((id) => !report.corrections.some((event) => event.id === id));
  return `<section class="student-section"><h2>${escapeReportText(report.studentName)}</h2>
<p class="week">${date(report.weekStart)} – ${date(report.weekEnd)}</p>
<p class="version">${escapeReportText(report.versionLabel)}${report.versionDate ? ` · ${date(report.versionDate)}` : ''}</p>
${report.versionActor ? `<p class="meta">Amendment by parent ${escapeReportText(report.versionActor)}</p>` : ''}${report.originalId ? `<p class="reference">Original report ref: ${escapeReportText(report.originalId)} · Filed ${date(report.originalDate)}</p>` : ''}
${report.countsRequireReview ? '<p class="notice">Original recorded totals (require review)</p>' : ''}<div class="counts"><span><strong>${escapeReportText(report.assigned)}</strong> assigned</span><span><strong>${escapeReportText(report.completed)}</strong> completed</span><span><strong>${escapeReportText(report.incomplete)}</strong> incomplete</span></div>
${report.countsRequireReview ? '<p class="notice">Completion counts require review. Original numerical totals are retained as historical evidence; no corrected total is claimed.</p>' : ''}
<p class="meta">${escapeReportText(report.timeLabel)}. Parent corrections add no time.</p>
${report.publishedRevision != null || report.correctionWatermark != null ? `<p class="reference">Published revision: ${escapeReportText(report.publishedRevision ?? 'Not recorded')} · Correction watermark: ${escapeReportText(typeof report.correctionWatermark === 'object' && report.correctionWatermark !== null ? report.correctionWatermark.school_state_revision ?? 'Not recorded' : report.correctionWatermark ?? 'Not recorded')}</p>` : ''}
<h3>Assigned work</h3>${report.blocks.length ? report.blocks.map((block) => `<section class="block"><h4>${escapeReportText(block.subjectTitle)} · ${escapeReportText(block.title)}${block.number ? ` · Block ${escapeReportText(block.number)}` : ''}</h4>
<p>${block.completed ? 'Completed' : 'Incomplete'}${block.provenance === 'parent_correction' ? ' · Parent correction; timer and response requirements bypassed, no evidence or time added' : block.provenance === 'legacy_parent' ? ' · Legacy parent record (actor unknown)' : ''}</p>
${block.instruction ? `<p class="response">${escapeReportText(block.instruction)}</p>` : ''}
${block.completed && !reportHasRequiredResponse(block) ? '<p class="notice">Required response missing</p>' : ''}
${block.evidenceIds.length ? `<p class="reference">Original evidence refs: ${block.evidenceIds.map(escapeReportText).join(', ')}</p>` : ''}</section>`).join('')
  : report.subjects.map((subject) => `<p>${escapeReportText(subject.title)} · ${escapeReportText(subject.completed)}/${escapeReportText(subject.assigned)} completed</p>`).join('') || '<p>No assigned work recorded.</p>'}
<h3>Corrections &amp; parent notes</h3>${report.notes.map((note) => `<p class="response">Parent note (recorded snapshot): ${escapeReportText(note)}</p>`).join('')}${corrections || '<p class="meta">No correction details recorded in this version.</p>'}
${linkedIds.map((id) => `<p class="reference">Linked correction ref: ${escapeReportText(id)} (details not recorded in this snapshot)</p>`).join('')}
${report.overlays.map((item) => `<p>Corrected block ${escapeReportText((item.block_index ?? 0) + 1)}: ${escapeReportText(item.status)} · Parent correction, revision ${escapeReportText(item.revision)}</p>`).join('')}
<h3>Original evidence</h3>${report.subjects.map((subject) => `<section class="subject"><h4>${escapeReportText(report.studentName)} · ${escapeReportText(subject.title)}</h4>${subject.evidence.map((item) => renderEvidence(item, report, subject.title)).join('') || '<p class="meta">No written evidence recorded.</p>'}</section>`).join('')}
${report.blocks.filter((block) => block.evidence.length && !report.subjects.some((subject) => subject.id === block.subjectId && subject.evidence.length)).map((block) => `<section class="subject"><h4>${escapeReportText(report.studentName)} · ${escapeReportText(block.title)}</h4>${block.evidence.map((item) => renderEvidence(item, report, block.subjectTitle)).join('')}</section>`).join('')}
${report.attachments.length ? `<h3>Evidence references</h3>${report.attachments.map((item) => `<p class="reference">${escapeReportText(reportEvidenceText(item))}</p>`).join('')}` : ''}</section>`;
};
export const buildReportPrintHtml = ({ reports, title = 'Weekly Progress Report', context = '', generatedAt = new Date(), timeZone = 'UTC' }) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Own Path — ${escapeReportText(title)}</title><style>
@page{margin:16mm 15mm 18mm;@top-left{content:"Own Path · Weekly reports";font:9pt Arial,sans-serif;color:#666}@bottom-left{content:"Own Path · Weekly reports";font:9pt Arial,sans-serif;color:#666}@bottom-right{content:"Page " counter(page) " of " counter(pages);font:9pt Arial,sans-serif;color:#666}}
*{box-sizing:border-box}body{margin:0 auto;padding:28px;max-width:900px;font:11pt/1.5 'Super Sans VF',Arial,sans-serif;color:#292827;background:white;overflow-wrap:anywhere}h1{font-size:23pt;color:#1b1938}h2{font-size:18pt;color:#1b1938}h3{font-size:12pt;color:#714cb6;border-bottom:1px solid #dcd7d3;padding-bottom:4px;margin-top:22px}h4{font-size:11pt;margin:12px 0 5px}p{margin:5px 0}h1,h2,h3,h4{break-inside:avoid;page-break-inside:avoid}h1,h2,h3,h4,.version,.counts{break-after:avoid;page-break-after:avoid}header{border-bottom:2px solid #714cb6;padding-bottom:16px;margin-bottom:24px}.brand{font-size:9pt;letter-spacing:2px;color:#714cb6}.student-section{border-bottom:1px solid #dcd7d3;padding:0 0 24px;margin-bottom:24px;break-inside:auto}.student-section:last-child{border-bottom:0;margin-bottom:0}.week,.version{color:#714cb6}.counts{display:flex;flex-wrap:wrap;gap:20px;padding:10px 0}.counts strong{font-size:16pt}.meta,.reference{font-size:9pt;color:#595354}.reference{overflow-wrap:anywhere}.evidence-context{font-size:9pt;color:#714cb6;break-after:avoid;page-break-after:avoid}.block{padding:7px 0;border-bottom:1px solid #e9e5dd}.response{white-space:pre-wrap;overflow-wrap:anywhere;orphans:3;widows:3}.evidence,.correction{border-left:3px solid #cbb7fb;padding:8px 12px;margin:10px 0;break-inside:auto}.notice{background:#f0eaff;padding:8px;font-size:10pt}footer{margin-top:20px;font-size:9pt;color:#595354}@media print{body{max-width:none;padding:0}.student-section,.subject,.block,.evidence,.correction{break-inside:auto;page-break-inside:auto}.evidence.is-short,.correction.is-short{break-inside:avoid;page-break-inside:avoid}h2,h3,h4{orphans:3;widows:3}a{color:inherit}}
</style></head><body><header><p class="brand">OWN PATH LMS</p><h1>${escapeReportText(title)}</h1>${context ? `<p>${escapeReportText(context)}</p>` : ''}<p class="meta">Generated ${escapeReportText(formatReportDate(generatedAt, timeZone))} · Household timezone ${escapeReportText(timeZone)}</p></header>${array(reports).map(renderReport).join('')}</body></html>`;

export const openReportPrintWindow = (options) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.document.write(buildReportPrintHtml(options));
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 400);
  return true;
};
