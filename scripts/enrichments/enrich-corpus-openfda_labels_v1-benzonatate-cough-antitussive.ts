// Enrichment: epistemic trajectory for the openFDA label claim covering
// BENZONATATE (Tessalon) — indicated for the symptomatic relief of cough.
//
// The subject fact is benzonatate as a non-narcotic (non-opioid) oral antitussive
// for symptomatic cough relief. The claim already carries its null -> RECORDED
// first entry (the drug's entry into the clinical/regulatory record — FDA approval
// of the indication that benzonatate relieves cough). This script adds the
// downstream arc:
//
//   RECORDED -> SETTLED (by ~2000): Benzonatate became the principal FDA-approved
//     non-opioid oral antitussive and one of the most commonly prescribed cough
//     medicines in the United States, with generic availability and tens of
//     millions of dispensings. Broad, durable market adoption settled its status
//     as standard symptomatic therapy for cough.
//
//   SETTLED -> CONTESTED (2010): The FDA issued a Drug Safety Communication after
//     reports of death from overdose following accidental ingestion of benzonatate
//     (Tessalon) by children under 10 years of age, and after reports of deaths and
//     serious adverse events in intentional/accidental overdoses. This post-market
//     safety signal — later analyzed in an FDA-authored review of overdose reports
//     from 1969-2010 — put the drug's safety margin, pediatric contraindication,
//     and packaging into active contestation, even as the cough indication itself
//     remained approved.
//
// Only high-confidence, canonical URLs (DOI + Wikipedia verification surface, the
// same surface used by scripts/seed-human-history-trajectories.ts) are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-benzonatate-cough-antitussive.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-benzonatate-cough-antitussive.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiykv3391hiplo79hshiysg'

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

// Do NOT duplicate the existing null -> RECORDED first entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'MARKET',
    occurredAt: '2000-01-01',
    datePrecision: 'YEAR',
    reason:
      "First approved by the FDA in 1958 as one of the earliest non-narcotic oral antitussives, benzonatate (Tessalon) grew over the following decades into the principal non-opioid prescription cough medicine in the United States. With patent expiry and broad generic availability it became one of the most commonly dispensed antitussives — tens of millions of prescriptions annually — settling its status as standard symptomatic therapy for cough. This durable, broad market adoption ratified the indication as established clinical practice rather than a novel or contested treatment.",
    source: {
      externalId: 'src:benzonatate-antitussive-adoption',
      name:
        'Benzonatate — non-narcotic oral antitussive first approved by the U.S. FDA in 1958; widely prescribed generic cough medicine (drug reference summary).',
      url: 'https://en.wikipedia.org/wiki/Benzonatate',
      publishedAt: '2000-01-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2010-12-14',
    datePrecision: 'DAY',
    reason:
      "In December 2010 the FDA issued a Drug Safety Communication warning that death from overdose can result from accidental ingestion of benzonatate (Tessalon) by children under 10 years of age, and that overdose in older patients has produced fatalities and serious adverse events (seizures, cardiac arrest). An FDA-authored analysis of benzonatate overdose reports from 1969-2010 documented the narrow margin between therapeutic and toxic effects. This post-market safety signal moved the drug from settled standard therapy into active contestation over its safety margin, pediatric contraindication, and child-resistant packaging — even as the cough indication itself remained FDA-approved.",
    source: {
      externalId: 'src:benzonatate-fda-overdose-analysis-2013',
      name:
        'McLawhorn MW, Goulding MR, Gill RK, Michele TM. Analysis of benzonatate overdoses among adults and children from 1969-2010 by the United States Food and Drug Administration. Pharmacotherapy. 2013;33(1):38-43.',
      url: 'https://doi.org/10.1002/phar.1153',
      publishedAt: '2013-01-01',
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
