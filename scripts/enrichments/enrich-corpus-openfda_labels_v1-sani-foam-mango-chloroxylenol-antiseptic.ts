// Enrichment: epistemic arc for the OTC drug fact "chloroxylenol (PCMX) is an
// antiseptic active ingredient", underlying the openFDA label claim
//   cmpiyiov88ywiplo7n7ig1jq8 —
//   "Sani Foam Mango Antiseptic Hand and Body Wash (CHLOROXYLENOL): Drug Facts
//    Box OTC-Purpose Section Antiseptic"
//
// The 2026-05-11 label merely records a long-standing drug fact. This script adds
// the two high-confidence, verifiable-source transitions in that fact's arc:
//   RECORDED -> SETTLED  : CDC/HICPAC hand-hygiene guideline (2002) treats
//                          chloroxylenol (PCMX) as an established antiseptic active.
//   SETTLED  -> CONTESTED: FDA's 2016 Consumer Antiseptic Wash final rule declined
//                          to find chloroxylenol GRASE and deferred rulemaking,
//                          pending additional safety/efficacy data.
//
// Does NOT create a new Claim and does NOT duplicate the existing null->first row.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-sani-foam-mango-chloroxylenol-antiseptic.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-sani-foam-mango-chloroxylenol-antiseptic.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyiov88ywiplo7n7ig1jq8'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus | null
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
  // ── RECORDED -> SETTLED : CDC/HICPAC hand-hygiene guideline (2002) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2002-10-25',
    datePrecision: 'DAY',
    reason:
      'The CDC Healthcare Infection Control Practices Advisory Committee (HICPAC) "Guideline for Hand Hygiene in Health-Care Settings" (MMWR Recommendations and Reports, 25 October 2002) reviewed chloroxylenol (para-chloro-meta-xylenol, PCMX) among the standard antiseptic active ingredients, summarizing its antimicrobial spectrum and residual activity in handwash and surgical-scrub formulations. Its inclusion in the definitive U.S. hand-hygiene guideline settled chloroxylenol\'s status as an accepted, standard-of-care topical antiseptic active — the fact later recorded verbatim on OTC Drug Facts labels such as this one.',
    source: {
      externalId: 'src:cdc-hicpac-hand-hygiene-2002-chloroxylenol',
      name: 'Boyce JM, Pittet D; HICPAC/SHEA/APIC/IDSA Hand Hygiene Task Force. Guideline for Hand Hygiene in Health-Care Settings. MMWR Recomm Rep. 2002 Oct 25;51(RR-16):1-45.',
      url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/rr5116a1.htm',
      publishedAt: '2002-10-25',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED : FDA 2016 Consumer Antiseptic Wash final rule ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-09-06',
    datePrecision: 'DAY',
    reason:
      'FDA\'s final rule "Safety and Effectiveness of Consumer Antiseptic Wash Products Containing Certain Active Ingredients" (81 FR 61106, published 6 September 2016) found 19 active ingredients not generally recognized as safe and effective (GRASE) for consumer antiseptic washes. For chloroxylenol — together with benzalkonium chloride and benzethonium chloride — FDA deferred final rulemaking to allow manufacturers to develop and submit additional safety and efficacy data, formally contesting the ingredient\'s previously assumed GRASE status pending that evidence.',
    source: {
      externalId: 'src:fda-consumer-antiseptic-wash-final-rule-2016',
      name: 'FDA Final Rule: Safety and Effectiveness of Consumer Antiseptic Wash Products Containing Certain Active Ingredients. 81 FR 61106. Federal Register, September 6, 2016.',
      url: 'https://www.federalregister.gov/documents/2016/09/06/2016-21337/safety-and-effectiveness-of-consumer-antiseptic-wash-products-containing-certain-active-ingredients',
      publishedAt: '2016-09-06',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    console.error(`Claim ${CLAIM_ID} not found — aborting (this script does not create claims).`)
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions${DRY_RUN ? ' [DRY RUN]' : ''}...`,
  )

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${tr.fromAxis ?? 'null'} -> ${tr.toAxis} @ ${tr.occurredAt}  (${histId})`)
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
        ingestedBy: 'enrich:openfda_labels_v1',
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
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${tr.fromAxis ?? 'null'} -> ${tr.toAxis} @ ${tr.occurredAt}  (${histId})`)
  }

  console.log(`\nDone. ${TRANSITIONS.length} transitions enriched.`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
