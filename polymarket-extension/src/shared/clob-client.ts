/**
 * Polymarket CLOB API client.
 *
 * Handles:
 *   - L1 auth: derive API key via EIP-712 signature (ClobAuthDomain)
 *   - L2 auth: HMAC-SHA256 request signing for trading endpoints
 *   - Order submission: POST /order with signed CLOB order struct
 *   - Balance fetch: GET /positions (Data API)
 */

import type { WalletState, ClobOrderPayload, PlacedOrder } from './types';

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
  wallet: WalletState,
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
  wallet: WalletState,
  order: ClobOrderPayload
): Promise<PlacedOrder> {
  const { negRisk, ...orderFields } = order;

  const body = JSON.stringify({
    order: orderFields,
    owner: wallet.address,
    orderType: 'GTC',         // Good-Till-Cancelled
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

export async function getOpenOrders(wallet: WalletState) {
  const headers = await buildL2Headers(wallet, 'GET', '/orders', '');
  const res = await fetch(`${CLOB_BASE}/orders`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch orders (${res.status})`);
  return res.json();
}

// ─── Get Polymarket USDC balance (from Data API) ─────────────────────────

export async function getPolyBalance(address: string): Promise<number> {
  try {
    const res = await fetch(
      `https://data-api.polymarket.com/balances?user=${address.toLowerCase()}`
    );
    if (!res.ok) return 0;
    const data = await res.json();
    // Response is usually an array of { asset, balance }
    if (Array.isArray(data)) {
      const usdc = data.find(
        (b: { asset?: string; balance?: string }) =>
          b.asset?.toLowerCase().includes('usdc') || b.balance != null
      );
      return usdc ? parseFloat(usdc.balance ?? '0') : 0;
    }
    // Or a direct { balance: number }
    return parseFloat(data?.balance ?? data?.usdc ?? '0');
  } catch {
    return 0;
  }
}
