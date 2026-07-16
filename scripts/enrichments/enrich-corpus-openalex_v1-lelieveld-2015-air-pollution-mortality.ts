// Enrichment: post-publication epistemic trajectory for Lelieveld, Evans, Fnais,
// Giannadaki & Pozzer (2015), "The contribution of outdoor air pollution sources
// to premature mortality on a global scale," Nature 525(7569):367–371,
// DOI 10.1038/nature15371. OpenAlex W2141970008. PubMed 26381985.
// Claim id: cmq2w58oh00rfsa8h6pa5puja.
//
// Baseline row (fromAxis=null -> RECORDED at 2015-09-01) already exists; NOT duplicated here.
//
// Added arc:
//   RECORDED -> SETTLED (2021-06-14): The GBD MAPS peer-reviewed analysis
//   (McDuffie, Martin, Spadaro, Burnett, ... Brauer, "Source sector and fuel
//   contributions to ambient PM2.5 and attributable mortality across multiple
//   spatial scales," Nature Communications 12:3594, 2021,
//   DOI 10.1038/s41467-021-23853-y) is an independent, systematic, source-resolved
//   attribution of ambient PM2.5 mortality across 21 regions and 204 countries. It
//   reproduces and refines the atmospheric-chemistry + concentration-response
//   source-apportionment method that Lelieveld et al. 2015 introduced, and confirms
//   its core finding: outdoor air-pollution SOURCES (fossil-fuel combustion,
//   residential energy, etc.) are major, quantifiable contributors to global
//   premature mortality. This dated, peer-reviewed systematic analysis establishes
//   the source-attribution finding as accepted, standard method in expert literature.
//
// No retraction, expression of concern, erratum, or dated failed replication was
// found (Retraction Watch / Nature / PubMed all clean; isRetracted=false). The
// contemporaneous Jerrett News & Views (Nature 525:330, 2015) is same-issue
// commentary with a caveat, not a post-publication contest — no CONTESTED step added.
//
// Idempotent: upserts on externalId / id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-lelieveld-2015-air-pollution-mortality.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-lelieveld-2015-air-pollution-mortality.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w58oh00rfsa8h6pa5puja'

async function main() {
  // ── RECORDED -> SETTLED : GBD MAPS systematic source-attribution corroboration (2021) ──
  const sourceExternalId = 'src:gbd-maps-mcduffie-natcomms-2021'
  const sourceData = {
    name: 'McDuffie EE, Martin RV, Spadaro JV, Burnett R, Smith SJ, O\u2019Rourke P, Hammer MS, van Donkelaar A, et al. Source sector and fuel contributions to ambient PM2.5 and attributable mortality across multiple spatial scales. Nature Communications 2021;12:3594.',
    url: 'https://doi.org/10.1038/s41467-021-23853-y',
    publishedAt: new Date('2021-06-14'),
    methodologyType: 'derivative',
  }

  const occurredAt = new Date('2021-06-14')
  const historyId = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  const historyData = {
    claimId: CLAIM_ID,
    fromAxis: 'RECORDED' as const,
    toAxis: 'SETTLED' as const,
    community: 'EXPERT_LITERATURE' as const,
    occurredAt,
    datePrecision: 'DAY' as const,
    reason:
      'The GBD MAPS analysis (McDuffie et al., Nature Communications 12:3594, 2021) is an independent, peer-reviewed, systematic source-resolved attribution of ambient PM2.5 mortality across 21 world regions and 204 countries. It reproduces and refines the atmospheric-chemistry + concentration-response source-apportionment method Lelieveld et al. 2015 introduced, and confirms its core finding that outdoor air-pollution sources (fossil-fuel combustion, residential energy, etc.) are major, quantifiable contributors to global premature mortality. A dated, systematic evaluation establishing the source-attribution finding as accepted method in expert literature; the paper is neither retracted nor overturned.',
  }

  if (DRY_RUN) {
    console.log('[dry-run] would upsert source:', sourceExternalId)
    console.log('[dry-run] would upsert claimStatusHistory:', historyId)
    console.log(JSON.stringify({ source: sourceData, history: historyData }, null, 2))
    await prisma.$disconnect()
    return
  }

  await prisma.source.upsert({
    where: { externalId: sourceExternalId },
    create: { externalId: sourceExternalId, ...sourceData },
    update: sourceData,
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: historyId },
    create: { id: historyId, ...historyData },
    update: historyData,
  })

  console.log('Upserted source + claimStatusHistory:', historyId)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
