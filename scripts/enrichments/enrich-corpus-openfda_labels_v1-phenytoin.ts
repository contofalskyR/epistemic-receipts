// Enrichment: epistemic arc for the FDA phenytoin sodium (Dilantin) label claim.
//
// Claim: cmpiykv7791hoplo7pe09n5bh (openfda_labels_v1)
//   PHENYTOIN SODIUM — extended phenytoin sodium capsules indicated for the
//   treatment of tonic-clonic (grand mal) and psychomotor (temporal lobe)
//   seizures and prevention/treatment of seizures during or following
//   neurosurgery.
//
// Arc (extends the existing fromAxis=null -> OPEN entry; do not duplicate it):
//   OPEN     -> RECORDED  (1938-09-17) Merritt & Putnam, JAMA — the landmark
//                         clinical report demonstrating that sodium
//                         diphenylhydantoinate controls convulsive (grand mal
//                         and psychomotor) seizures in patients. This is the
//                         first authoritative published clinical evidence for
//                         the exact indication on this label. EXPERT_LITERATURE.
//   RECORDED -> SETTLED   (2006-07-01) ILAE treatment guidelines (Epilepsia) —
//                         the International League Against Epilepsy's
//                         evidence-based analysis rating phenytoin as an
//                         established efficacious/effective initial monotherapy,
//                         codifying decades of standard-of-care use. INSTITUTIONAL.
//   SETTLED  -> CONTESTED (2008-01-31) FDA alert on suicidal behavior/ideation
//                         and antiepileptic drugs — a class-wide post-market
//                         safety signal (meta-analysis of 199 trials, ~doubled
//                         risk) that led to new warnings on phenytoin and all
//                         AEDs. A genuine safety signal short of withdrawal, so
//                         CONTESTED rather than REVERSED. INSTITUTIONAL.
//
// SETTLED -> REVERSED is NOT included: phenytoin remains a marketed, guideline-
// recognized anticonvulsant; the 2008 signal tempered but did not overturn its
// efficacy consensus. Per AGENTS.md hard-fact principles, no transition is
// fabricated beyond what the cited .gov / DOI record supports.
//
// Verification note: web fetch was unavailable in the authoring environment;
// URLs are canonical, widely-cited references (stable FDA.gov page + publisher
// DOIs) chosen for high confidence rather than live-fetched confirmation.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-phenytoin.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiykv7791hoplo7pe09n5bh'

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
    occurredAt: '1938-09-17',
    datePrecision: 'DAY',
    reason:
      'Merritt and Putnam reported that sodium diphenylhydantoinate (phenytoin) controlled convulsive seizures in a clinical series of epilepsy patients, following their earlier animal work identifying its anticonvulsant properties. This was the first authoritative published clinical evidence that phenytoin treats tonic-clonic (grand mal) and psychomotor seizures — the exact indication stated on this label — and it introduced the drug that would dominate seizure therapy for the rest of the century.',
    source: {
      externalId: 'src:phenytoin-merritt-putnam-1938',
      name: 'Merritt HH, Putnam TJ. "Sodium Diphenyl Hydantoinate in the Treatment of Convulsive Disorders." JAMA 1938;111(12):1068-1073.',
      url: 'https://doi.org/10.1001/jama.1938.02790380010004',
      publishedAt: '1938-09-17',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2006-07-01',
    datePrecision: 'MONTH',
    reason:
      'The International League Against Epilepsy (ILAE) published evidence-based treatment guidelines rating antiepileptic drug efficacy as initial monotherapy, classifying phenytoin among the established effective agents for partial-onset and generalized tonic-clonic seizures in adults. The formal guideline endorsement codified phenytoin\'s long-standing standard-of-care status for exactly the seizure indications on this label, settling the therapeutic consensus that had built up over decades of clinical use.',
    source: {
      externalId: 'src:phenytoin-ilae-guidelines-2006',
      name: 'Glauser T, et al. "ILAE Treatment Guidelines: Evidence-based Analysis of Antiepileptic Drug Efficacy and Effectiveness as Initial Monotherapy for Epileptic Seizures and Syndromes." Epilepsia 2006;47(7):1094-1120.',
      url: 'https://doi.org/10.1111/j.1528-1167.2006.00585.x',
      publishedAt: '2006-07-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2008-01-31',
    datePrecision: 'DAY',
    reason:
      'The FDA alerted healthcare professionals that a meta-analysis of 199 placebo-controlled trials of 11 antiepileptic drugs found roughly double the risk of suicidal behavior or ideation among patients taking these medications, and it subsequently required class-wide warning labeling covering phenytoin. This post-market safety signal applied across the antiepileptic class, including phenytoin, complicating its previously settled benefit profile without removing the drug from market — moving the fact into a contested rather than reversed state.',
    source: {
      externalId: 'src:phenytoin-fda-aed-suicidality-2008',
      name: 'FDA — "Suicidal Behavior and Ideation and Antiepileptic Drugs," healthcare professional alert, 2008-01-31.',
      url: 'https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/suicidal-behavior-and-ideation-and-antiepileptic-drugs',
      publishedAt: '2008-01-31',
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
