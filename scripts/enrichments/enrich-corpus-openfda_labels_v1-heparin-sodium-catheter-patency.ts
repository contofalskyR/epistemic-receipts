// Enrichment: epistemic arc for the Heparin Sodium (2 units/mL) FDA-label claim
// (openfda_labels_v1, claim cmpixwkvd89woplo77hyy403d).
//
// This is the LOW-DOSE (2 units/mL) heparin-lock/flush indication — "to maintain
// catheter patency" — a distinct trajectory from the treatment-of-VTE/PE arc
// already enriched in enrich-corpus-openfda_labels_v1-heparin-sodium.ts
// (claim cmpixrl4683hiplo7oco9f44u). No overlap.
//
// Adds ClaimStatusHistory rows for the heparin-flush-for-catheter-patency arc:
//   OPEN     -> RECORDED   Randolph et al. RCT meta-analysis: heparin reduces
//                          thrombus and maintains central venous / PA catheter
//                          patency (Chest, 1998)
//   RECORDED -> SETTLED    Catheter flush/lock to maintain patency codified as
//                          standard maintenance in the CDC intravascular-catheter
//                          guideline (Clin Infect Dis, 2011)
//   SETTLED  -> CONTESTED  Cochrane review finds no conclusive benefit of heparin
//                          over 0.9% saline for preventing occlusion (2018)
//
// Idempotent: upserts Sources on externalId and ClaimStatusHistory rows on a
// deterministic `${claimId}-${toAxis}-${occurredAt}` slug id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-heparin-sodium-catheter-patency.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-heparin-sodium-catheter-patency.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpixwkvd89woplo77hyy403d'

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
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED: RCT-level evidence that heparin maintains catheter patency ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1998-01-01',
    datePrecision: 'MONTH',
    reason:
      'Randolph and colleagues published a meta-analysis of randomized controlled trials in Chest (January 1998) showing that heparin — as low-dose flush, heparin bonding, or continuous low-dose infusion — significantly reduces catheter-related thrombus formation and helps maintain the patency of central venous and pulmonary-artery catheters. This consolidated the scattered trial evidence into the first strong clinical demonstration that heparinized flushing keeps intravascular catheters open. It is the evidentiary basis for the labeled low-concentration (2 units/mL) indication "to maintain catheter patency."',
    source: {
      externalId: 'src:randolph-heparin-catheter-patency-meta-analysis-1998',
      name: 'Randolph AG, Cook DJ, Gonzales CA, Andrew M. Benefit of heparin in central venous and pulmonary artery catheters: a meta-analysis of randomized controlled trials. Chest 1998;113(1):165–171.',
      url: 'https://doi.org/10.1378/chest.113.1.165',
      publishedAt: '1998-01-01',
      methodologyType: 'derivative',
    },
  },

  // ── RECORDED -> SETTLED: catheter flush/lock to maintain patency as standard care ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2011-05-01',
    datePrecision: 'MONTH',
    reason:
      'The CDC/HICPAC "Guidelines for the Prevention of Intravascular Catheter-Related Infections" (O\'Grady et al., Clinical Infectious Diseases, 2011) codified routine flushing and locking of intravascular catheters to maintain patency as standard maintenance practice across U.S. hospitals, with heparin-lock solution retained as an accepted lock agent for central venous and arterial catheters. By this point maintaining catheter patency by periodic heparinized (or saline) flushing was settled institutional standard of care rather than an open clinical question.',
    source: {
      externalId: 'src:cdc-hicpac-intravascular-catheter-guidelines-2011',
      name: 'O\'Grady NP, Alexander M, Burns LA, et al. Guidelines for the prevention of intravascular catheter-related infections. Clin Infect Dis 2011;52(9):e162–e193.',
      url: 'https://doi.org/10.1093/cid/cir257',
      publishedAt: '2011-05-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: Cochrane finds no conclusive benefit over saline ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2018-07-01',
    datePrecision: 'MONTH',
    reason:
      'The updated Cochrane systematic review by López-Briz et al. (2018) pooled randomized trials of intermittent heparin locking versus 0.9% sodium chloride for preventing occlusion of central venous catheters in adults and found no conclusive evidence that heparin is superior to saline, with the certainty of evidence rated low. Combined with the risk of heparin-induced thrombocytopenia and dosing errors, this drove a widespread professional shift toward saline-only flushing for many catheters, contesting — though not withdrawing — the routine heparin-flush practice behind the labeled indication.',
    source: {
      externalId: 'src:lopez-briz-cochrane-heparin-vs-saline-cvc-occlusion-2018',
      name: 'López-Briz E, Ruiz Garcia V, Cabello JB, Bort-Martí S, Carbonell Sanchis R, Burls A. Heparin versus 0.9% sodium chloride locking for prevention of occlusion in central venous catheters in adults. Cochrane Database Syst Rev 2018;(7):CD008462.',
      url: 'https://doi.org/10.1002/14651858.CD008462.pub3',
      publishedAt: '2018-07-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(
        `[dry-run] ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${t.datePrecision})  src=${t.source.externalId}  id=${slug}`,
      )
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda_labels_v1',
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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

    console.log(`upserted ${slug}  (${t.fromAxis ?? 'null'} -> ${t.toAxis})`)
  }

  console.log(DRY_RUN ? 'dry-run complete' : 'enrichment complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
