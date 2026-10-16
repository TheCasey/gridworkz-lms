import assert from 'node:assert/strict';
import { WeeklyBlockInstanceSchema } from '../src/constants/schema.js';
import {
  buildPlanningArchiveWrite, buildPlanningCandidate, buildPlanningDefaultWrite, buildPlanningPublishWrites, buildPlanningSaveWrite,
  getPlanningRevision, normalizePlanningWeekConfig, resolvePlanningWeek, retainPlanningIdentityHistory, validatePlanningPayload,
} from '../functions/src/weeklyPlanningContracts.js';
import * as foundation from '../functions/src/weeklyPlanningFoundation.js';
import * as clientFoundation from '../src/utils/productDirectionContracts.js';
import { createWeeklyPlanningService } from '../functions/src/weeklyPlanningAuthority.js';

const rejects = (code, operation) => assert.throws(operation, (error) => error.code === code);
const parentId = 'parent-a';
const studentId = 'student-a';
const weekKey = '2026-10-12';
const planId = `${parentId}_${studentId}_${weekKey}`;
const now = new Date('2026-10-14T17:00:00Z');
const subjects = [{ id: 'math', parent_id: parentId, student_ids: [studentId, 'student-b'], curriculum_blocks: [{ id: 'practice' }] }];
const block = {
  id: 'stable-copy-a', instance_key: 'copy-a', assignment_id: `legacy-assignment_${studentId}_math`, student_id: studentId,
  legacy_subject_id: 'math', legacy_block_index: 0, curriculum_block_id: 'practice', title: 'Practice', instruction: '',
  resources: [{ name: 'Book', url: 'https://example.com', parent_secret: 'private' }],
  custom_fields: [{ id: 'response', type: 'text', label: 'Explain', required: true, internal_note: 'private' }],
  category: 'practice', completion_mode: 'task_complete', planned_duration_minutes: 30, require_timer: false, require_input: true,
  parent_secret: 'private',
};
const candidate = { id: planId, parent_id: parentId, student_id: studentId, week_key: weekKey, assignment_ids: [block.assignment_id], weekly_exceptions: [], blocks: [block], parent_notes: 'private planning note' };
const range = resolvePlanningWeek({ weekKey, settings: { timezone: 'America/Chicago' }, now });
const options = { parentId, studentId, weekKey, planId, candidate, range, serverTime: now, subjects,
  currentDraft: null, currentPublished: null, expectedDraftRevision: 0, expectedPublishedRevision: 0 };
