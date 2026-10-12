import assert from 'node:assert/strict';
import { Collections, ProductDirectionContractVersion, WeeklyPlanSchema } from '../src/constants/schema.js';
import {
  adoptLegacyWeeklyBlockInstances,
  assertRetainedBlockIdentities,
  buildBlockCompletionStateId,
  buildParentCorrection,
  buildReportAmendment,
  buildRoutineDaySnapshotId,
  buildStableWeeklyBlockId,
  buildStudentCosmeticStateId,
  buildStudentDefaultWeekId,
  buildStudentDefaultWeekWrite,
  buildWeeklyPlanPublishWrites,
  isRoutineDaySnapshotComplete,
  nextContractRevision,
  resolveLegacyWeeklyBlock,
  validatePrivateWeeklyPlanDraft,
  validateRoutineDaySnapshot,
  validateStudentCosmeticState,
  validateStudentDefaultWeek,
} from '../src/utils/productDirectionContracts.js';

let assertions = 0;
const check = (value) => { assert.ok(value); assertions += 1; };
const equal = (actual, expected) => { assert.deepEqual(actual, expected); assertions += 1; };
const rejects = (code, callback) => {
  assert.throws(callback, (error) => error.code === code);
  assertions += 1;
};
const time = new Date('2026-10-12T16:00:00Z');
const block = (instanceKey, extras = {}) => ({
  id: buildStableWeeklyBlockId({ assignmentId: 'assignment-math', instanceKey }),
  instance_key: instanceKey, assignment_id: 'assignment-math', student_id: 'student-a',
  curriculum_block_id: 'practice', curriculum_block_occurrence: 0,
  title: 'Practice', instruction: 'Work problems', category: 'practice',
  completion_mode: 'hybrid', planned_duration_minutes: 20, require_timer: false,
  require_input: true, resources: [{ name: 'Book', url: 'https://example.test/book', parent_notes: 'private-resource' }],
  custom_fields: [{ id: 'summary', type: 'text', label: 'Summary', required: true, parent_notes: 'private-field' }],
  legacy_subject_id: 'subject-math', legacy_block_index: 0, ...extras,
});
const draft = {
  id: 'parent-a_student-a_2026-10-12', parent_id: 'parent-a', student_id: 'student-a',
  week_key: '2026-10-12', week_start: time, week_end: new Date('2026-10-19T16:00:00Z'),
  schema_version: ProductDirectionContractVersion, revision: 1, base_published_revision: 0,
  status: 'draft', assignment_ids: ['assignment-math'], weekly_exceptions: [],
  published_at: null, archived_at: null,
  blocks: [block('copy-a', { parent_notes: 'private-block' }), block('copy-b')],
  parent_notes: 'private-root', internal_review: { studentId: 'student-b' },
};
const publish = (input = {}) => buildWeeklyPlanPublishWrites({ draft, expectedDraftRevision: 1, expectedPublishedRevision: 0, actorId: 'parent-a', serverTime: time, ...input });
check(validatePrivateWeeklyPlanDraft(draft));
check('status' in WeeklyPlanSchema && !('revision' in WeeklyPlanSchema)); // additive old exports
check(buildBlockCompletionStateId({ planId: 'a:b', blockId: 'c' }) !== buildBlockCompletionStateId({ planId: 'a', blockId: 'b:c' }));
equal(buildStudentDefaultWeekId({ parentId: 'parent-a', studentId: 'student-a' }), 'parent-a_student-a');
check(buildStudentDefaultWeekId({ parentId: 'parent-a', studentId: 'student-a' }) !== buildStudentDefaultWeekId({ parentId: 'parent-a', studentId: 'student-b' }));
equal(nextContractRevision({ expectedRevision: 2, currentRevision: 2 }), 3);
rejects('revision-conflict', () => nextContractRevision({ expectedRevision: 1, currentRevision: 2 }));
rejects('invalid-revision', () => nextContractRevision({ expectedRevision: '2', currentRevision: 2 }));
rejects('revision-overflow', () => nextContractRevision({ expectedRevision: Number.MAX_SAFE_INTEGER, currentRevision: Number.MAX_SAFE_INTEGER }));
const writes = publish();
equal(writes.map((write) => write.collection), [Collections.WEEKLY_PLAN_DRAFTS, Collections.WEEKLY_PLANS]);
equal(writes[0].data.parent_notes, draft.parent_notes);
equal(writes[0].data.base_published_revision, 1);
equal(writes[0].data.revision, 2);
const published = writes[1].data;
equal(published.status, 'published');
equal(published.revision, 1);
check(!JSON.stringify(published).includes('private-'));
check(!('internal_review' in published) && !('base_published_revision' in published));
equal(published.blocks.map((item) => item.id), draft.blocks.map((item) => item.id));
equal(draft.revision, 1); // pure: input untouched
rejects('revision-conflict', () => publish({ expectedDraftRevision: 0 }));
rejects('draft-status-required', () => publish({ draft: { ...draft, status: 'published' } }));
rejects('draft-publish-separation', () => publish({ draft: { ...draft, published_at: time } }));
rejects('unsupported-weekly-exception', () => publish({ draft: { ...draft, weekly_exceptions: [{ parent_notes: 'secret' }] } }));
rejects('invalid-public-field', () => publish({ draft: { ...draft, blocks: [block('copy-a', { resources: [{ url: { parent_notes: 'secret' } }] })] } }));
rejects('scope-mismatch', () => publish({ draft: { ...draft, blocks: [block('copy-a', { student_id: 'student-b' })] } }));
rejects('duplicate-block-identity', () => publish({ draft: { ...draft, blocks: [block('copy-a'), block('copy-a')] } }));
rejects('missing-stable-block-identity', () => publish({ draft: { ...draft, blocks: [block('copy-a', { instance_key: undefined })] } }));
const republishDraft = { ...writes[0].data, blocks: [...draft.blocks].reverse() };
const republished = publish({ draft: republishDraft, currentPublished: published, expectedDraftRevision: 2, expectedPublishedRevision: 1 });
equal(republished[1].data.blocks.map((item) => item.id), [...draft.blocks].reverse().map((item) => item.id));
rejects('published-base-conflict', () => publish({ currentPublished: published, expectedPublishedRevision: 1 }));
rejects('archived-plan-immutable', () => publish({ draft: republishDraft, currentPublished: { ...published, status: 'archived' }, expectedDraftRevision: 2, expectedPublishedRevision: 1 }));
rejects('block-identity-renumbered', () => assertRetainedBlockIdentities(draft.blocks, [block('copy-a', { id: 'new-id' })]));
rejects('block-identity-reused', () => assertRetainedBlockIdentities(draft.blocks, [block('copy-new', { id: draft.blocks[0].id })]));
const legacyBlocks = draft.blocks.map(({ instance_key, ...item }) => item);
const adopted = adoptLegacyWeeklyBlockInstances({ ...draft, blocks: legacyBlocks });
equal(adopted.map((item) => item.id), legacyBlocks.map((item) => item.id));
equal(adoptLegacyWeeklyBlockInstances({ ...draft, blocks: adopted }), adopted);
const lookup = { plan: published, studentId: 'student-a', weekKey: '2026-10-12', subjectId: 'subject-math', blockIndex: 0 };
equal(resolveLegacyWeeklyBlock(lookup).status, 'ambiguous');
equal(resolveLegacyWeeklyBlock(lookup).block, null);
equal(resolveLegacyWeeklyBlock({ ...lookup, blockIndex: 9 }).status, 'missing');
equal(resolveLegacyWeeklyBlock({ ...lookup, plan: { ...published, blocks: [published.blocks[0]] } }).block.id, published.blocks[0].id);
rejects('scope-mismatch', () => resolveLegacyWeeklyBlock({ ...lookup, studentId: 'student-b' }));
rejects('invalid-legacy-reference', () => resolveLegacyWeeklyBlock({ ...lookup, blockIndex: '0' }));
const defaultsWrite = buildStudentDefaultWeekWrite({ parentId: 'parent-a', studentId: 'student-a', defaultBlockQuantities: { 'subject-math': { practice: 2 } }, expectedRevision: 0, actorId: 'parent-a', serverTime: time });
check(validateStudentDefaultWeek(defaultsWrite.data, { parentId: 'parent-a', studentId: 'student-a' }));
rejects('scope-mismatch', () => validateStudentDefaultWeek(defaultsWrite.data, { parentId: 'parent-a', studentId: 'student-b' }));
rejects('invalid-default-quantities', () => validateStudentDefaultWeek({ ...defaultsWrite.data, default_block_quantities: { math: { practice: -1 } } }, { parentId: 'parent-a', studentId: 'student-a' }));
rejects('scope-mismatch', () => buildStudentDefaultWeekWrite({ parentId: 'parent-a', studentId: 'student-b', defaultBlockQuantities: {}, currentDefaults: defaultsWrite.data, expectedRevision: 1, actorId: 'parent-a', serverTime: time }));

