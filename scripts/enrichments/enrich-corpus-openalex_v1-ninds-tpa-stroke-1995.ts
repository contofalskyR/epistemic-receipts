// Epistemic-receipt enrichment for the NINDS rt-PA acute ischemic stroke trial
// (NEJM 1995-12-14, DOI 10.1056/nejm199512143332401, OpenAlex W2292308933).
//
// Claim id cmply4g74006lsaihtobq9iew already carries its baseline
// (fromAxis=null -> RECORDED @ 1995-12-14). This script adds the post-publication
// arc only:
//   RECORDED -> CONTESTED  (2002-06-25) baseline-imbalance critique
//   CONTESTED -> SETTLED   (2004-09-02) NINDS-commissioned independent reanalysis
//
// Idempotent: source upsert on externalId, history upsert on deterministic id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ninds-tpa-stroke-1995.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ninds-tpa-stroke-1995.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply4g74006lsaihtobq9iew'

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
  // ── RECORDED -> CONTESTED: baseline-imbalance critique (Mann, CMAJ 2002) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2002-06-25',
    datePrecision: 'DAY',
    reason:
      'A sustained methodological critique argued that the two NINDS treatment arms were imbalanced at baseline in stroke severity, with more mild strokes in the t-PA group, potentially inflating the apparent benefit. Mann\'s CMAJ commentary "tPA for acute stroke: balancing baseline imbalances" (2002) crystallised the emergency-medicine and biostatistics dispute over whether the trial\'s 3-hour efficacy result was an artifact of randomisation imbalance, moving the finding from recorded to actively contested.',
    source: {
      externalId: 'src:ninds-tpa-stroke:mann-cmaj-baseline-imbalance-2002',
      name: 'Mann J. tPA for acute stroke: balancing baseline imbalances. CMAJ. 2002 Jun 25;166(13):1648–1649. PMID 12126317; PMC116149.',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC116149/',
      publishedAt: '2002-06-25',
      methodologyType: 'opinion',
    },
  },

  // ── CONTESTED -> SETTLED: NINDS-commissioned independent reanalysis (Ingall, Stroke 2004) ──
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-09-02',
    datePrecision: 'DAY',
    reason:
      'In response to the baseline-imbalance controversy the NIH appointed an independent multidisciplinary committee that regained access to the original trial data and re-ran the analysis. Ingall et al., "Findings from the reanalysis of the NINDS tissue plasminogen activator for acute ischemic stroke treatment trial" (Stroke 2004; Epub 2 Sep 2004), confirmed that a baseline severity imbalance existed but that adjusting for it did not overturn the benefit — the t-PA effect within 3 hours held. The reanalysis adjudicated the dispute and settled the finding in the expert literature.',
    source: {
      externalId: 'src:ninds-tpa-stroke:ingall-reanalysis-stroke-2004',
      name: 'Ingall TJ, O\'Fallon WM, Asplund K, et al. Findings from the reanalysis of the NINDS tissue plasminogen activator for acute ischemic stroke treatment trial. Stroke. 2004 Oct;35(10):2418–2424. Epub 2004 Sep 2. PMID 15345796; DOI 10.1161/01.STR.0000140891.70547.56.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/15345796/',
      publishedAt: '2004-09-02',
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
        ingestedBy: 'enrich:openalex_v1-ninds-tpa-stroke-1995',
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
