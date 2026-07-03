// Shared between scripts/populate-bill-coverage.ts (skip fetching junk
// queries) and app/api/stats/media-coverage/route.ts (flag rows already in
// the cache so degenerate 10,000-hit matches don't top the coverage ranking).

const QUERY_STOPWORDS = new Set([
  'a', 'an', 'and', 'or', 'of', 'the', 'to', 'in', 'for', 'on', 'at', 'by',
  'with', 'as', 'that', 'this', 'these', 'those', 'from', 'into', 'such',
  'be', 'is', 'are', 'was', 'were', 'so', 'if',
])

// Boilerplate lead words that survive as one-word queries when a bill has a
// generic long title and no short title ("Recognizing…", "To establish…" →
// query "establish"). Phrase-searching these on NYT returns the 10,000-hit
// cap and poisons the coverage ranking.
const GENERIC_QUERY_WORDS = new Set([
  'recognizing', 'establish', 'establishing', 'supporting', 'honoring',
  'commemorating', 'celebrating', 'designating', 'expressing', 'condemning',
  'congratulating', 'acknowledging', 'awarding', 'act', 'resolution', 'signal',
])

/**
 * True when a query is too generic to measure real coverage: placeholder
 * titles for reserved bill numbers ("_______ Act"), single words, or a single
 * meaningful word that is itself procedural boilerplate ("establish Act").
 */
export function isGenericQuery(q: string | null | undefined): boolean {
  if (!q) return true
  if (/_{2,}/.test(q)) return true
  const words = q.split(/\s+/).filter(Boolean)
  const meaningful = words.filter(w => {
    const bare = w.toLowerCase().replace(/[.,;:!?'"“”]+$/g, '')
    return !QUERY_STOPWORDS.has(bare) && !GENERIC_QUERY_WORDS.has(bare)
  })
  return meaningful.length < 2
}
