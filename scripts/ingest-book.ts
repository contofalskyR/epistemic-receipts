// Book Analysis Pipeline — paragraph-level claim extraction + pgvector matching
//
// Reads a plain-text book, chunks by paragraph, asks Claude Haiku for the
// discrete factual claims in each paragraph, embeds each claim with OpenAI
// text-embedding-3-small, and stores cosine-similarity matches against the
// existing Claim table (which it back-fills with embeddings on demand).
//
// Run:  npx tsx scripts/ingest-book.ts <path-to-file> <title> [author]
//
// Required env:
//   DATABASE_URL          — Neon Postgres with pgvector enabled
//   ANTHROPIC_API_KEY     — for claim extraction (claude-haiku-4-5)
//   OPENAI_API_KEY        — for text-embedding-3-small
//
// Optional flags:
//   --limit N             cap the number of chunks ingested (smoke-test)
//   --candidates N        candidate claims per book claim (default 25)
//   --top-matches N       matches stored per book claim (default 5)
//   --min-similarity F    cosine threshold to keep a match (default 0.55)

import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Config ────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const EMBED_MODEL = 'text-embedding-3-small'
const EMBED_DIM = 1536

type CLIArgs = {
  filePath: string
  title: string
  author: string | null
  limit: number
  candidates: number
  topMatches: number
  minSimilarity: number
}

function parseArgs(): CLIArgs {
  const argv = process.argv.slice(2)
  const positional: string[] = []
  const flags: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      flags[a.slice(2)] = argv[i + 1] ?? ''
      i++
    } else {
      positional.push(a)
    }
  }
  const [filePath, title, author] = positional
  if (!filePath || !title) {
    console.error('Usage: npx tsx scripts/ingest-book.ts <path-to-file> <title> [author] [--limit N]')
    process.exit(1)
  }
  return {
    filePath: resolve(filePath),
    title,
    author: author ?? null,
    limit: parseInt(flags.limit ?? '0', 10) || 0,
    candidates: parseInt(flags.candidates ?? '25', 10),
    topMatches: parseInt(flags['top-matches'] ?? '5', 10),
    minSimilarity: parseFloat(flags['min-similarity'] ?? '0.55'),
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function chunkByParagraph(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 40) // drop chapter headers / page numbers
}

function toVectorLiteral(vec: number[]): string {
  // pgvector accepts text form: '[0.1,0.2,...]'
  return '[' + vec.join(',') + ']'
}

// ── Anthropic claim extraction ────────────────────────────────────────────────

interface AnthropicMessageResponse {
  content?: Array<{ type: string; text?: string }>
  error?: { message: string }
}

const EXTRACTION_SYSTEM = `You extract discrete, verifiable factual claims from prose.
Return ONLY a JSON array of strings — no commentary, no markdown fences.
Each string is one self-contained factual claim that could in principle be
checked against an outside source (a date, an event, a statistic, an
attribution, a causal assertion). Skip opinions, rhetorical questions,
fictional descriptions, and meta-commentary. If the paragraph contains no
verifiable factual claims, return [].`

async function extractClaims(paragraph: string): Promise<string[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: 'user', content: paragraph }],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = (await res.json()) as AnthropicMessageResponse
  const text = data.content?.find((b) => b.type === 'text')?.text?.trim() ?? '[]'
  const jsonStart = text.indexOf('[')
  const jsonEnd = text.lastIndexOf(']')
  if (jsonStart === -1 || jsonEnd === -1) return []
  try {
    const arr = JSON.parse(text.slice(jsonStart, jsonEnd + 1))
    if (!Array.isArray(arr)) return []
    return arr.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
  } catch {
    return []
  }
}

// ── OpenAI embeddings ─────────────────────────────────────────────────────────

interface OpenAIEmbedResponse {
  data?: Array<{ embedding: number[] }>
  error?: { message: string }
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI embed ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = (await res.json()) as OpenAIEmbedResponse
  const out = data.data?.map((d) => d.embedding) ?? []
  if (out.length !== texts.length) {
    throw new Error(`OpenAI returned ${out.length} embeddings for ${texts.length} inputs`)
  }
  for (const v of out) {
    if (v.length !== EMBED_DIM) {
      throw new Error(`Unexpected embedding dim ${v.length} (expected ${EMBED_DIM})`)
    }
  }
  return out
}

// ── Matching ──────────────────────────────────────────────────────────────────

type CandidateRow = {
  id: string
  text: string
  similarity: number
  hasEmbedding: boolean
}

// Trigram-based candidate selection. We rely on the existing
// Claim_text_trgm_idx (pg_trgm) GIN index for fast lexical pre-filtering.
async function findCandidates(claimText: string, limit: number): Promise<CandidateRow[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; text: string; sim: number; has_embedding: boolean }>
  >(
    `SELECT id,
            text,
            similarity(text, $1) AS sim,
            (embedding IS NOT NULL) AS has_embedding
     FROM "Claim"
     WHERE deleted = false
       AND text % $1
     ORDER BY sim DESC
     LIMIT $2`,
    claimText,
    limit,
  )
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    similarity: Number(r.sim),
    hasEmbedding: r.has_embedding,
  }))
}

