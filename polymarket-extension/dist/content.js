"use strict";
var PolymarketRadar = (() => {
  // src/content/keywords.ts
  var STOP_WORDS = /* @__PURE__ */ new Set([
    // Articles / prepositions / conjunctions
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "if",
    "as",
    "at",
    "by",
    "for",
    "in",
    "of",
    "on",
    "to",
    "up",
    "it",
    "its",
    "is",
    "be",
    "am",
    "are",
    "was",
    "were",
    "been",
    "being",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "shall",
    "can",
    "have",
    "has",
    "had",
    "not",
    "no",
    "so",
    "yet",
    "than",
    "then",
    "that",
    "this",
    "with",
    "from",
    "into",
    "via",
    "out",
    "off",
    "over",
    "about",
    "just",
    "more",
    "very",
    "too",
    "also",
    "only",
    "even",
    "such",
    "most",
    "me",
    "my",
    "we",
    "our",
    "you",
    "your",
    "he",
    "him",
    "his",
    "she",
    "her",
    "they",
    "them",
    "their",
    "i",
    "who",
    "what",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "both",
    "few",
    "some",
    "any",
    "other",
    "same",
    "here",
    "there",
    "once",
    "after",
    "before",
    "since",
    "while",
    "like",
    "get",
    "got",
    "go",
    "see",
    "let",
    "way",
    "now",
    "new",
    "one",
    "two",
    "first",
    "last",
    "day",
    "time",
    "year",
    "week",
    // Common web/social noise
    "watch",
    "video",
    "click",
    "link",
    "post",
    "tweet",
    "like",
    "share",
    "follow",
    "subscribe",
    "view",
    "read",
    "more",
    "show",
    "via",
    "rt",
    "amp",
    "http",
    "https",
    "www",
    "com",
    "org",
    "net"
  ]);
  var MIN_LENGTH = 3;
  var MAX_KEYWORDS = 6;
  function extractKeywords(texts) {
    const combined = texts.join(" ");
    const tokens = combined.replace(/https?:\/\/\S+/g, " ").replace(/[@#]\S+/g, " ").replace(/[^a-zA-Z0-9\s'-]/g, " ").toLowerCase().split(/\s+/).filter((w) => w.length >= MIN_LENGTH && !STOP_WORDS.has(w));
    const hashtags = (combined.match(/#(\w+)/g) || []).map((h) => h.slice(1).toLowerCase()).filter((h) => h.length >= MIN_LENGTH && !STOP_WORDS.has(h));
    const allTokens = [...tokens, ...hashtags];
    const freq = /* @__PURE__ */ new Map();
    for (const token of allTokens) {
      freq.set(token, (freq.get(token) || 0) + 1);
    }
    const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).map(([word]) => word);
    const deduplicated = [];
    for (const word of sorted) {
      if (deduplicated.length >= MAX_KEYWORDS) break;
      const isSubsumed = deduplicated.some(
        (existing) => existing.includes(word) || word.includes(existing)
      );
      if (!isSubsumed) deduplicated.push(word);
    }
    return deduplicated;
  }

  // src/content/extractors/twitter.ts
  function extractFromTwitter() {
    const texts = [];
    const tweetEls = document.querySelectorAll(
      '[data-testid="tweetText"]'
    );
    const viewportHeight = window.innerHeight;
    tweetEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.bottom >= -200 && rect.top <= viewportHeight + 200) {
        const text = el.textContent?.trim();
        if (text) texts.push(text);
      }
    });
    const articleTitle = document.querySelector(
      '[data-testid="tweet"] [data-testid="tweetText"]'
    );
    if (articleTitle?.textContent) {
      texts.unshift(articleTitle.textContent);
    }
    const quotedTweets = document.querySelectorAll(
      '[data-testid="quotedTweetText"]'
    );
    quotedTweets.forEach((el) => {
      const text = el.textContent?.trim();
      if (text) texts.push(text);
    });
    return extractKeywords(texts);
  }

  // src/content/extractors/youtube.ts
  function extractFromYouTube() {
    const texts = [];
    const titleSelectors = [
      "h1.ytd-video-primary-info-renderer",
      "h1.ytd-watch-metadata yt-formatted-string",
      "yt-formatted-string.ytd-video-primary-info-renderer",
      "#above-the-fold #title h1",
      "ytd-watch-metadata h1"
    ];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) {
        texts.push(el.textContent.trim());
        break;
      }
    }
    if (texts.length === 0 && document.title) {
      const pageTitle = document.title.replace(" - YouTube", "").trim();
      if (pageTitle) texts.push(pageTitle);
    }
    const channelEl = document.querySelector(
      "ytd-channel-name yt-formatted-string, #channel-name yt-formatted-string"
    );
    if (channelEl?.textContent?.trim()) {
      texts.push(channelEl.textContent.trim());
    }
    const descEl = document.querySelector(
      "#description ytd-text-inline-expander, #description-inner, ytd-expander[collapsed]"
    );
    if (descEl?.textContent?.trim()) {
      texts.push(descEl.textContent.trim().slice(0, 500));
    }
    const shortsTitle = document.querySelector(
      "h2.ytShortsVideoTitle"
    );
    if (shortsTitle?.textContent?.trim()) {
      texts.push(shortsTitle.textContent.trim());
    }
    return extractKeywords(texts);
  }

  // src/shared/i18n.ts
  var en = {
    appName: "Polymarket Radar",
    appSubtitle: "Trade smarter, faster",
    checkingSession: "Checking session\u2026",
    notConnected: "Not connected to Polymarket",
    loginHintNoTab: "Open polymarket.com in any tab and log in.",
    loginHintHasTab: "Log in at polymarket.com \u2014 MetaMask, Coinbase, WalletConnect, Google, email all work.",
    openPolymarket: "Open Polymarket \u2197",
    retry: "Retry",
    socialLogin: "Social login",
    vpnTitle: "Restricted region? You may need a VPN first.",
    vpnFree: "Free options: ProtonVPN \xB7 Windscribe (10 GB/mo)",
    tabSearch: "Search",
    tabPortfolio: "Portfolio",
    searchPlaceholder: "Search any topic\u2026",
    searchBtn: "Search Markets",
    searching: "Searching\u2026",
    recent: "Recent",
    noMarketsFound: "No active markets found",
    tryDifferentKw: "Try different keywords",
    searchPromptTitle: "Search any topic",
    searchPromptLoggedIn: "Find a market, click YES% or NO% to order directly from here",
    searchPromptLoggedOut: "Log in at polymarket.com first, then search to place orders",
    buyTitle: (o, p) => `Buy ${o} \xB7 ${p}%`,
    amountLabel: "Amount (USDC)",
    orderTypeLabel: "Order type",
    orderMarket: "\u26A1 Market",
    orderLimit: (p) => `\u{1F4CC} Limit ${p}%`,
    orderMarketHint: "Fills immediately \xB7 up to 5% slippage",
    orderLimitHint: (p) => `Resting limit @ ${p}% \xB7 fills when matched`,
    pay: "Pay",
    getApprox: "Get \u2248",
    shares: "shares",
    lowBal: (b) => `\u26A0 Balance $${b} may be insufficient`,
    cancel: "Cancel",
    awaitingWallet: "\u23F3 Awaiting wallet\u2026",
    confirmBuy: (o) => `Confirm Buy ${o}`,
    sellTitle: (o, p) => `Sell ${o} \xB7 ${p}%`,
    sharesLabel: (s) => `Shares to sell (you hold ${s})`,
    allShares: (s) => `All (${s})`,
    halfShares: (s) => `Half (${s})`,
    customPlaceholder: "Custom",
    sellMarketHint: "Fills immediately \xB7 accepts up to 3% less USDC",
    socialSellWarning: "Social login detected \u2014 will open Polymarket to complete sell",
    confirmSell: (o) => `Confirm Sell ${o}`,
    sellBtn: "Sell",
    sellingBtn: "Selling\u2026",
    connectFirst: "Connect to Polymarket first",
    connectFirstSub: "Log in at polymarket.com to see your positions",
    posLabel: "Positions",
    valueLabel: "Value",
    pnlLabel: "P&L",
    noPositions: "No open positions",
    noPositionsSub: "You don't hold any shares yet. Search for a market and place your first trade!",
    resolved: (n) => `Resolved (${n})`,
    refreshBtn: "\u21BB Refresh positions",
    resolvedBadge: "Resolved",
    viewLink: "View \u2197",
    sharesCol: "Shares",
    priceCol: "Price",
    pnlCol: "P&L",
    avgPct: (p) => `avg ${p}%`,
    costLabel: "cost",
    overlayPendingTitle: "Trade staged from page overlay",
    marketCount: (n) => `${n} market${n !== 1 ? "s" : ""}`,
    detectingTopics: "Detecting topics\u2026",
    searchingKw: (k) => `Searching: ${k}`,
    topicsKw: (k) => `Topics: ${k}`,
    noTopics: "No topics detected",
    scanningMarkets: "Scanning markets\u2026",
    searchingMarkets: "Searching markets\u2026",
    noMarketsOverlay: "No active markets for current content",
    readyToTrade: "\u26A1 Ready to trade!",
    pendingSubDefault: "Click the \u{1F3AF} toolbar icon to confirm your trade in the popup.",
    pendingSubDetail: (o, p) => `${o} @ ${p}% staged \u2014 click \u{1F3AF} in toolbar to confirm.`,
    openPopupBtn: "\u{1F3AF} Open Popup to Trade",
    dismissBtn: "dismiss",
    closeHint: "Close (won't reopen for this topic)",
    footerHint: "Click YES/NO to stage a trade \xB7 confirm via the \u{1F3AF} popup",
    yesTradeBtn: (p) => `YES ${p}% \u2014 Trade \u26A1`,
    noTradeBtn: (p) => `NO ${p}% \u2014 Trade \u26A1`,
    tradeOnPoly: "Trade on Polymarket \u2197",
    viewLink2: "View \u2197"
  };
  var zhTW = {
    appName: "Polymarket \u96F7\u9054",
    appSubtitle: "\u66F4\u8070\u660E\u3001\u66F4\u5FEB\u901F\u5730\u4EA4\u6613",
    checkingSession: "\u6B63\u5728\u6AA2\u67E5\u767B\u5165\u72C0\u614B\u2026",
    notConnected: "\u5C1A\u672A\u9023\u63A5\u5230 Polymarket",
    loginHintNoTab: "\u8ACB\u5728\u4EFB\u610F\u5206\u9801\u958B\u555F polymarket.com \u4E26\u767B\u5165\u3002",
    loginHintHasTab: "\u8ACB\u5728 polymarket.com \u767B\u5165 \u2014 MetaMask\u3001Coinbase\u3001Google\u3001Email \u7B49\u5747\u53EF\u4F7F\u7528\u3002",
    openPolymarket: "\u958B\u555F Polymarket \u2197",
    retry: "\u91CD\u8A66",
    socialLogin: "\u793E\u4EA4\u767B\u5165",
    vpnTitle: "\u5728\u53D7\u9650\u5730\u5340\uFF1F\u8ACB\u5148\u958B\u555F VPN\u3002",
    vpnFree: "\u514D\u8CBB\u9078\u9805\uFF1AProtonVPN \xB7 Windscribe\uFF08\u6BCF\u6708 10GB\uFF09",
    tabSearch: "\u641C\u5C0B",
    tabPortfolio: "\u6295\u8CC7\u7D44\u5408",
    searchPlaceholder: "\u641C\u5C0B\u4EFB\u4F55\u8A71\u984C\u2026",
    searchBtn: "\u641C\u5C0B\u5E02\u5834",
    searching: "\u641C\u5C0B\u4E2D\u2026",
    recent: "\u6700\u8FD1\u641C\u5C0B",
    noMarketsFound: "\u627E\u4E0D\u5230\u76F8\u95DC\u6D3B\u8E8D\u5E02\u5834",
    tryDifferentKw: "\u8ACB\u5617\u8A66\u5176\u4ED6\u95DC\u9375\u5B57",
    searchPromptTitle: "\u641C\u5C0B\u4EFB\u4F55\u8A71\u984C",
    searchPromptLoggedIn: "\u627E\u5230\u5E02\u5834\u5F8C\uFF0C\u9EDE\u64CA YES% \u6216 NO% \u5373\u53EF\u76F4\u63A5\u4E0B\u55AE",
    searchPromptLoggedOut: "\u8ACB\u5148\u5728 polymarket.com \u767B\u5165\uFF0C\u518D\u641C\u5C0B\u4E0B\u55AE",
    buyTitle: (o, p) => `\u8CB7\u5165 ${o} \xB7 ${p}%`,
    amountLabel: "\u91D1\u984D\uFF08USDC\uFF09",
    orderTypeLabel: "\u8A02\u55AE\u985E\u578B",
    orderMarket: "\u26A1 \u5E02\u50F9\u55AE",
    orderLimit: (p) => `\u{1F4CC} \u9650\u50F9 ${p}%`,
    orderMarketHint: "\u7ACB\u5373\u6210\u4EA4\u30FB\u5141\u8A31\u6700\u591A 5% \u6ED1\u9EDE",
    orderLimitHint: (p) => `\u9650\u50F9\u639B\u55AE @ ${p}%\u30FB\u64AE\u5408\u6642\u6210\u4EA4`,
    pay: "\u652F\u4ED8",
    getApprox: "\u7372\u5F97\u7D04",
    shares: "\u80A1\u4EFD",
    lowBal: (b) => `\u26A0 \u9918\u984D $${b} \u53EF\u80FD\u4E0D\u8DB3`,
    cancel: "\u53D6\u6D88",
    awaitingWallet: "\u23F3 \u7B49\u5F85\u9322\u5305\u78BA\u8A8D\u2026",
    confirmBuy: (o) => `\u78BA\u8A8D\u8CB7\u5165 ${o}`,
    sellTitle: (o, p) => `\u8CE3\u51FA ${o} \xB7 ${p}%`,
    sharesLabel: (s) => `\u8CE3\u51FA\u80A1\u4EFD\uFF08\u4F60\u6301\u6709 ${s}\uFF09`,
    allShares: (s) => `\u5168\u90E8\uFF08${s}\uFF09`,
    halfShares: (s) => `\u4E00\u534A\uFF08${s}\uFF09`,
    customPlaceholder: "\u81EA\u8A02",
    sellMarketHint: "\u7ACB\u5373\u6210\u4EA4\u30FB\u63A5\u53D7\u6700\u591A\u5C11 3% \u7684 USDC",
    socialSellWarning: "\u5075\u6E2C\u5230\u793E\u4EA4\u767B\u5165 \u2014 \u5C07\u958B\u555F Polymarket \u5B8C\u6210\u8CE3\u51FA",
    confirmSell: (o) => `\u78BA\u8A8D\u8CE3\u51FA ${o}`,
    sellBtn: "\u8CE3\u51FA",
    sellingBtn: "\u8CE3\u51FA\u4E2D\u2026",
    connectFirst: "\u8ACB\u5148\u9023\u63A5 Polymarket",
    connectFirstSub: "\u5728 polymarket.com \u767B\u5165\u4EE5\u67E5\u770B\u60A8\u7684\u6301\u5009",
    posLabel: "\u6301\u5009\u6578",
    valueLabel: "\u50F9\u503C",
    pnlLabel: "\u640D\u76CA",
    noPositions: "\u76EE\u524D\u6C92\u6709\u6301\u5009",
    noPositionsSub: "\u60A8\u76EE\u524D\u5C1A\u672A\u6301\u6709\u4EFB\u4F55\u80A1\u4EFD\u3002\u641C\u5C0B\u5E02\u5834\u4E26\u9032\u884C\u60A8\u7684\u7B2C\u4E00\u7B46\u4EA4\u6613\uFF01",
    resolved: (n) => `\u5DF2\u7D50\u7B97\uFF08${n}\uFF09`,
    refreshBtn: "\u21BB \u5237\u65B0\u6301\u5009",
    resolvedBadge: "\u5DF2\u7D50\u7B97",
    viewLink: "\u67E5\u770B \u2197",
    sharesCol: "\u80A1\u4EFD",
    priceCol: "\u50F9\u683C",
    pnlCol: "\u640D\u76CA",
    avgPct: (p) => `\u5747 ${p}%`,
    costLabel: "\u6210\u672C",
    overlayPendingTitle: "\u5DF2\u5F9E\u9801\u9762\u6D6E\u52D5\u8996\u7A97\u66AB\u5B58\u4EA4\u6613",
    marketCount: (n) => `${n} \u500B\u5E02\u5834`,
    detectingTopics: "\u6B63\u5728\u5075\u6E2C\u8A71\u984C\u2026",
    searchingKw: (k) => `\u641C\u5C0B\u4E2D\uFF1A${k}`,
    topicsKw: (k) => `\u8A71\u984C\uFF1A${k}`,
    noTopics: "\u672A\u5075\u6E2C\u5230\u8A71\u984C",
    scanningMarkets: "\u6B63\u5728\u6383\u63CF\u5E02\u5834\u2026",
    searchingMarkets: "\u641C\u5C0B\u5E02\u5834\u4E2D\u2026",
    noMarketsOverlay: "\u76EE\u524D\u5167\u5BB9\u7121\u76F8\u95DC\u6D3B\u8E8D\u5E02\u5834",
    readyToTrade: "\u26A1 \u6E96\u5099\u597D\u4EA4\u6613\u4E86\uFF01",
    pendingSubDefault: "\u9EDE\u64CA\u5DE5\u5177\u5217\u7684 \u{1F3AF} \u5716\u793A\uFF0C\u5728\u5F48\u51FA\u8996\u7A97\u4E2D\u78BA\u8A8D\u60A8\u7684\u4EA4\u6613\u3002",
    pendingSubDetail: (o, p) => `${o} @ ${p}% \u5DF2\u66AB\u5B58 \u2014 \u9EDE\u64CA\u5DE5\u5177\u5217 \u{1F3AF} \u78BA\u8A8D\u3002`,
    openPopupBtn: "\u{1F3AF} \u958B\u555F\u5F48\u51FA\u8996\u7A97\u4EA4\u6613",
    dismissBtn: "\u95DC\u9589",
    closeHint: "\u95DC\u9589\uFF08\u6B64\u8A71\u984C 3 \u5206\u9418\u5167\u4E0D\u518D\u5F48\u51FA\uFF09",
    footerHint: "\u9EDE\u64CA YES/NO \u66AB\u5B58\u4EA4\u6613 \xB7 \u900F\u904E \u{1F3AF} \u5F48\u51FA\u8996\u7A97\u78BA\u8A8D",
    yesTradeBtn: (p) => `YES ${p}% \u2014 \u4EA4\u6613 \u26A1`,
    noTradeBtn: (p) => `NO ${p}% \u2014 \u4EA4\u6613 \u26A1`,
    tradeOnPoly: "\u5728 Polymarket \u4EA4\u6613 \u2197",
    viewLink2: "\u67E5\u770B \u2197"
  };
  var zhCN = {
    appName: "Polymarket \u96F7\u8FBE",
    appSubtitle: "\u66F4\u806A\u660E\u3001\u66F4\u5FEB\u901F\u5730\u4EA4\u6613",
    checkingSession: "\u6B63\u5728\u68C0\u67E5\u767B\u5F55\u72B6\u6001\u2026",
    notConnected: "\u672A\u8FDE\u63A5\u5230 Polymarket",
    loginHintNoTab: "\u8BF7\u5728\u4EFB\u610F\u6807\u7B7E\u9875\u6253\u5F00 polymarket.com \u5E76\u767B\u5F55\u3002",
    loginHintHasTab: "\u8BF7\u5728 polymarket.com \u767B\u5F55 \u2014 MetaMask\u3001Coinbase\u3001Google\u3001Email \u7B49\u5747\u53EF\u4F7F\u7528\u3002",
    openPolymarket: "\u6253\u5F00 Polymarket \u2197",
    retry: "\u91CD\u8BD5",
    socialLogin: "\u793E\u4EA4\u767B\u5F55",
    vpnTitle: "\u5728\u53D7\u9650\u533A\u57DF\uFF1F\u8BF7\u5148\u5F00\u542F VPN\u3002",
    vpnFree: "\u514D\u8D39\u9009\u9879\uFF1AProtonVPN \xB7 Windscribe\uFF08\u6BCF\u6708 10GB\uFF09",
    tabSearch: "\u641C\u7D22",
    tabPortfolio: "\u6295\u8D44\u7EC4\u5408",
    searchPlaceholder: "\u641C\u7D22\u4EFB\u4F55\u8BDD\u9898\u2026",
    searchBtn: "\u641C\u7D22\u5E02\u573A",
    searching: "\u641C\u7D22\u4E2D\u2026",
    recent: "\u6700\u8FD1\u641C\u7D22",
    noMarketsFound: "\u672A\u627E\u5230\u76F8\u5173\u6D3B\u8DC3\u5E02\u573A",
    tryDifferentKw: "\u8BF7\u5C1D\u8BD5\u5176\u4ED6\u5173\u952E\u8BCD",
    searchPromptTitle: "\u641C\u7D22\u4EFB\u4F55\u8BDD\u9898",
    searchPromptLoggedIn: "\u627E\u5230\u5E02\u573A\u540E\uFF0C\u70B9\u51FB YES% \u6216 NO% \u5373\u53EF\u76F4\u63A5\u4E0B\u5355",
    searchPromptLoggedOut: "\u8BF7\u5148\u5728 polymarket.com \u767B\u5F55\uFF0C\u518D\u641C\u7D22\u4E0B\u5355",
    buyTitle: (o, p) => `\u4E70\u5165 ${o} \xB7 ${p}%`,
    amountLabel: "\u91D1\u989D\uFF08USDC\uFF09",
    orderTypeLabel: "\u8BA2\u5355\u7C7B\u578B",
    orderMarket: "\u26A1 \u5E02\u4EF7\u5355",
    orderLimit: (p) => `\u{1F4CC} \u9650\u4EF7 ${p}%`,
    orderMarketHint: "\u7ACB\u5373\u6210\u4EA4\u30FB\u5141\u8BB8\u6700\u591A 5% \u6ED1\u70B9",
    orderLimitHint: (p) => `\u9650\u4EF7\u6302\u5355 @ ${p}%\u30FB\u64AE\u5408\u65F6\u6210\u4EA4`,
    pay: "\u652F\u4ED8",
    getApprox: "\u83B7\u5F97\u7EA6",
    shares: "\u80A1\u4EFD",
    lowBal: (b) => `\u26A0 \u4F59\u989D $${b} \u53EF\u80FD\u4E0D\u8DB3`,
    cancel: "\u53D6\u6D88",
    awaitingWallet: "\u23F3 \u7B49\u5F85\u94B1\u5305\u786E\u8BA4\u2026",
    confirmBuy: (o) => `\u786E\u8BA4\u4E70\u5165 ${o}`,
    sellTitle: (o, p) => `\u5356\u51FA ${o} \xB7 ${p}%`,
    sharesLabel: (s) => `\u5356\u51FA\u80A1\u4EFD\uFF08\u4F60\u6301\u6709 ${s}\uFF09`,
    allShares: (s) => `\u5168\u90E8\uFF08${s}\uFF09`,
    halfShares: (s) => `\u4E00\u534A\uFF08${s}\uFF09`,
    customPlaceholder: "\u81EA\u5B9A\u4E49",
    sellMarketHint: "\u7ACB\u5373\u6210\u4EA4\u30FB\u63A5\u53D7\u6700\u591A\u5C11 3% \u7684 USDC",
    socialSellWarning: "\u68C0\u6D4B\u5230\u793E\u4EA4\u767B\u5F55 \u2014 \u5C06\u6253\u5F00 Polymarket \u5B8C\u6210\u5356\u51FA",
    confirmSell: (o) => `\u786E\u8BA4\u5356\u51FA ${o}`,
    sellBtn: "\u5356\u51FA",
    sellingBtn: "\u5356\u51FA\u4E2D\u2026",
    connectFirst: "\u8BF7\u5148\u8FDE\u63A5 Polymarket",
    connectFirstSub: "\u5728 polymarket.com \u767B\u5F55\u4EE5\u67E5\u770B\u60A8\u7684\u6301\u4ED3",
    posLabel: "\u6301\u4ED3\u6570",
    valueLabel: "\u4EF7\u503C",
    pnlLabel: "\u635F\u76CA",
    noPositions: "\u76EE\u524D\u6CA1\u6709\u6301\u4ED3",
    noPositionsSub: "\u60A8\u76EE\u524D\u5C1A\u672A\u6301\u6709\u4EFB\u4F55\u80A1\u4EFD\u3002\u641C\u7D22\u5E02\u573A\u5E76\u8FDB\u884C\u60A8\u7684\u7B2C\u4E00\u7B14\u4EA4\u6613\uFF01",
    resolved: (n) => `\u5DF2\u7ED3\u7B97\uFF08${n}\uFF09`,
    refreshBtn: "\u21BB \u5237\u65B0\u6301\u4ED3",
    resolvedBadge: "\u5DF2\u7ED3\u7B97",
    viewLink: "\u67E5\u770B \u2197",
    sharesCol: "\u80A1\u4EFD",
    priceCol: "\u4EF7\u683C",
    pnlCol: "\u635F\u76CA",
    avgPct: (p) => `\u5747 ${p}%`,
    costLabel: "\u6210\u672C",
    overlayPendingTitle: "\u5DF2\u4ECE\u9875\u9762\u6D6E\u5C42\u6682\u5B58\u4EA4\u6613",
    marketCount: (n) => `${n} \u4E2A\u5E02\u573A`,
    detectingTopics: "\u6B63\u5728\u68C0\u6D4B\u8BDD\u9898\u2026",
    searchingKw: (k) => `\u641C\u7D22\u4E2D\uFF1A${k}`,
    topicsKw: (k) => `\u8BDD\u9898\uFF1A${k}`,
    noTopics: "\u672A\u68C0\u6D4B\u5230\u8BDD\u9898",
    scanningMarkets: "\u6B63\u5728\u626B\u63CF\u5E02\u573A\u2026",
    searchingMarkets: "\u641C\u7D22\u5E02\u573A\u4E2D\u2026",
    noMarketsOverlay: "\u5F53\u524D\u5185\u5BB9\u65E0\u76F8\u5173\u6D3B\u8DC3\u5E02\u573A",
    readyToTrade: "\u26A1 \u51C6\u5907\u597D\u4EA4\u6613\u4E86\uFF01",
    pendingSubDefault: "\u70B9\u51FB\u5DE5\u5177\u680F\u7684 \u{1F3AF} \u56FE\u6807\uFF0C\u5728\u5F39\u51FA\u7A97\u53E3\u4E2D\u786E\u8BA4\u60A8\u7684\u4EA4\u6613\u3002",
    pendingSubDetail: (o, p) => `${o} @ ${p}% \u5DF2\u6682\u5B58 \u2014 \u70B9\u51FB\u5DE5\u5177\u680F \u{1F3AF} \u786E\u8BA4\u3002`,
    openPopupBtn: "\u{1F3AF} \u6253\u5F00\u5F39\u51FA\u7A97\u53E3\u4EA4\u6613",
    dismissBtn: "\u5173\u95ED",
    closeHint: "\u5173\u95ED\uFF08\u6B64\u8BDD\u9898 3 \u5206\u949F\u5185\u4E0D\u518D\u5F39\u51FA\uFF09",
    footerHint: "\u70B9\u51FB YES/NO \u6682\u5B58\u4EA4\u6613 \xB7 \u901A\u8FC7 \u{1F3AF} \u5F39\u51FA\u7A97\u53E3\u786E\u8BA4",
    yesTradeBtn: (p) => `YES ${p}% \u2014 \u4EA4\u6613 \u26A1`,
    noTradeBtn: (p) => `NO ${p}% \u2014 \u4EA4\u6613 \u26A1`,
    tradeOnPoly: "\u5728 Polymarket \u4EA4\u6613 \u2197",
    viewLink2: "\u67E5\u770B \u2197"
  };
  var ja = {
    appName: "Polymarket \u30EC\u30FC\u30C0\u30FC",
    appSubtitle: "\u3088\u308A\u30B9\u30DE\u30FC\u30C8\u306B\u3001\u3088\u308A\u901F\u304F\u53D6\u5F15",
    checkingSession: "\u30BB\u30C3\u30B7\u30E7\u30F3\u3092\u78BA\u8A8D\u4E2D\u2026",
    notConnected: "Polymarket \u306B\u63A5\u7D9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093",
    loginHintNoTab: "\u4EFB\u610F\u306E\u30BF\u30D6\u3067 polymarket.com \u3092\u958B\u3044\u3066\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
    loginHintHasTab: "polymarket.com \u3067\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044 \u2014 MetaMask\u3001Coinbase\u3001Google\u3001\u30E1\u30FC\u30EB\u5BFE\u5FDC\u3002",
    openPolymarket: "Polymarket \u3092\u958B\u304F \u2197",
    retry: "\u518D\u8A66\u884C",
    socialLogin: "\u30BD\u30FC\u30B7\u30E3\u30EB\u30ED\u30B0\u30A4\u30F3",
    vpnTitle: "\u30A2\u30AF\u30BB\u30B9\u5236\u9650\u5730\u57DF\u3067\u3059\u304B\uFF1FVPN \u304C\u5FC5\u8981\u306A\u5834\u5408\u304C\u3042\u308A\u307E\u3059\u3002",
    vpnFree: "\u7121\u6599\u30AA\u30D7\u30B7\u30E7\u30F3\uFF1AProtonVPN\u30FBWindscribe\uFF08\u670810GB\uFF09",
    tabSearch: "\u691C\u7D22",
    tabPortfolio: "\u30DD\u30FC\u30C8\u30D5\u30A9\u30EA\u30AA",
    searchPlaceholder: "\u4EFB\u610F\u306E\u30C8\u30D4\u30C3\u30AF\u3092\u691C\u7D22\u2026",
    searchBtn: "\u30DE\u30FC\u30B1\u30C3\u30C8\u3092\u691C\u7D22",
    searching: "\u691C\u7D22\u4E2D\u2026",
    recent: "\u6700\u8FD1\u306E\u691C\u7D22",
    noMarketsFound: "\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u30DE\u30FC\u30B1\u30C3\u30C8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093",
    tryDifferentKw: "\u5225\u306E\u30AD\u30FC\u30EF\u30FC\u30C9\u3092\u304A\u8A66\u3057\u304F\u3060\u3055\u3044",
    searchPromptTitle: "\u30C8\u30D4\u30C3\u30AF\u3092\u691C\u7D22",
    searchPromptLoggedIn: "\u30DE\u30FC\u30B1\u30C3\u30C8\u3092\u898B\u3064\u3051\u3066 YES% \u307E\u305F\u306F NO% \u3092\u30AF\u30EA\u30C3\u30AF\u3059\u308B\u3068\u76F4\u63A5\u6CE8\u6587\u3067\u304D\u307E\u3059",
    searchPromptLoggedOut: "\u307E\u305A polymarket.com \u3067\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u304B\u3089\u6CE8\u6587\u3057\u3066\u304F\u3060\u3055\u3044",
    buyTitle: (o, p) => `${o} \u3092\u8CB7\u3046 \xB7 ${p}%`,
    amountLabel: "\u91D1\u984D (USDC)",
    orderTypeLabel: "\u6CE8\u6587\u30BF\u30A4\u30D7",
    orderMarket: "\u26A1 \u6210\u884C\u6CE8\u6587",
    orderLimit: (p) => `\u{1F4CC} \u6307\u5024 ${p}%`,
    orderMarketHint: "\u5373\u6642\u7D04\u5B9A\u30FB\u6700\u59275%\u30B9\u30EA\u30C3\u30DA\u30FC\u30B8\u8A31\u5BB9",
    orderLimitHint: (p) => `\u6307\u5024 @ ${p}% \u3067\u5F85\u6A5F\u30FB\u30DE\u30C3\u30C1\u30F3\u30B0\u6642\u306B\u7D04\u5B9A`,
    pay: "\u652F\u6255\u3046",
    getApprox: "\u53D7\u53D6 \u2248",
    shares: "\u30B7\u30A7\u30A2",
    lowBal: (b) => `\u26A0 \u6B8B\u9AD8 $${b} \u304C\u4E0D\u8DB3\u3057\u3066\u3044\u308B\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059`,
    cancel: "\u30AD\u30E3\u30F3\u30BB\u30EB",
    awaitingWallet: "\u23F3 \u30A6\u30A9\u30EC\u30C3\u30C8\u3092\u5F85\u6A5F\u4E2D\u2026",
    confirmBuy: (o) => `${o} \u306E\u8CFC\u5165\u3092\u78BA\u8A8D`,
    sellTitle: (o, p) => `${o} \u3092\u58F2\u308B \xB7 ${p}%`,
    sharesLabel: (s) => `\u58F2\u5374\u3059\u308B\u30B7\u30A7\u30A2\uFF08\u4FDD\u6709\u6570: ${s}\uFF09`,
    allShares: (s) => `\u5168\u90E8 (${s})`,
    halfShares: (s) => `\u534A\u5206 (${s})`,
    customPlaceholder: "\u30AB\u30B9\u30BF\u30E0",
    sellMarketHint: "\u5373\u6642\u7D04\u5B9A\u30FB\u6700\u59273%\u5C11\u306A\u3044USDC\u3092\u8A31\u5BB9",
    socialSellWarning: "\u30BD\u30FC\u30B7\u30E3\u30EB\u30ED\u30B0\u30A4\u30F3\u3092\u691C\u51FA \u2014 Polymarket \u3067\u58F2\u5374\u3092\u5B8C\u4E86\u3057\u307E\u3059",
    confirmSell: (o) => `${o} \u306E\u58F2\u5374\u3092\u78BA\u8A8D`,
    sellBtn: "\u58F2\u5374",
    sellingBtn: "\u58F2\u5374\u4E2D\u2026",
    connectFirst: "\u307E\u305A Polymarket \u306B\u63A5\u7D9A\u3057\u3066\u304F\u3060\u3055\u3044",
    connectFirstSub: "polymarket.com \u306B\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u30DD\u30B8\u30B7\u30E7\u30F3\u3092\u78BA\u8A8D",
    posLabel: "\u30DD\u30B8\u30B7\u30E7\u30F3",
    valueLabel: "\u8A55\u4FA1\u984D",
    pnlLabel: "\u640D\u76CA",
    noPositions: "\u30AA\u30FC\u30D7\u30F3\u30DD\u30B8\u30B7\u30E7\u30F3\u306A\u3057",
    noPositionsSub: "\u307E\u3060\u30B7\u30A7\u30A2\u3092\u4FDD\u6709\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u30DE\u30FC\u30B1\u30C3\u30C8\u3092\u691C\u7D22\u3057\u3066\u6700\u521D\u306E\u30C8\u30EC\u30FC\u30C9\u3092\u59CB\u3081\u307E\u3057\u3087\u3046\uFF01",
    resolved: (n) => `\u89E3\u6C7A\u6E08\u307F (${n})`,
    refreshBtn: "\u21BB \u30DD\u30B8\u30B7\u30E7\u30F3\u3092\u66F4\u65B0",
    resolvedBadge: "\u89E3\u6C7A\u6E08",
    viewLink: "\u8868\u793A \u2197",
    sharesCol: "\u30B7\u30A7\u30A2",
    priceCol: "\u4FA1\u683C",
    pnlCol: "\u640D\u76CA",
    avgPct: (p) => `\u5E73\u5747 ${p}%`,
    costLabel: "\u539F\u4FA1",
    overlayPendingTitle: "\u30DA\u30FC\u30B8\u30AA\u30FC\u30D0\u30FC\u30EC\u30A4\u304B\u3089\u30C8\u30EC\u30FC\u30C9\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F",
    marketCount: (n) => `${n} \u30DE\u30FC\u30B1\u30C3\u30C8`,
    detectingTopics: "\u30C8\u30D4\u30C3\u30AF\u3092\u691C\u51FA\u4E2D\u2026",
    searchingKw: (k) => `\u691C\u7D22\u4E2D\uFF1A${k}`,
    topicsKw: (k) => `\u30C8\u30D4\u30C3\u30AF\uFF1A${k}`,
    noTopics: "\u30C8\u30D4\u30C3\u30AF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093",
    scanningMarkets: "\u30DE\u30FC\u30B1\u30C3\u30C8\u3092\u30B9\u30AD\u30E3\u30F3\u4E2D\u2026",
    searchingMarkets: "\u30DE\u30FC\u30B1\u30C3\u30C8\u3092\u691C\u7D22\u4E2D\u2026",
    noMarketsOverlay: "\u73FE\u5728\u306E\u30B3\u30F3\u30C6\u30F3\u30C4\u306B\u95A2\u9023\u3059\u308B\u30DE\u30FC\u30B1\u30C3\u30C8\u306F\u3042\u308A\u307E\u305B\u3093",
    readyToTrade: "\u26A1 \u30C8\u30EC\u30FC\u30C9\u6E96\u5099\u5B8C\u4E86\uFF01",
    pendingSubDefault: "\u30C4\u30FC\u30EB\u30D0\u30FC\u306E \u{1F3AF} \u30A2\u30A4\u30B3\u30F3\u3092\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u30DD\u30C3\u30D7\u30A2\u30C3\u30D7\u3067\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
    pendingSubDetail: (o, p) => `${o} @ ${p}% \u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F \u2014 \u30C4\u30FC\u30EB\u30D0\u30FC \u{1F3AF} \u3092\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u78BA\u8A8D\u3002`,
    openPopupBtn: "\u{1F3AF} \u30DD\u30C3\u30D7\u30A2\u30C3\u30D7\u3092\u958B\u3044\u3066\u30C8\u30EC\u30FC\u30C9",
    dismissBtn: "\u9589\u3058\u308B",
    closeHint: "\u9589\u3058\u308B\uFF08\u3053\u306E\u30C8\u30D4\u30C3\u30AF\u3067\u306F\u518D\u8868\u793A\u3057\u307E\u305B\u3093\uFF09",
    footerHint: "YES/NO \u30AF\u30EA\u30C3\u30AF\u3067\u30C8\u30EC\u30FC\u30C9\u4FDD\u5B58 \xB7 \u{1F3AF} \u30DD\u30C3\u30D7\u30A2\u30C3\u30D7\u3067\u78BA\u8A8D",
    yesTradeBtn: (p) => `YES ${p}% \u2014 \u53D6\u5F15 \u26A1`,
    noTradeBtn: (p) => `NO ${p}% \u2014 \u53D6\u5F15 \u26A1`,
    tradeOnPoly: "Polymarket \u3067\u53D6\u5F15 \u2197",
    viewLink2: "\u8868\u793A \u2197"
  };
  var ko = {
    appName: "Polymarket \uB808\uC774\uB354",
    appSubtitle: "\uB354 \uC2A4\uB9C8\uD2B8\uD558\uAC8C, \uB354 \uBE60\uB974\uAC8C \uAC70\uB798",
    checkingSession: "\uC138\uC158 \uD655\uC778 \uC911\u2026",
    notConnected: "Polymarket\uC5D0 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC74C",
    loginHintNoTab: "\uC544\uBB34 \uD0ED\uC5D0\uC11C polymarket.com\uC744 \uC5F4\uACE0 \uB85C\uADF8\uC778\uD558\uC138\uC694.",
    loginHintHasTab: "polymarket.com\uC5D0 \uB85C\uADF8\uC778\uD558\uC138\uC694 \u2014 MetaMask, Coinbase, Google, \uC774\uBA54\uC77C \uBAA8\uB450 \uC9C0\uC6D0\uD569\uB2C8\uB2E4.",
    openPolymarket: "Polymarket \uC5F4\uAE30 \u2197",
    retry: "\uB2E4\uC2DC \uC2DC\uB3C4",
    socialLogin: "\uC18C\uC15C \uB85C\uADF8\uC778",
    vpnTitle: "\uC81C\uD55C \uC9C0\uC5ED\uC778\uAC00\uC694? VPN\uC774 \uD544\uC694\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
    vpnFree: "\uBB34\uB8CC \uC635\uC158: ProtonVPN \xB7 Windscribe (\uC6D4 10GB)",
    tabSearch: "\uAC80\uC0C9",
    tabPortfolio: "\uD3EC\uD2B8\uD3F4\uB9AC\uC624",
    searchPlaceholder: "\uC544\uBB34 \uC8FC\uC81C\uB098 \uAC80\uC0C9\u2026",
    searchBtn: "\uB9C8\uCF13 \uAC80\uC0C9",
    searching: "\uAC80\uC0C9 \uC911\u2026",
    recent: "\uCD5C\uADFC \uAC80\uC0C9",
    noMarketsFound: "\uD65C\uC131 \uB9C8\uCF13\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC74C",
    tryDifferentKw: "\uB2E4\uB978 \uD0A4\uC6CC\uB4DC\uB97C \uC2DC\uB3C4\uD574\uBCF4\uC138\uC694",
    searchPromptTitle: "\uC8FC\uC81C \uAC80\uC0C9",
    searchPromptLoggedIn: "\uB9C8\uCF13\uC744 \uCC3E\uACE0 YES% \uB610\uB294 NO%\uB97C \uD074\uB9AD\uD558\uBA74 \uBC14\uB85C \uC8FC\uBB38\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4",
    searchPromptLoggedOut: "\uBA3C\uC800 polymarket.com\uC5D0\uC11C \uB85C\uADF8\uC778\uD55C \uD6C4 \uAC80\uC0C9\uD558\uC5EC \uC8FC\uBB38\uD558\uC138\uC694",
    buyTitle: (o, p) => `${o} \uB9E4\uC218 \xB7 ${p}%`,
    amountLabel: "\uAE08\uC561 (USDC)",
    orderTypeLabel: "\uC8FC\uBB38 \uC720\uD615",
    orderMarket: "\u26A1 \uC2DC\uC7A5\uAC00",
    orderLimit: (p) => `\u{1F4CC} \uC9C0\uC815\uAC00 ${p}%`,
    orderMarketHint: "\uC989\uC2DC \uCCB4\uACB0 \xB7 \uCD5C\uB300 5% \uC2AC\uB9AC\uD53C\uC9C0",
    orderLimitHint: (p) => `\uC9C0\uC815\uAC00 @ ${p}% \uB300\uAE30 \xB7 \uB9E4\uCE6D \uC2DC \uCCB4\uACB0`,
    pay: "\uC9C0\uBD88",
    getApprox: "\uBC1B\uC744 \u2248",
    shares: "\uC8FC\uC2DD",
    lowBal: (b) => `\u26A0 \uC794\uC561 $${b}\uC774 \uBD80\uC871\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4`,
    cancel: "\uCDE8\uC18C",
    awaitingWallet: "\u23F3 \uC9C0\uAC11 \uD655\uC778 \uB300\uAE30 \uC911\u2026",
    confirmBuy: (o) => `${o} \uB9E4\uC218 \uD655\uC778`,
    sellTitle: (o, p) => `${o} \uB9E4\uB3C4 \xB7 ${p}%`,
    sharesLabel: (s) => `\uB9E4\uB3C4\uD560 \uC8FC\uC2DD (\uBCF4\uC720: ${s})`,
    allShares: (s) => `\uC804\uBD80 (${s})`,
    halfShares: (s) => `\uC808\uBC18 (${s})`,
    customPlaceholder: "\uC9C1\uC811 \uC785\uB825",
    sellMarketHint: "\uC989\uC2DC \uCCB4\uACB0 \xB7 \uCD5C\uB300 3% \uC801\uC740 USDC \uD5C8\uC6A9",
    socialSellWarning: "\uC18C\uC15C \uB85C\uADF8\uC778 \uAC10\uC9C0 \u2014 Polymarket\uC5D0\uC11C \uB9E4\uB3C4\uB97C \uC644\uB8CC\uD569\uB2C8\uB2E4",
    confirmSell: (o) => `${o} \uB9E4\uB3C4 \uD655\uC778`,
    sellBtn: "\uB9E4\uB3C4",
    sellingBtn: "\uB9E4\uB3C4 \uC911\u2026",
    connectFirst: "\uBA3C\uC800 Polymarket\uC5D0 \uC5F0\uACB0\uD558\uC138\uC694",
    connectFirstSub: "polymarket.com\uC5D0 \uB85C\uADF8\uC778\uD558\uC5EC \uD3EC\uC9C0\uC158\uC744 \uD655\uC778\uD558\uC138\uC694",
    posLabel: "\uD3EC\uC9C0\uC158",
    valueLabel: "\uAC00\uCE58",
    pnlLabel: "\uC190\uC775",
    noPositions: "\uC5F4\uB9B0 \uD3EC\uC9C0\uC158 \uC5C6\uC74C",
    noPositionsSub: "\uC544\uC9C1 \uC8FC\uC2DD\uC744 \uBCF4\uC720\uD558\uACE0 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB9C8\uCF13\uC744 \uAC80\uC0C9\uD558\uACE0 \uCCAB \uAC70\uB798\uB97C \uC2DC\uC791\uD558\uC138\uC694!",
    resolved: (n) => `\uD574\uACB0\uB428 (${n})`,
    refreshBtn: "\u21BB \uD3EC\uC9C0\uC158 \uC0C8\uB85C\uACE0\uCE68",
    resolvedBadge: "\uD574\uACB0\uB428",
    viewLink: "\uBCF4\uAE30 \u2197",
    sharesCol: "\uC8FC\uC2DD",
    priceCol: "\uAC00\uACA9",
    pnlCol: "\uC190\uC775",
    avgPct: (p) => `\uD3C9\uADE0 ${p}%`,
    costLabel: "\uBE44\uC6A9",
    overlayPendingTitle: "\uD398\uC774\uC9C0 \uC624\uBC84\uB808\uC774\uC5D0\uC11C \uAC70\uB798\uAC00 \uC900\uBE44\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
    marketCount: (n) => `${n}\uAC1C \uB9C8\uCF13`,
    detectingTopics: "\uC8FC\uC81C \uAC10\uC9C0 \uC911\u2026",
    searchingKw: (k) => `\uAC80\uC0C9 \uC911: ${k}`,
    topicsKw: (k) => `\uC8FC\uC81C: ${k}`,
    noTopics: "\uAC10\uC9C0\uB41C \uC8FC\uC81C \uC5C6\uC74C",
    scanningMarkets: "\uB9C8\uCF13 \uC2A4\uCE94 \uC911\u2026",
    searchingMarkets: "\uB9C8\uCF13 \uAC80\uC0C9 \uC911\u2026",
    noMarketsOverlay: "\uD604\uC7AC \uCF58\uD150\uCE20\uC5D0 \uAD00\uB828\uB41C \uD65C\uC131 \uB9C8\uCF13 \uC5C6\uC74C",
    readyToTrade: "\u26A1 \uAC70\uB798 \uC900\uBE44 \uC644\uB8CC!",
    pendingSubDefault: "\uD234\uBC14\uC758 \u{1F3AF} \uC544\uC774\uCF58\uC744 \uD074\uB9AD\uD558\uC5EC \uD31D\uC5C5\uC5D0\uC11C \uAC70\uB798\uB97C \uD655\uC778\uD558\uC138\uC694.",
    pendingSubDetail: (o, p) => `${o} @ ${p}% \uC900\uBE44\uB428 \u2014 \uD234\uBC14 \u{1F3AF} \uD074\uB9AD\uD558\uC5EC \uD655\uC778.`,
    openPopupBtn: "\u{1F3AF} \uD31D\uC5C5 \uC5F4\uC5B4\uC11C \uAC70\uB798",
    dismissBtn: "\uB2EB\uAE30",
    closeHint: "\uB2EB\uAE30 (\uC774 \uC8FC\uC81C\uB85C \uB2E4\uC2DC \uC5F4\uB9AC\uC9C0 \uC54A\uC74C)",
    footerHint: "YES/NO \uD074\uB9AD\uC73C\uB85C \uAC70\uB798 \uC900\uBE44 \xB7 \u{1F3AF} \uD31D\uC5C5\uC73C\uB85C \uD655\uC778",
    yesTradeBtn: (p) => `YES ${p}% \u2014 \uAC70\uB798 \u26A1`,
    noTradeBtn: (p) => `NO ${p}% \u2014 \uAC70\uB798 \u26A1`,
    tradeOnPoly: "Polymarket\uC5D0\uC11C \uAC70\uB798 \u2197",
    viewLink2: "\uBCF4\uAE30 \u2197"
  };
  var es = {
    appName: "Polymarket Radar",
    appSubtitle: "Opera m\xE1s r\xE1pido e inteligente",
    checkingSession: "Verificando sesi\xF3n\u2026",
    notConnected: "No conectado a Polymarket",
    loginHintNoTab: "Abre polymarket.com en cualquier pesta\xF1a e inicia sesi\xF3n.",
    loginHintHasTab: "Inicia sesi\xF3n en polymarket.com \u2014 MetaMask, Coinbase, Google, email son compatibles.",
    openPolymarket: "Abrir Polymarket \u2197",
    retry: "Reintentar",
    socialLogin: "Login social",
    vpnTitle: "\xBFRegi\xF3n restringida? Es posible que necesites una VPN.",
    vpnFree: "Opciones gratis: ProtonVPN \xB7 Windscribe (10 GB/mes)",
    tabSearch: "Buscar",
    tabPortfolio: "Portafolio",
    searchPlaceholder: "Busca cualquier tema\u2026",
    searchBtn: "Buscar Mercados",
    searching: "Buscando\u2026",
    recent: "Reciente",
    noMarketsFound: "No se encontraron mercados activos",
    tryDifferentKw: "Prueba otras palabras clave",
    searchPromptTitle: "Busca cualquier tema",
    searchPromptLoggedIn: "Encuentra un mercado y haz clic en YES% o NO% para ordenar directamente",
    searchPromptLoggedOut: "Inicia sesi\xF3n en polymarket.com primero y luego busca para ordenar",
    buyTitle: (o, p) => `Comprar ${o} \xB7 ${p}%`,
    amountLabel: "Cantidad (USDC)",
    orderTypeLabel: "Tipo de orden",
    orderMarket: "\u26A1 Mercado",
    orderLimit: (p) => `\u{1F4CC} L\xEDmite ${p}%`,
    orderMarketHint: "Se ejecuta inmediatamente \xB7 hasta 5% de deslizamiento",
    orderLimitHint: (p) => `Orden l\xEDmite @ ${p}% \xB7 se ejecuta al cruzar`,
    pay: "Pagar",
    getApprox: "Recibir \u2248",
    shares: "acciones",
    lowBal: (b) => `\u26A0 Saldo $${b} puede ser insuficiente`,
    cancel: "Cancelar",
    awaitingWallet: "\u23F3 Esperando billetera\u2026",
    confirmBuy: (o) => `Confirmar Compra ${o}`,
    sellTitle: (o, p) => `Vender ${o} \xB7 ${p}%`,
    sharesLabel: (s) => `Acciones a vender (tienes ${s})`,
    allShares: (s) => `Todo (${s})`,
    halfShares: (s) => `Mitad (${s})`,
    customPlaceholder: "Personalizar",
    sellMarketHint: "Se ejecuta inmediatamente \xB7 acepta hasta 3% menos USDC",
    socialSellWarning: "Login social detectado \u2014 se abrir\xE1 Polymarket para completar la venta",
    confirmSell: (o) => `Confirmar Venta ${o}`,
    sellBtn: "Vender",
    sellingBtn: "Vendiendo\u2026",
    connectFirst: "Con\xE9ctate a Polymarket primero",
    connectFirstSub: "Inicia sesi\xF3n en polymarket.com para ver tus posiciones",
    posLabel: "Posiciones",
    valueLabel: "Valor",
    pnlLabel: "G/P",
    noPositions: "Sin posiciones abiertas",
    noPositionsSub: "A\xFAn no tienes acciones. \xA1Busca un mercado y realiza tu primera operaci\xF3n!",
    resolved: (n) => `Resuelto (${n})`,
    refreshBtn: "\u21BB Actualizar posiciones",
    resolvedBadge: "Resuelto",
    viewLink: "Ver \u2197",
    sharesCol: "Acciones",
    priceCol: "Precio",
    pnlCol: "G/P",
    avgPct: (p) => `prom ${p}%`,
    costLabel: "costo",
    overlayPendingTitle: "Operaci\xF3n preparada desde el panel",
    marketCount: (n) => `${n} mercado${n !== 1 ? "s" : ""}`,
    detectingTopics: "Detectando temas\u2026",
    searchingKw: (k) => `Buscando: ${k}`,
    topicsKw: (k) => `Temas: ${k}`,
    noTopics: "No se detectaron temas",
    scanningMarkets: "Escaneando mercados\u2026",
    searchingMarkets: "Buscando mercados\u2026",
    noMarketsOverlay: "No hay mercados activos para el contenido actual",
    readyToTrade: "\u26A1 \xA1Listo para operar!",
    pendingSubDefault: "Haz clic en el icono \u{1F3AF} de la barra para confirmar en el popup.",
    pendingSubDetail: (o, p) => `${o} @ ${p}% preparado \u2014 clic en \u{1F3AF} para confirmar.`,
    openPopupBtn: "\u{1F3AF} Abrir Popup para Operar",
    dismissBtn: "cerrar",
    closeHint: "Cerrar (no se reabrir\xE1 para este tema)",
    footerHint: "Clic en YES/NO para preparar \xB7 confirma en el popup \u{1F3AF}",
    yesTradeBtn: (p) => `YES ${p}% \u2014 Operar \u26A1`,
    noTradeBtn: (p) => `NO ${p}% \u2014 Operar \u26A1`,
    tradeOnPoly: "Operar en Polymarket \u2197",
    viewLink2: "Ver \u2197"
  };
  var pt = {
    appName: "Polymarket Radar",
    appSubtitle: "Negocie de forma mais r\xE1pida e inteligente",
    checkingSession: "Verificando sess\xE3o\u2026",
    notConnected: "N\xE3o conectado ao Polymarket",
    loginHintNoTab: "Abra polymarket.com em qualquer aba e fa\xE7a login.",
    loginHintHasTab: "Fa\xE7a login em polymarket.com \u2014 MetaMask, Coinbase, Google, email s\xE3o suportados.",
    openPolymarket: "Abrir Polymarket \u2197",
    retry: "Tentar novamente",
    socialLogin: "Login social",
    vpnTitle: "Regi\xE3o restrita? Voc\xEA pode precisar de uma VPN.",
    vpnFree: "Op\xE7\xF5es gratuitas: ProtonVPN \xB7 Windscribe (10 GB/m\xEAs)",
    tabSearch: "Buscar",
    tabPortfolio: "Portf\xF3lio",
    searchPlaceholder: "Pesquise qualquer tema\u2026",
    searchBtn: "Pesquisar Mercados",
    searching: "Pesquisando\u2026",
    recent: "Recente",
    noMarketsFound: "Nenhum mercado ativo encontrado",
    tryDifferentKw: "Tente palavras-chave diferentes",
    searchPromptTitle: "Pesquise qualquer tema",
    searchPromptLoggedIn: "Encontre um mercado e clique em YES% ou NO% para ordenar diretamente",
    searchPromptLoggedOut: "Fa\xE7a login em polymarket.com primeiro, depois pesquise para fazer pedidos",
    buyTitle: (o, p) => `Comprar ${o} \xB7 ${p}%`,
    amountLabel: "Valor (USDC)",
    orderTypeLabel: "Tipo de ordem",
    orderMarket: "\u26A1 Mercado",
    orderLimit: (p) => `\u{1F4CC} Limite ${p}%`,
    orderMarketHint: "Executado imediatamente \xB7 at\xE9 5% de slippage",
    orderLimitHint: (p) => `Ordem limite @ ${p}% \xB7 executada ao cruzar`,
    pay: "Pagar",
    getApprox: "Receber \u2248",
    shares: "a\xE7\xF5es",
    lowBal: (b) => `\u26A0 Saldo $${b} pode ser insuficiente`,
    cancel: "Cancelar",
    awaitingWallet: "\u23F3 Aguardando carteira\u2026",
    confirmBuy: (o) => `Confirmar Compra ${o}`,
    sellTitle: (o, p) => `Vender ${o} \xB7 ${p}%`,
    sharesLabel: (s) => `A\xE7\xF5es a vender (voc\xEA tem ${s})`,
    allShares: (s) => `Tudo (${s})`,
    halfShares: (s) => `Metade (${s})`,
    customPlaceholder: "Personalizar",
    sellMarketHint: "Executado imediatamente \xB7 aceita at\xE9 3% menos USDC",
    socialSellWarning: "Login social detectado \u2014 o Polymarket ser\xE1 aberto para concluir a venda",
    confirmSell: (o) => `Confirmar Venda ${o}`,
    sellBtn: "Vender",
    sellingBtn: "Vendendo\u2026",
    connectFirst: "Conecte-se ao Polymarket primeiro",
    connectFirstSub: "Fa\xE7a login em polymarket.com para ver suas posi\xE7\xF5es",
    posLabel: "Posi\xE7\xF5es",
    valueLabel: "Valor",
    pnlLabel: "L/P",
    noPositions: "Sem posi\xE7\xF5es abertas",
    noPositionsSub: "Voc\xEA ainda n\xE3o tem a\xE7\xF5es. Pesquise um mercado e fa\xE7a sua primeira negocia\xE7\xE3o!",
    resolved: (n) => `Resolvido (${n})`,
    refreshBtn: "\u21BB Atualizar posi\xE7\xF5es",
    resolvedBadge: "Resolvido",
    viewLink: "Ver \u2197",
    sharesCol: "A\xE7\xF5es",
    priceCol: "Pre\xE7o",
    pnlCol: "L/P",
    avgPct: (p) => `m\xE9d ${p}%`,
    costLabel: "custo",
    overlayPendingTitle: "Negocia\xE7\xE3o preparada pelo painel",
    marketCount: (n) => `${n} mercado${n !== 1 ? "s" : ""}`,
    detectingTopics: "Detectando t\xF3picos\u2026",
    searchingKw: (k) => `Pesquisando: ${k}`,
    topicsKw: (k) => `T\xF3picos: ${k}`,
    noTopics: "Nenhum t\xF3pico detectado",
    scanningMarkets: "Verificando mercados\u2026",
    searchingMarkets: "Pesquisando mercados\u2026",
    noMarketsOverlay: "Nenhum mercado ativo para o conte\xFAdo atual",
    readyToTrade: "\u26A1 Pronto para negociar!",
    pendingSubDefault: "Clique no \xEDcone \u{1F3AF} da barra de ferramentas para confirmar no popup.",
    pendingSubDetail: (o, p) => `${o} @ ${p}% preparado \u2014 clique em \u{1F3AF} para confirmar.`,
    openPopupBtn: "\u{1F3AF} Abrir Popup para Negociar",
    dismissBtn: "fechar",
    closeHint: "Fechar (n\xE3o reabrir\xE1 para este t\xF3pico)",
    footerHint: "Clique em YES/NO para preparar \xB7 confirme no popup \u{1F3AF}",
    yesTradeBtn: (p) => `YES ${p}% \u2014 Negociar \u26A1`,
    noTradeBtn: (p) => `NO ${p}% \u2014 Negociar \u26A1`,
    tradeOnPoly: "Negociar no Polymarket \u2197",
    viewLink2: "Ver \u2197"
  };
  var ALL = {
    "en": en,
    "zh-TW": zhTW,
    "zh-CN": zhCN,
    "ja": ja,
    "ko": ko,
    "es": es,
    "pt": pt
  };
  function getStrings(lang) {
    return ALL[lang] ?? en;
  }
  function detectLang(locale) {
    if (!locale) return "en";
    const l = locale.toLowerCase();
    if (l.startsWith("zh-tw") || l.startsWith("zh-hant")) return "zh-TW";
    if (l.startsWith("zh")) return "zh-CN";
    if (l.startsWith("ja")) return "ja";
    if (l.startsWith("ko")) return "ko";
    if (l.startsWith("es")) return "es";
    if (l.startsWith("pt")) return "pt";
    return "en";
  }

  // src/content/overlay.ts
  var OVERLAY_ID = "__polymarket_radar_root__";
  var DISMISS_TIMEOUT = 3 * 60 * 1e3;
  var BG = "#0C0F1A";
  var PANEL = "#111520";
  var BORDER = "#232A3B";
  var TEXT = "#E8EDF5";
  var MUTED = "#5E6A82";
  var TEXT2 = "#A3ADBF";
  var YES = "#0AC18E";
  var NO = "#E23E3E";
  var BRAND = "#6170FF";
  var AMBER = "#F59E0B";
  var STYLES = `
  :host {
    all: initial;
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2147483647;
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  *, *::before, *::after { box-sizing: border-box; }

  /* \u2500\u2500 Tab trigger \u2500\u2500 */
  .tab {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    background: linear-gradient(180deg, ${BRAND}, ${YES});
    color: #fff;
    padding: 16px 7px;
    border-radius: 10px 0 0 10px;
    cursor: pointer;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 8px;
    user-select: none;
    border: none;
    outline: none;
    transition: opacity .15s;
    box-shadow: -2px 0 16px rgba(0,0,0,.5);
    position: relative;
  }
  .tab:hover { opacity: .9; }
  .tab-icon { writing-mode: horizontal-tb; font-size: 15px; }

  /* Notification dot on tab */
  .tab-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${AMBER};
    display: none;
    box-shadow: 0 0 6px ${AMBER};
    animation: pulseAmber 1.2s ease-in-out infinite;
  }
  .tab-badge.visible { display: block; }
  @keyframes pulseAmber { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.3)} }

  .container { display: flex; flex-direction: row; align-items: stretch; }

  /* \u2500\u2500 Side panel \u2500\u2500 */
  .panel {
    background: ${BG};
    border: 1px solid ${BORDER};
    border-right: none;
    border-radius: 12px 0 0 12px;
    width: 310px;
    max-height: 84vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: -6px 0 32px rgba(0,0,0,.65);
    animation: slideIn .18s ease;
  }
  .panel.hidden { display: none; }
  @keyframes slideIn { from { opacity:0; transform:translateX(12px) } to { opacity:1; transform:none } }

  /* \u2500\u2500 Panel header \u2500\u2500 */
  .panel-header {
    padding: 12px 14px 10px;
    border-bottom: 1px solid ${BORDER};
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: ${PANEL};
    flex-shrink: 0;
  }
  .header-left { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .logo {
    width: 28px; height: 28px; border-radius: 7px;
    background: linear-gradient(135deg, ${BRAND}, ${YES});
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; flex-shrink: 0;
  }
  .panel-title { font-size: 13px; font-weight: 800; color: ${TEXT}; letter-spacing: -.01em; }
  .panel-sub {
    font-size: 10px; color: ${MUTED}; margin-top: 1px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 185px;
  }
  .close-btn {
    background: none; border: none; color: ${MUTED}; cursor: pointer;
    font-size: 17px; padding: 2px 5px; line-height: 1; border-radius: 6px;
    transition: color .15s, background .15s; flex-shrink: 0;
  }
  .close-btn:hover { color: ${TEXT}; background: ${BORDER}; }

  /* \u2500\u2500 Pending trade banner \u2500\u2500 */
  .pending-banner {
    display: none;
    padding: 10px 14px;
    background: ${AMBER}18;
    border-bottom: 1px solid ${AMBER}44;
    animation: slideIn .18s ease;
  }
  .pending-banner.visible { display: block; }
  .pending-banner-title {
    font-size: 12px; font-weight: 800; color: ${AMBER}; margin-bottom: 4px;
    display: flex; align-items: center; gap: 6px;
  }
  .pending-banner-sub {
    font-size: 11px; color: ${TEXT2}; margin-bottom: 8px; line-height: 1.4;
  }
  .pending-banner-row { display: flex; gap: 6px; }
  .pending-btn-primary {
    flex: 2; font-size: 11px; font-weight: 800;
    background: ${BRAND}; color: #fff;
    border: none; border-radius: 7px;
    padding: 7px 0; cursor: pointer;
    transition: opacity .15s;
  }
  .pending-btn-primary:hover { opacity: .85; }
  .pending-btn-secondary {
    flex: 1; font-size: 11px; font-weight: 700;
    background: transparent; color: ${BRAND};
    border: 1px solid ${BRAND}44; border-radius: 7px;
    padding: 7px 0; cursor: pointer; text-decoration: none;
    display: flex; align-items: center; justify-content: center;
    transition: background .15s;
  }
  .pending-btn-secondary:hover { background: ${BRAND}22; }
  .pending-dismiss {
    background: none; border: none; color: ${MUTED}; cursor: pointer;
    font-size: 11px; padding: 2px 4px; margin-top: 4px; display: block;
    width: 100%; text-align: center;
  }

  /* \u2500\u2500 Scrollable body \u2500\u2500 */
  .panel-body { padding: 6px 0; flex: 1; overflow-y: auto; }
  .panel-body::-webkit-scrollbar { width: 3px; }
  .panel-body::-webkit-scrollbar-track { background: transparent; }
  .panel-body::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 3px; }

  /* \u2500\u2500 States \u2500\u2500 */
  .state-wrap {
    display: flex; flex-direction: column; align-items: center;
    padding: 28px 16px; color: ${MUTED}; font-size: 12px;
    gap: 8px; text-align: center;
  }
  .state-icon { font-size: 24px; }
  .spinner {
    width: 22px; height: 22px;
    border: 2px solid ${BORDER}; border-top-color: ${BRAND};
    border-radius: 50%;
    animation: spin .7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* \u2500\u2500 Market card \u2500\u2500 */
  .market-card {
    padding: 11px 14px;
    border-bottom: 1px solid ${BORDER};
    transition: background .15s;
    cursor: default;
  }
  .market-card:last-child { border-bottom: none; }
  .market-card:hover { background: #1A2136; }

  .market-q {
    font-size: 12px; font-weight: 600; color: ${TEXT};
    line-height: 1.45; margin-bottom: 9px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }

  /* Odds bar */
  .odds-labels { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .yes-lbl { font-size: 11px; font-weight: 800; color: ${YES}; }
  .no-lbl  { font-size: 11px; font-weight: 800; color: ${NO}; }
  .odds-track {
    height: 5px; border-radius: 3px; background: ${NO}22; overflow: hidden; margin-bottom: 9px;
  }
  .odds-fill { height: 100%; background: ${YES}; border-radius: 3px; transition: width .35s ease; }

  /* Multi-outcome chips */
  .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 9px; }
  .chip {
    font-size: 10px; font-weight: 600; background: ${BORDER};
    border-radius: 20px; padding: 2px 8px; color: ${TEXT2};
  }
  .chip-pct { color: ${YES}; font-weight: 800; margin-left: 3px; }

  /* Meta row */
  .meta {
    display: flex; align-items: center; gap: 6px;
    font-size: 10px; color: ${MUTED}; margin-bottom: 8px;
  }
  .meta-sep { color: ${BORDER}; }
  .meta-link {
    color: ${BRAND}; text-decoration: none; font-weight: 700;
    margin-left: auto; font-size: 10px;
  }
  .meta-link:hover { text-decoration: underline; }

  /* Action buttons */
  .btn-row { display: flex; gap: 6px; }
  .btn-yes {
    flex: 1; font-size: 11px; font-weight: 800;
    background: ${YES}22; color: ${YES};
    border: 1px solid ${YES}44; border-radius: 7px;
    padding: 6px 0; cursor: pointer; text-align: center;
    display: block; transition: background .15s;
  }
  .btn-yes:hover { background: ${YES}40; }
  .btn-no {
    flex: 1; font-size: 11px; font-weight: 800;
    background: ${NO}22; color: ${NO};
    border: 1px solid ${NO}44; border-radius: 7px;
    padding: 6px 0; cursor: pointer; text-align: center;
    display: block; transition: background .15s;
  }
  .btn-no:hover { background: ${NO}40; }
  .btn-view {
    flex: 1; font-size: 11px; font-weight: 700;
    background: ${BRAND}22; color: ${BRAND};
    border: 1px solid ${BRAND}44; border-radius: 7px;
    padding: 6px 0; cursor: pointer; text-align: center;
    text-decoration: none; display: block; transition: background .15s;
  }
  .btn-view:hover { background: ${BRAND}40; }

  /* \u2500\u2500 Footer \u2500\u2500 */
  .panel-footer {
    padding: 7px 14px;
    border-top: 1px solid ${BORDER};
    font-size: 10px; color: ${MUTED};
    text-align: center; background: ${PANEL}; flex-shrink: 0;
  }
  .footer-link { color: ${BRAND}; text-decoration: none; font-weight: 700; }
  .footer-link:hover { text-decoration: underline; }
`;
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fmtVol(v) {
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  }
  function fmtTime(endDate) {
    if (!endDate) return "";
    const ms = new Date(endDate).getTime() - Date.now();
    if (ms <= 0) return "Ended";
    const d = Math.floor(ms / 864e5);
    if (d > 60) return `${Math.floor(d / 30)}mo`;
    if (d > 0) return `${d}d`;
    const h = Math.floor(ms / 36e5);
    return h > 0 ? `${h}h` : "<1h";
  }
  var PolymarketOverlay = class {
    constructor(lang = "en") {
      this.isOpen = false;
      this.markets = [];
      this.bodyState = null;
      // Dismiss memory: track keyword key + time of last dismiss
      this.dismissedKey = "";
      this.dismissedAt = 0;
      this._currentKey = "";
      // Current pending trade info (for banner restore after lang switch)
      this.pendingMarket = null;
      this.pendingOutcome = "Yes";
      /** Called when user clicks YES/NO. Override in content/index.ts. */
      this.onBet = async (market) => {
        window.open(market.url, "_blank");
      };
      this.langCode = lang;
      this.s = getStrings(lang);
      this.host = document.createElement("div");
      this.host.id = OVERLAY_ID;
      this.shadow = this.host.attachShadow({ mode: "closed" });
      this.render();
    }
    // ── Render / re-render ────────────────────────────────────────────────────
    render() {
      const s = this.s;
      this.shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="container">
        <div class="panel hidden" id="panel">
          <div class="panel-header">
            <div class="header-left">
              <div class="logo">\u{1F3AF}</div>
              <div>
                <div class="panel-title">${esc(s.appName)}</div>
                <div class="panel-sub" id="sub">${esc(s.detectingTopics)}</div>
              </div>
            </div>
            <button class="close-btn" id="close-btn" title="${esc(s.closeHint)}">\u2715</button>
          </div>

          <!-- Pending trade banner (hidden until user clicks YES/NO) -->
          <div class="pending-banner" id="pending-banner">
            <div class="pending-banner-title">${esc(s.readyToTrade)}</div>
            <div class="pending-banner-sub" id="pending-sub">
              ${esc(s.pendingSubDefault)}
            </div>
            <div class="pending-banner-row">
              <button class="pending-btn-primary" id="pending-open-popup">
                ${esc(s.openPopupBtn)}
              </button>
              <a class="pending-btn-secondary" id="pending-polymarket-link"
                 href="https://polymarket.com" target="_blank" rel="noopener">
                Polymarket \u2197
              </a>
            </div>
            <button class="pending-dismiss" id="pending-dismiss">${esc(s.dismissBtn)}</button>
          </div>

          <div class="panel-body" id="panel-body">
            <div class="state-wrap">
              <div class="spinner"></div>
              <span>${esc(s.scanningMarkets)}</span>
            </div>
          </div>
          <div class="panel-footer">
            ${esc(s.footerHint)} \xB7
            <a class="footer-link" href="https://polymarket.com" target="_blank">polymarket.com</a>
          </div>
        </div>
        <button class="tab" id="tab-btn" title="Polymarket Radar">
          <span class="tab-badge" id="tab-badge"></span>
          <span class="tab-icon">\u{1F3AF}</span>MARKETS
        </button>
      </div>`;
      this.panelEl = this.shadow.getElementById("panel");
      this.bodyEl = this.shadow.getElementById("panel-body");
      this.subEl = this.shadow.getElementById("sub");
      this.bannerEl = this.shadow.getElementById("pending-banner");
      this.tabBadge = this.shadow.getElementById("tab-badge");
      this.shadow.getElementById("tab-btn").addEventListener("click", () => this.togglePanel());
      this.shadow.getElementById("close-btn").addEventListener("click", () => this.dismiss());
      this.shadow.getElementById("pending-dismiss").addEventListener("click", () => {
        this.hidePendingBanner();
      });
      this.bodyEl.addEventListener("click", (e) => {
        const el = e.target.closest("[data-outcome]");
        if (!el) return;
        e.preventDefault();
        const idx = parseInt(el.dataset.idx ?? "-1");
        const outcome = el.dataset.outcome;
        const market = this.markets[idx];
        if (market) this.onBet(market, outcome).catch(console.error);
      });
    }
    renderCard(m, idx) {
      const s = this.s;
      const binary = m.outcomes.length === 2 && m.outcomes[0]?.toLowerCase() === "yes";
      const vol = fmtVol(m.volume24hr || m.volume);
      const time = fmtTime(m.endDate);
      const yPct = Math.round((m.outcomePrices[0] ?? 0.5) * 100);
      const nPct = 100 - yPct;
      let oddsHtml = "";
      if (binary) {
        oddsHtml = `
        <div class="odds-labels">
          <span class="yes-lbl">YES ${yPct}%</span>
          <span class="no-lbl">NO ${nPct}%</span>
        </div>
        <div class="odds-track"><div class="odds-fill" style="width:${yPct}%"></div></div>`;
      } else {
        const chips = m.outcomes.slice(0, 4).map(
          (o, i) => `<span class="chip">${esc(o)}${m.outcomePrices[i] != null ? `<span class="chip-pct">${Math.round(m.outcomePrices[i] * 100)}%</span>` : ""}</span>`
        ).join("");
        oddsHtml = `<div class="chips">${chips}</div>`;
      }
      const actionsHtml = binary ? `<div class="btn-row">
          <button class="btn-yes" data-idx="${idx}" data-outcome="Yes">${esc(s.yesTradeBtn(yPct))}</button>
          <button class="btn-no"  data-idx="${idx}" data-outcome="No">${esc(s.noTradeBtn(nPct))}</button>
         </div>` : `<div class="btn-row">
          <a class="btn-view" href="${esc(m.url)}" target="_blank" rel="noopener">
            ${esc(s.tradeOnPoly)}
          </a>
         </div>`;
      return `
      <div class="market-card">
        <div class="market-q">${esc(m.question)}</div>
        ${oddsHtml}
        <div class="meta">
          <span>\u{1F4CA} ${vol}</span>
          ${time ? `<span class="meta-sep">\xB7</span><span>\u23F1 ${time}</span>` : ""}
          <a class="meta-link" href="${esc(m.url)}" target="_blank" rel="noopener">${esc(s.viewLink2)}</a>
        </div>
        ${actionsHtml}
      </div>`;
    }
    // ── Public API ──────────────────────────────────────────────────────────────
    mount() {
      if (document.getElementById(OVERLAY_ID)) return;
      document.body.appendChild(this.host);
    }
    unmount() {
      this.host.remove();
    }
    setWalletConnected(_) {
    }
    /** Update language. Re-renders static chrome and restores current body state. */
    setLang(lang) {
      if (lang === this.langCode) return;
      this.langCode = lang;
      this.s = getStrings(lang);
      const wasOpen = this.isOpen;
      this.render();
      if (wasOpen) this.openPanel();
      const st = this.bodyState;
      if (st?.type === "loading") this.setLoading(st.keywords);
      else if (st?.type === "markets") this.setMarkets(st.markets, st.keywords);
      else if (st?.type === "error") this.setError(st.msg);
      if (this.pendingMarket) this.showPendingBanner(this.pendingMarket, this.pendingOutcome);
    }
    getLang() {
      return this.langCode;
    }
    togglePanel() {
      this.isOpen ? this.closePanel() : this.openPanel();
    }
    openPanel() {
      this.panelEl.classList.remove("hidden");
      this.isOpen = true;
    }
    closePanel() {
      this.panelEl.classList.add("hidden");
      this.isOpen = false;
    }
    /** User explicitly dismissed — remember the current keyword set. */
    dismiss() {
      this.closePanel();
      this.dismissedKey = this._currentKey;
      this.dismissedAt = Date.now();
    }
    /** Whether auto-open is suppressed for the current keyword set. */
    isDismissed() {
      if (this.dismissedKey !== this._currentKey) return false;
      return Date.now() - this.dismissedAt < DISMISS_TIMEOUT;
    }
    setLoading(keywords = []) {
      this._currentKey = keywords.join("\0");
      this.bodyState = { type: "loading", keywords };
      if (keywords.length) {
        this.subEl.textContent = this.s.searchingKw(keywords.slice(0, 4).join(", "));
      }
      this.bodyEl.innerHTML = `
      <div class="state-wrap">
        <div class="spinner"></div>
        <span>${esc(this.s.searchingMarkets)}</span>
      </div>`;
      if (!this.isOpen && !this.isDismissed()) this.openPanel();
    }
    setMarkets(markets, keywords) {
      this._currentKey = keywords.join("\0");
      this.markets = markets;
      this.bodyState = { type: "markets", markets, keywords };
      this.subEl.textContent = keywords.length ? this.s.topicsKw(keywords.slice(0, 4).join(", ")) : this.s.noTopics;
      if (markets.length === 0) {
        this.bodyEl.innerHTML = `
        <div class="state-wrap">
          <span class="state-icon">\u{1F50D}</span>
          <span>${esc(this.s.noMarketsOverlay)}</span>
        </div>`;
        return;
      }
      this.bodyEl.innerHTML = markets.map((m, i) => this.renderCard(m, i)).join("");
      if (!this.isOpen && !this.isDismissed()) this.openPanel();
    }
    setError(msg) {
      this.bodyState = { type: "error", msg };
      this.bodyEl.innerHTML = `
      <div class="state-wrap">
        <span class="state-icon">\u26A0\uFE0F</span>
        <span>${esc(msg)}</span>
      </div>`;
    }
    /**
     * Show the pending trade banner.
     * Called by content/index.ts after storing trade in chrome.storage.local.
     */
    showPendingBanner(market, outcome) {
      this.pendingMarket = market;
      this.pendingOutcome = outcome;
      const pct = Math.round(
        (outcome === "Yes" ? market.outcomePrices[0] : market.outcomePrices[1]) * 100
      );
      const subEl = this.shadow.getElementById("pending-sub");
      subEl.textContent = this.s.pendingSubDetail(outcome, pct);
      const linkEl = this.shadow.getElementById("pending-polymarket-link");
      linkEl.href = market.url;
      this.bannerEl.classList.add("visible");
      this.tabBadge.classList.add("visible");
      if (!this.isOpen) this.openPanel();
    }
    hidePendingBanner() {
      this.bannerEl.classList.remove("visible");
      this.tabBadge.classList.remove("visible");
      this.pendingMarket = null;
    }
  };

  // src/content/index.ts
  var POLL_INTERVAL_MS = 15e3;
  var DEBOUNCE_MS = 2e3;
  var STALE_MS = 45e3;
  var PENDING_TTL_MS = 5 * 60 * 1e3;
  function getExtractor() {
    const h = window.location.hostname;
    if (h.includes("twitter.com") || h.includes("x.com")) return extractFromTwitter;
    if (h.includes("youtube.com")) return extractFromYouTube;
    return null;
  }
  function keywordsKey(kws) {
    return kws.join("\0");
  }
  async function init() {
    const extractorOrNull = getExtractor();
    if (!extractorOrNull) return;
    const extractor = extractorOrNull;
    const storedData = await chrome.storage.local.get("pm_lang");
    const lang = storedData.pm_lang ?? detectLang(navigator.language);
    const overlay = new PolymarketOverlay(lang);
    overlay.mount();
    overlay.onBet = async (market, outcome) => {
      chrome.storage.local.set({
        pm_pending_trade: {
          market,
          outcome,
          ts: Date.now()
        }
      });
      overlay.showPendingBanner(market, outcome);
    };
    let lastKey = "";
    let lastFetchTime = 0;
    let debounceTimer = null;
    let pollHandle = null;
    let isFetching = false;
    async function fetchMarkets(keywords, attempt = 0) {
      if (isFetching) return;
      isFetching = true;
      overlay.setLoading(keywords);
      try {
        const res = await new Promise(
          (resolve, reject) => chrome.runtime.sendMessage(
            { type: "SEARCH_MARKETS", keywords },
            (r) => {
              if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
              else resolve(r);
            }
          )
        );
        lastFetchTime = Date.now();
        if (res.type === "SEARCH_RESULT" && res.result) {
          overlay.setMarkets(res.result.markets, res.result.keywords);
        } else if (res.type === "SEARCH_ERROR") {
          overlay.setError(res.error ?? "Search failed");
        }
      } catch (err) {
        const msg = err.message ?? "";
        if (attempt === 0 && (msg.includes("Could not establish connection") || msg.includes("Extension context invalidated") || msg.includes("receiving end does not exist"))) {
          isFetching = false;
          await new Promise((r) => setTimeout(r, 800));
          return fetchMarkets(keywords, 1);
        }
        console.warn("[PolymarketRadar] Search error:", msg);
        overlay.setError("Search failed \u2014 will retry automatically.");
      } finally {
        isFetching = false;
      }
    }
    function scheduleSearch(keywords, immediate = false) {
      if (debounceTimer) clearTimeout(debounceTimer);
      const delay = immediate ? 0 : DEBOUNCE_MS;
      debounceTimer = setTimeout(() => {
        if (keywords.length > 0) fetchMarkets(keywords);
      }, delay);
    }
    function onKeywordsUpdated(keywords, force = false) {
      const key = keywordsKey(keywords);
      if (!force && key === lastKey) return;
      lastKey = key;
      scheduleSearch(keywords);
    }
    function startPolling() {
      if (pollHandle) return;
      pollHandle = setInterval(() => {
        if (!document.hidden) onKeywordsUpdated(extractor());
      }, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (pollHandle) {
        clearInterval(pollHandle);
        pollHandle = null;
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopPolling();
      } else {
        const kws = extractor();
        const stale = Date.now() - lastFetchTime > STALE_MS;
        const changed = keywordsKey(kws) !== lastKey;
        if (stale || changed) onKeywordsUpdated(kws, stale);
        startPolling();
      }
    });
    if (window.location.hostname.includes("youtube.com")) {
      let lastUrl = window.location.href;
      new MutationObserver(() => {
        if (window.location.href === lastUrl) return;
        lastUrl = window.location.href;
        let attempts = 0;
        const poll = setInterval(() => {
          const kws = extractor();
          if (kws.length > 0 || ++attempts >= 8) {
            clearInterval(poll);
            onKeywordsUpdated(kws, true);
          }
        }, 600);
      }).observe(document.body, { childList: true, subtree: true });
    }
    if (window.location.hostname.includes("twitter.com") || window.location.hostname.includes("x.com")) {
      const attachFeedObserver = () => {
        const main = document.querySelector("main") ?? document.body;
        new MutationObserver(() => onKeywordsUpdated(extractor())).observe(main, { childList: true, subtree: false });
      };
      if (document.querySelector("main")) {
        attachFeedObserver();
      } else {
        const waitForMain = new MutationObserver(() => {
          if (document.querySelector("main")) {
            waitForMain.disconnect();
            attachFeedObserver();
          }
        });
        waitForMain.observe(document.body, { childList: true, subtree: true });
      }
      let lastUrl = window.location.href;
      new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          setTimeout(() => onKeywordsUpdated(extractor(), true), 1200);
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
    chrome.storage.local.get("pm_pending_trade", (data) => {
      const pt2 = data.pm_pending_trade;
      if (pt2?.ts && Date.now() - pt2.ts > PENDING_TTL_MS) {
        chrome.storage.local.remove("pm_pending_trade");
      }
    });
    const initialKws = extractor();
    if (initialKws.length > 0) onKeywordsUpdated(initialKws);
    if (!document.hidden) startPolling();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
