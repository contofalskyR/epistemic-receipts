// Enrichment: epistemic arc for the amlodipine besylate / benazepril HCl
// fixed-dose combination (Lotrel and generics), FDA label claim
// cmpiyhse88xw6plo7u48x72v6 (openfda_labels_v1).
//
// The claim's efficacy/indication (combination therapy for hypertension) began
// as an FDA-approved combination in 1995 (RECORDED), was thrown into a genuine
// safety-driven contest by evidence of ACE-inhibitor fetal toxicity (CONTESTED,
// Cooper et al. NEJM 2006), and then settled as a standard-of-care first-line
// single-pill combination once the landmark ACCOMPLISH outcome trial demonstrated
// cardiovascular superiority with the risk confined to pregnancy (SETTLED, 2008;
// reinforced by the 2017 ACC/AHA guideline).
//
// The existing first ClaimStatusHistory row (fromAxis=null -> OPEN) is left
// untouched; this script adds the three subsequent transitions.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-amlodipine-benazepril.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-amlodipine-benazepril.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyhse88xw6plo7u48x72v6'

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

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED: FDA approval of the fixed-dose combination (1995) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1995-03-24',
    datePrecision: 'MONTH',
    reason:
      'The FDA approved the amlodipine besylate / benazepril hydrochloride fixed-dose combination (Lotrel, NDA 020-364) for hypertension in patients not adequately controlled on either agent alone. Approval recorded the combination\'s antihypertensive efficacy on the basis of the sponsor\'s factorial dose-response trials, establishing the indication that the current generic label restates.',
    source: {
      externalId: 'src:lotrel-fda-approval-1995',
      name: 'Drugs@FDA: Lotrel (amlodipine besylate; benazepril hydrochloride) NDA 020364 — FDA approval, 1995.',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=020364',
      publishedAt: '1995-03-24',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> CONTESTED: ACE-inhibitor fetal-toxicity safety signal (2006) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2006-06-08',
    datePrecision: 'DAY',
    reason:
      'Cooper et al. reported in the New England Journal of Medicine that first-trimester exposure to ACE inhibitors was associated with a markedly increased risk of major congenital malformations, hardening a class-wide fetal-toxicity signal for the benazepril component. The finding put the combination\'s safety in specific populations under active contest and underpins the boxed warning to discontinue the drug when pregnancy is detected.',
    source: {
      externalId: 'src:cooper-ace-inhibitor-fetal-toxicity-2006',
      name: 'Cooper WO, Hernandez-Diaz S, Arbogast PG, et al. Major congenital malformations after first-trimester exposure to ACE inhibitors. N Engl J Med. 2006;354(23):2443-2451.',
      url: 'https://doi.org/10.1056/NEJMoa055202',
      publishedAt: '2006-06-08',
      methodologyType: 'primary',
    },
  },

  // ── CONTESTED -> SETTLED: ACCOMPLISH outcome trial establishes standard-of-care (2008) ──
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2008-12-04',
    datePrecision: 'DAY',
    reason:
      'The ACCOMPLISH randomized outcome trial (Jamerson et al., NEJM) was stopped early after benazepril plus amlodipine reduced cardiovascular events roughly 20% versus benazepril plus hydrochlorothiazide in high-risk hypertensive patients, establishing the ACE-inhibitor/calcium-channel-blocker single-pill combination as a preferred, evidence-based regimen. With the fetal risk confined to pregnancy and net cardiovascular benefit demonstrated, the indication settled into standard of care, later reinforced by the 2017 ACC/AHA hypertension guideline\'s endorsement of single-pill combination therapy.',
    source: {
      externalId: 'src:accomplish-jamerson-nejm-2008',
      name: 'Jamerson K, Weber MA, Bakris GL, et al. Benazepril plus amlodipine or hydrochlorothiazide for hypertension in high-risk patients (ACCOMPLISH). N Engl J Med. 2008;359(23):2417-2428.',
      url: 'https://doi.org/10.1056/NEJMoa0806182',
      publishedAt: '2008-12-04',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  // Guard: make sure the claim exists and we are enriching, not creating.
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (this script must not create a Claim).`)
  }

  for (const t of TRANSITIONS) {
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source ${t.source.externalId}`)
      console.log(`[dry-run] history ${historyId} (${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt})`)
      continue
    }

    // 1) Upsert the marker Source first.
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'openfda_labels_v1-enrichment',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    // 2) Upsert the ClaimStatusHistory row, linking the marker Source.
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

    console.log(`upserted ${historyId} (${t.fromAxis} -> ${t.toAxis})`)
  }

  console.log(DRY_RUN ? 'Dry run complete.' : 'Enrichment complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
