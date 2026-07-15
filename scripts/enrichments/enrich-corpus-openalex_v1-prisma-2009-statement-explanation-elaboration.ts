// Enrichment: epistemic trajectory for the PRISMA 2009 Statement
// (Liberati A, Altman DG, Tetzlaff J, Mulrow C, Gøtzsche PC, Ioannidis JPA,
// Clarke M, Devereaux PJ, Kleijnen J, Moher D. "The PRISMA Statement for
// Reporting Systematic Reviews and Meta-Analyses of Studies That Evaluate
// Health Care Interventions: Explanation and Elaboration." Annals of Internal
// Medicine 2009;151(4):W65–W94. DOI 10.7326/0003-4819-151-4-200908180-00136).
//
// The claim already carries its baseline first entry (null -> RECORDED) at the
// Annals publication date 2009-08-18. This script does NOT duplicate it.
//
// Post-publication research:
//   - Retraction / expression of concern: NONE. Crossref `update-to` and
//     `updated-by` are both null for 10.7326/0003-4819-151-4-200908180-00136;
//     no notice on the Annals page or PubMed.
//   - Failed replication: N/A — PRISMA is a reporting guideline (a methods
//     standard), not an empirical finding subject to replication.
//   - Field consensus shift: PRISMA (introduced 2009 as the successor to the
//     1999 QUOROM Statement) became the de facto reporting standard for
//     systematic reviews of health-care interventions, endorsed by hundreds of
//     journals and organisations over the following decade. This is the one
//     dated, citable, verifiable adjudicating event and is added below.
//
// Single downstream arc:
//   RECORDED -> SETTLED (2021-03-29): Page MJ, McKenzie JE, Bossuyt PM, et al.
//     "The PRISMA 2020 statement: an updated guideline for reporting systematic
//     reviews." BMJ 2021;372:n71 (DOI 10.1136/bmj.n71). The PRISMA 2020 update
//     documents that the 2009 PRISMA Statement had become the established,
//     widely adopted reporting standard for systematic reviews across the
//     methods and clinical literature, and revises (rather than overturns) it to
//     reflect a decade of methodological advances. Its issuance by the same
//     expert consortium is the adjudication that the 2009 guideline reached
//     settled consensus as the reference reporting standard for the field.
//   Community: EXPERT_LITERATURE (methods/reporting-guideline consensus).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-prisma-2009-statement-explanation-elaboration.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-prisma-2009-statement-explanation-elaboration.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplzpav6007dsa86xmti7rjr'

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

// Do NOT duplicate the existing null -> RECORDED (Annals publication, 2009-08-18)
// first entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2021-03-29',
    datePrecision: 'DAY',
    reason:
      'The 2009 PRISMA Statement was introduced as the successor to the 1999 QUOROM Statement to improve the transparency and completeness of reporting of systematic reviews and meta-analyses of health-care interventions. Over the following decade it was adopted as the de facto reporting standard for systematic reviews and endorsed by numerous journals and organisations. In 2021 the same expert consortium published the PRISMA 2020 statement (Page et al., BMJ 2021;372:n71), which documents the original guideline\'s widespread adoption and revises it to reflect a decade of methodological advances rather than overturning it. This updated guideline is the adjudicating event establishing that the PRISMA reporting standard reached settled consensus in the methods and clinical literature, moving the claim from RECORDED to SETTLED.',
    source: {
      externalId: 'src:prisma-2020-statement-page-2021',
      name:
        'Page MJ, McKenzie JE, Bossuyt PM, Boutron I, Hoffmann TC, et al. The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. BMJ 2021;372:n71.',
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
