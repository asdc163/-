/**
 * Content script — Twitter/X and YouTube.
 *
 * Extracts keywords from the current page → searches Polymarket via background →
 * displays results in a floating overlay.
 *
 * YES/NO click flow:
 *  1. Store {market, outcome} in chrome.storage.local as "pending trade"
 *  2. Show "Tap 🎯 toolbar icon to confirm" banner in overlay
 *  3. Popup reads the pending trade on next open → auto-fills the order panel
 *
 * Timing design:
 *  - DEBOUNCE_MS:      waits for content to settle before searching
 *  - POLL_INTERVAL_MS: periodic refresh while tab is visible
 *  - STALE_MS:         forces a re-search if tab was hidden and user returns
 *  - Polling pauses while tab is hidden (saves API quota + battery)
 *  - Service-worker restarts (Chrome kills idle SW after ~30s) are retried once
 */

import { extractFromTwitter } from './extractors/twitter';
import { extractFromYouTube } from './extractors/youtube';
import { PolymarketOverlay } from './overlay';
import type { PolymarketMarket } from '../shared/types';
import { detectLang, LangCode } from '../shared/i18n';

const POLL_INTERVAL_MS = 15_000; // Poll every 15s while visible
const DEBOUNCE_MS      =  2_000; // Wait 2s after keyword change
const STALE_MS         = 45_000; // Re-search after 45s hidden+returned

// Pending trade TTL: popup must pick it up within 5 minutes
const PENDING_TTL_MS = 5 * 60 * 1000;

type Extractor = () => string[];

function getExtractor(): Extractor | null {
  const h = window.location.hostname;
  if (h.includes('twitter.com') || h.includes('x.com')) return extractFromTwitter;
  if (h.includes('youtube.com')) return extractFromYouTube;
  return null;
}

function keywordsKey(kws: string[]): string { return kws.join('\x00'); }

// ─── Main init ────────────────────────────────────────────────────────────────

async function init() {
  const extractorOrNull = getExtractor();
  if (!extractorOrNull) return;
  const extractor: Extractor = extractorOrNull;

  // Read stored language preference; fall back to browser locale
  const storedData = await chrome.storage.local.get('pm_lang');
  const lang: LangCode = (storedData.pm_lang as LangCode) ?? detectLang(navigator.language);

  const overlay = new PolymarketOverlay(lang);
  overlay.mount();

  // ── YES/NO bet handler ───────────────────────────────────────────────────
  // Store the pending trade in chrome.storage.local so the popup can pick it up.
  // Show a banner in the overlay guiding the user to click the toolbar icon.
  overlay.onBet = async (market: PolymarketMarket, outcome: 'Yes' | 'No') => {
    // 1. Store pending trade for popup pickup
    chrome.storage.local.set({
      pm_pending_trade: {
        market,
        outcome,
        ts: Date.now(),
      },
    });

    // 2. Show banner in overlay
    overlay.showPendingBanner(market, outcome);
  };

  // ── State ────────────────────────────────────────────────────────────────
  let lastKey       = '';
  let lastFetchTime = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pollHandle:    ReturnType<typeof setInterval>  | null = null;
  let isFetching    = false;

  // ── Search ───────────────────────────────────────────────────────────────

  async function fetchMarkets(keywords: string[], attempt = 0): Promise<void> {
    if (isFetching) return;
    isFetching = true;
    overlay.setLoading(keywords);
    try {
      const res = await new Promise<{
        type: string;
        result?: { markets: PolymarketMarket[]; keywords: string[] };
        error?: string;
      }>((resolve, reject) =>
        chrome.runtime.sendMessage(
          { type: 'SEARCH_MARKETS', keywords },
          r => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(r);
          }
        )
      );

      lastFetchTime = Date.now();
      if (res.type === 'SEARCH_RESULT' && res.result) {
        overlay.setMarkets(res.result.markets, res.result.keywords);
      } else if (res.type === 'SEARCH_ERROR') {
        overlay.setError(res.error ?? 'Search failed');
      }
    } catch (err) {
      const msg = (err as Error).message ?? '';
      // Service worker was killed by Chrome → retry once after short delay
      if (
        attempt === 0 &&
        (msg.includes('Could not establish connection') ||
          msg.includes('Extension context invalidated') ||
          msg.includes('receiving end does not exist'))
      ) {
        isFetching = false;
        await new Promise(r => setTimeout(r, 800));
        return fetchMarkets(keywords, 1);
      }
      console.warn('[PolymarketRadar] Search error:', msg);
      overlay.setError('Search failed — will retry automatically.');
    } finally {
      isFetching = false;
    }
  }

  function scheduleSearch(keywords: string[], immediate = false) {
    if (debounceTimer) clearTimeout(debounceTimer);
    const delay = immediate ? 0 : DEBOUNCE_MS;
    debounceTimer = setTimeout(() => {
      if (keywords.length > 0) fetchMarkets(keywords);
    }, delay);
  }

  function onKeywordsUpdated(keywords: string[], force = false) {
    const key = keywordsKey(keywords);
    if (!force && key === lastKey) return;
    lastKey = key;
    scheduleSearch(keywords);
  }

  // ── Polling control ──────────────────────────────────────────────────────

  function startPolling() {
    if (pollHandle) return;
    pollHandle = setInterval(() => {
      if (!document.hidden) onKeywordsUpdated(extractor());
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  }

  // ── Visibility change: pause when hidden, refresh when visible ───────────

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      const kws   = extractor();
      const stale = Date.now() - lastFetchTime > STALE_MS;
      const changed = keywordsKey(kws) !== lastKey;
      if (stale || changed) onKeywordsUpdated(kws, stale);
      startPolling();
    }
  });

  // ── YouTube SPA navigation ───────────────────────────────────────────────

  if (window.location.hostname.includes('youtube.com')) {
    let lastUrl = window.location.href;
    new MutationObserver(() => {
      if (window.location.href === lastUrl) return;
      lastUrl = window.location.href;
      let attempts = 0;
      const poll = setInterval(() => {
        const kws = extractor();
        if (kws.length > 0 || ++attempts >= 8) {
          clearInterval(poll);
          onKeywordsUpdated(kws, true);
        }
      }, 600);
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ── Twitter/X: observe new tweets + URL changes ──────────────────────────

  if (
    window.location.hostname.includes('twitter.com') ||
    window.location.hostname.includes('x.com')
  ) {
    const attachFeedObserver = () => {
      const main = document.querySelector('main') ?? document.body;
      new MutationObserver(() => onKeywordsUpdated(extractor()))
        .observe(main, { childList: true, subtree: false });
    };

    if (document.querySelector('main')) {
      attachFeedObserver();
    } else {
      const waitForMain = new MutationObserver(() => {
        if (document.querySelector('main')) {
          waitForMain.disconnect();
          attachFeedObserver();
        }
      });
      waitForMain.observe(document.body, { childList: true, subtree: true });
    }

    let lastUrl = window.location.href;
    new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(() => onKeywordsUpdated(extractor(), true), 1_200);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────

  // Clean up stale pending trades on page load
  chrome.storage.local.get('pm_pending_trade', data => {
    const pt = data.pm_pending_trade as { ts?: number } | undefined;
    if (pt?.ts && Date.now() - pt.ts > PENDING_TTL_MS) {
      chrome.storage.local.remove('pm_pending_trade');
    }
  });

  const initialKws = extractor();
  if (initialKws.length > 0) onKeywordsUpdated(initialKws);
  if (!document.hidden) startPolling();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
