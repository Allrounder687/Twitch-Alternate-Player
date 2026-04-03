# Project Structure

## Directory Organization

```
twitch-player-extension/
├── .kiro/                  # Kiro AI assistant configuration
├── node_modules/           # NPM dependencies (not tracked in git)
├── public/                 # Static assets copied to dist
│   ├── icons/              # Extension icons in various sizes
│   └── manifest.json       # Chrome extension manifest
├── src/                    # Source code
│   ├── background/         # Background service worker
│   │   └── index.ts        # Entry point for background script
│   ├── content/            # Content scripts injected into Twitch pages
│   │   └── index.ts        # Entry point for content scripts
│   └── popup/              # Extension popup UI
│       ├── components/     # React components
│       ├── hooks/          # Custom React hooks
│       ├── styles/         # CSS styles
│       ├── index.html      # Popup HTML template
│       └── index.tsx       # Popup entry point
├── dist/                   # Build output (not tracked in git)
├── package.json            # NPM package configuration
├── package-lock.json       # NPM dependency lock file
├── tsconfig.json           # TypeScript configuration
├── webpack.config.js       # Webpack build configuration
└── README.md               # Project documentation
```

## Key Files

- **webpack.config.js**: Defines build process and entry points
- **tsconfig.json**: TypeScript compiler configuration
- **package.json**: Project metadata and scripts
- **public/manifest.json**: Chrome extension configuration
- **src/background/index.ts**: Background service worker entry point
- **src/content/index.ts**: Content script entry point
- **src/popup/index.tsx**: Popup UI entry point

## Code Organization Patterns

### Component Structure
- React components should be organized in a feature-based structure
- Each component should have its own directory with related files
- Components should follow the single responsibility principle

### File Naming Conventions
- React components: PascalCase (e.g., `PlayerControls.tsx`)
- Utility files: camelCase (e.g., `videoUtils.ts`)
- Test files: Same name as the file they test with `.test` or `.spec` suffix
- CSS modules: Same name as the component they style (e.g., `PlayerControls.module.css`)

### Import Order
1. External libraries (React, etc.)
2. Internal modules/components
3. Assets (images, styles)
4. Types and interfaces

### Extension-specific Organization
- Background scripts handle global state and browser API interactions
- Content scripts interact with the Twitch.tv page DOM
- Popup provides user interface for configuration
- Shared utilities and types should be in dedicated folders