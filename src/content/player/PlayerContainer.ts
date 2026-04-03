import './player.css';
import { attachVideo, VideoController } from './VideoCore';
import { createCustomControls } from './ControlsUI';
import { TwitchChat } from './TwitchChat';
import { ChannelPointsClaimer } from './ChannelPointsClaimer';
import { ToastManager } from './ToastManager';
import { ThemeManager } from './ThemeManager';

export class PlayerContainer {
  private container: HTMLDivElement | null = null;
  private videoController: VideoController | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private adBlockCallback: (() => void) | null = null;
  private baseVideoInterval: number | null = null;
  private controlsCleanup: (() => void) | null = null;
  private originalStates = new Map<HTMLVideoElement, { muted: boolean; paused: boolean }>();
  private observer: IntersectionObserver | null = null;
  private twitchChat: TwitchChat | null = null;
  private channelPointsClaimer: ChannelPointsClaimer | null = null;
  private toastManager: ToastManager | null = null;
  private toastHandler: ((e: Event) => void) | null = null;
  private dragCleanup: (() => void) | null = null;
  private themeManager: ThemeManager | null = null;

  public mount(streamerName: string, volume: number = 50, quality: string = 'auto') {
    if (this.container) {
      this.unmount();
    }

    const playerSelectors = [
      '.video-player__container',
      '.highwind-video-player',
      '[data-a-target="player-container"]',
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

    // Chat Container — IRC chat sidebar
    const chatContainer = document.createElement('div');
    chatContainer.className = 'chat-container';
    chatContainer.id = 'kreo-irc-chat';

    // Check if chat should be initially hidden
    chrome.storage.sync.get(['chatEnabled'], (data) => {
      if (data.chatEnabled === false) {
        chatContainer.classList.add('hidden');
      }
    });

    // Mini drag handle (title bar area)
    const miniDragBar = document.createElement('div');
    miniDragBar.className = 'mini-drag-bar';

    // Mini Close Button
    const miniClose = document.createElement('button');
    miniClose.className = 'mini-close-btn';
    miniClose.innerText = 'Close Mini';
    miniClose.onclick = (e) => {
      e.stopPropagation();
      this.container?.classList.remove('mini-mode');
    };

    // Mini resize handle
    const miniResize = document.createElement('div');
    miniResize.className = 'mini-resize-handle';

    this.container.appendChild(videoContainer);
    this.container.appendChild(chatContainer);
    this.container.appendChild(miniDragBar);
    this.container.appendChild(miniClose);
    this.container.appendChild(miniResize);
    target.appendChild(this.container);

    // Setup mini-player drag & resize
    this.setupMiniDragResize(miniDragBar, miniResize);

    // Attach HLS logic (returns controller)
    this.videoController = attachVideo(video, streamerName, loader, errorMsg);

    // Initialize custom controls with the video controller
    const controls = createCustomControls(
      videoContainer,
      video,
      streamerName,
      quality,
      chatContainer,
      () => this.unmount(),
      this.videoController
    );
    this.controlsCleanup = controls.cleanup;

    // Initialize Toast Manager
    this.toastManager = new ToastManager(videoContainer);
    this.toastHandler = ((e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && this.toastManager) {
        this.toastManager.show(detail.message, detail.type || 'info');
      }
    });
    video.addEventListener('twitch-show-toast', this.toastHandler);

    // Initialize Theme Manager
    this.themeManager = new ThemeManager(this.container);
    this.themeManager.loadAndApply();

    // Trigger animation
    requestAnimationFrame(() => {
      if (this.container) this.container.classList.add('active');
    });

    // Initialize IRC Chat
    this.twitchChat = new TwitchChat(streamerName, chatContainer);
    this.twitchChat.connect();

    // Initialize Channel Points Claimer
    chrome.storage.sync.get(['autoClaimPoints'], (data) => {
      const enabled = data.autoClaimPoints !== false;
      this.channelPointsClaimer = new ChannelPointsClaimer(enabled);
      this.channelPointsClaimer.start();
    });

    // Setup Sticky Mini-mode Observer
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio < 0.1) {
            this.container?.classList.add('mini-mode');
          } else if (entry.intersectionRatio > 0.5) {
            this.container?.classList.remove('mini-mode');
          }
        });
      },
      { threshold: [0.1, 0.5] }
    );

    this.observer.observe(target);

    this.startBaseVideoKiller();
  }

  private setupMiniDragResize(dragBar: HTMLElement, resizeHandle: HTMLElement) {
    if (!this.container) return;
    const host = this.container;

    // Load persisted position/size
    chrome.storage.sync.get(['miniPlayerPos'], (data) => {
      if (data.miniPlayerPos) {
        const { x, y, w, h } = data.miniPlayerPos;
        host.style.setProperty('--mini-x', `${x}px`);
        host.style.setProperty('--mini-y', `${y}px`);
        if (w) host.style.setProperty('--mini-w', `${w}px`);
        if (h) host.style.setProperty('--mini-h', `${h}px`);
      }
    });

    // Drag
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const onDragStart = (e: MouseEvent) => {
      if (!host.classList.contains('mini-mode')) return;
      isDragging = true;
      dragOffsetX = e.clientX - host.getBoundingClientRect().left;
      dragOffsetY = e.clientY - host.getBoundingClientRect().top;
      e.preventDefault();
    };

    const onDragMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const x = e.clientX - dragOffsetX;
      const y = e.clientY - dragOffsetY;
      host.style.setProperty('--mini-x', `${x}px`);
      host.style.setProperty('--mini-y', `${y}px`);
      host.classList.add('mini-dragged');
    };

    const onDragEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      // Persist position
      const rect = host.getBoundingClientRect();
      chrome.storage.sync.set({
        miniPlayerPos: {
          x: rect.left,
          y: rect.top,
          w: rect.width,
          h: rect.height,
        },
      });
    };

    // Resize
    let isResizing = false;
    let resizeStartX = 0;
    let resizeStartY = 0;
    let startW = 0;
    let startH = 0;

    const onResizeStart = (e: MouseEvent) => {
      if (!host.classList.contains('mini-mode')) return;
      isResizing = true;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      const rect = host.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      e.preventDefault();
      e.stopPropagation();
    };

    const onResizeMove = (e: MouseEvent) => {
      if (!isResizing) return;
      // Resize from top-left corner (mini-player is anchored bottom-right by default)
      const dw = resizeStartX - e.clientX;
      const dh = resizeStartY - e.clientY;
      const newW = Math.max(280, startW + dw);
      const newH = Math.max(158, startH + dh);
      host.style.setProperty('--mini-w', `${newW}px`);
      host.style.setProperty('--mini-h', `${newH}px`);
      host.classList.add('mini-dragged');
    };

    const onResizeEnd = () => {
      if (!isResizing) return;
      isResizing = false;
      const rect = host.getBoundingClientRect();
      chrome.storage.sync.set({
        miniPlayerPos: {
          x: rect.left,
          y: rect.top,
          w: rect.width,
          h: rect.height,
        },
      });
    };

    dragBar.addEventListener('mousedown', onDragStart);
    resizeHandle.addEventListener('mousedown', onResizeStart);
    window.addEventListener('mousemove', (e) => { onDragMove(e); onResizeMove(e); });
    window.addEventListener('mouseup', () => { onDragEnd(); onResizeEnd(); });

    this.dragCleanup = () => {
      dragBar.removeEventListener('mousedown', onDragStart);
      resizeHandle.removeEventListener('mousedown', onResizeStart);
    };
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

    if (this.dragCleanup) {
      this.dragCleanup();
      this.dragCleanup = null;
    }

    this.themeManager = null;

    if (this.toastManager) {
      this.toastManager.destroy();
      this.toastManager = null;
    }

    if (this.videoElement && this.toastHandler) {
      this.videoElement.removeEventListener('twitch-show-toast', this.toastHandler);
      this.toastHandler = null;
    }

    if (this.channelPointsClaimer) {
      this.channelPointsClaimer.destroy();
      this.channelPointsClaimer = null;
    }

    if (this.twitchChat) {
      this.twitchChat.destroy();
      this.twitchChat = null;
    }

    if (this.videoController) {
      this.videoController.cleanup();
      this.videoController = null;
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
        } catch {
          // Ignore
        }
      });
      this.originalStates.clear();
    }

    if (this.container) {
      this.container.classList.remove('active');
      this.container.classList.remove('mini-mode');
      setTimeout(() => {
        if (this.container) {
          this.container.remove();
          this.container = null;
        }
      }, 300);
    }

    // Notify background script
    try {
      chrome.runtime.sendMessage({ action: 'PLAYER_CLOSED' });
    } catch {
      // Context may be invalidated
    }
  }
}

export const playerInstance = new PlayerContainer();
