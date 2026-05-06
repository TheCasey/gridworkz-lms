import {
  buildPairingCode,
  getPairingSettings,
  isPairingConfigured,
  normalizePairingSettings,
  parsePairingCode,
  setPairingSettings,
  clearPairingSettings
} from './policy.js';

const pairingCodeField = document.getElementById('pairing-code');
const policyIdField = document.getElementById('policy-id');
const projectIdField = document.getElementById('project-id');
const apiKeyField = document.getElementById('api-key');
const saveButton = document.getElementById('save-button');
const clearButton = document.getElementById('clear-button');
const popupButton = document.getElementById('popup-button');
const statusMessage = document.getElementById('status-message');

function setStatus(message, tone = '') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message${tone ? ` ${tone}` : ''}`;
}

function fillFields(pairing) {
  const normalized = normalizePairingSettings(pairing);
  pairingCodeField.value = buildPairingCode(normalized);
  policyIdField.value = normalized.policy_id;
  projectIdField.value = normalized.project_id;
  apiKeyField.value = normalized.api_key;
}

async function loadPairing() {
  const pairing = await getPairingSettings();
  fillFields(pairing);

  if (isPairingConfigured(pairing)) {
    setStatus(`Saved pairing for policy ${pairing.policy_id}.`, 'success');
    return;
  }

  setStatus('No pairing is saved yet.');
}

pairingCodeField.addEventListener('input', () => {
  const parsed = parsePairingCode(pairingCodeField.value);
  if (!parsed) {
    return;
  }

  policyIdField.value = parsed.policy_id;
  projectIdField.value = parsed.project_id;
  apiKeyField.value = parsed.api_key;
});

saveButton.addEventListener('click', async () => {
  saveButton.disabled = true;

  try {
    const parsedPairing = parsePairingCode(pairingCodeField.value);
    const manualPairing = normalizePairingSettings({
      policy_id: policyIdField.value,
      project_id: projectIdField.value,
      api_key: apiKeyField.value
    });
    const pairingToSave = parsedPairing || manualPairing;

    if (!isPairingConfigured(pairingToSave)) {
      setStatus('Enter a valid pairing code or fill in the policy ID, project ID, and web API key.', 'error');
      return;
    }

    const savedPairing = await setPairingSettings(pairingToSave);
    fillFields(savedPairing);
    await chrome.runtime.sendMessage({ type: 'lockdown:sync-now' });
    setStatus(`Saved pairing for policy ${savedPairing.policy_id}.`, 'success');
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : 'The pairing settings could not be saved.',
      'error'
    );
  } finally {
    saveButton.disabled = false;
  }
});

clearButton.addEventListener('click', async () => {
  clearButton.disabled = true;

  try {
    await clearPairingSettings();
    pairingCodeField.value = '';
    policyIdField.value = '';
    projectIdField.value = '';
    apiKeyField.value = '';
    setStatus('Pairing cleared. The extension is back on local cached policy only.', 'success');
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : 'The pairing settings could not be cleared.',
      'error'
    );
  } finally {
    clearButton.disabled = false;
  }
});

popupButton.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
});

void loadPairing();
