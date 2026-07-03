// Enrichment: epistemic trajectory for an openFDA-label-ingested claim describing
// VOYDEYA (danicopan) — an oral complement factor D inhibitor indicated as add-on
// therapy to ravulizumab or eculizumab for the treatment of extravascular hemolysis
// (EVH) in adults with paroxysmal nocturnal hemoglobinuria (PNH).
//
// Danicopan (AstraZeneca / Alexion) targets the alternative complement pathway
// upstream of the C5 inhibitors ravulizumab and eculizumab. Its clinical purpose is
// to control the residual EXTRAVASCULAR hemolysis (C3-mediated) that persists in a
// minority of PNH patients whose intravascular hemolysis is already controlled by a
// C5 inhibitor. The claim's core proposition — that adding danicopan to a C5
// inhibitor meaningfully raises hemoglobin and reduces transfusion need in these
// patients — moved from a registered trial hypothesis to an empirically recorded
// randomized result, then to institutional (regulatory) ratification via FDA
// approval.
//
// The claim already has its OPEN/null -> first-status entry (the label record
// itself, dated to the openFDA ingest 2026-05-12). This script adds the downstream
// arc that PRECEDES that ingest date, reconstructing the drug's actual history:
//
//   OPEN -> RECORDED (2024-03, EXPERT_LITERATURE): First pivotal clinical evidence.
//     The Phase 3 ALPHA trial (NCT04469465) — a double-blind, placebo-controlled,
//     multicenter randomized trial of danicopan added to ravulizumab or eculizumab
//     in PNH patients with clinically significant EVH — met its primary endpoint
//     (change in hemoglobin) and was reported in the peer-reviewed literature
//     (The Lancet Haematology, 2024). This recorded the add-on benefit as an
//     empirical randomized result rather than a mechanistic expectation.
//
//   RECORDED -> SETTLED (2024-03-29, INSTITUTIONAL): Regulatory ratification. The
//     U.S. FDA approved VOYDEYA (danicopan) as add-on therapy to ravulizumab or
//     eculizumab for the treatment of EVH in adults with PNH in March 2024, on the
//     strength of the ALPHA trial. FDA approval of exactly this add-on indication is
//     the institutional community's settling of the claim: the labeled use asserted
//     in this record became an approved standard-of-care option for the EVH
//     subpopulation.
//
// No SETTLED -> CONTESTED / REVERSED transition is included. As of this enrichment,
// danicopan has been marketed for roughly two years and carries NO post-market FDA
// safety communication, NO added boxed warning, and NO withdrawal specific to the
// EVH add-on indication. Fabricating a reversal event would violate the project's
// hard-fact norms, so the arc is left at SETTLED.
//
// URL-verification note: web verification tooling was unavailable when this script
// was authored. The two source URLs below are canonical, stable resources
// (ClinicalTrials.gov study record and the FDA approved-drugs announcement) and are
// left for the required human spot-check against their canonical pages before any
// production run, per AGENTS.md ("spot-check at least the anchor entries against
// their canonical URLs").
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-voydeya-danicopan-pnh-evh-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-voydeya-danicopan-pnh-evh-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyf1768uruplo7p2f8f2an'

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

// Do NOT duplicate the existing null -> first-status entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2024-03-01',
    datePrecision: 'MONTH',
    reason:
      "The proposition asserted by this label — that adding danicopan to a C5 inhibitor (ravulizumab or eculizumab) treats residual extravascular hemolysis in PNH — was first recorded as randomized clinical evidence by the Phase 3 ALPHA trial (NCT04469465), a double-blind, placebo-controlled, multicenter study in PNH patients with clinically significant EVH despite C5-inhibitor therapy. ALPHA met its primary endpoint of change in hemoglobin from baseline and showed reduced transfusion requirement in the danicopan add-on arm, with results reported in the peer-reviewed hematology literature in 2024. This moved the add-on benefit from a mechanistic expectation about the alternative complement pathway to an empirically recorded result.",
    source: {
      externalId: 'src:danicopan-alpha-phase3-nct04469465',
      name:
        'ALPHA: A Phase 3, randomized, double-blind, placebo-controlled, multicenter study to evaluate the efficacy and safety of danicopan as add-on therapy to a C5 inhibitor in patients with PNH who have clinically significant extravascular hemolysis (EVH). ClinicalTrials.gov Identifier NCT04469465.',
      url: 'https://clinicaltrials.gov/study/NCT04469465',
      publishedAt: '2024-03-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2024-03-29',
    datePrecision: 'MONTH',
    reason:
      "The claim's labeled add-on indication was institutionally ratified when the U.S. Food and Drug Administration approved VOYDEYA (danicopan) as add-on therapy to ravulizumab or eculizumab for the treatment of extravascular hemolysis in adults with paroxysmal nocturnal hemoglobinuria in March 2024, on the basis of the Phase 3 ALPHA trial. FDA approval of exactly this add-on indication converts the randomized result into a settled, approved standard-of-care option for the EVH subpopulation of PNH — the precise use this openFDA label record describes. As a newly approved product it carries no subsequent post-market safety reversal, so the arc terminates at SETTLED.",
    source: {
      externalId: 'src:fda-approves-danicopan-voydeya-evh-pnh-2024',
      name:
        'U.S. Food and Drug Administration. FDA approves danicopan as add-on therapy for the treatment of extravascular hemolysis in adults with paroxysmal nocturnal hemoglobinuria (2024). Resources for Information | Approved Drugs.',
      url: 'https://www.fda.gov/drugs/resources-information-approved-drugs/fda-approves-danicopan-add-therapy-treatment-extravascular-hemolysis-adults-paroxysmal-nocturnal',
      publishedAt: '2024-03-29',
      methodologyType: 'primary',
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
