// Enrichment: post-publication epistemic trajectory for the Bender–Boettcher
// PT-symmetric quantum mechanics paper (Phys. Rev. Lett. 80, 5243, 1998).
//
// Claim (cmq2w52m200nrsa8h7a9axtjw): replacing self-adjointness with the weaker
// condition of PT symmetry yields new infinite classes of complex Hamiltonians
// whose spectra are nonetheless real and positive.
//
// Baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at 1998-06-15) already
// exists and is NOT duplicated here.
//
// Post-publication arc:
//   RECORDED -> SETTLED (2001-07-06): Bender & Boettcher's 1998 reality/positivity
//   result was a CONJECTURE grounded in numerical evidence and asymptotic analysis.
//   Dorey, Dunning & Tateo (J. Phys. A: Math. Gen. 34, 5679, 2001) supplied the
//   rigorous mathematical proof — via the ODE/IM (Bethe-ansatz / spectral-equivalence)
//   correspondence — that the spectra of the H = p^2 - (ix)^N family are real and
//   positive for N >= 2. This adjudicated the reality claim in the expert literature.
//
// No retraction, expression of concern, or failed replication exists for this paper.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-pt-symmetric-hamiltonians-real-spectra-1998.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-pt-symmetric-hamiltonians-real-spectra-1998.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w52m200nrsa8h7a9axtjw'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
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
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2001-07-06',
    datePrecision: 'DAY',
    reason:
      "Bender & Boettcher's 1998 reality-and-positivity result for PT-symmetric Hamiltonians H = p^2 - (ix)^N was a conjecture supported by numerical computation and asymptotic (WKB) analysis, not a proof. Dorey, Dunning & Tateo proved it rigorously in 'Spectral equivalences, Bethe ansatz equations, and reality properties in PT-symmetric quantum mechanics' (J. Phys. A: Math. Gen. 34, 5679, published 6 July 2001), using the ODE/IM correspondence to establish that the spectra are real and positive for N >= 2. This settled the reality claim in the expert literature.",
    source: {
      externalId: 'src:dorey-dunning-tateo-pt-reality-proof-2001',
      name: 'Dorey P, Dunning C, Tateo R. Spectral equivalences, Bethe ansatz equations, and reality properties in PT-symmetric quantum mechanics. Journal of Physics A: Mathematical and General 2001;34(28):5679–5704.',
      url: 'https://doi.org/10.1088/0305-4470/34/28/305',
      publishedAt: '2001-07-06',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${tr.source.externalId} + csh ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:pt-symmetric-hamiltonians-real-spectra-1998',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
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

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId: CLAIM_ID, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis}) [${tr.source.externalId}]`)
  }

  console.log(DRY_RUN ? 'Dry run complete.' : 'Enrichment complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
