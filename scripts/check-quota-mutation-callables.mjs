import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { after, test } from 'node:test';
import { createDirectionAdmin, callDirectionFunction as call, signInDirectionParent } from './product-direction-emulator-api.mjs';

const { app, db } = createDirectionAdmin();
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { getAuth } = require('firebase-admin/auth');
const { deleteApp } = require('firebase-admin/app');
const households = [];
const household = async (plan = 'free') => {
  const uid = `quota_http_${randomUUID().replaceAll('-', '')}`;
  const auth = { uid, email: `${uid}@example.test`, password: 'Emulator-only-2026!' };
  households.push(uid);
  await getAuth(app).createUser(auth);
  await db.collection('parents').doc(uid).set({ parent_id: uid, timezone: 'America/Chicago' });
  await db.collection('accountEntitlements').doc(uid).set({ parent_id: uid, plan_id: plan, subscription_status: 'active', billing_provider: plan === 'free' ? null : 'stripe' });
  return { uid, token: await signInDirectionParent({ auth }) };
};
const owned = (collection, uid) => db.collection(collection).where('parent_id', '==', uid).get();
const subjectPayload = (studentId) => ({ title: 'Quota HTTP curriculum', student_ids: [studentId], block_count: 1, block_length: 15 });
after(async () => {
  for (const uid of households) {
    for (const collection of ['students', 'subjects', 'quotaMutationState', 'accountEntitlements', 'parents']) {
      for (const doc of (await owned(collection, uid)).docs) await doc.ref.delete();
    }
    await getAuth(app).deleteUser(uid);
  }
  await deleteApp(app);
});

test('actual quota adapters reject unauthenticated and foreign reactivation', async () => {
  assert.equal((await call('reactivateSubject', { subject_id: 'foreign' })).error?.status, 'UNAUTHENTICATED');
  const owner = await household(); const other = await household();
  const ref = db.collection('subjects').doc();
  await ref.set({ parent_id: owner.uid, is_active: false, title: 'Preserved archive' });
  assert.equal((await call('reactivateSubject', { subject_id: ref.id, parent_id: owner.uid }, other.token)).error?.status, 'PERMISSION_DENIED');
  assert.equal((await ref.get()).data().is_active, false);
});

test('concurrent actual student creates enforce the last Free slot', async () => {
  const parent = await household();
  assert.ok((await call('createStudent', { name: 'Existing student' }, parent.token)).result?.id);
  const results = await Promise.all([1, 2, 3].map((i) => call('createStudent', { name: `Concurrent ${i}` }, parent.token)));
  assert.equal(results.filter((result) => result.result?.id).length, 1);
  assert.ok(results.filter((result) => result.error).every((result) => result.error.status === 'RESOURCE_EXHAUSTED'));
  assert.equal((await owned('students', parent.uid)).size, 2);
});

test('actual subject creation and reactivation contend for the same final Free slot', async () => {
  const parent = await household();
  const student = (await call('createStudent', { name: 'Student' }, parent.token)).result;
  for (let i = 0; i < 2; i++) assert.ok((await call('createSubject', subjectPayload(student.id), parent.token)).result?.id);
  const ref = db.collection('subjects').doc();
  await ref.set({ parent_id: parent.uid, student_ids: [student.id], is_active: false, title: 'Preserved archive', curriculum_blocks: [{ id: 'evidence' }] });
  const results = await Promise.all([
    call('createSubject', subjectPayload(student.id), parent.token),
    call('reactivateSubject', { subject_id: ref.id }, parent.token),
  ]);
  assert.equal(results.filter((result) => result.result?.id).length, 1);
  assert.equal(results.filter((result) => result.error?.status === 'RESOURCE_EXHAUSTED').length, 1);
  assert.equal((await owned('subjects', parent.uid)).docs.filter((doc) => doc.data().is_active !== false).length, 3);
  assert.deepEqual((await ref.get()).data().curriculum_blocks, [{ id: 'evidence' }]);
});

test('Core actual creates exceed ten students and downgrade preserves work while blocking additions', async () => {
  const parent = await household('core');
  for (let i = 0; i < 11; i++) assert.ok((await call('createStudent', { name: `Core ${i}` }, parent.token)).result?.id);
  const before = (await owned('students', parent.uid)).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  await db.collection('accountEntitlements').doc(parent.uid).update({ plan_id: 'free', billing_provider: null, subscription_status: 'canceled' });
  assert.equal((await call('createStudent', { name: 'Above Free quota' }, parent.token)).error?.status, 'RESOURCE_EXHAUSTED');
  assert.deepEqual((await owned('students', parent.uid)).docs.map((doc) => ({ id: doc.id, ...doc.data() })), before);
});
