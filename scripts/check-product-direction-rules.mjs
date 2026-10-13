import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { buildDirectionFixture, DIRECTION_PROJECT_ID } from './product-direction-fixtures.mjs';

let env;
const fixture = buildDirectionFixture({ referenceDate: new Date('2026-10-12T15:00:00Z') });
const parent = fixture.parentId;
const published = fixture.documents.find((record) => record.collection === 'weeklyPlans');
const draft = fixture.documents.find((record) => record.collection === 'weeklyPlanDrafts');
const defaultId = `${parent}_${fixture.students[0].id}`;
const defaultWeek = { parent_id: parent, student_id: fixture.students[0].id, schema_version: 1, revision: 1,
  default_block_quantities: { [fixture.subjects[0].id]: { lesson: 2 } } };
const dbFor = (uid) => uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();

before(async () => {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Run rules checks through the local emulator command.');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  env = await initializeTestEnvironment({ projectId: DIRECTION_PROJECT_ID,
    firestore: { host, port: Number(port), rules: await fs.readFile('firestore.rules', 'utf8') } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    for (const record of fixture.documents) await setDoc(doc(database, record.collection, record.id), record.data);
  });
});
after(async () => { await env?.cleanup(); });

test('published plans are public while private drafts never are', async () => {
  const studentDb = dbFor();
  const result = await assertSucceeds(getDoc(doc(studentDb, 'weeklyPlans', published.id)));
  assert.equal(result.data().blocks.length, published.data.blocks.length);
  await assertFails(getDoc(doc(studentDb, 'weeklyPlanDrafts', draft.id)));
  await assertFails(getDoc(doc(dbFor('another_parent'), 'weeklyPlanDrafts', draft.id)));
  await assertSucceeds(getDoc(doc(dbFor(parent), 'weeklyPlanDrafts', draft.id)));
});

test('owner edits private draft without changing student published work', async () => {
  const ownerDb = dbFor(parent);
  await assertSucceeds(updateDoc(doc(ownerDb, 'weeklyPlanDrafts', draft.id), { revision: 3, blocks: [] }));
  const live = await getDoc(doc(dbFor(), 'weeklyPlans', published.id));
  assert.deepEqual(live.data().blocks, published.data.blocks);
  await assertFails(updateDoc(doc(ownerDb, 'weeklyPlanDrafts', draft.id), { revision: 3 }));
  await assertFails(updateDoc(doc(ownerDb, 'weeklyPlanDrafts', draft.id), { revision: 4, student_id: 'another_student' }));
  await assertFails(updateDoc(doc(ownerDb, 'weeklyPlanDrafts', draft.id), { revision: 4, parent_id: 'another_parent' }));
});

test('default week is student-scoped, private, and revision checked', async () => {
  const ownerDb = dbFor(parent);
  await assertSucceeds(setDoc(doc(ownerDb, 'studentDefaultWeeks', defaultId), defaultWeek));
  await assertFails(getDoc(doc(dbFor(), 'studentDefaultWeeks', defaultId)));
  await assertFails(getDoc(doc(dbFor('another_parent'), 'studentDefaultWeeks', defaultId)));
  await assertFails(setDoc(doc(dbFor('another_parent'), 'studentDefaultWeeks', defaultId), defaultWeek));
  await assertFails(updateDoc(doc(ownerDb, 'studentDefaultWeeks', defaultId), { revision: 1 }));
  await assertSucceeds(updateDoc(doc(ownerDb, 'studentDefaultWeeks', defaultId), { revision: 2 }));
  await assertFails(updateDoc(doc(ownerDb, 'studentDefaultWeeks', defaultId), { revision: 3, student_id: fixture.students[1].id }));
});

test('parent private queries must be constrained to their own household', async () => {
  await assertSucceeds(getDocs(query(collection(dbFor(parent), 'weeklyPlanDrafts'), where('parent_id', '==', parent))));
  await assertFails(getDocs(collection(dbFor(parent), 'weeklyPlanDrafts')));
  await assertFails(getDocs(query(collection(dbFor('another_parent'), 'weeklyPlanDrafts'), where('parent_id', '==', parent))));
});

test('correction, report amendment, routine snapshot and cosmetic authority deny client writes', async () => {
  for (const name of ['blockCompletionStates', 'parentCorrectionEvents', 'weeklyReportAmendments', 'routineDaySnapshots', 'routineDayPointers', 'studentCosmeticStates', 'householdHistoryEvents']) {
    const ref = (database) => doc(database, name, 'authority_test');
    await env.withSecurityRulesDisabled(async (context) => setDoc(ref(context.firestore()), { parent_id: parent, student_id: fixture.students[0].id }));
    await assertSucceeds(getDoc(ref(dbFor(parent))));
    await assertFails(getDoc(ref(dbFor())));
    await assertFails(getDoc(ref(dbFor('another_parent'))));
    await assertFails(setDoc(ref(dbFor(parent)), { parent_id: parent, status: 'forged' }));
    await assertFails(setDoc(ref(dbFor()), { parent_id: parent, status: 'forged' }));
  }
});

test('lookup prefixes cannot expose a privileged record belonging to another parent', async () => {
  const id = `${parent}_malformed_foreign_record`;
  await env.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, 'weeklyPlanDrafts', id), { parent_id: 'another_parent' });
    await setDoc(doc(database, 'studentDefaultWeeks', id), { parent_id: 'another_parent' });
  });
  await assertFails(getDoc(doc(dbFor(parent), 'weeklyPlanDrafts', id)));
  await assertFails(getDoc(doc(dbFor(parent), 'studentDefaultWeeks', id)));
});
