// Enrichment: post-publication epistemic trajectory for Link & Phelan (2001),
// "Conceptualizing Stigma," Annu. Rev. Sociol. 27:363-385.
// DOI 10.1146/annurev.soc.27.1.363 · OpenAlex W4213367093 · claim cmplxrhyh03cjsa7fcex5qyvy
//
// The baseline row (fromAxis=null -> RECORDED at 2001-08) already exists; do NOT duplicate it.
//
// Post-publication event added:
//  - RECORDED -> SETTLED (2015-08): Pescosolido & Martin, "The Stigma Complex"
//    (Annu. Rev. Sociol. 41:87-116, DOI 10.1146/annurev-soc-071312-145702), an
//    independent major review that adjudicates 14 years of stigma research and
//    builds the field's consolidated "theoretical architecture" on the
//    Link-Phelan conceptualization (labeling, stereotyping, separation, status
//    loss, discrimination + power), establishing it as the field's foundational
//    framework. Community: EXPERT_LITERATURE.
//
// No retraction, expression of concern, or failed replication exists (Crossref,
// 2026-07-15). This is a conceptual framework, not an empirical finding.
//
// Idempotent: source upsert on externalId, status-history upsert on slug.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-conceptualizing-stigma.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxrhyh03cjsa7fcex5qyvy'

async function main() {
  // ── RECORDED -> SETTLED: Pescosolido & Martin 2015 review consolidates the field ──
  await prisma.source.upsert({
    where: { externalId: 'src:pescosolido-martin-stigma-complex-2015' },
    create: {
      externalId: 'src:pescosolido-martin-stigma-complex-2015',
      name: 'Pescosolido & Martin (2015), "The Stigma Complex," Annual Review of Sociology 41:87-116',
      url: 'https://doi.org/10.1146/annurev-soc-071312-145702',
      publishedAt: new Date('2015-08-01'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Pescosolido & Martin (2015), "The Stigma Complex," Annual Review of Sociology 41:87-116',
      url: 'https://doi.org/10.1146/annurev-soc-071312-145702',
      publishedAt: new Date('2015-08-01'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2015-08-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2015-08-01'),
      datePrecision: 'MONTH',
      reason:
        'Pescosolido & Martin\'s "The Stigma Complex" (Annu. Rev. Sociol. 41:87-116, 2015), a comprehensive independent review of 14 years of stigma research, adopts the Link-Phelan conceptualization — stigma as the co-occurrence of labeling, stereotyping, separation, status loss, and discrimination conditioned on power — as the foundational framework on which it builds the field\'s integrated "theoretical architecture." The review adjudicates competing usages and treats the 2001 definition as the settled conceptual anchor of the discipline, marking field consensus within the expert literature.',
      sourceExternalId: 'src:pescosolido-martin-stigma-complex-2015',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2015-08-01'),
      datePrecision: 'MONTH',
      reason:
        'Pescosolido & Martin\'s "The Stigma Complex" (Annu. Rev. Sociol. 41:87-116, 2015), a comprehensive independent review of 14 years of stigma research, adopts the Link-Phelan conceptualization — stigma as the co-occurrence of labeling, stereotyping, separation, status loss, and discrimination conditioned on power — as the foundational framework on which it builds the field\'s integrated "theoretical architecture." The review adjudicates competing usages and treats the 2001 definition as the settled conceptual anchor of the discipline, marking field consensus within the expert literature.',
      sourceExternalId: 'src:pescosolido-martin-stigma-complex-2015',
    },
  })

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
