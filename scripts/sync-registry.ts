// Print a markdown table of active pipeline claim counts, ordered by count desc.
// Usage:  npx dotenv-cli -e .env.local -- npx tsx scripts/sync-registry.ts
//
// Paste the output into the <!-- BEGIN:active-pipelines --> block in AGENTS.md.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT "ingestedBy", COUNT(*)::int AS count
     FROM "Claim"
     WHERE deleted = false
     GROUP BY "ingestedBy"
     ORDER BY count DESC`,
  )) as Array<{ ingestedBy: string; count: number }>

  const today = new Date().toISOString().slice(0, 10)
  const total = rows.reduce((s, r) => s + r.count, 0)

  console.log(`<!-- Last synced from DB: ${today}. Total active claims: ${total.toLocaleString()} across ${rows.length} pipelines. -->`)
  console.log()
  console.log('| Tag | Claims |')
  console.log('|---|---|')
  for (const r of rows) {
    console.log(`| \`${r.ingestedBy}\` | ${r.count.toLocaleString()} |`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
