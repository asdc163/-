/**
 * POST /api/generate
 * Body: { prompt, resolution, duration }
 *
 * Submits a Kling 2.6 Pro text-to-video job via fal.ai queue.
 * Returns { jobId, source } immediately — client polls /api/generate-status.
 *
 * Model: fal-ai/kling-video/v2.6/pro/text-to-video
 * Pricing: ~$0.07/sec (5s ≈ $0.35), $1 free credits on new account
 * Docs: https://fal.ai/models/fal-ai/kling-video/v2.6/pro/text-to-video/api
 *
 * When Seedance 2.0 official API launches, switch provider by setting:
 *   VIDEO_PROVIDER=seedance
 *   SEEDANCE_API_KEY=...
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const FAL_BASE = 'https://queue.fal.run';
const KLING_MODEL = 'fal-ai/kling-video/v2.6/pro/text-to-video';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, resolution = '1080p', duration = 5 } = req.body ?? {};
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const falKey = process.env.FAL_AI_KEY;
  const forceMock = process.env.FORCE_MOCK === 'true';

  if (falKey && !forceMock) {
    try {
      // Kling 2.6 Pro supports 5s or 10s
      const videoDuration = Number(duration) >= 8 ? '10' : '5';

      const response = await fetch(`${FAL_BASE}/${KLING_MODEL}`, {
        method: 'POST',
        headers: {
          Authorization: `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          duration: videoDuration,
          aspect_ratio: '9:16', // TikTok vertical format
          negative_prompt: 'blur, distortion, low quality, watermark, text overlay',
          cfg_scale: 0.5,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`fal.ai ${response.status}: ${err}`);
      }

      const data = await response.json();
      // fal.ai returns: { request_id, status_url, response_url, ... }
      const jobId = `fal_${data.request_id}`;

      return res.json({
        jobId,
        source: 'live',
        provider: 'kling-2.6-pro',
        model: 'fal-ai/kling-video/v2.6/pro',
        statusUrl: data.status_url,
        responseUrl: data.response_url,
      });

    } catch (err: any) {
      console.error('[generate] fal.ai error:', err.message);
      // fall through to mock
    }
  }

  // ── Mock fallback: encode start time in jobId for stateless progress ──────
  return res.json({
    jobId: `mock_${Date.now()}`,
    source: 'mock',
    reason: falKey ? 'api_error' : 'no_fal_ai_key',
  });
}
