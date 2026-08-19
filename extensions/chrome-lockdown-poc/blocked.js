import {
  POLICY_KEY,
  SYNC_STATE_KEY,
  getLastBlockedRequest,
  getPolicy,
  getSyncState,
} from './policy.js';
import {
  getLockdownStateGuidance,
  getRequestAccessGuidance,
  summarizeAllowedResources,
} from './guidance.js';

const blockedUrl = document.getElementById('blocked-url');
const blockedAt = document.getElementById('blocked-at');
const stateCopy = document.getElementById('state-copy');
const stateNextStep = document.getElementById('state-next-step');
const originList = document.getElementById('origin-list');
const originEmpty = document.getElementById('origin-empty');
const systemResourceList = document.getElementById('system-resource-list');
const systemResourceEmpty = document.getElementById('system-resource-empty');
const viewAllowlistButton = document.getElementById('view-allowlist');
const requestAccessCopy = document.getElementById('request-access-copy');

function renderOrigins(origins) {
  originList.innerHTML = '';

  if (!origins.length) {
    originEmpty.hidden = false;
    return;
  }

  originEmpty.hidden = true;
  origins.forEach((origin) => {
    const item = document.createElement('li');
    item.textContent = origin;
    originList.appendChild(item);
  });
}

function renderSystemResources(resources) {
  systemResourceList.innerHTML = '';

  if (!resources.length) {
    systemResourceEmpty.hidden = false;
    return;
  }

  systemResourceEmpty.hidden = true;
  resources.forEach((resource) => {
    const item = document.createElement('li');
    item.innerHTML = `
      <strong>${resource.name || resource.origin || resource.url || resource.page}</strong>
      <small>${[resource.origin, resource.url || resource.page].filter(Boolean).join(' • ')}</small>
    `;
    systemResourceList.appendChild(item);
  });
}

async function refresh() {
  const [policy, syncState, lastBlockedRequest] = await Promise.all([
    getPolicy(),
    getSyncState(),
    getLastBlockedRequest()
  ]);

  const guidance = getLockdownStateGuidance({
    policy,
    syncState,
  });
  const requestAccess = getRequestAccessGuidance();
  const allowedResources = summarizeAllowedResources(policy);

  stateCopy.textContent = guidance.copy;
  stateNextStep.textContent = guidance.next_step;
  requestAccessCopy.textContent = requestAccess.copy;

  renderOrigins(allowedResources.allowedOrigins);
  renderSystemResources(allowedResources.allowedSystemResources);

  if (lastBlockedRequest?.url) {
    blockedUrl.textContent = lastBlockedRequest.url;
    blockedAt.textContent = `Redirected ${new Date(lastBlockedRequest.blocked_at).toLocaleString()}`;
  } else {
    blockedUrl.textContent = 'No blocked URL captured yet';
    blockedAt.textContent = 'Navigation details will appear here while testing the unpacked extension.';
  }
}

viewAllowlistButton.addEventListener('click', () => {
  window.location.href = chrome.runtime.getURL('allowlist.html');
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes[POLICY_KEY] || changes[SYNC_STATE_KEY] || changes.lockdownLastBlockedRequest) {
    void refresh();
  }
});

void refresh();
