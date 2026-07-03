// Epistemic-arc enrichment for the FDA-label claim on Carbidopa-Levodopa (Sinemet).
//
// Claim: cmpiydp3x8t6uplo7igxxz8j5 (ingestedBy: openfda_labels_v1)
//   "Carbidopa and levodopa tablets are indicated in the treatment of Parkinson's
//    disease ... Carbidopa allows patients ... to use much lower doses of levodopa."
//
// NOTE: a sibling file (enrich-corpus-openfda_labels_v1-carbidopa-levodopa.ts)
// enriches a DIFFERENT carbidopa/levodopa label claim (cmpiy7gvm8m4iplo79t8rdbsu).
// This file targets claim cmpiydp3x... and uses distinct source externalIds and
// history slugs, so the two do not collide.
//
// The claim's first ClaimStatusHistory row (fromAxis=null -> OPEN) already exists;
// this script appends the post-emergence transitions:
//   1. OPEN     -> RECORDED  (1972) first clinical proof carbidopa potentiates levodopa
//   2. RECORDED -> SETTLED   (2002) AAN practice parameter — first-line standard of care
//   3. SETTLED  -> CONTESTED (2004) ELLDOPA trial — long-term progression/dyskinesia debate
//
// Does NOT create a Claim. Idempotent: upserts Source (on externalId) then
// ClaimStatusHistory (on the deterministic slug id).
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-carbidopa-levodopa-cmpiydp3x.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-carbidopa-levodopa-cmpiydp3x.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiydp3x8t6uplo7igxxz8j5'
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
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // ── 1. OPEN -> RECORDED : first clinical proof of the carbidopa+levodopa combination (1972) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1972-01-06',
    datePrecision: 'DAY',
    reason:
      'Papavasiliou, Cotzias and colleagues reported in the New England Journal of Medicine that adding the peripheral aromatic-amino-acid decarboxylase inhibitor carbidopa to levodopa markedly potentiated levodopa\'s central antiparkinsonian effect while sharply lowering the required levodopa dose and reducing peripheral side effects. This was the first controlled clinical evidence of the exact mechanism the FDA label later codified — that carbidopa lets patients use much lower doses of levodopa — moving the combination indication from an open hypothesis to a recorded clinical finding.',
    source: {
      externalId: 'src:carbidopa-levodopa-cotzias-nejm-1972',
      name: 'Papavasiliou PS, Cotzias GC, Düby SE, Steck AJ, Bell M, Lawrence WH. Levodopa in Parkinsonism: potentiation of central effects with a peripheral inhibitor. N Engl J Med. 1972 Jan 6;286(1):8–14.',
      url: 'https://doi.org/10.1056/NEJM197201062860103',
      publishedAt: '1972-01-06',
      methodologyType: 'primary',
    },
  },

  // ── 2. RECORDED -> SETTLED : guideline / standard-of-care ratification (2002) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2002-01-08',
    datePrecision: 'DAY',
    reason:
      'The American Academy of Neurology issued an evidence-based practice parameter on initiation of treatment for Parkinson\'s disease, concluding that levodopa — delivered as carbidopa-levodopa — is an effective first-line option for controlling motor symptoms. Endorsement by the profession\'s guideline body cemented the combination as standard of care, settling the indication that had accumulated clinical support since the 1970s.',
    source: {
      externalId: 'src:carbidopa-levodopa-aan-practice-parameter-2002',
      name: 'Miyasaki JM, Martin W, Suchowersky O, Weiner WJ, Lang AE. Practice parameter: initiation of treatment for Parkinson\'s disease: an evidence-based review (Quality Standards Subcommittee, American Academy of Neurology). Neurology. 2002 Jan 8;58(1):11–17.',
      url: 'https://doi.org/10.1212/WNL.58.1.11',
      publishedAt: '2002-01-08',
      methodologyType: 'derivative',
    },
  },

  // ── 3. SETTLED -> CONTESTED : long-term progression / motor-complication debate (2004) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-12-09',
    datePrecision: 'DAY',
    reason:
      'The randomized, placebo-controlled ELLDOPA trial (Fahn et al., Parkinson Study Group) confirmed levodopa\'s dose-dependent symptomatic benefit but found dose-dependent dyskinesia and divergent clinical-versus-neuroimaging signals that could not resolve whether the drug slows or accelerates disease progression. The result did not overturn the indication, but it opened a durable expert debate over levodopa\'s long-term motor complications and optimal dosing, contesting the previously settled picture of how carbidopa-levodopa should be used over time.',
    source: {
      externalId: 'src:carbidopa-levodopa-elldopa-nejm-2004',
      name: 'Fahn S, Oakes D, Shoulson I, et al.; Parkinson Study Group. Levodopa and the progression of Parkinson\'s disease (ELLDOPA). N Engl J Med. 2004 Dec 9;351(24):2498–2508.',
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
