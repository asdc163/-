/**
 * GET /api/trending?region=Global|CN|TW
 *
 * Returns trending TikTok/Douyin topics.
 * Uses TikHub API if TIKHUB_API_KEY is set, otherwise returns mock data.
 *
 * TikHub docs: https://docs.tikhub.io/
 * Token: https://tikhub.io → User Center → API Token
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MOCK_TOPICS } from './_mock';

// Map TikHub Douyin hot-search item → our TrendingTopic shape
function mapDouyinItem(item: any, idx: number) {
  return {
    id: String(idx + 1),
    tag: `#${item.word ?? item.title ?? item.keyword ?? `熱搜${idx + 1}`}`,
    title: item.word ?? item.title ?? item.keyword ?? `熱搜話題 ${idx + 1}`,
    category: 'entertainment',
    heatScore: Math.max(10, 100 - idx * 8),
    viewCount: item.hot_value ? `${(item.hot_value / 1e8).toFixed(1)}億` : '未知',
    postCount: item.video_count ? `${(item.video_count / 1e4).toFixed(1)}萬` : '未知',
    trend: (idx < 3 ? 'rising' : idx < 6 ? 'stable' : 'falling') as 'rising' | 'stable' | 'falling',
    region: 'CN' as const,
    suggestedPrompt: `Cinematic video about ${item.word ?? 'trending topic'}, dramatic lighting, ultra-realistic`,
  };
}

// Map TikHub TikTok hashtag item → our TrendingTopic shape
function mapTikTokHashtag(item: any, idx: number) {
  const name = item.hashtag_name ?? item.name ?? `trend${idx + 1}`;
  return {
    id: String(idx + 1),
    tag: `#${name}`,
    title: name.replace(/_/g, ' '),
    category: 'entertainment',
    heatScore: Math.max(10, 100 - idx * 8),
    viewCount: item.view_count ? `${(Number(item.view_count) / 1e8).toFixed(1)}億` : '未知',
    postCount: item.video_count ? `${(Number(item.video_count) / 1e4).toFixed(1)}萬` : '未知',
    trend: (idx < 3 ? 'rising' : idx < 6 ? 'stable' : 'falling') as 'rising' | 'stable' | 'falling',
    region: 'Global' as const,
    suggestedPrompt: `Viral TikTok style video about #${name}, trending aesthetic, high energy, satisfying`,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const region = (req.query.region as string) || 'Global';
  const forceMock = process.env.FORCE_MOCK === 'true';
  const apiKey = process.env.TIKHUB_API_KEY;

  if (apiKey && !forceMock) {
    try {
      let topics: any[] = [];

      if (region === 'CN') {
        // Douyin (Chinese) hot search list
        const r = await fetch(
          'https://api.tikhub.io/api/v1/douyin/web/fetch_hot_search_list',
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        if (!r.ok) throw new Error(`TikHub CN error: ${r.status}`);
        const data = await r.json();
        const list = data?.data?.word_list ?? data?.data?.list ?? [];
        topics = list.slice(0, 10).map(mapDouyinItem);
      } else {
        // TikTok global trending hashtags
        const countryCode = region === 'TW' ? 'TW' : 'US';
        const r = await fetch(
          `https://api.tikhub.io/api/v1/tiktok/app/v3/fetch_trending_hashtag_list?country_code=${countryCode}&count=10`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        if (!r.ok) throw new Error(`TikHub Global error: ${r.status}`);
        const data = await r.json();
        const list = data?.data?.hashtag_list ?? data?.data?.list ?? [];
        topics = list.slice(0, 10).map(mapTikTokHashtag);
      }

      if (topics.length > 0) {
        return res.json({ topics, source: 'live', provider: 'tikhub' });
      }
      throw new Error('Empty response from TikHub');

    } catch (err: any) {
      console.error('[trending] TikHub API error:', err.message);
      // Fall through to mock
    }
  }

  // ── Mock fallback ──────────────────────────────────────────────────────────
  const topics = region === 'All'
    ? MOCK_TOPICS
    : MOCK_TOPICS.filter(t => t.region === region || t.region === 'Global');

  return res.json({
    topics: topics.sort((a, b) => b.heatScore - a.heatScore),
    source: 'mock',
    reason: apiKey ? 'api_error' : 'no_api_key',
  });
}