const state = {
  id: buildBlockCompletionStateId({ planId: published.id, blockId: published.blocks[0].id }),
  parent_id: 'parent-a', student_id: 'student-a', week_key: published.week_key,
  weekly_plan_id: published.id, weekly_block_id: published.blocks[0].id,
  schema_version: 1, revision: 3, status: 'completed', original_evidence_ids: ['submission-original'],
  last_correction_event_id: '', updated_at: time,
};
const evidence = { id: 'submission-original', parent_id: state.parent_id, student_id: state.student_id, week_key: state.week_key, weekly_plan_id: state.weekly_plan_id, weekly_block_id: state.weekly_block_id };
const request = { new_status: 'incomplete', reason: 'Redo needed', note: 'Retry question 3', idempotency_key: 'undo-1', expected_revision: 3 };
const correct = (input = {}) => buildParentCorrection({ request, plan: published, currentState: state, originalEvidence: [evidence], actorId: 'parent-a', serverTime: time, ...input });
const correction = correct();
equal(correction.state.status, 'incomplete');
equal(correction.event.prior_status, 'completed');
equal(correction.event.new_status, 'incomplete');
equal(correction.event.original_evidence_ids, ['submission-original']);
equal(correction.state.original_evidence_ids, state.original_evidence_ids);
equal(correction.event.actor_id, 'parent-a');
equal(correction.event.recorded_at, time);
equal(correction.state.revision, 4);
equal(state.status, 'completed');
equal(correct({ currentState: correction.state, existingEvent: correction.event }).replayed, true);
rejects('idempotency-conflict', () => correct({ request: { ...request, note: 'different' }, existingEvent: correction.event }));
rejects('unauthorized-actor', () => correct({ actorId: 'parent-b' }));
rejects('missing-server-time', () => correct({ serverTime: null }));
rejects('unsupported-correction-field', () => correct({ request: { ...request, actor_id: 'parent-b' } }));
rejects('unsupported-correction-field', () => correct({ request: { ...request, summary: 'replace original evidence' } }));
rejects('invalid-block-status', () => correct({ request: { ...request, new_status: 'approved' } }));
rejects('revision-conflict', () => correct({ request: { ...request, expected_revision: 2 } }));
rejects('scope-mismatch', () => correct({ currentState: { ...state, student_id: 'student-b' } }));
rejects('scope-mismatch', () => correct({ originalEvidence: [{ ...evidence, student_id: 'student-b' }] }));
rejects('evidence-reference-mismatch', () => correct({ originalEvidence: [] }));
equal(correct({ plan: { ...published, status: 'archived' } }).state.status, 'incomplete');
const laterComplete = correct({ currentState: correction.state, request: { ...request, expected_revision: 4, new_status: 'completed', idempotency_key: 'complete-again' } });
equal(laterComplete.state.status, 'completed');
equal(laterComplete.event.original_evidence_ids, ['submission-original']);

