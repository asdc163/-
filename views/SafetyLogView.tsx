
// AnalyticsView — repurposed from SafetyLogView
import React, { useState } from 'react';
import { useApp } from '../App';
import { BottomNav } from './DashboardView';
import { VideoAnalytics } from '../types';

// ─── Components ───────────────────────────────────────────────────────────────

const MetricCard: React.FC<{
  icon: string; label: string; value: string; sub?: string; color: string;
}> = ({ icon, label, value, sub, color }) => (
  <div className="bg-tt-surface border border-tt-border rounded-xl p-3.5">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-base">{icon}</span>
      <span className="text-[10px] text-tt-muted">{label}</span>
    </div>
    <div className="text-xl font-black" style={{ color }}>{value}</div>
    {sub && <div className="text-[10px] text-tt-dim mt-0.5">{sub}</div>}
  </div>
);

const RegionBar: React.FC<{ region: string; pct: number }> = ({ region, pct }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-tt-muted w-16 shrink-0">{region}</span>
    <div className="flex-1 h-1.5 bg-tt-border rounded-full overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #FE2C55, #8B5CF6)',
          transition: 'width 1s ease',
        }}
      />
    </div>
    <span className="text-xs font-mono text-tt-muted w-8 text-right">{pct}%</span>
  </div>
);

