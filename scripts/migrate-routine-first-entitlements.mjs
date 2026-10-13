import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import apiv2 from 'firebase-tools/lib/apiv2.js';
import cliAuth from 'firebase-tools/lib/requireAuth.js';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const projectId = option('project');
const target = option('target');
if (!projectId || !['emulator', 'staging', 'production'].includes(target)) {
  throw new Error('Specify --project=<id> and --target=<emulator|staging|production>; default behavior is dry-run.');
}
const write = args.includes('--write');
const activate = args.includes('--activate');
const deactivate = args.includes('--deactivate');
if (activate && deactivate) throw new Error('Choose activation or deactivation, not both.');
const action = activate ? 'activate' : deactivate ? 'deactivate' : 'prepare';
const enableNew = args.includes('--enable-new-accounts');
const disableNew = args.includes('--disable-new-accounts');
if ((enableNew && disableNew) || (enableNew && !activate) || (disableNew && !deactivate)) {
  throw new Error('New-account rollout requires --activate --enable-new-accounts or --deactivate --disable-new-accounts.');
}
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '';
if (target === 'emulator') {
  if (projectId !== 'demo-gridworkz-direction' || !/^127\.0\.0\.1:\d+$/.test(emulatorHost)) {
    throw new Error('Emulator migration requires demo-gridworkz-direction and a loopback FIRESTORE_EMULATOR_HOST.');
  }
} else if (projectId.startsWith('demo-') || emulatorHost) {
  throw new Error('Cloud migration cannot use a demo project or an emulator host.');
}

// Only explicitly selected project metadata is touched. Activation remains opt-in.
process.env.GCLOUD_PROJECT = projectId;
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
let credential;
if (target !== 'emulator') {
  const config = JSON.parse(await fs.readFile(`${process.env.HOME}/.config/configstore/firebase-tools.json`, 'utf8'));
  await cliAuth.requireAuth({ project: projectId, user: config.user, tokens: config.tokens });
  credential = { getAccessToken: async () => ({ access_token: await apiv2.getAccessToken(), expires_in: 300 }) };
}
const app = initializeApp({ projectId, ...(credential ? { credential } : {}) }, 'routine-first-migration');
const db = getFirestore(app);
const { buildRoutineFirstEntitlementPatch } = await import('../functions/src/index.js');
const parents = option('parents')?.split(',').filter(Boolean);
const accounts = parents
  ? await Promise.all(parents.map((id) => db.collection('accountEntitlements').doc(id).get()))
  : (await db.collection('accountEntitlements').get()).docs;
const summary = { target, project: projectId, action, mode: write ? 'write' : 'dry-run', examined: 0, changed: 0, unchanged: 0, missing: 0 };
const protectedKeys = ['billing_state', 'manual_override', 'usage_snapshot', 'billing_provider', 'subscription_id', 'customer_id', 'stripe_customer_id', 'stripe_subscription_id'];
const allowedKeys = new Set(['parent_id', 'plan_id', 'features', 'limits', 'product_direction_version', 'product_direction_migration_version', 'product_direction_migrated_at']);
const patchFor = (id, data) => {
  const patch = buildRoutineFirstEntitlementPatch({ parentId: id, entitlementDoc: data, activate, nowMillis: Date.now() });
  if (deactivate) patch.product_direction_version = 0;
  assert.ok(Object.keys(patch).every((key) => allowedKeys.has(key)), 'Unexpected field in migration patch');
  for (const key of protectedKeys) {
    assert.ok(!Object.hasOwn(patch, key), `Migration must leave ${key} untouched`);
  }
  return patch;
};
const equalPatch = (data, patch) => Object.keys(patch).every((key) => isDeepStrictEqual(data[key], patch[key]));
try {
  for (const snapshot of accounts) {
    if (!snapshot.exists) { summary.missing++; continue; }
    summary.examined++;
    const patch = patchFor(snapshot.id, snapshot.data());
    if (equalPatch(snapshot.data(), patch)) { summary.unchanged++; continue; }
    if (!write) { summary.changed++; continue; }
    const receiptId = `v1_${action}_${createHash('sha256').update(snapshot.id).digest('hex').slice(0, 24)}`;
    const receiptRef = db.collection('productDirectionMigrations').doc(receiptId);
    const changed = await db.runTransaction(async (transaction) => {
      const [current, receipt] = await Promise.all([transaction.get(snapshot.ref), transaction.get(receiptRef)]);
      if (!current.exists) throw new Error('Entitlement disappeared during migration; rerun inventory.');
      const currentPatch = patchFor(current.id, current.data());
      if (equalPatch(current.data(), currentPatch)) return false;
      // Check against the transaction's fresh read, not a stale inventory read.
      // A concurrent billing/support update causes retry; it is never overwritten.
      const merged = { ...current.data(), ...currentPatch };
      for (const key of protectedKeys) assert.deepEqual(merged[key], current.data()[key]);
      transaction.set(current.ref, currentPatch, { merge: true });
      transaction.set(receiptRef, {
        migration_version: 1, action, parent_id: current.id, project_id: projectId,
        before: receipt.exists ? receipt.data().before : {
          plan_id: current.data().plan_id || 'free', product_direction_version: current.data().product_direction_version || 0,
          features: current.data().features || null, limits: current.data().limits || null,
        },
        applied_fields: Object.keys(currentPatch), updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
      return true;
    });
    if (changed) {
      summary.changed++;
    } else summary.unchanged++;
  }
  if (enableNew || disableNew) {
    summary.new_accounts = enableNew ? 'enabled' : 'disabled';
    const configRef = db.collection('productDirectionConfig').doc('routineFirst');
    const config = await configRef.get();
    summary.new_accounts_changed = config.data()?.version !== 1 || config.data()?.new_accounts_enabled !== enableNew;
    if (write && summary.new_accounts_changed) {
      await db.runTransaction(async (transaction) => {
        const receiptRef = db.collection('productDirectionMigrations').doc(`v1_new_accounts_${summary.new_accounts}`);
        const [current, receipt] = await Promise.all([transaction.get(configRef), transaction.get(receiptRef)]);
        transaction.set(configRef, { version: 1, new_accounts_enabled: enableNew, updated_at: FieldValue.serverTimestamp() }, { merge: true });
        transaction.set(receiptRef, { migration_version: 1, action: `new_accounts_${summary.new_accounts}`, project_id: projectId,
          before: receipt.exists ? receipt.data().before : { version: current.data()?.version || 0, new_accounts_enabled: current.data()?.new_accounts_enabled === true },
          updated_at: FieldValue.serverTimestamp() }, { merge: true });
      });
    }
  }
  console.log(JSON.stringify(summary, null, 2));
} finally { await deleteApp(app); }
