/**
 * Polymarket Radar — i18n
 * Zero-dependency, type-safe translations.
 * Supported: English · 繁體中文 · 简体中文 · 日本語 · 한국어 · Español · Português
 */

export type LangCode = 'en' | 'zh-TW' | 'zh-CN' | 'ja' | 'ko' | 'es' | 'pt';

export const SUPPORTED_LANGS: { code: LangCode; label: string }[] = [
  { code: 'en',    label: 'EN'   },
  { code: 'zh-TW', label: '繁中'  },
  { code: 'zh-CN', label: '简中'  },
  { code: 'ja',    label: '日本語' },
  { code: 'ko',    label: '한국어' },
  { code: 'es',    label: 'ES'   },
  { code: 'pt',    label: 'PT'   },
];

export interface Strings {
  // ── App ────────────────────────────────────────────────────────────────────
  appName: string;
  appSubtitle: string;

  // ── Session ────────────────────────────────────────────────────────────────
  checkingSession: string;
  notConnected: string;
  loginHintNoTab: string;
  loginHintHasTab: string;
  openPolymarket: string;
  retry: string;
  socialLogin: string;

  // ── VPN hint ───────────────────────────────────────────────────────────────
  vpnTitle: string;
  vpnFree: string;

  // ── Tabs ───────────────────────────────────────────────────────────────────
  tabSearch: string;
  tabPortfolio: string;

  // ── Search ─────────────────────────────────────────────────────────────────
  searchPlaceholder: string;
  searchBtn: string;
  searching: string;
  recent: string;
  noMarketsFound: string;
  tryDifferentKw: string;
  searchPromptTitle: string;
  searchPromptLoggedIn: string;
  searchPromptLoggedOut: string;

  // ── Order panel (buy) ──────────────────────────────────────────────────────
  buyTitle: (outcome: string, pct: number) => string;
  amountLabel: string;
  orderTypeLabel: string;
  orderMarket: string;
  orderLimit: (pct: number) => string;
  orderMarketHint: string;
  orderLimitHint: (pct: number) => string;
  pay: string;
  getApprox: string;
  shares: string;
  lowBal: (bal: string) => string;
  cancel: string;
  awaitingWallet: string;
  confirmBuy: (outcome: string) => string;

  // ── Sell panel ─────────────────────────────────────────────────────────────
  sellTitle: (outcome: string, pct: number) => string;
  sharesLabel: (size: string) => string;
  allShares: (size: string) => string;
  halfShares: (size: string) => string;
  customPlaceholder: string;
  sellMarketHint: string;
  socialSellWarning: string;
  confirmSell: (outcome: string) => string;
  sellBtn: string;
  sellingBtn: string;

  // ── Portfolio ──────────────────────────────────────────────────────────────
  connectFirst: string;
  connectFirstSub: string;
  posLabel: string;
  valueLabel: string;
  pnlLabel: string;
  noPositions: string;
  noPositionsSub: string;
  resolved: (n: number) => string;
  refreshBtn: string;
  resolvedBadge: string;
  viewLink: string;

  // ── Position card ──────────────────────────────────────────────────────────
  sharesCol: string;
  priceCol: string;
  pnlCol: string;
  avgPct: (pct: number) => string;
  costLabel: string;

  // ── Overlay pending banner (in popup) ──────────────────────────────────────
  overlayPendingTitle: string;

  // ── Footer ─────────────────────────────────────────────────────────────────
  marketCount: (n: number) => string;

  // ── Overlay (content script) ───────────────────────────────────────────────
  detectingTopics: string;
  searchingKw: (kws: string) => string;
  topicsKw: (kws: string) => string;
  noTopics: string;
  scanningMarkets: string;
  searchingMarkets: string;
  noMarketsOverlay: string;
  readyToTrade: string;
  pendingSubDefault: string;
  pendingSubDetail: (outcome: string, pct: number) => string;
  openPopupBtn: string;
  dismissBtn: string;
  closeHint: string;
  footerHint: string;
  yesTradeBtn: (pct: number) => string;
  noTradeBtn: (pct: number) => string;
  tradeOnPoly: string;
  viewLink2: string;
}

