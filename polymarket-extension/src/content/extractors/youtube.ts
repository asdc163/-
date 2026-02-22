import { extractKeywords } from '../keywords';

/**
 * Extract keywords from YouTube video page.
 * Uses title, description, and channel name.
 */
export function extractFromYouTube(): string[] {
  const texts: string[] = [];

  // Video title — multiple selectors for different YouTube layouts
  const titleSelectors = [
    'h1.ytd-video-primary-info-renderer',
    'h1.ytd-watch-metadata yt-formatted-string',
    'yt-formatted-string.ytd-video-primary-info-renderer',
    '#above-the-fold #title h1',
    'ytd-watch-metadata h1',
  ];

  for (const sel of titleSelectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el?.textContent?.trim()) {
      texts.push(el.textContent.trim());
      break;
    }
  }

  // Fallback: page title (YouTube puts video title in <title>)
  if (texts.length === 0 && document.title) {
    const pageTitle = document.title.replace(' - YouTube', '').trim();
    if (pageTitle) texts.push(pageTitle);
  }

  // Channel name
  const channelEl = document.querySelector<HTMLElement>(
    'ytd-channel-name yt-formatted-string, #channel-name yt-formatted-string'
  );
  if (channelEl?.textContent?.trim()) {
    texts.push(channelEl.textContent.trim());
  }

  // Description (first 500 chars)
  const descEl = document.querySelector<HTMLElement>(
    '#description ytd-text-inline-expander, #description-inner, ytd-expander[collapsed]'
  );
  if (descEl?.textContent?.trim()) {
    texts.push(descEl.textContent.trim().slice(0, 500));
  }

  // YouTube Shorts — title may be different
  const shortsTitle = document.querySelector<HTMLElement>(
    'h2.ytShortsVideoTitle'
  );
  if (shortsTitle?.textContent?.trim()) {
    texts.push(shortsTitle.textContent.trim());
  }

  return extractKeywords(texts);
}
