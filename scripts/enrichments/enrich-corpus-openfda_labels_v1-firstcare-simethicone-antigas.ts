// Enrichment: epistemic trajectory for the openFDA-label claim asserting that
// simethicone 250 mg is an OTC "Antigas" active ingredient.
//
// Claim: Firstcare Gas Relief Simethicone 250 mg Anti-gas (SIMETHICONE 250 MG): Purpose Antigas
// Claim id: cmpiycywb8sciplo7phc1bg5c  (ingestedBy: openfda_labels_v1)
//
// The claim already carries its OPEN/null -> RECORDED first entry (simethicone's
// emergence as an antifoaming/antiflatulent agent and its early OTC marketing). This
// script adds only the downstream arc, anchored exclusively to high-confidence
// canonical URLs:
//
//   RECORDED -> SETTLED (1982): FDA's over-the-counter antiflatulent drug review
//     culminated in the final monograph, codified at 21 CFR Part 332 ("Antiflatulent
//     Products for Over-the-Counter Human Use"). Simethicone was classified as the sole
//     Category I (generally recognized as safe and effective) antiflatulent active
//     ingredient, institutionally settling its status as THE monograph antigas agent —
//     precisely the claim the Firstcare label makes.
//
//   SETTLED -> CONTESTED (1994): A randomized, placebo-controlled, multicenter trial
//     (Metcalf et al., Pediatrics) found simethicone was no more effective than placebo
//     for infant colic, one of the flagship indications for which the drug was marketed.
//     This and subsequent reviews contested simethicone's clinical EFFICACY (distinct
//     from its uncontested safety): the "antigas" purpose is monograph-sanctioned, yet
//     the evidence that it relieves gas-related symptoms better than placebo is weak.
//
// Note the arc's shape is efficacy-contested, not safety-reversed: simethicone is
// physiologically inert and not absorbed, so there is no black box warning or
// withdrawal — the contestation is over whether it works, not whether it is safe.
//
// Only .gov-anchored / PubMed-anchored arcs are encoded.
// NOTE: web verification tooling was unavailable when authoring; both URLs are
// canonical regulator/index links asserted from high confidence, not a live 200 check.
// Date precision is deliberately hedged where the exact publication day is uncertain.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-firstcare-simethicone-antigas.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-firstcare-simethicone-antigas.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiycywb8sciplo7phc1bg5c'

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
    community: 'INSTITUTIONAL',
    occurredAt: '1982-08-20',
    datePrecision: 'YEAR',
    reason:
      "The US Food and Drug Administration's over-the-counter drug review for antiflatulent products concluded with a final monograph, codified at 21 CFR Part 332 (\"Antiflatulent Products for Over-the-Counter Human Use\"). Simethicone was classified as the only Category I active ingredient — generally recognized as safe and effective for OTC use as an antiflatulent — establishing it as the monograph-sanctioned antigas agent. This institutionally settled exactly the assertion the Firstcare label makes: that simethicone's labeled purpose is 'Antigas.'",
    source: {
      externalId: 'src:ecfr-21cfr332-antiflatulent-monograph',
      name:
        'US Food and Drug Administration. 21 CFR Part 332 — Antiflatulent Products for Over-the-Counter Human Use (final monograph; simethicone as sole Category I active ingredient).',
      url: 'https://www.ecfr.gov/current/title-21/part-332',
      publishedAt: '1982-08-20',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1994-07-01',
    datePrecision: 'MONTH',
    reason:
      "A randomized, double-blind, placebo-controlled, multicenter trial by Metcalf and colleagues, published in Pediatrics, found that simethicone was no more effective than placebo in relieving infant colic — one of the gas-related indications for which the drug was widely marketed. Together with later systematic reviews reaching similar conclusions, this contested the clinical efficacy underpinning simethicone's 'antigas' framing. The contestation targets efficacy rather than safety: simethicone is not systemically absorbed and carries no serious safety signal, so its monograph status persists even as evidence that it outperforms placebo remains weak.",
    source: {
      externalId: 'src:metcalf-simethicone-infant-colic-pediatrics-1994',
      name:
        'Metcalf TJ, Irons TG, Sher LD, Young PC. Simethicone in the treatment of infant colic: a randomized, placebo-controlled, multicenter trial. Pediatrics. 1994;94(1):29-34.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/8008533/',
      publishedAt: '1994-07-01',
      methodologyType: 'primary',
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
        ingestedBy: 'enrich:openfda_labels_v1',
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
