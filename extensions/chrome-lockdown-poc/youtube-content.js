import {
  getRequestAccessGuidance,
  getYoutubeBlockedGuidance,
} from './guidance.js';

const POLICY_KEY = 'lockdownPolicy';
const OVERLAY_ID = 'ownpath-lockdown-overlay';
const STYLE_ID = 'ownpath-lockdown-style';
const URL_POLL_MS = 500;
const RETRY_DELAY_MS = 800;
const MAX_PENDING_ATTEMPTS = 6;

let lastUrl = window.location.href;
let currentRequestId = 0;
let pendingAttempts = 0;
let pendingUrl = window.location.href;
let pendingRetryTimer = 0;
let pauseTimer = 0;

function isSupportedYoutubePath(pathname = window.location.pathname) {
  return pathname === '/watch' || pathname.startsWith('/shorts/');
}

function clearRetryTimer() {
  if (pendingRetryTimer) {
    window.clearTimeout(pendingRetryTimer);
    pendingRetryTimer = 0;
  }
}

function startPauseLoop() {
  pauseVisibleMedia();

  if (!pauseTimer) {
    pauseTimer = window.setInterval(pauseVisibleMedia, 350);
  }
}

function stopPauseLoop() {
  if (pauseTimer) {
    window.clearInterval(pauseTimer);
    pauseTimer = 0;
  }
}

function pauseVisibleMedia() {
  document.querySelectorAll('video').forEach((video) => {
    if (!video.paused && video.dataset.ownpathShouldResume !== 'true') {
      video.dataset.ownpathShouldResume = 'true';
    }

    video.pause();
  });
}

function resumePausedMedia() {
  document.querySelectorAll('video[data-ownpath-should-resume]').forEach((video) => {
    delete video.dataset.ownpathShouldResume;
    void video.play().catch(() => {});
  });
}

function ensureStyleTag() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(27, 25, 56, 0.78);
      backdrop-filter: blur(12px);
      color: #292827;
    }

    #${OVERLAY_ID}[hidden] {
      display: none;
    }

    #${OVERLAY_ID} .ownpath-panel {
      width: min(560px, 100%);
      border-radius: 24px;
      border: 1px solid rgba(27, 25, 56, 0.14);
      background: linear-gradient(180deg, #fffefb 0%, #e9e5dd 100%);
      box-shadow: 0 28px 72px rgba(27, 25, 56, 0.34);
      padding: 24px;
    }

    #${OVERLAY_ID} .ownpath-eyebrow {
      margin: 0 0 10px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font: 600 11px/1.3 'Segoe UI', system-ui, sans-serif;
      color: rgba(41, 40, 39, 0.58);
    }

    #${OVERLAY_ID} h1,
    #${OVERLAY_ID} p,
    #${OVERLAY_ID} strong,
    #${OVERLAY_ID} small {
      margin: 0;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }

    #${OVERLAY_ID} h1 {
      font-size: 30px;
      line-height: 1.08;
      color: #1b1938;
    }

    #${OVERLAY_ID} .ownpath-copy {
      margin-top: 12px;
      color: rgba(41, 40, 39, 0.8);
      line-height: 1.55;
      font-size: 15px;
    }

    #${OVERLAY_ID} .ownpath-card {
      margin-top: 18px;
      border-radius: 18px;
      border: 1px solid rgba(27, 25, 56, 0.12);
      background: rgba(255, 255, 255, 0.84);
      padding: 16px;
    }

    #${OVERLAY_ID} .ownpath-card strong {
      display: block;
      font-size: 18px;
      color: #1b1938;
    }

    #${OVERLAY_ID} .ownpath-card small {
      display: block;
      margin-top: 6px;
      color: rgba(41, 40, 39, 0.64);
      line-height: 1.45;
      font-size: 13px;
    }

    #${OVERLAY_ID} .ownpath-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }

    #${OVERLAY_ID} button {
      border: 0;
      border-radius: 14px;
      padding: 12px 14px;
      font: 600 14px/1 'Segoe UI', system-ui, sans-serif;
      cursor: pointer;
      color: #1b1938;
      background: white;
      border: 1px solid rgba(27, 25, 56, 0.12);
    }
  `;

  document.documentElement.appendChild(style);
}

function ensureOverlay() {
  ensureStyleTag();

  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    return overlay;
  }

  overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="ownpath-panel" role="dialog" aria-modal="true" aria-live="polite">
      <p class="ownpath-eyebrow">Own Path Lockdown</p>
      <h1 id="ownpath-title"></h1>
      <p class="ownpath-copy" id="ownpath-copy"></p>
      <article class="ownpath-card" id="ownpath-creator-card" hidden>
        <strong id="ownpath-creator-name"></strong>
        <small id="ownpath-creator-meta"></small>
      </article>
      <div class="ownpath-actions">
        <button id="ownpath-allowlist-button" type="button">Open allowlist details</button>
      </div>
    </section>
  `;

  overlay.querySelector('#ownpath-allowlist-button').addEventListener('click', () => {
    window.open(chrome.runtime.getURL('allowlist.html'), '_blank', 'noopener');
  });

  document.documentElement.appendChild(overlay);
  return overlay;
}