// ─── English ──────────────────────────────────────────────────────────────────
const en: Strings = {
  appName:             'Polymarket Radar',
  appSubtitle:         'Trade smarter, faster',

  checkingSession:     'Checking session…',
  notConnected:        'Not connected to Polymarket',
  loginHintNoTab:      'Open polymarket.com in any tab and log in.',
  loginHintHasTab:     'Log in at polymarket.com — MetaMask, Coinbase, WalletConnect, Google, email all work.',
  openPolymarket:      'Open Polymarket ↗',
  retry:               'Retry',
  socialLogin:         'Social login',

  vpnTitle:            'Restricted region? You may need a VPN first.',
  vpnFree:             'Free options: ProtonVPN · Windscribe (10 GB/mo)',

  tabSearch:           'Search',
  tabPortfolio:        'Portfolio',

  searchPlaceholder:   'Search any topic…',
  searchBtn:           'Search Markets',
  searching:           'Searching…',
  recent:              'Recent',
  noMarketsFound:      'No active markets found',
  tryDifferentKw:      'Try different keywords',
  searchPromptTitle:   'Search any topic',
  searchPromptLoggedIn:  'Find a market, click YES% or NO% to order directly from here',
  searchPromptLoggedOut: 'Log in at polymarket.com first, then search to place orders',

  buyTitle:            (o, p) => `Buy ${o} · ${p}%`,
  amountLabel:         'Amount (USDC)',
  orderTypeLabel:      'Order type',
  orderMarket:         '⚡ Market',
  orderLimit:          p => `📌 Limit ${p}%`,
  orderMarketHint:     'Fills immediately · up to 5% slippage',
  orderLimitHint:      p => `Resting limit @ ${p}% · fills when matched`,
  pay:                 'Pay',
  getApprox:           'Get ≈',
  shares:              'shares',
  lowBal:              b => `⚠ Balance $${b} may be insufficient`,
  cancel:              'Cancel',
  awaitingWallet:      '⏳ Awaiting wallet…',
  confirmBuy:          o => `Confirm Buy ${o}`,

  sellTitle:           (o, p) => `Sell ${o} · ${p}%`,
  sharesLabel:         s => `Shares to sell (you hold ${s})`,
  allShares:           s => `All (${s})`,
  halfShares:          s => `Half (${s})`,
  customPlaceholder:   'Custom',
  sellMarketHint:      'Fills immediately · accepts up to 3% less USDC',
  socialSellWarning:   'Social login detected — will open Polymarket to complete sell',
  confirmSell:         o => `Confirm Sell ${o}`,
  sellBtn:             'Sell',
  sellingBtn:          'Selling…',

  connectFirst:        'Connect to Polymarket first',
  connectFirstSub:     'Log in at polymarket.com to see your positions',
  posLabel:            'Positions',
  valueLabel:          'Value',
  pnlLabel:            'P&L',
  noPositions:         'No open positions',
  noPositionsSub:      'You don\'t hold any shares yet. Search for a market and place your first trade!',
  resolved:            n => `Resolved (${n})`,
  refreshBtn:          '↻ Refresh positions',
  resolvedBadge:       'Resolved',
  viewLink:            'View ↗',

  sharesCol:           'Shares',
  priceCol:            'Price',
  pnlCol:              'P&L',
  avgPct:              p => `avg ${p}%`,
  costLabel:           'cost',

  overlayPendingTitle: 'Trade staged from page overlay',

  marketCount:         n => `${n} market${n !== 1 ? 's' : ''}`,

  detectingTopics:     'Detecting topics…',
  searchingKw:         k => `Searching: ${k}`,
  topicsKw:            k => `Topics: ${k}`,
  noTopics:            'No topics detected',
  scanningMarkets:     'Scanning markets…',
  searchingMarkets:    'Searching markets…',
  noMarketsOverlay:    'No active markets for current content',
  readyToTrade:        '⚡ Ready to trade!',
  pendingSubDefault:   'Click the 🎯 toolbar icon to confirm your trade in the popup.',
  pendingSubDetail:    (o, p) => `${o} @ ${p}% staged — click 🎯 in toolbar to confirm.`,
  openPopupBtn:        '🎯 Open Popup to Trade',
  dismissBtn:          'dismiss',
  closeHint:           "Close (won't reopen for this topic)",
  footerHint:          'Click YES/NO to stage a trade · confirm via the 🎯 popup',
  yesTradeBtn:         p => `YES ${p}% — Trade ⚡`,
  noTradeBtn:          p => `NO ${p}% — Trade ⚡`,
  tradeOnPoly:         'Trade on Polymarket ↗',
  viewLink2:           'View ↗',
};

