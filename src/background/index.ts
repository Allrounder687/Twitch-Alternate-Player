import { getStreamToken, getStreamUrl } from './twitch-api';

// Listen for installation or update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default values on first install
    chrome.storage.sync.set({
      isEnabled: false,
      streamerName: '',
      volume: 50,
      quality: 'auto'
    });
    
    // Open the options page after installation
    chrome.tabs.create({
      url: 'popup.html'
    });
  }
});

// Stream URL Cache for pre-fetching
const streamCache = new Map<string, { url: string, timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'PLAYER_CLOSED') {
    chrome.storage.sync.set({ isEnabled: false });
    updateExtensionIcon(false);
    sendResponse();
    return false;
  } 

  if (message.action === 'PREFETCH_STREAM') {
    const streamer = message.streamerName;
    // Don't prefetch if already in cache and not expired
    if (streamCache.has(streamer) && (Date.now() - streamCache.get(streamer)!.timestamp < CACHE_TTL)) {
      sendResponse({ status: 'already_cached' });
      return false;
    }

    getStreamToken(streamer).then(token => {
      if (token) {
        const url = getStreamUrl(streamer, token);
        streamCache.set(streamer, { url, timestamp: Date.now() });
        sendResponse({ status: 'prefetched' });
      } else {
        sendResponse({ error: 'failed' });
      }
    }).catch(() => sendResponse({ error: 'failed' }));
    
    return true; // Keep channel open
  }
  
  if (message.action === 'GET_STREAM_URL') {
    const streamer = message.streamerName;

    // Check Cache first
    if (streamCache.has(streamer) && (Date.now() - streamCache.get(streamer)!.timestamp < CACHE_TTL)) {
      const cached = streamCache.get(streamer)!;
      sendResponse({ url: cached.url });
      return false;
    }

    getStreamToken(streamer).then(token => {
      if (token) {
        const url = getStreamUrl(streamer, token);
        streamCache.set(streamer, { url, timestamp: Date.now() });
        sendResponse({ url });
      } else {
        sendResponse({ error: 'Failed to get stream token. Make sure the streamer is live.' });
      }
    }).catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }
  
  // Fallback for any other messages
  sendResponse();
  return false;
});

// Update the extension icon based on the enabled/disabled state
function updateExtensionIcon(isEnabled: boolean) {
  const iconPath = isEnabled 
    ? 'icons/icon48.png' 
    : 'icons/icon48-gray.png';
    
  chrome.action.setIcon({ path: iconPath });
}

// Listen for tab updates to inject content scripts when needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('twitch.tv')) {
    // Check if the player should be enabled for this tab
    chrome.storage.sync.get(['isEnabled', 'streamerName'], (data) => {
      if (data.isEnabled && data.streamerName) {
        // Inject the content script if not already injected
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        }).catch(err => console.error('Error injecting content script:', err));
      }
    });
  }
});

// Initialize the extension icon state
chrome.storage.sync.get(['isEnabled'], (data) => {
  updateExtensionIcon(data.isEnabled || false);
});
