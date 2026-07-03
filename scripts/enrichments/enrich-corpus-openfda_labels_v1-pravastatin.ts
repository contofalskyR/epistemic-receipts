// Enrichment: epistemic arc for the FDA pravastatin sodium (Pravachol) label claim.
//
// Claim: cmpiyk0h090e6plo7vs4a8q3k (openfda_labels_v1)
//   PRAVASTATIN SODIUM — indicated to reduce the risk of MI, myocardial
//   revascularization, and cardiovascular mortality in adults with elevated
//   LDL-C without clinically evident CHD (primary prevention), and to reduce
//   the risk of coronary death, MI, revascularization, stroke/TIA and slow
//   atherosclerosis progression in patients with established disease.
//
// Arc (extends the existing fromAxis=null -> OPEN entry; do not duplicate it):
//   OPEN     -> RECORDED (1995-11-16) WOSCOPS (West of Scotland Coronary
//                         Prevention Study), NEJM — the landmark randomized
//                         Phase III trial that first demonstrated pravastatin
//                         reduces MI and coronary death in hypercholesterolemic
//                         men WITHOUT prior CHD, the exact primary-prevention
//                         claim on this label. Ratified by EXPERT_LITERATURE.
//   RECORDED -> SETTLED  (2001-05-16) NCEP ATP III (JAMA) — the national
//                         cholesterol guideline that made statin therapy the
//                         standard of care for LDL-C reduction and CHD-risk
//                         reduction, cementing broad clinical adoption.
//   SETTLED  -> CONTESTED (2012-02-28) FDA Drug Safety Communication requiring
//                         class-wide statin label changes: new warnings for
//                         increased blood glucose / incident diabetes and rare
//                         cognitive effects. A genuine post-market safety signal
//                         affecting the statin class (including pravastatin) —
//                         not a withdrawal, so CONTESTED rather than REVERSED.
//
// SETTLED -> REVERSED is NOT included: pravastatin's cardiovascular indications
// carry no black-box warning and no market withdrawal. The 2012 communication
// tempered but did not overturn the benefit consensus, so CONTESTED is the
// honest terminal state. Per AGENTS.md hard-fact principles, no transition is
// fabricated beyond what the cited .gov / DOI record supports.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-pravastatin.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyk0h090e6plo7vs4a8q3k'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
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
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1995-11-16',
    datePrecision: 'DAY',
    reason:
      'The West of Scotland Coronary Prevention Study (WOSCOPS), a randomized double-blind Phase III trial in 6,595 hypercholesterolemic men with no history of myocardial infarction, reported that pravastatin cut the risk of nonfatal MI and death from coronary heart disease by roughly 31% versus placebo. This was the first authoritative published evidence for the primary-prevention indication stated on this label — reducing MI risk in adults with elevated LDL-C without clinically evident CHD.',
    source: {
      externalId: 'src:pravastatin-woscops-1995',
      name: 'Shepherd J, et al. "Prevention of Coronary Heart Disease with Pravastatin in Men with Hypercholesterolemia." N Engl J Med 1995;333:1301-1307.',
      url: 'https://doi.org/10.1056/NEJM199511163332001',
      publishedAt: '1995-11-16',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2001-05-16',
    datePrecision: 'DAY',
    reason:
      'The National Cholesterol Education Program (NCEP) Adult Treatment Panel III report established LDL-lowering statin therapy as the standard of care for reducing coronary heart disease risk, defining LDL-C treatment targets and risk-based intensity across primary and secondary prevention. Its guideline endorsement drove broad clinical adoption of statins such as pravastatin for exactly the risk-reduction indications on this label, settling the therapeutic consensus.',
    source: {
      externalId: 'src:pravastatin-ncep-atp3-2001',
      name: 'Expert Panel. "Executive Summary of the Third Report of the NCEP Expert Panel on Detection, Evaluation, and Treatment of High Blood Cholesterol in Adults (ATP III)." JAMA 2001;285(19):2486-2497.',
      url: 'https://doi.org/10.1001/jama.285.19.2486',
      publishedAt: '2001-05-16',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2012-02-28',
    datePrecision: 'DAY',
    reason:
      'The FDA issued a Drug Safety Communication requiring class-wide labeling changes for cholesterol-lowering statins, adding warnings that statins can raise blood glucose and HbA1c (increased risk of incident diabetes) and can be associated with rare, generally reversible cognitive effects such as memory loss and confusion. Applying to pravastatin and the whole statin class, this post-market safety signal complicated the previously settled benefit consensus without withdrawing the drugs from market, moving the fact into a contested state.',
    source: {
      externalId: 'src:pravastatin-fda-statin-safety-2012',
      name: 'FDA Drug Safety Communication — "Important safety label changes to cholesterol-lowering statin drugs," 2012-02-28.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-important-safety-label-changes-cholesterol-lowering-statin-drugs',
      publishedAt: '2012-02-28',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const occurredAt = new Date(t.occurredAt)
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
    })

    console.log(`upserted ${slug} (${t.fromAxis} -> ${t.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
