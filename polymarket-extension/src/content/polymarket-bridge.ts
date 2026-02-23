/**
 * polymarket-bridge.ts
 * Injected into https://polymarket.com/* pages (ISOLATED world).
 *
 * Responsibilities:
 *  1. Scan localStorage for CLOB L2 credentials (apiKey/secret/passphrase/address)
 *     — these are stored by Polymarket after any login method (MetaMask, social, etc.)
 *  2. Detect whether window.ethereum is available (via MAIN world injection)
 *  3. Sign EIP-712 orders using the page's wallet (MAIN world injection → postMessage)
 *
 * Communication:
 *  Background → (chrome.tabs.sendMessage) → this script → (sendResponse) → Background
 *  For signing: this script injects a <script> tag into MAIN world, receives result via postMessage.
 */

import type { PolySession, UnsignedOrder } from '../shared/types';

// ─── localStorage scanner ─────────────────────────────────────────────────

function extractCredsFromObj(obj: unknown): Omit<PolySession, 'hasEthProvider'> | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;

  const apiKey = (o.apiKey ?? o.api_key ?? o.POLY_API_KEY) as string | undefined;
  const secret = (o.secret ?? o.POLY_SIGNATURE) as string | undefined;
  const passphrase = (o.passphrase ?? o.POLY_PASSPHRASE) as string | undefined;
  const address = (o.address ?? o.maker ?? o.POLY_ADDRESS) as string | undefined;

  if (apiKey && secret && passphrase && address) {
    return { address: address.toLowerCase(), apiKey, secret, passphrase };
  }

  // Try one level of nesting (e.g. { credentials: { apiKey, ... } })
  for (const field of ['credentials', 'creds', 'auth', 'clob', 'wallet', 'user', 'data', 'api']) {
    if (o[field]) {
      const nested = extractCredsFromObj(o[field]);
      if (nested) return nested;
    }
  }

  return null;
}

function scanLocalStorage(): Omit<PolySession, 'hasEthProvider'> | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw || raw[0] !== '{') continue;
        // Quick string pre-check to avoid unnecessary JSON.parse
        if (!raw.includes('secret') && !raw.includes('passphrase')) continue;
        const obj = JSON.parse(raw) as unknown;
        const creds = extractCredsFromObj(obj);
        if (creds) return creds;
      } catch { /* skip malformed entries */ }
    }
  } catch { /* localStorage access denied */ }
  return null;
}

// ─── MAIN world injection ─────────────────────────────────────────────────
// Content scripts run in ISOLATED world and cannot access window.ethereum
// directly. We inject a <script> element that runs in MAIN world and
// communicates back via window.postMessage.

function runInMainWorld<T>(code: string, nonce: string, timeoutMs = 5_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      if (!event.data || event.data.__pmNonce !== nonce) return;
      window.removeEventListener('message', handler);
      clearTimeout(timer);
      if (event.data.error) reject(new Error(event.data.error as string));
      else resolve(event.data.result as T);
    };

    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('MAIN world call timed out'));
    }, timeoutMs);

    window.addEventListener('message', handler);

    const script = document.createElement('script');
    // Wrap in IIFE so the nonce variable is scoped
    script.textContent = `(function(){const __n=${JSON.stringify(nonce)};${code}})();`;
    document.documentElement.appendChild(script);
    script.remove();
  });
}

async function checkEthProvider(): Promise<boolean> {
  const nonce = `_pmchk_${Date.now()}`;
  try {
    return await runInMainWorld<boolean>(
      `window.postMessage({__pmNonce:__n,result:typeof window.ethereum!=='undefined'},'*');`,
      nonce,
      2_000
    );
  } catch {
    return false;
  }
}

async function signOrderInPage(
  address: string,
  order: UnsignedOrder,
  domain: object
): Promise<string> {
  const nonce = `_pmsign_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const typedData = {
    domain,
    types: {
      Order: [
        { name: 'salt',           type: 'uint256' },
        { name: 'maker',          type: 'address' },
        { name: 'signer',         type: 'address' },
        { name: 'taker',          type: 'address' },
        { name: 'tokenId',        type: 'uint256' },
        { name: 'makerAmount',    type: 'uint256' },
        { name: 'takerAmount',    type: 'uint256' },
        { name: 'expiration',     type: 'uint256' },
        { name: 'nonce',          type: 'uint256' },
        { name: 'feeRateBps',     type: 'uint256' },
        { name: 'side',           type: 'uint8'   },
        { name: 'signatureType',  type: 'uint8'   },
      ],
    },
    primaryType: 'Order',
    message: order,
  };

  // Embed typed data as a JSON literal in the injected script
  const tdJson = JSON.stringify(JSON.stringify(typedData)); // double-stringify: outer for JS string literal
  const addrJson = JSON.stringify(address);

  const code = `
    (async function(){
      try{
        if(!window.ethereum){
          window.postMessage({__pmNonce:__n,error:'NO_WALLET'},'*');
          return;
        }
        const sig=await window.ethereum.request({
          method:'eth_signTypedData_v4',
          params:[${addrJson},${tdJson}]
        });
        window.postMessage({__pmNonce:__n,result:sig},'*');
      }catch(e){
        window.postMessage({__pmNonce:__n,error:e.message||String(e)},'*');
      }
    })();
  `;

  return runInMainWorld<string>(code, nonce, 120_000); // 2 min for user to approve
}

// ─── Message listener ─────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (msg: { type: string; address?: string; order?: UnsignedOrder; domain?: object },
   _sender,
   sendResponse
  ) => {

    if (msg.type === 'PM_GET_SESSION') {
      const creds = scanLocalStorage();
      if (!creds) {
        sendResponse({ session: null });
        return true;
      }
      // Async: check for window.ethereum provider
      checkEthProvider().then(hasEthProvider => {
        sendResponse({ session: { ...creds, hasEthProvider } });
      });
      return true; // keep message channel open for async response
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
