import {
  getPairingSettings,
  isLegacyPairing,
  isPairingConfigured,
  normalizePairingSettings,
  parsePairingCode,
} from './policy.js';

const pairingCodeField = document.getElementById('pairing-code');
const deviceNameField = document.getElementById('device-name');
const saveButton = document.getElementById('save-button');
const clearButton = document.getElementById('clear-button');
const popupButton = document.getElementById('popup-button');
const statusMessage = document.getElementById('status-message');

function setStatus(message, tone = '') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message${tone ? ` ${tone}` : ''}`;
}

function formatTimestamp(value) {
  if (!value) return 'unknown time';
  return new Date(value).toLocaleString();
}

function fillFields(pairing) {
  const normalized = normalizePairingSettings(pairing);
  deviceNameField.value = normalized.device_name || deviceNameField.value;
}

async function loadPairing() {
  const pairing = await getPairingSettings();
  fillFields(pairing);

  if (isPairingConfigured(pairing)) {
    const studentLabel = pairing.student_id ? ` for student ${pairing.student_id}` : '';
    setStatus(
      `Trusted pairing saved for ${pairing.device_name || pairing.device_id || 'this browser'}${studentLabel}.`,
      'success'
    );
    return;
  }

  if (isLegacyPairing(pairing)) {
    setStatus(
      'A legacy PoC Firestore pairing is still saved here. Remote sync is paused until you replace it with a trusted enrollment code.',
      'error'
    );
    return;
  }

  setStatus('No trusted pairing is saved yet.');
}

pairingCodeField.addEventListener('input', () => {
  const parsed = parsePairingCode(pairingCodeField.value);
  if (!parsed) {
    return;
  }

  if (parsed.pairing_kind === 'legacy_poc') {
    setStatus(
      'This is a legacy PoC pairing code. Generate a trusted enrollment code from the parent dashboard instead.',
      'error'
    );
    return;
  }

  if (parsed.enrollment_expires_at) {
    setStatus(
      `Trusted enrollment code loaded. It expires ${formatTimestamp(parsed.enrollment_expires_at)}.`,
      'success'
    );
  }
});

saveButton.addEventListener('click', async () => {
  saveButton.disabled = true;

  try {
    const parsedPairing = parsePairingCode(pairingCodeField.value);

    if (!parsedPairing) {
      setStatus('Paste a valid trusted enrollment code from the parent dashboard.', 'error');
      return;
    }

    if (parsedPairing.pairing_kind === 'legacy_poc') {
      setStatus(
        'Legacy PoC pairing codes cannot drive secure sync anymore. Generate a trusted enrollment code from the parent dashboard instead.',
        'error'
      );
      return;
    }

    const result = await chrome.runtime.sendMessage({
      type: 'lockdown:pair-device',
      enrollmentMaterial: parsedPairing,
      deviceName: deviceNameField.value,
    });

    if (result?.status !== 'synced') {
      throw new Error(result?.error || 'Trusted pairing could not be completed.');
    }

    pairingCodeField.value = '';
    await loadPairing();
    setStatus(
      `Trusted pairing completed for ${result.pairing?.device_name || result.device_id || 'this browser'}.`,
      'success'
    );
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : 'Trusted pairing could not be completed.',
      'error'
    );
  } finally {
    saveButton.disabled = false;
  }
});

clearButton.addEventListener('click', async () => {
  clearButton.disabled = true;

  try {
    const result = await chrome.runtime.sendMessage({ type: 'lockdown:clear-pairing' });
    if (result?.status !== 'unpaired') {
      throw new Error(result?.error || 'The pairing settings could not be cleared.');
    }

    pairingCodeField.value = '';
    setStatus(
      'Trusted pairing cleared. The last cached policy stays stored locally until a new sync replaces it.',
      'success'
    );
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
