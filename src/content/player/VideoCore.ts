import Hls from 'hls.js';
import { sendMessageWithRetry } from '../index';

export interface HlsQualityLevel {
  height: number;
  width: number;
  bitrate: number;
  name: string;
  index: number;
}

export interface StreamStats {
  resolution: string;
  bitrate: number;
  droppedFrames: number;
  bufferLength: number;
  latency: number;
  fps: number;
}

/**
 * Initializes HLS.js on the provided video element, fetches the M3U8 list
 * via the background script, and handles playback errors.
 * Returns a controller object for quality, stats, clips, and cleanup.
 */
export function attachVideo(
  videoElement: HTMLVideoElement,
  streamerName: string,
  loaderElement: HTMLElement,
  errorElement: HTMLElement
): VideoController {
  let hlsInstance: Hls | null = null;
  let isDestroyed = false;
  let watchdogInterval: number | null = null;

  // Clip recording state
  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];
  let clipStream: MediaStream | null = null;
  const CLIP_DURATION = 30_000; // 30 seconds

  // Parsed quality levels
  let qualityLevels: HlsQualityLevel[] = [];
  const qualityListeners: Array<(levels: HlsQualityLevel[]) => void> = [];
  const statsListeners: Array<(stats: StreamStats) => void> = [];
  let statsInterval: number | null = null;

  const showError = (msg: string) => {
    if (isDestroyed) return;
    loaderElement.classList.remove('active');
    errorElement.innerText = msg;
    errorElement.classList.add('active');
  };

  const hideLoader = () => {
    if (isDestroyed) return;
    loaderElement.classList.remove('active');
  };

  const getStats = (): StreamStats => {
    const stats: StreamStats = {
      resolution: '—',
      bitrate: 0,
      droppedFrames: 0,
      bufferLength: 0,
      latency: 0,
      fps: 0,
    };

    if (hlsInstance) {
      const level = hlsInstance.levels?.[hlsInstance.currentLevel];
      if (level) {
        stats.resolution = `${level.width}x${level.height}`;
        stats.bitrate = level.bitrate;
        stats.fps = level.attrs?.['FRAME-RATE'] ? parseFloat(level.attrs['FRAME-RATE'] as string) : 0;
      }

      // Buffer length
      if (videoElement.buffered.length > 0) {
        const end = videoElement.buffered.end(videoElement.buffered.length - 1);
        stats.bufferLength = Math.max(0, end - videoElement.currentTime);
      }

      // Latency (edge - current position)
      if (hlsInstance.latency !== undefined) {
        stats.latency = hlsInstance.latency;
      }
    }

    // Dropped frames from video element
    const quality = (videoElement as any).getVideoPlaybackQuality?.();
    if (quality) {
      stats.droppedFrames = quality.droppedVideoFrames || 0;
    }

    return stats;
  };

  const initStream = async () => {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        throw new Error('Extension context invalidated');
      }

      const response: { url?: string; error?: string } = await sendMessageWithRetry({
        action: 'GET_STREAM_URL',
        streamerName,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.url) {
        throw new Error('Failed to retrieve stream URL');
      }

      if (isDestroyed) return;

      const mediaSourceUrl = response.url;

      // Load low-latency preference
      const settings = await new Promise<Record<string, any>>((resolve) => {
        chrome.storage.sync.get(['lowLatency'], (data) => {
          resolve(data);
        });
      });
      const lowLatency = settings.lowLatency !== false; // default true

      if (Hls.isSupported()) {
        // Ad bypass playlist loader
        class AdBypassPlaylistLoader extends Hls.DefaultConfig.loader {
          constructor(config: any) {
            super(config);
            const load = this.load.bind(this);
            this.load = function (...args: any[]) {
              const callbacks = args[2];
              if (callbacks?.onSuccess) {
                const onSuccess = callbacks.onSuccess;
                callbacks.onSuccess = function (
                  response: any,
                  stats: any,
                  context: any,
                  networkDetails: any
                ) {
                  if (response.data && typeof response.data === 'string') {
                    if (response.data.includes('#EXT-X-TWITCH-AD')) {
                      console.log('[AdBypass] Filtered ad segment from playlist');
                      response.data = response.data.replace(/#EXT-X-TWITCH-AD.*?\n.*?\n/g, '');
                      videoElement.dispatchEvent(new CustomEvent('twitch-ad-blocked'));
                    }
                  }
                  onSuccess(response, stats, context, networkDetails);
                };
              }
              // @ts-ignore
              load(...args);
            };
          }
        }

        const hlsConfig: Partial<typeof Hls.DefaultConfig> = {
          maxLiveSyncPlaybackRate: 1.5,
          pLoader: AdBypassPlaylistLoader as any,
          // Low-latency settings
          ...(lowLatency
            ? {
                liveSyncDurationCount: 2,
                liveMaxLatencyDurationCount: 5,
                lowLatencyMode: true,
                backBufferLength: 30,
              }
            : {
                liveSyncDurationCount: 5,
                liveMaxLatencyDurationCount: 15,
              }),
        };

        hlsInstance = new Hls(hlsConfig);

        hlsInstance.loadSource(mediaSourceUrl);
        hlsInstance.attachMedia(videoElement);

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          if (isDestroyed) return;
          hideLoader();

          // Parse quality levels
          qualityLevels = data.levels.map((l, index) => ({
            height: l.height,
            width: l.width,
            bitrate: l.bitrate,
            name: buildQualityName(l),
            index,
          }));

          // Notify listeners
          for (const cb of qualityListeners) cb(qualityLevels);

          // Start at highest quality
          let highestLevel = -1;
          let maxHeight = 0;
          data.levels.forEach((l, index) => {
            if (l.height > maxHeight) {
              maxHeight = l.height;
              highestLevel = index;
            }
          });

          if (highestLevel !== -1 && hlsInstance) {
            hlsInstance.startLevel = highestLevel;
            hlsInstance.nextLoadLevel = highestLevel;
          }

          videoElement.play().catch(() => {
            videoElement.muted = true;
            videoElement.play().catch((e) => console.warn('[Alt Player] Autoplay failed:', e?.message || String(e)));
          });
        });

        hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('[Alt Player] Fatal network error, recovering...');
                hlsInstance?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('[Alt Player] Fatal media error, recovering...');
                hlsInstance?.recoverMediaError();
                break;
              default:
                console.error('[Alt Player] Fatal error:', JSON.stringify({ type: data.type, details: data.details }));
                hlsInstance?.destroy();
                showError('Stream failed to load (Fatal Error).');
                break;
            }
          }
        });

        // Stats polling
        statsInterval = window.setInterval(() => {
          if (isDestroyed) return;
          const stats = getStats();
          for (const cb of statsListeners) cb(stats);
        }, 1000);
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.src = mediaSourceUrl;
        videoElement.addEventListener('loadedmetadata', () => {
          hideLoader();
          videoElement.play().catch(() => {
            videoElement.muted = true;
            videoElement.play().catch((e) => console.warn('[Alt Player] Autoplay fallback failed:', e?.message || String(e)));
          });
        });
      } else {
        showError('Your browser does not support HLS stream playback.');
      }

      // Auto-Freeze Recovery (Watchdog)
      let lastTime = -1;
      let freezeCount = 0;
      watchdogInterval = window.setInterval(() => {
        if (isDestroyed) {
          if (watchdogInterval) window.clearInterval(watchdogInterval);
          return;
        }

        if (!videoElement.paused && !videoElement.seeking) {
          if (videoElement.currentTime === lastTime) {
            freezeCount++;
            if (freezeCount > 4) {
              console.warn('[Alt Player] Stream freeze detected, recovering...');
              if (hlsInstance) {
                hlsInstance.recoverMediaError();
              } else {
                videoElement.load();
                videoElement.play().catch(() => {});
              }
              freezeCount = 0;
            }
          } else {
            freezeCount = 0;
            lastTime = videoElement.currentTime;
          }
        }
      }, 1000);
    } catch (err: any) {
      console.error('[Alt Player] Stream init error:', err?.message || String(err));
      showError(err?.message || 'Error occurred loading the stream.');
    }
  };

  const setQualityHandler = ((e: CustomEvent) => {
    if (!hlsInstance) return;
    const requested = e.detail;

    if (!hlsInstance.levels || hlsInstance.levels.length === 0) {
      hlsInstance.once(Hls.Events.MANIFEST_PARSED, () => {
        videoElement.dispatchEvent(new CustomEvent('twitch-set-quality', { detail: requested }));
      });
      return;
    }

    if (requested === 'auto') {
      hlsInstance.currentLevel = -1;
    } else if (requested === 'audio_only') {
      const idx = hlsInstance.levels.findIndex(
        (l) =>
          (l.attrs && (l.attrs as any).NAME === 'Audio Only') ||
          l.height === 0 ||
          l.bitrate < 200000
      );
      hlsInstance.currentLevel = idx !== -1 ? idx : 0;
    } else {
      const heightMatch = requested.match(/^(\d+)p/);
      if (heightMatch) {
        const height = parseInt(heightMatch[1]);
        const idx = hlsInstance.levels.findIndex((l) => l.height === height);
        hlsInstance.currentLevel = idx !== -1 ? idx : -1;
      }
    }
  }) as EventListener;

  videoElement.addEventListener('twitch-set-quality', setQualityHandler);

  // Start initialization
  initStream();

  // Build controller object
  const controller: VideoController = {
    getHlsInstance: () => hlsInstance,

    setQuality: (level: number) => {
      if (hlsInstance) {
        hlsInstance.currentLevel = level;
      }
    },

    getQualityLevels: () => qualityLevels,

    onQualityLevelsReady: (cb) => {
      qualityListeners.push(cb);
      if (qualityLevels.length > 0) cb(qualityLevels);
    },

    onStats: (cb) => {
      statsListeners.push(cb);
    },

    getStats,

    startClip: (): Promise<Blob | null> => {
      return new Promise((resolve) => {
        try {
          // Capture from video element using captureStream
          clipStream = (videoElement as any).captureStream?.() || (videoElement as any).mozCaptureStream?.();
          if (!clipStream) {
            console.warn('[Alt Player] captureStream not available');
            resolve(null);
            return;
          }

          recordedChunks = [];
          mediaRecorder = new MediaRecorder(clipStream, {
            mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
              ? 'video/webm;codecs=vp9'
              : 'video/webm',
          });

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
          };

          mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            recordedChunks = [];
            mediaRecorder = null;
            clipStream = null;
            resolve(blob);
          };

          mediaRecorder.onerror = () => {
            recordedChunks = [];
            mediaRecorder = null;
            clipStream = null;
            resolve(null);
          };

          mediaRecorder.start(1000); // Collect data every 1s

          // Auto-stop after CLIP_DURATION
          setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, CLIP_DURATION);
        } catch (err) {
          console.error('[Alt Player] Clip recording error:', err);
          resolve(null);
        }
      });
    },

    stopClip: () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    },

    isRecording: () => mediaRecorder !== null && mediaRecorder.state === 'recording',

    setLowLatency: (enabled: boolean) => {
      if (!hlsInstance) return;
      hlsInstance.config.liveSyncDurationCount = enabled ? 2 : 5;
      hlsInstance.config.liveMaxLatencyDurationCount = enabled ? 5 : 15;
      (hlsInstance.config as any).lowLatencyMode = enabled;
      chrome.storage.sync.set({ lowLatency: enabled });
    },

    cleanup: () => {
      videoElement.removeEventListener('twitch-set-quality', setQualityHandler);
      isDestroyed = true;
      qualityListeners.length = 0;
      statsListeners.length = 0;
      if (statsInterval) window.clearInterval(statsInterval);
      if (watchdogInterval) window.clearInterval(watchdogInterval);
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
      videoElement.src = '';
      videoElement.load();
    },
  };

  return controller;
}

function buildQualityName(level: { height: number; bitrate: number; attrs?: Record<string, any> }): string {
  if (level.attrs?.NAME) return level.attrs.NAME as string;
  if (level.height === 0 || level.bitrate < 200000) return 'Audio Only';
  const fps = level.attrs?.['FRAME-RATE'] ? Math.round(parseFloat(level.attrs['FRAME-RATE'] as string)) : 0;
  return `${level.height}p${fps > 30 ? fps : ''}`;
}

export interface VideoController {
  getHlsInstance: () => Hls | null;
  setQuality: (level: number) => void;
  getQualityLevels: () => HlsQualityLevel[];
  onQualityLevelsReady: (cb: (levels: HlsQualityLevel[]) => void) => void;
  onStats: (cb: (stats: StreamStats) => void) => void;
  getStats: () => StreamStats;
  startClip: () => Promise<Blob | null>;
  stopClip: () => void;
  isRecording: () => boolean;
  setLowLatency: (enabled: boolean) => void;
  cleanup: () => void;
}
