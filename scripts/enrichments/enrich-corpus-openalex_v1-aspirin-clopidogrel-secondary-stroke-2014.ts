// Epistemic-receipt enrichment for the Ye et al. systematic review/meta-analysis
// "Aspirin plus Clopidogrel as Secondary Prevention after Stroke or Transient
// Ischemic Attack" (Cerebrovascular Diseases 2015;39(1):13-22, published online
// 2014-12-24, DOI 10.1159/000369778, PMID 25547900, OpenAlex W1480729244).
//
// Claim id cmply4c0m004lsaihg2cu6hhd already carries its baseline
// (fromAxis=null -> RECORDED @ 2014-12-24). This script adds the post-publication
// arc only:
//   RECORDED -> SETTLED (2021-05-24) — field-consensus codification of the
//   review's short-course-benefit / long-course-harm thesis in the 2021 AHA/ASA
//   secondary-stroke-prevention guideline (INSTITUTIONAL).
//
// No retraction or expression of concern exists (PubMed / Karger clean). No
// specific, dated methodological contest of the finding was located, so no
// CONTESTED step is fabricated.
//
// Idempotent: source upsert on externalId, history upsert on deterministic id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-aspirin-clopidogrel-secondary-stroke-2014.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-aspirin-clopidogrel-secondary-stroke-2014.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply4c0m004lsaihg2cu6hhd'

type FactStatus = 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
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
  // ── RECORDED -> SETTLED: 2021 AHA/ASA guideline codifies short-course DAPT ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2021-05-24',
    datePrecision: 'DAY',
    reason:
      'The review\'s central thesis — that adding clopidogrel to aspirin is beneficial short-term but harmful (excess bleeding without added benefit) over the long term — was confirmed by the large POINT randomized trial (Johnston et al., N Engl J Med 2018;379:215-225, DOI 10.1056/NEJMoa1800410) alongside CHANCE, and then codified as standard of care. The 2021 AHA/ASA "Guideline for the Prevention of Stroke in Patients With Stroke and Transient Ischemic Attack" recommends aspirin plus clopidogrel for 21-90 days after minor noncardioembolic stroke or high-risk TIA followed by single antiplatelet therapy, and explicitly warns that continuing dual therapy beyond ~90 days raises hemorrhage risk without benefit. This institutional adjudication settles the finding in clinical practice.',
    source: {
      externalId: 'src:aspirin-clopidogrel-secondary-stroke:aha-asa-guideline-2021',
      name: 'Kleindorfer DO, Towfighi A, Chaturvedi S, et al. 2021 Guideline for the Prevention of Stroke in Patients With Stroke and Transient Ischemic Attack: A Guideline From the American Heart Association/American Stroke Association. Stroke. 2021 Jul;52(7):e364-e467. Epub 2021 May 24. PMID 34024117; DOI 10.1161/STR.0000000000000375.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/34024117/',
      publishedAt: '2021-05-24',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — refusing to create a new Claim.`)

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}  (${histId})`)
      console.log(`          source: ${tr.source.externalId}`)
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
        ingestedBy: 'enrich:openalex_v1-aspirin-clopidogrel-secondary-stroke-2014',
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

    console.log(`upserted ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}  (${histId})`)
  }

  console.log(`Done: ${TRANSITIONS.length} transition(s) for claim ${CLAIM_ID}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
