// Enrichment: epistemic arc for the Heparin Sodium FDA-label claim
// (openfda_labels_v1, claim cmpixrl4683hiplo7oco9f44u).
//
// Adds ClaimStatusHistory rows for heparin's clinical trajectory as an
// anticoagulant for venous thrombosis / pulmonary embolism:
//   OPEN     -> RECORDED   Barritt & Jordan controlled trial in PE (Lancet, 1960)
//   RECORDED -> SETTLED    ACCP CHEST 9th-ed VTE guideline standard of care (2012)
//   SETTLED  -> CONTESTED  2008 contaminated-heparin adverse-event crisis
//
// Idempotent: upserts Sources on externalId and ClaimStatusHistory rows on a
// deterministic `${claimId}-${toAxis}-${occurredAt}` slug id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-heparin-sodium.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-heparin-sodium.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpixrl4683hiplo7oco9f44u'

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
  // ── OPEN -> RECORDED: first controlled clinical trial of heparin in PE ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1960-06-18',
    datePrecision: 'DAY',
    reason:
      'Barritt and Jordan reported the first randomized controlled trial of anticoagulant therapy (heparin followed by nicoumalone) in acute pulmonary embolism in The Lancet in June 1960. The trial was stopped early because untreated control patients died of recurrent embolism while anticoagulated patients survived, establishing heparin as effective first-line treatment. This trial remains the foundational clinical evidence underpinning heparin\'s labeled indication for prophylaxis and treatment of venous thrombosis and pulmonary embolism.',
    source: {
      externalId: 'src:barritt-jordan-pe-anticoagulant-trial-1960',
      name: 'Barritt DW, Jordan SC. Anticoagulant drugs in the treatment of pulmonary embolism: a controlled trial. Lancet 1960;1(7138):1309–1312.',
      url: 'https://doi.org/10.1016/S0140-6736(60)92299-6',
      publishedAt: '1960-06-18',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: guideline standard-of-care status ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2012-02-01',
    datePrecision: 'MONTH',
    reason:
      'The American College of Chest Physicians (ACCP) 9th-edition evidence-based guideline "Antithrombotic Therapy for VTE Disease" (CHEST, 2012) codified parenteral heparin (unfractionated and low-molecular-weight) as standard-of-care initial anticoagulation for venous thromboembolism. Heparin is likewise listed on the WHO Model List of Essential Medicines. By this point heparin\'s efficacy for its labeled thromboembolic indications was settled clinical consensus rather than an open research question.',
    source: {
      externalId: 'src:accp-chest-9th-vte-guideline-2012',
      name: 'Kearon C, Akl EA, Comerota AJ, et al. Antithrombotic therapy for VTE disease: Antithrombotic Therapy and Prevention of Thrombosis, 9th ed: American College of Chest Physicians Evidence-Based Clinical Practice Guidelines. Chest 2012;141(2 Suppl):e419S–e496S.',
      url: 'https://doi.org/10.1378/chest.11-2301',
      publishedAt: '2012-02-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: 2008 contaminated-heparin safety crisis ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2008-02-08',
    datePrecision: 'DAY',
    reason:
      'Beginning in late 2007, clusters of acute allergic-type and hypotensive reactions — some fatal — were reported among U.S. dialysis and other patients receiving heparin, documented by CDC in MMWR (Feb 8, 2008) and traced to oversulfated chondroitin sulfate contamination introduced in the Chinese heparin supply chain. FDA safety communications and Baxter recalls followed. The episode did not reverse heparin\'s indication but contested the safety of the marketed product and its supply chain, driving new potency/impurity assay requirements.',
    source: {
      externalId: 'src:cdc-mmwr-heparin-allergic-reactions-hemodialysis-2008',
      name: 'CDC. Acute Allergic-Type Reactions Among Patients Undergoing Hemodialysis — Multiple States, 2007–2008. MMWR Morb Mortal Wkly Rep 2008;57(05):124–125.',
      url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/mm5705a4.htm',
      publishedAt: '2008-02-08',
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
