// Epistemic-receipt enrichment for claim cmpmcd92g59u4saer5164k8wj
//
// Paper: Hodi FS, O'Day SJ, McDermott DF, et al. "Improved Survival with
// Ipilimumab in Patients with Metastatic Melanoma." N Engl J Med 2010.
// DOI 10.1056/nejmoa1003466 · OpenAlex W2097995306
//
// Baseline row (fromAxis=null -> RECORDED at 2010-06-05) already exists; do not
// duplicate it. This script adds the post-publication adjudication:
//
//   RECORDED -> SETTLED  (2011-03-25, INSTITUTIONAL)
//     The finding — that ipilimumab produces an overall-survival benefit in
//     previously treated metastatic melanoma, the first agent ever to do so in
//     a phase 3 trial — was adjudicated by the FDA, which approved ipilimumab
//     (Yervoy, BLA 125377) on 2011-03-25 on the strength of this trial.
//     Durability of the OS benefit (a plateau in the survival curve) was later
//     corroborated by the Schadendorf pooled long-term analysis (JCO 2015).
//
// Verified URLs (fetched):
//   - FDA Drugs@FDA overview, BLA 125377, original approval 03/25/2011 -> 200
//   - Schadendorf pooled analysis DOI 10.1200/jco.2014.56.2736 -> 200
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ipilimumab-melanoma-survival-settled.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ipilimumab-melanoma-survival-settled.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpmcd92g59u4saer5164k8wj'

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
    occurredAt: '2011-03-25',
    datePrecision: 'DAY',
    reason:
      'On 25 March 2011 the U.S. FDA approved ipilimumab (Yervoy, BLA 125377) for unresectable or metastatic melanoma, granting the approval on the basis of the overall-survival benefit demonstrated in this phase 3 trial. The approval — the first for any agent showing an OS benefit in metastatic melanoma — moved the finding from a single reported result to an institutionally adjudicated, practice-defining conclusion. Durability of the survival benefit was subsequently corroborated by the Schadendorf pooled long-term analysis (J Clin Oncol 2015), which showed a plateau in the survival curve beyond three years.',
    source: {
      externalId: 'src:fda-ipilimumab-yervoy-bla125377-2011',
      name: 'U.S. Food and Drug Administration. Drugs@FDA: Yervoy (ipilimumab), BLA 125377, original approval 03/25/2011.',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=125377',
      publishedAt: '2011-03-25',
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
