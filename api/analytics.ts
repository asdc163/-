/**
 * GET /api/analytics?postId=xxx&region=Global
 *
 * Returns video analytics data.
 * TikTok Analytics API requires special access (Display API or Business API).
 * Until access is granted, returns realistic mock data seeded from postId.
 *
 * When TikTok Analytics API is available, set:
 *   TIKTOK_ACCESS_TOKEN with analytics.read scope
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple deterministic pseudo-random from string seed
function seedRand(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  const t = Math.abs(h) / 2_147_483_647;
  return Math.floor(t * (max - min + 1) + min);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const postId = (req.query.postId as string) || 'default';
  const region = (req.query.region as string) || 'Global';

  // ── Future: real TikTok Analytics API ────────────────────────────────────
  // const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  // if (accessToken) { ... }

  // ── Deterministic mock analytics (seeded from postId for consistency) ────
  const views      = seedRand(postId + 'v', 15_000, 150_000);
  const likes      = seedRand(postId + 'l', 1_000, 15_000);
  const comments   = seedRand(postId + 'c', 80, 800);
  const shares     = seedRand(postId + 's', 200, 4_000);
  const completion = seedRand(postId + 'p', 58, 88);
  const watchTime  = seedRand(postId + 'w', 4, 9);
  const engagement = parseFloat((((likes + comments + shares) / views) * 100).toFixed(1));

  const regionBreakdown =
    region === 'CN'
      ? [
          { region: '上海', pct: 28 }, { region: '北京', pct: 22 },
          { region: '廣州', pct: 18 }, { region: '其他', pct: 32 },
        ]
      : [
          { region: '台灣', pct: 42 }, { region: '香港', pct: 27 },
          { region: '中國大陸', pct: 19 }, { region: '其他', pct: 12 },
        ];

  const insights = [
    `影片完播率 ${completion}%，${completion >= 70 ? '高於' : '接近'}平台平均水準`,
    `前 3 秒留存率高，開頭節奏把握良好`,
    `21:00–23:00 互動率比日間高 2.3×，建議持續晚間發布`,
    `評論情緒分析：正面佔 ${seedRand(postId + 'pos', 55, 78)}%，有爆款潛力`,
    `${seedRand(postId + 'r', 30, 55)}% 流量來自「For You」推薦頁`,
  ];

  // Suggested next topic based on category signals in postId
  const nextTopics = [
    '#AI生成影片', '#春節舞蹈挑戰', '#奶茶新品測評', '#職場穿搭OOTD', '#健身挑戰30天',
  ];
  const nextTopicHint = nextTopics[seedRand(postId + 'n', 0, nextTopics.length - 1)];

  return res.json({
    postId,
    views,
    likes,
    comments,
    shares,
    watchTimeAvg: watchTime,
    completionRate: completion,
    engagementRate: engagement,
    peakHour: '21:00 – 23:00',
    audienceRegions: regionBreakdown,
    insights,
    nextTopicHint,
    source: 'mock',
    note: 'TikTok Analytics API 需要 Business API 存取，目前使用模擬數據',
  });
}
