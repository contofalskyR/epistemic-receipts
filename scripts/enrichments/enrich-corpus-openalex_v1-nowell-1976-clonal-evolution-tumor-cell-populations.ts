// Enrichment: epistemic trajectory for Peter C. Nowell (1976),
// "The Clonal Evolution of Tumor Cell Populations,"
// Science 194(4260):23–28. DOI: 10.1126/science.959840 · OpenAlex: W1967304777
//
// Nowell's paper PROPOSES the clonal-evolution model of cancer: most neoplasms
// arise from a single cell of origin, and tumor progression results from acquired
// genetic variability within the original clone that permits sequential selection
// of increasingly aggressive sublines (with elevated genetic instability in tumor
// cells relative to normal cells). In 1976 this was an explicitly framed hypothesis.
//
// The paper has no retraction, expression of concern, or failed replication. Over
// the following decades, genome-wide sequencing of tumors converted the proposal
// into the dominant paradigm of cancer biology. The claim already carries its
// publication (null -> RECORDED, 1976-10) first entry. This script adds the single
// downstream adjudicating arc:
//   RECORDED -> SETTLED (2012-01): Greaves M & Maley CC, "Clonal evolution in
//     cancer," Nature 481(7381):306–313 — the landmark modern synthesis that
//     re-examines Nowell's framework in light of cancer-genome sequencing and
//     confirms it. The review states cancers evolve "by a reiterative process of
//     clonal expansion, genetic diversification and clonal selection," restating
//     and ratifying Nowell's central thesis as established, Darwinian consensus.
//     There was no substantive prior contest of the model itself, so this is a
//     direct RECORDED -> SETTLED.
//
// Community: EXPERT_LITERATURE (adjudicated by a landmark peer-reviewed synthesis).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nowell-1976-clonal-evolution-tumor-cell-populations.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nowell-1976-clonal-evolution-tumor-cell-populations.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplzw7s107u1sat0awwinjk6'

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

// Do NOT duplicate the existing null -> RECORDED (publication, 1976-10) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2012-01-01',
    datePrecision: 'MONTH',
    reason:
      "Greaves M & Maley CC, 'Clonal evolution in cancer,' Nature 481(7381):306–313 (Jan 2012), is the landmark synthesis that re-examines Nowell's 1976 clonal-evolution model in light of genome-wide tumor sequencing and confirms it: cancers evolve 'by a reiterative process of clonal expansion, genetic diversification and clonal selection within the adaptive landscapes of tissue ecosystems.' By the time of this heavily cited review, single-cell-of-origin clonality, acquired genetic instability, and Darwinian selection of aggressive sublines — Nowell's original proposals — had become the established consensus framework of cancer biology. This ratifies the claim as SETTLED expert-literature consensus; the model itself faced no substantive prior contest, so the arc is a direct RECORDED -> SETTLED.",
    source: {
      externalId: 'src:greaves-maley-2012-clonal-evolution-cancer',
      name:
        'Greaves M, Maley CC. Clonal evolution in cancer. Nature. 2012 Jan 19;481(7381):306–313. doi:10.1038/nature10762. PMID: 22258609.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/22258609/',
      publishedAt: '2012-01-19',
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
