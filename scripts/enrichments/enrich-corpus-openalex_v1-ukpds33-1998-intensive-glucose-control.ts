// Enrichment: epistemic trajectory for UK Prospective Diabetes Study (UKPDS)
// Group (1998), "Intensive blood-glucose control with sulphonylureas or insulin
// compared with conventional treatment and risk of complications in patients
// with type 2 diabetes (UKPDS 33)," The Lancet 352(9131): 837–853.
// DOI 10.1016/S0140-6736(98)07019-6. OpenAlex W2337454357.
//
// UKPDS 33 is the landmark ~3,867-patient RCT establishing that intensive
// blood-glucose control (sulphonylureas or insulin) in newly diagnosed type 2
// diabetes reduces the risk of microvascular complications versus conventional
// treatment, while cardiovascular endpoints did not reach significance during
// the trial. It is the foundational trial evidence for tight glycemic control
// in type 2 diabetes.
//
// Post-publication research state:
//   - No retraction, expression of concern, or erratum. Crossref returns null
//     for both `update-to` and `updated-by`; the DOI resolves (HTTP 200).
//   - The finding was not contested in the expert literature; it changed
//     practice on publication. Rather than a contest, the arc is a vindication:
//     the surviving UKPDS cohort entered 10 years of post-trial monitoring, and
//     Holman et al. (UKPDS 80, NEJM 2008) reported that the microvascular risk
//     reduction persisted and that emergent, statistically significant
//     reductions in myocardial infarction and death from any cause appeared in
//     the intensive (sulphonylurea–insulin) group despite early loss of
//     between-group glycemic differences — the type 2 "legacy effect,"
//     analogous to DCCT/EDIC metabolic memory in type 1. This is a direct,
//     dated adjudication that settled the UKPDS 33 hypothesis.
//
// The claim already carries its baseline first entry (null -> RECORDED at the
// 1998-09 publication). This script adds a single downstream arc:
//
//   RECORDED -> SETTLED (2008-10-09): Holman RR, Paul SK, Bethel MA, Matthews
//     DR, Neil HAW, "10-Year Follow-up of Intensive Glucose Control in Type 2
//     Diabetes" (NEJM 359(15): 1577–1589) — the UKPDS post-trial monitoring
//     report. Community EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ukpds33-1998-intensive-glucose-control.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ukpds33-1998-intensive-glucose-control.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply48xp0033saihs3zkg9ev'

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

// Do NOT duplicate the existing null -> RECORDED (1998-09 publication) first
// entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2008-10-09',
    datePrecision: 'DAY',
    reason:
      'Holman RR, Paul SK, Bethel MA, Matthews DR, Neil HAW, "10-Year Follow-up of Intensive Glucose Control in Type 2 Diabetes" (NEJM 359(15): 1577–1589, 9 Oct 2008) reports the UKPDS post-trial monitoring of the original cohort. The microvascular risk reduction from intensive control persisted, and emergent statistically significant reductions appeared in the sulphonylurea–insulin group for myocardial infarction (15%) and death from any cause (13%) — despite early loss of the between-group glycemic difference. This "legacy effect" vindicated and extended the 1998 UKPDS 33 finding, settling the intensive-control hypothesis for type 2 diabetes in the expert literature.',
    source: {
      externalId: 'src:nejm-ukpds80-2008-10yr-followup-type2-diabetes',
      name:
        'R.R. Holman, S.K. Paul, M.A. Bethel, D.R. Matthews, H.A.W. Neil, "10-Year Follow-up of Intensive Glucose Control in Type 2 Diabetes," New England Journal of Medicine 359(15): 1577–1589 (9 October 2008). DOI 10.1056/NEJMoa0806470. PMID 18784090.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/18784090/',
      publishedAt: '2008-10-09',
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
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`)
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
        ingestedBy: 'enrich:openalex_v1',
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
