// Enrichment: epistemic arc for the CHLOROXYLENOL (PCMX) OTC antiseptic claim.
//
// Claim (openfda_labels_v1):
//   cmpiymi7a93h0plo7llep7ppp —
//   "Chemseptic (CHLOROXYLENOL): Drug Facts Box OTC-Purpose Section Antiseptic"
//
// The label is an instance of a much older regulated fact: chloroxylenol's
// status as a topical antiseptic active ingredient. That underlying fact has a
// dateable, well-sourced epistemic arc through hand-hygiene guideline literature
// and the FDA OTC antiseptic-wash monograph rulemaking:
//
//   OPEN     -> RECORDED  (2002)  CDC MMWR hand-hygiene guideline records PCMX
//                                 as an antiseptic agent with a described spectrum.
//   RECORDED -> SETTLED   (2009)  WHO global hand-hygiene guidelines include
//                                 chloroxylenol among established antiseptic agents.
//   SETTLED  -> CONTESTED (2016)  FDA consumer-antiseptic-wash final rule bans 19
//                                 actives (triclosan/triclocarban) but DEFERS a
//                                 GRASE determination on chloroxylenol, requiring
//                                 additional safety/effectiveness data.
//
// This mirrors the arc used for the sibling CHLOROXYLENOL label claim
// (cmpiyma9j936oplo722n82ue3, "Freshands Premium Foamy Antibacterial Handsoap"),
// because both labels are instances of the same underlying regulated fact. The
// three canonical sources are shared and upserted idempotently on externalId.
//
// The existing first ClaimStatusHistory row (fromAxis=null -> OPEN) is left
// untouched; this script adds only the OPEN->RECORDED->SETTLED->CONTESTED arc.
//
// Idempotent: upserts sources on externalId and history rows on deterministic id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-chemseptic-chloroxylenol-antiseptic-arc.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiymi7a93h0plo7llep7ppp'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED : PCMX recorded as an antiseptic agent in guideline literature ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2002-10-25',
    datePrecision: 'DAY',
    reason:
      "The CDC's 'Guideline for Hand Hygiene in Health-Care Settings' (MMWR 2002;51(RR-16), 25 October 2002) recorded chloroxylenol (para-chloro-meta-xylenol, PCMX) among the antiseptic agents used in hand-hygiene products, summarizing its antimicrobial spectrum (good gram-positive activity, fair activity against gram-negative bacteria, mycobacteria, and viruses) and its residual activity. This fixed the antiseptic property of chloroxylenol in the peer-reviewed guideline literature.",
    source: {
      externalId: 'src:cdc-mmwr-hand-hygiene-2002',
      name: 'CDC. Guideline for Hand Hygiene in Health-Care Settings. MMWR 2002;51(RR-16).',
      url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/rr5116a1.htm',
      publishedAt: '2002-10-25',
      methodologyType: 'derivative',
    },
  },

  // ── RECORDED -> SETTLED : global guideline inclusion / standard-of-care recognition ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2009-01-01',
    datePrecision: 'YEAR',
    reason:
      "The WHO 'Guidelines on Hand Hygiene in Health Care' (2009), the consolidated global standard produced under the First Global Patient Safety Challenge, listed chloroxylenol among the established antiseptic agents used in antimicrobial soaps and characterized its activity and use. Inclusion in the WHO guideline settled chloroxylenol's status internationally as a recognized topical antiseptic active ingredient.",
    source: {
      externalId: 'src:who-hand-hygiene-guidelines-2009',
      name: 'World Health Organization. WHO Guidelines on Hand Hygiene in Health Care (2009). ISBN 9789241597906.',
      url: 'https://www.who.int/publications/i/item/9789241597906',
      publishedAt: '2009-01-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED : FDA defers GRASE determination, requires more data ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-09-06',
    datePrecision: 'DAY',
    reason:
      "In its final rule on consumer antiseptic wash products (published in the Federal Register 6 September 2016), the FDA determined that 19 active ingredients — including triclosan and triclocarban — were not generally recognized as safe and effective (GRASE) for over-the-counter antibacterial soaps. For chloroxylenol the agency did not issue a GRASE finding but instead deferred rulemaking, requiring manufacturers to submit additional safety and effectiveness data. This placed the regulatory status of chloroxylenol as an OTC antiseptic active in open question rather than settled.",
    source: {
      externalId: 'src:fda-consumer-antiseptic-wash-final-rule-2016',
      name: 'FDA. Safety and Effectiveness of Consumer Antiseptics; final rule (2016) — press announcement.',
      url: 'https://www.fda.gov/news-events/press-announcements/fda-issues-final-rule-safety-and-effectiveness-antibacterial-soaps',
      publishedAt: '2016-09-02',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — refusing to create a new Claim.`)
  }

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1-chemseptic-chloroxylenol-antiseptic-arc',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`Done. ${TRANSITIONS.length} transitions upserted for ${CLAIM_ID}.`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
