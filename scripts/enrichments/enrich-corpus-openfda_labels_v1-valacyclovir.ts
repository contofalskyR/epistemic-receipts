// Enrichment: epistemic arc for the FDA valacyclovir hydrochloride label claim.
//
// Claim: cmpixtujq86biplo7n9rusgaz (openfda_labels_v1)
//   "Valacyclovir Hydrochloride ... a deoxynucleoside analogue DNA polymerase
//    inhibitor indicated for ... Cold Sores (Herpes Labialis) ... Genital Herpes
//    ... Suppression in immunocompetent or HIV-1-infected patients ... Reduction
//    of transmission ... Herpes Zoster ... Chickenpox ... Limitations of Use (1.3)"
//
// Valacyclovir (the L-valyl ester prodrug of acyclovir; brand Valtrex) has a
// well-documented, coherent epistemic arc. Note that the historically accurate
// order places the high-dose safety signal (1998) BEFORE the transmission-trial
// re-settlement (2004), so the trajectory is RECORDED -> CONTESTED -> SETTLED
// rather than the reverse. This is faithful to the record and is preferred over
// forcing the literal template order with fabricated dates (per AGENTS.md
// hard-fact principles: no transition beyond what the cited record supports).
//
//   OPEN     -> RECORDED  (1995-07)  First-published pivotal Phase III evidence:
//                         Beutner et al., "Valaciclovir compared with acyclovir
//                         for improved therapy for herpes zoster in immunocompetent
//                         adults," Antimicrob Agents Chemother 1995;39(7):1546-53.
//                         This randomized comparative trial (the pivotal zoster
//                         program) established that the prodrug improved acyclovir
//                         exposure and accelerated resolution of zoster-associated
//                         pain, the primary clinical evidence underpinning FDA
//                         approval of Valtrex in 1995. Ratified by EXPERT_LITERATURE.
//
//   RECORDED -> CONTESTED (1998-01)  Post-approval safety signal: Feinberg et al.,
//                         "A randomized, double-blind trial of valaciclovir
//                         prophylaxis for cytomegalovirus disease in patients with
//                         advanced human immunodeficiency virus infection"
//                         (ACTG 204), J Infect Dis 1998;177(1):48-56. High-dose
//                         valacyclovir (8 g/day) in advanced HIV was associated
//                         with excess mortality and a thrombotic thrombocytopenic
//                         purpura / hemolytic-uremic syndrome (TTP/HUS) signal.
//                         This contested expansion into high-dose immunocompromised
//                         prophylaxis and is the direct basis for the label's
//                         TTP/HUS Warning and its "Limitations of Use (1.3)."
//                         Ratified by EXPERT_LITERATURE.
//
//   CONTESTED -> SETTLED  (2004-01)  Re-settlement at standard antiviral doses:
//                         Corey et al., "Once-Daily Valacyclovir to Reduce the Risk
//                         of Transmission of Genital Herpes," N Engl J Med
//                         2004;350(1):11-20. This landmark placebo-controlled RCT
//                         showed once-daily suppressive valacyclovir reduced HSV-2
//                         transmission between serodiscordant partners — the first
//                         antiviral ever shown to reduce sexual transmission of an
//                         infection — cementing suppressive valacyclovir as standard
//                         of care and establishing the "Reduction of transmission"
//                         indication carried verbatim in this label. Ratified by
//                         EXPERT_LITERATURE.
//
// No SETTLED -> REVERSED transition is included: valacyclovir remains FDA-approved
// and first-line for its herpes indications; the 1998 signal narrowed high-dose
// immunocompromised use, it did not revoke the approval.
//
// Live web verification (WebFetch/WebSearch) was not available in this session;
// URLs are anchored on stable, canonical DOI records, consistent with the tofacitinib
// enrichment. Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-valacyclovir.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpixtujq86biplo7n9rusgaz'

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
    occurredAt: '1995-07-01',
    datePrecision: 'MONTH',
    reason:
      'In July 1995 Antimicrobial Agents and Chemotherapy published Beutner et al., "Valaciclovir compared with acyclovir for improved therapy for herpes zoster in immunocompetent adults," the pivotal randomized comparative trial of the acyclovir prodrug. It demonstrated that valacyclovir improved acyclovir exposure and accelerated resolution of zoster-associated pain relative to acyclovir. This was the first-published pivotal Phase III clinical evidence supporting the herpes zoster indication and underpinned FDA approval of Valtrex the same year.',
    source: {
      externalId: 'src:valacyclovir-beutner-zoster-aac-1995',
      name: 'Beutner KR, Friedman DJ, Forszpaniak C, Andersen PL, Wood MJ. "Valaciclovir compared with acyclovir for improved therapy for herpes zoster in immunocompetent adults." Antimicrob Agents Chemother 1995;39(7):1546-1553.',
      url: 'https://doi.org/10.1128/AAC.39.7.1546',
      publishedAt: '1995-07-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1998-01-01',
    datePrecision: 'MONTH',
    reason:
      'In January 1998 the Journal of Infectious Diseases published Feinberg et al. (AIDS Clinical Trials Group Protocol 204), a randomized, double-blind trial of high-dose valacyclovir (8 g/day) for cytomegalovirus prophylaxis in advanced HIV disease. The high-dose arm showed excess mortality and a thrombotic thrombocytopenic purpura / hemolytic-uremic syndrome (TTP/HUS) safety signal, contesting expansion of the drug into high-dose immunocompromised prophylaxis. This finding is the direct basis for the TTP/HUS Warning and the "Limitations of Use (1.3)" carried in this label.',
    source: {
      externalId: 'src:valacyclovir-feinberg-cmv-hiv-jid-1998',
      name: 'Feinberg JE, Hurwitz S, Cooper D, et al. "A randomized, double-blind trial of valaciclovir prophylaxis for cytomegalovirus disease in patients with advanced human immunodeficiency virus infection (ACTG 204)." J Infect Dis 1998;177(1):48-56.',
      url: 'https://doi.org/10.1086/513804',
      publishedAt: '1998-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-01-01',
    datePrecision: 'DAY',
    reason:
      'On 1 January 2004 the New England Journal of Medicine published Corey et al., "Once-Daily Valacyclovir to Reduce the Risk of Transmission of Genital Herpes," a placebo-controlled RCT in HSV-2 serodiscordant couples. It showed that once-daily suppressive valacyclovir significantly reduced sexual transmission of genital herpes — the first antiviral ever shown to reduce transmission of an infection — cementing suppressive valacyclovir as standard of care at standard doses and establishing the "Reduction of transmission" indication carried verbatim in this label. This re-settled the therapeutic consensus after the earlier high-dose safety signal.',
    source: {
      externalId: 'src:valacyclovir-corey-transmission-nejm-2004',
      name: 'Corey L, Wald A, Patel R, et al. "Once-Daily Valacyclovir to Reduce the Risk of Transmission of Genital Herpes." N Engl J Med 2004;350(1):11-20.',
      url: 'https://doi.org/10.1056/NEJMoa035144',
      publishedAt: '2004-01-01',
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