async function getEmbeddingsForClaims(
  candidates: CandidateRow[],
): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>()
  const need: CandidateRow[] = []
  for (const c of candidates) {
    if (c.hasEmbedding) continue
    need.push(c)
  }
  // Fetch already-stored embeddings in one query.
  const withEmbedding = candidates.filter((c) => c.hasEmbedding).map((c) => c.id)
  if (withEmbedding.length > 0) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; embedding: string }>>(
      `SELECT id, embedding::text AS embedding FROM "Claim" WHERE id = ANY($1::text[])`,
      withEmbedding,
    )
    for (const r of rows) {
      out.set(r.id, parsePgVector(r.embedding))
    }
  }
  // Embed the rest in a single batch and persist.
  if (need.length > 0) {
    const vectors = await embedBatch(need.map((c) => c.text))
    for (let i = 0; i < need.length; i++) {
      const c = need[i]
      const v = vectors[i]
      out.set(c.id, v)
      await prisma.$executeRawUnsafe(
        `UPDATE "Claim" SET embedding = $1::vector WHERE id = $2`,
        toVectorLiteral(v),
        c.id,
      )
    }
  }
  return out
}

function parsePgVector(s: string): number[] {
  // pgvector text form: "[0.1,0.2,...]"
  return s
    .slice(1, -1)
    .split(',')
    .map((x) => Number(x))
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function classifyMatch(score: number): string {
  // Pure-embedding stance detection is unreliable, so the ingest script only
  // produces RELATED (semantically close) and UNVERIFIED (weakly related)
  // labels. SUPPORTS / CONTRADICTS classification is an editorial step that
  // happens later — see CLAUDE.md / AGENTS.md on the editorial vs algorithmic
  // boundary.
  if (score >= 0.85) return 'RELATED'
  return 'UNVERIFIED'
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs()
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set in env')
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set in env')

  console.log(`Ingesting "${args.title}"${args.author ? ` by ${args.author}` : ''}`)
  console.log(`  file:       ${args.filePath}`)
  console.log(`  limit:      ${args.limit || 'no cap'}`)
  console.log(`  candidates: ${args.candidates}`)
  console.log(`  top:        ${args.topMatches}`)
  console.log(`  min sim:    ${args.minSimilarity}\n`)

  const raw = readFileSync(args.filePath, 'utf-8')
  let paragraphs = chunkByParagraph(raw)
  if (args.limit > 0) paragraphs = paragraphs.slice(0, args.limit)
  console.log(`${paragraphs.length} paragraph chunks\n`)

  const book = await prisma.book.create({
    data: { title: args.title, author: args.author, sourceUrl: null },
  })
  console.log(`Created book ${book.id}\n`)

  let globalClaimIndex = 0
  let totalClaims = 0
  let totalMatches = 0

  for (let i = 0; i < paragraphs.length; i++) {
    const text = paragraphs[i]
    const preview = text.slice(0, 80).replace(/\s+/g, ' ')
    process.stdout.write(`[${i + 1}/${paragraphs.length}] ${preview}…  `)

    const chunk = await prisma.bookChunk.create({
      data: { bookId: book.id, paragraphIndex: i, text },
    })

    let claimsText: string[] = []
    try {
      claimsText = await extractClaims(text)
    } catch (err) {
      console.warn(`\n  claim extraction failed: ${(err as Error).message}`)
      continue
    }
    if (claimsText.length === 0) {
      console.log('0 claims')
      continue
    }

    // Embed all claims in this chunk in one batch
    let claimEmbeddings: number[][]
    try {
      claimEmbeddings = await embedBatch(claimsText)
    } catch (err) {
      console.warn(`\n  embed failed: ${(err as Error).message}`)
      continue
    }

    let chunkMatches = 0
    for (let c = 0; c < claimsText.length; c++) {
      const claimText = claimsText[c]
      const claimVec = claimEmbeddings[c]
      const positionIndex = globalClaimIndex++
      totalClaims++

      const bookClaim = await prisma.bookClaim.create({
        data: { chunkId: chunk.id, claimText, positionIndex },
      })
      await prisma.$executeRawUnsafe(
        `UPDATE "BookClaim" SET embedding = $1::vector WHERE id = $2`,
        toVectorLiteral(claimVec),
        bookClaim.id,
      )

      const candidates = await findCandidates(claimText, args.candidates)
      if (candidates.length === 0) continue
      const embeddings = await getEmbeddingsForClaims(candidates)

      const scored = candidates
        .map((cand) => {
          const v = embeddings.get(cand.id)
          if (!v) return null
          return { id: cand.id, score: cosine(claimVec, v) }
        })
        .filter((x): x is { id: string; score: number } => x !== null)
        .filter((x) => x.score >= args.minSimilarity)
        .sort((a, b) => b.score - a.score)
        .slice(0, args.topMatches)

      if (scored.length === 0) continue
      await prisma.bookClaimMatch.createMany({
        data: scored.map((s) => ({
          bookClaimId: bookClaim.id,
          claimId: s.id,
          similarityScore: s.score,
          matchType: classifyMatch(s.score),
        })),
      })
      chunkMatches += scored.length
      totalMatches += scored.length
    }

    console.log(`${claimsText.length} claims, ${chunkMatches} matches`)

    // Light pacing for rate limits
    await sleep(150)
  }

  console.log(
    `\nDone. book=${book.id} chunks=${paragraphs.length} claims=${totalClaims} matches=${totalMatches}`,
  )
  console.log(`View: /reader/${book.id}`)
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('FATAL:', err)
  await prisma.$disconnect()
  process.exit(1)
})
