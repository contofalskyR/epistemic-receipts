// Enrichment: epistemic trajectory for the openFDA-label-ingested claim asserting
// nicotine polacrilex's ("stop smoking aid") purpose. Nicotine polacrilex is the
// ion-exchange-resin-bound form of nicotine used in nicotine gum (marketed as
// Nicorette), the first nicotine replacement therapy (NRT) product. It was approved
// by the FDA as a prescription smoking-cessation aid in 1984 and switched to
// over-the-counter status in 1996.
//
// Claim: cmpiyjveh9090plo7mnenm3e9 (openfda_labels_v1).
//
// The claim already carries its OPEN/null -> RECORDED first entry at label ingest.
// This script adds the downstream epistemic arc, mirroring the chronologically
// ordered shape used for other drug claims:
//
//   [existing] OPEN -> RECORDED: First controlled clinical evidence that nicotine
//     gum aids smoking cessation. (Not re-added here — first entry already exists.)
//
//   RECORDED -> SETTLED (2008): Nicotine gum's standing as first-line standard of
//     care was ratified by the U.S. Public Health Service Clinical Practice
//     Guideline "Treating Tobacco Use and Dependence: 2008 Update" (Fiore et al.),
//     which lists nicotine gum among the FDA-approved first-line pharmacotherapies
//     recommended for all patients attempting to quit smoking.
//
//   SETTLED -> CONTESTED (2013): A post-market real-world effectiveness signal.
//     Alpert, Connolly & Biener (Tobacco Control, 2013) reported a prospective
//     population cohort in which NRT — including nicotine gum — showed no advantage
//     for sustained cessation and high relapse in unassisted real-world use,
//     contesting the population-level effectiveness of the intervention.
//
// Only high-confidence, DOI-/.gov-anchored arcs are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-nicotine-polacrilex-stop-smoking-aid-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-nicotine-polacrilex-stop-smoking-aid-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyjveh9090plo7mnenm3e9'

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

// Do NOT duplicate the existing null -> RECORDED first entry created at ingest.
// This adds the downstream arc: RECORDED -> SETTLED -> CONTESTED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2008-05-01',
    datePrecision: 'MONTH',
    reason:
      "Nicotine gum's role as a standard-of-care stop-smoking aid was ratified by the U.S. Public Health Service Clinical Practice Guideline, 'Treating Tobacco Use and Dependence: 2008 Update.' The guideline classifies nicotine gum (nicotine polacrilex) among the FDA-approved first-line pharmacotherapies that clinicians should recommend to all patients attempting to quit, on the strength of pooled controlled-trial evidence that it roughly doubles long-term abstinence rates. This institutional endorsement settled nicotine gum's status as a recommended cessation aid, the purpose asserted in the FDA label claim.",
    source: {
      externalId: 'src:phs-treating-tobacco-use-dependence-2008-update',
      name:
        'Fiore MC, Jaén CR, Baker TB, et al. Treating Tobacco Use and Dependence: 2008 Update. Clinical Practice Guideline. Rockville, MD: U.S. Department of Health and Human Services, Public Health Service. May 2008.',
      url: 'https://www.ncbi.nlm.nih.gov/books/NBK63952/',
      publishedAt: '2008-05-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2013-01-01',
    datePrecision: 'MONTH',
    reason:
      "The population-level effectiveness of nicotine gum as a stop-smoking aid was thrown into contestation by real-world cohort evidence. Alpert, Connolly and Biener followed a prospective sample of recent quitters in Massachusetts and found that those using nicotine replacement therapy — including nicotine gum — with or without counselling were no less likely to relapse than quitters who used nothing, a result at odds with the efficacy seen in randomized trials. The study, published in Tobacco Control, challenged whether population-based promotion of over-the-counter nicotine gum delivers the cessation benefit implied by its labeled purpose, reopening debate about its real-world effectiveness.",
    source: {
      externalId: 'src:alpert-connolly-biener-nrt-real-world-tobacco-control-2013',
      name:
        'Alpert HR, Connolly GN, Biener L. A prospective cohort study challenging the effectiveness of population-based medical intervention for smoking cessation. Tobacco Control. 2013;22(1):32-37.',
      url: 'https://doi.org/10.1136/tobaccocontrol-2011-050129',
      publishedAt: '2013-01-01',
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
