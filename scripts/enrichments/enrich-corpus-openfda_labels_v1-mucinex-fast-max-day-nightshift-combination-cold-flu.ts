// Enrich the epistemic arc for the Mucinex Fast-Max Day / Nightshift Night
// combination cold-and-flu FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiyebwu8txcplo7xgre9inc —
//   "Mucinex Fast-Max Day Severe Congestion and Cough and Mucinex Nightshift
//    Night Cold and Flu Maximum Strength (ACETAMINOPHEN, DEXTROMETHORPHAN
//    HYDROBROMIDE, GUAIFENESIN, PHENYLEPHRINE HYDROCHLORIDE, AND TRIPROLIDINE
//    HYDROCHLORIDE) ... Dextromethorphan HBr 10 mg Cough suppressant /
//    Guaifenesin 200 mg Expectorant / Phenylephrine HCl 5 mg Nasal decongestant"
//
// This is a fixed-dose OTC combination marketed under the FDA over-the-counter
// (OTC) drug monograph system, not a single New Drug Application. Its component
// actives were established as generally recognized as safe and effective (GRASE)
// through the FDA OTC Drug Review. The one component with a genuine, verifiable
// multi-step epistemic arc — including a post-market efficacy reversal — is the
// nasal decongestant PHENYLEPHRINE HCl, so the arc is anchored there.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED   1976       FDA OTC Review advisory panel classifies
//                                     oral phenylephrine HCl (and the antitussive
//                                     dextromethorphan / expectorant guaifenesin)
//                                     as Category I (GRASE) for their labeled
//                                     purposes on the then-available clinical
//                                     literature. First regulatory recording of
//                                     the "Nasal decongestant" purpose.
//   RECORDED -> SETTLED    1994       FDA final monograph for OTC nasal
//                                     decongestant drug products (21 CFR 341)
//                                     codifies oral phenylephrine HCl as GRASE;
//                                     fixed-dose cough-cold combinations become
//                                     ubiquitous, physician-unsupervised standard
//                                     of care for symptomatic self-treatment.
//   SETTLED  -> CONTESTED  2023-09-12 FDA Nonprescription Drug Advisory Committee
//                                     (NDAC) votes unanimously (16-0) that oral
//                                     phenylephrine is NOT effective as a nasal
//                                     decongestant at monograph doses; FDA issues
//                                     a proposed order (Nov 2024) to remove oral
//                                     phenylephrine from the OTC monograph.
//
// WHY CONTESTED, NOT REVERSED:
//   The 2023 vote and 2024 proposed order concern the *decongestant efficacy of
//   the phenylephrine component only*. The product remains legally marketed, and
//   its other actives (acetaminophen, dextromethorphan, guaifenesin, triprolidine)
//   are unaffected. The GRASE status of oral phenylephrine is under active FDA
//   reconsideration but not yet withdrawn, so CONTESTED (not REVERSED) is the
//   honest axis. Overstating this as a product-wide REVERSAL would violate the
//   project's anti-fabrication principle.
//
// SOURCING NOTE:
//   Live URL verification (WebFetch/WebSearch) was unavailable in the authoring
//   environment (tool permissions denied). To avoid asserting unverifiable
//   identifiers (specific Federal Register cites, FDA docket URLs, DOIs, or PMIDs)
//   in violation of the "training-data recall is not a verifiable source" rule,
//   the marker `url` fields point to canonical Wikipedia article URLs (high
//   confidence to resolve, and the convention already used by
//   enrich-corpus-openfda_labels_v1-fexofenadine-childrens-allergy-antihistamine.ts
//   and seed-human-history-trajectories.ts); the underlying FDA panel reports,
//   final monograph, NDAC meeting, and pharmacology reviews (Hatton RC, Winterstein
//   AG, Hendeles L, et al., Ann Pharmacother. 2007) are named in the `name` field.
//   These should be upgraded to the exact FDA.gov / Federal Register / DOI links
//   on a subsequent pass where live verification is available.
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-fast-max-day-nightshift-combination-cold-flu.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-fast-max-day-nightshift-combination-cold-flu.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyebwu8txcplo7xgre9inc'

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
  // ── OPEN -> RECORDED: FDA OTC Review panel Category I classification (1976) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1976-09-09',
    datePrecision: 'YEAR',
    reason:
      'Under the FDA Over-the-Counter Drug Review begun in 1972, the advisory review panel on cold, cough, allergy, bronchodilator and antiasthmatic products classified oral phenylephrine hydrochloride as Category I (generally recognized as safe and effective) as a nasal decongestant, alongside dextromethorphan (cough suppressant) and guaifenesin (expectorant). This panel evaluation of the then-available controlled clinical literature is the first regulatory recording of the "Nasal decongestant" and companion purposes captured verbatim in the later openFDA Mucinex combination label.',
    source: {
      externalId: 'src:otc-cold-cough-panel-phenylephrine-1976',
      name: 'FDA OTC Drug Review advisory review panel report on cold, cough, allergy, bronchodilator and antiasthmatic products (Federal Register, 1976): oral phenylephrine HCl, dextromethorphan and guaifenesin classified Category I (GRASE) for nasal decongestant / antitussive / expectorant use.',
      url: 'https://en.wikipedia.org/wiki/Phenylephrine',
      publishedAt: '1976-09-09',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: Final OTC nasal decongestant monograph (1994) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1994-08-23',
    datePrecision: 'YEAR',
    reason:
      'The FDA final monograph for OTC nasal decongestant drug products (codified at 21 CFR part 341) fixed oral phenylephrine hydrochloride as a GRASE active ingredient, and fixed-dose cough-cold combinations built on these monograph actives became ubiquitous, physician-unsupervised standard of care for symptomatic self-treatment of colds and flu. Clearing a decongestant for nonprescription combination use without physician oversight is the institutional judgment that its labeled efficacy and safety were settled, ratifying the "Nasal decongestant" purpose asserted in the Mucinex label.',
    source: {
      externalId: 'src:otc-nasal-decongestant-final-monograph-1994',
      name: 'FDA final monograph for over-the-counter nasal decongestant drug products (21 CFR part 341), 1994: oral phenylephrine HCl codified as generally recognized as safe and effective; basis for GRASE fixed-dose cough-cold combination products.',
      url: 'https://en.wikipedia.org/wiki/Over-the-counter_drug',
      publishedAt: '1994-08-23',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: FDA NDAC unanimous "not effective" vote (2023) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2023-09-12',
    datePrecision: 'DAY',
    reason:
      'On 11–12 September 2023 the FDA Nonprescription Drug Advisory Committee (NDAC) reviewed modern pharmacokinetic and efficacy data — including systematic reviews by Hatton, Winterstein, Hendeles and colleagues showing extensive first-pass metabolism and negligible oral bioavailability — and voted unanimously (16–0) that oral phenylephrine is not effective as a nasal decongestant at monograph doses. FDA subsequently issued a proposed order (November 2024) to remove oral phenylephrine as a GRASE nasal-decongestant active from the OTC monograph. This contests the "Phenylephrine HCl 5 mg Nasal decongestant" efficacy claim in the Mucinex label; the reversal is confined to the phenylephrine component, so the product and its other actives remain marketed (CONTESTED, not REVERSED).',
    source: {
      externalId: 'src:fda-ndac-oral-phenylephrine-2023',
      name: 'FDA Nonprescription Drug Advisory Committee (NDAC) meeting, 11–12 September 2023: unanimous 16–0 vote that oral phenylephrine is not effective as a nasal decongestant; underpinned by Hatton RC, Winterstein AG, McKelvey RP, Shuster J, Hendeles L, "Efficacy and safety of oral phenylephrine: systematic review and meta-analysis," Ann Pharmacother. 2007. FDA proposed order to remove oral phenylephrine from the OTC monograph, November 2024.',
      url: 'https://en.wikipedia.org/wiki/Phenylephrine',
      publishedAt: '2023-09-12',
      methodologyType: 'primary',
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
