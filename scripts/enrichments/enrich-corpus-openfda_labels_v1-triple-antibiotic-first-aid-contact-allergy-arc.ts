// Enrichment: epistemic trajectory for the openFDA-label claim asserting the
// PURPOSE of a maximum-strength triple-antibiotic first aid ointment
// (BACITRACIN ZINC, NEOMYCIN SULFATE, POLYMYXIN B SULFATE) — "First aid
// antibiotic".
//
// The claim (an FDA structured-product-label snapshot ingested 2026-05-12)
// already carries its null -> RECORDED first entry. This script adds the
// downstream epistemic arc of the OTC triple-antibiotic ointment as a drug
// fact:
//
//   OPEN -> RECORDED (1945): First published antibacterial characterization of
//     the product's lead component. Johnson, Anker, and Meleney isolated and
//     named bacitracin — a new antibiotic from a Bacillus subtilis group
//     organism — in Science, documenting activity against gram-positive
//     organisms. This foundational report (together with the near-contemporary
//     isolations of polymyxin, 1947, and neomycin, 1949) put the ointment's
//     antibacterial ingredients into the recorded, citable scientific record.
//
//   RECORDED -> SETTLED (1987): The three ingredients reached settled
//     standard-first-aid status through the FDA's over-the-counter drug review,
//     which classifies bacitracin, neomycin sulfate, and polymyxin B sulfate as
//     Category I (generally recognized as safe and effective) "first aid
//     antibiotic" active ingredients. This recognition is codified in the OTC
//     monograph at 21 CFR Part 333, Subpart B — the regulatory basis for the
//     label's very "First aid antibiotic" PURPOSE statement.
//
//   SETTLED -> CONTESTED (1996): The settled assumption that routine topical
//     antibiotic ointment meaningfully prevents wound infection was contested by
//     the Smack et al. randomized controlled trial in JAMA, which found white
//     petrolatum equivalent to bacitracin ointment for preventing infection in
//     ambulatory surgical wounds while carrying no risk of allergic contact
//     dermatitis. Bacitracin and neomycin are among the most common topical
//     contact allergens (neomycin was named the American Contact Dermatitis
//     Society's Allergen of the Year), and bacitracin has caused anaphylaxis.
//     This body of evidence contested the settled value of the product's
//     everyday first-aid use.
//
// Only high-confidence, stably-identified sources are encoded (one crossref
// DOI, one stable eCFR.gov codification, one JAMA DOI).
//
// NOTE: Live URL verification (WebFetch/WebSearch) was unavailable in the
// authoring session; sources are included on a high-confidence basis —
// canonical DOIs and the current eCFR codification of 21 CFR Part 333.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-triple-antibiotic-first-aid-contact-allergy-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-triple-antibiotic-first-aid-contact-allergy-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy8itq8n6iplo7hwt5unyx'

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
    occurredAt: '1945-01-01',
    datePrecision: 'YEAR',
    reason:
      "The ointment's antibacterial claim entered the peer-reviewed record with Johnson, Anker, and Meleney's 1945 report in Science, which isolated and named bacitracin — a new antibiotic produced by a member of the Bacillus subtilis group — and documented its activity against gram-positive organisms. Together with the near-contemporary isolations of polymyxin (1947) and neomycin (1949), this foundational work placed the product's three active ingredients into the recorded, citable scientific record. It marks the transition from an open question to a recorded antibacterial drug fact.",
    source: {
      externalId: 'src:johnson-anker-meleney-bacitracin-science-1945',
      name:
        'Johnson BA, Anker H, Meleney FL. Bacitracin: A New Antibiotic Produced by a Member of the B. subtilis Group. Science. 1945;102(2650):376-377.',
      url: 'https://doi.org/10.1126/science.102.2650.376',
      publishedAt: '1945-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1987-01-01',
    datePrecision: 'YEAR',
    reason:
      "The three active ingredients reached settled standard-first-aid status through the U.S. Food and Drug Administration's over-the-counter (OTC) drug review, which recognizes bacitracin, neomycin sulfate, and polymyxin B sulfate as Category I — generally recognized as safe and effective — 'first aid antibiotic' active ingredients. This recognition is codified in the OTC monograph at 21 CFR Part 333, Subpart B, which is the direct regulatory basis for the label's 'First aid antibiotic' PURPOSE statement. Institutional endorsement moved the ingredients' first-aid indication from merely recorded to settled, marketable standard.",
    source: {
      externalId: 'src:ecfr-21cfr333-first-aid-antibiotic-monograph',
      name:
        'U.S. Food and Drug Administration. First Aid Antibiotic Drug Products for Over-the-Counter Human Use. Code of Federal Regulations, Title 21, Part 333, Subpart B (21 CFR 333.110-333.160).',
      url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-D/part-333/subpart-B',
      publishedAt: '1987-01-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1996-09-01',
    datePrecision: 'MONTH',
    reason:
      "The settled assumption that routine topical antibiotic ointment meaningfully prevents wound infection — and does so more safely than a bland emollient — was contested by the Smack et al. randomized controlled trial in JAMA (1996). In 922 ambulatory surgical wounds, white petrolatum was equivalent to bacitracin ointment for preventing infection, while bacitracin produced allergic contact dermatitis that petrolatum did not. Because bacitracin and neomycin rank among the most common topical contact allergens (neomycin was named the American Contact Dermatitis Society's Allergen of the Year) and bacitracin has caused anaphylaxis, this evidence directly contested the settled everyday value of the triple-antibiotic first-aid product.",
    source: {
      externalId: 'src:smack-bacitracin-petrolatum-rct-jama-1996',
      name:
        'Smack DP, Harrington AC, Dunn C, Howard RS, Szkutnik AJ, Krivda SJ, Caldwell JB, James WD. Infection and Allergy Incidence in Ambulatory Surgery Patients Using White Petrolatum vs Bacitracin Ointment: A Randomized Controlled Trial. JAMA. 1996;276(12):972-977.',
      url: 'https://doi.org/10.1001/jama.1996.03540120050033',
      publishedAt: '1996-09-01',
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
