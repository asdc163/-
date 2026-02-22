import type { PolymarketMarket } from '../shared/types';

const OVERLAY_ID = '__polymarket_radar_root__';

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

  .container {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    height: auto;
  }

  /* Vertical tab on the left */
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
  .tab:hover {
    background: #0f766e;
  }
  .tab-icon {
    writing-mode: horizontal-tb;
    font-size: 14px;
  }

  /* Main panel */
  .panel {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-right: none;
    border-radius: 8px 0 0 8px;
    width: 300px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: -4px 0 24px rgba(0,0,0,0.12);
    display: flex;
    flex-direction: column;
  }
  .panel.hidden {
    display: none;
  }

  /* Scrollbar styling */
  .panel::-webkit-scrollbar { width: 4px; }
  .panel::-webkit-scrollbar-track { background: transparent; }
  .panel::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }

  .panel-header {
    padding: 12px 14px 10px;
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
  .panel-keywords {
    font-size: 10px;
    color: #94a3b8;
    font-weight: 400;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }
  .close-btn {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 16px;
    padding: 2px 4px;
    border-radius: 4px;
    line-height: 1;
  }
  .close-btn:hover { color: #64748b; background: #f1f5f9; }

  .panel-body {
    padding: 8px 0;
    flex: 1;
  }

  /* Loading state */
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px;
    color: #94a3b8;
    font-size: 12px;
    gap: 10px;
  }
  .spinner {
    width: 22px;
    height: 22px;
    border: 2px solid #e2e8f0;
    border-top-color: #0d9488;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Empty state */
  .empty {
    padding: 20px 16px;
    text-align: center;
    color: #94a3b8;
    font-size: 12px;
  }
  .empty-icon { font-size: 24px; margin-bottom: 8px; }

  /* Market card */
  .market-card {
    padding: 10px 14px;
    border-bottom: 1px solid #f1f5f9;
    text-decoration: none;
    display: block;
    transition: background 0.1s;
  }
  .market-card:last-child { border-bottom: none; }
  .market-card:hover { background: #f8fafc; }

  .market-question {
    font-size: 12px;
    font-weight: 600;
    color: #1e293b;
    line-height: 1.4;
    margin-bottom: 8px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Odds bar */
  .odds-bar-wrap {
    margin-bottom: 6px;
  }
  .odds-labels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 700;
    margin-bottom: 3px;
  }
  .yes-label { color: #059669; }
  .no-label  { color: #dc2626; }
  .odds-bar {
    height: 5px;
    border-radius: 3px;
    background: #fee2e2;
    overflow: hidden;
  }
  .odds-bar-fill {
    height: 100%;
    background: #059669;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  /* Multi-outcome (non-binary) */
  .multi-outcomes {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 6px;
  }
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
  }
  .meta-vol { display: flex; align-items: center; gap: 3px; }
  .meta-end { display: flex; align-items: center; gap: 3px; }
  .bet-btn {
    font-size: 10px;
    font-weight: 700;
    background: #0d9488;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 3px 8px;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .bet-btn:hover { background: #0f766e; }

  .panel-footer {
    padding: 8px 14px;
    border-top: 1px solid #f1f5f9;
    font-size: 10px;
    color: #cbd5e1;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
  .footer-link {
    color: #0d9488;
    text-decoration: none;
    font-weight: 600;
  }
  .footer-link:hover { text-decoration: underline; }
`;

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
}

function formatTimeLeft(endDate: string): string {
  if (!endDate) return '';
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const days = Math.floor(diff / 86_400_000);
  if (days > 60) return `${Math.floor(days / 30)}mo left`;
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours > 0) return `${hours}h left`;
  return '<1h left';
}

function renderMarketCard(market: PolymarketMarket): string {
  const isBinary =
    market.outcomes.length === 2 &&
    market.outcomes[0]?.toLowerCase() === 'yes';

  let oddsSection = '';

  if (isBinary) {
    const yesPct = Math.round((market.outcomePrices[0] || 0.5) * 100);
    const noPct = 100 - yesPct;
    oddsSection = `
      <div class="odds-bar-wrap">
        <div class="odds-labels">
          <span class="yes-label">YES ${yesPct}%</span>
          <span class="no-label">NO ${noPct}%</span>
        </div>
        <div class="odds-bar">
          <div class="odds-bar-fill" style="width:${yesPct}%"></div>
        </div>
      </div>`;
  } else if (market.outcomes.length > 2) {
    const chips = market.outcomes
      .slice(0, 4)
      .map((o, i) => {
        const pct = market.outcomePrices[i]
          ? Math.round(market.outcomePrices[i] * 100)
          : null;
        return `<span class="outcome-chip">${o}${pct !== null ? ` <span>${pct}%</span>` : ''}</span>`;
      })
      .join('');
    oddsSection = `<div class="multi-outcomes">${chips}</div>`;
  }

  const vol24h = formatVolume(market.volume24hr || market.volume);
  const timeLeft = formatTimeLeft(market.endDate);

  return `
    <div class="market-card">
      <div class="market-question">${escapeHtml(market.question)}</div>
      ${oddsSection}
      <div class="meta-row">
        <span class="meta-vol">📊 ${vol24h} 24h</span>
        ${timeLeft ? `<span class="meta-end">⏱ ${timeLeft}</span>` : ''}
        <a class="bet-btn" href="${market.url}" target="_blank" rel="noopener">
          Bet ↗
        </a>
      </div>
    </div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class PolymarketOverlay {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private panelEl!: HTMLElement;
  private bodyEl!: HTMLElement;
  private keywordsEl!: HTMLElement;
  private isOpen = false;
  private isVisible = false;

  constructor() {
    // Create the host element outside any page element
    this.host = document.createElement('div');
    this.host.id = OVERLAY_ID;
    this.shadow = this.host.attachShadow({ mode: 'closed' });
    this.render();
  }

  private render() {
    this.shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="container">
        <div class="panel hidden" id="panel">
          <div class="panel-header">
            <div>
              <div class="panel-title">🎯 Polymarket Radar</div>
              <div class="panel-keywords" id="keywords-label">Detecting topics...</div>
            </div>
            <button class="close-btn" id="close-btn" title="Hide panel">✕</button>
          </div>
          <div class="panel-body" id="panel-body">
            <div class="loading">
              <div class="spinner"></div>
              <span>Scanning markets...</span>
            </div>
          </div>
          <div class="panel-footer">
            Powered by <a class="footer-link" href="https://polymarket.com" target="_blank">Polymarket</a>
          </div>
        </div>
        <button class="tab" id="tab-btn" title="Polymarket Radar">
          <span class="tab-icon">🎯</span>
          POLYMARKET
        </button>
      </div>
    `;

    this.panelEl = this.shadow.getElementById('panel')!;
    this.bodyEl = this.shadow.getElementById('panel-body')!;
    this.keywordsEl = this.shadow.getElementById('keywords-label')!;

    this.shadow.getElementById('tab-btn')!.addEventListener('click', () => {
      this.togglePanel();
    });

    this.shadow.getElementById('close-btn')!.addEventListener('click', () => {
      this.closePanel();
    });
  }

  mount() {
    if (document.getElementById(OVERLAY_ID)) return;
    document.body.appendChild(this.host);
    this.isVisible = true;
  }

  unmount() {
    this.host.remove();
    this.isVisible = false;
  }

  togglePanel() {
    if (this.isOpen) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  openPanel() {
    this.panelEl.classList.remove('hidden');
    this.isOpen = true;
  }

  closePanel() {
    this.panelEl.classList.add('hidden');
    this.isOpen = false;
  }

  setLoading(keywords: string[] = []) {
    if (keywords.length > 0) {
      this.keywordsEl.textContent = `Searching: ${keywords.join(', ')}`;
    }
    this.bodyEl.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <span>Searching markets...</span>
      </div>`;
    if (!this.isOpen) this.openPanel();
  }

  setMarkets(markets: PolymarketMarket[], keywords: string[]) {
    this.keywordsEl.textContent =
      keywords.length > 0
        ? `Topics: ${keywords.slice(0, 4).join(', ')}`
        : 'No topics detected';

    if (markets.length === 0) {
      this.bodyEl.innerHTML = `
        <div class="empty">
          <div class="empty-icon">🔍</div>
          <div>No active markets found<br>for current content</div>
        </div>`;
      return;
    }

    this.bodyEl.innerHTML = markets.map(renderMarketCard).join('');
    if (!this.isOpen) this.openPanel();
  }

  setError(msg: string) {
    this.bodyEl.innerHTML = `
      <div class="empty">
        <div class="empty-icon">⚠️</div>
        <div>${escapeHtml(msg)}</div>
      </div>`;
  }
}