// ─── Traditional Chinese ──────────────────────────────────────────────────────
const zhTW: Strings = {
  appName:             'Polymarket 雷達',
  appSubtitle:         '更聰明、更快速地交易',

  checkingSession:     '正在檢查登入狀態…',
  notConnected:        '尚未連接到 Polymarket',
  loginHintNoTab:      '請在任意分頁開啟 polymarket.com 並登入。',
  loginHintHasTab:     '請在 polymarket.com 登入 — MetaMask、Coinbase、Google、Email 等均可使用。',
  openPolymarket:      '開啟 Polymarket ↗',
  retry:               '重試',
  socialLogin:         '社交登入',

  vpnTitle:            '在受限地區？請先開啟 VPN。',
  vpnFree:             '免費選項：ProtonVPN · Windscribe（每月 10GB）',

  tabSearch:           '搜尋',
  tabPortfolio:        '投資組合',

  searchPlaceholder:   '搜尋任何話題…',
  searchBtn:           '搜尋市場',
  searching:           '搜尋中…',
  recent:              '最近搜尋',
  noMarketsFound:      '找不到相關活躍市場',
  tryDifferentKw:      '請嘗試其他關鍵字',
  searchPromptTitle:   '搜尋任何話題',
  searchPromptLoggedIn:  '找到市場後，點擊 YES% 或 NO% 即可直接下單',
  searchPromptLoggedOut: '請先在 polymarket.com 登入，再搜尋下單',

  buyTitle:            (o, p) => `買入 ${o} · ${p}%`,
  amountLabel:         '金額（USDC）',
  orderTypeLabel:      '訂單類型',
  orderMarket:         '⚡ 市價單',
  orderLimit:          p => `📌 限價 ${p}%`,
  orderMarketHint:     '立即成交・允許最多 5% 滑點',
  orderLimitHint:      p => `限價掛單 @ ${p}%・撮合時成交`,
  pay:                 '支付',
  getApprox:           '獲得約',
  shares:              '股份',
  lowBal:              b => `⚠ 餘額 $${b} 可能不足`,
  cancel:              '取消',
  awaitingWallet:      '⏳ 等待錢包確認…',
  confirmBuy:          o => `確認買入 ${o}`,

  sellTitle:           (o, p) => `賣出 ${o} · ${p}%`,
  sharesLabel:         s => `賣出股份（你持有 ${s}）`,
  allShares:           s => `全部（${s}）`,
  halfShares:          s => `一半（${s}）`,
  customPlaceholder:   '自訂',
  sellMarketHint:      '立即成交・接受最多少 3% 的 USDC',
  socialSellWarning:   '偵測到社交登入 — 將開啟 Polymarket 完成賣出',
  confirmSell:         o => `確認賣出 ${o}`,
  sellBtn:             '賣出',
  sellingBtn:          '賣出中…',

  connectFirst:        '請先連接 Polymarket',
  connectFirstSub:     '在 polymarket.com 登入以查看您的持倉',
  posLabel:            '持倉數',
  valueLabel:          '價值',
  pnlLabel:            '損益',
  noPositions:         '目前沒有持倉',
  noPositionsSub:      '您目前尚未持有任何股份。搜尋市場並進行您的第一筆交易！',
  resolved:            n => `已結算（${n}）`,
  refreshBtn:          '↻ 刷新持倉',
  resolvedBadge:       '已結算',
  viewLink:            '查看 ↗',

  sharesCol:           '股份',
  priceCol:            '價格',
  pnlCol:              '損益',
  avgPct:              p => `均 ${p}%`,
  costLabel:           '成本',

  overlayPendingTitle: '已從頁面浮動視窗暫存交易',

  marketCount:         n => `${n} 個市場`,

  detectingTopics:     '正在偵測話題…',
  searchingKw:         k => `搜尋中：${k}`,
  topicsKw:            k => `話題：${k}`,
  noTopics:            '未偵測到話題',
  scanningMarkets:     '正在掃描市場…',
  searchingMarkets:    '搜尋市場中…',
  noMarketsOverlay:    '目前內容無相關活躍市場',
  readyToTrade:        '⚡ 準備好交易了！',
  pendingSubDefault:   '點擊工具列的 🎯 圖示，在彈出視窗中確認您的交易。',
  pendingSubDetail:    (o, p) => `${o} @ ${p}% 已暫存 — 點擊工具列 🎯 確認。`,
  openPopupBtn:        '🎯 開啟彈出視窗交易',
  dismissBtn:          '關閉',
  closeHint:           '關閉（此話題 3 分鐘內不再彈出）',
  footerHint:          '點擊 YES/NO 暫存交易 · 透過 🎯 彈出視窗確認',
  yesTradeBtn:         p => `YES ${p}% — 交易 ⚡`,
  noTradeBtn:          p => `NO ${p}% — 交易 ⚡`,
  tradeOnPoly:         '在 Polymarket 交易 ↗',
  viewLink2:           '查看 ↗',
};

