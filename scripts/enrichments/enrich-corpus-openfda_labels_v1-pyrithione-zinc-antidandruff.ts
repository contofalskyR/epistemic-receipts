// Enrichment: epistemic trajectory for an openFDA-label claim asserting that
// CeraVe Anti-Dandruff Hydrating Conditioner's active ingredient PYRITHIONE ZINC
// carries the OTC "Purpose: Anti-dandruff" indication.
//
// Pyrithione zinc (zinc pyrithione, ZPT) is not a New-Drug-Application molecule;
// it is a long-marketed OTC anti-dandruff active whose epistemic arc runs through
// the U.S. OTC Drug Review monograph process and, downstream, through European
// hazard reclassification. The verifiable arc:
//
//   RECORDED -> SETTLED (1991-12-04): The FDA published the Final Monograph for
//     "Dandruff, Seborrheic Dermatitis, and Psoriasis Drug Products for Over-the-
//     Counter Human Use" (56 FR 63554), establishing pyrithione zinc as a
//     Category I (generally recognized as safe and effective) OTC anti-dandruff
//     active. The finding is codified at 21 CFR 358.710, which permits pyrithione
//     zinc at 0.3-2% and fixes the labeled "anti-dandruff" purpose that this claim
//     restates. INSTITUTIONAL settlement by the U.S. drug regulator.
//
//   SETTLED -> CONTESTED (2022-03-01): The European Commission reclassified zinc
//     pyrithione as toxic for reproduction (Repr. 1B) under the CLP framework and,
//     via Commission Regulation (EU) 2021/1902, added it to Annex II (prohibited
//     substances) of the Cosmetics Regulation (EC) No 1223/2009, banning its use
//     in cosmetic products from 1 March 2022. This post-market CMR safety signal
//     did not reverse the U.S. OTC-drug status, but it placed the "safe" half of
//     the safe-and-effective settlement under active regulatory contestation in a
//     major jurisdiction.
//
// Only high-confidence, official-record URLs (.gov eCFR, EUR-Lex ELI) are encoded.
// The first-clinical-evidence (OPEN -> RECORDED) node is intentionally omitted: no
// journal DOI could be verified in this session, and this pipeline's doctrine bars
// substituting model-recalled identifiers for a verifiable source.
//
// The claim already has its null -> RECORDED first entry; this script starts at
// RECORDED and does not duplicate it.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-pyrithione-zinc-antidandruff.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-pyrithione-zinc-antidandruff.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyjj7d8zvcplo76mrueq6q'

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
    occurredAt: '1991-12-04',
    datePrecision: 'DAY',
    reason:
      "The FDA published the Final Monograph for over-the-counter dandruff, seborrheic dermatitis, and psoriasis drug products (56 FR 63554, 4 December 1991), concluding the OTC Drug Review for this class. Pyrithione zinc was placed in Category I — generally recognized as safe and effective — as an anti-dandruff active at 0.3 to 2 percent, a finding codified at 21 CFR 358.710. This settled, by the U.S. drug regulator, the exact safe-and-effective 'anti-dandruff' purpose that the CeraVe label restates.",
    source: {
      externalId: 'src:fda-otc-dandruff-final-monograph-358-710',
      name:
        'U.S. FDA. Dandruff, Seborrheic Dermatitis, and Psoriasis Drug Products for Over-the-Counter Human Use; Final Monograph (56 FR 63554, Dec. 4, 1991), codified at 21 CFR 358.710 (active ingredients — pyrithione zinc).',
      url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-D/part-358/subpart-H/section-358.710',
      publishedAt: '1991-12-04',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2022-03-01',
    datePrecision: 'DAY',
    reason:
      "Following the harmonised CLP reclassification of zinc pyrithione as toxic for reproduction (Repr. 1B), Commission Regulation (EU) 2021/1902 of 29 October 2021 added the substance to Annex II — the list of substances prohibited in cosmetic products — of Cosmetics Regulation (EC) No 1223/2009, with the prohibition applying from 1 March 2022. The action does not touch the U.S. OTC-drug status of pyrithione zinc, but it is a post-market CMR safety signal from a major regulator that puts the 'safe' half of the anti-dandruff safe-and-effective settlement into active contestation.",
    source: {
      externalId: 'src:eu-reg-2021-1902-zinc-pyrithione-annex-ii-ban',
      name:
        'Commission Regulation (EU) 2021/1902 of 29 October 2021 amending Annexes II, III and V to Regulation (EC) No 1223/2009 as regards the use of certain substances classified as carcinogenic, mutagenic or toxic for reproduction (adds zinc pyrithione to Annex II; applicable from 1 March 2022).',
      url: 'https://eur-lex.europa.eu/eli/reg/2021/1902/oj',
      publishedAt: '2021-10-29',
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
