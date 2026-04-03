/**
 * Twitch IRC Chat Client — connects via WebSocket as anonymous viewer (justinfan).
 * Parses IRC messages, renders usernames with colors, supports BTTV/FFZ emotes.
 */

import { EmoteManager } from './EmoteManager';

export interface ChatMessage {
  username: string;
  displayName: string;
  color: string;
  message: string;
  emotes: Record<string, string[]>; // emote-id -> [start-end, ...]
  badges: string[];
  id: string;
}

const DEFAULT_COLORS = [
  '#FF0000', '#0000FF', '#00FF00', '#B22222', '#FF7F50',
  '#9ACD32', '#FF4500', '#2E8B57', '#DAA520', '#D2691E',
  '#5F9EA0', '#1E90FF', '#FF69B4', '#8A2BE2', '#00FF7F',
];

export class TwitchChat {
  private ws: WebSocket | null = null;
  private channel: string;
  private container: HTMLElement;
  private messageList: HTMLElement;
  private onMessage: ((msg: ChatMessage) => void) | null = null;
  private emoteManager: EmoteManager;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private destroyed = false;
  private messageCount = 0;
  private maxMessages = 200;

  constructor(channel: string, container: HTMLElement) {
    this.channel = channel.toLowerCase();
    this.container = container;
    this.emoteManager = new EmoteManager();

    // Build chat UI
    this.container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'irc-chat-header';
    header.innerHTML = `
      <span class="irc-chat-title">Chat — ${this.channel}</span>
      <span class="irc-chat-badge">IRC</span>
    `;

    this.messageList = document.createElement('div');
    this.messageList.className = 'irc-chat-messages';

    const inputArea = document.createElement('div');
    inputArea.className = 'irc-chat-input-area';
    inputArea.innerHTML = `<span class="irc-chat-readonly">Read-only (anonymous)</span>`;

    this.container.appendChild(header);
    this.container.appendChild(this.messageList);
    this.container.appendChild(inputArea);
  }

  async connect(): Promise<void> {
    // Load emotes first
    await this.emoteManager.loadGlobalEmotes();
    this.emoteManager.loadChannelEmotes(this.channel);

    this.initWebSocket();
  }

  private initWebSocket(): void {
    if (this.destroyed) return;

    this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    this.ws.onopen = () => {
      if (!this.ws) return;
      this.reconnectAttempts = 0;

      // Request capabilities for tags (colors, badges, emotes)
      this.ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      // Anonymous login
      const justinfanId = 1000 + Math.floor(Math.random() * 89000);
      this.ws.send(`NICK justinfan${justinfanId}`);
      this.ws.send(`JOIN #${this.channel}`);

      this.addSystemMessage('Connected to chat');
    };

    this.ws.onmessage = (event) => {
      const raw = event.data as string;
      const lines = raw.split('\r\n').filter(Boolean);
      for (const line of lines) {
        this.handleLine(line);
      }
    };

    this.ws.onclose = () => {
      if (this.destroyed) return;
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.addSystemMessage(`Disconnected. Reconnecting in ${delay / 1000}s...`);
        setTimeout(() => this.initWebSocket(), delay);
      } else {
        this.addSystemMessage('Chat disconnected. Refresh to reconnect.');
      }
    };

