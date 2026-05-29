// Enrich BookClaimMatch rows with LLM-generated reason text.
// Matches where Claude returns "NULL" are dropped (no meaningful connection).
//
// Run: npx ts-node --project tsconfig.scripts.json scripts/enrich-match-reasons.ts
// Flags:
//   --dry-run   Log what would happen without writing to DB

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
const CONCURRENCY = 15
const DRY_RUN = process.argv.includes('--dry-run')
const BOOK_ID = (() => {
  const idx = process.argv.indexOf('--book')
  return idx !== -1 ? process.argv[idx + 1] : undefined
})()

function callClaude(sourceText: string, matchedClaim: string): Promise<string | null> {
  const prompt = [
    'SOURCE DOCUMENT TEXT:',
    sourceText,
    '',
    'MATCHED CLAIM:',
    matchedClaim,
    '',
    'Extract the exact verbatim phrase or sentence from the SOURCE DOCUMENT TEXT that most directly proves, cites, or supports the MATCHED CLAIM.',
    'Return only the quote — no explanation, no prefix, no quotation marks.',
    'If the source text does not contain any language that directly proves or cites the claim, reply with exactly: NULL',
  ].join('\n')

  const escaped = prompt.replace(/'/g, "'\\''")

  return new Promise((resolve) => {
    exec(`claude --print '${escaped}'`, { timeout: 60000 }, (err, stdout) => {
      if (err) { resolve(null); return }
      const trimmed = stdout.trim()
      resolve(trimmed || null)
    })
  })
}

async function processChunk(
  batch: Array<{
    id: string
    bookClaim: { chunk: { text: string } }
    claim: { text: string }
  }>,
  counters: { enriched: number; dropped: number; errors: number; total: number },
) {
  await Promise.all(
    batch.map(async (match) => {
      const response = await callClaude(match.bookClaim.chunk.text, match.claim.text)

      if (response === null) {
        counters.errors++
        console.error(`[error] match ${match.id} — claude returned nothing`)
        return
      }

      const isNull = response.trim().toUpperCase() === 'NULL'

      if (DRY_RUN) {
        if (isNull) {
          console.log(`[dry-run][would drop] match ${match.id}`)
        } else {
          console.log(`[dry-run][would enrich] match ${match.id}: ${response.slice(0, 80)}…`)
        }
        counters.enriched++
        return
      }

      if (isNull) {
        await prisma.bookClaimMatch.delete({ where: { id: match.id } })
        counters.dropped++
      } else {
        await prisma.bookClaimMatch.update({
          where: { id: match.id },
          data: { reason: response },
        })
        counters.enriched++
      }
    }),
  )
}

async function main() {
  if (DRY_RUN) console.log('[dry-run mode — no DB writes]\n')
  if (BOOK_ID) console.log(`Scoped to book: ${BOOK_ID}\n`)

  const matches = await prisma.bookClaimMatch.findMany({
    where: {
      reason: null,
      ...(BOOK_ID ? { bookClaim: { chunk: { bookId: BOOK_ID } } } : {}),
    },
    select: {
      id: true,
      bookClaim: { select: { chunk: { select: { text: true } } } },
      claim: { select: { text: true } },
    },
  })

  const total = matches.length
  console.log(`Found ${total} matches with no reason. Starting enrichment…`)

  const counters = { enriched: 0, dropped: 0, errors: 0, total }

  for (let i = 0; i < matches.length; i += CONCURRENCY) {
    const batch = matches.slice(i, i + CONCURRENCY)
    await processChunk(batch, counters)

    const done = Math.min(i + CONCURRENCY, total)
    console.log(
      `[enriched] ${counters.enriched}/${total} | [dropped] ${counters.dropped} | [errors] ${counters.errors} | progress ${done}/${total}`,
    )
  }

  console.log('\nDone.')
  console.log(`Enriched: ${counters.enriched} | Dropped: ${counters.dropped} | Errors: ${counters.errors}`)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('FATAL:', err)
  await prisma.$disconnect()
  process.exit(1)
})
