// Enrichment: epistemic trajectory for the openFDA-label claim asserting that
// naproxen sodium is an OTC "Pain reliever/fever reducer."
//
// Claim: naproxen sodium (NAPROXEN SODIUM): Purposes Pain reliever/fever reducer
// Claim id: cmpiycrky8s2uplo7xpzcweyv  (ingestedBy: openfda_labels_v1)
//
// The claim already carries its OPEN/null -> RECORDED first entry (naproxen's
// analgesic efficacy first established in the clinical literature of the 1970s and
// its FDA approval as prescription Naprosyn in 1976). This script adds only the
// downstream arc, anchored exclusively to high-confidence canonical URLs:
//
//   RECORDED -> SETTLED (2013): The Coxib and traditional NSAID Trialists' (CNT)
//     Collaboration published an individual-participant-data meta-analysis of the
//     vascular and upper-GI effects of NSAIDs in the Lancet. Pooling ~639 trials, it
//     consolidated the evidence base for the NSAID class and — importantly for
//     naproxen — found that naproxen was NOT associated with a significant increase
//     in major vascular events, cementing its standing as an effective and
//     comparatively cardiovascular-safe standard-of-care NSAID.
//
//   SETTLED -> CONTESTED (2015): The FDA issued a Drug Safety Communication
//     strengthening the existing warning that non-aspirin NSAIDs — the class that
//     includes naproxen sodium — can cause heart attack and stroke, and required
//     labeling changes for both prescription and OTC products. This regulatory action
//     put the "safe everyday OTC pain reliever" framing of the whole class under
//     active contestation on cardiovascular-safety grounds.
//
// Only DOI-anchored / .gov-anchored arcs are encoded.
// NOTE: web verification tooling was unavailable when authoring; both URLs are
// canonical publisher/regulator links asserted from high confidence, not a live
// 200 check.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-naproxen-sodium-pain-reliever.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-naproxen-sodium-pain-reliever.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiycrky8s2uplo7xpzcweyv'

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

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

// Do NOT duplicate the existing null -> RECORDED first entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2013-05-30',
    datePrecision: 'DAY',
    reason:
      "The efficacy and comparative safety of naproxen as a standard NSAID were consolidated by the Coxib and traditional NSAID Trialists' (CNT) Collaboration meta-analysis of individual participant data from hundreds of randomised trials, published in the Lancet. The analysis characterised the vascular and upper-gastrointestinal effects of the NSAID class and found that, unlike diclofenac and the coxibs, naproxen was not associated with a significant increase in major vascular events. This settled naproxen's place as an effective and relatively cardiovascular-neutral first-line NSAID underpinning its routine use as a pain reliever/fever reducer.",
    source: {
      externalId: 'src:cnt-collaboration-nsaid-metaanalysis-lancet-2013',
      name:
        "Coxib and traditional NSAID Trialists' (CNT) Collaboration (Bhala N, Emberson J, Merhi A, et al.). Vascular and upper gastrointestinal effects of non-steroidal anti-inflammatory drugs: meta-analyses of individual participant data from randomised trials. The Lancet. 2013;382(9894):769-779.",
      url: 'https://doi.org/10.1016/S0140-6736(13)60900-9',
      publishedAt: '2013-05-30',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2015-07-09',
    datePrecision: 'DAY',
    reason:
      "The US Food and Drug Administration issued a Drug Safety Communication strengthening its existing warning that non-aspirin nonsteroidal anti-inflammatory drugs — the class that includes naproxen sodium — can cause heart attacks or strokes, and required updated labeling for both prescription and over-the-counter products. The action stated the risk can occur early in treatment and increase with dose and duration, and it directed consumers and clinicians to weigh cardiovascular risk. This put the framing of naproxen sodium as a benign everyday OTC pain reliever/fever reducer into active contestation on cardiovascular-safety grounds.",
    source: {
      externalId: 'src:fda-dsc-nsaid-heart-attack-stroke-2015',
      name:
        'US Food and Drug Administration. FDA Drug Safety Communication: FDA strengthens warning that non-aspirin nonsteroidal anti-inflammatory drugs (NSAIDs) can cause heart attacks or strokes. July 9, 2015.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-fda-strengthens-warning-non-aspirin-nonsteroidal-anti-inflammatory',
      publishedAt: '2015-07-09',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${
      DRY_RUN ? ' (DRY RUN)' : ''
    }`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`)
  }

  for (const t of TRANSITIONS) {
    const s = t.source
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    console.log(
      `  ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${s.externalId})`,
    )
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: s.externalId },
      create: {
        externalId: s.externalId,
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1',
        autoApproved: true,
      },
      update: {
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
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

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
