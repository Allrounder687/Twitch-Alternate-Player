import Hls from 'hls.js';
import { StatsOverlay } from './StatsOverlay';
import { ClipRecorder } from './ClipRecorder';

export interface QualityLevel {
  index: number;
  label: string;
  height: number;
  bitrate: number;
  fps: number;
}

export interface VideoInstance {
  cleanup: () => void;
  getHls: () => Hls | null;
  getQualities: () => QualityLevel[];
  setQuality: (label: string) => void;
  setLowLatency: (enabled: boolean) => void;
  setAudioOnly: (enabled: boolean) => void;
  stats: StatsOverlay;
  clipRecorder: ClipRecorder;
}

/**
 * Sends a message to the background script with retry logic for MV3 service worker lifecycle.
 */
function sendMessageWithRetry(
  msg: any,
  maxRetries = 3,
  delay = 500
): Promise<any> {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const tryOnce = () => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        reject(new Error('Extension context invalidated'));
        return;
      }

      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) {
          attempt++;
          if (attempt < maxRetries) {
            setTimeout(tryOnce, delay * attempt);
          } else {
            reject(new Error(chrome.runtime.lastError.message));
          }
        } else {
          resolve(res || { error: 'No response from background script' });
        }
      });
    };

    tryOnce();
  });
}

/**
 * Initializes HLS.js on the provided video element, fetches the M3U8 list
 * via the background script, and handles playback errors.
 */
