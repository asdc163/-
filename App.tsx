
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import SplashView from './views/SplashView';
import DashboardView from './views/DashboardView';
import TrendingView from './views/RoleSelectionView';    // repurposed
import GenerationView from './views/RegisterView';        // repurposed
import AnalyticsView from './views/SafetyLogView';        // repurposed
import SettingsView from './views/PrivacySettingsView';   // repurposed
import {
  AppConfig, AgentStats, LogEntry, LogLevel, PipelineRun, PipelineStage,
  TrendingTopic, VideoJob, SEOData, PublishedPost, VideoAnalytics,
} from './types';

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const MOCK_TRENDING: TrendingTopic[] = [
  {
    id: '1', tag: '#AI生成影片', title: 'AI生成影片大爆發',
    category: 'tech', heatScore: 98, viewCount: '12.3億', postCount: '24.7萬',
    trend: 'rising', region: 'Global',
    suggestedPrompt: 'Cinematic AI-generated world, neon holographic city, futuristic skyline at night, ultra-realistic 4K quality, dramatic lighting',
  },
  {
    id: '2', tag: '#春節舞蹈挑戰', title: '春節舞蹈挑戰賽',
    category: 'entertainment', heatScore: 95, viewCount: '8.9億', postCount: '18.2萬',
    trend: 'rising', region: 'CN',
    suggestedPrompt: 'Traditional Chinese New Year celebration, vibrant red lanterns, festive dragon dance, fireworks exploding over city skyline, joyful crowd',
  },
  {
    id: '3', tag: '#奶茶新品測評', title: '最新奶茶大評比',
    category: 'food', heatScore: 91, viewCount: '6.4億', postCount: '12.1萬',
    trend: 'rising', region: 'TW',
    suggestedPrompt: 'Aesthetic bubble tea close-up, steam rising, colorful toppings, soft bokeh background, slow-motion pour, ASMR style',
  },
  {
    id: '4', tag: '#職場穿搭OOTD', title: '職場穿搭靈感',
    category: 'fashion', heatScore: 87, viewCount: '4.2億', postCount: '9.8萬',
    trend: 'stable', region: 'Global',
    suggestedPrompt: 'Modern office fashion lookbook, clean minimalist style, confident professional walking through urban environment, golden hour lighting',
  },
  {
    id: '5', tag: '#健身挑戰30天', title: '30天健身蛻變挑戰',
    category: 'fitness', heatScore: 84, viewCount: '3.7億', postCount: '7.3萬',
    trend: 'rising', region: 'Global',
    suggestedPrompt: 'Motivational gym workout montage, dynamic camera angles, athlete transformation, high energy, cinematic slow motion',
  },
  {
    id: '6', tag: '#美食探店Vlog', title: '隱藏版美食探店',
    category: 'food', heatScore: 81, viewCount: '3.1億', postCount: '6.5萬',
    trend: 'stable', region: 'TW',
    suggestedPrompt: 'Cozy hidden restaurant discovery, steam rising from dishes, warm ambient lighting, delicious food close-ups, authentic local vibe',
  },
  {
    id: '7', tag: '#旅遊Vlog日本', title: '日本旅遊必看景點',
    category: 'travel', heatScore: 79, viewCount: '2.8億', postCount: '5.9萬',
    trend: 'stable', region: 'Global',
    suggestedPrompt: 'Japan travel cinematic vlog, cherry blossoms, Mount Fuji, Tokyo neon lights, serene temples, fast-paced montage, travel diary style',
  },
  {
    id: '8', tag: '#遊戲精彩時刻', title: '遊戲高光時刻合集',
    category: 'gaming', heatScore: 76, viewCount: '2.5億', postCount: '5.1萬',
    trend: 'falling', region: 'Global',
    suggestedPrompt: 'Epic gaming highlight reel, spectacular plays, reaction shots, neon gaming setup, dynamic transitions, hype moments compilation',
  },
];

