// Enrichment: epistemic trajectory for the openFDA-label-ingested claim asserting
// the "Purpose: Antigas" of Firstcare Gas Relief Simethicone 125 mg (SIMETHICONE 125 MG).
//
// Claim: cmpiylej0926iplo7m9vkqf23 (ingestedBy openfda_labels_v1)
//
// The claim already has its null -> RECORDED first entry (the FDA label record).
// This script adds the underlying medical/regulatory proposition's arc — that
// simethicone is an established, safe-and-effective over-the-counter antiflatulent —
// which both predates and is later qualified by the modern label:
//
//   RECORDED -> SETTLED (FDA OTC monograph): Simethicone is recognized by the FDA OTC
//     Drug Review as the sole active ingredient generally recognized as safe and
//     effective (GRASE) as an antiflatulent, codified at 21 CFR Part 332. This is the
//     regulatory basis on which the label markets the "Antigas" purpose.
//
//   SETTLED -> CONTESTED (efficacy signal): A randomized, double-blind, placebo-
//     controlled multicenter trial (Metcalf et al., Pediatrics, 1994) found simethicone
//     no better than placebo for infant colic — the beginning of a durable expert-
//     literature contestation of simethicone's symptomatic efficacy for functional gas
//     complaints. Its GRASE monograph *status* is unchanged; the *efficacy proposition*
//     is what is contested.
//
// NOTE: Simethicone is non-absorbed and carries no post-market safety signal (no
// withdrawal, no boxed warning), so there is no SETTLED->REVERSED safety arc to add.
// The honest contestation is over efficacy, not safety.
//
// Only high-confidence, deterministic/stable URLs are encoded (eCFR part path; the
// Pediatrics volume.issue.page DOI scheme). A "first Phase III trial" OPEN->RECORDED
// node was deliberately NOT added: no specific early-trial primary-publication URL
// could be verified in this session, and fabricating a DOI/PMID is barred by the
// hard-fact pipeline principles.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-firstcare-simethicone-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-firstcare-simethicone-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiylej0926iplo7m9vkqf23'

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

// Do NOT duplicate the existing null -> RECORDED first entry (the label record).
// The transitions below trace the underlying antiflatulent proposition's arc.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1990-01-01',
    datePrecision: 'YEAR',
    reason:
      "The proposition that simethicone is a safe and effective anti-gas agent was ratified at the institutional level through the FDA OTC Drug Review, which recognized simethicone as the sole active ingredient generally recognized as safe and effective (GRASE) as an antiflatulent for over-the-counter human use. This status is codified at 21 CFR Part 332 (Antiflatulent Products for Over-the-Counter Human Use), the regulatory basis on which products such as this Firstcare simethicone 125 mg label market the 'Antigas' purpose. Simethicone had become the established, monograph-recognized OTC antiflatulent well before 1994 (YEAR precision reflects the monograph era rather than a single promulgation date).",
    source: {
      externalId: 'src:fda-otc-antiflatulent-monograph-21cfr332',
      name:
        'U.S. Food and Drug Administration. 21 CFR Part 332 — Antiflatulent Products for Over-the-Counter Human Use (simethicone recognized as the GRASE antiflatulent active ingredient).',
      url: 'https://www.ecfr.gov/current/title-21/part-332',
      publishedAt: '1990-01-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1994-07-01',
    datePrecision: 'MONTH',
    reason:
      "Simethicone's symptomatic efficacy was subsequently contested by controlled clinical evidence. In a randomized, double-blind, placebo-controlled multicenter trial, Metcalf and colleagues found that simethicone performed no better than placebo in relieving the symptoms of infant colic, undercutting a common gas-relief indication. Simethicone retains its GRASE antiflatulent monograph status, but this trial — echoed by later systematic reviews — established that its benefit for functional gas-related complaints is not well supported, placing the broad efficacy proposition into durable expert-literature contestation.",
    source: {
      externalId: 'src:metcalf-simethicone-colic-1994',
      name:
        'Metcalf TJ, Irons TG, Sher LD, Young PC. Simethicone in the treatment of infant colic: a randomized, placebo-controlled, multicenter trial. Pediatrics. 1994;94(1):29-34.',
      url: 'https://doi.org/10.1542/peds.94.1.29',
      publishedAt: '1994-07-01',
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
