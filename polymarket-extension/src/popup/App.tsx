/**
 * Popup UI — "Order facilitation" approach.
 *
 * The extension piggybacks on the user's existing Polymarket session:
 *  - No wallet connect inside the extension
 *  - Session (CLOB credentials) is read from polymarket.com's localStorage
 *  - All login methods work (MetaMask, Coinbase, WalletConnect, Privy/social, etc.)
 *  - Orders are signed using the wallet already connected on polymarket.com
 *  - Market orders (FOK) and limit orders (GTC) both supported
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { PolymarketMarket, PolySession, OrderParams } from '../shared/types';
import { getPolyBalance } from '../shared/clob-client';

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtVol(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtTimeLeft(endDate: string): string {
  if (!endDate) return '';
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const d = Math.floor(diff / 86_400_000);
  if (d > 60) return `${Math.floor(d / 30)}mo`;
  if (d > 0) return `${d}d`;
  const h = Math.floor(diff / 3_600_000);
  return h > 0 ? `${h}h` : '<1h';
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── OddsBar ──────────────────────────────────────────────────────────────

function OddsBar({ outcomes, prices }: { outcomes: string[]; prices: number[] }) {
  const binary = outcomes.length === 2 && outcomes[0]?.toLowerCase() === 'yes';
  if (binary) {
    const yes = Math.round((prices[0] ?? 0.5) * 100);
    return (
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
          <span style={{ color: '#059669' }}>YES {yes}¢</span>
          <span style={{ color: '#dc2626' }}>NO {100 - yes}¢</span>
        </div>
        <div style={{ height: 4, background: '#fee2e2', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${yes}%`, height: '100%', background: '#059669', borderRadius: 3 }} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
      {outcomes.slice(0, 4).map((o, i) => (
        <span key={o} style={{ fontSize: 10, background: '#f1f5f9', borderRadius: 4, padding: '2px 6px', color: '#475569', fontWeight: 500 }}>
          {o}{prices[i] != null && <span style={{ color: '#0d9488', fontWeight: 700 }}> {Math.round(prices[i] * 100)}¢</span>}
        </span>
      ))}
    </div>
  );
}

// ─── Inline Order Panel ───────────────────────────────────────────────────

const PRESET_AMOUNTS = [5, 10, 25, 50];

interface OrderPanelProps {
  market: PolymarketMarket;
  outcome: 'Yes' | 'No';
  session: PolySession;
  balance: number | null;
  onCancel: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

function OrderPanel({ market, outcome, session, balance, onCancel, onSuccess, onError }: OrderPanelProps) {
  const [preset, setPreset] = useState(10);
  const [custom, setCustom] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [orderType, setOrderType] = useState<'FOK' | 'GTC'>('FOK');
  const [submitting, setSubmitting] = useState(false);

  const idx = outcome === 'Yes' ? 0 : 1;
  const price = market.outcomePrices[idx] ?? 0.5;
  const amount = useCustom ? (parseFloat(custom) || 0) : preset;
  const slippage = orderType === 'FOK' ? 1.05 : 1.0;
  const estShares = amount > 0 && price > 0
    ? (amount / (price * slippage)).toFixed(1)
    : '?';

  const accent = outcome === 'Yes' ? '#059669' : '#dc2626';

  const handleConfirm = async () => {
    if (amount <= 0) return;
    setSubmitting(true);
    try {
      const params: OrderParams = { outcome, usdcAmount: amount, orderType };
      const res = await chrome.runtime.sendMessage({
        type: 'PLACE_ORDER',
        session,
        params,
        market,
      }) as { type: string; result?: { orderId: string }; error?: string };

      if (res.type === 'ORDER_SUCCESS') {
        onSuccess(`${orderType === 'FOK' ? 'Market' : 'Limit'} order placed — ${outcome} ≈${estShares} shares @ $${amount}`);
      } else if (res.error === 'NO_ETH_PROVIDER') {
        chrome.tabs.create({ url: market.url });
        onSuccess('Opened on Polymarket (social login)');
      } else {
        onError(res.error ?? 'Order failed');
      }
    } catch (e) {
      onError((e as Error).message ?? 'Order failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      background: outcome === 'Yes' ? '#f0fdf4' : '#fef2f2',
      border: `1px solid ${accent}33`,
      borderRadius: 8, padding: '10px 12px', marginTop: 6,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, marginBottom: 8 }}>
        Buy {outcome} · {Math.round(price * 100)}¢ each
      </div>

      {/* Amount */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Amount (USDC)</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {PRESET_AMOUNTS.map(a => (
            <button key={a} onClick={() => { setPreset(a); setUseCustom(false); }} style={{
              padding: '4px 8px', fontSize: 11, fontWeight: 600, borderRadius: 5, border: 'none', cursor: 'pointer',
              background: !useCustom && preset === a ? accent : '#e2e8f0',
              color: !useCustom && preset === a ? 'white' : '#475569',
            }}>${a}</button>
          ))}
          <input
            type="number" min="1" placeholder="Other"
            value={custom}
            onChange={e => { setCustom(e.target.value); setUseCustom(true); }}
            onFocus={() => setUseCustom(true)}
            style={{
              width: 65, padding: '4px 6px', fontSize: 11, borderRadius: 5,
              border: `1px solid ${useCustom ? accent : '#e2e8f0'}`, outline: 'none', color: '#1e293b',
            }}
          />
        </div>
      </div>

      {/* Order type */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['FOK', 'GTC'] as const).map(t => (
            <button key={t} onClick={() => setOrderType(t)} style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, border: 'none', cursor: 'pointer',
              background: orderType === t ? '#0d9488' : '#e2e8f0',
              color: orderType === t ? 'white' : '#475569',
            }}>
              {t === 'FOK' ? 'Market order' : `Limit ${Math.round(price * 100)}¢`}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
          {orderType === 'FOK'
            ? 'Fills immediately at best available price (≤5% slippage)'
            : 'Resting limit — fills when a matching ask appears'}
        </div>
      </div>

      {/* Summary */}
      {amount > 0 && (
        <div style={{ fontSize: 11, background: 'white', borderRadius: 5, padding: '5px 8px', marginBottom: 8, color: '#475569' }}>
          Spend <strong>${amount}</strong> → get ≈<strong>{estShares}</strong> {outcome} shares
          {balance !== null && amount > balance && (
            <div style={{ color: '#dc2626', fontSize: 10, marginTop: 2 }}>
              ⚠ Low balance (${balance.toFixed(2)} available)
            </div>
          )}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '7px', fontSize: 12, borderRadius: 6,
          border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={handleConfirm} disabled={submitting || amount <= 0} style={{
          flex: 2, padding: '7px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none',
          background: submitting || amount <= 0 ? '#94a3b8' : accent,
          color: 'white', cursor: submitting || amount <= 0 ? 'not-allowed' : 'pointer',
        }}>
          {submitting ? '⏳ Signing…' : `Confirm Buy ${outcome}`}
        </button>
      </div>
    </div>
  );
}

