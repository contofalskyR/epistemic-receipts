// Enrichment: epistemic trajectory for the openFDA-label claim asserting the
// FDA-approved INDICATIONS AND USAGE of hydroxyzine hydrochloride — a first-
// generation piperazine antihistamine (marketed as Atarax) indicated for
// symptomatic relief of anxiety and tension, management of allergic and
// histamine-mediated pruritus (chronic urticaria, atopic/contact dermatoses),
// and as a sedative premedication.
//
// Claim (openfda_labels_v1): "HYDROXYZINE HYDROCHLORIDE (HYDROXYZINE
// HYDROCHLORIDE): INDICATIONS AND USAGE For symptomatic relief of anxiety and
// tension associated with psychoneurosis ... Useful in the management of
// pruritus due to allergic conditions such as chronic urticaria ... As a
// sedative when used as a premedication and following general anesthesia ..."
//
// The claim already carries its emergence entry (fromAxis=null). This script
// adds the downstream historical arc for hydroxyzine as an anxiolytic /
// antipruritic agent:
//
//   OPEN -> RECORDED (2002): Randomized controlled evidence for the anxiety
//     indication entered the peer-reviewed record via Llorca et al.'s 3-month
//     double-blind, placebo- and comparator-controlled trial of hydroxyzine in
//     generalized anxiety disorder (J Clin Psychiatry 2002) — the primary
//     controlled-human evidence that hydroxyzine relieves anxiety and tension.
//
//   RECORDED -> SETTLED (2010): The Cochrane systematic review "Hydroxyzine for
//     generalised anxiety disorder" (Guaiana, Barbui & Cipriani, Cochrane
//     Database Syst Rev 2010) pooled the randomized trials and confirmed
//     hydroxyzine's efficacy over placebo — settling its evidence-based standing
//     as an established anxiolytic across the accumulated clinical literature.
//
//   SETTLED -> CONTESTED (2015): The European Medicines Agency's referral
//     concluded that hydroxyzine carries a small risk of QT-interval
//     prolongation and torsade de pointes, and it introduced new restrictions
//     (dose caps, avoidance in patients with cardiac risk factors or on other
//     QT-prolonging drugs) — an official post-market safety signal that
//     contested the safety framing of a long-established use.
//
// Only high-confidence, DOI-anchored / EMA.europa.eu-anchored arcs are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-hydroxyzine-anxiety-pruritus-indications.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-hydroxyzine-anxiety-pruritus-indications.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy5q1z8kgcplo7pnuqwyce'

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

// Do NOT duplicate the existing null -> <first> emergence entry; start at OPEN -> RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2002-11-01',
    datePrecision: 'MONTH',
    reason:
      'Randomized controlled evidence for hydroxyzine as an anxiolytic entered the peer-reviewed record through Llorca and colleagues’ 3-month double-blind trial comparing hydroxyzine with placebo and an active comparator in patients with generalized anxiety disorder (Journal of Clinical Psychiatry, 2002). The study documented that hydroxyzine reduced anxiety and tension in a controlled human population, moving the label’s anxiety indication from clinical impression to recorded trial evidence. This is a primary controlled-trial publication placing hydroxyzine’s anxiolytic effect on the clinical scientific record.',
    source: {
      externalId: 'src:llorca-hydroxyzine-gad-jclinpsych-2002',
      name:
        'Llorca PM, Spadone C, Sol O, et al. Efficacy and safety of hydroxyzine in the treatment of generalized anxiety disorder: a 3-month double-blind study. Journal of Clinical Psychiatry. 2002;63(11):1020-1027.',
      url: 'https://doi.org/10.4088/JCP.v63n1112',
      publishedAt: '2002-11-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2010-12-08',
    datePrecision: 'DAY',
    reason:
      'The evidence-based standing of hydroxyzine as an anxiolytic settled when the Cochrane Collaboration pooled the randomized trials in "Hydroxyzine for generalised anxiety disorder" (Guaiana, Barbui & Cipriani, Cochrane Database of Systematic Reviews, 2010). The systematic review found hydroxyzine more effective than placebo for generalized anxiety disorder with tolerability comparable to benzodiazepines, consolidating the scattered trial record into a settled synthesis. Inclusion in a Cochrane review reflects the broad acceptance that established hydroxyzine as a recognized option for the label’s anxiety indication.',
    source: {
      externalId: 'src:cochrane-hydroxyzine-gad-cd006815-2010',
      name:
        'Guaiana G, Barbui C, Cipriani A. Hydroxyzine for generalised anxiety disorder. Cochrane Database of Systematic Reviews. 2010, Issue 12. Art. No.: CD006815.',
      url: 'https://doi.org/10.1002/14651858.CD006815.pub2',
      publishedAt: '2010-12-08',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2015-02-13',
    datePrecision: 'DAY',
    reason:
      'The European Medicines Agency’s Pharmacovigilance Risk Assessment Committee concluded a referral review finding that hydroxyzine is associated with a small but real risk of QT-interval prolongation and torsade de pointes, a cardiac arrhythmia. It recommended new restrictions — lower maximum daily doses, use for the shortest possible time, and avoidance in patients with cardiac risk factors or taking other QT-prolonging medicines. This official post-market safety signal contested the long-settled safety framing of an established anxiolytic and antipruritic and prompted revised European product information.',
    source: {
      externalId: 'src:ema-hydroxyzine-qt-prolongation-referral-2015',
      name:
        'European Medicines Agency. Hydroxyzine-containing medicinal products (Article 31 referral): new restrictions to minimise the risk of heart rhythm problems (QT prolongation). PRAC recommendation, 13 February 2015.',
      url: 'https://www.ema.europa.eu/en/medicines/human/referrals/hydroxyzine-containing-medicinal-products',
      publishedAt: '2015-02-13',
      methodologyType: 'derivative',
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
