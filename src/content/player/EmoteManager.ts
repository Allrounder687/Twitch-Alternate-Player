/**
 * Manages BetterTTV and FrankerFaceZ emotes.
 * Fetches global + channel emotes and provides word-based replacement.
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

export class EmoteManager {
  // code -> img URL
  private emoteMap = new Map<string, string>();
  private loaded = false;

  async loadGlobalEmotes(): Promise<void> {
    await Promise.allSettled([
      this.fetchBTTVGlobal(),
      this.fetchFFZGlobal(),
    ]);
    this.loaded = true;
  }

  async loadChannelEmotes(channel: string): Promise<void> {
    // Need Twitch user ID for BTTV/FFZ channel emotes
    // We'll try fetching by channel name — BTTV supports it
    await Promise.allSettled([
      this.fetchBTTVChannel(channel),
      this.fetchFFZChannel(channel),
    ]);
  }

  private async fetchBTTVGlobal(): Promise<void> {
    try {
      const res = await fetch('https://api.betterttv.net/3/cached/emotes/global');
      if (!res.ok) return;
      const emotes: BTTVEmote[] = await res.json();
      for (const e of emotes) {
        this.emoteMap.set(e.code, `https://cdn.betterttv.net/emote/${e.id}/1x`);
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
        this.emoteMap.set(e.code, `https://cdn.betterttv.net/emote/${e.id}/1x`);
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
            this.emoteMap.set(e.name, url.startsWith('//') ? `https:${url}` : url);
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
            this.emoteMap.set(e.name, url.startsWith('//') ? `https:${url}` : url);
          }
        }
      }
    } catch {
      // Non-critical
    }
  }

  /**
   * Given HTML (possibly containing Twitch emote <img> tags), replace word tokens
   * that match BTTV/FFZ emote codes with <img> tags.
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
        const url = this.emoteMap.get(word);
        if (url) {
          return `<img class="irc-emote" src="${url}" alt="${word}" title="${word}">`;
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
    return this.emoteMap.get(code);
  }
}