// ─── Simplified Chinese ───────────────────────────────────────────────────────
const zhCN: Strings = {
  appName:             'Polymarket 雷达',
  appSubtitle:         '更聪明、更快速地交易',

  checkingSession:     '正在检查登录状态…',
  notConnected:        '未连接到 Polymarket',
  loginHintNoTab:      '请在任意标签页打开 polymarket.com 并登录。',
  loginHintHasTab:     '请在 polymarket.com 登录 — MetaMask、Coinbase、Google、Email 等均可使用。',
  openPolymarket:      '打开 Polymarket ↗',
  retry:               '重试',
  socialLogin:         '社交登录',

  vpnTitle:            '在受限区域？请先开启 VPN。',
  vpnFree:             '免费选项：ProtonVPN · Windscribe（每月 10GB）',

  tabSearch:           '搜索',
  tabPortfolio:        '投资组合',

  searchPlaceholder:   '搜索任何话题…',
  searchBtn:           '搜索市场',
  searching:           '搜索中…',
  recent:              '最近搜索',
  noMarketsFound:      '未找到相关活跃市场',
  tryDifferentKw:      '请尝试其他关键词',
  searchPromptTitle:   '搜索任何话题',
  searchPromptLoggedIn:  '找到市场后，点击 YES% 或 NO% 即可直接下单',
  searchPromptLoggedOut: '请先在 polymarket.com 登录，再搜索下单',

  buyTitle:            (o, p) => `买入 ${o} · ${p}%`,
  amountLabel:         '金额（USDC）',
  orderTypeLabel:      '订单类型',
  orderMarket:         '⚡ 市价单',
  orderLimit:          p => `📌 限价 ${p}%`,
  orderMarketHint:     '立即成交・允许最多 5% 滑点',
  orderLimitHint:      p => `限价挂单 @ ${p}%・撮合时成交`,
  pay:                 '支付',
  getApprox:           '获得约',
  shares:              '股份',
  lowBal:              b => `⚠ 余额 $${b} 可能不足`,
  cancel:              '取消',
  awaitingWallet:      '⏳ 等待钱包确认…',
  confirmBuy:          o => `确认买入 ${o}`,

  sellTitle:           (o, p) => `卖出 ${o} · ${p}%`,
  sharesLabel:         s => `卖出股份（你持有 ${s}）`,
  allShares:           s => `全部（${s}）`,
  halfShares:          s => `一半（${s}）`,
  customPlaceholder:   '自定义',
  sellMarketHint:      '立即成交・接受最多少 3% 的 USDC',
  socialSellWarning:   '检测到社交登录 — 将打开 Polymarket 完成卖出',
  confirmSell:         o => `确认卖出 ${o}`,
  sellBtn:             '卖出',
  sellingBtn:          '卖出中…',

  connectFirst:        '请先连接 Polymarket',
  connectFirstSub:     '在 polymarket.com 登录以查看您的持仓',
  posLabel:            '持仓数',
  valueLabel:          '价值',
  pnlLabel:            '损益',
  noPositions:         '目前没有持仓',
  noPositionsSub:      '您目前尚未持有任何股份。搜索市场并进行您的第一笔交易！',
  resolved:            n => `已结算（${n}）`,
  refreshBtn:          '↻ 刷新持仓',
  resolvedBadge:       '已结算',
  viewLink:            '查看 ↗',

  sharesCol:           '股份',
  priceCol:            '价格',
  pnlCol:              '损益',
  avgPct:              p => `均 ${p}%`,
  costLabel:           '成本',

  overlayPendingTitle: '已从页面浮层暂存交易',

  marketCount:         n => `${n} 个市场`,

  detectingTopics:     '正在检测话题…',
  searchingKw:         k => `搜索中：${k}`,
  topicsKw:            k => `话题：${k}`,
  noTopics:            '未检测到话题',
  scanningMarkets:     '正在扫描市场…',
  searchingMarkets:    '搜索市场中…',
  noMarketsOverlay:    '当前内容无相关活跃市场',
  readyToTrade:        '⚡ 准备好交易了！',
  pendingSubDefault:   '点击工具栏的 🎯 图标，在弹出窗口中确认您的交易。',
  pendingSubDetail:    (o, p) => `${o} @ ${p}% 已暂存 — 点击工具栏 🎯 确认。`,
  openPopupBtn:        '🎯 打开弹出窗口交易',
  dismissBtn:          '关闭',
  closeHint:           '关闭（此话题 3 分钟内不再弹出）',
  footerHint:          '点击 YES/NO 暂存交易 · 通过 🎯 弹出窗口确认',
  yesTradeBtn:         p => `YES ${p}% — 交易 ⚡`,
  noTradeBtn:          p => `NO ${p}% — 交易 ⚡`,
  tradeOnPoly:         '在 Polymarket 交易 ↗',
  viewLink2:           '查看 ↗',
};

