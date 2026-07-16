// Enrichment: post-publication epistemic trajectory for
// "Predictive correlates of response to the anti-PD-L1 antibody MPDL3280A in cancer patients"
// (Herbst, Soria, Kowanetz et al., Nature 515:563–567, 2014; DOI 10.1038/nature14011; OpenAlex W2124427232)
//
// Baseline ClaimStatusHistory (null -> RECORDED at 2014-11-25) already exists; NOT duplicated here.
//
// Added arc:
//   RECORDED -> SETTLED (2016-05-18, INSTITUTIONAL): The FDA granted accelerated approval to
//   atezolizumab (Tecentriq) — the antibody formerly designated MPDL3280A — for locally advanced
//   or metastatic urothelial carcinoma, and on the same day approved the VENTANA PD-L1 (SP142)
//   Assay as a complementary diagnostic scoring PD-L1 on tumor-infiltrating immune cells. This
//   institutionally operationalized the paper's central predictive correlate.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mpdl3280a-pdl1-predictive.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mpdl3280a-pdl1-predictive.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply6wqc01e9saihxrx9rs2l'

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
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-05-18',
    datePrecision: 'DAY',
    reason:
      'On 18 May 2016 the FDA granted accelerated approval to atezolizumab (Tecentriq, BLA 761034) — the anti-PD-L1 antibody formerly designated MPDL3280A — for locally advanced or metastatic urothelial carcinoma. The FDA simultaneously approved the VENTANA PD-L1 (SP142) Assay as a complementary diagnostic scoring PD-L1 expression on tumor-infiltrating immune cells, the very predictive correlate this paper identified. The regulatory approval institutionally validated and operationalized the finding.',
    source: {
      externalId: 'src:fda-atezolizumab-bla761034-2016',
      name: 'U.S. FDA, Drugs@FDA: atezolizumab (TECENTRIQ), BLA 761034 — accelerated approval for urothelial carcinoma with VENTANA PD-L1 (SP142) complementary diagnostic (18 May 2016).',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=761034',
      publishedAt: '2016-05-18',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${slug} — ${tr.fromAxis ?? 'null'} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.community})`)
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
        ingestedBy: 'enrich:openalex_v1-mpdl3280a-pdl1-predictive',
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

    console.log(`  ✓ ${slug} (${tr.fromAxis ?? 'null'} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
