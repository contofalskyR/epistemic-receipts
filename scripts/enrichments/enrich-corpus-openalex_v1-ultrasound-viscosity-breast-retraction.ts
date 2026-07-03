// Enrichment: epistemic trajectory for the retracted breast-lesion ultrasound
// viscosity imaging study (claim 45ec4ee5-...).
//
// Arc added: RECORDED -> REVERSED (formal retraction, 2025-08-04).
// The paper (openalex_v1) was published 2025 and then formally retracted for
// "unintentional plagiarism and overlapping content." The retraction was
// approved by the Guest Editors and the Publisher on 2025-07-24 and the article
// was formally retracted on 2025-08-04 (corpus sibling claim 3ea10af6 is the
// verbatim retraction notice for this paper).
//
// The existing first status-history entry (null -> RECORDED) is NOT duplicated.
// No new Claim is created; we only add a status-history transition + its Source.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ultrasound-viscosity-breast-retraction.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ultrasound-viscosity-breast-retraction.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = '45ec4ee5-fad6-4f52-9aae-d246e1bf05e0'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
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
    toAxis: 'REVERSED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2025-08-04',
    datePrecision: 'DAY',
    reason:
      'The paper was formally retracted from publication due to unintentional plagiarism and overlapping content. The retraction was approved by the Guest Editors and the Publisher on 24 July 2025, and following publication of the Retraction Notice the article was formally retracted on 4 August 2025. The withdrawal removes the study\'s findings on ultrasound viscosity imaging for differentiating malignant from benign breast lesions from the standing scientific record.',
    source: {
      externalId: 'src:openalex-viscosity-breast-retraction-2025-08-04',
      name: 'Retraction Notice — ultrasound viscosity imaging for preoperative differential diagnosis of breast lesions (retracted for unintentional plagiarism and overlapping content; retracted 4 August 2025).',
      // Real, resolvable OpenAlex work-locator endpoint (retracted-works title
      // filter). Used in lieu of a DOI, which could not be resolved offline;
      // per project rules no identifier is fabricated.
      url: 'https://api.openalex.org/works?filter=title.search:ultrasound%20viscosity%20imaging%20breast%20lesions,is_retracted:true',
      publishedAt: '2025-08-04',
      methodologyType: 'primary',
    },
  },
]

function slugFor(claimId: string, tr: Transition): string {
  return `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
}

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — refusing to create a new Claim.`)
  }

  for (const tr of TRANSITIONS) {
    const histId = slugFor(CLAIM_ID, tr)

    if (DRY_RUN) {
      console.log(`  [dry] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}  (id=${histId})`)
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

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId: CLAIM_ID, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'AGAINST' } })
    }

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}  (id=${histId})`)
  }

  // Reflect the retraction on the claim's current axis.
  if (!DRY_RUN) {
    await prisma.claim.update({ where: { id: CLAIM_ID }, data: { epistemicAxis: 'REVERSED' } })
  }

  console.log('\nDone.')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
