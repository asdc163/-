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
 * All login methods work (MetaMask, Coinbase, WalletConnect, Privy/social).
 */
export interface PolySession {
  address: string;
  apiKey: string;
  secret: string;
  passphrase: string;
  hasEthProvider: boolean;
}

/** A user's open position in a Polymarket market. */
export interface Position {
  asset: string;        // CLOB token ID (used for sell orders)
  title: string;        // market question
  slug: string;         // market slug → URL
  outcome: string;      // "Yes" or "No"
  outcomeIndex: number; // 0 or 1
  size: number;         // shares held
  avgPrice: number;     // average entry price (0–1)
  currentPrice: number; // current market price (0–1)
  initialValue: number; // USDC spent
  currentValue: number; // current USDC value
  pnl: number;          // P&L in USDC
  pnlPercent: number;   // P&L in %
  negRisk: boolean;
  closed: boolean;      // market resolved?
}

// Unsigned order for EIP-712 signing
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

export interface ClobOrderPayload extends UnsignedOrder {
  signature: string;
  negRisk: boolean;
}

export interface OrderParams {
  outcome: 'Yes' | 'No';
  usdcAmount: number;
  orderType: 'FOK' | 'GTC';
}

export interface SellParams {
  position: Position;
  sharesToSell: number;
  orderType: 'FOK' | 'GTC';
}

export interface PlacedOrder {
  orderId: string;
  transactionHash?: string;
  outcome: string;
  usdcAmount: number;
  price: number;
}

// ─── Background message types ─────────────────────────────────────────────────
export type BgMessage =
  | { type: 'SEARCH_MARKETS'; keywords: string[] }
  | { type: 'SEARCH_RESULT'; result: SearchResult }
  | { type: 'SEARCH_ERROR'; error: string }
  | { type: 'GET_SESSION' }
  | { type: 'SESSION_RESULT'; session: PolySession | null; noTab: boolean }
  | { type: 'PLACE_ORDER'; session: PolySession; params: OrderParams; market: PolymarketMarket }
  | { type: 'SELL_POSITION'; session: PolySession; sellParams: SellParams }
  | { type: 'ORDER_SUCCESS'; result: PlacedOrder }
  | { type: 'ORDER_ERROR'; error: string };
