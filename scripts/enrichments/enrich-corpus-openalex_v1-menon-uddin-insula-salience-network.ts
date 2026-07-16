// Epistemic enrichment: post-publication trajectory for
// Menon & Uddin (2010), "Saliency, switching, attention and control:
// a network model of insula function" (Brain Structure and Function).
//
// Claim id: cmpm1s67e0ds7sadnkxi13y28  (openalex_v1 / W2129624700)
// DOI: https://doi.org/10.1007/s00429-010-0262-0
//
// The baseline ClaimStatusHistory row (null -> RECORDED at the 2010-05-28
// publication date) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (EXPERT_LITERATURE), Oct 2014.
//     The model's central novel prediction — that the salience network
//     (anterior insula + dACC) causally initiates switching between the
//     default mode network and the central executive network — was directly
//     and independently replicated by Goulden et al. (NeuroImage, 2014) using
//     dynamic causal modeling on two independent datasets. No retraction,
//     expression of concern, or failed replication of the core network model
//     was found.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-menon-uddin-insula-salience-network.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-menon-uddin-insula-salience-network.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm1s67e0ds7sadnkxi13y28'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity =
  | 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

// Post-publication transitions only (baseline null -> RECORDED already exists).
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2014-10-01',
    datePrecision: 'MONTH',
    reason:
      'The central novel prediction of the Menon–Uddin model — that the salience network (anterior insula and dorsal anterior cingulate) causally initiates switching between the default mode network and the central executive network — was directly and independently replicated by Goulden et al. (NeuroImage, 2014) using dynamic causal modeling across two independent resting-state datasets. The replication confirmed the insula-driven switching mechanism, and the salience-network framework has since been treated as an established organizing model in cognitive neuroscience. No retraction, expression of concern, or failed replication of the core model was found.',
    source: {
      externalId: 'src:goulden-2014-salience-switching-dcm',
      name: 'Goulden N, Khusnulina A, Davis NJ, Bracewell RM, Bokde AL, McNulty JP, Mullins PG. The salience network is responsible for switching between the default mode network and the central executive network: Replication from DCM. NeuroImage 2014;99:180–190.',
      url: 'https://doi.org/10.1016/j.neuroimage.2014.05.052',
      publishedAt: '2014-10-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} post-publication transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting (this script does not create claims).`)

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}  (hist ${histId})`)
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
        ingestedBy: 'enrich:openalex_v1-menon-uddin-insula',
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
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
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

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}  (hist ${histId})`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
