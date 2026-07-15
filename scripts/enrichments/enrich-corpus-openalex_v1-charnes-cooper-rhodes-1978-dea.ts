// Enrichment: epistemic trajectory for Charnes, Cooper & Rhodes (1978),
// "Measuring the efficiency of decision making units," European Journal of
// Operational Research 2(6): 429–444. DOI 10.1016/0377-2217(78)90138-8.
// OpenAlex W2076452041. This is the founding paper of Data Envelopment
// Analysis (DEA) — the CCR model — which introduced a fractional/linear
// programming definition of relative efficiency for multiple-input,
// multiple-output decision making units.
//
// Post-publication research state:
//   - No retraction, expression of concern, or erratum exists. Crossref
//     returns no `update-to` and no relations; the DOI resolves 200.
//   - DEA was never contested as invalid; it was adopted and extended (e.g.
//     Banker–Charnes–Cooper 1984 added variable returns to scale). By its
//     30th anniversary it was a mature, standard OR methodology with its own
//     literature, textbooks, and software.
//
// The claim already carries its baseline first entry (null -> RECORDED at the
// 1978 publication). This script adds the single downstream arc:
//   RECORDED -> SETTLED (2009-01): Cook & Seiford's invited retrospective
//     "Data envelopment analysis (DEA) – Thirty years on," published in the
//     same flagship journal (EJOR) and itself heavily cited (>1,200), reviews
//     the field's three decades of development and establishes DEA as a
//     settled, canonical methodology in operations research. This is
//     vindication by expert-literature consensus, not a contest.
//
// Community: EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-charnes-cooper-rhodes-1978-dea.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-charnes-cooper-rhodes-1978-dea.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w42pz0023sa8h271v6wpc'

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

// Do NOT duplicate the existing null -> RECORDED (1978 publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2009-01-01',
    datePrecision: 'MONTH',
    reason:
      'Cook & Seiford, "Data envelopment analysis (DEA) – Thirty years on" (European Journal of Operational Research 192(1): 1–17, Jan 2009), is an invited retrospective in the same flagship journal that published the original CCR model. It surveys three decades of DEA development and establishes the method as a mature, canonical approach to relative efficiency measurement in operations research. DEA was never contested as invalid — it was adopted and extended — so this review adjudicates the founding claim directly into a settled state via expert-literature consensus rather than resolving a prior dispute.',
    source: {
      externalId: 'src:ejor-cook-seiford-2009-dea-thirty-years-on',
      name:
        'W.D. Cook & L.M. Seiford, "Data envelopment analysis (DEA) – Thirty years on," European Journal of Operational Research 192(1): 1–17 (January 2009). DOI 10.1016/j.ejor.2008.01.032.',
      url: 'https://doi.org/10.1016/j.ejor.2008.01.032',
      publishedAt: '2009-01-01',
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
