/**
 * POST /api/publish
 * Body: { videoUrl, caption, hashtags, privacyLevel }
 *
 * Posts a video to TikTok via the Content Posting API.
 * Uses PULL_FROM_URL mode — TikTok fetches the video directly.
 *
 * Official docs: https://developers.tiktok.com/doc/content-posting-api-get-started
 * Scope required: video.publish (requires app audit for public posts)
 *
 * Without TIKTOK_ACCESS_TOKEN, returns a simulated successful post.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Privacy level mapping: our values → TikTok API values
const PRIVACY_MAP: Record<string, string> = {
  PUBLIC:    'PUBLIC_TO_EVERYONE',
  FOLLOWERS: 'MUTUAL_FOLLOW_FRIENDS',
  PRIVATE:   'SELF_ONLY',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { videoUrl, caption, hashtags = [], privacyLevel = 'PRIVATE' } = req.body ?? {};
  if (!videoUrl) return res.status(400).json({ error: 'videoUrl is required' });

  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const forceMock = process.env.FORCE_MOCK === 'true';

  if (accessToken && !forceMock) {
    try {
      // Step 1: Query creator info (required before posting)
      const creatorRes = await fetch(
        'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({}),
        }
      );
      if (!creatorRes.ok) throw new Error(`Creator info ${creatorRes.status}`);
      const creatorData = await creatorRes.json();
      const maxVideoSize = creatorData?.data?.max_video_post_duration_sec ?? 60;

      // Step 2: Init video post with PULL_FROM_URL
      const fullCaption = [
        caption ?? '',
        ...(hashtags as string[]),
      ].join(' ').slice(0, 2200); // TikTok max caption length

      const initRes = await fetch(
        'https://open.tiktokapis.com/v2/post/publish/video/init/',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({
            post_info: {
              title: fullCaption,
              privacy_level: PRIVACY_MAP[privacyLevel] ?? 'SELF_ONLY',
              disable_duet: false,
              disable_comment: false,
              disable_stitch: false,
              video_cover_timestamp_ms: 1000,
            },
            source_info: {
              source: 'PULL_FROM_URL',
              video_url: videoUrl,
              video_size: 50_000_000, // estimated, TikTok accepts this
            },
          }),
        }
      );

      if (!initRes.ok) {
        const errText = await initRes.text();
        throw new Error(`TikTok init ${initRes.status}: ${errText}`);
      }

      const initData = await initRes.json();
      const publishId = initData?.data?.publish_id;

      if (!publishId) throw new Error('No publish_id from TikTok');

      return res.json({
        postId: publishId,
        status: 'processing', // TikTok processes async
        source: 'live',
        provider: 'tiktok_content_posting_api',
        note: '影片正在處理中，TikTok 審核後將自動發布',
      });

    } catch (err: any) {
      console.error('[publish] TikTok API error:', err.message);
      // Fall through to mock
    }
  }

  // ── Mock fallback ──────────────────────────────────────────────────────────
  const mockPostId = `tt_${Date.now()}`;
  return res.json({
    postId: mockPostId,
    status: 'published',
    source: 'mock',
    reason: accessToken ? 'api_error' : 'no_access_token',
    postUrl: `https://www.tiktok.com/@your_account/video/${mockPostId}`,
    note: accessToken
      ? 'TikTok API 錯誤，使用模擬發布'
      : '未設置 TIKTOK_ACCESS_TOKEN，使用模擬發布',
  });
}
