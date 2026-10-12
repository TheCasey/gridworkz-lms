import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { buildDirectionFixture, DIRECTION_PROJECT_ID } from './product-direction-fixtures.mjs';

for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env[name] || '')) throw new Error(`${name} must point to a local emulator.`);
}
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore(initializeApp({ projectId: DIRECTION_PROJECT_ID }));
const free = buildDirectionFixture({ scenario: 'free' });
const core = buildDirectionFixture({ scenario: 'core' });
const context = (student) => ({ student_id: student.id, slug: student.slug, access_pin: student.access_pin });
const callable = async (name, data, token = '') => {
  const response = await fetch(`http://127.0.0.1:5001/${DIRECTION_PROJECT_ID}/us-central1/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  const body = await response.json();
  return body;
};
const signIn = async (fixture) => {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: fixture.auth.email, password: fixture.auth.password, returnSecureToken: true }),
  });
  const body = await response.json();
  assert.ok(response.ok && body.idToken, 'Emulator fixture parent must authenticate');
  return body.idToken;
};

test('student-safe routine state denies wrong PIN and mixed sibling context', async () => {
  const student = free.students[0];
  const good = await callable('readStudentChoreState', context(student));
  assert.ok(good.result, JSON.stringify(good.error));
  assert.equal(good.result.access.can_use_daily_routines, true);
  assert.equal(good.result.access.can_use_rewards, false);
  assert.equal(good.result.routines.length, 3);
  assert.ok(good.result.routines.every((routine) => routine.student_ids === undefined || routine.student_ids.includes(student.id)));
  assert.equal(good.result.rewards.wallet.total_points, 0, 'Current Free baseline omits paid wallet; Phase 2 introduces narrow routine capability');
  assert.equal((await callable('readStudentChoreState', { ...context(student), access_pin: '0000' })).error.status, 'PERMISSION_DENIED');
  assert.equal((await callable('readStudentChoreState', { ...context(student), slug: free.students[1].slug })).error.status, 'PERMISSION_DENIED');
});

test('Free routine completion persists once and retries keep the same completion identity', async () => {
  const student = free.students[0];
  const payload = { ...context(student), routine_template_id: `${student.id}_morning`, completed_item_ids: ['ready'] };
  const first = await callable('completeRoutine', payload);
  assert.ok(first.result, JSON.stringify(first.error));
  assert.equal(first.result.already_completed, false);
  const second = await callable('completeRoutine', payload);
  assert.equal(second.result.already_completed, true);
  assert.equal(first.result.routine_completion_id, second.result.routine_completion_id);
  const record = await db.collection('routineCompletions').doc(first.result.routine_completion_id).get();
  assert.equal(record.data().student_id, student.id);
  const siblingAttempt = await callable('completeRoutine', { ...context(free.students[1]), routine_template_id: payload.routine_template_id, completed_item_ids: ['ready'] });
  assert.equal(siblingAttempt.error.status, 'FAILED_PRECONDITION');
});

test('Free quota enforcement runs through the deployed emulator callable', async () => {
  const token = await signIn(free);
  const response = await callable('createStudent', { name: 'Third Free Student' }, token);
  assert.equal(response.error.status, 'RESOURCE_EXHAUSTED');
  const students = await db.collection('students').where('parent_id', '==', free.parentId).get();
  assert.equal(students.size, 2);
});

test('paid sibling wallet responses are scoped and create requires authenticated owner', async () => {
  const first = await callable('readStudentChoreState', context(core.students[0]));
  const second = await callable('readStudentChoreState', context(core.students[1]));
  assert.equal(first.result.rewards.wallet.total_points, 40);
  assert.equal(second.result.rewards.wallet.total_points, 20);
  assert.equal(first.result.rewards.wallet.student_id, core.students[0].id);
  assert.equal(second.result.rewards.wallet.student_id, core.students[1].id);
  assert.equal((await callable('createStudent', { name: 'Unauthorized' })).error.status, 'UNAUTHENTICATED');
});
