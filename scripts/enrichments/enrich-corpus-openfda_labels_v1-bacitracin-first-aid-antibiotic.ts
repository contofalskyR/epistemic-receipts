// Enrichment: epistemic trajectory for an openFDA-label-ingested claim asserting
// that BACITRACIN is a "first aid antibiotic" (OTC drug-facts "Purpose" statement).
//
// The claim is a monograph label statement, but it stands on a real scientific and
// regulatory arc that is dateable and primary-sourced:
//
//   OPEN -> RECORDED (1945): Bacitracin is first isolated and characterized.
//     Johnson, Anker & Meleney report in Science that a member of the B. subtilis
//     group produces a new antibiotic active against Gram-positive organisms,
//     naming it "bacitracin" (after the patient Margaret Tracy). This is the primary
//     record establishing the substance and its antibacterial activity.
//
//   RECORDED -> SETTLED (1991): The FDA OTC drug review classifies bacitracin as a
//     Category I (generally recognized as safe and effective) first aid antibiotic
//     active ingredient in the topical antimicrobial monograph (21 CFR part 333,
//     subpart B — First Aid Antibiotic Drug Products), institutionalizing the exact
//     "first aid antibiotic" labeling the claim reproduces.
//
//   SETTLED -> CONTESTED (1996): A randomized controlled trial in JAMA (Smack et al.)
//     finds that topical bacitracin ointment offers no infection-prevention advantage
//     over plain white petrolatum in clean wounds and is associated with allergic
//     contact dermatitis (including a case of anaphylaxis), contesting the clinical
//     value proposition of routine topical "first aid antibiotic" use.
//
// Only high-confidence, canonical DOI / .gov-anchored arcs are encoded.
// NOTE: URLs below were NOT live-fetched (web tools unavailable this session); they
// are canonical publisher DOIs and the stable eCFR codification of 21 CFR 333.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-bacitracin-first-aid-antibiotic.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-bacitracin-first-aid-antibiotic.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyd3sh8shiplo7i8lvsuig'

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
    occurredAt: '1945-10-05',
    datePrecision: 'DAY',
    reason:
      'Bacitracin entered the scientific record when Balbina A. Johnson, Herbert Anker, and Frank L. Meleney reported in Science that a member of the Bacillus subtilis group, cultured from a compound fracture wound, produced a previously undescribed antibiotic active against Gram-positive organisms. They named the substance "bacitracin," combining "Bacillus" with the surname of the seven-year-old patient, Margaret Tracy. This primary report established both the existence of the antibiotic and its antibacterial activity, the empirical basis for its later use as a first aid antibiotic.',
    source: {
      externalId: 'src:johnson-anker-meleney-bacitracin-science-1945',
      name:
        'Johnson BA, Anker H, Meleney FL. Bacitracin: A New Antibiotic Produced by a Member of the B. Subtilis Group. Science. 1945;102(2650):376-377.',
      url: 'https://doi.org/10.1126/science.102.2650.376',
      publishedAt: '1945-10-05',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1991-07-22',
    datePrecision: 'DAY',
    reason:
      'The FDA over-the-counter drug review settled bacitracin\'s status as a first aid antibiotic by classifying it as a Category I (generally recognized as safe and effective) active ingredient in the topical antimicrobial drug monograph. Under 21 CFR part 333, subpart B (First Aid Antibiotic Drug Products), bacitracin is an approved active ingredient with the labeled "Purpose: first aid antibiotic" indication — the exact monograph statement the ingested label claim reproduces. This institutional codification made the claim a standard, permitted OTC labeling rather than a manufacturer assertion.',
    source: {
      externalId: 'src:fda-otc-first-aid-antibiotic-monograph-21cfr333',
      name:
        'U.S. Food and Drug Administration. 21 CFR Part 333, Subpart B — First Aid Antibiotic Drug Products for Over-the-Counter Human Use (Topical Antimicrobial Drug Products; tentative final monograph, 56 FR 33644, codified at 21 CFR 333.120).',
      url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-D/part-333',
      publishedAt: '1991-07-22',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1996-09-25',
    datePrecision: 'DAY',
    reason:
      'A randomized controlled trial in JAMA contested the clinical value of routine topical "first aid antibiotic" use. Smack and colleagues randomized 922 ambulatory surgery patients to white petrolatum versus bacitracin ointment for postoperative wound care and found equivalent infection rates, with no infection-prevention advantage for bacitracin, while the bacitracin group experienced allergic contact dermatitis — including a case of anaphylaxis. The trial reframed bacitracin as an unnecessary sensitizing agent for clean wounds, moving the settled labeling claim into active contestation over whether topical antibiotic prophylaxis is warranted at all.',
    source: {
      externalId: 'src:smack-petrolatum-bacitracin-rct-jama-1996',
      name:
        'Smack DP, Harrington AC, Dunn C, Howard RS, Szkutnik AJ, Krivda SJ, Caldwell JB, James WD. Infection and Allergy Incidence in Ambulatory Surgery Patients Using White Petrolatum vs Bacitracin Ointment: A Randomized Controlled Trial. JAMA. 1996;276(12):972-977.',
      url: 'https://doi.org/10.1001/jama.1996.03540120050033',
      publishedAt: '1996-09-25',
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
