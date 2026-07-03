// Enrichment: epistemic trajectory for the openFDA label claim that BENZONATATE
// capsules are "indicated for the symptomatic relief of cough."
//
// Benzonatate (Tessalon) is a peripherally acting, non-narcotic antitussive first
// approved by the FDA in 1958. The claim already carries its null -> RECORDED first
// entry (the approval / first published clinical evidence that benzonatate suppresses
// cough). This script adds the downstream arc:
//
//   RECORDED -> SETTLED (2006): The American College of Chest Physicians (ACCP/CHEST)
//     published evidence-based clinical practice guidelines on the diagnosis and
//     management of cough, treating non-narcotic antitussives (including benzonatate)
//     as an established, guideline-recognized option for symptomatic cough relief.
//     This professional-society endorsement reflects benzonatate's status as broadly
//     adopted standard-of-care symptomatic therapy.
//
//   SETTLED -> CONTESTED (2010): The FDA issued a Drug Safety Communication warning
//     that accidental ingestion of even a small number of benzonatate capsules had
//     caused fatal overdoses in children under 10 years of age, and that benzonatate
//     is not indicated for and should be kept away from young children. This
//     post-market regulatory safety signal did not withdraw the adult cough
//     indication, but it materially qualified the drug's risk/benefit profile and
//     moved the settled "symptomatic relief of cough" claim into active contestation
//     over pediatric and overdose safety.
//
// Only high-confidence, DOI- and .gov-anchored arcs are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-benzonatate-antitussive-cough.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-benzonatate-antitussive-cough.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyh83n8xaoplo7wan1f3ul'

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
    community: 'INSTITUTIONAL',
    occurredAt: '2006-01-01',
    datePrecision: 'MONTH',
    reason:
      "By the mid-2000s benzonatate had long been an established non-narcotic antitussive for symptomatic cough relief. The American College of Chest Physicians (ACCP/CHEST) issued evidence-based clinical practice guidelines on the diagnosis and management of cough, situating non-narcotic peripheral antitussives such as benzonatate within the recognized armamentarium for symptomatic cough management. This professional-society guideline reflects benzonatate's settled status as broadly adopted, guideline-recognized standard-of-care symptomatic therapy.",
    source: {
      externalId: 'src:accp-cough-guideline-2006',
      name:
        'Irwin RS, Baumann MH, Bolser DC, et al. Diagnosis and management of cough executive summary: ACCP evidence-based clinical practice guidelines. Chest. 2006;129(1 Suppl):1S-23S.',
      url: 'https://doi.org/10.1378/chest.129.1_suppl.1S',
      publishedAt: '2006-01-01',
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
      "The FDA issued a Drug Safety Communication reporting deaths from overdose after accidental ingestion of Tessalon (benzonatate) by children under 10 years of age, warning that ingestion of even a small number of capsules can be fatal in young children and that benzonatate is not indicated for use in children under 10. This post-market regulatory safety signal did not withdraw the adult cough indication, but it materially qualified the drug's risk/benefit profile — highlighting pediatric fatality, accidental-overdose, and choking hazards — and moved the settled 'symptomatic relief of cough' claim into active contestation over safety.",
    source: {
      externalId: 'src:fda-dsc-benzonatate-2010',
      name:
        'FDA Drug Safety Communication: Death resulting from overdose after accidental ingestion of Tessalon (benzonatate) by children under 10 years of age. U.S. Food and Drug Administration; December 14, 2010.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-death-resulting-overdose-after-accidental-ingestion-tessalon',
      publishedAt: '2010-12-14',
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
