// Enrichment: post-publication trajectory for Paulhus & Williams (2002),
// "The Dark Triad of personality: Narcissism, Machiavellianism, and psychopathy",
// Journal of Research in Personality 36(6):556-563.
// Claim: cmpm25nvx0k2vsadncytjooge (openalex_v1, W1982777740, DOI 10.1016/s0092-6566(02)00505-6)
//
// Baseline ClaimStatusHistory row (null -> RECORDED at 2002-12-01) already exists.
// This script adds the single verified post-publication adjudication:
//   RECORDED -> CONTESTED (2017-03-27) — Muris, Merckelbach, Otgaar & Meijer,
//   "The Malevolent Side of Human Nature: A Meta-Analysis and Critical Review of the
//   Literature on the Dark Triad", Perspectives on Psychological Science 12(2):183-204.
//   Their meta-analysis found the three traits are strongly intercorrelated (especially
//   Machiavellianism and psychopathy, nearly indistinguishable in self-report) and
//   documented pervasive methodological problems, contesting the core claim that the
//   Dark Triad comprises three empirically distinct traits.
//
// Not retracted (Crossref / PubMed checked 2026-07-16). No expression of concern found.
// Target DOI resolves 200 via Crossref/Elsevier; adjudicating source anchored to PubMed
// (PMID 28346115), verified 200.
//
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-dark-triad-personality.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm25nvx0k2vsadncytjooge'

async function main() {
  // ── RECORDED -> CONTESTED: 2017 meta-analytic critical review challenges the tripartite construct ──
  await prisma.source.upsert({
    where: { externalId: 'src:muris-dark-triad-meta-analysis-2017' },
    create: {
      externalId: 'src:muris-dark-triad-meta-analysis-2017',
      name: 'Muris, Merckelbach, Otgaar & Meijer (2017), "The Malevolent Side of Human Nature: A Meta-Analysis and Critical Review of the Literature on the Dark Triad (Narcissism, Machiavellianism, and Psychopathy)", Perspectives on Psychological Science 12(2):183-204 (PMID 28346115)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/28346115/',
      publishedAt: new Date('2017-03-27'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Muris, Merckelbach, Otgaar & Meijer (2017), "The Malevolent Side of Human Nature: A Meta-Analysis and Critical Review of the Literature on the Dark Triad (Narcissism, Machiavellianism, and Psychopathy)", Perspectives on Psychological Science 12(2):183-204 (PMID 28346115)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/28346115/',
      publishedAt: new Date('2017-03-27'),
      methodologyType: 'derivative',
    },
  })

  const occurredAt = new Date('2017-03-27')
  const slug = `${CLAIM_ID}-CONTESTED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'Paulhus & Williams proposed the Dark Triad as three overlapping but empirically distinct traits (narcissism, Machiavellianism, psychopathy). Muris, Merckelbach, Otgaar & Meijer (Perspect Psychol Sci, 2017) meta-analyzed the literature and found the three traits strongly intercorrelated \u2014 Machiavellianism and psychopathy in particular being nearly indistinguishable in self-report \u2014 and documented pervasive methodological problems (over-reliance on brief self-report measures, weak discriminant validity, confounds with general personality). This is a specific, well-cited critical adjudication contesting the tripartite construct\u2019s distinctiveness.',
      sourceExternalId: 'src:muris-dark-triad-meta-analysis-2017',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'Paulhus & Williams proposed the Dark Triad as three overlapping but empirically distinct traits (narcissism, Machiavellianism, psychopathy). Muris, Merckelbach, Otgaar & Meijer (Perspect Psychol Sci, 2017) meta-analyzed the literature and found the three traits strongly intercorrelated \u2014 Machiavellianism and psychopathy in particular being nearly indistinguishable in self-report \u2014 and documented pervasive methodological problems (over-reliance on brief self-report measures, weak discriminant validity, confounds with general personality). This is a specific, well-cited critical adjudication contesting the tripartite construct\u2019s distinctiveness.',
      sourceExternalId: 'src:muris-dark-triad-meta-analysis-2017',
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> CONTESTED, 2017-03-27)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