const save = buildPlanningSaveWrite(options);
assert.equal(save.data.revision, 1);
assert.equal(save.collection, 'weeklyPlanDrafts');
assert.equal(save.data.base_published_revision, 0);
assert.equal(save.data.week_start.toISOString(), '2026-10-12T05:00:00.000Z');
const firstPublish = buildPlanningPublishWrites(options);
assert.deepEqual(firstPublish.map((write) => write.collection), ['weeklyPlanDrafts', 'weeklyPlans']);
assert.equal(firstPublish[0].data.revision, 1);
assert.equal(firstPublish[1].data.revision, 1);
assert.equal(firstPublish[0].data.base_published_revision, 1);
const published = firstPublish[1].data;
assert.equal(published.status, 'published');
assert.equal(published.blocks[0].parent_secret, undefined);
assert.equal(published.blocks[0].resources[0].parent_secret, undefined);
assert.equal(published.blocks[0].custom_fields[0].internal_note, undefined);
assert.equal(published.parent_notes, undefined);
assert.equal(published.block_identity_history, undefined);
assert.equal(published.blocks[0].require_timer, false);
assert.equal(firstPublish[0].data.parent_notes, candidate.parent_notes);
const current = { ...options, currentDraft: firstPublish[0].data, currentPublished: published, expectedDraftRevision: 1, expectedPublishedRevision: 1 };
const changed = { ...candidate, blocks: [{ ...block, title: 'Edited on screen' }] };
const afterSave = buildPlanningSaveWrite({ ...current, candidate: changed });
assert.equal(afterSave.data.revision, 2);
assert.equal(published.blocks[0].title, 'Practice');
const republish = buildPlanningPublishWrites({ ...current, candidate: changed });
assert.equal(republish[0].data.revision, 2);
assert.equal(republish[1].data.revision, 2);
assert.equal(republish[1].data.blocks[0].title, 'Edited on screen');
rejects('revision-conflict', () => buildPlanningPublishWrites({ ...current, expectedDraftRevision: 0 }));
rejects('revision-conflict', () => buildPlanningSaveWrite({ ...current, expectedPublishedRevision: 0 }));
rejects('published-base-conflict', () => buildPlanningSaveWrite({ ...current, currentDraft: { ...current.currentDraft, base_published_revision: 0 } }));
rejects('archived-plan-immutable', () => buildPlanningSaveWrite({ ...current, currentPublished: { ...published, status: 'archived' } }));
rejects('archived-plan-immutable', () => buildPlanningPublishWrites({ ...current, currentPublished: { ...published, status: 'archived' } }));
rejects('scope-mismatch', () => buildPlanningPublishWrites({ ...current, candidate: { ...candidate, student_id: 'student-b' } }));
rejects('scope-mismatch', () => buildPlanningSaveWrite({ ...current, currentPublished: { ...published, week_key: '2026-10-19' } }));
rejects('unsupported-contract-version', () => getPlanningRevision({ schema_version: 2, revision: 1 }));
rejects('invalid-revision', () => getPlanningRevision({ revision: 1 }));
rejects('invalid-assignment-reference', () => buildPlanningSaveWrite({ ...options, subjects: [{ ...subjects[0], parent_id: 'other-parent' }] }));
rejects('invalid-assignment-reference', () => buildPlanningSaveWrite({ ...options, subjects: [{ ...subjects[0], student_ids: ['student-b'] }] }));
rejects('missing-assignment-reference', () => buildPlanningSaveWrite({ ...options, candidate: { ...candidate, assignment_ids: ['other-assignment'] } }));
rejects('invalid-curriculum-reference', () => buildPlanningSaveWrite({ ...options, candidate: { ...candidate, blocks: [{ ...block, curriculum_block_id: 'missing' }] } }));
rejects('invalid-assignment-reference', () => buildPlanningSaveWrite({ ...options, subjects: [{ ...subjects[0], is_archived: true }] }));
rejects('unsupported-weekly-exception', () => buildPlanningPublishWrites({ ...options, candidate: { ...candidate, weekly_exceptions: [{ parent_notes: 'secret' }] } }));
rejects('unsupported-candidate-field', () => buildPlanningCandidate({ ...options, candidate: { ...candidate, extra_private: 'secret' } }));
rejects('invalid-block-duration', () => buildPlanningPublishWrites({ ...options, candidate: { ...candidate, blocks: [{ ...block, planned_duration_minutes: -1 }] } }));
rejects('invalid-public-field', () => buildPlanningPublishWrites({ ...options, candidate: { ...candidate, blocks: [{ ...block, resources: [{ name: 5 }] }] } }));
rejects('duplicate-block-identity', () => buildPlanningPublishWrites({ ...options, candidate: { ...candidate, blocks: [block, block] } }));
const removed = buildPlanningPublishWrites({ ...current, candidate: { ...candidate, blocks: [] } });
assert.equal(removed[1].data.blocks.length, 0);
assert.deepEqual(removed[1].data.assignment_ids, [block.assignment_id]);
assert.equal(removed[1].data.schema_version, 1);
assert.equal(removed[0].data.block_identity_history[block.id].instance_key, 'copy-a');
const removedState = { ...current, currentDraft: removed[0].data, currentPublished: removed[1].data, expectedDraftRevision: 2, expectedPublishedRevision: 2 };
rejects('block-identity-reused', () => buildPlanningPublishWrites({ ...removedState, candidate: { ...candidate, blocks: [{ ...block, instance_key: 'different-copy' }] } }));
rejects('block-identity-renumbered', () => buildPlanningPublishWrites({ ...removedState, candidate: { ...candidate, blocks: [{ ...block, id: 'new-id-for-old-instance' }] } }));
rejects('block-identity-reused', () => buildPlanningPublishWrites({ ...current, candidate: { ...candidate, blocks: [{ ...block, legacy_block_index: 7 }] } }));
rejects('block-compatibility-reused', () => buildPlanningPublishWrites({ ...removedState, candidate: { ...candidate, blocks: [{ ...block, id: 'new-copy', instance_key: 'new-instance' }] } }));
const reversedHistory = Object.fromEntries(Object.entries(current.currentDraft.block_identity_history[block.id]).reverse());
assert.equal(retainPlanningIdentityHistory({ currentDraft: { ...current.currentDraft, block_identity_history: { [block.id]: reversedHistory } }, currentPublished: published, blocks: [block] })[block.id].instance_key, 'copy-a');
const { instance_key: ignored, ...legacyBlock } = block;
rejects('missing-stable-block-identity', () => buildPlanningSaveWrite({ ...options, candidate: { ...candidate, blocks: [legacyBlock] } }));
const legacy = { ...published, schema_version: undefined, revision: undefined, blocks: [legacyBlock] };
const legacyCandidate = { ...candidate, blocks: [legacyBlock] };
const adopted = buildPlanningPublishWrites({ ...options, candidate: legacyCandidate, currentPublished: legacy });
assert.equal(adopted[1].data.revision, 1);
assert.equal(adopted[1].data.blocks[0].id, block.id);
assert.equal(adopted[1].data.blocks[0].instance_key, `legacy:${block.id}`);
assert.equal(adopted[1].data.created_at, published.created_at);

