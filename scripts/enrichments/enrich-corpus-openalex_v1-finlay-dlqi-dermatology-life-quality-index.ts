// Epistemic-receipt enrichment for the Dermatology Life Quality Index (DLQI)
// original paper: Finlay AY, Khan GK. "Dermatology Life Quality Index (DLQI) —
// a simple practical measure for routine clinical use." Clin Exp Dermatol
// 1994;19(3):210-216. DOI 10.1111/j.1365-2230.1994.tb01167.x (OpenAlex W2096991001).
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 1994-05) already exists;
// this script only adds the post-publication arc:
//   RECORDED -> CONTESTED  (2012-01)  Twiss et al., Rasch analysis: DLQI fails
//                                     unidimensionality/DIF, "a new measure is required"
//   CONTESTED -> SETTLED   (2024-11-07) Vyas et al., systematic review of 207
//                                     validation studies (58,828 patients) vindicating
//                                     the instrument's reliability/validity/responsiveness
//
// Idempotent: sources upsert on externalId; ClaimStatusHistory upserts on a
// deterministic slug id. Does NOT create or modify the Claim.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-finlay-dlqi-dermatology-life-quality-index.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-finlay-dlqi-dermatology-life-quality-index.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplyag760339saih21xtgi6g'

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
    occurredAt: '2012-01-01',
    datePrecision: 'MONTH',
    reason:
      'Twiss, Meads, Preston, Crawford & McKenna applied Rasch analysis to DLQI data and reported multiple psychometric failures: misfitting items, differential item functioning by disease, age and gender, disordered response thresholds, and inadequate measurement of patients with mild disease. They concluded the DLQI does not behave as a unidimensional interval scale and argued that a new dermatology-disability measure is required — a direct, dated challenge to the instrument\'s measurement validity.',
    source: {
      externalId: 'src:twiss-dlqi-rasch-critique-2012',
      name: 'Twiss J, Meads DM, Preston EP, Crawford SR, McKenna SP. Can We Rely on the Dermatology Life Quality Index as a Measure of the Impact of Psoriasis or Atopic Dermatitis? J Invest Dermatol 2012;132(1):76-84.',
      url: 'https://doi.org/10.1038/jid.2011.238',
      publishedAt: '2012-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2024-11-07',
    datePrecision: 'DAY',
    reason:
      'Vyas, Johns, Ali, Ingram, Salek & Finlay published a systematic review of 207 studies (58,828 patients, >49 countries, 41 diseases) describing validation aspects of the DLQI. It found strong test–retest reliability, good internal consistency across 43 studies, established known-groups and construct validity across 42 studies, and appropriate responsiveness to change — adjudicating the accumulated evidence in favour of the instrument and settling its status as a validated dermatology quality-of-life measure despite earlier Rasch-based objections.',
    source: {
      externalId: 'src:vyas-dlqi-207-study-review-2024',
      name: 'Vyas J, Johns JR, Ali FM, Ingram JR, Salek S, Finlay AY. A Systematic Review of 207 Studies Describing Validation Aspects of the Dermatology Life Quality Index. Acta Derm Venereol 2024;104:adv41120.',
      url: 'https://doi.org/10.2340/actadv.v104.41120',
      publishedAt: '2024-11-07',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
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
        ingestedBy: 'enrich:openalex_v1-finlay-dlqi',
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
