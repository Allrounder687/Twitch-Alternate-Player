import type { VideoController, HlsQualityLevel, StreamStats } from './VideoCore';

export function createCustomControls(
  videoContainer: HTMLElement,
  videoElement: HTMLVideoElement,
  streamerName: string,
  quality: string,
  chatContainer: HTMLElement,
  onClose: () => void,
  videoController: VideoController
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
      <span class="live-indicator">LIVE</span>
      <span class="latency-display" title="Click to cycle latency mode"></span>
      <span class="ad-shield-icon" title="Ad filter">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
      </span>
    </div>
    <div class="controls-section">
      <button class="ctrl-btn clip-btn" title="Record Clip (30s)">
        <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
      </button>
      <button class="ctrl-btn stats-btn" title="Stream Stats">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-5"/></svg>
      </button>
      <button class="ctrl-btn audio-only-btn" title="Audio Only">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </button>
      <button class="ctrl-btn switch-default-btn" title="Return to Twitch Player">Default Player</button>
      <button class="ctrl-btn chat-toggle-btn" title="Toggle Chat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      </button>
      <button class="ctrl-btn settings-btn" title="Quality">Quality</button>
      <button class="ctrl-btn pip-btn" title="Picture-in-Picture">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><rect x="12" y="9" width="8" height="6" rx="1" fill="currentColor" opacity="0.4"/></svg>
      </button>
      <button class="ctrl-btn theater-btn" title="Theater Mode (T)">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 5v14h20V5H2zm18 12H4V7h16v10z"/></svg>
      </button>
      <button class="ctrl-btn fullscreen-btn" title="Fullscreen (F)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
      </button>
    </div>
  `;

  // === SETTINGS MODAL (Quality) ===
  const settingsModal = document.createElement('div');
  settingsModal.className = 'settings-modal';

  let currentQuality = quality;
  let isAudioOnly = false;

  const updateSettingsUI = (levels?: HlsQualityLevel[]) => {
    const dynamicLevels = levels || videoController.getQualityLevels();

    let qualityOptionsHtml = `<div class="quality-option ${currentQuality === 'auto' ? 'selected' : ''}" data-quality="auto" data-level="-1">Auto</div>`;

    if (dynamicLevels.length > 0) {
      // Sort by height descending
      const sorted = [...dynamicLevels].sort((a, b) => b.height - a.height);
      for (const level of sorted) {
        if (level.height === 0 && level.bitrate < 200000) continue; // Skip audio-only from quality list
        const name = level.name || `${level.height}p`;
        const isSource = level.index === sorted[0].index;
        const label = isSource ? `${name} (Source)` : name;
        const selected = currentQuality === name || currentQuality === `${level.height}p`;
        qualityOptionsHtml += `<div class="quality-option ${selected ? 'selected' : ''}" data-quality="${name}" data-level="${level.index}">${label}</div>`;
      }
    } else {
      // Fallback static options
      const fallback = ['1080p60', '720p60', '480p30', '360p30'];
      for (const q of fallback) {
        qualityOptionsHtml += `<div class="quality-option ${q === currentQuality ? 'selected' : ''}" data-quality="${q}" data-level="-1">${q}</div>`;
      }
    }

    qualityOptionsHtml += `<div class="quality-option ${currentQuality === 'audio_only' ? 'selected' : ''}" data-quality="audio_only" data-level="-1">Audio Only</div>`;

    settingsModal.innerHTML = `
      <div class="settings-group">
        <span class="settings-label">Quality</span>
        <div class="quality-list">${qualityOptionsHtml}</div>
      </div>
    `;

    // Attach listeners
    settingsModal.querySelectorAll('.quality-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        const selected = opt.getAttribute('data-quality') || 'auto';
        const levelIdx = parseInt(opt.getAttribute('data-level') || '-1');

        if (selected === 'auto') {
          videoController.setQuality(-1);
        } else if (selected === 'audio_only') {
          videoElement.dispatchEvent(new CustomEvent('twitch-set-quality', { detail: 'audio_only' }));
        } else if (levelIdx >= 0) {
          videoController.setQuality(levelIdx);
        } else {
          videoElement.dispatchEvent(new CustomEvent('twitch-set-quality', { detail: selected }));
        }

        chrome.storage.sync.set({ quality: selected });
        currentQuality = selected;
        isAudioOnly = selected === 'audio_only';
        updateAudioOnlyBtn();
        updateSettingsUI();
        settingsModal.classList.remove('active');
      });
    });
  };

  // Listen for dynamic quality levels from HLS
  videoController.onQualityLevelsReady((levels) => {
    updateSettingsUI(levels);
  });

  updateSettingsUI();

  // === STATS OVERLAY ===
  const statsOverlay = document.createElement('div');
  statsOverlay.className = 'stats-overlay';
  statsOverlay.style.display = 'none';
  let statsVisible = false;

  const updateStatsDisplay = (stats: StreamStats) => {
    if (!statsVisible) return;
    statsOverlay.innerHTML = `
      <div class="stats-row"><span>Resolution</span><span>${stats.resolution}</span></div>
      <div class="stats-row"><span>Bitrate</span><span>${(stats.bitrate / 1000).toFixed(0)} kbps</span></div>
      <div class="stats-row"><span>FPS</span><span>${stats.fps || '—'}</span></div>
      <div class="stats-row"><span>Dropped Frames</span><span>${stats.droppedFrames}</span></div>
      <div class="stats-row"><span>Buffer</span><span>${stats.bufferLength.toFixed(1)}s</span></div>
      <div class="stats-row"><span>Latency</span><span>${stats.latency.toFixed(1)}s</span></div>
    `;
  };

  videoController.onStats(updateStatsDisplay);

  // === LATENCY DISPLAY ===
  const latencyDisplay = controlsBar.querySelector('.latency-display') as HTMLElement;
  const LATENCY_MODES = ['ultra-low', 'balanced', 'stable'] as const;
  const LATENCY_MODE_LABELS: Record<string, string> = {
    'ultra-low': 'Ultra Low',
    'balanced': 'Balanced',
    'stable': 'Stable',
  };
  let currentLatencyMode = 'balanced';

  // Load current latency mode
  chrome.storage.sync.get(['latencyMode', 'lowLatency'], (data) => {
    if (data.latencyMode) {
      currentLatencyMode = data.latencyMode;
    } else {
      currentLatencyMode = data.lowLatency !== false ? 'balanced' : 'stable';
    }
  });

  const updateLatencyDisplay = (stats: StreamStats) => {
    const latency = stats.latency;
    let color = '#10b981'; // green
    if (latency >= 5) color = '#ef4444'; // red
    else if (latency >= 2) color = '#f59e0b'; // yellow

    latencyDisplay.style.color = color;
    latencyDisplay.textContent = latency > 0 ? `${latency.toFixed(1)}s` : '';
    latencyDisplay.title = `Latency: ${latency.toFixed(1)}s — Mode: ${LATENCY_MODE_LABELS[currentLatencyMode] || currentLatencyMode}\nClick to cycle`;
  };

  videoController.onStats(updateLatencyDisplay);

  latencyDisplay.addEventListener('click', () => {
    const currentIdx = LATENCY_MODES.indexOf(currentLatencyMode as any);
    const nextIdx = (currentIdx + 1) % LATENCY_MODES.length;
    currentLatencyMode = LATENCY_MODES[nextIdx];
    videoController.setLatencyMode(currentLatencyMode);
  });

  // === AD SHIELD INDICATOR ===
  const adShieldIcon = controlsBar.querySelector('.ad-shield-icon') as HTMLElement;
  let adBlockCount = 0;

  const adBlockedHandler = () => {
    adBlockCount++;
    adShieldIcon.title = `Ad filter — ${adBlockCount} ad segment${adBlockCount > 1 ? 's' : ''} filtered`;

    // Pulse animation
    adShieldIcon.classList.remove('pulse');
    void adShieldIcon.offsetWidth; // force reflow
    adShieldIcon.classList.add('pulse');

    // Show toast if notifications are enabled (toast manager is injected via event)
    chrome.storage.sync.get(['showAdNotifications'], (data) => {
      if (data.showAdNotifications !== false) {
        videoElement.dispatchEvent(new CustomEvent('twitch-show-toast', {
          detail: { message: 'Ad segment filtered', type: 'info' },
        }));
      }
    });
  };

  videoElement.addEventListener('twitch-ad-blocked', adBlockedHandler);

  // Listen for channel points claimed
  const pointsClaimedHandler = () => {
    videoElement.dispatchEvent(new CustomEvent('twitch-show-toast', {
      detail: { message: 'Channel points claimed!', type: 'success' },
    }));
  };
  document.addEventListener('twitch-points-claimed', pointsClaimedHandler);

  videoContainer.appendChild(controlsBar);
  videoContainer.appendChild(settingsModal);
  videoContainer.appendChild(statsOverlay);

  // === Auto-hide UI ===
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

  // === Element references ===
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

  // === Switch to default player ===
  switchDefaultBtn.addEventListener('click', () => {
    chrome.storage.sync.set({ isEnabled: false }, () => onClose());
  });

  // === Play/Pause ===
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

  // === Volume ===
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

  // Wheel Volume Control
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

  // === Chat Toggle ===
  chatToggle.addEventListener('click', () => {
    chatContainer.classList.toggle('hidden');
  });

  // === Fullscreen ===
  // Use the top-level host so both video AND chat are inside the fullscreen element
  const fullscreenTarget = videoContainer.closest('#kreo-twitch-player-host') || videoContainer;
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      fullscreenTarget.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  });

  // === Settings ===
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsModal.classList.toggle('active');
  });

  const closeSettingsHandler = (e: MouseEvent) => {
    if (!settingsModal.contains(e.target as Node) && !settingsBtn.contains(e.target as Node)) {
      settingsModal.classList.remove('active');
    }
  };
  document.addEventListener('click', closeSettingsHandler);

  // === PiP ===
  pipBtn.addEventListener('click', async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoElement.requestPictureInPicture();
      }
    } catch (e: any) {
      console.error('[Alt Player] PiP failed:', e?.message || String(e));
    }
  });

  // === Theater Mode ===
  theaterBtn.addEventListener('click', () => {
    const selectors = [
      '[data-a-target="player-theatre-mode-button"]',
      '[data-a-target="right-control-theater-mode-button"]',
      '[data-a-target="core-player-theater-mode-button"]',
      'button[aria-label*="heater"]',
      'button[aria-label*="Theatre"]',
    ];

    let nativeBtn: HTMLElement | null = null;
    for (const s of selectors) {
      nativeBtn = document.querySelector(s) as HTMLElement;
      if (nativeBtn) break;
    }

    if (nativeBtn) {
      nativeBtn.click();
    } else {
      // Fallback: toggle a CSS class on the player host
      const host = document.getElementById('kreo-twitch-player-host');
      host?.classList.toggle('theater-mode');
    }
  });

  // === Clip Recording ===
  let clipRecording = false;
  clipBtn.addEventListener('click', async () => {
    if (clipRecording) {
      videoController.stopClip();
      clipBtn.classList.remove('recording');
      clipRecording = false;
      return;
    }

    clipRecording = true;
    clipBtn.classList.add('recording');
    clipBtn.title = 'Recording... Click to stop';

    const blob = await videoController.startClip();

    clipBtn.classList.remove('recording');
    clipBtn.title = 'Record Clip (30s)';
    clipRecording = false;

    if (blob && blob.size > 0) {
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clip_${streamerName}_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  });

  // === Stats Overlay ===
  statsBtn.addEventListener('click', () => {
    statsVisible = !statsVisible;
    statsOverlay.style.display = statsVisible ? 'block' : 'none';
    statsBtn.classList.toggle('active-toggle', statsVisible);
    if (statsVisible) {
      // Trigger immediate update
      updateStatsDisplay(videoController.getStats());
    }
  });

  // === Audio Only Toggle ===
  const updateAudioOnlyBtn = () => {
    audioOnlyBtn.classList.toggle('active-toggle', isAudioOnly);
    audioOnlyBtn.title = isAudioOnly ? 'Audio Only (On)' : 'Audio Only';
  };

  audioOnlyBtn.addEventListener('click', () => {
    isAudioOnly = !isAudioOnly;
    if (isAudioOnly) {
      videoElement.dispatchEvent(new CustomEvent('twitch-set-quality', { detail: 'audio_only' }));
      currentQuality = 'audio_only';
    } else {
      videoElement.dispatchEvent(new CustomEvent('twitch-set-quality', { detail: 'auto' }));
      currentQuality = 'auto';
    }
    chrome.storage.sync.set({ quality: currentQuality });
    updateAudioOnlyBtn();
    updateSettingsUI();
  });
  updateAudioOnlyBtn();

  // === Keyboard Shortcuts ===
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
        // Seek backward 5s (VODs)
        e.preventDefault();
        videoElement.currentTime = Math.max(0, videoElement.currentTime - 5);
        break;
      case 'ArrowRight':
        // Seek forward 5s (VODs)
        e.preventDefault();
        videoElement.currentTime += 5;
        break;
      case 'KeyJ':
        // Instant Replay backward 10s
        e.preventDefault();
        videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
        break;
      case 'KeyL':
        // Forward 10s
        e.preventDefault();
        videoElement.currentTime += 10;
        break;
    }
  };
  window.addEventListener('keydown', keydownHandler);

  return {
    cleanup: () => {
      window.removeEventListener('keydown', keydownHandler);
      document.removeEventListener('click', closeSettingsHandler);
      videoContainer.removeEventListener('wheel', wheelHandler);
      videoElement.removeEventListener('twitch-ad-blocked', adBlockedHandler);
      document.removeEventListener('twitch-points-claimed', pointsClaimedHandler);
    },
  };
}
