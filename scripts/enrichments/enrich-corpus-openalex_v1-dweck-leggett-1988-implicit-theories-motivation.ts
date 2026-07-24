// Enrichment: epistemic trajectory for Dweck & Leggett (1988),
// "A social-cognitive approach to motivation and personality."
// Psychological Review, 95(2), 256–273. DOI: 10.1037/0033-295x.95.2.256
// OpenAlex: W2167884222.
//
// This is the foundational theoretical statement of the implicit-theories
// ("mindset") model: implicit theories of intelligence orient individuals
// toward performance vs. learning goals, which set up the "helpless" vs.
// "mastery-oriented" behavioral patterns. It is a Psychological Review
// theoretical article, not an empirical report, and carries no retraction,
// correction, or expression of concern (Crossref shows no update-to /
// updated-by records).
//
// The claim already carries its baseline entry (null -> RECORDED at the
// 1988-04 publication date). This script adds the single downstream arc for
// the model's central empirical prediction — that mindset drives academic
// achievement via these adaptive/maladaptive patterns:
//
//   RECORDED -> CONTESTED (2018-04): Sisk, Burgoyne, Sun, Butler & Macnamara
//     published two meta-analyses in Psychological Science directly testing
//     the mindset–achievement prediction. The mindset–achievement association
//     was weak overall (mean r ~ .10; k = 273, N = 365,915) and growth-mindset
//     interventions were largely ineffective except in narrow subgroups (e.g.,
//     low-SES / academically at-risk students). This adjudicating synthesis
//     contested the model's claim that implicit theories are a strong
//     determinant of achievement-relevant motivation and outcomes.
//     Community: EXPERT_LITERATURE.
//
// Note deliberately NOT added: Yeager et al. (2019, Nature) reported a
// national experiment with conditional/subgroup effects — a partial, not a
// settling, result; the literature remains contested. No CONTESTED -> SETTLED
// transition is asserted, to avoid overclaiming.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-dweck-leggett-1988-implicit-theories-motivation.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-dweck-leggett-1988-implicit-theories-motivation.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxkv7r004dsa7fk907t8l9'

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

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2018-04-01',
    datePrecision: 'MONTH',
    reason:
      'Sisk, Burgoyne, Sun, Butler & Macnamara (2018) published two meta-analyses in Psychological Science directly testing the central prediction of the implicit-theories model — that growth vs. fixed mindsets drive academic achievement via mastery-oriented vs. helpless patterns. The mindset–achievement association was weak overall (mean r ~ .10; k = 273, N = 365,915), and growth-mindset interventions were largely ineffective outside narrow at-risk subgroups. This large, quantitative adjudication contested the model’s claim that implicit theories are a strong determinant of achievement-relevant motivation and outcomes.',
    source: {
      externalId: 'src:pubmed-29505339-sisk-2018-mindset-metaanalyses',
      name:
        'Sisk VF, Burgoyne AP, Sun J, Butler JL, Macnamara BN (2018). "To What Extent and Under Which Circumstances Are Growth Mind-Sets Important to Academic Achievement? Two Meta-Analyses." Psychological Science, 29(4), 549–571. DOI: 10.1177/0956797617739704. PMID: 29505339.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/29505339/',
      publishedAt: '2018-04-01',
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
