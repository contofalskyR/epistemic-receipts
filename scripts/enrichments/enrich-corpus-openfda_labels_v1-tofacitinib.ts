// Enrichment: epistemic arc for the FDA tofacitinib (extended-release) label claim.
//
// Claim: cmpixti6885ycplo7qaz3hcvp (openfda_labels_v1)
//   "tofacitinib (TOFACITINIB): 1 INDICATIONS AND USAGE ... Janus kinase (JAK)
//    inhibitors ... rheumatoid arthritis (RA) ... psoriatic arthritis (PsA) ...
//    ankylosing spondylitis (AS) ..."
//
// Tofacitinib (Xeljanz) is a modern small-molecule with a clean controlled-trial
// arc, so the trajectory follows the intended template exactly:
//
//   OPEN     -> RECORDED (2012-08-09)  First-published pivotal Phase III evidence:
//                         Fleischmann et al., "Placebo-Controlled Trial of
//                         Tofacitinib Monotherapy in Rheumatoid Arthritis"
//                         (the ORAL Solo trial), N Engl J Med 2012;367:495-507,
//                         one of two pivotal Phase III RA trials published
//                         simultaneously in NEJM, three months before FDA
//                         approval (Nov 6, 2012). Ratified by EXPERT_LITERATURE.
//   RECORDED -> SETTLED  (2015-11-06)  Guideline standard-of-care inclusion: the
//                         2015 American College of Rheumatology Guideline for the
//                         Treatment of Rheumatoid Arthritis (Singh et al.,
//                         Arthritis & Rheumatology 2016;68:1-26) recommended
//                         tofacitinib as a treatment option, placing the JAK
//                         inhibitor in the RA standard-of-care algorithm.
//                         Ratified by INSTITUTIONAL (ACR).
//   SETTLED  -> CONTESTED (2021-09-01) Post-market safety signal: on Sept 1, 2021
//                         the FDA required boxed warnings for tofacitinib and the
//                         JAK-inhibitor class for serious heart-related events,
//                         cancer, blood clots, and death, based on the mandated
//                         ORAL Surveillance safety trial. The drug was not
//                         withdrawn and the RA/PsA/AS indications remain, but they
//                         were materially narrowed (reserved for inadequate
//                         response/intolerance to TNF blockers — exactly the
//                         restricted indication language in this label), so the
//                         settled fact moved to CONTESTED rather than REVERSED.
//                         Ratified by INSTITUTIONAL (FDA).
//
// SETTLED -> REVERSED is NOT included: tofacitinib remains FDA-approved for RA,
// PsA, and AS; the 2021 action restricted rather than revoked the indication.
// Per AGENTS.md hard-fact principles, no transition is fabricated beyond what the
// cited record supports. Live web verification (WebFetch/WebSearch) was not
// available in this session; URLs are anchored on stable, canonical DOI and
// FDA.gov records, consistent with the anchoring used in the aspirin enrichment.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-tofacitinib.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpixti6885ycplo7qaz3hcvp'

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
    occurredAt: '2012-08-09',
    datePrecision: 'DAY',
    reason:
      'On 9 August 2012 the New England Journal of Medicine published Fleischmann et al., "Placebo-Controlled Trial of Tofacitinib Monotherapy in Rheumatoid Arthritis" (the ORAL Solo trial), one of two pivotal Phase III trials of the JAK inhibitor in RA released simultaneously. The randomized, placebo-controlled data established efficacy on ACR20 response and physical function in patients with inadequate response to prior DMARDs. This was the first-published pivotal clinical evidence for the indication, three months before FDA approval on 6 November 2012.',
    source: {
      externalId: 'src:tofacitinib-oral-solo-nejm-2012',
      name: 'Fleischmann R, Kremer J, Cush J, et al. "Placebo-Controlled Trial of Tofacitinib Monotherapy in Rheumatoid Arthritis" (ORAL Solo). N Engl J Med 2012;367:495-507.',
      url: 'https://doi.org/10.1056/NEJMoa1109071',
      publishedAt: '2012-08-09',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2015-11-06',
    datePrecision: 'DAY',
    reason:
      'The 2015 American College of Rheumatology Guideline for the Treatment of Rheumatoid Arthritis (Singh et al., Arthritis & Rheumatology 2016;68:1-26) formally incorporated tofacitinib into the RA treatment algorithm, recommending it as an option for patients with established disease and inadequate response to conventional or biologic DMARDs. Inclusion in the ACR guideline placed the JAK inhibitor within the rheumatology standard of care, marking broad professional adoption of the indication asserted in the label.',
    source: {
      externalId: 'src:tofacitinib-acr-ra-guideline-2015',
      name: 'Singh JA, Saag KG, Bridges SL, et al. "2015 American College of Rheumatology Guideline for the Treatment of Rheumatoid Arthritis." Arthritis & Rheumatology 2016;68(1):1-26.',
      url: 'https://doi.org/10.1002/art.39480',
      publishedAt: '2015-11-06',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2021-09-01',
    datePrecision: 'DAY',
    reason:
      'On 1 September 2021 the FDA required new and updated boxed warnings for tofacitinib (Xeljanz/Xeljanz XR) and the JAK-inhibitor class for serious heart-related events, cancer, blood clots, and death, based on the mandated ORAL Surveillance postmarketing safety trial that compared tofacitinib with TNF blockers. The agency limited approved use to patients with inadequate response or intolerance to one or more TNF blockers — the exact restricted indication language carried in this extended-release label. The drug was not withdrawn, but the previously settled therapeutic consensus was materially narrowed by the safety signal, moving the fact to a contested state.',
    source: {
      externalId: 'src:tofacitinib-fda-boxed-warning-2021',
      name: 'FDA Drug Safety Communication, 1 September 2021: "FDA requires warnings about increased risk of serious heart-related events, cancer, blood clots, and death for JAK inhibitors that treat certain chronic inflammatory conditions."',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-requires-warnings-about-increased-risk-serious-heart-related-events-cancer-blood-clots-and-death',
      publishedAt: '2021-09-01',
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
