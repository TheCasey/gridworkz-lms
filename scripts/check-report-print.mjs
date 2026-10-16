import assert from 'node:assert/strict';
import { buildLiveReportPresentation, buildSavedReportPresentation, buildReportPrintHtml, formatReportDate, reportHasRequiredResponse, isShortReportEvidence } from '../src/utils/reportPresentation.js';
const attack = '<img src=x onerror="alert(1)"> & \'quoted\'';
const start = new Date('2026-10-12T05:00Z');
const end = new Date('2026-10-19T04:59:59.999Z');
const submitted = { submissionId: 'evidence<1>', summaryText: attack, submittedAt: start, durationMinutes: null,
  customFieldResponses: { [attack]: attack }, resourcesUsed: [{ url: 'javascript:alert(1)', title: attack }] };
const block = { blockId: 'block', title: attack, instruction: attack, completed: false, requireInput: true,
  legacySubjectId: 'subject', legacyBlockIndex: 0, evidenceIds: ['evidence<1>'], originalEvidence: [submitted], matchedSubmissionSummary: submitted };
const original = { id: 'report<1>', student_id: 'student', student_name: attack, week_start: start, week_end: end,
  total_blocks: 1, weekly_goal: 1, total_hours: 0, timezone: 'America/Chicago', created_at: start,
  subjects_data: { subject: { subjectTitle: attack, totalBlocks: 1, goalBlocks: 1, summaries: [{ submissionId: 'evidence<1>', text: attack, duration: null }] } },
  assigned_blocks_snapshot: [{ ...block, completed: true }], attachments: [{ title: attack }], published_revision: 5 };
const correction = { id: 'event<1>', weekly_block_id: 'block', prior_status: 'completed', new_status: 'incomplete', reason: attack, note: attack, actor_id: attack, recorded_at: end };
const amendment = { id: 'amendment', report_version: 2, actor_id: attack, recorded_at: end, correction_event_ids: ['event<1>'],
  snapshot: { ...original, total_blocks: 0, assigned_blocks_snapshot: [block], correction_events: [correction], correction_watermark: { school_state_revision: 7, event_ids: ['event<1>'] } } };
const saved = buildSavedReportPresentation({ original, amendment });
assert.equal(saved.completed, 0); assert.equal(saved.assigned, 1); assert.equal(saved.incomplete, 1);
assert.equal(saved.subjects[0].evidence.length, 1);
assert.equal(saved.subjects[0].evidence[0].blockNumber, 1);
assert.equal(saved.blocks[0].subjectTitle, attack);
assert(isShortReportEvidence(saved.subjects[0].evidence[0]));
assert(!isShortReportEvidence({ ...saved.subjects[0].evidence[0], text: 'Long response '.repeat(100) }));
assert(!isShortReportEvidence({ ...saved.subjects[0].evidence[0], text: 'Line\n'.repeat(30) })); // rich evidence replaces summary, not appended twice
assert.equal(saved.subjects[0].evidence[0].responses[attack], attack);
assert.equal(saved.timeLabel, 'Duration not recorded');
const exactMinutes = buildSavedReportPresentation({ original: { ...original, subjects_data: { subject: { totalMinutes: 1 } } } });
assert.equal(exactMinutes.recordedMinutes, 1);
const fieldRequired = { ...block, completed: true, originalEvidence: [{ ...submitted, summaryText: '', customFieldResponses: { required: false } }], customFields: [{ id: 'required', required: true }] };
assert(!reportHasRequiredResponse(buildSavedReportPresentation({ original: { ...original, assigned_blocks_snapshot: [fieldRequired] } }).blocks[0]));
const resourceRef = buildSavedReportPresentation({ original: { ...original, parent_notes: attack, assigned_blocks_snapshot: [{ ...block, resources: [{ title: attack, url: 'https://example.test/reference' }], originalEvidence: [{ ...submitted, resourcesUsed: [0] }] }] } });
assert(buildReportPrintHtml({ reports: [resourceRef] }).includes('https://example.test/reference'));
assert(buildReportPrintHtml({ reports: [resourceRef] }).includes('Parent note (recorded snapshot)'));

const html = buildReportPrintHtml({ reports: [saved], generatedAt: start, timeZone: 'America/Chicago', title: attack, context: attack });
assert(!html.includes('<img')); assert(html.includes('&lt;img')); assert(!html.includes('href="javascript:'));
for (const expected of ['Amendment · Version 2', 'Oct 18, 2026', 'Parent correction:', 'Reason:', 'Parent note:', 'Evidence ref:', 'Original report ref:', 'Original evidence', 'Duration not recorded', 'Correction watermark: 7']) assert(html.includes(expected), expected);
assert(html.includes('break-inside:auto')); assert(html.includes('.evidence.is-short,.correction.is-short{break-inside:avoid;page-break-inside:avoid}')); assert(!html.includes('[object Object]'));
assert.equal((html.match(/&lt;img/g) || []).length > 8, true);
const live = buildLiveReportPresentation({ student: { id: 'student', name: attack }, weekStart: start, weekEnd: end,
  snapshot: { totalBlocks: 0, goalBlocks: 1, totalMinutes: 0, subjectData: [{ subject: { id: 'subject', title: attack }, blocks: [], completedCount: 0, totalCount: 1 }], assignedBlocksSnapshot: [block] },
  schoolWeek: { entries: [{ block: { id: 'block' }, evidence: [{ id: submitted.submissionId, summary_text: attack, block_duration: undefined, timestamp: start }], events: [correction] }] } });
