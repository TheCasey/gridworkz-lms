import {
  PAIRING_KEY,
  POLICY_KEY,
  SYNC_STATE_KEY,
  LOCKDOWN_SYNC_STATUSES,
  getPairingSettings,
  getPolicy,
  getSyncState,
  isLegacyPairing,
  isPairingConfigured,
  setPolicy,
} from './policy.js';
import {
  getLockdownStateGuidance,
  getRequestAccessGuidance,
  summarizeAllowedResources,
} from './guidance.js';

const statusDot = document.getElementById('status-dot');
const statusPillLabel = document.getElementById('status-pill-label');
const statusCopy = document.getElementById('status-copy');
const requestAccessCopy = document.getElementById('request-access-copy');
const originCount = document.getElementById('origin-count');
const creatorCount = document.getElementById('creator-count');
const toggleButton = document.getElementById('toggle-button');
const syncButton = document.getElementById('sync-button');
const setupButton = document.getElementById('setup-button');
const allowlistButton = document.getElementById('allowlist-button');
const updatedAt = document.getElementById('updated-at');
const syncStatusLabel = document.getElementById('sync-status-label');
const syncStatusCopy = document.getElementById('sync-status-copy');
const pairingSummary = document.getElementById('pairing-summary');
const syncTimestamp = document.getElementById('sync-timestamp');

function formatDateTime(value) {
  if (!value) return 'Cached policy state has not been changed yet.';
  return `Cached policy updated ${new Date(value).toLocaleString()}`;
}

function describeSyncState(syncState, pairing) {
  if (syncState.status === LOCKDOWN_SYNC_STATUSES.RECOVERY_UNPAIRED) {
    return {
      label: 'Parent recovery pending',
      copy: syncState.last_error || 'A parent recovery code cleared the local pairing. Cached enforcement stays local until this browser is paired again.',
      summary: syncState.device_id
        ? `Recovered device: ${syncState.device_id}`
        : 'Local pairing was cleared by parent recovery.',
      timestamp: syncState.last_attempt_at
        ? `Recovery accepted ${new Date(syncState.last_attempt_at).toLocaleString()}`
        : 'Pair this browser again to restore secure policy sync.',
    };
  }

  if (syncState.remote_policy_state === 'stale_cached_policy') {
    return {
      label: 'Using cached policy',
      copy: 'The last trusted policy is still active locally. A fresh sync has not completed yet.',
      summary: pairing.device_name
        ? `Paired device: ${pairing.device_name}`
        : `Device ID: ${pairing.device_id}`,
      timestamp: syncState.last_sync_at
        ? `Cached policy last refreshed ${new Date(syncState.last_sync_at).toLocaleString()}`
        : 'The cached policy is still being used while secure sync recovers.',
    };
  }

  if (isLegacyPairing(pairing)) {
    return {
      label: 'Older pairing saved',
      copy: 'A saved pairing from an older format is still present. Cached enforcement is still active, but secure sync is paused until you pair with a trusted enrollment code.',
      summary: pairing.legacy_policy_id
        ? `Compatibility record: ${pairing.legacy_policy_id}`
        : 'Older pairing data needs to be replaced with a trusted enrollment code.',
      timestamp: pairing.paired_at
        ? `Older pairing saved ${new Date(pairing.paired_at).toLocaleString()}`
        : 'Replace the older pairing before the next secure sync.',
    };
  }

  if (!isPairingConfigured(pairing)) {
    return {
      label: 'Not paired',
      copy: 'This browser is currently enforcing only its local cached policy.',
      summary: 'No trusted pairing saved yet.',
      timestamp: 'No secure policy sync has completed yet.',
    };
  }

  if (syncState.status === LOCKDOWN_SYNC_STATUSES.DEVICE_REVOKED) {
    return {
      label: 'Device revoked',
      copy: syncState.last_error || 'This saved device credential was revoked in the parent dashboard. Cached policy remains active locally until you pair again.',
      summary: pairing.device_name
        ? `Revoked device: ${pairing.device_name}`
        : `Device ID: ${pairing.device_id}`,
      timestamp: syncState.last_attempt_at
        ? `Revocation detected ${new Date(syncState.last_attempt_at).toLocaleString()}`
        : 'Secure sync is paused until you pair again.',
    };
  }

  if (syncState.status === LOCKDOWN_SYNC_STATUSES.DEVICE_INACTIVE) {
    return {
      label: 'Device inactive',
      copy: syncState.last_error || 'This saved device credential is inactive on the server. Cached policy remains active locally until you pair again.',
      summary: pairing.device_name
        ? `Inactive device: ${pairing.device_name}`
        : `Device ID: ${pairing.device_id}`,
      timestamp: syncState.last_attempt_at
        ? `Inactive status detected ${new Date(syncState.last_attempt_at).toLocaleString()}`
        : 'Secure sync is paused until you pair again.',
    };
  }

  if (syncState.status === LOCKDOWN_SYNC_STATUSES.INVALID_DEVICE_CREDENTIAL) {
    return {
      label: 'Invalid credential',
      copy: syncState.last_error || 'The saved device credential no longer matches the server record. Pair this browser again to restore secure sync.',
      summary: pairing.device_name
        ? `Paired device: ${pairing.device_name}`
        : `Device ID: ${pairing.device_id}`,
      timestamp: syncState.last_attempt_at
        ? `Latest sync failure ${new Date(syncState.last_attempt_at).toLocaleString()}`
        : 'Secure sync could not validate the saved credential.',
    };
  }

  if (syncState.status === 'syncing') {
    return {
      label: 'Syncing secure policy',
      copy: 'Reading the latest derived device policy with the saved device credential.',
      summary: pairing.device_name
        ? `Paired device: ${pairing.device_name}`
        : `Device ID: ${pairing.device_id}`,
      timestamp: syncState.last_attempt_at
        ? `Latest sync attempt ${new Date(syncState.last_attempt_at).toLocaleString()}`
        : 'Secure sync has started.',
    };
  }

  if (syncState.status === 'synced') {
    const policyState = syncState.remote_policy_state
      ? syncState.remote_policy_state.replace(/_/g, ' ')
      : 'derived policy';

    return {
      label: 'Secure policy synced',
      copy: `Enforcement reflects the latest credential-authenticated ${policyState}.`,
      summary: pairing.student_id
        ? `Student binding: ${pairing.student_id}`
        : pairing.device_name
          ? `Paired device: ${pairing.device_name}`
          : `Device ID: ${pairing.device_id}`,
      timestamp: syncState.last_sync_at
        ? `Last secure sync ${new Date(syncState.last_sync_at).toLocaleString()}`
        : 'Secure sync completed.',
    };
  }

  if (syncState.status === LOCKDOWN_SYNC_STATUSES.NETWORK_ERROR || syncState.status === 'error') {
    return {
      label: syncState.using_cached_policy ? 'Using cached fallback' : 'Sync unavailable',
      copy: syncState.using_cached_policy
        ? (syncState.last_error || 'Secure sync failed, so the last trusted policy is still active locally.')
        : (syncState.last_error || 'Secure sync failed before a trusted policy cache was available.'),
      summary: syncState.using_cached_policy
        ? 'The extension will keep enforcing the last good cached policy until sync recovers.'
        : 'The extension could not confirm a trusted cache, so pairing must recover before a secure sync can resume.',
      timestamp: syncState.last_attempt_at
        ? `Latest sync failure ${new Date(syncState.last_attempt_at).toLocaleString()}`
        : 'Secure sync failed before a timestamp was captured.',
    };
  }

  return {
    label: 'Paired',
    copy: 'This browser is paired and ready for secure policy sync.',
    summary: pairing.device_name
      ? `Paired device: ${pairing.device_name}`
      : `Device ID: ${pairing.device_id}`,
    timestamp: pairing.paired_at
      ? `Paired ${new Date(pairing.paired_at).toLocaleString()}`
      : 'Pairing completed, waiting on the first secure sync.',
  };
}

