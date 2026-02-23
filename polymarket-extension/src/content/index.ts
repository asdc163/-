/**
 * Content script for Twitter/X and YouTube.
 *
 * Extracts keywords from the current page, searches Polymarket,
 * and shows a floating overlay with relevant markets.
 *
 * Betting from the overlay opens the market directly on Polymarket —
 * the popup is the right place for in-extension quick ordering.
 */

import { extractFromTwitter } from './extractors/twitter';
import { extractFromYouTube } from './extractors/youtube';
import { PolymarketOverlay } from './overlay';
import type { PolymarketMarket } from '../shared/types';

const POLL_INTERVAL_MS = 8_000;
const DEBOUNCE_MS = 1_500;

type Extractor = () => string[];

function getExtractor(): Extractor | null {
  const host = window.location.hostname;
  if (host.includes('twitter.com') || host.includes('x.com')) return extractFromTwitter;
  if (host.includes('youtube.com')) return extractFromYouTube;
  return null;
}

function keywordsChanged(prev: string[], next: string[]): boolean {
  if (prev.length !== next.length) return true;
  return prev.some((k, i) => k !== next[i]);
}

// ─── Main init ────────────────────────────────────────────────────────────

async function init() {
  const extractor = getExtractor();
  if (!extractor) return;

  const overlay = new PolymarketOverlay();
  overlay.mount();

  // Bet from overlay → open market on polymarket.com
  // (quick ordering is done via the extension popup)
  overlay.onBet = async (market: PolymarketMarket, _outcome: 'Yes' | 'No') => {
    window.open(market.url, '_blank');
  };

  // ── Market search logic ─────────────────────────────────────────────────

  let lastKeywords: string[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isFetching = false;

  async function fetchMarkets(keywords: string[]) {
    if (isFetching) return;
    isFetching = true;
    overlay.setLoading(keywords);
    try {
      const response = await new Promise<{
        type: string;
        result?: { markets: PolymarketMarket[]; keywords: string[] };
        error?: string;
      }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'SEARCH_MARKETS', keywords },
          (res: { type: string; result?: { markets: PolymarketMarket[]; keywords: string[] }; error?: string }) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(res);
            }
          }
        );
      });

      if (response.type === 'SEARCH_RESULT' && response.result) {
        overlay.setMarkets(response.result.markets, response.result.keywords);
      } else if (response.type === 'SEARCH_ERROR') {
        overlay.setError(response.error ?? 'Search failed');
      }
    } catch (err) {
      console.error('[PolymarketRadar] Search error:', err);
      overlay.setError('Failed to load markets.');
    } finally {
      isFetching = false;
    }
  }

  function onKeywordsUpdated(keywords: string[]) {
    if (!keywordsChanged(lastKeywords, keywords)) return;
    lastKeywords = keywords;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (keywords.length > 0) fetchMarkets(keywords);
    }, DEBOUNCE_MS);
  }

  // Initial scan
  const initialKws = extractor();
  if (initialKws.length > 0) onKeywordsUpdated(initialKws);

  // Polling loop
  setInterval(() => onKeywordsUpdated(extractor()), POLL_INTERVAL_MS);

  // YouTube SPA navigation
  if (window.location.hostname.includes('youtube.com')) {
    let lastUrl = window.location.href;
    new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(() => onKeywordsUpdated(extractor()), 2000);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // Twitter/X timeline updates
  if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) {
    const main = document.querySelector('main');
    if (main) {
      new MutationObserver(() => onKeywordsUpdated(extractor()))
        .observe(main, { childList: true, subtree: false });
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
