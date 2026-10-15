import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
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

test('private drafts cannot bypass trusted revisions with direct client writes', async () => {
  const ownerDb = dbFor(parent);
  await assertFails(updateDoc(doc(ownerDb, 'weeklyPlanDrafts', draft.id), { revision: 3, blocks: [] }));
  await assertFails(setDoc(doc(ownerDb, 'weeklyPlanDrafts', `${parent}_new_draft`), draft.data));
  const live = await getDoc(doc(dbFor(), 'weeklyPlans', published.id));
  assert.deepEqual(live.data().blocks, published.data.blocks);
});

test('default week is owner-readable and server-writable only', async () => {
  await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), 'studentDefaultWeeks', defaultId), defaultWeek));
  await assertSucceeds(getDoc(doc(dbFor(parent), 'studentDefaultWeeks', defaultId)));
  await assertFails(getDoc(doc(dbFor(), 'studentDefaultWeeks', defaultId)));
  await assertFails(getDoc(doc(dbFor('another_parent'), 'studentDefaultWeeks', defaultId)));
  for (const uid of [parent, 'another_parent', null]) {
    await assertFails(setDoc(doc(dbFor(uid), 'studentDefaultWeeks', defaultId), defaultWeek));
    await assertFails(updateDoc(doc(dbFor(uid), 'studentDefaultWeeks', defaultId), { revision: 2 }));
  }
});

test('published revisions and student adoption markers cannot be forged or downgraded', async () => {
  const ownerDb = dbFor(parent);
  await assertFails(updateDoc(doc(ownerDb, 'weeklyPlans', published.id), { blocks: [], revision: 2 }));
  await assertFails(updateDoc(doc(ownerDb, 'weeklyPlans', published.id), { schema_version: 0 }));
  const studentRef = doc(ownerDb, 'students', fixture.students[0].id);
  await assertFails(updateDoc(studentRef, { weekly_planning_version: 1 }));
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'students', fixture.students[0].id), { weekly_planning_version: 1 }));
  await assertFails(updateDoc(studentRef, { weekly_planning_version: 0 }));
  await assertSucceeds(updateDoc(studentRef, { name: 'Owner can still edit profile' }));
  const legacy = { ...published.data, schema_version: 0, blocks: [] };
  await assertFails(setDoc(doc(ownerDb, 'weeklyPlans', published.id), legacy));
});

test('parent private queries must be constrained to their own household', async () => {
  await assertSucceeds(getDocs(query(collection(dbFor(parent), 'weeklyPlanDrafts'), where('parent_id', '==', parent))));
  await assertFails(getDocs(collection(dbFor(parent), 'weeklyPlanDrafts')));
  await assertFails(getDocs(query(collection(dbFor('another_parent'), 'weeklyPlanDrafts'), where('parent_id', '==', parent))));
});

test('correction, report amendment, routine snapshot and cosmetic authority deny client writes', async () => {
  for (const name of ['blockCompletionStates', 'parentCorrectionEvents', 'weeklyReportAmendments', 'routineDaySnapshots', 'routineDayPointers', 'studentCosmeticStates', 'householdHistoryEvents', 'weeklyPlanningReceipts']) {
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

test('rollout configuration and migration receipts are never client-readable or writable', async () => {
  for (const name of ['productDirectionConfig', 'productDirectionMigrations']) {
    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), name, 'private'), { parent_id: parent, new_accounts_enabled: true }));
    for (const uid of [parent, 'another_parent', null]) {
      await assertFails(getDoc(doc(dbFor(uid), name, 'private')));
      await assertFails(setDoc(doc(dbFor(uid), name, 'private'), { parent_id: parent, new_accounts_enabled: true }));
    }
  }
});

test('school execution, bridges, receipts, history and amendment heads stay private and server-owned', async () => {
  for (const name of ['schoolExecutionSnapshots', 'schoolPublicationBridges', 'schoolOperationReceipts', 'schoolStateHistory', 'schoolReportAmendmentHeads']) {
    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), name, 'school_test'), { parent_id: parent, student_id: fixture.students[0].id }));
    await assertSucceeds(getDocs(query(collection(dbFor(parent), name), where('parent_id', '==', parent))));
    for (const uid of [null, 'another_parent']) await assertFails(getDoc(doc(dbFor(uid), name, 'school_test')));
    for (const uid of [parent, null, 'another_parent']) await assertFails(setDoc(doc(dbFor(uid), name, 'school_test'), { parent_id: parent }));
  }
});

