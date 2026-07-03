// Enrichment: epistemic arc for the FDA OTC "triple antibiotic" first-aid
// ointment label claim.
//
// Claim: cmpixwkni89wcplo7mrqijv0i (openfda_labels_v1)
//   Combination product: BACITRACIN ZINC + NEOMYCIN SULFATE + POLYMYXIN B
//   SULFATE, labeled Purpose "First aid antibiotic."
//
// All three actives are long-established topical antibiotics with no single
// modern Phase II/III registration trial for the finished combination. The
// honest arc therefore tracks the clinical-then-regulatory-then-contested
// history of the topical "first aid antibiotic" itself.
//
// Arc (extends the existing fromAxis=null -> OPEN entry; do not duplicate it):
//   OPEN     -> RECORDED (1945)   The topical-antibiotic wound-prophylaxis
//                        literature that grounds the finished product begins
//                        with Johnson, Anker & Meleney's 1945 Science report of
//                        bacitracin and Meleney's clinical use of it on wounds;
//                        neomycin (1949) and polymyxin B (1947) were added to
//                        form the standard "triple antibiotic" ointment.
//                        Ratified by EXPERT_LITERATURE.
//   RECORDED -> SETTLED  (1987)   The FDA OTC Drug Review codified first aid
//                        antibiotic drug products at 21 CFR part 333, subpart B,
//                        recognizing bacitracin/neomycin/polymyxin B combinations
//                        as generally recognized as safe and effective (GRASE)
//                        for OTC first-aid use — the settled regulatory and
//                        standard-of-care basis for this label. Ratified by
//                        INSTITUTIONAL (FDA).
//   SETTLED  -> CONTESTED (2010)  Accumulating contact-dermatitis evidence —
//                        capped by the American Contact Dermatitis Society naming
//                        NEOMYCIN its 2010 "Allergen of the Year," and earlier
//                        randomized data showing plain white petrolatum matches
//                        topical antibiotic ointment for post-procedure wound
//                        care with less allergic risk — contests the risk/benefit
//                        of routine first-aid antibiotic use. Ratified by
//                        EXPERT_LITERATURE.
//
// SETTLED -> REVERSED is NOT used: the products remain on the OTC market and in
// the monograph; the expert-community signal contests, but has not overturned,
// their first-aid use. Per AGENTS.md hard-fact principles no transition is
// fabricated beyond what the cited record supports. URLs are anchored on stable
// canonical pages (eCFR part-level, long-standing Wikipedia articles) because
// live web verification was unavailable in this session; the sibling Mucinex
// enrichment uses the same anchoring convention.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-triple-antibiotic-first-aid.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpixwkni89wcplo7mrqijv0i'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
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
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1945-01-01',
    datePrecision: 'YEAR',
    reason:
      'The clinical foundation for the triple-antibiotic first-aid ointment was laid by the topical wound-prophylaxis literature that began with Johnson, Anker, and Meleney\'s 1945 report in Science ("Bacitracin: a new antibiotic produced by a member of the B. subtilis group"), which introduced bacitracin and documented Meleney\'s use of it on surgical and traumatic wounds. Neomycin (Waksman and Lechevalier, 1949) and polymyxin B (1947) followed and were combined with bacitracin into the standard "triple antibiotic" first-aid ointment. This body of published work is the first clinical-evidence record supporting the product\'s labeled "First aid antibiotic" purpose.',
    source: {
      externalId: 'src:triple-antibiotic-bacitracin-discovery-1945',
      name: 'Johnson BA, Anker H, Meleney FL. "Bacitracin: A New Antibiotic Produced by a Member of the B. subtilis Group." Science 1945;102(2650):376-377. (See also Bacitracin overview.)',
      url: 'https://en.wikipedia.org/wiki/Bacitracin',
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
      'Through the FDA OTC Drug Review, first aid antibiotic drug products were codified at 21 CFR part 333, subpart B, recognizing single- and combination-ingredient topical antibiotics — including bacitracin, neomycin sulfate, and polymyxin B sulfate — as generally recognized as safe and effective (GRASE) for over-the-counter first-aid use. Monograph status let manufacturers market these combinations without individual New Drug Applications and made the "triple antibiotic" ointment a settled nonprescription standard for minor wound care. This regulatory recognition is the institutional settling of the label\'s "First aid antibiotic" purpose.',
    source: {
      externalId: 'src:triple-antibiotic-cfr333-first-aid-monograph',
      name: '21 CFR Part 333 — Topical Antimicrobial Drug Products for Over-the-Counter Human Use (Subpart B, First Aid Antibiotic Drug Products; actives include bacitracin, neomycin sulfate, polymyxin B sulfate).',
      url: 'https://www.ecfr.gov/current/title-21/part-333',
      publishedAt: '1987-01-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2010-01-01',
    datePrecision: 'YEAR',
    reason:
      'The risk/benefit of routine first-aid antibiotic ointment came under sustained challenge as neomycin emerged as one of the most common causes of allergic contact dermatitis, culminating in the American Contact Dermatitis Society designating NEOMYCIN its 2010 "Allergen of the Year." This designation followed randomized evidence that plain white petrolatum matches topical antibiotic ointment for post-procedure wound outcomes while avoiding the sensitization risk. The expert-community signal contests, without overturning, the value of the labeled "First aid antibiotic" combination — hence CONTESTED rather than REVERSED, since the products remain marketed under the OTC monograph.',
    source: {
      externalId: 'src:triple-antibiotic-neomycin-allergen-of-year-2010',
      name: 'American Contact Dermatitis Society "Allergen of the Year" 2010: Neomycin — a leading topical contact allergen (component of triple antibiotic ointment).',
      url: 'https://en.wikipedia.org/wiki/Neomycin',
      publishedAt: '2010-01-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const occurredAt = new Date(t.occurredAt)
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
    })

    console.log(`upserted ${slug} (${t.fromAxis} -> ${t.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
