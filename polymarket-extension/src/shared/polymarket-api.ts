import type { PolymarketMarket } from './types';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
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
  negRisk?: boolean;
  volume: string;
  volume24hr: string;
  liquidity: string;
  markets?: RawMarket[];
}

interface SearchResponse {
  events?: RawEvent[];
}

function parseJsonArray(raw: string | undefined, fallback: string[]): string[] {
  try {
    return JSON.parse(raw || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function parseOutcomePrices(raw: string | undefined): number[] {
  const parsed = parseJsonArray(raw, ['0.5', '0.5']);
  return parsed.map(p => parseFloat(p));
}

function computeRelevanceScore(text: string, keywords: string[]): number {
  const lowerText = text.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lowerText.includes(kw.toLowerCase())) score += kw.length;
  }
  return score;
}

function marketFromRaw(
  raw: RawMarket,
  eventSlug: string,
  eventTitle: string,
  keywords: string[]
): PolymarketMarket {
  const outcomes = parseJsonArray(raw.outcomes, ['Yes', 'No']);
  const outcomePrices = parseOutcomePrices(raw.outcomePrices);
  const clobTokenIds = parseJsonArray(raw.clobTokenIds, []);

  const url = raw.slug
    ? `${POLYMARKET_BASE}/market/${raw.slug}`
    : `${POLYMARKET_BASE}/event/${eventSlug}`;

  return {
    id: raw.id,
    question: raw.question,
    slug: raw.slug,
    outcomes,
    outcomePrices,
    clobTokenIds,
    negRisk: raw.negRisk ?? false,
    volume: parseFloat(raw.volume || '0'),
    volume24hr: parseFloat(raw.volume24hr || '0'),
    liquidity: parseFloat(raw.liquidity || '0'),
    endDate: raw.endDate,
    active: raw.active,
    closed: raw.closed,
    eventSlug,
    eventTitle,
    url,
    relevanceScore: computeRelevanceScore(raw.question, keywords),
  };
}

function eventAsMarket(event: RawEvent, keywords: string[]): PolymarketMarket {
  return {
    id: event.id,
    question: event.title,
    slug: event.slug,
    outcomes: [],
    outcomePrices: [],
    clobTokenIds: [],
    negRisk: event.negRisk ?? false,
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
  };
}

/**
 * Search Polymarket using the /public-search endpoint for keyword relevance,
 * then supplement with trending active markets (volume-ranked, client-side filtered) if needed.
 * Results sorted by endDate ascending (soonest-to-close first).
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
          // Pick the most liquid active market from this event
          const best = activeMarkets.sort(
            (a, b) => parseFloat(b.liquidity || '0') - parseFloat(a.liquidity || '0')
          )[0];
          markets.push(marketFromRaw(best, event.slug, event.title, keywords));
        } else {
          markets.push(eventAsMarket(event, keywords));
        }
      }
    }
  } catch (e) {
    console.warn('[PolymarketRadar] Search endpoint error:', e);
  }

  // Fallback: trending active events filtered client-side by keyword match
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

          if (markets.some(m => m.eventSlug === event.slug)) continue;

          const eventMarkets = event.markets || [];
          const activeMarkets = eventMarkets.filter(m => m.active && !m.closed);

          if (activeMarkets.length > 0) {
            const best = activeMarkets.sort(
              (a, b) => parseFloat(b.liquidity || '0') - parseFloat(a.liquidity || '0')
            )[0];
            markets.push(marketFromRaw(best, event.slug, event.title, keywords));
          } else {
            markets.push(eventAsMarket(event, keywords));
          }
        }
      }
    } catch (e) {
      console.warn('[PolymarketRadar] Events fallback error:', e);
    }
  }

  // Sort by endDate ascending (soonest to close = most urgent = shown first)
  // Markets with no endDate go to the end
  markets.sort((a, b) => {
    if (!a.endDate && !b.endDate) return 0;
    if (!a.endDate) return 1;
    if (!b.endDate) return -1;
    return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
  });

  return markets.slice(0, limit);
}
