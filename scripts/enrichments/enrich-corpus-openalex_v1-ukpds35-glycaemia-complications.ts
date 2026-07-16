import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for UKPDS 35 (Stratton et al., BMJ 2000;321:405-412,
// DOI 10.1136/bmj.321.7258.405, OpenAlex W2123946565).
// Claim: continuous association between glycaemia (updated mean HbA1c) and macro-/microvascular
// complications of type 2 diabetes, with NO glycaemic threshold below which risk stopped falling.
//
// Baseline row (fromAxis=null -> RECORDED at 2000-08-12) already exists; do NOT duplicate it.
// This script adds the post-publication adjudication: Zoungas et al. (Diabetologia 2012) directly
// tested the no-threshold conclusion in ADVANCE-trial data and found glycaemic thresholds,
// contesting a central claim of UKPDS 35.

const claimId = 'cmply866p0209saih4o4ut3qk'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2012-03-01',
    datePrecision: 'MONTH',
    reason:
      'UKPDS 35 reported a continuous association between glycaemia and complication risk with no evidence of a glycaemic threshold below which risk stopped falling. Analysing 11,140 patients from the ADVANCE trial, Zoungas et al. instead found clear evidence of thresholds — risk of macrovascular events and death fell only down to a mean HbA1c of ~7.0%, and microvascular events to ~6.5%, with no further reduction below — directly contesting the no-threshold conclusion. Together with the 2008 ACCORD trial\'s finding of increased mortality under intensive glucose lowering, this placed the "lower is better, with no threshold" reading of the finding into active expert dispute.',
    source: {
      externalId: 'src:zoungas-glycaemic-thresholds-2012',
      name: 'Zoungas S, Chalmers J, Ninomiya T, et al. "Association of HbA1c levels with vascular complications and death in patients with type 2 diabetes: evidence of glycaemic thresholds." Diabetologia 2012;55(3):636–643.',
      url: 'https://doi.org/10.1007/s00125-011-2404-1',
      publishedAt: '2012-03-01',
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
        ingestedBy: 'enrich:openalex_v1-ukpds35-glycaemia-complications',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('Done. UKPDS 35 enrichment applied.')
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