// ─── Japanese ─────────────────────────────────────────────────────────────────
const ja: Strings = {
  appName:             'Polymarket レーダー',
  appSubtitle:         'よりスマートに、より速く取引',

  checkingSession:     'セッションを確認中…',
  notConnected:        'Polymarket に接続されていません',
  loginHintNoTab:      '任意のタブで polymarket.com を開いてログインしてください。',
  loginHintHasTab:     'polymarket.com でログインしてください — MetaMask、Coinbase、Google、メール対応。',
  openPolymarket:      'Polymarket を開く ↗',
  retry:               '再試行',
  socialLogin:         'ソーシャルログイン',

  vpnTitle:            'アクセス制限地域ですか？VPN が必要な場合があります。',
  vpnFree:             '無料オプション：ProtonVPN・Windscribe（月10GB）',

  tabSearch:           '検索',
  tabPortfolio:        'ポートフォリオ',

  searchPlaceholder:   '任意のトピックを検索…',
  searchBtn:           'マーケットを検索',
  searching:           '検索中…',
  recent:              '最近の検索',
  noMarketsFound:      'アクティブなマーケットが見つかりません',
  tryDifferentKw:      '別のキーワードをお試しください',
  searchPromptTitle:   'トピックを検索',
  searchPromptLoggedIn:  'マーケットを見つけて YES% または NO% をクリックすると直接注文できます',
  searchPromptLoggedOut: 'まず polymarket.com でログインしてから注文してください',

  buyTitle:            (o, p) => `${o} を買う · ${p}%`,
  amountLabel:         '金額 (USDC)',
  orderTypeLabel:      '注文タイプ',
  orderMarket:         '⚡ 成行注文',
  orderLimit:          p => `📌 指値 ${p}%`,
  orderMarketHint:     '即時約定・最大5%スリッページ許容',
  orderLimitHint:      p => `指値 @ ${p}% で待機・マッチング時に約定`,
  pay:                 '支払う',
  getApprox:           '受取 ≈',
  shares:              'シェア',
  lowBal:              b => `⚠ 残高 $${b} が不足している可能性があります`,
  cancel:              'キャンセル',
  awaitingWallet:      '⏳ ウォレットを待機中…',
  confirmBuy:          o => `${o} の購入を確認`,

  sellTitle:           (o, p) => `${o} を売る · ${p}%`,
  sharesLabel:         s => `売却するシェア（保有数: ${s}）`,
  allShares:           s => `全部 (${s})`,
  halfShares:          s => `半分 (${s})`,
  customPlaceholder:   'カスタム',
  sellMarketHint:      '即時約定・最大3%少ないUSDCを許容',
  socialSellWarning:   'ソーシャルログインを検出 — Polymarket で売却を完了します',
  confirmSell:         o => `${o} の売却を確認`,
  sellBtn:             '売却',
  sellingBtn:          '売却中…',

  connectFirst:        'まず Polymarket に接続してください',
  connectFirstSub:     'polymarket.com にログインしてポジションを確認',
  posLabel:            'ポジション',
  valueLabel:          '評価額',
  pnlLabel:            '損益',
  noPositions:         'オープンポジションなし',
  noPositionsSub:      'まだシェアを保有していません。マーケットを検索して最初のトレードを始めましょう！',
  resolved:            n => `解決済み (${n})`,
  refreshBtn:          '↻ ポジションを更新',
  resolvedBadge:       '解決済',
  viewLink:            '表示 ↗',

  sharesCol:           'シェア',
  priceCol:            '価格',
  pnlCol:              '損益',
  avgPct:              p => `平均 ${p}%`,
  costLabel:           '原価',

  overlayPendingTitle: 'ページオーバーレイからトレードを保存しました',

  marketCount:         n => `${n} マーケット`,

  detectingTopics:     'トピックを検出中…',
  searchingKw:         k => `検索中：${k}`,
  topicsKw:            k => `トピック：${k}`,
  noTopics:            'トピックが見つかりません',
  scanningMarkets:     'マーケットをスキャン中…',
  searchingMarkets:    'マーケットを検索中…',
  noMarketsOverlay:    '現在のコンテンツに関連するマーケットはありません',
  readyToTrade:        '⚡ トレード準備完了！',
  pendingSubDefault:   'ツールバーの 🎯 アイコンをクリックしてポップアップで確認してください。',
  pendingSubDetail:    (o, p) => `${o} @ ${p}% を保存しました — ツールバー 🎯 をクリックして確認。`,
  openPopupBtn:        '🎯 ポップアップを開いてトレード',
  dismissBtn:          '閉じる',
  closeHint:           '閉じる（このトピックでは再表示しません）',
  footerHint:          'YES/NO クリックでトレード保存 · 🎯 ポップアップで確認',
  yesTradeBtn:         p => `YES ${p}% — 取引 ⚡`,
  noTradeBtn:          p => `NO ${p}% — 取引 ⚡`,
  tradeOnPoly:         'Polymarket で取引 ↗',
  viewLink2:           '表示 ↗',
};

