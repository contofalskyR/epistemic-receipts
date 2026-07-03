// Enrichment: epistemic trajectory for the openFDA-label claim asserting the
// approved indications of valacyclovir (VALACYCLOVIR HYDROCHLORIDE), the
// L-valyl ester prodrug of acyclovir, a deoxynucleoside-analogue DNA-polymerase
// inhibitor.
//
// The claim (an FDA structured-product-label snapshot ingested 2026-05-12)
// already carries its null -> RECORDED first entry. This script adds the
// downstream epistemic arc of valacyclovir as a drug fact:
//
//   OPEN -> RECORDED (1995): First published pivotal clinical evidence — the
//     Beutner et al. Phase III randomized controlled trial in Antimicrobial
//     Agents and Chemotherapy showed valaciclovir superior to acyclovir for
//     accelerating resolution of herpes-zoster-associated pain in immunocompetent
//     adults, the trial that supported FDA approval of Valtrex (Dec 1995) and
//     underlies the label's Herpes Zoster indication.
//
//   RECORDED -> SETTLED (2004): The Corey et al. landmark randomized trial in
//     the New England Journal of Medicine showed once-daily valacyclovir
//     significantly reduced the risk of transmission of genital herpes between
//     partners — the first antiviral ever demonstrated to reduce HSV
//     transmission. It drove broad clinical adoption and the addition of the
//     "Reduction of transmission" indication now carried on the label, settling
//     valacyclovir as standard-of-care suppressive therapy.
//
//   SETTLED -> CONTESTED (2010): The expansive expectation that anti-HSV
//     suppression (acyclovir / its prodrug valacyclovir) would benefit the
//     HIV-1-coinfected population named on the label was contested by the large
//     randomized Partners in Prevention trial (Celum et al., NEJM). Despite
//     reducing genital ulcer disease, daily acyclovir suppression did NOT reduce
//     HIV-1 transmission from HSV-2/HIV-1-coinfected persons, tempering the
//     hoped-for public-health role of suppressive dosing in that population.
//
// Only high-confidence, permanently-identified sources are encoded (three DOIs
// from AAC / NEJM landmark trials).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-valacyclovir-herpes-antiviral-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-valacyclovir-herpes-antiviral-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy08bq8ecuplo7p8nzd1ri'

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

// Do NOT duplicate the existing null -> RECORDED first entry; this arc restates
// the epistemic history explicitly starting from OPEN -> RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1995-07-01',
    datePrecision: 'MONTH',
    reason:
      "Valacyclovir entered the peer-reviewed record as a clinically validated drug fact with Beutner and colleagues' 1995 Phase III randomized controlled trial in Antimicrobial Agents and Chemotherapy. In immunocompetent adults with herpes zoster, valaciclovir accelerated resolution of zoster-associated pain relative to its parent acyclovir while offering more convenient dosing, owing to the prodrug's markedly higher oral bioavailability. This pivotal published evidence supported FDA approval of Valtrex in December 1995 and underlies the Herpes Zoster indication carried on the label, moving the compound from an open clinical question to a recorded, citable fact.",
    source: {
      externalId: 'src:beutner-valaciclovir-herpes-zoster-aac-1995',
      name:
        'Beutner KR, Friedman DJ, Forszpaniak C, Andersen PL, Wood MJ. Valaciclovir compared with acyclovir for improved therapy for herpes zoster in immunocompetent adults. Antimicrobial Agents and Chemotherapy. 1995;39(7):1546-1553.',
      url: 'https://doi.org/10.1128/AAC.39.7.1546',
      publishedAt: '1995-07-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-01-01',
    datePrecision: 'MONTH',
    reason:
      "Valacyclovir reached settled standard-of-care status through the Corey et al. landmark randomized, double-blind trial in the New England Journal of Medicine (2004). Once-daily valacyclovir taken by the HSV-2-infected partner significantly reduced the risk of transmission of symptomatic genital herpes to susceptible partners — the first time any antiviral had been shown to reduce HSV transmission. The result drove broad clinical adoption of suppressive valacyclovir and supported the \"Reduction of transmission\" indication now carried on the label, moving the transmission-reduction claim from merely recorded to settled clinical practice.",
    source: {
      externalId: 'src:corey-valacyclovir-transmission-nejm-2004',
      name:
        'Corey L, Wald A, Patel R, Sacks SL, Tyring SK, Warren T, et al. Once-daily valacyclovir to reduce the risk of transmission of genital herpes. New England Journal of Medicine. 2004;350(1):11-20.',
      url: 'https://doi.org/10.1056/NEJMoa035144',
      publishedAt: '2004-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2010-02-04',
    datePrecision: 'DAY',
    reason:
      "The expansive expectation that anti-HSV suppression would deliver public-health benefit in the HIV-1-coinfected population — one of the groups named in the label's suppression indication — was contested by the large randomized Partners in Prevention HSV/HIV-1 Transmission Study (Celum et al., NEJM, 2010). Among HSV-2/HIV-1-coinfected persons, daily acyclovir (valacyclovir's active moiety) suppression reduced genital ulcer disease and plasma HIV-1 levels yet did NOT reduce HIV-1 transmission to susceptible partners. The negative result tempered the hoped-for role of suppressive anti-HSV dosing in HIV prevention and reframed the boundaries of the drug class's benefit in coinfected patients.",
    source: {
      externalId: 'src:celum-acyclovir-hiv1-transmission-nejm-2010',
      name:
        'Celum C, Wald A, Lingappa JR, Magaret AS, Wang RS, Mugo N, et al. Acyclovir and transmission of HIV-1 from persons infected with HIV-1 and HSV-2. New England Journal of Medicine. 2010;362(5):427-439.',
      url: 'https://doi.org/10.1056/NEJMoa0904849',
      publishedAt: '2010-02-04',
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
        ingestedBy: 'enrich:openfda_labels_v1',
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
