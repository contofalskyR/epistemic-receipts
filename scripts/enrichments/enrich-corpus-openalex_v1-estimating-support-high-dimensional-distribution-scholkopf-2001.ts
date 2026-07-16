import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Claim: Schölkopf, Platt, Shawe-Taylor, Smola & Williamson (2001),
// "Estimating the Support of a High-Dimensional Distribution" (One-Class SVM),
// Neural Computation. DOI 10.1162/089976601750264965 | OpenAlex W2132870739.
// Baseline ClaimStatusHistory (null -> RECORDED at 2001-07-01) already exists; do NOT duplicate.
const claimId = 'cmq2w5am800slsa8hkb3m2j7c'

interface Transition {
  fromAxis: string | null
  toAxis: string
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: string
  }
}

const transitions: Transition[] = [
  {
    // RECORDED -> SETTLED: canonical field survey establishes one-class SVM as a standard method.
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2009-07-01',
    datePrecision: 'MONTH',
    reason:
      'Chandola, Banerjee & Kumar (2009), "Anomaly Detection: A Survey" in ACM Computing Surveys — the field-defining review of anomaly detection (9,000+ citations) — categorizes the one-class SVM proposed here among the core classification-based anomaly-detection techniques. Its inclusion as an established, canonical method in the discipline\'s reference-of-record survey marks field consensus that the technique is a standard, adopted tool rather than an open proposal. No retraction, failed-replication report, or reversing critique exists.',
    source: {
      externalId: 'src:chandola-banerjee-kumar-2009-anomaly-detection-survey',
      name: 'Chandola, Banerjee & Kumar (2009), "Anomaly Detection: A Survey," ACM Computing Surveys 41(3)',
      url: 'https://doi.org/10.1145/1541880.1541882',
      publishedAt: '2009-07-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of transitions) {
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

    console.log(`Upserted transition ${slug} (source ${source.id})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
