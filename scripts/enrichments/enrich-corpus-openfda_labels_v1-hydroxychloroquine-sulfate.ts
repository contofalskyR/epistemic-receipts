// Enrichment: epistemic arc for the hydroxychloroquine sulfate label claim.
//
// Claim: cmpiyjk078zw6plo7t3d5q5ad
//   "Hydroxychloroquine sulfate (HYDROXYCHLOROQUINE SULFATE): 1 INDICATIONS AND
//    USAGE ... antimalarial and antirheumatic indicated for ... malaria ...
//    rheumatoid arthritis ..." (openfda_labels_v1)
//
// Adds three ClaimStatusHistory transitions tracing hydroxychloroquine's arc
// from the first randomized controlled evidence for its antirheumatic efficacy
// (the 1991 NEJM SLE withdrawal trial), through its settled standard-of-care
// apex (2019 EULAR recommendation of HCQ for all lupus patients), to the
// post-market safety signal that contested the drug's standing (the 2020 FDA
// safety communication on heart-rhythm risk arising from the COVID-19 episode).
//
// Does NOT create a new Claim — the claim already exists (openfda_labels_v1).
// The existing first entry (fromAxis=null -> first status) is not duplicated.
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on a
// deterministic id slug.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-hydroxychloroquine-sulfate.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyjk078zw6plo7t3d5q5ad'

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
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED: first randomized controlled evidence for antirheumatic efficacy ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1991-01-17',
    datePrecision: 'DAY',
    reason:
      'The Canadian Hydroxychloroquine Study Group published a randomized, double-blind trial in the New England Journal of Medicine showing that patients with clinically stable systemic lupus erythematosus who continued hydroxychloroquine relapsed less than half as often as those switched to placebo. This was the first rigorous controlled demonstration of hydroxychloroquine’s disease-modifying antirheumatic effect, converting decades of open-label rheumatologic use into a recorded, trial-grounded finding. It anchors the "antirheumatic" arm of the label’s indication claim.',
    source: {
      externalId: 'src:hcq-canadian-sle-withdrawal-1991',
      name: 'The Canadian Hydroxychloroquine Study Group. A randomized study of the effect of withdrawing hydroxychloroquine sulfate in systemic lupus erythematosus. N Engl J Med. 1991;324(3):150–154.',
      url: 'https://doi.org/10.1056/NEJM199101173240303',
      publishedAt: '1991-01-17',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: standard-of-care apex, ratified by EULAR guideline ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2019-03-29',
    datePrecision: 'DAY',
    reason:
      'The 2019 update of the EULAR recommendations for the management of systemic lupus erythematosus states that hydroxychloroquine is recommended for all patients with lupus unless contraindicated, reflecting accumulated evidence for reduced flares, organ damage, and mortality. Together with its long-standing first-line role in rheumatoid arthritis and malaria, this cemented hydroxychloroquine as settled standard of care rather than merely an evidence-backed option. The antirheumatic indication at the core of the label claim was, at this point, uncontested clinical consensus.',
    source: {
      externalId: 'src:eular-sle-recommendations-2019',
      name: 'Fanouriakis A, Kostopoulou M, Alunno A, et al. 2019 update of the EULAR recommendations for the management of systemic lupus erythematosus. Ann Rheum Dis. 2019;78(6):736–745.',
      url: 'https://doi.org/10.1136/annrheumdis-2019-215089',
      publishedAt: '2019-03-29',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: post-market safety signal from the COVID-19 episode ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-04-24',
    datePrecision: 'DAY',
    reason:
      'On 24 April 2020 the FDA issued a Drug Safety Communication cautioning against use of hydroxychloroquine for COVID-19 outside a hospital or clinical trial because of the risk of serious heart-rhythm problems, including QT prolongation and torsade de pointes. The COVID-19 surge in off-label prescribing surfaced a cardiac-safety signal that applies across all of the drug’s indications and preceded the June 2020 revocation of its emergency use authorization for COVID-19. The label’s malaria and antirheumatic indications survive, but the drug’s once-settled public standing was actively contested during this period.',
    source: {
      externalId: 'src:fda-hcq-cardiac-safety-communication-2020',
      name: 'U.S. Food and Drug Administration. FDA cautions against use of hydroxychloroquine or chloroquine for COVID-19 outside of the hospital setting or a clinical trial due to risk of heart rhythm problems. Drug Safety Communication, April 24, 2020.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-cautions-against-use-hydroxychloroquine-or-chloroquine-covid-19-outside-hospital-setting-or',
      publishedAt: '2020-04-24',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (this script does not create claims).`)
  }

  for (const t of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda_labels_v1',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const id = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id },
      create: {
        id,
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

    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${id})`)
  }

  console.log(`Done: ${TRANSITIONS.length} transitions for claim ${CLAIM_ID}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
