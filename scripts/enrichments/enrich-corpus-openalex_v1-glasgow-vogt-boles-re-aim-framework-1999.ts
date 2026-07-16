// Enrichment: post-publication epistemic trajectory for
// Glasgow, Vogt & Boles, "Evaluating the public health impact of health
// promotion interventions: the RE-AIM framework."
// Am J Public Health. 1999 Sep;89(9):1322–1327.
//
// Claim:    cmplyom8i00mbsaqkqb8uiks2
// DOI:      10.2105/ajph.89.9.1322
// OpenAlex: W2120079020
//
// The baseline row (fromAxis=null -> RECORDED at 1999-09-01) already exists; do
// NOT duplicate it. This script adds one verified downstream transition.
//
// This is a methodological / evaluation-framework paper (the RE-AIM model:
// Reach, Efficacy/Effectiveness, Adoption, Implementation, Maintenance). It is
// not an empirical finding, so the retraction / failed-replication axes do not
// apply. The adjudicating post-publication event is a field-consensus signal:
// a formal systematic review documenting that the framework became a durable,
// widely-adopted standard in public-health evaluation and dissemination/
// implementation science.
//
// Events considered but excluded:
//   - Thousands of citations and many applied uses EXTEND the framework; citation
//     volume alone is not modeled as settling.
//   - Glasgow et al. 2019 "RE-AIM ... 20-Year Review" (Frontiers in Public Health,
//     doi:10.3389/fpubh.2019.00064) is a further consolidation but is authored by
//     the framework's originators; the independent AJPH systematic review below is
//     the stronger adjudication and is used instead.
//
// Arc:
//   RECORDED -> SETTLED (2013-06, EXPERT_LITERATURE)
//     Gaglio, Shoup & Glasgow, "The RE-AIM framework: a systematic review of use
//     over time, 1999-2010" (Am J Public Health 2013;103(6):e38-46). A systematic
//     review adjudicating the framework's uptake, establishing that RE-AIM had
//     become an established, durably applied evaluation framework across the
//     public-health literature — settling its standing as a field standard.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-glasgow-vogt-boles-re-aim-framework-1999.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-glasgow-vogt-boles-re-aim-framework-1999.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplyom8i00mbsaqkqb8uiks2'

interface Transition {
  fromAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED'
  toAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED'
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2013-06-01',
    datePrecision: 'MONTH',
    reason:
      'Gaglio, Shoup & Glasgow published "The RE-AIM framework: a systematic review of use over time, 1999-2010" (Am J Public Health 2013;103(6):e38-e46). This systematic review adjudicated the framework\'s adoption, documenting sustained and growing use of RE-AIM across the public-health evaluation and dissemination/implementation literature. It ratifies that the model proposed in the 1999 commentary became an established, durably applied field standard rather than a provisional proposal, settling its standing.',
    source: {
      externalId: 'src:pubmed-23597377-re-aim-systematic-review-2013',
      name: 'Gaglio B, Shoup JA, Glasgow RE. "The RE-AIM framework: a systematic review of use over time, 1999-2010." Am J Public Health. 2013 Jun;103(6):e38-e46. PMID 23597377.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/23597377/',
      publishedAt: '2013-06-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry] ${slug}  ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.community})`)
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
        ingestedBy: 'enrich-corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
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
        reason: tr.reason,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        reason: tr.reason,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${slug}  ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.community})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
