import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Existing claim — do NOT create a new Claim.
// Rudd et al., "Global, regional, and national sepsis incidence and mortality,
// 1990–2017: analysis for the Global Burden of Disease Study", The Lancet 2020;
// 395(10219):200-211. DOI 10.1016/S0140-6736(19)32989-7. OpenAlex W2998853022.
const CLAIM_ID = 'cmplzlggr02sdsat0k630ozri'

const DRY_RUN = process.argv.includes('--dry-run')

type Transition = {
  fromAxis: 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE' | null
  toAxis: 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: string
  }
}

// The baseline null -> RECORDED entry (publication, 2020-01) already exists.
// Start from RECORDED. Only one verified post-publication adjudicating event.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-09-01',
    datePrecision: 'MONTH',
    reason:
      "In 2020 the World Health Organization published its first-ever 'Global report on the epidemiology and burden of sepsis: current evidence, identifying gaps and future directions' (ISBN 978-92-4-001078-9). The report adopts the GBD 2017 sepsis estimates reported by Rudd et al. — 48.9 million incident cases and 11.0 million sepsis-related deaths in 2017 — as WHO's authoritative global figures for the burden of sepsis, framing them as the basis for policy, prevention and surveillance under WHO's mandate following World Health Assembly resolution WHA70.7. This institutional endorsement establishes the paper's estimates as settled field consensus: RECORDED -> SETTLED.",
    source: {
      externalId: 'src:who-global-report-sepsis-2020',
      name:
        'WHO — Global report on the epidemiology and burden of sepsis: current evidence, identifying gaps and future directions (2020)',
      url: 'https://iris.who.int/handle/10665/334216',
      publishedAt: '2020-09-01',
      methodologyType: 'derivative',
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
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
