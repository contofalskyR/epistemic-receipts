// Epistemic-receipt enrichment for the updated Köppen-Geiger world map
// (Kottek, Grieser, Beck, Rudolf & Rubel, Meteorologische Zeitschrift 2006-07-02,
//  DOI 10.1127/0941-2948/2006/0130, OpenAlex W2127170577).
//
// Claim id cmq2w4f48009fsa8h1vcmt9y5 already carries its baseline
// (fromAxis=null -> RECORDED @ 2006-07-02). This script adds the post-publication
// arc only:
//   RECORDED  -> CONTESTED  (2007-10-11) independent competing re-derivation (Peel et al., HESS)
//   CONTESTED -> SETTLED    (2018-10-30) station-based validation + standard successor (Beck et al., Sci. Data)
//
// No retraction, expression of concern, or erratum exists for the Kottek 2006 paper
// (checked Meteorologische Zeitschrift / Schweizerbart and Retraction Watch, 2026-07-15).
// The arc is the field's classic contest-then-consolidation over the "correct" digital
// Köppen-Geiger map, not a challenge to the paper's integrity.
//
// Idempotent: source upsert on externalId, history upsert on deterministic id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-koppen-geiger-climate-classification-2006.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-koppen-geiger-climate-classification-2006.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w4f48009fsa8h1vcmt9y5'

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
  // ── RECORDED -> CONTESTED: competing independent re-derivation (Peel et al., HESS 2007) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-10-11',
    datePrecision: 'DAY',
    reason:
      'Within fifteen months a second team produced a competing "updated" world Köppen-Geiger map from a different station network and a different summer/winter precipitation threshold (70% rather than Kottek et al.\'s two-thirds/66.7%), yielding materially different class boundaries at 0.1° versus 0.5° resolution. Peel, Finlayson & McMahon (Hydrol. Earth Syst. Sci., 11 Oct 2007) explicitly documented discrepancies between the two maps, so the question of the single "correct" digital update moved from recorded to actively contested in the climatology and hydrology literature.',
    source: {
      externalId: 'src:koppen-geiger-2006:peel-hess-updated-map-2007',
      name: 'Peel MC, Finlayson BL, McMahon TA. Updated world map of the Köppen-Geiger climate classification. Hydrology and Earth System Sciences. 2007;11(5):1633–1644. DOI 10.5194/hess-11-1633-2007.',
      url: 'https://hess.copernicus.org/articles/11/1633/2007/',
      publishedAt: '2007-10-11',
      methodologyType: 'primary',
    },
  },

  // ── CONTESTED -> SETTLED: station-based validation + standard successor (Beck et al., Sci. Data 2018) ──
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2018-10-30',
    datePrecision: 'DAY',
    reason:
      'Beck et al., "Present and future Köppen-Geiger climate classification maps at 1-km resolution" (Scientific Data, 30 Oct 2018), adjudicated the competing maps by calculating each one\'s classification accuracy against 22,078 station observations — Kottek et al.\'s map scored 66–73% and the new topographically corrected 1-km ensemble scored 80.0%. By quantitatively benchmarking the earlier updates and delivering a freely available, validated high-resolution successor that the field converged on, the paper settled the digitally-updated Köppen-Geiger classification as the standard global reference framework while confirming the 2006 update as a valid, improvable step in that lineage.',
    source: {
      externalId: 'src:koppen-geiger-2006:beck-scidata-1km-validation-2018',
      name: 'Beck HE, Zimmermann NE, McVicar TR, Vergopolan N, Berg A, Wood EF. Present and future Köppen-Geiger climate classification maps at 1-km resolution. Scientific Data. 2018;5:180214. DOI 10.1038/sdata.2018.214. PMCID PMC6207062.',
      url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6207062/',
      publishedAt: '2018-10-30',
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
        ingestedBy: 'enrich:openalex_v1-koppen-geiger-climate-classification-2006',
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