// ─── Korean ───────────────────────────────────────────────────────────────────
const ko: Strings = {
  appName:             'Polymarket 레이더',
  appSubtitle:         '더 스마트하게, 더 빠르게 거래',

  checkingSession:     '세션 확인 중…',
  notConnected:        'Polymarket에 연결되지 않음',
  loginHintNoTab:      '아무 탭에서 polymarket.com을 열고 로그인하세요.',
  loginHintHasTab:     'polymarket.com에 로그인하세요 — MetaMask, Coinbase, Google, 이메일 모두 지원합니다.',
  openPolymarket:      'Polymarket 열기 ↗',
  retry:               '다시 시도',
  socialLogin:         '소셜 로그인',

  vpnTitle:            '제한 지역인가요? VPN이 필요할 수 있습니다.',
  vpnFree:             '무료 옵션: ProtonVPN · Windscribe (월 10GB)',

  tabSearch:           '검색',
  tabPortfolio:        '포트폴리오',

  searchPlaceholder:   '아무 주제나 검색…',
  searchBtn:           '마켓 검색',
  searching:           '검색 중…',
  recent:              '최근 검색',
  noMarketsFound:      '활성 마켓을 찾을 수 없음',
  tryDifferentKw:      '다른 키워드를 시도해보세요',
  searchPromptTitle:   '주제 검색',
  searchPromptLoggedIn:  '마켓을 찾고 YES% 또는 NO%를 클릭하면 바로 주문할 수 있습니다',
  searchPromptLoggedOut: '먼저 polymarket.com에서 로그인한 후 검색하여 주문하세요',

  buyTitle:            (o, p) => `${o} 매수 · ${p}%`,
  amountLabel:         '금액 (USDC)',
  orderTypeLabel:      '주문 유형',
  orderMarket:         '⚡ 시장가',
  orderLimit:          p => `📌 지정가 ${p}%`,
  orderMarketHint:     '즉시 체결 · 최대 5% 슬리피지',
  orderLimitHint:      p => `지정가 @ ${p}% 대기 · 매칭 시 체결`,
  pay:                 '지불',
  getApprox:           '받을 ≈',
  shares:              '주식',
  lowBal:              b => `⚠ 잔액 $${b}이 부족할 수 있습니다`,
  cancel:              '취소',
  awaitingWallet:      '⏳ 지갑 확인 대기 중…',
  confirmBuy:          o => `${o} 매수 확인`,

  sellTitle:           (o, p) => `${o} 매도 · ${p}%`,
  sharesLabel:         s => `매도할 주식 (보유: ${s})`,
  allShares:           s => `전부 (${s})`,
  halfShares:          s => `절반 (${s})`,
  customPlaceholder:   '직접 입력',
  sellMarketHint:      '즉시 체결 · 최대 3% 적은 USDC 허용',
  socialSellWarning:   '소셜 로그인 감지 — Polymarket에서 매도를 완료합니다',
  confirmSell:         o => `${o} 매도 확인`,
  sellBtn:             '매도',
  sellingBtn:          '매도 중…',

  connectFirst:        '먼저 Polymarket에 연결하세요',
  connectFirstSub:     'polymarket.com에 로그인하여 포지션을 확인하세요',
  posLabel:            '포지션',
  valueLabel:          '가치',
  pnlLabel:            '손익',
  noPositions:         '열린 포지션 없음',
  noPositionsSub:      '아직 주식을 보유하고 있지 않습니다. 마켓을 검색하고 첫 거래를 시작하세요!',
  resolved:            n => `해결됨 (${n})`,
  refreshBtn:          '↻ 포지션 새로고침',
  resolvedBadge:       '해결됨',
  viewLink:            '보기 ↗',

  sharesCol:           '주식',
  priceCol:            '가격',
  pnlCol:              '손익',
  avgPct:              p => `평균 ${p}%`,
  costLabel:           '비용',

  overlayPendingTitle: '페이지 오버레이에서 거래가 준비되었습니다',

  marketCount:         n => `${n}개 마켓`,

  detectingTopics:     '주제 감지 중…',
  searchingKw:         k => `검색 중: ${k}`,
  topicsKw:            k => `주제: ${k}`,
  noTopics:            '감지된 주제 없음',
  scanningMarkets:     '마켓 스캔 중…',
  searchingMarkets:    '마켓 검색 중…',
  noMarketsOverlay:    '현재 콘텐츠에 관련된 활성 마켓 없음',
  readyToTrade:        '⚡ 거래 준비 완료!',
  pendingSubDefault:   '툴바의 🎯 아이콘을 클릭하여 팝업에서 거래를 확인하세요.',
  pendingSubDetail:    (o, p) => `${o} @ ${p}% 준비됨 — 툴바 🎯 클릭하여 확인.`,
  openPopupBtn:        '🎯 팝업 열어서 거래',
  dismissBtn:          '닫기',
  closeHint:           '닫기 (이 주제로 다시 열리지 않음)',
  footerHint:          'YES/NO 클릭으로 거래 준비 · 🎯 팝업으로 확인',
  yesTradeBtn:         p => `YES ${p}% — 거래 ⚡`,
  noTradeBtn:          p => `NO ${p}% — 거래 ⚡`,
  tradeOnPoly:         'Polymarket에서 거래 ↗',
  viewLink2:           '보기 ↗',
};

