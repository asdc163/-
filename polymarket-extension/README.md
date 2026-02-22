# Polymarket Radar — Chrome Extension

Automatically detects relevant [Polymarket](https://polymarket.com) prediction markets while you browse **Twitter/X** and **YouTube**. A smart sidebar appears with active markets related to what you're reading or watching, so you can place bets without switching tabs.

## Features

- **Auto-detection**: Scans visible content (tweets, video titles) for keywords every 8 seconds
- **Smart search**: Uses Polymarket's search API + volume-based fallback for relevance
- **Active markets only**: Filters out closed and resolved markets — only shows live, tradable ones
- **Real-time odds**: Shows Yes/No probabilities as visual progress bars
- **Volume + time**: Displays 24h volume and days remaining for each market
- **Manual search**: Popup lets you search any topic directly
- **Shadow DOM**: Overlay is isolated from page styles to avoid conflicts
- **Debounced**: Won't spam the API — waits for keyword changes to settle

## Supported Sites

| Site | Detection Method |
|------|-----------------|
| Twitter / X | Visible tweet text (`[data-testid="tweetText"]`) |
| YouTube | Video title, channel name, description |

## How It Works

```
Page Content
    ↓
Keyword Extractor (stop-word filtering, frequency ranking)
    ↓
Polymarket Search API (gamma-api.polymarket.com/search)
    ↓ fallback ↓
Trending Events (volume-filtered, keyword-matched client-side)
    ↓
Overlay Sidebar (Shadow DOM, auto-opens on results)
```

## Build & Install

```bash
cd polymarket-extension
npm install
npm run build
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

## Project Structure

```
polymarket-extension/
├── manifest.json              # Chrome MV3 manifest
├── build.mjs                  # Custom build script (esbuild + Vite)
├── vite.config.ts             # Popup build config
├── src/
│   ├── background/
│   │   └── service-worker.ts  # Background worker (caching)
│   ├── content/
│   │   ├── index.ts           # Content script entry
│   │   ├── keywords.ts        # Stop-word filtering & keyword extraction
│   │   ├── overlay.ts         # Shadow DOM sidebar UI
│   │   └── extractors/
│   │       ├── twitter.ts     # Twitter/X DOM extraction
│   │       └── youtube.ts     # YouTube DOM extraction
│   ├── popup/
│   │   ├── App.tsx            # Popup React app
│   │   └── main.tsx
│   └── shared/
│       ├── polymarket-api.ts  # Gamma API client
│       └── types.ts
└── public/
    └── icons/                 # Extension icons (16, 48, 128px)
```

## API

Uses **Polymarket Gamma API** (public, no auth required):
- `GET https://gamma-api.polymarket.com/search?query={keywords}` — keyword search
- `GET https://gamma-api.polymarket.com/events?active=true&closed=false&order=volume24hr` — trending fallback

## Notes

- No API key or wallet connection required for market discovery
- Betting links open directly on [polymarket.com](https://polymarket.com)
- Background service worker caches results for 60 seconds to avoid redundant calls
