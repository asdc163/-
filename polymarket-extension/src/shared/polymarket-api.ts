import type { PolymarketMarket } from './types';

const GAMMA_BASE     = 'https://gamma-api.polymarket.com';
const POLYMARKET_BASE = 'https://polymarket.com';

interface RawMarket {
  id: string;
  question: string;
  slug: string;
  outcomes: string;
  outcomePrices: string;
  clobTokenIds: string;
  negRisk?: boolean;
  volume: string;
  volume24hr: string;
  liquidity: string;
  endDate: string;
  startDate?: string;
  active: boolean;
  closed: boolean;
}

interface RawEvent {
  id: string;
  title: string;
  slug: string;
  endDate: string;
  startDate?: string;
  active: boolean;
  closed: boolean;
  negRisk?: boolean;
  volume: string;
  volume24hr: string;
  liquidity: string;
  markets?: RawMarket[];
}

interface SearchResponse {
  events?: RawEvent[];
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseJsonArray(raw: string | undefined, fallback: string[]): string[] {
  try { return JSON.parse(raw || JSON.stringify(fallback)); } catch { return fallback; }
}

function parseOutcomePrices(raw: string | undefined): number[] {
  return parseJsonArray(raw, ['0.5', '0.5']).map(p => parseFloat(p));
}

/**
 * Relevance score: sum of (keyword length × occurrence count) in text.
 * Longer keyword matches are weighted more heavily to avoid false positives.
 */
function relevanceScore(text: string, keywords: string[]): number {
  const t = text.toLowerCase();
  return keywords.reduce((sum, kw) => {
    const re = new RegExp(kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const count = (t.match(re) ?? []).length;
    return sum + kw.length * count;
  }, 0);
}

/**
 * Composite freshness score: rewards markets that started recently (within 7d)
 * and have high 24h volume. Used as a secondary sort key.
 */
function freshnessScore(raw: RawMarket | RawEvent): number {
  const vol24h = parseFloat((raw as RawMarket).volume24hr || '0');
  const daysSinceStart = raw.startDate
    ? (Date.now() - new Date(raw.startDate).getTime()) / 86_400_000
    : 999;
  const recencyBonus = daysSinceStart < 7 ? (7 - daysSinceStart) * 10_000 : 0;
  return vol24h + recencyBonus;
}

function marketFromRaw(
  raw: RawMarket, eventSlug: string, eventTitle: string, keywords: string[]
): PolymarketMarket {
  const outcomes      = parseJsonArray(raw.outcomes, ['Yes', 'No']);
  const outcomePrices = parseOutcomePrices(raw.outcomePrices);
  const clobTokenIds  = parseJsonArray(raw.clobTokenIds, []);
  const url = raw.slug
    ? `${POLYMARKET_BASE}/market/${raw.slug}`
    : `${POLYMARKET_BASE}/event/${eventSlug}`;

  return {
    id: raw.id, question: raw.question, slug: raw.slug,
    outcomes, outcomePrices, clobTokenIds,
    negRisk: raw.negRisk ?? false,
    volume: parseFloat(raw.volume || '0'),
    volume24hr: parseFloat(raw.volume24hr || '0'),
    liquidity: parseFloat(raw.liquidity || '0'),
    endDate: raw.endDate, active: raw.active, closed: raw.closed,
    eventSlug, eventTitle, url,
    relevanceScore: relevanceScore(raw.question, keywords),
  };
}

function eventAsMarket(event: RawEvent, keywords: string[]): PolymarketMarket {
  return {
    id: event.id, question: event.title, slug: event.slug,
    outcomes: [], outcomePrices: [], clobTokenIds: [],
    negRisk: event.negRisk ?? false,
    volume: parseFloat(event.volume || '0'),
    volume24hr: parseFloat(event.volume24hr || '0'),
    liquidity: parseFloat(event.liquidity || '0'),
    endDate: event.endDate, active: event.active, closed: event.closed,
    eventSlug: event.slug, eventTitle: event.title,
    url: `${POLYMARKET_BASE}/event/${event.slug}`,
    relevanceScore: relevanceScore(event.title, keywords),
  };
}

// ─── Best market picker ───────────────────────────────────────────────────────

function pickBestMarket(
  event: RawEvent, keywords: string[]
): PolymarketMarket {
  const active = (event.markets ?? []).filter(m => m.active && !m.closed);
  if (active.length === 0) return eventAsMarket(event, keywords);

  // Prefer the most-liquid sub-market that best matches keywords
  const scored = active.map(m => ({
    m,
    score: relevanceScore(m.question, keywords) * 2 + parseFloat(m.liquidity || '0'),
  }));
  scored.sort((a, b) => b.score - a.score);
  return marketFromRaw(scored[0].m, event.slug, event.title, keywords);
}

// ─── Public search ────────────────────────────────────────────────────────────

/**
 * Search Polymarket for active markets matching keywords.
 *
 * Sort order (primary → secondary → tertiary):
 *  1. Relevance score (keyword match density)
 *  2. Freshness (started in last 7 days → +bonus) + 24h volume
 *  3. Market creation date (newer first)
 *
 * This ensures the most recent, currently-traded events surface first —
 * not markets that happen to expire soon.
 */
export async function searchMarkets(
  keywords: string[],
  limit = 8
): Promise<PolymarketMarket[]> {
  if (keywords.length === 0) return [];

  const query = keywords.join(' ');
  const seen  = new Set<string>();
  const markets: PolymarketMarket[] = [];

  const addEvent = (event: RawEvent) => {
    if (!event.active || event.closed) return;
    if (seen.has(event.slug)) return;
    seen.add(event.slug);
    markets.push(pickBestMarket(event, keywords));
  };

  // ── Primary: /public-search (Polymarket's native keyword search) ──────────
  try {
    const url =
      `${GAMMA_BASE}/public-search?q=${encodeURIComponent(query)}` +
      `&keep_closed_markets=0&limit_per_type=25&search_tags=false&search_profiles=false`;
    const res = await fetch(url);
    if (res.ok) {
      const data: SearchResponse = await res.json();
      (data.events ?? []).forEach(addEvent);
    }
  } catch (e) {
    console.warn('[PolymarketRadar] /public-search error:', e);
  }

  // ── Fallback: trending active events filtered client-side ─────────────────
  if (markets.length < limit) {
    try {
      const url =
        `${GAMMA_BASE}/events?active=true&closed=false` +
        `&limit=80&order=volume_24hr&ascending=false`;
      const res = await fetch(url);
      if (res.ok) {
        const events: RawEvent[] = await res.json();
        for (const ev of events) {
          if (markets.length >= limit * 2) break;
          if (relevanceScore(ev.title, keywords) === 0) continue;
          addEvent(ev);
        }
      }
    } catch (e) {
      console.warn('[PolymarketRadar] /events fallback error:', e);
    }
  }

  // ── Sort: relevance first, then freshness+volume, then newest start ────────
  markets.sort((a, b) => {
    // 1. Relevance
    const relDiff = (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
    if (relDiff !== 0) return relDiff;
    // 2. 24h volume (proxy for "this market is hot right now")
    const volDiff = (b.volume24hr) - (a.volume24hr);
    if (Math.abs(volDiff) > 1000) return volDiff > 0 ? 1 : -1;
    // 3. All else equal: don't prefer expiring-soon markets
    return 0;
  });

  return markets.slice(0, limit);
}
