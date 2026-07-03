// Epistemic-arc enrichment for the FDA drug-label claim:
//   Levetiracetam (LEVETIRACETAM) — antiepileptic indications (partial-onset,
//   myoclonic, and primary generalized tonic-clonic seizures)
//   Claim id: cmpiykgsh9100plo7xo0yemim  (ingestedBy: openfda_labels_v1)
//
// Adds ClaimStatusHistory rows tracing the drug's epistemic arc:
//   OPEN    -> RECORDED  first pivotal Phase III efficacy trial (Cereghino 2000)
//   RECORDED-> SETTLED   AAN/AES evidence-based practice guideline recommending
//                        levetiracetam for refractory partial seizures (French 2004)
//   SETTLED -> CONTESTED class-wide FDA antiepileptic-drug suicidality safety
//                        signal and mandated labeling change (2008)
//
// Does NOT create a new Claim — it attaches history to the existing claim.
// The existing first entry (fromAxis=null -> RECORDED at label ingest) is left
// untouched; these rows carry the dateable historical arc.
//
// Idempotent: upserts sources and status-history rows.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-levetiracetam.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiykgsh9100plo7xo0yemim'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED : first pivotal Phase III efficacy evidence ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2000-07-25',
    datePrecision: 'DAY',
    reason:
      'Cereghino and colleagues published a double-blind, randomized, placebo-controlled pivotal trial showing that levetiracetam added to existing therapy significantly reduced partial-onset seizure frequency in refractory adult epilepsy, with a favorable tolerability profile. This trial was one of the registration studies underpinning the FDA approval of levetiracetam (Keppra) as adjunctive therapy and first established its efficacy in the peer-reviewed literature.',
    source: {
      externalId: 'src:levetiracetam-cereghino-2000',
      name: 'Cereghino JJ, Biton V, Abou-Khalil B, Dreifuss F, Gauer LJ, Leppik I. Levetiracetam for partial seizures: results of a double-blind, randomized clinical trial. Neurology. 2000;55(2):236–242.',
      url: 'https://doi.org/10.1212/WNL.55.2.236',
      publishedAt: '2000-07-25',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED : evidence-based guideline inclusion / standard of care ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2004-04-27',
    datePrecision: 'DAY',
    reason:
      'The American Academy of Neurology and the American Epilepsy Society published an evidence-based practice parameter assessing the second-generation antiepileptic drugs, formally recommending levetiracetam among the agents effective as adjunctive therapy for refractory partial-onset seizures. Inclusion in a joint professional-society guideline consolidated levetiracetam as an established, standard-of-care option in epilepsy practice.',
    source: {
      externalId: 'src:levetiracetam-aan-french-2004',
      name: 'French JA, Kanner AM, Bautista J, et al. Efficacy and tolerability of the new antiepileptic drugs, II: Treatment of refractory epilepsy. Report of the AAN Therapeutics and Technology Assessment Subcommittee and Quality Standards Subcommittee and the American Epilepsy Society. Neurology. 2004;62(8):1261–1273.',
      url: 'https://doi.org/10.1212/01.WNL.0000123695.22623.32',
      publishedAt: '2004-04-27',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED : class-wide FDA post-market safety signal ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2008-01-31',
    datePrecision: 'DAY',
    reason:
      'After a pooled analysis of 199 placebo-controlled trials of eleven antiepileptic drugs (levetiracetam among them), the FDA alerted clinicians that this drug class approximately doubles the risk of suicidal thoughts and behavior and subsequently mandated class-wide warning labeling. Combined with levetiracetam\'s recognized behavioral and psychiatric adverse effects (irritability, aggression, depression), this contested the drug\'s benefit–risk profile without revoking its seizure indications.',
    source: {
      externalId: 'src:levetiracetam-fda-aed-suicidality-2008',
      name: 'U.S. FDA. Suicidal Behavior and Ideation and Antiepileptic Drugs — Information for Healthcare Professionals (Alert issued 31 Jan 2008; class-wide labeling change mandated 2008).',
      url: 'https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/suicidal-behavior-and-ideation-and-antiepileptic-drugs',
      publishedAt: '2008-01-31',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  // Confirm the target claim exists — never create a new Claim here.
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (this script never creates claims).`)
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
        ingestedBy: 'enrich:openfda_labels_v1',
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`Done: ${TRANSITIONS.length} transitions upserted for claim ${CLAIM_ID}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
