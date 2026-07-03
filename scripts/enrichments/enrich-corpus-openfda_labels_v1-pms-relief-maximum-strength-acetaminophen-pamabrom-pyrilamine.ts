// Enrich the epistemic arc for the "PMS Relief Maximum Strength" FDA-label claim
// (openfda_labels_v1).
//
// Claim: cmpiya4f18ox0plo7iqhn2npo — PMS Relief Maximum Strength
//        (ACETAMINOPHEN, PAMABROM, PYRILAMINE MALEATE): Pain reliever / Diuretic /
//        Antihistamine. This is the classic OTC menstrual-symptom-relief combination
//        (as marketed under Midol / Pamprin / Premsyn PMS), regulated under the FDA
//        OTC Drug Review monograph system rather than as an individual NDA.
//
// Arc (chronological, monotonic). Because the product is an OTC-monograph combination
// rather than an NDA drug, its epistemic history lives in the *regulatory* record, so
// the transitions are anchored on canonical FDA / eCFR endpoints rather than a single
// primary clinical trial. Web-verification tools were unavailable at authoring time, so
// only stable canonical .gov / eCFR URLs (which do not carry volatile slugs) are used;
// no DOI or Federal Register slug is asserted from memory. Approximate milestones use
// YEAR precision; the concrete FDA safety action uses DAY precision.
//
//   OPEN     -> RECORDED  1977  The three actives are entered into the federal
//                               regulatory record as candidate GRASE OTC ingredients
//                               during the FDA OTC Drug Review: acetaminophen (internal
//                               analgesic/antipyretic, 21 CFR 343) and pyrilamine
//                               maleate (antihistamine, 21 CFR 341), alongside pamabrom
//                               as the diuretic component.
//   RECORDED -> SETTLED   1992  OTC monograph codification of the component categories
//                               (antihistamine final monograph era; internal-analgesic
//                               monograph) settles the combination as accepted,
//                               ubiquitous OTC self-care therapy.
//   SETTLED  -> CONTESTED 2011  FDA post-market acetaminophen hepatotoxicity actions —
//                               mandatory OTC "Liver warning" labeling (2009) and the
//                               boxed warning on combination acetaminophen products
//                               (Jan 13, 2011) — introduce a recognized safety signal
//                               for the product's principal analgesic component. The
//                               combination remains marketed (not withdrawn), so the
//                               arc terminates at CONTESTED, not REVERSED.
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-pms-relief-maximum-strength-acetaminophen-pamabrom-pyrilamine.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-pms-relief-maximum-strength-acetaminophen-pamabrom-pyrilamine.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiya4f18ox0plo7iqhn2npo'

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
  // ── OPEN -> RECORDED: ingredients enter the OTC regulatory record (FDA OTC Drug Review) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1977-01-01',
    datePrecision: 'YEAR',
    reason:
      "Under FDA's OTC Drug Review, the active ingredients of this menstrual-relief combination were entered into the federal regulatory record as candidate generally-recognized-as-safe-and-effective (GRASE) OTC actives: acetaminophen as an internal analgesic/antipyretic (the product's 'Pain reliever', 21 CFR 343) and pyrilamine maleate as an antihistamine (21 CFR 341), alongside pamabrom as the diuretic component. This established the combination's therapeutic rationale as a recorded regulatory proposition rather than an unexamined marketing claim.",
    source: {
      externalId: 'src:pms-relief-otc-internal-analgesic-monograph-cfr343',
      name: '21 CFR Part 343 — Internal Analgesic, Antipyretic, and Antirheumatic Drug Products for Over-the-Counter Human Use (OTC Drug Review; establishes acetaminophen as a monograph analgesic ingredient).',
      url: 'https://www.ecfr.gov/current/title-21/part-343',
      publishedAt: '1977-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: OTC monograph codification / ubiquitous standard self-care ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1992-01-01',
    datePrecision: 'YEAR',
    reason:
      "By the early 1990s the component monograph categories were codified in the Code of Federal Regulations — pyrilamine maleate as a recognized OTC antihistamine (21 CFR 341) together with acetaminophen's analgesic monograph — and the acetaminophen/pamabrom/pyrilamine combination had become ubiquitous, nationally marketed OTC self-care for menstrual and premenstrual symptoms. Regulatory codification plus decades of routine consumer and clinical use settled the combination as accepted standard-of-care self-treatment rather than a merely recorded claim.",
    source: {
      externalId: 'src:pms-relief-otc-antihistamine-monograph-cfr341',
      name: '21 CFR Part 341 — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use (OTC Drug Review; codifies pyrilamine maleate as a monograph antihistamine).',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1992-01-01',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED: FDA post-market acetaminophen hepatotoxicity safety signal ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2011-01-13',
    datePrecision: 'DAY',
    reason:
      "FDA's post-market safety actions on acetaminophen — the mandatory 'Liver warning' added to over-the-counter acetaminophen product labeling (2009) and the boxed warning for combination acetaminophen products announced January 13, 2011 — introduced a recognized hepatotoxicity signal for the combination's principal analgesic component. This moved the previously settled claim into contested territory: the product's benefit is no longer treated as unqualified, though the combination remains marketed and was not withdrawn, so the arc terminates at CONTESTED rather than REVERSED.",
    source: {
      externalId: 'src:pms-relief-fda-acetaminophen-hepatotoxicity-information',
      name: 'U.S. Food & Drug Administration — Acetaminophen Information (drug-class safety hub documenting OTC liver-injury labeling and the boxed warning on acetaminophen combination products).',
      url: 'https://www.fda.gov/drugs/information-drug-class/acetaminophen-information',
      publishedAt: '2011-01-13',
      methodologyType: 'primary',
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
