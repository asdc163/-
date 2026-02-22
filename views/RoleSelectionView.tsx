
// TrendingView — repurposed from RoleSelectionView
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { TrendingTopic, TopicCategory, RegionTarget, TrendDirection } from '../types';
import { BottomNav } from './DashboardView';

const categoryLabel: Record<TopicCategory, string> = {
  entertainment: '娛樂', tech: '科技', food: '美食',
  fashion: '時尚', fitness: '健身', travel: '旅遊',
  news: '新聞', gaming: '遊戲',
};

const trendIcon: Record<TrendDirection, string> = {
  rising: '↑', stable: '→', falling: '↓',
};
const trendColor: Record<TrendDirection, string> = {
  rising: '#00D85B', stable: '#888', falling: '#FF4444',
};

const regionColors: Record<RegionTarget, string> = {
  CN: '#FE2C55', Global: '#25F4EE', TW: '#8B5CF6',
};

const ALL_CATS: (TopicCategory | 'all')[] = ['all', 'entertainment', 'tech', 'food', 'fashion', 'fitness', 'travel', 'gaming'];

const HeatBar: React.FC<{ score: number }> = ({ score }) => (
  <div className="flex items-center gap-1.5">
    <div className="flex-1 h-1 bg-tt-border rounded-full overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${score}%`,
          background: score >= 90 ? 'linear-gradient(90deg,#FF7A00,#FE2C55)' :
                     score >= 75 ? 'linear-gradient(90deg,#FFD60A,#FF7A00)' :
                     'linear-gradient(90deg,#555,#888)',
        }}
      />
    </div>
    <span className="text-[10px] font-bold font-mono" style={{
      color: score >= 90 ? '#FE2C55' : score >= 75 ? '#FFD60A' : '#888'
    }}>{score}</span>
  </div>
);

const TopicCard: React.FC<{ topic: TrendingTopic }> = ({ topic }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="bg-tt-surface border border-tt-border rounded-xl p-4 transition-all duration-200 cursor-pointer active:scale-[0.99]"
      style={{
        borderColor: topic.heatScore >= 90 ? 'rgba(254,44,85,0.3)' : '#2a2a2a',
        boxShadow: topic.heatScore >= 90 ? '0 0 12px rgba(254,44,85,0.1)' : 'none',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        {/* heat rank indicator */}
        <div
          className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-lg font-black"
          style={{
            background: topic.heatScore >= 90
              ? 'linear-gradient(135deg,#FF7A00,#FE2C55)'
              : topic.heatScore >= 80
              ? 'rgba(255,122,0,0.15)'
              : '#1e1e1e',
            color: topic.heatScore >= 80 ? '#FF7A00' : '#555',
          }}
        >
          {topic.heatScore >= 90 ? '🔥' : topic.heatScore >= 80 ? '⚡' : '○'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white truncate">{topic.tag}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{
                background: `${regionColors[topic.region]}20`,
                color: regionColors[topic.region],
              }}
            >
              {topic.region}
            </span>
            <span
              className="text-[10px] font-bold"
              style={{ color: trendColor[topic.trend] }}
            >
              {trendIcon[topic.trend]} {topic.trend === 'rising' ? '上升' : topic.trend === 'stable' ? '穩定' : '下降'}
            </span>
          </div>

          <div className="text-xs text-tt-muted mt-0.5">{topic.title}</div>

          <div className="mt-2">
            <HeatBar score={topic.heatScore} />
          </div>

          <div className="flex items-center gap-3 mt-2 text-[10px] text-tt-dim font-mono">
            <span>👁 {topic.viewCount}</span>
            <span>📝 {topic.postCount}</span>
            <span className="text-tt-border2">|</span>
            <span
              className="px-1.5 py-0.5 rounded text-[9px]"
              style={{ background: '#1e1e1e', color: '#888' }}
            >
              {categoryLabel[topic.category]}
            </span>
          </div>
        </div>

        <span className="text-tt-dim text-xs ml-2">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* expanded: suggested prompt */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-tt-border/50">
          <div className="text-[10px] text-tt-dim mb-1">AI 生成提示詞建議</div>
          <div
            className="text-xs text-tt-muted bg-tt-card rounded-lg px-3 py-2 leading-relaxed font-mono"
            style={{ fontSize: '11px' }}
          >
            "{topic.suggestedPrompt}"
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const TrendingView: React.FC = () => {
  const { topics } = useApp();
  const [activeRegion, setActiveRegion] = useState<RegionTarget | 'All'>('All');
  const [activeCat, setActiveCat] = useState<TopicCategory | 'all'>('all');

  const filtered = topics.filter(t => {
    const regionOk = activeRegion === 'All' || t.region === activeRegion;
    const catOk = activeCat === 'all' || t.category === activeCat;
    return regionOk && catOk;
  }).sort((a, b) => b.heatScore - a.heatScore);

  const regions: (RegionTarget | 'All')[] = ['All', 'Global', 'CN', 'TW'];

  return (
    <div className="min-h-screen bg-tt-bg pb-20">

      {/* header */}
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-xl font-black text-white font-display">🔥 熱門趨勢</h1>
        <p className="text-tt-muted text-xs mt-0.5">即時掃描抖音 / TikTok 熱門話題</p>
      </div>

      {/* region filter */}
      <div className="px-4 flex gap-2 mb-3">
        {regions.map(r => (
          <button
            key={r}
            onClick={() => setActiveRegion(r)}
            className="px-3 py-1 rounded-full text-xs font-bold transition-all"
            style={{
              background: activeRegion === r
                ? r === 'All' ? '#FE2C55' : regionColors[r as RegionTarget]
                : '#1e1e1e',
              color: activeRegion === r ? '#fff' : '#555',
              border: `1px solid ${activeRegion === r ? 'transparent' : '#2a2a2a'}`,
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* category pills */}
      <div className="px-4 mb-4 overflow-x-auto">
        <div className="flex gap-2" style={{ width: 'max-content' }}>
          {ALL_CATS.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap"
              style={{
                background: activeCat === cat ? 'rgba(254,44,85,0.15)' : '#1e1e1e',
                color: activeCat === cat ? '#FE2C55' : '#555',
                border: `1px solid ${activeCat === cat ? 'rgba(254,44,85,0.3)' : '#2a2a2a'}`,
              }}
            >
              {cat === 'all' ? '全部' : categoryLabel[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* topic count */}
      <div className="px-4 mb-3">
        <span className="text-[10px] text-tt-dim font-mono">{filtered.length} 個話題</span>
      </div>

      {/* topic list */}
      <div className="px-4 space-y-3">
        {filtered.map(topic => (
          <TopicCard key={topic.id} topic={topic} />
        ))}
      </div>

      {/* API note */}
      <div className="mx-4 mt-4 p-3 rounded-xl border border-tt-border/50 bg-tt-surface/50">
        <div className="text-[10px] text-tt-dim leading-relaxed">
          <span className="text-tt-muted font-medium">API 整合：</span>
          {' '}正式版接入 TikTok Research API、Trending Content API 及 Hashtag Analytics API
          進行即時熱度分析。需於 TikTok for Developers 申請 Research API 存取。
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default TrendingView;
