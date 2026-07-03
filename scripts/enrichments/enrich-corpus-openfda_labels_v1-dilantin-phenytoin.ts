// Enrich epistemic arc for the Dilantin Infatabs (PHENYTOIN) FDA label claim.
//
// Claim id: cmpiyia2q8ydcplo7j1nhkm96 (ingestedBy: openfda_labels_v1)
// The claim's first ClaimStatusHistory row (fromAxis=null -> OPEN) already exists.
// This script adds the underlying fact's epistemic trajectory:
//   OPEN     -> RECORDED  (1938) first controlled clinical evidence of anticonvulsant efficacy
//   RECORDED -> SETTLED   (1977) inclusion in the WHO Model List of Essential Medicines
//   SETTLED  -> CONTESTED (2014) post-market pharmacogenomic safety signal (HLA-B*1502 / CYP2C9*3)
//
// Idempotent: upserts Source rows on externalId and ClaimStatusHistory rows on id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-dilantin-phenytoin.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyia2q8ydcplo7j1nhkm96'

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
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED: first controlled clinical evidence (1938) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1938-09-17',
    datePrecision: 'DAY',
    reason:
      'Merritt and Putnam reported in JAMA that sodium diphenyl hydantoinate (phenytoin) controlled convulsive seizures in a clinical series with far less sedation than the bromides and phenobarbital then in use. The paper established phenytoin as an effective anticonvulsant for grand mal and psychomotor seizures and launched the class of non-sedating antiepileptic drugs. This first published clinical evidence moved the efficacy claim from open question to recorded finding.',
    source: {
      externalId: 'src:merritt-putnam-phenytoin-jama-1938',
      name: 'Merritt HH, Putnam TJ. Sodium Diphenyl Hydantoinate in the Treatment of Convulsive Disorders. JAMA. 1938;111(12):1068–1073.',
      url: 'https://doi.org/10.1001/jama.1938.02790380010004',
      publishedAt: '1938-09-17',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: WHO Essential Medicines List inclusion (1977) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1977-10-01',
    datePrecision: 'MONTH',
    reason:
      'The World Health Organization included phenytoin as a core antiepileptic in the first Model List of Essential Medicines, published in October 1977, marking its status as a globally endorsed standard-of-care treatment for generalized tonic-clonic and partial seizures. Its continuous retention across every subsequent revision of the list settled phenytoin as a baseline reference drug for epilepsy therapy. The institutional endorsement ratified the efficacy claim as settled clinical fact.',
    source: {
      externalId: 'src:who-eml-phenytoin-antiepileptic',
      name: 'WHO Model List of Essential Medicines — Antiepileptics (phenytoin), first list 1977 and subsequent editions.',
      url: 'https://www.who.int/groups/expert-committee-on-selection-and-use-of-essential-medicines/essential-medicines-lists',
      publishedAt: '1977-10-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: post-market pharmacogenomic safety signal (2014) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2014-08-06',
    datePrecision: 'DAY',
    reason:
      'Chung and colleagues reported in JAMA a genome-wide and candidate-gene study linking the CYP2C9*3 variant and the HLA-B*1502 allele to phenytoin-related severe cutaneous adverse reactions, including Stevens-Johnson syndrome, toxic epidermal necrolysis, and DRESS. The findings established a population-specific safety signal that contests unqualified use of phenytoin and now underlies pharmacogenomic screening and labeling caution for patients of Asian ancestry. The drug remains approved, but its blanket safety profile became contested for identifiable at-risk genotypes.',
    source: {
      externalId: 'src:chung-phenytoin-scar-jama-2014',
      name: 'Chung W-H, Chang W-C, Lee Y-S, et al. Genetic Variants Associated With Phenytoin-Related Severe Cutaneous Adverse Reactions. JAMA. 2014;312(5):525–534.',
      url: 'https://doi.org/10.1001/jama.2014.7859',
      publishedAt: '2014-08-06',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
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

    const occurredAt = new Date(t.occurredAt)
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt,
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt,
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${slug})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
