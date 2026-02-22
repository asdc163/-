export interface PolymarketMarket {
  id: string;
  question: string;
  slug: string;
  outcomes: string[];
  outcomePrices: number[];
  volume: number;
  volume24hr: number;
  liquidity: number;
  endDate: string;
  active: boolean;
  closed: boolean;
  eventSlug?: string;
  eventTitle?: string;
  url: string;
  relevanceScore?: number;
}

export interface SearchResult {
  markets: PolymarketMarket[];
  keywords: string[];
  timestamp: number;
}

export type MessageType =
  | { type: 'SEARCH_MARKETS'; keywords: string[] }
  | { type: 'SEARCH_RESULT'; result: SearchResult }
  | { type: 'SEARCH_ERROR'; error: string }
  | { type: 'GET_CACHED'; url: string }
  | { type: 'TOGGLE_OVERLAY' };
