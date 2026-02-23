"use strict";
var PolymarketBg = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/background/service-worker.ts
  var service_worker_exports = {};

  // src/shared/polymarket-api.ts
  var GAMMA_BASE = "https://gamma-api.polymarket.com";
  var POLYMARKET_BASE = "https://polymarket.com";
  function parseJsonArray(raw, fallback) {
    try {
      return JSON.parse(raw || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }
  function parseOutcomePrices(raw) {
    return parseJsonArray(raw, ["0.5", "0.5"]).map((p) => parseFloat(p));
  }
  function relevanceScore(text, keywords) {
    const t = text.toLowerCase();
    return keywords.reduce((sum, kw) => {
      const re = new RegExp(kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      const count = (t.match(re) ?? []).length;
      return sum + kw.length * count;
    }, 0);
  }
  function marketFromRaw(raw, eventSlug, eventTitle, keywords) {
    const outcomes = parseJsonArray(raw.outcomes, ["Yes", "No"]);
    const outcomePrices = parseOutcomePrices(raw.outcomePrices);
    const clobTokenIds = parseJsonArray(raw.clobTokenIds, []);
    const url = raw.slug ? `${POLYMARKET_BASE}/market/${raw.slug}` : `${POLYMARKET_BASE}/event/${eventSlug}`;
    return {
      id: raw.id,
      question: raw.question,
      slug: raw.slug,
      outcomes,
      outcomePrices,
      clobTokenIds,
      negRisk: raw.negRisk ?? false,
      volume: parseFloat(raw.volume || "0"),
      volume24hr: parseFloat(raw.volume24hr || "0"),
      liquidity: parseFloat(raw.liquidity || "0"),
      endDate: raw.endDate,
      active: raw.active,
      closed: raw.closed,
      eventSlug,
      eventTitle,
      url,
      relevanceScore: relevanceScore(raw.question, keywords)
    };
  }
  function eventAsMarket(event, keywords) {
    return {
      id: event.id,
      question: event.title,
      slug: event.slug,
      outcomes: [],
      outcomePrices: [],
      clobTokenIds: [],
      negRisk: event.negRisk ?? false,
      volume: parseFloat(event.volume || "0"),
      volume24hr: parseFloat(event.volume24hr || "0"),
      liquidity: parseFloat(event.liquidity || "0"),
      endDate: event.endDate,
      active: event.active,
      closed: event.closed,
      eventSlug: event.slug,
      eventTitle: event.title,
      url: `${POLYMARKET_BASE}/event/${event.slug}`,
      relevanceScore: relevanceScore(event.title, keywords)
    };
  }
  function pickBestMarket(event, keywords) {
    const active = (event.markets ?? []).filter((m) => m.active && !m.closed);
    if (active.length === 0) return eventAsMarket(event, keywords);
    const scored = active.map((m) => ({
      m,
      score: relevanceScore(m.question, keywords) * 2 + parseFloat(m.liquidity || "0")
    }));
    scored.sort((a, b) => b.score - a.score);
    return marketFromRaw(scored[0].m, event.slug, event.title, keywords);
  }
  async function searchMarkets(keywords, limit = 8) {
    if (keywords.length === 0) return [];
    const query = keywords.join(" ");
    const seen = /* @__PURE__ */ new Set();
    const markets = [];
    const addEvent = (event) => {
      if (!event.active || event.closed) return;
      if (seen.has(event.slug)) return;
      seen.add(event.slug);
      markets.push(pickBestMarket(event, keywords));
    };
    try {
      const url = `${GAMMA_BASE}/public-search?q=${encodeURIComponent(query)}&keep_closed_markets=0&limit_per_type=25&search_tags=false&search_profiles=false`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        (data.events ?? []).forEach(addEvent);
      }
    } catch (e) {
      console.warn("[PolymarketRadar] /public-search error:", e);
    }
    if (markets.length < limit) {
      try {
        const url = `${GAMMA_BASE}/events?active=true&closed=false&limit=80&order=volume_24hr&ascending=false`;
        const res = await fetch(url);
        if (res.ok) {
          const events = await res.json();
          for (const ev of events) {
            if (markets.length >= limit * 2) break;
            if (relevanceScore(ev.title, keywords) === 0) continue;
            addEvent(ev);
          }
        }
      } catch (e) {
        console.warn("[PolymarketRadar] /events fallback error:", e);
      }
    }
    markets.sort((a, b) => {
      const relDiff = (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
      if (relDiff !== 0) return relDiff;
      const volDiff = b.volume24hr - a.volume24hr;
      if (Math.abs(volDiff) > 1e3) return volDiff > 0 ? 1 : -1;
      return 0;
    });
    return markets.slice(0, limit);
  }

  // src/shared/clob-client.ts
  var CLOB_BASE = "https://clob.polymarket.com";
  async function hmacSha256Hex(message, secret) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function buildL2Headers(wallet, method, path, body) {
    const timestamp = String(Math.floor(Date.now() / 1e3));
    const message = timestamp + method.toUpperCase() + path + (body ?? "");
    const signature = await hmacSha256Hex(message, wallet.secret);
    return {
      "Content-Type": "application/json",
      POLY_ADDRESS: wallet.address,
      POLY_SIGNATURE: signature,
      POLY_TIMESTAMP: timestamp,
      POLY_API_KEY: wallet.apiKey,
      POLY_PASSPHRASE: wallet.passphrase
    };
  }
  async function submitOrder(wallet, order, orderType = "GTC") {
    const { negRisk, ...orderFields } = order;
    const body = JSON.stringify({
      order: orderFields,
      owner: wallet.address,
      orderType
    });
    const headers = await buildL2Headers(wallet, "POST", "/order", body);
    const res = await fetch(`${CLOB_BASE}/order`, {
      method: "POST",
      headers,
      body
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error ?? data?.message ?? JSON.stringify(data);
      throw new Error(`Order failed (${res.status}): ${msg}`);
    }
    return {
      orderId: data.orderID ?? data.order_id ?? data.id ?? "unknown",
      transactionHash: data.transactionHash,
      outcome: order.side === "0" ? "BUY" : "SELL",
      usdcAmount: parseInt(order.makerAmount) / 1e6,
      price: parseInt(order.makerAmount) / parseInt(order.takerAmount)
    };
  }

  // src/background/service-worker.ts
  var CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982e";
  var NEG_RISK_CTF_EX = "0xC5d563A36AE78145C45a50134d48A1a293c969E1";
  var POLYGON_CHAIN_ID = 137;
  var CACHE_TTL = 6e4;
  var cache = /* @__PURE__ */ new Map();
  async function findPolymarketTab() {
    const tabs = await chrome.tabs.query({ url: "https://polymarket.com/*" });
    return tabs[0] ?? null;
  }
  function randomSalt() {
    return String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  }
  function buildUnsignedOrder(session, market, params) {
    const idx = params.outcome === "Yes" ? 0 : 1;
    const rawPrice = market.outcomePrices[idx] ?? 0.5;
    const tokenId = market.clobTokenIds[idx] ?? "";
    const effectivePrice = params.orderType === "FOK" ? Math.min(rawPrice * 1.05, 0.99) : rawPrice;
    const makerAmountBN = BigInt(Math.round(params.usdcAmount * 1e6));
    const priceMicro = BigInt(Math.round(effectivePrice * 1e6));
    const takerAmountBN = priceMicro > 0n ? makerAmountBN * 1000000n / priceMicro : makerAmountBN;
    const order = {
      salt: randomSalt(),
      maker: session.address,
      signer: session.address,
      taker: "0x0000000000000000000000000000000000000000",
      tokenId,
      makerAmount: makerAmountBN.toString(),
      takerAmount: takerAmountBN.toString(),
      expiration: "0",
      nonce: "0",
      feeRateBps: "0",
      side: "0",
      signatureType: "0"
    };
    const domain = {
      name: "CTF Exchange",
      version: "1",
      chainId: POLYGON_CHAIN_ID,
      verifyingContract: market.negRisk ? NEG_RISK_CTF_EX : CTF_EXCHANGE
    };
    return { order, domain };
  }
  chrome.runtime.onMessage.addListener(
    (message, _sender, sendResponse) => {
      switch (message.type) {
        // ── Market search ─────────────────────────────────────────────────
        case "SEARCH_MARKETS": {
          const key = message.keywords.join(",");
          const hit = cache.get(key);
          if (hit && hit.expiresAt > Date.now()) {
            sendResponse({ type: "SEARCH_RESULT", result: hit.result });
            return true;
          }
          searchMarkets(message.keywords).then((markets) => {
            const result = { markets, keywords: message.keywords, timestamp: Date.now() };
            cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL });
            sendResponse({ type: "SEARCH_RESULT", result });
          }).catch(
            (err) => sendResponse({ type: "SEARCH_ERROR", error: String(err?.message ?? err) })
          );
          return true;
        }
        // ── Get session from polymarket.com tab ───────────────────────────
        case "GET_SESSION": {
          findPolymarketTab().then((tab) => {
            if (!tab?.id) {
              sendResponse({ type: "SESSION_RESULT", session: null, noTab: true });
              return;
            }
            chrome.tabs.sendMessage(tab.id, { type: "PM_GET_SESSION" }).then((res) => {
              sendResponse({ type: "SESSION_RESULT", session: res?.session ?? null, noTab: false });
            }).catch(() => {
              sendResponse({ type: "SESSION_RESULT", session: null, noTab: false });
            });
          });
          return true;
        }
        // ── Place order via polymarket.com page session ───────────────────
        case "PLACE_ORDER": {
          const { session, params, market } = message;
          const { order, domain } = buildUnsignedOrder(session, market, params);
          findPolymarketTab().then((tab) => {
            if (!tab?.id) {
              throw new Error("No polymarket.com tab open. Please open Polymarket first.");
            }
            if (!session.hasEthProvider) {
              throw new Error("NO_ETH_PROVIDER");
            }
            return chrome.tabs.sendMessage(tab.id, {
              type: "PM_SIGN_ORDER",
              address: session.address,
              order,
              domain
            });
          }).then((res) => {
            if (!res) throw new Error("No response from Polymarket tab");
            if (res.error) throw new Error(res.error);
            const signed = { ...order, signature: res.signature, negRisk: market.negRisk };
            return submitOrder(session, signed, params.orderType);
          }).then((result) => sendResponse({ type: "ORDER_SUCCESS", result })).catch((err) => sendResponse({ type: "ORDER_ERROR", error: err.message ?? String(err) }));
          return true;
        }
        default:
          return false;
      }
    }
  );
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of cache) if (v.expiresAt <= now) cache.delete(k);
  }, 12e4);
  return __toCommonJS(service_worker_exports);
})();
