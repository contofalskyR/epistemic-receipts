/**
 * fix-broken-links.ts
 * Nulls out Source.url for confirmed-broken URLs (404/SSL/ECONNREFUSED).
 * Claims and edges remain intact — only the dead hyperlink is removed.
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Fixing broken links in Source table ===\n')

  // Phase 1: Domain-level bulk fixes
  const domainFixes = [
    { pattern: '%aa.archives.gov.tw/ELK/%', label: 'Taiwan ROC Archives (site restructured)' },
    { pattern: '%elaw.klri.re.kr/eng_service/%', label: 'Korean Law English (service removed)' },
  ]

  let totalFixed = 0

  for (const { pattern, label } of domainFixes) {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "Source" SET url = NULL WHERE url LIKE $1`,
      pattern
    )
    console.log(`  ${label}: ${result} sources fixed`)
    totalFixed += result
  }

  // Phase 2: Remaining broken URLs (FEC, DOIs, misc)
  const brokenUrls = readFileSync('/tmp/broken-404.txt', 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(u => u.trim())
    .filter(u => !u.includes('aa.archives.gov.tw/ELK/') && !u.includes('elaw.klri.re.kr/eng_service/'))

  console.log(`\n  Remaining individual broken URLs: ${brokenUrls.length}`)

  const BATCH = 200
  let batchFixed = 0

  for (let i = 0; i < brokenUrls.length; i += BATCH) {
    const batch = brokenUrls.slice(i, i + BATCH)
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "Source" SET url = NULL WHERE url = ANY($1::text[])`,
      batch
    )
    batchFixed += result
    if (i % 2000 === 0 && i > 0) {
      console.log(`    Progress: ${i}/${brokenUrls.length}, ${batchFixed} fixed so far`)
    }
  }

  totalFixed += batchFixed
  console.log(`  Individual URLs: ${batchFixed} sources fixed`)
  console.log(`\n=== TOTAL: ${totalFixed} Source rows had broken URLs nulled ===`)
  console.log('(Claims and edges remain intact — only dead hyperlinks removed)')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
