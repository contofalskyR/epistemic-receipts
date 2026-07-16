// Enrichment: post-publication epistemic trajectory for the 2004 NCEP ATP III update.
//
// Claim (openalex_v1): Grundy SM et al. "Implications of Recent Clinical Trials for
// the National Cholesterol Education Program Adult Treatment Panel III Guidelines."
// Circulation. 2004-07-12. DOI 10.1161/01.cir.0000133317.49796.0e. OpenAlex W2106343349.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 2004-07-12) already
// exists; this script only adds what happened AFTER publication:
//
//   RECORDED -> CONTESTED  (2004-09-23) — Center for Science in the Public Interest and
//     35 physicians/scientists petitioned NIH/NHLBI for an independent, conflict-free
//     review of the five trials underlying the update, after it emerged that 8 of 9
//     panel authors had undisclosed financial ties to statin manufacturers.
//   CONTESTED -> REVERSED  (2013-11-12) — the 2013 ACC/AHA blood cholesterol guideline
//     (Stone et al.) found no RCT evidence supporting titration to specific LDL-C
//     targets and supplanted the ATP III "treat-to-target" framework (including the
//     update's optional LDL-C <70 mg/dL goal) with a fixed statin-intensity strategy.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-atp3-ncep-cholesterol-update.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-atp3-ncep-cholesterol-update.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply43fc000fsaiht1tj6ny3'

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
    occurredAt: '2004-09-23',
    datePrecision: 'DAY',
    reason:
      'On 23 September 2004 the Center for Science in the Public Interest, joined by 35 physicians, epidemiologists and scientists, wrote to the directors of NIH and NHLBI asking them to convene an independent review panel free of conflicts of interest to re-examine the five statin trials behind the July 2004 update. The petition followed the disclosure that eight of the nine authors had undisclosed financial associations with statin manufacturers, formally contesting the update\'s lowered LDL-C goals as potentially industry-influenced.',
    source: {
      externalId: 'src:cspi-nih-atp3-letter-2004',
      name: 'US consumer body calls for review of cholesterol guidelines. BMJ 2004;329:759 (news; CSPI/35-scientist letter to NIH, 23 Sep 2004).',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC521024/',
      publishedAt: '2004-09-25',
      methodologyType: 'opinion',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2013-11-12',
    datePrecision: 'DAY',
    reason:
      'The 2013 ACC/AHA Guideline on the Treatment of Blood Cholesterol (Stone et al.) reported that its Expert Panel could find no randomized-trial evidence to support titrating therapy to specific LDL-C or non-HDL-C targets, and it explicitly supplanted the ATP III treat-to-target framework — including the 2004 update\'s optional LDL-C <70 mg/dL goal — with a fixed statin-intensity strategy. This adjudication by the successor guideline overturned the target-based recommendations the 2004 update had advanced.',
    source: {
      externalId: 'src:acc-aha-cholesterol-guideline-2013',
      name: 'Stone NJ et al. 2013 ACC/AHA Guideline on the Treatment of Blood Cholesterol to Reduce Atherosclerotic Cardiovascular Risk in Adults. Circulation 2013 (PMID 24222016).',
      url: 'https://pubmed.ncbi.nlm.nih.gov/24222016/',
      publishedAt: '2013-11-12',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} post-publication transitions${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
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
        ingestedBy: 'enrich:openalex_v1-atp3-ncep-cholesterol-update',
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

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
  }

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
