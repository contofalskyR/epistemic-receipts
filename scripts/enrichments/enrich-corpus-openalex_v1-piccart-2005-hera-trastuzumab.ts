// Enrichment: epistemic trajectory for Piccart-Gebhart MJ et al. (2005),
// "Trastuzumab after Adjuvant Chemotherapy in HER2-Positive Breast Cancer,"
// New England Journal of Medicine 353(16):1659–1672. DOI 10.1056/NEJMoa052306.
// OpenAlex W2149908785. (The HERA trial.)
//
// The HERA trial was one of the pivotal randomized trials showing that one year
// of adjuvant trastuzumab after chemotherapy substantially reduces recurrence in
// HER2-positive early breast cancer.
//
// The claim already carries its baseline (null -> RECORDED) first entry at the
// October 20, 2005 publication date. This script adds the single downstream arc:
//
//   RECORDED -> SETTLED (2012-04-18): The Cochrane systematic review Moja L,
//     Tagliabue L, Balduzzi S, et al., "Trastuzumab containing regimens for
//     early breast cancer" (Cochrane Database of Systematic Reviews 2012, Issue
//     4, Art. No. CD006243; DOI 10.1002/14651858.CD006243.pub2) pooled eight
//     randomized adjuvant trials (including HERA), covering over 11,000 women,
//     and concluded that trastuzumab significantly improves both overall survival
//     (HR ~0.66) and disease-free survival (HR ~0.60). The review adjudicated the
//     HERA finding as an established efficacy result, settling adjuvant
//     trastuzumab as standard of care for HER2-positive early breast cancer.
//
// Community: EXPERT_LITERATURE (Cochrane systematic review / meta-analysis).
//
// Verified adjudicating source URL (HTTP 200): https://pubmed.ncbi.nlm.nih.gov/22513938/
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-piccart-2005-hera-trastuzumab.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-piccart-2005-hera-trastuzumab.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply574b00jxsaihgmb4emuo'

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
    occurredAt: '2012-04-18',
    datePrecision: 'DAY',
    reason:
      'The Cochrane systematic review Moja L, Tagliabue L, Balduzzi S, et al., "Trastuzumab containing regimens for early breast cancer" (Cochrane Database of Systematic Reviews 2012, Issue 4, Art. No. CD006243; DOI 10.1002/14651858.CD006243.pub2) pooled eight randomized adjuvant trials — including HERA — covering over 11,000 women. It concluded that adjuvant trastuzumab significantly improves overall survival (hazard ratio ~0.66) and disease-free survival (hazard ratio ~0.60). This meta-analytic adjudication confirmed the HERA efficacy result and settled adjuvant trastuzumab as standard of care for HER2-positive early breast cancer.',
    source: {
      externalId: 'src:cochrane-2012-trastuzumab-early-breast-cancer-CD006243',
      name:
        'Moja L, Tagliabue L, Balduzzi S, Parmelli E, Pistotti V, Guarneri V, D\'Amico R. Trastuzumab containing regimens for early breast cancer. Cochrane Database of Systematic Reviews 2012, Issue 4. Art. No.: CD006243. PMID 22513938.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/22513938/',
      publishedAt: '2012-04-18',
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
