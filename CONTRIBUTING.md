# Contributing to Twitch Alternate Player

First off — thanks for taking the time to contribute! 🎉

This extension is built with TypeScript, React 18, and hls.js, targeting Chrome/Edge via Manifest V3. Contributions of all kinds are welcome: bug fixes, new features, documentation, theme presets, and more.

---

## Table of Contents

- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Guidelines](#coding-guidelines)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Getting Started

1. **Fork** this repository
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/Twitch-Alternate-Player.git
   cd Twitch-Alternate-Player
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Start the dev build:**
   ```bash
   npm run dev
   ```
5. Load `dist/` as an unpacked extension in `chrome://extensions/` with Developer Mode on.

---

## How to Contribute

| Contribution type | Where to start |
|---|---|
| 🐛 Bug fix | Check [open issues](../../issues?q=is%3Aopen+label%3Abug), or open a new one |
| ✨ New feature | Open a [Feature Request](../../issues/new?template=feature_request.md) first and discuss |
| 🎨 New theme preset | Add to `src/content/player/ThemeManager.ts` — see [Adding a Theme](#adding-a-theme) |
| 📝 Docs improvement | Edit `README.md` or `CONTRIBUTING.md` directly |
| ♿ Accessibility | Open an issue tagged `accessibility` |
| 🧹 Refactor / cleanup | Open an issue first to discuss scope |

### Good First Issues

Look for issues labelled [`good first issue`](../../issues?q=is%3Aopen+label%3A%22good+first+issue%22) — these are intentionally scoped to be approachable.

---

## Development Setup

### Prerequisites

- Node.js ≥ 18
- Chrome or Edge (any Chromium-based browser)
- Basic familiarity with Chrome Extension APIs (MV3)

### Commands

```bash
npm run dev      # Watch mode — rebuilds on every file save
npm run build    # Production build to dist/
```

### Workflow

1. Make changes in `src/`
2. Webpack rebuilds automatically in `dev` mode
3. Go to `chrome://extensions/` → click the refresh icon on the extension
4. Reload the Twitch tab to pick up content script changes

> **Tip:** Background service worker changes require a full extension reload. Content script changes only need a tab reload.

---

## Project Structure

```
src/
├── background/           # MV3 service worker
│   ├── index.ts          # Message bus, stream token cache
│   └── twitch-api.ts     # Twitch GQL + HLS URL resolution
│
├── content/              # Injected into twitch.tv
│   ├── index.ts          # Mount/unmount logic
│   └── player/
│       ├── VideoCore.ts          # hls.js playback engine
│       ├── ControlsUI.ts         # Player controls bar
│       ├── PlayerContainer.ts    # Root layout orchestration
│       ├── TwitchChat.ts         # IRC WebSocket + message rendering
│       ├── EmoteManager.ts       # BTTV / FFZ / 7TV emote APIs
│       ├── MultiStreamManager.ts # Multi-stream grid (up to 4)
│       ├── ModTools.ts           # Channel moderation panel
│       ├── ThemeManager.ts       # CSS variable theme engine
│       ├── ChannelSettings.ts    # Per-channel settings
│       ├── LayoutPresets.ts      # Layout mode definitions
│       ├── ToastManager.ts       # Toast notifications
│       ├── PublicAPI.ts          # window.__twitchAltPlayer API
│       └── player.css            # All styles
│
├── popup/                # React 18 settings popup
└── popout/               # Standalone popout player
```

---

## Coding Guidelines

- **TypeScript strictly** — no `any` types without a comment explaining why
- **No external runtime dependencies** beyond what's already in `package.json` (keep the extension lightweight)
- **Follow existing patterns** — each module is a class; keep responsibilities focused
- **`chrome.storage.sync`** for all persisted settings — never `localStorage` (blocked in extension sandboxes)
- **Error handling** — always log `err?.message || String(err)` in catch blocks, never `[object Object]`
- **Accessibility** — new interactive elements must have `aria-label`, keyboard support, and visible focus rings
- **CSS** — add new styles to `player.css` using existing CSS variables (`--accent-color`, `--chat-bg`, etc.)

### Adding a Theme Preset

1. Open `src/content/player/ThemeManager.ts`
2. Add a new entry to `THEME_PRESETS`:
   ```ts
   'my-theme': {
     name: 'my-theme',
     label: 'My Theme',
     vars: {
       '--accent-color': '#yourcolor',
       '--player-bg': '#000',
       '--chat-bg': '#yourcolor',
       '--chat-font-size': '13px',
       '--chat-spacing': '3px',
       '--ui-opacity': '0.7',
     },
   },
   ```
3. The popup dropdown will pick it up automatically via `THEME_PRESET_NAMES`.

---

## Submitting a Pull Request

1. **Branch off `master`** with a descriptive name:
   ```bash
   git checkout -b fix/chat-emote-rendering
   git checkout -b feat/new-layout-preset
   ```
2. **Keep PRs focused** — one feature or fix per PR. Stacked changes are harder to review.
3. **Fill out the PR template** — describe what changed and why.
4. **Test manually** before submitting:
   - Load the extension, navigate to a live Twitch stream
   - Verify your change works end-to-end
   - Check that nothing you didn't touch is broken
5. **Link any related issue** in the PR description (`Closes #123`).

PRs are reviewed as time allows. Small, well-scoped PRs get merged faster.

---

## Reporting Bugs

Open a [Bug Report](../../issues/new?template=bug_report.md) with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser and OS version
- Any errors from the browser console (`F12` → Console tab)

---

## Requesting Features

Open a [Feature Request](../../issues/new?template=feature_request.md) with:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered

Big features should be discussed in an issue before a PR is opened.

---

## Questions?

Open a [Discussion](../../discussions) or drop a comment on any related issue.
