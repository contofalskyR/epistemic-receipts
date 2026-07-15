// Enrichment: epistemic trajectory for Stupp et al. 2005 NEJM glioblastoma trial.
//
// Claim: cmply4azr0043saihaxwyoldb
// "Radiotherapy plus Concomitant and Adjuvant Temozolomide for Glioblastoma"
// Stupp R, Mason WP, van den Bent MJ, et al. N Engl J Med 2005;352:987-996.
// DOI 10.1056/nejmoa043330 · OpenAlex W2096287682
//
// Post-publication event: the EORTC-NCIC trial's 5-year analysis (Stupp et al.,
// Lancet Oncol 2009) confirmed the durable overall-survival benefit of adding
// temozolomide to radiotherapy, cementing the "Stupp protocol" as standard of
// care for newly diagnosed glioblastoma. Vindicating follow-up of the same RCT.
// No retraction, erratum, or expression of concern exists for the 2005 paper.
//
// Arc: RECORDED (2005-03) --> SETTLED (2009-05, EXPERT_LITERATURE)
// The baseline RECORDED row (fromAxis=null) already exists; do NOT duplicate it.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-stupp-2005-temozolomide-glioblastoma.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply4azr0043saihaxwyoldb'

async function main() {
  // ── SETTLED: 5-year analysis confirms durable survival benefit ──
  await prisma.source.upsert({
    where: { externalId: 'src:stupp-2009-5yr-eortc-ncic' },
    create: {
      externalId: 'src:stupp-2009-5yr-eortc-ncic',
      name: 'Stupp R, Hegi ME, Mason WP, et al. Effects of radiotherapy with concomitant and adjuvant temozolomide versus radiotherapy alone on survival in glioblastoma in a randomised phase III study: 5-year analysis of the EORTC-NCIC trial. Lancet Oncol. 2009;10(5):459-466.',
      url: 'https://doi.org/10.1016/S1470-2045(09)70025-7',
      publishedAt: new Date('2009-05-01'),
      methodologyType: 'primary',
    },
    update: {
      name: 'Stupp R, Hegi ME, Mason WP, et al. Effects of radiotherapy with concomitant and adjuvant temozolomide versus radiotherapy alone on survival in glioblastoma in a randomised phase III study: 5-year analysis of the EORTC-NCIC trial. Lancet Oncol. 2009;10(5):459-466.',
      url: 'https://doi.org/10.1016/S1470-2045(09)70025-7',
      publishedAt: new Date('2009-05-01'),
      methodologyType: 'primary',
    },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${CLAIM_ID}-SETTLED-2009-05-01` },
    create: {
      id: `${CLAIM_ID}-SETTLED-2009-05-01`,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2009-05-01'),
      datePrecision: 'MONTH',
      reason:
        'The 5-year analysis of the same EORTC-NCIC randomised phase III trial (Lancet Oncol 2009) confirmed that adding temozolomide to radiotherapy produced a durable overall-survival benefit — 5-year survival of 9.8% versus 1.9% — persisting well beyond the original 2005 report. This long-term follow-up vindicated the initial finding and established the "Stupp protocol" as the standard of care for newly diagnosed glioblastoma in expert literature.',
      source: { connect: { externalId: 'src:stupp-2009-5yr-eortc-ncic' } },
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2009-05-01'),
      datePrecision: 'MONTH',
      reason:
        'The 5-year analysis of the same EORTC-NCIC randomised phase III trial (Lancet Oncol 2009) confirmed that adding temozolomide to radiotherapy produced a durable overall-survival benefit — 5-year survival of 9.8% versus 1.9% — persisting well beyond the original 2005 report. This long-term follow-up vindicated the initial finding and established the "Stupp protocol" as the standard of care for newly diagnosed glioblastoma in expert literature.',
      source: { connect: { externalId: 'src:stupp-2009-5yr-eortc-ncic' } },
    },
  })

  console.log('Enrichment complete: RECORDED -> SETTLED (2009-05) for', CLAIM_ID)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
