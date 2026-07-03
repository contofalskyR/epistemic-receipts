// Enrichment: epistemic trajectory for an openFDA-label-ingested claim describing
// ibuprofen's over-the-counter labeled purpose — "Pain reliever/fever reducer."
//
// Ibuprofen (2-(4-isobutylphenyl)propionic acid) was discovered by Stewart Adams,
// John Nicholson and colleagues at the Boots Company in the early 1960s. Its arc
// from experimental propionic-acid NSAID to the world's most widely used
// non-prescription analgesic/antipyretic, and then to a class carrying a
// strengthened cardiovascular warning, is well documented.
//
// The claim already has its OPEN/null -> first-status entry (the label record
// itself, dated to the openFDA ingest). This script adds the downstream arc:
//
//   OPEN -> RECORDED (1969): First clinical/pharmacological evidence establishing
//     ibuprofen's analgesic, antipyretic and anti-inflammatory activity, published
//     by Adams and colleagues, with the drug entering UK clinical use as a
//     prescription anti-rheumatic in 1969.
//
//   RECORDED -> SETTLED (1984): Broad clinical adoption — the U.S. FDA approved
//     ibuprofen for over-the-counter sale in 1984, and the drug is listed on the
//     WHO Model List of Essential Medicines, settling its standard-of-care status
//     as a first-line non-prescription pain reliever / fever reducer.
//
//   SETTLED -> CONTESTED (2015): A post-market safety signal — on 9 July 2015 the
//     FDA issued a Drug Safety Communication strengthening the warning that
//     non-aspirin NSAIDs (including ibuprofen) can increase the risk of heart
//     attack and stroke, contesting the drug's cardiovascular safety margin (the
//     product remains approved and OTC, so the arc is CONTESTED, not REVERSED).
//
// Only high-confidence, verifiable URLs are encoded (Wikipedia's Ibuprofen article,
// which the repo's seed pattern uses as a source URL for primary works, and the
// FDA.gov Drug Safety Communication).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-ibuprofen-otc-analgesic-antipyretic-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-ibuprofen-otc-analgesic-antipyretic-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyenc78uauplo75vqrzpmd'

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

// Do NOT duplicate the existing null -> first-status entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1969-01-01',
    datePrecision: 'YEAR',
    reason:
      "The analgesic, antipyretic and anti-inflammatory activity of ibuprofen was first established in the clinical and pharmacological literature by Stewart Adams, John Nicholson and colleagues at the Boots Company, who characterised the propionic-acid NSAID and reported its pharmacological properties in 1969. Following early clinical trials in rheumatoid arthritis, ibuprofen entered clinical use as a prescription anti-rheumatic agent in the United Kingdom in 1969, recording the empirical proposition that it relieves pain and reduces fever.",
    source: {
      externalId: 'src:ibuprofen-adams-boots-first-clinical-1969',
      name:
        'Adams SS, McCullough KF, Nicholson JS. The pharmacological properties of ibuprofen, an anti-inflammatory, analgesic and antipyretic agent. Archives Internationales de Pharmacodynamie et de Thérapie. 1969;178(1):115-129 (ibuprofen enters UK clinical use, 1969).',
      url: 'https://en.wikipedia.org/wiki/Ibuprofen',
      publishedAt: '1969-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1984-01-01',
    datePrecision: 'YEAR',
    reason:
      "Ibuprofen's status as a standard, first-line pain reliever and fever reducer was settled by institutional adoption. In 1984 the U.S. Food and Drug Administration approved ibuprofen for over-the-counter sale, moving it from a prescription anti-rheumatic to a mass-market non-prescription analgesic/antipyretic (marketed as Advil, Nuprin and later Motrin IB). It is also listed on the World Health Organization Model List of Essential Medicines as an essential analgesic/antipyretic/anti-inflammatory medicine, confirming its standard-of-care role — precisely the labeled OTC purpose asserted by this claim.",
    source: {
      externalId: 'src:ibuprofen-otc-approval-who-eml-1984',
      name:
        'U.S. FDA approval of ibuprofen for over-the-counter sale (1984); WHO Model List of Essential Medicines inclusion (ibuprofen as an essential analgesic/antipyretic/anti-inflammatory medicine).',
      url: 'https://en.wikipedia.org/wiki/Ibuprofen',
      publishedAt: '1984-01-01',
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
      "A post-market safety signal contested ibuprofen's cardiovascular safety margin. On 9 July 2015 the FDA issued a Drug Safety Communication strengthening the existing warning that non-aspirin nonsteroidal anti-inflammatory drugs (NSAIDs), which include ibuprofen, can increase the risk of heart attack or stroke — a risk that can occur early in treatment and rise with dose and duration of use. The FDA required label updates across prescription and over-the-counter NSAIDs. Ibuprofen remains approved and available over the counter, so its labeled purpose is qualified rather than withdrawn — the claim moves from SETTLED into active contestation over its safety profile.",
    source: {
      externalId: 'src:fda-nsaid-cv-warning-strengthened-2015',
      name:
        'FDA Drug Safety Communication: FDA strengthens warning that non-aspirin nonsteroidal anti-inflammatory drugs (NSAIDs) can cause heart attacks or strokes (9 July 2015).',
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
