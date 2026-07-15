// Enrichment: epistemic trajectory for Harmon Craig (1961),
// "Isotopic Variations in Meteoric Waters," Science 133 (3465): 1702–1703.
// DOI 10.1126/science.133.3465.1702 · OpenAlex W2072191315.
//
// This is the paper that established the Global Meteoric Water Line (GMWL):
// deuterium and oxygen-18 enrichments in meteoric waters (relative to ocean
// water) fall on a linear correlation, δD = 8·δ18O + 10, for waters that have
// not undergone excessive evaporation. It is a foundational result of stable
// isotope hydrology.
//
// Post-publication research turned up NO retraction, NO expression of concern,
// and NO failed replication or major methodological refutation. The finding was
// instead VINDICATED at global scale: the IAEA/WMO Global Network of Isotopes in
// Precipitation (GNIP) accumulated three decades of worldwide precipitation
// isotope data, and its adjudicating synthesis — Rozanski, Araguás-Araguás &
// Gonfiantini (1993), "Isotopic Patterns in Modern Global Precipitation" (AGU
// Geophysical Monograph 78, "Climate Change in Continental Isotopic Records",
// DOI 10.1029/GM078p0001) — confirmed Craig's line across the global station
// network (δD = 8.17·δ18O + 11.27), cementing it as the reference framework of
// the field. Because there was never a dated contest, the arc goes directly
// RECORDED -> SETTLED at the review.
//
// The claim already carries its baseline (null -> RECORDED) first entry at the
// 1961-05-26 publication date; this script adds only the single downstream arc.
//
// Community: EXPERT_LITERATURE (peer-reviewed synthesis over the IAEA/WMO
// global precipitation network).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-craig-isotopic-variations-meteoric-waters-1961.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-craig-isotopic-variations-meteoric-waters-1961.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w4ow900ffsa8hwigv0jln'

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
    occurredAt: '1993-01-01',
    datePrecision: 'YEAR',
    reason:
      "Craig's linear deuterium–oxygen-18 correlation for meteoric waters (the Global Meteoric Water Line) was vindicated at global scale by the IAEA/WMO Global Network of Isotopes in Precipitation. Rozanski, Araguás-Araguás & Gonfiantini's 1993 synthesis of the worldwide GNIP dataset, 'Isotopic Patterns in Modern Global Precipitation' (AGU Geophysical Monograph 78), reproduced Craig's relationship across the global station network (δD = 8.17·δ18O + 11.27), establishing it as the settled reference framework of stable isotope hydrology. No retraction, expression of concern, or failed replication was found; the finding moved from RECORDED directly to SETTLED via expert-literature consensus.",
    source: {
      externalId: 'src:rozanski-isotopic-patterns-global-precipitation-1993',
      name:
        'Rozanski, K., Araguás-Araguás, L., & Gonfiantini, R. (1993). "Isotopic Patterns in Modern Global Precipitation." In Climate Change in Continental Isotopic Records, Geophysical Monograph Series 78, pp. 1–36. American Geophysical Union.',
      url: 'https://doi.org/10.1029/GM078p0001',
      publishedAt: '1993-01-01',
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
