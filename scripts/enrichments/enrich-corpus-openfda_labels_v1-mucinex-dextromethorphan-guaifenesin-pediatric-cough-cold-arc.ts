// Enrichment: epistemic trajectory for the openFDA-label claim asserting the
// active ingredients and purposes of Mucinex Children's Cough and Chest
// Congestion Mini-Melts (DEXTROMETHORPHAN HYDROBROMIDE AND GUAIFENESIN) — an
// OTC pediatric antitussive/expectorant combination.
//
// The claim (an FDA structured-product-label snapshot ingested 2026-05-12)
// already carries its null -> RECORDED first entry. This script adds the
// downstream epistemic arc of this drug fact — the dextromethorphan +
// guaifenesin cough/cold combination — from first controlled clinical
// evidence, through regulatory settlement as a Generally-Recognized-As-Safe-
// and-Effective OTC standard, to the post-market pediatric safety
// reassessment that contested its use in young children:
//
//   OPEN -> RECORDED (1982): Kuhn and colleagues published one of the first
//     rigorously controlled clinical demonstrations of an active ingredient in
//     this product, objectively and subjectively measuring the antitussive
//     effect of guaifenesin in young adults with natural colds (Chest, 1982).
//     This moved the ingredients' therapeutic effect from folk practice into
//     the citable clinical record.
//
//   RECORDED -> SETTLED (1987): The FDA's OTC Drug Review codified
//     dextromethorphan as an approved nonnarcotic antitussive and guaifenesin
//     as the sole approved OTC expectorant, both Generally Recognized As Safe
//     and Effective, in the cough/cold/allergy final monograph (21 CFR Part
//     341). Regulatory recognition settled these ingredients as the OTC
//     standard of care.
//
//   SETTLED -> CONTESTED (2008): The FDA Public Health Advisory of
//     2008-01-17 recommended that OTC cough and cold products not be used to
//     treat infants and children under 2 years of age, citing serious and
//     potentially life-threatening adverse events and a lack of demonstrated
//     efficacy in young children. Manufacturers subsequently relabeled these
//     products "do not use in children under 4." The action directly contested
//     the settled safety/efficacy standing of pediatric cough/cold
//     combinations of exactly this type.
//
// Only high-confidence, permanently-identified sources are encoded (one journal
// DOI, one stable eCFR citation, and one FDA.gov advisory page).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-dextromethorphan-guaifenesin-pediatric-cough-cold-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-dextromethorphan-guaifenesin-pediatric-cough-cold-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy8mfu8naiplo754m70k6d'

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

// Do NOT duplicate the existing null -> RECORDED first entry; this arc restates
// the epistemic history explicitly starting from OPEN -> RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1982-12-01',
    datePrecision: 'MONTH',
    reason:
      "The therapeutic effect of the ingredients in this product entered the controlled clinical record with Kuhn and colleagues' 1982 study in Chest, which used both objective cough-count monitoring and subjective assessment to demonstrate the antitussive effect of guaifenesin in young adults with natural colds. This was among the first rigorously controlled evaluations of an active ingredient carried in modern OTC cough/cold combinations, moving the effect from empirical practice into a citable, peer-reviewed drug fact. It marks the transition from an open question to a recorded clinical result.",
    source: {
      externalId: 'src:kuhn-guaifenesin-antitussive-chest-1982',
      name:
        'Kuhn JJ, Hendley JO, Adams KF, Clark JW, Gwaltney JM Jr. Antitussive effect of guaifenesin in young adults with natural colds. Objective and subjective assessment. Chest. 1982;82(6):713-718.',
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
    datePrecision: 'MONTH',
    reason:
      "Through the FDA's OTC Drug Review, dextromethorphan was codified as an approved nonnarcotic antitussive and guaifenesin as the sole approved OTC expectorant — both Generally Recognized As Safe and Effective — within the cough, cold, allergy, bronchodilator, and antiasthmatic final monograph now maintained at 21 CFR Part 341. This regulatory settlement fixed the two ingredients as the recognized OTC standard of care for cough suppression and chest-congestion relief, the exact purposes stated on this product's label. Federal recognition moved the ingredients' efficacy from merely recorded to institutionally settled.",
    source: {
      externalId: 'src:fda-ecfr-21cfr341-cough-cold-monograph',
      name:
        'U.S. Food and Drug Administration. 21 CFR Part 341 — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use (antitussive: dextromethorphan; expectorant: guaifenesin). Electronic Code of Federal Regulations.',
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
      "The settled assumption that OTC cough/cold combinations are safe and effective for young children was contested by the FDA itself. In its Public Health Advisory of 17 January 2008, the FDA recommended that over-the-counter cough and cold products not be used to treat infants and children under 2 years of age, citing rare but serious and potentially life-threatening side effects together with a lack of demonstrated efficacy in this age group. Manufacturers subsequently relabeled these products to warn against use in children under 4, directly contesting the previously settled pediatric safety/efficacy standing of dextromethorphan/guaifenesin combinations of exactly the kind this children's product represents.",
    source: {
      externalId: 'src:fda-otc-cough-cold-children-advisory-2008',
      name:
        'U.S. Food and Drug Administration. Use Caution When Giving Cough and Cold Products to Kids (Public Health Advisory, January 17, 2008; recommendation against OTC cough/cold use in children under 2).',
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
