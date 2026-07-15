// Enrichment: epistemic trajectory for Torre, Bray, Siegel, Ferlay,
// Lortet-Tieulent & Jemal (2015), "Global cancer statistics, 2012,"
// CA: A Cancer Journal for Clinicians 65(2): 87–108.
// DOI 10.3322/caac.21262. OpenAlex W2917837889.
//
// The claim is the paper's central descriptive thesis: cancer is an enormous
// and *increasing* burden in more- and less-developed countries alike, driven
// by population growth/aging and rising risk-factor prevalence, with GLOBOCAN
// estimating ~14.1 million new cancer cases and ~8.2 million cancer deaths in
// 2012.
//
// Post-publication research state:
//   - No retraction, expression of concern, or erratum exists. Crossref returns
//     an empty `update-to` and no `is-updated-by` relation for the baseline DOI;
//     the Retraction Watch database contains no matching record.
//   - The specific 2012 estimates were not refuted — they were year-specific
//     model outputs. Rather, the paper's increasing-burden thesis was directly
//     REAFFIRMED and extended by the same IARC/American Cancer Society
//     collaboration's successor GLOBOCAN reports, published in the same journal:
//       * GLOBOCAN 2018 (Bray et al., 2018): 18.1M new cases, 9.6M deaths.
//       * GLOBOCAN 2020 (Sung et al., 2021): 19.3M new cases, ~10.0M deaths.
//     The observed trajectory (14.1M -> 18.1M -> 19.3M cases) confirms the
//     thesis that cancer occurrence is rising with demographic and risk-factor
//     change. This is a field-consensus reaffirmation from the authoritative
//     source, not a contest.
//
// The claim already carries its baseline first entry (null -> RECORDED at the
// 2015-02-04 publication). This script adds one downstream transition:
//
//   RECORDED -> SETTLED (2018-09-12): Bray et al., "Global cancer statistics
//     2018: GLOBOCAN estimates of incidence and mortality worldwide for 36
//     cancers in 185 countries" (CA Cancer J Clin 68(6): 394–424) is the
//     successor GLOBOCAN report from the same IARC/ACS team. It updates the
//     estimates to 18.1M new cases and 9.6M deaths and documents the continued
//     rise in global cancer burden, vindicating the baseline paper's central
//     increasing-burden thesis. Expert-literature adjudication.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-torre-2015-global-cancer-statistics.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-torre-2015-global-cancer-statistics.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpmbo1nh4y1asaer9swh8gbd'

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
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

// Do NOT duplicate the existing null -> RECORDED (2015 publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2018-09-12',
    datePrecision: 'DAY',
    reason:
      'Bray et al., "Global cancer statistics 2018: GLOBOCAN estimates of incidence and mortality worldwide for 36 cancers in 185 countries" (CA Cancer J Clin 68(6): 394–424, published 12 Sept 2018), is the successor GLOBOCAN report from the same IARC/American Cancer Society collaboration, published in the same journal. It updates the global estimates to 18.1 million new cases and 9.6 million deaths and documents the continued rise in cancer burden with population growth, aging, and risk-factor change. This directly reaffirms the baseline paper\'s central increasing-burden thesis (14.1M -> 18.1M cases), further extended by GLOBOCAN 2020 (19.3M cases). The finding is settled by authoritative successor estimates rather than contested.',
    source: {
      externalId: 'src:cacancerjclin-bray-2018-globocan-2018',
      name:
        'F. Bray, J. Ferlay, I. Soerjomataram, R.L. Siegel, L.A. Torre, A. Jemal, "Global cancer statistics 2018: GLOBOCAN estimates of incidence and mortality worldwide for 36 cancers in 185 countries," CA: A Cancer Journal for Clinicians 68(6): 394–424 (12 September 2018). DOI 10.3322/caac.21492; PMID 30207593.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/30207593/',
      publishedAt: '2018-09-12',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${
      DRY_RUN ? ' (DRY RUN)' : ''
    }`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`)
  }

  for (const t of TRANSITIONS) {
    const s = t.source
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    console.log(
      `  ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${s.externalId})`,
    )
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: s.externalId },
      create: {
        externalId: s.externalId,
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
        ingestedBy: 'enrich:openalex_v1',
        autoApproved: true,
      },
      update: {
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
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
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
