// Enrichment: epistemic trajectory for the FDA drug-label claim
//   "ACETAMINOPHEN 500 MG (ACETAMINOPHEN): Purpose Pain reliever/fever reducer"
// Claim id: cmpiyhifp8xloplo7r8441e9i  (ingestedBy openfda_labels_v1)
//
// The claim carries its label-ingestion first entry (fromAxis=null -> <first>)
// already; this script does NOT duplicate it. It adds the downstream epistemic
// arc of acetaminophen (paracetamol) as an OTC analgesic/antipyretic:
//
//   1. OPEN -> RECORDED (1948): Brodie & Axelrod establish N-acetyl-p-aminophenol
//      (acetaminophen) as the pharmacologically active analgesic/antipyretic
//      metabolite of acetanilide, the founding clinical-pharmacology evidence
//      that moved acetaminophen into human therapeutic use. EXPERT_LITERATURE.
//   2. RECORDED -> SETTLED (1977): WHO lists paracetamol on the first Model List
//      of Essential Medicines and it has remained a listed non-opioid analgesic/
//      antipyretic ever since — global standard-of-care ratification. INSTITUTIONAL.
//   3. SETTLED -> CONTESTED (2011-01-13): FDA Drug Safety Communication limits
//      acetaminophen in prescription combination products to 325 mg per dosage
//      unit and adds a boxed warning for severe (sometimes fatal) liver injury,
//      reflecting acetaminophen's status as a leading cause of acute liver
//      failure — contesting unrestricted use at the dosing margins. INSTITUTIONAL.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-acetaminophen-500-mg.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-acetaminophen-500-mg.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyhifp8xloplo7r8441e9i'

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

// Do NOT duplicate the existing null -> <first> (label-ingestion) entry.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1948-01-01',
    datePrecision: 'YEAR',
    reason:
      'Brodie and Axelrod showed that the analgesic and antipyretic activity long attributed to acetanilide and phenacetin was in fact mediated by their common metabolite N-acetyl-p-aminophenol (acetaminophen/paracetamol), and that this metabolite could itself be given directly to humans as an analgesic-antipyretic with a better safety margin than acetanilide. This founding clinical-pharmacology work moved acetaminophen out of the laboratory and into human therapeutic use as the parent analgesic. It is the primary citation from which every later acetaminophen "pain reliever/fever reducer" label descends.',
    source: {
      externalId: 'src:brodie-axelrod-acetanilide-in-man-1948',
      name:
        'Brodie BB, Axelrod J. The fate of acetanilide in man. Journal of Pharmacology and Experimental Therapeutics. 1948;94(1):29–38.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/18885382/',
      publishedAt: '1948-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1977-10-01',
    datePrecision: 'YEAR',
    reason:
      'The World Health Organization included paracetamol (acetaminophen) on its first Model List of Essential Medicines in 1977 as a core non-opioid analgesic and antipyretic, and it has remained continuously listed through the current edition. Inclusion on the WHO Essential Medicines List ratifies acetaminophen as a globally accepted standard-of-care agent for pain and fever, the settled therapeutic role asserted by this drug-label claim. Its terminal successful state for this indication is a first-line, over-the-counter analgesic-antipyretic recommended worldwide.',
    source: {
      externalId: 'src:who-eml-paracetamol-analgesic',
      name:
        'WHO Model List of Essential Medicines — paracetamol listed as a non-opioid analgesic/antipyretic (first list 1977; continuously listed through the current 23rd edition, 2023). WHO Expert Committee on Selection and Use of Essential Medicines.',
      url: 'https://www.who.int/groups/expert-committee-on-selection-and-use-of-essential-medicines/essential-medicines-lists',
      publishedAt: '1977-10-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2011-01-13',
    datePrecision: 'DAY',
    reason:
      'On 13 January 2011 the FDA issued a Drug Safety Communication limiting acetaminophen in prescription combination products to 325 mg per dosage unit and requiring a boxed warning highlighting the potential for severe, sometimes fatal, liver injury from doses above the maximum. The action reflected acetaminophen\'s standing as a leading cause of acute liver failure in the United States, driven by inadvertent overdose and combination-product stacking. The "pain reliever/fever reducer" indication remains approved, but its safety at the dosing margins is actively contested and now formally constrained.',
    source: {
      externalId: 'src:fda-dsc-acetaminophen-325mg-liver-2011',
      name:
        'FDA Drug Safety Communication: Prescription Acetaminophen Products to be Limited to 325 mg Per Dosage Unit; Boxed Warning Will Highlight Potential for Severe Liver Failure. 13 January 2011.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-prescription-acetaminophen-products-be-limited-325-mg-dosage-unit',
      publishedAt: '2011-01-13',
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
    throw new Error(
      `Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`,
    )
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
