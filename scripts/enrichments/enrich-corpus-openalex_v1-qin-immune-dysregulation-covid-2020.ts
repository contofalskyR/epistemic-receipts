// Epistemic-receipt enrichment for OpenAlex claim W3009859788
// Qin C, et al. "Dysregulation of Immune Response in Patients With Coronavirus
// 2019 (COVID-19) in Wuhan, China." Clinical Infectious Diseases, 2020.
// DOI: 10.1093/cid/ciaa248 · Claim id: cmpm0udcu0nr1sat00jw7oj0w
//
// The baseline row (fromAxis=null -> RECORDED at publication, 2020-03-06) already
// exists and is NOT duplicated here.
//
// Post-publication arc added:
//   RECORDED -> SETTLED (2020-05-24, EXPERT_LITERATURE)
//     The paper's central empirical finding — that peripheral lymphopenia and
//     T-cell (CD4+/CD8+) depletion distinguish severe from non-severe COVID-19 —
//     was adjudicated by a dedicated systematic review and meta-analysis
//     (Huang & Pranata, Journal of Intensive Care), which pooled multiple cohorts
//     and confirmed lymphopenia as a marker of severe disease. No contest phase
//     preceded this: the descriptive finding was corroborated, not challenged, so
//     the transition is RECORDED -> SETTLED directly.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-qin-immune-dysregulation-covid-2020.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm0udcu0nr1sat00jw7oj0w'

async function main() {
  // ── RECORDED -> SETTLED: lymphopenia meta-analysis adjudicates the finding ──
  const occurredAt = new Date('2020-05-24')
  const toAxis = 'SETTLED'
  const slug = `${CLAIM_ID}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`

  const source = await prisma.source.upsert({
    where: { externalId: 'src:huang-pranata-lymphopenia-covid-metaanalysis-2020' },
    create: {
      externalId: 'src:huang-pranata-lymphopenia-covid-metaanalysis-2020',
      name: 'Huang I, Pranata R. Lymphopenia in severe coronavirus disease-2019 (COVID-19): systematic review and meta-analysis. Journal of Intensive Care. 2020;8:36.',
      url: 'https://doi.org/10.1186/s40560-020-00453-4',
      publishedAt: occurredAt,
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Huang I, Pranata R. Lymphopenia in severe coronavirus disease-2019 (COVID-19): systematic review and meta-analysis. Journal of Intensive Care. 2020;8:36.',
      url: 'https://doi.org/10.1186/s40560-020-00453-4',
      publishedAt: occurredAt,
      methodologyType: 'derivative',
    },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis,
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'A dedicated systematic review and meta-analysis (Huang & Pranata, Journal of Intensive Care, 24 May 2020) pooled multiple cohorts and confirmed the paper\'s central finding: lymphopenia and T-cell depletion mark severe COVID-19, with severe/critical patients showing significantly lower lymphocyte counts than non-severe patients. The descriptive finding was corroborated rather than contested, settling it as an expert-literature consensus.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis,
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      sourceId: source.id,
    },
  })

  console.log(`Upserted transition ${slug} (source ${source.id})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
