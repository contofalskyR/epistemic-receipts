// Enrichment: epistemic trajectory for the openFDA-label claim asserting the
// INDICATIONS AND USAGE of Silver Sulfadiazine Cream — a topical antimicrobial
// "indicated as an adjunct for the prevention and treatment of wound sepsis in
// patients with second and third degree burns."
//
// The claim (an FDA structured-product-label snapshot ingested 2026-05-12)
// already carries its null -> RECORDED first entry. This script adds the
// downstream epistemic arc of silver sulfadiazine as a burn-wound drug fact:
//
//   OPEN -> RECORDED (1968): First published clinical characterization. Charles
//     L. Fox Jr. reported silver sulfadiazine as a new topical therapy against
//     Pseudomonas in burns in Archives of Surgery, documenting its broad
//     antibacterial activity and low toxicity in burn wounds. This foundational
//     report placed the "prevention and treatment of wound sepsis in burns"
//     indication into the recorded, citable clinical record.
//
//   RECORDED -> SETTLED (2023): Silver sulfadiazine 1% cream reached settled
//     standard-of-care status for burn care and is listed on the WHO Model List
//     of Essential Medicines (anti-infective medicines, skin), the canonical
//     institutional endorsement of a medicine as a globally essential therapeutic
//     standard. Its inclusion codifies the label's very indication — topical
//     control of burn-wound infection — as a settled standard.
//
//   SETTLED -> CONTESTED (2013): The settled assumption that silver sulfadiazine
//     is a first-line burn dressing was contested by the Cochrane systematic
//     review of dressings for superficial and partial-thickness burns (Wasiak et
//     al.), which found silver sulfadiazine consistently associated with poorer
//     healing outcomes — significantly longer time to healing and more frequent
//     dressing changes — than a range of alternative dressings. This body of
//     evidence contested the settled value of routine silver sulfadiazine use.
//
// Only high-confidence, stably-identified sources are encoded (one JAMA Network /
// Archives of Surgery DOI, one WHO Essential Medicines List, one Cochrane DOI).
//
// NOTE: Live URL verification (WebFetch/WebSearch) was unavailable in the
// authoring session; sources are included on a high-confidence basis — canonical
// DOIs (10.1001/archsurg… , 10.1002/14651858.CD…) and the WHO EML publication.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-silver-sulfadiazine-burn-wound-sepsis-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-silver-sulfadiazine-burn-wound-sepsis-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyhsyl8xwuplo7wfjwr0pr'

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

// Do NOT duplicate the existing null -> RECORDED first entry; this arc restates
// the epistemic history explicitly starting from OPEN -> RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1968-02-01',
    datePrecision: 'MONTH',
    reason:
      "Silver sulfadiazine's burn indication entered the peer-reviewed record with Charles L. Fox Jr.'s 1968 report in Archives of Surgery, which introduced silver sulfadiazine as a new topical therapy against Pseudomonas in burns. Fox documented the compound's broad antibacterial activity and low toxicity in burn wounds, providing the first published clinical characterization of the agent for the prevention and treatment of burn-wound infection. It marks the transition from an open question to a recorded burn-therapy drug fact.",
    source: {
      externalId: 'src:fox-silver-sulfadiazine-pseudomonas-burns-archsurg-1968',
      name:
        'Fox CL Jr. Silver Sulfadiazine — A New Topical Therapy for Pseudomonas in Burns: Therapy of Pseudomonas Infection in Burns. Archives of Surgery. 1968;96(2):184-188.',
      url: 'https://doi.org/10.1001/archsurg.1968.01330200022004',
      publishedAt: '1968-02-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2023-07-01',
    datePrecision: 'MONTH',
    reason:
      "Silver sulfadiazine 1% cream reached settled standard-of-care status for topical burn management and is listed on the World Health Organization Model List of Essential Medicines under anti-infective medicines (skin) — the canonical institutional endorsement of a medicine as a globally essential therapeutic standard. This inclusion codifies the label's indication, topical prevention and treatment of burn-wound infection, as a settled clinical standard rather than a merely recorded finding.",
    source: {
      externalId: 'src:who-eml-2023-silver-sulfadiazine',
      name:
        'World Health Organization. WHO Model List of Essential Medicines — 23rd List (2023), Section 13.2 Anti-infective medicines (skin): silver sulfadiazine.',
      url: 'https://www.who.int/publications/i/item/WHO-MHP-HPS-EML-2023.02',
      publishedAt: '2023-07-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2013-03-28',
    datePrecision: 'DAY',
    reason:
      "The settled assumption that silver sulfadiazine is a first-line dressing for burn wounds was contested by the Cochrane systematic review of dressings for superficial and partial-thickness burns (Wasiak et al., 2013). Pooling randomized evidence, the review found silver sulfadiazine consistently associated with poorer healing outcomes — significantly longer time to wound healing and more frequent dressing changes — than several alternative dressings (biosynthetic, silicone-coated, and silver-impregnated). This evidence directly contested the settled value of routine silver sulfadiazine use for burn care.",
    source: {
      externalId: 'src:wasiak-dressings-partial-thickness-burns-cochrane-2013',
      name:
        'Wasiak J, Cleland H, Campbell F, Spinks A. Dressings for superficial and partial thickness burns. Cochrane Database of Systematic Reviews. 2013;(3):CD002106.',
      url: 'https://doi.org/10.1002/14651858.CD002106.pub4',
      publishedAt: '2013-03-28',
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