const originalReport = { id: 'report-root', parent_id: 'parent-a', student_id: 'student-a', week_key: published.week_key, weekly_plan_id: published.id, total_blocks: 2 };
const snapshot = { ...originalReport, total_blocks: 1 };
const amend = (input = {}) => buildReportAmendment({ originalReport, correctionEvents: [correction.event], amendedSnapshot: snapshot, expectedVersion: 1, actorId: 'parent-a', serverTime: time, ...input });
const amendment = amend();
equal(amendment.original_report_id, originalReport.id);
equal(amendment.previous_report_version_id, originalReport.id);
equal(amendment.report_version, 2);
equal(amendment.correction_event_ids, [correction.event.id]);
equal(originalReport.total_blocks, 2);
equal(amendment.snapshot.total_blocks, 1);
const amendment2 = amend({ previousAmendment: amendment, expectedVersion: 2, correctionEvents: [laterComplete.event] });
equal(amendment2.original_report_id, originalReport.id);
equal(amendment2.previous_report_version_id, amendment.id);
equal(amendment2.report_version, 3);
rejects('revision-conflict', () => amend({ previousAmendment: amendment }));
rejects('invalid-amendment-chain', () => amend({ previousAmendment: { ...amendment, original_report_id: 'another-root' }, expectedVersion: 2 }));
rejects('scope-mismatch', () => amend({ amendedSnapshot: { ...snapshot, student_id: 'student-b' } }));
rejects('scope-mismatch', () => amend({ correctionEvents: [{ ...correction.event, weekly_plan_id: 'another-week' }] }));
rejects('missing-report-corrections', () => amend({ correctionEvents: [] }));
const legacyReport = { ...originalReport, id: 'legacy-report-root', snapshot_model: 'subjects' };
delete legacyReport.weekly_plan_id;
const originalCorrectionEvent = structuredClone(correction.event);
// Feed the actual buildParentCorrection result through the legacy report path.
const legacyAmendment = amend({ originalReport: legacyReport, amendedSnapshot: { ...legacyReport, total_blocks: 1 }, correctionEvents: [correction.event] });
equal(legacyAmendment.weekly_plan_id, '');
equal(legacyAmendment.original_report_id, 'legacy-report-root');
equal(legacyAmendment.snapshot.snapshot_model, 'subjects');
check(!Object.hasOwn(legacyReport, 'weekly_plan_id'));
equal(legacyAmendment.correction_event_ids, [correction.event.id]);
equal(correction.event, originalCorrectionEvent);
equal(correction.event.weekly_plan_id, published.id);
equal(correction.event.original_evidence_ids, ['submission-original']);
rejects('scope-mismatch', () => amend({ originalReport: legacyReport, amendedSnapshot: { ...legacyReport, weekly_plan_id: published.id }, correctionEvents: [correction.event] }));
rejects('invalid-original-report', () => amend({ originalReport: { ...legacyReport, snapshot_model: 'weekly_plan' }, amendedSnapshot: legacyReport, correctionEvents: [correction.event] }));
for (const [key, value] of [['parent_id', 'parent-b'], ['student_id', 'student-b'], ['week_key', '2026-10-19']]) {
  rejects('scope-mismatch', () => amend({ originalReport: legacyReport, amendedSnapshot: legacyReport, correctionEvents: [{ ...correction.event, [key]: value }] }));
}

