// Extract per-chunk claims for an already-uploaded book (has BookChunks, no BookClaims).
// Run: npx tsx scripts/extract-book-claims.ts --book <bookId>

import * as fs from 'node:fs'
import * as path from 'node:path'
import { exec } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}
loadEnvLocal()

const prisma = new PrismaClient()
const CONCURRENCY = 8

const BOOK_ID = (() => {
  const idx = process.argv.indexOf('--book')
  return idx !== -1 ? process.argv[idx + 1] : undefined
})()

if (!BOOK_ID) {
  console.error('Usage: npx tsx scripts/extract-book-claims.ts --book <bookId>')
  process.exit(1)
}

function extractClaims(chunkText: string): Promise<string[]> {
  const escaped = chunkText.replace(/'/g, "'\\''").replace(/\n/g, ' ')
  const prompt =
    `Extract all discrete, verifiable factual claims from this passage. ` +
    `Return ONLY a JSON array of strings, each one atomic. ` +
    `Example: ["Violence has declined over centuries", "The homicide rate fell by 50%"]. ` +
    `Passage: ${escaped}`

  return new Promise((resolve) => {
    exec(`claude --print '${prompt}'`, { timeout: 90000 }, (err, stdout) => {
      if (err) { resolve([]); return }
      const start = stdout.indexOf('[')
      const end = stdout.lastIndexOf(']')
      if (start === -1 || end <= start) { resolve([]); return }
      try {
        const parsed: unknown = JSON.parse(stdout.slice(start, end + 1))
        if (!Array.isArray(parsed)) { resolve([]); return }
        resolve(parsed.filter((s): s is string => typeof s === 'string').map(s => s.trim()).filter(s => s.length > 0))
      } catch { resolve([]) }
    })
  })
}

async function runWithConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0
  async function worker() {
    while (i < items.length) { const item = items[i++]; await fn(item) }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
}

async function main() {
  const book = await prisma.book.findUnique({ where: { id: BOOK_ID! }, select: { id: true, title: true } })
  if (!book) { console.error(`Book ${BOOK_ID} not found`); process.exit(1) }
  console.log(`Book: "${book.title}" (${book.id})`)

  const existing = await prisma.bookClaim.count({ where: { chunk: { bookId: book.id } } })
  if (existing > 0) { console.log(`Already has ${existing} claims — skipping extraction`); process.exit(0) }

  const chunks = await prisma.bookChunk.findMany({
    where: { bookId: book.id },
    orderBy: { paragraphIndex: 'asc' },
    select: { id: true, text: true, paragraphIndex: true },
  })
  console.log(`Processing ${chunks.length} chunks with concurrency=${CONCURRENCY}…`)

  const results: Array<{ chunkId: string; claims: string[] }> =
    chunks.map(c => ({ chunkId: c.id, claims: [] }))

  let done = 0
  await runWithConcurrency(results, CONCURRENCY, async (entry) => {
    const chunk = chunks.find(c => c.id === entry.chunkId)!
    entry.claims = await extractClaims(chunk.text)
    done++
    if (done % 20 === 0 || done === chunks.length)
      process.stdout.write(`\r  ${done}/${chunks.length} chunks, ${results.slice(0, done).reduce((s, r) => s + r.claims.length, 0)} claims so far`)
  })
  console.log()

  let positionIndex = 0
  let totalClaims = 0
  for (const { chunkId, claims } of results) {
    if (claims.length === 0) continue
    await prisma.bookClaim.createMany({
      data: claims.map(claimText => ({ chunkId, claimText, positionIndex: positionIndex++ })),
    })
    totalClaims += claims.length
  }

  console.log(`Done — ${totalClaims} BookClaim rows written for ${chunks.length} chunks`)
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error('FATAL:', err)
  await prisma.$disconnect()
  process.exit(1)
})
