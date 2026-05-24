// One-off migration: infer `result` from yesCount/noCount for all LegislativeVote rows.
// Run: npx tsx scripts/populate-vote-results.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const votes = await prisma.legislativeVote.findMany({
    where: { result: null },
    select: { id: true, yesCount: true, noCount: true },
  })

  console.log(`Found ${votes.length} votes without a result`)

  let passed = 0, failed = 0, tied = 0, unknown = 0

  type Update = { id: string; result: string }
  const updates: Update[] = votes.map(v => {
    let result: string
    if (v.yesCount !== null && v.noCount !== null) {
      if (v.yesCount > v.noCount) result = 'passed'
      else if (v.noCount > v.yesCount) result = 'failed'
      else result = 'tied'
    } else if (v.yesCount !== null && v.yesCount > 0 && v.noCount === null) {
      // EU-style: only yesCount recorded → passed
      result = 'passed'
    } else {
      result = 'unknown'
    }
    if (result === 'passed') passed++
    else if (result === 'failed') failed++
    else if (result === 'tied') tied++
    else unknown++
    return { id: v.id, result }
  })

  const CHUNK = 200
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = updates.slice(i, i + CHUNK)
    await Promise.all(
      batch.map(u => prisma.legislativeVote.update({ where: { id: u.id }, data: { result: u.result } }))
    )
    if ((i + CHUNK) % 1000 === 0 || i + CHUNK >= updates.length) {
      console.log(`  ${Math.min(i + CHUNK, updates.length)}/${updates.length}`)
    }
  }

  console.log(`Done. passed=${passed} failed=${failed} tied=${tied} unknown=${unknown}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
