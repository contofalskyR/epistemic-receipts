// Enrichment: epistemic arc for the FDA "Aspirin Low Dose" OTC label claim.
//
// Claim: cmpixth3a85x0plo77cwb3z10 (openfda_labels_v1)
//   "Aspirin Low Dose (ASPIRIN): Purpose Pain reliever"
//
// Aspirin (acetylsalicylic acid) predates the modern controlled-trial framework,
// so there is no Phase II/III registration trial for its analgesic action. The
// honest arc therefore begins with the first published pharmacological
// characterization (Dreser, 1899), proceeds to global standard-of-care status
// (WHO Model List of Essential Medicines, first edition 1977), and reaches a
// post-market safety signal (the aspirin–Reye's syndrome association, formalized
// in mandated U.S. labeling in 1986).
//
// Arc (extends the existing fromAxis=null -> OPEN entry; do not duplicate it):
//   OPEN     -> RECORDED (1899-03)   Heinrich Dreser's pharmacology paper
//                         "Pharmakologisches über Aspirin (Acetylsalicylsäure)"
//                         (Pflügers Archiv, 1899) — the first published account
//                         characterizing acetylsalicylic acid's analgesic and
//                         antipyretic action, the year Bayer began marketing it.
//                         Ratified by EXPERT_LITERATURE.
//   RECORDED -> SETTLED  (1977-10)   Acetylsalicylic acid is included as an
//                         analgesic/antipyretic in the first WHO Model List of
//                         Essential Medicines (October 1977), the global
//                         standard-of-care benchmark for essential drugs —
//                         cementing near-universal clinical adoption. Ratified by
//                         INSTITUTIONAL (WHO expert committee).
//   SETTLED  -> CONTESTED (1986-03)  Following the 1980–1982 epidemiologic signal
//                         and the U.S. Surgeon General's 1982 advisory, the FDA
//                         required a Reye's syndrome warning on aspirin labeling
//                         (final rule, 1986). This post-market safety signal
//                         contraindicated aspirin for febrile children/teens — a
//                         genuine narrowing of the "pain reliever" indication, but
//                         not a market withdrawal for adults, so CONTESTED rather
//                         than REVERSED.
//
// SETTLED -> REVERSED is NOT included: aspirin remains an approved OTC analgesic
// for adults with no withdrawal. Per AGENTS.md hard-fact principles, no
// transition is fabricated beyond what the cited record supports. URLs are
// anchored on well-established, stable reference pages (consistent with the
// Wikipedia anchoring used in seed-human-history-trajectories.ts) because live
// web verification was unavailable in this session.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-aspirin-low-dose-pain-reliever.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpixth3a85x0plo77cwb3z10'

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
    occurredAt: '1899-03-01',
    datePrecision: 'MONTH',
    reason:
      'In 1899 Heinrich Dreser published "Pharmakologisches über Aspirin (Acetylsalicylsäure)" in Pflügers Archiv, the first pharmacological account characterizing acetylsalicylic acid as a tolerable analgesic and antipyretic derivative of salicylic acid. Bayer began marketing the compound under the name Aspirin the same year. This was the first published evidence establishing the pain-relieving action stated as the label\'s Purpose.',
    source: {
      externalId: 'src:aspirin-dreser-1899',
      name: 'Dreser H. "Pharmakologisches über Aspirin (Acetylsalicylsäure)." Archiv für die gesamte Physiologie des Menschen und der Tiere (Pflügers Archiv) 1899;76:306-318.',
      url: 'https://en.wikipedia.org/wiki/History_of_aspirin',
      publishedAt: '1899-03-01',
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
      'The World Health Organization published the first Model List of Essential Medicines in October 1977, and acetylsalicylic acid (aspirin) was included as a core non-opioid analgesic and antipyretic. Inclusion on the WHO Model List is the global benchmark for standard-of-care medicines that a functioning health system should always have available, marking aspirin\'s near-universal clinical adoption for pain relief. This institutional endorsement settled the therapeutic consensus behind the label\'s Purpose.',
    source: {
      externalId: 'src:aspirin-who-eml-1977',
      name: 'WHO Model List of Essential Medicines, 1st edition (October 1977) — acetylsalicylic acid, non-opioid analgesic/antipyretic.',
      url: 'https://en.wikipedia.org/wiki/WHO_Model_List_of_Essential_Medicines',
      publishedAt: '1977-10-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '1986-03-01',
    datePrecision: 'MONTH',
    reason:
      'Epidemiologic studies in 1980-1982 linked aspirin use during viral illness in children and teenagers to Reye\'s syndrome, a rare but often fatal encephalopathy with fatty liver, prompting a U.S. Surgeon General\'s advisory in 1982. The FDA subsequently required a Reye\'s syndrome warning on aspirin-containing product labeling (final rule, 1986), contraindicating aspirin for children and adolescents with febrile viral illness. This post-market safety signal materially narrowed the "pain reliever" indication without withdrawing the drug for adults, moving the settled fact into a contested state.',
    source: {
      externalId: 'src:aspirin-reye-fda-labeling-1986',
      name: 'FDA mandated Reye\'s syndrome warning on aspirin labeling (final rule, 1986); U.S. Surgeon General\'s advisory on aspirin and Reye\'s syndrome, 1982.',
      url: 'https://en.wikipedia.org/wiki/Reye_syndrome',
      publishedAt: '1986-03-01',
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
