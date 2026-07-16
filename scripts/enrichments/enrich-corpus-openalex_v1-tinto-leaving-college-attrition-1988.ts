// Enrichment: post-publication epistemic trajectory for Vincent Tinto's synthesis
// of student attrition / retention theory ("Leaving College: Rethinking the Causes
// and Cures of Student Attrition", reviewed/recorded via JSTOR DOI 10.2307/1982243,
// OpenAlex W1972677302, claim emerged 1988-11-01).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 1988-11-01 publication date) already exists — do NOT duplicate it.
//
// Post-publication event (verified via ERIC):
//   No retraction, expression of concern, or failed replication exists. Tinto's
//   Interactionalist Theory of College Student Departure — the framework this text
//   synthesizes, holding that academic and social integration drive retention —
//   was subjected to systematic empirical appraisal. Braxton, Sullivan & Johnson
//   (1997, "Appraising Tinto's Theory of College Student Departure," Higher
//   Education: Handbook of Theory and Research, vol. XII) found that of the theory's
//   13 primary propositions, robust empirical tests supported only 5, and that the
//   model's applicability was limited largely to large, public, four-year, residential
//   institutions. Building directly on that appraisal, Braxton, Milem & Sullivan
//   (2000), "The Influence of Active Learning on the College Student Departure
//   Process: Toward a Revision of Tinto's Theory" (Journal of Higher Education
//   71(5):569-590, Sep-Oct 2000, DOI 10.1080/00221546.2000.11778853), explicitly set
//   out to REVISE the theory in light of its partial empirical support. This is a
//   specific, dated methodological/empirical contest of the recorded finding, so the
//   claim moves RECORDED -> CONTESTED. No subsequent meta-analysis has adjudicated
//   the theory as settled or reversed — it remains under active revision — so CONTESTED
//   is the terminal state. Community: EXPERT_LITERATURE.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-tinto-leaving-college-attrition-1988.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-tinto-leaving-college-attrition-1988.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm0orxl0grdsa866tzh23f0'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2000-09-01',
    datePrecision: 'MONTH',
    reason:
      "Tinto's Interactionalist Theory of College Student Departure — the framework this text synthesizes — was systematically appraised by Braxton, Sullivan & Johnson (1997), who found that only 5 of the theory's 13 primary propositions received robust empirical support and that its applicability was largely confined to large, public, four-year residential institutions. Building explicitly on that appraisal, Braxton, Milem & Sullivan (2000), 'The Influence of Active Learning on the College Student Departure Process: Toward a Revision of Tinto's Theory' (Journal of Higher Education 71(5):569-590, DOI 10.1080/00221546.2000.11778853), set out to revise the theory in light of its partial empirical support. This dated, citable methodological contest moves the recorded finding RECORDED -> CONTESTED; no later meta-analysis has settled or reversed it.",
    edgeType: 'AGAINST',
    source: {
      externalId: 'src:braxton-milem-sullivan-2000-revision-tinto',
      name: "Braxton JM, Milem JF, Sullivan AS. 'The Influence of Active Learning on the College Student Departure Process: Toward a Revision of Tinto's Theory.' Journal of Higher Education 2000;71(5):569-590 (Sep-Oct 2000), DOI 10.1080/00221546.2000.11778853. Extends Braxton, Sullivan & Johnson (1997)'s appraisal finding only 5 of Tinto's 13 propositions robustly supported.",
      url: 'https://eric.ed.gov/?id=EJ615015',
      publishedAt: '2000-09-01',
      methodologyType: 'primary',
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
