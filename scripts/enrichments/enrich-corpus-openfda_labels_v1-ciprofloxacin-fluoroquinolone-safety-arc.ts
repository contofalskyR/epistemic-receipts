// Enrichment: epistemic trajectory for the openFDA-label claim asserting the
// approved indications of ciprofloxacin (CIPROFLOXACIN HYDROCHLORIDE), a
// fluoroquinolone antibacterial.
//
// The claim (an FDA structured-product-label snapshot ingested 2026-05-12)
// already carries its null -> RECORDED first entry. This script adds the
// downstream epistemic arc of ciprofloxacin as a drug fact:
//
//   OPEN -> RECORDED (1983): First published peer-reviewed evidence of the
//     compound's broad-spectrum antibacterial activity — Wise, Andrews & Edwards
//     characterized "Bay o 9867" (ciprofloxacin) in Antimicrobial Agents and
//     Chemotherapy, the foundational report that launched its clinical
//     development and led to FDA approval (1987).
//
//   RECORDED -> SETTLED (2011): Ciprofloxacin reached standard-of-care status,
//     recommended in the joint IDSA/ESCMID international clinical practice
//     guidelines for acute uncomplicated cystitis and pyelonephritis in women —
//     one of the label's core indications (uncomplicated urinary-tract
//     infection). Fluoroquinolones were endorsed as effective first-line/
//     alternative therapy for these infections.
//
//   SETTLED -> CONTESTED (2016): The FDA Drug Safety Communication of
//     2016-05-12 advised RESTRICTING systemic fluoroquinolone use for certain
//     uncomplicated infections (acute uncomplicated cystitis, acute sinusitis,
//     acute bronchitis) because the risk of disabling and potentially permanent
//     adverse effects (tendons, muscles, joints, nerves, CNS) generally
//     outweighs the benefit in patients with other options. This directly
//     contested the earlier guideline endorsement and the breadth of the
//     label's uncomplicated-infection indications, and the boxed warning was
//     enhanced.
//
// Only high-confidence, permanently-identified sources are encoded (two DOIs and
// one stable FDA.gov safety-communication page).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-ciprofloxacin-fluoroquinolone-safety-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-ciprofloxacin-fluoroquinolone-safety-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpixzqxv8driplo7znmxe4i4'

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
    occurredAt: '1983-04-01',
    datePrecision: 'MONTH',
    reason:
      "Ciprofloxacin entered the peer-reviewed record with Wise, Andrews and Edwards' 1983 report in Antimicrobial Agents and Chemotherapy characterizing the new quinolone derivative \"Bay o 9867\" (ciprofloxacin) and documenting its broad-spectrum in-vitro activity, markedly more potent than the older quinolones against Gram-negative and many Gram-positive organisms. This foundational published evidence established the antibacterial profile that launched ciprofloxacin's clinical development and, ultimately, FDA approval in 1987. It marks the transition from an open question to a recorded, citable drug fact.",
    source: {
      externalId: 'src:wise-ciprofloxacin-bay-o-9867-aac-1983',
      name:
        'Wise R, Andrews JM, Edwards LJ. In vitro activity of Bay o 9867, a new quinoline derivative, compared with those of other antimicrobial agents. Antimicrobial Agents and Chemotherapy. 1983;23(4):559-564.',
      url: 'https://doi.org/10.1128/AAC.23.4.559',
      publishedAt: '1983-04-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2011-03-01',
    datePrecision: 'DAY',
    reason:
      "Ciprofloxacin achieved settled standard-of-care status through inclusion in major international clinical practice guidelines. The 2010 update jointly issued by the Infectious Diseases Society of America (IDSA) and the European Society for Microbiology and Infectious Diseases (ESCMID), published in Clinical Infectious Diseases in 2011, recommended fluoroquinolones — including ciprofloxacin — as effective therapy for acute uncomplicated cystitis and pyelonephritis in women, one of the core uncomplicated-infection indications carried on the drug's label. Guideline endorsement by the field's principal expert bodies moved the efficacy claim from merely recorded to settled clinical practice.",
    source: {
      externalId: 'src:gupta-idsa-escmid-uti-guidelines-cid-2011',
      name:
        'Gupta K, Hooton TM, Naber KG, Wullt B, Colgan R, Miller LG, et al. International clinical practice guidelines for the treatment of acute uncomplicated cystitis and pyelonephritis in women: A 2010 update by the Infectious Diseases Society of America and the European Society for Microbiology and Infectious Diseases. Clinical Infectious Diseases. 2011;52(5):e103-e120.',
      url: 'https://doi.org/10.1093/cid/ciq257',
      publishedAt: '2011-03-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-05-12',
    datePrecision: 'DAY',
    reason:
      "The settled breadth of ciprofloxacin's uncomplicated-infection use was contested by the FDA itself. In its Drug Safety Communication of 12 May 2016, the FDA advised restricting systemic fluoroquinolone antibiotics for acute uncomplicated cystitis, acute bacterial sinusitis, and acute bacterial exacerbation of chronic bronchitis, concluding that the risk of serious, disabling, and potentially permanent adverse effects — involving tendons, muscles, joints, peripheral nerves, and the central nervous system — generally outweighs the benefit for patients who have alternative treatment options. The agency directed enhancement of the boxed warning. This regulatory reassessment directly contested the earlier guideline endorsement and the appropriateness of the drug's broad uncomplicated-infection indications.",
    source: {
      externalId: 'src:fda-fluoroquinolone-restrict-dsc-2016-05-12',
      name:
        'U.S. Food and Drug Administration. FDA Drug Safety Communication: FDA advises restricting fluoroquinolone antibiotic use for certain uncomplicated infections; warns about disabling side effects that can occur together. May 12, 2016.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-fda-advises-restricting-fluoroquinolone-antibiotic-use-certain',
      publishedAt: '2016-05-12',
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
