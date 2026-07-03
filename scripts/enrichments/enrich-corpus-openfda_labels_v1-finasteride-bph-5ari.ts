// Enrichment: epistemic trajectory for an openFDA-label-ingested claim asserting
// finasteride (a 5α-reductase inhibitor) is indicated for symptomatic benign
// prostatic hyperplasia (BPH), including in combination with the alpha-blocker
// doxazosin.
//
// The claim already has its OPEN/null -> RECORDED first entry (the FDA label
// itself, claimEmergedAt 2026-05-12). This script adds the historical epistemic
// arc that predates and surrounds that label:
//
//   OPEN -> RECORDED (1992): The pivotal double-blind, placebo-controlled Phase III
//     trial (Gormley et al., Finasteride Study Group, N Engl J Med 1992) first
//     published clinical evidence that finasteride shrinks the prostate and
//     improves urinary symptoms in men with BPH — the primary evidence underlying
//     the indication.
//
//   RECORDED -> SETTLED (2003): The MTOPS trial (McConnell et al., N Engl J Med
//     2003) established the long-term clinical-progression benefit of finasteride
//     and, crucially, of finasteride + doxazosin combination therapy — settling
//     finasteride (alone and in combination) as standard-of-care for BPH and
//     directly underpinning the combination-with-doxazosin indication in the label.
//
//   SETTLED -> CONTESTED (2011): The FDA Drug Safety Communication warning that
//     5-alpha reductase inhibitors (finasteride, dutasteride) may increase the risk
//     of a more serious (high-grade) form of prostate cancer introduced a
//     post-market safety signal contesting the drug class's benefit/risk balance.
//
// Only high-confidence, DOI-/.gov-anchored arcs are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-finasteride-bph-5ari.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-finasteride-bph-5ari.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpixy8zw8c2cplo79lll7mra'

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

// Do NOT duplicate the existing null -> RECORDED label entry; the transitions
// below encode the historical clinical arc. The 1992 OPEN -> RECORDED marker
// records the first-published primary evidence (which historically precedes the
// 2026 label snapshot but is the true epistemic origin of the indication).
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1992-10-22',
    datePrecision: 'DAY',
    reason:
      "The clinical proposition that finasteride, a 5α-reductase inhibitor, benefits men with benign prostatic hyperplasia was first established by the pivotal Phase III randomized, double-blind, placebo-controlled trial of the Finasteride Study Group. Over 12 months, finasteride 5 mg significantly reduced prostate volume, increased maximum urinary flow rate, and improved obstructive symptom scores versus placebo. This primary evidence recorded the empirical basis for the BPH indication later carried in the FDA label.",
    source: {
      externalId: 'src:gormley-finasteride-bph-nejm-1992',
      name:
        'Gormley GJ, Stoner E, Bruskewitz RC, Imperato-McGinley J, Walsh PC, McConnell JD, et al. The effect of finasteride in men with benign prostatic hyperplasia. The Finasteride Study Group. N Engl J Med. 1992;327(17):1185-1191.',
      url: 'https://doi.org/10.1056/NEJM199210223271701',
      publishedAt: '1992-10-22',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2003-12-18',
    datePrecision: 'DAY',
    reason:
      "The Medical Therapy of Prostatic Symptoms (MTOPS) trial settled finasteride's role in BPH by demonstrating a durable clinical-progression benefit over 4.5 years. Finasteride reduced the long-term risk of overall clinical progression, acute urinary retention, and the need for invasive surgery, and combination therapy with the alpha-blocker doxazosin was superior to either agent alone. This established finasteride, including the finasteride-plus-doxazosin combination, as standard-of-care medical therapy for BPH and directly underpins the combination indication in the label.",
    source: {
      externalId: 'src:mtops-mcconnell-nejm-2003',
      name:
        'McConnell JD, Roehrborn CG, Bautista OM, Andriole GL Jr, Dixon CM, Kusek JW, et al. The long-term effect of doxazosin, finasteride, and combination therapy on the clinical progression of benign prostatic hyperplasia. N Engl J Med. 2003;349(25):2387-2398.',
      url: 'https://doi.org/10.1056/NEJMoa030656',
      publishedAt: '2003-12-18',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2011-06-09',
    datePrecision: 'DAY',
    reason:
      "A post-market safety signal contested the class benefit/risk profile when the FDA issued a Drug Safety Communication warning that 5-alpha reductase inhibitors (5-ARIs), including finasteride, may increase the risk of a more serious, high-grade form of prostate cancer. Drawing on the PCPT and REDUCE prevention trials, the FDA required labeling changes across the 5-ARI class. While the BPH indication itself was retained, the finding reopened active debate over the drugs' overall safety and appropriate use.",
    source: {
      externalId: 'src:fda-5ari-highgrade-prostate-cancer-2011',
      name:
        'U.S. Food and Drug Administration. FDA Drug Safety Communication: 5-alpha reductase inhibitors (5-ARIs) may increase the risk of a more serious form of prostate cancer. June 9, 2011.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/5-alpha-reductase-inhibitors-5-aris-may-increase-risk-more-serious-form-prostate-cancer',
      publishedAt: '2011-06-09',
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
        ingestedBy: 'enrich:openfda_labels_v1',
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
