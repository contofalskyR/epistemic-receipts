// Enrichment: post-publication epistemic trajectory for Tolman's cognitive maps
// (Tolman EC. "Cognitive maps in rats and men." Psychological Review 1948;55(4):189–208,
// DOI 10.1037/h0061626, OpenAlex W2000214310).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 1948-01-01 publication date) already exists — do NOT duplicate it.
//
// Post-publication event (verified via Nobel Foundation / PubMed):
//   No retraction, expression of concern, or failed replication exists. Tolman's
//   "cognitive map" — an internal, map-like spatial representation, controversial
//   in the stimulus-response behaviorist era — was decisively vindicated by
//   neuroscience: O'Keefe & Dostrovsky's 1971 discovery of hippocampal place cells
//   (Brain Research 1971;34(1):171–175, DOI 10.1016/0006-8993(71)90358-1,
//   PMID 5124915) gave the cognitive map a neural substrate, and the Mosers' 2005
//   discovery of grid cells completed the mechanism. The 2014 Nobel Prize in
//   Physiology or Medicine (John O'Keefe, May-Britt Moser, Edvard I. Moser)
//   "for their discoveries of cells that constitute a positioning system in the
//   brain" — whose official press release explicitly credits the brain's
//   "cognitive map" — is the institutional field-consensus adjudication of the
//   finding. There was no prior contest with a specific dated challenge, so this
//   is a direct RECORDED -> SETTLED at the prize announcement. Community: INSTITUTIONAL.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-tolman-cognitive-maps-rats-men-1948.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-tolman-cognitive-maps-rats-men-1948.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxlid700fvsa7f73hpwtoj'

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
    occurredAt: '2014-10-06',
    datePrecision: 'DAY',
    reason:
      "Tolman's 1948 proposal that rats (and men) build an internal, map-like spatial representation — the 'cognitive map' — was a controversial mentalistic construct in a stimulus-response behaviorist era, but it was vindicated by neuroscience: O'Keefe & Dostrovsky's 1971 discovery of hippocampal place cells (PMID 5124915) supplied its neural substrate and the Mosers' grid cells completed the mechanism. On 6 October 2014 the Nobel Assembly awarded the Nobel Prize in Physiology or Medicine to John O'Keefe, May-Britt Moser and Edvard Moser 'for their discoveries of cells that constitute a positioning system in the brain,' with the official press release explicitly crediting the brain's 'cognitive map.' This institutional consensus endorses rather than refutes the finding, so with no prior contest the claim moves directly RECORDED -> SETTLED.",
    edgeType: 'FOR',
    source: {
      externalId: 'src:nobel-medicine-2014-positioning-system',
      name: "The Nobel Prize in Physiology or Medicine 2014 — John O'Keefe, May-Britt Moser and Edvard I. Moser, 'for their discoveries of cells that constitute a positioning system in the brain.' Nobel Assembly at Karolinska Institutet, press release, 6 October 2014.",
      url: 'https://www.nobelprize.org/prizes/medicine/2014/press-release/',
      publishedAt: '2014-10-06',
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
