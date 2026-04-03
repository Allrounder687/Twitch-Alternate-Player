/**
 * ModTools — OAuth-based mod tools overlay.
 * Adds authentication flow, read-write chat, and moderator actions.
 * Only shows mod tools if user has mod badges in the channel.
 */

import { TWITCH_CLIENT_ID } from '../../background/twitch-api';

const OAUTH_SCOPES = 'chat:edit channel:moderate moderator:manage:chat_messages';
const OAUTH_REDIRECT = 'https://localhost/callback'; // Extension callback

interface ModToolsConfig {
  accessToken: string | null;
  username: string;
  userId: string;
  isMod: boolean;
}

export class ModTools {
  private channel: string;
  private container: HTMLElement;
  private chatContainer: HTMLElement;
  private panel: HTMLElement | null = null;
  private modBtn: HTMLElement | null = null;
  private authIndicator: HTMLElement | null = null;
  private config: ModToolsConfig = { accessToken: null, username: '', userId: '', isMod: false };
  private ws: WebSocket | null = null;
  private destroyed = false;
  private contextMenu: HTMLElement | null = null;
  private contextMenuHandler: ((e: MouseEvent) => void) | null = null;
  private deviceId = '';

  constructor(channel: string, controlsBar: HTMLElement, videoContainer: HTMLElement, chatContainer: HTMLElement) {
    this.channel = channel.toLowerCase();
    this.container = videoContainer;
    this.chatContainer = chatContainer;
    this.init(controlsBar);
  }

