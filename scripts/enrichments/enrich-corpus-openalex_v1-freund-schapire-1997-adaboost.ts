// Enrichment: epistemic trajectory for Freund & Schapire 1997 AdaBoost paper.
//
// Claim: cmq2w4570003fsa8hueunyq30
// "A Decision-Theoretic Generalization of On-Line Learning and an Application
//  to Boosting" — Freund Y, Schapire RE. J Comput Syst Sci. 1997;55(1):119-139.
// DOI 10.1006/jcss.1997.1504 · OpenAlex W1988790447
//
// Identity confirmed via Crossref: title, authors (Freund, Schapire), container
// (Journal of Computer and System Sciences), published 1997-08 all match. No
// retraction, erratum, or expression of concern exists (Crossref update-to /
// updated-by both null).
//
// Post-publication event: this is a theoretical-CS methods contribution (the
// AdaBoost algorithm), so the adjudicating event is formal field recognition,
// not replication or meta-analysis. In 2003 the Gödel Prize — awarded jointly by
// the European Association for Theoretical Computer Science (EATCS) and ACM
// SIGACT for outstanding papers in theoretical computer science — was awarded to
// Yoav Freund and Robert Schapire specifically "for the AdaBoost algorithm,"
// citing this exact 1997 paper. That prize is a dated, citable institutional
// consensus marker settling the finding's foundational status.
//
// Arc: RECORDED (1997-08) --> SETTLED (2003, INSTITUTIONAL)
// The baseline RECORDED row (fromAxis=null) already exists; do NOT duplicate it.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-freund-schapire-1997-adaboost.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w4570003fsa8hueunyq30'

async function main() {
  // ── SETTLED: 2003 Gödel Prize awarded to Freund & Schapire for AdaBoost ──
  await prisma.source.upsert({
    where: { externalId: 'src:godel-prize-2003-adaboost' },
    create: {
      externalId: 'src:godel-prize-2003-adaboost',
      name: 'Gödel Prize 2003 (EATCS / ACM SIGACT), awarded to Yoav Freund and Robert Schapire for the AdaBoost algorithm — "A decision-theoretic generalization of on-line learning and an application to boosting" (1997).',
      url: 'https://en.wikipedia.org/wiki/G%C3%B6del_Prize',
      publishedAt: new Date('2003-01-01'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Gödel Prize 2003 (EATCS / ACM SIGACT), awarded to Yoav Freund and Robert Schapire for the AdaBoost algorithm — "A decision-theoretic generalization of on-line learning and an application to boosting" (1997).',
      url: 'https://en.wikipedia.org/wiki/G%C3%B6del_Prize',
      publishedAt: new Date('2003-01-01'),
      methodologyType: 'derivative',
    },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${CLAIM_ID}-SETTLED-2003-01-01` },
    create: {
      id: `${CLAIM_ID}-SETTLED-2003-01-01`,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2003-01-01'),
      datePrecision: 'YEAR',
      reason:
        'In 2003 the Gödel Prize — awarded jointly by EATCS and ACM SIGACT for outstanding papers in theoretical computer science — was given to Yoav Freund and Robert Schapire specifically for the AdaBoost algorithm introduced in this 1997 paper. The award is a dated, formal institutional recognition that settles the finding\'s foundational status in the field. No retraction, erratum, or expression of concern exists for the paper (Crossref update-to/updated-by both null).',
      source: { connect: { externalId: 'src:godel-prize-2003-adaboost' } },
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2003-01-01'),
      datePrecision: 'YEAR',
      reason:
        'In 2003 the Gödel Prize — awarded jointly by EATCS and ACM SIGACT for outstanding papers in theoretical computer science — was given to Yoav Freund and Robert Schapire specifically for the AdaBoost algorithm introduced in this 1997 paper. The award is a dated, formal institutional recognition that settles the finding\'s foundational status in the field. No retraction, erratum, or expression of concern exists for the paper (Crossref update-to/updated-by both null).',
      source: { connect: { externalId: 'src:godel-prize-2003-adaboost' } },
    },
  })

  console.log('Enrichment complete: RECORDED -> SETTLED (2003) for', CLAIM_ID)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
