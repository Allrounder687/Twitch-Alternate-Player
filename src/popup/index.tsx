import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const App: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [streamerName, setStreamerName] = useState<string>('');
  const [volume, setVolume] = useState<number>(50);
  const [quality, setQuality] = useState<string>('auto');
  const [lowLatency, setLowLatency] = useState<boolean>(false);

  useEffect(() => {
    chrome.storage.sync.get(['isEnabled', 'streamerName', 'volume', 'quality'], (data) => {
      setIsEnabled(data.isEnabled || false);
      setStreamerName(data.streamerName || '');
      setVolume(data.volume || 50);
      setQuality(data.quality || 'auto');
    });
    chrome.storage.local.get(['lowLatency'], (data) => {
      setLowLatency(data.lowLatency || false);
    });
  }, []);

  const handleToggle = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    chrome.storage.sync.set({ isEnabled: newState });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'TOGGLE_PLAYER',
          isEnabled: newState,
          streamerName,
          volume,
          quality,
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

  const handleLowLatencyToggle = () => {
    const newVal = !lowLatency;
    setLowLatency(newVal);
    chrome.storage.local.set({ lowLatency: newVal });
  };

  return (
    <div className="app">
      <header>
        <h1>Twitch Alt Player</h1>
        <label className="switch">
          <input type="checkbox" checked={isEnabled} onChange={handleToggle} />
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

        <div className="form-group toggle-row">
          <label>Low Latency Mode</label>
          <label className="switch small">
            <input type="checkbox" checked={lowLatency} onChange={handleLowLatencyToggle} />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div className="shortcuts-info">
        <span className="shortcuts-title">Keyboard Shortcuts</span>
        <div className="shortcut-grid">
          <span>Space</span><span>Play/Pause</span>
          <span>F</span><span>Fullscreen</span>
          <span>M</span><span>Mute</span>
          <span>T</span><span>Theater Mode</span>
          <span>Up/Down</span><span>Volume</span>
          <span>Left/Right</span><span>Seek (VOD)</span>
        </div>
      </div>

      <div className={`status ${isEnabled ? 'active' : ''}`}>
        {isEnabled ? 'Player is enabled' : 'Player is disabled'}
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
