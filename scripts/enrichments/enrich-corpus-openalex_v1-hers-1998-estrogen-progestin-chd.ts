// Epistemic-receipt enrichment: post-publication trajectory for
// Hulley et al. (1998), "Randomized Trial of Estrogen Plus Progestin for
// Secondary Prevention of Coronary Heart Disease in Postmenopausal Women"
// (the HERS trial), JAMA 280(7):605-613. DOI: 10.1001/jama.280.7.605
// OpenAlex: W2113264115. Claim id: cmply5cuj00mrsaih55qx5zzu.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 1998-08-19) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2002-07-17, EXPERT_LITERATURE)
//     Writing Group for the Women's Health Initiative Investigators, "Risks and
//     Benefits of Estrogen Plus Progestin in Healthy Postmenopausal Women:
//     Principal Results From the Women's Health Initiative Randomized Controlled
//     Trial", JAMA 288(3):321-333. The WHI estrogen-plus-progestin arm was
//     STOPPED EARLY (mean 5.2 y) by its data safety monitoring board because the
//     therapy INCREASED cardiovascular events (CHD hazard ratio 1.29), breast
//     cancer, stroke, and pulmonary embolism, with overall harm exceeding
//     benefit. This large primary-prevention RCT confirmed HERS's secondary-
//     prevention finding that estrogen plus progestin does not prevent coronary
//     heart disease, and jointly with HERS overturned the prevailing
//     observational "cardioprotection" hypothesis. HERS's counter-consensus
//     result is thereby vindicated and settled in the expert literature; it was
//     subsequently entrenched by the 2015 Cochrane review (Boardman et al.,
//     10.1002/14651858.CD002229.pub4) and by guideline reversals recommending
//     against hormone therapy for cardiovascular prevention.
//
// No retraction, expression of concern, or failed replication exists; HERS is a
// celebrated, practice-changing trial whose finding was confirmed, not contested.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-hers-1998-estrogen-progestin-chd.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply5cuj00mrsaih55qx5zzu'

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

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
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
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2002-07-17',
    datePrecision: 'DAY',
    reason:
      'The Women\'s Health Initiative estrogen-plus-progestin randomized controlled trial (Writing Group for the WHI Investigators, JAMA 288(3):321-333, 2002) was stopped early because the therapy increased coronary heart disease (HR 1.29), stroke, breast cancer, and pulmonary embolism, with overall risks exceeding benefits. This large primary-prevention RCT confirmed HERS\'s secondary-prevention finding that estrogen plus progestin does not prevent CHD, and jointly with HERS overturned the observational cardioprotection hypothesis. HERS\'s counter-consensus result is thereby vindicated and settled in the expert literature (later entrenched by the 2015 Cochrane review and by guideline changes recommending against hormone therapy for cardiovascular prevention).',
    source: {
      externalId: 'src:whi-estrogen-progestin-jama-2002',
      name: 'Writing Group for the Women\'s Health Initiative Investigators. Risks and Benefits of Estrogen Plus Progestin in Healthy Postmenopausal Women: Principal Results From the Women\'s Health Initiative Randomized Controlled Trial. JAMA 2002;288(3):321-333.',
      url: 'https://doi.org/10.1001/jama.288.3.321',
      publishedAt: '2002-07-17',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
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

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
