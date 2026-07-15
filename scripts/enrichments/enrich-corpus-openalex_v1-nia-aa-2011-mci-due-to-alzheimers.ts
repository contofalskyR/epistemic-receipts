// Epistemic-receipt enrichment for claim cmplxl65100a7sa7finbe860x
// Paper: Albert MS, DeKosky ST, Dickson D, Dubois B, et al. "The diagnosis of mild
//   cognitive impairment due to Alzheimer's disease: Recommendations from the
//   National Institute on Aging-Alzheimer's Association workgroups on diagnostic
//   guidelines for Alzheimer's disease." Alzheimer's & Dementia 2011;7(3):270-279.
//   DOI 10.1016/j.jalz.2011.03.008. OpenAlex W2582524520.
//
// Baseline (already seeded): fromAxis=null -> RECORDED at 2011-04-22.
// Not retracted (Crossref shows no update-to / updated-by; no expression of concern).
//
// Post-publication arc:
//   1. RECORDED -> CONTESTED (2014-06) — the International Working Group's IWG-2
//      criteria (Dubois et al., Lancet Neurology) advanced a competing research
//      diagnostic framework that diverged from the NIA-AA scheme, folding the
//      symptomatic predementia phase into a single biomarker-anchored "prodromal AD"
//      construct rather than the NIA-AA's separate clinical-core-plus-likelihood
//      "MCI due to AD" category — placing the 2011 approach in active expert dispute.
//   2. CONTESTED -> SETTLED (2024-06-27) — the NIA-AA / Alzheimer's Association
//      Workgroup's "Revised criteria for diagnosis and staging of Alzheimer's disease"
//      (Jack et al., Alzheimer's & Dementia 2024) formally updated the 2011 guidelines
//      and retained the symptomatic predementia phase (MCI) as a recognized clinical
//      stage within an integrated clinical-biological staging model, institutionalizing
//      the 2011 construct.
//
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nia-aa-2011-mci-due-to-alzheimers.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nia-aa-2011-mci-due-to-alzheimers.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxl65100a7sa7finbe860x'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // ── 1. IWG-2 advances a competing research diagnostic framework (2014) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2014-06-01',
    datePrecision: 'MONTH',
    reason:
      'The International Working Group published "Advancing research diagnostic criteria for Alzheimer\'s disease: the IWG-2 criteria" (Dubois B, Feldman HH, Jacova C, et al., Lancet Neurology 2014;13(6):614-629), advancing a competing framework that diverged from the NIA-AA scheme. IWG-2 collapsed the symptomatic predementia phase into a single biomarker-anchored "prodromal AD" construct instead of the NIA-AA\'s separate "MCI due to AD" category with its clinical-core-plus-biomarker-likelihood levels, and criticized the NIA-AA approach as impractical for diagnosis — placing the 2011 recommendations in active expert dispute over how to define and diagnose the predementia phase.',
    source: {
      externalId: 'src:iwg-2-dubois-research-criteria-ad-2014',
      name: 'Dubois B, Feldman HH, Jacova C, et al. Advancing research diagnostic criteria for Alzheimer\'s disease: the IWG-2 criteria. Lancet Neurology 2014;13(6):614-629.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/24849862/',
      publishedAt: '2014-06-01',
      methodologyType: 'derivative',
    },
  },
  // ── 2. NIA-AA / AA Workgroup revised criteria formally update the 2011 guidelines (2024) ──
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2024-06-27',
    datePrecision: 'DAY',
    reason:
      'The NIA-AA / Alzheimer\'s Association Workgroup published "Revised criteria for diagnosis and staging of Alzheimer\'s disease" (Jack CR Jr, Andrews JS, Beach TG, et al., Alzheimer\'s & Dementia 2024;20(8):5143-5169) on 27 June 2024, formally updating the 2011 guidelines. The revised criteria retain the symptomatic predementia phase (mild cognitive impairment) as a recognized clinical stage within an integrated clinical-biological staging model — carrying the 2011 "MCI due to AD" construct forward as an adopted institutional standard rather than discarding it, and thereby settling the core proposition that AD has a diagnosable symptomatic predementia stage.',
    source: {
      externalId: 'src:nia-aa-revised-criteria-ad-2024',
      name: 'Jack CR Jr, Andrews JS, Beach TG, et al. Revised criteria for diagnosis and staging of Alzheimer\'s disease: Alzheimer\'s Association Workgroup. Alzheimer\'s & Dementia 2024;20(8):5143-5169.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/38934362/',
      publishedAt: '2024-06-27',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting (this script does not create claims)`)

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${tr.fromAxis ?? 'null'} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
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
        ingestedBy: 'enrich:openalex_v1-nia-aa-2011-mci-due-to-alzheimers',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${tr.fromAxis ?? 'null'} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
  }

  console.log(DRY_RUN ? '\nDry run complete.' : '\nEnrichment complete.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
