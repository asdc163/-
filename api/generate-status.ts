/**
 * GET /api/generate-status?jobId=fal_xxxxxxxx
 *
 * Polls fal.ai queue for Kling 2.6 Pro generation status.
 *
 * jobId formats:
 *   fal_{request_id}  → real fal.ai job
 *   mock_{timestamp}  → simulated job (no API key needed)
 *
 * fal.ai status values: IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const FAL_BASE = 'https://queue.fal.run';
const KLING_MODEL = 'fal-ai/kling-video';
const MOCK_DURATION_MS = 12_000;
const MOCK_VIDEO_URL = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const jobId = req.query.jobId as string;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  // ── Mock mode ─────────────────────────────────────────────────────────────
  if (jobId.startsWith('mock_')) {
    const startedAt = parseInt(jobId.replace('mock_', ''), 10);
    const elapsed = Date.now() - startedAt;
    const progress = Math.min(100, Math.floor((elapsed / MOCK_DURATION_MS) * 100));
    return res.json({
      status: progress >= 100 ? 'completed' : 'processing',
      progress,
      videoUrl: progress >= 100 ? MOCK_VIDEO_URL : undefined,
      source: 'mock',
    });
  }

  // ── fal.ai queue polling ──────────────────────────────────────────────────
  if (jobId.startsWith('fal_')) {
    const requestId = jobId.replace('fal_', '');
    const falKey = process.env.FAL_AI_KEY;

    if (!falKey) return res.status(503).json({ error: 'FAL_AI_KEY not configured' });

    try {
      // Check status first
      const statusRes = await fetch(
        `${FAL_BASE}/${KLING_MODEL}/requests/${requestId}/status`,
        { headers: { Authorization: `Key ${falKey}` } }
      );
      if (!statusRes.ok) throw new Error(`fal.ai status ${statusRes.status}`);
      const statusData = await statusRes.json();

      const falStatus: string = statusData.status ?? 'IN_PROGRESS';

      // Map fal.ai status → our progress
      const progressMap: Record<string, number> = {
        IN_QUEUE: 5,
        IN_PROGRESS: 50,
        COMPLETED: 100,
        FAILED: 0,
      };
      const progress = progressMap[falStatus] ?? 50;

      if (falStatus === 'FAILED') {
        return res.json({ status: 'failed', progress: 0, error: 'Generation failed', source: 'live' });
      }

      if (falStatus !== 'COMPLETED') {
        return res.json({ status: 'processing', progress, source: 'live' });
      }

      // Fetch the result
      const resultRes = await fetch(
        `${FAL_BASE}/${KLING_MODEL}/requests/${requestId}`,
        { headers: { Authorization: `Key ${falKey}` } }
      );
      if (!resultRes.ok) throw new Error(`fal.ai result ${resultRes.status}`);
      const resultData = await resultRes.json();

      // fal.ai Kling result: { video: { url, content_type, file_name, file_size } }
      const videoUrl = resultData?.video?.url
        ?? resultData?.videos?.[0]?.url
        ?? resultData?.output?.url;

      return res.json({
        status: 'completed',
        progress: 100,
        videoUrl,
        fileSize: resultData?.video?.file_size,
        source: 'live',
        provider: 'kling-2.6-pro',
      });

    } catch (err: any) {
      console.error('[generate-status] fal.ai error:', err.message);
      return res.status(500).json({ error: err.message, status: 'error', progress: 0 });
    }
  }

  return res.status(400).json({ error: `Unknown jobId format: ${jobId}` });
}
