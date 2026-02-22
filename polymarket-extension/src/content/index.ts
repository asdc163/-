import { extractFromTwitter } from './extractors/twitter';
import { extractFromYouTube } from './extractors/youtube';
import { PolymarketOverlay } from './overlay';
import {
  connectWallet,
  authenticateWallet,
  buildAndSignOrder,
  loadWalletState,
  saveWalletState,
  switchToPolygon,
  getChainId,
} from '../shared/wallet';
import type { PolymarketMarket, WalletState } from '../shared/types';

const POLL_INTERVAL_MS = 8_000;
const DEBOUNCE_MS = 1_500;
const POLYGON_CHAIN_ID = '0x89';

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

// ─── Wallet helpers (content-script context has access to window.ethereum) ──

async function ensurePolygon(): Promise<void> {
  const chainId = await getChainId();
  if (chainId !== POLYGON_CHAIN_ID) {
    await switchToPolygon();
  }
}

/**
 * Full connect flow:
 * 1. Request MetaMask accounts
 * 2. Switch/add Polygon network
 * 3. Sign L1 EIP-712 to derive CLOB API credentials
 * 4. Persist in chrome.storage.local
 */
async function connectAndAuth(): Promise<WalletState> {
  const address = await connectWallet();
  await ensurePolygon();
  const wallet = await authenticateWallet(address);
  await saveWalletState(wallet);
  return wallet;
}

// ─── Main init ────────────────────────────────────────────────────────────

async function init() {
  const extractor = getExtractor();
  if (!extractor) return;

  const overlay = new PolymarketOverlay();
  overlay.mount();

  // Load persisted wallet state
  let wallet: WalletState | null = await loadWalletState();
  overlay.setWalletConnected(wallet?.connected ?? false);

  // ── Connect wallet callback (triggered from bet modal) ──────────────────
  overlay.onConnect = async () => {
    try {
      wallet = await connectAndAuth();
      overlay.setWalletConnected(true);
    } catch (err) {
      console.error('[PolymarketRadar] Wallet connect failed:', err);
      throw err; // re-throw so modal can display the error
    }
  };

  // ── Bet callback (triggered from bet modal "Confirm" button) ────────────
  overlay.onBet = async (
    market: PolymarketMarket,
    outcome: 'Yes' | 'No',
    usdcAmount: number
  ) => {
    // Ensure wallet is connected (auto-connect if not)
    if (!wallet?.connected) {
      wallet = await connectAndAuth();
      overlay.setWalletConnected(true);
    }

    // Make sure we're on Polygon
    await ensurePolygon();

    // Build the order struct and sign it via MetaMask (EIP-712 eth_signTypedData_v4)
    // MetaMask will pop up for user confirmation
    const signedOrder = await buildAndSignOrder(wallet, market, outcome, usdcAmount);

    // Send to background service worker which makes the CLOB HTTPS request
    // with HMAC L2 auth headers
    const response = await new Promise<{ type: string; result?: unknown; error?: string }>(
      (resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'PLACE_ORDER', wallet, order: signedOrder },
          (res: { type: string; result?: unknown; error?: string }) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(res);
            }
          }
        );
      }
    );

    if (response.type === 'ORDER_ERROR') {
      throw new Error(response.error ?? 'Order failed');
    }
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
      if (keywords.length > 0) fetchMarkets(keywords);
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

  // YouTube SPA navigation
  if (window.location.hostname.includes('youtube.com')) {
    let lastUrl = window.location.href;
    new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(() => {
          const kws = extractor();
          if (kws.length > 0) onKeywordsUpdated(kws);
        }, 2000);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // Twitter/X timeline updates
  if (
    window.location.hostname.includes('twitter.com') ||
    window.location.hostname.includes('x.com')
  ) {
    const main = document.querySelector('main');
    if (main) {
      new MutationObserver(() => {
        const kws = extractor();
        onKeywordsUpdated(kws);
      }).observe(main, { childList: true, subtree: false });
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
