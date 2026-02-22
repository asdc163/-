/**
 * MetaMask / EIP-1193 wallet utilities.
 *
 * Runs in popup or content-script contexts where window.ethereum is available.
 * All EIP-712 signing is done via MetaMask (no private key stored in extension).
 */

import type { WalletState, ClobOrderPayload } from './types';
import type { PolymarketMarket } from './types';
import { deriveApiKey } from './clob-client';

const POLYGON_CHAIN_ID = '0x89';      // 137 decimal
const POLYGON_CHAIN_ID_NUM = 137;

// ─── EIP-712 domain definitions ──────────────────────────────────────────

const CLOB_AUTH_DOMAIN = {
  name: 'ClobAuthDomain',
  version: '1',
  chainId: POLYGON_CHAIN_ID_NUM,
};

const CLOB_AUTH_TYPES = {
  ClobAuth: [
    { name: 'address', type: 'address' },
    { name: 'timestamp', type: 'string' },
    { name: 'nonce', type: 'string' },
    { name: 'message', type: 'string' },
  ],
};

// CTF Exchange contract addresses (for order signing)
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982e';
const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1a293c969E1';

const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      isMetaMask?: boolean;
      selectedAddress?: string;
    };
  }
}

function ethereum() {
  if (!window.ethereum) throw new Error('MetaMask not found. Please install MetaMask.');
  return window.ethereum;
}

function randomSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // Convert to decimal string (uint256)
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  // Keep in safe JS range to avoid MetaMask issues
  return String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
}

// ─── Wallet connection ────────────────────────────────────────────────────

export async function connectWallet(): Promise<string> {
  const eth = ethereum();
  const accounts = (await eth.request({
    method: 'eth_requestAccounts',
  })) as string[];
  if (!accounts || accounts.length === 0) throw new Error('No accounts returned');
  return accounts[0].toLowerCase();
}

export async function getConnectedAddress(): Promise<string | null> {
  try {
    const eth = ethereum();
    const accounts = (await eth.request({ method: 'eth_accounts' })) as string[];
    return accounts && accounts.length > 0 ? accounts[0].toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function getChainId(): Promise<string> {
  const eth = ethereum();
  return (await eth.request({ method: 'eth_chainId' })) as string;
}

export async function switchToPolygon(): Promise<void> {
  const eth = ethereum();
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: POLYGON_CHAIN_ID }],
    });
  } catch (err: unknown) {
    // Chain not added yet — add it
    const error = err as { code?: number };
    if (error.code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: POLYGON_CHAIN_ID,
            chainName: 'Polygon Mainnet',
            nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
            rpcUrls: ['https://polygon-rpc.com'],
            blockExplorerUrls: ['https://polygonscan.com'],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

// ─── L1 auth: sign ClobAuthDomain message → derive API credentials ───────

export async function authenticateWallet(address: string): Promise<WalletState> {
  const eth = ethereum();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = '0';

  const typedData = {
    domain: CLOB_AUTH_DOMAIN,
    types: { ClobAuth: CLOB_AUTH_TYPES.ClobAuth },
    primaryType: 'ClobAuth',
    message: {
      address,
      timestamp,
      nonce,
      message: 'This message attests that I control the given wallet',
    },
  };

  const signature = (await eth.request({
    method: 'eth_signTypedData_v4',
    params: [address, JSON.stringify(typedData)],
  })) as string;

  const { apiKey, secret, passphrase } = await deriveApiKey(
    address,
    signature,
    timestamp,
    nonce
  );

  return {
    connected: true,
    address,
    apiKey,
    secret,
    passphrase,
    chainId: POLYGON_CHAIN_ID_NUM,
  };
}

// ─── Build + sign a CLOB order via MetaMask ───────────────────────────────

export async function buildAndSignOrder(
  wallet: WalletState,
  market: PolymarketMarket,
  outcome: 'Yes' | 'No',
  usdcAmount: number          // e.g. 10 means $10 USDC
): Promise<ClobOrderPayload> {
  const eth = ethereum();

  // Outcome index: 0 = Yes, 1 = No
  const outcomeIndex = outcome === 'Yes' ? 0 : 1;
  const price = market.outcomePrices[outcomeIndex] ?? 0.5;
  const tokenId = market.clobTokenIds[outcomeIndex];

  if (!tokenId) {
    throw new Error(
      `No CLOB token ID found for ${outcome} on this market. ` +
      `It may not support in-extension trading. Open on Polymarket instead.`
    );
  }

  // Convert USDC to 6-decimal integers using BigInt for precision
  const makerAmountBN = BigInt(Math.round(usdcAmount * 1e6));
  // takerAmount = how many outcome tokens received = makerAmount / price
  const priceMicro = BigInt(Math.round(price * 1e6));
  const takerAmountBN =
    priceMicro > 0n ? (makerAmountBN * 1_000_000n) / priceMicro : makerAmountBN;

  const salt = randomSalt();
  const verifyingContract = market.negRisk ? NEG_RISK_CTF_EXCHANGE : CTF_EXCHANGE;

  const orderMessage = {
    salt,
    maker: wallet.address,
    signer: wallet.address,
    taker: '0x0000000000000000000000000000000000000000',
    tokenId,
    makerAmount: makerAmountBN.toString(),
    takerAmount: takerAmountBN.toString(),
    expiration: '0',   // 0 = GTC (good-till-cancelled)
    nonce: '0',
    feeRateBps: '0',
    side: '0',         // 0 = BUY
    signatureType: '0', // 0 = EOA
  };

  const typedData = {
    domain: {
      name: 'CTF Exchange',
      version: '1',
      chainId: POLYGON_CHAIN_ID_NUM,
      verifyingContract,
    },
    types: { Order: ORDER_TYPES.Order },
    primaryType: 'Order',
    message: orderMessage,
  };

  const signature = (await eth.request({
    method: 'eth_signTypedData_v4',
    params: [wallet.address, JSON.stringify(typedData)],
  })) as string;

  return {
    ...orderMessage,
    signature,
    negRisk: market.negRisk,
  };
}

// ─── Wallet state persistence (chrome.storage.local) ────────────────────

export async function saveWalletState(wallet: WalletState): Promise<void> {
  return chrome.storage.local.set({ polymarket_wallet: wallet });
}

export async function loadWalletState(): Promise<WalletState | null> {
  const result = await chrome.storage.local.get('polymarket_wallet');
  return result.polymarket_wallet ?? null;
}

export async function clearWalletState(): Promise<void> {
  return chrome.storage.local.remove('polymarket_wallet');
}

// ─── USDC balance on Polygon ─────────────────────────────────────────────

const USDC_POLY = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e (bridged)
const NATIVE_USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // Native USDC

async function erc20BalanceOf(tokenAddress: string, userAddress: string): Promise<bigint> {
  const eth = ethereum();
  // keccak256("balanceOf(address)") = 0x70a08231
  const data = '0x70a08231' + userAddress.slice(2).padStart(64, '0');
  const result = (await eth.request({
    method: 'eth_call',
    params: [{ to: tokenAddress, data }, 'latest'],
  })) as string;
  return result && result !== '0x' ? BigInt(result) : 0n;
}

export async function getUsdcBalance(address: string): Promise<number> {
  try {
    const [bal1, bal2] = await Promise.all([
      erc20BalanceOf(USDC_POLY, address),
      erc20BalanceOf(NATIVE_USDC, address),
    ]);
    // Sum both USDC variants (both use 6 decimals)
    return Number((bal1 + bal2) / 1_000n) / 1_000; // divide by 10^6
  } catch {
    return 0;
  }
}
