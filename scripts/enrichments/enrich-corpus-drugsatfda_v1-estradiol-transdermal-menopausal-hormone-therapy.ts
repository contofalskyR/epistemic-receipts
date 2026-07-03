// Enrichment: epistemic trajectory for the FDA generic-approval (ANDA 218214, ENCUBE)
// claim covering ESTRADIOL transdermal metered gel 0.06% (1.25 g/activation), a
// generic of the EstroGel reference product indicated for moderate-to-severe
// menopausal vasomotor symptoms.
//
// The subject fact is estradiol (systemic estrogen) as therapy for menopausal
// symptoms. The claim already carries its null -> RECORDED first entry (the drug
// approval / first published clinical evidence that estrogen relieves menopausal
// vasomotor symptoms). This script adds the downstream arc:
//
//   RECORDED -> SETTLED (1992): The American College of Physicians issued a formal
//     clinical guideline counseling postmenopausal women about preventive hormone
//     therapy, reflecting estrogen's status as broadly adopted standard of care
//     for menopausal symptoms and postmenopausal health in the 1990s.
//
//   SETTLED -> CONTESTED (2002): The Women's Health Initiative (WHI) estrogen +
//     progestin randomized controlled trial was halted early after an interim
//     analysis found that the health risks (invasive breast cancer, coronary heart
//     disease, stroke, and pulmonary embolism) exceeded the benefits. This landmark
//     post-market safety signal overturned the prevailing assumption that hormone
//     therapy was broadly protective, precipitated the FDA class-wide boxed warnings
//     on estrogen products, and moved menopausal estrogen therapy from settled
//     standard of care into active contestation over its risk/benefit balance.
//
// Only high-confidence, DOI-anchored arcs are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-drugsatfda_v1-estradiol-transdermal-menopausal-hormone-therapy.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-drugsatfda_v1-estradiol-transdermal-menopausal-hormone-therapy.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq40spgs0yexsa8sgqdr9f49'

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

// Do NOT duplicate the existing null -> RECORDED first entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1992-12-15',
    datePrecision: 'DAY',
    reason:
      "By the early 1990s estrogen therapy had become broadly adopted standard of care for menopausal vasomotor symptoms and postmenopausal health. The American College of Physicians issued a formal clinical guideline counseling postmenopausal women about preventive hormone therapy, treating estrogen (and estrogen/progestin) regimens as an established, guideline-endorsed option for symptomatic and at-risk postmenopausal women. This institutional endorsement marks the settling of menopausal estrogen therapy as mainstream medical practice.",
    source: {
      externalId: 'src:acp-hormone-therapy-guideline-1992',
      name:
        'American College of Physicians. Guidelines for counseling postmenopausal women about preventive hormone therapy. Annals of Internal Medicine. 1992;117(12):1038-1041.',
      url: 'https://doi.org/10.7326/0003-4819-117-12-1038',
      publishedAt: '1992-12-15',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2002-07-17',
    datePrecision: 'DAY',
    reason:
      "The prevailing assumption that menopausal hormone therapy was broadly protective was overturned by the Women's Health Initiative (WHI). The estrogen-plus-progestin arm of this large randomized, placebo-controlled trial (~16,600 healthy postmenopausal women) was stopped early after an interim analysis found the overall health risks — increased invasive breast cancer, coronary heart disease, stroke, and pulmonary embolism — exceeded the benefits. This landmark post-market safety signal precipitated FDA class-wide boxed warnings on estrogen and estrogen/progestin products, sharply curtailed prescribing, and moved menopausal estrogen therapy from settled standard of care into active contestation over its risk/benefit balance.",
    source: {
      externalId: 'src:whi-estrogen-progestin-jama-2002',
      name:
        'Rossouw JE, Anderson GL, Prentice RL, LaCroix AZ, Kooperberg C, Stefanick ML, et al. Risks and benefits of estrogen plus progestin in healthy postmenopausal women: principal results from the Women\'s Health Initiative randomized controlled trial. JAMA. 2002;288(3):321-333.',
      url: 'https://doi.org/10.1001/jama.288.3.321',
      publishedAt: '2002-07-17',
      methodologyType: 'primary',
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
        ingestedBy: 'enrich:drugsatfda_v1',
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