const routineSnapshot = {
  id: buildRoutineDaySnapshotId({ parentId: 'parent-a', studentId: 'student-a', date: '2026-10-12' }),
  parent_id: 'parent-a', student_id: 'student-a', schema_version: 1, date_key: '2026-10-12', timezone: 'America/Chicago',
  routine_day_points: 10, routine_points_enabled: true, recorded_at: time,
  templates: [{ id: 'morning-a', routine_period: 'morning', checklist_items: [{ id: 'brush', label: 'Brush teeth' }, { id: 'dress', label: 'Get dressed' }] }],
};
check(validateRoutineDaySnapshot(routineSnapshot, { parentId: 'parent-a', studentId: 'student-a' }));
equal(isRoutineDaySnapshotComplete(routineSnapshot, { 'morning-a': ['brush'] }), false);
equal(isRoutineDaySnapshotComplete(routineSnapshot, { 'morning-a': ['brush', 'dress'] }), true);
equal(isRoutineDaySnapshotComplete({ ...routineSnapshot, templates: [] }, {}), false);
rejects('invalid-date-key', () => buildRoutineDaySnapshotId({ parentId: 'parent-a', studentId: 'student-a', date: '2026-02-30' }));
rejects('invalid-timezone', () => validateRoutineDaySnapshot({ ...routineSnapshot, timezone: 'bad/timezone' }, { parentId: 'parent-a', studentId: 'student-a' }));
const cosmetic = {
  id: buildStudentCosmeticStateId({ parentId: 'parent-a', studentId: 'student-a' }),
  parent_id: 'parent-a', student_id: 'student-a', schema_version: 1, revision: 1,
  owned_cosmetic_ids: ['base-avatar', 'legacy-unlock-retained'], selected_cosmetic_ids: { avatar: 'base-avatar' }, updated_at: time,
};
const catalog = [{ id: 'base-avatar', type: 'built_in', unlock_type: 'avatar', is_active: true }];
check(validateStudentCosmeticState(cosmetic, { parentId: 'parent-a', studentId: 'student-a', catalog }));
rejects('cosmetic-not-owned', () => validateStudentCosmeticState({ ...cosmetic, owned_cosmetic_ids: [] }, { parentId: 'parent-a', studentId: 'student-a', catalog }));
rejects('invalid-cosmetic-selection', () => validateStudentCosmeticState({ ...cosmetic, selected_cosmetic_ids: { badge: 'base-avatar' } }, { parentId: 'parent-a', studentId: 'student-a', catalog }));
console.log(`Product-direction v1 contracts passed (${assertions} assertions; pure helpers only, no backend reads/writes).`);
