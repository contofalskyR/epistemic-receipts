import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Existing claim — do NOT create a new Claim.
// Beigel et al., "Remdesivir for the Treatment of Covid-19" (ACTT-1 trial),
// New England Journal of Medicine. Preliminary report published 2020-05-22;
// the same DOI (10.1056/NEJMoa2007764) now serves the Final Report (2020-11-05).
// OpenAlex W3027630905.
const CLAIM_ID = 'cmply5qlj00tlsaih9x7xv0ql'

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

// The baseline null -> RECORDED entry (publication, 2020-05-22) already exists.
// Start from RECORDED. One verified post-publication adjudicating event: the
// finding of antiviral efficacy was directly contested by the large multinational
// WHO Solidarity randomized trial. It was never cleanly settled (remdesivir's
// recovery-time benefit held up while its mortality benefit remained disputed),
// so the honest terminal state is CONTESTED, not SETTLED or REVERSED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2021-02-11',
    datePrecision: 'DAY',
    reason:
      "The WHO Solidarity Trial Consortium published interim results of a large multinational randomized trial (>11,000 hospitalized Covid-19 patients across 405 hospitals) in the New England Journal of Medicine on 2021-02-11 (DOI 10.1056/NEJMoa2023184). Remdesivir showed little or no effect on the primary outcome of in-hospital mortality, nor on initiation of ventilation or duration of hospitalization, directly challenging the ACTT-1 finding that the antiviral is clinically efficacious. This dated, peer-reviewed contradicting RCT moves the antiviral-efficacy claim RECORDED -> CONTESTED; the field has not since converged (recovery-time benefit is supported while mortality benefit remains disputed).",
    edgeType: 'AGAINST',
    source: {
      externalId: 'src:who-solidarity-remdesivir-nejm-2021',
      name:
        'WHO Solidarity Trial Consortium — "Repurposed Antiviral Drugs for Covid-19 — Interim WHO Solidarity Trial Results", N Engl J Med 2021;384:497-511',
      url: 'https://doi.org/10.1056/NEJMoa2023184',
      publishedAt: '2021-02-11',
      methodologyType: 'primary',
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
