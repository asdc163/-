import { extractKeywords } from '../keywords';

/**
 * Extract keywords from visible tweets on Twitter/X.
 * Targets the tweet text elements and combines visible ones.
 */
export function extractFromTwitter(): string[] {
  const texts: string[] = [];

  // Primary tweet text selector (Twitter/X data-testid)
  const tweetEls = document.querySelectorAll<HTMLElement>(
    '[data-testid="tweetText"]'
  );

  const viewportHeight = window.innerHeight;

  tweetEls.forEach(el => {
    const rect = el.getBoundingClientRect();
    // Only consider tweets visible or near viewport
    if (rect.bottom >= -200 && rect.top <= viewportHeight + 200) {
      const text = el.textContent?.trim();
      if (text) texts.push(text);
    }
  });

  // Also grab the main article/post title if on a single tweet page
  const articleTitle = document.querySelector<HTMLElement>(
    '[data-testid="tweet"] [data-testid="tweetText"]'
  );
  if (articleTitle?.textContent) {
    texts.unshift(articleTitle.textContent);
  }

  // Try to get quoted tweets too
  const quotedTweets = document.querySelectorAll<HTMLElement>(
    '[data-testid="quotedTweetText"]'
  );
  quotedTweets.forEach(el => {
    const text = el.textContent?.trim();
    if (text) texts.push(text);
  });

  return extractKeywords(texts);
}
