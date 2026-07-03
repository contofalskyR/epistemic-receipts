// Enrichment: epistemic arc for the acyclovir FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiymj8193icplo7ahxh0sei — INDICATIONS AND USAGE for acyclovir
// (herpes zoster, genital herpes, chickenpox).
//
// Adds ClaimStatusHistory rows tracing the real epistemic trajectory of the
// underlying scientific claim (acyclovir is safe and effective for herpesvirus
// infections), independent of the 2026 label-ingestion date:
//   1. OPEN -> RECORDED  (1983) first published Phase III RCT of oral acyclovir
//      for first-episode genital herpes (Bryson et al., NEJM).
//   2. RECORDED -> SETTLED (2021) codified as first-line standard of care in the
//      CDC STI Treatment Guidelines (MMWR Recomm Rep).
//
// No SETTLED->CONTESTED/REVERSED row is added: acyclovir carries no black-box
// warning and has never been withdrawn; its indications remain standard of care.
// (Its renal-toxicity caution is an administration warning, not a challenge to
// the indication claim.)
//
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-acyclovir.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-acyclovir.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiymj8193icplo7ahxh0sei'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus | null
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
  // 1. First published clinical evidence — Phase III oral-acyclovir RCT.
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1983-04-21',
    datePrecision: 'DAY',
    reason:
      'Bryson and colleagues published the first randomized, double-blind, placebo-controlled trial of oral acyclovir for first-episode genital herpes in the New England Journal of Medicine, showing that oral acyclovir significantly shortened viral shedding and lesion healing versus placebo. This established, in the peer-reviewed literature, the efficacy of the oral formulation later reflected in the FDA label. It followed the earlier topical and intravenous acyclovir trials and marked the point at which oral treatment of genital herpes moved from hypothesis to recorded clinical evidence.',
    source: {
      externalId: 'src:acyclovir-bryson-nejm-1983',
      name: 'Bryson YJ, Dillon M, Lovett M, et al. Treatment of first episodes of genital herpes simplex virus infection with oral acyclovir. A randomized double-blind controlled trial in normal subjects. N Engl J Med. 1983;308(16):916–921. PMID: 6300641.',
      url: 'https://doi.org/10.1056/NEJM198304213081602',
      publishedAt: '1983-04-21',
      methodologyType: 'primary',
    },
  },
  // 2. Standard-of-care / major guideline codification.
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2021-07-23',
    datePrecision: 'DAY',
    reason:
      'The CDC 2021 Sexually Transmitted Infections Treatment Guidelines list acyclovir (alongside valacyclovir and famciclovir) as a first-line recommended antiviral for the treatment of first-episode, recurrent, and suppressive genital herpes. Its inclusion in CDC\'s flagship guideline codifies decades of standard-of-care use and settles the efficacy claim at the institutional level. Acyclovir holds analogous first-line status for herpes zoster and varicella in specialty guidelines and the WHO Model List of Essential Medicines.',
    source: {
      externalId: 'src:acyclovir-cdc-sti-guidelines-2021',
      name: 'Workowski KA, Bachmann LH, Chan PA, et al. Sexually Transmitted Infections Treatment Guidelines, 2021. MMWR Recomm Rep. 2021;70(No. RR-4):1–187 (Genital Herpes section).',
      url: 'https://www.cdc.gov/mmwr/volumes/70/rr/rr7004a1.htm',
      publishedAt: '2021-07-23',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — refusing to create a new Claim.`)

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${histId} — ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.source.url})`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1-acyclovir',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${histId} — ${tr.fromAxis} -> ${tr.toAxis}`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
