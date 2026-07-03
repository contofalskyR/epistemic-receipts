// Enrich the epistemic arc for the oxcarbazepine (Trileptal) FDA-label claim.
//
// Claim: cmpiyhi7w8xlcplo7k0d8gnba
//   "Oxcarbazepine (OXCARBAZEPINE): 1 INDICATIONS AND USAGE ... partial-onset
//    seizures in adults ... and in pediatric patients ..."
//
// Adds three historical ClaimStatusHistory rows tracing the drug's real-world
// epistemic trajectory (which predates the 2026 label-ingestion event):
//   OPEN     -> RECORDED  (2000-01-14) FDA approval of the Phase III monotherapy evidence
//   RECORDED -> SETTLED   (2006-07-01) ILAE evidence-based guideline: Level A monotherapy for POS
//   SETTLED  -> CONTESTED (2008-01-31) FDA class-wide AED suicidality safety signal
//
// Idempotent: source upserts on externalId, history upserts on the deterministic
//             slug `${claimId}-${toAxis}-${occurredAt.slice(0,10)}`.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-oxcarbazepine.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyhi7w8xlcplo7k0d8gnba'

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
  // ── OPEN -> RECORDED: Phase III monotherapy evidence enters the regulatory record ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '2000-01-14',
    datePrecision: 'DAY',
    reason:
      'On 14 January 2000 the FDA approved oxcarbazepine (Trileptal, NDA 021014, Novartis) for partial-onset seizures, recording into the regulatory record the pivotal double-blind, controlled Phase III monotherapy and adjunctive trials that established efficacy in adults and children. The submission included the placebo-controlled conversion-to-monotherapy design and an active-control comparison against carbamazepine and phenytoin. This fixed the first authoritative acceptance that oxcarbazepine is an efficacious antiepileptic drug for partial-onset seizures.',
    source: {
      externalId: 'src:oxcarbazepine-fda-approval-2000',
      name: 'FDA Drugs@FDA — Trileptal (oxcarbazepine), NDA 021014, original approval 14 January 2000.',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=021014',
      publishedAt: '2000-01-14',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: ILAE evidence-based guideline rates it Level A monotherapy ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2006-07-01',
    datePrecision: 'MONTH',
    reason:
      'In July 2006 the International League Against Epilepsy published its evidence-based analysis of antiepileptic-drug efficacy as initial monotherapy (Glauser et al., Epilepsia 47:1094–1120). The review rated oxcarbazepine as Level A evidence for initial monotherapy of partial-onset seizures — the highest efficacy rating, and the only Level A rating for children with partial-onset seizures. This established oxcarbazepine as guideline-endorsed standard-of-care for the indication.',
    source: {
      externalId: 'src:oxcarbazepine-ilae-guideline-2006',
      name: 'Glauser T, Ben-Menachem E, Bourgeois B, et al. ILAE treatment guidelines: evidence-based analysis of antiepileptic drug efficacy and effectiveness as initial monotherapy for epileptic seizures and syndromes. Epilepsia. 2006;47(7):1094–1120.',
      url: 'https://doi.org/10.1111/j.1528-1167.2006.00585.x',
      publishedAt: '2006-07-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: FDA class-wide AED suicidality safety signal ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2008-01-31',
    datePrecision: 'DAY',
    reason:
      'On 31 January 2008 the FDA alerted healthcare professionals that a meta-analysis of 199 placebo-controlled trials found antiepileptic drugs — oxcarbazepine among the drugs analyzed — approximately doubled the risk of suicidal thoughts and behavior. The finding triggered class-wide labeling warnings and a Medication Guide requirement, adding a post-market safety caveat to a previously settled therapeutic consensus. It reframed oxcarbazepine use around a monitoring obligation rather than unqualified endorsement.',
    source: {
      externalId: 'src:oxcarbazepine-fda-aed-suicidality-2008',
      name: 'FDA. Suicidal Behavior and Ideation and Antiepileptic Drugs — safety alert, 31 January 2008.',
      url: 'https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/suicidal-behavior-and-ideation-and-antiepileptic-drugs',
      publishedAt: '2008-01-31',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (this script does not create claims).`)
  }

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1-oxcarbazepine',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`Enriched ${TRANSITIONS.length} transitions for claim ${CLAIM_ID}.`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