export function attachVideo(
  videoElement: HTMLVideoElement,
  videoContainer: HTMLElement,
  streamerName: string,
  loaderElement: HTMLElement,
  errorElement: HTMLElement
): VideoInstance {
  let hlsInstance: Hls | null = null;
  let isDestroyed = false;
  let currentQualities: QualityLevel[] = [];
  let lowLatencyEnabled = false;
  let audioOnlyMode = false;
  let watchdogInterval: number | null = null;

  const stats = new StatsOverlay(videoContainer, videoElement);
  const clipRecorder = new ClipRecorder(videoElement);

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

  const buildQualities = (levels: any[]): QualityLevel[] => {
    const q: QualityLevel[] = [{ index: -1, label: 'Auto', height: 0, bitrate: 0, fps: 0 }];
    levels.forEach((l, idx) => {
      const fps = Math.round(l.attrs?.['FRAME-RATE'] || (l as any).frameRate || 0);
      const h = l.height || 0;
      let label: string;
      if (h === 0 || l.bitrate < 200000) {
        label = 'Audio Only';
      } else {
        label = fps > 30 ? `${h}p${fps}` : `${h}p`;
      }
      q.push({ index: idx, label, height: h, bitrate: l.bitrate, fps });
    });
    // Sort by bitrate descending, Audio Only last, Auto first
    q.sort((a, b) => {
      if (a.index === -1) return -1;
      if (b.index === -1) return 1;
      if (a.label === 'Audio Only') return 1;
      if (b.label === 'Audio Only') return -1;
      return b.bitrate - a.bitrate;
    });
    return q;
  };

  const initStream = async () => {
    try {
      const response = await sendMessageWithRetry({
        action: 'GET_STREAM_URL',
        streamerName,
      });

      if (response.error) throw new Error(response.error);
      if (!response.url) throw new Error('Failed to retrieve stream URL');
      if (isDestroyed) return;

      const mediaSourceUrl = response.url;

      // Load low-latency setting
      try {
        const settings = await sendMessageWithRetry({ action: 'GET_SETTINGS' });
        lowLatencyEnabled = !!settings?.lowLatency;
      } catch {
        // Use default
      }

      if (Hls.isSupported()) {
        // Ad-filtering playlist loader
        class AdBypassPlaylistLoader extends Hls.DefaultConfig.loader {
          constructor(config: any) {
            super(config);
            const load = this.load.bind(this);
            this.load = function (...args: any[]) {
              const callbacks = args[2];
              if (callbacks && callbacks.onSuccess) {
                const onSuccess = callbacks.onSuccess;
                callbacks.onSuccess = function (
                  response: any,
                  stats: any,
                  context: any,
                  networkDetails: any
                ) {
                  if (response.data && typeof response.data === 'string') {
                    if (response.data.includes('#EXT-X-TWITCH-AD')) {
                      response.data = response.data.replace(/#EXT-X-TWITCH-AD.*?\n.*?\n/g, '');
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

        const hlsConfig: Partial<Hls['config']> = {
          maxLiveSyncPlaybackRate: 1.5,
          liveSyncDurationCount: lowLatencyEnabled ? 2 : 3,
          liveMaxLatencyDurationCount: lowLatencyEnabled ? 5 : 10,
          lowLatencyMode: lowLatencyEnabled,
          pLoader: AdBypassPlaylistLoader as any,
        };

        hlsInstance = new Hls(hlsConfig as any);
        stats.attachHls(hlsInstance);

        hlsInstance.loadSource(mediaSourceUrl);
        hlsInstance.attachMedia(videoElement);

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          if (isDestroyed) return;
          hideLoader();

          currentQualities = buildQualities(data.levels);

          // Dispatch quality list to controls
          videoContainer.dispatchEvent(
            new CustomEvent('qualities-parsed', { detail: currentQualities })
          );

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

          // Apply audio-only if set
          if (audioOnlyMode && hlsInstance) {
            const audioIdx = data.levels.findIndex(
              (l) => l.height === 0 || l.bitrate < 200000
            );
            if (audioIdx !== -1) hlsInstance.currentLevel = audioIdx;
          }

          videoElement.play().catch(() => {
            videoElement.muted = true;
            videoElement.play().catch((e) =>
              console.warn('[Alt Player] Autoplay failed even muted:', e)
            );
          });

          // Start clip recorder after playback begins
          clipRecorder.start();
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
                hlsInstance?.destroy();
                showError('Stream failed to load (Fatal Error).');
                break;
            }
          }
        });
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.src = mediaSourceUrl;
        videoElement.addEventListener('loadedmetadata', () => {
          hideLoader();
          videoElement.play().catch(() => {
            videoElement.muted = true;
            videoElement.play().catch((e) =>
              console.warn('[Alt Player] Autoplay fallback failed:', e)
            );
          });
        });
      } else {
        showError('Your browser does not support HLS stream playback.');
      }

      // Watchdog: detect stream freezes
      let lastTime = -1;
      let freezeCount = 0;
      watchdogInterval = window.setInterval(() => {
        if (isDestroyed) {
          window.clearInterval(watchdogInterval!);
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

  // Start initialization
  initStream();

  const instance: VideoInstance = {
    cleanup: () => {
      isDestroyed = true;
      clipRecorder.destroy();
      stats.destroy();
      if (watchdogInterval !== null) window.clearInterval(watchdogInterval);
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
      videoElement.src = '';
      videoElement.load();
    },

    getHls: () => hlsInstance,
    getQualities: () => currentQualities,

    setQuality: (label: string) => {
      if (!hlsInstance) return;
      const q = currentQualities.find((q) => q.label === label);
      if (q) {
        hlsInstance.currentLevel = q.index;
        audioOnlyMode = label === 'Audio Only';
        chrome.storage.local.set({ lastQuality: label });
      }
    },

    setLowLatency: (enabled: boolean) => {
      lowLatencyEnabled = enabled;
      chrome.storage.local.set({ lowLatency: enabled });
      if (hlsInstance) {
        (hlsInstance.config as any).lowLatencyMode = enabled;
        hlsInstance.config.liveSyncDurationCount = enabled ? 2 : 3;
        hlsInstance.config.liveMaxLatencyDurationCount = enabled ? 5 : 10;
      }
    },

    setAudioOnly: (enabled: boolean) => {
      audioOnlyMode = enabled;
      if (!hlsInstance || !hlsInstance.levels) return;
      if (enabled) {
        const audioIdx = hlsInstance.levels.findIndex(
          (l) => l.height === 0 || l.bitrate < 200000
        );
        hlsInstance.currentLevel = audioIdx !== -1 ? audioIdx : 0;
      } else {
        hlsInstance.currentLevel = -1; // Back to auto
      }
    },

    stats,
    clipRecorder,
  };

  return instance;
}
