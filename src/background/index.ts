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

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'PLAYER_CLOSED') {
    // Update the extension's state when the player is closed
    chrome.storage.sync.set({ isEnabled: false });
    
    // Update the extension icon to show it's disabled
    updateExtensionIcon(false);
    sendResponse();
    return false; // Synchronous
  } 
  
  if (message.action === 'GET_STREAM_URL') {
    getStreamToken(message.streamerName).then(token => {
      if (token) {
        const url = getStreamUrl(message.streamerName, token);
        sendResponse({ url });
      } else {
        sendResponse({ error: 'Failed to get stream token. Make sure the streamer is live.' });
      }
    }).catch(err => {
      sendResponse({ error: err.message });
    });
    return true; // Keep message channel open for async response
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
