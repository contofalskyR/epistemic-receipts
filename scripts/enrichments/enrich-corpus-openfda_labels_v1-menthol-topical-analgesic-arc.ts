// Enrichment: epistemic arc for the MENTHOL topical-analgesic OTC claim.
//
// Claim (openfda_labels_v1):
//   cmpiymgm893eoplo7h96sels8 —
//   "Cool and Heat (MENTHOL): Purpose Topical analgesic"
//
// The OTC label is an instance of a much older, dateable regulated fact:
// menthol's status as a topical analgesic (cooling counterirritant). Its
// epistemic arc runs through the discovery of menthol's molecular mechanism
// and an FDA post-market safety signal:
//
//   OPEN     -> RECORDED  (2002)  McKemy et al. (Nature) identify the cold
//                                 receptor TRPM8 as the molecular target of
//                                 menthol — recording the mechanism of its
//                                 cooling/analgesic action in the primary
//                                 literature.
//   RECORDED -> SETTLED   (2007)  Bautista et al. (Nature) establish TRPM8 as
//                                 the principal detector of environmental cold
//                                 and the receptor for menthol, settling the
//                                 scientific consensus underpinning menthol's
//                                 standard use as a topical cooling analgesic.
//   SETTLED  -> CONTESTED (2012)  FDA Drug Safety Communication warns of rare
//                                 cases of serious skin burns from OTC topical
//                                 muscle/joint pain relievers containing menthol
//                                 (alone or with methyl salicylate), placing a
//                                 post-market safety signal against the settled
//                                 topical-analgesic status.
//
// The existing first ClaimStatusHistory row (fromAxis=null -> OPEN) is left
// untouched; this script adds only the OPEN->RECORDED->SETTLED->CONTESTED arc.
//
// Idempotent: upserts sources on externalId and history rows on deterministic id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-menthol-topical-analgesic-arc.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiymgm893eoplo7h96sels8'

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
  // ── OPEN -> RECORDED : menthol's molecular mechanism identified (TRPM8) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2002-03-07',
    datePrecision: 'DAY',
    reason:
      "McKemy, Neuhausser and Julius, 'Identification of a cold receptor reveals a general role for TRP channels in thermosensation' (Nature 416:52-58, 7 March 2002), identified TRPM8 as the cold- and menthol-activated ion channel. This recorded the molecular mechanism of menthol's cooling and analgesic action in the primary peer-reviewed literature, converting a long-used folk remedy into a mechanistically described topical analgesic.",
    source: {
      externalId: 'src:mckemy-trpm8-cold-receptor-nature-2002',
      name: 'McKemy DD, Neuhausser WM, Julius D. Identification of a cold receptor reveals a general role for TRP channels in thermosensation. Nature. 2002;416(6876):52-58.',
      url: 'https://doi.org/10.1038/nature719',
      publishedAt: '2002-03-07',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED : scientific consensus on menthol's cold/analgesic receptor ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-07-12',
    datePrecision: 'DAY',
    reason:
      "Bautista et al., 'The menthol receptor TRPM8 is the principal detector of environmental cold' (Nature 448:204-208, 12 July 2007), used TRPM8-knockout mice to establish TRPM8 as the principal detector of cold and the receptor mediating menthol's effects. This settled the scientific consensus behind menthol's established role as a topical cooling analgesic and counterirritant, the mechanism underlying its standard OTC use.",
    source: {
      externalId: 'src:bautista-trpm8-menthol-receptor-nature-2007',
      name: 'Bautista DM, Siemens J, Glazer JM, et al. The menthol receptor TRPM8 is the principal detector of environmental cold. Nature. 2007;448(7150):204-208.',
      url: 'https://doi.org/10.1038/nature05910',
      publishedAt: '2007-07-12',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED : FDA post-market safety signal (serious burns) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2012-09-13',
    datePrecision: 'DAY',
    reason:
      "On 13 September 2012 the FDA issued a Drug Safety Communication warning of rare cases of serious skin burns associated with over-the-counter topical muscle and joint pain relievers containing menthol, or menthol combined with methyl salicylate. The agency identified reports of first- to third-degree chemical burns, several requiring hospitalization, mostly with higher-concentration menthol products. The communication introduced an institutional safety signal that contested the settled topical-analgesic status of menthol at OTC concentrations.",
    source: {
      externalId: 'src:fda-dsc-serious-burns-otc-topical-pain-relievers-2012',
      name: 'FDA Drug Safety Communication: Rare cases of serious burns with the use of over-the-counter topical muscle and joint pain relievers (Sept 13, 2012).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-rare-cases-serious-burns-use-over-counter-topical-muscle-and-joint',
      publishedAt: '2012-09-13',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — refusing to create a new Claim.`)
  }

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1-menthol-topical-analgesic-arc',
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

  console.log(`Done. ${TRANSITIONS.length} transitions upserted for ${CLAIM_ID}.`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
