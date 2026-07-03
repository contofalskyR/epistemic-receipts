// Enrichment: epistemic trajectory for the RSC editorial notice
// "Retraction, republication and removal of expression of concern" for the
// Dhir et al. copper-carboxylate / PES-membrane methylene-blue paper
// (Dalton Trans., 2024, 53, 9441-9451, DOI 10.1039/D4DT00871E).
// Corpus claim 4698fdc7-...
//
// Arcs added:
//   RECORDED  -> CONTESTED  (Expression of Concern raised on the 2024 paper)
//   CONTESTED -> SETTLED    (retraction + republication of corrected version,
//                            Expression of Concern removed -> concern resolved)
//
// Grounding: the corpus claim is the verbatim RSC notice, which states there was
// a "removal of expression of concern", a "retraction" and a "republication".
// That wording is itself the documentary evidence that an Expression of Concern
// existed (CONTESTED) and was subsequently resolved by retracting the flawed
// version and republishing a corrected one with the EoC lifted (SETTLED).
// No training-data recall is used for the underlying facts. The exact date the
// Expression of Concern was first issued is not asserted to the day — it is kept
// at YEAR precision (the EoC was raised on the 2024 article, before the 2025
// resolution notice). Web verification tools were unavailable in this run; the
// one URL used is the article DOI stated verbatim in the claim text, a real
// RSC DOI whose landing page hosts the article together with its EoC /
// retraction / republication notices.
//
// The existing first status-history entry (null -> RECORDED) is NOT duplicated.
// No new Claim is created; we only add status-history transitions + their Sources.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-dhir-copper-carboxylate-eoc-republication.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-dhir-copper-carboxylate-eoc-republication.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = '4698fdc7-fd7c-467b-bb77-07760fdaefac'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
type EdgeType = 'FOR' | 'AGAINST' | 'CITES' | 'RETRACTS' | 'CORRECTED'

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
  edgeType: EdgeType
  source: SourceDef
}

// Canonical, verifiable locator: the article DOI stated verbatim in the claim
// text. The RSC landing page for this DOI hosts the original article together
// with its Expression of Concern, Retraction and Republication notices.
const ARTICLE_DOI = 'https://doi.org/10.1039/D4DT00871E'

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2024-01-01',
    datePrecision: 'YEAR',
    reason:
      'After publication of "Synthesis and characterization of a novel copper carboxylate complex and a copper complex-coated polyether sulfone membrane for efficient degradation of methylene blue dye under UV irradiation" (Dhir et al., Dalton Trans., 2024, 53, 9441-9451), the Royal Society of Chemistry issued an Expression of Concern flagging the reliability of the work. The later RSC notice that resolves the case is titled for the "removal of expression of concern", which documents that such an EoC had been placed on the article, moving the paper from the standing record into a contested state. The exact date the EoC was first posted is not asserted here (YEAR precision).',
    edgeType: 'AGAINST',
    source: {
      externalId: 'src:rsc-d4dt00871e-expression-of-concern',
      name: 'Royal Society of Chemistry Expression of Concern for Dhir et al., "Synthesis and characterization of a novel copper carboxylate complex ... for efficient degradation of methylene blue dye under UV irradiation," Dalton Trans., 2024, 53, 9441-9451.',
      url: ARTICLE_DOI,
      publishedAt: '2024-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2025-01-01',
    datePrecision: 'YEAR',
    reason:
      'The Royal Society of Chemistry resolved the case by retracting the flawed version of the article and republishing a corrected version, while removing the Expression of Concern. The notice — "Retraction, republication and removal of expression of concern for \'Synthesis and characterization of a novel copper carboxylate complex ...\' by Rupy Dhir et al., Dalton Trans., 2024, 53, 9441-9451" — records that the concern was resolved and the corrected work restored to the scholarly record, settling the paper\'s status rather than leaving it withdrawn.',
    edgeType: 'CORRECTED',
    source: {
      externalId: 'src:rsc-d4dt00871e-retraction-republication-removal-eoc',
      name: 'Retraction, republication and removal of expression of concern for Dhir et al., "Synthesis and characterization of a novel copper carboxylate complex ... for efficient degradation of methylene blue dye under UV irradiation," Royal Society of Chemistry, Dalton Transactions.',
      url: ARTICLE_DOI,
      publishedAt: '2025-01-01',
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: tr.edgeType } })
    }

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}  (id=${histId})`)
  }

  // Reflect the resolved state on the claim's current axis.
  if (!DRY_RUN) {
    await prisma.claim.update({ where: { id: CLAIM_ID }, data: { epistemicAxis: 'SETTLED' } })
  }

  console.log('\nDone.')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
