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

  // src/content/overlay.ts
  var OVERLAY_ID = "__polymarket_radar_root__";
  var BG = "#0C0F1A";
  var PANEL = "#111520";
  var BORDER = "#232A3B";
  var TEXT = "#E8EDF5";
  var MUTED = "#5E6A82";
  var TEXT2 = "#A3ADBF";
  var YES = "#0AC18E";
  var NO = "#E23E3E";
  var BRAND = "#6170FF";
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
  }
  .tab:hover { opacity: .9; }
  .tab-icon { writing-mode: horizontal-tb; font-size: 15px; }
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
    text-decoration: none; display: block; transition: background .15s;
  }
  .btn-yes:hover { background: ${YES}40; }
  .btn-no {
    flex: 1; font-size: 11px; font-weight: 800;
    background: ${NO}22; color: ${NO};
    border: 1px solid ${NO}44; border-radius: 7px;
    padding: 6px 0; cursor: pointer; text-align: center;
    text-decoration: none; display: block; transition: background .15s;
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
  function renderCard(m, idx) {
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
        <a class="btn-yes" href="${esc(m.url)}" target="_blank" rel="noopener"
           data-idx="${idx}" data-outcome="Yes">YES ${yPct}%</a>
        <a class="btn-no"  href="${esc(m.url)}" target="_blank" rel="noopener"
           data-idx="${idx}" data-outcome="No">NO ${nPct}%</a>
       </div>` : `<div class="btn-row">
        <a class="btn-view" href="${esc(m.url)}" target="_blank" rel="noopener">
          Trade on Polymarket \u2197
        </a>
       </div>`;
    return `
    <div class="market-card">
      <div class="market-q">${esc(m.question)}</div>
      ${oddsHtml}
      <div class="meta">
        <span>\u{1F4CA} ${vol}</span>
        ${time ? `<span class="meta-sep">\xB7</span><span>\u23F1 ${time}</span>` : ""}
        <a class="meta-link" href="${esc(m.url)}" target="_blank" rel="noopener">View \u2197</a>
      </div>
      ${actionsHtml}
    </div>`;
  }
  var PolymarketOverlay = class {
    constructor() {
      this.isOpen = false;
      this.markets = [];
      /** Called when user clicks a YES/NO button. Default: opens market URL. */
      this.onBet = async (market) => {
        window.open(market.url, "_blank");
      };
      this.host = document.createElement("div");
      this.host.id = OVERLAY_ID;
      this.shadow = this.host.attachShadow({ mode: "closed" });
      this.render();
    }
    render() {
      this.shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="container">
        <div class="panel hidden" id="panel">
          <div class="panel-header">
            <div class="header-left">
              <div class="logo">\u{1F3AF}</div>
              <div>
                <div class="panel-title">Polymarket Radar</div>
                <div class="panel-sub" id="sub">Detecting topics\u2026</div>
              </div>
            </div>
            <button class="close-btn" id="close-btn" title="Close">\u2715</button>
          </div>
          <div class="panel-body" id="panel-body">
            <div class="state-wrap">
              <div class="spinner"></div>
              <span>Scanning markets\u2026</span>
            </div>
          </div>
          <div class="panel-footer">
            Quick-order via the extension popup \xB7
            <a class="footer-link" href="https://polymarket.com" target="_blank">polymarket.com</a>
          </div>
        </div>
        <button class="tab" id="tab-btn" title="Polymarket Radar \u2014 relevant prediction markets">
          <span class="tab-icon">\u{1F3AF}</span>MARKETS
        </button>
      </div>`;
      this.panelEl = this.shadow.getElementById("panel");
      this.bodyEl = this.shadow.getElementById("panel-body");
      this.subEl = this.shadow.getElementById("sub");
      this.shadow.getElementById("tab-btn").addEventListener("click", () => this.togglePanel());
      this.shadow.getElementById("close-btn").addEventListener("click", () => this.closePanel());
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
    // ── Public API ──────────────────────────────────────────────────────────────
    mount() {
      if (document.getElementById(OVERLAY_ID)) return;
      document.body.appendChild(this.host);
    }
    unmount() {
      this.host.remove();
    }
    /** No-op — kept for backward compat with content/index.ts */
    setWalletConnected(_) {
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
    setLoading(keywords = []) {
      if (keywords.length) this.subEl.textContent = `Searching: ${keywords.slice(0, 4).join(", ")}`;
      this.bodyEl.innerHTML = `
      <div class="state-wrap">
        <div class="spinner"></div>
        <span>Searching markets\u2026</span>
      </div>`;
      if (!this.isOpen) this.openPanel();
    }
    setMarkets(markets, keywords) {
      this.markets = markets;
      this.subEl.textContent = keywords.length ? `Topics: ${keywords.slice(0, 4).join(", ")}` : "No topics detected";
      if (markets.length === 0) {
        this.bodyEl.innerHTML = `
        <div class="state-wrap">
          <span class="state-icon">\u{1F50D}</span>
          <span>No active markets for current content</span>
        </div>`;
        return;
      }
      this.bodyEl.innerHTML = markets.map((m, i) => renderCard(m, i)).join("");
      if (!this.isOpen) this.openPanel();
    }
    setError(msg) {
      this.bodyEl.innerHTML = `
      <div class="state-wrap">
        <span class="state-icon">\u26A0\uFE0F</span>
        <span>${esc(msg)}</span>
      </div>`;
    }
  };

  // src/content/index.ts
  var POLL_INTERVAL_MS = 12e3;
  var DEBOUNCE_MS = 2e3;
  var STALE_MS = 45e3;
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
    const overlay = new PolymarketOverlay();
    overlay.mount();
    overlay.onBet = async (market) => {
      window.open(market.url, "_blank");
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
