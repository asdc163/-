/**
 * Background Service Worker
 *
 * Acts as a coordinator between the popup and the polymarket.com content script.
 *
 * Key flows:
 *  GET_SESSION  → find polymarket.com tab → PM_GET_SESSION → return PolySession
 *  PLACE_ORDER  → build unsigned order → PM_SIGN_ORDER (in polymarket.com tab)
 *               → get EIP-712 signature → submit to CLOB API
 */

import type {
  BgMessage,
  PolySession,
  PolymarketMarket,
  OrderParams,
  SellParams,
  UnsignedOrder,
  ClobOrderPayload,
} from '../shared/types';
import { searchMarkets } from '../shared/polymarket-api';
import { submitOrder } from '../shared/clob-client';

// CTF Exchange contract addresses
const CTF_EXCHANGE    = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982e';
const NEG_RISK_CTF_EX = '0xC5d563A36AE78145C45a50134d48A1a293c969E1';
const POLYGON_CHAIN_ID = 137;

// ─── Search cache (90s TTL, persisted in chrome.storage.session) ─────────────
// chrome.storage.session survives service-worker restarts (Chrome kills idle SW
// after ~30s), so cached results are still available when the SW wakes back up.

import type { SearchResult } from '../shared/types';
interface CacheEntry { result: SearchResult; expiresAt: number }
const CACHE_TTL = 90_000;
// In-memory mirror of storage.session for fast reads within the same SW lifetime
const memCache = new Map<string, CacheEntry>();

async function getCached(key: string): Promise<SearchResult | null> {
  // Check in-memory first (zero latency)
  const mem = memCache.get(key);
  if (mem && mem.expiresAt > Date.now()) return mem.result;
  // Fall back to storage.session (survives SW restarts)
  try {
    const data = await chrome.storage.session.get(`pm_cache_${key}`);
    const entry = data[`pm_cache_${key}`] as CacheEntry | undefined;
    if (entry && entry.expiresAt > Date.now()) {
      memCache.set(key, entry); // re-warm in-memory
      return entry.result;
    }
  } catch { /* storage.session not available in older Chrome */ }
  return null;
}

async function setCached(key: string, result: SearchResult): Promise<void> {
  const entry: CacheEntry = { result, expiresAt: Date.now() + CACHE_TTL };
  memCache.set(key, entry);
  try {
    await chrome.storage.session.set({ [`pm_cache_${key}`]: entry });
  } catch { /* ignore */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function findPolymarketTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ url: 'https://polymarket.com/*' });
  return tabs[0] ?? null;
}

function randomSalt(): string {
  return String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
}

/**
 * Build an unsigned EIP-712 order struct.
 *
 * FOK (market order): price bumped +5% so the order fills against any resting
 * ask at or below current price. The maker still pays the same USDC; the 5%
 * just widens the acceptable price range to ensure fill.
 */
function buildUnsignedOrder(
  session: PolySession,
  market: PolymarketMarket,
  params: OrderParams
): { order: UnsignedOrder; domain: object } {
  const idx      = params.outcome === 'Yes' ? 0 : 1;
  const rawPrice = market.outcomePrices[idx] ?? 0.5;
  const tokenId  = market.clobTokenIds[idx] ?? '';

  const effectivePrice = params.orderType === 'FOK'
    ? Math.min(rawPrice * 1.05, 0.99)
    : rawPrice;

  const makerAmountBN = BigInt(Math.round(params.usdcAmount * 1_000_000));
  const priceMicro    = BigInt(Math.round(effectivePrice * 1_000_000));
  const takerAmountBN = priceMicro > 0n
    ? (makerAmountBN * 1_000_000n) / priceMicro
    : makerAmountBN;

  const order: UnsignedOrder = {
    salt:          randomSalt(),
    maker:         session.address,
    signer:        session.address,
    taker:         '0x0000000000000000000000000000000000000000',
    tokenId,
    makerAmount:   makerAmountBN.toString(),
    takerAmount:   takerAmountBN.toString(),
    expiration:    '0',
    nonce:         '0',
    feeRateBps:    '0',
    side:          '0',
    signatureType: '0',
  };

  const domain = {
    name:              'CTF Exchange',
    version:           '1',
    chainId:           POLYGON_CHAIN_ID,
    verifyingContract: market.negRisk ? NEG_RISK_CTF_EX : CTF_EXCHANGE,
  };

  return { order, domain };
}