const defaults = buildPlanningDefaultWrite({ parentId, studentId, defaultBlockQuantities: { math: { practice: 3 } }, currentDefaults: null, expectedRevision: 0, serverTime: now, subjects });
assert.equal(defaults.collection, 'studentDefaultWeeks');
assert.equal(defaults.data.student_id, studentId);
assert.equal(defaults.data.revision, 1);
assert.equal(subjects[0].default_block_quantities, undefined);
rejects('revision-conflict', () => buildPlanningDefaultWrite({ parentId, studentId, defaultBlockQuantities: {}, currentDefaults: defaults.data, expectedRevision: 0, serverTime: now, subjects }));
rejects('invalid-assignment-reference', () => buildPlanningDefaultWrite({ parentId, studentId: 'other', defaultBlockQuantities: { math: { practice: 1 } }, currentDefaults: null, expectedRevision: 0, serverTime: now, subjects }));
rejects('invalid-default-quantities', () => buildPlanningDefaultWrite({ parentId, studentId, defaultBlockQuantities: { math: { practice: 1.5 } }, currentDefaults: null, expectedRevision: 0, serverTime: now, subjects }));
rejects('invalid-curriculum-reference', () => buildPlanningDefaultWrite({ parentId, studentId, defaultBlockQuantities: { math: { missing: 1 } }, currentDefaults: null, expectedRevision: 0, serverTime: now, subjects }));

