// Enrichment: epistemic receipt for Cunningham et al. (2004), "Cetuximab
// Monotherapy and Cetuximab plus Irinotecan in Irinotecan-Refractory Metastatic
// Colorectal Cancer" (the BOND trial). N Engl J Med 2004;351(4):337-345.
// DOI 10.1056/NEJMoa033025. OpenAlex W2142564546.
// Claim id cmply5vl900w3saihbp3yiog8.
//
// Baseline row (fromAxis=null -> RECORDED at the 2004-07-21 publication) already
// exists; this script adds only the post-publication transitions.
//
// Post-publication arc — the KRAS/RAS predictive-biomarker story:
//
// 1. RECORDED -> CONTESTED (EXPERT_LITERATURE, 2008-10-23). Karapetis et al.,
//    "K-ras Mutations and Benefit from Cetuximab in Advanced Colorectal Cancer"
//    (NEJM 2008;359:1757-1765), analyzed the NCIC CTG CO.17 trial and showed that
//    the survival and response benefit from cetuximab is confined to tumors with
//    wild-type KRAS; patients with mutated KRAS derived no benefit. This directly
//    contested the BOND finding as originally stated for an unselected refractory
//    mCRC population — the efficacy claim held only for a molecular subgroup.
//
// 2. CONTESTED -> SETTLED (INSTITUTIONAL, 2009-04-20). The American Society of
//    Clinical Oncology Provisional Clinical Opinion (Allegra et al., J Clin Oncol
//    2009;27(12):2091-2096) recommended KRAS mutation testing for all mCRC
//    patients who are candidates for anti-EGFR antibody therapy and advised
//    against cetuximab/panitumumab in KRAS-mutant tumors. This institutional
//    consensus settled the question: cetuximab (+/- irinotecan) remained a
//    validated, guideline-endorsed therapy for irinotecan-refractory mCRC, now
//    restricted to the KRAS wild-type population.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-cunningham-cetuximab-irinotecan-colorectal.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-cunningham-cetuximab-irinotecan-colorectal.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmply5vl900w3saihbp3yiog8'

interface EnrichTransition {
  fromAxis: string
  toAxis: string
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

const TRANSITIONS: EnrichTransition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2008-10-23',
    datePrecision: 'DAY',
    reason:
      "Karapetis et al. analyzed the NCIC CTG CO.17 trial and showed that the survival and response benefit from cetuximab in advanced colorectal cancer is confined to tumors carrying wild-type KRAS, with no benefit in KRAS-mutant tumors. This contested the BOND finding as stated for an unselected irinotecan-refractory population: cetuximab's efficacy held only for a molecularly defined subgroup, not for metastatic colorectal cancer generally.",
    source: {
      externalId: 'src:karapetis-kras-cetuximab-2008',
      name: 'Karapetis CS, Khambata-Ford S, Jonker DJ, et al. K-ras Mutations and Benefit from Cetuximab in Advanced Colorectal Cancer. N Engl J Med 2008;359(17):1757-1765.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/18946061/',
      publishedAt: '2008-10-23',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2009-04-20',
    datePrecision: 'DAY',
    reason:
      "The American Society of Clinical Oncology Provisional Clinical Opinion (Allegra et al.) recommended KRAS mutation testing for every metastatic colorectal cancer patient who is a candidate for anti-EGFR monoclonal antibody therapy and advised against cetuximab or panitumumab in KRAS-mutant tumors. This institutional consensus settled the finding: cetuximab (with or without irinotecan) remained a validated, guideline-endorsed therapy for irinotecan-refractory metastatic colorectal cancer, now restricted to the KRAS wild-type population.",
    source: {
      externalId: 'src:asco-pco-kras-anti-egfr-2009',
      name: 'Allegra CJ, Jessup JM, Somerfield MR, et al. American Society of Clinical Oncology Provisional Clinical Opinion: Testing for KRAS Gene Mutations in Patients With Metastatic Colorectal Carcinoma to Predict Response to Anti-EGFR Monoclonal Antibody Therapy. J Clin Oncol 2009;27(12):2091-2096.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/19188670/',
      publishedAt: '2009-04-20',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const slug = `${claimId}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`
    if (DRY_RUN) {
      console.log(`[dry-run] would upsert source ${t.source.externalId} and history ${slug}`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-corpus-openalex_v1',
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`Upserted transition ${t.fromAxis} -> ${t.toAxis} (${slug})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
