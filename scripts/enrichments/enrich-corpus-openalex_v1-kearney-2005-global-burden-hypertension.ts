import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Existing claim — do NOT create a new Claim.
// Kearney PM, Whelton M, Reynolds K, Muntner P, Whelton PK, He J.
// "Global burden of hypertension: analysis of worldwide data", The Lancet 2005;365(9455):217-223.
// DOI 10.1016/s0140-6736(05)17741-1. OpenAlex W2116717490.
// The paper estimated ~972 million adults with hypertension in 2000 (26.4% of the
// adult population), projected to rise to ~1.56 billion by 2025.
const CLAIM_ID = 'cmpm1hcqo07dgsafwe4v2diao'

const DRY_RUN = process.argv.includes('--dry-run')

type Transition = {
  fromAxis: 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE' | null
  toAxis: 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
  reason: string
  edgeType: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: string
  }
}

// The baseline null -> RECORDED entry (publication, 2005-01) already exists.
// Start from RECORDED. Kearney's central finding — that global hypertension burden
// is very large and growing — was never contested; it was directly vindicated by a
// later systematic analysis that extended the same worldwide-data approach. Honest
// terminal state is SETTLED (vindicated), not CONTESTED or REVERSED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2016-08-09',
    datePrecision: 'DAY',
    reason:
      "Mills KT, Bundy JD, Kelly TN, et al. published 'Global Disparities of Hypertension Prevalence and Control: A Systematic Analysis of Population-Based Studies From 90 Countries' in Circulation on 2016-08-09 (DOI 10.1161/CIRCULATIONAHA.115.018912). Pooling 90-country population-based data, it estimated 1.39 billion adults with hypertension in 2010 — directly succeeding and confirming Kearney's worldwide-data estimate of ~972 million in 2000 and its projected growth. This large, highly cited systematic analysis vindicates the finding of an enormous and rising global hypertension burden, moving the claim RECORDED -> SETTLED.",
    edgeType: 'SUPPORTS',
    source: {
      externalId: 'src:mills-2016-global-hypertension-disparities-circulation',
      name:
        'Mills KT, Bundy JD, Kelly TN, et al. — "Global Disparities of Hypertension Prevalence and Control: A Systematic Analysis of Population-Based Studies From 90 Countries", Circulation 2016;134(6):441-450 (PMID 27502908)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/27502908/',
      publishedAt: '2016-08-09',
      methodologyType: 'meta-analysis',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`)
  }

  for (const t of TRANSITIONS) {
    const s = t.source
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    console.log(`  ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${s.externalId})`)
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: s.externalId },
      create: {
        externalId: s.externalId,
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1',
        autoApproved: true,
      },
      update: {
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis ?? undefined,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis ?? undefined,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId: CLAIM_ID, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: t.edgeType } })
    }
  }

  console.log(`Enriched claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s).`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
