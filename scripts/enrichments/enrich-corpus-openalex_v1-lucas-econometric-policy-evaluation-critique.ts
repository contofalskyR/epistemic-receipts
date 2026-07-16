// Epistemic-receipt enrichment for claim cmplynv0d008zsaqkxhz1tqw3
// "Econometric policy evaluation: A critique" — Robert E. Lucas Jr. (1976),
// Carnegie-Rochester Conference Series on Public Policy 1:19–46.
// DOI: 10.1016/s0167-2231(76)80003-6 · OpenAlex: W2070720254
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the 1976
// publication date) already exists; this script does NOT duplicate it.
//
// Post-publication arc added here:
//   RECORDED -> CONTESTED (Feb 2003) — Estrella & Fuhrer, "Are 'Deep'
//   Parameters Stable? The Lucas Critique as an Empirical Hypothesis"
//   (Review of Economics and Statistics 85(1):94–104), the first widely-cited
//   dated attempt to test the Lucas Critique as an empirical proposition. It
//   found little evidence of the parameter instability the critique predicts
//   under documented monetary-policy regime shifts, opening a standing dispute
//   over the critique's practical/empirical importance (reinforced by
//   Rudebusch 2005). The critique's THEORETICAL validity remained broadly
//   accepted, so no SETTLED/REVERSED step is added.
//
// Idempotent: upserts on stable ids.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-lucas-econometric-policy-evaluation-critique.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-lucas-econometric-policy-evaluation-critique.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplynv0d008zsaqkxhz1tqw3'

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
  fromAxis: FactStatus
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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2003-02-01',
    datePrecision: 'MONTH',
    reason:
      'Estrella & Fuhrer, "Are \'Deep\' Parameters Stable? The Lucas Critique as an Empirical Hypothesis" (Review of Economics and Statistics 85(1):94–104, Feb 2003), was the first widely-cited paper to test the Lucas Critique as an empirical proposition rather than accept it as an a priori truth. Applying parameter-stability tests to small monetary-policy models across documented policy-regime shifts, they found little evidence of the instability the critique predicts — and that forward-looking "optimizing" models were no more stable than backward-looking ones. This opened a standing dispute (reinforced by Rudebusch 2005) over the critique\'s empirical/practical importance, while its theoretical validity remained broadly accepted.',
    source: {
      externalId: 'src:lucas-critique-estrella-fuhrer-2003',
      name: 'Estrella A, Fuhrer JC. Are "Deep" Parameters Stable? The Lucas Critique as an Empirical Hypothesis. Review of Economics and Statistics 2003;85(1):94–104.',
      url: 'https://www.bostonfed.org/publications/research-department-working-paper/1999/are-deep-parameters-stable-the-lucas-critique-as-an-empirical-hypothesis.aspx',
      publishedAt: '2003-02-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${slug}: ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.source.externalId})`)
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
        ingestedBy: 'enrich:corpus-openalex_v1',
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'AGAINST' } })
    }

    console.log(`  ✓ ${slug}: ${tr.fromAxis} -> ${tr.toAxis}`)
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
