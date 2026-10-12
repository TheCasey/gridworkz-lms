import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
  buildDirectionFixture, DIRECTION_PROJECT_ID, DIRECTION_RESET_COLLECTIONS, DIRECTION_SCENARIOS,
} from './product-direction-fixtures.mjs';
import { validatePrivateWeeklyPlanDraft, validateStudentCosmeticState } from '../src/utils/productDirectionContracts.js';

const args = process.argv.slice(2);
const scenario = args.find((arg) => arg.startsWith('--scenario='))?.split('=')[1] || 'free';
const fixtures = (scenario === 'all' ? Object.keys(DIRECTION_SCENARIOS) : [scenario])
  .map((name) => buildDirectionFixture({ scenario: name }));
for (const fixture of fixtures) {
  for (const record of fixture.documents) {
    if (record.collection === 'weeklyPlanDrafts') validatePrivateWeeklyPlanDraft(record.data);
    if (record.collection === 'studentCosmeticStates') validateStudentCosmeticState(record.data, {
      parentId: fixture.parentId, studentId: record.data.student_id, catalog: [],
    });
  }
}
if (args.includes('--write')) {
  // This command intentionally has no production/staging mode or project override.
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (!/^127\.0\.0\.1:\d+$/.test(process.env[key] || '')) throw new Error(`${key} must point to a local emulator.`);
  }
  const require = createRequire(new URL('../functions/package.json', import.meta.url));
  const { initializeApp } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const { getFirestore } = require('firebase-admin/firestore');
  const app = initializeApp({ projectId: DIRECTION_PROJECT_ID });
  const db = getFirestore(app);
  for (const fixture of fixtures) {
    try { await getAuth(app).getUser(fixture.auth.uid); }
    catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      await getAuth(app).createUser(fixture.auth);
    }
    // Reset only this scenario's records; emulator-only and stable household identity.
    for (const collection of DIRECTION_RESET_COLLECTIONS) {
      const existing = await db.collection(collection).where('parent_id', '==', fixture.parentId).get();
      for (const doc of existing.docs) await doc.ref.delete();
    }
    const batch = db.batch();
    for (const record of fixture.documents) batch.set(db.collection(record.collection).doc(record.id), record.data);
    await batch.commit();
  }
  await fs.mkdir('tmp/product-direction', { recursive: true });
  await fs.writeFile('tmp/product-direction/emulator-fixtures.json', JSON.stringify(fixtures, null, 2));
}
console.log(JSON.stringify({ mode: args.includes('--write') ? 'emulator-write' : 'dry-run', project: DIRECTION_PROJECT_ID,
  scenarios: fixtures.map((fixture) => ({ name: fixture.scenario, students: fixture.students.length,
    subjects: fixture.subjects.length, documents: fixture.documents.length })) }, null, 2));
