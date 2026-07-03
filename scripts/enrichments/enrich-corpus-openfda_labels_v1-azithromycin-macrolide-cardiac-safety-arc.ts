// Enrichment: epistemic trajectory for the openFDA-label claim asserting the
// approved indications of azithromycin (AZITHROMYCIN), a macrolide
// antibacterial.
//
// The claim (an FDA structured-product-label snapshot ingested 2026-05-12)
// already carries its null -> RECORDED first entry. This script adds the
// downstream epistemic arc of azithromycin as a drug fact:
//
//   OPEN -> RECORDED (1987): First published peer-reviewed characterization of
//     the compound — Retsema and colleagues described azithromycin
//     ("CP-62,993"), the first 15-membered-ring azalide macrolide, documenting
//     its broad antibacterial spectrum and improved potency against
//     gram-negative organisms in Antimicrobial Agents and Chemotherapy. This
//     foundational report launched the clinical development that led to FDA
//     approval of Zithromax in 1991.
//
//   RECORDED -> SETTLED (2007): Azithromycin reached standard-of-care status
//     through inclusion in the joint IDSA/ATS consensus guidelines on the
//     management of community-acquired pneumonia in adults, which recommended
//     macrolides (including azithromycin) as first-line therapy for previously
//     healthy outpatients — one of the label's core respiratory-tract
//     indications.
//
//   SETTLED -> CONTESTED (2013): The FDA Drug Safety Communication of
//     2013-03-12 warned that azithromycin can cause abnormal changes in the
//     heart's electrical activity (QT-interval prolongation) that may lead to a
//     potentially fatal irregular heart rhythm (torsades de pointes). Prompted
//     by the Ray et al. NEJM 2012 cohort finding of increased cardiovascular
//     death, the FDA revised the drug label's Warnings and Precautions. This
//     institutional reassessment contested the settled assumption of the
//     drug's broad, low-risk cardiac safety profile.
//
// Only high-confidence, permanently-identified sources are encoded (two DOIs
// and one stable FDA.gov safety-communication page).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-azithromycin-macrolide-cardiac-safety-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-azithromycin-macrolide-cardiac-safety-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy847s8msoplo7e8gdmfzs'

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

// Do NOT duplicate the existing null -> RECORDED first entry; this arc restates
// the epistemic history explicitly starting from OPEN -> RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1987-12-01',
    datePrecision: 'MONTH',
    reason:
      "Azithromycin entered the peer-reviewed record with Retsema and colleagues' 1987 report in Antimicrobial Agents and Chemotherapy, which characterized the new compound \"CP-62,993\" — the first 15-membered-ring azalide macrolide — and documented its broad antibacterial spectrum and markedly improved potency against gram-negative organisms relative to erythromycin. This foundational published evidence established the antibacterial profile that launched azithromycin's clinical development and, ultimately, FDA approval of Zithromax in 1991. It marks the transition from an open question to a recorded, citable drug fact.",
    source: {
      externalId: 'src:retsema-azithromycin-cp62993-aac-1987',
      name:
        'Retsema J, Girard A, Schelkly W, Manousos M, Anderson M, Bright G, Borovoy R, Brennan L, Mason R. Spectrum and mode of action of azithromycin (CP-62,993), a new 15-membered-ring macrolide with improved potency against gram-negative organisms. Antimicrobial Agents and Chemotherapy. 1987;31(12):1939-1947.',
      url: 'https://doi.org/10.1128/AAC.31.12.1939',
      publishedAt: '1987-12-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-03-01',
    datePrecision: 'MONTH',
    reason:
      "Azithromycin achieved settled standard-of-care status through inclusion in major clinical practice guidelines. The 2007 consensus guidelines jointly issued by the Infectious Diseases Society of America (IDSA) and the American Thoracic Society (ATS), published in Clinical Infectious Diseases, recommended a macrolide — including azithromycin — as first-line therapy for previously healthy adult outpatients with community-acquired pneumonia, one of the core respiratory-tract indications carried on the drug's label. Endorsement by the field's principal expert bodies moved the efficacy claim from merely recorded to settled clinical practice.",
    source: {
      externalId: 'src:mandell-idsa-ats-cap-guidelines-cid-2007',
      name:
        'Mandell LA, Wunderink RG, Anzueto A, Bartlett JG, Campbell GD, Dean NC, et al. Infectious Diseases Society of America/American Thoracic Society consensus guidelines on the management of community-acquired pneumonia in adults. Clinical Infectious Diseases. 2007;44(Suppl 2):S27-S72.',
      url: 'https://doi.org/10.1086/511159',
      publishedAt: '2007-03-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2013-03-12',
    datePrecision: 'DAY',
    reason:
      "The settled assumption of azithromycin's broad, low-risk cardiac safety profile was contested by the FDA itself. In its Drug Safety Communication of 12 March 2013, the FDA warned that azithromycin can cause abnormal changes in the heart's electrical activity — prolongation of the QT interval — that may lead to a potentially fatal irregular heart rhythm (torsades de pointes), particularly in patients with known risk factors. The action followed the Ray et al. cohort study in the New England Journal of Medicine (2012;366:1881-1890, doi:10.1056/NEJMoa1003833), which found a small increase in cardiovascular deaths during a 5-day azithromycin course versus amoxicillin or no antibiotic. The FDA directed revisions to the label's Warnings and Precautions, directly contesting the drug's previously settled cardiac-safety standing.",
    source: {
      externalId: 'src:fda-azithromycin-fatal-heart-dsc-2013-03-12',
      name:
        'U.S. Food and Drug Administration. FDA Drug Safety Communication: Azithromycin (Zithromax or Zmax) and the risk of potentially fatal heart rhythms. March 12, 2013.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-azithromycin-zithromax-or-zmax-and-risk-potentially-fatal-heart',
      publishedAt: '2013-03-12',
      methodologyType: 'derivative',
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
