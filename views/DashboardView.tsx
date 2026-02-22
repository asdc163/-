
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../App';
import { PipelineStage, LogEntry, LogLevel, StageStatus } from '../types';

// ─── Shared Bottom Nav ────────────────────────────────────────────────────────

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = [
    { path: '/dashboard', icon: '⬡', label: '控制台' },
    { path: '/trending',  icon: '🔥', label: '趨勢' },
    { path: '/generate',  icon: '🎬', label: '生成' },
    { path: '/analytics', icon: '📊', label: '分析' },
    { path: '/settings',  icon: '⚙️', label: '設定' },
  ];
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-tt-surface border-t border-tt-border z-50">
      <div className="flex">
        {tabs.map(tab => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors"
              style={{ color: active ? '#FE2C55' : '#555' }}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
              {active && (
                <div className="w-4 h-0.5 rounded-full mt-0.5" style={{ background: '#FE2C55' }} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

// ─── Stage Definitions ────────────────────────────────────────────────────────

const STAGE_DEFS = [
  { label: '趨勢探索', icon: '🔥', key: 'trending' },
  { label: 'AI 生成',  icon: '🎬', key: 'generation' },
  { label: 'SEO 優化', icon: '🏷',  key: 'seo' },
  { label: '自動發布', icon: '📤', key: 'publish' },
  { label: '流量回饋', icon: '📊', key: 'analytics' },
];

const stageColor: Record<StageStatus, string> = {
  idle:      '#333',
  running:   '#FE2C55',
  completed: '#00D85B',
  error:     '#FF4444',
};

const stageBg: Record<StageStatus, string> = {
  idle:      '#1e1e1e',
  running:   'rgba(254,44,85,0.12)',
  completed: 'rgba(0,216,91,0.10)',
  error:     'rgba(255,68,68,0.12)',
};

// ─── Log Entry Row ────────────────────────────────────────────────────────────

const levelColor: Record<LogLevel, string> = {
  info:    '#888',
  success: '#00D85B',
  warning: '#FFB800',
  error:   '#FF4444',
};

const LogRow: React.FC<{ entry: LogEntry }> = ({ entry }) => (
  <div className="flex gap-2 items-start py-1.5 border-b border-tt-border/40 animate-fade-in-up">
    <span className="text-tt-dim font-mono text-[10px] mt-0.5 shrink-0">{entry.timestamp}</span>
    <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-1.5"
      style={{ background: levelColor[entry.level] }} />
    <span className="text-xs font-mono" style={{ color: levelColor[entry.level] }}>
      [{entry.stage}]
    </span>
    <span className="text-xs text-tt-muted flex-1">{entry.message}</span>
  </div>
);

// ─── Dashboard View ───────────────────────────────────────────────────────────

const DashboardView: React.FC = () => {
  const { pipeline, logs, stats, isRunning, runPipeline, resetPipeline } = useApp();

  const stages: PipelineStage[] = pipeline?.stages ?? [
    { status: 'idle', progress: 0 },
    { status: 'idle', progress: 0 },
    { status: 'idle', progress: 0 },
    { status: 'idle', progress: 0 },
    { status: 'idle', progress: 0 },
  ];

  const completedCount = stages.filter(s => s.status === 'completed').length;
  const overallProgress = pipeline ? Math.round((completedCount / 5) * 100) : 0;

  const agentStatus = isRunning
    ? { label: '執行中', color: '#FE2C55', dot: 'animate-pulse' }
    : pipeline?.completedAt
    ? { label: '已完成', color: '#00D85B', dot: '' }
    : { label: '待機中', color: '#555', dot: '' };

  return (
    <div className="min-h-screen bg-tt-bg pb-20">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-4 pt-12 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white tracking-wide font-display">SEEDANCE AGENT</h1>
          <p className="text-tt-muted text-xs mt-0.5">抖音 AI 自動化內容代理</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-tt-surface border border-tt-border">
          <span
            className={`w-2 h-2 rounded-full ${agentStatus.dot}`}
            style={{ background: agentStatus.color }}
          />
          <span className="text-xs font-medium" style={{ color: agentStatus.color }}>
            {agentStatus.label}
          </span>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* ── Stats Row ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '總執行', value: stats.totalRuns.toString(), unit: '次' },
            { label: '影片數', value: stats.totalVideos.toString(), unit: '支' },
            { label: '總觀看', value: stats.totalViews, unit: '' },
          ].map(s => (
            <div key={s.label} className="bg-tt-surface border border-tt-border rounded-xl p-3 text-center">
              <div className="text-lg font-black text-white">
                {s.value}<span className="text-xs text-tt-muted ml-0.5">{s.unit}</span>
              </div>
              <div className="text-[10px] text-tt-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Pipeline Stages ────────────────────────────────── */}
        <div className="bg-tt-surface border border-tt-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-white">流水線進度</span>
            {pipeline && (
              <span className="text-xs font-mono text-tt-muted">{overallProgress}%</span>
            )}
          </div>

          {/* stage nodes */}
          <div className="flex items-center gap-1 mb-3">
            {STAGE_DEFS.map((def, i) => {
              const stage = stages[i];
              const color = stageColor[stage.status];
              const bg = stageBg[stage.status];
              return (
                <React.Fragment key={def.key}>
                  <div
                    className="flex-shrink-0 flex flex-col items-center gap-1 rounded-xl px-2 py-2 transition-all duration-300"
                    style={{
                      background: bg,
                      border: `1px solid ${color}40`,
                      minWidth: 52,
                      boxShadow: stage.status === 'running'
                        ? `0 0 12px ${color}40`
                        : stage.status === 'completed'
                        ? `0 0 8px ${color}20`
                        : 'none',
                    }}
                  >
                    <span className="text-base leading-none">{def.icon}</span>
                    <span className="text-[9px] text-center leading-tight font-medium"
                      style={{ color }}>{def.label}</span>
                    <div className="flex items-center gap-1">
                      {stage.status === 'running' && (
                        <span className="text-[8px] font-mono animate-pulse" style={{ color }}>
                          {stage.progress}%
                        </span>
                      )}
                      {stage.status === 'completed' && <span className="text-[10px]">✓</span>}
                      {stage.status === 'idle' && (
                        <span className="text-[8px]" style={{ color: '#444' }}>–</span>
                      )}
                    </div>
                  </div>
                  {i < 4 && (
                    <div className="flex-1 h-px" style={{
                      background: stages[i].status === 'completed'
                        ? 'linear-gradient(90deg, #00D85B, #555)'
                        : '#2a2a2a'
                    }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* overall progress bar */}
          {pipeline && (
            <div className="h-1.5 bg-tt-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${overallProgress}%`,
                  background: isRunning
                    ? 'linear-gradient(90deg, #FE2C55, #8B5CF6, #25F4EE)'
                    : overallProgress === 100
                    ? '#00D85B'
                    : '#8B5CF6',
                }}
              />
            </div>
          )}

          {/* current topic */}
          {pipeline?.selectedTopic && (
            <div className="mt-3 flex items-center gap-2 bg-tt-card rounded-lg px-3 py-2">
              <span className="text-base">🔥</span>
              <div>
                <div className="text-xs font-bold text-white">{pipeline.selectedTopic.tag}</div>
                <div className="text-[10px] text-tt-muted">{pipeline.selectedTopic.title}</div>
              </div>
              <div className="ml-auto text-xs font-bold" style={{ color: '#FF7A00' }}>
                {pipeline.selectedTopic.heatScore}
              </div>
            </div>
          )}
        </div>

        {/* ── Control Buttons ────────────────────────────────── */}
        <div className="flex gap-3">
          <button
            onClick={runPipeline}
            disabled={isRunning}
            className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-200 active:scale-95"
            style={{
              background: isRunning
                ? 'rgba(254,44,85,0.3)'
                : 'linear-gradient(135deg, #FE2C55, #8B5CF6)',
              boxShadow: isRunning ? 'none' : '0 0 20px rgba(254,44,85,0.35)',
              opacity: isRunning ? 0.7 : 1,
            }}
          >
            {isRunning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />
                執行中...
              </span>
            ) : (
              '▶  執行流水線'
            )}
          </button>
          <button
            onClick={resetPipeline}
            disabled={isRunning}
            className="px-4 py-3.5 rounded-xl font-bold text-sm border border-tt-border text-tt-muted transition-all active:scale-95"
            style={{ opacity: isRunning ? 0.4 : 1 }}
          >
            ↺ 重置
          </button>
        </div>

        {/* ── Latest Result ─────────────────────────────────── */}
        {pipeline?.analytics && (
          <div className="bg-tt-surface border border-tt-border rounded-2xl p-4">
            <div className="text-sm font-bold text-white mb-3">最新發布成效</div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '觀看', value: pipeline.analytics.views.toLocaleString(), color: '#25F4EE' },
                { label: '按讚', value: pipeline.analytics.likes.toLocaleString(), color: '#FE2C55' },
                { label: '分享', value: pipeline.analytics.shares.toLocaleString(), color: '#8B5CF6' },
                { label: '互動率', value: `${pipeline.analytics.engagementRate}%`, color: '#00D85B' },
              ].map(m => (
                <div key={m.label} className="text-center">
                  <div className="text-sm font-black" style={{ color: m.color }}>{m.value}</div>
                  <div className="text-[10px] text-tt-muted">{m.label}</div>
                </div>
              ))}
            </div>
            {pipeline.analytics.insights[0] && (
              <div className="mt-3 text-[11px] text-tt-muted bg-tt-card rounded-lg px-3 py-2 leading-relaxed">
                💡 {pipeline.analytics.insights[0]}
              </div>
            )}
          </div>
        )}

        {/* ── Activity Log ──────────────────────────────────── */}
        <div className="bg-tt-surface border border-tt-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-white">活動紀錄</span>
            <span className="text-[10px] text-tt-dim font-mono">{logs.length} 條</span>
          </div>
          <div className="max-h-52 overflow-y-auto space-y-0">
            {logs.length === 0 ? (
              <div className="text-center py-6 text-tt-dim text-xs">
                點擊「執行流水線」開始自動化代理...
              </div>
            ) : (
              logs.slice(0, 15).map(entry => <LogRow key={entry.id} entry={entry} />)
            )}
          </div>
        </div>

        {/* ── Quick Stats ───────────────────────────────────── */}
        <div className="bg-tt-surface border border-tt-border rounded-2xl p-4">
          <div className="text-sm font-bold text-white mb-3">歷史表現</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '平均互動率', value: stats.avgEngagement, color: '#00D85B' },
              { label: '總按讚數', value: stats.totalLikes, color: '#FE2C55' },
              { label: '最佳話題', value: stats.topPerformingTag, color: '#FFD60A', small: true },
              { label: '總觀看', value: stats.totalViews, color: '#25F4EE' },
            ].map(s => (
              <div key={s.label} className="bg-tt-card rounded-xl p-3">
                <div
                  className="font-black"
                  style={{ color: s.color, fontSize: s.small ? '11px' : '18px' }}
                >
                  {s.value}
                </div>
                <div className="text-[10px] text-tt-muted mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  );
};

export default DashboardView;
