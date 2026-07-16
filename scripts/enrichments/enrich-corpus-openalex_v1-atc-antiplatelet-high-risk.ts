import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for the Antithrombotic Trialists' Collaboration (ATC) 2002 meta-analysis,
// "Collaborative meta-analysis of randomised trials of antiplatelet therapy for prevention of death,
// myocardial infarction, and stroke in high risk patients." BMJ 2002;324:71.
// Claim id cmply4yj300flsaih747g730j / OpenAlex W2024352468 / DOI 10.1136/bmj.324.7329.71.
//
// Baseline row (fromAxis=null -> RECORDED at 2002-01-12 publication) already exists; not duplicated here.
//
// Post-publication arc: the core finding — antiplatelet therapy (chiefly aspirin) reduces serious
// vascular events by ~25% among high-risk patients with occlusive vascular disease (secondary
// prevention) — was vindicated, never contested. In May 2009 the SAME collaboration published a
// methodological upgrade in The Lancet ("Aspirin in the primary and secondary prevention of vascular
// disease: collaborative meta-analysis of individual participant data from randomised trials",
// Lancet 2009;373:1849-60, DOI 10.1016/S0140-6736(09)60503-1). Re-analysing individual participant
// data from 16 secondary-prevention trials (~17,000 high-risk individuals), it confirmed that in
// secondary prevention aspirin's benefits clearly outweigh its bleeding risks — re-affirming the 2002
// aggregate-data conclusion with superior IPD methodology. That adjudication is the settling event.
//   RECORDED -> SETTLED at 2009-05 (MONTH precision), community EXPERT_LITERATURE.

const CLAIM_ID = 'cmply4yj300flsaih747g730j'

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (2009 ATC IPD meta-analysis re-confirms secondary prevention) ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:atc-ipd-lancet-2009' },
    create: {
      externalId: 'src:atc-ipd-lancet-2009',
      name: "Antithrombotic Trialists' (ATT) Collaboration — Aspirin in the primary and secondary prevention of vascular disease: collaborative meta-analysis of individual participant data from randomised trials (Lancet 2009;373:1849-60)",
      url: 'https://doi.org/10.1016/S0140-6736(09)60503-1',
      publishedAt: new Date('2009-05-30'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1',
    },
    update: {
      name: "Antithrombotic Trialists' (ATT) Collaboration — Aspirin in the primary and secondary prevention of vascular disease: collaborative meta-analysis of individual participant data from randomised trials (Lancet 2009;373:1849-60)",
      url: 'https://doi.org/10.1016/S0140-6736(09)60503-1',
      publishedAt: new Date('2009-05-30'),
    },
  })

  const occurredAt = new Date('2009-05-30')
  const slug = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  const reason =
    "The 2002 finding — antiplatelet therapy (chiefly aspirin) cuts serious vascular events by about a quarter in high-risk patients with occlusive vascular disease — was re-adjudicated by the same collaboration's May 2009 Lancet meta-analysis using individual participant data. Re-analysing 16 secondary-prevention trials (~17,000 high-risk individuals), it confirmed that in secondary prevention aspirin's benefits clearly outweigh its bleeding risks, vindicating the original aggregate-data conclusion with superior IPD methodology. The secondary-prevention finding was settled, not overturned."

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      reason,
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      reason,
      sourceId: source.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({
    where: { claimId: CLAIM_ID, sourceId: source.id },
  })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: RECORDED -> SETTLED (ATC 2009 IPD meta-analysis) upserted`)

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
