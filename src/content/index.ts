console.log('[Twitch Player] Content script loading...');
import { playerInstance } from './player/PlayerContainer';

function getStreamerNameFromUrl(): string | null {
  const path = window.location.pathname.split('/');
  const excluded = ['directory', 'p', 'search', 'videos', 'u', 'settings', 'subscriptions', 'drops', 'inventory', 'wallet', 'friends', 'moderator'];
  if (path.length >= 2 && path[1] !== '' && !excluded.includes(path[1])) {
    return path[1];
  }
  return null;
}

let currentStreamer: string | null = null;
let playerEnabled = false;
let currentVolume = 50;
let currentQuality = 'auto';

function isContextValid() {
  return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
}

/**
 * Send a message to the background script with retry logic for MV3 service worker restarts.
 */
export function sendMessageWithRetry(
  message: any,
  maxRetries = 3
): Promise<any> {
  return new Promise((resolve) => {
    let attempt = 0;

    function trySend() {
      if (!isContextValid()) {
        resolve({ error: 'Extension context invalidated' });
        return;
      }
      attempt++;
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            const errMsg = chrome.runtime.lastError.message || '';
            // Retry on "Receiving end does not exist" — service worker may be waking up
            if (attempt < maxRetries && errMsg.includes('Receiving end does not exist')) {
              setTimeout(trySend, 500 * attempt);
              return;
            }
            resolve({ error: errMsg });
          } else {
            resolve(response || {});
          }
        });
      } catch {
        if (attempt < maxRetries) {
          setTimeout(trySend, 500 * attempt);
        } else {
          resolve({ error: 'Failed to send message after retries' });
        }
      }
    }

    trySend();
  });
}

// Initial storage load
if (isContextValid()) {
  chrome.storage.sync.get(['isEnabled', 'volume', 'quality'], (data) => {
    if (chrome.runtime.lastError) return;
    playerEnabled = !!data.isEnabled;
    currentVolume = data.volume || 50;
    currentQuality = data.quality || 'auto';
    checkAndMount();
  });

  // Listen for storage changes
  chrome.storage.sync.onChanged.addListener((changes) => {
    if (changes.isEnabled) playerEnabled = changes.isEnabled.newValue;
    if (changes.volume) currentVolume = changes.volume.newValue;
    if (changes.quality) currentQuality = changes.quality.newValue;
    checkAndMount();
  });
}

const checkAndMount = () => {
  const streamerName = getStreamerNameFromUrl();

  if (playerEnabled && streamerName) {
    if (currentStreamer !== streamerName) {
      currentStreamer = streamerName;
      playerInstance.mount(streamerName, currentVolume, currentQuality);
    }
  } else if (!streamerName || !playerEnabled) {
    currentStreamer = null;
    playerInstance.unmount();
  }

  // Pre-fetch if we are on a new streamer but player is disabled
  if (streamerName && !playerEnabled && streamerName !== currentStreamer) {
    sendMessageWithRetry({ action: 'PREFETCH_STREAM', streamerName });
  }
};

// Listen for messages from the popup
if (isContextValid()) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'TOGGLE_PLAYER') {
      checkAndMount();
    }
    sendResponse();
    return false;
  });
}

function injectPlayerButton() {
  if (!isContextValid()) return;
  const streamerName = getStreamerNameFromUrl();
  if (!streamerName) return;

  const controlGroup =
    document.querySelector('[data-a-target="player-controls-right"]') ||
    document.querySelector('.player-controls__right-control-group') ||
    document.querySelector('[data-test-selector="right-control-group"]');

  if (!controlGroup) return;

  const btn =
    (document.getElementById('kreo-alt-player-btn') as HTMLButtonElement) ||
    document.createElement('button');
  if (!btn.id) {
    btn.id = 'kreo-alt-player-btn';
    controlGroup.insertBefore(btn, controlGroup.firstChild);
  }

  const applyStyles = () => {
    btn.style.setProperty('background-color', 'transparent', 'important');
    btn.style.color = 'white';
    btn.style.borderRadius = '4px';
    btn.style.fontWeight = '600';
    btn.style.fontSize = '12px';
    btn.style.padding = '0 8px';
    btn.style.height = '30px';
    btn.style.margin = '0 4px';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.cursor = 'pointer';
    btn.style.border = 'none';
    btn.style.transition = 'background-color 0.2s';
    btn.style.fontFamily = 'inherit';
    btn.innerText = playerEnabled ? 'Use Default Player' : 'Alt Player';
  };

  applyStyles();

  btn.onmouseover = () => (btn.style.backgroundColor = 'rgba(255, 255, 255, 0.15)');
  btn.onmouseout = () => (btn.style.backgroundColor = 'transparent');

  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isContextValid()) return;

    const toggleState = !playerEnabled;
    chrome.storage.sync.set({ isEnabled: toggleState });
  };
}

// Check for URL changes periodically (Twitch is an SPA)
const mainInterval = setInterval(() => {
  if (!isContextValid()) {
    clearInterval(mainInterval);
    return;
  }
  checkAndMount();
}, 2000);

// Injection loop for the button
const slowInterval = setInterval(() => {
  if (!isContextValid()) {
    clearInterval(slowInterval);
    return;
  }
  injectPlayerButton();
}, 1000);

// Initial check
checkAndMount();
