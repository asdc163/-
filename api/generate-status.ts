/**
 * GET /api/generate-status?jobId=xxx
 *
 * Polls the status of a Seedance video generation job.
 * For mock jobs (jobId starts with "mock_"), progress is calculated from
 * the timestamp embedded in the jobId — no server state needed.
 *
 * Response: { status, progress, videoUrl?, error? }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simulated generation duration for mock mode (ms)
const MOCK_GENERATION_MS = 12_000;

// Placeholder thumbnail for generated videos (mock)
const MOCK_VIDEO_URL =
  'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const jobId = req.query.jobId as string;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  // ── Mock mode (stateless, time-based progress) ────────────────────────────
  if (jobId.startsWith('mock_')) {
    const startedAt = parseInt(jobId.replace('mock_', ''), 10);
    const elapsed = Date.now() - startedAt;
    const progress = Math.min(100, Math.floor((elapsed / MOCK_GENERATION_MS) * 100));
    const completed = progress >= 100;

    return res.json({
      status: completed ? 'completed' : 'processing',
      progress,
      videoUrl: completed ? MOCK_VIDEO_URL : undefined,
      source: 'mock',
    });
  }

  // ── Real Seedance API polling ──────────────────────────────────────────────
  const apiKey = process.env.SEEDANCE_API_KEY;
  const baseUrl = process.env.SEEDANCE_BASE_URL ?? 'https://api.laozhang.ai/v1';

  if (!apiKey) {
    return res.status(503).json({ error: 'SEEDANCE_API_KEY not configured' });
  }

  try {
    const response = await fetch(`${baseUrl}/video/jobs/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Seedance status API ${response.status}`);
    }

    const data = await response.json();

    // Normalise field names across providers
    const status = data.status ?? 'processing';
    const progress = data.progress ?? (status === 'completed' ? 100 : status === 'queued' ? 5 : 50);
    const videoUrl = data.video_url ?? data.videoUrl ?? data.output_url;

    return res.json({ status, progress, videoUrl, source: 'live' });

  } catch (err: any) {
    console.error('[generate-status] error:', err.message);
    return res.status(500).json({ error: err.message, status: 'error', progress: 0 });
  }
}
