// Enrich the epistemic arc for the Mucinex Sinus-Max / Nightshift FDA-label claim
// (openfda_labels_v1).
//
// Claim: cmpiyhxs98y06plo7zt4segdm — Mucinex Sinus-Max Day Pressure, Pain & Cough and
// Mucinex Nightshift Night Sinus (ACETAMINOPHEN, DEXTROMETHORPHAN HBr, GUAIFENESIN,
// PHENYLEPHRINE HCl, TRIPROLIDINE HCl), a fixed-dose OTC cough-cold combination whose
// labeled "nasal decongestant" purpose rests on oral PHENYLEPHRINE HYDROCHLORIDE.
//
// The defensible, well-sourced epistemic arc for this product tracks its oral
// phenylephrine component — the most consequential of its actives:
//
//   OPEN     -> RECORDED  1994  Phenylephrine HCl and the other actives codified as
//                               generally recognized as safe and effective (GRASE) in
//                               the FDA OTC cough-cold monograph (21 CFR part 341) —
//                               the regulatory recording of the accumulated efficacy
//                               evidence that lets the combination ship without a
//                               product-specific NDA.
//   RECORDED -> SETTLED   2006  The Combat Methamphetamine Epidemic Act of 2005
//                               (Pub. L. 109-177) moved pseudoephedrine behind the
//                               counter, making oral phenylephrine the dominant
//                               nonprescription decongestant and settling this class of
//                               combination as de facto standard of care.
//   SETTLED  -> CONTESTED 2007  Hatton et al. meta-analysis finds 10 mg oral
//                               phenylephrine no better than placebo — a post-market
//                               efficacy signal that culminated in the FDA NDAC's 16-0
//                               vote (12 Sep 2023) and a Nov 2025 FDA proposed order to
//                               remove oral phenylephrine from the monograph.
//
// The arc is ordered by epistemic axis (RECORDED->SETTLED->CONTESTED); occurredAt
// carries the true historical date of each marker. The terminal state is CONTESTED,
// not REVERSED: as of this writing the product remains legally marketed and the FDA
// removal is a proposed (not final) order.
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-sinus-max-phenylephrine-oral-decongestant-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-sinus-max-phenylephrine-oral-decongestant-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyhxs98y06plo7zt4segdm'

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
  // ── OPEN -> RECORDED: actives codified as GRASE in the OTC monograph (1994) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1994-01-01',
    datePrecision: 'YEAR',
    reason:
      'Oral phenylephrine hydrochloride — the nasal-decongestant component of this combination — together with the product\'s other actives (acetaminophen, dextromethorphan, guaifenesin) was codified as generally recognized as safe and effective (GRASE) in the FDA over-the-counter cough-cold-allergy monograph (21 CFR part 341). That monograph is the regulatory recording of the accumulated mid-20th-century efficacy evidence for each ingredient, and it is what permits fixed-dose products like Mucinex Sinus-Max to be marketed without a product-specific New Drug Application, underlying the labeled "Purposes" captured verbatim in the claim.',
    source: {
      externalId: 'src:phenylephrine-otc-monograph-21cfr341',
      name: 'FDA OTC monograph — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use, 21 CFR part 341 (phenylephrine HCl listed among GRASE nasal decongestant active ingredients).',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1994-01-01',
      methodologyType: 'derivative',
    },
  },

  // ── RECORDED -> SETTLED: CMEA 2005 makes phenylephrine the default OTC decongestant (2006) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'MARKET',
    occurredAt: '2006-03-09',
    datePrecision: 'DAY',
    reason:
      'The Combat Methamphetamine Epidemic Act of 2005 — enacted within Public Law 109-177, signed 9 March 2006 — moved pseudoephedrine behind the pharmacy counter with purchase limits, prompting manufacturers to reformulate mass-market oral decongestants (including Mucinex/Sinus-Max-type combinations) around phenylephrine hydrochloride. Phenylephrine consequently became the dominant nonprescription oral decongestant on U.S. shelves, settling this class of fixed-dose combination as the de facto standard of care for self-treated sinus and cold symptoms.',
    source: {
      externalId: 'src:cmea-2005-pl-109-177',
      name: 'Combat Methamphetamine Epidemic Act of 2005 (Title VII of the USA PATRIOT Improvement and Reauthorization Act, H.R.3199, 109th Congress; became Public Law 109-177, 9 March 2006).',
      url: 'https://www.congress.gov/bill/109th-congress/house-bill/3199',
      publishedAt: '2006-03-09',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED: meta-analysis + 2023 FDA advisory vote on efficacy (2007) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-03-01',
    datePrecision: 'MONTH',
    reason:
      'A systematic review and meta-analysis by Hatton and colleagues (Annals of Pharmacotherapy, March 2007) found that oral phenylephrine at the monograph dose of 10 mg was no more effective than placebo as a nasal decongestant, opening a sustained post-market efficacy challenge to a designated active ingredient in this product. The signal culminated on 12 September 2023, when the FDA Nonprescription Drugs Advisory Committee voted 16-0 that current data do not support the effectiveness of orally administered phenylephrine, and in a November 2025 FDA proposed order to remove oral phenylephrine from the OTC monograph — contesting, without yet reversing, the efficacy basis for the product\'s labeled nasal-decongestant claim.',
    source: {
      externalId: 'src:hatton-oral-phenylephrine-meta-analysis-2007',
      name: 'Hatton RC, Winterstein AG, McKelvey RP, Shuster J, Hendeles L. Efficacy and safety of oral phenylephrine: systematic review and meta-analysis. Ann Pharmacother. 2007;41(3):381-390.',
      url: 'https://doi.org/10.1345/aph.1H679',
      publishedAt: '2007-03-01',
      methodologyType: 'derivative',
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
