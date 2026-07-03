// Enrichment: epistemic arc for the "basic care daytime nighttime cold and flu"
// FDA-label claim (openfda_labels_v1, claim cmpiy83ag8mroplo7i030kaak).
//
// This is a fixed-dose OTC cold/flu combination (ACETAMINOPHEN, DEXTROMETHORPHAN
// HBR, DOXYLAMINE SUCCINATE, PHENYLEPHRINE HCL). Its sharpest, most dateable
// epistemic arc runs through the oral PHENYLEPHRINE component — a monograph
// nasal decongestant whose efficacy was recorded institutionally, cemented by
// market default, then contested on modern evidence:
//   OPEN     -> RECORDED   FDA OTC cold/cough monograph recognizes the actives
//                          (incl. oral phenylephrine HCl) as GRASE / Category I
//   RECORDED -> SETTLED    Combat Methamphetamine Epidemic Act (2006) moves
//                          pseudoephedrine behind the counter; oral phenylephrine
//                          becomes the default OTC oral decongestant
//   SETTLED  -> CONTESTED  Hatton et al. meta-analysis (2007) → FDA advisory
//                          committee's 2023 no-efficacy vote → 2024 proposed
//                          removal of oral phenylephrine from the monograph
//
// Idempotent: upserts Sources on externalId and ClaimStatusHistory rows on a
// deterministic `${claimId}-${toAxis}-${occurredAt}` slug id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-basic-care-daytime-nighttime-cold-flu-phenylephrine.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-basic-care-daytime-nighttime-cold-flu-phenylephrine.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy83ag8mroplo7i030kaak'

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
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED: FDA OTC cold/cough monograph recognizes the actives ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1976-09-09',
    datePrecision: 'DAY',
    reason:
      'On September 9, 1976 the FDA advisory review panel for OTC cold, cough, allergy, bronchodilator and antiasthmatic products published its report classifying the ingredients of this product — including oral phenylephrine hydrochloride as a nasal decongestant, acetaminophen, dextromethorphan and doxylamine — as Category I, generally recognized as safe and effective at the specified doses. Those findings were codified in the OTC drug monograph now at 21 CFR Part 341, the regulatory basis on which such combination cold/flu products are marketed without individual new-drug approval. This moved the combination\'s labeled purposes from open assertion to a recorded, monograph-recognized standard.',
    source: {
      externalId: 'src:ecfr-21cfr341-otc-cold-cough-monograph',
      name: '21 CFR Part 341 — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use (OTC monograph; oral phenylephrine HCl listed as a nasal decongestant active ingredient).',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1976-09-09',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: phenylephrine becomes the default oral OTC decongestant ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'MARKET',
    occurredAt: '2006-09-30',
    datePrecision: 'DAY',
    reason:
      'The Combat Methamphetamine Epidemic Act of 2005 (enacted March 9, 2006 as Title VII of the USA PATRIOT Improvement and Reauthorization Act) moved pseudoephedrine products behind the pharmacy counter and imposed purchase logs and quantity limits, with the retail provisions taking full effect September 30, 2006. Manufacturers reformulated mass-market cold/flu combinations toward oral phenylephrine, which stayed on the open shelf, making phenylephrine HCl the default OTC oral decongestant in products exactly like this one. Its place in standard self-care cold/flu combinations became settled by market default.',
    source: {
      externalId: 'src:combat-methamphetamine-epidemic-act-2006',
      name: 'Combat Methamphetamine Epidemic Act of 2005 (Title VII of the USA PATRIOT Improvement and Reauthorization Act of 2005, Pub. L. 109-177); pseudoephedrine retail restrictions effective September 30, 2006.',
      url: 'https://en.wikipedia.org/wiki/Combat_Methamphetamine_Epidemic_Act',
      publishedAt: '2006-09-30',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: modern evidence disputes oral phenylephrine efficacy ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-03-01',
    datePrecision: 'MONTH',
    reason:
      'Hatton and colleagues published a systematic review and meta-analysis in the Annals of Pharmacotherapy (March 2007) finding that oral phenylephrine at the monograph 10 mg dose was no more effective than placebo as a nasal decongestant, attributing this to very low (~1%) oral bioavailability. The challenge escalated institutionally: in September 2023 the FDA Nonprescription Drugs Advisory Committee voted unanimously (16-0) that oral phenylephrine is not effective at monograph doses, and in November 2024 the FDA issued a proposed order to remove oral phenylephrine as an OTC monograph nasal decongestant active ingredient. The efficacy of a settled active ingredient in this combination is now openly contested.',
    source: {
      externalId: 'src:hatton-oral-phenylephrine-meta-analysis-2007',
      name: 'Hatton RC, Winterstein AG, McKelvey RP, Shuster J, Hendeles L. Efficacy and safety of oral phenylephrine: systematic review and meta-analysis. Ann Pharmacother. 2007;41(3):381–390.',
      url: 'https://doi.org/10.1345/aph.1H679',
      publishedAt: '2007-03-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(
        `[dry-run] ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${t.datePrecision})  src=${t.source.externalId}  id=${slug}`,
      )
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda_labels_v1',
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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

    console.log(`upserted ${slug}  (${t.fromAxis ?? 'null'} -> ${t.toAxis})`)
  }

  console.log(DRY_RUN ? 'dry-run complete' : 'enrichment complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
