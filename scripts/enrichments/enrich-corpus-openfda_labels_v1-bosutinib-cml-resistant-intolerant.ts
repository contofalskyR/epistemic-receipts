// Enrich the epistemic arc for the Bosutinib FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiycepv8rnoplo7btnf2lgw — Bosutinib (Bosulif) tablets indicated for
// adult Ph+ CML (chronic, accelerated, or blast phase) resistant or intolerant
// to prior therapy.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  2011-10  pivotal phase 1/2 efficacy in imatinib-resistant CP-CML
//   RECORDED -> SETTLED   2012-09  FDA approval of Bosulif (NDA 203341), standard 2nd-line TKI
//   SETTLED  -> CONTESTED 2016-11  post-market toxicity signal (renal-function decline / GI / hepatic)
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-bosutinib-cml-resistant-intolerant.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-bosutinib-cml-resistant-intolerant.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiycepv8rnoplo7btnf2lgw'

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
  // ── OPEN -> RECORDED: pivotal phase 1/2 efficacy in imatinib-resistant CP-CML (2011) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2011-10-27',
    datePrecision: 'DAY',
    reason:
      'Cortes, Kantarjian, Brümmendorf and colleagues published the pivotal phase 1/2 study of the dual SRC/ABL kinase inhibitor bosutinib (SKI-606) in chronic-phase Ph+ CML patients resistant or intolerant to imatinib (Blood, 2011), reporting durable major cytogenetic and complete hematologic responses. This established the primary clinical evidence that bosutinib is active after failure of first-line therapy — the exact second-line population captured in the current openFDA label indication.',
    source: {
      externalId: 'src:bosutinib-cortes-phase12-2011',
      name: 'Cortes JE, Kantarjian HM, Brümmendorf TH, et al. Safety and efficacy of bosutinib (SKI-606) in chronic phase Philadelphia chromosome-positive CML patients with resistance or intolerance to imatinib. Blood. 2011;118(17):4567–4576.',
      url: 'https://doi.org/10.1182/blood-2011-05-355594',
      publishedAt: '2011-10-27',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: FDA approval of Bosulif, standard 2nd-line TKI (2012) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2012-09-04',
    datePrecision: 'DAY',
    reason:
      'The FDA approved bosutinib (Bosulif, NDA 203341) on 4 September 2012 for adult patients with chronic, accelerated, or blast-phase Ph+ CML with resistance or intolerance to prior therapy, ratifying it as a standard second-line tyrosine-kinase-inhibitor option. Regulatory approval and subsequent NCCN/ELN guideline inclusion settled the indication that the current openFDA label reproduces verbatim.',
    source: {
      externalId: 'src:bosutinib-fda-approval-2012',
      name: 'Drugs@FDA — Bosutinib (BOSULIF), NDA 203341 (approved 2012-09-04).',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=203341',
      publishedAt: '2012-09-04',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED: post-market toxicity signal (renal decline / GI / hepatic) (2016) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-11-01',
    datePrecision: 'MONTH',
    reason:
      'Long-term follow-up of the bosutinib program surfaced a treatment-emergent decline in estimated glomerular filtration rate (renal function) alongside the drug\'s known gastrointestinal and hepatic toxicity, prompting FDA prescribing-information warnings and renal/hepatic monitoring guidance. These post-market safety signals contested unqualified long-term use and required active tolerability management rather than reversing the approved second-line indication.',
    source: {
      externalId: 'src:bosutinib-fda-safety-label-203341',
      name: 'FDA Prescribing Information / Drugs@FDA — Bosutinib (BOSULIF), NDA 203341: Warnings and Precautions (renal, hepatic, gastrointestinal toxicity).',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=203341',
      publishedAt: '2016-11-01',
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
