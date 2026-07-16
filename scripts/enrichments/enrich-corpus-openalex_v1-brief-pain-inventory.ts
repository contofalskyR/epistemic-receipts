// Enrichment: post-publication epistemic trajectory for the Brief Pain Inventory (BPI).
//
// Claim: Cleeland CS & Ryan KM, "Pain assessment: global use of the Brief Pain
// Inventory," Ann Acad Med Singapore 1994;23(2):129-38 (PMID 8080219, no DOI,
// OpenAlex W2320909684). The baseline fromAxis=null -> RECORDED row (1994-03-01)
// already exists and is NOT re-created here.
//
// Post-publication event: the BPI is a measurement instrument, not an empirical
// claim subject to retraction or replication. Its status was adjudicated by the
// IMMPACT consensus recommendations (Dworkin et al., Pain 2005;113(1-2):9-19,
// DOI 10.1016/j.pain.2004.09.012, PMID 15621359), which selected core outcome
// measures for chronic-pain clinical trials and endorsed the BPI interference
// scale as a recommended measure of pain-related interference with functioning.
// This is a dated, citable field-consensus endorsement => RECORDED -> SETTLED.
//
// Idempotent: upserts on source externalId and ClaimStatusHistory id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-brief-pain-inventory.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmpm0d8720frjsat0xwvnfdd9'

async function main() {
  // ── RECORDED -> SETTLED: IMMPACT consensus recommends the BPI (Jan 2005) ──
  await prisma.source.upsert({
    where: { externalId: 'src:immpact-core-outcome-measures-2005' },
    create: {
      externalId: 'src:immpact-core-outcome-measures-2005',
      name: 'Dworkin RH et al. (IMMPACT), "Core outcome measures for chronic pain clinical trials: IMMPACT recommendations," Pain 2005;113(1-2):9-19',
      url: 'https://doi.org/10.1016/j.pain.2004.09.012',
      publishedAt: new Date('2005-01-01'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Dworkin RH et al. (IMMPACT), "Core outcome measures for chronic pain clinical trials: IMMPACT recommendations," Pain 2005;113(1-2):9-19',
      url: 'https://doi.org/10.1016/j.pain.2004.09.012',
      publishedAt: new Date('2005-01-01'),
      methodologyType: 'derivative',
    },
  })

  const settledId = `${claimId}-SETTLED-2005-01-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2005-01-01'),
      datePrecision: 'MONTH',
      reason:
        'The IMMPACT consensus (Dworkin et al., Pain 2005) established core outcome measures for chronic-pain clinical trials and endorsed the Brief Pain Inventory interference scale as a recommended measure of pain-related interference with functioning. This expert-consensus adoption of the BPI as a standard assessment instrument, alongside its validation across many languages and clinical settings, settles the instrument in the expert literature.',
      sourceExternalId: 'src:immpact-core-outcome-measures-2005',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2005-01-01'),
      datePrecision: 'MONTH',
      reason:
        'The IMMPACT consensus (Dworkin et al., Pain 2005) established core outcome measures for chronic-pain clinical trials and endorsed the Brief Pain Inventory interference scale as a recommended measure of pain-related interference with functioning. This expert-consensus adoption of the BPI as a standard assessment instrument, alongside its validation across many languages and clinical settings, settles the instrument in the expert literature.',
      sourceExternalId: 'src:immpact-core-outcome-measures-2005',
    },
  })

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
