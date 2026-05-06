import {
  POLICY_KEY,
  LAST_BLOCKED_KEY,
  PAIRING_KEY,
  SYNC_ALARM_NAME,
  SYNC_INTERVAL_MINUTES,
  buildUrlFilterForOrigin,
  buildFirestorePolicyUrl,
  findAllowedYoutubeChannel,
  getPairingSettings,
  getPolicy,
  isPairingConfigured,
  parseFirestorePolicyDocument,
  setPolicy,
  setSyncState,
  normalizePairingSettings,
  normalizePolicy
} from './policy.js';

const BLOCK_ALL_RULE_ID = 1;
const ALLOW_RULE_START = 100;
const YOUTUBE_ALLOW_RULE_START = 1000;
const YOUTUBE_MAIN_FRAME_FILTERS = [
  '|https://www.youtube.com/watch',
  '|https://www.youtube.com/shorts/',
  '|https://youtube.com/watch',
  '|https://youtube.com/shorts/',
  '|https://m.youtube.com/watch',
  '|https://m.youtube.com/shorts/'
];

function buildAllowRule(origin, index) {
  const urlFilter = buildUrlFilterForOrigin(origin);
  if (!urlFilter) return null;

  return {
    id: ALLOW_RULE_START + index,
    priority: 2,
    action: { type: 'allow' },
    condition: {
      urlFilter,
      resourceTypes: ['main_frame']
    }
  };
}

function buildBlockRule() {
  return {
    id: BLOCK_ALL_RULE_ID,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        extensionPath: '/blocked.html'
      }
    },
    condition: {
      regexFilter: '^https?://',
      resourceTypes: ['main_frame']
    }
  };
}

function buildYoutubeAllowRules() {
  return YOUTUBE_MAIN_FRAME_FILTERS.map((urlFilter, index) => ({
    id: YOUTUBE_ALLOW_RULE_START + index,
    priority: 2,
    action: { type: 'allow' },
    condition: {
      urlFilter,
      resourceTypes: ['main_frame']
    }
  }));
}

function buildRules(policy) {
  if (!policy.is_enabled) {
    return [];
  }

  const allowRules = policy.allowed_origins
    .map((origin, index) => buildAllowRule(origin, index))
    .filter(Boolean);

  return [...allowRules, ...buildYoutubeAllowRules(), buildBlockRule()];
}

async function updateBadge(policy) {
  if (policy.is_enabled) {
    await chrome.action.setBadgeText({ text: 'ON' });
    await chrome.action.setBadgeBackgroundColor({ color: '#714cb6' });
    await chrome.action.setTitle({ title: 'GridWorkz Lockdown PoC: blocking on' });
    return;
  }

  await chrome.action.setBadgeText({ text: '' });
  await chrome.action.setTitle({ title: 'GridWorkz Lockdown PoC: blocking off' });
}

async function applyPolicy(policy) {
  const currentRules = await chrome.declarativeNetRequest.getDynamicRules();

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: currentRules.map((rule) => rule.id),
    addRules: buildRules(policy)
  });

  await updateBadge(policy);
}

async function applyCachedPolicy() {
  const policy = await getPolicy();
  await applyPolicy(policy);
}

async function ensureSyncAlarm() {
  await chrome.alarms.clear(SYNC_ALARM_NAME);
  await chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: SYNC_INTERVAL_MINUTES });
}

async function fetchRemotePolicy(pairing) {
  const url = buildFirestorePolicyUrl(pairing);
  if (!url) {
    throw new Error('The saved pairing is incomplete.');
  }

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('No Firestore policy document was found for this pairing.');
    }

    if (response.status === 403) {
      throw new Error('Firestore denied policy access. Check the PoC rules setup.');
    }

    throw new Error(`Firestore sync failed with HTTP ${response.status}.`);
  }

  const document = await response.json();
  return parseFirestorePolicyDocument(document, pairing.policy_id);
}

