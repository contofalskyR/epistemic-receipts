// Enrichment: epistemic arc for the phenazopyridine hydrochloride OTC drug-label
// claim (claim id cmpiy9voj8om6plo7wjxx5jms).
//
// The epistemic thread for this century-old azo-dye urinary analgesic:
//   RECORDED  — introduced ~1914 and recorded in the pharmacological literature as
//               a local urinary-tract analgesic (Pyridium).
//   SETTLED   — established as the standard symptomatic urinary analgesic, marketed
//               for decades under FDA-recognized labeling (by prescription and, in
//               low doses, over the counter).
//   CONTESTED — the NCI/NTP carcinogenesis bioassay (Technical Report Series No. 99,
//               1978) found tumors in rats and mice; NTP now classifies it as
//               "reasonably anticipated to be a human carcinogen," which — together
//               with methemoglobinemia / hemolytic-anemia risk — contests its
//               long-settled safety profile.
//
// NOTE ON VERIFICATION: web tools were unavailable in the authoring session, so the
// URLs below could not be live-fetched. They are limited to stable, scheme-based
// endpoints on preferred domains (NCBI PubChem, DailyMed, PubMed) that resolve by
// construction (name/query lookups), rather than guessed deep identifiers. Spot-check
// against the canonical pages before treating any source as human-reviewed.
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on deterministic id.
// The claim's first (fromAxis=null) status row already exists — this script does NOT
// duplicate it and does NOT create a new Claim.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-phenazopyridine-hydrochloride.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiy9voj8om6plo7wjxx5jms'

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
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1914-01-01',
    datePrecision: 'YEAR',
    reason:
      'Phenazopyridine, an azo dye first synthesized and introduced around 1914 (marketed as Pyridium), entered the pharmacological record as a urinary-tract analgesic. It exerts a local analgesic/anesthetic action on the mucosa of the lower urinary tract, relieving the burning, urgency, and dysuria of cystitis and instrumentation; because it is excreted largely unchanged in urine it characteristically colors the urine orange.',
    source: {
      externalId: 'src:pubchem-phenazopyridine',
      name: 'PubChem Compound Summary — Phenazopyridine (National Center for Biotechnology Information, U.S. National Library of Medicine)',
      url: 'https://pubchem.ncbi.nlm.nih.gov/compound/Phenazopyridine',
      publishedAt: '1914-01-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1996-01-01',
    datePrecision: 'YEAR',
    reason:
      'Over subsequent decades phenazopyridine hydrochloride became the established, FDA-recognized standard symptomatic urinary analgesic, sold both by prescription and — by the 1990s, in low doses (e.g. AZO/Uristat products) — over the counter. Its labeled purpose statement ("urinary tract analgesic") is maintained in current FDA-approved labeling archived in DailyMed, marking its settled institutional status for short-term self-care of dysuria.',
    source: {
      externalId: 'src:dailymed-phenazopyridine',
      name: 'DailyMed — FDA-approved labeling for phenazopyridine hydrochloride (U.S. National Library of Medicine)',
      url: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=phenazopyridine',
      publishedAt: '1996-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1978-01-01',
    datePrecision: 'YEAR',
    reason:
      'The U.S. National Cancer Institute / National Toxicology Program carcinogenesis bioassay (Technical Report Series No. 99, 1978) found that phenazopyridine hydrochloride induced tumors in laboratory animals — colorectal tumors in rats and hepatocellular tumors in mice. On that basis the NTP Report on Carcinogens classifies phenazopyridine hydrochloride as "reasonably anticipated to be a human carcinogen." Combined with recognized hematologic toxicity (methemoglobinemia and hemolytic anemia, with contraindication in G6PD deficiency and renal impairment), this contests the long-settled safety of the agent even as its symptomatic efficacy remains accepted.',
    source: {
      externalId: 'src:ntp-nci-phenazopyridine-carcinogenicity-tr99',
      name: 'NCI/NTP Carcinogenesis Bioassay of Phenazopyridine Hydrochloride (Technical Report Series No. 99, 1978) and NTP Report on Carcinogens listing — indexed via PubMed',
      url: 'https://pubmed.ncbi.nlm.nih.gov/?term=phenazopyridine+carcinogenicity',
      publishedAt: '1978-01-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        externalId: t.source.externalId,
        ingestedBy: 'enrich-openfda_labels_v1',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const id = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id },
      create: {
        id,
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

    console.log(`upserted ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${id})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
