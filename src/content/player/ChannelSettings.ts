export interface ChannelConfig {
  quality?: string;
  volume?: number;
  chatEnabled?: boolean;
  latencyMode?: string;
  layout?: string;
}

const CHANNEL_SETTINGS_PREFIX = 'channelSettings.';

/**
 * Get merged settings for a channel: per-channel overrides on top of global defaults.
 */
export async function getChannelSettings(channel: string): Promise<ChannelConfig> {
  return new Promise((resolve) => {
    const channelKey = `${CHANNEL_SETTINGS_PREFIX}${channel.toLowerCase()}`;
    chrome.storage.sync.get(['quality', 'volume', 'chatEnabled', 'latencyMode', 'layout', channelKey], (data) => {
      const globals: ChannelConfig = {
        quality: data.quality || 'auto',
        volume: data.volume ?? 50,
        chatEnabled: data.chatEnabled !== false,
        latencyMode: data.latencyMode || 'balanced',
        layout: data.layout || 'balanced',
      };
      const perChannel: ChannelConfig = data[channelKey] || {};
      resolve({ ...globals, ...perChannel });
    });
  });
}

/**
 * Save a per-channel setting override.
 */
export function saveChannelSetting(channel: string, key: keyof ChannelConfig, value: any): void {
  const channelKey = `${CHANNEL_SETTINGS_PREFIX}${channel.toLowerCase()}`;
  chrome.storage.sync.get([channelKey], (data) => {
    const existing: ChannelConfig = data[channelKey] || {};
    existing[key] = value;
    chrome.storage.sync.set({ [channelKey]: existing });
  });
}

/**
 * Reset per-channel settings to defaults (remove overrides).
 */
export function resetChannelSettings(channel: string): void {
  const channelKey = `${CHANNEL_SETTINGS_PREFIX}${channel.toLowerCase()}`;
  chrome.storage.sync.remove(channelKey);
}

/**
 * Migrate flat settings to new schema on first run.
 * Called once from background script on install/update.
 */
export function migrateSettings(): void {
  chrome.storage.sync.get(null, (data) => {
    // If migration was already done, skip
    if (data._settingsMigrated) return;

    // The flat keys remain as global defaults — no actual migration needed.
    // Just mark as migrated so we don't re-run.
    chrome.storage.sync.set({ _settingsMigrated: true });
  });
}
