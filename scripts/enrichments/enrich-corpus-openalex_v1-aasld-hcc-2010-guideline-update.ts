// Enrichment: post-publication epistemic trajectory for the AASLD 2010 HCC
// guideline update (Bruix & Sherman, "Management of Hepatocellular Carcinoma:
// An Update," Hepatology 2011;53:1020–1022, DOI 10.1002/hep.24199).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 2011-01-19 publication date) already exists — do NOT duplicate it.
//
// Post-publication event (verified via Crossref):
//   The AASLD formally superseded this guideline with its 2018 Practice
//   Guidance (Marrero et al., Hepatology 2018;68:723–750, DOI
//   10.1002/hep.29913) — the same-scope successor covering diagnosis, staging,
//   and management of HCC. Institutional supersession by the issuing body:
//   RECORDED -> REVERSED (the 2011 recommendation set is no longer current
//   AASLD guidance). Community: INSTITUTIONAL.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-aasld-hcc-2010-guideline-update.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-aasld-hcc-2010-guideline-update.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply563j00jfsaih0tbrihml'

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
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2018-08-01',
    datePrecision: 'MONTH',
    reason:
      'The AASLD formally superseded this 2010/2011 HCC guideline update with its 2018 Practice Guidance (Marrero et al., Hepatology 2018;68:723–750), the same-scope successor that re-issued the association\'s recommendations on the diagnosis, staging, and management of hepatocellular carcinoma. The 2018 guidance revised or replaced multiple recommendations of the earlier document — including surveillance, diagnostic criteria, and expanded systemic and locoregional treatment options — so the specific recommendation set in the 2011 update no longer represents current AASLD guidance. This is an institutional supersession by the issuing body, not a scientific refutation of an underlying finding.',
    source: {
      externalId: 'src:aasld-hcc-2018-practice-guidance',
      name: 'Marrero JA, Kulik LM, Sirlin CB, et al. Diagnosis, Staging, and Management of Hepatocellular Carcinoma: 2018 Practice Guidance by the American Association for the Study of Liver Diseases. Hepatology 2018;68(2):723–750.',
      url: 'https://doi.org/10.1002/hep.29913',
      publishedAt: '2018-08-01',
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'AGAINST' } })
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
