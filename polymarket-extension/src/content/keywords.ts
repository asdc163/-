const STOP_WORDS = new Set([
  // Articles / prepositions / conjunctions
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'as', 'at', 'by', 'for',
  'in', 'of', 'on', 'to', 'up', 'it', 'its', 'is', 'be', 'am', 'are',
  'was', 'were', 'been', 'being', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'have', 'has',
  'had', 'not', 'no', 'so', 'yet', 'than', 'then', 'that', 'this',
  'with', 'from', 'into', 'via', 'out', 'off', 'over', 'about', 'just',
  'more', 'very', 'too', 'also', 'only', 'even', 'such', 'most',
  'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she',
  'her', 'they', 'them', 'their', 'i', 'who', 'what', 'when', 'where',
  'why', 'how', 'all', 'each', 'both', 'few', 'some', 'any', 'other',
  'same', 'here', 'there', 'once', 'after', 'before', 'since', 'while',
  'like', 'get', 'got', 'go', 'see', 'let', 'way', 'now', 'new',
  'one', 'two', 'first', 'last', 'day', 'time', 'year', 'week',
  // Common web/social noise
  'watch', 'video', 'click', 'link', 'post', 'tweet', 'like', 'share',
  'follow', 'subscribe', 'view', 'read', 'more', 'show', 'via', 'rt',
  'amp', 'http', 'https', 'www', 'com', 'org', 'net',
]);

// Minimum word length to be considered a keyword
const MIN_LENGTH = 3;
// Maximum keywords to return
const MAX_KEYWORDS = 6;

/**
 * Extract meaningful keywords from arbitrary text.
 * Returns top keywords sorted by frequency, filtered by stop words.
 */
export function extractKeywords(texts: string[]): string[] {
  const combined = texts.join(' ');

  // Tokenize: keep alphanumeric + hyphens, lowercased
  const tokens = combined
    .replace(/https?:\/\/\S+/g, ' ')      // strip URLs
    .replace(/[@#]\S+/g, ' ')             // strip @mentions and #hashtags (we handle these separately)
    .replace(/[^a-zA-Z0-9\s'-]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= MIN_LENGTH && !STOP_WORDS.has(w));

  // Also extract hashtags (without #) and @mentions — these are strong signals
  const hashtags = (combined.match(/#(\w+)/g) || [])
    .map(h => h.slice(1).toLowerCase())
    .filter(h => h.length >= MIN_LENGTH && !STOP_WORDS.has(h));

  const allTokens = [...tokens, ...hashtags];

  // Count frequency
  const freq = new Map<string, number>();
  for (const token of allTokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  // Sort by frequency descending
  const sorted = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  // De-duplicate substrings: if 'bitcoin' and 'bitcoins' both exist, keep the shorter
  const deduplicated: string[] = [];
  for (const word of sorted) {
    if (deduplicated.length >= MAX_KEYWORDS) break;
    const isSubsumed = deduplicated.some(
      existing => existing.includes(word) || word.includes(existing)
    );
    if (!isSubsumed) deduplicated.push(word);
  }

  return deduplicated;
}
