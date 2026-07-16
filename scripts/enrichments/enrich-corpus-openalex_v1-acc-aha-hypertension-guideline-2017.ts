// Enrichment: post-publication epistemic trajectory for the 2017 ACC/AHA
// multi-society "Guideline for the Prevention, Detection, Evaluation, and
// Management of High Blood Pressure in Adults" (Whelton et al., Hypertension).
//
// Claim: cmply4oxn00arsaihxiek92oy
// DOI:   10.1161/hyp.0000000000000065
// OpenAlex: W2770837559
//
// The baseline row (fromAxis=null -> RECORDED at 2017-11-13) already exists; do
// NOT duplicate it. This script adds the two verified downstream transitions.
//
// Arc:
//   RECORDED -> CONTESTED (2018-05-31, EXPERT_LITERATURE)
//     The guideline's headline move — lowering the hypertension threshold to
//     130/80 mm Hg — was contested almost immediately. The American Academy of
//     Family Physicians declined to endorse it (Dec 2017), continuing to endorse
//     JNC8, citing concerns over methodologic rigor, panel conflicts of interest,
//     and inadequate consideration of harms. The peer-reviewed critique cited here
//     (Miyazaki, J Gen Fam Med 2018) crystallized that objection, arguing the
//     lower threshold amounted to overdiagnosis driven by intellectual conflict
//     of interest.
//   CONTESTED -> SETTLED (2025-08, INSTITUTIONAL)
//     The 2025 AHA/ACC multi-society hypertension guideline (DOI
//     10.1161/HYP.0000000000000249) — the first major update since 2017 —
//     reaffirmed the <130/80 mm Hg treatment goal and the ≥130/80 mm Hg
//     definition/treatment threshold (with encouragement toward <120/80),
//     settling the disputed threshold as durable field consensus eight years on.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-acc-aha-hypertension-guideline-2017.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-acc-aha-hypertension-guideline-2017.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply4oxn00arsaihxiek92oy'

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
    occurredAt: '2018-05-31',
    datePrecision: 'DAY',
    reason:
      'The guideline\'s central change — redefining hypertension at 130/80 mm Hg rather than 140/90 — was contested from publication. The American Academy of Family Physicians declined to endorse it (December 2017) and continued endorsing JNC8, citing weak methodologic rigor, panel conflicts of interest, and inadequate weighting of treatment harms. This peer-reviewed critique articulated the same objection, arguing the lower threshold constituted overdiagnosis driven by intellectual conflict of interest.',
    source: {
      externalId: 'src:miyazaki-acc-aha-htn-overdiagnosis-2018',
      name: 'Miyazaki K. Overdiagnosis or not? 2017 ACC/AHA high blood pressure clinical practice guideline: Consequences of intellectual conflict of interest. Journal of General and Family Medicine 2018;19(4):123–125.',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6030030/',
      publishedAt: '2018-05-31',
      methodologyType: 'opinion',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2025-08-01',
    datePrecision: 'MONTH',
    reason:
      'The 2025 AHA/ACC multi-society "Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults" (DOI 10.1161/HYP.0000000000000249) — the first major update since 2017 — reaffirmed the <130/80 mm Hg treatment goal and retained the ≥130/80 mm Hg definition and pharmacologic-treatment threshold (adding encouragement toward <120/80). The disputed 130/80 threshold survived eight years of contest and was re-ratified by the same institutional coalition, settling it as durable field consensus.',
    source: {
      externalId: 'src:acc-aha-hypertension-guideline-2025',
      name: '2025 AHA/ACC/AANP/AAPA/ABC/ACCP/ACPM/AGS/AMA/ASPC/NMA/PCNA/SGIM Guideline for the Management of High Blood Pressure in Adults. Hypertension 2025. DOI 10.1161/HYP.0000000000000249. Summary: Updates in the 2025 AHA/ACC Hypertension Guideline.',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12995957/',
      publishedAt: '2025-08-01',
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
