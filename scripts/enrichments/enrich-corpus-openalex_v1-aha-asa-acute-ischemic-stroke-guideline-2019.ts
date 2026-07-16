// Enrichment: post-publication epistemic trajectory for the AHA/ASA
// "Guidelines for the Early Management of Patients With Acute Ischemic Stroke:
// 2019 Update to the 2018 Guidelines" (Powers et al., Stroke 2019;50(12):e344–e418).
//
// Claim: cmplyh7a906b3saihidf20zjr
// DOI:   10.1161/str.0000000000000211
// OpenAlex: W2982303713
//
// The baseline row (fromAxis=null -> RECORDED at 2019-10-30) already exists; do
// NOT duplicate it. This script adds one verified downstream transition.
//
// Notes on events considered but excluded:
//   - A "Correction to..." (Published Erratum, Stroke 2019 Dec; PMID 31765293)
//     followed publication, but an erratum is housekeeping — it fixes errors in
//     the printed article, it does not contest the finding — so it is NOT modeled
//     as a CONTESTED transition.
//
// Arc:
//   RECORDED -> SETTLED (2026-01-26, INSTITUTIONAL)
//     The "2026 Guideline for the Early Management of Patients With Acute Ischemic
//     Stroke" (DOI 10.1161/STR.0000000000000513), issued by a new AHA/ASA writing
//     group after systematic review of evidence since 2018, formally replaced the
//     2018 and 2019 guidelines. Rather than overturning the 2019 recommendations,
//     it reaffirmed and extended their core: IV thrombolysis within 4.5 hours as a
//     "mainstay" of care and mechanical (endovascular) thrombectomy for large-vessel
//     occlusion, adding tenecteplase, extended time windows, and mobile stroke units.
//     The 2019 recommendations were thus re-ratified as durable institutional
//     consensus by their own successor document.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-aha-asa-acute-ischemic-stroke-guideline-2019.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-aha-asa-acute-ischemic-stroke-guideline-2019.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplyh7a906b3saihidf20zjr'

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
    occurredAt: '2026-01-26',
    datePrecision: 'DAY',
    reason:
      'The "2026 Guideline for the Early Management of Patients With Acute Ischemic Stroke" (DOI 10.1161/STR.0000000000000513), issued by a new AHA/ASA writing group after systematic review of evidence published since 2018, formally replaced the 2018 and 2019 guidelines. It did not overturn the 2019 recommendations but reaffirmed and extended their core — IV thrombolysis within 4.5 hours as a "mainstay" of medical management and endovascular (mechanical) thrombectomy for large-vessel occlusion — while adding tenecteplase, extended time windows, and mobile stroke units. The 2019 recommendations were re-ratified as durable institutional consensus by their own successor document.',
    source: {
      externalId: 'src:aha-asa-acute-ischemic-stroke-guideline-2026',
      name: '2026 Guideline for the Early Management of Patients With Acute Ischemic Stroke: A Guideline From the American Heart Association/American Stroke Association. Stroke 2026 (published online 26 Jan 2026). DOI 10.1161/STR.0000000000000513.',
      url: 'https://doi.org/10.1161/STR.0000000000000513',
      publishedAt: '2026-01-26',
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
