/**
 * ChatPanel — Twitch IRC chat over WebSocket with BTTV/FFZ emote support.
 * Anonymous read-only via justinfan username (no auth needed).
 */

interface EmoteMap {
  [code: string]: string; // code -> image URL
}

interface ChatMessage {
  username: string;
  color: string;
  text: string;
}

export class ChatPanel {
  private container: HTMLElement;
  private messagesEl: HTMLElement;
  private ws: WebSocket | null = null;
  private channel: string;
  private emotes: EmoteMap = {};
  private emotesLoaded = false;
  private channelId: string | null = null;

  constructor(parentEl: HTMLElement, channel: string) {
    this.channel = channel.toLowerCase();
    this.container = document.createElement('div');
    this.container.className = 'irc-chat-panel';

    const header = document.createElement('div');
    header.className = 'irc-chat-header';
    header.textContent = `Chat — ${this.channel}`;

    this.messagesEl = document.createElement('div');
    this.messagesEl.className = 'irc-chat-messages';

    this.container.appendChild(header);
    this.container.appendChild(this.messagesEl);
    parentEl.appendChild(this.container);

    this.loadEmotes();
    this.connect();
  }

  private async loadEmotes() {
    try {
      // Fetch BTTV global emotes
      const bttvGlobal = await fetch('https://api.betterttv.net/3/cached/emotes/global').then(
        (r) => r.json()
      );
      for (const e of bttvGlobal) {
        this.emotes[e.code] = `https://cdn.betterttv.net/emote/${e.id}/1x`;
      }

      // Fetch BTTV channel emotes (need to resolve Twitch user ID first)
      try {
        const bttvUser = await fetch(
          `https://api.betterttv.net/3/cached/users/twitch/${await this.getTwitchUserId()}`
        ).then((r) => r.json());
        if (bttvUser.channelEmotes) {
          for (const e of bttvUser.channelEmotes) {
            this.emotes[e.code] = `https://cdn.betterttv.net/emote/${e.id}/1x`;
          }
        }
        if (bttvUser.sharedEmotes) {
          for (const e of bttvUser.sharedEmotes) {
            this.emotes[e.code] = `https://cdn.betterttv.net/emote/${e.id}/1x`;
          }
        }
      } catch {
        // Channel may not have BTTV emotes
      }

      // FFZ global emotes
      try {
        const ffzGlobal = await fetch(
          'https://api.frankerfacez.com/v1/set/global'
        ).then((r) => r.json());
        for (const setId of Object.keys(ffzGlobal.sets)) {
          for (const e of ffzGlobal.sets[setId].emoticons) {
            const url = e.urls['1'] || e.urls[Object.keys(e.urls)[0]];
            if (url) this.emotes[e.name] = url.startsWith('//') ? `https:${url}` : url;
          }
        }
      } catch {
        // FFZ global fetch failed
      }

      // FFZ channel emotes
      try {
        const ffzChannel = await fetch(
          `https://api.frankerfacez.com/v1/room/${this.channel}`
        ).then((r) => r.json());
        for (const setId of Object.keys(ffzChannel.sets)) {
          for (const e of ffzChannel.sets[setId].emoticons) {
            const url = e.urls['1'] || e.urls[Object.keys(e.urls)[0]];
            if (url) this.emotes[e.name] = url.startsWith('//') ? `https:${url}` : url;
          }
        }
      } catch {
        // Channel may not have FFZ emotes
      }

      this.emotesLoaded = true;
    } catch (err) {
      console.warn('[ChatPanel] Failed to load emotes:', err);
    }
  }

  private async getTwitchUserId(): Promise<string> {
    if (this.channelId) return this.channelId;
    // Use BTTV's user lookup which doesn't require auth
    const data = await fetch(
      `https://api.betterttv.net/3/cached/users/twitch/name/${this.channel}`
    ).then((r) => r.json());
    this.channelId = data.id || '';
    return this.channelId!;
  }

