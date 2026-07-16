// Enrichment: epistemic trajectory for Insel, Cuthbert, Garvey, Heinssen, Pine,
// Quinn, Sanislow & Wang, "Research Domain Criteria (RDoC): Toward a New
// Classification Framework for Research on Mental Disorders" (American Journal
// of Psychiatry, 2010-07-01; DOI 10.1176/appi.ajp.2010.09091379).
// OpenAlex W1977465442. claimId cmply8b2l022lsaih6yiju21v.
//
// This is the founding statement of NIMH's Research Domain Criteria (RDoC)
// initiative. Its core claim is that DSM/ICD categorical diagnosis — while it
// enables reliable clinical/research communication — has documented validity
// problems: the categories fail to align with clinical neuroscience and
// genetics, and their boundaries do not predict treatment response.
//
// This is a programmatic/institutional position paper, so retraction, failed
// replication, and meta-analysis do not apply. What DID happen after
// publication is that the position was formally adopted as agency policy: NIMH
// reoriented its research funding away from DSM categories toward RDoC dimensions
// (Insel's "Transforming Diagnosis" director's blog, 29 Apr 2013), and Cuthbert
// & Insel codified the framework in "Toward the future of psychiatric diagnosis:
// the seven pillars of RDoC" (BMC Medicine, online 2013-05-14). That marks the
// claim's transition from a recorded proposal to an institutionally ratified
// research doctrine.
//
// The baseline row (fromAxis=null -> RECORDED at the 2010-07-01 publication
// date) already exists and is NOT recreated here.
//
// Arc added: RECORDED -> SETTLED (INSTITUTIONAL, 2013-05-14). No CONTESTED or
// REVERSED step is added: RDoC's status as a *solution* remains debated, but the
// claim as stated — that DSM/ICD categories have these validity limitations —
// was adopted rather than overturned, so the arc honestly terminates at SETTLED.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-insel-2010-research-domain-criteria-rdoc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-insel-2010-research-domain-criteria-rdoc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply8b2l022lsaih6yiju21v'

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

interface Arc {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const ARCS: Arc[] = [
  // ── RECORDED -> SETTLED: NIMH institutionalizes RDoC (2013) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2013-05-14',
    datePrecision: 'DAY',
    reason:
      'In 2013 NIMH formally adopted the paper\'s position as agency policy: director Thomas Insel announced NIMH would "re-orient its research away from DSM categories" ("Transforming Diagnosis," 29 Apr 2013), and Cuthbert & Insel codified the program in "Toward the future of psychiatric diagnosis: the seven pillars of RDoC" (BMC Medicine, online 14 May 2013). This institutionalized the claim that DSM/ICD categorical diagnosis fails to align with neuroscience and genetics and does not predict treatment response, moving it from a recorded proposal to a ratified research framework governing NIMH funding.',
    source: {
      externalId: 'src:cuthbert-insel-2013-seven-pillars-rdoc',
      name: 'Cuthbert BN, Insel TR. Toward the future of psychiatric diagnosis: the seven pillars of RDoC. BMC Medicine. 2013;11:126.',
      url: 'https://doi.org/10.1186/1741-7015-11-126',
      publishedAt: '2013-05-14',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(
    `[enrich] claim ${CLAIM_ID} — Insel et al. "Research Domain Criteria (RDoC)" (AJP 2010)`,
  )
  console.log(`[enrich] ${ARCS.length} transition(s) to upsert${DRY_RUN ? ' (DRY RUN)' : ''}`)

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
        ingestedBy: 'enrichment',
        humanReviewed: true,
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

    console.log(`  upserted ${slug} (${arc.fromAxis} -> ${arc.toAxis} @ ${arc.occurredAt})`)
  }

  console.log('[enrich] done')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
