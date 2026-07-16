// Enrichment: epistemic trajectory for Peter A. Hall (1993),
// "Policy Paradigms, Social Learning, and the State: The Case of Economic
// Policymaking in Britain," Comparative Politics 25(3):275–296.
// DOI 10.2307/422246 · OpenAlex W4371184.
//
// Hall's article introduced the concept of "policy paradigms" and distinguished
// first/second-order (normal) policy adjustment from third-order paradigm change,
// arguing that the Keynesian-to-monetarist shift in British economic policy was
// a paradigm shift not captured by conventional models of state-autonomous social
// learning. The claim already carries its baseline entry (null -> RECORDED at the
// April 1993 publication date). This script adds the downstream arc:
//
//   RECORDED -> CONTESTED (2004-05-24): Adam Oliver-style direct methodological
//     critique. Hugh Pemberton & Michael J. Oliver, "Learning and Change in
//     20th-Century British Economic Policy" (Governance 17(3), 2004), re-examined
//     Hall's own British case and argued his punctuated third-order-paradigm-shift
//     model understates the protracted, contested, and incremental character of
//     paradigm change — a specific, dated challenge to the movement-of-paradigms
//     claim on the exact terrain Hall used. Community: EXPERT_LITERATURE.
//
//   CONTESTED -> SETTLED (2015): the framework survived the critique and became
//     the field's institutionalized reference concept for ideational policy change.
//     John Hogan & Michael Howlett (eds.), "Policy Paradigms in Theory and
//     Practice" (Palgrave Macmillan, 2015), is a dedicated scholarly volume that
//     revisits, defines, measures, and applies Hall's paradigm concept two decades
//     on (incl. Daigneault, "Can You Recognize a Paradigm When You See One?"),
//     consolidating it as the canonical framework of the subfield. Community:
//     EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-hall-1993-policy-paradigms-social-learning.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-hall-1993-policy-paradigms-social-learning.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplyne2i000tsaqkm4xj0ce2'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-05-24',
    datePrecision: 'DAY',
    reason:
      'Hugh Pemberton and Michael J. Oliver, "Learning and Change in 20th-Century British Economic Policy" (Governance 17(3):415–441, 2004), re-examined Hall\'s own case — British economic policymaking — and directly challenged his third-order "paradigm shift" model of social learning. They argued that policy change is more protracted, resisted, and incremental than Hall\'s punctuated Keynesian-to-monetarist paradigm-shift narrative implies, and that the sharp first/second/third-order distinction obscures how learning actually unfolds. This is a specific, dated methodological critique targeting the paper\'s central claim on the same empirical terrain, moving the finding into contest.',
    source: {
      externalId: 'src:oliver-pemberton-2004-governance-learning-change',
      name:
        'Pemberton H, Oliver MJ. "Learning and Change in 20th-Century British Economic Policy." Governance 2004;17(3):415–441.',
      url: 'https://doi.org/10.1111/j.0952-1895.2004.00252.x',
      publishedAt: '2004-05-24',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2015-01-01',
    datePrecision: 'YEAR',
    reason:
      'The policy-paradigms framework survived two decades of critique to become the field\'s canonical concept for ideational and third-order policy change. John Hogan and Michael Howlett (eds.), "Policy Paradigms in Theory and Practice" (Palgrave Macmillan, 2015), is a dedicated scholarly volume that revisits, defines, measures, and operationalizes Hall\'s concept — including Daigneault\'s "Can You Recognize a Paradigm When You See One? Defining and Measuring Paradigm Shift" — consolidating the framework as the standard reference for studying paradigmatic policy change and settling its status as an established research program in the expert literature.',
    source: {
      externalId: 'src:hogan-howlett-2015-policy-paradigms-theory-practice',
      name:
        'Hogan J, Howlett M, eds. "Policy Paradigms in Theory and Practice: Discourses, Ideas and Anomalies in Public Policy Dynamics." Palgrave Macmillan, 2015. ISBN 9781137434043.',
      url: 'https://doi.org/10.1057/9781137434043',
      publishedAt: '2015-01-01',
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
