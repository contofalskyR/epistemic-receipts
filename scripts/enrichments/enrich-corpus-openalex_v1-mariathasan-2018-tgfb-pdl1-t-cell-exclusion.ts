// Enrichment: post-publication epistemic trajectory for Mariathasan et al. 2018,
// "TGFβ attenuates tumour response to PD-L1 blockade by contributing to
// exclusion of T cells" (Nature 554:544-548).
//
// Claim:    cmplygtdu064fsaihx25luagl
// DOI:      10.1038/nature25501  (PubMed 29443960 confirms identity)
// OpenAlex: W2785803176
//
// The baseline row (fromAxis=null -> RECORDED at 2018-02-01) already exists; do
// NOT duplicate it. This script adds the one verified downstream transition.
//
// Not retracted (Retraction Watch returns no result; publisher page carries no
// expression of concern). The mechanistic finding was widely cited and gave the
// TGFβ-plus-checkpoint combination its rationale.
//
// Arc:
//   RECORDED -> CONTESTED (2023-12, EXPERT_LITERATURE)
//     The claim's central actionable prediction — that neutralizing TGFβ restores
//     tumour response to PD-L1 blockade — was put to its definitive randomized
//     test by bintrafusp alfa, a first-in-class bifunctional fusion protein
//     combining a TGF-βRII "trap" with an anti-PD-L1 antibody (exactly the two
//     activities this paper implicated). In the adaptive phase 3 trial
//     (NCT03631706), bintrafusp alfa failed to beat pembrolizumab in first-line
//     PD-L1-high advanced NSCLC (PFS HR 1.232, 95% CI 0.885-1.714; stopped at
//     interim for futility), and the accompanying editorial framed it as a
//     setback for the strategy. This contested the therapeutic corollary of the
//     claim. It is CONTESTED, not REVERSED: the exclusion mechanism itself was
//     cast into doubt but not overturned, with the molecule's own design and
//     dosing also implicated.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mariathasan-2018-tgfb-pdl1-t-cell-exclusion.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mariathasan-2018-tgfb-pdl1-t-cell-exclusion.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplygtdu064fsaihx25luagl'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2023-12-01',
    datePrecision: 'MONTH',
    reason:
      'The claim\'s central actionable prediction — that neutralizing TGFβ restores tumour response to PD-L1 blockade — was tested directly by bintrafusp alfa, a first-in-class bifunctional protein fusing a TGF-βRII "trap" to an anti-PD-L1 antibody (the two activities this paper implicated). In the adaptive phase 3 trial (NCT03631706, J Thorac Oncol 2023), bintrafusp alfa did not exhibit superior efficacy versus pembrolizumab in first-line PD-L1-high advanced NSCLC (PFS HR 1.232, 95% CI 0.885-1.714) and was stopped at interim analysis for futility, with the accompanying editorial treating it as a setback for the TGFβ-plus-checkpoint strategy. This contested the therapeutic corollary of the finding. It is CONTESTED rather than REVERSED: the T-cell-exclusion mechanism was cast into doubt but not overturned, as the molecule\'s own design and dosing were also implicated in the failure.',
    source: {
      externalId: 'src:bintrafusp-alfa-phase3-nsclc-2023',
      name: 'Barlesi F, Isambert N, Felip E, et al. Bintrafusp Alfa Versus Pembrolizumab in Patients With Treatment-Naive, Programmed Death-Ligand 1-High Advanced NSCLC: A Randomized, Open-Label, Phase 3 Trial. J Thorac Oncol. 2023;18(12). PMID 37597750.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/37597750/',
      publishedAt: '2023-12-01',
      methodologyType: 'primary',
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
