// Enrichment: epistemic trajectory for Bond TC, et al., "Bounding the role of
// black carbon in the climate system: A scientific assessment." J. Geophys.
// Res. Atmos. 2013;118(11):5380-5552. DOI 10.1002/jgrd.50171.
// OpenAlex W1907369419.
//
// This 31-author assessment produced a "constrained" best estimate of
// industrial-era black-carbon climate forcing of +1.1 W/m^2 (direct component
// +0.71 W/m^2), and its headline conclusion was that black carbon is "the
// second most important human emission in terms of climate forcing... only
// carbon dioxide is estimated to have a greater forcing" — roughly twice
// prior estimates. There is no retraction. The downstream arc is a genuine,
// well-documented scientific correction of that high magnitude estimate.
//
// The claim already carries its baseline null -> RECORDED first entry
// (publication, 2013-04-22). This script adds the downstream arc only:
//
//   RECORDED -> CONTESTED (2014-11-25): Samset BH, et al., "Modelled black
//     carbon radiative forcing and atmospheric lifetime in AeroCom Phase II
//     constrained by aircraft observations." Atmos. Chem. Phys.
//     2014;14:12465-12477. DOI 10.5194/acp-14-12465-2014. By constraining the
//     AeroCom Phase II model ensemble (the same class of models underpinning
//     the Bond assessment) against HIPPO/aircraft vertical profiles, the study
//     found models overestimate BC lifetime and free-tropospheric burden;
//     adjusting to observations reduced the AeroCom-median BC direct forcing by
//     ~25%. Together with contemporaneous observational-constraint work (e.g.
//     Wang et al. 2014, JGR, DOI 10.1002/2013JD020824), this opened a
//     sustained challenge that the Bond assessment's high forcing was biased
//     upward. Community: EXPERT_LITERATURE.
//
//   CONTESTED -> REVERSED (2021-08-09): IPCC Sixth Assessment Report, Working
//     Group I, "Climate Change 2021: The Physical Science Basis" (Chapter 7,
//     radiative forcing). The institutional consensus adopted a best-estimate
//     black-carbon effective radiative forcing of ~+0.11 W/m^2 (1750-2019) —
//     roughly an order of magnitude below the Bond assessment's +1.1 W/m^2
//     total — and no longer ranks black carbon as the second-largest positive
//     forcing agent after CO2. This overturns the specific quantitative /
//     ranking headline of the 2013 assessment (black carbon remains a positive
//     warming agent, but not at the asserted magnitude). Community:
//     INSTITUTIONAL (major intergovernmental scientific assessment).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bond-black-carbon-assessment-2013.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bond-black-carbon-assessment-2013.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w516900mxsa8h6n47y6lk'

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

// Do NOT duplicate the existing null -> RECORDED (publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2014-11-25',
    datePrecision: 'DAY',
    reason:
      'In November 2014 Samset et al. published "Modelled black carbon radiative forcing and atmospheric lifetime in AeroCom Phase II constrained by aircraft observations" (Atmos. Chem. Phys. 14:12465-12477). Comparing the AeroCom Phase II model ensemble — the same class of global aerosol models underpinning the Bond assessment — against HIPPO and other aircraft vertical profiles, they showed models overestimate black-carbon atmospheric lifetime and free-tropospheric burden; constraining models to observations cut the AeroCom-median BC direct forcing by roughly 25%. This dated, quantitative critique (reinforced by Wang et al. 2014, JGR, which required stronger wet removal than models used) directly challenged the Bond assessment\'s high forcing estimate as biased upward, leaving the magnitude contested.',
    source: {
      externalId: 'src:samset-2014-aerocom-bc-forcing-constrained',
      name:
        'Samset BH, Myhre G, Herber A, et al. "Modelled black carbon radiative forcing and atmospheric lifetime in AeroCom Phase II constrained by aircraft observations." Atmos. Chem. Phys. 2014;14:12465-12477. DOI 10.5194/acp-14-12465-2014.',
      url: 'https://doi.org/10.5194/acp-14-12465-2014',
      publishedAt: '2014-11-25',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2021-08-09',
    datePrecision: 'DAY',
    reason:
      'The IPCC Sixth Assessment Report, Working Group I ("Climate Change 2021: The Physical Science Basis," released 9 August 2021) adjudicated the black-carbon forcing question for the intergovernmental scientific consensus. Its Chapter 7 radiative-forcing assessment adopted a best-estimate black-carbon effective radiative forcing of about +0.1 W/m^2 (1750-2019) — roughly an order of magnitude below the Bond assessment\'s +1.1 W/m^2 total — and no longer treats black carbon as the second-largest positive climate forcing after CO2. This overturns the specific quantitative and ranking headline of the 2013 assessment (black carbon remains a positive warming agent, but not at the asserted magnitude).',
    source: {
      externalId: 'src:ipcc-ar6-wg1-2021-radiative-forcing',
      name:
        'IPCC, 2021: Climate Change 2021: The Physical Science Basis. Contribution of Working Group I to the Sixth Assessment Report of the Intergovernmental Panel on Climate Change (Chapter 7: The Earth\u2019s Energy Budget, Climate Feedbacks and Climate Sensitivity). Cambridge University Press.',
      url: 'https://www.ipcc.ch/report/ar6/wg1/',
      publishedAt: '2021-08-09',
      methodologyType: 'derivative',
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
