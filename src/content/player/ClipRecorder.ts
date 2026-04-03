/**
 * ClipRecorder — Uses MediaRecorder API to capture the last 30 seconds of a stream.
 * Keeps a rolling buffer of recorded chunks.
 */

export class ClipRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private maxDuration = 30000; // 30 seconds
  private chunkInterval = 1000; // 1 second chunks
  private recording = false;
  private video: HTMLVideoElement;
  private stream: MediaStream | null = null;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  public start() {
    if (this.recording) return;
    try {
      this.stream = (this.video as any).captureStream?.() || (this.video as any).mozCaptureStream?.();
      if (!this.stream) {
        console.warn('[ClipRecorder] captureStream not available');
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
          // Keep only last ~30 seconds of chunks
          const maxChunks = Math.ceil(this.maxDuration / this.chunkInterval);
          while (this.chunks.length > maxChunks) {
            this.chunks.shift();
          }
        }
      };

      this.mediaRecorder.start(this.chunkInterval);
      this.recording = true;
    } catch (err) {
      console.error('[ClipRecorder] Failed to start:', err);
    }
  }

  public isRecording(): boolean {
    return this.recording;
  }

  public saveClip(): boolean {
    if (!this.recording || this.chunks.length === 0) return false;

    const blob = new Blob(this.chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `twitch-clip-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  public stop() {
    if (this.mediaRecorder && this.recording) {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Already stopped
      }
      this.mediaRecorder = null;
      this.recording = false;
    }
    this.stream = null;
  }

  public destroy() {
    this.stop();
    this.chunks = [];
  }
}
