/**
 * MultiStreamManager — Allows watching multiple streams simultaneously.
 * Manages a grid of lightweight stream cells, each with its own video + HLS instance.
 * Only ONE stream has audio at a time. Number keys 1-4 switch audio focus.
 */

import { attachVideo, VideoController } from './VideoCore';

interface StreamCell {
  channel: string;
  element: HTMLElement;
  video: HTMLVideoElement;
  controller: VideoController;
  volumeSlider: HTMLInputElement;
  index: number;
}

export class MultiStreamManager {
  private container: HTMLElement;
  private primaryVideoContainer: HTMLElement;
  private cells: StreamCell[] = [];
  private audioFocusIndex = 0;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private destroyed = false;
  private addBtn: HTMLElement | null = null;

  constructor(
    hostElement: HTMLElement,
    primaryVideoContainer: HTMLElement,
  ) {
    this.container = hostElement;
    this.primaryVideoContainer = primaryVideoContainer;
  }

  init(controlsBar: HTMLElement): void {
    // Create the "+" button in controls
    this.addBtn = document.createElement('button');
    this.addBtn.className = 'ctrl-btn multi-stream-add-btn';
    this.addBtn.title = 'Add Stream (Multi-View)';
    this.addBtn.tabIndex = 0;
    this.addBtn.setAttribute('aria-label', 'Add another stream for multi-view');
    this.addBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    `;

    const rightSection = controlsBar.querySelector('.controls-section:last-child');
    const settingsBtn = controlsBar.querySelector('.settings-btn');
    if (rightSection && settingsBtn) {
      rightSection.insertBefore(this.addBtn, settingsBtn);
    } else if (rightSection) {
      rightSection.appendChild(this.addBtn);
    }

    this.addBtn.addEventListener('click', () => this.showAddDialog());

    // Keyboard shortcuts: 1-4 switch audio focus
    this.keydownHandler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (this.cells.length === 0) return;

      const num = parseInt(e.key);
      if (num >= 1 && num <= 4 && num <= this.cells.length) {
        e.preventDefault();
        this.setAudioFocus(num - 1);
      }
    };
    window.addEventListener('keydown', this.keydownHandler);

    // Load persisted multi-streams
    chrome.storage.sync.get(['multiStreams'], (data) => {
      const streams: string[] = data.multiStreams || [];
      for (const ch of streams) {
        this.addStream(ch);
      }
    });
  }

  private showAddDialog(): void {
    // Simple inline input dialog
    const existing = this.container.querySelector('.multi-stream-dialog');
    if (existing) {
      existing.remove();
      return;
    }

    const dialog = document.createElement('div');
    dialog.className = 'multi-stream-dialog';
    dialog.innerHTML = `
      <input type="text" class="multi-stream-input" placeholder="Enter channel name..." maxlength="25" aria-label="Channel name for multi-stream">
      <button class="multi-stream-go-btn" aria-label="Add stream">Go</button>
    `;

    this.primaryVideoContainer.appendChild(dialog);

    const input = dialog.querySelector('.multi-stream-input') as HTMLInputElement;
    const goBtn = dialog.querySelector('.multi-stream-go-btn') as HTMLButtonElement;

    const submit = () => {
      const channel = input.value.trim().toLowerCase();
      if (channel) {
        this.addStream(channel);
        this.persistStreams();
      }
      dialog.remove();
    };

    goBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') dialog.remove();
    });

    input.focus();
  }

  addStream(channel: string): void {
    if (this.destroyed) return;
    if (this.cells.length >= 3) return; // Max 3 additional streams (4 total with primary)

    // Check if already added
    if (this.cells.some(c => c.channel === channel)) return;

    const index = this.cells.length;

    // Create cell element
    const cell = document.createElement('div');
    cell.className = 'multi-stream-cell';
    cell.setAttribute('data-channel', channel);

    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true; // All secondary streams start muted

    const overlay = document.createElement('div');
    overlay.className = 'multi-stream-overlay';

    const label = document.createElement('span');
    label.className = 'multi-stream-label';
    label.textContent = channel;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'multi-stream-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Remove stream';
    closeBtn.tabIndex = 0;
    closeBtn.setAttribute('aria-label', `Remove ${channel} stream`);

    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.className = 'multi-stream-volume';
    volumeSlider.min = '0';
    volumeSlider.max = '100';
    volumeSlider.value = '50';
    volumeSlider.setAttribute('aria-label', `Volume for ${channel}`);

    overlay.appendChild(label);
    overlay.appendChild(volumeSlider);
    overlay.appendChild(closeBtn);
    cell.appendChild(video);
    cell.appendChild(overlay);

    // Loader & error for this cell
    const loader = document.createElement('div');
    loader.className = 'loader active';
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-msg';
    cell.appendChild(loader);
    cell.appendChild(errorMsg);

    // Insert cell into the grid area
    this.getOrCreateGrid().appendChild(cell);

    // Initialize HLS
    const controller = attachVideo(video, channel, loader, errorMsg);

    const streamCell: StreamCell = {
      channel,
      element: cell,
      video,
      controller,
      volumeSlider,
      index,
    };
    this.cells.push(streamCell);

    // Event listeners
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeStream(channel);
    });

    cell.addEventListener('click', () => {
      const idx = this.cells.findIndex(c => c.channel === channel);
      if (idx >= 0) this.setAudioFocus(idx);
    });

    volumeSlider.addEventListener('input', () => {
      video.volume = Number(volumeSlider.value) / 100;
    });
    volumeSlider.addEventListener('click', (e) => e.stopPropagation());

    this.updateGridLayout();
  }

  removeStream(channel: string): void {
    const idx = this.cells.findIndex(c => c.channel === channel);
    if (idx === -1) return;

    const cell = this.cells[idx];
    cell.controller.cleanup();
    cell.element.remove();
    this.cells.splice(idx, 1);

    // Re-index
    this.cells.forEach((c, i) => c.index = i);

    // Reset audio focus if needed
    if (this.audioFocusIndex >= this.cells.length) {
      this.audioFocusIndex = 0;
    }

    this.updateGridLayout();
    this.persistStreams();

    // Remove grid if no cells left
    if (this.cells.length === 0) {
      const grid = this.container.querySelector('.multi-stream-grid');
      grid?.remove();
      this.container.classList.remove('multi-stream-active');
    }
  }

  private setAudioFocus(index: number): void {
    if (index < 0 || index >= this.cells.length) return;
    this.audioFocusIndex = index;

    this.cells.forEach((cell, i) => {
      if (i === index) {
        cell.video.muted = false;
        cell.element.classList.add('audio-focus');
      } else {
        cell.video.muted = true;
        cell.element.classList.remove('audio-focus');
      }
    });
  }

  private getOrCreateGrid(): HTMLElement {
    let grid = this.container.querySelector('.multi-stream-grid') as HTMLElement;
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'multi-stream-grid';
      // Insert grid after the primary video container
      this.primaryVideoContainer.after(grid);
      this.container.classList.add('multi-stream-active');
    }
    return grid;
  }

  private updateGridLayout(): void {
    const totalStreams = 1 + this.cells.length; // primary + additional
    this.container.setAttribute('data-stream-count', String(totalStreams));

    // CSS handles the layout via data-stream-count attribute
  }

  private persistStreams(): void {
    const channels = this.cells.map(c => c.channel);
    chrome.storage.sync.set({ multiStreams: channels });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    for (const cell of this.cells) {
      cell.controller.cleanup();
      cell.element.remove();
    }
    this.cells = [];
    this.addBtn?.remove();
    const grid = this.container.querySelector('.multi-stream-grid');
    grid?.remove();
    this.container.classList.remove('multi-stream-active');
  }
}
