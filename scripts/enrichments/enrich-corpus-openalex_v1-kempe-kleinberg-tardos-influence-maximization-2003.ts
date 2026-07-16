// Enrichment: post-publication epistemic trajectory for
// Kempe, Kleinberg & Tardos, "Maximizing the Spread of Influence through a
// Social Network" (Proc. 9th ACM SIGKDD, 2003, pp. 137–146).
//
// Claim:    cmq2w4wse00k9sa8hcd57ni2d
// DOI:      10.1145/956750.956769
// OpenAlex: W2061820396
//
// The baseline row (fromAxis=null -> RECORDED at 2003-08-24) already exists; do
// NOT duplicate it. This script adds one verified downstream transition.
//
// This is a theoretical / algorithmic result (the greedy (1 - 1/e) approximation
// for influence maximization under submodular diffusion models). It is not an
// empirical finding, so the retraction / failed-replication / meta-analysis axes
// do not apply. The adjudicating post-publication event is a field-consensus
// recognition: the paper's approach became the canonical foundation of the
// influence-maximization literature.
//
// Events considered but excluded:
//   - Thousands of citations and many follow-up algorithms (Borgs et al. 2014;
//     Tang, Xiao & Shi 2014 on near-linear-time RIS/IMM) EXTEND the result; they
//     do not contest it, so no CONTESTED transition is warranted. Citation volume
//     alone is not modeled as settling.
//
// Arc:
//   RECORDED -> SETTLED (2014, INSTITUTIONAL)
//     ACM SIGKDD awarded this paper the 2014 SIGKDD Test of Time Award (the third
//     such award), which recognizes a KDD paper that "has had an important impact
//     on the data mining research community." The award formally ratifies that the
//     paper's influence-maximization framework became durable, foundational
//     consensus in the field.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-kempe-kleinberg-tardos-influence-maximization-2003.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-kempe-kleinberg-tardos-influence-maximization-2003.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w4wse00k9sa8hcd57ni2d'

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
    community: 'INSTITUTIONAL',
    occurredAt: '2014-08-24',
    datePrecision: 'YEAR',
    reason:
      'ACM SIGKDD awarded "Maximizing the Spread of Influence through a Social Network" the 2014 SIGKDD Test of Time Award — the third such award — presented at KDD 2014. The Test of Time Award recognizes a KDD paper that has had a lasting, important impact on the data-mining research community. The award formally ratifies that the paper\'s greedy submodular influence-maximization framework became the durable, foundational basis of the influence-maximization literature, settling its standing as canonical rather than provisional.',
    source: {
      externalId: 'src:sigkdd-test-of-time-award-2014-influence-maximization',
      name: '2014 SIGKDD Test of Time Award — awarded to "Maximizing the Spread of Influence through a Social Network" (Kempe, Kleinberg, Tardos, KDD \'03). ACM SIGKDD official award announcement.',
      url: 'https://web.archive.org/web/20160803071103/http://www.kdd.org/awards/view/2014-sikdd-test-of-time-award-winners',
      publishedAt: '2014-08-24',
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

    console.log(`  ✓ ${slug}  ${tr.fromAxis} -> ${tr.toAxis} (${tr.community})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
