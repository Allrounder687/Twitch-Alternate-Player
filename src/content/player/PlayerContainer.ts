import './player.css';
import { attachVideo, VideoInstance } from './VideoCore';
import { createCustomControls } from './ControlsUI';
import { ChatPanel } from './ChatPanel';

export class PlayerContainer {
  private container: HTMLDivElement | null = null;
  private videoInstance: VideoInstance | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private controlsCleanup: (() => void) | null = null;
  private originalStates = new Map<HTMLVideoElement, { muted: boolean; paused: boolean }>();
  private observer: IntersectionObserver | null = null;
  private baseVideoInterval: number | null = null;
  private chatPanel: ChatPanel | null = null;
  private theaterMode = false;
  private target: HTMLElement | null = null;

  public mount(streamerName: string, volume: number = 50, quality: string = 'auto') {
    if (this.container) {
      this.unmount();
    }

    const playerSelectors = [
      '.video-player__container',
      '.highwind-video-player',
      '[data-a-target="player-container"]',
    ];

    this.target = null;
    for (const selector of playerSelectors) {
      this.target = document.querySelector(selector) as HTMLElement;
      if (this.target) break;
    }

    if (!this.target) {
      console.error('[Alt Player] Could not find Twitch player container to overlay');
      return;
    }

    if (getComputedStyle(this.target).position === 'static') {
      this.target.style.position = 'relative';
    }

    // Main overlay wrapper
    this.container = document.createElement('div');
    this.container.id = 'kreo-twitch-player-host';

    // Video container
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';

    // Video element
    const video = document.createElement('video');
    this.videoElement = video;
    video.autoplay = true;
    video.volume = volume / 100;

    // Loader and error
    const loader = document.createElement('div');
    loader.className = 'loader active';

    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-msg';

    videoContainer.appendChild(video);
    videoContainer.appendChild(loader);
    videoContainer.appendChild(errorMsg);

    // Chat container — uses IRC WebSocket chat with BTTV/FFZ emotes
    const chatContainer = document.createElement('div');
    chatContainer.className = 'chat-container hidden';

    // Mini close button
    const miniClose = document.createElement('button');
    miniClose.className = 'mini-close-btn';
    miniClose.innerText = 'Close Mini';
    miniClose.onclick = (e) => {
      e.stopPropagation();
      this.container?.classList.remove('mini-mode');
    };

    this.container.appendChild(videoContainer);
    this.container.appendChild(chatContainer);
    this.container.appendChild(miniClose);
    this.target.appendChild(this.container);

    // Initialize IRC chat panel inside chatContainer
    this.chatPanel = new ChatPanel(chatContainer, streamerName);

    // Attach HLS video logic (with all new features)
    this.videoInstance = attachVideo(video, videoContainer, streamerName, loader, errorMsg);

    // Initialize custom UI controls
    const controls = createCustomControls(
      videoContainer,
      video,
      streamerName,
      quality,
      chatContainer,
      this.videoInstance,
      () => this.unmount(),
      () => this.toggleTheater()
    );
    this.controlsCleanup = controls.cleanup;

    // Trigger animation
    requestAnimationFrame(() => {
      if (this.container) this.container.classList.add('active');
    });

    // Setup Sticky Mini-mode Observer
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (this.theaterMode) return; // Don't mini in theater mode
          if (entry.intersectionRatio < 0.1) {
            this.container?.classList.add('mini-mode');
          } else if (entry.intersectionRatio > 0.5) {
            this.container?.classList.remove('mini-mode');
          }
        });
      },
      { threshold: [0.1, 0.5] }
    );

    this.observer.observe(this.target);
    this.startBaseVideoKiller();
  }

  private toggleTheater() {
    this.theaterMode = !this.theaterMode;

    if (this.theaterMode) {
      document.body.classList.add('alt-player-theater');
      this.container?.classList.add('theater-mode');
      // Also try to click native Twitch theater button for layout integration
      const nativeSelectors = [
        '[data-a-target="player-theatre-mode-button"]',
        '[data-a-target="right-control-theater-mode-button"]',
        'button[aria-label*="Theatre"]',
        'button[aria-label*="Theater"]',
      ];
      for (const s of nativeSelectors) {
        const btn = document.querySelector(s) as HTMLElement;
        if (btn) {
          btn.click();
          break;
        }
      }
    } else {
      document.body.classList.remove('alt-player-theater');
      this.container?.classList.remove('theater-mode');
      // Try to exit native theater too
      const nativeSelectors = [
        '[data-a-target="player-theatre-mode-button"]',
        '[data-a-target="right-control-theater-mode-button"]',
        'button[aria-label*="Theatre"]',
        'button[aria-label*="Theater"]',
      ];
      for (const s of nativeSelectors) {
        const btn = document.querySelector(s) as HTMLElement;
        if (btn) {
          btn.click();
          break;
        }
      }
    }
  }

  private startBaseVideoKiller() {
    this.baseVideoInterval = window.setInterval(() => {
      const allVideos = document.querySelectorAll('video');
      allVideos.forEach((vid) => {
        if (vid === this.videoElement) return;
        if (!this.originalStates.has(vid)) {
          this.originalStates.set(vid, { muted: vid.muted, paused: vid.paused });
        }
        try {
          if (!vid.paused) vid.pause();
          if (!vid.muted) vid.muted = true;
        } catch {
          // Ignore cross-origin errors
        }
      });
    }, 1000);
  }

  public unmount() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.videoInstance) {
      this.videoInstance.cleanup();
      this.videoInstance = null;
    }

    if (this.chatPanel) {
      this.chatPanel.destroy();
      this.chatPanel = null;
    }

    if (this.controlsCleanup) {
      this.controlsCleanup();
      this.controlsCleanup = null;
    }

    if (this.baseVideoInterval) {
      window.clearInterval(this.baseVideoInterval);
      this.baseVideoInterval = null;
      this.originalStates.forEach((state, vid) => {
        try {
          vid.muted = state.muted;
          if (!state.paused) vid.play().catch(() => {});
        } catch {
          // Ignore
        }
      });
      this.originalStates.clear();
    }

    // Clean up theater mode
    if (this.theaterMode) {
      this.theaterMode = false;
      document.body.classList.remove('alt-player-theater');
    }

    if (this.container) {
      this.container.classList.remove('active');
      this.container.classList.remove('mini-mode');
      this.container.classList.remove('theater-mode');
      setTimeout(() => {
        if (this.container) {
          this.container.remove();
          this.container = null;
        }
      }, 300);
    }

    this.videoElement = null;
    this.target = null;

    // Notify background script (with retry for MV3 lifecycle)
    try {
      chrome.runtime.sendMessage({ action: 'PLAYER_CLOSED' });
    } catch {
      // Extension context may be invalidated
    }
  }
}

export const playerInstance = new PlayerContainer();
