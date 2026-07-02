// Enrichment: epistemic arc for the FDA-label claim
// "adapalene and benzoyl peroxide gel ... topical treatment of acne vulgaris in
// patients 9 years of age and older" (claim cmpiyntwf9550plo7jxujxxls).
//
// The generic label was approved 2026-11-23, but the underlying fact — that a
// fixed-dose adapalene 0.1% / benzoyl peroxide 2.5% gel is an effective, safe
// acne therapy — has a decades-long epistemic arc that predates this generic
// approval:
//   1. OPEN   -> RECORDED : pivotal Phase III RCT (Thiboutot et al., JAAD 2007)
//   2. RECORDED -> SETTLED: AAD guideline recommends fixed-dose retinoid+BPO (2016)
//   3. SETTLED -> CONTESTED: FDA benzene-contamination signal & recalls (2025)
//
// Does NOT create a new Claim — enriches the existing openfda_labels_v1 claim.
// The existing null->first ClaimStatusHistory entry is left untouched.
//
// Idempotent: upserts source + claimStatusHistory on stable ids.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-adapalene-bpo-acne.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-adapalene-bpo-acne.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyntwf9550plo7jxujxxls'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
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
  // ── OPEN -> RECORDED : first published pivotal Phase III trial ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-11-01',
    datePrecision: 'MONTH',
    reason:
      'The pivotal multicenter, randomized, double-blind, controlled Phase III trial of the fixed-dose adapalene 0.1% / benzoyl peroxide 2.5% gel was published by Thiboutot et al. in the Journal of the American Academy of Dermatology (November 2007). It demonstrated that the fixed-dose combination was significantly more effective than either monotherapy or vehicle in reducing inflammatory and non-inflammatory acne lesions, establishing the combination in the peer-reviewed clinical record. These results underpinned the original FDA approval of the fixed-dose product (Epiduo).',
    source: {
      externalId: 'src:thiboutot-adapalene-bpo-jaad-2007',
      name: 'Thiboutot D, Zaenglein A, Weiss J, et al. Adapalene-benzoyl peroxide, a fixed-dose combination for the treatment of acne vulgaris: results of a multicenter, randomized double-blind, controlled study. J Am Acad Dermatol. 2007;57(5):791-799.',
      url: 'https://doi.org/10.1016/j.jaad.2007.06.006',
      publishedAt: '2007-11-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED : major clinical guideline inclusion ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-05-01',
    datePrecision: 'MONTH',
    reason:
      'The American Academy of Dermatology "Guidelines of care for the management of acne vulgaris" (Zaenglein et al., JAAD, May 2016) recommended fixed-dose combination topical therapy — a topical retinoid together with benzoyl peroxide — as a mainstay of acne treatment, explicitly endorsing adapalene/benzoyl peroxide combinations. Guideline incorporation by the leading dermatology professional body marked the combination as settled standard-of-care rather than merely a recorded trial result.',
    source: {
      externalId: 'src:aad-acne-guidelines-2016',
      name: 'Zaenglein AL, Pathy AL, Schlosser BJ, et al. Guidelines of care for the management of acne vulgaris. J Am Acad Dermatol. 2016;74(5):945-973.e33.',
      url: 'https://doi.org/10.1016/j.jaad.2015.12.037',
      publishedAt: '2016-05-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED : post-market benzene safety signal & recalls ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2025-03-11',
    datePrecision: 'DAY',
    reason:
      'On March 11, 2025 the FDA announced that its own laboratory testing found elevated levels of benzene — a known human carcinogen — in some benzoyl peroxide acne products, and that several manufacturers were recalling affected lots. Because benzoyl peroxide can degrade to form benzene, particularly at elevated temperatures, the finding placed a post-market chemistry/safety cloud over the benzoyl-peroxide half of the fixed-dose combination, contesting the previously settled safety profile even as the drug remained indicated and marketed.',
    source: {
      externalId: 'src:fda-benzene-benzoyl-peroxide-2025',
      name: 'U.S. Food and Drug Administration. FDA actions on benzene in benzoyl peroxide acne products (March 11, 2025).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-actions-benzene-benzoyl-peroxide-acne-products',
      publishedAt: '2025-03-11',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions${DRY_RUN ? ' [DRY RUN]' : ''}...`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    console.error(`  ✗ Claim ${CLAIM_ID} not found — aborting.`)
    await prisma.$disconnect()
    process.exit(1)
  }

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${slug} (${tr.fromAxis} -> ${tr.toAxis}) src=${tr.source.externalId}`)
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
        ingestedBy: 'enrich:openfda_labels_v1-adapalene-bpo-acne',
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

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId: CLAIM_ID, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`\nDone. ${TRANSITIONS.length} transitions enriched for ${CLAIM_ID}.`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
