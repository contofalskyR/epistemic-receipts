// Enrichment: epistemic trajectory for The Diabetes Control and Complications
// Trial Research Group (1993), "The Effect of Intensive Treatment of Diabetes on
// the Development and Progression of Long-Term Complications in Insulin-Dependent
// Diabetes Mellitus," New England Journal of Medicine 329(14): 977–986.
// DOI 10.1056/NEJM199309303291401. OpenAlex W2769264260.
//
// This is the DCCT: a 1,441-patient RCT establishing that intensive glycemic
// control (targeting near-normal blood glucose) substantially reduces the onset
// and progression of retinopathy, nephropathy, and neuropathy in type 1
// diabetes. It is the foundational evidence for tight glucose control as
// standard of care.
//
// Post-publication research state:
//   - No retraction, expression of concern, or erratum. Crossref returns an
//     empty `update-to`; the DOI resolves via Crossref metadata.
//   - The finding was never contested in the expert literature. It was accepted
//     immediately and changed practice. Rather than a contest, the arc is a
//     vindication: the same DCCT cohort was followed observationally in the
//     EDIC study, which showed the microvascular benefit persisted for years
//     after the trial and — critically — that intensive treatment during DCCT
//     later reduced cardiovascular disease events ("metabolic memory"/legacy
//     effect). This is a direct, dated adjudication that settled the DCCT
//     hypothesis in the expert literature.
//
// The claim already carries its baseline first entry (null -> RECORDED at the
// 1993 publication). This script adds a single downstream arc:
//
//   RECORDED -> SETTLED (2005-12-22): Nathan et al. (DCCT/EDIC Research Group),
//     "Intensive Diabetes Treatment and Cardiovascular Disease in Patients with
//     Type 1 Diabetes" (NEJM 353(25): 2643–2653) reports the long-term follow-up
//     of the original DCCT cohort: intensive therapy during DCCT reduced the
//     risk of any cardiovascular disease event by 42% and of nonfatal MI,
//     stroke, or CVD death by 57%. Combined with the durable microvascular
//     benefit documented across EDIC, this vindicated and extended the 1993
//     finding, settling it in the expert literature. Community EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-dcct-1993-intensive-diabetes-treatment.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-dcct-1993-intensive-diabetes-treatment.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplygiq205z9saihyqpsqgkx'

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

// Do NOT duplicate the existing null -> RECORDED (1993 publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2005-12-22',
    datePrecision: 'DAY',
    reason:
      'Nathan et al. for the DCCT/EDIC Study Research Group, "Intensive Diabetes Treatment and Cardiovascular Disease in Patients with Type 1 Diabetes" (NEJM 353(25): 2643–2653, 22 Dec 2005), reports long-term follow-up of the original 1,441-patient DCCT cohort. Intensive glucose control during DCCT reduced the risk of any cardiovascular disease event by 42% and of nonfatal MI, stroke, or death from CVD by 57%, a durable "metabolic memory" benefit persisting years after the trial ended. This vindicated and extended the 1993 DCCT microvascular finding, settling the intensive-control hypothesis in the expert literature.',
    source: {
      externalId: 'src:nejm-dcct-edic-2005-cvd-type1-diabetes',
      name:
        'D.M. Nathan et al. (DCCT/EDIC Study Research Group), "Intensive Diabetes Treatment and Cardiovascular Disease in Patients with Type 1 Diabetes," New England Journal of Medicine 353(25): 2643–2653 (22 December 2005). DOI 10.1056/NEJMoa052187. PMID 16371630.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/16371630/',
      publishedAt: '2005-12-22',
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
