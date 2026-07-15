// Enrichment: epistemic trajectory for Guyatt, Oxman, Vist, Kunz, Falck-Ytter,
// Alonso-Coello & Schünemann (2008), "GRADE: an emerging consensus on rating
// quality of evidence and strength of recommendations," BMJ 2008;336:924.
// DOI 10.1136/bmj.39489.470347.AD. OpenAlex W2165010366.
//
// This is the flagship article of the BMJ GRADE series. Its claim: existing
// guidelines are inconsistent in how they rate evidence quality and
// recommendation strength, and the GRADE system — then "increasingly being
// adopted by organisations worldwide" — offers a unified approach.
//
// Post-publication research state (verified via Crossref, 2026-07-15):
//   - No retraction, expression of concern, or erratum. Crossref returns null
//     for both `update-to` and `updated-by` on the DOI, and the DOI resolves.
//   - The claim was VINDICATED, not contested. The "emerging consensus" of 2008
//     became the settled international standard: GRADE was formally codified as
//     an operational methodology and adopted by WHO, the Cochrane
//     Collaboration, NICE, UpToDate, and 100+ organisations worldwide.
//
// The claim already carries its baseline first entry (null -> RECORDED at the
// 2008-04-24 publication). This script adds a single downstream arc:
//
//   RECORDED -> SETTLED (2011-04): The GRADE Working Group's "GRADE guidelines"
//     series in the Journal of Clinical Epidemiology — beginning with Guyatt et
//     al., "GRADE guidelines: 1. Introduction—GRADE evidence profiles and
//     summary of findings tables" (J Clin Epidemiol 2011;64(4):383-94) — moved
//     GRADE from an "emerging consensus" to a fully codified, operationalized
//     methodology. By this point GRADE was the adopted evidence-rating standard
//     of WHO, Cochrane, and dozens of guideline bodies, adjudicating the 2008
//     claim as settled expert-literature consensus rather than overturning it.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-guyatt-2008-grade-evidence-rating.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-guyatt-2008-grade-evidence-rating.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm9p5f140sasaerp9fbl5az'

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

// Do NOT duplicate the existing null -> RECORDED (2008 publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2011-04-01',
    datePrecision: 'MONTH',
    reason:
      'The GRADE Working Group\'s "GRADE guidelines" series in the Journal of Clinical Epidemiology, opening with Guyatt et al., "GRADE guidelines: 1. Introduction—GRADE evidence profiles and summary of findings tables" (J Clin Epidemiol 2011;64(4):383-94), codified GRADE from the "emerging consensus" of the 2008 BMJ article into a fully operationalized methodology with standard evidence profiles and summary-of-findings tables. By 2011 GRADE was the adopted evidence-rating standard of the WHO, the Cochrane Collaboration, and NICE, and had been endorsed by dozens of guideline organizations worldwide. This dated, highly cited expert-literature series adjudicates the 2008 claim as settled and authoritative rather than reversing it.',
    source: {
      externalId: 'src:jce-guyatt-2011-grade-guidelines-1',
      name:
        'G.H. Guyatt et al., "GRADE guidelines: 1. Introduction—GRADE evidence profiles and summary of findings tables," Journal of Clinical Epidemiology 2011;64(4):383-394. DOI 10.1016/j.jclinepi.2010.04.026.',
      url: 'https://doi.org/10.1016/j.jclinepi.2010.04.026',
      publishedAt: '2011-04-01',
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
