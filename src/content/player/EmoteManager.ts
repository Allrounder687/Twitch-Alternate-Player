/**
 * Manages BetterTTV, FrankerFaceZ, and 7TV emotes.
 * Fetches global + channel emotes and provides word-based replacement.
 * Supports per-provider toggles via storage.
 */

interface BTTVEmote {
  id: string;
  code: string;
  imageType: string;
}

interface FFZEmoteSet {
  emoticons: Array<{
    id: number;
    name: string;
    urls: Record<string, string>;
  }>;
}

interface SevenTVEmote {
  id: string;
  name: string;
  data?: {
    host?: {
      url: string;
      files: Array<{ name: string; format: string }>;
    };
  };
}

export interface EmoteProviders {
  bttv: boolean;
  ffz: boolean;
  seventv: boolean;
}

export class EmoteManager {
  // code -> { url, provider }
  private emoteMap = new Map<string, { url: string; provider: 'bttv' | 'ffz' | 'seventv' }>();
  private loaded = false;
  private providers: EmoteProviders = { bttv: true, ffz: true, seventv: true };

  setProviders(providers: EmoteProviders): void {
    this.providers = providers;
  }

  async loadGlobalEmotes(): Promise<void> {
    // Load provider settings first
    try {
      const data = await new Promise<Record<string, any>>((resolve) => {
        chrome.storage.sync.get(['emoteProviders'], (d) => resolve(d));
      });
      if (data.emoteProviders) {
        this.providers = data.emoteProviders;
      }
    } catch {
      // Use defaults
    }

    const fetches: Promise<void>[] = [];
    if (this.providers.bttv) fetches.push(this.fetchBTTVGlobal());
    if (this.providers.ffz) fetches.push(this.fetchFFZGlobal());
    if (this.providers.seventv) fetches.push(this.fetch7TVGlobal());
    await Promise.allSettled(fetches);
    this.loaded = true;
  }

  async loadChannelEmotes(channel: string): Promise<void> {
    const fetches: Promise<void>[] = [];
    if (this.providers.bttv) fetches.push(this.fetchBTTVChannel(channel));
    if (this.providers.ffz) fetches.push(this.fetchFFZChannel(channel));
    if (this.providers.seventv) fetches.push(this.fetch7TVChannel(channel));
    await Promise.allSettled(fetches);
  }

  private async fetchBTTVGlobal(): Promise<void> {
    try {
      const res = await fetch('https://api.betterttv.net/3/cached/emotes/global');
      if (!res.ok) return;
      const emotes: BTTVEmote[] = await res.json();
      for (const e of emotes) {
        this.emoteMap.set(e.code, { url: `https://cdn.betterttv.net/emote/${e.id}/1x`, provider: 'bttv' });
      }
    } catch {
      // Non-critical
    }
  }

  private async fetchBTTVChannel(channel: string): Promise<void> {
    try {
      // BTTV user lookup by twitch login
      const res = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${channel}`);
      if (!res.ok) return;
      const data = await res.json();
      const allEmotes = [...(data.channelEmotes || []), ...(data.sharedEmotes || [])];
      for (const e of allEmotes) {
        this.emoteMap.set(e.code, { url: `https://cdn.betterttv.net/emote/${e.id}/1x`, provider: 'bttv' });
      }
    } catch {
      // BTTV needs numeric user ID for some channels; best effort
    }
  }

  private async fetchFFZGlobal(): Promise<void> {
    try {
      const res = await fetch('https://api.frankerfacez.com/v1/set/global');
      if (!res.ok) return;
      const data = await res.json();
      for (const setId of Object.keys(data.sets || {})) {
        const set: FFZEmoteSet = data.sets[setId];
        for (const e of set.emoticons) {
          const url = e.urls['1'] || e.urls['2'] || Object.values(e.urls)[0];
          if (url) {
            this.emoteMap.set(e.name, { url: url.startsWith('//') ? `https:${url}` : url, provider: 'ffz' });
          }
        }
      }
    } catch {
      // Non-critical
    }
  }

  private async fetchFFZChannel(channel: string): Promise<void> {
    try {
      const res = await fetch(`https://api.frankerfacez.com/v1/room/${channel}`);
      if (!res.ok) return;
      const data = await res.json();
      for (const setId of Object.keys(data.sets || {})) {
        const set: FFZEmoteSet = data.sets[setId];
        for (const e of set.emoticons) {
          const url = e.urls['1'] || e.urls['2'] || Object.values(e.urls)[0];
          if (url) {
            this.emoteMap.set(e.name, { url: url.startsWith('//') ? `https:${url}` : url, provider: 'ffz' });
          }
        }
      }
    } catch {
      // Non-critical
    }
  }

  private async fetch7TVGlobal(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('https://7tv.io/v3/emote-sets/global', { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return;
      const data = await res.json();
      const emotes: SevenTVEmote[] = data.emotes || [];
      for (const e of emotes) {
        this.emoteMap.set(e.name, { url: `https://cdn.7tv.app/emote/${e.id}/1x.webp`, provider: 'seventv' });
      }
    } catch {
      // 7TV API can be slow — non-critical
    }
  }

  private async fetch7TVChannel(channel: string): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`https://7tv.io/v3/users/twitch/${channel}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return;
      const data = await res.json();
      const emotes: SevenTVEmote[] = data.emote_set?.emotes || [];
      for (const e of emotes) {
        this.emoteMap.set(e.name, { url: `https://cdn.7tv.app/emote/${e.id}/1x.webp`, provider: 'seventv' });
      }
    } catch {
      // Non-critical
    }
  }

  /**
   * Given HTML (possibly containing Twitch emote <img> tags), replace word tokens
   * that match BTTV/FFZ/7TV emote codes with <img> tags.
   * Only replaces emotes from enabled providers.
   */
  replaceEmotesInHtml(html: string): string {
    if (this.emoteMap.size === 0) return html;

    // Split on HTML tags to avoid replacing inside existing <img> tags
    const parts = html.split(/(<[^>]+>)/);
    for (let i = 0; i < parts.length; i++) {
      // Skip HTML tags
      if (parts[i].startsWith('<')) continue;

      // Replace words in text nodes
      parts[i] = parts[i].replace(/\S+/g, (word) => {
        const entry = this.emoteMap.get(word);
        if (entry && this.providers[entry.provider]) {
          return `<img class="irc-emote" src="${entry.url}" alt="${word}" title="${word}">`;
        }
        return word;
      });
    }
    return parts.join('');
  }

  hasEmote(code: string): boolean {
    return this.emoteMap.has(code);
  }

  getEmoteUrl(code: string): string | undefined {
    const entry = this.emoteMap.get(code);
    return entry?.url;
  }
}
