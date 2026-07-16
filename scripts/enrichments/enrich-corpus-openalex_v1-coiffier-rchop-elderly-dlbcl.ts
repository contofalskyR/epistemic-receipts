// Epistemic-receipt enrichment for claim cmplybqhn03p9saih0fcs9rym
//
// Paper: Coiffier B, et al. "CHOP Chemotherapy plus Rituximab Compared with
// CHOP Alone in Elderly Patients with Diffuse Large-B-Cell Lymphoma."
// N Engl J Med 2002;346(4):235-242. DOI 10.1056/nejmoa011795. OpenAlex W2058015212.
// This is the GELA LNH-98.5 trial, the first randomized study to show that adding
// rituximab to CHOP improves survival in elderly DLBCL.
//
// Post-publication arc (baseline fromAxis=null -> RECORDED at 2002-01-24 already seeded):
//   RECORDED -> SETTLED (2010-09-23) — the 10-year follow-up of the same LNH-98.5
//   cohort (Coiffier et al., Blood 2010) confirmed a durable, statistically robust
//   survival advantage (10-yr PFS 36.5% vs 20%, 10-yr OS 43.5% vs 27.6%) with no
//   offsetting late toxicity, cementing R-CHOP as the settled standard of care.
//   The finding was never contested; it was vindicated -> a direct RECORDED->SETTLED.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-coiffier-rchop-elderly-dlbcl.ts
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplybqhn03p9saih0fcs9rym'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

// Only the post-publication transitions. The baseline null->RECORDED row already exists.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2010-09-23',
    datePrecision: 'DAY',
    reason:
      'The 10-year follow-up of the same GELA LNH-98.5 cohort (Coiffier et al., Blood 2010;116(12):2040-2045) showed the survival benefit of adding rituximab to CHOP persisted for a decade: 10-year progression-free survival 36.5% vs 20% and 10-year overall survival 43.5% vs 27.6%, with no offsetting late toxicity. Together with confirmatory trials (RICOVER-60, MInT) and its incorporation into standard practice, this durable result settled R-CHOP as the standard of care for elderly diffuse large-B-cell lymphoma.',
    source: {
      externalId: 'src:coiffier-2010-lnh985-10yr',
      name: 'Coiffier B, et al. Long-term outcome of patients in the LNH-98.5 trial, the first randomized study comparing rituximab-CHOP to standard CHOP chemotherapy in DLBCL patients: a study by the Groupe d\'Etudes des Lymphomes de l\'Adulte. Blood 2010;116(12):2040-2045.',
      url: 'https://doi.org/10.1182/blood-2010-03-276246',
      publishedAt: '2010-09-23',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:coiffier-rchop-elderly-dlbcl',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
