// Epistemic-receipt enrichment for claim cmplyroxp024bsaqkpp24ewfc
//
// Paper: Levac D, Colquhoun H, O'Brien KK. "Scoping studies: advancing the
// methodology." Implementation Science 2010;5:69.
// DOI 10.1186/1748-5908-5-69 · OpenAlex W2084154288
//
// Baseline row (fromAxis=null -> RECORDED at 2010-09-20) already exists; do not
// duplicate it. This script adds the post-publication adjudication:
//
//   RECORDED -> SETTLED  (2018-10-02, INSTITUTIONAL)
//     Levac et al. argued the Arksey & O'Malley (2005) scoping-study framework
//     needed clarifying and enhancing to support consistency in how scoping
//     studies are conducted and reported. That call was adjudicated by the
//     PRISMA Extension for Scoping Reviews (PRISMA-ScR), a formal Delphi-
//     consensus reporting guideline (Tricco et al., Ann Intern Med 2018) that
//     standardized scoping-review conduct and reporting, building explicitly on
//     the Arksey-O'Malley, Levac, and JBI methodological work. Its publication
//     marks field convergence on the standardized methodology Levac called for.
//
// Verified URLs (fetched 2026-07-15):
//   - Levac DOI 10.1186/1748-5908-5-69 -> 200 (link.springer.com)
//   - PRISMA-ScR PubMed 30178033 (DOI 10.7326/M18-0850) -> 200
//     (publisher DOI acpjournals.org returns 403 bot-block; PubMed used instead)
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-scoping-studies-methodology-settled.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-scoping-studies-methodology-settled.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplyroxp024bsaqkpp24ewfc'

interface TransitionDef {
  fromAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED'
  toAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED'
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

const TRANSITIONS: TransitionDef[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2018-10-02',
    datePrecision: 'DAY',
    reason:
      "Levac et al. argued that the Arksey & O'Malley (2005) scoping-study framework required clarifying and enhancing to support the consistency with which authors conduct and report scoping studies. That call was adjudicated by the PRISMA Extension for Scoping Reviews (PRISMA-ScR), a formal Delphi-consensus reporting guideline that standardized scoping-review conduct and reporting and drew explicitly on the Arksey-O'Malley, Levac, and Joanna Briggs Institute methodological work. Its publication represents the field's convergence on the standardized, reproducible scoping-review methodology that Levac et al. had called for.",
    source: {
      externalId: 'src:prisma-scr-tricco-2018',
      name: 'Tricco AC, Lillie E, Zarin W, et al. PRISMA Extension for Scoping Reviews (PRISMA-ScR): Checklist and Explanation. Ann Intern Med 2018;169(7):467-473.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/30178033/',
      publishedAt: '2018-10-02',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source upsert ${t.source.externalId}`)
      console.log(`[dry-run] history upsert ${histId} (${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt})`)
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
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${histId} (${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
