export interface PolymarketMarket {
  id: string;
  question: string;
  slug: string;
  outcomes: string[];
  outcomePrices: number[];
  clobTokenIds: string[];   // [yesTokenId, noTokenId]
  negRisk: boolean;
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

/**
 * Session read from polymarket.com's localStorage after the user logs in.
 * Works regardless of login method (MetaMask, Coinbase, WalletConnect, Privy/social).
 * Contains the CLOB L2 API credentials — no wallet signing needed for request auth.
 */
export interface PolySession {
  address: string;         // wallet address (lowercase)
  apiKey: string;          // CLOB L2 API key
  secret: string;          // CLOB L2 secret (used for HMAC request signing)
  passphrase: string;      // CLOB L2 passphrase
  hasEthProvider: boolean; // true = window.ethereum found → in-extension signing supported
}

// Unsigned order struct for EIP-712 signing (done via page's window.ethereum)
export interface UnsignedOrder {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: string;          // '0' = BUY, '1' = SELL
  signatureType: string; // '0' = EOA
}

// Signed order ready for CLOB API submission
export interface ClobOrderPayload extends UnsignedOrder {
  signature: string;
  negRisk: boolean;
}

export interface OrderParams {
  outcome: 'Yes' | 'No';
  usdcAmount: number;
  orderType: 'FOK' | 'GTC'; // FOK = market order (fill now), GTC = limit at current price
}

export interface PlacedOrder {
  orderId: string;
  transactionHash?: string;
  outcome: string;
  usdcAmount: number;
  price: number;
}

// ─── Background message types ─────────────────────────────────────────────

export type BgMessage =
  // Market search
  | { type: 'SEARCH_MARKETS'; keywords: string[] }
  | { type: 'SEARCH_RESULT'; result: SearchResult }
  | { type: 'SEARCH_ERROR'; error: string }

  // Session: reads CLOB credentials from polymarket.com tab's localStorage
  | { type: 'GET_SESSION' }
  | { type: 'SESSION_RESULT'; session: PolySession | null; noTab: boolean }

  // Order placement via the existing Polymarket page session
  | { type: 'PLACE_ORDER'; session: PolySession; params: OrderParams; market: PolymarketMarket }
  | { type: 'ORDER_SUCCESS'; result: PlacedOrder }
  | { type: 'ORDER_ERROR'; error: string };
