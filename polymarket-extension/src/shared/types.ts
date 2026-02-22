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

// Wallet / auth state stored in chrome.storage.local
export interface WalletState {
  connected: boolean;
  address: string;
  apiKey: string;
  secret: string;
  passphrase: string;
  chainId: number;
}

// Raw order struct to be signed and submitted
export interface ClobOrderPayload {
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
  side: string;         // '0' = BUY
  signatureType: string;
  signature: string;
  negRisk: boolean;
}

export interface OrderParams {
  market: PolymarketMarket;
  outcome: 'Yes' | 'No';
  usdcAmount: number;   // raw USDC (e.g. 10 = $10)
}

export interface PlacedOrder {
  orderId: string;
  transactionHash?: string;
  outcome: string;
  usdcAmount: number;
  price: number;
}

// Background message types
export type BgMessage =
  | { type: 'SEARCH_MARKETS'; keywords: string[] }
  | { type: 'SEARCH_RESULT'; result: SearchResult }
  | { type: 'SEARCH_ERROR'; error: string }
  | { type: 'GET_WALLET' }
  | { type: 'WALLET_STATE'; wallet: WalletState | null }
  | { type: 'SAVE_WALLET'; wallet: WalletState }
  | { type: 'CLEAR_WALLET' }
  | { type: 'PLACE_ORDER'; wallet: WalletState; order: ClobOrderPayload }
  | { type: 'ORDER_SUCCESS'; result: PlacedOrder }
  | { type: 'ORDER_ERROR'; error: string };
