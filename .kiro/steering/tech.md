# Technical Stack & Build System

## Core Technologies
- TypeScript (ES6+)
- React 18
- Chrome Extension Manifest V3
- Webpack 5

## Key Dependencies
- React & React DOM (v18.2.0)
- TypeScript (v5.0.0)
- Chrome Types (@types/chrome v0.0.220)
- Webpack and related plugins

## Project Build System
The project uses Webpack for bundling and building the extension:
- Entry points are defined for popup, content script, and background service worker
- TypeScript compilation via ts-loader
- CSS processing with style-loader and css-loader
- Asset handling for images and other resources
- HTML generation with HtmlWebpackPlugin
- Static file copying with CopyWebpackPlugin

## TypeScript Configuration
- Target: ES6
- Strict type checking enabled
- React JSX support
- Chrome types included

## Common Commands

### Installation
```
npm install
```

### Development
```
npm run dev
```
Runs webpack in watch mode for development, automatically rebuilding on changes.

```
npm start
```
Starts webpack-dev-server on port 3000 with hot reloading.

### Production Build
```
npm run build
```
Creates a production-optimized build in the `dist` directory.

## Browser Extension Structure
- **Background Service Worker**: Handles extension lifecycle and background tasks
- **Content Scripts**: Inject code into Twitch.tv pages
- **Popup**: User interface for the extension
- **Manifest**: Configuration for Chrome/Edge extension API

## Testing & Debugging
Load the unpacked extension from the `dist` directory in developer mode:
- Open `chrome://extensions/` or `edge://extensions/`
- Enable "Developer mode"
- Click "Load unpacked" and select the `dist` directory