// ─── Spanish ──────────────────────────────────────────────────────────────────
const es: Strings = {
  appName:             'Polymarket Radar',
  appSubtitle:         'Opera más rápido e inteligente',

  checkingSession:     'Verificando sesión…',
  notConnected:        'No conectado a Polymarket',
  loginHintNoTab:      'Abre polymarket.com en cualquier pestaña e inicia sesión.',
  loginHintHasTab:     'Inicia sesión en polymarket.com — MetaMask, Coinbase, Google, email son compatibles.',
  openPolymarket:      'Abrir Polymarket ↗',
  retry:               'Reintentar',
  socialLogin:         'Login social',

  vpnTitle:            '¿Región restringida? Es posible que necesites una VPN.',
  vpnFree:             'Opciones gratis: ProtonVPN · Windscribe (10 GB/mes)',

  tabSearch:           'Buscar',
  tabPortfolio:        'Portafolio',

  searchPlaceholder:   'Busca cualquier tema…',
  searchBtn:           'Buscar Mercados',
  searching:           'Buscando…',
  recent:              'Reciente',
  noMarketsFound:      'No se encontraron mercados activos',
  tryDifferentKw:      'Prueba otras palabras clave',
  searchPromptTitle:   'Busca cualquier tema',
  searchPromptLoggedIn:  'Encuentra un mercado y haz clic en YES% o NO% para ordenar directamente',
  searchPromptLoggedOut: 'Inicia sesión en polymarket.com primero y luego busca para ordenar',

  buyTitle:            (o, p) => `Comprar ${o} · ${p}%`,
  amountLabel:         'Cantidad (USDC)',
  orderTypeLabel:      'Tipo de orden',
  orderMarket:         '⚡ Mercado',
  orderLimit:          p => `📌 Límite ${p}%`,
  orderMarketHint:     'Se ejecuta inmediatamente · hasta 5% de deslizamiento',
  orderLimitHint:      p => `Orden límite @ ${p}% · se ejecuta al cruzar`,
  pay:                 'Pagar',
  getApprox:           'Recibir ≈',
  shares:              'acciones',
  lowBal:              b => `⚠ Saldo $${b} puede ser insuficiente`,
  cancel:              'Cancelar',
  awaitingWallet:      '⏳ Esperando billetera…',
  confirmBuy:          o => `Confirmar Compra ${o}`,

  sellTitle:           (o, p) => `Vender ${o} · ${p}%`,
  sharesLabel:         s => `Acciones a vender (tienes ${s})`,
  allShares:           s => `Todo (${s})`,
  halfShares:          s => `Mitad (${s})`,
  customPlaceholder:   'Personalizar',
  sellMarketHint:      'Se ejecuta inmediatamente · acepta hasta 3% menos USDC',
  socialSellWarning:   'Login social detectado — se abrirá Polymarket para completar la venta',
  confirmSell:         o => `Confirmar Venta ${o}`,
  sellBtn:             'Vender',
  sellingBtn:          'Vendiendo…',

  connectFirst:        'Conéctate a Polymarket primero',
  connectFirstSub:     'Inicia sesión en polymarket.com para ver tus posiciones',
  posLabel:            'Posiciones',
  valueLabel:          'Valor',
  pnlLabel:            'G/P',
  noPositions:         'Sin posiciones abiertas',
  noPositionsSub:      'Aún no tienes acciones. ¡Busca un mercado y realiza tu primera operación!',
  resolved:            n => `Resuelto (${n})`,
  refreshBtn:          '↻ Actualizar posiciones',
  resolvedBadge:       'Resuelto',
  viewLink:            'Ver ↗',

  sharesCol:           'Acciones',
  priceCol:            'Precio',
  pnlCol:              'G/P',
  avgPct:              p => `prom ${p}%`,
  costLabel:           'costo',

  overlayPendingTitle: 'Operación preparada desde el panel',

  marketCount:         n => `${n} mercado${n !== 1 ? 's' : ''}`,

  detectingTopics:     'Detectando temas…',
  searchingKw:         k => `Buscando: ${k}`,
  topicsKw:            k => `Temas: ${k}`,
  noTopics:            'No se detectaron temas',
  scanningMarkets:     'Escaneando mercados…',
  searchingMarkets:    'Buscando mercados…',
  noMarketsOverlay:    'No hay mercados activos para el contenido actual',
  readyToTrade:        '⚡ ¡Listo para operar!',
  pendingSubDefault:   'Haz clic en el icono 🎯 de la barra para confirmar en el popup.',
  pendingSubDetail:    (o, p) => `${o} @ ${p}% preparado — clic en 🎯 para confirmar.`,
  openPopupBtn:        '🎯 Abrir Popup para Operar',
  dismissBtn:          'cerrar',
  closeHint:           'Cerrar (no se reabrirá para este tema)',
  footerHint:          'Clic en YES/NO para preparar · confirma en el popup 🎯',
  yesTradeBtn:         p => `YES ${p}% — Operar ⚡`,
  noTradeBtn:          p => `NO ${p}% — Operar ⚡`,
  tradeOnPoly:         'Operar en Polymarket ↗',
  viewLink2:           'Ver ↗',
};

