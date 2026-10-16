import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/, 'Loopback Firestore emulator required.');
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
// Separate disposable emulator project avoids replacing another test run's rules/data.
const env = await initializeTestEnvironment({ projectId: 'demo-gridworkz-quota-rules',
  firestore: { host, port: Number(port), rules: await fs.readFile('firestore.rules', 'utf8') } });
const prefix = `quota_rules_${randomUUID().replaceAll('-', '')}`;
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const seed = async (id, data) => env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), 'subjects', id), data));
try {
  for (const plan of ['free', 'core']) {
    const parentId = `${prefix}_${plan}`;
    const database = env.authenticatedContext(parentId).firestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'parents', parentId), { parent_id: parentId });
      await setDoc(doc(adminDb, 'accountEntitlements', parentId), { parent_id: parentId, plan_id: plan, subscription_status: 'active' });
    });
    await check(`${plan}: owner keeps ordinary active edits, archive and delete while ownership is immutable`, async () => {
      const id = `${parentId}_active`;
      await seed(id, { parent_id: parentId, title: 'Existing active legacy curriculum' });
      const ref = doc(database, 'subjects', id);
      await assertSucceeds(updateDoc(ref, { title: 'Edit existing', is_active: true }));
      await assertFails(updateDoc(ref, { parent_id: `${prefix}_other` }));
      await assertSucceeds(updateDoc(ref, { is_active: false }));
      await assertSucceeds(updateDoc(ref, { title: 'Edit archived work' }));
      await assertFails(updateDoc(ref, { is_active: true }));
      await assertSucceeds(deleteDoc(ref));
    });
    await check(`${plan}: every legacy archive flag denies direct reactivation`, async () => {
      const flags = [{ is_active: false }, { is_archived: true }, { archived: true }, { status: 'archived' }, { archived_at: new Date() }];
      for (let i = 0; i < flags.length; i++) {
        const id = `${parentId}_archived_${i}`;
        await seed(id, { parent_id: parentId, ...flags[i] });
        const ref = doc(database, 'subjects', id);
        await assertFails(updateDoc(ref, { is_active: true, is_archived: false, archived: false, status: 'active', archived_at: null }));
        await assertSucceeds(updateDoc(ref, { title: 'Preserved archive edit' }));
        await assertFails(setDoc(ref, { parent_id: parentId, title: 'Overwrite to bypass' }));
      }
      await assertFails(setDoc(doc(database, 'subjects', `${parentId}_new`), { parent_id: parentId, is_active: true }));
      await assertFails(setDoc(doc(database, 'students', `${parentId}_new`), { parent_id: parentId }));
    });
    await check(`${plan}: quota coordinator remains private server authority`, async () => {
      await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), 'quotaMutationState', parentId), { parent_id: parentId, revision: 2 }));
      for (const uid of [parentId, `${prefix}_other`, null]) {
        const context = uid ? env.authenticatedContext(uid) : env.unauthenticatedContext();
        const ref = doc(context.firestore(), 'quotaMutationState', parentId);
        await assertFails(getDoc(ref));
        await assertFails(setDoc(ref, { parent_id: parentId, revision: 0 }));
        await assertFails(deleteDoc(ref));
      }
    });
  }
  console.log(`${passed} quota rules cases passed.`);
} finally { await env.cleanup(); }
