#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createQuotaMutationService, isQuotaActiveSubject } from '../functions/src/quotaMutationAuthority.js';

assert.equal(process.env.GCLOUD_PROJECT, 'demo-gridworkz-direction', 'Explicit disposable demo project required.');
assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/, 'Loopback Firestore emulator required.');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { HttpsError } = require('firebase-functions/v2/https');
const { resolveEntitlementRecord } = await import('../functions/src/index.js');
const db = getFirestore();
const service = createQuotaMutationService({ db, FieldValue, HttpsError, resolveEntitlementRecord });
const runId = `quota_${randomUUID().replaceAll('-', '')}`;
const parents = [];
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const fixture = async (entitlement) => {
  const parentId = `${runId}_${parents.length}`;
  parents.push(parentId);
  await db.collection('parents').doc(parentId).set({ parent_id: parentId });
  if (entitlement) await db.collection('accountEntitlements').doc(parentId).set({ parent_id: parentId, ...entitlement });
  return parentId;
};
const student = (parentId) => service.createStudent({ parentId, studentDoc: { name: 'Quota student' } });
const subject = (parentId, studentId) => service.createSubject({ parentId, subjectDoc: { title: 'Quota curriculum', student_ids: [studentId] } });
const owned = async (collection, parentId) => (await db.collection(collection).where('parent_id', '==', parentId).get()).docs;
const activeSubjects = async (parentId) => (await owned('subjects', parentId)).filter((doc) => isQuotaActiveSubject(doc.data()));
const seedSubject = async (parentId, data = {}) => {
  const ref = db.collection('subjects').doc();
  await ref.set({ parent_id: parentId, title: 'Existing curriculum', ...data });
  return ref.id;
};
const outcomes = (results, successCount) => {
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, successCount);
  for (const result of results.filter((result) => result.status === 'rejected')) assert.equal(result.reason.code, 'resource-exhausted');
};
const paid = { plan_id: 'core', subscription_status: 'active', billing_provider: 'stripe' };

