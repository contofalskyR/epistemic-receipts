// Enrich the epistemic arc for the econazole nitrate FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiya1588osoplo7tv9ist06 — Econazole nitrate cream indicated for tinea
// pedis, tinea cruris, tinea corporis (Trichophyton/Microsporum/Epidermophyton),
// cutaneous candidiasis, and tinea versicolor.
//
// Econazole nitrate is a topical imidazole antifungal developed by Janssen. Its
// clinical value is a mature, settled question; unlike systemic azoles it carries
// no black-box warning, no FDA safety communication, and has never been withdrawn.
// There is therefore NO high-confidence post-market safety-reversal step, so the arc
// terminates at SETTLED rather than fabricating a CONTESTED/REVERSED transition.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1978  consolidated clinical efficacy evidence enters the
//                               literature (ADIS "Drugs" therapeutic review)
//   RECORDED -> SETTLED   2014  Cochrane systematic review confirms topical azoles
//                               incl. econazole are effective for tinea cruris/corporis
//                               — standard-of-care ratification
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-econazole-nitrate-topical-antifungal.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-econazole-nitrate-topical-antifungal.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiya1588osoplo7tv9ist06'

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
  // ── OPEN -> RECORDED: consolidated clinical efficacy evidence (1978) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1978-01-01',
    datePrecision: 'YEAR',
    reason:
      'By 1978 the accumulated clinical-trial evidence for topical econazole nitrate had been consolidated in the literature in the ADIS therapeutic review by Heel and colleagues, which assessed its antifungal spectrum and controlled therapeutic efficacy across the dermatophytoses (tinea pedis, cruris, corporis), cutaneous candidiasis, and pityriasis (tinea) versicolor. This established, as a recorded proposition in the expert literature, that topical econazole was clinically effective across exactly the indications later captured in the FDA label.',
    source: {
      externalId: 'src:econazole-heel-drugs-review-1978',
      name: 'Heel RC, Brogden RN, Speight TM, Avery GS. Econazole: a review of its antifungal activity and therapeutic efficacy. Drugs. 1978;16(3):177–201.',
      url: 'https://doi.org/10.2165/00003495-197816030-00001',
      publishedAt: '1978-01-01',
      methodologyType: 'derivative',
    },
  },

  // ── RECORDED -> SETTLED: systematic-review / standard-of-care ratification (2014) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2014-08-04',
    datePrecision: 'DAY',
    reason:
      'The Cochrane systematic review of topical antifungal treatments for tinea cruris and tinea corporis (El-Gohary et al., 2014) pooled randomized-controlled-trial evidence and found the topical imidazoles — econazole among them — effective for clinical and mycological cure of these dermatophyte infections. Aggregation of the RCT evidence in a Cochrane review, alongside decades of ubiquitous first-line clinical use, settled topical econazole as standard-of-care therapy for the labelled indications rather than a merely recorded claim.',
    source: {
      externalId: 'src:econazole-cochrane-tinea-cruris-corporis-2014',
      name: 'El-Gohary M, van Zuuren EJ, Fedorowicz Z, et al. Topical antifungal treatments for tinea cruris and tinea corporis. Cochrane Database of Systematic Reviews. 2014;(8):CD009992.',
      url: 'https://doi.org/10.1002/14651858.CD009992.pub2',
      publishedAt: '2014-08-04',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const t of TRANSITIONS) {
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${historyId})`)
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda-labels',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })
  }

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Done — ${TRANSITIONS.length} transitions processed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
