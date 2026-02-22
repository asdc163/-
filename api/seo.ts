/**
 * POST /api/seo
 * Body: { topic, videoUrl }
 *
 * Generates SEO-optimised caption, hashtags, and A/B variants.
 * Uses OpenAI if OPENAI_API_KEY is set, otherwise uses rule-based generation.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CATEGORY_TAGS: Record<string, string[]> = {
  tech:          ['#科技', '#AI', '#未來', '#數位'],
  entertainment: ['#娛樂', '#搞笑', '#有趣', '#潮流'],
  food:          ['#美食', '#吃貨', '#推薦', '#必吃'],
  fashion:       ['#時尚', '#穿搭', '#OOTD', '#outfit'],
  fitness:       ['#健身', '#運動', '#健康', '#workout'],
  travel:        ['#旅遊', '#Vlog', '#旅行', '#景點'],
  news:          ['#新聞', '#時事', '#資訊'],
  gaming:        ['#遊戲', '#電競', '#Gaming', '#實況'],
};

function buildRuleSEO(topic: any) {
  const catTags = CATEGORY_TAGS[topic.category as string] ?? ['#熱門', '#推薦'];
  const hashtags = [
    topic.tag,
    '#AI影片',
    '#Seedance',
    '#抖音創作者',
    ...catTags.slice(0, 2),
    '#爆款',
    '#trending',
    '#viral',
  ];

  const hour = new Date().getHours();
  const suggestedTime =
    hour < 12 ? '午後 12:00–14:00（午休高峰）' : '晚上 20:00–22:00（黃金時段）';

  return {
    caption: `🔥 ${topic.title}！這個趨勢你跟上了嗎？AI 生成超震撼影片 ✨ #創作者 #AI工具`,
    hashtags,
    suggestedPostTime: suggestedTime,
    expectedReach: `預計觸及 ${Math.floor(Math.random() * 40 + 20)}萬人`,
    keywords: ['AI生成', '影片創作', '抖音', '爆款', '熱門趨勢'],
    sentiment: 'trending' as const,
    abVariants: [
      {
        label: 'A 版（情緒驅動）',
        caption: `😱 不敢相信！${topic.tag} 的流量居然這麼高！趕快來看看 👀`,
        hashtags: [topic.tag, '#震驚', '#必看', '#抖音熱門', '#viral'],
      },
      {
        label: 'B 版（價值導向）',
        caption: `📈 ${topic.title}，掌握這個趨勢讓你的帳號快速成長 💡`,
        hashtags: [topic.tag, '#成長技巧', '#創作者必看', '#抖音攻略', '#trending'],
      },
    ],
  };
}

async function buildOpenAISEO(topic: any, apiKey: string) {
  const prompt = `You are a TikTok/Douyin SEO expert.
Given this trending topic: "${topic.tag}" (${topic.title}) in category "${topic.category}",
generate optimized content in Traditional Chinese for TikTok.

Return ONLY valid JSON with this shape:
{
  "caption": "engaging caption under 150 chars with 2-3 emojis",
  "hashtags": ["#tag1", "#tag2", ...8 tags total],
  "suggestedPostTime": "suggested posting window",
  "expectedReach": "estimated reach string",
  "abVariants": [
    {"label": "A 版", "caption": "...", "hashtags": [...]},
    {"label": "B 版", "caption": "...", "hashtags": [...]}
  ]
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI ${response.status}`);
  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return {
    ...parsed,
    keywords: ['AI生成', '影片創作', topic.tag],
    sentiment: 'trending' as const,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic } = req.body ?? {};
  if (!topic) return res.status(400).json({ error: 'topic is required' });

  const openaiKey = process.env.OPENAI_API_KEY;
  const forceMock = process.env.FORCE_MOCK === 'true';

  if (openaiKey && !forceMock) {
    try {
      const seoData = await buildOpenAISEO(topic, openaiKey);
      return res.json({ ...seoData, source: 'ai', provider: 'openai' });
    } catch (err: any) {
      console.error('[seo] OpenAI error:', err.message);
      // fall through to rule-based
    }
  }

  const seoData = buildRuleSEO(topic);
  return res.json({
    ...seoData,
    source: openaiKey ? 'rule_based_fallback' : 'rule_based',
  });
}
