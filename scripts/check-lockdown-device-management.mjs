#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildTrustedSyncFailureState,
  LOCKDOWN_SYNC_STATUSES,
} from '../extensions/chrome-lockdown-poc/policy.js';
import {
  buildLockdownDeviceSummary,
  buildLockdownDeviceSummaryState,
  LockdownDeviceSummaryStates,
  LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS,
} from '../src/utils/lockdownPolicyUtils.js';

const functionsSource = readFileSync(new URL('../functions/src/index.js', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../src/constants/schema.js', import.meta.url), 'utf8');
const trustedOperationsSource = readFileSync(
  new URL('../src/firebase/trustedOperations.js', import.meta.url),
  'utf8'
);
const panelSource = readFileSync(
  new URL('../src/components/LockdownPolicyPanel.jsx', import.meta.url),
  'utf8'
);
const backgroundSource = readFileSync(
  new URL('../extensions/chrome-lockdown-poc/background.js', import.meta.url),
  'utf8'
);
const popupSource = readFileSync(
  new URL('../extensions/chrome-lockdown-poc/popup.js', import.meta.url),
  'utf8'
);
const optionsSource = readFileSync(
  new URL('../extensions/chrome-lockdown-poc/options.js', import.meta.url),
  'utf8'
);

for (const functionName of [
  'LIST_LOCKDOWN_DEVICES',
  'REVOKE_LOCKDOWN_DEVICE',
  'ISSUE_LOCKDOWN_RECOVERY',
  'RECOVER_LOCKDOWN_DEVICE_PAIRING',
  'READ_LOCKDOWN_DEVICE_POLICY',
]) {
  assert.ok(schemaSource.includes(functionName), `${functionName} is exported in TrustedFunctionNames`);
}

for (const wrapperName of [
  'issueTrustedLockdownRecovery',
  'listTrustedLockdownDevices',
  'revokeTrustedLockdownDevice',
]) {
  assert.ok(
    trustedOperationsSource.includes(`export const ${wrapperName}`),
    `${wrapperName} client wrapper is exported`
  );
}

assert.ok(
  panelSource.includes('listTrustedLockdownDevices'),
  'dashboard device table reads through the trusted callable bridge'
);
assert.ok(
  panelSource.includes('revokeTrustedLockdownDevice'),
  'dashboard revoke action uses the trusted callable bridge'
);
assert.ok(
  panelSource.includes('issueTrustedLockdownRecovery'),
  'dashboard recovery action uses the trusted callable bridge'
);
assert.ok(
  panelSource.includes('buildTrustedLockdownRecoveryCode'),
  'dashboard renders parent recovery material as a copyable code'
);
assert.ok(
  panelSource.includes('LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS'),
  'dashboard device summaries use the shared stale-device threshold constant'
);
assert.ok(
  panelSource.includes("student_id: selectedStudentId"),
  'dashboard device list requests stay scoped to the selected student'
);

for (const callableName of ['listLockdownDevices', 'revokeLockdownDevice', 'issueLockdownRecovery']) {
  const start = functionsSource.indexOf(`export const ${callableName} = onCall`);
  const next = functionsSource.indexOf('\nexport const ', start + 1);
  const callableSource = functionsSource.slice(start, next === -1 ? functionsSource.length : next);

  assert.notEqual(start, -1, `${callableName} is exported as a callable`);
  assert.ok(
    callableSource.includes('ensureAuthenticated(request)'),
    `${callableName} requires parent authentication`
  );
  assert.ok(
    callableSource.includes('ensureLockdownExtensionEntitlement(entitlementState)'),
    `${callableName} keeps device management gated by the Lockdown entitlement`
  );
}

const issueRecoveryStart = functionsSource.indexOf('export const issueLockdownRecovery = onCall');
const issueRecoveryNext = functionsSource.indexOf('\nexport const ', issueRecoveryStart + 1);
const issueRecoverySource = functionsSource.slice(
  issueRecoveryStart,
  issueRecoveryNext === -1 ? functionsSource.length : issueRecoveryNext
);

assert.ok(
  issueRecoverySource.includes('LOCKDOWN_RECOVERY_TTL_MS'),
  'parent-issued recovery codes use the short-lived recovery TTL'
);
assert.ok(
  issueRecoverySource.includes('requestedStudentId && requestedStudentId !== deviceStudentId'),
  'parent-issued recovery codes are bound to the selected student and device binding'
);
assert.ok(
  issueRecoverySource.includes('token_hash: recoveryCredential.tokenHash'),
  'recovery tokens are stored hashed server-side'
);
assert.ok(
  issueRecoverySource.includes('device_id: deviceId'),
  'recovery tickets are bound to a device id'
);

const listStart = functionsSource.indexOf('export const listLockdownDevices = onCall');
const listNext = functionsSource.indexOf('\nexport const ', listStart + 1);
const listSource = functionsSource.slice(
  listStart,
  listNext === -1 ? functionsSource.length : listNext
);

assert.ok(
  listSource.includes('loadLockdownStudentBinding({'),
  'device listing validates the requested student binding before querying devices'
);
assert.ok(
  listSource.includes('allowImplicitSingleStudent: false'),
  'device listing does not silently fall back to another student when a selected student is requested'
);
assert.ok(
  listSource.includes(".where('student_id', '==', requestedStudentId)"),
  'selected-student device listing is scoped in the Firestore query and returns an empty list for no matching rows'
);
assert.ok(
  !listSource.includes('.filter((deviceRecord) => ('),
  'selected-student device listing does not rely on broad parent reads followed only by client-side filtering'
);

const revokeStart = functionsSource.indexOf('export const revokeLockdownDevice = onCall');
const revokeNext = functionsSource.indexOf('\nexport const ', revokeStart + 1);
const revokeSource = functionsSource.slice(
  revokeStart,
  revokeNext === -1 ? functionsSource.length : revokeNext
);

assert.ok(
  revokeSource.includes('status: LOCKDOWN_DEVICE_STATUSES.REVOKED'),
  'revoking a device flips the trusted record to revoked'
);
assert.ok(
  backgroundSource.includes("device_revoked"),
  'the extension background distinguishes revoked device credentials'
);
assert.ok(
  popupSource.includes("DEVICE_REVOKED"),
  'the popup distinguishes revoked credentials from other sync failures'
);
assert.ok(
  optionsSource.includes("DEVICE_REVOKED"),
  'the options page distinguishes revoked credentials from other sync failures'
);

const recoveryStart = functionsSource.indexOf('export const lockdownRecoverDevicePairing = onRequest');
const recoveryNext = functionsSource.indexOf('\nexport const ', recoveryStart + 1);
const recoverySource = functionsSource.slice(
  recoveryStart,
  recoveryNext === -1 ? functionsSource.length : recoveryNext
);

assert.notEqual(recoveryStart, -1, 'lockdownRecoverDevicePairing is exported as a public validation endpoint');
assert.ok(
  recoverySource.includes('body.recovery_token'),
  'recovery validation requires the parent-issued recovery token'
);
assert.ok(
  recoverySource.includes('readBearerToken(request) || trimString(body.device_credential)'),
  'recovery validation also requires the local saved device credential'
);
assert.ok(
  recoverySource.includes('parsedDeviceCredential.documentId !== recoveryDeviceId'),
  'recovery validation rejects codes presented by the wrong device'
);
assert.ok(
  recoverySource.includes('constantTimeHexEquals(deviceRecord.credential_hash'),
  'recovery validation checks the current device credential hash'
);
assert.ok(
  recoverySource.includes('status: LOCKDOWN_RECOVERY_STATUSES.CONSUMED'),
  'recovery validation consumes the one-time code'
);
assert.ok(
  recoverySource.includes("'recovery_expired'"),
  'recovery validation rejects expired recovery codes distinctly'
);
assert.ok(
  recoverySource.includes("'recovery_consumed'"),
  'recovery validation rejects reused recovery codes distinctly'
);
assert.ok(
  recoverySource.includes("'wrong_device'"),
  'recovery validation rejects same-parent wrong-device attempts'
);
assert.ok(
  !recoverySource.includes('status: LOCKDOWN_DEVICE_STATUSES.REVOKED'),
  'local recovery does not revoke or otherwise mutate the trusted device record'
);
assert.ok(
  backgroundSource.includes("status: 'recovery_unpaired'"),
  'extension clears local pairing into a distinct recovered-unpaired state'
);
assert.ok(
  backgroundSource.includes('await clearPairingSettings()'),
  'extension recovery clears local pairing settings'
);
assert.ok(
  backgroundSource.includes('is_enabled: true'),
  'extension recovery keeps cached enforcement from becoming open browsing'
);

const revokedState = buildTrustedSyncFailureState({
  currentSyncState: {
    last_sync_at: '2026-05-22T08:00:00.000Z',
    remote_policy_updated_at: '2026-05-22T08:00:00.000Z',
  },
  errorCode: 'device_revoked',
  errorMessage: 'revoked',
});
assert.equal(revokedState.status, LOCKDOWN_SYNC_STATUSES.DEVICE_REVOKED);
assert.equal(revokedState.using_cached_policy, true);

const inactiveState = buildTrustedSyncFailureState({
  currentSyncState: {
    last_sync_at: '2026-05-22T08:00:00.000Z',
    remote_policy_updated_at: '2026-05-22T08:00:00.000Z',
  },
  errorCode: 'device_inactive',
  errorMessage: 'inactive',
});
assert.equal(inactiveState.status, LOCKDOWN_SYNC_STATUSES.DEVICE_INACTIVE);
assert.equal(inactiveState.using_cached_policy, true);
assert.notEqual(inactiveState.status, revokedState.status);

const invalidCredentialState = buildTrustedSyncFailureState({
  currentSyncState: {
    last_sync_at: '2026-05-22T08:00:00.000Z',
    remote_policy_updated_at: '2026-05-22T08:00:00.000Z',
  },
  errorCode: 'invalid_device_credential',
  errorMessage: 'invalid',
});
assert.equal(invalidCredentialState.status, LOCKDOWN_SYNC_STATUSES.INVALID_DEVICE_CREDENTIAL);
assert.equal(invalidCredentialState.using_cached_policy, true);

const networkFailureWithCache = buildTrustedSyncFailureState({
  currentSyncState: {
    last_sync_at: '2026-05-22T08:00:00.000Z',
    remote_policy_updated_at: '2026-05-22T08:00:00.000Z',
  },
  errorCode: 'network_error',
  errorMessage: 'offline',
});
assert.equal(networkFailureWithCache.status, LOCKDOWN_SYNC_STATUSES.NETWORK_ERROR);
assert.equal(networkFailureWithCache.using_cached_policy, true);

const networkFailureWithoutCache = buildTrustedSyncFailureState({
  currentSyncState: {
    last_sync_at: null,
    remote_policy_updated_at: null,
    using_cached_policy: false,
  },
  errorCode: 'network_error',
  errorMessage: 'offline',
});
assert.equal(networkFailureWithoutCache.status, LOCKDOWN_SYNC_STATUSES.NETWORK_ERROR);
assert.equal(networkFailureWithoutCache.using_cached_policy, false);

const referenceNow = Date.parse('2026-05-27T12:00:00.000Z');
const staleBoundaryIso = '2026-05-20T12:00:00.000Z';
const freshPolicyIso = '2026-05-24T12:00:00.000Z';

const staleDevice = buildLockdownDeviceSummaryState({
  device_id: 'device_stale',
  status: 'active',
  last_seen_at: staleBoundaryIso,
  last_policy_read_at: null,
}, {
  referenceNow,
});
assert.equal(
  staleDevice.summary_state,
  LockdownDeviceSummaryStates.STALE,
  `devices become stale at the ${LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS}-day boundary`
);

const activeDeviceWithRecentSync = buildLockdownDeviceSummaryState({
  device_id: 'device_recent_sync',
  status: 'active',
  last_seen_at: staleBoundaryIso,
  last_policy_read_at: freshPolicyIso,
}, {
  referenceNow,
});
assert.equal(
  activeDeviceWithRecentSync.summary_state,
  LockdownDeviceSummaryStates.PAIRED,
  'a recent policy sync keeps an active device out of the stale bucket'
);

const deviceSummary = buildLockdownDeviceSummary([
  {
    device_id: 'device_paired',
    status: 'active',
    last_seen_at: freshPolicyIso,
  },
  {
    device_id: 'device_stale',
    status: 'active',
    last_seen_at: staleBoundaryIso,
  },
  {
    device_id: 'device_revoked',
    status: 'revoked',
    last_seen_at: '2026-05-10T12:00:00.000Z',
  },
  {
    device_id: 'device_inactive',
    status: 'inactive',
    last_seen_at: '2026-05-26T12:00:00.000Z',
  },
], {
  referenceNow,
});

assert.equal(deviceSummary.total, 4);
assert.equal(deviceSummary.paired, 1);
assert.equal(deviceSummary.stale, 1);
assert.equal(deviceSummary.revoked, 1);
assert.equal(deviceSummary.inactive, 1);
assert.equal(deviceSummary.attention_needed, 3);
assert.equal(
  buildLockdownDeviceSummaryState({
    device_id: 'device_revoked_only',
    status: 'revoked',
    last_seen_at: staleBoundaryIso,
  }, {
    referenceNow,
  }).summary_state,
  LockdownDeviceSummaryStates.REVOKED,
  'revoked devices stay separate from stale devices even when timestamps are old'
);

console.log('Lockdown device-management checks passed.');
