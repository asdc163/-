/**
 * Popup — Polymarket Radar
 * Tabs: Search (buy) | Portfolio (sell)
 */

import React, {
  useState, useEffect, useCallback, useRef, KeyboardEvent
} from 'react';
import type {
  PolymarketMarket, PolySession, OrderParams, Position, SellParams,
} from '../shared/types';
import { getPolyBalance, getPositions } from '../shared/clob-client';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:          '#0C0F1A',
  panel:       '#111520',
  card:        '#141928',
  cardHover:   '#1A2136',
  border:      '#232A3B',
  borderLight: '#2E3650',
  text:        '#E8EDF5',
  textMid:     '#A3ADBF',
  muted:       '#5E6A82',
  yes:         '#0AC18E',
  yesDim:      '#0AC18E22',
  no:          '#E23E3E',
  noDim:       '#E23E3E22',
  brand:       '#6170FF',
  brandDim:    '#6170FF22',
  amber:       '#F59E0B',
  amberDim:    '#F59E0B22',
  green:       '#22C55E',
  red:         '#EF4444',
} as const;

const FONT = `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtVol(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtTimeLeft(endDate: string): string {
  if (!endDate) return '';
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const d = Math.floor(ms / 86_400_000);
  if (d > 60) return `${Math.floor(d / 30)}mo`;
  if (d > 0)  return `${d}d`;
  const h = Math.floor(ms / 3_600_000);
  return h > 0 ? `${h}h` : '<1h';
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function keywordsFromTitle(title: string): string {
  const STOP = new Set(['the','and','for','with','from','that','this','are','was','will',
    'video','watch','twitter','youtube','home','trending','explore','page','new','top']);
  return title
    .replace(/[|–\-—]/g, ' ').replace(/\(.*?\)/g, '').replace(/[^a-zA-Z0-9 ]/g, ' ')
    .toLowerCase().split(/\s+/)
    .filter(w => w.length > 3 && !STOP.has(w))
    .slice(0, 4).join(' ');
}

function fmtPnl(pnl: number, pct: number): string {
  const sign = pnl >= 0 ? '+' : '';
  return `${sign}$${pnl.toFixed(2)} (${sign}${pct.toFixed(1)}%)`;
}

// ─── Styles helpers ───────────────────────────────────────────────────────────
const chip = (active: boolean, color: string = C.brand): React.CSSProperties => ({
  padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 20,
  border: `1px solid ${active ? color : C.border}`,
  background: active ? color + '25' : 'transparent',
  color: active ? color : C.textMid, cursor: 'pointer',
  transition: 'all .15s',
});

const btn = (bg: string, full = false): React.CSSProperties => ({
  width: full ? '100%' : undefined, padding: '9px 16px',
  fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none',
  background: bg, color: '#fff', cursor: 'pointer', transition: 'opacity .15s',
});

// ─── OddsBar ──────────────────────────────────────────────────────────────────
function OddsBar({ outcomes, prices }: { outcomes: string[]; prices: number[] }) {
  const binary = outcomes.length === 2 && outcomes[0]?.toLowerCase() === 'yes';
  if (binary) {
    const y = Math.round((prices[0] ?? 0.5) * 100);
    const n = 100 - y;
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.yes }}>YES {y}%</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.no  }}>NO {n}%</span>
        </div>
        <div style={{ height: 5, borderRadius: 4, background: C.noDim, overflow: 'hidden' }}>
          <div style={{ width: `${y}%`, height: '100%', background: C.yes, borderRadius: 4,
            transition: 'width .4s ease' }} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
      {outcomes.slice(0, 4).map((o, i) => (
        <span key={o} style={{
          fontSize: 11, background: C.border, borderRadius: 20, padding: '3px 9px',
          color: C.textMid, fontWeight: 600,
        }}>
          {o}
          {prices[i] != null &&
            <span style={{ color: C.yes, marginLeft: 4, fontWeight: 800 }}>
              {Math.round(prices[i] * 100)}%
            </span>}
        </span>
      ))}
    </div>
  );
}

// ─── Buy Order Panel ──────────────────────────────────────────────────────────
const BUY_PRESETS = [5, 10, 25, 50];

interface OrderPanelProps {
  market: PolymarketMarket;
  outcome: 'Yes' | 'No';
  session: PolySession;
  balance: number | null;
  onCancel: () => void;
  onSuccess: (msg: string) => void;
  onError:   (msg: string) => void;
}

function OrderPanel({ market, outcome, session, balance, onCancel, onSuccess, onError }: OrderPanelProps) {
  const [preset,    setPreset]    = useState(10);
  const [custom,    setCustom]    = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [orderType, setOrderType] = useState<'FOK' | 'GTC'>('FOK');
  const [busy,      setBusy]      = useState(false);

  const idx    = outcome === 'Yes' ? 0 : 1;
  const price  = market.outcomePrices[idx] ?? 0.5;
  const amount = useCustom ? (parseFloat(custom) || 0) : preset;
  const slip   = orderType === 'FOK' ? 1.05 : 1.0;
  const shares = amount > 0 && price > 0 ? (amount / (price * slip)).toFixed(2) : '—';
  const accent  = outcome === 'Yes' ? C.yes : C.no;
  const accentD = outcome === 'Yes' ? C.yesDim : C.noDim;
  const lowBal  = balance !== null && amount > 0 && amount > balance;

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = async () => {
    if (amount <= 0 || busy) return;
    setBusy(true);
    try {
      const params: OrderParams = { outcome, usdcAmount: amount, orderType };
      const res = await chrome.runtime.sendMessage({ type: 'PLACE_ORDER', session, params, market }) as
        { type: string; result?: { orderId: string }; error?: string };
      if (res.type === 'ORDER_SUCCESS') {
        onSuccess(`${orderType === 'FOK' ? 'Market' : 'Limit'} order placed ✓  ${outcome} ≈${shares} shares @ $${amount}`);
      } else if (res.error === 'NO_ETH_PROVIDER') {
        chrome.tabs.create({ url: market.url });
        onSuccess('Opened on Polymarket (social login)');
      } else {
        onError(res.error ?? 'Order failed');
      }
    } catch (e) {
      onError((e as Error).message ?? 'Order failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      marginTop: 10, borderRadius: 10, border: `1px solid ${accent}55`,
      background: accentD, padding: '12px 14px',
      animation: 'slideDown .15s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: accent }}>
          Buy {outcome} · {Math.round(price * 100)}%
        </span>
        <button onClick={onCancel} style={{
          background: 'none', border: 'none', color: C.muted, cursor: 'pointer',
          fontSize: 16, lineHeight: 1, padding: '0 4px',
        }}>×</button>
      </div>

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '.06em' }}>Amount (USDC)</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {BUY_PRESETS.map(a => (
          <button key={a} onClick={() => { setPreset(a); setUseCustom(false); }}
            style={chip(!useCustom && preset === a, accent)}>
            ${a}
          </button>
        ))}
        <input
          type="number" min="1" placeholder="Other"
          value={custom}
          onChange={e => { setCustom(e.target.value); setUseCustom(true); }}
          onFocus={() => setUseCustom(true)}
          style={{
            width: 68, padding: '5px 8px', fontSize: 11, fontWeight: 700, borderRadius: 20,
            border: `1px solid ${useCustom ? accent : C.border}`, outline: 'none',
            background: useCustom ? accentD : 'transparent', color: C.text,
          }}
        />
      </div>

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '.06em' }}>Order type</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['FOK', 'GTC'] as const).map(t => (
          <button key={t} onClick={() => setOrderType(t)}
            style={{ ...chip(orderType === t, C.brand), borderRadius: 7, padding: '6px 14px' }}>
            {t === 'FOK' ? '⚡ Market' : `📌 Limit ${Math.round(price * 100)}%`}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
        {orderType === 'FOK'
          ? 'Fills immediately · up to 5% slippage'
          : `Resting limit @ ${Math.round(price * 100)}% · fills when matched`}
      </div>

      {amount > 0 && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '8px 12px', marginBottom: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: C.textMid }}>Pay</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>${amount} USDC</span>
          <span style={{ fontSize: 12, color: C.muted }}>→</span>
          <span style={{ fontSize: 12, color: C.textMid }}>Get ≈</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: accent }}>{shares} shares</span>
        </div>
      )}

      {lowBal && (
        <div style={{ fontSize: 11, color: C.amber, background: C.amberDim,
          border: `1px solid ${C.amber}44`, borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
          ⚠ Balance ${balance!.toFixed(2)} may be insufficient
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '9px', fontSize: 12, fontWeight: 600, borderRadius: 8,
          border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid, cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={submit} disabled={busy || amount <= 0 || lowBal === true}
          style={{
            flex: 2.5, padding: '9px', fontSize: 13, fontWeight: 800, borderRadius: 8,
            border: 'none', cursor: busy || amount <= 0 ? 'not-allowed' : 'pointer',
            background: busy || amount <= 0 ? C.muted : accent, color: '#fff',
            opacity: busy ? 0.7 : 1,
          }}>
          {busy ? '⏳ Awaiting wallet…' : `Confirm Buy ${outcome}`}
        </button>
      </div>
    </div>
  );
}

// ─── Sell Panel ───────────────────────────────────────────────────────────────
interface SellPanelProps {
  position: Position;
  session: PolySession;
  onCancel: () => void;
  onSuccess: (msg: string) => void;
  onError:   (msg: string) => void;
}

function SellPanel({ position, session, onCancel, onSuccess, onError }: SellPanelProps) {
  const [mode,      setMode]      = useState<'all' | 'half' | 'custom'>('all');
  const [custom,    setCustom]    = useState('');
  const [orderType, setOrderType] = useState<'FOK' | 'GTC'>('FOK');
  const [busy,      setBusy]      = useState(false);

  const pricePct = Math.round(position.currentPrice * 100);

  const sharesToSell = (() => {
    if (mode === 'all')    return position.size;
    if (mode === 'half')   return position.size / 2;
    const c = parseFloat(custom);
    return isNaN(c) ? 0 : Math.min(c, position.size);
  })();

  const slipFactor = orderType === 'FOK' ? 0.97 : 1.0;
  const estUsdc    = sharesToSell * position.currentPrice * slipFactor;
  const isValid    = sharesToSell > 0.001 && sharesToSell <= position.size;

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = async () => {
    if (!isValid || busy) return;
    if (!session.hasEthProvider) {
      const url = `https://polymarket.com/event/${position.slug}`;
      chrome.tabs.create({ url });
      onSuccess('Opened on Polymarket (social login — sell there)');
      return;
    }
    setBusy(true);
    try {
      const sellParams: SellParams = { position, sharesToSell, orderType };
      const res = await chrome.runtime.sendMessage({
        type: 'SELL_POSITION', session, sellParams,
      }) as { type: string; result?: unknown; error?: string };

      if (res.type === 'ORDER_SUCCESS') {
        onSuccess(`Sold ${sharesToSell.toFixed(2)} shares @ ${pricePct}% ≈ $${estUsdc.toFixed(2)} USDC ✓`);
      } else {
        onError(res.error ?? 'Sell failed');
      }
    } catch (e) {
      onError((e as Error).message ?? 'Sell failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      marginTop: 10, borderRadius: 10, border: `1px solid ${C.no}55`,
      background: C.noDim, padding: '12px 14px',
      animation: 'slideDown .15s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.no }}>
          Sell {position.outcome} · {pricePct}%
        </span>
        <button onClick={onCancel} style={{
          background: 'none', border: 'none', color: C.muted, cursor: 'pointer',
          fontSize: 16, lineHeight: 1, padding: '0 4px',
        }}>×</button>
      </div>

      {/* Amount selector */}
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '.06em' }}>
        Shares to sell (you hold {position.size.toFixed(2)})
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {(['all', 'half'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={chip(mode === m, C.no)}>
            {m === 'all' ? `All (${position.size.toFixed(2)})` : `Half (${(position.size / 2).toFixed(2)})`}
          </button>
        ))}
        <input
          type="number" min="0.01" step="0.01" placeholder="Custom"
          value={mode === 'custom' ? custom : ''}
          onChange={e => { setMode('custom'); setCustom(e.target.value); }}
          onFocus={() => setMode('custom')}
          style={{
            width: 80, padding: '5px 8px', fontSize: 11, fontWeight: 700, borderRadius: 20,
            border: `1px solid ${mode === 'custom' ? C.no : C.border}`, outline: 'none',
            background: mode === 'custom' ? C.noDim : 'transparent', color: C.text,
          }}
        />
      </div>

      {/* Order type */}
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '.06em' }}>Order type</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['FOK', 'GTC'] as const).map(t => (
          <button key={t} onClick={() => setOrderType(t)}
            style={{ ...chip(orderType === t, C.brand), borderRadius: 7, padding: '6px 14px' }}>
            {t === 'FOK' ? '⚡ Market' : `📌 Limit ${pricePct}%`}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
        {orderType === 'FOK'
          ? 'Fills immediately · accepts up to 3% less USDC'
          : `Resting limit @ ${pricePct}% · fills when matched`}
      </div>

      {/* Summary */}
      {isValid && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '8px 12px', marginBottom: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: C.textMid }}>Sell</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{sharesToSell.toFixed(2)} shares</span>
          <span style={{ fontSize: 12, color: C.muted }}>→</span>
          <span style={{ fontSize: 12, color: C.textMid }}>Get ≈</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.yes }}>${estUsdc.toFixed(2)} USDC</span>
        </div>
      )}

      {/* Social login warning */}
      {!session.hasEthProvider && (
        <div style={{ fontSize: 11, color: C.amber, background: C.amberDim,
          border: `1px solid ${C.amber}44`, borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
          Social login detected — will open Polymarket to complete sell
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '9px', fontSize: 12, fontWeight: 600, borderRadius: 8,
          border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid, cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={submit} disabled={busy || !isValid}
          style={{
            flex: 2.5, padding: '9px', fontSize: 13, fontWeight: 800, borderRadius: 8,
            border: 'none', cursor: busy || !isValid ? 'not-allowed' : 'pointer',
            background: busy || !isValid ? C.muted : C.no, color: '#fff',
            opacity: busy ? 0.7 : 1,
          }}>
          {busy ? '⏳ Awaiting wallet…' : `Confirm Sell ${position.outcome}`}
        </button>
      </div>
    </div>
  );
}

// ─── Market Card (Search tab) ─────────────────────────────────────────────────
function MarketCard({
  market, session, activeOrder, balance, onBuy, onCancel, onSuccess, onError,
}: {
  market: PolymarketMarket;
  session: PolySession | null;
  activeOrder: { marketId: string; outcome: 'Yes' | 'No' } | null;
  balance: number | null;
  onBuy:    (m: PolymarketMarket, o: 'Yes' | 'No') => void;
  onCancel: () => void;
  onSuccess: (msg: string) => void;
  onError:   (msg: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const binary  = market.outcomes.length === 2 && market.outcomes[0]?.toLowerCase() === 'yes';
  const isOpen  = activeOrder?.marketId === market.id;
  const yPct    = Math.round((market.outcomePrices[0] ?? 0.5) * 100);
  const nPct    = 100 - yPct;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? C.cardHover : C.card,
        border: `1px solid ${isOpen ? C.borderLight : C.border}`,
        borderRadius: 12, padding: '12px 14px', marginBottom: 8,
        transition: 'background .15s, border-color .15s',
      }}
    >
      <div style={{
        fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.45,
        marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
      }}>
        {market.question}
      </div>

      <OddsBar outcomes={market.outcomes} prices={market.outcomePrices} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: C.muted }}>
          📊 {fmtVol(market.volume24hr || market.volume)}
        </span>
        {market.endDate && (
          <span style={{ fontSize: 11, color: C.muted }}>
            · ⏱ {fmtTimeLeft(market.endDate)}
          </span>
        )}
        <div style={{ flex: 1 }} />

        {binary && session ? (
          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={() => onBuy(market, 'Yes')} style={{
              fontSize: 11, fontWeight: 800,
              background: isOpen && activeOrder?.outcome === 'Yes' ? C.yes : C.yesDim,
              color: C.yes, border: `1px solid ${C.yes}55`, borderRadius: 6,
              padding: '4px 10px', cursor: 'pointer',
            }}>YES {yPct}%</button>
            <button onClick={() => onBuy(market, 'No')} style={{
              fontSize: 11, fontWeight: 800,
              background: isOpen && activeOrder?.outcome === 'No' ? C.no : C.noDim,
              color: C.no, border: `1px solid ${C.no}55`, borderRadius: 6,
              padding: '4px 10px', cursor: 'pointer',
            }}>NO {nPct}%</button>
          </div>
        ) : (
          <a href={market.url} target="_blank" rel="noopener noreferrer" style={{
            fontSize: 11, fontWeight: 700, background: C.brandDim,
            color: C.brand, border: `1px solid ${C.brand}44`, borderRadius: 6,
            padding: '4px 10px', textDecoration: 'none',
          }}>Trade ↗</a>
        )}
      </div>

      {isOpen && session && (
        <OrderPanel
          market={market} outcome={activeOrder!.outcome}
          session={session} balance={balance}
          onCancel={onCancel} onSuccess={onSuccess} onError={onError}
        />
      )}
    </div>
  );
}

