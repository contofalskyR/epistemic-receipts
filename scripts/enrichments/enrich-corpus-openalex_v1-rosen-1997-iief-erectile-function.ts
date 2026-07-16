// Enrichment: post-publication epistemic trajectory for
// Rosen et al. (1997), "The International Index of Erectile Function (IIEF):
// a multidimensional scale for assessment of erectile dysfunction."
// Urology 49(6):822–830. DOI 10.1016/s0090-4295(97)00238-0 · OpenAlex W2086240335.
//
// Claim already has its baseline ClaimStatusHistory row (null -> RECORDED at
// the 1997 publication date). This script adds what happened AFTER publication.
//
// Arc added (1 transition):
//   RECORDED -> SETTLED (2002-08) — the IIEF's five-year state-of-the-science
//   review (Rosen, Cappelleri & Gendrano, Int J Impot Res 2002;14(4):226–244)
//   consolidated the accumulated psychometric-validation evidence and cemented
//   the IIEF as the field's gold-standard efficacy endpoint for ED trials.
//   No retraction, failed replication, or overturning event was found.
//
// Idempotent: upserts on externalId (source) and a deterministic id
// (claimStatusHistory). Safe to re-run.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-rosen-1997-iief-erectile-function.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-rosen-1997-iief-erectile-function.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplzqg3e054psat0ogkqyhtz'

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
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2002-08-01',
    datePrecision: 'MONTH',
    reason:
      'Five years after publication, Rosen, Cappelleri & Gendrano published "The International Index of Erectile Function (IIEF): a state-of-the-science review" (Int J Impot Res 2002;14(4):226–244), consolidating the accumulated psychometric-validation literature across dozens of studies and 32 language versions. The review documented the IIEF\'s established reliability, construct validity, and its adoption as the primary efficacy endpoint in more than 50 ED clinical trials, cementing it as the field\'s gold-standard measure. This adjudicating review marks the transition from a newly recorded instrument to a settled, community-ratified standard.',
    source: {
      externalId: 'src:rosen-2002-iief-state-of-the-science-review',
      name: 'Rosen RC, Cappelleri JC, Gendrano N. The International Index of Erectile Function (IIEF): a state-of-the-science review. International Journal of Impotence Research 2002;14(4):226–244.',
      url: 'https://doi.org/10.1038/sj.ijir.3900857',
      publishedAt: '2002-08-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry-run] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
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
