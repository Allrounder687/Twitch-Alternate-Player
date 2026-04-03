import Hls from 'hls.js';

/**
 * Initializes HLS.js on the provided video element, fetches the M3U8 list
 * via the background script, and handles playback errors.
 */
export function attachVideo(
  videoElement: HTMLVideoElement,
  streamerName: string,
  loaderElement: HTMLElement,
  errorElement: HTMLElement
): () => void {
  let hlsInstance: Hls | null = null;
  let isDestroyed = false;

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

  const initStream = async () => {
    try {
      // 1. Request Stream URL from Background Script
      const response: { url?: string, error?: string } = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'GET_STREAM_URL', streamerName },
          (res) => resolve(res || { error: 'No response from background script' })
        );
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.url) {
        throw new Error('Failed to retrieve stream URL');
      }

      if (isDestroyed) return;

      const mediaSourceUrl = response.url;

      // 2. Attach HLS or Native playback
      if (Hls.isSupported()) {
        // METHOD 2: Manifest Filtering
        // Intercept playlist loads to strip out Twitch Ad Segments
        class AdBypassPlaylistLoader extends Hls.DefaultConfig.loader {
          constructor(config: any) {
            super(config);
            const load = this.load.bind(this);
            this.load = function(...args: any[]) {
              const callbacks = args[2];
              if (callbacks && callbacks.onSuccess) {
                const onSuccess = callbacks.onSuccess;
                callbacks.onSuccess = function(response: any, stats: any, context: any, networkDetails: any) {
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

        hlsInstance = new Hls({
          maxLiveSyncPlaybackRate: 1.5,
          pLoader: AdBypassPlaylistLoader as any,
        });

        hlsInstance.loadSource(mediaSourceUrl);
        hlsInstance.attachMedia(videoElement);

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!isDestroyed) {
            hideLoader();
            videoElement.play().catch(e => console.error("Auto-play prevented", e));
          }
        });

        hlsInstance.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Fatal network error encountered, try to recover');
                hlsInstance?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Fatal media error encountered, try to recover');
                hlsInstance?.recoverMediaError();
                break;
              default:
                // Cannot recover
                hlsInstance?.destroy();
                showError('Stream failed to load (Fatal Error).');
                break;
            }
          }
        });
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Fallback for Safari natively supporting HLS
        videoElement.src = mediaSourceUrl;
        videoElement.addEventListener('loadedmetadata', () => {
          hideLoader();
          videoElement.play().catch(e => console.error("Auto-play prevented", e));
        });
      } else {
        showError('Your browser does not support HLS stream playback.');
      }
    } catch (err: any) {
      console.error("Stream init error:", err);
      showError(err.message || 'Error occurred loading the stream.');
    }
  };

  const setQualityHandler = ((e: CustomEvent) => {
    if (!hlsInstance) return;
    const requested = e.detail;

    // Await levels to be parsed if not yet
    if (!hlsInstance.levels || hlsInstance.levels.length === 0) {
      hlsInstance.once(Hls.Events.MANIFEST_PARSED, () => {
        videoElement.dispatchEvent(new CustomEvent('twitch-set-quality', { detail: requested }));
      });
      return;
    }

    if (requested === 'auto') {
      hlsInstance.currentLevel = -1;
    } else if (requested === 'audio_only') {
      const idx = hlsInstance.levels.findIndex(l => 
        (l.attrs && (l.attrs as any).NAME === 'Audio Only') || l.height === 160 || l.height === 0 || l.bitrate < 200000
      );
      hlsInstance.currentLevel = idx !== -1 ? idx : 0;
    } else {
      const heightMatch = requested.match(/^(\d+)p/);
      if (heightMatch) {
         const height = parseInt(heightMatch[1]);
         const idx = hlsInstance.levels.findIndex(l => l.height === height);
         hlsInstance.currentLevel = idx !== -1 ? idx : -1;
      }
    }
  }) as EventListener;

  videoElement.addEventListener('twitch-set-quality', setQualityHandler);

  // Start initialization
  initStream();

  // Return cleanup function
  return () => {
    videoElement.removeEventListener('twitch-set-quality', setQualityHandler);
    isDestroyed = true;
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    videoElement.src = '';
    videoElement.load();
  };
}