// ─── Position Card (Portfolio tab) ────────────────────────────────────────────
function PositionCard({
  position, session, activeSell, onSell, onCancel, onSuccess, onError,
}: {
  position: Position;
  session: PolySession;
  activeSell: string | null;   // position.asset of open sell panel
  onSell:    (asset: string) => void;
  onCancel:  () => void;
  onSuccess: (msg: string) => void;
  onError:   (msg: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const isOpen  = activeSell === position.asset;
  const pnlPos  = position.pnl >= 0;
  const pnlColor = pnlPos ? C.yes : C.no;
  const curPct   = Math.round(position.currentPrice * 100);
  const avgPct   = Math.round(position.avgPrice * 100);
  const outcomeColor = position.outcome.toLowerCase() === 'yes' ? C.yes : C.no;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? C.cardHover : C.card,
        border: `1px solid ${isOpen ? C.borderLight : C.border}`,
        borderRadius: 12, padding: '12px 14px', marginBottom: 8,
        transition: 'background .15s, border-color .15s',
      }}
    >
      {/* Title + outcome badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.4, flex: 1,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
        }}>
          {position.title || 'Unknown market'}
        </div>
        <span style={{
          flexShrink: 0, fontSize: 10, fontWeight: 800, borderRadius: 20,
          padding: '3px 9px', border: `1px solid ${outcomeColor}55`,
          background: outcomeColor + '22', color: outcomeColor,
          marginTop: 1,
        }}>
          {position.outcome}
        </span>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10,
      }}>
        <div style={{ background: C.panel, borderRadius: 8, padding: '7px 10px' }}>
          <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '.06em', marginBottom: 3 }}>Shares</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
            {position.size.toFixed(2)}
          </div>
        </div>
        <div style={{ background: C.panel, borderRadius: 8, padding: '7px 10px' }}>
          <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '.06em', marginBottom: 3 }}>Price</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
            {curPct}%
            <span style={{ fontSize: 10, color: C.muted, marginLeft: 3 }}>
              (avg {avgPct}%)
            </span>
          </div>
        </div>
        <div style={{ background: C.panel, borderRadius: 8, padding: '7px 10px' }}>
          <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '.06em', marginBottom: 3 }}>P&amp;L</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: pnlColor }}>
            {fmtPnl(position.pnl, position.pnlPercent)}
          </div>
        </div>
      </div>

      {/* Value + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>
          <span style={{ fontSize: 11, color: C.muted }}>Value </span>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>
            ${position.currentValue.toFixed(2)}
          </span>
          <span style={{ fontSize: 10, color: C.muted }}>
            {' '}/ ${position.initialValue.toFixed(2)} cost
          </span>
        </div>
        <div style={{ flex: 1 }} />

        {position.closed ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted,
            background: C.border, borderRadius: 20, padding: '3px 10px' }}>
            Resolved
          </span>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <a
              href={`https://polymarket.com/event/${position.slug}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                fontSize: 11, fontWeight: 700, color: C.brand,
                background: C.brandDim, border: `1px solid ${C.brand}44`,
                borderRadius: 6, padding: '4px 9px', textDecoration: 'none',
              }}
            >View ↗</a>
            <button
              onClick={() => onSell(position.asset)}
              style={{
                fontSize: 11, fontWeight: 800,
                background: isOpen ? C.no : C.noDim,
                color: isOpen ? '#fff' : C.no,
                border: `1px solid ${C.no}55`, borderRadius: 6,
                padding: '4px 12px', cursor: 'pointer',
                transition: 'background .15s, color .15s',
              }}
            >
              {isOpen ? 'Selling…' : 'Sell'}
            </button>
          </div>
        )}
      </div>

      {/* Inline sell panel */}
      {isOpen && (
        <SellPanel
          position={position} session={session}
          onCancel={onCancel} onSuccess={onSuccess} onError={onError}
        />
      )}
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: '12px 14px', marginBottom: 8, border: `1px solid ${C.border}` }}>
      {[80, 95, 60].map((w, i) => (
        <div key={i} style={{ height: 12, borderRadius: 6, background: C.border, marginBottom: 8, width: `${w}%`,
          animation: 'pulse 1.6s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
      ))}
      <div style={{ height: 5, borderRadius: 4, background: C.border, marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ height: 26, width: 70, borderRadius: 6, background: C.border }} />
        <div style={{ height: 26, width: 70, borderRadius: 6, background: C.border }} />
      </div>
    </div>
  );
}

