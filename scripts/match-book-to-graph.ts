// Find genuine external cross-references for a book's claims against the main
// knowledge graph. For each BookClaim, pre-filter candidates from the 842k Claim
// table via Postgres full-text search, then use the claude CLI to judge whether
// each candidate is a genuine SUPPORTS / CONTRADICTS / RELATED match. Writes
// BookClaimMatch rows for genuine hits only.
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/match-book-to-graph.ts --book <id> [--dry-run]
//
// Required env (read from .env.local):
//   DATABASE_URL  — Neon Postgres (Prisma)

import * as fs from 'node:fs'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'

const anthropic = new Anthropic()

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, 'utf-8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}
loadEnvLocal()

const prisma = new PrismaClient()
const CONCURRENCY = 5
const CANDIDATES_PER_BOOK_CLAIM = 20
const SIMILARITY_BY_TYPE: Record<string, number> = {
  SUPPORTS: 0.95,
  CONTRADICTS: 0.9,
  RELATED: 0.8,
}

const DRY_RUN = process.argv.includes('--dry-run')
const BOOK_ID = (() => {
  const idx = process.argv.indexOf('--book')
  return idx !== -1 ? process.argv[idx + 1] : undefined
})()
const PROGRESS_FILE = process.env.MATCH_PROGRESS_FILE || ''

function writeProgress(state: {
  status: 'running' | 'done' | 'error'
  processed: number
  matched: number
  total: number
  errors: number
  startedAt: number
  finishedAt?: number
  errorMessage?: string
}) {
  if (!PROGRESS_FILE) return
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(state))
  } catch {
    // swallow — progress reporting is best-effort
  }
}

if (!BOOK_ID) {
  console.error('Usage: npx ts-node --project tsconfig.scripts.json scripts/match-book-to-graph.ts --book <bookId> [--dry-run]')
  process.exit(1)
}

const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'because', 'before', 'being', 'between',
  'could', 'during', 'every', 'first', 'often', 'other', 'should', 'still',
  'their', 'there', 'these', 'they', 'this', 'those', 'through', 'under',
  'until', 'where', 'which', 'while', 'would', 'might', 'shall', 'whose',
  'years', 'world', 'people', 'said', 'made', 'have', 'been', 'were', 'will',
  'with', 'from', 'that', 'than', 'them', 'into', 'such', 'also', 'some',
  'many', 'most', 'when', 'what', 'were', 'only', 'just', 'over', 'more',
  'very', 'much', 'each', 'both', 'same', 'then', 'than',
])

function keywordsFrom(claimText: string): string[] {
  const tokens = claimText
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 4 && !STOPWORDS.has(w))
  return Array.from(new Set(tokens)).slice(0, 8)
}

type Candidate = { id: string; text: string; score: number }

async function findCandidates(claimText: string, excludeIngestedBy: string): Promise<Candidate[]> {
  const keywords = keywordsFrom(claimText)
  if (keywords.length === 0) return []

  // Build a tsquery from the keywords using OR so any-of-keywords matches
  // (plainto_tsquery uses AND which is too restrictive against 842k rows).
  const tsQuery = keywords.join(' | ')

  try {
    const rows = await prisma.$queryRaw<Candidate[]>`
      SELECT c.id, c.text, ts_rank(to_tsvector('english', c.text), query) AS score
      FROM "Claim" c, to_tsquery('english', ${tsQuery}) AS query
      WHERE c.deleted = false
        AND (c."ingestedBy" IS NULL OR c."ingestedBy" != ${excludeIngestedBy})
        AND to_tsvector('english', c.text) @@ query
      ORDER BY score DESC
      LIMIT ${CANDIDATES_PER_BOOK_CLAIM}
    `
    return rows
  } catch (err) {
    // to_tsquery is strict about syntax; fall back to ILIKE OR if it complains.
    const candidates = await prisma.claim.findMany({
      where: {
        deleted: false,
        ingestedBy: { not: excludeIngestedBy },
        OR: keywords.map((w) => ({ text: { contains: w, mode: 'insensitive' as const } })),
      },
      select: { id: true, text: true },
      take: CANDIDATES_PER_BOOK_CLAIM,
    })
    return candidates.map((c) => ({ ...c, score: 0 }))
  }
}

type Judgment = { index: number; matchType: 'SUPPORTS' | 'CONTRADICTS' | 'RELATED' | 'UNRELATED'; reason: string }

// Sentinel returned when the LLM call fails or returns unparseable JSON,
// so callers can distinguish "error" from "no matches found".
export const JUDGMENT_ERROR: unique symbol = Symbol('JUDGMENT_ERROR')

