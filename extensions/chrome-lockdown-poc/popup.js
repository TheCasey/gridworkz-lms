import {
  PAIRING_KEY,
  POLICY_KEY,
  SYNC_STATE_KEY,
  getPairingSettings,
  getPolicy,
  getSyncState,
  isPairingConfigured,
  setPolicy
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

function describeSyncState(syncState, paired) {
  if (!paired) {
    return {
      label: 'Not paired',
      copy: 'This extension is still using its local PoC policy.',
      summary: 'No pairing saved yet.',
      timestamp: 'No remote sync has completed yet.'
    };
  }

  if (syncState.status === 'syncing') {
    return {
      label: 'Syncing now',
      copy: 'Polling Firestore for the latest parent policy.',
      summary: 'Using the saved pairing to fetch the policy document.',
      timestamp: syncState.last_attempt_at
        ? `Latest sync attempt ${new Date(syncState.last_attempt_at).toLocaleString()}`
        : 'Sync has started.'
    };
  }

  if (syncState.status === 'synced') {
    return {
      label: 'Remote policy synced',
      copy: 'Popup counts and enforcement reflect the latest Firestore policy.',
      summary: 'Paired to a saved remote policy document.',
      timestamp: syncState.last_sync_at
        ? `Last remote sync ${new Date(syncState.last_sync_at).toLocaleString()}`
        : 'Remote sync completed.'
    };
  }

  if (syncState.status === 'error') {
    return {
      label: 'Using cached fallback',
      copy: syncState.last_error || 'Remote sync failed, so the cached policy is still active.',
      summary: 'The extension will keep enforcing the last cached policy until sync recovers.',
      timestamp: syncState.last_attempt_at
        ? `Latest sync failure ${new Date(syncState.last_attempt_at).toLocaleString()}`
        : 'Remote sync failed before a timestamp was captured.'
    };
  }

  return {
    label: 'Paired',
    copy: 'The extension is paired and waiting for the first remote sync.',
    summary: 'Paired to a saved remote policy document.',
    timestamp: 'No remote sync has completed yet.'
  };
}

function renderPolicy(policy, pairing, syncState) {
  const enabled = policy.is_enabled;
  const paired = isPairingConfigured(pairing);
  const syncDescription = describeSyncState(syncState, paired);

  statusDot.classList.toggle('off', !enabled);
  statusPillLabel.textContent = enabled ? 'Blocking on' : 'Blocking off';
  statusCopy.textContent = paired
    ? enabled
      ? 'Blocking is managed by the paired parent policy and includes website and approved-creator checks.'
      : 'The paired parent policy currently leaves blocking off.'
    : enabled
      ? 'Top-level browsing is limited to the website allowlist and approved YouTube creators.'
      : 'Browsing is unrestricted until you turn local blocking back on.';
  originCount.textContent = String(policy.allowed_origins.length);
  creatorCount.textContent = String(policy.allowed_youtube_channels.length);
  toggleButton.textContent = paired
    ? 'Managed by parent portal'
    : enabled
      ? 'Turn blocking off'
      : 'Turn blocking on';
  toggleButton.disabled = paired;
  syncStatusLabel.textContent = syncDescription.label;
  syncStatusCopy.textContent = syncDescription.copy;
  pairingSummary.textContent = paired
    ? `Paired policy ID: ${pairing.policy_id}`
    : syncDescription.summary;
  syncTimestamp.textContent = syncDescription.timestamp;
  syncButton.disabled = !paired || syncState.status === 'syncing';
  updatedAt.textContent = formatDateTime(policy.updated_at);
}

async function refresh() {
  const [policy, pairing, syncState] = await Promise.all([
    getPolicy(),
    getPairingSettings(),
    getSyncState()
  ]);

  renderPolicy(policy, pairing, syncState);
}

toggleButton.addEventListener('click', async () => {
  toggleButton.disabled = true;

  try {
    const policy = await getPolicy();
    await setPolicy({
      ...policy,
      is_enabled: !policy.is_enabled
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
