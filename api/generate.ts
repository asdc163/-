/**
 * POST /api/generate
 * Body: { prompt, resolution, duration, topicTag? }
 *
 * Submits a Seedance 2.0 text-to-video generation job.
 * Returns { jobId, source } immediately — client polls /api/generate-status.
 *
 * API: api.laozhang.ai (OpenAI-compatible Seedance proxy)
 * Docs: https://www.aifreeapi.com/en/posts/seedance-2-api-integration-guide
 *
 * When Volcengine ARK launches (~2026-02-24), set:
 *   SEEDANCE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
 *   SEEDANCE_API_KEY=ark-xxxxx
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, resolution = '1080p', duration = 8 } = req.body ?? {};
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const apiKey = process.env.SEEDANCE_API_KEY;
  const baseUrl = process.env.SEEDANCE_BASE_URL ?? 'https://api.laozhang.ai/v1';
  const forceMock = process.env.FORCE_MOCK === 'true';

  if (apiKey && !forceMock) {
    try {
      const response = await fetch(`${baseUrl}/video/text-to-video`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'seedance-2.0',
          prompt,
          resolution,
          duration: Number(duration),
          aspect_ratio: '9:16', // vertical for TikTok
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Seedance API ${response.status}: ${err}`);
      }

      const data = await response.json();
      const jobId = data.job_id ?? data.id ?? data.jobId;

      if (!jobId) throw new Error('No job_id in Seedance response');

      return res.json({ jobId, source: 'live', provider: 'seedance-2.0', model: 'seedance-2.0' });

    } catch (err: any) {
      console.error('[generate] Seedance API error:', err.message);
      // Fall through to mock
    }
  }

  // ── Mock fallback: encode start time in jobId for stateless progress calc ──
  const mockJobId = `mock_${Date.now()}`;
  return res.json({
    jobId: mockJobId,
    source: 'mock',
    reason: apiKey ? 'api_error' : 'no_api_key',
  });
}
