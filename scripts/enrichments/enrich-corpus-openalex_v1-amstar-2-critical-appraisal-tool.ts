// Enrichment: epistemic trajectory for AMSTAR 2 (Shea BJ, Reeves BC, Wells G,
// et al. "AMSTAR 2: a critical appraisal tool for systematic reviews that
// include randomised or non-randomised studies of healthcare interventions,
// or both." BMJ 2017;358:j4008. DOI 10.1136/bmj.j4008).
//
// The claim already carries its baseline first entry (null -> RECORDED) at the
// BMJ publication date 2017-09-21. This script does NOT duplicate it.
//
// Post-publication research:
//   - Retraction / expression of concern: NONE. Crossref `update-to` is null
//     for 10.1136/bmj.j4008; no notice on the BMJ page or PubMed.
//   - Failed replication: N/A — AMSTAR 2 is a critical-appraisal instrument
//     (a methods tool), not an empirical finding subject to replication.
//   - Field consensus shift: within a few years AMSTAR 2 became the de facto
//     standard tool for appraising the methodological quality of systematic
//     reviews of interventions, displacing the original AMSTAR. This is the one
//     dated, citable, verifiable adjudicating event and is added below.
//
// Single downstream arc:
//   RECORDED -> SETTLED (2022-04-10): Bojcic R, Todoric M, Puljak L. "Adopting
//     AMSTAR 2 critical appraisal tool for systematic reviews: speed of the tool
//     uptake and barriers for its adoption." BMC Med Res Methodol 2022;22:104
//     (DOI 10.1186/s12874-022-01592-y). This peer-reviewed bibliometric study
//     documents that AMSTAR 2 rapidly became the majority-used critical-appraisal
//     instrument for systematic reviews after 2017, evidencing an expert-literature
//     consensus that it is the reference comprehensive appraisal tool for the field.
//   Community: EXPERT_LITERATURE (methods literature consensus).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-amstar-2-critical-appraisal-tool.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-amstar-2-critical-appraisal-tool.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplzvfra033dsa86ea6hgogv'

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

// Do NOT duplicate the existing null -> RECORDED (BMJ publication, 2017-09-21)
// first entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2022-04-10',
    datePrecision: 'DAY',
    reason:
      'AMSTAR 2 (Shea et al., BMJ 2017) was introduced as a comprehensive critical-appraisal instrument for systematic reviews of healthcare interventions. In the years after publication it was adopted by the methods community as the reference tool for appraising the methodological quality of such reviews, displacing the original AMSTAR. A peer-reviewed bibliometric study by Bojcic, Todoric and Puljak (BMC Medical Research Methodology 2022;22:104) analysed the uptake of AMSTAR 2 and found it had become the majority-used appraisal instrument for systematic reviews, quantifying the speed of adoption and the barriers to it. This documents an expert-literature consensus that AMSTAR 2 is the settled comprehensive appraisal tool for the field, moving the claim from RECORDED to SETTLED.',
    source: {
      externalId: 'src:amstar2-uptake-bojcic-2022',
      name:
        'Bojcic R, Todoric M, Puljak L. Adopting AMSTAR 2 critical appraisal tool for systematic reviews: speed of the tool uptake and barriers for its adoption. BMC Medical Research Methodology 2022;22:104.',
      url: 'https://doi.org/10.1186/s12874-022-01592-y',
      publishedAt: '2022-04-10',
      methodologyType: 'derivative',
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
