// Enrich the epistemic arc for the Digenyx (Hyoscyamine Sulfate 0.125 mg) FDA-label
// claim (openfda_labels_v1).
//
// Claim: cmpiy4wci8jxuplo7d4sy0o8b — Hyoscyamine sulfate tablets indicated as an
// anticholinergic/antispasmodic adjunct for GI/GU conditions (peptic ulcer disease,
// irritable bowel syndrome / functional bowel, smooth-muscle spasm).
//
// Hyoscyamine is the levorotatory belladonna (tropane) alkaloid — a centuries-old
// agent marketed without a modern NDA. Its defensible epistemic arc is class-level:
// the antispasmodic/anticholinergic evidence base for IBS, its institutional
// guideline endorsement, and the post-market anticholinergic-burden dementia signal
// that now contests unqualified long-term use.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  2008-11  first high-quality systematic evidence that
//                                  antispasmodics (the class incl. hyoscyamine)
//                                  reduce IBS symptoms (Ford et al., BMJ)
//   RECORDED -> SETTLED   2017-04  NICE CG61 recommends antispasmodics as first-line
//                                  pharmacological therapy for IBS (standard of care)
//   SETTLED  -> CONTESTED 2019-06  anticholinergic cumulative-exposure dementia
//                                  signal (Coupland et al., JAMA Intern Med)
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-hyoscyamine-sulfate-ibs-antispasmodic.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-hyoscyamine-sulfate-ibs-antispasmodic.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy4wci8jxuplo7d4sy0o8b'

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
  // ── OPEN -> RECORDED: first robust class-level clinical evidence in IBS (2008) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2008-11-13',
    datePrecision: 'DAY',
    reason:
      'Ford and colleagues published a systematic review and meta-analysis in the BMJ (13 November 2008) pooling randomized controlled trials of antispasmodics — the pharmacological class to which hyoscyamine belongs — and found a statistically significant benefit over placebo for global irritable bowel syndrome symptoms (NNT ~5). This was the first high-quality synthesis establishing that antispasmodic/anticholinergic therapy has measurable efficacy in functional bowel disease, the evidentiary basis for the label indication captured in the openFDA record.',
    source: {
      externalId: 'src:hyoscyamine-antispasmodic-ibs-ford-bmj-2008',
      name: 'Ford AC, Talley NJ, Spiegel BMR, et al. Effect of fibre, antispasmodics, and peppermint oil in the treatment of irritable bowel syndrome: systematic review and meta-analysis. BMJ. 2008;337:a2313.',
      url: 'https://doi.org/10.1136/bmj.a2313',
      publishedAt: '2008-11-13',
      methodologyType: 'derivative',
    },
  },

  // ── RECORDED -> SETTLED: institutional guideline endorsement / standard of care (2017) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2017-04-01',
    datePrecision: 'MONTH',
    reason:
      'The UK National Institute for Health and Care Excellence guideline CG61 ("Irritable bowel syndrome in adults: diagnosis and management," last updated April 2017) recommends antispasmodic agents as a first-line pharmacological option for IBS, ratifying the antispasmodic/anticholinergic class as standard symptomatic therapy. This institutional endorsement settled hyoscyamine and its congeners as accepted adjunctive treatment for functional bowel and smooth-muscle spasm.',
    source: {
      externalId: 'src:hyoscyamine-nice-cg61-ibs-2017',
      name: 'National Institute for Health and Care Excellence (NICE). Irritable bowel syndrome in adults: diagnosis and management. Clinical guideline CG61 (published 2008; last updated April 2017).',
      url: 'https://www.nice.org.uk/guidance/cg61',
      publishedAt: '2017-04-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: post-market anticholinergic-burden dementia signal (2019) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2019-06-24',
    datePrecision: 'DAY',
    reason:
      'Coupland and colleagues reported in JAMA Internal Medicine (24 June 2019) a large nested case-control study (QResearch, ~284,000 patients) finding that cumulative exposure to strong anticholinergic drugs — the class that includes hyoscyamine and other gastrointestinal antimuscarinics — was associated with a significantly increased risk of incident dementia. This post-market pharmacoepidemiologic safety signal, reinforcing earlier anticholinergic-burden findings, contests unqualified long-term use of hyoscyamine in older adults rather than reversing the approved symptomatic indication.',
    source: {
      externalId: 'src:hyoscyamine-anticholinergic-dementia-coupland-2019',
      name: 'Coupland CAC, Hill T, Dening T, et al. Anticholinergic Drug Exposure and the Risk of Dementia: A Nested Case-Control Study. JAMA Intern Med. 2019;179(8):1084–1093.',
      url: 'https://doi.org/10.1001/jamainternmed.2019.0677',
      publishedAt: '2019-06-24',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const t of TRANSITIONS) {
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${historyId})`)
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda-labels',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
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

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Done — ${TRANSITIONS.length} transitions processed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
