/**
 * polymarket-bridge.ts — runs on https://polymarket.com/* (ISOLATED world)
 *
 * Responsibilities:
 *  1. Scan localStorage AND sessionStorage for CLOB L2 credentials.
 *     Polymarket stores these after any login (MetaMask, Coinbase, Privy social, etc.)
 *     under various key names — we scan all of them.
 *  2. Detect window.ethereum via a MAIN-world injection (isolated world can't see it).
 *  3. Sign EIP-712 orders using the page's connected wallet (MAIN world injection).
 *
 * Communication pattern:
 *   Background ──(chrome.tabs.sendMessage)──► this script ──(sendResponse)──► Background
 *   For signing: inject <script> into MAIN world → postMessage back to this script.
 */

import type { PolySession, UnsignedOrder } from '../shared/types';

// ─── Credential extraction ────────────────────────────────────────────────────

interface RawCreds {
  address: string;
  apiKey: string;
  secret: string;
  passphrase: string;
}

/**
 * Walk an object (one level deep) looking for the CLOB credential fields.
 * Polymarket uses various field name conventions across SDK versions.
 */
function extractCreds(obj: unknown): RawCreds | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;

  // Normalise field aliases
  const apiKey     = (o.apiKey     ?? o.api_key     ?? o.POLY_API_KEY     ?? o.key)      as string | undefined;
  const secret     = (o.secret     ?? o.POLY_SIGNATURE ?? o.secretKey     ?? o.sigKey)   as string | undefined;
  const passphrase = (o.passphrase ?? o.POLY_PASSPHRASE ?? o.pass         ?? o.phrase)   as string | undefined;
  const address    = (o.address    ?? o.POLY_ADDRESS  ?? o.maker          ?? o.userAddr) as string | undefined;

  if (apiKey && secret && passphrase && address) {
    return {
      address:    address.toLowerCase(),
      apiKey, secret, passphrase,
    };
  }

  // One level of nesting (e.g. { credentials: { apiKey, ... } })
  for (const field of [
    'credentials', 'creds', 'auth', 'clob', 'clobCreds', 'wallet', 'user',
    'account', 'session', 'data', 'api', 'keys',
  ]) {
    if (o[field]) {
      const nested = extractCreds(o[field]);
      if (nested) return nested;
    }
  }

  return null;
}

/**
 * Scan a Storage object (localStorage or sessionStorage) for CLOB credentials.
 * Checks all entries whose value looks like a JSON object containing 'secret' or 'passphrase'.
 */
function scanStorage(storage: Storage): RawCreds | null {
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      try {
        const raw = storage.getItem(key);
        if (!raw || raw[0] !== '{') continue;
        // Quick pre-filter before JSON.parse
        if (!raw.includes('secret') && !raw.includes('passphrase') && !raw.includes('POLY_')) continue;
        const parsed = JSON.parse(raw) as unknown;
        const creds = extractCreds(parsed);
        if (creds) return creds;
      } catch { /* skip malformed */ }
    }
  } catch { /* storage access denied */ }
  return null;
}

function findCreds(): RawCreds | null {
  // localStorage first (Polymarket's web app uses it for persistence)
  return scanStorage(localStorage) ?? scanStorage(sessionStorage);
}

// ─── MAIN-world injection helper ─────────────────────────────────────────────
// Content scripts run in ISOLATED world and cannot read window.ethereum.
// We inject a <script> into the real page context and communicate via postMessage.

function runInMainWorld<T>(code: string, nonce: string, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (ev: MessageEvent) => {
      if (!ev.data || ev.data.__pmNonce !== nonce) return;
      window.removeEventListener('message', handler);
      clearTimeout(timer);
      if (ev.data.error) reject(new Error(ev.data.error as string));
      else resolve(ev.data.result as T);
    };
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('MAIN world call timed out'));
    }, timeoutMs);
    window.addEventListener('message', handler);

    const script = document.createElement('script');
    // Wrap in IIFE; the nonce is captured as a local variable
    script.textContent = `(function(){var __n=${JSON.stringify(nonce)};${code}})();`;
    document.documentElement.appendChild(script);
    script.remove();
  });
}

async function hasEthProvider(): Promise<boolean> {
  const nonce = `_pmchk_${Date.now()}`;
  try {
    return await runInMainWorld<boolean>(
      `window.postMessage({__pmNonce:__n,result:typeof window.ethereum!=='undefined'},'*');`,
      nonce, 2_500
    );
  } catch { return false; }
}

async function signOrderInPage(address: string, order: UnsignedOrder, domain: object): Promise<string> {
  const nonce = `_pmsign_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const typedData = {
    domain,
    types: {
      Order: [
        { name: 'salt',          type: 'uint256' },
        { name: 'maker',         type: 'address' },
        { name: 'signer',        type: 'address' },
        { name: 'taker',         type: 'address' },
        { name: 'tokenId',       type: 'uint256' },
        { name: 'makerAmount',   type: 'uint256' },
        { name: 'takerAmount',   type: 'uint256' },
        { name: 'expiration',    type: 'uint256' },
        { name: 'nonce',         type: 'uint256' },
        { name: 'feeRateBps',    type: 'uint256' },
        { name: 'side',          type: 'uint8'   },
        { name: 'signatureType', type: 'uint8'   },
      ],
    },
    primaryType: 'Order',
    message: order,
  };

  // Double-serialise: JSON.stringify produces a JS string literal that is safe
  // to embed in a script tag (no </script> injection risk from our own data).
  const tdJson   = JSON.stringify(JSON.stringify(typedData));
  const addrJson = JSON.stringify(address);

  const code = `(async function(){
    try{
      if(!window.ethereum){
        window.postMessage({__pmNonce:__n,error:'NO_WALLET'},'*');return;
      }
      var sig=await window.ethereum.request({
        method:'eth_signTypedData_v4',
        params:[${addrJson},${tdJson}]
      });
      window.postMessage({__pmNonce:__n,result:sig},'*');
    }catch(e){
      window.postMessage({__pmNonce:__n,error:e&&e.message||String(e)},'*');
    }
  })();`;

  // 2 min timeout — enough for user to approve in the wallet UI
  return runInMainWorld<string>(code, nonce, 120_000);
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    msg: { type: string; address?: string; order?: UnsignedOrder; domain?: object },
    _sender,
    sendResponse
  ) => {
    if (msg.type === 'PM_GET_SESSION') {
      const raw = findCreds();
      if (!raw) {
        sendResponse({ session: null });
        return true;
      }
      // Async: probe for window.ethereum
      hasEthProvider().then(hasEth => {
        sendResponse({
          session: { ...raw, hasEthProvider: hasEth } satisfies PolySession,
        });
      });
      return true; // keep channel open for async response
    }

    if (msg.type === 'PM_SIGN_ORDER') {
      const { address, order, domain } = msg;
      if (!address || !order || !domain) {
        sendResponse({ error: 'Missing sign params' });
        return true;
      }
      signOrderInPage(address, order, domain)
        .then(signature => sendResponse({ signature }))
        .catch(err => sendResponse({ error: (err as Error).message }));
      return true;
    }

    return false;
  }
);