try {
  await check('registered parent required; no minimal entitlement document is created', async () => {
    await assert.rejects(student(`${runId}_missing`), { code: 'permission-denied' });
    const parentId = await fixture();
    await student(parentId);
    assert.equal((await db.collection('accountEntitlements').doc(parentId).get()).exists, false);
    assert.equal((await db.collection('quotaMutationState').doc(parentId).get()).data().revision, 1);
  });

  await check('simultaneous Free student creates commit only the remaining slot', async () => {
    const parentId = await fixture({ usage_snapshot: { students: 0, curriculum_items: 0 } });
    await student(parentId);
    outcomes(await Promise.allSettled([student(parentId), student(parentId), student(parentId)]), 1);
    assert.equal((await owned('students', parentId)).length, 2);
    assert.equal((await db.collection('quotaMutationState').doc(parentId).get()).data().revision, 2);
  });

  await check('simultaneous Free curriculum creates commit only the remaining slot', async () => {
    const parentId = await fixture();
    const { id } = await student(parentId);
    await subject(parentId, id); await subject(parentId, id);
    outcomes(await Promise.allSettled([subject(parentId, id), subject(parentId, id), subject(parentId, id)]), 1);
    assert.equal((await activeSubjects(parentId)).length, 3);
  });

  await check('legacy missing is_active counts; all archive representations free a slot', async () => {
    const parentId = await fixture();
    const { id } = await student(parentId);
    await seedSubject(parentId); await seedSubject(parentId, { is_active: true });
    for (const flags of [{ is_active: false }, { is_archived: true }, { archived: true }, { status: 'archived' }, { archived_at: new Date() }]) {
      await seedSubject(parentId, flags);
    }
    await subject(parentId, id);
    await assert.rejects(subject(parentId, id), { code: 'resource-exhausted' });
    assert.equal((await activeSubjects(parentId)).length, 3);
    assert.equal((await owned('subjects', parentId)).length, 8);
  });

  await check('concurrent create and reactivations share one quota coordinator', async () => {
    const parentId = await fixture();
    const { id } = await student(parentId);
    await seedSubject(parentId); await seedSubject(parentId);
    const first = await seedSubject(parentId, { is_active: false, archived: true, is_archived: true, status: 'archived', archived_at: new Date() });
    const second = await seedSubject(parentId, { is_active: false });
    outcomes(await Promise.allSettled([
      service.reactivateSubject({ parentId, subjectId: first }),
      service.reactivateSubject({ parentId, subjectId: second }), subject(parentId, id),
    ]), 1);
    assert.equal((await activeSubjects(parentId)).length, 3);
  });

  await check('reactivation clears every archive flag and retries without consuming another slot', async () => {
    const parentId = await fixture();
    const id = await seedSubject(parentId, { is_active: false, archived: true, is_archived: true, status: 'archived', archived_at: new Date(), custom_evidence: 'keep' });
    const results = await Promise.all([
      service.reactivateSubject({ parentId, subjectId: id }), service.reactivateSubject({ parentId, subjectId: id }),
    ]);
    assert.deepEqual(results.map((value) => value.already_active).sort(), [false, true]);
    const saved = (await db.collection('subjects').doc(id).get()).data();
    assert.equal(isQuotaActiveSubject(saved), true);
    assert.equal(saved.archived_at, null); assert.equal(saved.status, 'active');
    assert.equal(saved.custom_evidence, 'keep');
    assert.equal((await db.collection('quotaMutationState').doc(parentId).get()).data().revision, 1);
    await assert.rejects(service.reactivateSubject({ parentId: await fixture(), subjectId: id }), { code: 'permission-denied' });
    await assert.rejects(service.reactivateSubject({ parentId, subjectId: `${runId}_missing` }), { code: 'not-found' });
    await assert.rejects(service.reactivateSubject({ parentId }), { code: 'invalid-argument' });
    await assert.rejects(service.reactivateSubject({ parentId, subjectId: 'invalid/path' }), { code: 'invalid-argument' });
  });

  await check('Core creates and reactivates beyond ten; downgrade preserves existing work', async () => {
    const parentId = await fixture(paid);
    for (let i = 0; i < 12; i++) await student(parentId);
    const id = (await owned('students', parentId))[0].id;
    for (let i = 0; i < 12; i++) await subject(parentId, id);
    const archivedId = await seedSubject(parentId, { is_active: false });
    await service.reactivateSubject({ parentId, subjectId: archivedId });
    const preserved = await owned('subjects', parentId);
    await db.collection('accountEntitlements').doc(parentId).set({ plan_id: 'free', subscription_status: 'canceled', usage_snapshot: { students: 0, curriculum_items: 0 } });
    await assert.rejects(student(parentId), { code: 'resource-exhausted' });
    await assert.rejects(subject(parentId, id), { code: 'resource-exhausted' });
    assert.equal((await owned('students', parentId)).length, 12);
    assert.equal((await activeSubjects(parentId)).length, 13);
    assert.deepEqual((await owned('subjects', parentId)).map((doc) => doc.data()), preserved.map((doc) => doc.data()));
    assert.equal((await service.reactivateSubject({ parentId, subjectId: archivedId })).already_active, true);
    await db.collection('subjects').doc(archivedId).update({ is_active: false });
    await assert.rejects(service.reactivateSubject({ parentId, subjectId: archivedId }), { code: 'resource-exhausted' });
  });

  await check('fresh support overrides govern quota without touching usage or billing fields', async () => {
    const parentId = await fixture({ ...paid, usage_snapshot: { students: 999, curriculum_items: 999 }, product_direction_version: 1 });
    for (let i = 0; i < 3; i++) await student(parentId);
    const entitlementRef = db.collection('accountEntitlements').doc(parentId);
    await entitlementRef.update({ manual_override: { is_active: true, plan_id: 'free', subscription_status: 'active', expires_at: null } });
    await assert.rejects(student(parentId), { code: 'resource-exhausted' });
    const before = (await entitlementRef.get()).data();
    await entitlementRef.update({ manual_override: null });
    await student(parentId);
    assert.deepEqual((await entitlementRef.get()).data(), { ...before, manual_override: null });
  });

  await check('assignment forgery is rejected without mutation or coordinator increment', async () => {
    const parentId = await fixture();
    const other = await fixture();
    const { id } = await student(other);
    await assert.rejects(subject(parentId, id), { code: 'failed-precondition' });
    assert.equal((await owned('subjects', parentId)).length, 0);
    assert.equal((await db.collection('quotaMutationState').doc(parentId).get()).exists, false);
  });
  console.log(`${passed} persisted quota authority cases passed.`);
} finally {
  // Delete only this run's randomly named households; never clear the shared emulator.
  for (const parentId of parents) {
    for (const collection of ['students', 'subjects']) {
      for (const doc of await owned(collection, parentId)) await doc.ref.delete();
    }
    for (const collection of ['parents', 'accountEntitlements', 'quotaMutationState']) await db.collection(collection).doc(parentId).delete();
  }
  await db.terminate();
}
