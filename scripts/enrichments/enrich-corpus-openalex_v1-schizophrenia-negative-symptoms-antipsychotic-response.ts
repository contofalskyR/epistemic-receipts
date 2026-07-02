// Enrichment: epistemic trajectory for an OpenAlex-ingested schizophrenia review
// claim asserting that (a) positive symptoms respond more completely to
// antipsychotic drugs than negative symptoms, (b) residual negative symptoms
// persist after positive symptoms are controlled, and (c) current therapies have
// only a limited effect on negative symptoms — motivating "broad-spectrum" agents.
//
// The claim already has its OPEN/null -> RECORDED first entry. This script adds
// the downstream arc:
//   RECORDED -> SETTLED (2015): a large meta-analysis of 168 randomized
//     placebo-controlled trials (Fusar-Poli et al., Schizophrenia Bulletin, 2015)
//     found that no available treatment — including antipsychotics — produced a
//     clinically meaningful improvement in negative symptoms, ratifying the
//     review's central empirical assertion that current therapies have only a
//     limited effect on negative symptoms.
//
// Only one high-confidence, dated arc is added. The review's forward-looking
// "broad-spectrum antipsychotics" hypothesis (later supported by the cariprazine
// vs. risperidone trial, Németh et al., Lancet 2017) is corroboration of the
// prescription rather than a status change to the settled empirical core, so it is
// not encoded as a separate transition.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-schizophrenia-negative-symptoms-antipsychotic-response.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-schizophrenia-negative-symptoms-antipsychotic-response.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm2ddpu0l2msaerbaj9x39l'

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
    community: 'EXPERT_LITERATURE',
    occurredAt: '2015-07-01',
    datePrecision: 'MONTH',
    reason:
      "The review's central empirical assertion — that current therapies have only a limited effect on the negative symptoms of schizophrenia — was ratified by a large quantitative synthesis. Fusar-Poli and colleagues meta-analyzed 168 randomized placebo-controlled trials (~6,500 patients) of pharmacological and non-pharmacological treatments targeting negative symptoms. Although several interventions (including second-generation antipsychotics, antidepressants, and combination strategies) produced small statistically significant reductions in negative-symptom scores, none reached the threshold for a clinically meaningful improvement. The authors concluded that no available treatment achieves a clinically significant effect on negative symptoms, settling the claim's core proposition that positive symptoms respond more completely to antipsychotics while residual negative symptoms remain poorly addressed by existing therapy.",
    source: {
      externalId: 'src:fusar-poli-negative-symptoms-meta-2015',
      name:
        'Fusar-Poli P, Papanastasiou E, Stahl D, Rocchetti M, Carpenter W, Shergill S, McGuire P. Treatments of Negative Symptoms in Schizophrenia: Meta-Analysis of 168 Randomized Placebo-Controlled Trials. Schizophrenia Bulletin. 2015;41(4):892–899.',
      url: 'https://doi.org/10.1093/schbul/sbu170',
      publishedAt: '2015-07-01',
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
