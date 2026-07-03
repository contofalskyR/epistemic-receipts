// Enrichment: epistemic trajectory for an openFDA-labels-ingested claim asserting
// the FDA-approved indications for VIMPAT (lacosamide) — treatment of partial-onset
// seizures (patients 1 month and older) and adjunctive therapy for primary
// generalized tonic-clonic seizures (patients 4 years and older).
//
// The claim already carries its OPEN/null -> RECORDED first entry. RECORDED is
// anchored by the first published pivotal clinical evidence: Ben-Menachem E, Biton V,
// Jatuzis D, Abou-Khalil B, Doty P, Rudd GD. "Efficacy and safety of oral lacosamide
// as adjunctive therapy in adults with partial-onset seizures" (trial SP667),
// Epilepsia 2007;48(7):1308-1317, doi:10.1111/j.1528-1167.2007.01188.x. That first
// entry is NOT re-created here.
//
// This script adds the downstream arc:
//
//   RECORDED -> SETTLED (2008-10-28): The FDA approved VIMPAT (lacosamide),
//     NDA 022253, as adjunctive therapy for partial-onset seizures, on the strength
//     of the pivotal Phase II/III program (SP667, SP754, SP755). Institutional
//     approval moved lacosamide from published-evidence into an approved, marketed
//     standard antiseizure medication entering routine clinical practice; the
//     indication was later broadened (monotherapy 2014; pediatric partial-onset and
//     adjunctive primary generalized tonic-clonic seizures thereafter).
//
//   SETTLED -> CONTESTED (2008-12-16): A post-market class-wide safety signal
//     qualified the indication's benefit-risk. Following its meta-analysis of 199
//     placebo-controlled trials of antiepileptic drugs (alert of 2008-01-31), the FDA
//     required all AED manufacturers — lacosamide included — to add a warning about
//     increased risk of suicidal thoughts and behavior. This "Suicidal Behavior and
//     Ideation" warning is carried in VIMPAT's label, contesting the unqualified
//     favorable framing of the approved indication.
//
// Only high-confidence, .gov / DOI-anchored regulatory sources are encoded.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-vimpat-lacosamide-seizures.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-vimpat-lacosamide-seizures.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiydpqf8t7oplo75iox7zsz'

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
    occurredAt: '2008-10-28',
    datePrecision: 'DAY',
    reason:
      "The U.S. Food and Drug Administration approved VIMPAT (lacosamide), NDA 022253, as adjunctive therapy for partial-onset seizures, on the strength of the pivotal randomized controlled trial program (SP667, SP754, SP755). This institutional ratification moved lacosamide from published clinical evidence into an approved, marketed standard antiseizure medication entering routine practice. The indication was subsequently broadened — monotherapy (2014) and pediatric partial-onset plus adjunctive primary generalized tonic-clonic seizures — reflecting durable clinical adoption.",
    source: {
      externalId: 'src:fda-vimpat-nda022253-approval-2008',
      name:
        'U.S. Food and Drug Administration. Drugs@FDA: NDA 022253, VIMPAT (lacosamide) — original approval as adjunctive therapy for partial-onset seizures.',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=022253',
      publishedAt: '2008-10-28',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2008-12-16',
    datePrecision: 'DAY',
    reason:
      "A post-market, class-wide safety signal qualified the approved indication's benefit-risk profile. Following an FDA meta-analysis of 199 placebo-controlled trials of antiepileptic drugs (alert of January 31, 2008), the FDA required all AED manufacturers — lacosamide included — to add labeling on the increased risk of suicidal thoughts and behavior. This 'Suicidal Behavior and Ideation' warning is carried in VIMPAT's Warnings and Precautions, contesting any unqualified favorable framing of the seizure indication.",
    source: {
      externalId: 'src:fda-aed-suicidality-warning-2008',
      name:
        'U.S. Food and Drug Administration. Suicidal Behavior and Ideation and Antiepileptic Drugs — class-wide labeling requirement for all antiepileptic drugs.',
      url: 'https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/suicidal-behavior-and-ideation-and-antiepileptic-drugs',
      publishedAt: '2008-12-16',
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
