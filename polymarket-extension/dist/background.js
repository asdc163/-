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
    const parsed = parseJsonArray(raw, ["0.5", "0.5"]);
    return parsed.map((p) => parseFloat(p));
  }
  function computeRelevanceScore(text, keywords) {
    const lowerText = text.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (lowerText.includes(kw.toLowerCase())) score += kw.length;
    }
    return score;
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
      relevanceScore: computeRelevanceScore(raw.question, keywords)
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
      relevanceScore: computeRelevanceScore(event.title, keywords)
    };
  }
  async function searchMarkets(keywords, limit = 5) {
    if (keywords.length === 0) return [];
    const query = keywords.join(" ");
    const markets = [];
    try {
      const searchUrl = `${GAMMA_BASE}/public-search?q=${encodeURIComponent(query)}&keep_closed_markets=0&limit_per_type=20&search_tags=false&search_profiles=false`;
      const res = await fetch(searchUrl);
      if (res.ok) {
        const data = await res.json();
        const events = data.events || [];
        for (const event of events) {
          if (!event.active || event.closed) continue;
          const eventMarkets = event.markets || [];
          const activeMarkets = eventMarkets.filter((m) => m.active && !m.closed);
          if (activeMarkets.length > 0) {
            const best = activeMarkets.sort(
              (a, b) => parseFloat(b.liquidity || "0") - parseFloat(a.liquidity || "0")
            )[0];
            markets.push(marketFromRaw(best, event.slug, event.title, keywords));
          } else {
            markets.push(eventAsMarket(event, keywords));
          }
        }
      }
    } catch (e) {
      console.warn("[PolymarketRadar] Search endpoint error:", e);
    }
    if (markets.length < limit) {
      try {
        const eventsUrl = `${GAMMA_BASE}/events?active=true&closed=false&limit=50&order=volume_24hr&ascending=false`;
        const res = await fetch(eventsUrl);
        if (res.ok) {
          const events = await res.json();
          for (const event of events) {
            if (markets.length >= limit * 2) break;
            if (!event.active || event.closed) continue;
            const relevance = computeRelevanceScore(event.title, keywords);
            if (relevance === 0) continue;
            if (markets.some((m) => m.eventSlug === event.slug)) continue;
            const eventMarkets = event.markets || [];
            const activeMarkets = eventMarkets.filter((m) => m.active && !m.closed);
            if (activeMarkets.length > 0) {
              const best = activeMarkets.sort(
                (a, b) => parseFloat(b.liquidity || "0") - parseFloat(a.liquidity || "0")
              )[0];
              markets.push(marketFromRaw(best, event.slug, event.title, keywords));
            } else {
              markets.push(eventAsMarket(event, keywords));
            }
          }
        }
      } catch (e) {
        console.warn("[PolymarketRadar] Events fallback error:", e);
      }
    }
    markets.sort((a, b) => {
      if (!a.endDate && !b.endDate) return 0;
      if (!a.endDate) return 1;
      if (!b.endDate) return -1;
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
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
  async function submitOrder(wallet, order) {
    const { negRisk, ...orderFields } = order;
    const body = JSON.stringify({
      order: orderFields,
      owner: wallet.address,
      orderType: "GTC"
      // Good-Till-Cancelled
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
  var CACHE_TTL_MS = 6e4;
  var cache = /* @__PURE__ */ new Map();
  chrome.runtime.onMessage.addListener(
    (message, _sender, sendResponse) => {
      switch (message.type) {
        // ── Market search (with 60s cache) ──────────────────────────────
        case "SEARCH_MARKETS": {
          const { keywords } = message;
          const key = keywords.join(",");
          const cached = cache.get(key);
          if (cached && cached.expiresAt > Date.now()) {
            sendResponse({ type: "SEARCH_RESULT", result: cached.result });
            return true;
          }
          searchMarkets(keywords).then((markets) => {
            const result = { markets, keywords, timestamp: Date.now() };
            cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
            sendResponse({ type: "SEARCH_RESULT", result });
          }).catch((err) => {
            sendResponse({ type: "SEARCH_ERROR", error: String(err?.message ?? err) });
          });
          return true;
        }
        // ── Wallet state (read from chrome.storage) ─────────────────────
        case "GET_WALLET": {
          chrome.storage.local.get("polymarket_wallet").then((result) => {
            sendResponse({
              type: "WALLET_STATE",
              wallet: result.polymarket_wallet ?? null
            });
          });
          return true;
        }
        case "SAVE_WALLET": {
          chrome.storage.local.set({ polymarket_wallet: message.wallet }).then(() => sendResponse({ type: "WALLET_STATE", wallet: message.wallet }));
          return true;
        }
        case "CLEAR_WALLET": {
          chrome.storage.local.remove("polymarket_wallet").then(() => sendResponse({ type: "WALLET_STATE", wallet: null }));
          return true;
        }
        // ── Place CLOB order (background makes the authenticated HTTPS request)
        case "PLACE_ORDER": {
          const { wallet, order } = message;
          submitOrder(wallet, order).then((result) => {
            sendResponse({ type: "ORDER_SUCCESS", result });
          }).catch((err) => {
            sendResponse({ type: "ORDER_ERROR", error: String(err?.message ?? err) });
          });
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
