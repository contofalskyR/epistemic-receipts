// Epistemic-receipt enrichment: post-publication trajectory for
// Shepherd, Cobbe, Ford et al. (1995), "Prevention of Coronary Heart Disease
// with Pravastatin in Men with Hypercholesterolemia" — the West of Scotland
// Coronary Prevention Study (WOSCOPS).
// New England Journal of Medicine 1995;333:1301–1307.
// DOI: 10.1056/nejm199511163332001
// OpenAlex: W2155598961. Claim id: cmply8imw0269saih46aw0d56.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 1995-11-16) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2005-10, EXPERT_LITERATURE)
//     Cholesterol Treatment Trialists' (CTT) Collaboration prospective
//     meta-analysis of 90,056 participants across 14 randomised statin trials
//     (WOSCOPS among them), Lancet 2005. It quantified a ~21% reduction in major
//     vascular events per 1 mmol/L LDL-C reduction and established statin
//     efficacy for preventing coronary heart disease events across primary and
//     secondary prevention — the definitive meta-analytic adjudication that
//     vindicates the WOSCOPS finding that pravastatin lowers the incidence of
//     nonfatal MI and CHD death in hypercholesterolemic men without prior MI.
//
// WOSCOPS was never retracted, contested by a failed replication, or overturned;
// its result was progressively confirmed (including its own 20-year legacy
// follow-up, Ford et al., Circulation 2016). A single RECORDED->SETTLED arc is
// therefore the honest trajectory — no contest step is invented.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-woscops-pravastatin-shepherd-1995.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply8imw0269saih46aw0d56'

type FactStatus =
  | 'OPEN'
  | 'RECORDED'
  | 'SETTLED'
  | 'CONTESTED'
  | 'REVERSED'
  | 'ABANDONED'
  | 'UNRESOLVABLE'
type RatifyingCommunity =
  | 'EXPERT_LITERATURE'
  | 'INSTITUTIONAL'
  | 'JUDICIAL'
  | 'PUBLIC'
  | 'MARKET'
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
    occurredAt: '2005-10-01',
    datePrecision: 'MONTH',
    reason:
      'The Cholesterol Treatment Trialists\' (CTT) Collaboration published a prospective meta-analysis of individual data from 90,056 participants across 14 randomised statin trials (WOSCOPS included), Lancet 2005;366:1267–1278. It established that statin therapy reduces major coronary events by roughly a fifth per 1 mmol/L reduction in LDL cholesterol, across both primary and secondary prevention, adjudicating the WOSCOPS finding that pravastatin lowers the combined incidence of nonfatal myocardial infarction and coronary heart disease death in hypercholesterolemic men without prior MI. This pooled, adequately powered evidence base settled statin efficacy for CHD prevention as expert-literature consensus.',
    source: {
      externalId: 'src:ctt-collaboration-statin-meta-analysis-2005',
      name: 'Cholesterol Treatment Trialists\' (CTT) Collaborators. Efficacy and safety of cholesterol-lowering treatment: prospective meta-analysis of data from 90,056 participants in 14 randomised trials of statins. Lancet 2005;366(9493):1267–1278.',
      url: 'https://doi.org/10.1016/S0140-6736(05)67394-1',
      publishedAt: '2005-10-01',
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
        ingestedBy: 'enrich:corpus-openalex_v1',
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

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