assert.equal(live.completed, saved.completed); assert.equal(live.incomplete, saved.incomplete);
assert(buildReportPrintHtml({ reports: [live] }).includes('&lt;img'));
const parent = { ...block, completed: true, completionProvenance: 'parent_correction', originalEvidence: [], matchedSubmissionSummary: null };
const parentReport = buildSavedReportPresentation({ original: { ...original, subjects_data: {}, assigned_blocks_snapshot: [parent] } });
assert(reportHasRequiredResponse(parentReport.blocks[0]));
assert(!buildReportPrintHtml({ reports: [parentReport] }).includes('Required response missing'));
const unknownLegacy = buildSavedReportPresentation({ original: { student_name: 'Legacy', total_blocks: 1, weekly_goal: 1, subjects_data: { subject: { subjectTitle: 'Legacy subject', summaries: [{ text: 'Preserved', duration: null }] } } } });
assert.equal(unknownLegacy.timeLabel, 'Duration not recorded');
assert(buildReportPrintHtml({ reports: [unknownLegacy] }).includes('Preserved'));
const ambiguous = buildSavedReportPresentation({ original, amendment: { ...amendment, snapshot: { ...amendment.snapshot, completion_counts_require_review: true } } });
const ambiguousHtml = buildReportPrintHtml({ reports: [ambiguous] });
assert(ambiguousHtml.includes('no corrected total is claimed')); assert(ambiguousHtml.includes('&lt;img')); assert(ambiguousHtml.includes('Reason:'));
assert.equal(formatReportDate(null), 'Not recorded'); assert.equal(formatReportDate('invalid'), 'Not recorded');
assert.equal(formatReportDate(start, 'America/Chicago', true), 'Oct 12, 2026');
const maliciousModel = { ...saved, studentName: attack, versionLabel: attack, subjects: [{ id: 's', title: attack, evidence: [] }], blocks: [], corrections: [], correctionIds: [attack], overlays: [{ block_index: 0, status: attack, revision: attack }], attachments: [attack] };
assert(!buildReportPrintHtml({ reports: [maliciousModel] }).includes('<img'));
console.log('Report print: effective zero-completion evidence, original/amended provenance, unknown duration, parent bypass, rich response/resource preservation, escaping and deterministic household dates passed.');

const changedReset = buildLiveReportPresentation({ student: { id: 'student', name: 'Student' }, snapshot: {},
  weekStart: new Date('2026-10-12T14:00Z'), weekEnd: new Date('2026-10-19T13:59:59Z'), timeZone: 'UTC',
  schoolWeek: { plan: { week_start: start, week_end: end, timezone: 'America/Chicago' } } });
assert.equal(changedReset.weekStart, start); assert.equal(changedReset.weekEnd, end); assert.equal(changedReset.timeZone, 'America/Chicago');
assert(buildReportPrintHtml({ reports: [changedReset] }).includes('Oct 18, 2026'));

const oldSummary = { text: 'Legacy projection', blockNumber: 1, date: start, duration: 5, manualOverride: false };
const oldRich = { submissionId: 'old-evidence', summaryText: oldSummary.text, submittedAt: start, durationMinutes: 5 };
const compatible = buildSavedReportPresentation({ original: { ...original, subjects_data: { subject: { subjectTitle: 'History', summaries: [oldSummary, { ...oldSummary, text: 'Unmatched original reflection' }] } },
  assigned_blocks_snapshot: [{ ...block, originalEvidence: [], matchedSubmissionSummary: oldRich }] } });
assert.equal(compatible.subjects[0].evidence.length, 2);
assert.equal(compatible.subjects[0].evidence[0].id, 'old-evidence');
assert.equal(compatible.subjects[0].evidence[1].text, 'Unmatched original reflection');
const ambiguousOld = buildSavedReportPresentation({ original: { ...original, subjects_data: { subject: { subjectTitle: 'History', summaries: [{ ...oldSummary, date: null }] } },
  assigned_blocks_snapshot: [{ ...block, originalEvidence: [], matchedSubmissionSummary: oldRich }] } });
assert.equal(ambiguousOld.subjects[0].evidence.length, 2);
console.log('Historical report presentation: frozen reset boundaries, exact old summary projection pairing and ambiguous evidence preservation passed.');
