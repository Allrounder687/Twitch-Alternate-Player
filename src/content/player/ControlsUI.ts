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
      <button class="ctrl-btn fullscreen-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
      </button>
    </div>
  `;

  // === SETTINGS MODAL ===
  const settingsModal = document.createElement('div');
  settingsModal.className = 'settings-modal hidden';
  settingsModal.innerHTML = `
    <div class="setting-item">
      <label>Quality</label>
      <select class="quality-select">
        <option value="auto">Auto</option>
        <option value="1080p60">1080p60</option>
        <option value="720p60">720p60</option>
        <option value="480p30">480p</option>
        <option value="360p30">360p</option>
        <option value="audio_only">Audio Only</option>
      </select>
    </div>
  `;

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
      volIcon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
    } else {
      volIcon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
    }
  };
  
  volSlider.addEventListener('input', (e) => {
    videoElement.volume = Number((e.target as HTMLInputElement).value) / 100;
    videoElement.muted = false;
    updateVolumeIcon();
  });

  muteBtn.addEventListener('click', () => {
    videoElement.muted = !videoElement.muted;
    updateVolumeIcon();
  });


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
    settingsModal.classList.toggle('hidden');
  });

  videoContainer.addEventListener('click', (e) => {
    if (!settingsModal.contains(e.target as Node) && !settingsBtn.contains(e.target as Node)) {
      settingsModal.classList.add('hidden');
    }
  });

  const qualitySelect = settingsModal.querySelector('.quality-select') as HTMLSelectElement;
  qualitySelect.addEventListener('change', () => {
    videoElement.dispatchEvent(new CustomEvent('twitch-set-quality', { detail: qualitySelect.value }));
    settingsModal.classList.add('hidden');
  });

  // Hotkeys
  const keydownHandler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    }
  };
  window.addEventListener('keydown', keydownHandler);

  return { 
    cleanup: () => {
      window.removeEventListener('keydown', keydownHandler);
    }
  };
}

