// Epistemic-receipt enrichment for corpus claim (openalex_v1):
//   "Nanocarriers as an emerging platform for cancer therapy"
//   Peer D, Karp JM, Hong S, Farokhzad OC, Margalit R, Langer R.
//   Nature Nanotechnology (2007-12). DOI 10.1038/nnano.2007.387 · OpenAlex W2032760352
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication)
// already exists; this script only adds the post-publication arc.
//
// Post-publication event: Wilhelm et al. (Nature Reviews Materials, 2016-04-26)
// meta-analysed ~10 years of the tumour-targeting literature and found that a
// median of only ~0.7% of the injected nanoparticle dose is delivered to solid
// tumours — a landmark, heavily-cited reassessment that contested the delivery
// premise underpinning the nanocarrier-for-cancer platform this review promoted.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-peer-2007-nanocarriers-cancer-therapy.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-peer-2007-nanocarriers-cancer-therapy.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmplycbuj03zfsaihnq2a4e7v'

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
    occurredAt: '2016-04-26',
    datePrecision: 'DAY',
    reason:
      'Wilhelm et al., "Analysis of nanoparticle delivery to tumours" (Nature Reviews Materials, 2016), surveyed roughly a decade of published tumour-targeting studies and found that a median of only ~0.7% of the systemically injected nanoparticle dose actually reaches the solid tumour. This quantitative reassessment directly challenged the delivery efficiency and EPR-effect premise underpinning the nanocarrier-for-cancer platform that this review helped establish, opening a sustained field-wide debate about whether nanocarriers can deliver on their therapeutic promise.',
    source: {
      externalId: 'src:wilhelm-2016-nanoparticle-delivery-tumours',
      name: 'Wilhelm S, Tavares AJ, Dai Q, Ohta S, Audet J, Dvorak HF, Chan WCW. Analysis of nanoparticle delivery to tumours. Nature Reviews Materials 2016;1:16014.',
      url: 'https://doi.org/10.1038/natrevmats.2016.14',
      publishedAt: '2016-04-26',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${claimId} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  if (DRY_RUN) {
    for (const tr of TRANSITIONS) {
      console.log(`  [dry] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.source.externalId})`)
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
        ingestedBy: 'enrich:openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const histId = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId,
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'AGAINST' } })
    }

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
