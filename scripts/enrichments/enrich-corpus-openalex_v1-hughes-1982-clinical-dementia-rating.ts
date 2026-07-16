// Epistemic-receipt enrichment for claim cmpm149wr02n1sadnyrnbvm7i
// "A New Clinical Scale for the Staging of Dementia" — Hughes CP, Berg L,
//   Danziger WL, Coben LA, Martin RL. British Journal of Psychiatry
//   140(6):566–572 (Jun 1982). Introduces the Clinical Dementia Rating (CDR).
//   DOI: 10.1192/bjp.140.6.566 · OpenAlex W2136250824
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 1982-06-01) already
// exists — do NOT duplicate it. This script adds the post-publication arc.
//
// Post-publication finding:
//   No retraction, expression of concern, failed replication, or methodological
//   reversal exists for this paper. The CDR is one of the most widely used
//   dementia-staging instruments in the world. The finding did not remain
//   merely "recorded": the instrument was standardized and adopted as the field
//   reference by Morris JC, "The Clinical Dementia Rating (CDR): current version
//   and scoring rules" (Neurology 43(11):2412–2414, Nov 1993, PMID 8232972).
//   That paper — independent of the original author team — fixed the definitive
//   global scoring rules (six domains; global 0/0.5/1/2/3) that the field
//   subsequently treated as canonical, settling the original claim that the CDR
//   achieves accurate clinical staging of dementia. This supports one
//   transition: RECORDED -> SETTLED.
//   (The CDR Sum of Boxes was later validated for staging by O'Bryant et al.,
//   Arch Neurol 2008, PMID 18695059, and the CDR-SB became the accepted primary
//   endpoint in phase-3 anti-amyloid trials; these reinforce but do not add a
//   distinct status transition, so they are noted here, not seeded.)
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-hughes-1982-clinical-dementia-rating.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-hughes-1982-clinical-dementia-rating.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

const CLAIM_ID = 'cmpm149wr02n1sadnyrnbvm7i'

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
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1993-11-01',
    datePrecision: 'MONTH',
    reason:
      'Morris JC, "The Clinical Dementia Rating (CDR): current version and scoring rules" (Neurology 43(11):2412–2414, Nov 1993), independent of the original Hughes/Berg author team, defined the definitive scoring rules for the CDR (six domains — memory, orientation, judgment/problem-solving, community affairs, home/hobbies, personal care — synthesized into a global 0/0.5/1/2/3 stage). The field adopted this version as the reference standard for clinical staging of dementia, settling the original 1982 claim that the CDR achieves accurate, unambiguous staging. No retraction, failed replication, or methodological reversal exists; the instrument remains standard in expert literature and clinical practice.',
    source: {
      externalId: 'src:morris-1993-cdr-current-version',
      name: 'Morris JC. The Clinical Dementia Rating (CDR): current version and scoring rules. Neurology 1993;43(11):2412–2414.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/8232972/',
      publishedAt: '1993-11-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source upsert: ${tr.source.externalId}`)
      console.log(`[dry-run] history upsert: ${histId} (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
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
        ingestedBy: 'enrich:openalex_v1-hughes-1982-clinical-dementia-rating',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
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

    console.log(`✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
