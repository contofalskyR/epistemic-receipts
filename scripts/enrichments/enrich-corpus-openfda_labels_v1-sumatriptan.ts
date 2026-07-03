// Enrichment: epistemic arc for the FDA sumatriptan (Imitrex) label claim.
//
// Claim: cmpiyleew926cplo73t233vh1 (openfda_labels_v1)
//   SUMATRIPTAN — indicated for the acute treatment of migraine with or
//   without aura in adults. Not indicated for prevention; use only after a
//   clear diagnosis of migraine headache.
//
// Arc (extends the existing fromAxis=null -> OPEN entry; do not duplicate it):
//   OPEN     -> RECORDED (1991-08-01) The Subcutaneous Sumatriptan International
//                         Study Group, NEJM — the landmark randomized,
//                         placebo-controlled trial that first demonstrated
//                         sumatriptan relieves acute migraine attacks, the
//                         exact indication on this label. First authoritative
//                         published clinical evidence. Ratified by
//                         EXPERT_LITERATURE.
//   RECORDED -> SETTLED  (2000-09-26) AAN / US Headache Consortium evidence-
//                         based practice parameter (Neurology) — established
//                         the triptans, sumatriptan foremost, as a first-line
//                         standard of care for acute migraine, cementing broad
//                         clinical adoption. Ratified by INSTITUTIONAL.
//   SETTLED  -> CONTESTED (2006-07-19) FDA safety alert warning that combining
//                         triptans (5-HT1 agonists such as sumatriptan) with
//                         SSRIs or SNRIs can cause life-threatening serotonin
//                         syndrome, driving new class-wide labeling. A genuine
//                         post-market safety signal that complicated — but did
//                         not withdraw — the drug, so CONTESTED, not REVERSED.
//
// SETTLED -> REVERSED is NOT included: sumatriptan's acute-migraine indication
// carries cardiovascular contraindications and (from 2006) a serotonin-syndrome
// warning, but no market withdrawal and no revocation of the indication. Per
// AGENTS.md hard-fact principles, no transition is fabricated beyond what the
// cited .gov / DOI record supports.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-sumatriptan.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyleew926cplo73t233vh1'

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
    occurredAt: '1991-08-01',
    datePrecision: 'DAY',
    reason:
      'The Subcutaneous Sumatriptan International Study Group reported a randomized, double-blind, placebo-controlled trial showing that subcutaneous sumatriptan relieved acute migraine headache in roughly 70% of patients within one hour versus about 22% on placebo. This was the first authoritative published clinical evidence for the indication stated on this label — the acute treatment of migraine attacks in adults.',
    source: {
      externalId: 'src:sumatriptan-nejm-intl-study-group-1991',
      name: 'The Subcutaneous Sumatriptan International Study Group. "Treatment of Migraine Attacks with Sumatriptan." N Engl J Med 1991;325(5):316-321.',
      url: 'https://doi.org/10.1056/NEJM199108013250505',
      publishedAt: '1991-08-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2000-09-26',
    datePrecision: 'DAY',
    reason:
      'The American Academy of Neurology Quality Standards Subcommittee, working with the US Headache Consortium, published an evidence-based practice parameter for migraine headache that established the triptans — with sumatriptan as the prototype agent — as a first-line, standard-of-care option for the acute treatment of moderate-to-severe migraine. This guideline endorsement drove broad clinical adoption for exactly the acute-treatment indication on this label, settling the therapeutic consensus.',
    source: {
      externalId: 'src:sumatriptan-aan-practice-parameter-2000',
      name: 'Silberstein SD. "Practice parameter: evidence-based guidelines for migraine headache (an evidence-based review): report of the Quality Standards Subcommittee of the American Academy of Neurology." Neurology 2000;55(6):754-762.',
      url: 'https://doi.org/10.1212/WNL.55.6.754',
      publishedAt: '2000-09-26',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2006-07-19',
    datePrecision: 'DAY',
    reason:
      'The FDA issued an alert for healthcare professionals warning that the combined use of 5-HT1 receptor agonists (triptans such as sumatriptan) with selective serotonin reuptake inhibitors (SSRIs) or serotonin/norepinephrine reuptake inhibitors (SNRIs) can result in life-threatening serotonin syndrome, and directed corresponding class-wide labeling changes. Applying to sumatriptan, this post-market safety signal complicated the previously settled benefit consensus without withdrawing the drug or revoking its indication, moving the fact into a contested state.',
    source: {
      externalId: 'src:sumatriptan-fda-serotonin-syndrome-2006',
      name: 'FDA Alert / Information for Healthcare Professionals — "Selective Serotonin Reuptake Inhibitors (SSRIs), Selective Serotonin-Norepinephrine Reuptake Inhibitors (SNRIs), and 5-Hydroxytryptamine Receptor Agonists (Triptans): Life-threatening Serotonin Syndrome," July 2006.',
      url: 'https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/information-healthcare-professionals-selective-serotonin-reuptake-inhibitors-ssris-selective',
      publishedAt: '2006-07-19',
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