async function syncRemotePolicy(reason = 'manual') {
  const pairing = await getPairingSettings();
  if (!isPairingConfigured(pairing)) {
    await setSyncState({
      status: 'unpaired',
      last_attempt_at: new Date().toISOString(),
      last_error: '',
      using_cached_policy: false
    });
    return { status: 'unpaired' };
  }

  await setSyncState({
    status: 'syncing',
    last_attempt_at: new Date().toISOString(),
    last_error: '',
    using_cached_policy: false
  });

  try {
    const remotePolicy = await fetchRemotePolicy(pairing);
    const persistedPolicy = await setPolicy(remotePolicy, { touchUpdatedAt: false });

    await setSyncState({
      status: 'synced',
      last_sync_at: new Date().toISOString(),
      last_error: '',
      using_cached_policy: false,
      remote_policy_updated_at: persistedPolicy.updated_at || null
    });

    return { status: 'synced', reason };
  } catch (error) {
    await applyCachedPolicy();
    await setSyncState({
      status: 'error',
      last_error: error instanceof Error ? error.message : String(error),
      using_cached_policy: true
    });

    return {
      status: 'error',
      reason,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function resolveYoutubePageContext(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      const playerResponse = window.ytInitialPlayerResponse;
      const videoDetails = playerResponse?.videoDetails || null;
      const microformat = playerResponse?.microformat?.playerMicroformatRenderer || null;
      const ownerProfileUrl =
        typeof microformat?.ownerProfileUrl === 'string' ? microformat.ownerProfileUrl : '';
      const handleMatch = ownerProfileUrl.match(/\/(@[^/?]+)/i);

      return {
        channelId: typeof videoDetails?.channelId === 'string' ? videoDetails.channelId : '',
        title:
          typeof videoDetails?.author === 'string'
            ? videoDetails.author
            : typeof microformat?.ownerChannelName === 'string'
              ? microformat.ownerChannelName
              : '',
        handle: handleMatch ? handleMatch[1] : '',
        href: window.location.href,
        pathname: window.location.pathname
      };
    }
  });

  return result?.result || null;
}

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    try {
      await ensureSyncAlarm();
      await applyCachedPolicy();
      await syncRemotePolicy('install');
    } catch (error) {
      console.error('Failed to initialize lockdown policy:', error);
    }
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    try {
      await ensureSyncAlarm();
      await applyCachedPolicy();
      await syncRemotePolicy('startup');
    } catch (error) {
      console.error('Failed to sync lockdown policy on startup:', error);
    }
  })();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== SYNC_ALARM_NAME) {
    return;
  }

  void syncRemotePolicy('alarm').catch((error) => {
    console.error('Failed to sync lockdown policy on interval:', error);
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  if (changes[POLICY_KEY]?.newValue) {
    void applyPolicy(normalizePolicy(changes[POLICY_KEY].newValue)).catch((error) => {
      console.error('Failed to apply updated lockdown policy:', error);
    });
  }

  if (PAIRING_KEY in changes) {
    const nextPairing = normalizePairingSettings(changes[PAIRING_KEY]?.newValue || {});
    void ensureSyncAlarm()
      .then(() => {
        if (!isPairingConfigured(nextPairing)) {
          return setSyncState({
            status: 'unpaired',
            last_attempt_at: new Date().toISOString(),
            last_error: '',
            using_cached_policy: false,
            remote_policy_updated_at: null
          });
        }

        return syncRemotePolicy('pairing-updated');
      })
      .catch((error) => {
        console.error('Failed to process updated pairing state:', error);
      });
  }
});

if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((details) => {
    if (details.rule.ruleId !== BLOCK_ALL_RULE_ID) {
      return;
    }

    void chrome.storage.local.set({
      [LAST_BLOCKED_KEY]: {
        url: details.request.url,
        blocked_at: new Date().toISOString()
      }
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'lockdown:sync-now') {
    void syncRemotePolicy('manual').then(sendResponse).catch((error) => {
      sendResponse({
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    });

    return true;
  }

  if (message?.type !== 'lockdown:resolve-youtube-access') {
    return false;
  }

  void (async () => {
    try {
      const policy = await getPolicy();
      if (!policy.is_enabled) {
        sendResponse({ status: 'disabled' });
        return;
      }

      const tabId = sender.tab?.id;
      if (typeof tabId !== 'number') {
        sendResponse({ status: 'error', reason: 'missing_tab_id' });
        return;
      }

      const creator = await resolveYoutubePageContext(tabId);
      if (!creator?.channelId) {
        sendResponse({ status: 'pending', creator });
        return;
      }

      const allowedChannel = findAllowedYoutubeChannel(policy, creator.channelId);
      sendResponse({
        status: allowedChannel ? 'allowed' : 'blocked',
        creator,
        allowedChannel
      });
    } catch (error) {
      console.error('Failed to resolve YouTube creator access:', error);
      sendResponse({
        status: 'error',
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  })();

  return true;
});

void ensureSyncAlarm().catch((error) => {
  console.error('Failed to schedule lockdown sync alarm:', error);
});

void applyCachedPolicy().catch((error) => {
  console.error('Failed to apply cached lockdown policy:', error);
});
