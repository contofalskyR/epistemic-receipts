// Enrichment: epistemic trajectory for the openFDA-label-ingested claim asserting
// the purpose of Infants' Motrin (ibuprofen) as a "Pain reliever/fever reducer."
//
// Claim: "Motrin Infants (IBUPROFEN): Purposes Pain reliever/fever reducer"
// Claim ID: cmpiyhovn8xs0plo7gv7ydkie
//
// The claim already has its OPEN/null -> RECORDED first entry (the FDA OTC drug
// label itself, the artifact that records the labeled purpose). This script adds
// the downstream epistemic arc for ibuprofen as a pediatric analgesic/antipyretic:
//
//   RECORDED -> SETTLED (1995): The Boston University Fever Study — a
//     practitioner-based randomized clinical trial of ~84,000 febrile children
//     (Lesko & Mitchell, JAMA 1995) — established that ibuprofen carried no
//     increased short-term risk of the serious adverse outcomes of concern
//     (hospitalization for GI bleeding, renal failure, anaphylaxis, Reye's
//     syndrome) relative to acetaminophen. This large-scale safety evidence
//     underpinned pediatric ibuprofen's move to OTC availability and its
//     standard-of-care status as a childhood antipyretic/analgesic.
//
//   SETTLED -> CONTESTED (2015): FDA post-market safety signal. The FDA Drug
//     Safety Communication of 9 July 2015 strengthened the existing labeling
//     warning that non-aspirin NSAIDs — the class that includes ibuprofen — can
//     increase the risk of heart attack or stroke, based on a comprehensive
//     review of the accumulated cardiovascular safety data. This reopened the
//     "broadly safe" framing that had settled ibuprofen's OTC standing, without
//     overturning its labeled analgesic/antipyretic efficacy.
//
// Only high-confidence, canonical-URL arcs (DOI + FDA.gov) are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-motrin-infants-ibuprofen-pain-fever.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-motrin-infants-ibuprofen-pain-fever.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyhovn8xs0plo7gv7ydkie'

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
    occurredAt: '1995-09-20',
    datePrecision: 'DAY',
    reason:
      "The safety of ibuprofen as a pediatric antipyretic/analgesic was settled at scale by the Boston University Fever Study, a practitioner-based randomized clinical trial that enrolled roughly 84,000 febrile children randomized to ibuprofen or acetaminophen. Lesko and Mitchell found no increased risk of the serious short-term adverse outcomes of concern — hospitalization for gastrointestinal bleeding, acute renal failure, anaphylaxis, or Reye's syndrome — for ibuprofen relative to acetaminophen. This large-scale evidence base underpinned pediatric ibuprofen's transition to over-the-counter availability and its establishment as a standard-of-care childhood fever reducer and pain reliever.",
    source: {
      externalId: 'src:lesko-mitchell-pediatric-ibuprofen-safety-jama-1995',
      name:
        'Lesko SM, Mitchell AA. An assessment of the safety of pediatric ibuprofen: a practitioner-based randomized clinical trial. JAMA. 1995;274(11):929-933.',
      url: 'https://doi.org/10.1001/jama.1995.03530110091046',
      publishedAt: '1995-09-20',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2015-07-09',
    datePrecision: 'DAY',
    reason:
      "The FDA issued a Drug Safety Communication strengthening its warning that non-aspirin nonsteroidal anti-inflammatory drugs (NSAIDs) — the class that includes ibuprofen — can increase the risk of heart attack or stroke, based on a comprehensive review of newer cardiovascular safety data. The strengthened warning revised the labeling of all prescription and over-the-counter NSAID products, reopening the 'broadly safe' framing that had settled ibuprofen's over-the-counter standing. The labeled analgesic/antipyretic efficacy of ibuprofen was not overturned, but its post-market safety profile moved back into active institutional contestation.",
    source: {
      externalId: 'src:fda-dsc-nsaid-cardiovascular-warning-2015',
      name:
        'U.S. Food and Drug Administration. FDA Drug Safety Communication: FDA strengthens warning that non-aspirin nonsteroidal anti-inflammatory drugs (NSAIDs) can cause heart attacks or strokes. July 9, 2015.',
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