async function judgeCandidates(
  bookClaimId: string,
  bookClaimText: string,
  candidates: Candidate[],
  counters: { errors: number },
): Promise<Judgment[] | typeof JUDGMENT_ERROR> {
  const numbered = candidates.map((c, i) => `${i}. ${c.text}`).join('\n')

  const prompt = [
    'You are an epistemic analyst. A book makes a factual claim. Below are candidate claims from a knowledge graph that share keywords with the book claim. For each candidate, judge whether it is a genuine match.',
    '',
    'BOOK CLAIM:',
    bookClaimText,
    '',
    'CANDIDATE CLAIMS:',
    numbered,
    '',
    'For each candidate, classify the relationship:',
    '- SUPPORTS: the candidate provides direct evidence for the book claim',
    '- CONTRADICTS: the candidate directly contradicts the book claim',
    '- RELATED: the candidate is genuinely about the same event/person/topic and adds context (not just keyword overlap)',
    '- UNRELATED: keywords overlap but the candidate is about something different',
    '',
    'Be strict. Only mark SUPPORTS, CONTRADICTS, or RELATED if there is a real intellectual connection — not just lexical overlap.',
    '',
    'Respond with ONLY a JSON array. One object per candidate, in the same order. Each object has: {"index": <number>, "matchType": "<SUPPORTS|CONTRADICTS|RELATED|UNRELATED>", "reason": "<one-sentence explanation, max 200 chars>"}.',
    'If you mark UNRELATED, the reason field can be empty.',
  ].join('\n')

  let raw: string
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content[0]
    raw = block.type === 'text' ? block.text.trim() : ''
  } catch (err) {
    console.error(`[bc ${bookClaimId.slice(0, 8)}] LLM call failed:`, err instanceof Error ? err.message : err)
    counters.errors++
    return JUDGMENT_ERROR
  }

  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '')
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1) {
    console.error(`[bc ${bookClaimId.slice(0, 8)}] LLM returned unparseable response (no JSON array)`)
    counters.errors++
    return JUDGMENT_ERROR
  }
  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1))
    if (!Array.isArray(parsed)) {
      console.error(`[bc ${bookClaimId.slice(0, 8)}] LLM JSON was not an array`)
      counters.errors++
      return JUDGMENT_ERROR
    }
    return parsed.filter(
      (j): j is Judgment =>
        typeof j === 'object' &&
        j !== null &&
        typeof (j as Judgment).index === 'number' &&
        typeof (j as Judgment).matchType === 'string' &&
        ['SUPPORTS', 'CONTRADICTS', 'RELATED', 'UNRELATED'].includes((j as Judgment).matchType),
    )
  } catch (err) {
    console.error(`[bc ${bookClaimId.slice(0, 8)}] JSON.parse failed:`, err instanceof Error ? err.message : err)
    counters.errors++
    return JUDGMENT_ERROR
  }
}

type BookClaimRow = { id: string; claimText: string }

