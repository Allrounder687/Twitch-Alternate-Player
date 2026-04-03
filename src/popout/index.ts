import Hls from 'hls.js';

const params = new URLSearchParams(window.location.search);
const channel = params.get('channel') || '';
document.title = `${channel || 'Stream'} — Pop-Out Player`;

const video = document.getElementById('video') as HTMLVideoElement;
const loader = document.getElementById('loader') as HTMLElement;
const error = document.getElementById('error') as HTMLElement;

if (!channel) {
  loader.classList.add('hidden');
  error.textContent = 'No channel specified.';
  error.classList.add('active');
} else {
  chrome.runtime.sendMessage({ action: 'GET_STREAM_URL', streamerName: channel }, (response) => {
    if (chrome.runtime.lastError || !response || response.error) {
      loader.classList.add('hidden');
      error.textContent = response?.error || 'Failed to get stream URL';
      error.classList.add('active');
      return;
    }
    loadStream(response.url);
  });
}

function loadStream(url: string) {
  if (Hls.isSupported()) {
    const hls = new Hls({
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 8,
      lowLatencyMode: true,
      maxLiveSyncPlaybackRate: 1.2,
      backBufferLength: 30,
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      loader.classList.add('hidden');
      let highest = -1, maxH = 0;
      data.levels.forEach((l, i) => { if (l.height > maxH) { maxH = l.height; highest = i; } });
      if (highest !== -1) { hls.startLevel = highest; hls.nextLoadLevel = highest; }
      video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else { loader.classList.add('hidden'); error.textContent = 'Stream failed.'; error.classList.add('active'); }
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.addEventListener('loadedmetadata', () => { loader.classList.add('hidden'); video.play().catch(() => {}); });
  }
}
