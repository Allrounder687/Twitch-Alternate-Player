import type { VideoInstance, QualityLevel } from './VideoCore';

export function createCustomControls(
  videoContainer: HTMLElement,
  videoElement: HTMLVideoElement,
  streamerName: string,
  quality: string,
  chatContainer: HTMLElement,
  videoInstance: VideoInstance,
  onClose: () => void,
  onTheaterToggle: () => void
) {
  // === BOTTOM CONTROLS ===
  const controlsBar = document.createElement('div');
  controlsBar.className = 'controls-bar custom-ui';
  controlsBar.innerHTML = `
    <div class="controls-section">
      <button class="ctrl-btn play-btn" title="Play/Pause (Space)">
        <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <div class="volume-container">
        <button class="ctrl-btn mute-btn" title="Mute (M)">
          <svg class="vol-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
        </button>
        <input type="range" class="volume-slider" min="0" max="100" value="${videoElement.volume * 100}">
      </div>
      <span class="live-indicator" style="color:red; font-weight:bold; font-size:12px;">LIVE</span>
    </div>
    <div class="controls-section">
      <button class="ctrl-btn clip-btn" title="Save Clip (last 30s)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
      </button>
      <button class="ctrl-btn stats-btn" title="Stream Stats">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      </button>
      <button class="ctrl-btn audio-only-btn" title="Audio Only">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </button>
      <button class="ctrl-btn low-latency-btn" title="Low Latency">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      </button>
      <button class="ctrl-btn switch-default-btn" title="Return to Twitch Player">Default</button>
      <button class="ctrl-btn chat-toggle-btn" title="Toggle Chat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      </button>
      <button class="ctrl-btn settings-btn" title="Quality">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
      <button class="ctrl-btn pip-btn" title="Picture-in-Picture">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><rect x="11" y="9" width="10" height="7" rx="1" ry="1"/></svg>
      </button>
      <button class="ctrl-btn theater-btn" title="Theater Mode (T)">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 5v14h20V5H2zm18 12H4V7h16v10z"/></svg>
      </button>
      <button class="ctrl-btn fullscreen-btn" title="Fullscreen (F)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
      </button>
    </div>
  `;

  // === SETTINGS MODAL ===
  const settingsModal = document.createElement('div');
  settingsModal.className = 'settings-modal';
  let currentQuality = quality;
  let dynamicQualities: QualityLevel[] = [];

  const updateSettingsUI = () => {
    const quals = dynamicQualities.length > 0
      ? dynamicQualities
      : [
          { index: -1, label: 'Auto', height: 0, bitrate: 0, fps: 0 },
          { index: 0, label: '1080p60', height: 1080, bitrate: 0, fps: 60 },
          { index: 1, label: '720p60', height: 720, bitrate: 0, fps: 60 },
          { index: 2, label: '480p', height: 480, bitrate: 0, fps: 30 },
          { index: 3, label: '360p', height: 360, bitrate: 0, fps: 30 },
        ];

    settingsModal.innerHTML = `
      <div class="settings-group">
        <span class="settings-label">Quality</span>
        <div class="quality-list">
          ${quals.map((q) => `
            <div class="quality-option ${q.label === currentQuality ? 'selected' : ''}" data-quality="${q.label}">
              <span>${q.label}</span>
              ${q.bitrate > 0 ? `<span class="quality-bitrate">${(q.bitrate / 1000).toFixed(0)}k</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    settingsModal.querySelectorAll('.quality-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        const selected = opt.getAttribute('data-quality') || 'Auto';
        currentQuality = selected;
        videoInstance.setQuality(selected);
        chrome.storage.sync.set({ quality: selected });
        updateSettingsUI();
        settingsModal.classList.remove('active');
      });
    });
  };

  // Listen for qualities from HLS manifest
  videoContainer.addEventListener('qualities-parsed', ((e: CustomEvent) => {
    dynamicQualities = e.detail;
    updateSettingsUI();
  }) as EventListener);

  updateSettingsUI();

  videoContainer.appendChild(controlsBar);
  videoContainer.appendChild(settingsModal);

  // Auto-hide UI logic
  let hideTimeout: number;
  const showUI = () => {
    videoContainer.classList.remove('hide-ui');
    clearTimeout(hideTimeout);
    hideTimeout = window.setTimeout(() => {
      if (!videoElement.paused) videoContainer.classList.add('hide-ui');
    }, 3000);
  };
  videoContainer.addEventListener('mousemove', showUI);
  videoContainer.addEventListener('mouseleave', () => videoContainer.classList.add('hide-ui'));
  showUI();

  // Elements
  const playBtn = controlsBar.querySelector('.play-btn') as HTMLButtonElement;
  const playIcon = playBtn.querySelector('.play-icon') as SVGElement;
  const muteBtn = controlsBar.querySelector('.mute-btn') as HTMLButtonElement;
  const volIcon = muteBtn.querySelector('.vol-icon') as SVGElement;
  const volSlider = controlsBar.querySelector('.volume-slider') as HTMLInputElement;
  const fullscreenBtn = controlsBar.querySelector('.fullscreen-btn') as HTMLButtonElement;
  const settingsBtn = controlsBar.querySelector('.settings-btn') as HTMLButtonElement;
  const switchDefaultBtn = controlsBar.querySelector('.switch-default-btn') as HTMLButtonElement;
  const pipBtn = controlsBar.querySelector('.pip-btn') as HTMLButtonElement;
  const theaterBtn = controlsBar.querySelector('.theater-btn') as HTMLButtonElement;
  const chatToggle = controlsBar.querySelector('.chat-toggle-btn') as HTMLButtonElement;
  const clipBtn = controlsBar.querySelector('.clip-btn') as HTMLButtonElement;
  const statsBtn = controlsBar.querySelector('.stats-btn') as HTMLButtonElement;
  const audioOnlyBtn = controlsBar.querySelector('.audio-only-btn') as HTMLButtonElement;
  const lowLatencyBtn = controlsBar.querySelector('.low-latency-btn') as HTMLButtonElement;

  // State tracking for toggle buttons
  let audioOnlyActive = false;
  let lowLatencyActive = false;

  // Load low-latency state from storage
  chrome.storage.local.get(['lowLatency'], (data) => {
    lowLatencyActive = !!data.lowLatency;
    if (lowLatencyActive) lowLatencyBtn.classList.add('active-toggle');
  });

  // Switch to default player
  switchDefaultBtn.addEventListener('click', () => {
    chrome.storage.sync.set({ isEnabled: false }, () => {
      onClose();
    });
  });

  // Play/Pause
  const togglePlay = () => {
    if (videoElement.paused) videoElement.play();
    else videoElement.pause();
  };
  playBtn.addEventListener('click', togglePlay);
  videoElement.addEventListener('click', togglePlay);

  videoElement.addEventListener('play', () => {
    playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
  });
  videoElement.addEventListener('pause', () => {
    playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    showUI();
  });

  // Volume
  const updateVolumeIcon = () => {
    if (videoElement.muted || videoElement.volume === 0) {
      volIcon.innerHTML =
        '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.58.45-1.24.8-1.97.98v2.09c1.24-.22 2.37-.74 3.33-1.47L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
    } else if (videoElement.volume > 0.5) {
      volIcon.innerHTML =
        '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
    } else {
      volIcon.innerHTML =
        '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
    }
  };

  const toggleMute = () => {
    videoElement.muted = !videoElement.muted;
    updateVolumeIcon();
  };

  muteBtn.addEventListener('click', toggleMute);

  volSlider.addEventListener('input', () => {
    videoElement.volume = Number(volSlider.value) / 100;
    videoElement.muted = videoElement.volume === 0;
    updateVolumeIcon();
  });

  videoElement.addEventListener('volumechange', () => {
    updateVolumeIcon();
    volSlider.value = (videoElement.volume * 100).toString();
  });

  // Wheel volume control
  const wheelHandler = (e: WheelEvent) => {
    if (e.deltaY === 0) return;
    e.preventDefault();
    const step = 0.05;
    const delta = e.deltaY > 0 ? -step : step;
    const nextVolume = Math.max(0, Math.min(1, videoElement.volume + delta));
    videoElement.volume = nextVolume;
    videoElement.muted = nextVolume === 0;
    chrome.storage.sync.set({ volume: Math.round(nextVolume * 100) });
  };
  videoContainer.addEventListener('wheel', wheelHandler, { passive: false });
  updateVolumeIcon();

  // Chat Toggle
  chatToggle.addEventListener('click', () => {
    chatContainer.classList.toggle('hidden');
  });

  // Fullscreen
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      videoContainer.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  });

  // Settings
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsModal.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!settingsModal.contains(e.target as Node) && !settingsBtn.contains(e.target as Node)) {
      settingsModal.classList.remove('active');
    }
  });

  // PiP
  pipBtn.addEventListener('click', async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoElement.requestPictureInPicture();
      }
    } catch (e) {
      console.error('[Alt Player] PiP failed:', e);
    }
  });

  // Theater Mode
  theaterBtn.addEventListener('click', () => {
    onTheaterToggle();
  });

  // Clip creation
  clipBtn.addEventListener('click', () => {
    const saved = videoInstance.clipRecorder.saveClip();
    if (saved) {
      clipBtn.classList.add('active-toggle');
      setTimeout(() => clipBtn.classList.remove('active-toggle'), 1500);
    }
  });

  // Stats overlay toggle
  statsBtn.addEventListener('click', () => {
    videoInstance.stats.toggle();
    statsBtn.classList.toggle('active-toggle', videoInstance.stats.isVisible());
  });

  // Audio-only toggle
  audioOnlyBtn.addEventListener('click', () => {
    audioOnlyActive = !audioOnlyActive;
    videoInstance.setAudioOnly(audioOnlyActive);
    audioOnlyBtn.classList.toggle('active-toggle', audioOnlyActive);
  });

  // Low-latency toggle
  lowLatencyBtn.addEventListener('click', () => {
    lowLatencyActive = !lowLatencyActive;
    videoInstance.setLowLatency(lowLatencyActive);
    lowLatencyBtn.classList.toggle('active-toggle', lowLatencyActive);
  });

  // Keyboard shortcuts
  const keydownHandler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlay();
        break;
      case 'KeyM':
        e.preventDefault();
        toggleMute();
        break;
      case 'KeyF':
        e.preventDefault();
        fullscreenBtn.click();
        break;
      case 'KeyT':
        e.preventDefault();
        theaterBtn.click();
        break;
      case 'ArrowUp':
        e.preventDefault();
        videoElement.volume = Math.min(1, videoElement.volume + 0.1);
        volSlider.value = (videoElement.volume * 100).toString();
        break;
      case 'ArrowDown':
        e.preventDefault();
        videoElement.volume = Math.max(0, videoElement.volume - 0.1);
        volSlider.value = (videoElement.volume * 100).toString();
        break;
      case 'ArrowLeft':
        // Seek backward 10s (for VODs)
        e.preventDefault();
        videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
        break;
      case 'ArrowRight':
        // Seek forward 10s (for VODs)
        e.preventDefault();
        videoElement.currentTime += 10;
        break;
      case 'KeyJ':
        e.preventDefault();
        videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
        break;
      case 'KeyL':
        e.preventDefault();
        videoElement.currentTime += 10;
        break;
    }
  };
  window.addEventListener('keydown', keydownHandler);

  return {
    cleanup: () => {
      window.removeEventListener('keydown', keydownHandler);
      videoContainer.removeEventListener('wheel', wheelHandler);
    },
  };
}
