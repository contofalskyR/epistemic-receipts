// Enrich the epistemic arc for the "Lidocaine anorectal cream (LIDOCAINE 5%)"
// FDA-label claim (openfda_labels_v1).
//
// Claim: cmpixtcmu85ruplo7g6wn9chl — an OTC topical anorectal product whose label
// carries "(no purpose or indication on label)". The empirically decidable spine
// here is not a single Phase II/III trial (lidocaine is a monograph-era local
// anesthetic, first introduced clinically in the 1940s), but the arc of the
// active ingredient itself: lidocaine's efficacy as a local/topical anesthetic
// was first RECORDED in the clinical literature, became SETTLED as a global
// standard-of-care local anesthetic (WHO Model List of Essential Medicines), and
// then the OTC-anorectal labeling status of a 5% lidocaine product became
// CONTESTED against the FDA's final OTC anorectal drug-products monograph — the
// regulatory tension that is legible in this very product carrying no monograph
// "Purpose"/"Uses" statement.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1949        Gordh reports the first extensive clinical use of
//                                     Xylocaine (lidocaine) as a local anesthetic (Anaesthesia)
//   RECORDED -> SETTLED   1977        Lidocaine listed among local anaesthetics on the WHO
//                                     Model List of Essential Medicines — global standard-of-care
//   SETTLED  -> CONTESTED 1988        FDA final OTC anorectal drug-products monograph (21 CFR 346)
//                                     settles GRASE anorectal actives + mandatory "Purpose"/"Uses"
//                                     labeling; a 5% lidocaine anorectal cream carrying NO purpose
//                                     statement sits outside that settled monograph framework
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-lidocaine-anorectal-cream.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-lidocaine-anorectal-cream.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpixtcmu85ruplo7g6wn9chl'

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
  // ── OPEN -> RECORDED: first extensive clinical report of lidocaine (Xylocaine) (1949) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1949-01-01',
    datePrecision: 'YEAR',
    reason:
      'Lidocaine was synthesized by Nils Löfgren and Bengt Lundqvist in 1943 and first marketed as Xylocaine in 1948. Torsten Gordh\'s 1949 report in Anaesthesia, "Xylocaine — a new local analgesic," presented the first extensive clinical evaluation of the drug as a local/topical anesthetic, recording its efficacy and comparatively favorable tolerability against the then-standard procaine. This is the first published clinical evidence for the local-anesthetic action that every later lidocaine topical formulation — including a 5% anorectal cream — relies upon.',
    source: {
      externalId: 'src:lidocaine-gordh-xylocaine-1949',
      name: 'Gordh T. Xylocaine — a new local analgesic. Anaesthesia. 1949;4(1):4–9.',
      url: 'https://doi.org/10.1111/j.1365-2044.1949.tb05837.x',
      publishedAt: '1949-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: WHO Model List of Essential Medicines lists lidocaine (1977) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1977-10-01',
    datePrecision: 'YEAR',
    reason:
      'Lidocaine (lignocaine) has been carried among the local anaesthetics on the WHO Model List of Essential Medicines since its early editions (the first Model List was issued in 1977), a status it retains in the current 23rd edition (2023). Inclusion on the WHO Model List is the archetypal marker of settled, standard-of-care status: it certifies the drug as a safe and effective medicine that a functioning health system should stock. Lidocaine\'s efficacy as a topical/local anesthetic thereby moved from recorded to broadly settled global standard-of-care.',
    source: {
      externalId: 'src:lidocaine-who-eml',
      name: 'WHO Model List of Essential Medicines — local anaesthetics (lidocaine). WHO Essential Medicines List database (23rd edition, 2023).',
      url: 'https://list.essentialmeds.org/',
      publishedAt: '1977-10-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: FDA OTC anorectal final monograph vs. a no-purpose 5% lidocaine label (1988) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '1988-01-01',
    datePrecision: 'YEAR',
    reason:
      'The FDA\'s final monograph for OTC anorectal drug products (21 CFR part 346), established in 1988, settled which anorectal actives are generally recognized as safe and effective and required conforming products to bear an explicit "Purpose"/"Uses" statement (e.g., "local anesthetic — for temporary relief of pain, soreness, and burning"). A marketed 5% lidocaine anorectal cream whose label carries no purpose or indication statement at all is inconsistent with a fully monograph-compliant OTC anorectal drug, signaling that this formulation\'s OTC status sits outside the settled monograph framework (marketed under enforcement discretion / as an unapproved drug) rather than as a clean GRASE monograph article. The general local-anesthetic efficacy of lidocaine remains settled; it is the OTC anorectal labeling/monograph status of this specific product that is contested.',
    source: {
      externalId: 'src:lidocaine-fda-anorectal-monograph-346',
      name: 'Anorectal Drug Products for Over-the-Counter Human Use — 21 CFR Part 346 (FDA final monograph).',
      url: 'https://www.ecfr.gov/current/title-21/part-346',
      publishedAt: '1988-01-01',
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
