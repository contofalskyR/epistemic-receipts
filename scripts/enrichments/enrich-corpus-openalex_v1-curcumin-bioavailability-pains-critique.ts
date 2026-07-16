// Enrichment: epistemic trajectory for Anand et al. (2007),
// "Bioavailability of Curcumin: Problems and Promises,"
// Molecular Pharmaceutics, DOI 10.1021/mp700113r (OpenAlex W1976194786).
//
// The paper reviewed curcumin's claimed "diverse pharmacologic effects"
// (anti-inflammatory, antioxidant, antiproliferative, antiangiogenic), its
// safety at high doses, and its poor bioavailability — framing the field as one
// of "problems and promises," with nano/adjuvant formulations offered as the
// route to therapeutic viability.
//
// The claim already carries its baseline entry (null -> RECORDED at publication,
// 2007-11-14). This script adds the single downstream arc:
//
//   RECORDED -> CONTESTED (2017-01-11): Nelson, Dahlin, Bisson, Graham, Pauli &
//     Walters, "The Essential Medicinal Chemistry of Curcumin" (J. Med. Chem.,
//     online ASAP 2017-01-11; print 2017-03-09; DOI 10.1021/acs.jmedchem.6b00975;
//     PMID 28074653). This highly-cited expert critique classified curcumin as a
//     PAINS (pan-assay interference compound) and IMPS (invalid metabolic
//     panacea), argued that no double-blind, placebo-controlled clinical trial of
//     curcumin had ever succeeded, and concluded that its chemical instability,
//     reactivity, and poor bioavailability make it an improbable drug lead —
//     directly contesting the therapeutic-"promise" framing of the 2007 review.
//     (It reinforces, rather than contests, the poor-bioavailability half.)
//
// Community: EXPERT_LITERATURE. No retraction, expression of concern, or
// adjudicating meta-analysis that settles the therapeutic question either way was
// found; the arc stops at CONTESTED.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-curcumin-bioavailability-pains-critique.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-curcumin-bioavailability-pains-critique.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply4qzu00brsaihi92quo3b'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2017-01-11',
    datePrecision: 'DAY',
    reason:
      'Nelson, Dahlin, Bisson, Graham, Pauli, and Walters published "The Essential Medicinal Chemistry of Curcumin" (Journal of Medicinal Chemistry, online 11 January 2017; print 9 March 2017; PMID 28074653), a widely cited expert critique that classified curcumin as a PAINS (pan-assay interference compound) and IMPS (invalid metabolic panacea). It argued that no double-blind, placebo-controlled clinical trial of curcumin had ever succeeded and that curcumin\'s chemical instability, reactivity, and poor bioavailability make it an improbable therapeutic lead. This directly contested the "promises" framing of the 2007 review — that curcumin\'s diverse pharmacologic effects could be translated into therapy via improved-delivery formulations — while reinforcing its poor-bioavailability finding.',
    source: {
      externalId: 'src:nelson-2017-essential-medicinal-chemistry-curcumin',
      name:
        'Nelson KM, Dahlin JL, Bisson J, Graham J, Pauli GF, Walters MA. The Essential Medicinal Chemistry of Curcumin. J Med Chem. 2017;60(5):1620–1637. DOI 10.1021/acs.jmedchem.6b00975. PMID 28074653.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/28074653/',
      publishedAt: '2017-01-11',
      methodologyType: 'opinion',
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
