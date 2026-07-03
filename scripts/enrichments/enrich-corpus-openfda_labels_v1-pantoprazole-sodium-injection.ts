// Enrich the epistemic arc for the Pantoprazole sodium for injection FDA-label
// claim (openfda_labels_v1).
//
// Claim: cmpiyh6wg8x90plo7bkzjs139 — Pantoprazole sodium for injection (Protonix
// I.V.), a proton pump inhibitor, indicated for short-term treatment of GERD with
// a history of erosive esophagitis in adults and for pathological hypersecretory
// conditions including Zollinger-Ellison (ZE) Syndrome. Upper-GI-bleeding use is
// explicitly not established (Limitations of Use).
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  2000-02-02  FDA approval of oral Protonix (NDA 020987) — first regulatory recording of pantoprazole efficacy for EE/GERD from its Phase III program
//   RECORDED -> SETTLED   2001-03-20  FDA approval of Protonix I.V. — pantoprazole sodium for injection (NDA 020988); broad adoption as parenteral PPI, standard-of-care for hospitalized GERD/hypersecretory patients
//   SETTLED  -> CONTESTED 2011-03-02  FDA Drug Safety Communication — hypomagnesemia with long-term PPI use (class-wide post-market safety signal)
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-pantoprazole-sodium-injection.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-pantoprazole-sodium-injection.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyh6wg8x90plo7bkzjs139'

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
  // ── OPEN -> RECORDED: first regulatory recording of pantoprazole efficacy (oral Protonix, 2000) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '2000-02-02',
    datePrecision: 'DAY',
    reason:
      'The FDA approved oral Protonix (pantoprazole sodium delayed-release tablets, NDA 020987) on 2 February 2000, recording pantoprazole as an effective proton pump inhibitor for the healing of erosive esophagitis and treatment of GERD on the basis of its randomized Phase III healing trials. This established the clinical efficacy and acid-suppression mechanism later carried into the pantoprazole sodium for injection label captured in the openFDA record.',
    source: {
      externalId: 'src:pantoprazole-fda-oral-approval-2000',
      name: 'Drugs@FDA — PROTONIX (pantoprazole sodium) delayed-release tablets, NDA 020987 (approved 2 February 2000).',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=020987',
      publishedAt: '2000-02-02',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: approval of the injection product / standard parenteral PPI (2001) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2001-03-20',
    datePrecision: 'DAY',
    reason:
      'The FDA approved Protonix I.V. (pantoprazole sodium for injection, NDA 020988) on 20 March 2001 for GERD with a history of erosive esophagitis and for pathological hypersecretory conditions including Zollinger-Ellison syndrome — the exact indications in the claim. Intravenous pantoprazole became a widely adopted parenteral PPI for hospitalized patients unable to take oral therapy and for hypersecretory states, and major GERD management guidelines (ACG, AGA) subsequently endorsed PPIs as the standard healing agents, settling the indication.',
    source: {
      externalId: 'src:pantoprazole-fda-injection-approval-2001',
      name: 'Drugs@FDA — PROTONIX I.V. (pantoprazole sodium) for injection, NDA 020988 (approved 20 March 2001).',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=020988',
      publishedAt: '2001-03-20',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED: post-market PPI safety signal (hypomagnesemia, 2011) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2011-03-02',
    datePrecision: 'DAY',
    reason:
      'On 2 March 2011 the FDA issued a Drug Safety Communication warning that prolonged use of proton pump inhibitors, including pantoprazole, can cause low serum magnesium levels (hypomagnesemia) that may lead to tetany, arrhythmias and seizures, and required class-wide labeling changes. The signal did not withdraw the approved GERD/erosive-esophagitis or hypersecretory indications but contested unqualified long-term PPI use and, alongside later signals for C. difficile infection and fractures, sustained an ongoing benefit-risk debate about PPI therapy.',
    source: {
      externalId: 'src:pantoprazole-fda-ppi-hypomagnesemia-2011',
      name: 'FDA Drug Safety Communication: Low magnesium levels can be associated with long-term use of Proton Pump Inhibitor drugs (PPIs) (2 March 2011).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-low-magnesium-levels-can-be-associated-long-term-use-proton-pump',
      publishedAt: '2011-03-02',
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
