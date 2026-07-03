// Enrich the epistemic arc for the Mucinex Sinus-Max / Nightshift Sinus FDA-label
// claim (openfda_labels_v1).
//
// Claim: cmpiya3e58ovoplo7nkkuqyth — a multi-ingredient OTC monograph combination
// product (acetaminophen, dextromethorphan HBr, guaifenesin, phenylephrine HCl,
// triprolidine HCl). The label asserts "Phenylephrine HCl 10 mg — Nasal decongestant."
//
// The editorially meaningful, verifiable epistemic arc attaches to the ORAL
// PHENYLEPHRINE nasal-decongestant proposition embedded in this label. That claim
// was institutionally recorded (FDA OTC monograph, Category I / GRASE), became the
// de-facto standard OTC oral decongestant after pseudoephedrine moved behind the
// counter, and was then contested when an FDA advisory committee found oral
// phenylephrine ineffective at monograph doses.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1994  FDA OTC monograph recognizes oral phenylephrine HCl
//                               10 mg as GRASE (Category I) nasal decongestant
//                               (21 CFR Part 341) — INSTITUTIONAL recording.
//   RECORDED -> SETTLED   2006  Combat Methamphetamine Epidemic Act moves
//                               pseudoephedrine behind the counter; oral phenylephrine
//                               becomes the dominant OTC oral decongestant — MARKET
//                               standard-of-use ratification.
//   SETTLED  -> CONTESTED 2023  FDA Nonprescription Drugs Advisory Committee votes
//                               16-0 that oral phenylephrine is NOT effective at
//                               monograph doses; FDA later (Nov 2024) proposes ending
//                               its use as an OTC decongestant ingredient.
//
// The arc terminates at CONTESTED, not REVERSED: as of authoring, the FDA action is a
// PROPOSED order, not a final removal, so the monograph recognition is disputed but
// not yet overturned. Does NOT create a new Claim; only adds ClaimStatusHistory rows +
// marker Sources. Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-sinus-max-phenylephrine-decongestant.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-sinus-max-phenylephrine-decongestant.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiya3e58ovoplo7nkkuqyth'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
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
  // ── OPEN -> RECORDED: FDA OTC monograph recognizes oral phenylephrine (1994) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1994-01-01',
    datePrecision: 'YEAR',
    reason:
      'The nasal-decongestant proposition on this label — "Phenylephrine HCl 10 mg, Nasal decongestant" — traces to FDA\'s over-the-counter drug review, which classified oral phenylephrine hydrochloride at 10 mg as a Category I (generally recognized as safe and effective) nasal decongestant and codified it in the OTC monograph for cold, cough, and allergy products at 21 CFR Part 341. This institutional recognition recorded oral phenylephrine as an accepted OTC decongestant active ingredient, the regulatory basis on which combination products like Mucinex Sinus-Max are marketed.',
    source: {
      externalId: 'src:phenylephrine-otc-monograph-21cfr341',
      name: '21 CFR Part 341 — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use (OTC monograph listing phenylephrine HCl as a nasal decongestant active ingredient).',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1994-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: PE becomes dominant OTC oral decongestant (2006) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'MARKET',
    occurredAt: '2006-03-09',
    datePrecision: 'DAY',
    reason:
      'The Combat Methamphetamine Epidemic Act of 2005 (Title VII of the USA PATRIOT Improvement and Reauthorization Act, Public Law 109-177, signed March 9, 2006) moved pseudoephedrine behind the pharmacy counter with purchase limits and logging. Manufacturers reformulated mass-market OTC cold and sinus products around oral phenylephrine, which became the default shelf-available oral nasal decongestant across the United States. That market-wide substitution settled oral phenylephrine as the standard OTC oral decongestant of record — the status under which this Mucinex formulation reaches consumers.',
    source: {
      externalId: 'src:cmea-2006-hr3199-pl109-177',
      name: 'USA PATRIOT Improvement and Reauthorization Act of 2005, H.R. 3199, Public Law 109-177 (Title VII: Combat Methamphetamine Epidemic Act of 2005).',
      url: 'https://www.congress.gov/bill/109th-congress/house-bill/3199',
      publishedAt: '2006-03-09',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED: FDA advisory committee finds oral PE ineffective (2023) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2023-09-12',
    datePrecision: 'DAY',
    reason:
      'On September 11–12, 2023, FDA\'s Nonprescription Drugs Advisory Committee reviewed the accumulated efficacy evidence — including modern pharmacokinetic data and placebo-controlled trials showing extensive first-pass metabolism and no benefit over placebo — and voted unanimously (16-0) that oral phenylephrine is not effective as a nasal decongestant at the monograph dose. FDA subsequently issued a proposed order (November 2024) to end use of oral phenylephrine as an OTC monograph decongestant ingredient. The label\'s "Phenylephrine HCl 10 mg — Nasal decongestant" claim is therefore now contested by the ratifying regulator, though not yet formally overturned pending finalization of the order.',
    source: {
      externalId: 'src:fda-ndac-oral-phenylephrine-2023',
      name: 'U.S. Food & Drug Administration — FDA Clarifies Results of Recent Advisory Committee Meeting on Oral Phenylephrine (Nonprescription Drugs Advisory Committee, Sept 11–12, 2023).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-clarifies-results-recent-advisory-committee-meeting-oral-phenylephrine',
      publishedAt: '2023-09-14',
      methodologyType: 'opinion',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const t of TRANSITIONS) {
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${historyId})`)
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda-labels',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
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

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Done — ${TRANSITIONS.length} transitions processed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
