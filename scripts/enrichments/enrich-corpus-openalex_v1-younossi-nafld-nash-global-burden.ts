// Enrichment: epistemic trajectory for Younossi et al. (2017/2018),
// "Global burden of NAFLD and NASH: trends, predictions, risk factors and
// prevention," Nature Reviews Gastroenterology & Hepatology.
// DOI: 10.1038/nrgastro.2017.109 · OpenAlex: W2759997926
//
// Identity verified via Crossref (title, container "Nature Reviews
// Gastroenterology & Hepatology", authors Younossi, Anstee, Marietti, Hardy,
// Henry, Eslam, George, Bugianesi). NOT retracted: absent from the Retraction
// Watch database (0 rows for the DOI), Crossref carries no `update-to`, and
// OpenAlex isRetracted=false. No expression of concern found.
//
// The paper's central contribution is an estimate of the global burden of
// NAFLD/NASH (prevalence, trends, projections). That finding was never
// contested — it was independently adjudicated and CONFIRMED by a subsequent
// large systematic review and meta-analysis:
//
//   Riazi, Azhari, Charette, Underwood, et al., "The prevalence and incidence
//   of NAFLD worldwide: a systematic review and meta-analysis," The Lancet
//   Gastroenterology & Hepatology (online 5 July 2022; Vol 7, Issue 9).
//   DOI: 10.1016/S2468-1253(22)00165-0. This independent meta-analysis
//   (Calgary group) pooled 92 studies / ~9.7M individuals and reported an
//   overall global NAFLD prevalence of ~32%, vindicating and updating the
//   burden estimates advanced by the 2017 review.
//
// The claim already carries its baseline null -> RECORDED first entry
// (publication, 2017-09-20). This script adds the single downstream arc:
//   RECORDED -> SETTLED (2022-07-05): a well-cited independent systematic
//     review and meta-analysis confirms the global-burden finding.
// Community: EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-younossi-nafld-nash-global-burden.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-younossi-nafld-nash-global-burden.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm1ir3i07zzsafwtoap874q'

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

// Do NOT duplicate the existing null -> RECORDED (publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2022-07-05',
    datePrecision: 'DAY',
    reason:
      "Younossi et al.'s estimate of the global burden of NAFLD/NASH was independently adjudicated and confirmed by Riazi et al.'s systematic review and meta-analysis in The Lancet Gastroenterology & Hepatology (online 5 July 2022), which pooled 92 studies covering roughly 9.7 million individuals and reported an overall global NAFLD prevalence of ~32%. This independent quantitative synthesis by a separate group vindicated and refined the prevalence and trend estimates advanced by the 2017 review, settling the global-burden finding in the expert literature. The paper was never retracted or subject to an expression of concern.",
    source: {
      externalId: 'src:riazi-2022-nafld-prevalence-worldwide-meta-analysis',
      name:
        'Riazi K, Azhari H, Charette JH, Underwood FE, et al. "The prevalence and incidence of NAFLD worldwide: a systematic review and meta-analysis." The Lancet Gastroenterology & Hepatology, Vol 7, Issue 9 (online 5 July 2022). DOI: 10.1016/S2468-1253(22)00165-0.',
      url: 'https://doi.org/10.1016/S2468-1253(22)00165-0',
      publishedAt: '2022-07-05',
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