const EngagementChart: React.FC<{ rate: number; completion: number }> = ({ rate, completion }) => {
  const bars = [
    { label: '互動率', value: rate, max: 20, color: '#FE2C55', unit: '%' },
    { label: '完播率', value: completion, max: 100, color: '#25F4EE', unit: '%' },
  ];
  return (
    <div className="space-y-3">
      {bars.map(b => (
        <div key={b.label}>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-tt-muted">{b.label}</span>
            <span className="font-mono font-bold" style={{ color: b.color }}>
              {b.value}{b.unit}
            </span>
          </div>
          <div className="h-2 bg-tt-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(b.value / b.max) * 100}%`,
                background: b.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Historical Mock Data ─────────────────────────────────────────────────────

interface HistoricalPost {
  tag: string; views: string; likes: string; date: string;
  engagement: string; status: 'growing' | 'peaked' | 'declining';
}

const HISTORY: HistoricalPost[] = [
  { tag: '#AI生成影片', views: '128K', likes: '9.8K', date: '今天', engagement: '12.1%', status: 'growing' },
  { tag: '#春節舞蹈挑戰', views: '87K', likes: '6.3K', date: '昨天', engagement: '9.4%', status: 'peaked' },
  { tag: '#奶茶新品測評', views: '64K', likes: '4.1K', date: '2天前', engagement: '7.8%', status: 'declining' },
  { tag: '#職場穿搭OOTD', views: '42K', likes: '2.9K', date: '3天前', engagement: '6.2%', status: 'declining' },
];

const statusConfig = {
  growing:   { label: '成長中', color: '#00D85B', icon: '↑' },
  peaked:    { label: '峰值',   color: '#FFB800', icon: '→' },
  declining: { label: '下降',   color: '#FF4444', icon: '↓' },
};

// ─── Main View ────────────────────────────────────────────────────────────────

const AnalyticsView: React.FC = () => {
  const { pipeline, stats } = useApp();
  const analytics: VideoAnalytics | null = pipeline?.analytics ?? null;
  const [tab, setTab] = useState<'current' | 'history'>('current');

  return (
    <div className="min-h-screen bg-tt-bg pb-20">

      {/* header */}
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-xl font-black text-white font-display">📊 流量分析</h1>
        <p className="text-tt-muted text-xs mt-0.5">影片表現與回饋優化</p>
      </div>

      {/* tab toggle */}
      <div className="px-4 mb-4 flex gap-1 bg-tt-surface border border-tt-border rounded-xl p-1 mx-4">
        {[
          { key: 'current', label: '最新影片' },
          { key: 'history', label: '歷史紀錄' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: tab === t.key ? '#FE2C55' : 'transparent',
              color: tab === t.key ? '#fff' : '#555',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-4">

        {tab === 'current' && (
          <>
            {analytics ? (
              <>
                {/* key metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <MetricCard icon="👁" label="觀看次數" value={analytics.views.toLocaleString()} color="#25F4EE" />
                  <MetricCard icon="❤️" label="按讚數" value={analytics.likes.toLocaleString()} color="#FE2C55" />
                  <MetricCard icon="💬" label="留言數" value={analytics.comments.toLocaleString()} color="#8B5CF6" />
                  <MetricCard icon="↗️" label="分享數" value={analytics.shares.toLocaleString()} color="#FFD60A" />
                </div>

                {/* watch metrics */}
                <div className="bg-tt-surface border border-tt-border rounded-2xl p-4">
                  <div className="text-xs font-bold text-white mb-3">互動品質</div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-black" style={{ color: '#25F4EE' }}>
                        {analytics.watchTimeAvg}s
                      </div>
                      <div className="text-[9px] text-tt-muted">平均觀看時長</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-black" style={{ color: '#00D85B' }}>
                        {analytics.completionRate}%
                      </div>
                      <div className="text-[9px] text-tt-muted">完播率</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-black" style={{ color: '#FE2C55' }}>
                        {analytics.engagementRate}%
                      </div>
                      <div className="text-[9px] text-tt-muted">互動率</div>
                    </div>
                  </div>
                  <EngagementChart
                    rate={analytics.engagementRate}
                    completion={analytics.completionRate}
                  />
                </div>

                {/* audience regions */}
                <div className="bg-tt-surface border border-tt-border rounded-2xl p-4">
                  <div className="text-xs font-bold text-white mb-3">受眾地區分布</div>
                  <div className="space-y-2.5">
                    {analytics.audienceRegions.map(r => (
                      <RegionBar key={r.region} region={r.region} pct={r.pct} />
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-tt-dim">
                    ⏰ 峰值時段: {analytics.peakHour}
                  </div>
                </div>

                {/* AI insights */}
                <div className="bg-tt-surface border border-tt-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                      style={{ background: 'rgba(139,92,246,0.2)', color: '#8B5CF6' }}
                    >✦ AI 洞察</span>
                  </div>
                  <div className="space-y-2">
                    {analytics.insights.map((insight, i) => (
                      <div key={i} className="flex gap-2 text-xs text-tt-muted leading-relaxed">
                        <span className="mt-0.5" style={{ color: '#8B5CF6' }}>›</span>
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                  {analytics.nextTopicHint && (
                    <div
                      className="mt-3 p-3 rounded-xl text-xs"
                      style={{ background: 'rgba(254,44,85,0.08)', border: '1px solid rgba(254,44,85,0.2)' }}
                    >
                      <div className="text-[10px] text-tt-dim mb-1">下一輪建議話題</div>
                      <div className="font-bold" style={{ color: '#FE2C55' }}>
                        {analytics.nextTopicHint}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-tt-surface border border-tt-border rounded-2xl p-10 text-center">
                <div className="text-4xl mb-3">📊</div>
                <div className="text-sm font-bold text-white mb-1">尚無分析數據</div>
                <div className="text-xs text-tt-muted">執行完整流水線後，AI 將自動分析影片表現</div>
              </div>
            )}

            {/* overall stats */}
            <div className="bg-tt-surface border border-tt-border rounded-2xl p-4">
              <div className="text-xs font-bold text-white mb-3">帳號整體表現</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '累計觀看', value: stats.totalViews, color: '#25F4EE' },
                  { label: '累計按讚', value: stats.totalLikes, color: '#FE2C55' },
                  { label: '平均互動率', value: stats.avgEngagement, color: '#00D85B' },
                  { label: '最佳標籤', value: stats.topPerformingTag, color: '#FFD60A', small: true },
                ].map(s => (
                  <div key={s.label} className="bg-tt-card rounded-xl p-3">
                    <div
                      className="font-black"
                      style={{ color: s.color, fontSize: (s as any).small ? '10px' : '18px' }}
                    >
                      {s.value}
                    </div>
                    <div className="text-[10px] text-tt-muted mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'history' && (
          <div className="space-y-3">
            {HISTORY.map((post, i) => {
              const sc = statusConfig[post.status];
              return (
                <div key={i} className="bg-tt-surface border border-tt-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-white">{post.tag}</span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${sc.color}20`, color: sc.color }}
                    >
                      {sc.icon} {sc.label}
                    </span>
                  </div>
                  <div className="flex gap-4 text-[10px] font-mono">
                    <span style={{ color: '#25F4EE' }}>👁 {post.views}</span>
                    <span style={{ color: '#FE2C55' }}>❤ {post.likes}</span>
                    <span style={{ color: '#00D85B' }}>互動 {post.engagement}</span>
                    <span className="text-tt-dim ml-auto">{post.date}</span>
                  </div>
                </div>
              );
            })}

            {/* feedback loop note */}
            <div className="bg-tt-surface border border-tt-border rounded-xl p-4">
              <div className="text-xs font-bold text-white mb-2">回饋優化機制</div>
              <div className="space-y-1.5 text-[10px] text-tt-muted leading-relaxed">
                <div className="flex gap-2">
                  <span style={{ color: '#00D85B' }}>①</span>
                  <span>分析每支影片互動率、完播率、分享率</span>
                </div>
                <div className="flex gap-2">
                  <span style={{ color: '#25F4EE' }}>②</span>
                  <span>識別高效標籤組合，更新 SEO 權重矩陣</span>
                </div>
                <div className="flex gap-2">
                  <span style={{ color: '#8B5CF6' }}>③</span>
                  <span>調整最佳發布時段（依受眾活躍時間）</span>
                </div>
                <div className="flex gap-2">
                  <span style={{ color: '#FE2C55' }}>④</span>
                  <span>根據表現優先選取相似熱門話題</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
};

export default AnalyticsView;
