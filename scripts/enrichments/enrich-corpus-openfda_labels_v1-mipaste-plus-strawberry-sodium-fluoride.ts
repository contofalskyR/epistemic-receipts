// Enrichment: epistemic arc for the FDA MI Paste Plus Strawberry (sodium fluoride)
// OTC anticaries label claim.
//
// Claim: cmpixtz8p86guplo7hq2ylnxa (openfda_labels_v1)
//   "MIPaste Plus Strawberry (SODIUM FLUORIDE): Use Aids in the prevention of
//    dental cavities"
//
// The label's exact wording is not marketing copy — it is the claim string that
// FDA's OTC Anticaries Drug Products monograph (21 CFR part 355) prescribes for a
// Category I (safe-and-effective) fluoride active. That regulatory fact makes the
// epistemic arc for "sodium fluoride aids in the prevention of dental cavities"
// unusually well documented:
//
//   OPEN     -> RECORDED (1945-01-25)  First controlled clinical evidence. On
//                        25 January 1945 Grand Rapids, Michigan became the first
//                        city to fluoridate its water in a prospective controlled
//                        trial (Dean/Arnold, U.S. Public Health Service). The
//                        follow-up years demonstrated a ~50-60% reduction in dental
//                        caries in children versus the Muskegon control city — the
//                        first-published clinical evidence that fluoride prevents
//                        cavities. Documented by CDC/MMWR. Ratified by
//                        EXPERT_LITERATURE.
//
//   RECORDED -> SETTLED  (1995-10-06)  Regulatory / standard-of-care settling. FDA's
//                        final OTC "Anticaries Drug Products for Over-the-Counter
//                        Human Use" monograph codified in 21 CFR part 355 classifies
//                        sodium fluoride as a Category I anticaries active and, at
//                        21 CFR 355.50, prescribes the exact permitted label claim
//                        "aids in the prevention of dental cavities." This is the
//                        institutional consensus that this label's claim is settled
//                        science. Ratified by INSTITUTIONAL (FDA monograph).
//
//   SETTLED  -> CONTESTED (2024-08-21)  Post-market safety signal. The U.S. National
//                        Toxicology Program released its systematic-review monograph
//                        concluding, with moderate confidence, that higher fluoride
//                        exposures (drinking water >1.5 mg/L) are consistently
//                        associated with lower IQ in children. Coupled with the
//                        24 September 2024 federal ruling in Food & Water Watch v. EPA
//                        (N.D. Cal.) ordering EPA to address fluoride's
//                        neurodevelopmental risk under TSCA, this opened a genuine
//                        contestation of fluoride's safety margin. NOTE: the signal
//                        concerns systemic/ingested exposure, not the topical
//                        efficacy of this OTC dentifrice claim; it contests the
//                        broader fluoride-safety consensus rather than reversing the
//                        anticaries efficacy finding. Ratified by INSTITUTIONAL.
//
// URL provenance: live web verification (WebFetch/WebSearch) was not available in
// this session. URLs are anchored on stable canonical .gov / DOI records
// (CDC MMWR permalink, eCFR part 355, NTP monograph DOI) consistent with the other
// enrichments in this directory. Idempotent: upserts on Source.externalId and
// ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mipaste-plus-strawberry-sodium-fluoride.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpixtz8p86guplo7hq2ylnxa'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
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
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1945-01-25',
    datePrecision: 'DAY',
    reason:
      'On 25 January 1945 Grand Rapids, Michigan became the first city in the world to fluoridate its public water supply as part of a prospective controlled trial run by the U.S. Public Health Service (H. Trendley Dean, Francis Arnold). Over the following years the study demonstrated roughly a 50-60% reduction in dental caries among children compared with the unfluoridated control city of Muskegon. This was the first-published controlled clinical evidence that fluoride prevents dental cavities, as documented by CDC/MMWR, and it is the foundation for the anticaries claim carried on this sodium-fluoride label.',
    source: {
      externalId: 'src:sodium-fluoride-cdc-mmwr-fluoridation-1999',
      name: 'CDC. "Achievements in Public Health, 1900-1999: Fluoridation of Drinking Water to Prevent Dental Caries." MMWR Morb Mortal Wkly Rep 1999;48(41):933-940.',
      url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/mm4841a1.htm',
      publishedAt: '1999-10-22',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1995-10-06',
    datePrecision: 'MONTH',
    reason:
      'FDA\'s final monograph "Anticaries Drug Products for Over-the-Counter Human Use," codified in 21 CFR part 355, classifies sodium fluoride as a Category I (generally recognized as safe and effective) anticaries active ingredient. At 21 CFR 355.50 the monograph prescribes the exact permitted labeling claim "aids in the prevention of dental cavities" — the precise string appearing on this label. Codification in the OTC monograph settled the caries-prevention efficacy of sodium fluoride as regulatory and standard-of-care consensus.',
    source: {
      externalId: 'src:sodium-fluoride-fda-anticaries-monograph-21cfr355',
      name: 'U.S. FDA. Anticaries Drug Products for Over-the-Counter Human Use, 21 CFR part 355 (final monograph; see 355.50 for permitted claims).',
      url: 'https://www.ecfr.gov/current/title-21/part-355',
      publishedAt: '1995-10-06',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2024-08-21',
    datePrecision: 'DAY',
    reason:
      'On 21 August 2024 the U.S. National Toxicology Program released its systematic-review monograph on fluoride and neurodevelopment, concluding with moderate confidence that higher fluoride exposures (drinking water above 1.5 mg/L) are consistently associated with lower IQ in children. Together with the 24 September 2024 federal ruling in Food & Water Watch v. EPA (N.D. Cal.) ordering EPA to address fluoride\'s neurodevelopmental risk under the Toxic Substances Control Act, this opened a genuine contestation of fluoride\'s safety margin. The signal concerns systemic/ingested exposure rather than the topical efficacy of this OTC anticaries claim, so it contests the broader fluoride-safety consensus rather than reversing the caries-prevention finding.',
    source: {
      externalId: 'src:sodium-fluoride-ntp-monograph-neurodevelopment-2024',
      name: 'National Toxicology Program. "NTP Monograph on the State of the Science Concerning Fluoride Exposure and Neurodevelopment and Cognition: A Systematic Review." NTP Monograph 08, August 2024.',
      url: 'https://doi.org/10.22427/NTP-MGRAPH-8',
      publishedAt: '2024-08-21',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const occurredAt = new Date(t.occurredAt)
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
    })

    console.log(`upserted ${slug} (${t.fromAxis} -> ${t.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
