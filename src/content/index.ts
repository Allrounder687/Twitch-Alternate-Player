import { playerInstance } from './player/PlayerContainer';

function getStreamerNameFromUrl(): string | null {
  const path = window.location.pathname.split('/');
  const nonStreamerPaths = [
    'directory', 'p', 'search', 'videos', 'u', 'settings',
    'subscriptions', 'inventory', 'wallet', 'drops', 'friends',
  ];
  if (path.length >= 2 && path[1] !== '' && !nonStreamerPaths.includes(path[1])) {
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
 * Send a message with retry logic for MV3 service worker lifecycle.
 * The background service worker may be asleep when we try to send.
 */
function sendMessageSafe(msg: any, maxRetries = 3): void {
  if (!isContextValid()) return;

  let attempt = 0;
  const tryOnce = () => {
    try {
      chrome.runtime.sendMessage(msg, () => {
        if (chrome.runtime.lastError) {
          attempt++;
          if (attempt < maxRetries) {
            setTimeout(tryOnce, 300 * attempt);
          }
        }
      });
    } catch {
      // Extension context invalidated
    }
  };
  tryOnce();
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

  // Pre-fetch if on a new streamer page but player is disabled
  if (streamerName && !playerEnabled && streamerName !== currentStreamer) {
    sendMessageSafe({ action: 'PREFETCH_STREAM', streamerName });
  }
};

// Listen for messages from the popup
if (isContextValid()) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'TOGGLE_PLAYER') {
      checkAndMount();
    }
    sendResponse({ ok: true });
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
