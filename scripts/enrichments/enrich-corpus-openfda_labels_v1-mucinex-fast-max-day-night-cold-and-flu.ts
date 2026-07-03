// Enrichment: epistemic arc for the FDA "Maximum Strength Mucinex Fast-Max Day
// Cold and Flu and Night Cold and Flu" OTC label claim.
//
// Claim: cmpixtr8b8676plo7membgp5t (openfda_labels_v1)
//   Combination liquid-gel product. Day formula: Acetaminophen 325 mg (pain
//   reliever/fever reducer), Dextromethorphan HBr 10 mg (cough suppressant),
//   Guaifenesin 200 mg (expectorant), Phenylephrine HCl 5 mg (nasal
//   decongestant). The companion Night formula adds Doxylamine succinate
//   (antihistamine).
//
// These actives are all long-established OTC-monograph drugs, so there is no
// single Phase II/III registration trial for the finished combination. The
// honest arc therefore tracks the ingredient whose "Purpose" has an actual
// contested epistemic history: PHENYLEPHRINE, the oral nasal decongestant that
// the FDA has since concluded is not effective at monograph doses. This mirrors
// the arc built for the sibling claim cmpixtj6e85zuplo7v9ey5lus (Mucinex
// Fast-Max Cold and Flu) and reuses the same shared Source records.
//
// Arc (extends the existing fromAxis=null -> OPEN entry; do not duplicate it):
//   OPEN     -> RECORDED (1976)        FDA OTC Drug Review Advisory Panel on
//                         Cough/Cold/Allergy/Bronchodilator/Antiasthmatic
//                         products — first systematic published evaluation
//                         classifying these actives (incl. oral phenylephrine)
//                         for their labeled purposes. Ratified by
//                         EXPERT_LITERATURE.
//   RECORDED -> SETTLED  (1994-08)     Final OTC monograph codified at 21 CFR
//                         part 341 recognized oral phenylephrine HCl (and the
//                         companion analgesic/antitussive/expectorant actives)
//                         as generally recognized as safe and effective
//                         (GRASE) — the settled regulatory + standard-of-care
//                         basis for cold/flu combinations. Ratified by
//                         INSTITUTIONAL (FDA).
//   SETTLED  -> CONTESTED (2023-09-12) The FDA Nonprescription Drug Advisory
//                         Committee voted unanimously (16-0) that orally
//                         administered phenylephrine is NOT effective as a nasal
//                         decongestant at the monograph dose; FDA followed with
//                         a 2024-11-07 proposed order to remove oral
//                         phenylephrine from the OTC monograph. This post-market
//                         efficacy signal contests the "Nasal decongestant"
//                         purpose of the Phenylephrine HCl 5 mg (Day) component.
//                         Ratified by INSTITUTIONAL.
//
// SETTLED -> REVERSED is NOT used: the 2024 action is a *proposed* order (not a
// final removal), and the product's other actives remain GRASE, so the
// product-level claim is contested, not reversed. Per AGENTS.md hard-fact
// principles, no transition is fabricated beyond what the cited record supports.
// Live web verification (WebFetch/WebSearch) was unavailable in this session;
// URLs are anchored on stable canonical pages (eCFR part-level, Wikipedia, FDA
// press announcement), consistent with the sibling Mucinex enrichment.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-fast-max-day-night-cold-and-flu.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpixtr8b8676plo7membgp5t'

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
    occurredAt: '1976-09-09',
    datePrecision: 'YEAR',
    reason:
      'The FDA OTC Drug Review Advisory Review Panel on Cough, Cold, Allergy, Bronchodilator, and Antiasthmatic Products completed the first systematic published evaluation of this combination\'s active ingredients — acetaminophen, dextromethorphan, guaifenesin, and phenylephrine — and classified each for its labeled purpose, including oral phenylephrine as a Category I (safe and effective) nasal decongestant. This panel report is the first published clinical-evidence record supporting the finished product\'s stated Purposes.',
    source: {
      externalId: 'src:mucinex-fastmax-otc-panel-1976',
      name: 'FDA OTC Drug Review — Advisory Review Panel on Cough, Cold, Allergy, Bronchodilator, and Antiasthmatic Products; report and proposed monograph (Federal Register, 1976).',
      url: 'https://en.wikipedia.org/wiki/Phenylephrine',
      publishedAt: '1976-09-09',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1994-08-01',
    datePrecision: 'MONTH',
    reason:
      'The FDA final OTC monograph for cold, cough, allergy, bronchodilator, and antiasthmatic drug products, codified at 21 CFR part 341, recognized oral phenylephrine hydrochloride as generally recognized as safe and effective (GRASE) at monograph doses, alongside the companion analgesic/antipyretic, antitussive, and expectorant actives. Monograph status let manufacturers market these combinations without individual New Drug Applications and made them the standard nonprescription actives for cold/flu products, settling the regulatory and clinical consensus behind this label.',
    source: {
      externalId: 'src:mucinex-fastmax-cfr341-monograph',
      name: '21 CFR Part 341 — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use (final monograph; nasal decongestant class includes phenylephrine HCl).',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1994-08-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2023-09-12',
    datePrecision: 'DAY',
    reason:
      'On September 11-12, 2023 the FDA Nonprescription Drug Advisory Committee reviewed modern pharmacokinetic and clinical-efficacy data and voted unanimously (16-0) that orally administered phenylephrine is not effective as a nasal decongestant at the monograph dose. On November 7, 2024 the FDA issued a proposed order to remove oral phenylephrine as an OTC monograph nasal-decongestant active ingredient. This post-market efficacy signal directly contests the "Nasal decongestant" purpose of the Phenylephrine HCl 5 mg (Day formula) component, while the product\'s other actives remain GRASE — hence CONTESTED rather than REVERSED.',
    source: {
      externalId: 'src:mucinex-fastmax-fda-phenylephrine-2024',
      name: 'FDA, "FDA Proposes Ending Use of Oral Phenylephrine as an OTC Monograph Nasal Decongestant Active Ingredient After Extensive Review" (press announcement, Nov 7, 2024); FDA Nonprescription Drug Advisory Committee meeting, Sept 11-12, 2023.',
      url: 'https://www.fda.gov/news-events/press-announcements/fda-proposes-ending-use-oral-phenylephrine-otc-monograph-nasal-decongestant-active-ingredient-after',
      publishedAt: '2024-11-07',
      methodologyType: 'primary',
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