const MOCK_SEO = (topic: TrendingTopic): SEOData => ({
  caption: `🔥 ${topic.title}！這個趨勢你跟上了嗎？用 AI 一秒生成爆款影片 ✨ #創作者 #AI工具`,
  hashtags: [topic.tag, '#AI影片', '#Seedance', '#抖音創作者', '#爆款', '#熱門', '#trending', '#viral'],
  suggestedPostTime: '晚上 20:00 – 22:00',
  expectedReach: `預計觸及 ${Math.floor(Math.random() * 50 + 20)}萬人`,
  keywords: ['AI生成', '影片創作', '抖音', '爆款', '熱門趨勢'],
  sentiment: 'trending',
  abVariants: [
    {
      label: 'A 版 (情緒驅動)',
      caption: `😱 不敢相信！${topic.tag} 的流量居然這麼高！趕快來看看 👀`,
      hashtags: [topic.tag, '#震驚', '#必看', '#抖音熱門', '#viral'],
    },
    {
      label: 'B 版 (價值導向)',
      caption: `📈 ${topic.title}，掌握這個趨勢讓你的帳號快速成長 💡`,
      hashtags: [topic.tag, '#成長技巧', '#創作者必看', '#抖音攻略', '#trending'],
    },
  ],
});

const MOCK_ANALYTICS = (topic: TrendingTopic): VideoAnalytics => ({
  postId: `tt_${Date.now()}`,
  views: Math.floor(Math.random() * 80000 + 20000),
  likes: Math.floor(Math.random() * 8000 + 2000),
  comments: Math.floor(Math.random() * 500 + 100),
  shares: Math.floor(Math.random() * 2000 + 300),
  watchTimeAvg: Math.floor(Math.random() * 5 + 4),
  completionRate: Math.floor(Math.random() * 25 + 65),
  engagementRate: parseFloat((Math.random() * 5 + 5).toFixed(1)),
  peakHour: '21:00 – 23:00',
  audienceRegions: [
    { region: '台灣', pct: 42 }, { region: '香港', pct: 28 },
    { region: '中國大陸', pct: 18 }, { region: '其他', pct: 12 },
  ],
  insights: [
    `影片完播率高達 ${Math.floor(Math.random() * 25 + 65)}%，高於平均水準`,
    `${topic.tag} 標籤帶來 40% 的自然觸及`,
    '21:00 後互動率上升 2.3×，建議晚間發布',
    '評論中 68% 是正面情緒，有爆款潛力',
  ],
  nextTopicHint: MOCK_TRENDING[(MOCK_TRENDING.findIndex(t => t.id === topic.id) + 1) % MOCK_TRENDING.length]?.tag,
});

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppCtx {
  splash: boolean;
  pipeline: PipelineRun | null;
  logs: LogEntry[];
  topics: TrendingTopic[];
  config: AppConfig;
  stats: AgentStats;
  isRunning: boolean;
  runPipeline: () => void;
  resetPipeline: () => void;
  setConfig: (c: AppConfig) => void;
}

export const AppContext = createContext<AppCtx>(null!);
export const useApp = () => useContext(AppContext);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const now = () => new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const makeId = () => Math.random().toString(36).slice(2, 10);

const idleStage = (): PipelineStage => ({ status: 'idle', progress: 0 });

const DEFAULT_CONFIG: AppConfig = {
  seedanceApiKey: '',
  volcengineApiKey: '',
  tiktokClientKey: '',
  tiktokAccessToken: '',
  targetRegion: 'Global',
  videoResolution: '1080p',
  videoDuration: 8,
  autoRun: false,
  runIntervalHours: 6,
  postPrivacy: 'PUBLIC',
};

const DEFAULT_STATS: AgentStats = {
  totalRuns: 12, totalVideos: 12, totalViews: '2.3M',
  totalLikes: '187K', avgEngagement: '8.4%', topPerformingTag: '#AI生成影片',
};

// ─── App Content ──────────────────────────────────────────────────────────────

