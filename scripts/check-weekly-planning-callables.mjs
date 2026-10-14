import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { buildDirectionFixture } from './product-direction-fixtures.mjs';
import { createDirectionAdmin, callDirectionFunction as call, signInDirectionParent } from './product-direction-emulator-api.mjs';
import { resolvePlanningWeek } from '../functions/src/weeklyPlanningContracts.js';

const { app, db } = createDirectionAdmin();
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { deleteApp } = require('firebase-admin/app');
const fixture = buildDirectionFixture({ scenario: 'free' });
const student = fixture.students[0];
const sibling = fixture.students[1];
const initial = fixture.documents.find((record) => record.collection === 'weeklyPlans' && record.data.student_id === student.id);
const week = initial.data.week_key;
let token;
let sequence = 0;
const read = async (collection, id = initial.id) => (await db.collection(collection).doc(id).get()).data();
const ok = (body) => { assert.ok(body.result, JSON.stringify(body)); return body.result; };
const deny = (body, status, detail) => { assert.equal(body.error?.status, status, JSON.stringify(body)); if (detail) assert.equal(body.error.details?.code, detail); };
const candidate = (plan) => ({ id: initial.id, parent_id: fixture.parentId, student_id: student.id, week_key: week,
  assignment_ids: plan.assignment_ids, weekly_exceptions: [], blocks: plan.blocks, parent_notes: 'Parent-private planning note' });
const payload = async (plan) => ({ student_id: student.id, week_key: week, candidate: candidate(plan),
  expected_draft_revision: (await read('weeklyPlanDrafts'))?.revision ?? 0,
  expected_published_revision: (await read('weeklyPlans'))?.revision ?? 0, idempotency_key: `runtime-${++sequence}` });
before(async () => {
  await promisify(execFile)(process.execPath, ['scripts/seed-product-direction-fixtures.mjs', '--scenario=free', '--write'], { env: process.env });
  token = await signInDirectionParent(fixture);
});
after(() => deleteApp(app));

test('owner authentication, student ownership and server metadata reject forged requests', async () => {
  const request = await payload(initial.data);
  deny(await call('publishWeeklyPlan', request), 'UNAUTHENTICATED');
  deny(await call('publishWeeklyPlan', { ...request, student_id: 'foreign_student' }, token), 'PERMISSION_DENIED');
  deny(await call('publishWeeklyPlan', { ...request, candidate: { ...request.candidate, parent_id: 'foreign_parent' } }, token), 'PERMISSION_DENIED');
  deny(await call('publishWeeklyPlan', { ...request, server_time: 1 }, token), 'INVALID_ARGUMENT');
  const forged = structuredClone(request);
  forged.candidate.blocks[0].assignment_id = `legacy-assignment_${sibling.id}_${fixture.subjects[0].id}`;
  deny(await call('publishWeeklyPlan', forged, token), 'FAILED_PRECONDITION', 'missing-assignment-reference');
  assert.equal((await read('weeklyPlans')).revision, 1);
});

test('households must persist their timezone before planning; publishing syncs the public student calendar', async () => {
  const settingsRef = db.collection('parents').doc(fixture.parentId);
  const original = await read('parents', fixture.parentId);
  await settingsRef.set({ ...original, timezone: '' });
  deny(await call('saveWeeklyPlanDraft', await payload(initial.data), token), 'FAILED_PRECONDITION', 'missing-household-timezone');
  await settingsRef.set(original);
});

