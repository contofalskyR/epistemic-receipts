// Epistemic enrichment: post-publication trajectory for the Framingham echocardiographic
// left ventricular (LV) mass prognosis claim (Levy et al., NEJM 1990).
//
// Claim: cmplyb38603efsaih2zsmljdd
//   "Prognostic implications of echocardiographically determined left ventricular mass
//    in the Framingham Heart Study" — Levy D, Garrison RJ, Savage DD, Kannel WB, Castelli WP.
//    N Engl J Med. 1990 May 31;322(22):1561–6. DOI 10.1056/NEJM199005313222203.
//    OpenAlex W2334499091.
//
// The baseline RECORDED row (fromAxis=null -> RECORDED at 1990-05-31) already exists; this
// script does NOT duplicate it. It adds the single verified post-publication transition.
//
// Arc: RECORDED -> SETTLED (EXPERT_LITERATURE).
//   The finding — that echocardiographic LV mass is an independent, graded predictor of
//   cardiovascular morbidity, cardiovascular mortality, and all-cause mortality — was never
//   contested. It was adjudicated and vindicated by a systematic review + meta-analysis of
//   22 longitudinal studies (55,603 individuals without prior cardiovascular disease):
//   Fernandes et al., Clinics (Sao Paulo) 2021;76:e2754. LVH pooled RR 2.58 (95% CI 1.83–3.64)
//   for cardiovascular death and 2.02 (1.34–3.04) for all-cause mortality.
//
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-framingham-lv-mass-prognosis.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-framingham-lv-mass-prognosis.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplyb38603efsaih2zsmljdd'

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
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2021-06-23',
    datePrecision: 'DAY',
    reason:
      'A systematic review and meta-analysis of 22 longitudinal studies (55,603 individuals with no history of cardiovascular disease) adjudicated the Framingham finding, confirming that echocardiographic left ventricular hypertrophy / LV mass is an independent predictor of adverse outcomes: pooled relative risk 2.58 (95% CI 1.83–3.64) for cardiovascular death and 2.02 (95% CI 1.34–3.04) for all-cause mortality. The original claim was never contested in the literature; the pooled evidence vindicates and settles it. The finding is likewise codified in major clinical guidelines (e.g., the 2018 ESC/ESH hypertension guidelines) that treat echocardiographic LV mass as hypertension-mediated organ damage.',
    source: {
      externalId: 'src:fernandes-2021-echo-prognosis-metaanalysis',
      name: 'Fernandes LP, Barreto ATF, Gomes Neto M, Câmara EJN, Durães AR, Roever L, et al. Prognostic power of conventional echocardiography in individuals without history of cardiovascular diseases: A systematic review and meta-analysis. Clinics (Sao Paulo). 2021 Jun 23;76:e2754. PMID 34190849.',
      url: 'https://doi.org/10.6061/clinics/2021/e2754',
      publishedAt: '2021-06-23',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — refusing to enrich a non-existent claim.`)
  }

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry-run] source ${tr.source.externalId}`)
      console.log(`  [dry-run] claimStatusHistory ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
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
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
