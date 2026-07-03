// Enrichment: epistemic trajectory for an openFDA-label-ingested claim asserting
// that GUAIFENESIN DM (guaifenesin + dextromethorphan) is a "Non-Narcotic, Alcohol
// Free Expectorant/Cough Suppressant."
//
// The claim is an OTC drug-facts label statement, but it stands on a real, dateable,
// primary-sourced scientific and regulatory arc:
//
//   OPEN -> RECORDED (1982): Kuhn, Hendley, Adams, Clark and Gwaltney publish the
//     first objective, placebo-controlled clinical evaluation of guaifenesin in
//     natural colds ("Antitussive effect of guaifenesin in young adults with natural
//     colds," Chest 1982), measuring cough frequency and sputum objectively. This is
//     the primary clinical evidence underpinning the "expectorant" activity in the
//     ingested GUAIFENESIN DM claim. (Dextromethorphan, the non-narcotic cough
//     suppressant, had itself been characterized as a codeine-equivalent antitussive
//     without addiction liability since the 1950s.)
//
//   RECORDED -> SETTLED (1987): The FDA over-the-counter drug review's Cold, Cough,
//     Allergy, Bronchodilator, and Antiasthmatic Drug Products monograph (final
//     monograph for antitussives, 52 FR 30042; codified at 21 CFR part 341) recognizes
//     dextromethorphan as the monographed non-narcotic (Category I) antitussive and
//     guaifenesin as the monographed expectorant. This institutionalized the exact
//     "expectorant / cough suppressant" combination labeling the claim reproduces,
//     making it permitted OTC monograph language rather than a manufacturer assertion.
//
//   SETTLED -> CONTESTED (2008): An FDA public-health action contested the assumption
//     that these OTC cough/cold combinations are safe across all ages. After reviewing
//     serious and fatal adverse events, the FDA recommended that OTC cough and cold
//     products not be used in children under 2 years; manufacturers then voluntarily
//     relabeled products "do not use in children under 4." The signal reframed the
//     combination as safe only within tightened age and dose limits, directly echoing
//     the ingested label's own dosing warnings.
//
// Only high-confidence, canonical DOI / .gov-anchored arcs are encoded.
// NOTE: URLs below were NOT live-fetched (web tools unavailable this session); they
// are a canonical publisher DOI, the stable eCFR codification of 21 CFR part 341, and
// a stable FDA drug-safety consumer page.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-guaifenesin-dm-expectorant-cough-suppressant.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-guaifenesin-dm-expectorant-cough-suppressant.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiydlbp8t30plo7jbpd76hb'

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

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1982-12-01',
    datePrecision: 'MONTH',
    reason:
      'Guaifenesin’s expectorant/antitussive activity entered the objective clinical record when Kuhn, Hendley, Adams, Clark and Gwaltney published "Antitussive effect of guaifenesin in young adults with natural colds" in Chest (1982), the first placebo-controlled study to measure cough frequency and sputum characteristics objectively rather than by symptom report. The trial documented a reduction in cough and improved sputum handling, providing the primary clinical evidence for the "expectorant" half of the ingested GUAIFENESIN DM claim. Dextromethorphan, the paired non-narcotic cough suppressant, had already been characterized in the 1950s as a codeine-equivalent antitussive lacking narcotic addiction liability.',
    source: {
      externalId: 'src:kuhn-guaifenesin-antitussive-chest-1982',
      name:
        'Kuhn JJ, Hendley JO, Adams KF, Clark JW, Gwaltney JM Jr. Antitussive effect of guaifenesin in young adults with natural colds. Objective and subjective assessment. Chest. 1982 Dec;82(6):713-718.',
      url: 'https://doi.org/10.1378/chest.82.6.713',
      publishedAt: '1982-12-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1987-08-12',
    datePrecision: 'DAY',
    reason:
      'The FDA over-the-counter drug review settled the combination’s status through the Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products rulemaking. The final monograph for OTC antitussives (52 FR 30042) and its codified framework at 21 CFR part 341 recognize dextromethorphan as the monographed non-narcotic (Category I) cough suppressant and guaifenesin as the monographed expectorant. This institutional codification made the exact "expectorant / cough suppressant" combination labeling standard, permitted OTC monograph language rather than a manufacturer assertion.',
    source: {
      externalId: 'src:fda-otc-cough-cold-monograph-21cfr341',
      name:
        'U.S. Food and Drug Administration. 21 CFR Part 341 — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use (antitussive final monograph, 52 FR 30042, Aug 12, 1987).',
      url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-D/part-341',
      publishedAt: '1987-08-12',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2008-01-17',
    datePrecision: 'DAY',
    reason:
      'An FDA public-health action contested the assumption that OTC cough/cold combinations like guaifenesin-dextromethorphan are safe across all patients. After reviewing serious and fatal adverse events, the FDA recommended that over-the-counter cough and cold products not be used to treat infants and children under 2 years of age; manufacturers subsequently relabeled products voluntarily to state "do not use in children under 4 years." The signal reframed the combination as safe only within tightened age and dosing limits, directly reflecting the ingested label’s own warnings not to exceed the recommended dosage.',
    source: {
      externalId: 'src:fda-otc-cough-cold-children-safety-2008',
      name:
        'U.S. Food and Drug Administration. Use Caution When Giving Cough and Cold Products to Kids (FDA public health advisory / consumer guidance, Jan 17, 2008).',
      url: 'https://www.fda.gov/drugs/special-features/use-caution-when-giving-cough-and-cold-products-kids',
      publishedAt: '2008-01-17',
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
