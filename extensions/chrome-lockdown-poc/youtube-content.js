const POLICY_KEY = 'lockdownPolicy';
const OVERLAY_ID = 'gridworkz-lockdown-overlay';
const STYLE_ID = 'gridworkz-lockdown-style';
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
    if (!video.paused && video.dataset.gridworkzShouldResume !== 'true') {
      video.dataset.gridworkzShouldResume = 'true';
    }

    video.pause();
  });
}

function resumePausedMedia() {
  document.querySelectorAll('video[data-gridworkz-should-resume]').forEach((video) => {
    delete video.dataset.gridworkzShouldResume;
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

    #${OVERLAY_ID} .gridworkz-panel {
      width: min(560px, 100%);
      border-radius: 24px;
      border: 1px solid rgba(27, 25, 56, 0.14);
      background: linear-gradient(180deg, #fffefb 0%, #e9e5dd 100%);
      box-shadow: 0 28px 72px rgba(27, 25, 56, 0.34);
      padding: 24px;
    }

    #${OVERLAY_ID} .gridworkz-eyebrow {
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

    #${OVERLAY_ID} .gridworkz-copy {
      margin-top: 12px;
      color: rgba(41, 40, 39, 0.8);
      line-height: 1.55;
      font-size: 15px;
    }

    #${OVERLAY_ID} .gridworkz-card {
      margin-top: 18px;
      border-radius: 18px;
      border: 1px solid rgba(27, 25, 56, 0.12);
      background: rgba(255, 255, 255, 0.84);
      padding: 16px;
    }

    #${OVERLAY_ID} .gridworkz-card strong {
      display: block;
      font-size: 18px;
      color: #1b1938;
    }

    #${OVERLAY_ID} .gridworkz-card small {
      display: block;
      margin-top: 6px;
      color: rgba(41, 40, 39, 0.64);
      line-height: 1.45;
      font-size: 13px;
    }

    #${OVERLAY_ID} .gridworkz-actions {
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
    <section class="gridworkz-panel" role="dialog" aria-modal="true" aria-live="polite">
      <p class="gridworkz-eyebrow">GridWorkz Lockdown PoC</p>
      <h1 id="gridworkz-title"></h1>
      <p class="gridworkz-copy" id="gridworkz-copy"></p>
      <article class="gridworkz-card" id="gridworkz-creator-card" hidden>
        <strong id="gridworkz-creator-name"></strong>
        <small id="gridworkz-creator-meta"></small>
      </article>
      <div class="gridworkz-actions">
        <button id="gridworkz-allowlist-button" type="button">Open allowlist details</button>
      </div>
    </section>
  `;

  overlay.querySelector('#gridworkz-allowlist-button').addEventListener('click', () => {
    window.open(chrome.runtime.getURL('allowlist.html'), '_blank', 'noopener');
  });

  document.documentElement.appendChild(overlay);
  return overlay;
}

function renderOverlay({ title, copy, creator }) {
  const overlay = ensureOverlay();
  const creatorCard = overlay.querySelector('#gridworkz-creator-card');
  const creatorName = overlay.querySelector('#gridworkz-creator-name');
  const creatorMeta = overlay.querySelector('#gridworkz-creator-meta');

  overlay.querySelector('#gridworkz-title').textContent = title;
  overlay.querySelector('#gridworkz-copy').textContent = copy;

  if (creator?.title || creator?.handle || creator?.channelId) {
    creatorCard.hidden = false;
    creatorName.textContent = creator.title || creator.channelId || 'Unknown creator';
    creatorMeta.textContent = [creator.handle, creator.channelId].filter(Boolean).join(' • ');
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

function applyBlockedCreatorState(creator) {
  startPauseLoop();
  renderOverlay({
    title: 'This creator is blocked right now',
    copy:
      'Local blocking is active and this video is not from an approved YouTube creator in the current mock policy.',
    creator
  });
}

function applyUnsupportedPageState() {
  startPauseLoop();
  renderOverlay({
    title: 'Only direct YouTube videos are allowed right now',
    copy:
      'Phase 2 keeps YouTube limited to direct watch and shorts pages so creator-level checks stay local and easy to test.',
    creator: null
  });
}

function applyPendingState() {
  startPauseLoop();
  renderOverlay({
    title: 'Checking this creator',
    copy:
      'GridWorkz is resolving the current YouTube creator before playback is allowed.',
    creator: null
  });
}

function applyUnresolvedState() {
  startPauseLoop();
  renderOverlay({
    title: 'We could not verify this creator',
    copy:
      'This Phase 2 build stays fail-closed when the current YouTube page does not expose a stable creator channel yet.',
    creator: null
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
    applyBlockedCreatorState(response.creator);
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
