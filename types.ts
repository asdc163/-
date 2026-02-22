
// ─── Trending Topics ──────────────────────────────────────────────────────────

export type TopicCategory = 'entertainment' | 'tech' | 'food' | 'fashion' | 'fitness' | 'travel' | 'news' | 'gaming';
export type RegionTarget = 'CN' | 'Global' | 'TW';
export type TrendDirection = 'rising' | 'stable' | 'falling';

export interface TrendingTopic {
  id: string;
  tag: string;
  title: string;
  category: TopicCategory;
  heatScore: number; // 0–100
  viewCount: string;
  postCount: string;
  trend: TrendDirection;
  region: RegionTarget;
  suggestedPrompt: string;
}

// ─── Video Generation ─────────────────────────────────────────────────────────

export type VideoResolution = '480p' | '720p' | '1080p' | '2K';
export type VideoModel = 'seedance-2.0' | 'seedance-1.5-pro';
export type JobStatus = 'idle' | 'pending' | 'generating' | 'completed' | 'failed';

export interface VideoJob {
  id: string;
  topic: TrendingTopic;
  prompt: string;
  negativePrompt?: string;
  model: VideoModel;
  resolution: VideoResolution;
  duration: number; // seconds
  status: JobStatus;
  progress: number; // 0–100
  videoUrl?: string;
  thumbnailUrl?: string;
  generatedAt?: string;
  costEstimate?: string;
}

// ─── SEO & Tags ───────────────────────────────────────────────────────────────

export interface SEOData {
  caption: string;
  hashtags: string[];
  suggestedPostTime: string;
  expectedReach: string;
  keywords: string[];
  sentiment: 'positive' | 'neutral' | 'trending';
  abVariants: Array<{ caption: string; hashtags: string[]; label: string }>;
}

// ─── Publishing ───────────────────────────────────────────────────────────────

export type PostStatus = 'uploading' | 'processing' | 'published' | 'failed' | 'draft';

export interface PublishedPost {
  id: string;
  videoJobId: string;
  tiktokPostId: string;
  status: PostStatus;
  publishedAt?: string;
  postUrl?: string;
  caption: string;
  hashtags: string[];
  privacyLevel: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface VideoAnalytics {
  postId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watchTimeAvg: number;   // seconds
  completionRate: number; // 0–100
  engagementRate: number; // 0–100
  peakHour: string;
  audienceRegions: Array<{ region: string; pct: number }>;
  insights: string[];
  nextTopicHint?: string;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export type StageStatus = 'idle' | 'running' | 'completed' | 'error';

export interface PipelineStage {
  status: StageStatus;
  progress: number; // 0–100
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface PipelineRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  stages: [PipelineStage, PipelineStage, PipelineStage, PipelineStage, PipelineStage];
  selectedTopic?: TrendingTopic;
  videoJob?: VideoJob;
  seoData?: SEOData;
  publishedPost?: PublishedPost;
  analytics?: VideoAnalytics;
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  stage: string;
  message: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────

export interface AppConfig {
  seedanceApiKey: string;
  volcengineApiKey: string;
  tiktokClientKey: string;
  tiktokAccessToken: string;
  targetRegion: RegionTarget;
  videoResolution: VideoResolution;
  videoDuration: 5 | 8 | 12 | 15;
  autoRun: boolean;
  runIntervalHours: number;
  postPrivacy: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
}

// ─── App Stats ────────────────────────────────────────────────────────────────

export interface AgentStats {
  totalRuns: number;
  totalVideos: number;
  totalViews: string;
  totalLikes: string;
  avgEngagement: string;
  topPerformingTag: string;
}
