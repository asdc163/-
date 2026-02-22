import type { PolymarketMarket } from '../shared/types';

const OVERLAY_ID = '__polymarket_radar_root__';

// ─── Styles ──────────────────────────────────────────────────────────────

const STYLES = `
  :host {
    all: initial;
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  *, *::before, *::after { box-sizing: border-box; }

  .container { display: flex; flex-direction: row; align-items: stretch; }

  /* Vertical tab */
  .tab {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    background: #0d9488;
    color: white;
    padding: 12px 6px;
    border-radius: 8px 0 0 8px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    display: flex;
    align-items: center;
    gap: 6px;
    user-select: none;
    border: none;
    outline: none;
    transition: background 0.15s;
  }
  .tab:hover { background: #0f766e; }
  .tab-icon { writing-mode: horizontal-tb; font-size: 14px; }

  /* Main panel */
  .panel {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-right: none;
    border-radius: 8px 0 0 8px;
    width: 300px;
    max-height: 82vh;
    overflow-y: auto;
    box-shadow: -4px 0 24px rgba(0,0,0,.12);
    display: flex;
    flex-direction: column;
  }
  .panel.hidden { display: none; }
  .panel::-webkit-scrollbar { width: 4px; }
  .panel::-webkit-scrollbar-track { background: transparent; }
  .panel::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }

  /* Panel header */
  .panel-header {
    padding: 11px 14px 9px;
    border-bottom: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    background: white;
    z-index: 1;
  }
  .panel-title {
    font-size: 13px;
    font-weight: 700;
    color: #0d9488;
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
  }
  .panel-sub {
    font-size: 10px;
    color: #94a3b8;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 190px;
  }
  .header-right { display: flex; align-items: center; gap: 7px; }
  .wallet-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #94a3b8;
    flex-shrink: 0;
    transition: background .2s;
  }
  .wallet-dot.connected { background: #22c55e; }
  .close-btn {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 15px;
    padding: 2px 4px;
    border-radius: 4px;
    line-height: 1;
  }
  .close-btn:hover { color: #64748b; background: #f1f5f9; }

  .panel-body { padding: 6px 0; flex: 1; }

  /* States */
  .loading, .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px;
    color: #94a3b8;
    font-size: 12px;
    gap: 8px;
    text-align: center;
  }
  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e2e8f0;
    border-top-color: #0d9488;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .empty-icon { font-size: 22px; }

  /* Market card */
  .market-card {
    padding: 10px 14px;
    border-bottom: 1px solid #f1f5f9;
  }
  .market-card:last-child { border-bottom: none; }

  .market-question {
    font-size: 12px;
    font-weight: 600;
    color: #1e293b;
    line-height: 1.4;
    margin-bottom: 7px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Odds bar */
  .odds-bar-wrap { margin-bottom: 7px; }
  .odds-labels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 700;
    margin-bottom: 3px;
  }
  .yes-label { color: #059669; }
  .no-label  { color: #dc2626; }
  .odds-bar  { height: 5px; border-radius: 3px; background: #fee2e2; overflow: hidden; }
  .odds-bar-fill { height: 100%; background: #059669; border-radius: 3px; transition: width .3s; }

  /* Multi-outcome chips */
  .multi-outcomes { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 7px; }
  .outcome-chip {
    font-size: 10px;
    background: #f1f5f9;
    border-radius: 4px;
    padding: 2px 6px;
    color: #475569;
    font-weight: 500;
  }
  .outcome-chip span { color: #0d9488; font-weight: 700; }

  /* Meta row */
  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    color: #94a3b8;
    gap: 4px;
    margin-bottom: 8px;
  }
  .meta-link {
    color: #0d9488;
    text-decoration: none;
    font-weight: 600;
    font-size: 10px;
  }
  .meta-link:hover { text-decoration: underline; }

  /* Bet buttons */
  .bet-row { display: flex; gap: 6px; }
  .bet-yes, .bet-no {
    flex: 1;
    font-size: 11px;
    font-weight: 700;
    border: none;
    border-radius: 5px;
    padding: 6px 0;
    cursor: pointer;
    transition: opacity .15s;
  }
  .bet-yes { background: #059669; color: white; }
  .bet-yes:hover { opacity: .85; }
  .bet-no  { background: #dc2626; color: white; }
  .bet-no:hover  { opacity: .85; }
  .bet-open {
    flex: 1;
    font-size: 11px;
    font-weight: 700;
    background: #f1f5f9;
    color: #475569;
    border: none;
    border-radius: 5px;
    padding: 6px 0;
    cursor: pointer;
    text-align: center;
    text-decoration: none;
    display: block;
  }
  .bet-open:hover { background: #e2e8f0; }

  /* Panel footer */
  .panel-footer {
    padding: 7px 14px;
    border-top: 1px solid #f1f5f9;
    font-size: 10px;
    color: #cbd5e1;
    text-align: center;
  }
  .footer-link { color: #0d9488; text-decoration: none; font-weight: 600; }
  .footer-link:hover { text-decoration: underline; }
`;

