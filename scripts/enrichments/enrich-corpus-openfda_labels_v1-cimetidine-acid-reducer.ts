// Enrichment: epistemic arc for the cimetidine "acid reducer" claim.
//
// Claim: cmpiyitfp8z30plo7r0guwerd
//   "ACID CONTROLLER (CIMETIDINE): Purpose Acid reducer" (openfda_labels_v1)
//
// Adds three ClaimStatusHistory transitions tracing cimetidine's arc from the
// first published evidence for H2-receptor blockade (the acid-reducing
// mechanism), through its settled standard-of-care apex (Nobel Prize 1988), to
// the contesting of the H2-antagonist acid-reducer class (2020 ranitidine
// NDMA withdrawal + prior displacement by proton-pump inhibitors).
//
// Does NOT create a new Claim — the claim already exists (openfda_labels_v1).
// The existing first entry (fromAxis=null -> first status) is not duplicated.
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on a
// deterministic id slug.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-cimetidine-acid-reducer.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyitfp8z30plo7r0guwerd'

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
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED: first published evidence for H2-blockade acid reduction ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1972-04-21',
    datePrecision: 'DAY',
    reason:
      'Black, Duncan, Durant, Ganellin and Parsons defined the histamine H2 receptor and showed that a competitive antagonist (burimamide) suppresses gastric acid secretion — the first published evidence for the pharmacological mechanism cimetidine exploits as an acid reducer. Smith Kline & French developed cimetidine directly from this program, and it entered controlled clinical trials for duodenal ulcer within a few years. This established the acid-reducing claim as a recorded, mechanistically grounded finding rather than an open hypothesis.',
    source: {
      externalId: 'src:cimetidine-h2-receptor-definition-1972',
      name: 'Black JW, Duncan WA, Durant CJ, Ganellin CR, Parsons EM. Definition and antagonism of histamine H2-receptors. Nature. 1972;236(5347):385–390.',
      url: 'https://doi.org/10.1038/236385a0',
      publishedAt: '1972-04-21',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: standard-of-care apex, ratified by the Nobel Prize ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1988-12-10',
    datePrecision: 'DAY',
    reason:
      'By the 1980s cimetidine (Tagamet) was the first-line standard of care for peptic and duodenal ulcer disease and had become the world’s first billion-dollar drug. In 1988 James W. Black received the Nobel Prize in Physiology or Medicine, cited for the discovery of important principles for drug treatment including cimetidine — an institutional ratification of cimetidine’s settled status as a landmark acid-reducing therapeutic. The acid-reducer claim was, at this point, uncontested clinical fact.',
    source: {
      externalId: 'src:cimetidine-nobel-medicine-1988',
      name: 'The Nobel Prize in Physiology or Medicine 1988 — James W. Black, Gertrude B. Elion, George H. Hitchings. Nobel Foundation.',
      url: 'https://www.nobelprize.org/prizes/medicine/1988/summary/',
      publishedAt: '1988-12-10',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: H2-antagonist acid-reducer class comes under scrutiny ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-04-01',
    datePrecision: 'DAY',
    reason:
      'On 1 April 2020 the FDA requested the withdrawal of all ranitidine products after finding the probable carcinogen NDMA in the H2-antagonist, casting scrutiny across the histamine H2-blocker acid-reducer category to which cimetidine belongs. FDA testing found cimetidine itself did not form NDMA, so it remained available as a safe alternative, but the episode — together with the earlier displacement of H2 antagonists by proton-pump inhibitors as first-line acid-suppression therapy — contested the H2 acid-reducer class’s standing as the default treatment. The specific cimetidine acid-reducer claim survives, but the category’s once-settled dominance did not.',
    source: {
      externalId: 'src:fda-ranitidine-withdrawal-2020',
      name: 'U.S. Food and Drug Administration. FDA Requests Removal of All Ranitidine Products (Zantac) from the Market. Press announcement, April 1, 2020.',
      url: 'https://www.fda.gov/news-events/press-announcements/fda-requests-removal-all-ranitidine-products-zantac-market',
      publishedAt: '2020-04-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (this script does not create claims).`)
  }

  for (const t of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda_labels_v1',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const id = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id },
      create: {
        id,
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

    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${id})`)
  }

  console.log(`Done: ${TRANSITIONS.length} transitions for claim ${CLAIM_ID}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