    this.ws.onerror = () => {
      // onclose will handle reconnection
    };
  }

  private handleLine(line: string): void {
    // Respond to PING to keep connection alive
    if (line.startsWith('PING')) {
      this.ws?.send('PONG :tmi.twitch.tv');
      return;
    }

    // Parse PRIVMSG
    if (!line.includes('PRIVMSG')) return;

    const parsed = this.parseIRCMessage(line);
    if (!parsed) return;

    this.renderMessage(parsed);
    this.onMessage?.(parsed);
  }

  private parseIRCMessage(raw: string): ChatMessage | null {
    try {
      let tags: Record<string, string> = {};
      let rest = raw;

      // Parse tags
      if (rest.startsWith('@')) {
        const spaceIdx = rest.indexOf(' ');
        const tagStr = rest.substring(1, spaceIdx);
        rest = rest.substring(spaceIdx + 1);

        for (const pair of tagStr.split(';')) {
          const eqIdx = pair.indexOf('=');
          if (eqIdx !== -1) {
            tags[pair.substring(0, eqIdx)] = pair.substring(eqIdx + 1);
          }
        }
      }

      // Parse :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
      const privmsgIdx = rest.indexOf('PRIVMSG');
      if (privmsgIdx === -1) return null;

      // Extract username from prefix
      const prefix = rest.substring(1, rest.indexOf(' '));
      const username = prefix.split('!')[0];

      // Extract message content
      const msgStart = rest.indexOf(':', privmsgIdx);
      if (msgStart === -1) return null;
      const message = rest.substring(msgStart + 1);

      // Parse emote positions from tags
      const emotes: Record<string, string[]> = {};
      if (tags['emotes']) {
        for (const emoteGroup of tags['emotes'].split('/')) {
          const colonIdx = emoteGroup.indexOf(':');
          if (colonIdx !== -1) {
            const emoteId = emoteGroup.substring(0, colonIdx);
            const positions = emoteGroup.substring(colonIdx + 1).split(',');
            emotes[emoteId] = positions;
          }
        }
      }

      const color =
        tags['color'] ||
        DEFAULT_COLORS[
          username.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % DEFAULT_COLORS.length
        ];

      return {
        username,
        displayName: tags['display-name'] || username,
        color,
        message,
        emotes,
        badges: tags['badges'] ? tags['badges'].split(',') : [],
        id: tags['id'] || String(Date.now()),
      };
    } catch {
      return null;
    }
  }

  private renderMessage(msg: ChatMessage): void {
    const el = document.createElement('div');
    el.className = 'irc-chat-msg';

    // Badges
    let badgeHtml = '';
    for (const badge of msg.badges) {
      const [name] = badge.split('/');
      if (name === 'broadcaster') badgeHtml += '<span class="irc-badge broadcaster" title="Broadcaster">&#9733;</span>';
      else if (name === 'moderator') badgeHtml += '<span class="irc-badge moderator" title="Moderator">&#9878;</span>';
      else if (name === 'vip') badgeHtml += '<span class="irc-badge vip" title="VIP">&#9830;</span>';
      else if (name === 'subscriber') badgeHtml += '<span class="irc-badge subscriber" title="Subscriber">&#9829;</span>';
    }

    // Process message text — replace Twitch emotes and BTTV/FFZ emotes
    const processedMessage = this.processMessageEmotes(msg);

    el.innerHTML = `
      ${badgeHtml}
      <span class="irc-chat-username" style="color: ${msg.color}">${this.escapeHtml(msg.displayName)}</span>
      <span class="irc-chat-separator">: </span>
      <span class="irc-chat-text">${processedMessage}</span>
    `;

    this.messageList.appendChild(el);
    this.messageCount++;

    // Prune old messages
    while (this.messageCount > this.maxMessages && this.messageList.firstChild) {
      this.messageList.removeChild(this.messageList.firstChild);
      this.messageCount--;
    }

    // Auto-scroll to bottom
    this.messageList.scrollTop = this.messageList.scrollHeight;
  }

  private processMessageEmotes(msg: ChatMessage): string {
    let text = msg.message;

    // First apply Twitch native emotes (position-based)
    if (Object.keys(msg.emotes).length > 0) {
      // Collect all emote positions
      const replacements: { start: number; end: number; emoteId: string }[] = [];
      for (const [emoteId, positions] of Object.entries(msg.emotes)) {
        for (const pos of positions) {
          const [start, end] = pos.split('-').map(Number);
          replacements.push({ start, end, emoteId });
        }
      }
      // Sort by position descending so replacements don't shift indices
      replacements.sort((a, b) => b.start - a.start);

      const chars = [...text]; // Handle multi-byte chars
      for (const r of replacements) {
        const emoteName = chars.slice(r.start, r.end + 1).join('');
        const img = `<img class="irc-emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${r.emoteId}/default/dark/1.0" alt="${this.escapeHtml(emoteName)}" title="${this.escapeHtml(emoteName)}">`;
        chars.splice(r.start, r.end - r.start + 1, img);
      }
      text = chars.join('');
    } else {
      text = this.escapeHtml(text);
    }

    // Then apply BTTV/FFZ emotes (word-based replacement)
    text = this.emoteManager.replaceEmotesInHtml(text);

    return text;
  }

  private addSystemMessage(text: string): void {
    const el = document.createElement('div');
    el.className = 'irc-chat-system';
    el.textContent = text;
    this.messageList.appendChild(el);
    this.messageList.scrollTop = this.messageList.scrollHeight;
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.container.innerHTML = '';
  }
}