function renderOverlay({ title, copy, creator, requestAccessCopy = '' }) {
  const overlay = ensureOverlay();
  const creatorCard = overlay.querySelector('#ownpath-creator-card');
  const creatorName = overlay.querySelector('#ownpath-creator-name');
  const creatorMeta = overlay.querySelector('#ownpath-creator-meta');
  const allowlistButton = overlay.querySelector('#ownpath-allowlist-button');

  overlay.querySelector('#ownpath-title').textContent = title;
  overlay.querySelector('#ownpath-copy').textContent = copy;

  if (requestAccessCopy) {
    allowlistButton.textContent = 'Open allowlist details';
    allowlistButton.title = requestAccessCopy;
  } else {
    allowlistButton.title = '';
  }

  if (creator?.title || creator?.handle || creator?.channelId) {
    creatorCard.hidden = false;
    creatorName.textContent = creator.title || creator.channelId || 'Unknown creator';
    creatorMeta.textContent = creator.metadataLine || [creator.handle, creator.channelId].filter(Boolean).join(' • ') || 'Creator metadata not available';
  } else {
    creatorCard.hidden = true;
    creatorName.textContent = '';
    creatorMeta.textContent = '';
  }

  overlay.hidden = false;
}

function hideOverlay() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    overlay.hidden = true;
  }
}

function resetPendingStateForUrl() {
  if (pendingUrl !== window.location.href) {
    pendingUrl = window.location.href;
    pendingAttempts = 0;
  }
}

async function isBlockingEnabled() {
  const stored = await chrome.storage.local.get([POLICY_KEY]);
  return Boolean(stored[POLICY_KEY]?.is_enabled);
}

function scheduleRetry(requestId) {
  clearRetryTimer();
  pendingRetryTimer = window.setTimeout(() => {
    if (requestId !== currentRequestId) {
      return;
    }

    void enforceCurrentPage('retry');
  }, RETRY_DELAY_MS);
}

function applyBlockedCreatorState({ creator, policy, syncState }) {
  startPauseLoop();
  const guidance = getYoutubeBlockedGuidance({ policy, syncState, creator });
  renderOverlay({
    title: guidance.title,
    copy: guidance.copy,
    creator: guidance.creatorMetadata,
    requestAccessCopy: guidance.requestAccess.copy,
  });
}

function applyUnsupportedPageState() {
  startPauseLoop();
  renderOverlay({
    title: 'Only direct YouTube videos are allowed right now',
    copy:
      'Own Path keeps YouTube limited to direct watch and shorts pages so creator approval can be checked locally.',
    creator: null,
    requestAccessCopy: getRequestAccessGuidance().copy,
  });
}

function applyPendingState() {
  startPauseLoop();
  renderOverlay({
    title: 'Checking this creator',
    copy:
      'Own Path is resolving the current YouTube creator before playback is allowed.',
    creator: null,
    requestAccessCopy: getRequestAccessGuidance().copy,
  });
}

function applyUnresolvedState() {
  startPauseLoop();
  renderOverlay({
    title: 'We could not verify this creator',
    copy:
      'This extension stays fail-closed when the current YouTube page does not expose stable creator channel data yet.',
    creator: null,
    requestAccessCopy: getRequestAccessGuidance().copy,
  });
}

function clearLockdownState() {
  clearRetryTimer();
  stopPauseLoop();
  hideOverlay();
  resumePausedMedia();
}

async function enforceCurrentPage(reason) {
  currentRequestId += 1;
  const requestId = currentRequestId;

  resetPendingStateForUrl();
  clearRetryTimer();

  const supportedPath = isSupportedYoutubePath();
  if (!supportedPath) {
    if (await isBlockingEnabled()) {
      applyUnsupportedPageState();
    } else {
      clearLockdownState();
    }

    return;
  }

  applyPendingState();

  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: 'lockdown:resolve-youtube-access',
      reason
    });
  } catch (error) {
    console.error('Failed to request YouTube lockdown status:', error);
    response = { status: 'error' };
  }

  if (requestId !== currentRequestId) {
    return;
  }

  if (response?.status === 'disabled') {
    clearLockdownState();
    return;
  }

  if (response?.status === 'allowed') {
    pendingAttempts = 0;
    clearLockdownState();
    return;
  }

  if (response?.status === 'blocked') {
    pendingAttempts = 0;
    applyBlockedCreatorState({
      creator: response.creator,
      policy: response.policy,
      syncState: response.syncState,
    });
    return;
  }

  if (response?.status === 'pending') {
    pendingAttempts += 1;

    if (pendingAttempts >= MAX_PENDING_ATTEMPTS) {
      applyUnresolvedState();
      return;
    }

    applyPendingState();
    scheduleRetry(requestId);
    return;
  }

  applyUnresolvedState();
}

function handleMaybeChangedUrl(reason) {
  if (window.location.href === lastUrl) {
    return;
  }

  lastUrl = window.location.href;
  pendingUrl = window.location.href;
  pendingAttempts = 0;
  void enforceCurrentPage(reason);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[POLICY_KEY]) {
    return;
  }

  void enforceCurrentPage('policy-change');
});

window.addEventListener('yt-navigate-finish', () => {
  handleMaybeChangedUrl('yt-navigate-finish');
});

window.addEventListener('yt-page-data-updated', () => {
  handleMaybeChangedUrl('yt-page-data-updated');
});

window.addEventListener('popstate', () => {
  handleMaybeChangedUrl('popstate');
});

window.setInterval(() => {
  handleMaybeChangedUrl('url-poll');
}, URL_POLL_MS);

void enforceCurrentPage('initial-load');
