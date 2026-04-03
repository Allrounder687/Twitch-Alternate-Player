/**
 * StatsOverlay — Shows stream statistics: resolution, bitrate, dropped frames, buffer, latency.
 * Pulls data from hls.js stats events.
 */
import Hls from 'hls.js';

export class StatsOverlay {
  private overlay: HTMLElement;
  private interval: number | null = null;
  private hls: Hls | null = null;
  private video: HTMLVideoElement;
  private visible = false;

  constructor(videoContainer: HTMLElement, video: HTMLVideoElement) {
    this.video = video;
    this.overlay = document.createElement('div');
    this.overlay.className = 'stats-overlay';
    this.overlay.style.display = 'none';
    videoContainer.appendChild(this.overlay);
  }

  public attachHls(hls: Hls) {
    this.hls = hls;
  }

  public toggle() {
    this.visible = !this.visible;
    if (this.visible) {
      this.overlay.style.display = 'block';
      this.startUpdating();
    } else {
      this.overlay.style.display = 'none';
      this.stopUpdating();
    }
  }

  public isVisible(): boolean {
    return this.visible;
  }

  private startUpdating() {
    this.update();
    this.interval = window.setInterval(() => this.update(), 1000);
  }

  private stopUpdating() {
    if (this.interval !== null) {
      window.clearInterval(this.interval);
      this.interval = null;
    }
  }

  private update() {
    if (!this.hls) {
      this.overlay.textContent = 'Stats: No HLS instance';
      return;
    }

    const level = this.hls.currentLevel >= 0 ? this.hls.levels[this.hls.currentLevel] : null;
    const resolution = level ? `${level.width}x${level.height}` : 'N/A';
    const fps = level?.attrs?.['FRAME-RATE'] || (level as any)?.frameRate || 'N/A';
    const bitrate = level ? `${(level.bitrate / 1000).toFixed(0)} kbps` : 'N/A';

    // Buffer length
    const buffered = this.video.buffered;
    let bufferLen = 0;
    if (buffered.length > 0) {
      bufferLen = buffered.end(buffered.length - 1) - this.video.currentTime;
    }

    // Dropped frames (from video element if available)
    const vq = (this.video as any).getVideoPlaybackQuality?.();
    const dropped = vq ? vq.droppedVideoFrames : 'N/A';
    const totalFrames = vq ? vq.totalVideoFrames : 'N/A';

    // Latency
    const latency = this.hls.latency != null ? `${this.hls.latency.toFixed(1)}s` : 'N/A';

    this.overlay.innerHTML = `
      <div class="stats-row"><span>Resolution</span><span>${resolution}</span></div>
      <div class="stats-row"><span>FPS</span><span>${fps}</span></div>
      <div class="stats-row"><span>Bitrate</span><span>${bitrate}</span></div>
      <div class="stats-row"><span>Buffer</span><span>${bufferLen.toFixed(1)}s</span></div>
      <div class="stats-row"><span>Dropped Frames</span><span>${dropped} / ${totalFrames}</span></div>
      <div class="stats-row"><span>Latency</span><span>${latency}</span></div>
    `;
  }

  public destroy() {
    this.stopUpdating();
    this.overlay.remove();
  }
}
