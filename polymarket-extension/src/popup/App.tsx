import React, { useState, useEffect, useCallback } from 'react';
import type { PolymarketMarket } from '../shared/types';
import { searchMarkets } from '../shared/polymarket-api';

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
}

function formatTimeLeft(endDate: string): string {
  if (!endDate) return '';
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const days = Math.floor(diff / 86_400_000);
  if (days > 60) return `${Math.floor(days / 30)}mo left`;
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(diff / 3_600_000);
  return hours > 0 ? `${hours}h left` : '<1h left';
}

function OddsBar({ outcomes, prices }: { outcomes: string[]; prices: number[] }) {
  const isBinary =
    outcomes.length === 2 && outcomes[0]?.toLowerCase() === 'yes';

  if (isBinary) {
    const yesPct = Math.round((prices[0] ?? 0.5) * 100);
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
          <span style={{ color: '#059669' }}>YES {yesPct}%</span>
          <span style={{ color: '#dc2626' }}>NO {100 - yesPct}%</span>
        </div>
        <div style={{ height: 5, background: '#fee2e2', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${yesPct}%`, height: '100%', background: '#059669', borderRadius: 3 }} />
        </div>
      </div>
    );
  }

  if (outcomes.length > 2) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {outcomes.slice(0, 4).map((o, i) => (
          <span
            key={o}
            style={{
              fontSize: 10, background: '#f1f5f9', borderRadius: 4,
              padding: '2px 6px', color: '#475569', fontWeight: 500,
            }}
          >
            {o}{prices[i] != null && (
              <span style={{ color: '#0d9488', fontWeight: 700 }}>
                {' '}{Math.round(prices[i] * 100)}%
              </span>
            )}
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
      style={{
        background: 'white', borderRadius: 8, padding: '10px 12px',
        marginBottom: 8, border: '1px solid #e2e8f0', cursor: 'pointer',
      }}
      onClick={() => window.open(market.url, '_blank')}
    >
      <div
        style={{
          fontSize: 12, fontWeight: 600, color: '#1e293b',
          lineHeight: 1.4, marginBottom: 8,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}
      >
        {market.question}
      </div>

      <OddsBar outcomes={market.outcomes} prices={market.outcomePrices} />

      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 10, color: '#94a3b8',
        }}
      >
        <span>📊 {formatVolume(market.volume24hr || market.volume)} 24h</span>
        {market.endDate && <span>⏱ {formatTimeLeft(market.endDate)}</span>}
        <a
          href={market.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            fontSize: 10, fontWeight: 700, background: '#0d9488',
            color: 'white', borderRadius: 4, padding: '3px 8px',
            textDecoration: 'none', display: 'inline-flex',
            alignItems: 'center', gap: 3,
          }}
        >
          Bet ↗
        </a>
      </div>
    </div>
  );
}

export default function App() {
  const [query, setQuery] = useState('');
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

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
    } catch (err) {
      setError('Failed to search markets. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch(query);
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <div
        style={{
          background: '#0d9488', color: 'white', padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <span style={{ fontSize: 18 }}>🎯</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Polymarket Radar</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>
            Prediction markets for what you're reading
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 12px', background: 'white', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search topic (e.g. bitcoin, election)"
            style={{
              flex: 1, padding: '7px 10px', fontSize: 12,
              border: '1px solid #e2e8f0', borderRadius: 6,
              outline: 'none', color: '#1e293b',
            }}
          />
          <button
            onClick={() => handleSearch(query)}
            disabled={loading}
            style={{
              background: '#0d9488', color: 'white', border: 'none',
              borderRadius: 6, padding: '7px 12px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={{ padding: '10px 12px', maxHeight: 400, overflowY: 'auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12 }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>⏳</div>
            Searching Polymarket...
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

        {!loading && markets.map(m => (
          <MarketCard key={m.id} market={m} />
        ))}

        {!searched && !loading && (
          <div style={{ textAlign: 'center', padding: '28px 16px', color: '#94a3b8', fontSize: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🎯</div>
            <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
              Search any topic
            </div>
            <div>
              Or browse Twitter/X & YouTube — the overlay<br />
              will auto-detect relevant markets
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 12px', borderTop: '1px solid #f1f5f9',
          fontSize: 10, color: '#cbd5e1', textAlign: 'center',
        }}
      >
        Data from{' '}
        <a
          href="https://polymarket.com"
          target="_blank"
          rel="noopener"
          style={{ color: '#0d9488', textDecoration: 'none', fontWeight: 600 }}
        >
          Polymarket
        </a>
        {' '}· Active markets only
      </div>
    </div>
  );
}
