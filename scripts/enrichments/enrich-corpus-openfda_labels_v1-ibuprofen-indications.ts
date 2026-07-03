// Enrichment: epistemic arc for the OTC/Rx analgesic-antiinflammatory active
// ingredient ibuprofen behind an "Ibuprofen Tablets" FDA drug label.
//
// Claim: cmpiylqxu92joplo79mx2u3lf (openfda_labels_v1)
//   "Ibuprofen (IBUPROFEN): INDICATIONS AND USAGE ... indicated for relief of
//    the signs and symptoms of rheumatoid arthritis and osteoarthritis ...
//    relief of mild to moderate pain ..."
//
// The label's INDICATIONS claim rides on ibuprofen's status as an established
// NSAID for arthritis and pain. That status has a real, dateable clinical arc:
//   OPEN -> RECORDED  (1969): First published controlled clinical experience of
//                             ibuprofen in rheumatoid arthritis (Chalmers, ARD).
//   RECORDED -> SETTLED (2012): American College of Rheumatology osteoarthritis
//                             treatment recommendations embed oral ibuprofen as
//                             a standard-of-care NSAID option -> guideline status.
//   SETTLED -> CONTESTED (2015): FDA strengthens the heart-attack/stroke warning
//                             on all non-aspirin NSAIDs, reopening the safety
//                             risk-benefit question the label itself flags.
//
// Does NOT create a Claim (claim already exists). Idempotent upserts.
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-ibuprofen-indications.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiylqxu92joplo79mx2u3lf'

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
  // ── OPEN -> RECORDED: first published clinical trial evidence in RA ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1969-09-01',
    datePrecision: 'MONTH',
    reason:
      'Chalmers reported the first controlled clinical experience of ibuprofen in the treatment of rheumatoid arthritis in the Annals of the Rheumatic Diseases (1969;28(5):513-517), documenting symptomatic relief and tolerability shortly after the drug\'s UK introduction. This entered the peer-reviewed rheumatology literature the core efficacy claim — relief of the signs and symptoms of rheumatoid arthritis — that the FDA label later asserts.',
    source: {
      externalId: 'src:chalmers-1969-ibuprofen-rheumatoid-arthritis',
      name: 'Chalmers TM. Clinical experience with ibuprofen in the treatment of rheumatoid arthritis. Ann Rheum Dis. 1969;28(5):513-517.',
      url: 'https://doi.org/10.1136/ard.28.5.513',
      publishedAt: '1969-09-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: professional-society guideline standard-of-care ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2012-04-01',
    datePrecision: 'MONTH',
    reason:
      'The American College of Rheumatology 2012 recommendations for the use of nonpharmacologic and pharmacologic therapies in osteoarthritis of the hand, hip, and knee (Arthritis Care Res. 2012;64(4):465-474) embed oral NSAIDs such as ibuprofen as a conditionally recommended standard-of-care pharmacologic option. Inclusion in a definitive professional-society guideline reflects broad clinical adoption of ibuprofen for the osteoarthritis and pain indications the label carries.',
    source: {
      externalId: 'src:acr-2012-osteoarthritis-recommendations',
      name: 'Hochberg MC, et al. American College of Rheumatology 2012 recommendations for the use of nonpharmacologic and pharmacologic therapies in osteoarthritis of the hand, hip, and knee. Arthritis Care Res (Hoboken). 2012;64(4):465-474.',
      url: 'https://doi.org/10.1002/acr.21596',
      publishedAt: '2012-04-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: FDA strengthens NSAID cardiovascular warning ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2015-07-09',
    datePrecision: 'DAY',
    reason:
      'On 9 July 2015 the FDA issued a Drug Safety Communication strengthening the existing label warning that non-aspirin NSAIDs, including ibuprofen, increase the risk of heart attack and stroke — a risk that can occur early in treatment and rise with dose and duration. This reopened the risk-benefit determination that the label\'s own "carefully consider the potential benefits and risks / use the lowest effective dose" language flags, contesting the settled safety profile of the indications claim.',
    source: {
      externalId: 'src:fda-dsc-2015-nsaid-heart-attack-stroke',
      name: 'FDA Drug Safety Communication: FDA strengthens warning that non-aspirin nonsteroidal anti-inflammatory drugs (NSAIDs) can cause heart attacks or strokes (9 July 2015).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-fda-strengthens-warning-non-aspirin-nonsteroidal-anti-inflammatory',
      publishedAt: '2015-07-09',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1-ibuprofen-indications',
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`\nDone. ${TRANSITIONS.length} transitions upserted for ${CLAIM_ID}.`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
