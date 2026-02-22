
// GenerationView — repurposed from RegisterView
import React from 'react';
import { useApp } from '../App';
import { BottomNav } from './DashboardView';
import { VideoJob, VideoResolution } from '../types';

const resolutionLabel: Record<VideoResolution, string> = {
  '480p': '480p SD', '720p': '720p HD', '1080p': '1080p FHD', '2K': '2K QHD',
};

const ModelBadge: React.FC = () => (
  <div
    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
    style={{ background: 'rgba(139,92,246,0.2)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.3)' }}
  >
    <span>✦</span> Seedance 2.0
  </div>
);

const ProgressRing: React.FC<{ progress: number }> = ({ progress }) => {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress / 100);
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#2a2a2a" strokeWidth="4" />
      <circle
        cx="40" cy="40" r={r} fill="none"
        stroke="url(#grad)" strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 40 40)"
        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
      />
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FE2C55" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <text x="40" y="44" textAnchor="middle" fill="white"
        fontSize="13" fontWeight="bold" fontFamily="monospace">
        {progress}%
      </text>
    </svg>
  );
};

const JobCard: React.FC<{ job: VideoJob; isActive?: boolean }> = ({ job, isActive }) => (
  <div
    className="bg-tt-surface border rounded-xl p-4 transition-all duration-300"
    style={{
      borderColor: isActive ? 'rgba(254,44,85,0.4)' : '#2a2a2a',
      boxShadow: isActive ? '0 0 16px rgba(254,44,85,0.15)' : 'none',
    }}
  >
    <div className="flex items-start gap-3">
      {/* thumbnail placeholder */}
      <div
        className="w-16 h-12 rounded-lg flex-shrink-0 flex items-center justify-center text-xl relative overflow-hidden"
        style={{
          background: isActive
            ? 'linear-gradient(135deg, rgba(254,44,85,0.2), rgba(139,92,246,0.2))'
            : '#1e1e1e',
          border: `1px solid ${isActive ? 'rgba(254,44,85,0.3)' : '#2a2a2a'}`,
        }}
      >
        {job.status === 'generating' ? (
          <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
        ) : job.status === 'completed' ? (
          <span>🎬</span>
        ) : (
          <span style={{ color: '#444' }}>▷</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-white truncate">{job.topic.tag}</span>
          <ModelBadge />
        </div>
        <div className="text-[10px] text-tt-muted mt-0.5 font-mono">
          {resolutionLabel[job.resolution]} · {job.duration}s
        </div>
        {job.status === 'completed' && job.costEstimate && (
          <div className="text-[10px] mt-1" style={{ color: '#00D85B' }}>
            ✓ 完成 · 費用 {job.costEstimate}
          </div>
        )}
        {job.generatedAt && (
          <div className="text-[10px] text-tt-dim mt-0.5">{job.generatedAt}</div>
        )}
      </div>

      {/* status indicator */}
      <div>
        {job.status === 'generating' && (
          <span className="text-[10px] font-mono animate-pulse" style={{ color: '#FE2C55' }}>
            {job.progress}%
          </span>
        )}
        {job.status === 'completed' && (
          <span className="text-[12px]" style={{ color: '#00D85B' }}>✓</span>
        )}
        {job.status === 'failed' && (
          <span className="text-[12px]" style={{ color: '#FF4444' }}>✗</span>
        )}
      </div>
    </div>

    {/* progress bar for active job */}
    {job.status === 'generating' && (
      <div className="mt-3 h-1 bg-tt-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${job.progress}%`,
            background: 'linear-gradient(90deg, #FE2C55, #8B5CF6)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    )}

    {/* prompt preview */}
    {job.status === 'generating' && (
      <div className="mt-2 text-[10px] text-tt-dim font-mono leading-relaxed">
        "{job.prompt.slice(0, 80)}..."
      </div>
    )}
  </div>
);

// ─── Generation Capabilities Panel ───────────────────────────────────────────

const CapabilityPanel: React.FC = () => {
  const caps = [
    { icon: '📝', label: '文字生成影片', desc: 'Text-to-Video', color: '#8B5CF6' },
    { icon: '🖼', label: '圖片生成影片', desc: 'Image-to-Video', color: '#25F4EE' },
    { icon: '🎵', label: '原生音訊合成', desc: '8+ 語言聲音同步', color: '#00D85B' },
    { icon: '🎞', label: '多模態輸入', desc: '文字+圖片+影片+音訊', color: '#FFD60A' },
    { icon: '🔮', label: '最高 2K 解析度', desc: '480p – 2K', color: '#FE2C55' },
    { icon: '⚡', label: '快速生成', desc: '4–15 秒影片', color: '#FF7A00' },
  ];
  return (
    <div className="bg-tt-surface border border-tt-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <ModelBadge />
        <span className="text-sm font-bold text-white">模型能力</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {caps.map(c => (
          <div key={c.label} className="bg-tt-card rounded-xl px-3 py-2.5 flex items-start gap-2">
            <span className="text-base">{c.icon}</span>
            <div>
              <div className="text-[11px] font-bold text-white">{c.label}</div>
              <div className="text-[9px] text-tt-muted">{c.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const GenerationView: React.FC = () => {
  const { pipeline, isRunning } = useApp();
  const job = pipeline?.videoJob;

  const hasJob = !!job;

  return (
    <div className="min-h-screen bg-tt-bg pb-20">

      {/* header */}
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-xl font-black text-white font-display">🎬 影片生成</h1>
        <p className="text-tt-muted text-xs mt-0.5">Seedance 2.0 AI 影片生成引擎</p>
      </div>

      <div className="px-4 space-y-4">

        {/* active job */}
        {hasJob && (
          <div>
            <div className="text-xs font-bold text-tt-muted mb-2 uppercase tracking-wider">
              {job.status === 'generating' ? '生成中' : '最新任務'}
            </div>

            {job.status === 'generating' ? (
              /* large progress display */
              <div
                className="bg-tt-surface border rounded-2xl p-6 flex flex-col items-center gap-4"
                style={{ borderColor: 'rgba(254,44,85,0.35)', boxShadow: '0 0 24px rgba(254,44,85,0.12)' }}
              >
                <ProgressRing progress={job.progress} />
                <div className="text-center">
                  <div className="text-sm font-bold text-white">{job.topic.tag}</div>
                  <div className="text-xs text-tt-muted mt-1">
                    {resolutionLabel[job.resolution]} · {job.duration}s · Seedance 2.0
                  </div>
                </div>
                <div className="w-full">
                  <div className="text-[10px] text-tt-dim mb-1 font-mono">提示詞</div>
                  <div
                    className="text-[10px] text-tt-muted bg-tt-card rounded-lg px-3 py-2 leading-relaxed font-mono"
                    style={{ maxHeight: 60, overflow: 'hidden' }}
                  >
                    {job.prompt}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#FE2C55' }} />
                  <span className="text-[11px] text-tt-muted animate-pulse">正在渲染影片幀...</span>
                </div>
              </div>
            ) : (
              <JobCard job={job} isActive={job.status === 'completed'} />
            )}
          </div>
        )}

        {!hasJob && !isRunning && (
          <div className="bg-tt-surface border border-tt-border rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">🎬</div>
            <div className="text-sm font-bold text-white mb-1">尚未有生成任務</div>
            <div className="text-xs text-tt-muted">返回控制台執行流水線以開始生成</div>
          </div>
        )}

        {/* SEO preview if completed */}
        {pipeline?.seoData && (
          <div className="bg-tt-surface border border-tt-border rounded-2xl p-4">
            <div className="text-xs font-bold text-tt-muted mb-2 uppercase tracking-wider">SEO 優化結果</div>
            <div className="text-xs text-tt-muted leading-relaxed mb-2">{pipeline.seoData.caption}</div>
            <div className="flex flex-wrap gap-1">
              {pipeline.seoData.hashtags.map(h => (
                <span
                  key={h}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(254,44,85,0.12)', color: '#FE2C55' }}
                >
                  {h}
                </span>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-tt-dim">
              <span>⏰ 最佳發布: {pipeline.seoData.suggestedPostTime}</span>
              <span>📈 {pipeline.seoData.expectedReach}</span>
            </div>
          </div>
        )}

        {/* published post */}
        {pipeline?.publishedPost && (
          <div
            className="border rounded-2xl p-4"
            style={{
              background: 'rgba(0,216,91,0.06)',
              borderColor: 'rgba(0,216,91,0.25)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: '#00D85B' }}>✓</span>
              <span className="text-xs font-bold" style={{ color: '#00D85B' }}>已發布至抖音</span>
            </div>
            <div className="text-[10px] text-tt-muted font-mono">
              ID: {pipeline.publishedPost.tiktokPostId.slice(0, 28)}...
            </div>
            <div className="text-[10px] text-tt-dim mt-0.5">
              {pipeline.publishedPost.publishedAt} · {pipeline.publishedPost.privacyLevel}
            </div>
          </div>
        )}

        {/* Seedance 2.0 capabilities */}
        <CapabilityPanel />

        {/* API integration info */}
        <div className="bg-tt-surface border border-tt-border rounded-xl p-4">
          <div className="text-xs font-bold text-white mb-2">API 整合說明</div>
          <div className="space-y-2 text-[10px] text-tt-muted leading-relaxed">
            <div className="flex gap-2">
              <span style={{ color: '#8B5CF6' }}>①</span>
              <span>透過 Volcengine ARK 平台接入（預計 2026/2/24 正式上線）</span>
            </div>
            <div className="flex gap-2">
              <span style={{ color: '#8B5CF6' }}>②</span>
              <span>支援第三方 API 代理（如 APIYI、AIFreeAPI）立即使用</span>
            </div>
            <div className="flex gap-2">
              <span style={{ color: '#8B5CF6' }}>③</span>
              <span>定價約 $0.10–$0.80/分鐘（依解析度）</span>
            </div>
            <div className="flex gap-2">
              <span style={{ color: '#8B5CF6' }}>④</span>
              <span>非同步任務，支援 Webhook 通知完成</span>
            </div>
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  );
};

export default GenerationView;
