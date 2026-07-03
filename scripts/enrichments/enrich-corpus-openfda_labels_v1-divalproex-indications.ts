// Enrichment: epistemic arc for the anti-epileptic active ingredient
// divalproex sodium behind a "Divalproex Sodium Delayed-Release Tablets"
// FDA drug label.
//
// Claim: cmpiyly3u92r0plo7d7hb4un1 (openfda_labels_v1)
//   "Divalproex Sodium (DIVALPROEX SODIUM): 1 INDICATIONS AND USAGE ...
//    • Treatment of manic episodes associated with bipolar disorder
//    • Monotherapy and adjunctive therapy of ... seizures
//    • Prophylaxis of migraine headaches ..."
//
// The label carries three indications. The migraine-prophylaxis indication
// has the cleanest, fully-dateable epistemic arc, and the post-market safety
// reversal below is migraine-specific, so the arc is anchored there:
//   OPEN -> RECORDED  (1995): First US double-blind placebo-controlled RCT of
//                             divalproex for migraine prophylaxis (Mathew et al.,
//                             Arch Neurol) — the efficacy basis for the 1996 FDA
//                             migraine indication the label asserts.
//   RECORDED -> SETTLED (2012): AAN/AHS evidence-based guideline update rates
//                             divalproex sodium Level A (established efficacy)
//                             for episodic migraine prevention -> standard of care.
//   SETTLED -> REVERSED (2013): FDA contraindicates valproate products for
//                             migraine prevention in pregnant women (Pregnancy
//                             Category X) after decreased-IQ findings — a formal
//                             regulatory reversal of the migraine indication for
//                             that population.
//
// Does NOT create a Claim (claim already exists). Idempotent upserts.
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-divalproex-indications.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyly3u92r0plo7d7hb4un1'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED: first controlled trial evidence in migraine prophylaxis ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1995-03-01',
    datePrecision: 'MONTH',
    reason:
      'Mathew and colleagues reported the first US multicenter double-blind, placebo-controlled randomized trial of divalproex sodium for migraine prophylaxis in the Archives of Neurology (1995;52(3):281-286), showing a significantly greater reduction in migraine frequency versus placebo. This entered the peer-reviewed neurology literature the controlled efficacy evidence that underpinned the FDA migraine-prophylaxis indication the label asserts.',
    source: {
      externalId: 'src:mathew-1995-divalproex-migraine-prophylaxis',
      name: 'Mathew NT, Saper JR, Silberstein SD, et al. Migraine prophylaxis with divalproex. Arch Neurol. 1995;52(3):281-286.',
      url: 'https://doi.org/10.1001/archneur.1995.00540270077022',
      publishedAt: '1995-03-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: professional-society guideline Level A ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2012-04-24',
    datePrecision: 'DAY',
    reason:
      'The American Academy of Neurology and American Headache Society evidence-based guideline update on pharmacologic treatment for episodic migraine prevention (Neurology 2012;78(17):1337-1345) rated divalproex sodium as Level A — established efficacy — recommending it as first-line migraine-prophylaxis therapy. Level-A placement in a definitive professional-society guideline reflects the broad clinical adoption and standard-of-care status of the migraine indication carried by the label.',
    source: {
      externalId: 'src:aan-ahs-2012-episodic-migraine-prevention-guideline',
      name: 'Silberstein SD, Holland S, Freitag F, et al. Evidence-based guideline update: Pharmacologic treatment for episodic migraine prevention in adults. Neurology. 2012;78(17):1337-1345.',
      url: 'https://doi.org/10.1212/WNL.0b013e3182535d20',
      publishedAt: '2012-04-24',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> REVERSED: FDA contraindicates valproate for migraine in pregnancy ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2013-05-06',
    datePrecision: 'DAY',
    reason:
      'On 6 May 2013 the FDA issued a Drug Safety Communication announcing that valproate products — including divalproex sodium — are contraindicated and reclassified to Pregnancy Category X for migraine prevention in pregnant women, after data showed decreased IQ scores in children exposed in utero. This formally reverses the migraine-prophylaxis indication for that population: the benefit no longer outweighs the risk, and the label must now bar the use it otherwise asserts.',
    source: {
      externalId: 'src:fda-dsc-2013-valproate-migraine-pregnancy-contraindicated',
      name: 'FDA Drug Safety Communication: Valproate Anti-seizure Products Contraindicated for Migraine Prevention in Pregnant Women due to Decreased IQ Scores in Exposed Children (6 May 2013).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-valproate-anti-seizure-products-contraindicated-migraine-prevention',
      publishedAt: '2013-05-06',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1-divalproex-indications',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`\nDone. ${TRANSITIONS.length} transitions upserted for ${CLAIM_ID}.`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
