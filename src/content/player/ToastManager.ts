/**
 * Toast notification system for the player.
 * Slides in from top-right of video container, auto-dismisses.
 * Types: info (blue), success (green), warning (yellow), error (red)
 */

export type ToastType = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  element: HTMLElement;
  timeout: number;
}

export class ToastManager {
  private container: HTMLElement;
  private toastContainer: HTMLElement;
  private activeToasts: Toast[] = [];
  private queue: Array<{ message: string; type: ToastType; duration: number }> = [];
  private maxVisible = 3;

  constructor(videoContainer: HTMLElement) {
    this.container = videoContainer;

    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'toast-container';
    this.container.appendChild(this.toastContainer);
  }

  show(message: string, type: ToastType = 'info', duration: number = 4000): void {
    if (this.activeToasts.length >= this.maxVisible) {
      this.queue.push({ message, type, duration });
      return;
    }

    this.createToast(message, type, duration);
  }

  private createToast(message: string, type: ToastType, duration: number): void {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;

    const iconMap: Record<ToastType, string> = {
      info: '&#9432;',      // ⓘ
      success: '&#10003;',  // ✓
      warning: '&#9888;',   // ⚠
      error: '&#10007;',    // ✗
    };

    el.innerHTML = `
      <span class="toast-icon">${iconMap[type]}</span>
      <span class="toast-message">${message}</span>
    `;

    this.toastContainer.appendChild(el);

    // Trigger enter animation
    requestAnimationFrame(() => el.classList.add('toast-visible'));

    const timeout = window.setTimeout(() => {
      this.removeToast(el);
    }, duration);

    this.activeToasts.push({ element: el, timeout });
  }

  private removeToast(el: HTMLElement): void {
    el.classList.remove('toast-visible');
    el.classList.add('toast-exit');

    setTimeout(() => {
      el.remove();
      this.activeToasts = this.activeToasts.filter((t) => t.element !== el);

      // Process queue
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        this.createToast(next.message, next.type, next.duration);
      }
    }, 300);
  }

  destroy(): void {
    for (const toast of this.activeToasts) {
      window.clearTimeout(toast.timeout);
      toast.element.remove();
    }
    this.activeToasts = [];
    this.queue = [];
    this.toastContainer.remove();
  }
}
