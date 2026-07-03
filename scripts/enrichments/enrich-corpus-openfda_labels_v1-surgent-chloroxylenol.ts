// Enrichment: epistemic arc for the chloroxylenol (PCMX) OTC-antiseptic claim
// cmpiyi3kl8y6uplo7csz1w1j1 (openfda_labels_v1) — "Surgent Antiseptic
// (CHLOROXYLENOL): Drug Facts Box OTC-Purpose Section Antiseptic".
//
// Chloroxylenol (para-chloro-meta-xylenol, PCMX) is a long-marketed topical
// antiseptic active ingredient. Its epistemic arc as an OTC antiseptic:
//   - RECORDED (1999): its antimicrobial spectrum, mechanism, and established
//     antiseptic status were consolidated in the authoritative peer-reviewed
//     antiseptics/disinfectants literature (McDonnell & Russell, Clin Microbiol Rev).
//   - SETTLED (2002): the CDC Guideline for Hand Hygiene in Health-Care Settings
//     named chloroxylenol among the recognized antiseptic active ingredients,
//     marking mainstream guideline inclusion / standard-of-care recognition.
//   - CONTESTED (2016): the FDA consumer-antiseptic final rule deferred a final
//     GRASE determination for chloroxylenol (with benzalkonium chloride and
//     benzethonium chloride), requesting additional safety and effectiveness
//     data — placing its antiseptic status under active regulatory contest.
//
// The existing first ClaimStatusHistory row (fromAxis=null -> OPEN) is left
// untouched; this script adds the three subsequent transitions.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-surgent-chloroxylenol.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-surgent-chloroxylenol.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyi3kl8y6uplo7csz1w1j1'

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

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
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
  // ── OPEN -> RECORDED: antiseptic evidence base consolidated in the literature (1999) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1999-01-01',
    datePrecision: 'MONTH',
    reason:
      "McDonnell and Russell's review in Clinical Microbiology Reviews consolidated the antimicrobial spectrum, mode of action, and established antiseptic use of chloroxylenol (PCMX) in the authoritative peer-reviewed antiseptics/disinfectants literature. This synthesis recorded chloroxylenol's status as a recognized topical antiseptic active ingredient — the germicidal purpose the current OTC Drug Facts label restates.",
    source: {
      externalId: 'src:mcdonnell-russell-antiseptics-cmr-1999',
      name: 'McDonnell G, Russell AD. Antiseptics and disinfectants: activity, action, and resistance. Clin Microbiol Rev. 1999;12(1):147-179.',
      url: 'https://doi.org/10.1128/CMR.12.1.147',
      publishedAt: '1999-01-01',
      methodologyType: 'derivative',
    },
  },

  // ── RECORDED -> SETTLED: CDC hand-hygiene guideline inclusion (2002) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2002-10-25',
    datePrecision: 'DAY',
    reason:
      "The CDC Guideline for Hand Hygiene in Health-Care Settings (MMWR 2002;51(RR-16)) named chloroxylenol (PCMX) among the antiseptic active ingredients used in antimicrobial handwash and antiseptic products, describing its spectrum and role. Formal inclusion in a national infection-control guideline settled chloroxylenol's antiseptic purpose as accepted, standard-of-care practice.",
    source: {
      externalId: 'src:cdc-hand-hygiene-guideline-mmwr-2002',
      name: 'CDC. Guideline for Hand Hygiene in Health-Care Settings. MMWR Recomm Rep. 2002;51(RR-16):1-45.',
      url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/rr5116a1.htm',
      publishedAt: '2002-10-25',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: FDA defers GRASE determination for chloroxylenol (2016) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-09-06',
    datePrecision: 'DAY',
    reason:
      "In its final rule on consumer antiseptic wash products, the FDA found 19 active ingredients (including triclosan and triclocarban) not generally recognized as safe and effective, but expressly deferred a final GRASE determination for chloroxylenol — together with benzalkonium chloride and benzethonium chloride — to allow submission of additional safety and effectiveness data. The deferral put chloroxylenol's regulatory standing as a recognized OTC antiseptic into active contest pending that evidence.",
    source: {
      externalId: 'src:fda-consumer-antiseptic-wash-final-rule-2016',
      name: 'FDA. Safety and Effectiveness of Consumer Antiseptics; Topical Antimicrobial Drug Products for Over-the-Counter Human Use. Final rule. 81 FR 61106. Sept 6, 2016.',
      url: 'https://www.federalregister.gov/documents/2016/09/06/2016-21337/safety-and-effectiveness-of-consumer-antiseptics-topical-antimicrobial-drug-products-for',
      publishedAt: '2016-09-06',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  // Guard: make sure the claim exists and we are enriching, not creating.
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (this script must not create a Claim).`)
  }

  for (const t of TRANSITIONS) {
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source ${t.source.externalId}`)
      console.log(`[dry-run] history ${historyId} (${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt})`)
      continue
    }

    // 1) Upsert the marker Source first.
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'openfda_labels_v1-enrichment',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    // 2) Upsert the ClaimStatusHistory row, linking the marker Source.
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

    console.log(`upserted ${historyId} (${t.fromAxis} -> ${t.toAxis})`)
  }

  console.log(DRY_RUN ? 'Dry run complete.' : 'Enrichment complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
