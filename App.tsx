
import React, { useState, useCallback, createContext, useContext } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
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

// ─── Fallback Mock Data (used when API is unavailable) ────────────────────────

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

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const makeId = () => Math.random().toString(36).slice(2, 10);
const idleStage = (): PipelineStage => ({ status: 'idle', progress: 0 });

const DEFAULT_CONFIG: AppConfig = {
  seedanceApiKey: '', volcengineApiKey: '', tiktokClientKey: '', tiktokAccessToken: '',
  targetRegion: 'Global', videoResolution: '1080p', videoDuration: 8,
  autoRun: false, runIntervalHours: 6, postPrivacy: 'PUBLIC',
};

const DEFAULT_STATS: AgentStats = {
  totalRuns: 12, totalVideos: 12, totalViews: '2.3M',
  totalLikes: '187K', avgEngagement: '8.4%', topPerformingTag: '#AI生成影片',
};

// ─── API helpers ──────────────────────────────────────────────────────────────

/** Typed fetch with timeout; throws on network/HTTP error */
async function apiFetch<T>(url: string, options?: RequestInit, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(tid);
  }
}

// ─── App Content ──────────────────────────────────────────────────────────────

const AppContent: React.FC = () => {
  const [splash, setSplash] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pipeline, setPipeline] = useState<PipelineRun | null>(null);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [stats, setStats] = useState<AgentStats>(DEFAULT_STATS);

  const addLog = useCallback((level: LogLevel, stage: string, message: string) => {
    setLogs(prev => [{ id: makeId(), timestamp: now(), level, stage, message }, ...prev].slice(0, 60));
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

    // initialise fresh pipeline
    setPipeline({
      id: makeId(), startedAt: now(),
      stages: [idleStage(), idleStage(), idleStage(), idleStage(), idleStage()],
    });
    setLogs([]);

    // ── Stage 1: Trending Discovery ───────────────────────────────────────────
    updateStage(0, 'running', 0);
    addLog('info', '趨勢探索', '連接 TikHub API 掃描熱門話題...');

    let topic: TrendingTopic = MOCK_TRENDING[Math.floor(Math.random() * 3)];
    let trendSource = 'mock';

    try {
      for (let p = 10; p <= 70; p += 20) { updateStage(0, 'running', p); await delay(200); }

      const trendData = await apiFetch<{ topics: TrendingTopic[]; source: string }>(
        `/api/trending?region=${config.targetRegion}`
      );

      if (trendData.topics?.length) {
        topic = trendData.topics[0];
        trendSource = trendData.source;
      }

      updateStage(0, 'completed', 100);
      addLog('success', '趨勢探索', `選定話題: ${topic.tag}（熱度 ${topic.heatScore}/100）`);
      addLog(
        trendSource === 'live' ? 'success' : 'warning',
        '趨勢探索',
        trendSource === 'live'
          ? `✓ 即時 TikHub 數據（共 ${trendData.topics.length} 個話題）`
          : '⚠ 模擬數據（設定 TIKHUB_API_KEY 啟用即時數據）'
      );
    } catch (e: any) {
      updateStage(0, 'completed', 100);
      addLog('warning', '趨勢探索', `API 請求失敗，使用模擬數據: ${topic.tag} | ${e.message}`);
    }

    const videoJob: VideoJob = {
      id: makeId(), topic, prompt: topic.suggestedPrompt,
      model: 'seedance-2.0', resolution: config.videoResolution,
      duration: config.videoDuration, status: 'generating', progress: 0,
    };
    setPipeline(prev => prev ? { ...prev, selectedTopic: topic, videoJob } : prev);
    await delay(300);

    // ── Stage 2: Seedance Video Generation ────────────────────────────────────
    updateStage(1, 'running', 0);
    addLog('info', 'Seedance 生成', `調用 Seedance 2.0 API (${config.videoResolution}, ${config.videoDuration}s)...`);
    addLog('info', 'Seedance 生成', `提示詞: "${topic.suggestedPrompt.slice(0, 70)}..."`);

    let videoUrl = '';
    let generationSource = 'mock';

    try {
      const genData = await apiFetch<{ jobId: string; source: string }>(
        '/api/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: topic.suggestedPrompt,
            resolution: config.videoResolution,
            duration: config.videoDuration,
          }),
        }
      );

      const { jobId, source } = genData;
      generationSource = source;

      addLog(
        source === 'live' ? 'success' : 'warning',
        'Seedance 生成',
        source === 'live'
          ? `✓ 任務建立成功 (jobId: ${jobId.slice(0, 16)}...)`
          : '⚠ 模擬模式（設定 SEEDANCE_API_KEY 啟用真實生成）'
      );

      // Poll for completion (every 3s, max 3 minutes)
      const maxPolls = 60;
      for (let i = 0; i < maxPolls; i++) {
        await delay(3_000);
        const statusData = await apiFetch<{
          status: string; progress: number; videoUrl?: string; error?: string;
        }>(`/api/generate-status?jobId=${encodeURIComponent(jobId)}`);

        const { status, progress, videoUrl: url, error } = statusData;
        updateStage(1, 'running', progress);
        setPipeline(prev => prev?.videoJob ? { ...prev, videoJob: { ...prev.videoJob, progress } } : prev);

        if (progress >= 30 && i === 1) addLog('info', 'Seedance 生成', '正在渲染幀畫面...');
        if (progress >= 60 && i === 3) addLog('info', 'Seedance 生成', '合成音軌與影像...');
        if (progress >= 85 && i === 5) addLog('info', 'Seedance 生成', '最終後製處理中...');

        if (status === 'completed' || url) { videoUrl = url ?? ''; break; }
        if (status === 'failed') throw new Error(error ?? '生成失敗');
      }

    } catch (e: any) {
      addLog('warning', 'Seedance 生成', `API 失敗 (${e.message})，切換模擬模式`);
      generationSource = 'mock_fallback';
      // Animate progress locally as fallback
      for (let p = 5; p <= 100; p += 5) {
        updateStage(1, 'running', p);
        setPipeline(prev => prev?.videoJob ? { ...prev, videoJob: { ...prev.videoJob, progress: p } } : prev);
        await delay(200);
      }
      videoUrl = '';
    }

    const completedJob: VideoJob = {
      ...videoJob, status: 'completed', progress: 100,
      videoUrl: videoUrl || undefined,
      generatedAt: now(),
      costEstimate: `$${(config.videoDuration * 0.065).toFixed(2)}`,
    };
    updateStage(1, 'completed', 100);
    setPipeline(prev => prev ? { ...prev, videoJob: completedJob } : prev);
    addLog('success', 'Seedance 生成', `影片生成完畢！${config.videoResolution}, ${config.videoDuration}s${generationSource === 'live' ? ' (真實影片)' : ' (模擬)'}`);
    await delay(300);

    // ── Stage 3: SEO Optimization ─────────────────────────────────────────────
    updateStage(2, 'running', 0);
    addLog('info', 'SEO 優化', '分析熱門關鍵字與標籤組合...');

    let seoData: SEOData | null = null;

    try {
      for (let p = 15; p <= 70; p += 20) { updateStage(2, 'running', p); await delay(200); }

      const seoResult = await apiFetch<SEOData & { source: string }>(
        '/api/seo',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, videoUrl }),
        }
      );
      seoData = seoResult;
      addLog(
        seoResult.source === 'ai' ? 'success' : 'info',
        'SEO 優化',
        seoResult.source === 'ai'
          ? '✓ OpenAI 生成 SEO 文案'
          : '⚠ 規則式 SEO（設定 OPENAI_API_KEY 啟用 AI 文案）'
      );
    } catch (e: any) {
      addLog('warning', 'SEO 優化', `API 失敗，使用規則式 SEO | ${e.message}`);
    }

    // Local fallback SEO
    if (!seoData) {
      seoData = {
        caption: `🔥 ${topic.title}！AI 生成超震撼影片 ✨ #創作者 #AI工具`,
        hashtags: [topic.tag, '#AI影片', '#Seedance', '#抖音創作者', '#爆款', '#trending', '#viral', '#熱門'],
        suggestedPostTime: '晚上 20:00–22:00',
        expectedReach: '預計觸及 30萬人',
        keywords: ['AI生成', '影片創作', '抖音'],
        sentiment: 'trending',
        abVariants: [
          { label: 'A 版', caption: `😱 不敢相信！${topic.tag} 流量這麼高！`, hashtags: [topic.tag, '#必看', '#viral'] },
          { label: 'B 版', caption: `📈 ${topic.title}，掌握趨勢快速成長 💡`, hashtags: [topic.tag, '#成長技巧'] },
        ],
      };
    }

    updateStage(2, 'completed', 100);
    setPipeline(prev => prev ? { ...prev, seoData: seoData! } : prev);
    addLog('success', 'SEO 優化', `生成 ${seoData.hashtags.length} 個標籤，最佳時段: ${seoData.suggestedPostTime}`);
    addLog('info', 'SEO 優化', `${seoData.expectedReach}，A/B 測試文案 ${seoData.abVariants.length} 組`);
    await delay(300);

    // ── Stage 4: Auto Publish ─────────────────────────────────────────────────
    updateStage(3, 'running', 0);
    addLog('info', '自動發布', '初始化 TikTok Content Posting API...');

    let publishedPost: PublishedPost | null = null;

    try {
      for (let p = 20; p <= 70; p += 20) {
        updateStage(3, 'running', p);
        await delay(250);
        if (p === 40) addLog('info', '自動發布', videoUrl ? '上傳影片至 TikTok 伺服器 (PULL_FROM_URL)...' : '準備發布...');
        if (p === 60) addLog('info', '自動發布', '設定標題、標籤與隱私權...');
      }

      const publishResult = await apiFetch<{
        postId: string; status: string; source: string; postUrl?: string; note?: string;
      }>(
        '/api/publish',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl: videoUrl || 'https://example.com/placeholder.mp4',
            caption: seoData.caption,
            hashtags: seoData.hashtags,
            privacyLevel: config.postPrivacy,
          }),
        }
      );

      publishedPost = {
        id: makeId(), videoJobId: videoJob.id,
        tiktokPostId: publishResult.postId,
        status: publishResult.status === 'published' ? 'published' : 'processing',
        publishedAt: now(),
        postUrl: publishResult.postUrl,
        caption: seoData.caption, hashtags: seoData.hashtags,
        privacyLevel: config.postPrivacy,
      };

      addLog(
        publishResult.source === 'live' ? 'success' : 'warning',
        '自動發布',
        publishResult.source === 'live'
          ? `✓ TikTok 已接受，Post ID: ${publishResult.postId.slice(0, 20)}`
          : `⚠ 模擬發布（設定 TIKTOK_ACCESS_TOKEN 啟用真實發布）`
      );
      if (publishResult.note) addLog('info', '自動發布', publishResult.note);

    } catch (e: any) {
      addLog('warning', '自動發布', `API 失敗 (${e.message})，使用模擬發布`);
      const mockPostId = `tt_${Date.now()}`;
      publishedPost = {
        id: makeId(), videoJobId: videoJob.id, tiktokPostId: mockPostId,
        status: 'published', publishedAt: now(),
        postUrl: `https://www.tiktok.com/@agent/video/${mockPostId}`,
        caption: seoData.caption, hashtags: seoData.hashtags,
        privacyLevel: config.postPrivacy,
      };
    }

    updateStage(3, 'completed', 100);
    setPipeline(prev => prev ? { ...prev, publishedPost: publishedPost! } : prev);
    addLog('success', '自動發布', `發布完成！ID: ${publishedPost.tiktokPostId.slice(0, 24)}...`);
    await delay(400);

    // ── Stage 5: Analytics & Feedback Loop ────────────────────────────────────
    updateStage(4, 'running', 0);
    addLog('info', '流量分析', '等待初始流量數據（約 30 秒後可見）...');

    let analytics: VideoAnalytics | null = null;

    try {
      for (let p = 10; p <= 80; p += 20) { updateStage(4, 'running', p); await delay(400); }

      analytics = await apiFetch<VideoAnalytics>(
        `/api/analytics?postId=${encodeURIComponent(publishedPost.tiktokPostId)}&region=${config.targetRegion}`
      );
    } catch (e: any) {
      addLog('warning', '流量分析', `分析 API 失敗 | ${e.message}`);
      // local fallback
      analytics = {
        postId: publishedPost.tiktokPostId,
        views: Math.floor(Math.random() * 80000 + 20000),
        likes: Math.floor(Math.random() * 8000 + 2000),
        comments: Math.floor(Math.random() * 500 + 100),
        shares: Math.floor(Math.random() * 2000 + 300),
        watchTimeAvg: Math.floor(Math.random() * 5 + 4),
        completionRate: Math.floor(Math.random() * 25 + 65),
        engagementRate: parseFloat((Math.random() * 5 + 5).toFixed(1)),
        peakHour: '21:00 – 23:00',
        audienceRegions: [{ region: '台灣', pct: 42 }, { region: '香港', pct: 28 }, { region: '中國大陸', pct: 18 }, { region: '其他', pct: 12 }],
        insights: ['完播率高於平均水準', '21:00 後互動率上升 2.3×', '評論中 68% 是正面情緒'],
        nextTopicHint: MOCK_TRENDING[(MOCK_TRENDING.findIndex(t => t.id === topic.id) + 1) % MOCK_TRENDING.length]?.tag,
      };
    }

    updateStage(4, 'completed', 100);
    setPipeline(prev => prev ? { ...prev, analytics: analytics!, completedAt: now() } : prev);

    addLog('success', '流量分析', `初始數據: ${analytics.views.toLocaleString()} 觀看，互動率 ${analytics.engagementRate}%`);
    analytics.insights.slice(0, 2).forEach(i => addLog('info', '流量分析', i));
    if (analytics.nextTopicHint) addLog('info', '流量分析', `🔁 下輪建議話題: ${analytics.nextTopicHint}`);

    addLog('success', 'AGENT', '🎉 流水線完成！數據已寫入回饋系統，優化下一輪策略中...');

    setStats(prev => ({
      ...prev,
      totalRuns: prev.totalRuns + 1,
      totalVideos: prev.totalVideos + 1,
      totalViews: `${(parseFloat(prev.totalViews) + analytics!.views / 1_000_000).toFixed(1)}M`,
      totalLikes: `${Math.round(parseInt(prev.totalLikes) + analytics!.likes / 1_000)}K`,
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
    setConfig: c => setConfig(c),
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

const App: React.FC = () => (
  <HashRouter>
    <AppContent />
  </HashRouter>
);

export default App;
