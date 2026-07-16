import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Fox et al. 2005, PNAS, "The human brain is intrinsically organized into
//   dynamic, anticorrelated functional networks"
//   DOI: 10.1073/pnas.0504136102  | OpenAlex: W1760829075
//   Claim: cmpm1c7c506bpsadnj7kolqlo
//
// Baseline row (fromAxis=null -> RECORDED @ 2005-06-23) already exists; do NOT duplicate.
//
// Post-publication event (verified 2026-07-15):
//   Murphy et al. 2009, NeuroImage 44(3):893-905,
//   "The impact of global signal regression on resting state correlations:
//    Are anti-correlated networks introduced?"
//   DOI: 10.1016/j.neuroimage.2008.09.036 (published Feb 2009)
//   Directly contests whether the reported anticorrelations are a genuine
//   property of intrinsic brain organization or an artifact of the global
//   signal regression preprocessing step. -> RECORDED -> CONTESTED.

const claimId = 'cmpm1c7c506bpsadnj7kolqlo'

interface Transition {
  fromAxis: string | null
  toAxis: string
  community: string
  occurredAt: string // YYYY-MM-DD
  datePrecision: string
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
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2009-02-01',
    datePrecision: 'MONTH',
    reason:
      'Murphy et al. (NeuroImage, Feb 2009) directly challenged the central finding, arguing that the anticorrelation between the two networks reported by Fox et al. is at least partly an artifact mathematically introduced by the global signal regression step used in preprocessing, rather than an intrinsic property of resting brain organization. The critique — that removing the global signal forces the appearance of negatively correlated networks — placed the specific anticorrelation claim into active methodological dispute across the resting-state fMRI literature.',
    source: {
      externalId: 'src:murphy-2009-global-signal-anticorrelated-networks',
      name: 'Murphy K, Birn RM, Handwerker DA, Jones TB, Bandettini PA, "The impact of global signal regression on resting state correlations: Are anti-correlated networks introduced?", NeuroImage 44(3):893-905, 2009.',
      url: 'https://doi.org/10.1016/j.neuroimage.2008.09.036',
      publishedAt: '2009-02-01',
      methodologyType: 'primary',
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
        ingestedBy: 'enrich:openalex_v1-fox-anticorrelated-brain-networks-2005',
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
      where: { claimId, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({
        data: { claimId, sourceId: source.id, type: 'FOR' },
      })
    }

    console.log(`Upserted transition ${tr.fromAxis} -> ${tr.toAxis} (${histId})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
