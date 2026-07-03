// Enrichment: epistemic arc for the openFDA label claim
//   "Mucus Relief DM (DEXTROMETHORPHAN HBR, GUAIFENESIN): Purpose Cough suppressant Expectorant"
//   claimId cmpiyidcb8yh6plo71bq40v84 (ingestedBy: openfda_labels_v1)
//
// The product pairs dextromethorphan (antitussive / cough suppressant) with
// guaifenesin (expectorant). Its epistemic arc as a therapeutic label claim:
//   OPEN  -> RECORDED   first controlled clinical evidence (guaifenesin RCT, Chest 1982)
//   RECORDED -> SETTLED  FDA OTC Drug Review — both actives Category I (GRASE), 21 CFR 341
//   SETTLED -> CONTESTED FDA 2008 advisory: do not use in children < 2 (safety signal)
//
// Does NOT create a new Claim — upserts Source + ClaimStatusHistory rows against
// the existing claim id. Idempotent (upsert on stable ids).
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucus-relief-dm-dxm-guaifenesin.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucus-relief-dm-dxm-guaifenesin.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyidcb8yh6plo71bq40v84'

type FactStatus =
  | 'OPEN'
  | 'RECORDED'
  | 'SETTLED'
  | 'CONTESTED'
  | 'REVERSED'
  | 'ABANDONED'
  | 'UNRESOLVABLE'
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
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

// The claim's first ClaimStatusHistory row (fromAxis=null -> RECORDED at ingest)
// already exists; these transitions extend the arc beyond it and are keyed by
// their own (toAxis, occurredAt) slugs, so no duplication occurs.
const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED: first controlled clinical evidence ──────────────────
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1982-12-01',
    datePrecision: 'MONTH',
    reason:
      'Kuhn and colleagues published the first rigorous placebo-controlled test of an active in this combination — a double-blind, randomized trial of guaifenesin in young adults with natural colds — reporting that guaifenesin significantly reduced cough frequency and sputum thickness versus placebo. Combined with the earlier body of antitussive evidence for dextromethorphan, this established that both actives had measurable, published clinical effects for the labeled purposes of cough suppression and expectoration.',
    source: {
      externalId: 'src:mucus-relief-dm-kuhn-guaifenesin-chest-1982',
      name: 'Kuhn JJ, Hendley JO, Adams KF, Clark JW, Gwaltney JM Jr. Antitussive effect of guaifenesin in young adults with natural colds. Results of a double-blind, placebo-controlled trial. Chest. 1982 Dec;82(6):713–718.',
      url: 'https://doi.org/10.1378/chest.82.6.713',
      publishedAt: '1982-12-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: FDA OTC Drug Review, both actives Category I ──────
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1987-08-12',
    datePrecision: 'DAY',
    reason:
      'Through the OTC Drug Review, FDA classified dextromethorphan as a Category I (generally recognized as safe and effective) antitussive and guaifenesin as the sole Category I expectorant, codified in the final monograph for over-the-counter cold, cough, allergy, bronchodilator, and antihistamine drug products at 21 CFR part 341. This settled the labeled "cough suppressant / expectorant" purposes as a nationally recognized regulatory standard, permitting marketing of monograph-conforming products such as this one without individual approval.',
    source: {
      externalId: 'src:mucus-relief-dm-otc-monograph-21cfr341',
      name: 'FDA final monograph, Cold, Cough, Allergy, Bronchodilator, and Antihistamine Drug Products for OTC Human Use (antitussive final monograph, 52 FR 30042, Aug. 12, 1987), codified at 21 CFR part 341.',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1987-08-12',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: FDA 2008 pediatric safety advisory ──────────────
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2008-01-17',
    datePrecision: 'DAY',
    reason:
      'FDA issued a public health advisory recommending that over-the-counter cough and cold products — the class that includes dextromethorphan/guaifenesin combinations — not be used to treat infants and children under 2 years, citing rare but serious and potentially life-threatening adverse events. Manufacturers subsequently relabeled products against use in children under 4, contesting the previously unqualified safety of the labeled purposes for a key population and marking a durable post-market safety signal.',
    source: {
      externalId: 'src:mucus-relief-dm-fda-pediatric-cough-cold-2008',
      name: 'FDA, "Use Caution When Giving Cough and Cold Products to Kids" (public health advisory, Jan. 17, 2008; do not use OTC cough/cold products in children under 2).',
      url: 'https://www.fda.gov/drugs/special-features/use-caution-when-giving-cough-and-cold-products-kids',
      publishedAt: '2008-01-17',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions${DRY_RUN ? ' [DRY RUN]' : ''}...`,
  )

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${slug}  (${tr.fromAxis ?? 'null'} -> ${tr.toAxis})  ${tr.source.url}`)
      continue
    }

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

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId: CLAIM_ID, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug}  (${tr.fromAxis ?? 'null'} -> ${tr.toAxis})`)
  }

  console.log('\nDone.')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
