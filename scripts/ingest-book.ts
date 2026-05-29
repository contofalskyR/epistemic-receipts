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
import * as os from 'node:os'
import { exec, execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import pdfParse from 'pdf-parse'

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

const CONCURRENCY = 10
const MAX_MATCHES_PER_CLAIM = 3
const PLACEHOLDER_SIMILARITY = 0.82

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

function parseClaimsFromOutput(output: string): string[] {
  const arrayStart = output.indexOf('[')
  const arrayEnd = output.lastIndexOf(']')
  if (arrayStart === -1 || arrayEnd === -1 || arrayEnd <= arrayStart) return []
  try {
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

function extractClaims(chunkText: string): Promise<string[]> {
  const escaped = chunkText.replace(/'/g, "'\\''")
  const prompt =
    `Extract all discrete, verifiable factual claims from this passage. ` +
    `Return ONLY a JSON array of strings, each string being one atomic factual claim. ` +
    `Example: ["The Earth orbits the Sun", "Water boils at 100°C"]. ` +
    `Passage: ${escaped}`

  return new Promise((resolve) => {
    exec(`claude --print '${prompt}'`, { timeout: 90000 }, (err, stdout) => {
      if (err) { resolve([]); return }
      resolve(parseClaimsFromOutput(stdout))
    })
  })
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
  let raw: string
  if (filePath.toLowerCase().endsWith('.pdf')) {
    const pdfBuffer = fs.readFileSync(filePath)
    const parsed = await pdfParse(pdfBuffer)
    if (parsed.text.trim().length > 20) {
      raw = parsed.text
    } else {
      // Image-based PDF — OCR with pdftoppm + tesseract
      console.log('No embedded text; running OCR…')
      const tmpDir = fs.mkdtempSync(path.join(os.homedir(), '.pdf-ocr-'))
      try {
        execSync(`pdftoppm -r 300 -png "${filePath}" "${tmpDir}/page"`)
        const pages = fs.readdirSync(tmpDir).filter(f => f.endsWith('.png')).sort()
        const pageTexts: string[] = []
        for (const pg of pages) {
          const imgPath = path.join(tmpDir, pg)
          const outBase = path.join(tmpDir, pg.replace('.png', ''))
          execSync(`tesseract "${imgPath}" "${outBase}" -l eng 2>/dev/null`)
          pageTexts.push(fs.readFileSync(`${outBase}.txt`, 'utf-8'))
        }
        raw = pageTexts.join('\n\n')
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    }
  } else {
    raw = fs.readFileSync(filePath, 'utf-8')
  }
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

  // Extract claims for all chunks in parallel (CONCURRENCY workers)
  console.log(`Extracting claims with concurrency=${CONCURRENCY}…`)
  const extractions: Array<{ chunkId: string; paragraphIndex: number; claims: string[] }> =
    dbChunks.map((ch) => ({ chunkId: ch.id, paragraphIndex: ch.paragraphIndex, claims: [] }))

  let done = 0
  await runWithConcurrency(extractions, CONCURRENCY, async (entry) => {
    const ch = dbChunks.find((c) => c.id === entry.chunkId)!
    entry.claims = await extractClaims(ch.text)
    done++
    if (done % 50 === 0 || done === dbChunks.length)
      console.log(`  ${done}/${dbChunks.length} chunks processed`)
  })

  // Store claims + matches sequentially (DB writes need ordered positionIndex)
  let positionIndex = 0
  let totalClaims = 0
  let totalMatches = 0

  for (const { chunkId, claims } of extractions) {
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
  console.log(`Claims stored: ${totalClaims}, matches: ${totalMatches}`)

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
