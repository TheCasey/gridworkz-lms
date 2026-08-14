import {
  getPairingSettings,
  getSyncState,
  isLegacyPairing,
  isPairingConfigured,
  LOCKDOWN_SYNC_STATUSES,
  normalizePairingSettings,
  parsePairingCode,
  parseRecoveryCode,
} from './policy.js';

const pairingCodeField = document.getElementById('pairing-code');
const deviceNameField = document.getElementById('device-name');
const saveButton = document.getElementById('save-button');
const clearButton = document.getElementById('clear-button');
const popupButton = document.getElementById('popup-button');
const statusMessage = document.getElementById('status-message');
const recoverySection = document.getElementById('recovery-section');
const recoveryCodeField = document.getElementById('recovery-code');
const recoveryButton = document.getElementById('recovery-button');

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

function setRecoveryControls({ paired = false, legacy = false } = {}) {
  recoverySection.hidden = !paired;
  clearButton.hidden = paired || (!legacy && !paired);
  clearButton.disabled = paired || (!legacy && !paired);
}

async function loadPairing() {
  const [pairing, syncState] = await Promise.all([
    getPairingSettings(),
    getSyncState(),
  ]);
  fillFields(pairing);
  setRecoveryControls({
    paired: isPairingConfigured(pairing),
    legacy: isLegacyPairing(pairing),
  });

  if (isPairingConfigured(pairing)) {
    if (syncState.status === LOCKDOWN_SYNC_STATUSES.DEVICE_REVOKED) {
      setStatus(
        `Trusted pairing saved for ${pairing.device_name || pairing.device_id || 'this browser'}, but the parent revoked this device credential. Cached policy remains local until you pair again.`,
        'error'
      );
      return;
    }

    if (syncState.status === LOCKDOWN_SYNC_STATUSES.DEVICE_INACTIVE) {
      setStatus(
        `Trusted pairing saved for ${pairing.device_name || pairing.device_id || 'this browser'}, but the device record is inactive on the server. Cached policy remains local until you pair again.`,
        'error'
      );
      return;
    }

    if (syncState.status === LOCKDOWN_SYNC_STATUSES.INVALID_DEVICE_CREDENTIAL) {
      setStatus(
        `Trusted pairing saved for ${pairing.device_name || pairing.device_id || 'this browser'}, but the credential is no longer valid. Pair again to restore secure sync.`,
        'error'
      );
      return;
    }

    if (syncState.status === LOCKDOWN_SYNC_STATUSES.NETWORK_ERROR || syncState.status === 'error') {
      setStatus(
        syncState.using_cached_policy
          ? `Trusted pairing saved for ${pairing.device_name || pairing.device_id || 'this browser'}. Network sync failed, so the last trusted policy is still active locally.`
          : `Trusted pairing saved for ${pairing.device_name || pairing.device_id || 'this browser'}. Network sync failed before a trusted policy cache was available.`,
        'error'
      );
      return;
    }

    const studentLabel = pairing.student_id ? ` for student ${pairing.student_id}` : '';
    setStatus(
      `Trusted pairing saved for ${pairing.device_name || pairing.device_id || 'this browser'}${studentLabel}. Local clearing requires a parent recovery code for this exact device.`,
      'success'
    );
    return;
  }

  if (isLegacyPairing(pairing)) {
    setStatus(
      'An older pairing format is still saved here. Remote sync is paused until you replace it with a trusted enrollment code.',
      'error'
    );
    return;
  }

  setStatus('No trusted pairing is saved yet. The last cached policy stays stored locally until a new sync replaces it.');
}

pairingCodeField.addEventListener('input', () => {
  const parsed = parsePairingCode(pairingCodeField.value);
  if (!parsed) {
    return;
  }

  if (parsed.recovery_kind === 'trusted_recovery') {
    setStatus(
      'This is a parent recovery code. Paste it in the Parent recovery section for the paired device.',
      'error'
    );
    return;
  }

  if (parsed.pairing_kind === 'legacy_poc') {
    setStatus(
      'This is an older pairing code. Generate a trusted enrollment code from the parent dashboard instead.',
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

recoveryCodeField.addEventListener('input', () => {
  const parsed = parseRecoveryCode(recoveryCodeField.value);
  if (!parsed) {
    return;
  }

  if (parsed.recovery_expires_at) {
    setStatus(
      `Parent recovery code loaded. It expires ${formatTimestamp(parsed.recovery_expires_at)}.`,
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

    if (parsedPairing.recovery_kind === 'trusted_recovery') {
      setStatus(
        'Parent recovery codes cannot pair a device. Paste a trusted enrollment code from the parent dashboard.',
        'error'
      );
      return;
    }

    if (parsedPairing.pairing_kind === 'legacy_poc') {
      setStatus(
        'Older pairing codes cannot drive secure sync anymore. Generate a trusted enrollment code from the parent dashboard instead.',
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

recoveryButton.addEventListener('click', async () => {
  recoveryButton.disabled = true;

  try {
    const result = await chrome.runtime.sendMessage({
      type: 'lockdown:clear-pairing',
      recoveryCode: recoveryCodeField.value,
    });
    if (result?.status !== 'recovery_unpaired') {
      throw new Error(result?.error || 'Parent recovery could not clear this device pairing.');
    }

    pairingCodeField.value = '';
    recoveryCodeField.value = '';
    await loadPairing();
    setStatus(
      'Parent recovery accepted. Local pairing was cleared and cached enforcement stays local until this browser is paired again.',
      'success'
    );
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : 'Parent recovery could not clear this device pairing.',
      'error'
    );
  } finally {
    recoveryButton.disabled = false;
  }
});

popupButton.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
});

void loadPairing();