// ─── Session Panel ────────────────────────────────────────────────────────────
function SessionPanel({
  session, loading, noTab, balance, onRefresh,
}: {
  session: PolySession | null;
  loading: boolean;
  noTab: boolean;
  balance: number | null;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div style={{ padding: '10px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`,
        fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.muted,
          animation: 'pulse 1.4s infinite' }} />
        Checking session…
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ padding: '12px 16px', background: C.amberDim, borderBottom: `1px solid ${C.amber}44` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 4 }}>
          Not connected to Polymarket
        </div>
        <div style={{ fontSize: 11, color: C.textMid, marginBottom: 10, lineHeight: 1.55 }}>
          {noTab
            ? 'Open polymarket.com in any tab and log in.'
            : 'Log in at polymarket.com — MetaMask, Coinbase, WalletConnect, Google, email all work.'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => chrome.tabs.create({ url: 'https://polymarket.com' })} style={{
            ...btn(C.amber), flex: 1, padding: '8px', fontSize: 12,
          }}>Open Polymarket ↗</button>
          <button onClick={onRefresh} style={{
            padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
            border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid, cursor: 'pointer',
          }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '9px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green,
          display: 'inline-block', flexShrink: 0, boxShadow: `0 0 6px ${C.green}88` }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>
          {shortAddr(session.address)}
        </span>
      </div>
      {balance !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 1, height: 14, background: C.border }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: C.yes }}>${balance.toFixed(2)}</span>
          <span style={{ fontSize: 11, color: C.muted }}>USDC</span>
        </div>
      )}
      {!session.hasEthProvider && (
        <>
          <div style={{ width: 1, height: 14, background: C.border }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: C.amber,
            background: C.amberDim, borderRadius: 20, padding: '2px 8px', border: `1px solid ${C.amber}44` }}>
            Social login
          </span>
        </>
      )}
      <div style={{ flex: 1 }} />
      <button onClick={onRefresh} title="Refresh session" style={{
        background: 'none', border: 'none', color: C.muted, cursor: 'pointer',
        fontSize: 14, padding: '2px 4px',
      }}>↻</button>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <div style={{
      padding: '10px 16px', fontSize: 12, fontWeight: 600,
      background: ok ? C.yesDim : C.noDim,
      color: ok ? C.yes : C.no,
      borderBottom: `1px solid ${ok ? C.yes : C.no}44`,
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'slideDown .2s ease',
    }}>
      <span>{ok ? '✓' : '⚠'}</span>
      <span style={{ flex: 1 }}>{msg}</span>
    </div>
  );
}

