// Epistemic-receipt enrichment for claim cmq2w4ly200dlsa8hmqrjm7mb
// "The Chemical Composition of the Sun" — Asplund, Grevesse, Sauval & Scott,
// Annual Review of Astronomy and Astrophysics 47 (2009), DOI 10.1146/annurev.astro.46.060407.145222.
//
// Baseline RECORDED row (fromAxis=null -> RECORDED at 2009-08-20) already exists; do NOT duplicate.
//
// Post-publication arc added here:
//   RECORDED -> CONTESTED (2009-10-20)
//     The review's downward-revised solar photospheric abundances (notably C, N, O,
//     Ne -> a lower overall metallicity Z) broke the previously good agreement between
//     standard solar models and helioseismology. Serenelli, Basu, Ferguson & Asplund
//     (2009, ApJL 705, L123) is the canonical dated demonstration that the new
//     composition degrades the modelled sound-speed profile, convective-zone depth,
//     and surface-helium abundance — the "solar abundance/modeling problem." This
//     tension remains unresolved in the literature (Asplund et al. 2021 reaffirm the
//     low values; Magg et al. 2022 dispute them), so the arc stops at CONTESTED.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-asplund-solar-composition-2009.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w4ly200dlsa8hmqrjm7mb'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2009-10-20',
    datePrecision: 'DAY',
    reason:
      'The review\'s downward-revised solar photospheric abundances (notably a lower C, N, O and Ne, giving a reduced overall metallicity Z) broke the long-standing agreement between standard solar models and helioseismology. Serenelli, Basu, Ferguson & Asplund (ApJL 705, L123, 2009-10-20) showed the new composition significantly degrades the modelled sound-speed profile, convective-zone depth and surface-helium abundance — the "solar abundance/modeling problem." This became the central, still-unresolved tension attached to the finding, with one of the review\'s own authors co-signing the challenge.',
    source: {
      externalId: 'src:serenelli-2009-solar-models-revisited',
      name: 'Serenelli AM, Basu S, Ferguson JW, Asplund M. New Solar Composition: The Problem With Solar Models Revisited. The Astrophysical Journal Letters 2009;705(2):L123–L127.',
      url: 'https://doi.org/10.1088/0004-637X/705/2/L123',
      publishedAt: '2009-10-20',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'AGAINST' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
