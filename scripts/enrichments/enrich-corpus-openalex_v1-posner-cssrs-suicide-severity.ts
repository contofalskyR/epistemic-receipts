// Enrichment: epistemic receipt for Posner et al. (2011), "The Columbia–Suicide
// Severity Rating Scale: Initial Validity and Internal Consistency Findings From
// Three Multisite Studies With Adolescents and Adults." Am J Psychiatry
// 168(12):1266-1277. DOI 10.1176/appi.ajp.2011.10111704.
// OpenAlex W2148083007. Claim id cmply7kyz01q9saih7s3nogvn.
//
// Baseline row (fromAxis=null -> RECORDED at 2011-12 publication) already exists;
// this script adds only the post-publication transitions.
//
// Post-publication arc:
//
// 1. RECORDED -> SETTLED (INSTITUTIONAL, 2012-08-15). The FDA announced the
//    availability of its "Guidance for Industry: Suicidal Ideation and Behavior:
//    Prospective Assessment of Occurrence in Clinical Trials" (Federal Register
//    notice, 15 Aug 2012), whose 11 suicidal-ideation-and-behavior categories are
//    based on the C-SSRS. The C-SSRS became the instrument the FDA identifies for
//    prospectively capturing suicidality in drug/biologic clinical trials — an
//    institutional endorsement that established the scale as the regulatory
//    standard and validated the paper's core claim in practice.
//
// 2. SETTLED -> CONTESTED (EXPERT_LITERATURE, 2014-09). Giddens, Sheehan &
//    Sheehan, "The Columbia–Suicide Severity Rating Scale (C-SSRS): Has the 'Gold
//    Standard' Become a Liability?" (Innov Clin Neurosci 11(9-10):66-80, 2014),
//    argued the scale is conceptually and psychometrically flawed — challenging
//    inter-rater reliability, the ideation-severity ordering, and the mapping onto
//    the FDA classification — directly reopening the psychometric-validity claim
//    the 2011 paper had recorded.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-posner-cssrs-suicide-severity.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-posner-cssrs-suicide-severity.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmply7kyz01q9saih7s3nogvn'

interface EnrichTransition {
  fromAxis: string
  toAxis: string
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: EnrichTransition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2012-08-15',
    datePrecision: 'DAY',
    reason:
      "The FDA announced the availability of its Guidance for Industry, 'Suicidal Ideation and Behavior: Prospective Assessment of Occurrence in Clinical Trials' (Federal Register, 15 Aug 2012), whose 11 suicidal-ideation-and-behavior categories are drawn from the C-SSRS. By identifying the scale as the instrument for prospectively capturing suicidality in drug and biologic trials, the FDA established the C-SSRS as the regulatory standard, vindicating the paper's validity claim through institutional adoption.",
    source: {
      externalId: 'src:fda-suicidal-ideation-behavior-guidance-2012',
      name: "U.S. Food and Drug Administration. Draft Guidance for Industry on Suicidal Ideation and Behavior: Prospective Assessment of Occurrence in Clinical Trials; Availability. Federal Register, 15 Aug 2012.",
      url: 'https://www.federalregister.gov/documents/2012/08/15/2012-19993/draft-guidance-for-industry-on-suicidal-ideation-and-behavior-prospective-assessment-of-occurrence',
      publishedAt: '2012-08-15',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2014-09-01',
    datePrecision: 'MONTH',
    reason:
      "Giddens, Sheehan & Sheehan published a detailed methodological critique arguing the C-SSRS is conceptually and psychometrically flawed — raising problems with inter-rater reliability, the ordering and definitions of ideation-severity categories, and the scale's mapping onto the FDA classification. The critique directly reopened the psychometric-validity claim the 2011 paper had established, moving the finding from settled standard to contested.",
    source: {
      externalId: 'src:giddens-sheehan-cssrs-gold-standard-liability-2014',
      name: "Giddens JM, Sheehan KH, Sheehan DV. The Columbia–Suicide Severity Rating Scale (C-SSRS): Has the 'Gold Standard' Become a Liability? Innov Clin Neurosci 2014;11(9-10):66-80.",
      url: 'https://pubmed.ncbi.nlm.nih.gov/25520890/',
      publishedAt: '2014-09-01',
      methodologyType: 'opinion',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const slug = `${claimId}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`
    if (DRY_RUN) {
      console.log(`[dry-run] would upsert source ${t.source.externalId} and history ${slug}`)
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
        ingestedBy: 'enrich-corpus-openalex_v1',
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
        claimId,
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

    console.log(`Upserted transition ${t.fromAxis} -> ${t.toAxis} (${slug})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
