// Epistemic-receipt enrichment: Penn State Worry Questionnaire (Meyer, Miller,
// Metzger & Borkovec, 1990), Behaviour Research and Therapy.
// DOI: 10.1016/0005-7967(90)90135-6 | OpenAlex: W2001866454
//
// Baseline row (fromAxis=null -> RECORDED @ 1990-01-01) already exists — NOT duplicated.
//
// Post-publication arc discovered:
//   RECORDED -> CONTESTED @ 2003-12 — Brown TA, "Confirmatory factor analysis of
//   the Penn State Worry Questionnaire: Multiple factors or method effects?"
//   (Behaviour Research and Therapy, Dec 2003; DOI 10.1016/S0005-7967(03)00059-7;
//   225+ citations). The original validation treated the PSWQ as an essentially
//   unidimensional measure of trait worry. Brown's CFA showed the apparent
//   two-factor structure is driven by the reverse-worded items, framing a genuine,
//   still-active methodological dispute over the scale's dimensionality and the
//   scoring/interpretation of its reverse-scored items. This contests the
//   original paper's factor-structure claim (no retraction; no failed replication).
//
// No retraction (Crossref update-to = null; Retraction Watch negative), no failed
// replication, and no single adjudicating meta-analysis/guideline surfaced, so this
// script writes exactly one verified transition.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-penn-state-worry-questionnaire-1990.ts
// Idempotent: upserts on externalId / deterministic history id.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm2nbn60sbpsadn59nwrj09'

async function main() {
  // ── RECORDED -> CONTESTED (Brown 2003 CFA) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:pswq-brown-cfa-2003' },
    create: {
      externalId: 'src:pswq-brown-cfa-2003',
      name: 'Brown TA. Confirmatory factor analysis of the Penn State Worry Questionnaire: Multiple factors or method effects? Behaviour Research and Therapy 2003;41(12):1411–1426.',
      url: 'https://doi.org/10.1016/S0005-7967(03)00059-7',
      publishedAt: new Date('2003-12-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-pswq-1990',
    },
    update: {
      name: 'Brown TA. Confirmatory factor analysis of the Penn State Worry Questionnaire: Multiple factors or method effects? Behaviour Research and Therapy 2003;41(12):1411–1426.',
      url: 'https://doi.org/10.1016/S0005-7967(03)00059-7',
      publishedAt: new Date('2003-12-01'),
    },
  })

  const histId = `${CLAIM_ID}-CONTESTED-2003-12-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2003-12-01'),
      datePrecision: 'MONTH',
      reason: 'The 1990 validation established the PSWQ as an essentially unidimensional trait-worry measure. Brown\'s confirmatory factor analysis (Behaviour Research and Therapy, Dec 2003; 225+ citations) showed that the apparent two-factor structure is produced by the reverse-worded items, and argued these represent method effects rather than substantive dimensions. The paper crystallized a genuine, still-active methodological dispute over the PSWQ\'s dimensionality and the treatment of its reverse-scored items, contesting the original factor-structure claim.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2003-12-01'),
      datePrecision: 'MONTH',
      reason: 'The 1990 validation established the PSWQ as an essentially unidimensional trait-worry measure. Brown\'s confirmatory factor analysis (Behaviour Research and Therapy, Dec 2003; 225+ citations) showed that the apparent two-factor structure is produced by the reverse-worded items, and argued these represent method effects rather than substantive dimensions. The paper crystallized a genuine, still-active methodological dispute over the PSWQ\'s dimensionality and the treatment of its reverse-scored items, contesting the original factor-structure claim.',
      sourceId: source.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'AGAINST' } })
  }

  console.log('Enriched PSWQ (1990) with 1 transition: RECORDED -> CONTESTED (2003-12).')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