test('publish A, save draft B, publish current editor C preserve isolation and public projection', async () => {
  const planA = { ...initial.data, blocks: initial.data.blocks.map((block) => ({ ...block, title: `A ${block.title}` })) };
  const first = ok(await call('publishWeeklyPlan', await payload(planA), token));
  assert.equal(first.published_revision, 2);
  const publicA = await read('weeklyPlans');
  const planB = { ...planA, blocks: planA.blocks.map((block) => ({ ...block, title: `B ${block.title}` })) };
  ok(await call('saveWeeklyPlanDraft', await payload(planB), token));
  assert.deepEqual(await read('weeklyPlans'), publicA);
  assert.equal((await read('weeklyPlanDrafts')).blocks[0].title, planB.blocks[0].title);
  const planC = { ...planB, blocks: planB.blocks.map((block) => ({ ...block, title: `C ${block.title}`, internal_parent_note: 'private', resources: [{ name: 'Book', url: 'https://example.test/book', private_note: 'private' }] })) };
  const request = await payload(planC);
  const published = ok(await call('publishWeeklyPlan', request, token));
  const live = await read('weeklyPlans');
  assert.equal(live.blocks[0].title, planC.blocks[0].title);
  assert.equal(live.parent_notes, undefined);
  assert.equal(live.block_identity_history, undefined);
  assert.equal(live.blocks[0].internal_parent_note, undefined);
  assert.equal(live.blocks[0].resources[0].private_note, undefined);
  assert.equal((await read('weeklyPlanDrafts')).parent_notes, request.candidate.parent_notes);
  const replay = ok(await call('publishWeeklyPlan', request, token));
  assert.equal(replay.replayed, true);
  assert.equal(replay.published_revision, published.published_revision);
  assert.deepEqual(await read('weeklyPlans'), live);
  deny(await call('publishWeeklyPlan', { ...request, candidate: { ...request.candidate, parent_notes: 'Different retry' } }, token), 'ABORTED', 'idempotency-conflict');
  assert.equal((await read('students', student.id)).weekly_planning_version, 1);
  assert.equal((await read('students', student.id)).timezone, fixture.settings.timezone);
});

test('two concurrent editors with the same baseline commit exactly once', async () => {
  const request = await payload(await read('weeklyPlans'));
  const results = await Promise.all([call('saveWeeklyPlanDraft', request, token), call('saveWeeklyPlanDraft', { ...request, idempotency_key: `runtime-${++sequence}` }, token)]);
  assert.equal(results.filter((result) => result.result).length, 1);
  deny(results.find((result) => result.error), 'ABORTED', 'revision-conflict');
  assert.equal((await read('weeklyPlanDrafts')).revision, request.expected_draft_revision + 1);
});

test('student default changes do not alter published weeks, shared subjects or sibling defaults', async () => {
  const live = await read('weeklyPlans');
  const subjectsBefore = await Promise.all(fixture.subjects.map((subject) => read('subjects', subject.id)));
  const defaultId = `${fixture.parentId}_${student.id}`;
  const siblingId = `${fixture.parentId}_${sibling.id}`;
  await db.collection('studentDefaultWeeks').doc(siblingId).set({ parent_id: fixture.parentId, student_id: sibling.id, schema_version: 1, revision: 1, default_block_quantities: {} });
  const siblingBefore = await read('studentDefaultWeeks', siblingId);
  const request = { student_id: student.id, default_block_quantities: { [fixture.subjects[0].id]: { legacy_1: 3 } }, expected_revision: 0, idempotency_key: `runtime-${++sequence}` };
  ok(await call('saveStudentDefaultWeek', request, token));
  assert.equal((await read('studentDefaultWeeks', defaultId)).revision, 1);
  assert.deepEqual(await read('weeklyPlans'), live);
  assert.deepEqual(await Promise.all(fixture.subjects.map((subject) => read('subjects', subject.id))), subjectsBefore);
  assert.deepEqual(await read('studentDefaultWeeks', siblingId), siblingBefore);
  deny(await call('saveStudentDefaultWeek', { ...request, idempotency_key: `runtime-${++sequence}` }, token), 'ABORTED');
  ok(await call('saveStudentDefaultWeek', request, token));
  await db.collection('studentDefaultWeeks').doc(defaultId).update({ 'default_block_quantities.retired_subject': { old_definition: 4 } });
  const preserved = { ...request, expected_revision: 1, default_block_quantities: { ...request.default_block_quantities, retired_subject: { old_definition: 4 } }, idempotency_key: `runtime-${++sequence}` };
  ok(await call('saveStudentDefaultWeek', preserved, token));
  deny(await call('saveStudentDefaultWeek', { ...preserved, expected_revision: 2, idempotency_key: `runtime-${++sequence}`, default_block_quantities: { retired_subject: { old_definition: 5 } } }, token), 'INVALID_ARGUMENT');
});

