export interface LayoutPreset {
  name: string;
  label: string;
  chat: boolean;
  chatWidth: number;
  controlsAutoHide: boolean;
  miniControls: boolean;
  fullWidth: boolean;
  statsOverlay: boolean;
}

export const LAYOUT_PRESETS: Record<string, LayoutPreset> = {
  balanced: {
    name: 'balanced',
    label: 'Balanced',
    chat: true,
    chatWidth: 340,
    controlsAutoHide: true,
    miniControls: false,
    fullWidth: false,
    statsOverlay: true,
  },
  minimalist: {
    name: 'minimalist',
    label: 'Minimalist',
    chat: false,
    chatWidth: 0,
    controlsAutoHide: true,
    miniControls: true,
    fullWidth: false,
    statsOverlay: false,
  },
  chatFocused: {
    name: 'chatFocused',
    label: 'Chat Focused',
    chat: true,
    chatWidth: 480,
    controlsAutoHide: false,
    miniControls: false,
    fullWidth: false,
    statsOverlay: true,
  },
  theater: {
    name: 'theater',
    label: 'Theater',
    chat: false,
    chatWidth: 0,
    controlsAutoHide: true,
    miniControls: false,
    fullWidth: true,
    statsOverlay: true,
  },
};

export const PRESET_NAMES = Object.keys(LAYOUT_PRESETS);

export function applyLayoutPreset(
  hostElement: HTMLElement,
  chatContainer: HTMLElement,
  presetName: string
): void {
  const preset = LAYOUT_PRESETS[presetName] || LAYOUT_PRESETS.balanced;

  // Remove all layout classes
  hostElement.classList.remove(
    'layout-minimalist',
    'layout-chat-focused',
    'layout-theater',
    'layout-balanced'
  );

  // Add the current layout class
  hostElement.classList.add(`layout-${preset.name === 'chatFocused' ? 'chat-focused' : preset.name}`);

  // Chat visibility
  if (preset.chat) {
    chatContainer.classList.remove('hidden');
    chatContainer.style.width = `${preset.chatWidth}px`;
  } else {
    chatContainer.classList.add('hidden');
  }

  // Persist
  chrome.storage.sync.set({ layout: presetName });
}
