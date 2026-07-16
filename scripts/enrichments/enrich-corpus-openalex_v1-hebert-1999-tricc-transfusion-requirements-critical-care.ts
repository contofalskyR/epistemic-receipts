// Enrichment: epistemic trajectory for Hébert et al. (1999), "A Multicenter,
// Randomized, Controlled Clinical Trial of Transfusion Requirements in Critical
// Care" (the TRICC trial), New England Journal of Medicine.
// DOI: 10.1056/nejm199902113400601 · OpenAlex: W127034668
//
// Identity verified via Crossref (title "A Multicenter, Randomized, Controlled
// Clinical Trial of Transfusion Requirements in Critical Care"; container "New
// England Journal of Medicine"; authors Hébert, Wells, Blajchman, Marshall,
// Martin, Pagliarello, Tweeddale, Schweitzer, Yetisir; published 1999-02-11).
// NOT retracted: Crossref carries no `update-to`, OpenAlex isRetracted=false,
// no expression of concern found.
//
// The trial's central finding is that a restrictive red-cell transfusion
// strategy (threshold ~7 g/dL) is at least as safe as — and not inferior to — a
// liberal strategy (~10 g/dL) in euvolemic critically ill adults, with
// equivalent 30-day mortality. That finding was never retracted or contested;
// it was independently adjudicated and CONFIRMED by a subsequent Cochrane
// systematic review and meta-analysis of transfusion-threshold trials:
//
//   Carson JL, Stanworth SJ, Roubinian N, et al. "Transfusion thresholds and
//   other strategies for guiding allogeneic red blood cell transfusion."
//   Cochrane Database of Systematic Reviews, 12 October 2016.
//   DOI: 10.1002/14651858.CD002042.pub4. This review pooled 31 randomized
//   trials (~12,500 patients), with TRICC as an anchor trial, and concluded
//   that restrictive thresholds (7–8 g/dL) do not increase mortality or
//   morbidity — settling the transfusion-threshold question in the expert
//   literature. The same conclusion was carried into the AABB clinical practice
//   guideline (Carson JL, et al., JAMA, 15 Nov 2016; DOI 10.1001/jama.2016.9185),
//   which recommends the restrictive 7 g/dL threshold TRICC established.
//
// The claim already carries its baseline null -> RECORDED first entry
// (publication, 1999-02-11). This script adds the single downstream arc:
//   RECORDED -> SETTLED (2016-10-12): an independent Cochrane systematic review
//     and meta-analysis confirms the restrictive-transfusion finding.
// Community: EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-hebert-1999-tricc-transfusion-requirements-critical-care.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-hebert-1999-tricc-transfusion-requirements-critical-care.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplzhqkp0127sat09njotyfk'

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

// Do NOT duplicate the existing null -> RECORDED (publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2016-10-12',
    datePrecision: 'DAY',
    reason:
      "The TRICC trial's finding — that a restrictive red-cell transfusion strategy (~7 g/dL) is at least as safe as a liberal one (~10 g/dL) in critically ill adults, with equivalent 30-day mortality — was independently adjudicated and confirmed by Carson et al.'s Cochrane systematic review and meta-analysis (Cochrane Database Syst Rev, 12 Oct 2016), which pooled 31 randomized trials (~12,500 patients) with TRICC as an anchor and concluded that restrictive thresholds (7–8 g/dL) do not increase mortality or morbidity. This independent quantitative synthesis settled the transfusion-threshold question in the expert literature, and the same conclusion was carried into the AABB clinical practice guideline (JAMA, 15 Nov 2016). The paper was never retracted or subject to an expression of concern.",
    source: {
      externalId: 'src:carson-2016-cochrane-transfusion-thresholds-cd002042-pub4',
      name:
        'Carson JL, Stanworth SJ, Roubinian N, et al. "Transfusion thresholds and other strategies for guiding allogeneic red blood cell transfusion." Cochrane Database of Systematic Reviews, 12 October 2016. DOI: 10.1002/14651858.CD002042.pub4.',
      url: 'https://doi.org/10.1002/14651858.CD002042.pub4',
      publishedAt: '2016-10-12',
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