const AppContent: React.FC = () => {
  const [splash, setSplash] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pipeline, setPipeline] = useState<PipelineRun | null>(null);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [stats, setStats] = useState<AgentStats>(DEFAULT_STATS);

  const addLog = useCallback((level: LogLevel, stage: string, message: string) => {
    setLogs(prev => [{
      id: makeId(), timestamp: now(), level, stage, message,
    }, ...prev].slice(0, 50));
  }, []);

  const updateStage = useCallback((idx: number, status: PipelineStage['status'], progress = 100) => {
    setPipeline(prev => {
      if (!prev) return prev;
      const stages = [...prev.stages] as PipelineRun['stages'];
      stages[idx] = {
        ...stages[idx], status, progress,
        ...(status === 'running' ? { startedAt: now() } : {}),
        ...(status === 'completed' || status === 'error' ? { completedAt: now() } : {}),
      };
      return { ...prev, stages };
    });
  }, []);

  const runPipeline = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);

    const runId = makeId();
    const freshPipeline: PipelineRun = {
      id: runId,
      startedAt: now(),
      stages: [idleStage(), idleStage(), idleStage(), idleStage(), idleStage()],
    };
    setPipeline(freshPipeline);
    setLogs([]);

    // ── Stage 1: Trending Discovery ──────────────────────────────
    addLog('info', '趨勢探索', '正在連接抖音 Research API...');
    setPipeline(prev => prev ? {
      ...prev,
      stages: [{ status: 'running', progress: 0, startedAt: now() }, idleStage(), idleStage(), idleStage(), idleStage()],
    } : prev);

    await delay(800);
    addLog('info', '趨勢探索', `掃描到 ${MOCK_TRENDING.length} 個熱門話題，分析熱度中...`);

    // progress animation for stage 1
    for (let p = 10; p <= 90; p += 20) {
      updateStage(0, 'running', p);
      await delay(300);
    }

    const topic = MOCK_TRENDING[Math.floor(Math.random() * 3)]; // top 3
    updateStage(0, 'completed', 100);
    addLog('success', '趨勢探索', `選定話題: ${topic.tag}（熱度 ${topic.heatScore}/100, ${topic.viewCount}觀看次數）`);

    const videoJob: VideoJob = {
      id: makeId(), topic, prompt: topic.suggestedPrompt,
      model: 'seedance-2.0', resolution: config.videoResolution,
      duration: config.videoDuration, status: 'generating', progress: 0,
    };

    setPipeline(prev => prev ? { ...prev, selectedTopic: topic, videoJob } : prev);
    await delay(500);

    // ── Stage 2: Seedance Video Generation ───────────────────────
    updateStage(1, 'running', 0);
    addLog('info', 'Seedance 生成', `調用 Seedance 2.0 API (${config.videoResolution}, ${config.videoDuration}s)...`);
    addLog('info', 'Seedance 生成', `提示詞: "${topic.suggestedPrompt.slice(0, 60)}..."`);

    for (let p = 5; p <= 100; p += 5) {
      updateStage(1, 'running', p);
      setPipeline(prev => prev && prev.videoJob
        ? { ...prev, videoJob: { ...prev.videoJob, progress: p } }
        : prev);
      if (p === 30) addLog('info', 'Seedance 生成', '正在渲染幀畫面...');
      if (p === 60) addLog('info', 'Seedance 生成', '合成音軌與影像...');
      if (p === 85) addLog('info', 'Seedance 生成', '最終後製處理中...');
      await delay(200);
    }

    const completedJob: VideoJob = {
      ...videoJob, status: 'completed', progress: 100,
      videoUrl: 'https://example.com/generated.mp4',
      generatedAt: now(),
      costEstimate: `$${(config.videoDuration * 0.065).toFixed(2)}`,
    };

    updateStage(1, 'completed', 100);
    setPipeline(prev => prev ? { ...prev, videoJob: completedJob } : prev);
    addLog('success', 'Seedance 生成', `影片生成完畢！${config.videoResolution}，${config.videoDuration}秒，費用約 ${completedJob.costEstimate}`);

    await delay(400);

    // ── Stage 3: SEO Optimization ────────────────────────────────
    updateStage(2, 'running', 0);
    addLog('info', 'SEO 優化', '分析熱門關鍵字與標籤組合...');

    for (let p = 15; p <= 100; p += 25) {
      updateStage(2, 'running', p);
      await delay(350);
    }

    const seoData = MOCK_SEO(topic);
    updateStage(2, 'completed', 100);
    setPipeline(prev => prev ? { ...prev, seoData } : prev);
    addLog('success', 'SEO 優化', `生成 ${seoData.hashtags.length} 個標籤，最佳發布時段: ${seoData.suggestedPostTime}`);
    addLog('info', 'SEO 優化', `${seoData.expectedReach}，產生 A/B 測試文案 2 組`);

    await delay(400);

    // ── Stage 4: Auto Publish ────────────────────────────────────
    updateStage(3, 'running', 0);
    addLog('info', '自動發布', '初始化 TikTok Content Posting API...');

    for (let p = 20; p <= 80; p += 20) {
      updateStage(3, 'running', p);
      await delay(350);
      if (p === 40) addLog('info', '自動發布', '上傳影片至 TikTok 伺服器...');
      if (p === 60) addLog('info', '自動發布', '設定標題、標籤與隱私權...');
    }

    const postId = `tt_${Date.now()}`;
    const publishedPost: PublishedPost = {
      id: makeId(), videoJobId: videoJob.id,
      tiktokPostId: postId, status: 'published',
      publishedAt: now(), postUrl: `https://www.tiktok.com/@agent/video/${postId}`,
      caption: seoData.caption, hashtags: seoData.hashtags,
      privacyLevel: config.postPrivacy,
    };

    updateStage(3, 'completed', 100);
    setPipeline(prev => prev ? { ...prev, publishedPost } : prev);
    addLog('success', '自動發布', `發布成功！帖子 ID: ${postId.slice(0, 20)}...`);

    await delay(600);

    // ── Stage 5: Analytics & Feedback ───────────────────────────
    updateStage(4, 'running', 0);
    addLog('info', '流量分析', '監控初始流量數據...');

    for (let p = 10; p <= 90; p += 20) {
      updateStage(4, 'running', p);
      await delay(400);
    }

    const analytics = MOCK_ANALYTICS(topic);
    updateStage(4, 'completed', 100);
    setPipeline(prev => prev ? { ...prev, analytics, completedAt: now() } : prev);

    addLog('success', '流量分析', `初始數據: ${analytics.views.toLocaleString()}次觀看，互動率 ${analytics.engagementRate}%`);
    addLog('info', '流量分析', `洞察: ${analytics.insights[0]}`);
    if (analytics.nextTopicHint) {
      addLog('info', '流量分析', `下次建議話題: ${analytics.nextTopicHint}`);
    }
    addLog('success', 'AGENT', '🎉 完整流水線執行完成！正在優化下一輪策略...');

    // Update stats
    setStats(prev => ({
      ...prev,
      totalRuns: prev.totalRuns + 1,
      totalVideos: prev.totalVideos + 1,
      totalViews: `${(parseFloat(prev.totalViews) + analytics.views / 1_000_000).toFixed(1)}M`,
      totalLikes: `${Math.round(parseInt(prev.totalLikes) + analytics.likes / 1000)}K`,
    }));

    setIsRunning(false);
  }, [isRunning, config, addLog, updateStage]);

  const resetPipeline = useCallback(() => {
    if (isRunning) return;
    setPipeline(null);
    setLogs([]);
  }, [isRunning]);

  const ctx: AppCtx = {
    splash, pipeline, logs, topics: MOCK_TRENDING, config, stats,
    isRunning, runPipeline, resetPipeline,
    setConfig: (c) => setConfig(c),
  };

  return (
    <AppContext.Provider value={ctx}>
      <div className="relative min-h-screen bg-tt-bg max-w-md mx-auto overflow-x-hidden">
        <Routes>
          <Route path="/"          element={<SplashView onDone={() => setSplash(false)} />} />
          <Route path="/dashboard" element={<DashboardView />} />
          <Route path="/trending"  element={<TrendingView />} />
          <Route path="/generate"  element={<GenerationView />} />
          <Route path="/analytics" element={<AnalyticsView />} />
          <Route path="/settings"  element={<SettingsView />} />
        </Routes>
      </div>
    </AppContext.Provider>
  );
};

// ─── Root App ────────────────────────────────────────────────────────────────

const App: React.FC = () => (
  <HashRouter>
    <AppContent />
  </HashRouter>
);

export default App;
