// Enrichment: epistemic arc for the FDA "Children's Pain Reliever" OTC label claim.
//
// Claim: cmpixu6x986siplo7cgb5t1py (openfda_labels_v1)
//   "childrens pain reliever (ACETAMINOPHEN): Purpose Pain reliever/fever reducer"
//
// Acetaminophen (paracetamol / N-acetyl-p-aminophenol) reached clinical use before
// the modern Phase II/III registration framework, so the earliest published
// evidence establishing its analgesic/antipyretic action is a pharmacology paper,
// not a controlled trial. The honest arc therefore begins with Brodie & Axelrod's
// 1948 identification of acetaminophen as the active analgesic metabolite of
// acetanilide, proceeds to global standard-of-care status (WHO Model List of
// Essential Medicines, first edition 1977), and reaches a post-market safety
// signal (FDA's 2011 hepatotoxicity boxed-warning and dose-limitation action).
//
// Arc (extends the existing fromAxis=null -> OPEN entry; do not duplicate it):
//   OPEN     -> RECORDED (1948-01)   Brodie & Axelrod, "The fate of acetanilide
//                         in man" (J Pharmacol Exp Ther 1948;94:29-38), showed
//                         acetaminophen is the analgesically active metabolite of
//                         acetanilide/phenacetin — the first published evidence
//                         characterizing the pain-relieving/antipyretic action
//                         stated as the label's Purpose. Ratified by
//                         EXPERT_LITERATURE.
//   RECORDED -> SETTLED  (1977-10)   Paracetamol is included as a non-opioid
//                         analgesic/antipyretic in the first WHO Model List of
//                         Essential Medicines (October 1977), the global
//                         standard-of-care benchmark — cementing near-universal
//                         clinical adoption, including in pediatric care. Ratified
//                         by INSTITUTIONAL (WHO expert committee).
//   SETTLED  -> CONTESTED (2011-01-13) FDA Drug Safety Communication limited
//                         acetaminophen in prescription combination products to
//                         325 mg per dosage unit and added a Boxed Warning for the
//                         risk of severe liver injury. This post-market
//                         hepatotoxicity signal narrowed safe-use conditions
//                         (dose ceilings, overdose warnings) without withdrawing
//                         the drug, so CONTESTED rather than REVERSED.
//
// SETTLED -> REVERSED is NOT included: acetaminophen remains an approved OTC
// analgesic/antipyretic, including the children's formulation, with no withdrawal.
// Per AGENTS.md hard-fact principles, no transition is fabricated beyond what the
// cited record supports. Live web verification was unavailable in this session
// (WebFetch not permitted), so the two pre-internet events are anchored on stable
// reference pages, consistent with seed-human-history-trajectories.ts, and the
// 2011 event is anchored on its FDA.gov Drug Safety Communication URL.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-childrens-pain-reliever-acetaminophen.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpixu6x986siplo7cgb5t1py'

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
    occurredAt: '1948-01-01',
    datePrecision: 'MONTH',
    reason:
      'In 1948 Bernard Brodie and Julius Axelrod published "The fate of acetanilide in man" (Journal of Pharmacology and Experimental Therapeutics 1948;94:29-38), demonstrating that acetaminophen (N-acetyl-p-aminophenol) is the metabolite responsible for the analgesic and antipyretic action of acetanilide and phenacetin, while being far less prone to methemoglobinemia. This was the first published pharmacological evidence establishing acetaminophen itself as the pain-relieving, fever-reducing agent stated as the label\'s Purpose. The finding directly motivated acetaminophen\'s introduction as a standalone medicine in the following years.',
    source: {
      externalId: 'src:acetaminophen-brodie-axelrod-1948',
      name: 'Brodie BB, Axelrod J. "The fate of acetanilide in man." Journal of Pharmacology and Experimental Therapeutics 1948;94:29-38.',
      url: 'https://en.wikipedia.org/wiki/Paracetamol',
      publishedAt: '1948-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1977-10-01',
    datePrecision: 'MONTH',
    reason:
      'The World Health Organization published the first Model List of Essential Medicines in October 1977, and paracetamol (acetaminophen) was included as a core non-opioid analgesic and antipyretic. Inclusion on the WHO Model List is the global benchmark for standard-of-care medicines a functioning health system should always stock, marking acetaminophen\'s near-universal clinical adoption for pain and fever, including in pediatric use. This institutional endorsement settled the therapeutic consensus behind the label\'s Purpose.',
    source: {
      externalId: 'src:acetaminophen-who-eml-1977',
      name: 'WHO Model List of Essential Medicines, 1st edition (October 1977) — paracetamol, non-opioid analgesic/antipyretic.',
      url: 'https://en.wikipedia.org/wiki/WHO_Model_List_of_Essential_Medicines',
      publishedAt: '1977-10-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2011-01-13',
    datePrecision: 'DAY',
    reason:
      'On 13 January 2011 the FDA issued a Drug Safety Communication limiting the amount of acetaminophen in prescription combination products to 325 mg per dosage unit and requiring a Boxed Warning highlighting the potential for severe, sometimes fatal, liver injury (acute liver failure) from acetaminophen. Acetaminophen overdose was, by then, a leading cause of acute liver failure in the United States, a signal especially consequential for children\'s formulations where dosing errors occur. This post-market safety action materially narrowed safe-use conditions without withdrawing the drug, moving the settled fact into a contested state.',
    source: {
      externalId: 'src:acetaminophen-fda-dsc-2011',
      name: 'FDA Drug Safety Communication: Prescription Acetaminophen Products to be Limited to 325 mg Per Dosage Unit; Boxed Warning Will Highlight Potential for Severe Liver Failure (January 13, 2011).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-prescription-acetaminophen-products-be-limited-325-mg-dosage-unit',
      publishedAt: '2011-01-13',
      methodologyType: 'derivative',
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
