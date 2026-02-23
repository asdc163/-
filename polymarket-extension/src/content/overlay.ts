/**
 * Floating overlay injected into Twitter/X and YouTube.
 *
 * UX principles:
 *  - Opens automatically when relevant markets are found
 *  - Respects user dismiss: won't reopen for the same keyword set for 3 min
 *  - YES/NO click → stores a "pending trade" in chrome.storage.local
 *    → shows "Tap 🎯 to trade now" banner (no jarring tab navigation)
 *  - Wallet users pick up the pending trade when they open the popup
 *  - Social login fallback: also shows "Or open at Polymarket ↗"
 */

import type { PolymarketMarket } from '../shared/types';

const OVERLAY_ID       = '__polymarket_radar_root__';
const DISMISS_TIMEOUT  = 3 * 60 * 1000; // 3 min: re-open allowed after this

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG     = '#0C0F1A';
const PANEL  = '#111520';
const BORDER = '#232A3B';
const TEXT   = '#E8EDF5';
const MUTED  = '#5E6A82';
const TEXT2  = '#A3ADBF';
const YES    = '#0AC18E';
const NO     = '#E23E3E';
const BRAND  = '#6170FF';
const AMBER  = '#F59E0B';

// ─── Shadow-DOM styles ────────────────────────────────────────────────────────
const STYLES = `
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

  /* ── Tab trigger ── */
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

  /* ── Side panel ── */
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

  /* ── Panel header ── */
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

  /* ── Pending trade banner ── */
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

  /* ── Scrollable body ── */
  .panel-body { padding: 6px 0; flex: 1; overflow-y: auto; }
  .panel-body::-webkit-scrollbar { width: 3px; }
  .panel-body::-webkit-scrollbar-track { background: transparent; }
  .panel-body::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 3px; }

  /* ── States ── */
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

  /* ── Market card ── */
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

  /* ── Footer ── */
  .panel-footer {
    padding: 7px 14px;
    border-top: 1px solid ${BORDER};
    font-size: 10px; color: ${MUTED};
    text-align: center; background: ${PANEL}; flex-shrink: 0;
  }
  .footer-link { color: ${BRAND}; text-decoration: none; font-weight: 700; }
  .footer-link:hover { text-decoration: underline; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtVol(v: number): string {
  if (v >= 1e6) return `$${(v/1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v/1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtTime(endDate: string): string {
  if (!endDate) return '';
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const d = Math.floor(ms / 86_400_000);
  if (d > 60) return `${Math.floor(d/30)}mo`;
  if (d > 0) return `${d}d`;
  const h = Math.floor(ms / 3_600_000);
  return h > 0 ? `${h}h` : '<1h';
}

function renderCard(m: PolymarketMarket, idx: number): string {
  const binary = m.outcomes.length === 2 && m.outcomes[0]?.toLowerCase() === 'yes';
  const vol    = fmtVol(m.volume24hr || m.volume);
  const time   = fmtTime(m.endDate);
  const yPct   = Math.round((m.outcomePrices[0] ?? 0.5) * 100);
  const nPct   = 100 - yPct;

  let oddsHtml = '';
  if (binary) {
    oddsHtml = `
      <div class="odds-labels">
        <span class="yes-lbl">YES ${yPct}%</span>
        <span class="no-lbl">NO ${nPct}%</span>
      </div>
      <div class="odds-track"><div class="odds-fill" style="width:${yPct}%"></div></div>`;
  } else {
    const chips = m.outcomes.slice(0, 4).map((o, i) =>
      `<span class="chip">${esc(o)}${m.outcomePrices[i] != null
        ? `<span class="chip-pct">${Math.round(m.outcomePrices[i]*100)}%</span>` : ''
      }</span>`
    ).join('');
    oddsHtml = `<div class="chips">${chips}</div>`;
  }

  // YES/NO are plain buttons (no href) — click is handled via JS delegation
  // which stores a pending trade and shows the banner
  const actionsHtml = binary
    ? `<div class="btn-row">
        <button class="btn-yes" data-idx="${idx}" data-outcome="Yes">YES ${yPct}% — Trade ⚡</button>
        <button class="btn-no"  data-idx="${idx}" data-outcome="No">NO ${nPct}% — Trade ⚡</button>
       </div>`
    : `<div class="btn-row">
        <a class="btn-view" href="${esc(m.url)}" target="_blank" rel="noopener">
          Trade on Polymarket ↗
        </a>
       </div>`;

  return `
    <div class="market-card">
      <div class="market-q">${esc(m.question)}</div>
      ${oddsHtml}
      <div class="meta">
        <span>📊 ${vol}</span>
        ${time ? `<span class="meta-sep">·</span><span>⏱ ${time}</span>` : ''}
        <a class="meta-link" href="${esc(m.url)}" target="_blank" rel="noopener">View ↗</a>
      </div>
      ${actionsHtml}
    </div>`;
}

// ─── Callback types ───────────────────────────────────────────────────────────
export type BetCallback = (
  market: PolymarketMarket,
  outcome: 'Yes' | 'No',
) => Promise<void>;

// ─── PolymarketOverlay ────────────────────────────────────────────────────────
export class PolymarketOverlay {
  private host:     HTMLElement;
  private shadow:   ShadowRoot;
  private panelEl!: HTMLElement;
  private bodyEl!:  HTMLElement;
  private subEl!:   HTMLElement;
  private bannerEl!: HTMLElement;
  private tabBadge!: HTMLElement;

  private isOpen = false;
  private markets: PolymarketMarket[] = [];

  // Dismiss memory: track keyword key + time of last dismiss
  private dismissedKey = '';
  private dismissedAt  = 0;

  // Current pending trade info (for banner)
  private pendingMarket: PolymarketMarket | null = null;
  private pendingOutcome: 'Yes' | 'No' = 'Yes';

  /** Called when user clicks YES/NO. Override in content/index.ts. */
  onBet: BetCallback = async (market) => { window.open(market.url, '_blank'); };

  constructor() {
    this.host    = document.createElement('div');
    this.host.id = OVERLAY_ID;
    this.shadow  = this.host.attachShadow({ mode: 'closed' });
    this.render();
  }

  private render() {
    this.shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="container">
        <div class="panel hidden" id="panel">
          <div class="panel-header">
            <div class="header-left">
              <div class="logo">🎯</div>
              <div>
                <div class="panel-title">Polymarket Radar</div>
                <div class="panel-sub" id="sub">Detecting topics…</div>
              </div>
            </div>
            <button class="close-btn" id="close-btn" title="Close (won't reopen for this topic)">✕</button>
          </div>

          <!-- Pending trade banner (hidden until user clicks YES/NO) -->
          <div class="pending-banner" id="pending-banner">
            <div class="pending-banner-title">⚡ Ready to trade!</div>
            <div class="pending-banner-sub" id="pending-sub">
              Click the 🎯 toolbar icon to confirm your trade in the popup.
            </div>
            <div class="pending-banner-row">
              <button class="pending-btn-primary" id="pending-open-popup">
                🎯 Open Popup to Trade
              </button>
              <a class="pending-btn-secondary" id="pending-polymarket-link"
                 href="https://polymarket.com" target="_blank" rel="noopener">
                Polymarket ↗
              </a>
            </div>
            <button class="pending-dismiss" id="pending-dismiss">dismiss</button>
          </div>

          <div class="panel-body" id="panel-body">
            <div class="state-wrap">
              <div class="spinner"></div>
              <span>Scanning markets…</span>
            </div>
          </div>
          <div class="panel-footer">
            Click YES/NO to stage a trade · confirm via the 🎯 popup ·
            <a class="footer-link" href="https://polymarket.com" target="_blank">polymarket.com</a>
          </div>
        </div>
        <button class="tab" id="tab-btn" title="Polymarket Radar — relevant prediction markets">
          <span class="tab-badge" id="tab-badge"></span>
          <span class="tab-icon">🎯</span>MARKETS
        </button>
      </div>`;

    this.panelEl  = this.shadow.getElementById('panel')!;
    this.bodyEl   = this.shadow.getElementById('panel-body')!;
    this.subEl    = this.shadow.getElementById('sub')!;
    this.bannerEl = this.shadow.getElementById('pending-banner')!;
    this.tabBadge = this.shadow.getElementById('tab-badge')!;

    this.shadow.getElementById('tab-btn')!.addEventListener('click', () => this.togglePanel());
    this.shadow.getElementById('close-btn')!.addEventListener('click', () => this.dismiss());

    // Pending trade banner actions
    this.shadow.getElementById('pending-open-popup')!.addEventListener('click', () => {
      // We can't programmatically open the popup, but we can open a
      // chrome-extension page that tells the user what to do, or just
      // navigate to the extension. Most users know to click the toolbar icon.
      // The badge on the tab button also guides them.
      // Best we can do: show a helpful alert... or just let the banner speak.
    });
    this.shadow.getElementById('pending-dismiss')!.addEventListener('click', () => {
      this.hidePendingBanner();
    });

    // Delegate YES/NO click on market cards
    this.bodyEl.addEventListener('click', e => {
      const el = (e.target as HTMLElement).closest('[data-outcome]') as HTMLElement | null;
      if (!el) return;
      e.preventDefault();
      const idx     = parseInt(el.dataset.idx ?? '-1');
      const outcome = el.dataset.outcome as 'Yes' | 'No';
      const market  = this.markets[idx];
      if (market) this.onBet(market, outcome).catch(console.error);
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  mount() {
    if (document.getElementById(OVERLAY_ID)) return;
    document.body.appendChild(this.host);
  }
  unmount() { this.host.remove(); }
  setWalletConnected(_: boolean) {}

  togglePanel() { this.isOpen ? this.closePanel() : this.openPanel(); }

  openPanel() {
    this.panelEl.classList.remove('hidden');
    this.isOpen = true;
  }

  closePanel() {
    this.panelEl.classList.add('hidden');
    this.isOpen = false;
  }

  /** User explicitly dismissed — remember the current keyword set. */
  private dismiss() {
    this.closePanel();
    this.dismissedKey = this._currentKey;
    this.dismissedAt  = Date.now();
  }

  private _currentKey = '';

  /** Whether auto-open is suppressed for the current keyword set. */
  private isDismissed(): boolean {
    if (this.dismissedKey !== this._currentKey) return false;
    return Date.now() - this.dismissedAt < DISMISS_TIMEOUT;
  }

  setLoading(keywords: string[] = []) {
    this._currentKey = keywords.join('\x00');
    if (keywords.length) this.subEl.textContent = `Searching: ${keywords.slice(0,4).join(', ')}`;
    this.bodyEl.innerHTML = `
      <div class="state-wrap">
        <div class="spinner"></div>
        <span>Searching markets…</span>
      </div>`;
    // Auto-open on new topic (but not if user dismissed this topic recently)
    if (!this.isOpen && !this.isDismissed()) this.openPanel();
  }

  setMarkets(markets: PolymarketMarket[], keywords: string[]) {
    this._currentKey = keywords.join('\x00');
    this.markets = markets;
    this.subEl.textContent = keywords.length
      ? `Topics: ${keywords.slice(0, 4).join(', ')}`
      : 'No topics detected';

    if (markets.length === 0) {
      this.bodyEl.innerHTML = `
        <div class="state-wrap">
          <span class="state-icon">🔍</span>
          <span>No active markets for current content</span>
        </div>`;
      // Don't auto-open when no results — only close if already open and empty
      return;
    }

    this.bodyEl.innerHTML = markets.map((m, i) => renderCard(m, i)).join('');

    // Auto-open only if user hasn't dismissed this topic
    if (!this.isOpen && !this.isDismissed()) this.openPanel();
  }

  setError(msg: string) {
    this.bodyEl.innerHTML = `
      <div class="state-wrap">
        <span class="state-icon">⚠️</span>
        <span>${esc(msg)}</span>
      </div>`;
  }

  /**
   * Show the pending trade banner.
   * Called by content/index.ts after storing trade in chrome.storage.local.
   */
  showPendingBanner(market: PolymarketMarket, outcome: 'Yes' | 'No') {
    this.pendingMarket  = market;
    this.pendingOutcome = outcome;

    const pct = Math.round(
      (outcome === 'Yes' ? market.outcomePrices[0] : market.outcomePrices[1]) * 100
    );

    const subEl = this.shadow.getElementById('pending-sub')!;
    subEl.textContent =
      `${outcome} @ ${pct}% staged — click the 🎯 icon in your toolbar to confirm.`;

    const linkEl = this.shadow.getElementById('pending-polymarket-link') as HTMLAnchorElement;
    linkEl.href = market.url;

    this.bannerEl.classList.add('visible');
    this.tabBadge.classList.add('visible');
    if (!this.isOpen) this.openPanel();
  }

  hidePendingBanner() {
    this.bannerEl.classList.remove('visible');
    this.tabBadge.classList.remove('visible');
    this.pendingMarket = null;
  }
}