  private async init(controlsBar: HTMLElement): Promise<void> {
    // Load device ID
    try {
      const data = await new Promise<Record<string, any>>((resolve) => {
        chrome.storage.local.get(['twitch_device_id'], (d) => resolve(d));
      });
      this.deviceId = data.twitch_device_id || '';
    } catch {
      // Continue
    }

    // Load stored token
    try {
      const data = await new Promise<Record<string, any>>((resolve) => {
        chrome.storage.local.get(['twitchOAuthToken', 'twitchOAuthUser', 'twitchOAuthUserId'], (d) => resolve(d));
      });
      if (data.twitchOAuthToken) {
        this.config.accessToken = data.twitchOAuthToken;
        this.config.username = data.twitchOAuthUser || '';
        this.config.userId = data.twitchOAuthUserId || '';
      }
    } catch {
      // Continue as anonymous
    }

    // Create mod button in controls
    this.modBtn = document.createElement('button');
    this.modBtn.className = 'ctrl-btn mod-tools-btn';
    this.modBtn.title = 'Mod Tools';
    this.modBtn.tabIndex = 0;
    this.modBtn.setAttribute('aria-label', 'Moderator tools');
    this.modBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    `;

    // Auth indicator
    this.authIndicator = document.createElement('span');
    this.authIndicator.className = 'mod-auth-indicator';
    this.updateAuthIndicator();

    const rightSection = controlsBar.querySelector('.controls-section:last-child');
    const settingsBtn = controlsBar.querySelector('.settings-btn');
    if (rightSection && settingsBtn) {
      rightSection.insertBefore(this.authIndicator, settingsBtn);
      rightSection.insertBefore(this.modBtn, settingsBtn);
    } else if (rightSection) {
      rightSection.appendChild(this.authIndicator);
      rightSection.appendChild(this.modBtn);
    }

    // Create mod panel
    this.panel = document.createElement('div');
    this.panel.className = 'mod-panel';
    this.renderPanel();
    this.container.appendChild(this.panel);

    // Event listeners
    this.modBtn.addEventListener('click', () => {
      this.panel?.classList.toggle('active');
    });

    // Setup right-click context menu on usernames in chat
    this.setupChatContextMenu();

    // If we have a token, validate it and check mod status
    if (this.config.accessToken) {
      this.validateAndSetup();
    }
  }

  private updateAuthIndicator(): void {
    if (!this.authIndicator) return;
    if (this.config.accessToken) {
      this.authIndicator.className = 'mod-auth-indicator authenticated';
      this.authIndicator.title = `Authenticated as ${this.config.username}`;
      this.authIndicator.textContent = '';
    } else {
      this.authIndicator.className = 'mod-auth-indicator';
      this.authIndicator.title = 'Not authenticated';
      this.authIndicator.textContent = '';
    }
  }

  private renderPanel(): void {
    if (!this.panel) return;

    if (!this.config.accessToken) {
      this.panel.innerHTML = `
        <div class="mod-panel-header">
          <span class="mod-panel-title">Mod Tools</span>
          <button class="mod-panel-close" tabindex="0" aria-label="Close mod panel">&times;</button>
        </div>
        <div class="mod-panel-content">
          <p class="mod-panel-info">Connect your Twitch account to enable chat and moderator tools.</p>
          <button class="mod-connect-btn" tabindex="0" aria-label="Connect Twitch account">Connect Twitch Account</button>
        </div>
      `;

      this.panel.querySelector('.mod-panel-close')?.addEventListener('click', () => {
        this.panel?.classList.remove('active');
      });

      this.panel.querySelector('.mod-connect-btn')?.addEventListener('click', () => {
        this.startOAuth();
      });
      return;
    }

    const modSection = this.config.isMod ? `
      <div class="mod-section">
        <div class="mod-section-title">Quick Timeout</div>
        <div class="mod-timeout-buttons">
          <button class="mod-action-btn" data-action="timeout" data-duration="1" aria-label="Timeout 1 second">1s</button>
          <button class="mod-action-btn" data-action="timeout" data-duration="10" aria-label="Timeout 10 seconds">10s</button>
          <button class="mod-action-btn" data-action="timeout" data-duration="60" aria-label="Timeout 1 minute">60s</button>
          <button class="mod-action-btn" data-action="timeout" data-duration="600" aria-label="Timeout 10 minutes">600s</button>
          <button class="mod-action-btn mod-ban-btn" data-action="ban" aria-label="Permanent ban">Ban</button>
        </div>
        <div class="mod-section-title" style="margin-top:12px">Chat Modes</div>
        <div class="mod-toggles">
          <button class="mod-toggle-btn" data-mode="slow" aria-label="Toggle slow mode">Slow Mode</button>
          <button class="mod-toggle-btn" data-mode="subscribers" aria-label="Toggle sub-only mode">Sub-Only</button>
          <button class="mod-toggle-btn" data-mode="emoteonly" aria-label="Toggle emote-only mode">Emote-Only</button>
          <button class="mod-toggle-btn" data-mode="followers" aria-label="Toggle follower-only mode">Follower-Only</button>
        </div>
      </div>
    ` : '<div class="mod-panel-info">You are not a moderator in this channel.</div>';

    this.panel.innerHTML = `
      <div class="mod-panel-header">
        <span class="mod-panel-title">Mod Tools</span>
        <span class="mod-mode-indicator">${this.config.isMod ? 'MOD MODE' : ''}</span>
        <button class="mod-panel-close" tabindex="0" aria-label="Close mod panel">&times;</button>
      </div>
      <div class="mod-panel-content">
        <div class="mod-user-info">
          <span>Logged in as <strong>${this.escapeHtml(this.config.username)}</strong></span>
          <button class="mod-disconnect-btn" tabindex="0" aria-label="Disconnect Twitch account">Disconnect</button>
        </div>
        ${modSection}
        <div class="mod-section">
          <div class="mod-section-title">Chat Input</div>
          <div class="mod-chat-input-wrapper">
            <input type="text" class="mod-chat-input" placeholder="Send a message..." maxlength="500" aria-label="Chat message input">
            <button class="mod-chat-send" aria-label="Send chat message">Send</button>
          </div>
        </div>
      </div>
    `;

    // Wire up event listeners
    this.panel.querySelector('.mod-panel-close')?.addEventListener('click', () => {
      this.panel?.classList.remove('active');
    });

    this.panel.querySelector('.mod-disconnect-btn')?.addEventListener('click', () => {
      this.disconnect();
    });

    // Timeout/Ban buttons - these need a target username
    this.panel.querySelectorAll('.mod-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const duration = btn.getAttribute('data-duration');
        const target = this.getTargetUsername();
        if (!target) {
          this.showModToast('Right-click a username in chat first');
          return;
        }
        if (action === 'timeout' && duration) {
          this.sendIRCCommand(`/timeout ${target} ${duration}`);
        } else if (action === 'ban') {
          this.sendIRCCommand(`/ban ${target}`);
        }
      });
    });

    // Chat mode toggles
    this.panel.querySelectorAll('.mod-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        if (!mode) return;
        const isActive = btn.classList.toggle('active');
        if (mode === 'slow') {
          this.sendIRCCommand(isActive ? '/slow 30' : '/slowoff');
        } else if (mode === 'subscribers') {
          this.sendIRCCommand(isActive ? '/subscribers' : '/subscribersoff');
        } else if (mode === 'emoteonly') {
          this.sendIRCCommand(isActive ? '/emoteonly' : '/emoteonlyoff');
        } else if (mode === 'followers') {
          this.sendIRCCommand(isActive ? '/followers 10' : '/followersoff');
        }
      });
    });

    // Chat input
    const chatInput = this.panel.querySelector('.mod-chat-input') as HTMLInputElement;
    const chatSend = this.panel.querySelector('.mod-chat-send');
    const sendChat = () => {
      const msg = chatInput?.value.trim();
      if (msg) {
        this.sendChatMessage(msg);
        if (chatInput) chatInput.value = '';
      }
    };
    chatSend?.addEventListener('click', sendChat);
    chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChat();
    });
  }

  private lastTargetUsername = '';

  private getTargetUsername(): string {
    return this.lastTargetUsername;
  }

  private setupChatContextMenu(): void {
    this.contextMenuHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const usernameEl = target.closest('.irc-chat-username') as HTMLElement;
      if (!usernameEl || !this.config.isMod) return;

      e.preventDefault();
      const username = usernameEl.textContent?.trim() || '';
      if (!username) return;
      this.lastTargetUsername = username.toLowerCase();

      // Remove existing context menu
      this.contextMenu?.remove();

      this.contextMenu = document.createElement('div');
      this.contextMenu.className = 'mod-context-menu';
      this.contextMenu.innerHTML = `
        <div class="mod-context-header">${this.escapeHtml(username)}</div>
        <button class="mod-context-item" data-cmd="/timeout ${username.toLowerCase()} 1">Timeout 1s</button>
        <button class="mod-context-item" data-cmd="/timeout ${username.toLowerCase()} 10">Timeout 10s</button>
        <button class="mod-context-item" data-cmd="/timeout ${username.toLowerCase()} 60">Timeout 1m</button>
        <button class="mod-context-item" data-cmd="/timeout ${username.toLowerCase()} 600">Timeout 10m</button>
        <button class="mod-context-item mod-context-ban" data-cmd="/ban ${username.toLowerCase()}">Ban</button>
      `;

      this.contextMenu.style.left = `${e.clientX}px`;
      this.contextMenu.style.top = `${e.clientY}px`;
      document.body.appendChild(this.contextMenu);

      this.contextMenu.querySelectorAll('.mod-context-item').forEach(item => {
        item.addEventListener('click', () => {
          const cmd = item.getAttribute('data-cmd');
          if (cmd) this.sendIRCCommand(cmd);
          this.contextMenu?.remove();
          this.contextMenu = null;
        });
      });

      // Close on click outside
      const closeMenu = (ev: MouseEvent) => {
        if (!this.contextMenu?.contains(ev.target as Node)) {
          this.contextMenu?.remove();
          this.contextMenu = null;
          document.removeEventListener('click', closeMenu);
        }
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 0);
    };

    this.chatContainer.addEventListener('contextmenu', this.contextMenuHandler);
  }

  private startOAuth(): void {
    // Build OAuth URL
    const redirectUri = chrome.identity?.getRedirectURL?.() || OAUTH_REDIRECT;
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(OAUTH_SCOPES)}`;

    // Use chrome.identity.launchWebAuthFlow if available (MV3)
    if (chrome.identity?.launchWebAuthFlow) {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        (responseUrl) => {
          if (chrome.runtime.lastError || !responseUrl) {
            this.showModToast('OAuth failed or was cancelled');
            return;
          }
          this.handleOAuthCallback(responseUrl);
        }
      );
    } else {
      // Fallback: open popup
      window.open(authUrl, '_blank', 'width=500,height=700');
      this.showModToast('Complete authentication in the popup window');
    }
  }

  private async handleOAuthCallback(url: string): Promise<void> {
    // Extract token from URL hash fragment
    const hashParams = new URLSearchParams(url.split('#')[1] || '');
    const token = hashParams.get('access_token');

    if (!token) {
      this.showModToast('Failed to get access token');
      return;
    }

    this.config.accessToken = token;

    // Validate token and get user info
    await this.validateAndSetup();
  }

  private async validateAndSetup(): Promise<void> {
    if (!this.config.accessToken) return;

    try {
      // Validate token
      const validateRes = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { 'Authorization': `OAuth ${this.config.accessToken}` },
      });

      if (!validateRes.ok) {
        // Token expired or invalid
        this.config.accessToken = null;
        chrome.storage.local.remove(['twitchOAuthToken', 'twitchOAuthUser', 'twitchOAuthUserId']);
        this.updateAuthIndicator();
        this.renderPanel();
        return;
      }

      const validateData = await validateRes.json();
      this.config.username = validateData.login || '';
      this.config.userId = validateData.user_id || '';

      // Store token
      chrome.storage.local.set({
        twitchOAuthToken: this.config.accessToken,
        twitchOAuthUser: this.config.username,
        twitchOAuthUserId: this.config.userId,
      });

      // Check mod status via GQL
      await this.checkModStatus();

      // Connect IRC with auth
      this.connectAuthenticatedIRC();

      // Update UI
      this.updateAuthIndicator();
      this.renderPanel();

      // Also update the chat input area to show write capability
      this.updateChatInputArea();
    } catch {
      // Token validation failed, fall back to anonymous
      this.config.accessToken = null;
      this.updateAuthIndicator();
      this.renderPanel();
    }
  }

  private async checkModStatus(): Promise<void> {
    if (!this.config.accessToken) return;

    try {
      const headers: Record<string, string> = {
        'Client-ID': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      };
      if (this.deviceId) {
        headers['X-Device-Id'] = this.deviceId;
      }
      if (this.config.accessToken) {
        headers['Authorization'] = `OAuth ${this.config.accessToken}`;
      }

      const query = `
        query UserModerationStatus($channelLogin: String!) {
          user(login: $channelLogin) {
            self {
              isModerator
            }
          }
        }
      `;

      const res = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          variables: { channelLogin: this.channel },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        this.config.isMod = data?.data?.user?.self?.isModerator === true;
      }
    } catch {
      this.config.isMod = false;
    }
  }

  private connectAuthenticatedIRC(): void {
    if (!this.config.accessToken || !this.config.username) return;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    this.ws.onopen = () => {
      if (!this.ws || !this.config.accessToken) return;
      this.ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      this.ws.send(`PASS oauth:${this.config.accessToken}`);
      this.ws.send(`NICK ${this.config.username}`);
      this.ws.send(`JOIN #${this.channel}`);
    };

    this.ws.onmessage = (event) => {
      const raw = event.data as string;
      const lines = raw.split('\r\n').filter(Boolean);
      for (const line of lines) {
        if (line.startsWith('PING')) {
          this.ws?.send('PONG :tmi.twitch.tv');
        }
      }
    };

    this.ws.onerror = () => {
      // Silent fallback
    };

    this.ws.onclose = () => {
      this.ws = null;
    };
  }

  sendChatMessage(message: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.showModToast('Not connected to chat');
      return;
    }
    this.ws.send(`PRIVMSG #${this.channel} :${message}`);
  }

  sendIRCCommand(command: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.showModToast('Not connected to chat');
      return;
    }
    // IRC commands are sent as messages
    this.ws.send(`PRIVMSG #${this.channel} :${command}`);
    this.showModToast(`Sent: ${command}`);
  }

  private updateChatInputArea(): void {
    if (!this.config.accessToken) return;
    const inputArea = this.chatContainer.querySelector('.irc-chat-input-area');
    if (!inputArea) return;

    inputArea.innerHTML = `
      <div class="mod-inline-chat">
        <input type="text" class="mod-inline-input" placeholder="Send a message..." maxlength="500" aria-label="Chat message">
        <button class="mod-inline-send" aria-label="Send">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    `;

    const input = inputArea.querySelector('.mod-inline-input') as HTMLInputElement;
    const send = inputArea.querySelector('.mod-inline-send');

    const doSend = () => {
      const msg = input?.value.trim();
      if (msg) {
        this.sendChatMessage(msg);
        if (input) input.value = '';
      }
    };

    send?.addEventListener('click', doSend);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSend();
    });
  }

  private showModToast(message: string): void {
    const video = this.container.querySelector('video');
    if (video) {
      video.dispatchEvent(new CustomEvent('twitch-show-toast', {
        detail: { message, type: 'info' },
      }));
    }
  }

  private disconnect(): void {
    this.config.accessToken = null;
    this.config.username = '';
    this.config.userId = '';
    this.config.isMod = false;

    chrome.storage.local.remove(['twitchOAuthToken', 'twitchOAuthUser', 'twitchOAuthUserId']);

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.updateAuthIndicator();
    this.renderPanel();

    // Restore anonymous chat input
    const inputArea = this.chatContainer.querySelector('.irc-chat-input-area');
    if (inputArea) {
      inputArea.innerHTML = `<span class="irc-chat-readonly">Read-only (anonymous)</span>`;
    }
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
    this.panel?.remove();
    this.modBtn?.remove();
    this.authIndicator?.remove();
    this.contextMenu?.remove();
    if (this.contextMenuHandler) {
      this.chatContainer.removeEventListener('contextmenu', this.contextMenuHandler);
    }
  }
}
