# 🎮 Twitch Alternate Player

> A feature-rich browser extension that replaces Twitch's native player with a fully custom, ad-filtered, and deeply customizable viewing experience.

![Chrome/Edge](https://img.shields.io/badge/Browser-Chrome%20%7C%20Edge-blue?logo=googlechrome&logoColor=white)
![TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/Popup-React%2018-61DAFB?logo=react&logoColor=black)
![hls.js](https://img.shields.io/badge/Streaming-hls.js-FF6600)
![License](https://img.shields.io/badge/License-MIT-green)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)
[![Latest Release](https://img.shields.io/github/v/release/Allrounder687/Twitch-Alternate-Player?label=latest%20release&color=blueviolet)](https://github.com/Allrounder687/Twitch-Alternate-Player/releases/latest)

---

## ✨ What It Does

Twitch Alternate Player intercepts Twitch stream playlists via a Manifest V3 background service worker, filters ad segments before playback, and injects a fully custom player, chat, and controls interface into any Twitch page. Everything runs locally — no servers, no proxies.

---

## 📦 Installation

### ⭐ Option 1: Download the Pre-Built Release (Recommended)

> No build tools or Node.js required.

1. Go to the **[Releases page](https://github.com/Allrounder687/Twitch-Alternate-Player/releases/latest)**
2. Download **`twitch-alternate-player-vX.X.X.zip`** under **Assets**
3. Extract the zip to any folder on your computer
4. Open **Chrome** or **Edge** and navigate to:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
5. Enable **Developer Mode** using the toggle in the top-right corner
6. Click **"Load unpacked"** and select the folder you extracted
7. The extension icon will appear in your toolbar — click it, enter a Twitch channel name, and enable the player

> ⚠️ **Why "Developer Mode"?** This extension is not on the Chrome Web Store, so it must be side-loaded. Developer Mode is safe — it simply allows loading extensions from local folders.

---

### 🔧 Option 2: Build from Source

For developers who want to modify or contribute to the extension.

**Prerequisites:** Node.js ≥ 18, Chrome or Edge

```bash
# 1. Clone the repository
git clone https://github.com/Allrounder687/Twitch-Alternate-Player.git
cd Twitch-Alternate-Player

# 2. Install dependencies
npm install

# 3. Build the extension
npm run build
```

Then follow steps 4–7 from Option 1, selecting the `dist/` folder instead of the extracted zip.

---

### 🔄 Updating the Extension

When a new release is available:
1. Download the new zip from the [Releases page](https://github.com/Allrounder687/Twitch-Alternate-Player/releases/latest)
2. Extract it, **replacing the contents of your existing folder**
3. Go to `chrome://extensions/` and click the **refresh icon** on the extension card

---

## 🚀 Features

### 🎬 Video Player
- **HLS-based custom player** powered by [hls.js](https://github.com/video-dev/hls.js), bypassing Twitch's native player entirely
- **Ad segment filtering** — intercepts the stream M3U8 playlist and strips ad markers before the player loads them
- **Adjustable quality** — Auto, 1080p60, 720p60, 480p, 360p, Audio Only
- **3-tier latency control** — Ultra Low, Balanced, Stable — with migration support from legacy boolean settings
- **Stream URL pre-fetching & caching** — the background worker caches stream tokens for 10 minutes to reduce load times
- **Popout player** — detach the player into a standalone 640×360 popup window

### 💬 Chat
- **Custom IRC-based chat** built from scratch — connects directly to Twitch IRC over WebSocket
- **BTTV, FFZ, and 7TV emote support** — all three providers toggleable independently
- **Username highlight** — auto-detects your Twitch username or lets you set it manually for @mention highlighting
- **Chat sidebar toggle** — show or hide at will

### 🖥️ Multi-Stream (Up to 4 Simultaneous)
- Watch up to **4 streams at once** in an auto-adapting grid layout
- **One audio source at a time** — click any stream or press **1–4** to switch audio focus
- Per-stream volume sliders and play/pause controls
- Sessions persist across page reloads via `chrome.storage.sync`

### 🛠️ Mod Tools
- Full in-player moderation panel for channels you moderate
- Dedicated `ModTools.ts` module (~22KB) with mod actions integrated directly into the player UI

### ⚙️ Per-Channel Settings
- Settings are **saved per-channel** when changed while watching — quality, volume, latency mode, layout
- Channel-specific settings override global defaults
- "Reset to Defaults" button available directly in the popup for any channel

### 🎨 Theme System
| Preset | Description |
|---|---|
| **Twitch Dark** | Default Twitch purple dark theme |
| **Twitch Light** | Light mode with Twitch branding |
| **OLED Black** | True black for OLED screens |
| **High Contrast** | Gold accent, maximum contrast for accessibility |

Beyond presets, you can customize:
- **Accent color** — color picker + hex input
- **Chat font size** — 10px–20px slider
- **Chat spacing** — Compact / Normal / Cozy

### 🏗️ Layout Presets
| Layout | Behavior |
|---|---|
| **Balanced** | Standard side-by-side player and chat |
| **Minimalist** | Minimal UI chrome, more video space |
| **Chat Focused** | Chat takes priority in the layout |
| **Theater** | Wide player, chat collapsed or floating |

### ⌨️ Keyboard Shortcuts
| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `M` | Toggle Mute |
| `F` | Toggle Fullscreen |
| `T` | Toggle Theater mode |
| `C` | Cycle Layout Presets |
| `J` / `L` | Seek −10s / +10s |
| `↑` / `↓` | Volume Up / Down |
| `1` – `4` | Switch audio focus in multi-stream view |

### 🤖 Automation
- **Auto-Claim Channel Points** — automatically clicks the bonus chest when it appears
- **Ad notifications** — optional toast notification when an ad segment is detected and filtered

---

## 💻 Development

```bash
# Watch mode — auto-rebuilds on file changes
npm run dev
```

Then load the `dist/` folder as an unpacked extension. The extension will reflect changes after a page reload.

> **Tip:** Background service worker changes require a full extension reload (`chrome://extensions/` → refresh icon). Content script changes only need a Twitch tab reload.

### Creating a Release

Push a version tag and GitHub Actions will automatically build the extension and attach the zip to a new GitHub Release:

```bash
git tag v2.1.0
git push origin v2.1.0
```

The workflow in `.github/workflows/release.yml` will run `npm run build`, zip the `dist/` folder, and publish the release within ~2 minutes.

---

## 🧩 Architecture

The extension is structured as a standard Manifest V3 Chrome extension with four build entry points:

```
src/
├── background/          # Service worker (MV3)
│   ├── index.ts         # Message handling, stream token cache, tab injection
│   └── twitch-api.ts    # Twitch API — stream token + HLS URL resolution
│
├── content/             # Injected into twitch.tv pages
│   ├── index.ts         # Entry point — mounts/unmounts the player
│   └── player/
│       ├── VideoCore.ts         # HLS playback engine (hls.js wrapper)
│       ├── ControlsUI.ts        # Custom player control bar
│       ├── PlayerContainer.ts   # Root container, layout orchestration
│       ├── TwitchChat.ts        # IRC WebSocket chat + message rendering
│       ├── EmoteManager.ts      # BTTV / FFZ / 7TV emote fetching & caching
│       ├── MultiStreamManager.ts # Up to 4 simultaneous stream grid
│       ├── ModTools.ts          # Channel moderation panel
│       ├── ThemeManager.ts      # CSS variable-based theme engine
│       ├── ChannelSettings.ts   # Per-channel settings persistence
│       ├── LayoutPresets.ts     # Layout mode definitions
│       ├── ToastManager.ts      # In-player toast notifications
│       ├── PublicAPI.ts         # Exposed API for external tool integration
│       └── player.css           # All player/chat/controls styles (~35KB)
│
├── popup/               # Extension popup (React 18)
│   ├── index.tsx        # Full settings UI
│   ├── index.html
│   └── index.css
│
└── popout/              # Standalone popout player window
```

**Data flow:**
1. User opens Twitch → content script injected → checks `chrome.storage.sync` for `isEnabled`
2. If enabled, `PlayerContainer` mounts the custom player, hides Twitch’s native UI
3. Background worker fetches stream token → constructs HLS M3U8 URL
4. `VideoCore` initializes `hls.js`, loads the stream, filters ad segments
5. `TwitchChat` connects to Twitch IRC via WebSocket, renders messages with emotes
6. All settings changes in the popup sync instantly via `chrome.storage.sync.onChanged`

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5 |
| Bundler | Webpack 5 |
| Popup UI | React 18 |
| Stream Playback | hls.js 1.6 |
| Extension API | Chrome MV3 |
| Chat Protocol | Twitch IRC over WebSocket |
| Emotes | BTTV API, FFZ API, 7TV API |
| Storage | `chrome.storage.sync` |

---

## 🤝 Contributing

Contributions are welcome and appreciated! Whether it’s a bug fix, a new theme preset, a new layout, or a feature — all PRs are considered.

**Quick start:**

```bash
# 1. Fork the repo and clone your fork
git clone https://github.com/<your-username>/Twitch-Alternate-Player.git

# 2. Create a branch
git checkout -b feat/my-improvement

# 3. Make changes, build, and test
npm run dev

# 4. Push and open a Pull Request
```

Please read **[CONTRIBUTING.md](./CONTRIBUTING.md)** for full guidelines including:
- Coding standards and TypeScript conventions
- How to add a new theme preset (it’s easy!)
- PR checklist and review process
- How to report bugs and request features

### Good First Issues

New to the codebase? Look for issues labelled [`good first issue`](../../issues?q=is%3Aopen+label%3A%22good+first+issue%22) — these are scoped to be approachable without deep context.

### Areas That Need Help

- 🧪 **Testing** — the test infrastructure is minimal; help adding proper unit/integration tests is very welcome
- 🎨 **New theme presets** — creative themes (e.g. Catppuccin, Nord, Dracula) are easy to add and great for first contributions
- 🇦🇨 **i18n / localization** — the UI is English-only today
- 📄 **Docs** — screenshots, GIFs, wiki pages, anything that helps new users get started faster
- 🔍 **Bug reports** — if something doesn’t work on your stream or browser version, please open an issue

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.
