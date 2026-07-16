// Enrichment: epistemic trajectory for the Panel on Clinical Practices for the
// Treatment of HIV (DHHS / Henry J. Kaiser Family Foundation), "Guidelines for
// the Use of Antiretroviral Agents in HIV-Infected Adults and Adolescents,"
// Annals of Internal Medicine, 1998.
// DOI: 10.7326/0003-4819-128-12_part_2-199806151-00003 · OpenAlex: W2183940924
//
// Identity verified via Crossref: title "Guidelines for the Use of
// Antiretroviral Agents in HIV-Infected Adults and Adolescents," container
// "Annals of Internal Medicine," Vol 128, Issue 12_Part_2, pages 1079-1100,
// published 1998-06-15, publisher American College of Physicians. This is the
// FIRST edition of the U.S. Department of Health and Human Services (DHHS)
// Panel guidelines for adult/adolescent antiretroviral therapy.
//
// NOT retracted: no match in the Retraction Watch database for the DOI, Crossref
// carries no `update-to` relation, and OpenAlex isRetracted=false. No expression
// of concern found. As a clinical guideline (not an empirical finding), there is
// no "failed replication" surface.
//
// Post-publication trajectory: the 1998 guideline established the enduring U.S.
// standard-of-care framework for HIV — physician-supervised combination
// antiretroviral therapy managed by a clinician experienced in HIV care. That
// framework was continuously maintained through subsequent DHHS Panel updates
// (2001, 2002, 2003, 2004, 2008, 2009, ... on to the living guideline now hosted
// at clinicalinfo.hiv.gov) and was independently reaffirmed by a parallel,
// external expert body — the International Antiviral Society–USA (IAS-USA) Panel.
// The IAS-USA 2020 recommendations, published in JAMA (Saag, Gandhi, Hoy,
// Landovitz, Thompson, Sax, et al.), restate combination ART under experienced-
// clinician supervision as the unquestioned standard of care, adjudicating the
// framework as settled expert consensus.
//
// The claim already carries its baseline null -> RECORDED first entry
// (publication, 1998-06-15). This script adds a single downstream arc:
//   RECORDED -> SETTLED (2020-10-27): an independent, well-cited expert-consensus
//     guideline (IAS-USA / JAMA) reaffirms the standard-of-care framework the
//     1998 DHHS guideline established.
// Community: EXPERT_LITERATURE.
//
// Source URL uses the PubMed record (PMID 33052386), which resolves 200; the
// JAMA doi.org endpoint returns 403 to automated fetches (publisher bot block)
// though the DOI 10.1001/jama.2020.17025 is registered and valid in Crossref.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-dhhs-1998-antiretroviral-guidelines-adults-adolescents.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-dhhs-1998-antiretroviral-guidelines-adults-adolescents.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply4w7o00efsaihfemc4t93'

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

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2020-10-27',
    datePrecision: 'DAY',
    reason:
      'The 1998 DHHS/Kaiser Panel guideline established the enduring U.S. standard-of-care framework for HIV: physician-supervised combination antiretroviral therapy managed by a clinician experienced in HIV care. That framework was independently reaffirmed as settled expert consensus by the International Antiviral Society–USA (IAS-USA) Panel — an external expert body — in its 2020 recommendations published in JAMA, which restate experienced-clinician-supervised combination ART as the standard of care. The guideline was never retracted or subject to an expression of concern.',
    source: {
      externalId: 'src:ias-usa-2020-antiretroviral-recommendations-jama',
      name:
        'Saag MS, Gandhi RT, Hoy JF, Landovitz RJ, Thompson MA, Sax PE, et al. "Antiretroviral Drugs for Treatment and Prevention of HIV Infection in Adults: 2020 Recommendations of the International Antiviral Society–USA Panel." JAMA. 2020 Oct 27;324(16):1651-1669. PMID: 33052386. DOI: 10.1001/jama.2020.17025.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/33052386/',
      publishedAt: '2020-10-27',
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
