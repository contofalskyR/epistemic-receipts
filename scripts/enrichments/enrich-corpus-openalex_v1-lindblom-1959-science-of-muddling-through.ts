// Enrich epistemic receipt for Lindblom, C.E. (1959), "The Science of 'Muddling Through'",
// Public Administration Review 19(2):79-88. DOI 10.2307/973677 · OpenAlex W2313563931.
//
// Claim (existing): cmplyrkff021zsaqkqm90qvrh — already carries its baseline
// ClaimStatusHistory row (fromAxis=null -> RECORDED at the 1959 publication date).
// This script does NOT create a Claim and does NOT duplicate that baseline row.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (1964-09) — Yehezkel Dror's dated methodological critique
//   "Muddling Through—'Science' or Inertia?" (PAR 24(3):153-157, DOI 10.2307/973640)
//   argued that Lindblom's incrementalism ("successive limited comparisons") is not a
//   science of decision but a rationalization of inertia — adequate only where change is
//   marginal, and a conservative brake where societies need rapid, discontinuous change.
//   This is the canonical first substantive scholarly contest of the finding.
//
// No retraction, expression of concern, failed-replication report, or adjudicating
// systematic review/meta-analysis exists for this 1959 policy-theory paper; only the
// single verified CONTESTED transition is recorded here.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-lindblom-1959-science-of-muddling-through.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-lindblom-1959-science-of-muddling-through.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplyrkff021zsaqkqm90qvrh'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1964-09-01',
    datePrecision: 'MONTH',
    reason:
      "Yehezkel Dror's 'Muddling Through—\"Science\" or Inertia?' (Public Administration Review 24(3):153-157, Sept 1964) mounted the first major scholarly critique of Lindblom's incrementalism. Dror argued that the method of 'successive limited comparisons' is not a science of decision but a rationalization of inertia — workable only where policy change is marginal, and a conservative brake in societies that need rapid, discontinuous change. The critique opened a durable disciplinary debate over whether incrementalism describes good policymaking or merely excuses drift.",
    source: {
      externalId: 'src:dror-1964-muddling-through-science-or-inertia',
      name: 'Dror Y. Muddling Through—"Science" or Inertia? Public Administration Review 1964;24(3):153-157.',
      url: 'https://doi.org/10.2307/973640',
      publishedAt: '1964-09-01',
      methodologyType: 'opinion',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (id=${slug}) src=${tr.source.externalId}`)
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
        ingestedBy: 'enrich:openalex_v1-lindblom-1959-muddling-through',
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

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (id=${slug})`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
