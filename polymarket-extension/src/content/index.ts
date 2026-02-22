import { extractFromTwitter } from './extractors/twitter';
import { extractFromYouTube } from './extractors/youtube';
import { PolymarketOverlay } from './overlay';
import { searchMarkets } from '../shared/polymarket-api';

const POLL_INTERVAL_MS = 8_000;   // Scan every 8s
const DEBOUNCE_MS = 1_500;        // Wait 1.5s after last keyword change before fetching

type Extractor = () => string[];

function getExtractor(): Extractor | null {
  const host = window.location.hostname;
  if (host.includes('twitter.com') || host.includes('x.com')) {
    return extractFromTwitter;
  }
  if (host.includes('youtube.com')) {
    return extractFromYouTube;
  }
  return null;
}

function keywordsChanged(prev: string[], next: string[]): boolean {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) return true;
  }
  return false;
}

async function init() {
  const extractor = getExtractor();
  if (!extractor) return;

  const overlay = new PolymarketOverlay();
  overlay.mount();

  let lastKeywords: string[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isFetching = false;

  async function fetchMarkets(keywords: string[]) {
    if (isFetching) return;
    isFetching = true;
    overlay.setLoading(keywords);
    try {
      const markets = await searchMarkets(keywords);
      overlay.setMarkets(markets, keywords);
    } catch (err) {
      console.error('[PolymarketRadar] API error:', err);
      overlay.setError('Failed to load markets. Please try again.');
    } finally {
      isFetching = false;
    }
  }

  function onKeywordsUpdated(keywords: string[]) {
    if (!keywordsChanged(lastKeywords, keywords)) return;
    lastKeywords = keywords;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (keywords.length > 0) {
        fetchMarkets(keywords);
      }
    }, DEBOUNCE_MS);
  }

  // Initial scan
  const initialKws = extractor();
  if (initialKws.length > 0) onKeywordsUpdated(initialKws);

  // Polling loop
  setInterval(() => {
    const kws = extractor();
    onKeywordsUpdated(kws);
  }, POLL_INTERVAL_MS);

  // For YouTube: also watch for navigation (SPA route changes)
  if (window.location.hostname.includes('youtube.com')) {
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        // After navigation, wait for DOM to settle
        setTimeout(() => {
          const kws = extractor();
          if (kws.length > 0) onKeywordsUpdated(kws);
        }, 2000);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // For Twitter: watch for timeline updates
  if (
    window.location.hostname.includes('twitter.com') ||
    window.location.hostname.includes('x.com')
  ) {
    const observer = new MutationObserver(() => {
      const kws = extractor();
      onKeywordsUpdated(kws);
    });

    // Observe the main timeline container
    const main = document.querySelector('main');
    if (main) {
      observer.observe(main, { childList: true, subtree: false });
    }
  }
}

// Run after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
