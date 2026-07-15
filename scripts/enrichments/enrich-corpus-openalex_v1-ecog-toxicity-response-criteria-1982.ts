// Epistemic-receipt enrichment for claim cmply4d2x0053saihlygsb3zl
// "STANDARD CRITERIA FOR TOXICITY and for response to treatment are important
//  prerequisites to the conduct of cancer trials... The Eastern Cooperative
//  Oncology Group criteria for toxicity and response are presented..."
// Oken MM, Creech RH, Tormey DC, et al. "Toxicity and response criteria of the
// Eastern Cooperative Oncology Group." Am J Clin Oncol 1982;5(6):649-655.
// OpenAlex W2076668534. DOI 10.1097/00000421-198212000-00014. Published 1982-12-01.
// Not retracted.
//
// Baseline row (null -> RECORDED at 1982-12-01) already exists; this script adds
// the post-publication arc:
//   RECORDED -> SETTLED (2000)  RECIST international consensus institutionalizes
//                               standardized response criteria for solid-tumor
//                               trials, consolidating the WHO/ECOG bidimensional
//                               criteria this paper helped establish. The paper's
//                               thesis — that standard toxicity/response criteria
//                               are essential prerequisites — is vindicated as
//                               field consensus (RECIST for response, and the
//                               ECOG performance status from the same paper
//                               enduring as the universal functional-status index).
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ecog-toxicity-response-criteria-1982.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ecog-toxicity-response-criteria-1982.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply4d2x0053saihlygsb3zl'

interface Transition {
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

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2000-02-02',
    datePrecision: 'DAY',
    reason:
      'The RECIST guidelines (Therasse et al., J Natl Cancer Inst, 2 Feb 2000), produced by an international working group of the EORTC, the US NCI, and the NCI of Canada, unified response evaluation for solid-tumor trials by consolidating and simplifying the earlier WHO and ECOG bidimensional response criteria that the 1982 ECOG paper helped standardize. This institutionalized standardized toxicity/response reporting as the global field norm — vindicating the paper\'s core thesis that standard criteria are essential prerequisites for cancer trials — while the ECOG performance status introduced in the same paper endured as the universal functional-status index (paralleled on the toxicity side by the NCI Common Toxicity Criteria / CTCAE).',
    source: {
      externalId: 'src:ecog-criteria-1982-settled-recist-2000',
      name: 'Therasse P, Arbuck SG, Eisenhauer EA, et al. "New guidelines to evaluate the response to treatment in solid tumors (RECIST)." J Natl Cancer Inst 2000;92(3):205-216. PMID 10655437.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/10655437/',
      publishedAt: '2000-02-02',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found`)

  for (const t of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${t.datePrecision})`)
      console.log(`          source ${t.source.externalId} -> ${t.source.url}`)
      console.log(`          history id ${slug}`)
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
        ingestedBy: 'enrich-openalex_v1',
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
        claimId: CLAIM_ID,
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

    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${slug})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
