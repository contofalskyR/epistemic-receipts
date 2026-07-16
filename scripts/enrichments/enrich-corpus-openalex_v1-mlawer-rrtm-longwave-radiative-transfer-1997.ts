// Epistemic-receipt enrichment for the RRTM longwave radiative transfer model claim.
//
// Claim: Mlawer, Taubman, Brown, Iacono & Clough (1997), "Radiative transfer for
// inhomogeneous atmospheres: RRTM, a validated correlated-k model for the longwave,"
// J. Geophys. Res. Atmospheres, DOI 10.1029/97jd00237 (OpenAlex W2083339292).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the 1997-07
// publication date) already exists; this script does NOT duplicate it.
//
// Post-publication arc: no retraction, no expression of concern, no failed
// replication. RRTM was progressively validated against line-by-line models
// (LBLRTM) and its GCM-applicable derivative, RRTMG, was incorporated into major
// operational and climate models. Iacono et al. (2008) documents RRTMG's
// validation and adoption into general circulation models — the field-consensus
// adjudication that settles the original claim. This is a vindication arc
// (RECORDED -> SETTLED); there was never a CONTESTED phase.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mlawer-rrtm-longwave-radiative-transfer-1997.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mlawer-rrtm-longwave-radiative-transfer-1997.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w4p5s00flsa8hi8itm6hb'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus | null
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
    occurredAt: '2008-07-02',
    datePrecision: 'DAY',
    reason:
      'Iacono, Delamere, Mlawer, Shephard, Clough & Collins (2008) report RRTMG — the GCM-applicable version derived directly from RRTM — and document its validation against line-by-line (LBLRTM) calculations across a range of atmospheres and its incorporation into general circulation models. By this point RRTM/RRTMG had become the de facto standard longwave radiation parameterization in major operational and climate models (e.g. WRF, NCAR CESM/CAM, ECMWF), reflecting a field-consensus adjudication that vindicated the original 1997 RRTM claim. No retraction, expression of concern, or failed replication exists.',
    source: {
      externalId: 'src:iacono-rrtmg-aer-radiative-transfer-2008',
      name: 'Iacono MJ, Delamere JS, Mlawer EJ, Shephard MW, Clough SA, Collins WD. Radiative forcing by long-lived greenhouse gases: Calculations with the AER radiative transfer models. J. Geophys. Res. Atmospheres 2008;113:D13103.',
      url: 'https://doi.org/10.1029/2008JD009944',
      publishedAt: '2008-07-02',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} — ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  if (DRY_RUN) {
    for (const tr of TRANSITIONS) {
      console.log(`  [dry] ${tr.fromAxis ?? 'null'} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.source.externalId})`)
    }
    await prisma.$disconnect()
    return
  }

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-mlawer-rrtm-1997',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${histId} (${tr.fromAxis ?? 'null'} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