  private connect() {
    this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    this.ws.onopen = () => {
      if (!this.ws) return;
      // Anonymous login with justinfan
      const nick = `justinfan${Math.floor(Math.random() * 99999)}`;
      this.ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      this.ws.send(`NICK ${nick}`);
      this.ws.send(`JOIN #${this.channel}`);
    };

    this.ws.onmessage = (event) => {
      const raw = event.data as string;
      const lines = raw.split('\r\n').filter((l: string) => l.length > 0);
      for (const line of lines) {
        if (line.startsWith('PING')) {
          this.ws?.send('PONG :tmi.twitch.tv');
          continue;
        }
        const msg = this.parseIRCMessage(line);
        if (msg) this.appendMessage(msg);
      }
    };

    this.ws.onclose = () => {
      // Reconnect after 3 seconds if not destroyed
      if (this.ws) {
        setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private parseIRCMessage(raw: string): ChatMessage | null {
    // Format: @tags :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
    if (!raw.includes('PRIVMSG')) return null;

    let tags: Record<string, string> = {};
    let rest = raw;

    if (rest.startsWith('@')) {
      const spaceIdx = rest.indexOf(' ');
      const tagStr = rest.substring(1, spaceIdx);
      rest = rest.substring(spaceIdx + 1);
      for (const pair of tagStr.split(';')) {
        const [k, v] = pair.split('=');
        tags[k] = v || '';
      }
    }

    const privmsgIdx = rest.indexOf('PRIVMSG');
    if (privmsgIdx === -1) return null;

    // Extract username from :username!...
    const colonIdx = rest.indexOf(':');
    const exclIdx = rest.indexOf('!');
    if (colonIdx === -1 || exclIdx === -1) return null;
    const username = rest.substring(colonIdx + 1, exclIdx);

    // Extract message text after the second colon (after channel name)
    const msgStart = rest.indexOf(':', privmsgIdx);
    if (msgStart === -1) return null;
    const text = rest.substring(msgStart + 1);

    const color = tags['color'] || this.hashColor(username);
    const displayName = tags['display-name'] || username;

    return { username: displayName, color, text };
  }

  private hashColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      '#FF4500', '#FF6900', '#008000', '#B22222', '#FF69B4',
      '#1E90FF', '#9ACD32', '#00CED1', '#DAA520', '#5F9EA0',
      '#D2691E', '#FF7F50', '#2E8B57', '#8A2BE2', '#FA8072',
    ];
    return colors[Math.abs(hash) % colors.length];
  }

  private appendMessage(msg: ChatMessage) {
    const el = document.createElement('div');
    el.className = 'irc-chat-msg';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'irc-chat-name';
    nameSpan.style.color = msg.color;
    nameSpan.textContent = msg.username;

    const textSpan = document.createElement('span');
    textSpan.className = 'irc-chat-text';

    // Replace emote codes with images
    if (this.emotesLoaded) {
      const words = msg.text.split(' ');
      for (const word of words) {
        if (this.emotes[word]) {
          const img = document.createElement('img');
          img.src = this.emotes[word];
          img.alt = word;
          img.title = word;
          img.className = 'irc-chat-emote';
          textSpan.appendChild(img);
        } else {
          if (textSpan.lastChild && textSpan.lastChild.nodeType === Node.TEXT_NODE) {
            textSpan.lastChild.textContent += ' ' + word;
          } else {
            textSpan.appendChild(document.createTextNode(' ' + word));
          }
        }
      }
    } else {
      textSpan.textContent = msg.text;
    }

    el.appendChild(nameSpan);
    el.appendChild(document.createTextNode(': '));
    el.appendChild(textSpan);
    this.messagesEl.appendChild(el);

    // Auto-scroll and limit message count
    if (this.messagesEl.children.length > 300) {
      this.messagesEl.removeChild(this.messagesEl.firstChild!);
    }
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  public destroy() {
    if (this.ws) {
      const ws = this.ws;
      this.ws = null; // Prevent reconnect
      ws.close();
    }
    this.container.remove();
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public toggle() {
    this.container.classList.toggle('hidden');
  }

  public isVisible(): boolean {
    return !this.container.classList.contains('hidden');
  }
}
