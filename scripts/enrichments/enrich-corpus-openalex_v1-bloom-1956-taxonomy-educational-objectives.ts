// Enrichment: post-publication epistemic arc for Bloom's 1956 Taxonomy of Educational Objectives.
//
// Claim: cmplxlz4400mpsa7f4aw0h63v (openalex_v1, W2573894086)
//   "Taxonomy of Educational Objectives: The Classification of Educational Goals,
//   Handbook I: Cognitive Domain"
//   — Bloom BS (Ed.), Engelhart MD, Furst EJ, Hill WH, Krathwohl DR.
//   New York: David McKay, 1956. No DOI (pre-DOI monograph).
//   OpenAlex W2573894086, ~9,383 citations.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 1956-01-01 publication)
// already exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15 via OpenAlex + Crossref):
//   - Claim identity confirmed against OpenAlex W2573894086 (doi: null) — Bloom's
//     Handbook I: Cognitive Domain, 1956.
//   - No retraction and no expression of concern (a 1956 monograph; not indexed by
//     Retraction Watch; no Crossref crossmark markers on the framework).
//   - The cognitive-domain taxonomy became the canonical, field-settled classification
//     of educational objectives. It was authoritatively adjudicated and updated by the
//     2001 revision — Anderson LW & Krathwohl DR (Eds.), "A Taxonomy for Learning,
//     Teaching, and Assessing: A Revision of Bloom's Taxonomy of Educational Objectives"
//     (New York: Longman, 2001). Krathwohl, a co-author of the original 1956 Handbook,
//     published the overview "A Revision of Bloom's Taxonomy: An Overview," Theory Into
//     Practice 2002;41(4):212-218, DOI 10.1207/s15430421tip4104_2 (~4,596 citations).
//     Its reference list cites both the original 1956 Handbook I and the 2001 revision,
//     confirming it directly adjudicates this finding. The revision refined the framework
//     (nouns->verbs, added a knowledge dimension, reordered the top categories) while
//     preserving and affirming the cognitive taxonomy as settled field consensus.
//     -> RECORDED -> SETTLED at the 2002 overview's publication date. Community
//     EXPERT_LITERATURE.
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bloom-1956-taxonomy-educational-objectives.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxlz4400mpsa7f4aw0h63v'

async function main() {
  // ── RECORDED -> SETTLED: the 2001 revision, overviewed by Krathwohl (2002) ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:krathwohl-2002-revision-bloom-taxonomy-overview' },
    create: {
      externalId: 'src:krathwohl-2002-revision-bloom-taxonomy-overview',
      name: "Krathwohl DR. A Revision of Bloom's Taxonomy: An Overview. Theory Into Practice 2002;41(4):212-218 (overview of Anderson & Krathwohl, eds., A Taxonomy for Learning, Teaching, and Assessing, Longman 2001).",
      url: 'https://doi.org/10.1207/s15430421tip4104_2',
      publishedAt: new Date('2002-11-01'),
      methodologyType: 'derivative',
    },
    update: {
      name: "Krathwohl DR. A Revision of Bloom's Taxonomy: An Overview. Theory Into Practice 2002;41(4):212-218 (overview of Anderson & Krathwohl, eds., A Taxonomy for Learning, Teaching, and Assessing, Longman 2001).",
      url: 'https://doi.org/10.1207/s15430421tip4104_2',
      publishedAt: new Date('2002-11-01'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2002-11-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2002-11-01'),
      datePrecision: 'MONTH',
      sourceId: settleSource.id,
      reason:
        "Bloom's 1956 cognitive-domain taxonomy became the canonical, field-settled classification of educational objectives. It was authoritatively adjudicated and updated by the 2001 revision (Anderson & Krathwohl, eds., 'A Taxonomy for Learning, Teaching, and Assessing', Longman 2001), overviewed by Krathwohl — an original 1956 co-author — in 'A Revision of Bloom's Taxonomy: An Overview' (Theory Into Practice 2002;41(4):212-218, DOI 10.1207/s15430421tip4104_2). The revision refined the framework (nouns->verbs, a two-dimensional knowledge/process structure) while preserving and affirming the cognitive taxonomy as settled consensus. RECORDED -> SETTLED.",
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2002-11-01'),
      datePrecision: 'MONTH',
      sourceId: settleSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED @ 2002-11, Krathwohl 2002 revision overview)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
