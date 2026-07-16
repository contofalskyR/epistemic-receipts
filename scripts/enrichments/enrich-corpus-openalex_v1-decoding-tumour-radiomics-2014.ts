// Enrichment: post-publication epistemic trajectory for the founding radiomics
// paper (Aerts et al. 2014, Nature Communications) — "Decoding tumour phenotype
// by noninvasive imaging using a quantitative radiomics approach."
//
// Claim:    cmplzfix1000psat0j3t9c6ea
// DOI:      https://doi.org/10.1038/ncomms5006
// OpenAlex: W2103004421
//
// Baseline ClaimStatusHistory row (null -> RECORDED @ 2014-06-03) already exists;
// this script does NOT duplicate it. It adds the single verified downstream arc:
// RECORDED -> CONTESTED, adjudicated by Welch et al. (2019, Radiotherapy and
// Oncology), a specific, dated methodological critique showing that the paper's
// four-feature CT radiomic signature derived much of its prognostic power from
// tumour volume, a confounder. Notably, original author Hugo Aerts is a co-author
// of the critique, so the vulnerability is acknowledged within the founding group.
//
// No retraction or expression of concern exists. Crossref shows only an author
// Corrigendum (10.1038/ncomms5644, 2014-08-07) — a minor correction, not an
// epistemic challenge — which is deliberately NOT modeled as a transition here.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-decoding-tumour-radiomics-2014.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-decoding-tumour-radiomics-2014.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplzfix1000psat0j3t9c6ea'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Arc {
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

const ARCS: Arc[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2018-11-08',
    datePrecision: 'DAY',
    reason:
      'Welch, McIntosh, Haibe-Kains, Milosevic and colleagues published a methodological critique in Radiotherapy and Oncology (online 8 Nov 2018) that re-examined the four-feature CT radiomic signature introduced in this paper and demonstrated that much of its reported prognostic performance was driven by tumour volume, a confounder, rather than by independent texture/intensity information. The critique argued that radiomic signatures require explicit safeguards (e.g. volume de-confounding) to substantiate added value. Notably, the paper\'s original senior author Hugo J.W.L. Aerts is a co-author of the critique, marking a genuine within-field contest over the strength of the original claim.',
    source: {
      externalId: 'src:welch-radiomics-safeguards-2019',
      name: 'Welch ML, McIntosh C, Haibe-Kains B, Milosevic MF, Wee L, Dekker A, Huang SH, Purdie TG, O\'Sullivan B, Aerts HJWL, Jaffray DA. "Vulnerabilities of radiomic signature development: The need for safeguards." Radiotherapy and Oncology 2019;130:2–9.',
      url: 'https://doi.org/10.1016/j.radonc.2018.10.027',
      publishedAt: '2018-11-08',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const arc of ARCS) {
    const slug = `${CLAIM_ID}-${arc.toAxis}-${arc.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(
        `  would upsert source ${arc.source.externalId} + history ${slug} (${arc.fromAxis} -> ${arc.toAxis} @ ${arc.occurredAt})`,
      )
      continue
    }

    // 1) Source (marker artifact) first, so we can link it.
    const source = await prisma.source.upsert({
      where: { externalId: arc.source.externalId },
      create: {
        externalId: arc.source.externalId,
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-decoding-tumour-radiomics-2014',
      },
      update: {
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
      },
    })

    // 2) ClaimStatusHistory row keyed on the deterministic slug id.
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community,
        reason: arc.reason,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community,
        reason: arc.reason,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`  upserted ${slug} (${arc.fromAxis} -> ${arc.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
