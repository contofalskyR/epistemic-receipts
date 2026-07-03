// Enrichment: epistemic trajectory for an openFDA-label-ingested claim asserting
// that LIDOCAINE (Healcome Lidocaine Numbing Cream) has the "Purpose: Topical
// Analgesia" OTC drug-facts statement.
//
// The claim is a monograph label statement, but it stands on a real scientific and
// regulatory arc that is dateable and primary-sourced:
//
//   OPEN -> RECORDED (1949): Lidocaine (Xylocaine), synthesized by Löfgren and
//     Lundqvist in 1943, enters the clinical record. Torsten Gordh reports the first
//     systematic clinical evaluation of "Xylocaine — a new local analgesic" in the
//     journal Anaesthesia, establishing lidocaine as an effective local anesthetic in
//     human use. This primary clinical report is the empirical basis for its later
//     topical-analgesic labeling.
//
//   RECORDED -> SETTLED (1983): The FDA OTC drug review's External Analgesic tentative
//     final monograph (48 FR 5852; codified framework at 21 CFR part 348) recognizes
//     lidocaine as a topical anesthetic / external analgesic active ingredient,
//     institutionalizing the exact "Purpose: topical analgesic" labeling the claim
//     reproduces.
//
//   SETTLED -> CONTESTED (2014): An FDA Drug Safety Communication requires a Boxed
//     Warning on oral/topical viscous lidocaine 2% and recommends against using it for
//     teething pain, after reports of serious harm and death from systemic toxicity
//     (seizures, cardiac arrest) when applied to mucous membranes. This post-market
//     safety signal contests the assumption that topical lidocaine is benign at
//     label-recommended use, echoing the very warnings the ingested label carries
//     ("Do not exceed the recommended daily dosage unless directed by a doctor").
//
// Only high-confidence, canonical DOI / .gov-anchored arcs are encoded.
// NOTE: URLs below were NOT live-fetched (web tools unavailable this session); they
// are canonical publisher DOIs, the stable eCFR codification of 21 CFR part 348, and
// the FDA Drug Safety Communication permalink.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-lidocaine-topical-analgesia.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-lidocaine-topical-analgesia.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiydedi8stuplo74l91tfqf'

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

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1949-01-01',
    datePrecision: 'YEAR',
    reason:
      'Lidocaine (Xylocaine), first synthesized by Nils Löfgren and Bengt Lundqvist in 1943, entered the clinical record when Torsten Gordh published the first systematic clinical evaluation, "Xylocaine — a new local analgesic," in the journal Anaesthesia. The report documented lidocaine\'s efficacy and tolerability as a local anesthetic in human patients, establishing the empirical basis for the substance now labeled for topical analgesia. This is the primary clinical evidence underpinning the ingested "Purpose: Topical Analgesia" claim.',
    source: {
      externalId: 'src:gordh-xylocaine-anaesthesia-1949',
      name:
        'Gordh T. Xylocaine — a new local analgesic. Anaesthesia. 1949;4(1):4-9.',
      url: 'https://doi.org/10.1111/j.1365-2044.1949.tb05802.x',
      publishedAt: '1949-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1983-02-08',
    datePrecision: 'DAY',
    reason:
      'The FDA over-the-counter drug review settled lidocaine\'s topical-analgesic status through the External Analgesic Drug Products rulemaking. The tentative final monograph (48 FR 5852) and its codified framework at 21 CFR part 348 recognize lidocaine as a topical anesthetic / external analgesic active ingredient carrying the "Purpose: topical analgesic" indication — the exact monograph statement the ingested label reproduces. This institutional codification made the claim a standard, permitted OTC labeling rather than a manufacturer assertion.',
    source: {
      externalId: 'src:fda-otc-external-analgesic-monograph-21cfr348',
      name:
        'U.S. Food and Drug Administration. 21 CFR Part 348 — External Analgesic Drug Products for Over-the-Counter Human Use (tentative final monograph, 48 FR 5852, Feb 8, 1983).',
      url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-D/part-348',
      publishedAt: '1983-02-08',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2014-06-26',
    datePrecision: 'DAY',
    reason:
      'An FDA Drug Safety Communication contested the assumption that topical lidocaine is benign at label-recommended use. The FDA required a Boxed Warning on oral viscous lidocaine 2% and recommended against using it for teething pain, after reports of serious adverse events and deaths from systemic toxicity — seizures, severe brain injury, and cardiac arrest — when lidocaine applied to mucous membranes was absorbed or overdosed. The signal reframed topical lidocaine as a substance requiring strict dose limits, directly reflecting the ingested label\'s own warnings not to exceed the recommended daily dosage.',
    source: {
      externalId: 'src:fda-dsc-lidocaine-teething-boxed-warning-2014',
      name:
        'U.S. Food and Drug Administration. FDA Drug Safety Communication: FDA recommends not using lidocaine to treat teething pain and requires new Boxed Warning (June 26, 2014).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-fda-recommends-not-using-lidocaine-treat-teething-pain-and-requires',
      publishedAt: '2014-06-26',
      methodologyType: 'derivative',
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
