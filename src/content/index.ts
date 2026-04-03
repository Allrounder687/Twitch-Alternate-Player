console.log('[Twitch Player] Content script loading...');
import { playerInstance } from './player/PlayerContainer';

function getStreamerNameFromUrl(): string | null {
  const path = window.location.pathname.split('/');
  // Filter out non-streamer paths
  if (path.length >= 2 && path[1] !== '' && !['directory', 'p', 'search', 'videos', 'u', 'settings', 'subscriptions'].includes(path[1])) {
    return path[1];
  }
  return null;
}

let currentStreamer: string | null = null;
let playerEnabled = false;
function isContextValid() {
  return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
}

const checkAndMount = () => {
  if (!isContextValid()) return;
  
  chrome.storage.sync.get(['isEnabled', 'volume', 'quality'], (data) => {
    if (chrome.runtime.lastError) return;
    
    playerEnabled = !!data.isEnabled;
    const streamerName = getStreamerNameFromUrl();
    
    if (playerEnabled && streamerName) {
      if (currentStreamer !== streamerName) {
        currentStreamer = streamerName;
        playerInstance.mount(streamerName, data.volume || 50, data.quality || 'auto');
      }
    } else if (!streamerName || !playerEnabled) {
      currentStreamer = null;
      playerInstance.unmount();
    }
  });
};

// Listen for messages from the popup (e.g. toggling the player)
if (isContextValid()) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'TOGGLE_PLAYER') {
      checkAndMount();
    }
    return true;
  });
}

function injectPlayerButton() {
  if (!isContextValid()) return;
  // Only inject if we are on a stream page
  const streamerName = getStreamerNameFromUrl();
  if (!streamerName) return;

  // Try to find the right-side control bar in Twitch's live player DOM
  const controlGroup = 
    document.querySelector('[data-a-target="player-controls-right"]') || 
    document.querySelector('.player-controls__right-control-group') ||
    document.querySelector('[data-test-selector="right-control-group"]');

  if (!controlGroup) return;

  const btn = (document.getElementById('kreo-alt-player-btn') as HTMLButtonElement) || document.createElement('button');
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

  btn.onmouseover = () => btn.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
  btn.onmouseout = () => btn.style.backgroundColor = 'transparent';

  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isContextValid()) return;
    
    chrome.storage.sync.get(['isEnabled'], (data) => {
      const toggleState = !data.isEnabled;
      chrome.storage.sync.set({ isEnabled: toggleState }, () => {
        playerEnabled = toggleState;
        btn.innerText = playerEnabled ? 'Use Default Player' : 'Alt Player';
        checkAndMount();
      });
    });
  };
}

// Twitch is an SPA, so we periodically check if the URL changed to a new streamer
const mainInterval = setInterval(() => {
  if (!isContextValid()) {
    clearInterval(mainInterval);
    return;
  }
  checkAndMount();
  injectPlayerButton();
}, 2000);

// Injection loop for the button (Twitch DOM constantly destroys/recreates controls)
const slowInterval = setInterval(() => {
  if (!isContextValid()) {
    clearInterval(slowInterval);
    return;
  }
  injectPlayerButton();
}, 1000);

// Initial check
checkAndMount();
