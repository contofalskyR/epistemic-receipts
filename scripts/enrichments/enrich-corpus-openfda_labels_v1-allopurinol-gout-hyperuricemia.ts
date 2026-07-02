// Enrich the epistemic arc for the Allopurinol FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiya7mt8p06plo7kve83wpk — Allopurinol tablets indicated for gout
// (hyperuricemia), tumor-lysis hyperuricemia in cancer therapy, and recurrent
// calcium-oxalate stones.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1965  first controlled clinical efficacy trial in gout
//   RECORDED -> SETTLED   1966  FDA approval (Zyloprim), standard urate-lowering therapy
//   SETTLED  -> CONTESTED 2005  HLA-B*5801 pharmacogenomic safety signal (SJS/TEN)
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-allopurinol-gout-hyperuricemia.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-allopurinol-gout-hyperuricemia.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiya7mt8p06plo7kve83wpk'

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
  // ── OPEN -> RECORDED: first controlled clinical efficacy in gout (1965) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1965-04-01',
    datePrecision: 'MONTH',
    reason:
      'Klinenberg, Goldfinger and Seegmiller published the first controlled clinical study demonstrating that the xanthine-oxidase inhibitor allopurinol lowered serum and urinary uric acid and controlled gout in treated patients (Ann Intern Med, April 1965). This established the primary clinical evidence that allopurinol works by blocking uric-acid synthesis rather than promoting excretion, the mechanism underpinning the modern label indication.',
    source: {
      externalId: 'src:allopurinol-klinenberg-1965',
      name: 'Klinenberg JR, Goldfinger SE, Seegmiller JE. The effectiveness of the xanthine oxidase inhibitor allopurinol in the treatment of gout. Ann Intern Med. 1965;62(4):639–647.',
      url: 'https://doi.org/10.7326/0003-4819-62-4-639',
      publishedAt: '1965-04-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: FDA approval / standard-of-care ULT (1966) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1966-01-01',
    datePrecision: 'YEAR',
    reason:
      'The FDA approved allopurinol (Zyloprim, NDA 016084) in 1966 for the management of hyperuricemia in gout and in cancer therapy, ratifying the drug as standard urate-lowering therapy. Regulatory approval and rapid clinical adoption settled the indication captured verbatim in the current openFDA label decades later.',
    source: {
      externalId: 'src:allopurinol-fda-approval-1966',
      name: 'Drugs@FDA — Allopurinol (ZYLOPRIM), NDA 016084 (approved 1966).',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=016084',
      publishedAt: '1966-01-01',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED: HLA-B*5801 severe-reaction safety signal (2005) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2005-03-15',
    datePrecision: 'DAY',
    reason:
      'Hung, Chung and colleagues reported in PNAS (15 March 2005) that the HLA-B*5801 allele is a strong genetic marker for allopurinol-induced severe cutaneous adverse reactions (Stevens–Johnson syndrome and toxic epidermal necrolysis), a potentially fatal post-market safety signal. The finding contested unqualified use of the drug and drove pharmacogenomic screening recommendations (later adopted in ACR gout guidance) rather than reversing the approved indication.',
    source: {
      externalId: 'src:allopurinol-hlab5801-hung-2005',
      name: 'Hung SI, Chung WH, Liou LB, et al. HLA-B*5801 allele as a genetic marker for severe cutaneous adverse reactions caused by allopurinol. Proc Natl Acad Sci USA. 2005;102(11):4134–4139.',
      url: 'https://doi.org/10.1073/pnas.0409500102',
      publishedAt: '2005-03-15',
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
