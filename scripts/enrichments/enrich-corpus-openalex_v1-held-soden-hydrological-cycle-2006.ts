// Epistemic-receipt enrichment for Held & Soden (2006),
// "Robust Responses of the Hydrological Cycle to Global Warming"
// Journal of Climate, DOI 10.1175/jcli3990.1 · OpenAlex W2122511023
// Claim id: cmq2w5sg00139sa8hc0q6d8kg
//
// Baseline row (fromAxis=null -> RECORDED @ 2006-11-01) already exists; do NOT duplicate.
// This script adds ONE verified post-publication transition:
//   RECORDED -> CONTESTED @ 2014-09-14 (Greve et al. 2014, Nature Geoscience)
// Greve et al. directly cite Held & Soden and show that the "wet-get-wetter,
// dry-get-drier" enhancement of the evaporation-minus-precipitation pattern —
// one of the robust responses this paper enumerated — does not generalise to
// land, holding over only a small fraction of the global land surface.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-held-soden-hydrological-cycle-2006.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-held-soden-hydrological-cycle-2006.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w5sg00139sa8hc0q6d8kg'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
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
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2014-09-14',
    datePrecision: 'DAY',
    reason:
      'Greve, Orlowsky, Mueller, Sheffield, Reichstein & Seneviratne, "Global assessment of trends in wetting and drying over land" (Nature Geoscience, published online 14 Sep 2014), directly cited Held & Soden and tested the "dry-get-drier, wet-get-wetter" enhancement of the evaporation-minus-precipitation pattern against observations over land. They found this simple thermodynamic expectation is confirmed over only about 10% of the global land area, and is contradicted or ambiguous elsewhere. This contested the generalisation to land of one of the robust responses the 2006 paper enumerated; the ocean-focused thermodynamic core (moisture increase, weakening circulation) was not overturned, but the land applicability became an active, unresolved debate.',
    source: {
      externalId: 'src:greve-2014-wetting-drying-land',
      name: 'Greve P, Orlowsky B, Mueller B, Sheffield J, Reichstein M, Seneviratne SI. Global assessment of trends in wetting and drying over land. Nature Geoscience. 2014;7(10):716–721.',
      url: 'https://doi.org/10.1038/ngeo2247',
      publishedAt: '2014-09-14',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} — ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  would upsert source ${tr.source.externalId}`)
      console.log(`  would upsert history ${slug}: ${tr.fromAxis ?? 'null'} -> ${tr.toAxis} @ ${tr.occurredAt}`)
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
        ingestedBy: 'enrich:held-soden-hydrological-cycle-2006',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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

    console.log(`  upserted ${slug}: ${tr.fromAxis ?? 'null'} -> ${tr.toAxis} @ ${tr.occurredAt}`)
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
