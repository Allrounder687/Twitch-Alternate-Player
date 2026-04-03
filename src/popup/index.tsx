import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const App: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [streamerName, setStreamerName] = useState<string>('');
  const [volume, setVolume] = useState<number>(50);
  const [quality, setQuality] = useState<string>('auto');

  useEffect(() => {
    // Load saved settings
    chrome.storage.sync.get(
      ['isEnabled', 'streamerName', 'volume', 'quality'],
      (data) => {
        setIsEnabled(data.isEnabled || false);
        setStreamerName(data.streamerName || '');
        setVolume(data.volume || 50);
        setQuality(data.quality || 'auto');
      }
    );
  }, []);

  const handleToggle = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    chrome.storage.sync.set({ isEnabled: newState });
    
    // Send message to content script to toggle the player
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'TOGGLE_PLAYER', 
          isEnabled: newState,
          streamerName,
          volume,
          quality
        });
      }
    });
  };

  const handleStreamerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setStreamerName(name);
    chrome.storage.sync.set({ streamerName: name });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    chrome.storage.sync.set({ volume: newVolume });
  };

  const handleQualityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newQuality = e.target.value;
    setQuality(newQuality);
    chrome.storage.sync.set({ quality: newQuality });
  };

  return (
    <div className="app">
      <header>
        <h1>Twitch Player</h1>
        <label className="switch">
          <input 
            type="checkbox" 
            checked={isEnabled} 
            onChange={handleToggle} 
          />
          <span className="slider round"></span>
        </label>
      </header>
      
      <div className="settings">
        <div className="form-group">
          <label>Streamer Name:</label>
          <input 
            type="text" 
            value={streamerName}
            onChange={handleStreamerChange}
            placeholder="Enter streamer name"
          />
        </div>
        
        <div className="form-group">
          <label>Volume: {volume}%</label>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={volume}
            onChange={handleVolumeChange}
          />
        </div>
        
        <div className="form-group">
          <label>Quality:</label>
          <select value={quality} onChange={handleQualityChange}>
            <option value="auto">Auto</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
            <option value="360p">360p</option>
            <option value="160p">160p</option>
          </select>
        </div>
      </div>
      
      <div className={`status ${isEnabled ? 'active' : ''}`}>
        {isEnabled ? 'Player is enabled' : 'Player is disabled'}
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
