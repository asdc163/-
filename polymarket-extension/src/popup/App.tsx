import React, { useState, useEffect, useCallback } from 'react';
import type { PolymarketMarket, WalletState } from '../shared/types';
import { searchMarkets } from '../shared/polymarket-api';
import {
  connectWallet,
  authenticateWallet,
  loadWalletState,
  saveWalletState,
  clearWalletState,
  switchToPolygon,
  getChainId,
  getUsdcBalance,
} from '../shared/wallet';

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
  if (d > 60) return `${Math.floor(d / 30)}mo left`;
  if (d > 0) return `${d}d left`;
  const h = Math.floor(diff / 3_600_000);
  return h > 0 ? `${h}h left` : '<1h left';
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const POLYGON_CHAIN_ID = '0x89';

// ─── Sub-components ───────────────────────────────────────────────────────

function OddsBar({ outcomes, prices }: { outcomes: string[]; prices: number[] }) {
  const binary = outcomes.length === 2 && outcomes[0]?.toLowerCase() === 'yes';
  if (binary) {
    const yes = Math.round((prices[0] ?? 0.5) * 100);
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
          <span style={{ color: '#059669' }}>YES {yes}%</span>
          <span style={{ color: '#dc2626' }}>NO {100 - yes}%</span>
        </div>
        <div style={{ height: 5, background: '#fee2e2', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${yes}%`, height: '100%', background: '#059669', borderRadius: 3 }} />
        </div>
      </div>
    );
  }
  if (outcomes.length > 2) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {outcomes.slice(0, 4).map((o, i) => (
          <span key={o} style={{ fontSize: 10, background: '#f1f5f9', borderRadius: 4, padding: '2px 6px', color: '#475569', fontWeight: 500 }}>
            {o}{prices[i] != null && <span style={{ color: '#0d9488', fontWeight: 700 }}> {Math.round(prices[i] * 100)}%</span>}
          </span>
        ))}
      </div>
    );
  }
  return null;
}

function MarketCard({ market }: { market: PolymarketMarket }) {
  return (
    <div
      style={{ background: 'white', borderRadius: 8, padding: '10px 12px', marginBottom: 8, border: '1px solid #e2e8f0' }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', lineHeight: 1.4, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
        {market.question}
      </div>
      <OddsBar outcomes={market.outcomes} prices={market.outcomePrices} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
        <span>📊 {fmtVol(market.volume24hr || market.volume)} 24h</span>
        {market.endDate && <span>⏱ {fmtTimeLeft(market.endDate)}</span>}
        <a
          href={market.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 10, fontWeight: 700, background: '#0d9488', color: 'white', borderRadius: 4, padding: '3px 8px', textDecoration: 'none' }}
        >
          Bet ↗
        </a>
      </div>
    </div>
  );
}

// ─── Wallet panel ─────────────────────────────────────────────────────────

function WalletPanel({
  wallet,
  usdcBalance,
  connecting,
  connectError,
  onConnect,
  onDisconnect,
}: {
  wallet: WalletState | null;
  usdcBalance: number | null;
  connecting: boolean;
  connectError: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (wallet?.connected) {
    return (
      <div style={{ padding: '10px 12px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>Connected</span>
          </div>
          <button
            onClick={onDisconnect}
            style={{ fontSize: 10, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
          >
            Disconnect
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#166534', fontFamily: 'monospace', marginBottom: 4 }}>
          {shortAddr(wallet.address)}
        </div>
        {usdcBalance !== null && (
          <div style={{ fontSize: 10, color: '#64748b' }}>
            Wallet USDC: <strong style={{ color: '#059669' }}>${usdcBalance.toFixed(2)}</strong>
            <span style={{ marginLeft: 6, color: '#94a3b8' }}>(on Polygon)</span>
          </div>
        )}
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
          To bet, click overlay → Bet YES/NO on a market
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 12px', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
        Connect your MetaMask wallet to place bets directly from the extension.
      </div>
      {connectError && (
        <div style={{ fontSize: 10, color: '#dc2626', background: '#fef2f2', borderRadius: 5, padding: '5px 8px', marginBottom: 8 }}>
          ⚠️ {connectError}
        </div>
      )}
      <button
        onClick={onConnect}
        disabled={connecting}
        style={{
          width: '100%', padding: '8px', background: connecting ? '#94a3b8' : '#0d9488',
          color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700,
          cursor: connecting ? 'not-allowed' : 'pointer',
        }}
      >
        {connecting ? '⏳ Connecting…' : '🦊 Connect MetaMask'}
      </button>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────

export default function App() {
  const [query, setQuery] = useState('');
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Wallet state
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Load persisted wallet on popup open
  useEffect(() => {
    loadWalletState().then(w => {
      if (w) {
        setWallet(w);
        getUsdcBalance(w.address).then(setUsdcBalance);
      }
    });
  }, []);

  // ── Wallet connect ────────────────────────────────────────────────────

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const address = await connectWallet();

      // Check/switch to Polygon
      const chainId = await getChainId();
      if (chainId !== POLYGON_CHAIN_ID) {
        await switchToPolygon();
      }

      // L1 auth: sign EIP-712 message to derive API credentials
      const w = await authenticateWallet(address);
      await saveWalletState(w);
      setWallet(w);

      // Fetch USDC balance
      const bal = await getUsdcBalance(address);
      setUsdcBalance(bal);
    } catch (err) {
      setConnectError((err as Error).message ?? 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    await clearWalletState();
    setWallet(null);
    setUsdcBalance(null);
  }, []);

  // ── Search ────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const keywords = trimmed.split(/\s+/).filter(Boolean);
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const results = await searchMarkets(keywords, 8);
      setMarkets(results);
    } catch {
      setError('Failed to search markets. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch(query);
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d9488', color: 'white', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🎯</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Polymarket Radar</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>Predict & bet from your browser</div>
        </div>
        {wallet?.connected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,.15)', borderRadius: 20, padding: '3px 8px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
            <span style={{ fontSize: 10, fontWeight: 600 }}>{shortAddr(wallet.address)}</span>
          </div>
        )}
      </div>

      {/* Wallet panel */}
      <WalletPanel
        wallet={wallet}
        usdcBalance={usdcBalance}
        connecting={connecting}
        connectError={connectError}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      {/* Search bar */}
      <div style={{ padding: '10px 12px', background: 'white', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search topic (e.g. bitcoin, election)"
            style={{ flex: 1, padding: '7px 10px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, outline: 'none', color: '#1e293b' }}
          />
          <button
            onClick={() => handleSearch(query)}
            disabled={loading}
            style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={{ padding: '10px 12px', maxHeight: 360, overflowY: 'auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12 }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>⏳</div>
            Searching Polymarket…
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#dc2626', fontSize: 12 }}>
            ⚠️ {error}
          </div>
        )}

        {!loading && searched && markets.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12 }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>🔍</div>
            No active markets found for this topic
          </div>
        )}

        {!loading && markets.map(m => <MarketCard key={m.id} market={m} />)}

        {!searched && !loading && (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: '#94a3b8', fontSize: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🎯</div>
            <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Search any topic</div>
            <div>
              Or browse Twitter/X &amp; YouTube —<br />
              the overlay auto-detects relevant markets
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9', fontSize: 10, color: '#cbd5e1', textAlign: 'center' }}>
        Sorted by closest end date · Data from{' '}
        <a href="https://polymarket.com" target="_blank" rel="noopener" style={{ color: '#0d9488', textDecoration: 'none', fontWeight: 600 }}>
          Polymarket
        </a>
      </div>
    </div>
  );
}
