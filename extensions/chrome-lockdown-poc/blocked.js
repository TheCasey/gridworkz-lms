import { POLICY_KEY, getLastBlockedRequest, getPolicy } from './policy.js';

const blockedUrl = document.getElementById('blocked-url');
const blockedAt = document.getElementById('blocked-at');
const originList = document.getElementById('origin-list');
const originEmpty = document.getElementById('origin-empty');
const viewAllowlistButton = document.getElementById('view-allowlist');

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

async function refresh() {
  const [policy, lastBlockedRequest] = await Promise.all([
    getPolicy(),
    getLastBlockedRequest()
  ]);

  renderOrigins(policy.allowed_origins);

  if (lastBlockedRequest?.url) {
    blockedUrl.textContent = lastBlockedRequest.url;
    blockedAt.textContent = `Redirected ${new Date(lastBlockedRequest.blocked_at).toLocaleString()}`;
    return;
  }

  blockedUrl.textContent = 'No blocked URL captured yet';
  blockedAt.textContent = 'Navigation details will appear here while testing the unpacked extension.';
}

viewAllowlistButton.addEventListener('click', () => {
  window.location.href = chrome.runtime.getURL('allowlist.html');
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes[POLICY_KEY] || changes.lockdownLastBlockedRequest) {
    void refresh();
  }
});

void refresh();
