// Enrichment: epistemic trajectory for Zou & Hastie 2005 elastic net paper.
//
// Claim: cmq2w44md0033sa8hrwgiv20f
// "Regularization and Variable Selection via the Elastic Net"
// Zou H, Hastie T. J R Stat Soc Series B Stat Methodol. 2005;67(2):301-320.
// DOI 10.1111/j.1467-9868.2005.00503.x · OpenAlex W2122825543
//
// Identity confirmed via Crossref (title/authors/container/date match).
// No retraction, erratum, or expression of concern exists (Crossref
// update-to / updated-by both null).
//
// Post-publication event: this is a statistical-methods contribution, so the
// relevant adjudication is field consensus, not replication or meta-analysis.
// The elastic net penalty was operationalized for generalized linear models
// and cemented as canonical methodology by the glmnet coordinate-descent
// solver (Friedman, Hastie & Tibshirani, J Stat Softw 2010), which became the
// field-standard implementation across R and (later) scikit-learn. That paper
// is a specific, dated, highly-cited document marking the elastic net's
// establishment as standard practice in expert literature.
//
// Arc: RECORDED (2005-04) --> SETTLED (2010, EXPERT_LITERATURE)
// The baseline RECORDED row (fromAxis=null) already exists; do NOT duplicate it.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-zou-hastie-2005-elastic-net.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w44md0033sa8hrwgiv20f'

async function main() {
  // ── SETTLED: elastic net established as standard methodology via glmnet ──
  await prisma.source.upsert({
    where: { externalId: 'src:friedman-2010-glmnet-jss' },
    create: {
      externalId: 'src:friedman-2010-glmnet-jss',
      name: 'Friedman J, Hastie T, Tibshirani R. Regularization Paths for Generalized Linear Models via Coordinate Descent. J Stat Softw. 2010;33(1):1-22.',
      url: 'https://doi.org/10.18637/jss.v033.i01',
      publishedAt: new Date('2010-01-01'),
      methodologyType: 'primary',
    },
    update: {
      name: 'Friedman J, Hastie T, Tibshirani R. Regularization Paths for Generalized Linear Models via Coordinate Descent. J Stat Softw. 2010;33(1):1-22.',
      url: 'https://doi.org/10.18637/jss.v033.i01',
      publishedAt: new Date('2010-01-01'),
      methodologyType: 'primary',
    },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${CLAIM_ID}-SETTLED-2010-01-01` },
    create: {
      id: `${CLAIM_ID}-SETTLED-2010-01-01`,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2010-01-01'),
      datePrecision: 'YEAR',
      reason:
        'The elastic net penalty was operationalized for generalized linear models and cemented as standard methodology by the glmnet coordinate-descent solver (Friedman, Hastie & Tibshirani, J Stat Softw 2010), which became the field-standard implementation for penalized regression in R and, subsequently, scikit-learn. Its universal adoption settled the elastic net as canonical, textbook regularization practice in the statistics and machine-learning literature. No retraction, erratum, or expression of concern exists for the 2005 paper.',
      source: { connect: { externalId: 'src:friedman-2010-glmnet-jss' } },
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2010-01-01'),
      datePrecision: 'YEAR',
      reason:
        'The elastic net penalty was operationalized for generalized linear models and cemented as standard methodology by the glmnet coordinate-descent solver (Friedman, Hastie & Tibshirani, J Stat Softw 2010), which became the field-standard implementation for penalized regression in R and, subsequently, scikit-learn. Its universal adoption settled the elastic net as canonical, textbook regularization practice in the statistics and machine-learning literature. No retraction, erratum, or expression of concern exists for the 2005 paper.',
      source: { connect: { externalId: 'src:friedman-2010-glmnet-jss' } },
    },
  })

  console.log('Enrichment complete: RECORDED -> SETTLED (2010) for', CLAIM_ID)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
