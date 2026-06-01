// One-time backfill: fix broken/non-human-readable source URLs for three pipelines.
//
// openfda_labels_v1 — API JSON endpoints → DailyMed drug info pages
//   old: https://api.fda.gov/drug/label.json?search=id:{setId}
//   new: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={setId}
//
// rxnorm_v1 — REST JSON endpoints → RxNav human-readable pages
//   old: https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/properties.json
//   new: https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm={rxcui}
//
// openfda_v1 — fragile PDF letter URLs → stable CDER drug approval overview
//   old: https://www.accessdata.fda.gov/drugsatfda_docs/appletter/{year}/{appNum}...ltr.pdf
//   new: https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo={numericPart}
//
// Run: npx tsx --tsconfig tsconfig.scripts.json scripts/backfill-source-urls.ts [--dry-run]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

if (DRY_RUN) console.log('[dry-run mode — no writes]\n')

async function fixLabels(): Promise<number> {
  const sources = await prisma.source.findMany({
    where: {
      ingestedBy: 'openfda_labels_v1',
      url: { startsWith: 'https://api.fda.gov/drug/label.json?search=id:' },
      deleted: false,
    },
    select: { id: true, url: true },
  })

  let updated = 0
  for (const s of sources) {
    if (!s.url) continue
    const setId = s.url.split('id:')[1]
    if (!setId) continue
    const newUrl = `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setId}`
    if (!DRY_RUN) {
      await prisma.source.update({ where: { id: s.id }, data: { url: newUrl } })
    }
    updated++
  }
  return updated
}

async function fixRxNorm(): Promise<number> {
  const sources = await prisma.source.findMany({
    where: {
      ingestedBy: 'rxnorm_v1',
      url: { contains: 'rxnav.nlm.nih.gov/REST/rxcui/' },
      deleted: false,
    },
    select: { id: true, externalId: true },
  })

  let updated = 0
  for (const s of sources) {
    if (!s.externalId) continue
    const rxcui = s.externalId.replace('rxnorm_source_', '')
    if (!rxcui) continue
    const newUrl = `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${rxcui}`
    if (!DRY_RUN) {
      await prisma.source.update({ where: { id: s.id }, data: { url: newUrl } })
    }
    updated++
  }
  return updated
}

async function fixOpenFDAApprovals(): Promise<number> {
  const sources = await prisma.source.findMany({
    where: {
      ingestedBy: 'openfda_v1',
      url: { contains: 'accessdata.fda.gov/drugsatfda_docs/appletter' },
      deleted: false,
    },
    select: { id: true, externalId: true },
  })

  let updated = 0
  for (const s of sources) {
    if (!s.externalId) continue
    const numericPart = s.externalId.replace(/[^0-9]/g, '')
    if (!numericPart) continue
    const newUrl = `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${numericPart}`
    if (!DRY_RUN) {
      await prisma.source.update({ where: { id: s.id }, data: { url: newUrl } })
    }
    updated++
  }
  return updated
}

async function main() {
  console.log('=== backfill-source-urls ===\n')

  const [labels, rxnorm, fda] = await Promise.all([
    fixLabels(),
    fixRxNorm(),
    fixOpenFDAApprovals(),
  ])

  console.log(`openfda_labels_v1 → DailyMed:  ${labels} sources ${DRY_RUN ? 'would be ' : ''}updated`)
  console.log(`rxnorm_v1         → RxNav:     ${rxnorm} sources ${DRY_RUN ? 'would be ' : ''}updated`)
  console.log(`openfda_v1        → CDER page: ${fda} sources ${DRY_RUN ? 'would be ' : ''}updated`)
  console.log(`\nTotal: ${labels + rxnorm + fda}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
