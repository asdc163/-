// Polymarket Radar — Background Service Worker
// Handles message passing, result caching, wallet state, and order submission.

import type { BgMessage, SearchResult, WalletState } from '../shared/types';
import { searchMarkets } from '../shared/polymarket-api';
import { submitOrder } from '../shared/clob-client';

// In-memory cache for search results (60s TTL)
const CACHE_TTL_MS = 60_000;
interface CacheEntry { result: SearchResult; expiresAt: number }
const cache = new Map<string, CacheEntry>();

// ─── Message router ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: BgMessage, _sender, sendResponse) => {
    switch (message.type) {

      // ── Market search (with 60s cache) ──────────────────────────────
      case 'SEARCH_MARKETS': {
        const { keywords } = message;
        const key = keywords.join(',');
        const cached = cache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
          sendResponse({ type: 'SEARCH_RESULT', result: cached.result });
          return true;
        }
        searchMarkets(keywords)
          .then(markets => {
            const result: SearchResult = { markets, keywords, timestamp: Date.now() };
            cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
            sendResponse({ type: 'SEARCH_RESULT', result });
          })
          .catch(err => {
            sendResponse({ type: 'SEARCH_ERROR', error: String((err as Error)?.message ?? err) });
          });
        return true;
      }

      // ── Wallet state (read from chrome.storage) ─────────────────────
      case 'GET_WALLET': {
        chrome.storage.local.get('polymarket_wallet').then(result => {
          sendResponse({
            type: 'WALLET_STATE',
            wallet: (result.polymarket_wallet as WalletState) ?? null,
          });
        });
        return true;
      }

      case 'SAVE_WALLET': {
        chrome.storage.local
          .set({ polymarket_wallet: message.wallet })
          .then(() => sendResponse({ type: 'WALLET_STATE', wallet: message.wallet }));
        return true;
      }

      case 'CLEAR_WALLET': {
        chrome.storage.local
          .remove('polymarket_wallet')
          .then(() => sendResponse({ type: 'WALLET_STATE', wallet: null }));
        return true;
      }

      // ── Place CLOB order (background makes the authenticated HTTPS request)
      case 'PLACE_ORDER': {
        const { wallet, order } = message;
        submitOrder(wallet, order)
          .then(result => {
            sendResponse({ type: 'ORDER_SUCCESS', result });
          })
          .catch(err => {
            sendResponse({ type: 'ORDER_ERROR', error: String((err as Error)?.message ?? err) });
          });
        return true;
      }

      default:
        return false;
    }
  }
);

// Cleanup stale cache entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) if (v.expiresAt <= now) cache.delete(k);
}, 120_000);

export {};
