// Enrich the epistemic arc for the ergocalciferol (vitamin D2 / Drisdol) FDA-label claim.
//
// Claim: cmpiyhj3v8xmoplo79e5bt36t
//   "Ergocalciferol (ERGOCALCIFEROL): INDICATIONS AND USAGE ... hypoparathyroidism,
//    refractory rickets, also known as vitamin D resistant rickets, and familial
//    hypophosphatemia."
//
// Ergocalciferol predates the modern Phase II/III trial regime, so the arc traces the
// real-world clinical trajectory of the drug for these specific indications rather than
// a registrational trial. Adds three ClaimStatusHistory rows (the 2026 label ingestion
// is the pre-existing first entry, fromAxis=null -> RECORDED, which this script does not
// touch):
//   OPEN     -> RECORDED  (1937-09) Albright et al. characterize vitamin D-resistant
//                          rickets and high-dose vitamin D therapy — first clinical
//                          record for the familial-hypophosphatemia / refractory-rickets
//                          indication.
//   RECORDED -> SETTLED   (2016-06) First International Conference guidelines on the
//                          management of hypoparathyroidism affirm vitamin D (incl.
//                          ergocalciferol) within standard-of-care.
//   SETTLED  -> CONTESTED (2018-04-17) FDA approves burosumab (Crysvita) as the first
//                          XLH-specific therapy, superseding the conventional
//                          phosphate + active-vitamin-D regimen as first-line for many
//                          familial-hypophosphatemia patients.
//
// Idempotent: source upserts on externalId, history upserts on the deterministic
//             slug `${claimId}-${toAxis}-${occurredAt.slice(0,10)}`.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-ergocalciferol.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyhj3v8xmoplo79e5bt36t'

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

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
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
  // ── OPEN -> RECORDED: vitamin D-resistant rickets characterized and treated ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1937-09-01',
    datePrecision: 'MONTH',
    reason:
      'In 1937 Albright, Butler and Bloomberg published "Rickets resistant to vitamin D therapy" (Am J Dis Child 54:529–547), the first clinical characterization of what is now called familial (X-linked) hypophosphatemia. The paper established that these patients require and respond only to very large pharmacologic doses of vitamin D (ergocalciferol), separating the entity from ordinary nutritional rickets. This recorded into the medical literature the therapeutic rationale for the refractory-rickets / vitamin-D-resistant-rickets indication on the label.',
    source: {
      externalId: 'src:ergocalciferol-albright-vdrr-1937',
      name: 'Albright F, Butler AM, Bloomberg E. Rickets resistant to vitamin D therapy. Am J Dis Child. 1937;54(3):529–547.',
      url: 'https://doi.org/10.1001/archpedi.1937.01980030093007',
      publishedAt: '1937-09-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: hypoparathyroidism management guidelines affirm vitamin D ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2016-06-01',
    datePrecision: 'MONTH',
    reason:
      'In 2016 the First International Conference on the Management of Hypoparathyroidism published its summary statement and guidelines (Brandi et al., J Clin Endocrinol Metab 101:2273–2283). The consensus affirmed calcium plus vitamin D — including plain vitamin D such as ergocalciferol alongside active analogues — as the standard-of-care backbone for chronic hypoparathyroidism. This codified the decades-old clinical consensus into a formal international guideline for one of the label indications.',
    source: {
      externalId: 'src:ergocalciferol-hypopara-guideline-2016',
      name: 'Brandi ML, Bilezikian JP, Shoback D, et al. Management of Hypoparathyroidism: Summary Statement and Guidelines. J Clin Endocrinol Metab. 2016;101(6):2273–2283.',
      url: 'https://doi.org/10.1210/jc.2015-3907',
      publishedAt: '2016-06-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: burosumab supersedes conventional therapy for XLH ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2018-04-17',
    datePrecision: 'DAY',
    reason:
      'On 17 April 2018 the FDA approved burosumab (Crysvita), the first therapy specific to X-linked hypophosphatemia, targeting the underlying FGF23 excess. The announcement explicitly frames the prior standard as oral phosphate plus active vitamin D — the conventional regimen the ergocalciferol-based approach to familial hypophosphatemia anchored. Subsequent XLH consensus recommendations position burosumab as first-line for many patients, contesting the conventional vitamin-D/phosphate regimen’s standard-of-care role for this indication, though ergocalciferol remains indicated and in use.',
    source: {
      externalId: 'src:ergocalciferol-burosumab-fda-2018',
      name: 'FDA. FDA approves first therapy for rare inherited form of rickets, x-linked hypophosphatemia (XLH). News release, 17 April 2018.',
      url: 'https://www.fda.gov/news-events/press-announcements/fda-approves-first-therapy-rare-inherited-form-rickets-x-linked-hypophosphatemia',
      publishedAt: '2018-04-17',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (this script does not create claims).`)
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
        ingestedBy: 'enrich:openfda_labels_v1-ergocalciferol',
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

  console.log(`Enriched ${TRANSITIONS.length} transitions for claim ${CLAIM_ID}.`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
