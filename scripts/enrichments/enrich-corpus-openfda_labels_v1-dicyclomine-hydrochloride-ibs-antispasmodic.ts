// Enrich the epistemic arc for the Dicyclomine Hydrochloride FDA-label claim
// (openfda_labels_v1).
//
// Claim: cmpiy5oqs8kf0plo7epbg2elz — Dicyclomine hydrochloride tablets, an
// antispasmodic and anticholinergic (antimuscarinic) agent indicated for the
// treatment of functional bowel/irritable bowel syndrome (IBS).
//
// Dicyclomine (Bentyl) is one of the oldest marketed GI antispasmodics. Its
// defensible epistemic arc is anchored to the very indication the label captures:
// the pivotal placebo-controlled trial that established efficacy in IBS, the
// meta-analytic consolidation that codified antispasmodics as an accepted
// symptomatic therapy for IBS, and the geriatric-safety contestation that flags
// dicyclomine's anticholinergic burden as potentially inappropriate in older adults.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1981-06     Page & Dirnberger double-blind placebo-controlled
//                                     trial (J Clin Gastroenterol) — dicyclomine relieves
//                                     IBS symptoms vs placebo
//   RECORDED -> SETTLED   2008-11-13  Ford et al. systematic review & meta-analysis (BMJ)
//                                     consolidates antispasmodics as effective symptomatic
//                                     therapy for IBS, underpinning standard-of-care use
//   SETTLED  -> CONTESTED 2023-05-04  2023 AGS Beers Criteria list dicyclomine among
//                                     anticholinergics to avoid in older adults
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-dicyclomine-hydrochloride-ibs-antispasmodic.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-dicyclomine-hydrochloride-ibs-antispasmodic.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy5oqs8kf0plo7epbg2elz'

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
  // ── OPEN -> RECORDED: pivotal placebo-controlled trial in IBS (1981) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1981-06-01',
    datePrecision: 'MONTH',
    reason:
      'Page and Dirnberger published a double-blind, placebo-controlled trial of dicyclomine hydrochloride (Bentyl) in patients with the irritable bowel syndrome in the Journal of Clinical Gastroenterology in June 1981. Dicyclomine produced significantly greater global symptom improvement than placebo, establishing the first controlled clinical evidence for the antispasmodic in functional bowel/IBS. This trial is the primary efficacy evidence underlying the label indication captured in the openFDA record.',
    source: {
      externalId: 'src:dicyclomine-page-dirnberger-jcg-1981',
      name: 'Page JG, Dirnberger GM. Treatment of the irritable bowel syndrome with Bentyl (dicyclomine hydrochloride). J Clin Gastroenterol. 1981;3(2):153–156.',
      url: 'https://doi.org/10.1097/00004836-198106000-00009',
      publishedAt: '1981-06-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: meta-analytic consolidation of antispasmodics (2008) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2008-11-13',
    datePrecision: 'DAY',
    reason:
      'Ford and colleagues published a systematic review and meta-analysis of fibre, antispasmodics, and peppermint oil for the irritable bowel syndrome in the BMJ on 13 November 2008. Pooling randomized controlled trials, the analysis found antispasmodics — the pharmacologic class of which dicyclomine is a member — significantly more effective than placebo for global IBS symptoms and abdominal pain. This evidence synthesis consolidated antispasmodics as an accepted symptomatic therapy for IBS and was subsequently incorporated into major society guidance, settling the label indication as standard of care.',
    source: {
      externalId: 'src:dicyclomine-ford-antispasmodics-ibs-bmj-2008',
      name: 'Ford AC, Talley NJ, Spiegel BMR, et al. Effect of fibre, antispasmodics, and peppermint oil in the treatment of irritable bowel syndrome: systematic review and meta-analysis. BMJ. 2008;337:a2313.',
      url: 'https://doi.org/10.1136/bmj.a2313',
      publishedAt: '2008-11-13',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: geriatric-safety flag in the 2023 Beers Criteria ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2023-05-04',
    datePrecision: 'DAY',
    reason:
      'The American Geriatrics Society 2023 updated AGS Beers Criteria, published in the Journal of the American Geriatrics Society, list dicyclomine among the anticholinergic gastrointestinal antispasmodics that are potentially inappropriate for use in older adults because of uncertain effectiveness and high anticholinergic burden (risk of confusion, dry mouth, constipation, and other adverse effects). This institutional safety guidance contests the appropriateness of the marketed agent in the geriatric population rather than reversing its approved IBS indication.',
    source: {
      externalId: 'src:dicyclomine-ags-beers-criteria-2023',
      name: 'By the 2023 American Geriatrics Society Beers Criteria Update Expert Panel. American Geriatrics Society 2023 updated AGS Beers Criteria for potentially inappropriate medication use in older adults. J Am Geriatr Soc. 2023;71(7):2052–2081.',
      url: 'https://doi.org/10.1111/jgs.18372',
      publishedAt: '2023-05-04',
      methodologyType: 'derivative',
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