rejects('current-or-future-week', () => buildPlanningArchiveWrite({ ...current, range, serverTime: now }));
const futureRange = resolvePlanningWeek({ weekKey, settings: { timezone: 'America/Chicago' }, now: new Date('2026-10-19T05:00:00Z') });
const archived = buildPlanningArchiveWrite({ ...current, range: futureRange, serverTime: now });
assert.equal(archived.data.status, 'archived');
assert.equal(archived.data.revision, published.revision);
assert.deepEqual(archived.data.blocks, published.blocks);
assert.equal(buildPlanningArchiveWrite({ ...current, currentPublished: archived.data, range: futureRange, serverTime: now }), null);
rejects('unpublished-archive-target', () => buildPlanningArchiveWrite({ ...current, currentPublished: { ...published, status: 'draft' }, range: futureRange, serverTime: now }));
rejects('invalid-week-reset', () => normalizePlanningWeekConfig({ week_reset_day: 7 }));
rejects('invalid-timezone', () => normalizePlanningWeekConfig({ timezone: 'Bad/Zone' }));
rejects('invalid-date-key', () => resolvePlanningWeek({ weekKey: '2026-02-30', settings: {}, now }));
const customSettings = { timezone: 'America/Chicago', week_reset_day: 3, week_reset_hour: 14, week_reset_minute: 30 };
assert.equal(resolvePlanningWeek({ weekKey: '2026-10-14', settings: customSettings, now: new Date('2026-10-14T19:29:59Z') }).currentKey, '2026-10-07');
assert.equal(resolvePlanningWeek({ weekKey: '2026-10-14', settings: customSettings, now: new Date('2026-10-14T19:30:00Z') }).currentKey, '2026-10-14');
const future = resolvePlanningWeek({ weekKey: '2026-10-19', settings: {}, now });
assert.equal(buildPlanningSaveWrite({ ...options, weekKey: '2026-10-19', planId: `${parentId}_${studentId}_2026-10-19`, range: future,
  candidate: { ...candidate, id: `${parentId}_${studentId}_2026-10-19`, week_key: '2026-10-19' } }).data.week_key, '2026-10-19');
rejects('past-week-immutable', () => buildPlanningSaveWrite({ ...options, range: futureRange }));
const spring = resolvePlanningWeek({ weekKey: '2026-03-02', settings: {}, now: new Date('2026-03-03T18:00Z') });
assert.equal(spring.weekEnd.getTime() + 1 - spring.weekStart.getTime(), 167 * 3600000);
const fall = resolvePlanningWeek({ weekKey: '2026-10-26', settings: {}, now });
assert.equal(fall.weekEnd.getTime() + 1 - fall.weekStart.getTime(), 169 * 3600000);
const gap = resolvePlanningWeek({ weekKey: '2026-03-08', settings: { week_reset_day: 0, week_reset_hour: 2, week_reset_minute: 30 }, now: new Date('2026-03-08T08:00Z') });
assert.equal(gap.weekStart.toISOString(), '2026-03-08T08:00:00.000Z');
const foldSettings = { week_reset_day: 0, week_reset_hour: 1, week_reset_minute: 30 };
assert.equal(resolvePlanningWeek({ weekKey: '2026-11-01', settings: foldSettings, now: new Date('2026-11-01T07:15Z') }).currentKey, '2026-11-01');

// Browser and packaged foundation publish exactly the same allowlisted contract.
const foundationOptions = { draft: save.data, currentPublished: null, expectedDraftRevision: 1, expectedPublishedRevision: 0, actorId: parentId, serverTime: now };
assert.deepEqual(foundation.buildWeeklyPlanPublishWrites(foundationOptions), clientFoundation.buildWeeklyPlanPublishWrites(foundationOptions));
assert.deepEqual(foundation.buildStudentDefaultWeekWrite({ parentId, studentId, defaultBlockQuantities: { math: { practice: 3 } }, currentDefaults: null, expectedRevision: 0, actorId: parentId, serverTime: now }),
  clientFoundation.buildStudentDefaultWeekWrite({ parentId, studentId, defaultBlockQuantities: { math: { practice: 3 } }, currentDefaults: null, expectedRevision: 0, actorId: parentId, serverTime: now }));
rejects('unsupported-request-field', () => validatePlanningPayload({ student_id: studentId, default_block_quantities: {}, expected_revision: 0, idempotency_key: 'key', subjects: [] }, 'defaults'));

