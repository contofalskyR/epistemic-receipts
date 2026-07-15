// Enrichment: epistemic trajectory for Wang et al. 2020 JAMA COVID-19 case series.
//
// Claim: cmplya83h02z9saihgyingixa
// "Clinical Characteristics of 138 Hospitalized Patients With 2019 Novel
//  Coronavirus-Infected Pneumonia in Wuhan, China"
// Wang D, Hu B, Hu C, et al. JAMA. 2020;323(11):1061-1069.
// DOI 10.1001/jama.2020.1585 · OpenAlex W3005079553
//
// Post-publication event: this single-center case series' headline finding was
// that presumed hospital-related (nosocomial) transmission of 2019-nCoV was
// suspected in 41% of the 138 patients. A subsequent rapid review and
// meta-analysis (Zhou Q, et al. Ann Transl Med 2020) pooled nosocomial infection
// proportions across early COVID-19 outbreaks at 44.0% — closely matching the
// 41% reported here — incorporating this study among its primary sources and
// adjudicating the finding in the expert literature.
// No retraction or expression of concern exists; only a minor Feb 2020 data
// correction to Table 1 (female-patient values), which does not alter the claim.
//
// Arc: RECORDED (2020-02) --> SETTLED (2020-05, EXPERT_LITERATURE)
// The baseline RECORDED row (fromAxis=null) already exists; do NOT duplicate it.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-wang-2020-138-hospitalized-covid-wuhan.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplya83h02z9saihgyingixa'

async function main() {
  // ── SETTLED: meta-analysis vindicates the nosocomial-transmission finding ──
  await prisma.source.upsert({
    where: { externalId: 'src:zhou-2020-nosocomial-covid-sars-mers-meta' },
    create: {
      externalId: 'src:zhou-2020-nosocomial-covid-sars-mers-meta',
      name: 'Zhou Q, Gao Y, Wang X, et al. Nosocomial infections among patients with COVID-19, SARS and MERS: a rapid review and meta-analysis. Ann Transl Med. 2020;8(10):629.',
      url: 'https://doi.org/10.21037/atm-20-3324',
      publishedAt: new Date('2020-05-01'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Zhou Q, Gao Y, Wang X, et al. Nosocomial infections among patients with COVID-19, SARS and MERS: a rapid review and meta-analysis. Ann Transl Med. 2020;8(10):629.',
      url: 'https://doi.org/10.21037/atm-20-3324',
      publishedAt: new Date('2020-05-01'),
      methodologyType: 'derivative',
    },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${CLAIM_ID}-SETTLED-2020-05-01` },
    create: {
      id: `${CLAIM_ID}-SETTLED-2020-05-01`,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2020-05-01'),
      datePrecision: 'MONTH',
      reason:
        'This study\'s headline epidemiological finding — presumed hospital-related (nosocomial) transmission of 2019-nCoV suspected in 41% of the 138 patients — was adjudicated by a rapid review and meta-analysis (Zhou et al., Ann Transl Med 2020) that pooled nosocomial infection proportions across early COVID-19 outbreaks at 44.0%, closely matching the 41% reported here. The meta-analysis incorporated this case series among its primary sources, vindicating the finding in the expert literature rather than overturning it.',
      source: { connect: { externalId: 'src:zhou-2020-nosocomial-covid-sars-mers-meta' } },
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2020-05-01'),
      datePrecision: 'MONTH',
      reason:
        'This study\'s headline epidemiological finding — presumed hospital-related (nosocomial) transmission of 2019-nCoV suspected in 41% of the 138 patients — was adjudicated by a rapid review and meta-analysis (Zhou et al., Ann Transl Med 2020) that pooled nosocomial infection proportions across early COVID-19 outbreaks at 44.0%, closely matching the 41% reported here. The meta-analysis incorporated this case series among its primary sources, vindicating the finding in the expert literature rather than overturning it.',
      source: { connect: { externalId: 'src:zhou-2020-nosocomial-covid-sars-mers-meta' } },
    },
  })

  console.log('Enrichment complete: RECORDED -> SETTLED (2020-05) for', CLAIM_ID)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
