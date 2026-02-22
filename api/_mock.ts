/**
 * Server-side mock data for API routes.
 * Mirrors MOCK_TRENDING in App.tsx — used when API keys are not configured.
 */

export const MOCK_TOPICS = [
  {
    id: '1', tag: '#AI生成影片', title: 'AI生成影片大爆發',
    category: 'tech', heatScore: 98, viewCount: '12.3億', postCount: '24.7萬',
    trend: 'rising', region: 'Global',
    suggestedPrompt: 'Cinematic AI-generated world, neon holographic city, futuristic skyline at night, ultra-realistic quality, dramatic lighting',
  },
  {
    id: '2', tag: '#春節舞蹈挑戰', title: '春節舞蹈挑戰賽',
    category: 'entertainment', heatScore: 95, viewCount: '8.9億', postCount: '18.2萬',
    trend: 'rising', region: 'CN',
    suggestedPrompt: 'Traditional Chinese New Year celebration, vibrant red lanterns, festive dragon dance, fireworks exploding over city skyline',
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
    suggestedPrompt: 'Japan travel cinematic vlog, cherry blossoms, Mount Fuji, Tokyo neon lights, serene temples, fast-paced montage',
  },
  {
    id: '8', tag: '#遊戲精彩時刻', title: '遊戲高光時刻合集',
    category: 'gaming', heatScore: 76, viewCount: '2.5億', postCount: '5.1萬',
    trend: 'falling', region: 'Global',
    suggestedPrompt: 'Epic gaming highlight reel, spectacular plays, reaction shots, neon gaming setup, dynamic transitions, hype moments compilation',
  },
];

export const CATEGORY_MAP: Record<string, string> = {
  entertainment: '娛樂', tech: '科技', food: '美食',
  fashion: '時尚', fitness: '健身', travel: '旅遊',
  news: '新聞', gaming: '遊戲',
};
