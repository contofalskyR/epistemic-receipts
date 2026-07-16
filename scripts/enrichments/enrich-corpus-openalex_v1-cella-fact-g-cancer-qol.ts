import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────────────────
// Epistemic-receipt enrichment for:
//   Claim: "The Functional Assessment of Cancer Therapy (FACT) scale:
//           development and validation of the general measure."
//   Cella DF, Tulsky DS, Gray G, et al. (1993), J Clin Oncol, 11(3):570–579
//   DOI:      https://doi.org/10.1200/jco.1993.11.3.570
//   OpenAlex: W2105258029
//   Claim ID: cmply5f8u00nxsaih4qzci6ep
//
// Baseline row (fromAxis=null -> RECORDED @ 1993-03-01) already exists — NOT duplicated here.
//
// Post-publication trajectory (no retraction / expression of concern / failed
// replication found — the FACT-G became a field-standard HRQOL instrument):
//  1. RECORDED -> SETTLED  (EXPERT_LITERATURE, 2008-11)
//     Victorson et al. conducted a reliability-generalization meta-analysis pooling
//     FACT-G score reliability across independent published studies, finding a mean
//     total-score reliability of ~0.88 (subscales 0.71–0.83) with no substantial
//     variability by scale or demographic characteristics. Pooling across many
//     downstream applications adjudicated the paper's central claim — that the FACT-G
//     is a reliable, validated general cancer QoL measure — as vindicated in the
//     expert literature. No prior contest existed, so this is RECORDED -> SETTLED.
// ─────────────────────────────────────────────────────────────────────────────

const CLAIM_ID = 'cmply5f8u00nxsaih4qzci6ep'

interface Transition {
  fromAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED'
  toAxis: 'SETTLED' | 'CONTESTED' | 'REVERSED'
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
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
    occurredAt: '2008-11-01',
    datePrecision: 'MONTH',
    reason:
      'Victorson, Barocas, Song & Cella, "Reliability across studies from the Functional Assessment of Cancer Therapy-General (FACT-G) and its subscales: a reliability generalization" (Quality of Life Research, 2008;17(9):1137–1146), performed a reliability-generalization meta-analysis pooling FACT-G score reliability across independent published studies. They found an average total-score reliability of ~0.88 (subscales 0.71–0.83) with acceptable reliability and no substantial variability attributable to scale or sample characteristics. This systematic pooling of downstream use adjudicated the 1993 paper\'s core claim — a reliable, validated brief general cancer quality-of-life measure — as vindicated, settling it in the expert literature.',
    source: {
      externalId: 'src:victorson-2008-factg-reliability-generalization',
      name: 'Victorson D, Barocas J, Song J, Cella D. Reliability across studies from the Functional Assessment of Cancer Therapy-General (FACT-G) and its subscales: a reliability generalization. Quality of Life Research, 2008;17(9):1137–1146.',
      url: 'https://doi.org/10.1007/s11136-008-9398-2',
      publishedAt: '2008-11-01',
      methodologyType: 'derivative',
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
        ingestedBy: 'enrich:cella-fact-g-cancer-qol',
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

    console.log(`Upserted ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.community})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
