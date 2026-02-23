/**
 * Polymarket CLOB + Data API client.
 *
 * All requests go directly from the user's browser to Polymarket's APIs.
 * No central server, no shared API key — 100% distributed / zero-infra cost.
 */

import type { PolySession, ClobOrderPayload, PlacedOrder, Position } from './types';

// Minimal auth interface — both PolySession and legacy WalletState satisfy this
type ClobAuth = Pick<PolySession, 'address' | 'apiKey' | 'secret' | 'passphrase'>;

const CLOB_BASE = 'https://clob.polymarket.com';

// ─── HMAC-SHA256 (Web Crypto API, no external deps) ────────────────────────

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── L2 request headers ───────────────────────────────────────────────────

async function buildL2Headers(
  wallet: ClobAuth,
  method: string,
  path: string,
  body?: string
): Promise<Record<string, string>> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const message = timestamp + method.toUpperCase() + path + (body ?? '');
  const signature = await hmacSha256Hex(message, wallet.secret);

  return {
    'Content-Type': 'application/json',
    POLY_ADDRESS: wallet.address,
    POLY_SIGNATURE: signature,
    POLY_TIMESTAMP: timestamp,
    POLY_API_KEY: wallet.apiKey,
    POLY_PASSPHRASE: wallet.passphrase,
  };
}

// ─── Derive API key via L1 auth (call from background after wallet signs) ──

export async function deriveApiKey(
  address: string,
  l1Signature: string,
  timestamp: string,
  nonce = '0'
): Promise<{ apiKey: string; secret: string; passphrase: string }> {
  const res = await fetch(`${CLOB_BASE}/auth/derive-api-key`, {
    method: 'GET',
    headers: {
      POLY_ADDRESS: address,
      POLY_SIGNATURE: l1Signature,
      POLY_TIMESTAMP: timestamp,
      POLY_NONCE: nonce,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`L1 auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    apiKey: data.apiKey ?? data.api_key,
    secret: data.secret,
    passphrase: data.passphrase,
  };
}

// ─── Place order ──────────────────────────────────────────────────────────

export async function submitOrder(
  wallet: ClobAuth,
  order: ClobOrderPayload,
  orderType: 'GTC' | 'FOK' = 'GTC'
): Promise<PlacedOrder> {
  const { negRisk, ...orderFields } = order;

  const body = JSON.stringify({
    order: orderFields,
    owner: wallet.address,
    orderType,
  });

  const headers = await buildL2Headers(wallet, 'POST', '/order', body);

  const res = await fetch(`${CLOB_BASE}/order`, {
    method: 'POST',
    headers,
    body,
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error ?? data?.message ?? JSON.stringify(data);
    throw new Error(`Order failed (${res.status}): ${msg}`);
  }

  return {
    orderId: data.orderID ?? data.order_id ?? data.id ?? 'unknown',
    transactionHash: data.transactionHash,
    outcome: order.side === '0' ? 'BUY' : 'SELL',
    usdcAmount: parseInt(order.makerAmount) / 1e6,
    price: parseInt(order.makerAmount) / parseInt(order.takerAmount),
  };
}

// ─── Get open orders ─────────────────────────────────────────────────────

export async function getOpenOrders(wallet: ClobAuth) {
  const headers = await buildL2Headers(wallet, 'GET', '/orders', '');
  const res = await fetch(`${CLOB_BASE}/orders`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch orders (${res.status})`);
  return res.json();
}

// ─── Get Polymarket USDC balance (Data API) ──────────────────────────────────

export async function getPolyBalance(address: string): Promise<number> {
  try {
    const res = await fetch(
      `https://data-api.polymarket.com/balances?user=${address.toLowerCase()}`
    );
    if (!res.ok) return 0;
    const data = await res.json();
    if (Array.isArray(data)) {
      const usdc = data.find(
        (b: { asset?: string; balance?: string }) =>
          b.asset?.toLowerCase().includes('usdc') || b.balance != null
      );
      return usdc ? parseFloat(usdc.balance ?? '0') : 0;
    }
    return parseFloat(data?.balance ?? data?.usdc ?? '0');
  } catch {
    return 0;
  }
}

// ─── Get open positions (Data API) ───────────────────────────────────────────
//
// Fully client-side: each user's extension queries with THEIR OWN address.
// Zero central server. Zero infra cost on our side.

export async function getPositions(address: string): Promise<Position[]> {
  try {
    const res = await fetch(
      `https://data-api.polymarket.com/positions?user=${address.toLowerCase()}&sizeThreshold=0.01`
    );
    if (!res.ok) return [];
    const raw = await res.json();
    if (!Array.isArray(raw)) return [];

    return raw
      .map((d: Record<string, unknown>) => {
        const size         = parseFloat(String(d.size  ?? d.amount      ?? '0'));
        const currentValue = parseFloat(String(d.currentValue ?? d.current_value ?? '0'));
        // currentPrice may not be returned directly; derive from currentValue/size
        const currentPrice = parseFloat(String(
          d.currentPrice ?? d.price ?? d.curPrice ??
          (size > 0 ? currentValue / size : 0)
        ));
        return {
          asset:        String(d.asset        ?? d.tokenId    ?? d.token_id ?? ''),
          title:        String(d.title        ?? d.question   ?? d.market   ?? ''),
          slug:         String(d.slug         ?? d.marketSlug ?? ''),
          outcome:      String(d.outcome      ?? d.side       ?? 'Yes'),
          outcomeIndex: Number(d.outcomeIndex ?? d.outcome_index ?? 0),
          size,
          avgPrice:     parseFloat(String(d.avgPrice     ?? d.avg_price     ?? '0')),
          currentPrice,
          initialValue: parseFloat(String(d.initialValue ?? d.initial_value ?? '0')),
          currentValue,
          pnl:          parseFloat(String(d.pnl          ?? d.unrealizedPnl ?? '0')),
          pnlPercent:   parseFloat(String(d.pnlPercent   ?? d.pnl_percent   ?? '0')),
          negRisk:      Boolean(d.negRisk ?? d.neg_risk ?? false),
          closed:       Boolean(d.closed   ?? d.resolved  ?? false),
        } satisfies Position;
      })
      .filter(p => p.size > 0.001 && p.asset);
  } catch {
    return [];
  }
}
