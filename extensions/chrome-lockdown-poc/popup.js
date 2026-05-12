import {
  PAIRING_KEY,
  POLICY_KEY,
  SYNC_STATE_KEY,
  getPairingSettings,
  getPolicy,
  getSyncState,
  isLegacyPairing,
  isPairingConfigured,
  setPolicy,
} from './policy.js';

const statusDot = document.getElementById('status-dot');
const statusPillLabel = document.getElementById('status-pill-label');
const statusCopy = document.getElementById('status-copy');
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
  if (isLegacyPairing(pairing)) {
    return {
      label: 'Migration required',
      copy: 'A legacy PoC pairing is still saved. Cached enforcement is still active, but secure sync is paused until you pair with a trusted enrollment code.',
      summary: pairing.legacy_policy_id
        ? `Legacy policy ID: ${pairing.legacy_policy_id}`
        : 'Legacy pairing needs to be replaced with a trusted enrollment code.',
      timestamp: pairing.paired_at
        ? `Legacy pairing saved ${new Date(pairing.paired_at).toLocaleString()}`
        : 'Legacy pairing replacement is required before the next secure sync.',
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

  if (syncState.status === 'error') {
    return {
      label: 'Using cached fallback',
      copy: syncState.last_error || 'Secure sync failed, so the cached policy is still active.',
      summary: 'The extension will keep enforcing the last good cached policy until sync recovers.',
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
  const syncDescription = describeSyncState(syncState, pairing);

  statusDot.classList.toggle('off', !enabled);
  statusPillLabel.textContent = enabled ? 'Blocking on' : 'Blocking off';
  statusCopy.textContent = paired
    ? enabled
      ? 'Blocking is managed by the paired device credential and includes website and approved-creator checks.'
      : 'The paired device policy currently leaves blocking off.'
    : legacyPairing
      ? enabled
        ? 'Cached blocking is still active, but this browser needs a new trusted pairing before it can receive policy changes.'
        : 'This browser needs a new trusted pairing before it can receive policy changes.'
      : enabled
        ? 'Top-level browsing is limited to the website allowlist and approved YouTube creators.'
        : 'Browsing is unrestricted until you turn local blocking back on.';
  originCount.textContent = String(policy.allowed_origins.length);
  creatorCount.textContent = String(policy.allowed_youtube_channels.length);
  toggleButton.textContent = paired
    ? 'Managed by parent portal'
    : legacyPairing
      ? 'Migration required'
      : enabled
        ? 'Turn blocking off'
        : 'Turn blocking on';
  toggleButton.disabled = paired || legacyPairing;
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
