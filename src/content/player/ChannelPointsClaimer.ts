/**
 * Channel Points Auto-Claimer
 * Watches the native Twitch DOM for channel point claim buttons and auto-clicks them.
 * Uses MutationObserver + periodic polling as backup.
 */

export class ChannelPointsClaimer {
  private observer: MutationObserver | null = null;
  private pollInterval: number | null = null;
  private enabled = true;
  private destroyed = false;

  private static CLAIM_SELECTORS = [
    'button[aria-label="Claim Bonus"]',
    'div.claimable-bonus__icon',
    'button.ScCoreButtonSuccess-sc-ocjdkq-0',
    '[data-test-selector="community-points-summary"] button',
    '.community-points-summary button.ScCoreButtonSuccess',
  ];

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  start(): void {
    if (this.destroyed || !this.enabled) return;

    // MutationObserver for real-time detection
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            this.checkForClaimButton(node);
          }
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Periodic polling as backup (every 15s)
    this.pollInterval = window.setInterval(() => {
      if (this.destroyed || !this.enabled) return;
      this.scanForClaimButtons();
    }, 15000);

    // Initial scan
    this.scanForClaimButtons();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private checkForClaimButton(root: HTMLElement): void {
    if (!this.enabled) return;

    for (const selector of ChannelPointsClaimer.CLAIM_SELECTORS) {
      const btn = root.matches?.(selector) ? root : root.querySelector?.(selector);
      if (btn instanceof HTMLElement) {
        this.claimWithDelay(btn);
        return;
      }
    }
  }

  private scanForClaimButtons(): void {
    if (!this.enabled) return;

    for (const selector of ChannelPointsClaimer.CLAIM_SELECTORS) {
      const btn = document.querySelector(selector) as HTMLElement | null;
      if (btn) {
        this.claimWithDelay(btn);
        return;
      }
    }
  }

  private claimWithDelay(btn: HTMLElement): void {
    // Random delay 500-2000ms to look natural
    const delay = 500 + Math.random() * 1500;
    setTimeout(() => {
      if (this.destroyed || !this.enabled) return;
      try {
        btn.click();
        console.log('[Alt Player] Channel points claimed!');
        // Dispatch event so ToastManager can show notification
        document.dispatchEvent(new CustomEvent('twitch-points-claimed'));
      } catch {
        // Button may have been removed
      }
    }, delay);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.pollInterval) {
      window.clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
