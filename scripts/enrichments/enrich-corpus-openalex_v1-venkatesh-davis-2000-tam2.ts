// Enrichment: epistemic trajectory for Venkatesh & Davis (2000), "A Theoretical
// Extension of the Technology Acceptance Model: Four Longitudinal Field Studies,"
// Management Science 46(2): 186–204. DOI 10.1287/mnsc.46.2.186.11926.
// OpenAlex W2168569455.
//
// This is the founding statement of TAM2 — the extension of the Technology
// Acceptance Model that explains perceived usefulness and usage intentions in
// terms of social influence processes (subjective norm, voluntariness, image)
// and cognitive instrumental processes (job relevance, output quality, result
// demonstrability, perceived ease of use), tested with longitudinal data across
// four systems (N = 156) spanning voluntary and mandatory usage settings.
//
// Post-publication research state:
//   - No retraction, expression of concern, or erratum exists. Crossref returns
//     an empty `update-to` and the DOI resolves (302 -> pubsonline.informs.org).
//   - The finding was never contested; instead it was adjudicated and vindicated
//     by a large meta-analysis of the accumulated TAM literature. TAM2's central
//     novel contribution — that subjective norm (social influence) drives
//     perceived usefulness and usage intentions, moderated by voluntariness and
//     experience — is exactly the effect that meta-analysis pooled and confirmed.
//
// The claim already carries its baseline first entry (null -> RECORDED at the
// 2000 publication). This script adds the downstream arc:
//
//   RECORDED -> SETTLED (2007-01): Schepers & Wetzels, "A meta-analysis of the
//     technology acceptance model: Investigating subjective norm and moderation
//     effects" (Information & Management 44(1): 90–103), pools effect sizes
//     across the accumulated TAM/TAM2 literature and confirms that subjective
//     norm significantly affects perceived usefulness and usage intentions — the
//     core social-influence extension TAM2 introduced — including its moderation
//     by usage context. A dated, highly cited (>1,100 citations) expert-literature
//     adjudication that vindicates the finding. There was no prior contest, so
//     this is a direct RECORDED -> SETTLED at the meta-analysis publication.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-venkatesh-davis-2000-tam2.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-venkatesh-davis-2000-tam2.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxl4m2009dsa7fmf26fgco'

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

// Do NOT duplicate the existing null -> RECORDED (2000 publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-01-01',
    datePrecision: 'MONTH',
    reason:
      'Schepers & Wetzels, "A meta-analysis of the technology acceptance model: Investigating subjective norm and moderation effects" (Information & Management 44(1): 90–103, Jan 2007), pools effect sizes across the accumulated TAM literature and specifically tests the subjective-norm extension that TAM2 introduced. It confirms that subjective norm (social influence) has a significant effect on perceived usefulness and usage intentions, and examines the moderating role of usage context — directly vindicating TAM2\'s central theoretical contribution. As a dated, highly cited (>1,100 citations) meta-analytic adjudication with no prior contest of the finding, this settles the claim in the expert literature.',
    source: {
      externalId: 'src:im-schepers-wetzels-2007-tam-metaanalysis-subjective-norm',
      name:
        'J. Schepers & M. Wetzels, "A meta-analysis of the technology acceptance model: Investigating subjective norm and moderation effects," Information & Management 44(1): 90–103 (January 2007). DOI 10.1016/j.im.2006.10.007.',
      url: 'https://doi.org/10.1016/j.im.2006.10.007',
      publishedAt: '2007-01-01',
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
