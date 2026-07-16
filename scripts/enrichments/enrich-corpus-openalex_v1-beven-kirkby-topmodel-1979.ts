// Enrichment: post-publication epistemic trajectory for Beven & Kirkby's TOPMODEL
// (Beven KJ, Kirkby MJ. "A physically based, variable contributing area model of
// basin hydrology." Hydrological Sciences Bulletin 1979;24(1):43-69,
// DOI 10.1080/02626667909491834, OpenAlex W1981646498).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 1979-03-01 publication date) already exists — do NOT duplicate it.
//
// Post-publication event (verified via Crossref / Semantic Scholar / publisher page):
//   No retraction or expression of concern exists, and TOPMODEL remains one of the
//   most widely used conceptual rainfall-runoff models in hydrology (the paper is
//   cited >6,600 times). But the model's theoretical foundations were subjected to a
//   specific, dated, landmark methodological critique by the original author himself:
//
//   CONTEST (1997): Beven, K.J. "TOPMODEL: A critique." (Hydrological Processes
//      1997;11(9):1069-1088, DOI 10.1002/(SICI)1099-1085(199707)11:9<1069::AID-
//      HYP545>3.0.CO;2-O, 630 citations). Beven systematically catalogued the ways
//      the 1979 model's core assumptions fail in practice — the quasi-steady-state
//      recharge assumption, the exponential transmissivity / topographic-index
//      similarity assumption, the scale dependence of the topographic index, and the
//      difficulty of identifying parameters uniquely — arguing the model should be
//      treated as a conceptual hypothesis-testing tool rather than a physically
//      exact predictor. This put the theoretical basis of the original claim under
//      sustained scrutiny in the hydrological literature. RECORDED -> CONTESTED.
//      Community: EXPERT_LITERATURE.
//
// No later document cleanly "settles" the contest: the field continues to use
// TOPMODEL while acknowledging the limitations Beven identified (subsequent work such
// as the 2001 "dynamic TOPMODEL" reformulates rather than vindicates the original
// storage/contributing-area formulation), so only the single CONTESTED transition is
// encoded here.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-beven-kirkby-topmodel-1979.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-beven-kirkby-topmodel-1979.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w52bv00nlsa8h5hxxiuex'

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
  edgeType: 'FOR' | 'AGAINST'
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1997-07-01',
    datePrecision: 'MONTH',
    reason:
      "Beven & Kirkby's 1979 TOPMODEL derived quick-response flow from an analytically derived storage/contributing-area relationship keyed to a topographic index, presenting it as a physically based basin-hydrology model. Eighteen years later the original author subjected that theoretical basis to a specific, dated, landmark critique — Beven, K.J., 'TOPMODEL: A critique' (Hydrological Processes 1997;11(9):1069-1088, 630 citations). Beven systematically documented where the model's founding assumptions fail: the quasi-steady-state recharge assumption, the exponential-transmissivity / topographic-index hydrological-similarity assumption, the scale dependence of the computed topographic index, and the non-uniqueness of calibrated parameters — concluding TOPMODEL is better regarded as a conceptual hypothesis-testing framework than a physically exact predictor. This placed the original claim's physical basis under sustained scrutiny in the hydrological literature. RECORDED -> CONTESTED.",
    edgeType: 'AGAINST',
    source: {
      externalId: 'src:beven-1997-topmodel-critique',
      name: "Beven K. TOPMODEL: A critique. Hydrological Processes 1997;11(9):1069-1088. DOI 10.1002/(SICI)1099-1085(199707)11:9<1069::AID-HYP545>3.0.CO;2-O.",
      url: 'https://onlinelibrary.wiley.com/doi/10.1002/(SICI)1099-1085(199707)11:9%3C1069::AID-HYP545%3E3.0.CO;2-O',
      publishedAt: '1997-07-01',
      methodologyType: 'opinion',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} — ${TRANSITIONS.length} post-publication transition(s)${DRY_RUN ? ' (dry-run)' : ''}`)

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry-run] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.datePrecision}) | ${slug}`)
      console.log(`            source: ${tr.source.externalId} -> ${tr.source.url}`)
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
        ingestedBy: 'enrich:openalex_v1',
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: tr.edgeType } })
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
