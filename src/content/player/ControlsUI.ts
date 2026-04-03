export function createCustomControls(
  videoContainer: HTMLElement,
  videoElement: HTMLVideoElement,
  streamerName: string,
  quality: string,
  chatContainer: HTMLElement,
  onClose: () => void
) {
  // === BOTTOM CONTROLS ===
  const controlsBar = document.createElement('div');
  controlsBar.className = 'controls-bar custom-ui';
  controlsBar.innerHTML = `
    <div class="controls-section">
      <button class="ctrl-btn play-btn">
        <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <div class="volume-container">
        <button class="ctrl-btn mute-btn">
          <svg class="vol-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
        </button>
        <input type="range" class="volume-slider" min="0" max="100" value="${videoElement.volume * 100}">
      </div>
      <span class="live-indicator" style="color:red; font-weight:bold; font-size:12px;">LIVE</span>
    </div>
    <div class="controls-section">
      <button class="ctrl-btn switch-default-btn" title="Return to Twitch Player">Default Player</button>
      <button class="ctrl-btn chat-toggle-btn" title="Toggle Chat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      </button>
      <button class="ctrl-btn settings-btn" title="Settings">Quality</button>
      <button class="ctrl-btn pip-btn" title="Mini Player">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H3c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 12H3V4h10v10z"></path><path d="M21 8h-4v2h4v10H11v-4H9v4c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z"></path></svg>
      </button>
      <button class="ctrl-btn theater-btn" title="Theater Mode">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 5v14h20V5H2zm18 12H4V7h16v10z"/></svg>
      </button>
      <button class="ctrl-btn fullscreen-btn" title="Fullscreen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
      </button>
    </div>
  `;

  // === SETTINGS MODAL ===
  const settingsModal = document.createElement('div');
  settingsModal.className = 'settings-modal';
  
  const updateSettingsUI = () => {
    const qualities = ['auto', '1080p60', '720p60', '480p30', '360p30', 'audio_only'];
    settingsModal.innerHTML = `
      <div class="settings-group">
        <span class="settings-label">Quality</span>
        <div class="quality-list">
          ${qualities.map(q => `
            <div class="quality-option ${q === quality ? 'selected' : ''}" data-quality="${q}">
              ${q === 'audio_only' ? 'Audio Only' : q === 'auto' ? 'Auto' : q}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Re-attach listeners to new elements
    settingsModal.querySelectorAll('.quality-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const selected = opt.getAttribute('data-quality') || 'auto';
        videoContainer.dispatchEvent(new CustomEvent('twitch-set-quality', { detail: selected }));
        // Update storage
        chrome.storage.sync.set({ quality: selected });
        // Update local UI
        quality = selected;
        updateSettingsUI();
        settingsModal.classList.remove('active');
      });
    });
  };

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
  
  // Interactions
  switchDefaultBtn.addEventListener('click', () => {
    chrome.storage.sync.set({ isEnabled: false }, () => {
      onClose();
    });
  });

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
      volIcon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.58.45-1.24.8-1.97.98v2.09c1.24-.22 2.37-.74 3.33-1.47L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
    } else if (videoElement.volume > 0.5) {
      volIcon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
    } else {
      volIcon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
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

  // Wheel Volume Control
  const wheelHandler = (e: WheelEvent) => {
    if (e.deltaY === 0) return;
    e.preventDefault();
    const step = 0.05;
    const delta = e.deltaY > 0 ? -step : step;
    const nextVolume = Math.max(0, Math.min(1, videoElement.volume + delta));
    videoElement.volume = nextVolume;
    videoElement.muted = nextVolume === 0;
    
    // Save to storage (throttled implicitly by user interaction speed)
    chrome.storage.sync.set({ volume: Math.round(nextVolume * 100) });
  };
  videoContainer.addEventListener('wheel', wheelHandler, { passive: false });

  updateVolumeIcon();


  // Chat Toggling
  const chatToggle = controlsBar.querySelector('.chat-toggle-btn') as HTMLButtonElement;
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

  // PiP (Mini Player)
  const pipBtn = controlsBar.querySelector('.pip-btn') as HTMLButtonElement;
  pipBtn.addEventListener('click', async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoElement.requestPictureInPicture();
      }
    } catch (e) {
      console.error("[Alt Player] PiP failed:", e);
    }
  });

  // Theater Mode
  const theaterBtn = controlsBar.querySelector('.theater-btn') as HTMLButtonElement;
  theaterBtn.addEventListener('click', () => {
    // Proxy the click to Twitch's native theater mode button for robust layout integration
    const selectors = [
      '[data-a-target="player-theatre-mode-button"]',
      '[data-a-target="right-control-theater-mode-button"]',
      '[data-a-target="core-player-theater-mode-button"]',
      'button[aria-label*="Theater Mode"]'
    ];
    
    let nativeBtn: HTMLElement | null = null;
    for (const s of selectors) {
      nativeBtn = document.querySelector(s) as HTMLElement;
      if (nativeBtn) break;
    }

    if (nativeBtn) {
      nativeBtn.click();
    } else {
      console.warn('[Alt Player] Native theater mode button not found using any known selector.');
    }
  });

  // Hotkeys
  const keydownHandler = (e: KeyboardEvent) => {
    // Ignore if user is typing in a text field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

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
        const up = Math.min(1, videoElement.volume + 0.1);
        videoElement.volume = up;
        volSlider.value = (up * 100).toString();
        break;
      case 'ArrowDown':
        e.preventDefault();
        const down = Math.max(0, videoElement.volume - 0.1);
        videoElement.volume = down;
        volSlider.value = (down * 100).toString();
        break;
      case 'KeyJ':
        // Instant Replay (backward 10s)
        e.preventDefault();
        videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
        break;
    }
  };
  window.addEventListener('keydown', keydownHandler);

  return { 
    cleanup: () => {
      window.removeEventListener('keydown', keydownHandler);
    }
  };
}