test('empty publish preserves removed identities, rejects reuse, and adopts missing current weeks', async () => {
  const live = await read('weeklyPlans');
  const emptyRequest = await payload({ ...live, blocks: [] });
  ok(await call('publishWeeklyPlan', emptyRequest, token));
  assert.deepEqual((await read('weeklyPlans')).blocks, []);
  assert.ok((await read('weeklyPlanDrafts')).block_identity_history[live.blocks[0].id]);
  const reused = { ...live, blocks: [{ ...live.blocks[0], instance_key: 'different-copy' }] };
  deny(await call('publishWeeklyPlan', await payload(reused), token), 'FAILED_PRECONDITION', 'block-identity-reused');
  const nextKeyDate = new Date(`${week}T00:00Z`); nextKeyDate.setUTCDate(nextKeyDate.getUTCDate() + 7);
  const futureKey = nextKeyDate.toISOString().slice(0, 10);
  const futureId = `${fixture.parentId}_${sibling.id}_${futureKey}`;
  ok(await call('publishWeeklyPlan', { student_id: sibling.id, week_key: futureKey, candidate: { id: futureId, parent_id: fixture.parentId, student_id: sibling.id, week_key: futureKey, assignment_ids: [], weekly_exceptions: [], blocks: [] }, expected_draft_revision: 0, expected_published_revision: 0, idempotency_key: `runtime-${++sequence}` }, token));
  assert.equal((await read('students', sibling.id)).weekly_planning_version, 1);
  const currentId = `${fixture.parentId}_${sibling.id}_${week}`;
  await db.collection('weeklyPlans').doc(currentId).delete();
  assert.equal((await db.collection('weeklyPlans').doc(currentId).get()).exists, false);
});

test('only ended weeks can archive; archived snapshots remain intact and immutable', async () => {
  const live = await read('weeklyPlans');
  deny(await call('archiveWeeklyPlan', { student_id: student.id, week_key: week, expected_published_revision: live.revision, idempotency_key: `runtime-${++sequence}` }, token), 'FAILED_PRECONDITION', 'current-or-future-week');
  const pastDate = new Date(`${week}T00:00Z`); pastDate.setUTCDate(pastDate.getUTCDate() - 7);
  const pastKey = pastDate.toISOString().slice(0, 10);
  const pastId = `${fixture.parentId}_${student.id}_${pastKey}`;
  const range = resolvePlanningWeek({ weekKey: pastKey, settings: fixture.settings, now: new Date() });
  const historical = { ...initial.data, id: pastId, week_key: pastKey, week_start: range.weekStart, week_end: range.weekEnd };
  await db.collection('weeklyPlans').doc(pastId).set(historical);
  const request = { student_id: student.id, week_key: pastKey, expected_published_revision: 1, idempotency_key: `runtime-${++sequence}` };
  ok(await call('archiveWeeklyPlan', request, token));
  const archived = await read('weeklyPlans', pastId);
  assert.equal(archived.status, 'archived');
  assert.deepEqual(archived.blocks, historical.blocks);
  assert.equal(ok(await call('archiveWeeklyPlan', request, token)).replayed, true);
  deny(await call('publishWeeklyPlan', { ...request, idempotency_key: `runtime-${++sequence}`, expected_draft_revision: 0, candidate: candidate(historical) }, token), 'FAILED_PRECONDITION', 'archived-plan-immutable');
  deny(await call('publishWeeklyPlan', { ...request, idempotency_key: `runtime-${++sequence}`, expected_draft_revision: 0, candidate: { ...candidate(historical), id: pastId, week_key: pastKey } }, token), 'FAILED_PRECONDITION', 'archived-plan-immutable');
});

test('adopted students can still archive a preserved legacy published week through the trusted adapter', async () => {
  const pastDate = new Date(`${week}T00:00Z`); pastDate.setUTCDate(pastDate.getUTCDate() - 14);
  const pastKey = pastDate.toISOString().slice(0, 10);
  const pastId = `${fixture.parentId}_${student.id}_${pastKey}`;
  const { schema_version, revision, ...legacy } = initial.data;
  await db.collection('weeklyPlans').doc(pastId).set({ ...legacy, id: pastId, week_key: pastKey });
  ok(await call('archiveWeeklyPlan', { student_id: student.id, week_key: pastKey, expected_published_revision: 0, idempotency_key: `runtime-${++sequence}` }, token));
  const archived = await read('weeklyPlans', pastId);
  assert.equal(archived.status, 'archived');
  assert.deepEqual(archived.blocks, legacy.blocks);
});
