// Enrichment: epistemic trajectory for Cruz-Jentoft AJ, Bahat G, Bauer J, et al.
// (Writing Group for the European Working Group on Sarcopenia in Older People 2,
// EWGSOP2), "Sarcopenia: revised European consensus on definition and diagnosis,"
// Age and Ageing 48(1): 16–31 (published online 24 September 2018).
// DOI 10.1093/ageing/afy169. OpenAlex W2897513125. PMID 30312372.
//
// EWGSOP2 is the revised European consensus operational definition of sarcopenia,
// updating the 2010 EWGSOP definition. It reframes low muscle STRENGTH (not mass)
// as the primary parameter, sets diagnostic cut-off points, and proposes the
// Find–Assess–Confirm–Severity (F-A-C-S) pathway. Its stated goal was "to increase
// consistency of research design, clinical diagnoses and ultimately the care" of
// people with sarcopenia — i.e., to standardise the definition.
//
// Post-publication research state:
//   - No retraction or expression of concern. Crossref returns empty `update-to`
//     / `updated-by` / `relation` for afy169.
//   - A corrigendum (Age and Ageing 48(4): 601, DOI 10.1093/ageing/afz046, PMID
//     31081853, 13 May 2019) corrected specific cut-off values. This is a minor
//     numeric correction, not a challenge to the definition's validity, so it is
//     NOT modelled as an axis transition.
//   - The definition did NOT settle into a single global standard. Multiple
//     regional operational definitions (EWGSOP2, AWGS 2019, SDOC, FNIH) diverge.
//     In 2019–2021 the Global Leadership Initiative in Sarcopenia (GLIS) — with
//     representatives from all relevant scientific societies worldwide — convened
//     precisely because, in its own words, "no international consensus on the
//     definition exists." Its Delphi consensus paper (Kirk et al., Age and Ageing
//     53(3): afae052, March 2024) established a new *conceptual* definition,
//     documenting that the operational-definition question EWGSOP2 aimed to close
//     remained open and contested at the global level.
//
// The claim already carries its baseline first entry (null -> RECORDED at the
// 2018-09-24 publication). This script adds a single downstream arc:
//
//   RECORDED -> CONTESTED (2024-03): the GLIS Delphi consensus (Kirk et al. 2024)
//     publicly recorded that no international consensus on the sarcopenia
//     definition exists and launched a new global conceptual definition,
//     establishing that EWGSOP2's operational consensus did not settle the field
//     but sits among competing, non-harmonised definitions. Community
//     EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ewgsop2-2018-sarcopenia-definition.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ewgsop2-2018-sarcopenia-definition.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply544600ifsaihdiz1xxeb'

type FactStatus =
  | 'OPEN'
  | 'RECORDED'
  | 'SETTLED'
  | 'CONTESTED'
  | 'REVERSED'
  | 'ABANDONED'
  | 'UNRESOLVABLE'
type RatifyingCommunity =
  | 'EXPERT_LITERATURE'
  | 'INSTITUTIONAL'
  | 'JUDICIAL'
  | 'PUBLIC'
  | 'MARKET'
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
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

// Do NOT duplicate the existing null -> RECORDED (2018-09-24 publication) first
// entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2024-03-01',
    datePrecision: 'MONTH',
    reason:
      'Kirk B, Cawthon PM, Arai H, et al. for the Global Leadership Initiative in Sarcopenia (GLIS), "The Conceptual Definition of Sarcopenia: Delphi Consensus from the Global Leadership Initiative in Sarcopenia (GLIS)," Age and Ageing 53(3): afae052 (March 2024), states plainly that "no international consensus on the definition exists" and convenes representatives from all relevant scientific societies worldwide to build a new global conceptual definition. This documents that EWGSOP2\'s revised European operational consensus did not settle the field: multiple regional definitions (EWGSOP2, AWGS 2019, SDOC, FNIH) diverge, and the definitional question EWGSOP2 aimed to close was re-opened at the global level. RECORDED -> CONTESTED in the expert literature.',
    source: {
      externalId: 'src:glis-2024-sarcopenia-conceptual-definition-afae052',
      name:
        'B. Kirk, P.M. Cawthon, H. Arai, et al. (Global Leadership Initiative in Sarcopenia), "The Conceptual Definition of Sarcopenia: Delphi Consensus from the Global Leadership Initiative in Sarcopenia (GLIS)," Age and Ageing 53(3): afae052 (March 2024). DOI 10.1093/ageing/afae052. PMID 38520141.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/38520141/',
      publishedAt: '2024-03-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${
      DRY_RUN ? ' (DRY RUN)' : ''
    }`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`)
  }

  for (const t of TRANSITIONS) {
    const s = t.source
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    console.log(
      `  ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${s.externalId})`,
    )
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: s.externalId },
      create: {
        externalId: s.externalId,
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
        ingestedBy: 'enrich:openalex_v1',
        autoApproved: true,
      },
      update: {
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
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
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
