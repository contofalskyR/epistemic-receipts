// Enrichment: epistemic arc for the Ozempic (semaglutide) FDA-label claim.
//
// Claim: cmpiyfa2x8v1iplo7hpc486pp  (ingestedBy: openfda_labels_v1)
//   "Ozempic (SEMAGLUTIDE): 1 INDICATIONS AND USAGE ..."
//
// Adds three ClaimStatusHistory transitions tracing the drug's evidentiary arc:
//   1. OPEN -> RECORDED    First landmark phase-3 clinical evidence (SUSTAIN-6, NEJM 2016)
//   2. RECORDED -> SETTLED  Standard-of-care status via the 2018 ADA/EASD consensus report
//   3. SETTLED -> CONTESTED Post-market safety signal (NAION, JAMA Ophthalmology 2024)
//
// The claim itself already exists (do NOT create it) and already carries its
// initial null -> OPEN emergence entry. This script only adds the arc above.
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on a
// deterministic id = `${claimId}-${toAxis}-${occurredAt.slice(0,10)}`.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-ozempic-semaglutide.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyfa2x8v1iplo7hpc486pp'

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
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // 1. OPEN -> RECORDED — first landmark phase-3 clinical evidence.
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2016-11-10',
    datePrecision: 'DAY',
    reason:
      'The SUSTAIN-6 phase-3 cardiovascular-outcomes trial (Marso et al., N Engl J Med 2016;375:1834–1844) reported that once-weekly semaglutide significantly lowered the rate of major adverse cardiovascular events versus placebo in patients with type 2 diabetes at high cardiovascular risk. This was the first large randomized trial to establish semaglutide\'s efficacy on hard clinical endpoints, entering the drug\'s cardiovascular and glycemic benefit into the peer-reviewed record. It underpins both the glycemic-control and cardiovascular-risk-reduction indications later carried on the Ozempic label.',
    source: {
      externalId: 'src:semaglutide-sustain6-nejm-2016',
      name: 'Marso SP, Bain SC, Consoli A, et al. Semaglutide and Cardiovascular Outcomes in Patients with Type 2 Diabetes (SUSTAIN-6). N Engl J Med. 2016;375(19):1834–1844.',
      url: 'https://doi.org/10.1056/NEJMoa1607141',
      publishedAt: '2016-11-10',
      methodologyType: 'primary',
    },
  },

  // 2. RECORDED -> SETTLED — standard-of-care status via major guideline inclusion.
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2018-10-01',
    datePrecision: 'MONTH',
    reason:
      'The 2018 ADA/EASD consensus report on the management of hyperglycemia in type 2 diabetes (Davies et al., Diabetes Care 2018;41(12):2669–2701) recommended GLP-1 receptor agonists with proven cardiovascular benefit — semaglutide among them — for patients with established atherosclerotic cardiovascular disease. Endorsement by the two principal international diabetes bodies moved semaglutide from a trial-supported agent to a guideline-embedded standard of care. This institutional ratification settled its place in first-line management for high-cardiovascular-risk type 2 diabetes.',
    source: {
      externalId: 'src:semaglutide-ada-easd-consensus-2018',
      name: 'Davies MJ, D\'Alessio DA, Fradkin J, et al. Management of Hyperglycemia in Type 2 Diabetes, 2018. A Consensus Report by the ADA and the EASD. Diabetes Care. 2018;41(12):2669–2701.',
      url: 'https://doi.org/10.2337/dci18-0033',
      publishedAt: '2018-10-01',
      methodologyType: 'derivative',
    },
  },

  // 3. SETTLED -> CONTESTED — post-market safety signal.
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2024-07-03',
    datePrecision: 'DAY',
    reason:
      'A retrospective cohort study (Hathaway et al., JAMA Ophthalmology 2024;142(8):732–739) reported an elevated risk of nonarteritic anterior ischemic optic neuropathy (NAION) among patients prescribed semaglutide, surfacing a previously unrecognized post-market safety signal. The finding prompted regulatory review and pharmacovigilance scrutiny and opened active debate over whether the drug\'s established benefit–risk balance required revision. The safety consensus around semaglutide moved from settled to contested pending confirmatory evidence.',
    source: {
      externalId: 'src:semaglutide-naion-jama-ophthalmol-2024',
      name: 'Hathaway JT, Shah MP, Hathaway DB, et al. Risk of Nonarteritic Anterior Ischemic Optic Neuropathy in Patients Prescribed Semaglutide. JAMA Ophthalmol. 2024;142(8):732–739.',
      url: 'https://doi.org/10.1001/jamaophthalmol.2024.2296',
      publishedAt: '2024-07-03',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const publishedAt = new Date(t.source.publishedAt)

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt,
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda_labels_v1',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt,
        methodologyType: t.source.methodologyType,
      },
    })

    const occurredAt = new Date(t.occurredAt)
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
        occurredAt,
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt,
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${id})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
