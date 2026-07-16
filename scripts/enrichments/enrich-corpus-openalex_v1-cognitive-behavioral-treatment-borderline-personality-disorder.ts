// Enrichment: epistemic trajectory for Linehan, M. M. (1994),
// "Cognitive-Behavioral Treatment of Borderline Personality Disorder,"
// American Journal of Psychotherapy, 48(1), 155.
// DOI 10.1176/appi.psychotherapy.1994.48.1.155 · OpenAlex W208211972.
//
// The claim is the foundational statement of Dialectical Behavior Therapy (DBT) —
// a structured cognitive-behavioral treatment for borderline personality disorder,
// a population historically regarded as difficult-to-treat. The seminal work
// (6,352 citations) proposed that a manualized skills-plus-individual-therapy CBT
// package reduces self-harm and improves functioning in BPD.
//
// The claim already carries its baseline (null -> RECORDED) first entry at
// publication (1994). This script adds the post-publication arc:
//
//   RECORDED -> SETTLED (2012-08-15): the Cochrane systematic review and
//     meta-analysis (Stoffers-Winterling, Völlm, Rücker, Timmer, Huband & Lieb,
//     "Psychological therapies for people with borderline personality disorder,"
//     Cochrane Database of Systematic Reviews, Issue 8, CD005652.pub2) pooled the
//     controlled trials of psychotherapy for BPD and found DBT to be the most
//     extensively studied intervention, with beneficial effects on core BPD
//     symptom severity, self-harm/parasuicidality, and general psychopathology
//     relative to treatment as usual. This is the first Cochrane-level adjudication
//     of the DBT-for-BPD literature; there was no prior dated scholarly contest,
//     and no retraction or failed-replication event exists — the finding moves
//     directly from recorded to settled in the expert literature. (The 2020
//     Cochrane update, Storebø et al., CD012955.pub2, reaffirmed DBT's benefit on
//     BPD symptom severity, self-harm, and psychosocial functioning.)
//
// Community: EXPERT_LITERATURE (Cochrane systematic review / meta-analysis).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-cognitive-behavioral-treatment-borderline-personality-disorder.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-cognitive-behavioral-treatment-borderline-personality-disorder.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxm1cv00npsa7fxgcuup80'

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

// Do NOT duplicate the existing null -> RECORDED (publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2012-08-15',
    datePrecision: 'DAY',
    reason:
      'The Cochrane systematic review and meta-analysis (Stoffers-Winterling, Völlm, Rücker, Timmer, Huband & Lieb, "Psychological therapies for people with borderline personality disorder," Cochrane Database of Systematic Reviews 2012, Issue 8, CD005652.pub2) pooled the controlled trials of psychotherapy for BPD and identified Dialectical Behavior Therapy as the most extensively studied intervention, with beneficial effects on core BPD symptom severity, self-harm/parasuicidal behaviour, and general psychopathology versus treatment as usual. As the first Cochrane-level adjudication of the DBT-for-BPD literature — with no prior dated scholarly contest and no retraction or failed-replication event — the seminal finding moves directly from recorded to settled in the expert literature. The 2020 Cochrane update (Storebø et al., CD012955.pub2) reaffirmed DBT\'s benefit on BPD symptom severity, self-harm, and psychosocial functioning.',
    source: {
      externalId: 'src:cochrane-2012-cd005652-psychological-therapies-bpd',
      name:
        'Stoffers-Winterling JM, Völlm BA, Rücker G, Timmer A, Huband N, Lieb K. Psychological therapies for people with borderline personality disorder. Cochrane Database of Systematic Reviews. 2012;(8):CD005652. doi:10.1002/14651858.CD005652.pub2',
      url: 'https://doi.org/10.1002/14651858.CD005652.pub2',
      publishedAt: '2012-08-15',
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