// ─── Modal styles (injected into document body, outside shadow DOM) ───────

const MODAL_STYLES = `
  #__pm_bet_modal__ {
    position: fixed; inset: 0; z-index: 2147483648;
    background: rgba(0,0,0,.45);
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  #__pm_bet_modal__ .modal {
    background: white; border-radius: 14px; padding: 22px 20px;
    width: 330px; max-width: calc(100vw - 32px);
    box-shadow: 0 20px 60px rgba(0,0,0,.28);
    animation: pm-slide-up .18s ease;
  }
  @keyframes pm-slide-up {
    from { opacity:0; transform: translateY(16px); }
    to   { opacity:1; transform: translateY(0); }
  }
  #__pm_bet_modal__ .modal-title {
    font-size: 15px; font-weight: 700; color: #1e293b; margin: 0 0 4px;
  }
  #__pm_bet_modal__ .modal-question {
    font-size: 12px; color: #64748b; margin-bottom: 14px;
    display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden;
  }
  #__pm_bet_modal__ .outcome-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 12px; font-weight: 700;
    padding: 4px 11px; border-radius: 20px; margin-bottom: 16px;
  }
  #__pm_bet_modal__ .outcome-badge.yes { background:#dcfce7; color:#166534; }
  #__pm_bet_modal__ .outcome-badge.no  { background:#fee2e2; color:#991b1b; }

  #__pm_bet_modal__ .field-label {
    font-size: 11px; color: #94a3b8; font-weight: 600;
    text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px;
  }
  #__pm_bet_modal__ .input-wrap {
    position: relative; margin-bottom: 14px;
  }
  #__pm_bet_modal__ .input-prefix {
    position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
    font-size: 13px; color: #64748b; font-weight: 600; pointer-events: none;
  }
  #__pm_bet_modal__ .amount-input {
    width: 100%; padding: 9px 10px 9px 22px;
    border: 1.5px solid #e2e8f0; border-radius: 7px;
    font-size: 15px; color: #1e293b; outline: none; font-weight: 700;
  }
  #__pm_bet_modal__ .amount-input:focus { border-color: #0d9488; }
  #__pm_bet_modal__ .amount-input:disabled { opacity: .6; }

  #__pm_bet_modal__ .summary {
    background: #f8fafc; border-radius: 8px; padding: 10px 12px;
    margin-bottom: 14px; font-size: 11px; color: #64748b;
  }
  #__pm_bet_modal__ .summary-row {
    display: flex; justify-content: space-between; margin-bottom: 5px;
  }
  #__pm_bet_modal__ .summary-row:last-child { margin-bottom: 0; }
  #__pm_bet_modal__ .summary-val { font-weight: 700; color: #1e293b; }
  #__pm_bet_modal__ .summary-val.green { color: #059669; }

  #__pm_bet_modal__ .note {
    font-size: 10px; color: #94a3b8; margin-bottom: 14px; text-align: center;
  }
  #__pm_bet_modal__ .note a { color: #0d9488; text-decoration: none; }
  #__pm_bet_modal__ .note a:hover { text-decoration: underline; }

  #__pm_bet_modal__ .actions { display: flex; gap: 8px; }
  #__pm_bet_modal__ .btn-cancel {
    flex: 1; padding: 9px; border: 1.5px solid #e2e8f0; background: white;
    border-radius: 7px; font-size: 12px; font-weight: 600; color: #64748b;
    cursor: pointer;
  }
  #__pm_bet_modal__ .btn-cancel:hover { background: #f8fafc; }
  #__pm_bet_modal__ .btn-confirm {
    flex: 2; padding: 9px; border: none; border-radius: 7px;
    font-size: 13px; font-weight: 700; color: white; cursor: pointer;
    transition: opacity .15s;
  }
  #__pm_bet_modal__ .btn-confirm.yes { background: #059669; }
  #__pm_bet_modal__ .btn-confirm.no  { background: #dc2626; }
  #__pm_bet_modal__ .btn-confirm:hover:not(:disabled) { opacity: .85; }
  #__pm_bet_modal__ .btn-confirm:disabled { opacity: .5; cursor: not-allowed; }

  #__pm_bet_modal__ .btn-connect {
    width: 100%; padding: 10px; background: #0d9488; color: white;
    border: none; border-radius: 7px; font-size: 13px; font-weight: 700;
    cursor: pointer; transition: background .15s; margin-top: 4px;
  }
  #__pm_bet_modal__ .btn-connect:hover:not(:disabled) { background: #0f766e; }
  #__pm_bet_modal__ .btn-connect:disabled { opacity: .6; cursor: not-allowed; }

  #__pm_bet_modal__ .connect-desc {
    font-size: 12px; color: #64748b; margin-bottom: 14px; text-align: center;
  }

  #__pm_bet_modal__ .alert {
    font-size: 11px; border-radius: 7px; padding: 8px 11px;
    margin-bottom: 12px; word-break: break-word; line-height: 1.5;
  }
  #__pm_bet_modal__ .alert-error { background: #fef2f2; color: #dc2626; }
  #__pm_bet_modal__ .alert-success { background: #dcfce7; color: #166534; text-align:center; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtVol(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtTimeLeft(endDate: string): string {
  if (!endDate) return '';
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const d = Math.floor(diff / 86_400_000);
  if (d > 60) return `${Math.floor(d / 30)}mo`;
  if (d > 0) return `${d}d`;
  const h = Math.floor(diff / 3_600_000);
  return h > 0 ? `${h}h` : '<1h';
}

function canBetInline(m: PolymarketMarket): boolean {
  return (
    m.outcomes.length === 2 &&
    m.outcomes[0]?.toLowerCase() === 'yes' &&
    Array.isArray(m.clobTokenIds) &&
    m.clobTokenIds.length >= 2 &&
    !!m.clobTokenIds[0] &&
    !!m.clobTokenIds[1]
  );
}

function renderCard(m: PolymarketMarket, idx: number): string {
  const binary =
    m.outcomes.length === 2 && m.outcomes[0]?.toLowerCase() === 'yes';
  const timeLeft = fmtTimeLeft(m.endDate);
  const vol = fmtVol(m.volume24hr || m.volume);

  let oddsHtml = '';
  if (binary) {
    const yes = Math.round((m.outcomePrices[0] ?? 0.5) * 100);
    oddsHtml = `
      <div class="odds-bar-wrap">
        <div class="odds-labels">
          <span class="yes-label">YES ${yes}%</span>
          <span class="no-label">NO ${100 - yes}%</span>
        </div>
        <div class="odds-bar">
          <div class="odds-bar-fill" style="width:${yes}%"></div>
        </div>
      </div>`;
  } else if (m.outcomes.length > 2) {
    const chips = m.outcomes
      .slice(0, 4)
      .map((o, i) => {
        const pct =
          m.outcomePrices[i] != null
            ? `<span>${Math.round(m.outcomePrices[i] * 100)}%</span>`
            : '';
        return `<span class="outcome-chip">${esc(o)} ${pct}</span>`;
      })
      .join('');
    oddsHtml = `<div class="multi-outcomes">${chips}</div>`;
  }

  const bettable = canBetInline(m);
  const betHtml = bettable
    ? `<div class="bet-row">
        <button class="bet-yes" data-idx="${idx}" data-outcome="Yes">
          Bet YES ↑
        </button>
        <button class="bet-no" data-idx="${idx}" data-outcome="No">
          Bet NO ↓
        </button>
       </div>`
    : `<div class="bet-row">
        <a class="bet-open" href="${esc(m.url)}" target="_blank" rel="noopener">
          Open on Polymarket ↗
        </a>
       </div>`;

  return `
    <div class="market-card" data-market-idx="${idx}">
      <div class="market-question">${esc(m.question)}</div>
      ${oddsHtml}
      <div class="meta-row">
        <span>📊 ${vol}/24h</span>
        ${timeLeft ? `<span>⏱ ${timeLeft}</span>` : ''}
        <a class="meta-link" href="${esc(m.url)}" target="_blank" rel="noopener">View ↗</a>
      </div>
      ${betHtml}
    </div>`;
}

// ─── Callback types ───────────────────────────────────────────────────────

export type BetCallback = (
  market: PolymarketMarket,
  outcome: 'Yes' | 'No',
  usdcAmount: number
) => Promise<void>;

export type ConnectCallback = () => Promise<void>;

// ─── Main overlay class ───────────────────────────────────────────────────

export class PolymarketOverlay {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private panelEl!: HTMLElement;
  private bodyEl!: HTMLElement;
  private subEl!: HTMLElement;
  private walletDotEl!: HTMLElement;
  private isOpen = false;

  private markets: PolymarketMarket[] = [];
  private walletConnected = false;

  /** Called when user confirms a bet in the modal. Injected by content/index.ts */
  onBet: BetCallback = async () => {};
  /** Called when user clicks "Connect MetaMask" in the modal. Injected by content/index.ts */
  onConnect: ConnectCallback = async () => {};

  constructor() {
    this.host = document.createElement('div');
    this.host.id = OVERLAY_ID;
    this.shadow = this.host.attachShadow({ mode: 'closed' });
    this.injectModalStyles();
    this.render();
  }

  // Inject modal CSS into the main document (modal lives outside shadow DOM)
  private injectModalStyles() {
    if (document.getElementById('__pm_modal_styles__')) return;
    const style = document.createElement('style');
    style.id = '__pm_modal_styles__';
    style.textContent = MODAL_STYLES;
    document.head.appendChild(style);
  }

  private render() {
    this.shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="container">
        <div class="panel hidden" id="panel">
          <div class="panel-header">
            <div style="min-width:0">
              <div class="panel-title">🎯 Polymarket Radar</div>
              <div class="panel-sub" id="sub">Detecting topics…</div>
            </div>
            <div class="header-right">
              <div class="wallet-dot" id="wallet-dot" title="Wallet not connected"></div>
              <button class="close-btn" id="close-btn">✕</button>
            </div>
          </div>
          <div class="panel-body" id="panel-body">
            <div class="loading">
              <div class="spinner"></div>
              <span>Scanning markets…</span>
            </div>
          </div>
          <div class="panel-footer">
            Powered by
            <a class="footer-link" href="https://polymarket.com" target="_blank">Polymarket</a>
          </div>
        </div>
        <button class="tab" id="tab-btn" title="Polymarket Radar">
          <span class="tab-icon">🎯</span>POLYMARKET
        </button>
      </div>`;

    this.panelEl = this.shadow.getElementById('panel')!;
    this.bodyEl = this.shadow.getElementById('panel-body')!;
    this.subEl = this.shadow.getElementById('sub')!;
    this.walletDotEl = this.shadow.getElementById('wallet-dot')!;

    this.shadow.getElementById('tab-btn')!.addEventListener('click', () => this.togglePanel());
    this.shadow.getElementById('close-btn')!.addEventListener('click', () => this.closePanel());

    // Delegate bet button clicks inside the panel body
    this.bodyEl.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest('[data-outcome]') as HTMLElement | null;
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx ?? '-1');
      const outcome = btn.dataset.outcome as 'Yes' | 'No';
      const market = this.markets[idx];
      if (market) this.openBetModal(market, outcome);
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────

  mount() {
    if (document.getElementById(OVERLAY_ID)) return;
    document.body.appendChild(this.host);
  }

  unmount() {
    this.host.remove();
  }

  setWalletConnected(connected: boolean) {
    this.walletConnected = connected;
    if (this.walletDotEl) {
      this.walletDotEl.className = `wallet-dot${connected ? ' connected' : ''}`;
      this.walletDotEl.title = connected
        ? 'Wallet connected'
        : 'Wallet not connected — click Bet to connect';
    }
  }

  togglePanel() { this.isOpen ? this.closePanel() : this.openPanel(); }
  openPanel()   { this.panelEl.classList.remove('hidden'); this.isOpen = true; }
  closePanel()  { this.panelEl.classList.add('hidden'); this.isOpen = false; }

  setLoading(keywords: string[] = []) {
    if (keywords.length > 0) {
      this.subEl.textContent = `Searching: ${keywords.slice(0, 4).join(', ')}`;
    }
    this.bodyEl.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <span>Searching markets…</span>
      </div>`;
    if (!this.isOpen) this.openPanel();
  }

  setMarkets(markets: PolymarketMarket[], keywords: string[]) {
    // Markets arrive pre-sorted by endDate ascending from polymarket-api.ts
    this.markets = markets;
    this.subEl.textContent =
      keywords.length > 0
        ? `Topics: ${keywords.slice(0, 4).join(', ')}`
        : 'No topics detected';

    if (markets.length === 0) {
      this.bodyEl.innerHTML = `
        <div class="empty">
          <div class="empty-icon">🔍</div>
          <div>No active markets found for current content</div>
        </div>`;
      return;
    }

    this.bodyEl.innerHTML = markets.map((m, i) => renderCard(m, i)).join('');
    if (!this.isOpen) this.openPanel();
  }

  setError(msg: string) {
    this.bodyEl.innerHTML = `
      <div class="empty">
        <div class="empty-icon">⚠️</div>
        <div>${esc(msg)}</div>
      </div>`;
  }

  // ── Bet modal ───────────────────────────────────────────────────────────

  private openBetModal(market: PolymarketMarket, outcome: 'Yes' | 'No') {
    document.getElementById('__pm_bet_modal__')?.remove();

    const wrap = document.createElement('div');
    wrap.id = '__pm_bet_modal__';
    document.body.appendChild(wrap);

    // Close on backdrop click
    wrap.addEventListener('click', e => {
      if (e.target === wrap) wrap.remove();
    });

    // Render helper — re-renders modal on state change
    const render = (state: {
      loading: boolean;
      error: string | null;
      success: string | null;
      amount: string;
    }) => {
      const outcomeIdx = outcome === 'Yes' ? 0 : 1;
      const price = market.outcomePrices[outcomeIdx] ?? 0.5;
      const pct = Math.round(price * 100);
      const parsedAmt = parseFloat(state.amount) || 0;
      const shares = parsedAmt > 0 ? (parsedAmt / price).toFixed(2) : '—';
      const maxPayout = parsedAmt > 0 ? (parsedAmt / price).toFixed(2) : '—';
      const profit = parsedAmt > 0 ? ((parsedAmt / price) - parsedAmt).toFixed(2) : '—';

      wrap.innerHTML = `
        <div class="modal">
          <div class="modal-title">Place Bet on Polymarket</div>
          <div class="modal-question">${esc(market.question)}</div>

          <span class="outcome-badge ${outcome.toLowerCase()}">
            ${outcome === 'Yes' ? '🟢' : '🔴'} ${outcome} · ${pct}¢
          </span>

          ${state.error
            ? `<div class="alert alert-error">⚠️ ${esc(state.error)}</div>`
            : ''}

          ${state.success
            ? `<div class="alert alert-success">✅ ${state.success}</div>
               <div class="actions" style="margin-top:4px">
                 <button class="btn-cancel" id="pm-close">Close</button>
                 <a class="btn-confirm yes" href="${esc(market.url)}" target="_blank"
                    rel="noopener" style="text-align:center;text-decoration:none;
                    padding:9px;display:block;border-radius:7px">
                   View on Polymarket ↗
                 </a>
               </div>`
            : !this.walletConnected
              ? `<div class="connect-desc">
                   Connect your MetaMask wallet (Polygon network) to bet directly
                   from this extension.
                 </div>
                 <button class="btn-connect" id="pm-connect"
                   ${state.loading ? 'disabled' : ''}>
                   ${state.loading ? '⏳ Connecting…' : '🦊 Connect MetaMask'}
                 </button>
                 <div class="note" style="margin-top:10px">
                   No MetaMask?
                   <a href="https://metamask.io" target="_blank">Install here ↗</a>
                 </div>`
              : `<div class="field-label">Amount (USDC)</div>
                 <div class="input-wrap">
                   <span class="input-prefix">$</span>
                   <input class="amount-input" id="pm-amount" type="number"
                     min="1" step="0.1" value="${esc(state.amount)}"
                     placeholder="10.00" ${state.loading ? 'disabled' : ''} />
                 </div>
                 <div class="summary">
                   <div class="summary-row">
                     <span>Price per share</span>
                     <span class="summary-val">$${price.toFixed(3)}</span>
                   </div>
                   <div class="summary-row">
                     <span>Shares received</span>
                     <span class="summary-val">${shares}</span>
                   </div>
                   <div class="summary-row">
                     <span>Max payout</span>
                     <span class="summary-val green">$${maxPayout}</span>
                   </div>
                   <div class="summary-row">
                     <span>Potential profit</span>
                     <span class="summary-val green">+$${profit}</span>
                   </div>
                 </div>
                 <div class="note">
                   Requires USDC balance on Polymarket.
                   <a href="https://polymarket.com/profile" target="_blank">Deposit ↗</a>
                 </div>
                 <div class="actions">
                   <button class="btn-cancel" id="pm-cancel">Cancel</button>
                   <button class="btn-confirm ${outcome.toLowerCase()}" id="pm-confirm"
                     ${state.loading ? 'disabled' : ''}>
                     ${state.loading
                       ? '⏳ Signing order…'
                       : `Confirm — Bet ${outcome === 'Yes' ? '✅' : '❌'}`}
                   </button>
                 </div>`
          }
        </div>`;

      // Wire up events
      wrap.addEventListener('click', e => {
        if (e.target === wrap) wrap.remove();
      }, { once: true });

      document.getElementById('pm-close')?.addEventListener('click', () => wrap.remove());
      document.getElementById('pm-cancel')?.addEventListener('click', () => wrap.remove());

      document.getElementById('pm-connect')?.addEventListener('click', async () => {
        render({ ...state, loading: true, error: null });
        try {
          await this.onConnect();
          render({ ...state, loading: false, error: null });
        } catch (err) {
          render({
            ...state,
            loading: false,
            error: (err as Error).message ?? 'Connection failed',
          });
        }
      });

      const amountInput = document.getElementById('pm-amount') as HTMLInputElement | null;
      amountInput?.addEventListener('input', () => {
        render({ ...state, amount: amountInput.value, error: null });
      });

      document.getElementById('pm-confirm')?.addEventListener('click', async () => {
        const input = document.getElementById('pm-amount') as HTMLInputElement | null;
        const amt = parseFloat(input?.value ?? '0');
        if (!amt || amt < 1) {
          render({ ...state, error: 'Minimum bet is $1 USDC' });
          return;
        }
        render({ ...state, loading: true, error: null, amount: String(amt) });
        try {
          await this.onBet(market, outcome, amt);
          render({
            ...state,
            loading: false,
            error: null,
            success: `Order placed! Bet $${amt} on ${outcome}.`,
          });
        } catch (err) {
          render({
            ...state,
            loading: false,
            error: (err as Error).message ?? 'Order failed',
          });
        }
      });
    };

    render({ loading: false, error: null, success: null, amount: '10' });
  }
}
