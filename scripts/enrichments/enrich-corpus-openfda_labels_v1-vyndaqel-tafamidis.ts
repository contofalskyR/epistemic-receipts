// Enrichment: epistemic arc for the FDA Vyndaqel/Vyndamax (tafamidis) label claim.
//
// Claim: cmpixtxaj86fuplo7lb8zbhvy (openfda_labels_v1)
//   "Vyndaqel (TAFAMIDIS MEGLUMINE): ... transthyretin stabilizers indicated for
//    the treatment of the cardiomyopathy of wild-type or hereditary transthyretin-
//    mediated amyloidosis (ATTR-CM) in adults to reduce cardiovascular mortality
//    and cardiovascular-related hospitalization."
//
// Tafamidis (Vyndaqel = tafamidis meglumine; Vyndamax = tafamidis free acid; Pfizer)
// has a well-documented, coherent epistemic arc for the ATTR-CM indication:
//
//   OPEN     -> RECORDED (2018-08-27)  First-published pivotal Phase III evidence:
//                        Maurer et al., "Tafamidis Treatment for Patients with
//                        Transthyretin Amyloid Cardiomyopathy" (the ATTR-ACT trial),
//                        N Engl J Med 2018;379:1007-1016. This double-blind,
//                        placebo-controlled RCT (441 patients, wild-type and
//                        hereditary ATTR-CM) showed tafamidis reduced all-cause
//                        mortality and cardiovascular-related hospitalizations — the
//                        primary clinical evidence that underpins this label's exact
//                        indication language. Ratified by EXPERT_LITERATURE.
//
//   RECORDED -> SETTLED  (2023-08-25)  Standard-of-care / major guideline inclusion:
//                        following FDA approval of Vyndaqel/Vyndamax for ATTR-CM on
//                        3 May 2019 (the first pharmacologic therapy approved for the
//                        condition), the 2023 ESC Guidelines for the management of
//                        cardiomyopathies (Arbelo et al., Eur Heart J 2023;44:3503-3626)
//                        gave tafamidis a Class I recommendation to reduce
//                        cardiovascular hospitalization and mortality in ATTR-CM,
//                        cementing it as guideline-endorsed standard of care.
//                        Ratified by INSTITUTIONAL (guideline body).
//
// No SETTLED -> CONTESTED / REVERSED transition is included. Tafamidis carries no
// black-box warning, no post-market safety withdrawal, and no FDA safety
// communication reversing its approval; it remains first-line standard of care.
// The notable real-world controversy is economic (cost-effectiveness at its list
// price), but that debate is not a safety reversal, and per AGENTS.md hard-fact
// principles a transition is added only where a verifiable canonical URL supports
// it — the exact DOI for that analysis could not be verified in this session, so it
// is omitted rather than fabricated.
//
// Live web verification (WebFetch/WebSearch) was not available in this session;
// URLs are anchored on stable canonical DOI records, consistent with the
// valacyclovir and tofacitinib enrichments in this directory. Idempotent: upserts
// on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-vyndaqel-tafamidis.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpixtxaj86fuplo7lb8zbhvy'

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
    occurredAt: '2018-08-27',
    datePrecision: 'DAY',
    reason:
      'On 27 August 2018 the New England Journal of Medicine published (online, coincident with ESC Congress 2018) Maurer et al., "Tafamidis Treatment for Patients with Transthyretin Amyloid Cardiomyopathy" — the pivotal Phase III ATTR-ACT trial. This double-blind, placebo-controlled RCT of 441 patients with wild-type or hereditary ATTR cardiomyopathy showed that tafamidis reduced all-cause mortality and cardiovascular-related hospitalizations versus placebo. It is the first-published pivotal clinical evidence underpinning this label\'s ATTR-CM indication and the "reduce cardiovascular mortality and cardiovascular-related hospitalization" language.',
    source: {
      externalId: 'src:tafamidis-maurer-attr-act-nejm-2018',
      name: 'Maurer MS, Schwartz JH, Gundapaneni B, et al. "Tafamidis Treatment for Patients with Transthyretin Amyloid Cardiomyopathy" (ATTR-ACT). N Engl J Med 2018;379(11):1007-1016.',
      url: 'https://doi.org/10.1056/NEJMoa1805689',
      publishedAt: '2018-08-27',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2023-08-25',
    datePrecision: 'DAY',
    reason:
      'Following FDA approval of Vyndaqel and Vyndamax for ATTR-CM on 3 May 2019 — the first pharmacologic therapy ever approved for the condition — the 2023 ESC Guidelines for the management of cardiomyopathies (Arbelo et al., published online 25 August 2023) gave tafamidis a Class I recommendation to reduce cardiovascular hospitalization and mortality in patients with ATTR-CM. This guideline inclusion cemented tafamidis as the guideline-endorsed standard of care for the indication carried in this label, settling the therapeutic consensus.',
    source: {
      externalId: 'src:tafamidis-esc-cardiomyopathy-guidelines-2023',
      name: 'Arbelo E, Protonotarios A, Gimeno JR, et al. "2023 ESC Guidelines for the management of cardiomyopathies." Eur Heart J 2023;44(37):3503-3626.',
      url: 'https://doi.org/10.1093/eurheartj/ehad194',
      publishedAt: '2023-08-25',
      methodologyType: 'derivative',
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
