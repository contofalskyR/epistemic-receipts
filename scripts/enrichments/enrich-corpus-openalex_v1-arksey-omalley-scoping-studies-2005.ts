// Epistemic-receipt enrichment for Arksey & O'Malley (2005),
// "Scoping studies: towards a methodological framework"
// International Journal of Social Research Methodology, 8(1):19–32.
// Claim: cmplyovw200rbsaqkd15p7bh1 · DOI 10.1080/1364557032000119616 · OpenAlex W2075950485
//
// Baseline row (fromAxis=null -> RECORDED @ 2005-02) already exists; NOT duplicated here.
// This adds the post-publication arc:
//   RECORDED  -> CONTESTED  (2010-09-20): Levac et al. identify limitations in the
//               Arksey & O'Malley framework and publish enhancements to each of its
//               six stages ("Scoping studies: advancing the methodology").
//   CONTESTED -> SETTLED    (2018-10-02): the field consolidates around a formal
//               reporting standard — PRISMA-ScR (Tricco et al.), developed by a
//               24-member expert panel under EQUATOR Network guidance — which builds
//               on and institutionalises the Arksey & O'Malley framework.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-arksey-omalley-scoping-studies-2005.ts
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplyovw200rbsaqkd15p7bh1'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
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
    occurredAt: '2010-09-20',
    datePrecision: 'DAY',
    reason:
      'Levac, Colquhoun & O\'Brien, "Scoping studies: advancing the methodology" (Implementation Science, online 20 Sept 2010), drew on teams\' experience applying the Arksey & O\'Malley framework to identify concrete limitations in it and to propose enhancements to each of its six stages — clarifying purpose and research question, balancing feasibility against breadth, an iterative team approach to study selection and charting, and making the optional consultation stage explicit. This is a specific, dated methodological critique of the 2005 framework rather than an endorsement, moving the finding into contested standing.',
    source: {
      externalId: 'src:levac-scoping-advancing-methodology-2010',
      name: 'Levac D, Colquhoun H, O\'Brien KK. Scoping studies: advancing the methodology. Implementation Science 2010;5:69.',
      url: 'https://doi.org/10.1186/1748-5908-5-69',
      publishedAt: '2010-09-20',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2018-10-02',
    datePrecision: 'DAY',
    reason:
      'Tricco et al., "PRISMA Extension for Scoping Reviews (PRISMA-ScR): Checklist and Explanation" (Annals of Internal Medicine 2018;169(7):467–473), established a formal reporting standard for scoping reviews. Developed by a 24-member expert panel following EQUATOR Network guidance, PRISMA-ScR explicitly builds on the Arksey & O\'Malley framework (as advanced by Levac et al.), settling scoping reviews as a recognised, institutionally sanctioned review method and consolidating the earlier methodological debate into an agreed standard.',
    source: {
      externalId: 'src:prisma-scr-tricco-2018',
      name: 'Tricco AC, Lillie E, Zarin W, et al. PRISMA Extension for Scoping Reviews (PRISMA-ScR): Checklist and Explanation. Ann Intern Med 2018;169(7):467–473.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/30178033/',
      publishedAt: '2018-10-02',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — refusing to enrich a missing claim.`)

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-arksey-omalley-scoping-studies-2005',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    console.log(`  ✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`Done: ${TRANSITIONS.length} transitions upserted for ${CLAIM_ID}.`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
