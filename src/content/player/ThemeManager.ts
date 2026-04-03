export interface ThemeConfig {
  preset: string;
  custom: {
    accentColor?: string;
    playerBg?: string;
    chatBg?: string;
    chatFontSize?: string;
    chatSpacing?: string;
    uiOpacity?: string;
  };
}

export interface ThemePreset {
  name: string;
  label: string;
  vars: Record<string, string>;
}

export const THEME_PRESETS: Record<string, ThemePreset> = {
  'twitch-dark': {
    name: 'twitch-dark',
    label: 'Twitch Dark',
    vars: {
      '--accent-color': '#9146FF',
      '--player-bg': '#000',
      '--chat-bg': '#18181b',
      '--chat-font-size': '13px',
      '--chat-spacing': '3px',
      '--ui-opacity': '0.7',
    },
  },
  'twitch-light': {
    name: 'twitch-light',
    label: 'Twitch Light',
    vars: {
      '--accent-color': '#9146FF',
      '--player-bg': '#000',
      '--chat-bg': '#f7f7f8',
      '--chat-font-size': '13px',
      '--chat-spacing': '4px',
      '--ui-opacity': '0.85',
    },
  },
  'oled-black': {
    name: 'oled-black',
    label: 'OLED Black',
    vars: {
      '--accent-color': '#9146FF',
      '--player-bg': '#000',
      '--chat-bg': '#000000',
      '--chat-font-size': '13px',
      '--chat-spacing': '3px',
      '--ui-opacity': '0.6',
    },
  },
  'high-contrast': {
    name: 'high-contrast',
    label: 'High Contrast',
    vars: {
      '--accent-color': '#FFD700',
      '--player-bg': '#000',
      '--chat-bg': '#000000',
      '--chat-font-size': '14px',
      '--chat-spacing': '4px',
      '--ui-opacity': '1',
    },
  },
};

export const THEME_PRESET_NAMES = Object.keys(THEME_PRESETS);

export class ThemeManager {
  private hostElement: HTMLElement;

  constructor(hostElement: HTMLElement) {
    this.hostElement = hostElement;
  }

  applyTheme(config: ThemeConfig): void {
    const preset = THEME_PRESETS[config.preset] || THEME_PRESETS['twitch-dark'];

    // Apply preset vars
    for (const [key, value] of Object.entries(preset.vars)) {
      this.hostElement.style.setProperty(key, value);
    }

    // Apply custom overrides
    if (config.custom.accentColor) {
      this.hostElement.style.setProperty('--accent-color', config.custom.accentColor);
    }
    if (config.custom.playerBg) {
      this.hostElement.style.setProperty('--player-bg', config.custom.playerBg);
    }
    if (config.custom.chatBg) {
      this.hostElement.style.setProperty('--chat-bg', config.custom.chatBg);
    }
    if (config.custom.chatFontSize) {
      this.hostElement.style.setProperty('--chat-font-size', config.custom.chatFontSize);
    }
    if (config.custom.chatSpacing) {
      this.hostElement.style.setProperty('--chat-spacing', config.custom.chatSpacing);
    }
    if (config.custom.uiOpacity) {
      this.hostElement.style.setProperty('--ui-opacity', config.custom.uiOpacity);
    }

    // Apply chat-specific styles that use the CSS variables
    const chatContainer = this.hostElement.querySelector('.chat-container') as HTMLElement;
    if (chatContainer) {
      chatContainer.style.background = `var(--chat-bg)`;
    }

    const chatMsgs = this.hostElement.querySelectorAll('.irc-chat-msg');
    chatMsgs.forEach((msg) => {
      (msg as HTMLElement).style.fontSize = `var(--chat-font-size)`;
      (msg as HTMLElement).style.padding = `var(--chat-spacing) 4px`;
    });

    // Special handling for light theme
    if (config.preset === 'twitch-light') {
      this.hostElement.classList.add('theme-light');
    } else {
      this.hostElement.classList.remove('theme-light');
    }

    // High contrast mode
    if (config.preset === 'high-contrast') {
      this.hostElement.classList.add('theme-high-contrast');
    } else {
      this.hostElement.classList.remove('theme-high-contrast');
    }
  }

  loadAndApply(): void {
    chrome.storage.sync.get(['theme'], (data) => {
      const config: ThemeConfig = data.theme || { preset: 'twitch-dark', custom: {} };
      this.applyTheme(config);
    });
  }

  static saveTheme(config: ThemeConfig): void {
    chrome.storage.sync.set({ theme: config });
  }
}
