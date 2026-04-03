# Twitch Player Extension

An alternative player for Twitch.tv that provides a customizable viewing experience with additional features.

## Features

- Customizable video player interface
- Adjustable video quality
- Volume control
- Lightweight and fast
- No ads (when used with appropriate stream sources)

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Build the extension:
   ```
   npm run build
   ```
4. Load the extension in Chrome/Edge:
   - Open `chrome://extensions/` or `edge://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` directory

## Development

1. Start the development server:
   ```
   npm run dev
   ```
2. Load the extension in your browser as described above
3. The extension will automatically reload when you make changes

## Usage

1. Click the extension icon in your browser toolbar
2. Enter a Twitch streamer's name
3. Adjust the volume and quality settings
4. Toggle the switch to enable/disable the custom player

## Building for Production

```
npm run build
```

This will create a production-ready build in the `dist` directory.

## License

MIT
