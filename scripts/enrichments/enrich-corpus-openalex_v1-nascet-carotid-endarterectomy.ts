// Epistemic receipt enrichment for claim cmplyifwq06wrsaihru4ajdjx
// "Beneficial Effect of Carotid Endarterectomy in Symptomatic Patients with
//  High-Grade Carotid Stenosis" (NASCET), NEJM 1991;325:445-453.
// DOI 10.1056/NEJM199108153250701 · OpenAlex W2767911074
//
// Baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at 1991-08-15)
// already exists; do NOT duplicate it. This script adds the post-publication
// adjudicating transition only.
//
// Arc added: RECORDED -> SETTLED at the Cochrane systematic review that pooled
// NASCET, ECST and the VA trial and confirmed the benefit of carotid
// endarterectomy for symptomatic severe stenosis. There was never a genuine
// contest of the core finding, so this is a direct RECORDED -> SETTLED
// vindication per task rule #3.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nascet-carotid-endarterectomy.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nascet-carotid-endarterectomy.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplyifwq06wrsaihru4ajdjx'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
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
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2011-04-13',
    datePrecision: 'DAY',
    reason:
      'The Cochrane systematic review "Carotid endarterectomy for symptomatic carotid stenosis" (Rerkasem & Rothwell, Cochrane Database of Systematic Reviews, 13 April 2011; PMID 21491381) pooled the randomised evidence from NASCET, the European Carotid Surgery Trial (ECST) and the VA trial. It confirmed that carotid endarterectomy substantially reduces the risk of ipsilateral stroke in patients with recently symptomatic severe (~70-99%) carotid stenosis, directly vindicating the NASCET finding. The review adjudicated the core claim as settled clinical evidence, superseded only by later updates (pub3, 2017).',
    source: {
      externalId: 'src:cochrane-cea-symptomatic-cd001081-pub2-2011',
      name: 'Rerkasem K, Rothwell PM. Carotid endarterectomy for symptomatic carotid stenosis. Cochrane Database of Systematic Reviews 2011, Issue 4, Art. No.: CD001081. DOI: 10.1002/14651858.CD001081.pub2.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/21491381/',
      publishedAt: '2011-04-13',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}  (${histId})`)
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
        ingestedBy: 'enrich:openalex_v1-nascet-carotid-endarterectomy',
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
