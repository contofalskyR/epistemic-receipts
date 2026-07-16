// Enrichment: epistemic trajectory for Teece DJ (1986),
// "Profiting from technological innovation: Implications for integration,
// collaboration, licensing and public policy," Research Policy 15(6):285–305.
// DOI 10.1016/0048-7333(86)90027-2. OpenAlex W3125571233.
//
// Teece introduced the "Profiting from Innovation" (PFI) framework — arguing
// that whether an innovator or an imitator/follower captures the value from an
// innovation depends on the appropriability regime, the ownership of
// specialized complementary assets, and the timing of the dominant design.
// The claim already carries its baseline first entry (null -> RECORDED,
// publication 1986). This script adds the single well-documented downstream arc:
//
//   RECORDED -> SETTLED (October 2006): Research Policy devoted a commemorative
//     20th-anniversary special issue (Vol. 35, Issue 8) to the PFI framework, in
//     which independent leading scholars of innovation studies assessed, affirmed
//     and extended it — including Richard R. Nelson, "Reflections of David
//     Teece's 'Profiting from technological innovation…'" (pp. 1107–1109), and
//     Gary Pisano, "Profiting from innovation and the intellectual property
//     revolution" (pp. 1122–1130). The special issue marks the framework's
//     consolidation as a canonical, consensus reference point in the strategic-
//     management and innovation-economics literature rather than a still-open
//     proposition. Community: EXPERT_LITERATURE.
//
// No retraction or expression of concern exists (Crossref update-to: None), and
// the framework has not been overturned by a failed replication or adjudicating
// meta-analysis, so no CONTESTED or REVERSED transition is added.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-teece-1986-profiting-from-innovation.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-teece-1986-profiting-from-innovation.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplynftb001nsaqkauxecydo'

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

// Do NOT duplicate the existing null -> RECORDED (publication 1986) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2006-10-01',
    datePrecision: 'MONTH',
    reason:
      'In October 2006 Research Policy — the flagship journal of innovation studies — published a commemorative 20th-anniversary special issue (Vol. 35, Issue 8) built around Teece\'s "Profiting from Innovation" framework, in which independent leading scholars assessed, affirmed and extended it. Contributions included Richard R. Nelson, "Reflections of David Teece\'s \u2018Profiting from technological innovation\u2026\u2019" (pp. 1107–1109), and Gary Pisano, "Profiting from innovation and the intellectual property revolution" (pp. 1122–1130), which revisits the appropriability/complementary-assets logic in light of the biotech and IP revolution and finds it durable. A dedicated special issue of the field\'s core journal, contributed by independent authorities two decades on, marks the framework\'s consolidation as a canonical, consensus reference point rather than an open proposition — moving the finding from recorded to settled.',
    source: {
      externalId: 'src:pisano-2006-profiting-innovation-ip-revolution',
      name:
        'Pisano G. Profiting from innovation and the intellectual property revolution. Research Policy 2006;35(8):1122–1130 (commemorative 20th-anniversary special issue on Teece\'s "Profiting from Innovation").',
      url: 'https://doi.org/10.1016/j.respol.2006.09.008',
      publishedAt: '2006-10-01',
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
