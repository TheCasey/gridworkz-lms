import { POLICY_KEY, getPolicy } from './policy.js';

const updatedAt = document.getElementById('updated-at');
const originList = document.getElementById('origin-list');
const originEmpty = document.getElementById('origin-empty');
const creatorList = document.getElementById('creator-list');
const creatorEmpty = document.getElementById('creator-empty');

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

async function refresh() {
  const policy = await getPolicy();
  updatedAt.textContent = policy.updated_at
    ? `Last updated ${new Date(policy.updated_at).toLocaleString()}`
    : 'Policy state has not been changed yet.';
  renderOrigins(policy.allowed_origins);
  renderCreators(policy.allowed_youtube_channels);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[POLICY_KEY]) return;
  void refresh();
});

void refresh();
