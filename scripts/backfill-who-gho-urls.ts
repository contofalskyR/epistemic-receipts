// Backfill WHO GHO source URLs after WHO restructured indicator detail pages.
//
// The 5 Source rows (one per indicator) carry URLs that 404 because WHO replaced
// the indicator code segment (e.g. WHOSIS_000001) with kebab-case slugs derived
// from the indicator title. Each Source backs ~200 Claims (1,001 total).
//
// Old:  https://www.who.int/data/gho/data/indicators/indicator-details/GHO/WHOSIS_000001
// New:  https://www.who.int/data/gho/data/indicators/indicator-details/GHO/life-expectancy-at-birth-(years)
//
// Run:  npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-who-gho-urls.ts --dry-run
//       ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-who-gho-urls.ts
//
// Flags: --dry-run (no writes), --limit N (cap sources processed)

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INGESTED_BY = 'who_gho_v1'
const OLD_BASE = 'https://www.who.int/data/gho/data/indicators/indicator-details/GHO/'

// indicator-code -> verified new slug (HEAD-checked 2026-06-06, all 200)
const NEW_SLUGS: Record<string, string> = {
  WHOSIS_000001: 'life-expectancy-at-birth-(years)',
  MDG_0000000001: 'under-five-mortality-rate-(probability-of-dying-by-age-5-per-1000-live-births)',
  SDGPM25: 'concentrations-of-fine-particulate-matter-(pm2-5)',
  SA_0000001462: 'total-(recorded-unrecorded)-alcohol-per-capita-(15-)-consumption',
  NCD_BMI_30A: 'prevalence-of-obesity-among-adults-bmi--30-(age-standardized-estimate)-(-)',
}

function newUrlFor(oldUrl: string): string | null {
  if (!oldUrl.startsWith(OLD_BASE)) return null
  const code = oldUrl.slice(OLD_BASE.length)
  const slug = NEW_SLUGS[code]
  return slug ? OLD_BASE + slug : null
}

async function verify(url: string): Promise<number> {
  const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
  return res.status
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const li = args.indexOf('--limit')
  const limit = li !== -1 ? parseInt(args[li + 1] ?? '0', 10) || 0 : 0

  const writesEnabled = process.env.ALLOW_EDITS === 'true'
  if (!dryRun && !writesEnabled) {
    console.error('Real run requires ALLOW_EDITS=true. (Or pass --dry-run.)')
    process.exit(1)
  }

  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'WRITE'} | Limit: ${limit || 'none'} | Tag: ${INGESTED_BY}\n`)

  const sources = await prisma.source.findMany({
    where: { ingestedBy: INGESTED_BY, deleted: false },
    select: { id: true, url: true, externalId: true, name: true },
    orderBy: { externalId: 'asc' },
    take: limit > 0 ? limit : undefined,
  })

  console.log(`Found ${sources.length} WHO GHO sources.\n`)

  const planned: { id: string; externalId: string | null; oldUrl: string; newUrl: string }[] = []
  for (const s of sources) {
    if (!s.url) {
      console.warn(`  [skip] ${s.externalId} has null url`)
      continue
    }
    const newUrl = newUrlFor(s.url)
    if (!newUrl) {
      console.warn(`  [skip] ${s.externalId} url does not match expected pattern: ${s.url}`)
      continue
    }
    if (newUrl === s.url) {
      console.log(`  [already-new] ${s.externalId}`)
      continue
    }
    planned.push({ id: s.id, externalId: s.externalId, oldUrl: s.url, newUrl })
  }

  console.log(`\nPlanned URL rewrites: ${planned.length}`)
  for (const p of planned) {
    console.log(`  ${p.externalId}`)
    console.log(`    old: ${p.oldUrl}`)
    console.log(`    new: ${p.newUrl}`)
  }

  if (planned.length === 0) {
    console.log('\nNothing to do.')
    return
  }

  console.log('\nVerifying new URLs (HEAD)...')
  const sample = planned.slice(0, Math.min(planned.length, 5))
  for (const p of sample) {
    const status = await verify(p.newUrl)
    console.log(`  HTTP ${status}  ${p.newUrl}`)
    if (status !== 200) {
      console.error(`\nABORT: verification failed for ${p.newUrl} (HTTP ${status})`)
      process.exit(1)
    }
  }

  if (dryRun) {
    console.log('\nDry-run: no DB writes.')
    return
  }

  console.log('\nApplying updates...')
  let updated = 0
  for (const p of planned) {
    await prisma.source.update({ where: { id: p.id }, data: { url: p.newUrl } })
    updated++
  }
  console.log(`\nUpdated ${updated} sources.`)

  const claimCount = await prisma.claim.count({
    where: { ingestedBy: INGESTED_BY, deleted: false },
  })
  console.log(`Claims downstream of these sources: ${claimCount}`)
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
