// Enrichment: post-publication trajectory for the Cholesterol Treatment Trialists'
// (CTT) Collaboration 2005 statin meta-analysis (Lancet 2005;366:1267–78).
//
// Claim: "Efficacy and safety of cholesterol-lowering treatment: prospective
// meta-analysis of data from 90 056 participants in 14 randomised trials of statins"
// DOI: https://doi.org/10.1016/s0140-6736(05)67394-1  ·  OpenAlex: W2247997571
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 2005-09-28) already
// exists — do NOT duplicate it. This script adds the single verified follow-up arc:
//
//   RECORDED -> SETTLED (2010-11-13, EXPERT_LITERATURE)
//     The same CTT Collaboration's larger meta-analysis of 170,000 participants in
//     26 randomised trials (Lancet 2010;376:1670–81, PMID 21067804) confirmed and
//     extended the 2005 finding: each 1.0 mmol/L reduction in LDL cholesterol
//     produced a proportional ~22% reduction in major vascular events, holding
//     across the wider evidence base and for more-intensive lowering. The finding
//     was vindicated, not overturned — no intervening retraction or expression of
//     concern exists.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ctt-statin-meta-analysis-2005.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply8aq2022fsaih862czwpb'

async function main() {
  // ── Source: CTT 2010 meta-analysis (the adjudicating document) ──
  await prisma.source.upsert({
    where: { externalId: 'src:ctt-2010-intensive-ldl-meta-analysis' },
    create: {
      externalId: 'src:ctt-2010-intensive-ldl-meta-analysis',
      name: "Cholesterol Treatment Trialists' (CTT) Collaboration. Efficacy and safety of more intensive lowering of LDL cholesterol: a meta-analysis of data from 170 000 participants in 26 randomised trials. Lancet 2010;376(9753):1670–1681.",
      url: 'https://doi.org/10.1016/s0140-6736(10)61350-5',
      publishedAt: new Date('2010-11-13'),
      methodologyType: 'derivative',
    },
    update: {
      name: "Cholesterol Treatment Trialists' (CTT) Collaboration. Efficacy and safety of more intensive lowering of LDL cholesterol: a meta-analysis of data from 170 000 participants in 26 randomised trials. Lancet 2010;376(9753):1670–1681.",
      url: 'https://doi.org/10.1016/s0140-6736(10)61350-5',
      publishedAt: new Date('2010-11-13'),
      methodologyType: 'derivative',
    },
  })

  // ── Transition: RECORDED -> SETTLED ──
  const occurredAt = new Date('2010-11-13')
  const toAxis = 'SETTLED'
  const slug = `${CLAIM_ID}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis,
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        "The 2005 finding was vindicated and extended by the same Cholesterol Treatment Trialists' Collaboration's larger 2010 meta-analysis of 170,000 participants in 26 randomised trials. That analysis confirmed the core relationship — each ~1.0 mmol/L reduction in LDL cholesterol yields a proportional reduction of roughly a fifth in major vascular events — across a far wider evidence base and for more-intensive statin regimens. No retraction or expression of concern intervened; the proportional-benefit result is settled in the cardiovascular-prevention literature.",
      sourceExternalId: 'src:ctt-2010-intensive-ldl-meta-analysis',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis,
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        "The 2005 finding was vindicated and extended by the same Cholesterol Treatment Trialists' Collaboration's larger 2010 meta-analysis of 170,000 participants in 26 randomised trials. That analysis confirmed the core relationship — each ~1.0 mmol/L reduction in LDL cholesterol yields a proportional reduction of roughly a fifth in major vascular events — across a far wider evidence base and for more-intensive statin regimens. No retraction or expression of concern intervened; the proportional-benefit result is settled in the cardiovascular-prevention literature.",
      sourceExternalId: 'src:ctt-2010-intensive-ldl-meta-analysis',
    },
  })

  console.log(`Upserted trajectory transition: ${slug}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
