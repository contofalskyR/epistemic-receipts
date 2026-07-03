// Enrichment: epistemic arc for the Levofloxacin FDA-label claim.
//
// Claim: cmpiygptc8wn6plo7owd45f0w  (ingestedBy: openfda_labels_v1)
//   "Levofloxacin (LEVOFLOXACIN): 1 INDICATIONS AND USAGE ..."
//
// Adds three ClaimStatusHistory transitions tracing the drug's evidentiary arc:
//   1. OPEN -> RECORDED    First landmark phase-3 clinical evidence (File et al., AAC 1997)
//   2. RECORDED -> SETTLED  Guideline standard-of-care via IDSA/ATS CAP guidelines (2007)
//   3. SETTLED -> CONTESTED Post-market FDA safety communication restricting use (2016)
//
// The claim itself already exists (do NOT create it) and already carries its
// initial null -> OPEN emergence entry. This script only adds the arc above.
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on a
// deterministic id = `${claimId}-${toAxis}-${occurredAt.slice(0,10)}`.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-levofloxacin.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiygptc8wn6plo7owd45f0w'

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
    occurredAt: '1997-09-01',
    datePrecision: 'MONTH',
    reason:
      'The pivotal multicenter, randomized phase-3 trial by File et al. (Antimicrob Agents Chemother 1997;41(9):1965–1972) compared intravenous and/or oral levofloxacin against ceftriaxone and/or cefuroxime axetil for adults with community-acquired pneumonia, reporting higher clinical and microbiologic success with levofloxacin. This was the registration-supporting randomized evidence establishing levofloxacin\'s efficacy and safety on a hard clinical indication, entering the drug into the peer-reviewed record shortly before its U.S. approval. It underpins the community-acquired pneumonia indication carried on the levofloxacin label.',
    source: {
      externalId: 'src:levofloxacin-file-cap-aac-1997',
      name: 'File TM Jr, Segreti J, Dunbar L, et al. A multicenter, randomized study comparing the efficacy and safety of intravenous and/or oral levofloxacin versus ceftriaxone and/or cefuroxime axetil in treatment of adults with community-acquired pneumonia. Antimicrob Agents Chemother. 1997;41(9):1965–1972.',
      url: 'https://doi.org/10.1128/AAC.41.9.1965',
      publishedAt: '1997-09-01',
      methodologyType: 'primary',
    },
  },

  // 2. RECORDED -> SETTLED — standard-of-care status via major guideline inclusion.
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2007-03-01',
    datePrecision: 'MONTH',
    reason:
      'The 2007 IDSA/ATS consensus guidelines on the management of community-acquired pneumonia in adults (Mandell et al., Clin Infect Dis 2007;44 Suppl 2:S27–S72) recommended respiratory fluoroquinolones — levofloxacin among them — as first-line therapy for outpatients with comorbidities and as a core option for inpatient and severe pneumonia. Joint endorsement by the two principal U.S. infectious-disease and pulmonary societies moved levofloxacin from a trial-supported agent to a guideline-embedded standard of care. This institutional ratification settled its place in routine pneumonia management.',
    source: {
      externalId: 'src:levofloxacin-idsa-ats-cap-2007',
      name: 'Mandell LA, Wunderink RG, Anzueto A, et al. Infectious Diseases Society of America/American Thoracic Society Consensus Guidelines on the Management of Community-Acquired Pneumonia in Adults. Clin Infect Dis. 2007;44(Suppl 2):S27–S72.',
      url: 'https://doi.org/10.1086/511159',
      publishedAt: '2007-03-01',
      methodologyType: 'derivative',
    },
  },

  // 3. SETTLED -> CONTESTED — post-market FDA safety signal restricting first-line use.
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-07-26',
    datePrecision: 'DAY',
    reason:
      'On July 26, 2016, the FDA issued a Drug Safety Communication updating warnings for oral and injectable fluoroquinolones — including levofloxacin — after concluding that their disabling and potentially permanent side effects involving tendons, muscles, joints, nerves, and the central nervous system generally outweigh the benefits for patients with uncomplicated urinary tract infection, acute sinusitis, or acute bacterial exacerbation of chronic bronchitis. The agency advised reserving these drugs for patients with no alternative treatment options for those conditions. This regulatory action reopened the benefit–risk balance for routine fluoroquinolone use, moving the settled standard-of-care consensus into contestation.',
    source: {
      externalId: 'src:levofloxacin-fda-dsc-fluoroquinolone-2016',
      name: 'FDA Drug Safety Communication: FDA updates warnings for oral and injectable fluoroquinolone antibiotics due to disabling side effects (July 26, 2016).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-fda-updates-warnings-oral-and-injectable-fluoroquinolone-antibiotics',
      publishedAt: '2016-07-26',
      methodologyType: 'opinion',
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
