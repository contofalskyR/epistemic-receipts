// Epistemic-receipt enrichment for claim cmplxpjy402f1sa7fx3wf9vm4
// Paper: Jack CR Jr, Bennett DA, Blennow K, et al. "NIA-AA Research Framework:
//   Toward a biological definition of Alzheimer's disease." Alzheimer's & Dementia
//   2018;14(4):535-562. DOI 10.1016/j.jalz.2018.02.018. OpenAlex W2798054687.
//
// Post-publication arc (baseline fromAxis=null -> RECORDED at 2018-04-01 already seeded):
//   1. RECORDED -> CONTESTED (2021-06) — the International Working Group (Dubois et al.,
//      Lancet Neurology) formally rejected the purely biological, biomarker-based
//      definition of AD for cognitively unimpaired individuals, arguing biomarker
//      positivity in asymptomatic people should not be labeled "Alzheimer's disease."
//   2. CONTESTED -> SETTLED (2024-06-27) — the NIA-AA / Alzheimer's Association
//      Workgroup formally revised and adopted the framework as biology-based criteria
//      for diagnosis and staging (Jack et al., Alzheimer's & Dementia 2024), moving the
//      2018 research construct into an adopted institutional standard bridging research
//      and clinical care.
//
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nia-aa-2018-research-framework-alzheimers.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nia-aa-2018-research-framework-alzheimers.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxpjy402f1sa7fx3wf9vm4'

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
  // ── 1. IWG contests the purely biological definition of AD (2021) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2021-06-01',
    datePrecision: 'MONTH',
    reason:
      'The International Working Group (Dubois B, Villain N, Frisoni GB, et al.), publishing "Clinical diagnosis of Alzheimer\'s disease: recommendations of the International Working Group" in Lancet Neurology (2021;20(6):484-496), directly challenged the 2018 NIA-AA framework\'s purely biological, biomarker-based definition. The IWG argued that cognitively unimpaired individuals can be amyloid- and tau-positive yet never develop clinical AD in their lifetime, so biomarker positivity alone should not diagnose Alzheimer\'s disease in a clinical setting — placing the framework\'s core proposition in active expert dispute.',
    source: {
      externalId: 'src:iwg-dubois-clinical-diagnosis-ad-2021',
      name: 'Dubois B, Villain N, Frisoni GB, et al. Clinical diagnosis of Alzheimer\'s disease: recommendations of the International Working Group. Lancet Neurology 2021;20(6):484-496.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/33933186/',
      publishedAt: '2021-06-01',
      methodologyType: 'derivative',
    },
  },
  // ── 2. NIA-AA / AA Workgroup formally adopts biology-based criteria (2024) ──
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2024-06-27',
    datePrecision: 'DAY',
    reason:
      'The NIA-AA / Alzheimer\'s Association Workgroup published "Revised criteria for diagnosis and staging of Alzheimer\'s disease" (Jack CR Jr, Andrews JS, Beach TG, et al., Alzheimer\'s & Dementia 2024;20(8):5143-5169) on 27 June 2024, formally updating and superseding the 2011 guidelines and the 2018 research framework. The revised criteria adopt the biological definition as the institutional standard for diagnosis and staging — expanding AT(N) into a Core-1/Core-2 biomarker model that incorporates blood-based biomarkers and explicitly positions itself as a bridge between research and clinical care, institutionalizing the framework\'s approach.',
    source: {
      externalId: 'src:nia-aa-revised-criteria-ad-2024',
      name: 'Jack CR Jr, Andrews JS, Beach TG, et al. Revised criteria for diagnosis and staging of Alzheimer\'s disease: Alzheimer\'s Association Workgroup. Alzheimer\'s & Dementia 2024;20(8):5143-5169.',
      url: 'https://doi.org/10.1002/alz.13859',
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
        ingestedBy: 'enrich:openalex_v1-nia-aa-2018-research-framework',
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
