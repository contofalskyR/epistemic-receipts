// Enrichment: epistemic trajectory for the openFDA-label-ingested claim asserting
// the INDICATIONS AND USAGE of Ketorolac Tromethamine — short-term (≤5 days)
// management of moderately severe acute pain requiring opioid-level analgesia, at the
// lowest effective dose for the shortest duration.
//
// Claim: cmpiym7a1932cplo7v938hpgf (ingestedBy openfda_labels_v1)
//
// The claim already has its null -> RECORDED first entry (the FDA label record).
// This script adds the deep clinical/epistemic arc of the underlying medical
// proposition — that ketorolac is an effective analgesic for moderately severe acute
// pain — which predates the current label by decades and whose ≤5-day / lowest-dose
// framing is itself the residue of a post-market safety reversal:
//
//   OPEN -> RECORDED (1986): First clinical-trial evidence. Yee and colleagues
//     reported that intramuscular ketorolac tromethamine provided analgesia comparable
//     to morphine sulfate after major surgery (Pharmacotherapy, 1986), recording the
//     empirical core of the indication — potent, opioid-level analgesia for acute pain.
//
//   RECORDED -> SETTLED (1989): Regulatory ratification / broad adoption. The FDA
//     approved ketorolac tromethamine (Toradol) for injection under NDA 019645,
//     establishing it as a settled, marketed standard-of-care non-opioid analgesic for
//     moderately severe acute pain.
//
//   SETTLED -> CONTESTED (1996): Post-market safety signal. The Strom et al.
//     postmarketing surveillance study in JAMA linked parenteral ketorolac to increased
//     gastrointestinal and operative-site bleeding, especially with higher doses and
//     longer duration. This finding is the evidentiary basis for the boxed warnings and
//     the ≤5-day / lowest-effective-dose restriction that the current label codifies.
//
// Only high-confidence, DOI-anchored / official-institution URLs are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-ketorolac-tromethamine-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-ketorolac-tromethamine-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiym7a1932cplo7v938hpgf'

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
    occurredAt: '1986-09-01',
    datePrecision: 'MONTH',
    reason:
      "The proposition that ketorolac tromethamine provides potent analgesia for moderately severe acute pain was first recorded in the clinical literature by Yee and colleagues, who compared intramuscular ketorolac with morphine sulfate for pain after major surgery and found the non-opioid provided comparable analgesia. This early clinical-trial evidence established the empirical core of the indication the modern FDA label codifies — opioid-level relief of moderately severe acute pain.",
    source: {
      externalId: 'src:yee-ketorolac-morphine-1986',
      name:
        'Yee JP, Koshiver JE, Allbon C, Brown CR. Comparison of intramuscular ketorolac tromethamine and morphine sulfate for analgesia of pain after major surgery. Pharmacotherapy. 1986;6(5):253-261.',
      url: 'https://doi.org/10.1002/j.1875-9114.1986.tb03485.x',
      publishedAt: '1986-09-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1989-01-01',
    datePrecision: 'YEAR',
    reason:
      "The empirical claim was ratified at the regulatory level: the U.S. Food and Drug Administration approved ketorolac tromethamine (Toradol) for injection under NDA 019645 in 1989, licensing it for the short-term management of moderately severe acute pain. Approval settled the drug's status as a marketed, standard-of-care non-opioid analgesic and established the indication the current label continues to carry.",
    source: {
      externalId: 'src:fda-daf-ketorolac-019645',
      name:
        'U.S. Food and Drug Administration. Drugs@FDA: Ketorolac Tromethamine (Toradol), NDA 019645 — approval overview.',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=019645',
      publishedAt: '1989-01-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1996-02-07',
    datePrecision: 'DAY',
    reason:
      "A post-market safety signal contested unrestricted ketorolac use. In a large postmarketing surveillance study, Strom, Berlin, Kinman, and colleagues found that parenteral ketorolac was associated with an increased risk of gastrointestinal and operative-site bleeding, with risk rising at higher doses and with treatment beyond five days. This finding is the evidentiary basis for the boxed warnings and the label's insistence on the lowest effective dose for the shortest duration (≤5 days) that appear in the current INDICATIONS AND USAGE and WARNINGS sections.",
    source: {
      externalId: 'src:strom-ketorolac-bleeding-jama-1996',
      name:
        'Strom BL, Berlin JA, Kinman JL, et al. Parenteral ketorolac and risk of gastrointestinal and operative site bleeding. A postmarketing surveillance study. JAMA. 1996;275(5):376-382.',
      url: 'https://doi.org/10.1001/jama.1996.03530290046036',
      publishedAt: '1996-02-07',
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
