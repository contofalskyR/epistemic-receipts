// Enrichment: post-publication epistemic arc for Bandura's self-efficacy paper.
//
// Claim: cmplxo4is01p7sa7f7jxnx8bo (openalex_v1, W2134049139)
//   "Self-efficacy: Toward a unifying theory of behavioral change" — Albert Bandura,
//   Psychological Review, 1977. DOI 10.1037/0033-295x.84.2.191.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 1977-01-01) already
// exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15 via Crossref):
//   - No retraction and no expression of concern (Crossref update-to/updated-by: none).
//   - RECORDED -> CONTESTED: Eastman & Marzillier (Cognitive Therapy and Research 1984;8:213-229,
//     DOI 10.1007/BF01172994) mounted a specific, dated theoretical + methodological critique,
//     arguing the efficacy-expectation construct is not cleanly separable from outcome
//     expectations and that the assessment methodology is ambiguous. This triggered a published
//     exchange (Bandura's "Recycling misconceptions..." reply and Marzillier & Eastman's rejoinder),
//     i.e. a genuine contest in the expert literature.
//   - CONTESTED -> SETTLED: Stajkovic & Luthans (Psychological Bulletin 1998;124:240-261,
//     DOI 10.1037/0033-2909.124.2.240) meta-analyzed 114 studies (N=21,616) and found a strong,
//     significant self-efficacy/work-performance relationship (weighted G(r)=.38), directly
//     vindicating the paper's core hypothesis that efficacy expectations govern effort and
//     performance. Published in the field's premier review outlet, the expert literature
//     adjudicated the construct's predictive validity in the theory's favor.
//
// Idempotent: upserts source on externalId and each status row on its deterministic slug id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bandura-1977-self-efficacy.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxo4is01p7sa7f7jxnx8bo'

async function main() {
  // ── RECORDED -> CONTESTED: Eastman & Marzillier methodological critique (1984) ──
  const critiqueSource = await prisma.source.upsert({
    where: { externalId: 'src:eastman-marzillier-1984-self-efficacy-critique' },
    create: {
      externalId: 'src:eastman-marzillier-1984-self-efficacy-critique',
      name: 'Eastman C, Marzillier JS. Theoretical and methodological difficulties in Bandura\'s self-efficacy theory. Cognitive Therapy and Research 1984;8(3):213-229. DOI 10.1007/BF01172994.',
      url: 'https://doi.org/10.1007/BF01172994',
      publishedAt: new Date('1984-06-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Eastman C, Marzillier JS. Theoretical and methodological difficulties in Bandura\'s self-efficacy theory. Cognitive Therapy and Research 1984;8(3):213-229. DOI 10.1007/BF01172994.',
      url: 'https://doi.org/10.1007/BF01172994',
      publishedAt: new Date('1984-06-01'),
      methodologyType: 'derivative',
    },
  })

  const contestedSlug = `${CLAIM_ID}-CONTESTED-1984-06-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedSlug },
    create: {
      id: contestedSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1984-06-01'),
      datePrecision: 'MONTH',
      sourceId: critiqueSource.id,
      reason:
        'Eastman & Marzillier (Cognitive Therapy and Research 1984;8:213-229) published a specific theoretical and methodological critique arguing that the efficacy-expectation construct is not cleanly differentiated from outcome expectations and that self-efficacy assessment is ambiguous. It opened a published exchange (Bandura\'s reply "Recycling misconceptions of perceived self-efficacy" and the authors\' rejoinder), placing the finding in active expert dispute: RECORDED -> CONTESTED.',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1984-06-01'),
      datePrecision: 'MONTH',
      sourceId: critiqueSource.id,
    },
  })

  // ── CONTESTED -> SETTLED: Stajkovic & Luthans meta-analysis vindicates the construct (1998) ──
  const metaSource = await prisma.source.upsert({
    where: { externalId: 'src:stajkovic-luthans-1998-self-efficacy-meta-analysis' },
    create: {
      externalId: 'src:stajkovic-luthans-1998-self-efficacy-meta-analysis',
      name: 'Stajkovic AD, Luthans F. Self-efficacy and work-related performance: A meta-analysis. Psychological Bulletin 1998;124(2):240-261. DOI 10.1037/0033-2909.124.2.240.',
      url: 'https://doi.org/10.1037/0033-2909.124.2.240',
      publishedAt: new Date('1998-09-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Stajkovic AD, Luthans F. Self-efficacy and work-related performance: A meta-analysis. Psychological Bulletin 1998;124(2):240-261. DOI 10.1037/0033-2909.124.2.240.',
      url: 'https://doi.org/10.1037/0033-2909.124.2.240',
      publishedAt: new Date('1998-09-01'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-1998-09-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1998-09-01'),
      datePrecision: 'MONTH',
      sourceId: metaSource.id,
      reason:
        'Stajkovic & Luthans (Psychological Bulletin 1998;124:240-261) meta-analyzed 114 studies (N=21,616) and found a strong, significant relationship between self-efficacy and work performance (weighted average G(r)=.38), directly supporting the paper\'s core hypothesis that efficacy expectations govern effort and performance. Published in the field\'s premier review journal, this adjudicated the construct\'s predictive validity in the theory\'s favor: CONTESTED -> SETTLED.',
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1998-09-01'),
      datePrecision: 'MONTH',
      sourceId: metaSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED @ 1984-06, CONTESTED -> SETTLED @ 1998-09)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
