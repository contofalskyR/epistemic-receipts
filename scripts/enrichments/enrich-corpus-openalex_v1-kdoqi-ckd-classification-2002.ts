// Epistemic-receipt enrichment for claim cmply4sy400crsaihdbyxgg3i
// "Introduction: Chronic kidney disease as a public health problem."
// K/DOQI Clinical Practice Guidelines for Chronic Kidney Disease:
// Evaluation, Classification, and Stratification (Levey et al., 2002).
// OpenAlex W2487377689. Published 2002-09-15. Not retracted.
//
// Baseline row (null -> RECORDED at 2002-09-15) already exists; this script
// adds the post-publication arc:
//   RECORDED -> CONTESTED  (2008)  Bauer/Melamed/Hostetter "course correction" critique
//   CONTESTED -> SETTLED   (2013)  KDIGO 2012 guideline revises + institutionalizes CKD classification
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-kdoqi-ckd-classification-2002.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-kdoqi-ckd-classification-2002.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply4sy400crsaihdbyxgg3i'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2008-05-01',
    datePrecision: 'MONTH',
    reason:
      'Bauer, Melamed, and Hostetter argued in the Journal of the American Society of Nephrology that the K/DOQI GFR-only staging system was misclassifying large numbers of healthy older adults as having chronic kidney disease and called it "time for a course correction." The editorial crystallized a wider debate (including Glassock and Winearls) over whether the 2002 classification over-diagnosed CKD, marking the finding as actively contested in the expert literature.',
    source: {
      externalId: 'src:kdoqi-ckd-2002-contested-bauer-jasn-2008',
      name: 'Bauer C, Melamed ML, Hostetter TH. "Staging of chronic kidney disease: time for a course correction." J Am Soc Nephrol 2008;19(5):844-846.',
      url: 'https://doi.org/10.1681/asn.2008010110',
      publishedAt: '2008-05-01',
      methodologyType: 'opinion',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2013-06-04',
    datePrecision: 'DAY',
    reason:
      'The KDIGO 2012 Clinical Practice Guideline (synopsized by Stevens and Levin in Annals of Internal Medicine, 4 June 2013) revised the 2002 classification into the cause/GFR/albuminuria (CGA) framework, subdividing GFR stage 3 and adding albuminuria categories to address the over-diagnosis critique. In doing so it retained and internationalized the core K/DOQI construct — CKD as a GFR/damage-defined public-health entity — settling the debate as the global institutional consensus.',
    source: {
      externalId: 'src:kdoqi-ckd-2002-settled-kdigo-2012-annals',
      name: 'Stevens PE, Levin A (KDIGO CKD Work Group). "Evaluation and Management of Chronic Kidney Disease: Synopsis of the KDIGO 2012 Clinical Practice Guideline." Ann Intern Med 2013;158(11):825-830.',
      url: 'https://doi.org/10.7326/0003-4819-158-11-201306040-00007',
      publishedAt: '2013-06-04',
      methodologyType: 'primary',
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
