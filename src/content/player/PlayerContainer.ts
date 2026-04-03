import './player.css';
import { attachVideo } from './VideoCore';
import { createCustomControls } from './ControlsUI';

export class PlayerContainer {
  private container: HTMLDivElement | null = null;
  private videoCoreCleanup: (() => void) | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private adBlockCallback: (() => void) | null = null;
  private baseVideoInterval: number | null = null;
  private controlsCleanup: (() => void) | null = null;
  private originalStates = new Map<HTMLVideoElement, { muted: boolean, paused: boolean }>();

  public mount(streamerName: string, volume: number = 50, quality: string = 'auto') {
    if (this.container) {
      this.unmount();
    }

    // Identifiers for Twitch player containers
    const playerSelectors = [
      '.video-player__container',
      '.highwind-video-player',
      '[data-a-target="player-container"]'
    ];
    
    let target: HTMLElement | null = null;
    for (const selector of playerSelectors) {
      target = document.querySelector(selector) as HTMLElement;
      if (target) break;
    }

    if (!target) {
      console.error('[Alt Player] Could not find Twitch player container to overlay');
      return;
    }

    // Ensure the target is relative so our absolute host fills it
    if (getComputedStyle(target).position === 'static') {
      target.style.position = 'relative';
    }

    // Main overlay wrapper
    this.container = document.createElement('div');
    this.container.id = 'kreo-twitch-player-host';

    // Video container
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';

    // Video Element
    const video = document.createElement('video');
    this.videoElement = video;
    video.autoplay = true;
    video.volume = volume / 100;
    
    // Loaders and Error
    const loader = document.createElement('div');
    loader.className = 'loader active';
    
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-msg';

    videoContainer.appendChild(video);
    videoContainer.appendChild(loader);
    videoContainer.appendChild(errorMsg);

    // Chat Container (overlay)
    const chatContainer = document.createElement('div');
    chatContainer.className = 'chat-container hidden';
    chatContainer.innerHTML = `
      <iframe src="https://www.twitch.tv/embed/${streamerName}/chat?parent=${window.location.hostname}&darkpopout" width="100%" height="100%" frameborder="0"></iframe>
    `;

    this.container.appendChild(videoContainer);
    this.container.appendChild(chatContainer);
    target.appendChild(this.container);

    // Initialize custom UI
    const controls = createCustomControls(videoContainer, video, streamerName, quality, chatContainer, () => this.unmount());
    this.controlsCleanup = controls.cleanup;

    // Trigger animation
    requestAnimationFrame(() => {
      if (this.container) this.container.classList.add('active');
    });

    // Attach HLS logic
    this.videoCoreCleanup = attachVideo(video, streamerName, loader, errorMsg);

    this.startBaseVideoKiller();
  }

  private startBaseVideoKiller() {
    this.baseVideoInterval = window.setInterval(() => {
      const allVideos = document.querySelectorAll('video');
      allVideos.forEach(vid => {
        if (vid === this.videoElement) return; // Skip our own player

        if (!this.originalStates.has(vid)) {
          this.originalStates.set(vid, { muted: vid.muted, paused: vid.paused });
        }

        try {
          if (!vid.paused) vid.pause();
          if (!vid.muted) vid.muted = true;
        } catch(e) {}
      });
    }, 1000); // Re-check every second in case Twitch tries to unpause it
  }

  public unmount() {
    if (this.videoCoreCleanup) {
      this.videoCoreCleanup();
      this.videoCoreCleanup = null;
    }

    if (this.videoElement && this.adBlockCallback) {
      this.videoElement.removeEventListener('twitch-ad-blocked', this.adBlockCallback);
      this.videoElement = null;
      this.adBlockCallback = null;
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
        } catch(e) {}
      });
      this.originalStates.clear();
    }

    if (this.container) {
      this.container.classList.remove('active');
      // Wait for fade out
      setTimeout(() => {
        if (this.container) {
          this.container.remove();
          this.container = null;
        }
      }, 300);
    }

    // Notify background script
    chrome.runtime.sendMessage({ action: 'PLAYER_CLOSED' });
  }
}

export const playerInstance = new PlayerContainer();
