// Enrich the epistemic arc for the "Ibuprofen PM" FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiyajw18peuplo7wj3fa1ay — Ibuprofen PM (IBUPROFEN, DIPHENHYDRAMINE HCL):
// a fixed combination nighttime pain-reliever + sleep-aid.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1984  ibuprofen switched to OTC; diphenhydramine already the
//                               recognized OTC nighttime sleep-aid (component clinical basis)
//   RECORDED -> SETTLED   2009  FDA-approved fixed ibuprofen/diphenhydramine HCl combination
//                               (Advil PM Liqui-Gels), broad OTC market adoption
//   SETTLED  -> CONTESTED 2020  FDA safety communication on serious harms from high-dose
//                               diphenhydramine (post-market safety signal)
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// NOTE: This is an OTC combination product. No single fixed-combination Phase II/III
// pivotal trial with a stable public DOI was verifiable at authoring time, so the RECORDED
// step is anchored on the FDA OTC drug-monograph recognition of each active's clinical
// efficacy (the regulatory record of the reviewed clinical evidence) rather than a fabricated
// trial citation. All URLs are canonical FDA.gov / eCFR / DOI endpoints.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-ibuprofen-pm-diphenhydramine.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-ibuprofen-pm-diphenhydramine.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyajw18peuplo7wj3fa1ay'

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
  // ── OPEN -> RECORDED: component clinical basis recognized in OTC monographs (1984) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1984-01-01',
    datePrecision: 'YEAR',
    reason:
      'Ibuprofen was switched to nonprescription (OTC) status in 1984 — the first Rx-to-OTC NSAID switch — while diphenhydramine was already FDA-recognized as the OTC nighttime sleep-aid active ingredient. The clinical evidence for each active (analgesia and sedation) was reviewed under the FDA OTC Drug Review and codified as generally recognized as safe and effective in the internal-analgesic monograph, recording the evidentiary basis for a combined nighttime pain-reliever/sleep-aid.',
    source: {
      externalId: 'src:ibuprofen-otc-analgesic-monograph-21cfr343',
      name: 'FDA OTC monograph — 21 CFR Part 343, Internal Analgesic, Antipyretic, and Antirheumatic Drug Products for Over-the-Counter Human Use (ibuprofen).',
      url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-D/part-343',
      publishedAt: '1984-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: FDA-approved fixed combination, broad OTC adoption (2009) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2009-01-01',
    datePrecision: 'YEAR',
    reason:
      'FDA approved fixed-dose ibuprofen/diphenhydramine hydrochloride nighttime pain-reliever/sleep-aid products (marketed as Advil PM and store-brand equivalents), which achieved broad OTC market adoption for the "pain that keeps you awake" indication captured in the current openFDA label. The nighttime sleep-aid monograph (21 CFR Part 338) governs diphenhydramine as the sole permitted OTC sleep-aid active, settling the combination as a standard consumer analgesic sleep-aid.',
    source: {
      externalId: 'src:nighttime-sleep-aid-monograph-21cfr338',
      name: 'FDA OTC monograph — 21 CFR Part 338, Nighttime Sleep-Aid Drug Products for Over-the-Counter Human Use (diphenhydramine).',
      url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-D/part-338',
      publishedAt: '2009-01-01',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED: FDA safety communication on high-dose diphenhydramine (2020) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-09-24',
    datePrecision: 'DAY',
    reason:
      'On 24 September 2020 the FDA issued a safety communication warning that taking higher-than-recommended doses of the diphenhydramine component can cause serious heart problems, seizures, coma, and death, prompted by reports (including the viral "Benadryl Challenge") of intentional overdose. This post-market safety signal — reinforcing older pharmacoepidemiologic concern that cumulative anticholinergic exposure is associated with incident dementia (Gray et al., JAMA Intern Med 2015) — contested unrestricted use of diphenhydramine-containing sleep-aid combinations without reversing the approved indication.',
    source: {
      externalId: 'src:fda-diphenhydramine-high-dose-warning-2020',
      name: 'FDA Drug Safety Communication — FDA warns about serious problems with high doses of the allergy medicine diphenhydramine (Benadryl) (24 Sept 2020).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-warns-about-serious-problems-high-doses-allergy-medicine-diphenhydramine-benadryl',
      publishedAt: '2020-09-24',
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