// ─── Market Card ──────────────────────────────────────────────────────────

function MarketCard({
  market, session, activeOrder, balance, onBuy, onCancel, onSuccess, onError,
}: {
  market: PolymarketMarket;
  session: PolySession | null;
  activeOrder: { marketId: string; outcome: 'Yes' | 'No' } | null;
  balance: number | null;
  onBuy: (mkt: PolymarketMarket, outcome: 'Yes' | 'No') => void;
  onCancel: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const isBinary = market.outcomes.length === 2 && market.outcomes[0]?.toLowerCase() === 'yes';
  const isOpen = activeOrder?.marketId === market.id;

  return (
    <div style={{ background: 'white', borderRadius: 8, padding: '10px 12px', marginBottom: 8, border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', lineHeight: 1.4, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
        {market.question}
      </div>

      <OddsBar outcomes={market.outcomes} prices={market.outcomePrices} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#94a3b8' }}>
        <span>📊 {fmtVol(market.volume24hr || market.volume)}</span>
        {market.endDate && <span>· ⏱ {fmtTimeLeft(market.endDate)}</span>}
        <span style={{ flex: 1 }} />
        {isBinary && session ? (
          <>
            <button onClick={() => onBuy(market, 'Yes')} style={{
              fontSize: 10, fontWeight: 700, background: '#059669', color: 'white',
              borderRadius: 4, padding: '3px 7px', border: 'none', cursor: 'pointer',
            }}>YES {Math.round((market.outcomePrices[0] ?? 0.5) * 100)}¢</button>
            <button onClick={() => onBuy(market, 'No')} style={{
              fontSize: 10, fontWeight: 700, background: '#dc2626', color: 'white',
              borderRadius: 4, padding: '3px 7px', border: 'none', cursor: 'pointer',
            }}>NO {Math.round((market.outcomePrices[1] ?? 0.5) * 100)}¢</button>
          </>
        ) : (
          <a href={market.url} target="_blank" rel="noopener noreferrer" style={{
            fontSize: 10, fontWeight: 700, background: '#0d9488', color: 'white',
            borderRadius: 4, padding: '3px 8px', textDecoration: 'none',
          }}>View ↗</a>
        )}
      </div>

      {isOpen && session && (
        <OrderPanel
          market={market}
          outcome={activeOrder!.outcome}
          session={session}
          balance={balance}
          onCancel={onCancel}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}
    </div>
  );
}

// ─── Session Panel ────────────────────────────────────────────────────────

function SessionPanel({
  session, loading: sLoading, noTab, balance, onRefresh,
}: {
  session: PolySession | null;
  loading: boolean;
  noTab: boolean;
  balance: number | null;
  onRefresh: () => void;
}) {
  if (sLoading) {
    return (
      <div style={{ padding: '10px 12px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', fontSize: 11, color: '#94a3b8' }}>
        Checking Polymarket session…
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ padding: '10px 12px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Not connected</div>
        <div style={{ fontSize: 10, color: '#78350f', marginBottom: 8, lineHeight: 1.5 }}>
          {noTab
            ? 'Open polymarket.com in any tab and log in — any login method works (MetaMask, Google, email…)'
            : 'Log in at polymarket.com — any login method works (MetaMask, Google, email…)'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => chrome.tabs.create({ url: 'https://polymarket.com' })} style={{
            flex: 1, padding: '6px', fontSize: 11, fontWeight: 600,
            background: '#d97706', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer',
          }}>Open Polymarket</button>
          <button onClick={onRefresh} style={{
            padding: '6px 10px', fontSize: 11, background: 'white', color: '#64748b',
            border: '1px solid #e2e8f0', borderRadius: 5, cursor: 'pointer',
          }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 12px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', fontFamily: 'monospace' }}>
          {shortAddr(session.address)}
        </span>
        {balance !== null && (
          <span style={{ fontSize: 10, color: '#64748b' }}>
            · <strong style={{ color: '#059669' }}>${balance.toFixed(2)}</strong>
          </span>
        )}
        <span style={{ flex: 1 }} />
        {!session.hasEthProvider && (
          <span style={{ fontSize: 9, color: '#d97706', background: '#fffbeb', borderRadius: 4, padding: '2px 5px', border: '1px solid #fde68a' }}>
            Social login
          </span>
        )}
        <button onClick={onRefresh} style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>↻</button>
      </div>
      {!session.hasEthProvider && (
        <div style={{ fontSize: 10, color: '#78350f', marginTop: 3 }}>
          Social login — clicking Buy will open the market on Polymarket
        </div>
      )}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState<PolySession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [noTab, setNoTab] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const [query, setQuery] = useState('');
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [activeOrder, setActiveOrder] = useState<{ marketId: string; outcome: 'Yes' | 'No' } | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load session ────────────────────────────────────────────────────

  const loadSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_SESSION' }) as {
        type: string; session: PolySession | null; noTab: boolean;
      };
      setSession(res.session ?? null);
      setNoTab(res.noTab ?? false);
      if (res.session) {
        getPolyBalance(res.session.address).then(setBalance).catch(() => {});
      } else {
        setBalance(null);
      }
    } catch {
      setSession(null);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => { loadSession(); }, [loadSession]);

  // ── Toast helper ────────────────────────────────────────────────────

  const showToast = useCallback((ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setActiveOrder(null);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 4_500);
  }, []);

  // ── Search ──────────────────────────────────────────────────────────

  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSearching(true);
    setSearchError(null);
    setSearched(true);
    setActiveOrder(null);
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'SEARCH_MARKETS',
        keywords: trimmed.split(/\s+/).filter(Boolean),
      }) as { type: string; result?: { markets: PolymarketMarket[] }; error?: string };
      if (res.type === 'SEARCH_RESULT') setMarkets(res.result?.markets ?? []);
      else setSearchError(res.error ?? 'Search failed');
    } catch {
      setSearchError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }, []);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d9488', color: 'white', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🎯</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Polymarket Radar</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>Quick orders via your Polymarket session</div>
        </div>
        {session && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,.15)', borderRadius: 20, padding: '3px 8px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
            <span style={{ fontSize: 10, fontWeight: 600 }}>{shortAddr(session.address)}</span>
          </div>
        )}
      </div>

      <SessionPanel session={session} loading={sessionLoading} noTab={noTab} balance={balance} onRefresh={loadSession} />

      {toast && (
        <div style={{
          padding: '8px 12px', fontSize: 11, fontWeight: 600,
          background: toast.ok ? '#f0fdf4' : '#fef2f2',
          color: toast.ok ? '#166534' : '#dc2626',
          borderBottom: `1px solid ${toast.ok ? '#bbf7d0' : '#fecaca'}`,
        }}>
          {toast.ok ? '✓ ' : '⚠ '}{toast.msg}
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '10px 12px', background: 'white', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text" value={query} placeholder="Search topic (e.g. bitcoin, election…)"
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
            style={{ flex: 1, padding: '7px 10px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, outline: 'none', color: '#1e293b' }}
          />
          <button onClick={() => handleSearch(query)} disabled={searching} style={{
            background: '#0d9488', color: 'white', border: 'none', borderRadius: 6,
            padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: searching ? 0.7 : 1,
          }}>
            {searching ? '…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={{ padding: '10px 12px', maxHeight: 380, overflowY: 'auto' }}>
        {searching && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12 }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>⏳</div>Searching Polymarket…
          </div>
        )}
        {searchError && (
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#dc2626', fontSize: 12 }}>⚠️ {searchError}</div>
        )}
        {!searching && searched && markets.length === 0 && !searchError && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12 }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>🔍</div>No active markets found
          </div>
        )}
        {!searching && markets.map(m => (
          <MarketCard
            key={m.id} market={m} session={session} activeOrder={activeOrder} balance={balance}
            onBuy={(mkt, outcome) => setActiveOrder({ marketId: mkt.id, outcome })}
            onCancel={() => setActiveOrder(null)}
            onSuccess={msg => showToast(true, msg)}
            onError={msg => showToast(false, msg)}
          />
        ))}
        {!searched && !searching && (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: '#94a3b8', fontSize: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🎯</div>
            <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Search any topic</div>
            <div style={{ lineHeight: 1.6 }}>
              {session
                ? 'Find a market → click YES/NO to place quick orders'
                : 'Log in at polymarket.com, then search to quick-order'}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9', fontSize: 10, color: '#cbd5e1', textAlign: 'center' }}>
        Orders via your existing Polymarket session ·{' '}
        <a href="https://polymarket.com" target="_blank" rel="noopener" style={{ color: '#0d9488', textDecoration: 'none', fontWeight: 600 }}>
          polymarket.com
        </a>
      </div>
    </div>
  );
}
