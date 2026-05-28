// Book Analysis Pipeline — ingest a plain-text book, extract per-paragraph
// claims via the `claude` CLI (uses your existing subscription, no API key needed),
// and cross-reference each book claim against the canonical Claim table.
//
// Run: npx tsx scripts/ingest-book.ts <path> <title> [author]
//
// Required env (read from .env.local or process env):
//   DATABASE_URL — Neon Postgres (Prisma)
//
// Matching is a placeholder text-contains query against Claim.text — every
// stored match gets matchType=RELATED and similarityScore=0.7 until the
// pgvector cosine path lands.

import 'dotenv/config'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

// Manually load .env.local so the bare `npx tsx scripts/ingest-book.ts ...`
// command works without a dotenv-cli wrapper.
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

const BATCH_SIZE = 20
const MAX_MATCHES_PER_CLAIM = 3
const PLACEHOLDER_SIMILARITY = 0.7

interface ParsedChunk {
  paragraphIndex: number
  text: string
}

function parseBookText(raw: string): ParsedChunk[] {
  return raw
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((text, paragraphIndex) => ({ paragraphIndex, text }))
}

function extractClaims(chunkText: string): string[] {
  const prompt =
    `Extract all discrete, verifiable factual claims from this passage. ` +
    `Return ONLY a JSON array of strings, each string being one atomic factual claim. ` +
    `Example: ["The Earth orbits the Sun", "Water boils at 100°C"]. ` +
    `Passage: ${chunkText.replace(/'/g, "'\\''")}`

  try {
    const output = execSync(`claude --print '${prompt}'`, {
      encoding: 'utf-8',
      timeout: 60000,
    })
    const arrayStart = output.indexOf('[')
    const arrayEnd = output.lastIndexOf(']')
    if (arrayStart === -1 || arrayEnd === -1 || arrayEnd <= arrayStart) return []
    const parsed: unknown = JSON.parse(output.slice(arrayStart, arrayEnd + 1))
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  } catch {
    return []
  }
}

const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'because', 'before', 'being', 'between',
  'could', 'during', 'every', 'first', 'often', 'other', 'should', 'still',
  'their', 'there', 'these', 'they', 'this', 'those', 'through', 'under',
  'until', 'where', 'which', 'while', 'would', 'might', 'shall', 'whose',
  'would', 'years', 'world', 'people',
])

function keywordsFrom(claimText: string): string[] {
  const tokens = claimText
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 4 && !STOPWORDS.has(w))
  return Array.from(new Set(tokens)).slice(0, 5)
}

async function findCandidateMatches(claimText: string): Promise<string[]> {
  const keywords = keywordsFrom(claimText)
  if (keywords.length === 0) return []

  const candidates = await prisma.claim.findMany({
    where: {
      deleted: false,
      OR: keywords.map((w) => ({
        text: { contains: w, mode: 'insensitive' as const },
      })),
    },
    select: { id: true },
    take: MAX_MATCHES_PER_CLAIM,
  })
  return candidates.map((c) => c.id)
}

async function main() {
  const [rawFilePath, title, author] = process.argv.slice(2)
  if (!rawFilePath || !title) {
    console.error('Usage: npx tsx scripts/ingest-book.ts <path> <title> [author]')
    process.exit(1)
  }

  const filePath = path.resolve(rawFilePath)
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  console.log(`Reading ${filePath}…`)
  const raw = fs.readFileSync(filePath, 'utf-8')
  const chunks = parseBookText(raw)
  console.log(`Parsed ${chunks.length} paragraph chunks`)

  const book = await prisma.book.create({
    data: { title, author: author ?? null, sourceUrl: null },
  })
  console.log(`Created Book ${book.id}: "${title}"${author ? ` by ${author}` : ''}`)

  await prisma.bookChunk.createMany({
    data: chunks.map((c) => ({
      bookId: book.id,
      paragraphIndex: c.paragraphIndex,
      text: c.text,
    })),
  })
  const dbChunks = await prisma.bookChunk.findMany({
    where: { bookId: book.id },
    orderBy: { paragraphIndex: 'asc' },
    select: { id: true, text: true, paragraphIndex: true },
  })
  console.log(`Inserted ${dbChunks.length} BookChunk rows`)

  let positionIndex = 0
  let totalClaims = 0
  let totalMatches = 0

  for (let batchStart = 0; batchStart < dbChunks.length; batchStart += BATCH_SIZE) {
    const batch = dbChunks.slice(batchStart, batchStart + BATCH_SIZE)
    console.log(
      `Batch ${batchStart + 1}–${batchStart + batch.length} of ${dbChunks.length}: ` +
        `extracting claims via ${MODEL}…`,
    )

    const batchExtractions: Array<{ chunkId: string; claims: string[] }> = []
    for (const ch of batch) {
      try {
        const claims = extractClaims(ch.text)
        batchExtractions.push({ chunkId: ch.id, claims })
      } catch (err) {
        console.warn(
          `  chunk ${ch.id} (¶${ch.paragraphIndex}) failed: ${(err as Error).message}`,
        )
        batchExtractions.push({ chunkId: ch.id, claims: [] })
      }
    }

    for (const { chunkId, claims } of batchExtractions) {
      for (const claimText of claims) {
        const bookClaim = await prisma.bookClaim.create({
          data: { chunkId, claimText, positionIndex: positionIndex++ },
        })
        totalClaims++

        const matchClaimIds = await findCandidateMatches(claimText)
        if (matchClaimIds.length > 0) {
          await prisma.bookClaimMatch.createMany({
            data: matchClaimIds.map((cid) => ({
              bookClaimId: bookClaim.id,
              claimId: cid,
              similarityScore: PLACEHOLDER_SIMILARITY,
              matchType: 'RELATED',
            })),
          })
          totalMatches += matchClaimIds.length
        }
      }
    }
    console.log(`  cumulative: ${totalClaims} book claims, ${totalMatches} matches`)
  }

  console.log(
    `Done. Book ${book.id}: ${totalClaims} claims across ${dbChunks.length} paragraphs, ${totalMatches} matches.`,
  )
  console.log(`View: /reader/${book.id}`)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('FATAL:', err)
  await prisma.$disconnect()
  process.exit(1)
})
