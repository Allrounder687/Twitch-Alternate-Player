/**
 * PublicAPI — Exposes window.__twitchAltPlayer for external extensions/scripts.
 * Dispatches CustomEvents on document for lifecycle and state changes.
 */

import type { VideoController } from './VideoCore';

interface StreamInfo {
  channel: string;
  quality: string;
  latency: number;
  resolution: string;
}

type EventCallback = (...args: any[]) => void;

interface TwitchAltPlayerAPI {
  version: string;
  getVideoElement(): HTMLVideoElement | null;
  getVolume(): number;
  setVolume(v: number): void;
  getQuality(): string;
  setQuality(q: string): void;
  isPlaying(): boolean;
  getStreamInfo(): StreamInfo;
  on(event: string, cb: EventCallback): void;
  off(event: string, cb: EventCallback): void;
}

declare global {
  interface Window {
    __twitchAltPlayer?: TwitchAltPlayerAPI;
  }
}

const EVENT_PREFIX = 'twitch-alt-player:';

export class PublicAPI {
  private videoElement: HTMLVideoElement;
  private videoController: VideoController;
  private channel: string;
  private listeners = new Map<string, Set<EventCallback>>();
  private boundHandlers: Array<{ target: EventTarget; event: string; handler: EventListener }> = [];

  constructor(videoElement: HTMLVideoElement, videoController: VideoController, channel: string) {
    this.videoElement = videoElement;
    this.videoController = videoController;
    this.channel = channel;
  }

  init(): void {
    const api: TwitchAltPlayerAPI = {
      version: '2.0.0',

      getVideoElement: () => this.videoElement,

      getVolume: () => this.videoElement.muted ? 0 : this.videoElement.volume,

      setVolume: (v: number) => {
        const clamped = Math.max(0, Math.min(1, v));
        this.videoElement.volume = clamped;
        this.videoElement.muted = clamped === 0;
        this.dispatch('volume-change', { volume: clamped });
      },

      getQuality: () => {
        const hls = this.videoController.getHlsInstance();
        if (!hls) return 'unknown';
        if (hls.currentLevel === -1) return 'auto';
        const levels = this.videoController.getQualityLevels();
        const current = levels.find(l => l.index === hls.currentLevel);
        return current?.name || 'unknown';
      },

      setQuality: (q: string) => {
        if (q === 'auto') {
          this.videoController.setQuality(-1);
        } else {
          const levels = this.videoController.getQualityLevels();
          const match = levels.find(l => l.name === q || `${l.height}p` === q);
          if (match) {
            this.videoController.setQuality(match.index);
          }
        }
        this.dispatch('quality-change', { quality: q });
      },

      isPlaying: () => !this.videoElement.paused,

      getStreamInfo: () => {
        const stats = this.videoController.getStats();
        const hls = this.videoController.getHlsInstance();
        let quality = 'auto';
        if (hls && hls.currentLevel >= 0) {
          const levels = this.videoController.getQualityLevels();
          const current = levels.find(l => l.index === hls.currentLevel);
          quality = current?.name || 'auto';
        }
        return {
          channel: this.channel,
          quality,
          latency: stats.latency,
          resolution: stats.resolution,
        };
      },

      on: (event: string, cb: EventCallback) => {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(cb);
      },

      off: (event: string, cb: EventCallback) => {
        this.listeners.get(event)?.delete(cb);
      },
    };

    window.__twitchAltPlayer = api;

    // Wire up video element events to dispatch API events
    this.addHandler(this.videoElement, 'play', () => {
      this.dispatch('play');
    });

    this.addHandler(this.videoElement, 'pause', () => {
      this.dispatch('pause');
    });

    this.addHandler(this.videoElement, 'volumechange', () => {
      this.dispatch('volume-change', {
        volume: this.videoElement.muted ? 0 : this.videoElement.volume,
      });
    });

    // Dispatch ready and mount events
    this.dispatch('ready');
    this.dispatch('mount', { channel: this.channel });
  }

  private addHandler(target: EventTarget, event: string, handler: EventListener): void {
    target.addEventListener(event, handler);
    this.boundHandlers.push({ target, event, handler });
  }

  private dispatch(eventName: string, detail?: any): void {
    // Dispatch on document as CustomEvent
    document.dispatchEvent(new CustomEvent(`${EVENT_PREFIX}${eventName}`, {
      detail: detail || {},
    }));

    // Notify registered listeners
    const cbs = this.listeners.get(eventName);
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(detail || {});
        } catch {
          // Don't let external callbacks break us
        }
      }
    }
  }

  destroy(): void {
    // Dispatch unmount before cleanup
    this.dispatch('unmount', { channel: this.channel });

    // Remove all event handlers
    for (const { target, event, handler } of this.boundHandlers) {
      target.removeEventListener(event, handler);
    }
    this.boundHandlers = [];
    this.listeners.clear();

    // Clean up global
    delete window.__twitchAltPlayer;
  }
}