// ─── Message router ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: BgMessage, _sender, sendResponse) => {
    switch (message.type) {

      // ── Market search ─────────────────────────────────────────────────
      case 'SEARCH_MARKETS': {
        const key = message.keywords.join(',');
        getCached(key)
          .then(cached => {
            if (cached) {
              sendResponse({ type: 'SEARCH_RESULT', result: cached });
              return;
            }
            return searchMarkets(message.keywords).then(async markets => {
              const result: SearchResult = { markets, keywords: message.keywords, timestamp: Date.now() };
              await setCached(key, result);
              sendResponse({ type: 'SEARCH_RESULT', result });
            });
          })
          .catch(err =>
            sendResponse({ type: 'SEARCH_ERROR', error: String((err as Error)?.message ?? err) })
          );
        return true;
      }

      // ── Get session from polymarket.com tab ───────────────────────────
      case 'GET_SESSION': {
        findPolymarketTab()
          .then(tab => {
            if (!tab?.id) {
              sendResponse({ type: 'SESSION_RESULT', session: null, noTab: true });
              return;
            }
            (chrome.tabs.sendMessage(tab.id, { type: 'PM_GET_SESSION' }) as Promise<{ session: PolySession | null }>)
              .then(res => {
                sendResponse({ type: 'SESSION_RESULT', session: res?.session ?? null, noTab: false });
              })
              .catch(() => {
                sendResponse({ type: 'SESSION_RESULT', session: null, noTab: false });
              });
          });
        return true;
      }

      // ── Sell position (SELL order, side='1') ─────────────────────────
      case 'SELL_POSITION': {
        const { session, sellParams } = message as {
          session: PolySession;
          sellParams: SellParams;
        };
        const { position, sharesToSell, orderType } = sellParams;

        // For FOK market sell: accept 3% less USDC to ensure immediate fill
        const effectivePrice = orderType === 'FOK'
          ? Math.max(position.currentPrice * 0.97, 0.01)
          : position.currentPrice;

        const makerAmountBN = BigInt(Math.round(sharesToSell * 1_000_000));
        const takerAmountBN = BigInt(Math.round(sharesToSell * effectivePrice * 1_000_000));

        const sellOrder: UnsignedOrder = {
          salt:          randomSalt(),
          maker:         session.address,
          signer:        session.address,
          taker:         '0x0000000000000000000000000000000000000000',
          tokenId:       position.asset,
          makerAmount:   makerAmountBN.toString(),
          takerAmount:   takerAmountBN.toString(),
          expiration:    '0',
          nonce:         '0',
          feeRateBps:    '0',
          side:          '1',  // SELL
          signatureType: '0',
        };

        const sellDomain = {
          name:              'CTF Exchange',
          version:           '1',
          chainId:           POLYGON_CHAIN_ID,
          verifyingContract: position.negRisk ? NEG_RISK_CTF_EX : CTF_EXCHANGE,
        };

        findPolymarketTab()
          .then(tab => {
            if (!tab?.id) throw new Error('No polymarket.com tab open. Please open Polymarket first.');
            if (!session.hasEthProvider) throw new Error('NO_ETH_PROVIDER');
            return chrome.tabs.sendMessage(tab.id, {
              type: 'PM_SIGN_ORDER', address: session.address, order: sellOrder, domain: sellDomain,
            }) as Promise<{ signature?: string; error?: string }>;
          })
          .then(res => {
            if (!res) throw new Error('No response from Polymarket tab');
            if (res.error) throw new Error(res.error);
            const signed: ClobOrderPayload = { ...sellOrder, signature: res.signature!, negRisk: position.negRisk };
            return submitOrder(session, signed, orderType);
          })
          .then(result => sendResponse({ type: 'ORDER_SUCCESS', result }))
          .catch(err => sendResponse({ type: 'ORDER_ERROR', error: (err as Error).message ?? String(err) }));
        return true;
      }

      // ── Place BUY order via polymarket.com page session ───────────────
      case 'PLACE_ORDER': {
        const { session, params, market } = message;
        const { order, domain } = buildUnsignedOrder(session, market, params);

        findPolymarketTab()
          .then(tab => {
            if (!tab?.id) {
              throw new Error('No polymarket.com tab open. Please open Polymarket first.');
            }
            if (!session.hasEthProvider) {
              throw new Error('NO_ETH_PROVIDER');
            }
            return chrome.tabs.sendMessage(tab.id, {
              type: 'PM_SIGN_ORDER',
              address: session.address,
              order,
              domain,
            }) as Promise<{ signature?: string; error?: string }>;
          })
          .then(res => {
            if (!res) throw new Error('No response from Polymarket tab');
            if (res.error) throw new Error(res.error);
            const signed: ClobOrderPayload = { ...order, signature: res.signature!, negRisk: market.negRisk };
            return submitOrder(session, signed, params.orderType);
          })
          .then(result => sendResponse({ type: 'ORDER_SUCCESS', result }))
          .catch(err => sendResponse({ type: 'ORDER_ERROR', error: (err as Error).message ?? String(err) }));
        return true;
      }

      default:
        return false;
    }
  }
);

// Prune stale in-memory entries every 2 min (storage.session auto-expires via TTL check)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memCache) if (v.expiresAt <= now) memCache.delete(k);
}, 120_000);

export {};
