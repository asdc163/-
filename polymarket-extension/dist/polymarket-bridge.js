"use strict";
var PolymarketBridge = (() => {
  // src/content/polymarket-bridge.ts
  function extractCreds(obj) {
    if (!obj || typeof obj !== "object") return null;
    const o = obj;
    const apiKey = o.apiKey ?? o.api_key ?? o.POLY_API_KEY ?? o.key;
    const secret = o.secret ?? o.POLY_SIGNATURE ?? o.secretKey ?? o.sigKey;
    const passphrase = o.passphrase ?? o.POLY_PASSPHRASE ?? o.pass ?? o.phrase;
    const address = o.address ?? o.POLY_ADDRESS ?? o.maker ?? o.userAddr;
    if (apiKey && secret && passphrase && address) {
      return {
        address: address.toLowerCase(),
        apiKey,
        secret,
        passphrase
      };
    }
    for (const field of [
      "credentials",
      "creds",
      "auth",
      "clob",
      "clobCreds",
      "wallet",
      "user",
      "account",
      "session",
      "data",
      "api",
      "keys"
    ]) {
      if (o[field]) {
        const nested = extractCreds(o[field]);
        if (nested) return nested;
      }
    }
    return null;
  }
  function scanStorage(storage) {
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) continue;
        try {
          const raw = storage.getItem(key);
          if (!raw || raw[0] !== "{") continue;
          if (!raw.includes("secret") && !raw.includes("passphrase") && !raw.includes("POLY_")) continue;
          const parsed = JSON.parse(raw);
          const creds = extractCreds(parsed);
          if (creds) return creds;
        } catch {
        }
      }
    } catch {
    }
    return null;
  }
  function findCreds() {
    return scanStorage(localStorage) ?? scanStorage(sessionStorage);
  }
  function runInMainWorld(code, nonce, timeoutMs) {
    return new Promise((resolve, reject) => {
      const handler = (ev) => {
        if (!ev.data || ev.data.__pmNonce !== nonce) return;
        window.removeEventListener("message", handler);
        clearTimeout(timer);
        if (ev.data.error) reject(new Error(ev.data.error));
        else resolve(ev.data.result);
      };
      const timer = setTimeout(() => {
        window.removeEventListener("message", handler);
        reject(new Error("MAIN world call timed out"));
      }, timeoutMs);
      window.addEventListener("message", handler);
      const script = document.createElement("script");
      script.textContent = `(function(){var __n=${JSON.stringify(nonce)};${code}})();`;
      document.documentElement.appendChild(script);
      script.remove();
    });
  }
  async function hasEthProvider() {
    const nonce = `_pmchk_${Date.now()}`;
    try {
      return await runInMainWorld(
        `window.postMessage({__pmNonce:__n,result:typeof window.ethereum!=='undefined'},'*');`,
        nonce,
        2500
      );
    } catch {
      return false;
    }
  }
  async function signOrderInPage(address, order, domain) {
    const nonce = `_pmsign_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const typedData = {
      domain,
      types: {
        Order: [
          { name: "salt", type: "uint256" },
          { name: "maker", type: "address" },
          { name: "signer", type: "address" },
          { name: "taker", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "makerAmount", type: "uint256" },
          { name: "takerAmount", type: "uint256" },
          { name: "expiration", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "feeRateBps", type: "uint256" },
          { name: "side", type: "uint8" },
          { name: "signatureType", type: "uint8" }
        ]
      },
      primaryType: "Order",
      message: order
    };
    const tdJson = JSON.stringify(JSON.stringify(typedData));
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
    return runInMainWorld(code, nonce, 12e4);
  }
  chrome.runtime.onMessage.addListener(
    (msg, _sender, sendResponse) => {
      if (msg.type === "PM_GET_SESSION") {
        const raw = findCreds();
        if (!raw) {
          sendResponse({ session: null });
          return true;
        }
        hasEthProvider().then((hasEth) => {
          sendResponse({
            session: { ...raw, hasEthProvider: hasEth }
          });
        });
        return true;
      }
      if (msg.type === "PM_SIGN_ORDER") {
        const { address, order, domain } = msg;
        if (!address || !order || !domain) {
          sendResponse({ error: "Missing sign params" });
          return true;
        }
        signOrderInPage(address, order, domain).then((signature) => sendResponse({ signature })).catch((err) => sendResponse({ error: err.message }));
        return true;
      }
      return false;
    }
  );
})();
