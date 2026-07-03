// Enrichment: epistemic trajectory for the openFDA-label-ingested claim asserting
// the INDICATIONS AND USAGE of Clindamycin Hydrochloride (serious infections due to
// susceptible anaerobes, streptococci, pneumococci, and staphylococci; reserved for
// penicillin-allergic patients; carries a colitis warning).
//
// Claim: cmpiyl00691o6plo7q2kiad1h (ingestedBy openfda_labels_v1)
//
// The claim already has its null -> RECORDED first entry (the FDA label record).
// This script adds the deep clinical/epistemic arc of the underlying medical
// proposition — that clindamycin is an effective therapy for serious anaerobic and
// gram-positive infections — which predates the modern label by decades:
//
//   OPEN -> RECORDED (1973): First-line clinical-trial evidence. Fass and colleagues
//     reported clindamycin's efficacy in the treatment of serious anaerobic
//     infections (Annals of Internal Medicine, 1973), recording the core empirical
//     proposition that the label's INDICATIONS AND USAGE now codify.
//
//   RECORDED -> CONTESTED (1974): Post-market safety signal. Tedesco, Barton, and
//     Alpers' prospective study found that a strikingly high fraction of patients
//     receiving clindamycin developed diarrhea (~21%) and pseudomembranous colitis
//     (~10%), the finding that grounds clindamycin's FDA boxed warning for
//     Clostridioides difficile-associated colitis and contested unrestricted use.
//
//   CONTESTED -> SETTLED (2023): Standard-of-care ratification. Despite the boxed-
//     warning colitis risk (managed, not eliminated), clindamycin remains on the WHO
//     Model List of Essential Medicines (23rd list, 2023) as a core antibacterial,
//     settling its status as an established standard-of-care agent whose benefit for
//     serious anaerobic/gram-positive infection is judged to outweigh its risk in
//     appropriate use.
//
// Only high-confidence, DOI-anchored / official-institution URLs are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-clindamycin-hydrochloride-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-clindamycin-hydrochloride-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyl00691o6plo7q2kiad1h'

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

// Do NOT duplicate the existing null -> RECORDED first entry (the label record).
// The transitions below trace the underlying medical claim's epistemic history.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1973-06-01',
    datePrecision: 'MONTH',
    reason:
      "The proposition that clindamycin effectively treats serious anaerobic infections was first recorded in the clinical literature by Fass and colleagues, who evaluated parenteral clindamycin in patients with serious infections caused by anaerobic bacteria and found high clinical and bacteriological response rates. This early clinical-trial evidence established the empirical core of the indication the modern FDA label codifies — treatment of serious infections caused by susceptible anaerobic bacteria and by susceptible gram-positive cocci.",
    source: {
      externalId: 'src:fass-clindamycin-anaerobic-1973',
      name:
        'Fass RJ, Scholand JF, Hodges GR, Saslaw S. Clindamycin in the treatment of serious anaerobic infections. Annals of Internal Medicine. 1973;78(6):853-859.',
      url: 'https://doi.org/10.7326/0003-4819-78-6-853',
      publishedAt: '1973-06-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1974-10-01',
    datePrecision: 'MONTH',
    reason:
      "A post-market safety signal contested unrestricted clindamycin use. In a prospective study, Tedesco, Barton, and Alpers found that roughly 21% of patients receiving clindamycin developed diarrhea and about 10% developed endoscopically confirmed pseudomembranous colitis — a far higher rate than previously appreciated. This finding is the evidentiary basis for clindamycin's FDA boxed warning that treatment can cause Clostridioides difficile-associated (pseudomembranous) colitis ranging from mild to fatal, and it reframed the label's own instruction to reserve clindamycin for infections where less toxic agents are inappropriate.",
    source: {
      externalId: 'src:tedesco-clindamycin-colitis-1974',
      name:
        'Tedesco FJ, Barton RW, Alpers DH. Clindamycin-associated colitis. A prospective study. Annals of Internal Medicine. 1974;81(4):429-433.',
      url: 'https://doi.org/10.7326/0003-4819-81-4-429',
      publishedAt: '1974-10-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2023-07-01',
    datePrecision: 'MONTH',
    reason:
      "The contestation over clindamycin's risk-benefit balance settled into a durable standard-of-care judgment: the colitis risk is real and boxed-warning-managed, but the drug's value for serious anaerobic and gram-positive infection is recognized as outweighing that risk in appropriate use. The World Health Organization retains clindamycin on the 23rd WHO Model List of Essential Medicines (2023) as a core antibacterial, ratifying at the institutional level that clindamycin is an established, essential standard-of-care therapy.",
    source: {
      externalId: 'src:who-eml-2023-clindamycin',
      name:
        'World Health Organization. WHO Model List of Essential Medicines — 23rd list, 2023 (clindamycin listed as an antibacterial/Access-group agent).',
      url: 'https://www.who.int/publications/i/item/WHO-MHP-HPS-EML-2023.02',
      publishedAt: '2023-07-01',
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
