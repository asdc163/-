// Polymarket Radar - Background Service Worker
// Handles message passing and caching between content scripts and popup

import type { MessageType, SearchResult } from '../shared/types';
import { searchMarkets } from '../shared/polymarket-api';

// In-memory cache: url -> search result (valid for 60 seconds)
const CACHE_TTL_MS = 60_000;
interface CacheEntry {
  result: SearchResult;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

chrome.runtime.onMessage.addListener(
  (message: MessageType, _sender, sendResponse) => {
    if (message.type === 'SEARCH_MARKETS') {
      const { keywords } = message;
      const cacheKey = keywords.join(',');
      const cached = cache.get(cacheKey);

      if (cached && cached.expiresAt > Date.now()) {
        sendResponse({ type: 'SEARCH_RESULT', result: cached.result });
        return true;
      }

      searchMarkets(keywords)
        .then(markets => {
          const result: SearchResult = {
            markets,
            keywords,
            timestamp: Date.now(),
          };
          cache.set(cacheKey, {
            result,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });
          sendResponse({ type: 'SEARCH_RESULT', result });
        })
        .catch(err => {
          sendResponse({
            type: 'SEARCH_ERROR',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        });

      return true; // Keep message channel open for async response
    }

    return false;
  }
);

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}, 120_000);

export {};
