// Enrichment: epistemic trajectory for the openFDA-label claim asserting the
// FDA-approved INDICATIONS AND USAGE of dexamethasone — a synthetic
// glucocorticoid used across allergic states, dermatologic diseases, endocrine
// disorders, and many other anti-inflammatory / immunosuppressive indications.
//
// Claim (openfda_labels_v1): "Dexamethasone (DEXAMETHASONE): INDICATIONS AND
// USAGE Allergic States ... Dermatologic Diseases ... Endo[crine] ..."
//
// The claim already carries its emergence entry (fromAxis=null). This script
// adds the downstream historical arc for dexamethasone as a therapeutic agent:
//
//   OPEN -> RECORDED (1958): Dexamethasone (9alpha-fluoro-16alpha-
//     methylprednisolone) is first reported in the peer-reviewed literature as a
//     new, highly potent anti-inflammatory 16-methylated corticosteroid by
//     Arth, Fried, Sarett and colleagues at Merck (J. Am. Chem. Soc. 1958),
//     recording it as a real, characterized compound of the class named in the
//     label.
//
//   RECORDED -> SETTLED (2002): A landmark randomized controlled trial
//     (de Gans & van de Beek, NEJM 2002) established adjunctive dexamethasone as
//     standard of care in adults with bacterial meningitis, exemplifying the
//     broad clinical adoption and guideline entrenchment of dexamethasone as a
//     first-line corticosteroid — settling its therapeutic role.
//
//   SETTLED -> CONTESTED (2014): The FDA issued a Drug Safety Communication
//     requiring label changes to warn of rare but serious neurologic problems
//     (including paralysis, stroke, and death) after epidural corticosteroid
//     injections — a class to which injectable dexamethasone belongs — a
//     post-market safety signal that contested the safety framing of an
//     established use.
//
// Only high-confidence, DOI-anchored / FDA.gov-anchored arcs are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-dexamethasone-corticosteroid-indications.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-dexamethasone-corticosteroid-indications.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy5p1k8kfcplo72dl9vlcl'

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
    occurredAt: '1958-06-20',
    datePrecision: 'MONTH',
    reason:
      'Dexamethasone — 9alpha-fluoro-16alpha-methylprednisolone — was first reported in the peer-reviewed chemical literature by Arth, Johnston, Fried, Spooncer, Hoffsommer and Sarett at Merck as one of a new group of 16-methylated, 9alpha-halogenated anti-inflammatory corticosteroids. The report characterized the compound and its markedly enhanced glucocorticoid (anti-inflammatory) potency relative to cortisone, recording dexamethasone as a real, defined member of the corticosteroid class subsequently indicated on the FDA label. This is the primary publication that placed the drug on the scientific record ahead of its clinical introduction as Decadron.',
    source: {
      externalId: 'src:arth-16-methylated-steroids-i-jacs-1958',
      name:
        'Arth GE, Johnston DBR, Fried J, Spooncer WW, Hoffsommer DR, Sarett LH. 16-Methylated Steroids. I. 16alpha-Methylated Analogs of Cortisone, a New Group of Anti-inflammatory Steroids. 9alpha-Halo Derivatives. Journal of the American Chemical Society. 1958;80(12):3160-3161.',
      url: 'https://doi.org/10.1021/ja01545a061',
      publishedAt: '1958-06-20',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2002-11-14',
    datePrecision: 'DAY',
    reason:
      'The therapeutic role of dexamethasone as a first-line corticosteroid moved from recorded to settled as its use became standard of care across major indications. A landmark European multicenter randomized, double-blind, placebo-controlled trial (de Gans & van de Beek, New England Journal of Medicine 2002) showed that adjunctive dexamethasone begun before or with the first antibiotic dose significantly reduced death and unfavorable outcomes in adults with acute bacterial meningitis. The result was rapidly incorporated into international treatment guidelines, exemplifying the broad clinical adoption and guideline entrenchment that settled dexamethasone as a standard anti-inflammatory / immunomodulatory agent.',
    source: {
      externalId: 'src:degans-vandebeek-dexamethasone-meningitis-nejm-2002',
      name:
        'de Gans J, van de Beek D; European Dexamethasone in Adulthood Bacterial Meningitis Study Investigators. Dexamethasone in adults with bacterial meningitis. New England Journal of Medicine. 2002;347(20):1549-1556.',
      url: 'https://doi.org/10.1056/NEJMoa021334',
      publishedAt: '2002-11-14',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2014-04-23',
    datePrecision: 'DAY',
    reason:
      'The FDA issued a Drug Safety Communication warning that injection of corticosteroids into the epidural space of the spine may result in rare but serious adverse events, including loss of vision, stroke, paralysis, and death, and required a class Warning to be added to the labels. Injectable dexamethasone is among the corticosteroids used for these epidural injections, so the communication introduced an official post-market safety signal contesting the safety framing of an established corticosteroid use. The agency noted that the effectiveness and safety of epidural corticosteroid administration had not been established and convened advisory review, moving the settled use into active safety contestation.',
    source: {
      externalId: 'src:fda-dsc-epidural-corticosteroid-neurologic-2014',
      name:
        'U.S. Food and Drug Administration. FDA Drug Safety Communication: FDA requires label changes to warn of rare but serious neurologic problems after epidural corticosteroid injections for pain. April 23, 2014.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-fda-requires-label-changes-warn-rare-serious-neurologic-problems-after',
      publishedAt: '2014-04-23',
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
