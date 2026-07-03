// Enrichment: epistemic arc for the carbidopa/levodopa FDA-label claim.
//
// Claim: cmpiy7gvm8m4iplo79t8rdbsu (openfda_labels_v1)
//   "Carbidopa and levodopa ... indicated in the treatment of Parkinson's
//    disease, post-encephalitic parkinsonism, and symptomatic parkinsonism ..."
//
// Adds three ClaimStatusHistory rows tracing the therapy's epistemic arc:
//   1. OPEN  -> RECORDED : Cotzias et al. establish oral levodopa efficacy in PD
//                          (NEJM, 16 Feb 1967) — first controlled clinical evidence.
//   2. RECORDED -> SETTLED : FDA approves the carbidopa/levodopa combination
//                          (Sinemet, NDA 017555, 1975), making it standard of care.
//   3. SETTLED -> CONTESTED : ELLDOPA trial (Fahn et al., NEJM, 9 Dec 2004) raises
//                          the long-term safety/disease-modification question that
//                          keeps levodopa's long-term use under active debate.
//
// Does NOT create a Claim — enriches the existing openfda_labels_v1 claim.
// Idempotent: upserts Source (on externalId) then ClaimStatusHistory (on id).
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-carbidopa-levodopa.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-carbidopa-levodopa.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy7gvm8m4iplo79t8rdbsu'
const INGESTED_BY = 'enrich:openfda_labels_v1-carbidopa-levodopa'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
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
  // ── 1. OPEN -> RECORDED : first controlled clinical evidence (1967) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1967-02-16',
    datePrecision: 'DAY',
    reason:
      'George Cotzias and colleagues published the first controlled clinical demonstration that high-dose oral aromatic amino acid therapy (DL-DOPA/levodopa) markedly reduces rigidity and akinesia in Parkinson\'s disease. The report converted levodopa from a pharmacological curiosity into a documented, reproducible treatment effect and launched the modern era of dopamine-replacement therapy. Carbidopa was later added to block peripheral decarboxylation, but the efficacy of the levodopa core was first recorded here.',
    source: {
      externalId: 'src:cotzias-levodopa-nejm-1967',
      name: 'Cotzias GC, Van Woert MH, Schiffer LM. Aromatic amino acids and modification of parkinsonism. N Engl J Med. 1967;276(7):374–379.',
      url: 'https://doi.org/10.1056/NEJM196702162760703',
      publishedAt: '1967-02-16',
      methodologyType: 'primary',
    },
  },

  // ── 2. RECORDED -> SETTLED : FDA approval / standard-of-care (1975) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1975-01-01',
    datePrecision: 'YEAR',
    reason:
      'The FDA approved the fixed carbidopa/levodopa combination (Sinemet, NDA 017555) in 1975, ratifying the exact Parkinsonian indications carried in the current label — Parkinson\'s disease, post-encephalitic parkinsonism, and symptomatic parkinsonism following carbon monoxide or manganese intoxication. Approval established the combination as the institutional standard of care for dopamine-replacement therapy, and it has remained the reference antiparkinsonian regimen against which all later agents are measured.',
    source: {
      externalId: 'src:fda-sinemet-approval-1975',
      name: 'FDA Drugs@FDA — Sinemet (carbidopa; levodopa), NDA 017555.',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=017555',
      publishedAt: '1975-01-01',
      methodologyType: 'derivative',
    },
  },

  // ── 3. SETTLED -> CONTESTED : long-term safety / progression question (2004) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-12-09',
    datePrecision: 'DAY',
    reason:
      'The randomized, placebo-controlled ELLDOPA trial (Fahn et al.) confirmed levodopa\'s dose-dependent symptomatic benefit but found neuroimaging and post-washout clinical signals that could not resolve whether the drug is neuroprotective or accelerates disease progression, reviving long-standing concerns about levodopa toxicity and motor complications. The unresolved disease-modification question — alongside the well-documented emergence of dyskinesias and motor fluctuations with chronic use — keeps the long-term use of levodopa under active expert debate even though its symptomatic indication remains firmly established.',
    source: {
      externalId: 'src:elldopa-fahn-nejm-2004',
      name: 'Fahn S, Oakes D, Shoulson I, et al. Levodopa and the progression of Parkinson\'s disease (ELLDOPA). N Engl J Med. 2004;351(24):2498–2508.',
      url: 'https://doi.org/10.1056/NEJMoa033447',
      publishedAt: '2004-12-09',
      methodologyType: 'primary',
    },
  },
]

async function upsertTransition(tr: Transition) {
  const source = await prisma.source.upsert({
    where: { externalId: tr.source.externalId },
    create: {
      externalId: tr.source.externalId,
      name: tr.source.name,
      url: tr.source.url,
      publishedAt: new Date(tr.source.publishedAt),
      methodologyType: tr.source.methodologyType,
      ingestedBy: INGESTED_BY,
    },
    update: {
      name: tr.source.name,
      url: tr.source.url,
      publishedAt: new Date(tr.source.publishedAt),
    },
  })

  const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: tr.fromAxis,
      toAxis: tr.toAxis,
      community: tr.community,
      occurredAt: new Date(tr.occurredAt),
      datePrecision: tr.datePrecision,
      reason: tr.reason,
      sourceId: source.id,
    },
    update: {
      fromAxis: tr.fromAxis,
      toAxis: tr.toAxis,
      community: tr.community,
      occurredAt: new Date(tr.occurredAt),
      datePrecision: tr.datePrecision,
      reason: tr.reason,
      sourceId: source.id,
    },
  })

  console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
}

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting (this script enriches, it does not create).`)

  if (DRY_RUN) {
    for (const tr of TRANSITIONS) {
      console.log(`  [dry] ${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)} (${tr.fromAxis} -> ${tr.toAxis})`)
    }
  } else {
    for (const tr of TRANSITIONS) {
      await upsertTransition(tr)
    }
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
