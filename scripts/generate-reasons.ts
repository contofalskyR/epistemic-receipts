/**
 * generate-reasons.ts
 * Fetches BookClaimMatch rows with null reasons for a given book,
 * generates explanations via claude --print, writes directly to DB.
 * Usage: BOOK_ID=xxx npx ts-node --project tsconfig.scripts.json scripts/generate-reasons.ts
 */

import { PrismaClient } from '@prisma/client'
import { execFileSync } from 'child_process'

const prisma = new PrismaClient()
const BOOK_ID = process.env.BOOK_ID
const BATCH_SIZE = 20

if (!BOOK_ID) { console.error('BOOK_ID env required'); process.exit(1) }

type MatchRow = { id: string; bookText: string; dbText: string; matchType: string }

async function callClaude(batch: MatchRow[]): Promise<{ id: string; reason: string }[]> {
  const items = batch.map((m, i) =>
    `${i}. [${m.matchType}] BookClaim: "${m.bookText.slice(0, 200)}" | DBClaim: "${m.dbText.slice(0, 200)}"`
  ).join('\n')

  const prompt = `For each pair below, write a single concise sentence (max 180 chars) explaining HOW the DB claim relates to the book claim. Be specific — mention actual content. Output ONLY a valid JSON array with no other text: [{"index":0,"reason":"..."},...]

${items}`

  const out = execFileSync('claude', ['--print', '--model', 'claude-haiku-4-5-20251001', prompt], {
    encoding: 'utf-8',
    timeout: 90000,
  })

  const match = out.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`No JSON array in output: ${out.slice(0, 300)}`)
  const arr: { index: number; reason: string }[] = JSON.parse(match[0])
  return arr
    .filter(r => typeof r.index === 'number' && batch[r.index] && r.reason)
    .map(r => ({ id: batch[r.index].id, reason: r.reason.slice(0, 500) }))
}

async function writeReasons(results: { id: string; reason: string }[]) {
  for (const r of results) {
    await prisma.bookClaimMatch.update({
      where: { id: r.id },
      data: { reason: r.reason },
    })
  }
}

async function main() {
  console.log(`Fetching null-reason matches for book ${BOOK_ID}...`)

  const rows = await prisma.$queryRaw<MatchRow[]>`
    SELECT bcm.id, bc."claimText" as "bookText", c.text as "dbText", bcm."matchType"
    FROM "BookClaimMatch" bcm
    JOIN "BookClaim" bc ON bcm."bookClaimId" = bc.id
    JOIN "BookChunk" bch ON bc."chunkId" = bch.id
    JOIN "Claim" c ON bcm."claimId" = c.id
    WHERE bch."bookId" = ${BOOK_ID}
      AND (bcm.reason IS NULL OR bcm.reason = '')
    ORDER BY bcm."similarityScore" DESC
  `

  console.log(`Found ${rows.length} matches needing reasons`)
  if (rows.length === 0) { await prisma.$disconnect(); return }

  let done = 0
  let errors = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    try {
      const results = await callClaude(batch)
      await writeReasons(results)
      done += results.length
      process.stdout.write(`\r  Progress: ${done}/${rows.length} (${errors} errors)`)
    } catch (e) {
      errors++
      console.error(`\n  Batch ${i}–${i + BATCH_SIZE} failed:`, (e as Error).message?.slice(0, 120))
    }
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\nDone. ${done} reasons written, ${errors} batch errors.`)

  if (process.env.TELEGRAM_NOTIFY === 'true') {
    try {
      execFileSync('openclaw', ['message', 'send', '--channel', 'telegram', '--target', '7688025079',
        '--message', `✅ Reasons generated for book ${BOOK_ID}: ${done} written, ${errors} errors.`])
    } catch {}
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
