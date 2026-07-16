// Enrichment: post-publication epistemic trajectory for the MPACT trial
// (Von Hoff DD, Ervin T, Arena FP, et al. "Increased Survival in Pancreatic
// Cancer with nab-Paclitaxel plus Gemcitabine." N Engl J Med 2013;369:1691–1703,
// DOI 10.1056/nejmoa1304369, OpenAlex W2165480504).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 2013-10-16 publication date) already exists — do NOT duplicate it.
//
// Post-publication event (verified via PubMed / Crossref):
//   No retraction, expression of concern, or failed replication exists. The
//   phase 3 MPACT finding (median OS 8.5 vs 6.7 mo; HR 0.72) was adjudicated by
//   the American Society of Clinical Oncology: its 2016 Clinical Practice
//   Guideline on Metastatic Pancreatic Cancer (Sohal DPS, Mangu PB, Khorana AA,
//   et al. J Clin Oncol 2016;34(23):2784–2796, DOI 10.1200/JCO.2016.67.1412,
//   PMID 27247222), based on a systematic review of 24 randomized controlled
//   trials, recommends gemcitabine plus nab-paclitaxel as a first-line
//   treatment option. There was no prior contest, so this is a direct
//   RECORDED -> SETTLED at the guideline's issue date. Community: INSTITUTIONAL.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mpact-nab-paclitaxel-gemcitabine-2013.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mpact-nab-paclitaxel-gemcitabine-2013.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply6t4001cfsaihyi2291a3'

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
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  edgeType: 'FOR' | 'AGAINST'
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-08-10',
    datePrecision: 'DAY',
    reason:
      'The American Society of Clinical Oncology, in its 2016 Clinical Practice Guideline on Metastatic Pancreatic Cancer (Sohal et al., J Clin Oncol 2016;34(23):2784–2796), based on a systematic review of 24 randomized controlled trials, recommended gemcitabine plus nab-paclitaxel as a first-line treatment option for patients with good performance status — the regimen and survival benefit established by the phase 3 MPACT trial. This institutional adjudication by the specialty society endorses the finding as standard practice rather than refuting it, so with no prior contest the claim moves directly RECORDED -> SETTLED.',
    edgeType: 'FOR',
    source: {
      externalId: 'src:asco-metastatic-pancreatic-cancer-guideline-2016',
      name: 'Sohal DPS, Mangu PB, Khorana AA, et al. Metastatic Pancreatic Cancer: American Society of Clinical Oncology Clinical Practice Guideline. J Clin Oncol 2016;34(23):2784–2796. DOI 10.1200/JCO.2016.67.1412. PMID 27247222.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/27247222/',
      publishedAt: '2016-08-10',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} — ${TRANSITIONS.length} post-publication transition(s)${DRY_RUN ? ' (dry-run)' : ''}`)

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry-run] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.datePrecision}) | ${slug}`)
      console.log(`            source: ${tr.source.externalId} -> ${tr.source.url}`)
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
        ingestedBy: 'enrich:openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: tr.edgeType } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
