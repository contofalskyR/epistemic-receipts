// Enrichment: epistemic arc for tofacitinib (TOFACITINIB) FDA-label claim.
//
// Claim id: cmpiyf2qt8uu0plo7o74f3vrf
//   "tofacitinib (TOFACITINIB): (no purpose or indication on label)"
//
// Tofacitinib (Xeljanz) is an oral JAK inhibitor for rheumatoid arthritis.
// Arc: pivotal Phase III evidence (2012) → ACR guideline standard-of-care
// inclusion (2015) → FDA boxed-warning safety reversal after ORAL Surveillance
// (2021).
//
// Idempotent: upserts Source rows on externalId, ClaimStatusHistory rows on id.
// Does NOT create or modify the existing Claim.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-tofacitinib-no-indication.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-tofacitinib-no-indication.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyf2qt8uu0plo7o74f3vrf'

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
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

// NOTE: the existing first ClaimStatusHistory row (fromAxis=null -> first axis)
// is left untouched. These transitions extend the arc from OPEN onward.
const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED: pivotal Phase III evidence in RA (2012) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2012-08-09',
    datePrecision: 'DAY',
    reason:
      'The pivotal Phase III ORAL program results were published in the New England Journal of Medicine on 9 August 2012. Fleischmann et al. reported that tofacitinib monotherapy significantly reduced the signs and symptoms of active rheumatoid arthritis versus placebo (higher ACR20 responses and improved physical function), establishing the first-in-class oral JAK inhibitor as an efficacious disease-modifying therapy. This primary, peer-reviewed clinical evidence moved the drug from an open question to a recorded empirical result.',
    source: {
      externalId: 'src:tofacitinib-nejm-phase3-fleischmann-2012',
      name: 'Fleischmann R, et al. Placebo-Controlled Trial of Tofacitinib Monotherapy in Rheumatoid Arthritis. N Engl J Med 2012;367:495–507.',
      url: 'https://doi.org/10.1056/NEJMoa1109071',
      publishedAt: '2012-08-09',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: ACR guideline standard-of-care inclusion (2015) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2015-11-06',
    datePrecision: 'DAY',
    reason:
      'Following FDA approval in November 2012, the 2015 American College of Rheumatology Guideline for the Treatment of Rheumatoid Arthritis formally incorporated tofacitinib into the recommended treatment algorithm alongside conventional and biologic DMARDs. Inclusion by the primary specialty body settled the drug\'s status as an accepted standard-of-care option for established RA. The guideline was published by the ACR as an authoritative institutional recommendation.',
    source: {
      externalId: 'src:acr-ra-guideline-2015-tofacitinib',
      name: 'Singh JA, et al. 2015 American College of Rheumatology Guideline for the Treatment of Rheumatoid Arthritis. Arthritis Care Res (Hoboken) 2016;68(1):1–25.',
      url: 'https://doi.org/10.1002/acr.22783',
      publishedAt: '2015-11-06',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: ORAL Surveillance safety signal / FDA boxed warning (2021) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2021-09-01',
    datePrecision: 'DAY',
    reason:
      'On 1 September 2021 the FDA required new and updated boxed warnings for tofacitinib and other JAK inhibitors after final results of the mandated ORAL Surveillance safety trial showed increased risks of serious heart-related events, cancer, blood clots, and death compared with TNF inhibitors. The agency also limited approved use to patients with an inadequate response or intolerance to TNF blockers. This post-market safety reversal reopened the benefit–risk consensus, moving the settled standard-of-care status to contested.',
    source: {
      externalId: 'src:fda-jak-boxed-warning-2021',
      name: 'FDA Drug Safety Communication: FDA requires warnings about increased risk of serious heart-related events, cancer, blood clots, and death for JAK inhibitors that treat certain chronic inflammatory conditions (Sept 1, 2021).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-requires-warnings-about-increased-risk-serious-heart-related-events-cancer-blood-clots-and-death',
      publishedAt: '2021-09-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions${DRY_RUN ? ' [dry-run]' : ''}`,
  )

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(
        `  [dry] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`,
      )
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
        ingestedBy: 'enrich:openfda_labels_v1:tofacitinib-no-indication',
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

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} (${histId})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