// ─── Portuguese (Brazil) ──────────────────────────────────────────────────────
const pt: Strings = {
  appName:             'Polymarket Radar',
  appSubtitle:         'Negocie de forma mais rápida e inteligente',

  checkingSession:     'Verificando sessão…',
  notConnected:        'Não conectado ao Polymarket',
  loginHintNoTab:      'Abra polymarket.com em qualquer aba e faça login.',
  loginHintHasTab:     'Faça login em polymarket.com — MetaMask, Coinbase, Google, email são suportados.',
  openPolymarket:      'Abrir Polymarket ↗',
  retry:               'Tentar novamente',
  socialLogin:         'Login social',

  vpnTitle:            'Região restrita? Você pode precisar de uma VPN.',
  vpnFree:             'Opções gratuitas: ProtonVPN · Windscribe (10 GB/mês)',

  tabSearch:           'Buscar',
  tabPortfolio:        'Portfólio',

  searchPlaceholder:   'Pesquise qualquer tema…',
  searchBtn:           'Pesquisar Mercados',
  searching:           'Pesquisando…',
  recent:              'Recente',
  noMarketsFound:      'Nenhum mercado ativo encontrado',
  tryDifferentKw:      'Tente palavras-chave diferentes',
  searchPromptTitle:   'Pesquise qualquer tema',
  searchPromptLoggedIn:  'Encontre um mercado e clique em YES% ou NO% para ordenar diretamente',
  searchPromptLoggedOut: 'Faça login em polymarket.com primeiro, depois pesquise para fazer pedidos',

  buyTitle:            (o, p) => `Comprar ${o} · ${p}%`,
  amountLabel:         'Valor (USDC)',
  orderTypeLabel:      'Tipo de ordem',
  orderMarket:         '⚡ Mercado',
  orderLimit:          p => `📌 Limite ${p}%`,
  orderMarketHint:     'Executado imediatamente · até 5% de slippage',
  orderLimitHint:      p => `Ordem limite @ ${p}% · executada ao cruzar`,
  pay:                 'Pagar',
  getApprox:           'Receber ≈',
  shares:              'ações',
  lowBal:              b => `⚠ Saldo $${b} pode ser insuficiente`,
  cancel:              'Cancelar',
  awaitingWallet:      '⏳ Aguardando carteira…',
  confirmBuy:          o => `Confirmar Compra ${o}`,

  sellTitle:           (o, p) => `Vender ${o} · ${p}%`,
  sharesLabel:         s => `Ações a vender (você tem ${s})`,
  allShares:           s => `Tudo (${s})`,
  halfShares:          s => `Metade (${s})`,
  customPlaceholder:   'Personalizar',
  sellMarketHint:      'Executado imediatamente · aceita até 3% menos USDC',
  socialSellWarning:   'Login social detectado — o Polymarket será aberto para concluir a venda',
  confirmSell:         o => `Confirmar Venda ${o}`,
  sellBtn:             'Vender',
  sellingBtn:          'Vendendo…',

  connectFirst:        'Conecte-se ao Polymarket primeiro',
  connectFirstSub:     'Faça login em polymarket.com para ver suas posições',
  posLabel:            'Posições',
  valueLabel:          'Valor',
  pnlLabel:            'L/P',
  noPositions:         'Sem posições abertas',
  noPositionsSub:      'Você ainda não tem ações. Pesquise um mercado e faça sua primeira negociação!',
  resolved:            n => `Resolvido (${n})`,
  refreshBtn:          '↻ Atualizar posições',
  resolvedBadge:       'Resolvido',
  viewLink:            'Ver ↗',

  sharesCol:           'Ações',
  priceCol:            'Preço',
  pnlCol:              'L/P',
  avgPct:              p => `méd ${p}%`,
  costLabel:           'custo',

  overlayPendingTitle: 'Negociação preparada pelo painel',

  marketCount:         n => `${n} mercado${n !== 1 ? 's' : ''}`,

  detectingTopics:     'Detectando tópicos…',
  searchingKw:         k => `Pesquisando: ${k}`,
  topicsKw:            k => `Tópicos: ${k}`,
  noTopics:            'Nenhum tópico detectado',
  scanningMarkets:     'Verificando mercados…',
  searchingMarkets:    'Pesquisando mercados…',
  noMarketsOverlay:    'Nenhum mercado ativo para o conteúdo atual',
  readyToTrade:        '⚡ Pronto para negociar!',
  pendingSubDefault:   'Clique no ícone 🎯 da barra de ferramentas para confirmar no popup.',
  pendingSubDetail:    (o, p) => `${o} @ ${p}% preparado — clique em 🎯 para confirmar.`,
  openPopupBtn:        '🎯 Abrir Popup para Negociar',
  dismissBtn:          'fechar',
  closeHint:           'Fechar (não reabrirá para este tópico)',
  footerHint:          'Clique em YES/NO para preparar · confirme no popup 🎯',
  yesTradeBtn:         p => `YES ${p}% — Negociar ⚡`,
  noTradeBtn:          p => `NO ${p}% — Negociar ⚡`,
  tradeOnPoly:         'Negociar no Polymarket ↗',
  viewLink2:           'Ver ↗',
};

// ─── Registry ─────────────────────────────────────────────────────────────────
const ALL: Record<LangCode, Strings> = {
  'en': en, 'zh-TW': zhTW, 'zh-CN': zhCN, 'ja': ja, 'ko': ko, 'es': es, 'pt': pt,
};

export function getStrings(lang: LangCode): Strings {
  return ALL[lang] ?? en;
}

/**
 * Detect best matching language from a BCP-47 locale string.
 * Falls back to 'en' if unsupported.
 */
export function detectLang(locale?: string): LangCode {
  if (!locale) return 'en';
  const l = locale.toLowerCase();
  if (l.startsWith('zh-tw') || l.startsWith('zh-hant')) return 'zh-TW';
  if (l.startsWith('zh'))                                  return 'zh-CN';
  if (l.startsWith('ja'))                                  return 'ja';
  if (l.startsWith('ko'))                                  return 'ko';
  if (l.startsWith('es'))                                  return 'es';
  if (l.startsWith('pt'))                                  return 'pt';
  return 'en';
}
