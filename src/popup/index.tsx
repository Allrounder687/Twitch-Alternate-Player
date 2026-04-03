import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

type LatencyMode = 'ultra-low' | 'balanced' | 'stable';

interface EmoteProviders {
  bttv: boolean;
  ffz: boolean;
  seventv: boolean;
}

const LATENCY_LABELS: Record<LatencyMode, string> = {
  'ultra-low': 'Ultra Low',
  'balanced': 'Balanced',
  'stable': 'Stable',
};

const App: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [streamerName, setStreamerName] = useState<string>('');
  const [volume, setVolume] = useState<number>(50);
  const [quality, setQuality] = useState<string>('auto');
  const [latencyMode, setLatencyMode] = useState<LatencyMode>('balanced');
  const [chatEnabled, setChatEnabled] = useState<boolean>(true);
  const [emoteProviders, setEmoteProviders] = useState<EmoteProviders>({ bttv: true, ffz: true, seventv: true });
  const [autoClaimPoints, setAutoClaimPoints] = useState<boolean>(true);
  const [twitchUsername, setTwitchUsername] = useState<string>('');
  const [showAdNotifications, setShowAdNotifications] = useState<boolean>(true);
  const [layout, setLayout] = useState<string>('balanced');

  useEffect(() => {
    chrome.storage.sync.get(
      ['isEnabled', 'streamerName', 'volume', 'quality', 'latencyMode', 'lowLatency',
       'chatEnabled', 'emoteProviders', 'autoClaimPoints', 'twitchUsername', 'showAdNotifications', 'layout'],
      (data) => {
        setIsEnabled(data.isEnabled || false);
        setStreamerName(data.streamerName || '');
        setVolume(data.volume || 50);
        setQuality(data.quality || 'auto');
        // Migrate from old lowLatency boolean
        if (data.latencyMode) {
          setLatencyMode(data.latencyMode);
        } else {
          setLatencyMode(data.lowLatency !== false ? 'balanced' : 'stable');
        }
        setChatEnabled(data.chatEnabled !== false);
        setEmoteProviders(data.emoteProviders || { bttv: true, ffz: true, seventv: true });
        setAutoClaimPoints(data.autoClaimPoints !== false);
        setTwitchUsername(data.twitchUsername || '');
        setShowAdNotifications(data.showAdNotifications !== false);
        setLayout(data.layout || 'balanced');
      }
    );
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

  const handleLatencyChange = (mode: LatencyMode) => {
    setLatencyMode(mode);
    chrome.storage.sync.set({ latencyMode: mode });
  };

  const handleChatToggle = () => {
    const newState = !chatEnabled;
    setChatEnabled(newState);
    chrome.storage.sync.set({ chatEnabled: newState });
  };

  const handleEmoteProviderToggle = (provider: keyof EmoteProviders) => {
    const newProviders = { ...emoteProviders, [provider]: !emoteProviders[provider] };
    setEmoteProviders(newProviders);
    chrome.storage.sync.set({ emoteProviders: newProviders });
  };

  const handleAutoClaimToggle = () => {
    const newState = !autoClaimPoints;
    setAutoClaimPoints(newState);
    chrome.storage.sync.set({ autoClaimPoints: newState });
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setTwitchUsername(name);
    chrome.storage.sync.set({ twitchUsername: name });
  };

  const handleLayoutChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLayout = e.target.value;
    setLayout(newLayout);
    chrome.storage.sync.set({ layout: newLayout });
  };

  const handleAdNotificationsToggle = () => {
    const newState = !showAdNotifications;
    setShowAdNotifications(newState);
    chrome.storage.sync.set({ showAdNotifications: newState });
  };

  return (
    <div className="app">
      <header>
        <h1>Twitch Player</h1>
        <label className="switch">
          <input type="checkbox" checked={isEnabled} onChange={handleToggle} />
          <span className="slider round"></span>
        </label>
      </header>

      <div className="settings">
        <div className="form-group">
          <label>Streamer Name</label>
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
          <label>Quality</label>
          <select value={quality} onChange={handleQualityChange}>
            <option value="auto">Auto</option>
            <option value="1080p60">1080p60</option>
            <option value="720p60">720p60</option>
            <option value="480p30">480p</option>
            <option value="360p30">360p</option>
            <option value="audio_only">Audio Only</option>
          </select>
        </div>

        <div className="form-group">
          <label>Latency Mode</label>
          <div className="latency-slider">
            {(['ultra-low', 'balanced', 'stable'] as LatencyMode[]).map((mode) => (
              <button
                key={mode}
                className={`latency-option ${latencyMode === mode ? 'active' : ''}`}
                onClick={() => handleLatencyChange(mode)}
              >
                {LATENCY_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group toggle-row">
          <label>Chat Sidebar</label>
          <label className="switch small">
            <input type="checkbox" checked={chatEnabled} onChange={handleChatToggle} />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="form-group">
          <label>Layout Preset</label>
          <select value={layout} onChange={handleLayoutChange}>
            <option value="balanced">Balanced</option>
            <option value="minimalist">Minimalist</option>
            <option value="chatFocused">Chat Focused</option>
            <option value="theater">Theater</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <span className="section-title">Emote Providers</span>
        <div className="settings">
          <div className="form-group toggle-row">
            <label>BTTV</label>
            <label className="switch small">
              <input type="checkbox" checked={emoteProviders.bttv} onChange={() => handleEmoteProviderToggle('bttv')} />
              <span className="slider round"></span>
            </label>
          </div>
          <div className="form-group toggle-row">
            <label>FFZ</label>
            <label className="switch small">
              <input type="checkbox" checked={emoteProviders.ffz} onChange={() => handleEmoteProviderToggle('ffz')} />
              <span className="slider round"></span>
            </label>
          </div>
          <div className="form-group toggle-row">
            <label>7TV</label>
            <label className="switch small">
              <input type="checkbox" checked={emoteProviders.seventv} onChange={() => handleEmoteProviderToggle('seventv')} />
              <span className="slider round"></span>
            </label>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <span className="section-title">Features</span>
        <div className="settings">
          <div className="form-group toggle-row">
            <label>Auto-Claim Points</label>
            <label className="switch small">
              <input type="checkbox" checked={autoClaimPoints} onChange={handleAutoClaimToggle} />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="form-group">
            <label>Twitch Username (for mentions)</label>
            <input
              type="text"
              value={twitchUsername}
              onChange={handleUsernameChange}
              placeholder="Your username (auto-detected if empty)"
            />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <span className="section-title">Ad Handling</span>
        <div className="settings">
          <div className="form-group toggle-row">
            <label>Show Notifications</label>
            <label className="switch small">
              <input type="checkbox" checked={showAdNotifications} onChange={handleAdNotificationsToggle} />
              <span className="slider round"></span>
            </label>
          </div>
          <p className="info-text">
            The player filters ad segments from the stream playlist. This may not catch all ads.
          </p>
        </div>
      </div>

      <div className="shortcuts-info">
        <span className="shortcuts-label">Shortcuts</span>
        <div className="shortcut-grid">
          <span>Space</span><span>Play/Pause</span>
          <span>M</span><span>Mute</span>
          <span>F</span><span>Fullscreen</span>
          <span>T</span><span>Theater</span>
          <span>J / L</span><span>-10s / +10s</span>
          <span>&uarr; / &darr;</span><span>Volume</span>
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