test('activated school authority blocks stale completion, timer and planning clients and marker downgrades', async () => {
  const student = fixture.students[0];
  const subject = fixture.subjects[0];
  const evidenceId = 'preserved_school_evidence'; const timerId = `${student.id}_${subject.id}`;
  const evidence = { parent_id: parent, student_id: student.id, subject_id: subject.id, block_index: 0, summary_text: 'Original evidence', timestamp: new Date() };
  const timer = { parent_id: parent, student_id: student.id, subject_id: subject.id, block_index: 0, start_time: Date.now(), duration_ms: 60000,
    duration_minutes: 1, target_end_time: Date.now() + 60000, initial_duration_ms: 60000, remaining_time: 60000, is_running: true, saved_at: Date.now() };
  await assertSucceeds(setDoc(doc(dbFor(), 'timerSessions', timerId), timer));
  await assertSucceeds(setDoc(doc(dbFor(), 'submissions', evidenceId), evidence));
  await assertFails(updateDoc(doc(dbFor(parent), 'students', student.id), { school_authority_version: 1 }));
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'students', student.id), { school_authority_version: 1, school_state_revision: 1 }));
  for (const uid of [parent, null]) {
    await assertFails(setDoc(doc(dbFor(uid), 'submissions', 'forged_school_evidence'), evidence));
    await assertFails(updateDoc(doc(dbFor(uid), 'submissions', evidenceId), { summary_text: 'rewritten' }));
    await assertFails(deleteDoc(doc(dbFor(uid), 'submissions', evidenceId)));
    await assertFails(setDoc(doc(dbFor(uid), 'timerSessions', 'forged_timer'), timer));
    await assertFails(updateDoc(doc(dbFor(uid), 'timerSessions', timerId), { remaining_time: 0 }));
    await assertFails(deleteDoc(doc(dbFor(uid), 'timerSessions', timerId)));
  }
  await assertFails(getDoc(doc(dbFor(), 'timerSessions', timerId)));
  await assertSucceeds(getDoc(doc(dbFor(parent), 'timerSessions', timerId)));
  await assertFails(updateDoc(doc(dbFor(parent), 'students', student.id), { school_authority_version: 0, school_state_revision: 0 }));
  await assertFails(updateDoc(doc(dbFor(parent), 'students', student.id), { parent_id: 'another_parent' }));
});

test('trusted evidence and timer context cannot be forged even before adoption; amended originals are locked', async () => {
  const student = fixture.students[1]; const subject = fixture.subjects[1];
  await assertFails(setDoc(doc(dbFor(), 'submissions', 'forged_authority'), { parent_id: parent, student_id: student.id, subject_id: subject.id,
    block_index: 0, authority_version: 1, actor_id: student.id }));
  await assertFails(setDoc(doc(dbFor(), 'timerSessions', 'forged_trusted_timer'), { parent_id: parent, student_id: student.id, subject_id: subject.id,
    authority_version: 1, session_id: 'forged', context_signature: 'forged' }));
  const id = 'locked_original_report';
  await env.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, 'weeklyReports', id), { parent_id: parent, student_id: student.id, total_blocks: 2 });
    await setDoc(doc(database, 'schoolReportAmendmentHeads', id), { parent_id: parent, original_report_id: id, report_version: 2 });
  });
  await assertSucceeds(getDoc(doc(dbFor(parent), 'weeklyReports', id)));
  await assertFails(setDoc(doc(dbFor(parent), 'weeklyReports', 'forged_first_report'), { parent_id: parent, student_id: student.id, total_blocks: 500 }));
  await assertFails(updateDoc(doc(dbFor(parent), 'weeklyReports', id), { total_blocks: 0 }));
  await assertFails(deleteDoc(doc(dbFor(parent), 'weeklyReports', id)));
});

test('weekly plan queries are owner-scoped, including empty query results', async () => {
  await assertSucceeds(getDocs(query(collection(dbFor(parent), 'weeklyPlans'), where('parent_id', '==', parent), where('student_id', '==', fixture.students[0].id))));
  await assertFails(getDocs(collection(dbFor(parent), 'weeklyPlans')));
  await assertFails(getDocs(query(collection(dbFor('another_parent'), 'weeklyPlans'), where('parent_id', '==', parent))));
});
