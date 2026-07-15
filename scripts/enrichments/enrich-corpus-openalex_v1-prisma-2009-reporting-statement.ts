// Enrichment: epistemic trajectory for Moher, Liberati, Tetzlaff, Altman &
// the PRISMA Group (2009), "The PRISMA Statement for Reporting Systematic
// Reviews and Meta-Analyses of Studies That Evaluate Health Care
// Interventions: Explanation and Elaboration," PLoS Medicine 6(7): e1000100.
// DOI 10.1371/journal.pmed.1000100. OpenAlex W3022903699.
//
// This is the founding PRISMA reporting guideline (with its companion BMJ
// statement, DOI 10.1136/bmj.b2535), which replaced the 1999 QUOROM Statement
// and became the international standard for transparent reporting of
// systematic reviews and meta-analyses of health care interventions.
//
// Post-publication research state:
//   - No retraction, expression of concern, or erratum exists. Crossref returns
//     an empty `update-to` for the DOI and the DOI resolves.
//   - The guideline was NOT overturned. It was widely adopted (endorsed by
//     hundreds of journals and by the EQUATOR Network), and in 2021 it was
//     formally updated — not retracted — by the same authorship/EQUATOR
//     ecosystem via the PRISMA 2020 Statement.
//
// The claim already carries its baseline first entry (null -> RECORDED at the
// 2009 publication). This script adds a single downstream arc:
//
//   RECORDED -> SETTLED (2021-03-29): Page et al., "The PRISMA 2020 statement:
//     an updated guideline for reporting systematic reviews" (BMJ 2021;372:n71)
//     is the official update to the 2009 statement. It reaffirms and carries
//     forward the PRISMA framework as the operative reporting standard,
//     refining checklist items in light of a decade of methodological advances
//     and use rather than reversing the original. A dated, institutional
//     consensus document adjudicating the 2009 guideline as settled and
//     authoritative.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-prisma-2009-reporting-statement.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-prisma-2009-reporting-statement.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplyo8ep00fhsaqkqwfnh0pq'

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

// Do NOT duplicate the existing null -> RECORDED (2009 publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2021-03-29',
    datePrecision: 'DAY',
    reason:
      'Page et al., "The PRISMA 2020 statement: an updated guideline for reporting systematic reviews" (BMJ 2021;372:n71, published 29 March 2021), is the official update to the 2009 PRISMA Statement. It was produced by the PRISMA authorship group within the EQUATOR Network and reaffirms the PRISMA framework as the operative international standard for reporting systematic reviews, refining and expanding the checklist to reflect a decade of methodological advances and use rather than retracting or reversing the 2009 guideline. Combined with the guideline\'s adoption by hundreds of journals, this constitutes institutional consensus that the 2009 statement is settled and authoritative.',
    source: {
      externalId: 'src:bmj-page-2021-prisma-2020-statement',
      name:
        'M.J. Page et al., "The PRISMA 2020 statement: an updated guideline for reporting systematic reviews," BMJ 2021;372:n71 (29 March 2021). DOI 10.1136/bmj.n71.',
      url: 'https://doi.org/10.1136/bmj.n71',
      publishedAt: '2021-03-29',
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
