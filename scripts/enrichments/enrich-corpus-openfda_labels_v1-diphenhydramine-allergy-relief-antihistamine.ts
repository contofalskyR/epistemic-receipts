// Enrichment: epistemic arc for the Allergy Relief mini Softgels
// (DIPHENHYDRAMINE HCl 25 MG) — "Purpose: Antihistamine" OTC drug-label claim
// (claim id cmpiykfli90ycplo7wbiqzjff).
//
// Diphenhydramine (Benadryl) is the prototype first-generation H1-antihistamine.
// The epistemic thread: its antihistaminic pharmacology was first established in the
// mid-1940s (RECORDED), it settled into a federal OTC self-care standard via the FDA
// OTC antihistamine monograph at 21 CFR Part 341 (SETTLED), and its use was then
// contested by a post-market safety signal — a 2020 FDA safety communication warning
// that high doses cause serious cardiac problems, alongside the American Geriatrics
// Society Beers Criteria flagging it as potentially inappropriate for older adults
// (CONTESTED).
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on deterministic id.
// The claim's first (fromAxis=null) status row already exists — this script does NOT
// duplicate it and does NOT create a new Claim.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-diphenhydramine-allergy-relief-antihistamine.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiykfli90ycplo7wbiqzjff'

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
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1947-01-01',
    datePrecision: 'YEAR',
    reason:
      'Diphenhydramine (Benadryl), synthesized by George Rieveschl in 1943, was the first antihistamine approved for prescription use in the United States (FDA, 1946). Its antihistaminic pharmacology was documented in the foundational peer-reviewed pharmacology literature of the period, establishing that the compound antagonized histamine and relieved allergic symptoms. This entered diphenhydramine into the expert record as a recognized antihistamine, the labeled purpose carried on this OTC product.',
    source: {
      externalId: 'src:loew-1947-pharmacology-antihistamine-compounds',
      name: 'Loew ER. Pharmacology of antihistamine compounds. Physiological Reviews. 1947;27(4):542-573.',
      url: 'https://doi.org/10.1152/physrev.1947.27.4.542',
      publishedAt: '1947-10-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1985-08-24',
    datePrecision: 'MONTH',
    reason:
      'Under the FDA OTC Drug Review, diphenhydramine hydrochloride was recognized as a Category I (generally recognized as safe and effective) antihistamine active ingredient and codified in the OTC monograph for cold, cough, allergy, bronchodilator, and antiasthmatic drug products at 21 CFR Part 341. This let manufacturers market OTC diphenhydramine products carrying the labeled "Antihistamine" purpose without an individual new drug application, settling the claim as a federal OTC self-care standard. The GRASE status was later deemed a final administrative order by the CARES Act OTC monograph reform (2020).',
    source: {
      externalId: 'src:fda-otc-monograph-341-antihistamine',
      name: 'FDA OTC Monograph — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for OTC Human Use (21 CFR Part 341, Subpart D — Antihistamine Active Ingredients)',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1985-08-24',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-09-24',
    datePrecision: 'DAY',
    reason:
      'The FDA issued a Drug Safety Communication warning that taking higher-than-recommended doses of diphenhydramine (Benadryl) can lead to serious heart problems, seizures, coma, or death, prompted by reports and social-media "Benadryl Challenge" cases. This post-market safety signal — alongside the American Geriatrics Society Beers Criteria long listing first-generation antihistamines like diphenhydramine as potentially inappropriate for older adults due to strong anticholinergic effects, confusion, and fall risk — contests the routine safety of the product beyond its narrowly labeled antihistamine purpose. The labeled indication remains valid; the contest is over appropriate use and dosing rather than antihistaminic efficacy.',
    source: {
      externalId: 'src:fda-2020-diphenhydramine-high-dose-safety-communication',
      name: 'FDA Drug Safety Communication — FDA warns about serious problems with high doses of the allergy medicine diphenhydramine (Benadryl)',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-warns-about-serious-problems-high-doses-allergy-medicine-diphenhydramine-benadryl',
      publishedAt: '2020-09-24',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        externalId: t.source.externalId,
        ingestedBy: 'enrich-openfda_labels_v1',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const id = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id },
      create: {
        id,
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

    console.log(`upserted ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${id})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
