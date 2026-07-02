// Enrichment: epistemic trajectory for an OpenAlex-ingested review claim asserting
// the efficacy and safety of duloxetine (a dual serotonin/norepinephrine reuptake
// inhibitor) in major depressive disorder (MDD), pooled from six double-blind
// placebo- and/or active-comparator-controlled trials plus a stress urinary
// incontinence study for the safety assessment.
//
// Underlying paper: Nemeroff CB, Schatzberg AF, Goldstein DJ, Detke MJ,
// Mallinckrodt C, Lu Y, Tran PV. "Duloxetine for the treatment of major depressive
// disorder." Psychopharmacology Bulletin 2002;36(4):106-132 — an Eli Lilly-
// authored/sponsored pooled synthesis.
//
// The claim already has its OPEN/null -> RECORDED first entry (the pooled review
// itself). This script adds the downstream arc:
//
//   RECORDED -> CONTESTED (2012): The Cochrane comparative review of duloxetine
//     versus other antidepressants (Cipriani et al., 2012) found that duloxetine
//     did NOT provide a significant efficacy advantage over other antidepressive
//     agents and was associated with a higher rate of adverse-event
//     discontinuations than some comparators (e.g., SSRIs), directly contesting the
//     industry-sponsored review's favorable efficacy/safety framing.
//
//   CONTESTED -> SETTLED (2018): The landmark network meta-analysis of 21
//     antidepressants (Cipriani et al., Lancet 2018), synthesizing 522 trials and
//     ~116,000 participants, confirmed duloxetine to be significantly more
//     efficacious than placebo for acute MDD (with moderate acceptability),
//     settling the core empirical proposition that duloxetine is an efficacious
//     antidepressant while placing its benefit in comparative context.
//
// Only high-confidence, DOI-anchored arcs are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-duloxetine-mdd-efficacy-safety.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-duloxetine-mdd-efficacy-safety.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm7p01932zgsaere6wi0koe'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2012-10-17',
    datePrecision: 'DAY',
    reason:
      "The favorable efficacy/safety profile advanced by the Eli Lilly-authored pooled review was contested by an independent Cochrane systematic review. Cipriani and colleagues compared duloxetine head-to-head against other antidepressive agents and concluded that duloxetine did not provide a significant advantage in efficacy, while being associated with a higher rate of discontinuation due to adverse events than some comparator antidepressants (notably certain SSRIs). The review questioned whether the industry-sponsored evidence base supported duloxetine as a preferred first-line option, moving the claim from RECORDED into active contestation over its comparative benefit and tolerability.",
    source: {
      externalId: 'src:cipriani-duloxetine-cochrane-2012',
      name:
        'Cipriani A, Koesters M, Furukawa TA, Nosè M, Purgato M, Omori IM, Trespidi C, Barbui C. Duloxetine versus other anti-depressive agents for depression. Cochrane Database of Systematic Reviews. 2012;(10):CD006533.',
      url: 'https://doi.org/10.1002/14651858.CD006533.pub2',
      publishedAt: '2012-10-17',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2018-02-21',
    datePrecision: 'DAY',
    reason:
      "The contestation over duloxetine's efficacy was resolved by the largest network meta-analysis of antidepressants to date. Cipriani and colleagues synthesized 522 double-blind randomized controlled trials (~116,477 participants) comparing 21 antidepressants for the acute treatment of adults with major depressive disorder. Duloxetine was among the drugs found to be significantly more efficacious than placebo (odds ratio for response ~1.85), with acceptability comparable to other agents. This settled the review's central empirical proposition — that duloxetine is an efficacious antidepressant for MDD — while situating its benefit within the comparative landscape of available antidepressants.",
    source: {
      externalId: 'src:cipriani-21-antidepressants-nma-lancet-2018',
      name:
        'Cipriani A, Furukawa TA, Salanti G, Chaimani A, Atkinson LZ, Ogawa Y, et al. Comparative efficacy and acceptability of 21 antidepressant drugs for the acute treatment of adults with major depressive disorder: a systematic review and network meta-analysis. The Lancet. 2018;391(10128):1357-1366.',
      url: 'https://doi.org/10.1016/S0140-6736(17)32802-7',
      publishedAt: '2018-02-21',
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
