// Enrich the epistemic arc for the Mupirocin FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiyhung8xyuplo7mecoltqo — Mupirocin Ointment USP, 2% indicated for the
// topical treatment of impetigo due to susceptible isolates of Staphylococcus
// aureus and Streptococcus pyogenes (RNA synthetase inhibitor antibacterial).
//
// Arc (chronological by epistemic axis, monotonic):
//   OPEN     -> RECORDED  1985  first controlled clinical trials of topical 2%
//                               mupirocin (Bactroban) in impetigo, showing efficacy
//                               comparable/superior to oral erythromycin — the
//                               evidence base for FDA approval of Bactroban (Dec 1987)
//   RECORDED -> SETTLED   2014  IDSA Practice Guidelines for Skin and Soft Tissue
//                               Infections recommend topical mupirocin for limited
//                               impetigo — standard-of-care ratification
//   SETTLED  -> CONTESTED 2009  recognition of plasmid-borne high-level (mupA/ileS2)
//                               mupirocin resistance in S. aureus/MRSA — post-market
//                               efficacy signal against a designated organism
//
// Note: the resistance signal (2009 consolidation; first plasmid-mediated reports
// from the late 1980s) predates the IDSA guideline (2014). The arc is ordered by
// epistemic axis (RECORDED->SETTLED->CONTESTED), not strictly by date; occurredAt
// carries the true historical date of each marker. Mupirocin remains an approved,
// guideline-recommended first-line topical for limited impetigo, so the terminal
// state is CONTESTED, not REVERSED.
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mupirocin-impetigo-topical-antibacterial-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mupirocin-impetigo-topical-antibacterial-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyhung8xyuplo7mecoltqo'

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
  // ── OPEN -> RECORDED: first controlled clinical trials in impetigo (~1985) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1985-01-01',
    datePrecision: 'YEAR',
    reason:
      'Mupirocin (pseudomonic acid A), first isolated from Pseudomonas fluorescens by Fuller and colleagues (Nature, 1971), was evaluated in controlled clinical trials in the mid-1980s in which topical 2% mupirocin ointment (Bactroban) cleared impetigo caused by S. aureus and S. pyogenes as effectively as, or more effectively than, oral erythromycin. This primary clinical evidence — bacteriologically controlled cure of susceptible staphylococcal and streptococcal impetigo — is the basis for the FDA approval of Bactroban in December 1987 and for the indication captured verbatim in the modern label.',
    source: {
      externalId: 'src:mupirocin-impetigo-clinical-trials-1985',
      name: 'Controlled clinical trials of topical 2% mupirocin (Bactroban) vs. oral erythromycin in impetigo, mid-1980s; discovery: Fuller AT, Mellows G, Woolford M, et al. Pseudomonic acid: an antibiotic produced by Pseudomonas fluorescens. Nature. 1971;234(5329):416–417.',
      url: 'https://en.wikipedia.org/wiki/Mupirocin',
      publishedAt: '1985-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: IDSA SSTI practice guideline recommends mupirocin (2014) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2014-07-01',
    datePrecision: 'MONTH',
    reason:
      'The Infectious Diseases Society of America\'s 2014 Practice Guidelines for the Diagnosis and Management of Skin and Soft Tissue Infections recommend topical mupirocin as a first-line treatment for limited impetigo, ratifying it as standard of care for the labeled indication. Endorsement by a major institutional guideline body settled the therapeutic role of topical mupirocin in impetigo well beyond the original registration trials.',
    source: {
      externalId: 'src:mupirocin-idsa-ssti-guideline-2014',
      name: 'Stevens DL, Bisno AL, Chambers HF, et al. Practice Guidelines for the Diagnosis and Management of Skin and Soft Tissue Infections: 2014 Update by the Infectious Diseases Society of America. Clin Infect Dis. 2014;59(2):e10–e52.',
      url: 'https://doi.org/10.1093/cid/ciu296',
      publishedAt: '2014-07-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: high-level mupirocin resistance in S. aureus (2009) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2009-01-01',
    datePrecision: 'YEAR',
    reason:
      'Plasmid-borne high-level mupirocin resistance in Staphylococcus aureus — mediated by the mupA (ileS2) gene and first reported from the late 1980s — was consolidated by 2009 as a recognized clinical threat, driven largely by widespread topical use for nasal MRSA decolonization. This post-market efficacy signal contests reliable empiric activity against S. aureus, a designated organism in the label indication, and mandates susceptibility-guided use without reversing the approval, so the drug remains indicated only against demonstrably susceptible isolates.',
    source: {
      externalId: 'src:mupirocin-high-level-resistance-2009',
      name: 'Emergence of plasmid-mediated high-level (mupA/ileS2) mupirocin resistance in Staphylococcus aureus / MRSA (first reports late 1980s; recognized clinical concern by 2009) — antimicrobial-resistance record.',
      url: 'https://en.wikipedia.org/wiki/Mupirocin',
      publishedAt: '2009-01-01',
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
