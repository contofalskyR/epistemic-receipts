// Epistemic-receipt enrichment for OpenAlex claim W3111590711
// Voysey M, et al. "Safety and efficacy of the ChAdOx1 nCoV-19 vaccine (AZD1222)
// against SARS-CoV-2: an interim analysis of four randomised controlled trials in
// Brazil, South Africa, and the UK." The Lancet, 2020/2021.
// DOI: 10.1016/S0140-6736(20)32661-1 · Claim id: cmply52h600hlsaihp6mfv80g
//
// The baseline row (fromAxis=null -> RECORDED at publication, 2020-12-08) already
// exists and is NOT duplicated here. The paper is not retracted (no Crossref
// update-to / Retraction Watch record).
//
// Post-publication arc added:
//   RECORDED -> SETTLED (2020-12-30, INSTITUTIONAL)
//     The UK Medicines and Healthcare products Regulatory Agency granted temporary
//     authorisation for the Oxford/AstraZeneca ChAdOx1 nCoV-19 vaccine after it met
//     the required safety, quality and effectiveness standards. A national medicines
//     regulator adjudicating the trial data as sufficient to authorise mass
//     deployment settles the paper's core "safe and efficacious" claim.
//
//   SETTLED -> CONTESTED (2021-04-07, INSTITUTIONAL)
//     The EMA safety committee (PRAC) concluded that unusual blood clots with low
//     platelets (later termed VITT) should be listed as a very rare side effect and
//     found a possible causal link to the vaccine. This dedicated regulatory finding,
//     which prompted numerous countries to suspend or age-restrict the vaccine,
//     contests the unqualified "safe" half of the original claim (efficacy was not
//     overturned).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-voysey-chadox1-covid-vaccine-2020.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply52h600hlsaihp6mfv80g'

async function main() {
  // ── RECORDED -> SETTLED: MHRA authorisation adjudicates safety + efficacy ──
  {
    const occurredAt = new Date('2020-12-30')
    const toAxis = 'SETTLED'
    const slug = `${CLAIM_ID}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`

    const source = await prisma.source.upsert({
      where: { externalId: 'src:mhra-oxford-astrazeneca-vaccine-approved-2020' },
      create: {
        externalId: 'src:mhra-oxford-astrazeneca-vaccine-approved-2020',
        name: 'MHRA. Oxford University/AstraZeneca COVID-19 vaccine approved. GOV.UK news release, 30 December 2020.',
        url: 'https://www.gov.uk/government/news/oxford-universityastrazeneca-covid-19-vaccine-approved',
        publishedAt: occurredAt,
        methodologyType: 'regulatory',
        ingestedBy: 'enrich-openalex_v1',
      },
      update: {
        name: 'MHRA. Oxford University/AstraZeneca COVID-19 vaccine approved. GOV.UK news release, 30 December 2020.',
        url: 'https://www.gov.uk/government/news/oxford-universityastrazeneca-covid-19-vaccine-approved',
        publishedAt: occurredAt,
        methodologyType: 'regulatory',
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: 'RECORDED',
        toAxis,
        community: 'INSTITUTIONAL',
        occurredAt,
        datePrecision: 'DAY',
        reason:
          'On 30 December 2020 the UK MHRA granted temporary authorisation for the Oxford/AstraZeneca ChAdOx1 nCoV-19 vaccine, judging the pooled trial data to meet required safety, quality and effectiveness standards. A national medicines regulator authorising mass deployment on the strength of these trials settles the paper\'s central "safe and efficacious" claim at the institutional level.',
        sourceId: source.id,
      },
      update: {
        fromAxis: 'RECORDED',
        toAxis,
        community: 'INSTITUTIONAL',
        occurredAt,
        datePrecision: 'DAY',
        sourceId: source.id,
      },
    })

    console.log(`Upserted transition ${slug} (source ${source.id})`)
  }

  // ── SETTLED -> CONTESTED: EMA PRAC VITT finding contests the safety claim ──
  {
    const occurredAt = new Date('2021-04-07')
    const toAxis = 'CONTESTED'
    const slug = `${CLAIM_ID}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`

    const source = await prisma.source.upsert({
      where: { externalId: 'src:ema-prac-astrazeneca-blood-clots-2021' },
      create: {
        externalId: 'src:ema-prac-astrazeneca-blood-clots-2021',
        name: 'EMA. AstraZeneca\u2019s COVID-19 vaccine: EMA finds possible link to very rare cases of unusual blood clots with low blood platelets. European Medicines Agency, 7 April 2021.',
        url: 'https://www.ema.europa.eu/en/news/astrazenecas-covid-19-vaccine-ema-finds-possible-link-very-rare-cases-unusual-blood-clots-low-blood',
        publishedAt: occurredAt,
        methodologyType: 'regulatory',
        ingestedBy: 'enrich-openalex_v1',
      },
      update: {
        name: 'EMA. AstraZeneca\u2019s COVID-19 vaccine: EMA finds possible link to very rare cases of unusual blood clots with low blood platelets. European Medicines Agency, 7 April 2021.',
        url: 'https://www.ema.europa.eu/en/news/astrazenecas-covid-19-vaccine-ema-finds-possible-link-very-rare-cases-unusual-blood-clots-low-blood',
        publishedAt: occurredAt,
        methodologyType: 'regulatory',
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: 'SETTLED',
        toAxis,
        community: 'INSTITUTIONAL',
        occurredAt,
        datePrecision: 'DAY',
        reason:
          'On 7 April 2021 the EMA safety committee (PRAC) concluded that unusual blood clots with low platelets (later termed VITT) should be listed as a very rare side effect of the vaccine and found a possible causal link. This regulatory finding, which led numerous countries to suspend or age-restrict the vaccine, contests the unqualified "safe" half of the original claim; the efficacy finding was not overturned.',
        sourceId: source.id,
      },
      update: {
        fromAxis: 'SETTLED',
        toAxis,
        community: 'INSTITUTIONAL',
        occurredAt,
        datePrecision: 'DAY',
        sourceId: source.id,
      },
    })

    console.log(`Upserted transition ${slug} (source ${source.id})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