async function processBookClaim(
  bookClaim: BookClaimRow,
  excludeIngestedBy: string,
  counters: { processed: number; candidatesFound: number; matchesWritten: number; matchesWithReason: number; errors: number },
): Promise<void> {
  try {
    const candidates = await findCandidates(bookClaim.claimText, excludeIngestedBy)
    counters.candidatesFound += candidates.length

    if (candidates.length === 0) {
      console.log(`[bc ${bookClaim.id.slice(0, 8)}] 0 candidates`)
      counters.processed++
      return
    }

    const judgeResult = await judgeCandidates(bookClaim.id, bookClaim.claimText, candidates, counters)
    if (judgeResult === JUDGMENT_ERROR) {
      counters.processed++
      return
    }
    const genuine = judgeResult.filter((j) => j.matchType !== 'UNRELATED')

    console.log(
      `[bc ${bookClaim.id.slice(0, 8)}] ${candidates.length} candidates → ${genuine.length} genuine ` +
        `(${genuine.map((j) => j.matchType[0]).join('') || '-'})`,
    )

    if (genuine.length === 0) {
      counters.processed++
      return
    }

    const rowsToWrite = genuine
      .map((j) => {
        const cand = candidates[j.index]
        if (!cand) return null
        return {
          bookClaimId: bookClaim.id,
          claimId: cand.id,
          similarityScore: SIMILARITY_BY_TYPE[j.matchType] ?? 0.8,
          matchType: j.matchType,
          reason: j.reason?.slice(0, 500) || null,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (DRY_RUN) {
      for (const r of rowsToWrite) {
        const cand = candidates.find((c) => c.id === r.claimId)
        console.log(
          `  [dry-run] ${r.matchType} → ${r.claimId.slice(0, 8)} "${cand?.text.slice(0, 80) ?? ''}..." :: ${r.reason ?? ''}`,
        )
      }
    } else {
      await prisma.bookClaimMatch.createMany({ data: rowsToWrite, skipDuplicates: true })
    }

    counters.matchesWritten += rowsToWrite.length
    counters.matchesWithReason += rowsToWrite.filter((r) => !!r.reason && r.reason.length > 0).length
    counters.processed++
  } catch (err) {
    counters.errors++
    counters.processed++
    console.error(`[bc ${bookClaim.id.slice(0, 8)}] error:`, err instanceof Error ? err.message : err)
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0
  async function worker() {
    while (i < items.length) {
      const item = items[i++]
      await fn(item)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
}

async function main() {
  if (DRY_RUN) console.log('[dry-run mode — no DB writes]\n')

  const book = await prisma.book.findUnique({
    where: { id: BOOK_ID },
    select: { id: true, title: true },
  })

  if (!book) {
    console.error(`Book not found: ${BOOK_ID}`)
    process.exit(1)
  }

  console.log(`Book: ${book.title} (${book.id})`)

  // Exclude claims derived from this same book (self-references).
  // analyze-book-connections.ts ingests claims with ingestedBy = `book-analysis:${bookId}`.
  const excludeIngestedBy = `book-analysis:${book.id}`

  // BookClaims without any existing matches (idempotent).
  const bookClaims = await prisma.bookClaim.findMany({
    where: {
      chunk: { bookId: book.id },
      matches: { none: {} },
    },
    select: { id: true, claimText: true },
    orderBy: { positionIndex: 'asc' },
  })

  console.log(`Found ${bookClaims.length} BookClaim rows without existing matches.\n`)
  const startedAt = Date.now()
  if (bookClaims.length === 0) {
    writeProgress({ status: 'done', processed: 0, matched: 0, total: 0, errors: 0, startedAt, finishedAt: Date.now() })
    await prisma.$disconnect()
    return
  }

  const counters = { processed: 0, candidatesFound: 0, matchesWritten: 0, matchesWithReason: 0, errors: 0 }
  const total = bookClaims.length
  writeProgress({ status: 'running', processed: 0, matched: 0, total, errors: 0, startedAt })

  await runWithConcurrency(bookClaims, CONCURRENCY, async (bc) => {
    await processBookClaim(bc, excludeIngestedBy, counters)
    writeProgress({
      status: 'running',
      processed: counters.processed,
      matched: counters.matchesWritten,
      total,
      errors: counters.errors,
      startedAt,
    })
    if (counters.processed % 10 === 0 || counters.processed === total) {
      console.log(
        `  progress ${counters.processed}/${total} | candidates ${counters.candidatesFound} | matches ${counters.matchesWritten} | errors ${counters.errors}`,
      )
    }
  })

  console.log('\nDone.')
  console.log(
    `BookClaims processed: ${counters.processed} | candidates found: ${counters.candidatesFound} | ` +
      `matches ${DRY_RUN ? 'would be written' : 'written'}: ${counters.matchesWritten} | errors: ${counters.errors}`,
  )
  console.log(
    `Match complete: ${counters.matchesWritten} matches found, ${counters.matchesWithReason} with reasons`,
  )

  writeProgress({
    status: 'done',
    processed: counters.processed,
    matched: counters.matchesWritten,
    total,
    errors: counters.errors,
    startedAt,
    finishedAt: Date.now(),
  })

  if (process.env.TELEGRAM_NOTIFY && !DRY_RUN) {
    const message =
      `📚 Match complete for ${book.title}\n` +
      `${counters.matchesWritten} matches found, ${counters.matchesWithReason} with reasons` +
      (counters.errors > 0 ? ` (errors: ${counters.errors})` : '')
    const result = spawnSync(
      'openclaw',
      [
        'message',
        'send',
        '--channel', 'telegram',
        '--target', process.env.TELEGRAM_CHAT_ID ?? '',
        '--message', message,
      ],
      { stdio: 'inherit' },
    )
    if (result.status !== 0) {
      console.error(
        `openclaw notify failed (status ${result.status}${result.error ? `, ${result.error.message}` : ''})`,
      )
    }
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('FATAL:', err)
  writeProgress({
    status: 'error',
    processed: 0,
    matched: 0,
    total: 0,
    errors: 1,
    startedAt: Date.now(),
    finishedAt: Date.now(),
    errorMessage: err instanceof Error ? err.message : String(err),
  })
  await prisma.$disconnect()
  process.exit(1)
})
