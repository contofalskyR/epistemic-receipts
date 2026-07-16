// Enrichment: post-publication epistemic trajectory for Ridker et al. 1997,
// "Inflammation, Aspirin, and the Risk of Cardiovascular Disease in Apparently
// Healthy Men" (New England Journal of Medicine).
//
// Claim: cmplybrjb03prsaihakydrkbo
// DOI:   10.1056/nejm199704033361401  (PubMed 9077376 confirms identity)
// OpenAlex: W2316376271
//
// The baseline row (fromAxis=null -> RECORDED at 1997-04-03) already exists; do
// NOT duplicate it. This script adds the one verified downstream transition.
//
// Arc:
//   RECORDED -> SETTLED (2003-01-28, INSTITUTIONAL)
//     The paper's central finding — that baseline plasma C-reactive protein
//     predicts a healthy person's risk of future myocardial infarction and
//     stroke — was formally ratified by the joint AHA/CDC scientific statement
//     "Markers of Inflammation and Cardiovascular Disease" (Pearson et al.,
//     Circulation 2003;107(3):499-511, DOI 10.1161/01.CIR.0000052939.59093.45).
//     That statement designated hsCRP the inflammatory marker of choice and
//     endorsed its optional use as an adjunct to traditional risk factors in
//     global cardiovascular risk assessment, moving the predictive claim from a
//     single cohort finding to institutional clinical-practice consensus.
//
// Note on the causal debate: subsequent Mendelian-randomization work (2008-2011)
// argued CRP is a marker, not a cause, of atherothrombosis. That contested the
// causal interpretation, not this paper's predictive claim, which the 2003
// statement and later meta-analyses (ERFC 2010) sustained — so no CONTESTED node
// is added here.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ridker-1997-crp-inflammation-aspirin-cvd.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ridker-1997-crp-inflammation-aspirin-cvd.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplybrjb03prsaihakydrkbo'

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
    occurredAt: '2003-01-28',
    datePrecision: 'DAY',
    reason:
      'The paper\'s headline finding — baseline plasma C-reactive protein predicts a healthy person\'s risk of future myocardial infarction and stroke — was ratified by the joint AHA/CDC scientific statement "Markers of Inflammation and Cardiovascular Disease" (Pearson et al., Circulation 2003;107(3):499-511). The statement designated hsCRP the inflammatory marker of choice and endorsed its optional use as an adjunct to traditional risk factors in global cardiovascular risk assessment, converting a single cohort observation into institutional clinical-practice consensus.',
    source: {
      externalId: 'src:pearson-aha-cdc-inflammation-cvd-2003',
      name: 'Pearson TA, Mensah GA, Alexander RW, et al. Markers of Inflammation and Cardiovascular Disease: Application to Clinical and Public Health Practice: A Statement for Healthcare Professionals From the Centers for Disease Control and Prevention and the American Heart Association. Circulation. 2003;107(3):499-511. DOI 10.1161/01.CIR.0000052939.59093.45.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/12551878/',
      publishedAt: '2003-01-28',
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
