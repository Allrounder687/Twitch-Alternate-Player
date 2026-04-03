import { getStreamToken, getStreamUrl } from './twitch-api';
import { migrateSettings } from '../content/player/ChannelSettings';

// ── MV3: onMessage MUST be registered synchronously at the top level ──
// Stream URL Cache for pre-fetching
const streamCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'PLAYER_CLOSED') {
    chrome.storage.sync.set({ isEnabled: false });
    updateExtensionIcon(false);
    sendResponse();
    return false;
  }

  if (message.action === 'PREFETCH_STREAM') {
    const streamer = message.streamerName;
    if (
      streamCache.has(streamer) &&
      Date.now() - streamCache.get(streamer)!.timestamp < CACHE_TTL
    ) {
      sendResponse({ status: 'already_cached' });
      return false;
    }

    getStreamToken(streamer)
      .then((token) => {
        if (token) {
          const url = getStreamUrl(streamer, token);
          streamCache.set(streamer, { url, timestamp: Date.now() });
          sendResponse({ status: 'prefetched' });
        } else {
          sendResponse({ error: 'failed' });
        }
      })
      .catch((err) => {
        console.error('[Background] Prefetch error:', err?.message || String(err));
        sendResponse({ error: 'failed' });
      });

    return true; // Keep channel open for async
  }

  if (message.action === 'GET_STREAM_URL') {
    const streamer = message.streamerName;

    // Check Cache first
    if (
      streamCache.has(streamer) &&
      Date.now() - streamCache.get(streamer)!.timestamp < CACHE_TTL
    ) {
      const cached = streamCache.get(streamer)!;
      sendResponse({ url: cached.url });
      return false;
    }

    getStreamToken(streamer)
      .then((token) => {
        if (token) {
          const url = getStreamUrl(streamer, token);
          streamCache.set(streamer, { url, timestamp: Date.now() });
          sendResponse({ url });
        } else {
          sendResponse({
            error: 'Failed to get stream token. Make sure the streamer is live.',
          });
        }
      })
      .catch((err) => {
        console.error('[Background] GET_STREAM_URL error:', err?.message || String(err));
        sendResponse({ error: err?.message || 'Unknown error fetching stream' });
      });
    return true;
  }

  // Fallback for any other messages
  sendResponse();
  return false;
});

// Listen for installation or update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      isEnabled: false,
      streamerName: '',
      volume: 50,
      quality: 'auto',
      latencyMode: 'balanced',
      chatEnabled: true,
      emoteProviders: { bttv: true, ffz: true, seventv: true },
      autoClaimPoints: true,
      twitchUsername: '',
      showAdNotifications: true,
      layout: 'balanced',
      theme: { preset: 'twitch-dark', custom: {} },
      multiStreams: [],
    });

    chrome.tabs.create({ url: 'popup.html' });
  }

  // Run migration on install or update
  migrateSettings();
});

// Update the extension icon based on the enabled/disabled state
function updateExtensionIcon(isEnabled: boolean) {
  const iconPath = isEnabled ? 'icons/icon48.png' : 'icons/icon48-gray.png';
  chrome.action.setIcon({ path: iconPath });
}

// Listen for tab updates to inject content scripts when needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('twitch.tv')) {
    chrome.storage.sync.get(['isEnabled', 'streamerName'], (data) => {
      if (data.isEnabled && data.streamerName) {
        chrome.scripting
          .executeScript({
            target: { tabId },
            files: ['content.js'],
          })
          .catch((err) =>
            console.error('[Background] Error injecting content script:', err?.message || String(err))
          );
      }
    });
  }
});

// Initialize the extension icon state
chrome.storage.sync.get(['isEnabled'], (data) => {
  updateExtensionIcon(data.isEnabled || false);
});