// ─── Tab Nav ──────────────────────────────────────────────────────────────────
type Tab = 'search' | 'portfolio';

function TabNav({
  active, onChange, positionCount,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  positionCount: number | null;
}) {
  const tabStyle = (t: Tab): React.CSSProperties => ({
    flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700,
    background: 'none', border: 'none', cursor: 'pointer',
    color: active === t ? C.text : C.muted,
    borderBottom: `2px solid ${active === t ? C.brand : 'transparent'}`,
    transition: 'color .15s, border-color .15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  });

  return (
    <div style={{
      display: 'flex', background: C.panel,
      borderBottom: `1px solid ${C.border}`,
    }}>
      <button style={tabStyle('search')} onClick={() => onChange('search')}>
        🔍 Search
      </button>
      <button style={tabStyle('portfolio')} onClick={() => onChange('portfolio')}>
        💼 Portfolio
        {positionCount !== null && positionCount > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 800, background: C.brand,
            color: '#fff', borderRadius: 20, padding: '1px 6px',
            minWidth: 16, textAlign: 'center',
          }}>
            {positionCount}
          </span>
        )}
      </button>
    </div>
  );
}

// ─── Portfolio View ───────────────────────────────────────────────────────────
function PortfolioView({
  session, onSuccess, onError,
}: {
  session: PolySession | null;
  onSuccess: (msg: string) => void;
  onError:   (msg: string) => void;
}) {
  const [positions,  setPositions]  = useState<Position[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [loaded,     setLoaded]     = useState(false);
  const [activeSell, setActiveSell] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const pos = await getPositions(session.address);
      setPositions(pos);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [session]);

  // Auto-load when portfolio tab becomes visible
  useEffect(() => {
    if (!loaded) load();
  }, [load, loaded]);

  if (!session) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.textMid, marginBottom: 6 }}>
          Connect to Polymarket first
        </div>
        <div style={{ fontSize: 12 }}>Log in at polymarket.com to see your positions</div>
        <button
          onClick={() => chrome.tabs.create({ url: 'https://polymarket.com' })}
          style={{ ...btn(C.brand), marginTop: 16, fontSize: 12 }}
        >Open Polymarket ↗</button>
      </div>
    );
  }

  const open   = positions.filter(p => !p.closed);
  const closed = positions.filter(p => p.closed);
  const totalValue = open.reduce((s, p) => s + p.currentValue, 0);
  const totalPnl   = open.reduce((s, p) => s + p.pnl, 0);

  return (
    <div>
      {/* Summary bar */}
      {!loading && open.length > 0 && (
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: `1px solid ${C.border}`,
          background: C.panel,
        }}>
          {[
            { label: 'Positions', value: String(open.length), color: C.text },
            { label: 'Value', value: `$${totalValue.toFixed(2)}`, color: C.text },
            { label: 'P&L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? C.yes : C.no },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              flex: 1, padding: '10px 0', textAlign: 'center',
              borderRight: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '.06em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '10px 12px', maxHeight: 420, overflowY: 'auto' }}>
        {/* Loading skeletons */}
        {loading && [1, 2, 3].map(i => <SkeletonCard key={i} />)}

        {/* Empty state */}
        {!loading && loaded && positions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textMid, marginBottom: 6 }}>
              No open positions
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              You don't hold any shares yet.<br />
              Search for a market and place your first trade!
            </div>
          </div>
        )}

        {/* Open positions */}
        {!loading && open.map(p => (
          <PositionCard
            key={p.asset}
            position={p}
            session={session}
            activeSell={activeSell}
            onSell={asset => setActiveSell(prev => prev === asset ? null : asset)}
            onCancel={() => setActiveSell(null)}
            onSuccess={msg => { setActiveSell(null); onSuccess(msg); load(); }}
            onError={msg => onError(msg)}
          />
        ))}

        {/* Resolved positions */}
        {!loading && closed.length > 0 && (
          <>
            <div style={{
              fontSize: 10, fontWeight: 600, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '.06em',
              padding: '8px 4px 4px',
            }}>
              Resolved ({closed.length})
            </div>
            {closed.map(p => (
              <PositionCard
                key={p.asset}
                position={p}
                session={session}
                activeSell={null}
                onSell={() => {}}
                onCancel={() => {}}
                onSuccess={onSuccess}
                onError={onError}
              />
            ))}
          </>
        )}

        {/* Refresh button */}
        {!loading && loaded && (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <button onClick={load} style={{
              fontSize: 12, fontWeight: 600, color: C.muted,
              background: 'none', border: `1px solid ${C.border}`,
              borderRadius: 20, padding: '6px 16px', cursor: 'pointer',
            }}>↻ Refresh positions</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Search View ──────────────────────────────────────────────────────────────
const PENDING_TTL = 5 * 60 * 1000; // 5 min

function SearchView({
  session, balance, onToast,
}: {
  session: PolySession | null;
  balance: number | null;
  onToast: (ok: boolean, msg: string) => void;
}) {
  const [query,              setQuery]              = useState('');
  const [markets,            setMarkets]            = useState<PolymarketMarket[]>([]);
  const [searching,          setSearching]          = useState(false);
  const [searchError,        setSearchError]        = useState<string | null>(null);
  const [searched,           setSearched]           = useState(false);
  const [recents,            setRecents]            = useState<string[]>([]);
  const [showHints,          setShowHints]          = useState(false);
  const [activeOrder,        setActiveOrder]        = useState<{ marketId: string; outcome: 'Yes' | 'No' } | null>(null);
  const [overlayPending,     setOverlayPending]     = useState<{ market: PolymarketMarket; outcome: 'Yes' | 'No' } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const initRef   = useRef(false);

  useEffect(() => {
    chrome.storage.local.get('pm_recents', d => setRecents(d.pm_recents ?? []));
  }, []);

  const saveRecent = useCallback((q: string) => {
    setRecents(prev => {
      const next = [q, ...prev.filter(r => r !== q)].slice(0, 6);
      chrome.storage.local.set({ pm_recents: next });
      return next;
    });
  }, []);

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSearching(true);
    setSearchError(null);
    setSearched(true);
    setActiveOrder(null);
    setOverlayPending(null);
    setShowHints(false);
    saveRecent(trimmed);
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
  }, [saveRecent]);

  // On mount: check for pending trade from overlay FIRST, then fall back to tab-title auto-search
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    chrome.storage.local.get(['pm_pending_trade', 'pm_recents'], data => {
      setRecents(data.pm_recents ?? []);

      const pt = data.pm_pending_trade as
        { market: PolymarketMarket; outcome: 'Yes' | 'No'; ts: number } | undefined;

      if (pt && Date.now() - pt.ts < PENDING_TTL) {
        // ── Pending trade from overlay: pre-fill everything ──────────────
        chrome.storage.local.remove('pm_pending_trade');
        setMarkets([pt.market]);
        setSearched(true);
        setOverlayPending({ market: pt.market, outcome: pt.outcome });
        // Auto-open the order panel
        setActiveOrder({ marketId: pt.market.id, outcome: pt.outcome });
        return; // skip tab-title auto-search
      }

      // ── No pending trade: auto-search from active tab title ─────────────
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tab = tabs[0];
        if (!tab?.title || tab.url?.includes('polymarket.com')) return;
        const kw = keywordsFromTitle(tab.title);
        if (!kw) return;
        setQuery(kw);
        doSearch(kw);
      });
    });
  }, [doSearch]);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') doSearch(query);
    if (e.key === 'Escape') { setShowHints(false); (e.target as HTMLInputElement).blur(); }
  };

  return (
    <>
      {/* ── Pending trade banner (from overlay YES/NO click) ── */}
      {overlayPending && (
        <div style={{
          padding: '10px 16px',
          background: C.brandDim,
          borderBottom: `1px solid ${C.brand}44`,
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'slideDown .2s ease',
        }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.brand }}>
              Trade staged from page overlay
            </div>
            <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>
              {overlayPending.outcome} · {overlayPending.market.question.slice(0, 60)}
              {overlayPending.market.question.length > 60 ? '…' : ''}
            </div>
          </div>
          <button onClick={() => { setOverlayPending(null); setActiveOrder(null); }} style={{
            background: 'none', border: 'none', color: C.muted, cursor: 'pointer',
            fontSize: 16, padding: '2px 4px',
          }}>×</button>
        </div>
      )}

      {/* Search bar */}
      <div style={{ padding: '12px 16px', background: C.panel, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '0 12px',
          }}>
            <span style={{ fontSize: 14, color: C.muted, flexShrink: 0 }}>🔍</span>
            <input
              ref={searchRef}
              type="text" value={query}
              placeholder="Search any topic…"
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              onFocus={() => setShowHints(recents.length > 0)}
              onBlur={() => setTimeout(() => setShowHints(false), 150)}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 13, color: C.text, padding: '10px 0', fontFamily: FONT,
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setSearched(false); setMarkets([]); searchRef.current?.focus(); }}
                style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, padding: '0 2px' }}
              >×</button>
            )}
          </div>

          {showHints && recents.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
              marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.5)',
            }}>
              <div style={{ padding: '6px 12px', fontSize: 10, color: C.muted,
                textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Recent</div>
              {recents.map(r => (
                <button key={r} onClick={() => { setQuery(r); doSearch(r); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 14px', fontSize: 13, color: C.textMid,
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderTop: `1px solid ${C.border}`,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.cardHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  🕐 {r}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => doSearch(query)} disabled={searching || !query.trim()}
          style={{
            ...btn(C.brand, true), marginTop: 8,
            opacity: searching || !query.trim() ? 0.5 : 1,
            cursor: searching || !query.trim() ? 'not-allowed' : 'pointer',
          }}>
          {searching ? 'Searching…' : 'Search Markets'}
        </button>
      </div>

      {/* Results */}
      <div style={{ padding: '10px 12px', maxHeight: 400, overflowY: 'auto' }}>
        {searching && [1, 2, 3].map(i => <SkeletonCard key={i} />)}

        {searchError && !searching && (
          <div style={{
            textAlign: 'center', padding: '20px 16px', color: C.no,
            fontSize: 13, background: C.noDim, borderRadius: 10, border: `1px solid ${C.no}33`,
          }}>⚠ {searchError}</div>
        )}

        {!searching && searched && markets.length === 0 && !searchError && (
          <div style={{ textAlign: 'center', padding: '28px 16px', color: C.muted }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid }}>No active markets found</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Try different keywords</div>
          </div>
        )}

        {!searching && markets.map(m => (
          <MarketCard key={m.id} market={m} session={session}
            activeOrder={activeOrder} balance={balance}
            onBuy={(mkt, o) => setActiveOrder(prev =>
              prev?.marketId === mkt.id && prev.outcome === o ? null : { marketId: mkt.id, outcome: o }
            )}
            onCancel={() => setActiveOrder(null)}
            onSuccess={msg => { onToast(true, msg); setActiveOrder(null); }}
            onError={msg => onToast(false, msg)}
          />
        ))}

        {!searched && !searching && (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: C.muted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textMid, marginBottom: 6 }}>
              Search any topic
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.65 }}>
              {session
                ? 'Find a market, click YES% or NO% to order directly from here'
                : 'Log in at polymarket.com first, then search to place orders'}
            </div>
            {!session && (
              <button onClick={() => chrome.tabs.create({ url: 'https://polymarket.com' })}
                style={{ ...btn(C.brand), marginTop: 16, fontSize: 12 }}>
                Open Polymarket ↗
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 16px', borderTop: `1px solid ${C.border}`, background: C.panel,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 10, color: C.muted }}>
          {searched && !searching ? `${markets.length} market${markets.length !== 1 ? 's' : ''}` : 'Polymarket Radar v1.2'}
        </span>
        <a href="https://polymarket.com" target="_blank" rel="noopener"
          style={{ fontSize: 10, color: C.brand, fontWeight: 700, textDecoration: 'none' }}>
          polymarket.com ↗
        </a>
      </div>
    </>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session,        setSession]        = useState<PolySession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [noTab,          setNoTab]          = useState(false);
  const [balance,        setBalance]        = useState<number | null>(null);
  const [tab,            setTab]            = useState<Tab>('search');
  const [posCount,       setPosCount]       = useState<number | null>(null);
  const [toast,          setToast]          = useState<{ ok: boolean; msg: string } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((ok: boolean, msg: string) => {
    setToast({ ok, msg });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 5_000);
  }, []);

  const loadSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_SESSION' }) as
        { type: string; session: PolySession | null; noTab: boolean };
      setSession(res.session ?? null);
      setNoTab(res.noTab ?? false);
      if (res.session) {
        getPolyBalance(res.session.address).then(setBalance).catch(() => {});
        // Pre-fetch position count for badge
        getPositions(res.session.address)
          .then(ps => setPosCount(ps.filter(p => !p.closed).length))
          .catch(() => {});
      } else {
        setBalance(null);
        setPosCount(null);
      }
    } catch {
      setSession(null);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => { loadSession(); }, [loadSession]);

  return (
    <>
      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:none } }
        @keyframes pulse     { 0%,100% { opacity:.4 } 50% { opacity:1 } }
        * { box-sizing:border-box; }
        body { margin:0; background:${C.bg}; }
        ::-webkit-scrollbar { width:4px }
        ::-webkit-scrollbar-track { background:transparent }
        ::-webkit-scrollbar-thumb { background:${C.border}; border-radius:4px }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none }
        button:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 2px; }
      `}</style>

      <div style={{ fontFamily: FONT, background: C.bg, color: C.text, width: 420, minHeight: 200 }}>

        {/* Header */}
        <div style={{
          background: C.panel, borderBottom: `1px solid ${C.border}`,
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #6170FF, #0AC18E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>🎯</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: '-.01em' }}>
              Polymarket Radar
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
              Trade smarter, faster
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {session && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: C.yesDim, border: `1px solid ${C.yes}33`,
              borderRadius: 20, padding: '4px 10px',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green,
                display: 'inline-block', boxShadow: `0 0 5px ${C.green}` }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.yes, fontFamily: 'monospace' }}>
                {shortAddr(session.address)}
              </span>
            </div>
          )}
        </div>

        {/* Session strip */}
        <SessionPanel session={session} loading={sessionLoading} noTab={noTab}
          balance={balance} onRefresh={loadSession} />

        {/* Toast */}
        {toast && <Toast ok={toast.ok} msg={toast.msg} />}

        {/* Tab navigation */}
        <TabNav active={tab} onChange={setTab} positionCount={posCount} />

        {/* Tab content */}
        {tab === 'search' ? (
          <SearchView
            session={session}
            balance={balance}
            onToast={showToast}
          />
        ) : (
          <PortfolioView
            session={session}
            onSuccess={msg => showToast(true, msg)}
            onError={msg => showToast(false, msg)}
          />
        )}
      </div>
    </>
  );
}
