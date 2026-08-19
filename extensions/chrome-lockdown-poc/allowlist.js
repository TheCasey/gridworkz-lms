import {
  POLICY_KEY,
  SYNC_STATE_KEY,
  getPolicy,
  getSyncState,
} from './policy.js';
import {
  getLockdownStateGuidance,
  summarizeAllowedResources,
} from './guidance.js';

const stateCopy = document.getElementById('state-copy');
const updatedAt = document.getElementById('updated-at');
const originList = document.getElementById('origin-list');
const originEmpty = document.getElementById('origin-empty');
const creatorList = document.getElementById('creator-list');
const creatorEmpty = document.getElementById('creator-empty');
const systemResourceList = document.getElementById('system-resource-list');
const systemResourceEmpty = document.getElementById('system-resource-empty');

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

function renderCreators(creators) {
  creatorList.innerHTML = '';

  if (!creators.length) {
    creatorEmpty.hidden = false;
    return;
  }

  creatorEmpty.hidden = true;
  creators.forEach((creator) => {
    const item = document.createElement('li');
    item.innerHTML = `
      <strong>${creator.title || creator.channel_id}</strong>
      <small>${creator.handle || 'No public handle stored'} • ${creator.channel_id}</small>
    `;
    creatorList.appendChild(item);
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
  const [policy, syncState] = await Promise.all([
    getPolicy(),
    getSyncState(),
  ]);
  const guidance = getLockdownStateGuidance({ policy, syncState });
  const allowedResources = summarizeAllowedResources(policy);

  stateCopy.textContent = guidance.stateKey === 'active_block'
    ? 'These entries come from the cached device policy and remain visible while the browser is blocked elsewhere.'
    : `${guidance.title}. ${guidance.next_step}`;
  updatedAt.textContent = policy.updated_at
    ? `Last updated ${new Date(policy.updated_at).toLocaleString()}`
    : 'Policy state has not been changed yet.';
  renderOrigins(allowedResources.allowedOrigins);
  renderCreators(allowedResources.allowedCreators);
  renderSystemResources(allowedResources.allowedSystemResources);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || (!changes[POLICY_KEY] && !changes[SYNC_STATE_KEY])) return;
  void refresh();
});

void refresh();
