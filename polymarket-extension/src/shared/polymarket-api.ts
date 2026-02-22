import type { PolymarketMarket } from './types';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const POLYMARKET_BASE = 'https://polymarket.com';

interface RawMarket {
  id: string;
  question: string;
  slug: string;
  outcomes: string;
  outcomePrices: string;
  volume: string;
  volume24hr: string;
  liquidity: string;
  endDate: string;
  active: boolean;
  closed: boolean;
}

interface RawEvent {
  id: string;
  title: string;
  slug: string;
  endDate: string;
  active: boolean;
  closed: boolean;
  volume: string;
  volume24hr: string;
  liquidity: string;
  markets?: RawMarket[];
}

interface SearchResponse {
  events?: RawEvent[];
}

function parseOutcomePrices(raw: string | undefined): number[] {
  try {
    const parsed = JSON.parse(raw || '["0.5","0.5"]');
    return parsed.map((p: string) => parseFloat(p));
  } catch {
    return [0.5, 0.5];
  }
}

function parseOutcomes(raw: string | undefined): string[] {
  try {
    return JSON.parse(raw || '["Yes","No"]');
  } catch {
    return ['Yes', 'No'];
  }
}

function computeRelevanceScore(
  text: string,
  keywords: string[]
): number {
  const lowerText = text.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lowerText.includes(kw.toLowerCase())) {
      score += kw.length;
    }
  }
  return score;
}

function marketFromRaw(
  raw: RawMarket,
  eventSlug: string,
  eventTitle: string,
  keywords: string[]
): PolymarketMarket {
  const outcomes = parseOutcomes(raw.outcomes);
  const outcomePrices = parseOutcomePrices(raw.outcomePrices);
  const vol = parseFloat(raw.volume || '0');
  const vol24h = parseFloat(raw.volume24hr || '0');
  const liq = parseFloat(raw.liquidity || '0');

  const url = raw.slug
    ? `${POLYMARKET_BASE}/market/${raw.slug}`
    : `${POLYMARKET_BASE}/event/${eventSlug}`;

  return {
    id: raw.id,
    question: raw.question,
    slug: raw.slug,
    outcomes,
    outcomePrices,
    volume: vol,
    volume24hr: vol24h,
    liquidity: liq,
    endDate: raw.endDate,
    active: raw.active,
    closed: raw.closed,
    eventSlug,
    eventTitle,
    url,
    relevanceScore: computeRelevanceScore(raw.question, keywords),
  };
}

/**
 * Search Polymarket using the /public-search endpoint for keyword relevance,
 * then supplement with trending active markets (volume-ranked, client-side filtered) if needed.
 */
export async function searchMarkets(
  keywords: string[],
  limit = 5
): Promise<PolymarketMarket[]> {
  if (keywords.length === 0) return [];

  const query = keywords.join(' ');
  const markets: PolymarketMarket[] = [];

  // Primary: /public-search (correct Polymarket keyword search endpoint)
  try {
    const searchUrl =
      `${GAMMA_BASE}/public-search?q=${encodeURIComponent(query)}` +
      `&keep_closed_markets=0&limit_per_type=20&search_tags=false&search_profiles=false`;
    const res = await fetch(searchUrl);
    if (res.ok) {
      const data: SearchResponse = await res.json();
      const events = data.events || [];

      for (const event of events) {
        if (!event.active || event.closed) continue;
        const eventMarkets = event.markets || [];
        const activeMarkets = eventMarkets.filter(m => m.active && !m.closed);

        if (activeMarkets.length > 0) {
          // For binary markets (Yes/No), pick the most liquid one
          const best = activeMarkets.sort(
            (a, b) => parseFloat(b.liquidity || '0') - parseFloat(a.liquidity || '0')
          )[0];
          markets.push(marketFromRaw(best, event.slug, event.title, keywords));
        } else {
          // Event-level market (multi-outcome)
          markets.push({
            id: event.id,
            question: event.title,
            slug: event.slug,
            outcomes: [],
            outcomePrices: [],
            volume: parseFloat(event.volume || '0'),
            volume24hr: parseFloat(event.volume24hr || '0'),
            liquidity: parseFloat(event.liquidity || '0'),
            endDate: event.endDate,
            active: event.active,
            closed: event.closed,
            eventSlug: event.slug,
            eventTitle: event.title,
            url: `${POLYMARKET_BASE}/event/${event.slug}`,
            relevanceScore: computeRelevanceScore(event.title, keywords),
          });
        }
      }
    }
  } catch (e) {
    console.warn('[PolymarketRadar] Search endpoint error:', e);
  }

  // Fallback: fetch trending active events and filter client-side
  if (markets.length < limit) {
    try {
      const eventsUrl =
        `${GAMMA_BASE}/events?active=true&closed=false` +
        `&limit=50&order=volume_24hr&ascending=false`;
      const res = await fetch(eventsUrl);
      if (res.ok) {
        const events: RawEvent[] = await res.json();

        for (const event of events) {
          if (markets.length >= limit * 2) break;
          if (!event.active || event.closed) continue;

          const relevance = computeRelevanceScore(event.title, keywords);
          if (relevance === 0) continue;

          // Avoid duplicates
          if (markets.some(m => m.eventSlug === event.slug)) continue;

          const eventMarkets = event.markets || [];
          const activeMarkets = eventMarkets.filter(m => m.active && !m.closed);

          if (activeMarkets.length > 0) {
            const best = activeMarkets.sort(
              (a, b) => parseFloat(b.liquidity || '0') - parseFloat(a.liquidity || '0')
            )[0];
            markets.push(marketFromRaw(best, event.slug, event.title, keywords));
          } else {
            markets.push({
              id: event.id,
              question: event.title,
              slug: event.slug,
              outcomes: [],
              outcomePrices: [],
              volume: parseFloat(event.volume || '0'),
              volume24hr: parseFloat(event.volume24hr || '0'),
              liquidity: parseFloat(event.liquidity || '0'),
              endDate: event.endDate,
              active: event.active,
              closed: event.closed,
              eventSlug: event.slug,
              eventTitle: event.title,
              url: `${POLYMARKET_BASE}/event/${event.slug}`,
              relevanceScore: relevance,
            });
          }
        }
      }
    } catch (e) {
      console.warn('[PolymarketRadar] Events fallback error:', e);
    }
  }

  // Sort by relevance score desc, then by 24h volume desc
  markets.sort((a, b) => {
    const rel = (b.relevanceScore || 0) - (a.relevanceScore || 0);
    if (rel !== 0) return rel;
    return b.volume24hr - a.volume24hr;
  });

  return markets.slice(0, limit);
}
