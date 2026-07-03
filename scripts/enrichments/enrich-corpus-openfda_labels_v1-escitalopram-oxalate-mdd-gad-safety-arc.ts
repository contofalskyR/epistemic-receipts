// Enrichment: epistemic trajectory for the FDA drug-label claim
//   "Escitalopram (ESCITALOPRAM OXALATE): 1 INDICATIONS AND USAGE …
//    major depressive disorder (MDD) in adults and pediatric patients 12+
//    … generalized anxiety disorder (GAD) in adults and pediatric patients 7+"
// Claim id: cmpiyjfze8zt0plo7sjjjbsmu  (ingestedBy openfda_labels_v1)
//
// The claim already carries its label-ingestion first entry (fromAxis=null ->
// <first>); this script does NOT duplicate it. It adds the downstream epistemic
// arc of escitalopram (the S-enantiomer of citalopram, brand Lexapro), tracked
// through the two indications named verbatim in the claim (MDD and GAD):
//
//   1. OPEN -> RECORDED (2002-04): the first pivotal fixed-dose Phase III
//      efficacy evidence for escitalopram in MDD is published (Burke et al.,
//      J Clin Psychiatry), recording the drug's antidepressant effect in the
//      peer-reviewed literature ahead of and supporting its FDA approval.
//      EXPERT_LITERATURE.
//   2. RECORDED -> SETTLED (2003-12): the FDA approves escitalopram for a
//      second flagship indication, generalized anxiety disorder (NDA 021323
//      supplement) — the institutional ratification that establishes the drug
//      across both indications the claim names and settles it as a
//      first-line SSRI. INSTITUTIONAL.
//   3. SETTLED -> CONTESTED (2004-10-15): the FDA directs a boxed ("black box")
//      warning onto all antidepressants, including escitalopram, for increased
//      suicidality in children and adolescents — a post-market safety signal
//      that opened a sustained risk–benefit contest over pediatric SSRI use,
//      directly relevant to the claim's pediatric (12+/7+) indications.
//      INSTITUTIONAL.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-escitalopram-oxalate-mdd-gad-safety-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-escitalopram-oxalate-mdd-gad-safety-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyjfze8zt0plo7sjjjbsmu'

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
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

// Do NOT duplicate the existing null -> <first> (label-ingestion) entry.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2002-04-01',
    datePrecision: 'MONTH',
    reason:
      'The first pivotal, fixed-dose Phase III trial of escitalopram in major depressive disorder — Burke, Gergel, and Bose in the Journal of Clinical Psychiatry (April 2002) — reported that the single-isomer SSRI significantly outperformed placebo in depressed outpatients. This peer-reviewed efficacy evidence recorded escitalopram\'s antidepressant effect in the clinical literature, the basis on which the FDA approved it for MDD in August 2002. It is the first published clinical evidence underlying the "treatment of major depressive disorder" indication quoted in this claim.',
    source: {
      externalId: 'src:burke-escitalopram-fixed-dose-mdd-2002-lexapro',
      name:
        'Burke WJ, Gergel I, Bose A. Fixed-dose trial of the single isomer SSRI escitalopram in depressed outpatients. J Clin Psychiatry. 2002 Apr;63(4):331-336.',
      url: 'https://doi.org/10.4088/jcp.v63n0410',
      publishedAt: '2002-04-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2003-12-01',
    datePrecision: 'MONTH',
    reason:
      'In December 2003 the FDA approved a supplement to escitalopram\'s New Drug Application (NDA 021323, Lexapro) for the treatment of generalized anxiety disorder, extending the drug from a single approved indication to the two flagship indications — MDD and GAD — named verbatim in this claim. Approval of a second major psychiatric indication is the institutional ratification that established escitalopram as a first-line SSRI across mood and anxiety disorders. From this point the drug was entrenched as standard-of-care in routine outpatient practice.',
    source: {
      externalId: 'src:fda-drugsatfda-lexapro-nda021323-gad-2003',
      name:
        'FDA Drugs@FDA — Escitalopram oxalate (Lexapro), NDA 021323, approval history including the generalized anxiety disorder supplemental indication (approved December 2003).',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=021323',
      publishedAt: '2003-12-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2004-10-15',
    datePrecision: 'DAY',
    reason:
      'On 15 October 2004 the FDA directed manufacturers of all antidepressants — including escitalopram — to add a boxed ("black box") warning describing an increased risk of suicidal thinking and behavior in children and adolescents, based on a pooled analysis of pediatric placebo-controlled trials. The action opened a sustained risk–benefit contest over pediatric SSRI use that bears directly on this claim\'s pediatric indications (MDD from age 12, GAD from age 7). The indication itself was not withdrawn, but the drug\'s safety in the youngest labeled populations became, and remains, actively contested.',
    source: {
      externalId: 'src:fda-antidepressant-pediatric-suicidality-boxed-warning-2004',
      name:
        'FDA Public Health Advisory — Suicidality in Children and Adolescents Being Treated With Antidepressant Medications (boxed warning directed 15 October 2004).',
      url: 'https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/suicidality-children-and-adolescents-being-treated-antidepressant-medications',
      publishedAt: '2004-10-15',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${
      DRY_RUN ? ' (DRY RUN)' : ''
    }`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(
      `Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`,
    )
  }

  for (const t of TRANSITIONS) {
    const s = t.source
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    console.log(
      `  ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${s.externalId})`,
    )
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: s.externalId },
      create: {
        externalId: s.externalId,
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1',
        autoApproved: true,
      },
      update: {
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
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

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
