// Enrichment: post-publication epistemic trajectory for Rizvi NA, Hellmann MD,
// Snyder A, et al., "Cancer immunology. Mutational landscape determines
// sensitivity to PD-1 blockade in non-small cell lung cancer," Science
// 2015;348(6230):124–128, DOI 10.1126/science.aaa1348 (published 2015-03-12).
//
// The paper reported that higher nonsynonymous tumor mutation burden (TMB) in
// NSCLC was associated with improved objective response, durable clinical
// benefit, and progression-free survival on pembrolizumab (anti–PD-1).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 2015-03-12 publication date) already exists — do NOT duplicate it.
//
// Post-publication arc:
//   1. RECORDED -> SETTLED (2020-06-16): The US FDA granted accelerated approval
//      to pembrolizumab for adult and pediatric patients with unresectable or
//      metastatic tumor-mutational-burden-high (TMB-H, >=10 mutations/megabase)
//      solid tumors, with the FoundationOne CDx assay approved as a companion
//      diagnostic (efficacy from KEYNOTE-158). This tumor-agnostic biomarker
//      approval ratified into US regulatory practice the very principle this
//      paper pioneered — that mutation burden predicts response to PD-1 blockade
//      — moving it from a research finding to an approved, testable biomarker
//      indication. Institutional adjudication (regulatory approval); the paper's
//      NSCLC finding was vindicated, never retracted or overturned.
//      Community: INSTITUTIONAL.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-rizvi-2015-mutational-landscape-pd1.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-rizvi-2015-mutational-landscape-pd1.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply7eus01n9saihoovuo984'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
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
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  edgeType: 'FOR' | 'AGAINST'
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-06-16',
    datePrecision: 'DAY',
    edgeType: 'FOR',
    reason:
      'On 2020-06-16 the US FDA granted accelerated approval to pembrolizumab for adult and pediatric patients with unresectable or metastatic tumor-mutational-burden-high (TMB-H, >=10 mutations/megabase) solid tumors, and simultaneously approved the FoundationOne CDx assay as a companion diagnostic (efficacy demonstrated in the KEYNOTE-158 trial). This tumor-agnostic biomarker approval ratified into US regulatory practice the principle this paper pioneered — that nonsynonymous mutation burden predicts response to PD-1 blockade — converting the finding from a research correlation into an approved, testable biomarker indication. An institutional adjudication that vindicated the finding; it was never retracted or overturned.',
    source: {
      externalId: 'src:fda-pembrolizumab-tmb-h-2020',
      name: 'US Food and Drug Administration. FDA approves pembrolizumab for adults and children with TMB-H solid tumors. June 16, 2020.',
      url: 'https://www.fda.gov/drugs/drug-approvals-and-databases/fda-approves-pembrolizumab-adults-and-children-tmb-h-solid-tumors',
      publishedAt: '2020-06-16',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} — ${TRANSITIONS.length} post-publication transition(s)${DRY_RUN ? ' (dry-run)' : ''}`)

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry-run] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.datePrecision}) | ${slug}`)
      console.log(`            source: ${tr.source.externalId} -> ${tr.source.url}`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: tr.edgeType } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