function renderPolicy(policy, pairing, syncState) {
  const enabled = policy.is_enabled;
  const paired = isPairingConfigured(pairing);
  const legacyPairing = isLegacyPairing(pairing);
  const recoveryPending = syncState.status === LOCKDOWN_SYNC_STATUSES.RECOVERY_UNPAIRED;
  const syncDescription = describeSyncState(syncState, pairing);
  const guidance = getLockdownStateGuidance({ policy, syncState });
  const requestAccess = getRequestAccessGuidance();
  const allowedResources = summarizeAllowedResources(policy);
  const showStateLabel = guidance.stateKey !== 'active_block';

  statusDot.classList.toggle('off', !enabled);
  statusPillLabel.textContent = showStateLabel
    ? (guidance.label || (enabled ? 'Blocking on' : 'Blocking off'))
    : (enabled ? 'Blocking on' : 'Blocking off');
  statusCopy.textContent = paired
    ? enabled
      ? (showStateLabel ? guidance.copy : 'Blocking is managed by the paired device credential and includes website and approved-creator checks.')
      : 'The paired device policy currently leaves blocking off.'
    : recoveryPending
      ? 'Parent recovery cleared this browser pairing. Cached enforcement remains on locally until a trusted enrollment code pairs it again.'
      : legacyPairing
      ? enabled
        ? 'Cached blocking is still active, but this browser needs a new trusted pairing before it can receive policy changes.'
        : 'This browser needs a new trusted pairing before it can receive policy changes.'
      : enabled
        ? guidance.copy
        : 'Browsing is unrestricted until you turn local blocking back on.';
  requestAccessCopy.textContent = requestAccess.copy;
  originCount.textContent = String(allowedResources.allowedOrigins.length);
  creatorCount.textContent = String(allowedResources.allowedCreators.length);
  toggleButton.textContent = paired
    ? 'Managed by parent portal'
    : recoveryPending
      ? 'Parent recovery pending'
    : legacyPairing
      ? 'Older pairing saved'
      : enabled
        ? 'Turn blocking off'
        : 'Turn blocking on';
  toggleButton.disabled = paired || legacyPairing || recoveryPending;
  syncStatusLabel.textContent = syncDescription.label;
  syncStatusCopy.textContent = syncDescription.copy;
  pairingSummary.textContent = syncDescription.summary;
  syncTimestamp.textContent = syncDescription.timestamp;
  syncButton.disabled = !paired || syncState.status === 'syncing';
  updatedAt.textContent = formatDateTime(policy.updated_at);
}

async function refresh() {
  const [policy, pairing, syncState] = await Promise.all([
    getPolicy(),
    getPairingSettings(),
    getSyncState(),
  ]);

  renderPolicy(policy, pairing, syncState);
}

toggleButton.addEventListener('click', async () => {
  toggleButton.disabled = true;

  try {
    const policy = await getPolicy();
    await setPolicy({
      ...policy,
      is_enabled: !policy.is_enabled,
    });
  } finally {
    toggleButton.disabled = false;
  }
});

allowlistButton.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('allowlist.html') });
});

setupButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

syncButton.addEventListener('click', async () => {
  syncButton.disabled = true;

  try {
    await chrome.runtime.sendMessage({ type: 'lockdown:sync-now' });
  } finally {
    await refresh();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (!changes[POLICY_KEY] && !changes[PAIRING_KEY] && !changes[SYNC_STATE_KEY]) return;
  void refresh();
});

void refresh();