// Pure in-memory transaction harness verifies atomic adapters and replay. It has
// no Firebase connection and rejects any read after the first queued write.
class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
const stamp = (date) => ({ toDate: () => date, toMillis: () => date.getTime() });
const Timestamp = { now: () => stamp(now), fromDate: stamp };
const state = new Map([['parents/parent-a', { timezone: 'America/Chicago' }], ['students/student-a', { parent_id: parentId }], ['subjects/math', subjects[0]]]);
const queryFor = (collection, constraints = [], maximum = Infinity) => ({ collection, constraints, maximum,
  where: (key, operator, value) => queryFor(collection, [...constraints, [key, operator, value]], maximum),
  limit: (nextMaximum) => queryFor(collection, constraints, nextMaximum),
  doc: (id) => ({ path: `${collection}/${id}`, id }),
});
const db = {
  collection: (collection) => queryFor(collection),
  runTransaction: async (operation) => {
    const writes = [];
    const snapshot = (id, value) => ({ id, exists: value !== undefined, data: () => value });
    const transaction = {
      get: async (target) => {
        assert.equal(writes.length, 0, 'All transaction reads precede writes');
        if (target.collection) {
          const docs = [...state.entries()].filter(([path, data]) => path.startsWith(`${target.collection}/`) && target.constraints.every(([key, operator, value]) =>
            operator === 'array-contains' ? data[key]?.includes(value) : operator === '>=' ? data[key] >= value : operator === '<=' ? data[key] <= value : data[key] === value))
            .slice(0, target.maximum).map(([path, value]) => snapshot(path.split('/')[1], value));
          return { docs, size: docs.length };
        }
        return snapshot(target.id, state.get(target.path));
      },
      set: (target, value) => writes.push({ target, value }),
      create: (target, value) => { assert.equal(state.has(target.path), false); writes.push({ target, value }); },
      update: (target, value) => writes.push({ target, value: { ...state.get(target.path), ...value } }),
    };
    const response = await operation(transaction);
    for (const write of writes) state.set(write.target.path, write.value);
    return response;
  },
};
const service = createWeeklyPlanningService({ db, Timestamp, HttpsError });
const payload = { student_id: studentId, week_key: weekKey, candidate: { ...candidate, legacy_source_links: Object.fromEntries(candidate.blocks.map((block) => [block.id, null])) }, expected_draft_revision: 0, expected_published_revision: 0, idempotency_key: 'network-key' };
const result = await service.publish({ parentId, payload });
assert.equal(result.published_revision, 1);
assert.equal(state.get(`weeklyPlans/${planId}`).status, 'published');
assert.equal(state.get(`weeklyPlanDrafts/${planId}`).base_published_revision, 1);
assert.equal(state.get('students/student-a').weekly_planning_version, 1);
assert.equal((await service.publish({ parentId, payload })).replayed, true);
assert.equal(state.get(`weeklyPlans/${planId}`).revision, 1);
await assert.rejects(service.publish({ parentId, payload: { ...payload, candidate: changed } }), (error) => error.code === 'aborted' && error.details.code === 'idempotency-conflict');
await assert.rejects(service.publish({ parentId, payload: { ...payload, idempotency_key: 'new-key' } }), (error) => error.code === 'aborted' && error.details.code === 'revision-conflict');
assert.equal(state.get(`weeklyPlans/${planId}`).revision, 1);
assert.equal([...state.keys()].some((key) => ['submissions', 'timerSessions', 'weeklyReports', 'pointLedgerEntries'].some((collection) => key.startsWith(`${collection}/`))), false);
await assert.rejects(service.saveDefaults({ parentId: 'other-parent', payload: { student_id: studentId, default_block_quantities: {}, expected_revision: 0, idempotency_key: 'owner-denied' } }), (error) => error.code === 'permission-denied');
console.log('Weekly planning helpers passed: v1/legacy adoption, projections, scoped revisions, retained identities, ownership/definitions, empty publication, defaults, server calendars/DST, archival and atomic adapter retry policy.');

const schemaBlock = Object.fromEntries(Object.entries(WeeklyBlockInstanceSchema).map(([key, type]) => [key,
  type === 'string' ? 'value' : type === 'number' ? 1 : type === 'boolean' ? false : []]));
assert.deepEqual(Object.keys(foundation.projectPublicWeeklyBlocks([schemaBlock])[0]).sort(), Object.keys(WeeklyBlockInstanceSchema).sort(),
  'Packaged public block allowlist must match schema source of truth');
