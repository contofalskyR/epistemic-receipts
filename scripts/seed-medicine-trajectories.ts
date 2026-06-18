// Seed: Medicine & Drug Approvals epistemic trajectories
//
// Domain-specific settling curves: each trajectory is a dateable medical/
// pharmacological claim with a verifiable epistemic arc — from initial
// expert literature finding through institutional adoption, regulatory
// action, court judgments, public recognition, or market response.
//
// Sources: PubMed, FDA approval databases, Retraction Watch, NEJM, Lancet,
// WHO bulletins, congressional records, court decisions.
//
// Idempotent: upserts on externalId.
//
// Run:     npx tsx scripts/seed-medicine-trajectories.ts
// Dry-run: npx tsx scripts/seed-medicine-trajectories.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

type FactStatus = 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
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

interface Trajectory {
  externalId: string
  text: string
  claimType: 'EMPIRICAL' | 'INSTITUTIONAL' | 'INTERPRETIVE' | 'HYBRID'
  claimEmergedAt: string
  claimEmergedPrecision: DatePrecision
  currentAxis: FactStatus
  transitions: Transition[]
}

const TRAJECTORIES: Trajectory[] = [

  // ═══════════════════════════════════════════════════════════════════════════════
  // DRUG DISCOVERY ERA (pre-1950)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 1. Penicillin discovered — Fleming 1928 ─────────────────────────────────
  {
    externalId: 'trajectory:penicillin-discovery-1928',
    text: 'Alexander Fleming observed on 28 September 1928 that the mold Penicillium notatum inhibited bacterial growth on a contaminated culture plate, establishing that penicillin had antibacterial properties.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1928-09-28',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1929-06-01',
        datePrecision: 'MONTH',
        reason: 'Fleming publishes his observation in the British Journal of Experimental Pathology, describing the mold\'s bacteriostatic effect. The finding is noted but largely ignored for a decade — Fleming himself was unable to stabilize the compound.',
        source: {
          externalId: 'src:fleming-penicillin-1929',
          name: 'Fleming A. On the antibacterial action of cultures of a Penicillium. British Journal of Experimental Pathology. 1929;10(3):226–236.',
          url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2048009/',
          publishedAt: '1929-06-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1940-08-24',
        datePrecision: 'DAY',
        reason: 'Chain, Florey, and colleagues at Oxford publish the first clinical results demonstrating penicillin\'s efficacy in infected mice in The Lancet, establishing its therapeutic potential. This paper restarts serious scientific and institutional interest.',
        source: {
          externalId: 'src:chain-florey-penicillin-1940',
          name: 'Chain E, Florey HW, et al. Penicillin as a Chemotherapeutic Agent. Lancet. 1940;236(6104):226–228.',
          url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(01)08728-1/fulltext',
          publishedAt: '1940-08-24',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1945-10-25',
        datePrecision: 'DAY',
        reason: 'Fleming, Chain, and Florey are awarded the Nobel Prize in Physiology or Medicine for the discovery and development of penicillin, cementing institutional recognition of the antibiotic\'s significance.',
        source: {
          externalId: 'src:nobel-penicillin-1945',
          name: 'Nobel Prize Committee. Nobel Prize in Physiology or Medicine 1945. NobelPrize.org.',
          url: 'https://www.nobelprize.org/prizes/medicine/1945/summary/',
          publishedAt: '1945-10-25',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLINICAL TRIALS ERA (1950–1990)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 2. Smoking causes lung cancer — Doll & Hill 1950 ───────────────────────
  {
    externalId: 'trajectory:smoking-causes-lung-cancer-1950',
    text: 'Cigarette smoking causes lung cancer in humans.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1950-09-30',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1950-09-30',
        datePrecision: 'MONTH',
        reason: 'Doll and Hill publish a landmark case-control study in the British Medical Journal showing a statistically significant association between cigarette smoking and lung cancer. Simultaneously Wynder & Graham publish similar findings in JAMA. Expert literature moves from OPEN to RECORDED.',
        source: {
          externalId: 'src:doll-hill-smoking-1950',
          name: 'Doll R, Hill AB. Smoking and Carcinoma of the Lung. BMJ. 1950;2(4682):739–748.',
          url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2038856/',
          publishedAt: '1950-09-30',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1964-01-11',
        datePrecision: 'DAY',
        reason: 'The U.S. Surgeon General\'s Advisory Committee report, reviewing over 7,000 studies, concludes that "cigarette smoking is causally related to lung cancer in men." The 14-year lag between expert literature consensus and institutional recognition is one of the defining epistemic delays of the 20th century.',
        source: {
          externalId: 'src:surgeon-general-smoking-1964',
          name: 'U.S. Surgeon General\'s Advisory Committee. Smoking and Health. Public Health Service Publication No. 1103. January 11, 1964.',
          url: 'https://profiles.nlm.nih.gov/spotlight/nn/feature/smoking',
          publishedAt: '1964-01-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'JUDICIAL',
        occurredAt: '1998-11-23',
        datePrecision: 'DAY',
        reason: 'The Tobacco Master Settlement Agreement is signed by 46 U.S. states and the four largest tobacco companies, requiring $206 billion in payments over 25 years and accepting liability for smoking-related illness. Courts formally ratify the scientific consensus as a legal fact.',
        source: {
          externalId: 'src:tobacco-msa-1998',
          name: 'National Association of Attorneys General. Master Settlement Agreement. November 23, 1998.',
          url: 'https://www.naag.org/our-work/naag-center-for-tobacco-and-public-health/the-master-settlement-agreement/',
          publishedAt: '1998-11-23',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // VACCINE SAFETY & EFFICACY ERA (1990–2010)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 4. Wakefield MMR-autism fraud — 1998–2010 ───────────────────────────────
  {
    externalId: 'trajectory:wakefield-mmr-autism-1998',
    text: 'Andrew Wakefield and colleagues reported in The Lancet on 28 February 1998 that MMR vaccination was temporally associated with the onset of behavioural (autistic) regression and non-specific colitis in 12 children, suggesting a possible link between the MMR vaccine and pervasive developmental disorder.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1998-02-28',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1998-02-28',
        datePrecision: 'DAY',
        reason: 'The Lancet published Wakefield et al.\'s case series of 12 children describing ileal-lymphoid-nodular hyperplasia and developmental regression following MMR vaccination. The paper itself only hypothesised a link, but a press conference at which Wakefield called for suspension of the combined vaccine turned the hypothesis into a widely recorded public-health claim.',
        source: {
          externalId: 'src:wakefield-lancet-1998',
          name: 'Wakefield AJ, Murch SH, Anthony A, et al. Ileal-lymphoid-nodular hyperplasia, non-specific colitis, and pervasive developmental disorder in children. Lancet. 1998;351(9103):637-641.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9683237/',
          publishedAt: '1998-02-28',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2002-11-07',
        datePrecision: 'DAY',
        reason: 'Madsen et al. published a population-based cohort study of all 537,303 children born in Denmark 1991–1998 in the New England Journal of Medicine, finding no increased risk of autism among MMR-vaccinated children. This and subsequent large epidemiological studies failed to replicate any MMR–autism association, placing the original claim in serious dispute.',
        source: {
          externalId: 'src:madsen-nejm-mmr-2002',
          name: 'Madsen KM, Hviid A, Vestergaard M, et al. A population-based study of measles, mumps, and rubella vaccination and autism. N Engl J Med. 2002;347(19):1477-1482.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12421889/',
          publishedAt: '2002-11-07',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2010-02-02',
        datePrecision: 'DAY',
        reason: 'Following the UK General Medical Council\'s Fitness to Practise Panel finding (28 January 2010) that key claims in the paper were false and that the research was conducted unethically, The Lancet fully retracted the 1998 article. The retraction formally erased the study from the scientific record, completing the reversal of the MMR–autism claim.',
        source: {
          externalId: 'src:lancet-retraction-wakefield-2010',
          name: 'The Editors of The Lancet. Retraction—Ileal-lymphoid-nodular hyperplasia, non-specific colitis, and pervasive developmental disorder in children. Lancet. 2010;375(9713):445.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/20137807/',
          publishedAt: '2010-02-02',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 5. RotaShield rotavirus vaccine withdrawal — 1998–1999 ──────────────────
  {
    externalId: 'trajectory:rotashield-rotavirus-withdrawal-1999',
    text: 'RotaShield (RRV-TV), the first licensed rotavirus vaccine, was approved by the FDA on 31 August 1998 and recommended for routine infant immunization in the United States as a safe and effective vaccine.',
    claimType: 'HYBRID',
    claimEmergedAt: '1998-08-31',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1998-08-31',
        datePrecision: 'DAY',
        reason: 'The FDA licensed Wyeth-Lederle\'s RotaShield, and the Advisory Committee on Immunization Practices subsequently recommended it for routine administration to infants at 2, 4, and 6 months. The claim that an effective, acceptably safe rotavirus vaccine existed was institutionally settled in U.S. immunization policy.',
        source: {
          externalId: 'src:cdc-mmwr-rotashield-postpone-1999',
          name: 'CDC. Intussusception among recipients of rotavirus vaccine—United States, 1998-1999. MMWR Morb Mortal Wkly Rep. 1999;48(27):577-581.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/mm4827a1.htm',
          publishedAt: '1999-07-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '1999-07-16',
        datePrecision: 'DAY',
        reason: 'Post-marketing surveillance via the Vaccine Adverse Event Reporting System detected 15 cases of intussusception, 80% within one week of vaccination. CDC recommended postponing further RotaShield administration pending investigation, converting the settled safety claim into an active safety signal — a textbook post-market surveillance contestation.',
        source: {
          externalId: 'src:cdc-mmwr-rotashield-intussusception-1999',
          name: 'CDC. Intussusception among recipients of rotavirus vaccine—United States, 1998-1999. MMWR Morb Mortal Wkly Rep. 1999;48(27):577-581.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/mm4827a1.htm',
          publishedAt: '1999-07-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '1999-10-22',
        datePrecision: 'DAY',
        reason: 'After analysis confirmed a significantly increased risk of intussusception in the 1–2 weeks following vaccination, ACIP withdrew its recommendation on 22 October 1999 and the manufacturer withdrew RotaShield from the market. It was the first vaccine pulled in the U.S. primarily on the basis of a post-licensure safety signal.',
        source: {
          externalId: 'src:cdc-mmwr-rotashield-withdraw-1999',
          name: 'CDC. Withdrawal of rotavirus vaccine recommendation. MMWR Morb Mortal Wkly Rep. 1999;48(43):1007.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/mm4843a5.htm',
          publishedAt: '1999-11-05',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 6. HAART triple therapy for HIV — 1997–1998 ─────────────────────────────
  {
    externalId: 'trajectory:haart-triple-therapy-hiv-1997',
    text: 'A randomized controlled trial reported on 11 September 1997 that adding the protease inhibitor indinavir to two nucleoside analogues (triple combination antiretroviral therapy) roughly halved progression to AIDS or death in patients with advanced HIV infection.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1997-09-11',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1997-09-11',
        datePrecision: 'DAY',
        reason: 'Hammer et al. published the AIDS Clinical Trials Group 320 trial in the New England Journal of Medicine, showing that triple therapy with indinavir plus zidovudine and lamivudine reduced progression to AIDS or death to 6% versus 11% with dual nucleosides (P=0.001). This provided the first definitive randomized evidence that protease-inhibitor-based combination therapy altered the course of HIV disease.',
        source: {
          externalId: 'src:hammer-actg320-nejm-1997',
          name: 'Hammer SM, Squires KE, Hughes MD, et al. A controlled trial of two nucleoside analogues plus indinavir in persons with HIV infection and CD4 cell counts of 200 per cubic millimeter or less. N Engl J Med. 1997;337(11):725-733.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9287227/',
          publishedAt: '1997-09-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1998-03-26',
        datePrecision: 'DAY',
        reason: 'Palella et al. documented in the New England Journal of Medicine that mortality among patients with advanced HIV fell from 29.4 to 8.8 per 100 person-years between 1995 and 1997 as combination antiretroviral therapy was adopted. This population-level confirmation settled triple therapy as the standard of care for HIV.',
        source: {
          externalId: 'src:palella-nejm-haart-1998',
          name: 'Palella FJ Jr, Delaney KM, Moorman AC, et al. Declining morbidity and mortality among patients with advanced human immunodeficiency virus infection. N Engl J Med. 1998;338(13):853-860.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9516219/',
          publishedAt: '1998-03-26',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 7. First VRSA — vancomycin-resistant S. aureus 2002 ─────────────────────
  {
    externalId: 'trajectory:first-vrsa-antibiotic-resistance-2002',
    text: 'The CDC reported on 5 July 2002 the first documented human infection caused by fully vancomycin-resistant Staphylococcus aureus (VRSA), isolated from a Michigan patient and carrying the vanA resistance gene.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2002-07-05',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2002-07-05',
        datePrecision: 'DAY',
        reason: 'CDC\'s MMWR reported VRSA isolated from a catheter exit site of a 40-year-old Michigan dialysis patient, confirmed by CDC to be resistant to vancomycin (MIC ≥128 µg/mL). The long-feared transfer of high-level glycopeptide resistance into S. aureus — previously only theoretical and demonstrated in vitro — was now an observed clinical fact.',
        source: {
          externalId: 'src:cdc-mmwr-vrsa-2002',
          name: 'CDC. Staphylococcus aureus resistant to vancomycin—United States, 2002. MMWR Morb Mortal Wkly Rep. 2002;51(26):565-567.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/mm5126a1.htm',
          publishedAt: '2002-07-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2003-04-03',
        datePrecision: 'DAY',
        reason: 'Chang et al. published the full molecular characterization in the New England Journal of Medicine, confirming the vanA gene had transferred to S. aureus, likely from co-infecting vancomycin-resistant Enterococcus. Independent genetic confirmation in a peer-reviewed journal settled the emergence of VRSA as established science.',
        source: {
          externalId: 'src:chang-nejm-vrsa-2003',
          name: 'Chang S, Sievert DM, Hageman JC, et al. Infection with vancomycin-resistant Staphylococcus aureus containing the vanA resistance gene. N Engl J Med. 2003;348(14):1342-1347.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12700376/',
          publishedAt: '2003-04-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 8. Gardasil HPV vaccine approval — 2006–2007 ───────────────────────────
  {
    externalId: 'trajectory:gardasil-hpv-vaccine-approval-2006',
    text: 'The FDA approved Gardasil, the first quadrivalent human papillomavirus (HPV types 6, 11, 16, 18) vaccine, on 8 June 2006 to prevent cervical cancer and precancerous cervical lesions in females.',
    claimType: 'HYBRID',
    claimEmergedAt: '2006-06-08',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2006-06-08',
        datePrecision: 'DAY',
        reason: 'The FDA licensed Merck\'s Gardasil for females aged 9–26 based on the FUTURE clinical trial program, formally recording the claim that vaccination against oncogenic HPV types could prevent cervical cancer precursors. It was the first vaccine specifically licensed to prevent a cancer in women.',
        source: {
          externalId: 'src:fda-gardasil-approval-2006',
          name: 'U.S. Food and Drug Administration. Gardasil — Product Approval Information (Licensing Action), June 8, 2006.',
          url: 'https://wayback.archive-it.org/7993/20170111233922/http://www.fda.gov/BiologicsBloodVaccines/Vaccines/ApprovedProducts/ucm094042.htm',
          publishedAt: '2006-06-08',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2007-05-10',
        datePrecision: 'DAY',
        reason: 'The FUTURE II Study Group published in the New England Journal of Medicine that the quadrivalent vaccine was 98% efficacious against HPV-16/18-related high-grade cervical lesions (CIN 2/3) in the per-protocol population. Large-scale randomized efficacy data settled the vaccine\'s protective claim across the expert community.',
        source: {
          externalId: 'src:future-ii-nejm-gardasil-2007',
          name: 'FUTURE II Study Group. Quadrivalent vaccine against human papillomavirus to prevent high-grade cervical lesions. N Engl J Med. 2007;356(19):1915-1927.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/17494925/',
          publishedAt: '2007-05-10',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // THALIDOMIDE ERA (pre-1950 → clinical trials era)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 3. Thalidomide — approved, reversed, partially rehabilitated ───────────
  {
    externalId: 'trajectory:thalidomide-teratogenicity-1961',
    text: 'Thalidomide, widely prescribed in Europe from 1957 as a sedative and anti-nausea drug for pregnant women, causes severe limb malformations (phocomelia) in newborns when taken during the first trimester.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1961-11-16',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1961-11-16',
        datePrecision: 'MONTH',
        reason: 'Widukind Lenz presents his findings at the German Pediatric Society meeting on November 16, 1961, identifying thalidomide as the cause of 52 malformation cases in Hamburg. Simultaneously Australian physician William McBride writes to The Lancet. Chemie Grünenthal withdraws the drug from the German market on November 26, 1961.',
        source: {
          externalId: 'src:mcbride-thalidomide-lancet-1961',
          name: 'McBride WG. Thalidomide and congenital abnormalities. Lancet. 1961;278(7216):1358.',
          url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(61)90927-8/fulltext',
          publishedAt: '1961-12-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1962-10-10',
        datePrecision: 'MONTH',
        reason: 'The Kefauver-Harris Amendment to the U.S. Federal Food, Drug and Cosmetic Act is signed on October 10, 1962, requiring proof of efficacy (not just safety) for drug approval. The law was directly prompted by the thalidomide crisis, though the FDA\'s Frances Kelsey had blocked U.S. approval. The amendment transforms global drug regulation.',
        source: {
          externalId: 'src:kefauver-harris-1962',
          name: 'Drug Amendments Act of 1962 (Kefauver-Harris Amendment). Pub. L. 87–781, 76 Stat. 780.',
          url: 'https://www.fda.gov/patients/drug-development-process/step-3-clinical-research',
          publishedAt: '1962-10-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1998-07-16',
        datePrecision: 'DAY',
        reason: 'FDA approves thalidomide (as Thalomid, Celgene) for erythema nodosum leprosum on July 16, 1998, and later for multiple myeloma (2006). The teratogenicity claim remains fully settled; the SETTLED→SETTLED transition reflects partial rehabilitation in a strictly controlled, non-pregnancy context — a new epistemic layer added to the same substance.',
        source: {
          externalId: 'src:fda-thalomid-approval-1998',
          name: 'FDA. NDA 20-785. Thalomid (thalidomide) approval letter. July 16, 1998.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/appletter/1998/20785ltr.pdf',
          publishedAt: '1998-07-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PSYCHIATRIC NEUROSURGERY ERA (1930s–1960s)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 9. Prefrontal lobotomy — Nobel → abandoned ───────────────────────────────
  {
    externalId: 'trajectory:prefrontal-lobotomy-therapeutic-value-1936',
    text: 'Prefrontal leucotomy (lobotomy), introduced by António Egas Moniz and Almeida Lima in 1935–1936, has therapeutic value as a treatment for severe psychoses and mental illness.',
    claimType: 'HYBRID',
    claimEmergedAt: '1936-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'ABANDONED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1936-01-01',
        datePrecision: 'YEAR',
        reason: 'Moniz and the neurosurgeon Almeida Lima performed and reported the first prefrontal leucotomies in 1936, claiming symptomatic improvement in patients with severe psychiatric illness. The procedure was rapidly adopted internationally (notably by Freeman and Watts in the U.S.), recording the claim that destroying prefrontal connections could relieve intractable mental illness.',
        source: {
          externalId: 'src:mehta-moniz-legacy-cureus-2024',
          name: 'Mehta SS, Vadali S, Singh J, Sadana SK, Singh A. The Legacy of Egas Moniz: Triumphs and Controversies in Medical Innovation. Cureus. 2024;16(10):e72056.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11578627/',
          publishedAt: '2024-10-21',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1949-12-10',
        datePrecision: 'DAY',
        reason: 'Egas Moniz was awarded the Nobel Prize in Physiology or Medicine for 1949 \'for his discovery of the therapeutic value of leucotomy in certain psychoses,\' sharing it with Walter Hess. The highest institutional honor in medicine ratified lobotomy\'s therapeutic legitimacy at the peak of its global use, settling the claim in mainstream psychiatry.',
        source: {
          externalId: 'src:nobel-moniz-leucotomy-1949',
          name: 'Nobel Prize Committee. The Nobel Prize in Physiology or Medicine 1949 — António Egas Moniz, Facts. NobelPrize.org.',
          url: 'https://www.nobelprize.org/prizes/medicine/1949/moniz/facts/',
          publishedAt: '1949-12-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'ABANDONED',
        community: 'INSTITUTIONAL',
        occurredAt: '1960-01-01',
        datePrecision: 'YEAR',
        reason: 'Following the introduction of chlorpromazine and other neuroleptics in 1952, which offered effective, reversible pharmacological control of psychotic symptoms, lobotomy use fell sharply through the 1950s and largely ceased after 1960. Mounting recognition of irreversible cognitive and personality damage, combined with a pharmacological alternative, led psychiatry to abandon the procedure as a therapeutic standard.',
        source: {
          externalId: 'src:mehta-moniz-decline-cureus-2024',
          name: 'Mehta SS, Vadali S, Singh J, Sadana SK, Singh A. The Legacy of Egas Moniz: Triumphs and Controversies in Medical Innovation. Cureus. 2024;16(10):e72056.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11578627/',
          publishedAt: '2024-10-21',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ALZHEIMER'S / AMYLOID HYPOTHESIS ERA (2006–2024)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 10. Lesné Aβ*56 — fabrication retracted 2024 ────────────────────────────
  {
    externalId: 'trajectory:lesne-amyloid-beta-star-56-2006',
    text: 'Sylvain Lesné and colleagues reported in Nature on 16 March 2006 that Aβ*56, a specific soluble amyloid-beta oligomer, accumulates in the brains of memory-impaired Alzheimer\'s-model mice and directly impairs memory when administered to healthy rats — identifying a discrete toxic species behind Alzheimer\'s cognitive decline.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2006-03-16',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-03-16',
        datePrecision: 'DAY',
        reason: 'Lesné et al. published in Nature the identification of Aβ*56 as a specific amyloid-beta assembly that impaired memory independently of plaques and neuronal loss. The paper became one of the most-cited works in Alzheimer\'s research and was widely taken as direct in vivo evidence for the toxic-oligomer version of the amyloid hypothesis, recording the claim in the expert literature.',
        source: {
          externalId: 'src:lesne-abeta56-nature-2006',
          name: 'Lesné S, Koh MT, Kotilinek L, et al. A specific amyloid-beta protein assembly in the brain impairs memory. Nature. 2006;440(7082):352-357.',
          url: 'https://www.nature.com/articles/nature04533',
          publishedAt: '2006-03-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2022-07-21',
        datePrecision: 'DAY',
        reason: 'A Science investigation by Charles Piller reported that neuroscientist Matthew Schrag and image-forensics experts had found apparent manipulation — spliced and duplicated Western blots — in the 2006 paper and dozens of related Lesné publications. The exposé cast doubt on a foundational pillar of the toxic-oligomer hypothesis and triggered formal institutional and journal investigations, placing the Aβ*56 claim in serious dispute.',
        source: {
          externalId: 'src:piller-blots-on-a-field-science-2022',
          name: 'Piller C. Blots on a field? A neuroscience image sleuth finds signs of fabrication in scores of Alzheimer\'s articles. Science. 2022;377(6604):358-363.',
          url: 'https://www.science.org/content/article/potential-fabrication-research-images-threatens-key-theory-alzheimers-disease',
          publishedAt: '2022-07-21',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2024-06-24',
        datePrecision: 'DAY',
        reason: 'Nature retracted the 2006 paper, stating that figures including Fig. 2c and Supplementary Fig. 4 showed signs of excessive manipulation — splicing, duplication, and eraser-tool use — and that the data could not be verified from the original records. Most co-authors agreed with the retraction while Lesné dissented. The retraction of one of the most-cited papers ever withdrawn formally erased the Aβ*56 claim from the scientific record.',
        source: {
          externalId: 'src:nature-retraction-lesne-2024',
          name: 'Retraction Note: A specific amyloid-β protein assembly in the brain impairs memory. Nature. 2024;631:E12.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/38914864/',
          publishedAt: '2024-06-24',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 11. Aducanumab accelerated approval — approved, coverage-denied, withdrawn ─
  {
    externalId: 'trajectory:aducanumab-aduhelm-accelerated-approval-2021',
    text: 'The U.S. FDA granted accelerated approval to aducanumab (Aduhelm, Biogen) on 7 June 2021 for the treatment of Alzheimer\'s disease, on the basis that the antibody\'s reduction of amyloid-beta plaque was reasonably likely to predict clinical benefit.',
    claimType: 'HYBRID',
    claimEmergedAt: '2021-06-07',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2021-06-07',
        datePrecision: 'DAY',
        reason: 'The FDA approved Biogen\'s aducanumab under the accelerated-approval pathway using amyloid-plaque reduction as a surrogate endpoint, despite its own Peripheral and Central Nervous System Drugs Advisory Committee having voted overwhelmingly against approval in November 2020. It was the first new Alzheimer\'s drug approved since 2003 and the first ever cleared on the amyloid hypothesis, formally entering the regulatory record over substantial expert dissent.',
        source: {
          externalId: 'src:fda-aduhelm-approval-letter-2021',
          name: 'U.S. Food and Drug Administration. Aduhelm (aducanumab-avwa) injection — BLA 761178 approval letter. June 7, 2021.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/appletter/2021/761178Orig1s000ltr.pdf',
          publishedAt: '2021-06-07',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '2022-04-07',
        datePrecision: 'DAY',
        reason: 'CMS finalized a National Coverage Determination restricting Medicare coverage of amyloid-directed antibodies approved under accelerated approval (i.e., Aduhelm) to patients enrolled in qualifying randomized clinical trials. This unprecedented near-total payment restriction signaled that the federal payer did not accept that amyloid reduction had been shown to predict clinical benefit, placing the approval\'s evidentiary basis in open institutional dispute.',
        source: {
          externalId: 'src:cms-amyloid-mab-ncd-2022',
          name: 'Centers for Medicare & Medicaid Services. CMS Finalizes Medicare Coverage Policy for Monoclonal Antibodies Directed Against Amyloid for the Treatment of Alzheimer\'s Disease. April 7, 2022.',
          url: 'https://www.cms.gov/newsroom/press-releases/cms-finalizes-medicare-coverage-policy-monoclonal-antibodies-directed-against-amyloid-treatment',
          publishedAt: '2022-04-07',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'MARKET',
        occurredAt: '2024-01-31',
        datePrecision: 'DAY',
        reason: 'Biogen announced it was discontinuing the development and commercialization of Aduhelm and terminating the confirmatory ENVISION trial. With no completed confirmatory trial verifying clinical benefit and the drug withdrawn from the market, the original approval claim was effectively abandoned — a rare case of an FDA-approved drug being pulled by its own manufacturer amid unresolved efficacy questions.',
        source: {
          externalId: 'src:biogen-aduhelm-discontinuation-2024',
          name: 'CNN Health. Biogen discontinues Alzheimer\'s medication Aduhelm. January 31, 2024.',
          url: 'https://www.cnn.com/2024/01/31/health/aduhelm-alzheimers-biogen/index.html',
          publishedAt: '2024-01-31',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 12. Lecanemab CLARITY AD — first anti-amyloid with confirmed benefit ─────
  {
    externalId: 'trajectory:lecanemab-leqembi-clinical-benefit-2022',
    text: 'Lecanemab (Leqembi, Eisai/Biogen), an anti-amyloid-beta monoclonal antibody, slows cognitive and functional decline in people with early Alzheimer\'s disease, as demonstrated by the phase 3 CLARITY AD trial reported on 29 November 2022.',
    claimType: 'HYBRID',
    claimEmergedAt: '2022-11-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2022-11-29',
        datePrecision: 'DAY',
        reason: 'Van Dyck et al. published the CLARITY AD trial in the New England Journal of Medicine, reporting that lecanemab reduced the rate of decline on the CDR-SB scale by 27% versus placebo over 18 months in 1,795 patients with early Alzheimer\'s — a statistically significant result on the primary endpoint. This was the first large randomized trial to show an anti-amyloid antibody produced a measurable, prespecified clinical benefit, recording the claim in the expert literature.',
        source: {
          externalId: 'src:vandyck-clarity-ad-nejm-2022',
          name: 'van Dyck CH, Swanson CJ, Aisen P, et al. Lecanemab in Early Alzheimer\'s Disease. N Engl J Med. 2023;388(1):9-21.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/36449413/',
          publishedAt: '2023-01-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2023-07-06',
        datePrecision: 'DAY',
        reason: 'The FDA converted lecanemab from accelerated approval (January 2023) to traditional approval after determining that the CLARITY AD confirmatory trial had verified clinical benefit, making it the first amyloid-beta-directed antibody to clear the traditional-approval bar. Institutional ratification of a verified clinical benefit — a contrast to aducanumab — settled the claim that amyloid clearance can translate into slowed clinical decline.',
        source: {
          externalId: 'src:fda-leqembi-traditional-approval-2023',
          name: 'U.S. Food and Drug Administration. FDA Converts Novel Alzheimer\'s Disease Treatment to Traditional Approval. July 6, 2023.',
          url: 'https://www.fda.gov/news-events/press-announcements/fda-converts-novel-alzheimers-disease-treatment-traditional-approval',
          publishedAt: '2023-07-06',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // DRUG DISCOVERY ERA — EARLY 20TH CENTURY (1930s–1940s)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 14. Dinitrophenol (DNP) for obesity — 1933 → reversed 1938 ──────────────
  {
    externalId: 'trajectory:dinitrophenol-obesity-drug-1933',
    text: 'Maurice Tainter and colleagues at Stanford reported in JAMA in November 1933 that 2,4-dinitrophenol, by markedly raising the basal metabolic rate, was a safe and effective treatment for obesity, prompting its widespread sale as a weight-loss drug.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1933-11-04',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1933-11-04',
        datePrecision: 'MONTH',
        reason: 'Tainter, Stockton, and Cutting published \'Use of Dinitrophenol in Obesity and Related Conditions: A Progress Report\' in JAMA, reporting 113 consecutive obesity cases in which DNP raised metabolic rate roughly 11% per 100 mg and produced rapid weight loss \'without important damage to vital organs.\' Following Tainter and Cutting\'s Stanford work earlier that year, this recorded in the expert literature the claim that DNP was a safe, effective anti-obesity agent, and the drug was sold under names such as Alpha-Dinitrophenol and Dinitrenal.',
        source: {
          externalId: 'src:tainter-dnp-jama-progress-1933',
          name: 'Tainter ML, Stockton AB, Cutting WC. Use of Dinitrophenol in Obesity and Related Conditions: A Progress Report. JAMA. 1933;101(19):1472–1475.',
          url: 'https://jamanetwork.com/journals/jama/fullarticle/245872',
          publishedAt: '1933-11-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '1938-01-01',
        datePrecision: 'YEAR',
        reason: 'After thousands of users suffered irreversible harm — rapidly developing cataracts, agranulocytosis, fatal hyperthermia — and multiple deaths, physicians recognized that DNP\'s therapeutic index was untenable, and passage of the Federal Food, Drug, and Cosmetic Act of 1938 gave regulators the authority to halt its distribution as \'extremely dangerous and not fit for human consumption.\' DNP was effectively removed from medical use, reversing the original safety-and-efficacy claim.',
        source: {
          externalId: 'src:colman-dnp-regulatory-dilemma-2007',
          name: 'Colman E. Dinitrophenol and obesity: an early twentieth-century regulatory dilemma. Regul Toxicol Pharmacol. 2007;48(2):115–117.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/17475379/',
          publishedAt: '2007-07-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 15. Diethylstilbestrol (DES) for pregnancy — 1938 → reversed 1971 ───────
  {
    externalId: 'trajectory:diethylstilbestrol-des-pregnancy-1938',
    text: 'Diethylstilbestrol (DES), a cheap orally active synthetic non-steroidal estrogen first reported by E. C. Dodds and colleagues in Nature in February 1938, was claimed to be a safe and effective drug that prevented miscarriage and pregnancy complications when given to pregnant women.',
    claimType: 'HYBRID',
    claimEmergedAt: '1938-02-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1938-02-01',
        datePrecision: 'MONTH',
        reason: 'Dodds, Goldberg, Lawson, and Robinson reported in Nature that diethylstilbestrol possessed potent oestrogenic activity — about three times that of natural estrogen and effective orally — establishing the first inexpensive, unpatented synthetic estrogen. This recorded the claim of a usable synthetic estrogen, which over the following decade was promoted (notably by Smith & Smith) and used to prevent miscarriage in pregnant women.',
        source: {
          externalId: 'src:dodds-des-nature-1938',
          name: 'Dodds EC, Goldberg L, Lawson W, Robinson R. Oestrogenic Activity of Certain Synthetic Compounds. Nature. 1938;141(3562):247–248.',
          url: 'https://www.nature.com/articles/141247b0',
          publishedAt: '1938-02-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1971-04-22',
        datePrecision: 'DAY',
        reason: 'Herbst, Ulfelder, and Poskanzer reported in the New England Journal of Medicine that seven of eight young women with clear-cell adenocarcinoma of the vagina had mothers who took DES during the first trimester of pregnancy — the first evidence of a transplacental carcinogen. The finding overturned the claim that DES was a safe drug in pregnancy, transforming it from therapeutic agent to documented cause of cancer in exposed daughters.',
        source: {
          externalId: 'src:herbst-des-vaginal-cancer-nejm-1971',
          name: 'Herbst AL, Ulfelder H, Poskanzer DC. Adenocarcinoma of the vagina. Association of maternal stilbestrol therapy with tumor appearance in young women. N Engl J Med. 1971;284(15):878–881.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/5549830/',
          publishedAt: '1971-04-22',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'REVERSED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '1971-11-01',
        datePrecision: 'MONTH',
        reason: 'The FDA Drug Bulletin of November 1971, citing the Herbst findings, declared diethylstilbestrol contraindicated in pregnancy and urged physicians to stop prescribing it for pregnant patients. This institutional action formally ratified the reversal of DES\'s pregnancy indication on safety grounds.',
        source: {
          externalId: 'src:fda-des-contraindicated-bulletin-1971',
          name: 'Selected Item from the FDA Drug Bulletin—November 1971: Diethylstilbestrol Contraindicated in Pregnancy. FDA Drug Bulletin. 1971 (reproduced).',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1518220/',
          publishedAt: '1971-11-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 16. Cortisone for rheumatoid arthritis — 1949 → Nobel 1950 ──────────────
  {
    externalId: 'trajectory:cortisone-rheumatoid-arthritis-1949',
    text: 'Philip Hench, Edward Kendall, Charles Slocumb, and Howard Polley reported in 1949 (Proceedings of the Staff Meetings of the Mayo Clinic) that compound E (cortisone), a hormone of the adrenal cortex, produced dramatic remission of rheumatoid arthritis symptoms.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1949-04-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1949-04-01',
        datePrecision: 'MONTH',
        reason: 'Following the first injection of compound E into a rheumatoid arthritis patient (Mrs. G.) at the Mayo Clinic in September 1948, Hench, Kendall, Slocumb, and Polley published their preliminary report in the Proceedings of the Staff Meetings of the Mayo Clinic (1949;24:181–197), describing rapid, dramatic relief of joint inflammation. This recorded in the expert literature the claim that an adrenal-cortex hormone could reverse the symptoms of rheumatoid disease, opening the corticosteroid era.',
        source: {
          externalId: 'src:hench-cortisone-mayo-1949',
          name: 'Hench PS, Kendall EC, Slocumb CH, Polley HF. The effect of a hormone of the adrenal cortex (17-hydroxy-11-dehydrocorticosterone: compound E) and of pituitary adrenocorticotropic hormone on rheumatoid arthritis. Proc Staff Meet Mayo Clin. 1949;24(8):181–197.',
          url: 'https://en.wikipedia.org/wiki/Cortisone',
          publishedAt: '1949-04-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1950-12-10',
        datePrecision: 'DAY',
        reason: 'Hench and Kendall, together with Tadeusz Reichstein, were awarded the 1950 Nobel Prize in Physiology or Medicine for their discoveries relating to the hormones of the adrenal cortex, their structure and biological effects. The award, barely a year after the first clinical report, institutionally ratified cortisone\'s therapeutic significance and settled the claim that adrenal-cortex hormones are active anti-inflammatory agents.',
        source: {
          externalId: 'src:nobel-cortisone-hench-1950',
          name: 'Nobel Prize Committee. The Nobel Prize in Physiology or Medicine 1950 — Hench, Kendall, Reichstein (adrenal cortex hormones).',
          url: 'https://en.wikipedia.org/wiki/Philip_Showalter_Hench',
          publishedAt: '1950-12-10',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 17. Himsworth — two types of diabetes — 1936 → settled 1979 ─────────────
  {
    externalId: 'trajectory:himsworth-diabetes-two-types-1936',
    text: 'Harold Himsworth reported in The Lancet in January 1936 that diabetes mellitus is not a single disease but differentiates into an insulin-sensitive type (caused by insulin deficiency) and an insulin-insensitive type (caused by tissue resistance to insulin), anticipating the modern distinction between type 1 and type 2 diabetes.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1936-01-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1936-01-01',
        datePrecision: 'MONTH',
        reason: 'Himsworth published \'Diabetes Mellitus: Its Differentiation into Insulin-Sensitive and Insulin-Insensitive Types\' in The Lancet, using glucose-plus-insulin tolerance tests to show that some diabetics responded poorly to administered insulin. Decades before insulin could be measured directly, this recorded in the expert literature the claim that diabetes comprises at least two pathophysiologically distinct conditions — effectively the first description of insulin resistance.',
        source: {
          externalId: 'src:himsworth-diabetes-types-lancet-1936',
          name: 'Himsworth HP. Diabetes mellitus: its differentiation into insulin-sensitive and insulin-insensitive types. Lancet. 1936;227(5864):127–130. (Reprinted Int J Epidemiol. 2013;42(6):1594–1598.)',
          url: 'https://pubmed.ncbi.nlm.nih.gov/24415598/',
          publishedAt: '1936-01-18',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1979-12-01',
        datePrecision: 'MONTH',
        reason: 'The National Diabetes Data Group published \'Classification and Diagnosis of Diabetes Mellitus and Other Categories of Glucose Intolerance\' in Diabetes, formally codifying the two major forms as insulin-dependent (IDDM) and non-insulin-dependent (NIDDM) diabetes — the standard later endorsed by the ADA, British Diabetic Association, and WHO. This institutional classification settled, as the official framework of diabetology, the two-type distinction Himsworth had proposed in 1936.',
        source: {
          externalId: 'src:nddg-diabetes-classification-1979',
          name: 'National Diabetes Data Group. Classification and Diagnosis of Diabetes Mellitus and Other Categories of Glucose Intolerance. Diabetes. 1979;28(12):1039–1057.',
          url: 'https://diabetesjournals.org/diabetes/article/28/12/1039/5951/Classification-and-Diagnosis-of-Diabetes-Mellitus',
          publishedAt: '1979-12-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // OPIOID CRISIS ERA (1980–2022)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 18. Porter-Jick NEJM letter — addiction rare in hospitalized patients 1980 ─
  {
    externalId: 'trajectory:porter-jick-opioid-addiction-rare-1980',
    text: 'Jane Porter and Hershel Jick reported in a five-sentence letter to the New England Journal of Medicine on January 10, 1980, that among 11,882 hospitalized patients given at least one narcotic, only four cases of addiction occurred, concluding that addiction is rare in medical patients treated with narcotics.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1980-01-10',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1980-01-10',
        datePrecision: 'DAY',
        reason: 'Porter and Jick published a brief letter in NEJM reporting that of 11,882 hospitalized patients receiving narcotics, only four became addicted. The observation was a narrow finding about supervised inpatient administration, but it entered the record as a citable datum on opioid addiction risk.',
        source: {
          externalId: 'src:porter-jick-nejm-1980',
          name: 'Porter J, Jick H. Addiction rare in patients treated with narcotics. N Engl J Med. 1980 Jan 10;302(2):123.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/7350425/',
          publishedAt: '1980-01-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-06-01',
        datePrecision: 'DAY',
        reason: 'Leung and colleagues published a bibliometric analysis in NEJM showing the 1980 letter had been cited 608 times, with 72.2% citing it as evidence that addiction is rare during opioid treatment and 80.8% omitting that it described only hospitalized patients. The analysis established that the letter had been systematically miscited to justify outpatient opioid prescribing, reversing the generalized claim it had been made to support.',
        source: {
          externalId: 'src:leung-1980-letter-nejm-2017',
          name: 'Leung PTM, Macdonald EM, Stanbrook MB, Dhalla IA, Juurlink DN. A 1980 Letter on the Risk of Opioid Addiction. N Engl J Med. 2017 Jun 1;376(22):2194-2195.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/28564561/',
          publishedAt: '2017-06-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 19. OxyContin reduced abuse liability — FDA approval 1995 → reversed 2013 ─
  {
    externalId: 'trajectory:oxycontin-reduced-abuse-liability-1995',
    text: 'The FDA approved Purdue Pharma\'s OxyContin (controlled-release oxycodone, NDA 20-553) on December 12, 1995, with labeling stating that the delayed absorption afforded by the controlled-release formulation was believed to reduce the abuse liability of the drug.',
    claimType: 'HYBRID',
    claimEmergedAt: '1995-12-12',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1995-12-12',
        datePrecision: 'DAY',
        reason: 'The FDA\'s Center for Drug Evaluation and Research approved NDA 20-553 for OxyContin and permitted label language asserting that the controlled-release formulation\'s delayed absorption was believed to reduce abuse liability. The claim was institutionally ratified without clinical studies designed to test abuse potential, becoming a settled marketing premise.',
        source: {
          externalId: 'src:fda-oxycontin-nda-20553-1995',
          name: 'FDA. NDA 20-553, OxyContin (oxycodone HCl controlled-release), Center for Drug Evaluation and Research application materials.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/nda/96/020553s002.pdf',
          publishedAt: '1995-12-12',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '2001-07-25',
        datePrecision: 'MONTH',
        reason: 'Amid mounting reports of OxyContin abuse, diversion, and overdose deaths, the FDA required Purdue to add a boxed warning and strengthen the labeling in July 2001, the agency\'s first major corrective action. The reduced-abuse-liability premise was now formally in question.',
        source: {
          externalId: 'src:fda-oxycontin-labeling-supplement-2002',
          name: 'FDA. NDA 20-553/S-024, OxyContin approved labeling supplement (boxed warning).',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/nda/2002/020553_S024_OXYCONTIN_AP.pdf',
          publishedAt: '2002-01-22',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'CONTESTED',
        community: 'JUDICIAL',
        occurredAt: '2007-05-10',
        datePrecision: 'DAY',
        reason: 'Purdue Frederick Company pleaded guilty in the U.S. District Court for the Western District of Virginia to felony misbranding of OxyContin, and three executives pleaded guilty to misdemeanor misbranding, paying $634.5 million. Purdue admitted it had fraudulently marketed OxyContin as less addictive and less subject to abuse with no supporting research, a judicial finding that the original abuse-liability claim was false.',
        source: {
          externalId: 'src:usao-wdva-purdue-plea-2007',
          name: 'U.S. Attorney\'s Office, Western District of Virginia. The Purdue Frederick Company Inc. and Top Executives Plead Guilty to Misbranding OxyContin. News release, May 10, 2007.',
          url: 'https://media.defense.gov/2007/May/10/2001711223/-1/-1/1/purduefrederick1.pdf',
          publishedAt: '2007-05-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2013-04-18',
        datePrecision: 'DAY',
        reason: 'The FDA published a determination that the original OXYCONTIN products covered by NDA 20-553 were withdrawn from sale for reasons of safety or effectiveness, after Purdue conceded that no labeling or REMS could create a positive risk/benefit ratio for the original formulation. The premise that the controlled-release design reduced abuse liability was institutionally repudiated.',
        source: {
          externalId: 'src:fda-fr-oxycontin-withdrawn-2013',
          name: 'FDA. Determination That the OXYCONTIN (Oxycodone Hydrochloride) Drug Products Covered by NDA 20-553 Were Withdrawn From Sale for Reasons of Safety or Effectiveness. Fed. Reg. 78(75):23273, Apr. 18, 2013.',
          url: 'https://www.federalregister.gov/documents/2013/04/18/2013-09092/determination-that-the-oxycontin-oxycodone-hydrochloride-drug-products-covered-by-new-drug',
          publishedAt: '2013-04-18',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 20. CDC 2016 opioid prescribing guideline — settled, then contested 2022 ──
  {
    externalId: 'trajectory:cdc-opioid-prescribing-guideline-2016',
    text: 'The CDC issued its Guideline for Prescribing Opioids for Chronic Pain on March 18, 2016, recommending nonopioid therapy as first-line for chronic pain and establishing dosage thresholds (caution above 50 morphine-milligram-equivalents/day, avoidance of 90 MME/day) for primary care prescribers.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2016-03-18',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2016-03-18',
        datePrecision: 'DAY',
        reason: 'The CDC published its Guideline for Prescribing Opioids for Chronic Pain in MMWR Recommendations and Reports, recommending nonopioid first-line therapy, immediate-release over long-acting opioids, and specific MME dosage thresholds. The guideline became the dominant institutional standard, rapidly adopted by states, payers, and pharmacies.',
        source: {
          externalId: 'src:cdc-opioid-guideline-mmwr-2016',
          name: 'Dowell D, Haegerich TM, Chou R. CDC Guideline for Prescribing Opioids for Chronic Pain — United States, 2016. MMWR Recomm Rep. 2016;65(1):1-49.',
          url: 'https://www.cdc.gov/mmwr/volumes/65/rr/rr6501e1.htm',
          publishedAt: '2016-03-18',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '2022-11-03',
        datePrecision: 'DAY',
        reason: 'The CDC published a revised 2022 Clinical Practice Guideline that superseded the 2016 guideline, removing the rigid MME dosage thresholds and duration limits after evidence that they had been widely misapplied — producing abrupt tapering, untreated pain, and patient harm. The specific numeric prescribing thresholds of the 2016 guideline were walked back rather than reaffirmed.',
        source: {
          externalId: 'src:cdc-opioid-guideline-mmwr-2022',
          name: 'Dowell D, Ragan KR, Jones CM, Baldwin GT, Chou R. CDC Clinical Practice Guideline for Prescribing Opioids for Pain — United States, 2022. MMWR Recomm Rep. 2022;71(3):1-95.',
          url: 'https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm',
          publishedAt: '2022-11-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 21. DEA hydrocodone rescheduling — Schedule III → Schedule II 2014 ────────
  {
    externalId: 'trajectory:dea-hydrocodone-schedule-ii-2014',
    text: 'The DEA published a final rule on August 22, 2014, rescheduling hydrocodone combination products from Schedule III to Schedule II of the Controlled Substances Act, effective October 6, 2014, on the determination that they have a high potential for abuse that may lead to severe psychological or physical dependence.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2014-08-22',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2014-08-22',
        datePrecision: 'DAY',
        reason: 'Following an HHS scientific and medical evaluation concluding that adding nonnarcotic substances like acetaminophen does not diminish hydrocodone\'s abuse potential, the DEA published a final rule moving hydrocodone combination products from Schedule III to the more restrictive Schedule II, effective October 6, 2014. The reclassification formally upgraded the abuse-and-dependence assessment of the most-prescribed opioid class in the United States.',
        source: {
          externalId: 'src:dea-fr-hydrocodone-rescheduling-2014',
          name: 'DEA. Schedules of Controlled Substances: Rescheduling of Hydrocodone Combination Products From Schedule III to Schedule II. Final rule. Fed. Reg. 79(163):49661, Aug. 22, 2014.',
          url: 'https://www.federalregister.gov/documents/2014/08/22/2014-19922/schedules-of-controlled-substances-rescheduling-of-hydrocodone-combination-products-from-schedule',
          publishedAt: '2014-08-22',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CARDIOVASCULAR EVIDENCE ERA (1967–1994)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 22. VA Hypertension Trial — first RCT proving BP treatment prevents harm ──
  {
    externalId: 'trajectory:va-hypertension-treatment-benefit-1967',
    text: 'In 1967 the Veterans Administration Cooperative Study Group on Antihypertensive Agents reported that drug treatment of severe hypertension (diastolic 115–129 mm Hg) sharply reduced morbid cardiovascular events, the first randomized proof that lowering blood pressure prevents harm.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1967-12-11',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1967-12-11',
        datePrecision: 'DAY',
        reason: 'The VA Cooperative Study Group published the first randomized controlled trial showing that antihypertensive drug therapy in men with severe diastolic hypertension (115–129 mm Hg) markedly reduced strokes, heart failure, and death versus placebo — so decisively that the severe-hypertension arm was halted early. This put the claim that treating high blood pressure prevents cardiovascular events on the scientific record for the first time.',
        source: {
          externalId: 'src:va-coop-hypertension-severe-jama-1967',
          name: 'Veterans Administration Cooperative Study Group on Antihypertensive Agents. Effects of treatment on morbidity in hypertension. Results in patients with diastolic blood pressures averaging 115 through 129 mm Hg. JAMA. 1967;202(11):1028-1034.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/4862069/',
          publishedAt: '1967-12-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1970-08-17',
        datePrecision: 'DAY',
        reason: 'The VA Cooperative Study Group\'s second report extended the benefit to the far larger population with moderate hypertension (diastolic 90–114 mm Hg), showing treatment roughly halved morbid events, with the largest effect on stroke. This generalized the treatment benefit from rare severe cases to common moderate hypertension, settling antihypertensive therapy as standard preventive care and launching routine blood-pressure screening.',
        source: {
          externalId: 'src:va-coop-hypertension-moderate-jama-1970',
          name: 'Veterans Administration Cooperative Study Group on Antihypertensive Agents. Effects of treatment on morbidity in hypertension. II. Results in patients with diastolic blood pressure averaging 90 through 114 mm Hg. JAMA. 1970;213(7):1143-1152.',
          url: 'https://jamanetwork.com/journals/jama/fullarticle/356138',
          publishedAt: '1970-08-17',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 23. BHAT propranolol post-MI — beta-blocker mortality benefit 1982 ────────
  {
    externalId: 'trajectory:bhat-propranolol-post-mi-1982',
    text: 'On 26 March 1982 the Beta-Blocker Heart Attack Trial (BHAT) reported that propranolol given to survivors of acute myocardial infarction reduced total mortality (7.2% vs 9.8% on placebo), establishing beta-blockade as standard secondary prevention after heart attack.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1982-03-26',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1982-03-26',
        datePrecision: 'DAY',
        reason: 'The NHLBI-sponsored multicenter, randomized, double-blind, placebo-controlled BHAT was stopped early when propranolol was found to significantly lower total mortality, cardiovascular mortality, and sudden cardiac death in post-infarction patients over an average 24-month follow-up. The result converted long-term beta-blockade after MI into evidence-based standard therapy, a status it retains.',
        source: {
          externalId: 'src:bhat-propranolol-jama-1982',
          name: 'Beta-Blocker Heart Attack Trial Research Group. A randomized trial of propranolol in patients with acute myocardial infarction. I. Mortality results. JAMA. 1982;247(12):1707-1714.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/7038157/',
          publishedAt: '1982-03-26',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 24. ISIS-2 aspirin in acute MI — settled 1988 ────────────────────────────
  {
    externalId: 'trajectory:isis2-aspirin-acute-mi-1988',
    text: 'On 13 August 1988 the ISIS-2 trial reported that oral aspirin given during suspected acute myocardial infarction reduced vascular mortality by about 23% alone and 42% combined with streptokinase, establishing aspirin as standard acute treatment for heart attack.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1988-08-13',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1988-08-13',
        datePrecision: 'DAY',
        reason: 'The ISIS-2 Collaborative Group\'s randomized trial in 17,187 patients showed that one month of low-dose aspirin during suspected acute MI produced a highly significant reduction in vascular death, additive to streptokinase, with a combined 42% odds reduction. The large, unambiguous result immediately settled aspirin as a standard, inexpensive component of acute MI care worldwide.',
        source: {
          externalId: 'src:isis2-aspirin-streptokinase-lancet-1988',
          name: 'ISIS-2 (Second International Study of Infarct Survival) Collaborative Group. Randomised trial of intravenous streptokinase, oral aspirin, both, or neither among 17,187 cases of suspected acute myocardial infarction: ISIS-2. Lancet. 1988;2(8607):349-360.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2899772/',
          publishedAt: '1988-08-13',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 25. CAST antiarrhythmic reversal — surrogate endpoint lethal 1989 ─────────
  {
    externalId: 'trajectory:cast-antiarrhythmic-suppression-reversal-1989',
    text: 'The accepted hypothesis that suppressing asymptomatic ventricular ectopy after myocardial infarction with class IC antiarrhythmic drugs (encainide, flecainide) would reduce sudden death was overturned on 10 August 1989 when the CAST trial found these drugs more than doubled mortality versus placebo.',
    claimType: 'HYBRID',
    claimEmergedAt: '1985-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1989-08-10',
        datePrecision: 'DAY',
        reason: 'By the mid-1980s, suppressing post-MI ventricular premature beats with class IC antiarrhythmics (encainide, flecainide) was widely practiced on the well-accepted theory that fewer ectopic beats would mean fewer fatal arrhythmias. The CAST preliminary report found total mortality of 7.7% on active drug versus 3.0% on placebo (relative risk 2.5), forcing early termination of those arms and reversing the suppression hypothesis — a landmark demonstration that a plausible surrogate-endpoint rationale can be lethal.',
        source: {
          externalId: 'src:cast-encainide-flecainide-nejm-1989',
          name: 'Cardiac Arrhythmia Suppression Trial (CAST) Investigators. Preliminary report: effect of encainide and flecainide on mortality in a randomized trial of arrhythmia suppression after myocardial infarction. N Engl J Med. 1989;321(6):406-412.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2473403/',
          publishedAt: '1989-08-10',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 26. Lovastatin / 4S — first statin approval → survival benefit 1994 ───────
  {
    externalId: 'trajectory:lovastatin-first-statin-approval-1987',
    text: 'On 31 August 1987 the U.S. FDA approved lovastatin (Mevacor, Merck, NDA 19-643), the first HMG-CoA reductase inhibitor (statin), establishing that this drug class safely and effectively lowers blood cholesterol.',
    claimType: 'HYBRID',
    claimEmergedAt: '1987-08-31',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1987-08-31',
        datePrecision: 'DAY',
        reason: 'The FDA approved lovastatin as the first statin, accepting trial evidence that HMG-CoA reductase inhibition lowers LDL cholesterol. This established the drug class as a safe, effective lipid-lowering therapy on the regulatory record, but a hard-outcome benefit (reduced mortality) had not yet been demonstrated in a randomized endpoint trial.',
        source: {
          externalId: 'src:fda-mevacor-lovastatin-approval-1987',
          name: 'FDA. Determination That MEVACOR (Lovastatin) Tablets, 20 mg and 40 mg, Were Not Withdrawn From Sale for Reasons of Safety or Effectiveness (documenting original approval under NDA 19-643 on 31 Aug 1987). Federal Register, 21 Jan 2016.',
          url: 'https://www.federalregister.gov/documents/2016/01/21/2016-01096/determination-that-mevacor-lovastatin-tablets-20-milligrams-and-40-milligrams-were-not-withdrawn',
          publishedAt: '2016-01-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1994-11-19',
        datePrecision: 'DAY',
        reason: 'The Scandinavian Simvastatin Survival Study (4S), a randomized placebo-controlled trial in 4,444 coronary heart disease patients, reported a 30% relative reduction in all-cause mortality (relative risk 0.70, 95% CI 0.58–0.85, p=0.0003) with a statin. This converted the statin class from a cholesterol-lowering agent of presumed benefit into a therapy with proven survival benefit, settling statins as standard secondary-prevention treatment.',
        source: {
          externalId: 'src:4s-simvastatin-lancet-1994',
          name: 'Scandinavian Simvastatin Survival Study Group. Randomised trial of cholesterol lowering in 4444 patients with coronary heart disease: the Scandinavian Simvastatin Survival Study (4S). Lancet. 1994;344(8934):1383-1389.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/7968073/',
          publishedAt: '1994-11-19',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // VACCINE REVERSAL & ANTIMICROBIAL RESISTANCE ERA (2000–2012)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 27. LYMErix Lyme vaccine withdrawal — 2002 ──────────────────────────────
  {
    externalId: 'trajectory:lymerix-lyme-vaccine-2002',
    text: "GlaxoSmithKline's LYMErix, the first FDA-approved human Lyme disease vaccine (recombinant OspA, ~76% efficacy), was voluntarily withdrawn from the U.S. market in February 2002 amid unproven safety fears and declining sales despite no established causal harm.",
    claimType: 'HYBRID',
    claimEmergedAt: '1998-07-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1998-07-23',
        datePrecision: 'DAY',
        reason: 'Steere et al. published a 10,936-subject randomized trial in the NEJM showing the recombinant OspA Lyme vaccine prevented roughly 76% of definite Lyme disease cases after three doses. This established the efficacy of the first human Lyme vaccine, which the FDA approved on 21 December 1998.',
        source: {
          externalId: 'src:steere-ospa-lyme-vaccine-nejm-1998',
          name: 'Steere AC, Sikand VK, Meurice F, et al. Vaccination against Lyme disease with recombinant Borrelia burgdorferi outer-surface lipoprotein A with adjuvant. N Engl J Med. 1998;339(4):209-215.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9673298/',
          publishedAt: '1998-07-23',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'PUBLIC',
        occurredAt: '2001-01-31',
        datePrecision: 'MONTH',
        reason: 'Reports of arthritis and autoimmune adverse events, a hypothesized OspA molecular-mimicry mechanism, class-action litigation, and intense media coverage drove an FDA VRBPAC review in early 2001. Public confidence in the vaccine\'s safety collapsed even though regulators found no confirmed causal link.',
        source: {
          externalId: 'src:nigrovic-lyme-vaccine-cautionary-tale-2007',
          name: 'Nigrovic LE, Thompson KM. The Lyme vaccine: a cautionary tale. Epidemiol Infect. 2007;135(1):1-8.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16893489/',
          publishedAt: '2007-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'MARKET',
        occurredAt: '2002-02-26',
        datePrecision: 'MONTH',
        reason: 'GlaxoSmithKline voluntarily withdrew LYMErix in February 2002, about three years after approval, citing declining sales amid fears of side effects. A safe and effective vaccine was removed from the market by litigation and risk-communication failure rather than by scientific refutation — a widely cited cautionary tale.',
        source: {
          externalId: 'src:nigrovic-lyme-vaccine-withdrawal-2007',
          name: 'Nigrovic LE, Thompson KM. The Lyme vaccine: a cautionary tale. Epidemiol Infect. 2007;135(1):1-8.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16893489/',
          publishedAt: '2007-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 28. Step Study Merck Ad5 HIV vaccine failure — 2007 ─────────────────────
  {
    externalId: 'trajectory:step-merck-ad5-hiv-vaccine-failure-2007',
    text: "Merck's MRKAd5 HIV-1 gag/pol/nef T-cell vaccine — the leading cell-mediated-immunity HIV vaccine candidate, tested in the Step Study — failed to prevent infection or reduce viral load and was associated with increased HIV acquisition in some men, prompting the data monitoring board to halt immunizations on 21 September 2007.",
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2007-09-21',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2007-09-21',
        datePrecision: 'DAY',
        reason: "After a planned interim analysis showed futility, the Step Study's Data and Safety Monitoring Board recommended halting vaccinations on 21 September 2007. The result put on record that the field's leading T-cell-based HIV vaccine concept had failed and might even raise infection risk.",
        source: {
          externalId: 'src:buchbinder-step-study-lancet-2008',
          name: 'Buchbinder SP, Mehrotra DV, Duerr A, et al. Efficacy assessment of a cell-mediated immunity HIV-1 vaccine (the Step Study): a double-blind, randomised, placebo-controlled, test-of-concept trial. Lancet. 2008;372(9653):1881-1893.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/19012954/',
          publishedAt: '2008-11-29',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2008-11-29',
        datePrecision: 'DAY',
        reason: 'Buchbinder et al. published the full Step Study results in the Lancet, confirming the vaccine neither prevented HIV-1 infection nor lowered viral load, and showed increased acquisition among Ad5-seropositive and uncircumcised men. The cell-mediated-immunity vaccine paradigm was abandoned, redirecting HIV vaccine research toward antibody-based approaches.',
        source: {
          externalId: 'src:buchbinder-step-study-results-lancet-2008',
          name: 'Buchbinder SP, Mehrotra DV, Duerr A, et al. Efficacy assessment of a cell-mediated immunity HIV-1 vaccine (the Step Study). Lancet. 2008;372(9653):1881-1893.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/19012954/',
          publishedAt: '2008-11-29',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 29. Artemisinin resistance in P. falciparum — 2009 ───────────────────────
  {
    externalId: 'trajectory:artemisinin-resistance-falciparum-2009',
    text: 'Plasmodium falciparum malaria in western Cambodia showed reduced in vivo susceptibility to artemisinins (markedly delayed parasite clearance), the first clinical evidence of emerging artemisinin resistance, reported by Dondorp et al. in the NEJM on 30 July 2009.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2009-07-30',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2009-07-30',
        datePrecision: 'DAY',
        reason: 'Dondorp et al. documented a median parasite clearance time of 84 hours in Pailin, western Cambodia, versus 48 hours in northwestern Thailand, demonstrating that the frontline antimalarial class was losing potency. This recorded the first robust clinical signal of artemisinin resistance in the parasite responsible for most malaria deaths.',
        source: {
          externalId: 'src:dondorp-artemisinin-resistance-nejm-2009',
          name: 'Dondorp AM, Nosten F, Yi P, et al. Artemisinin resistance in Plasmodium falciparum malaria. N Engl J Med. 2009;361(5):455-467.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/19641202/',
          publishedAt: '2009-07-30',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2014-01-02',
        datePrecision: 'DAY',
        reason: 'Ariey et al. identified mutations in the kelch13 (K13-propeller) gene as a molecular marker of artemisinin resistance, with mutant alleles clustering in resistant Cambodian provinces. This pinned the mechanism, enabled global genomic surveillance, and settled artemisinin resistance as an established, spreading phenomenon rather than a regional anomaly.',
        source: {
          externalId: 'src:ariey-k13-artemisinin-marker-nature-2014',
          name: 'Ariey F, Witkowski B, Amaratunga C, et al. A molecular marker of artemisinin-resistant Plasmodium falciparum malaria. Nature. 2014;505(7481):50-55.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/24352242/',
          publishedAt: '2014-01-02',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 30. NDM-1 carbapenem resistance emergence — 2009 ─────────────────────────
  {
    externalId: 'trajectory:ndm-1-carbapenem-resistance-emergence-2009',
    text: 'A novel carbapenem-resistance gene, blaNDM-1 (New Delhi metallo-β-lactamase), conferring near-pan-resistance in Enterobacteriaceae, was first characterized by Yong et al. in 2009 and shown by Kumarasamy et al. in 2010 to be spreading internationally from the Indian subcontinent.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2009-12-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2009-12-01',
        datePrecision: 'MONTH',
        reason: 'Yong et al. characterized the new metallo-β-lactamase gene blaNDM-1 in a Klebsiella pneumoniae ST14 isolate from a Swedish patient who had acquired a urinary infection in New Delhi. This recorded the first description of a resistance mechanism that disabled carbapenems, the last-line β-lactams.',
        source: {
          externalId: 'src:yong-ndm-1-characterization-aac-2009',
          name: 'Yong D, Toleman MA, Giske CG, et al. Characterization of a new metallo-beta-lactamase gene, bla(NDM-1)... in Klebsiella pneumoniae sequence type 14 from India. Antimicrob Agents Chemother. 2009;53(12):5046-5054.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/19770275/',
          publishedAt: '2009-12-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2010-08-11',
        datePrecision: 'DAY',
        reason: 'Kumarasamy et al. reported 180 NDM-1-positive isolates across Chennai, Haryana, and the UK — resistant to all antibiotics except tigecycline and colistin — and warned NDM-1 had great potential to become a worldwide public health problem. The multinational epidemiology settled NDM-1 as an established, globally spreading resistance threat and triggered international surveillance.',
        source: {
          externalId: 'src:kumarasamy-ndm-1-emergence-lancet-id-2010',
          name: 'Kumarasamy KK, Toleman MA, Walsh TR, et al. Emergence of a new antibiotic resistance mechanism in India, Pakistan, and the UK: a molecular, biological, and epidemiological study. Lancet Infect Dis. 2010;10(9):597-602.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/20705517/',
          publishedAt: '2010-08-11',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 31. Pandemrix H1N1 vaccine narcolepsy association — 2010 ─────────────────
  {
    externalId: 'trajectory:pandemrix-h1n1-vaccine-narcolepsy-2010',
    text: 'The AS03-adjuvanted 2009 pandemic influenza A(H1N1) vaccine Pandemrix was found to be associated with a sharp increase in childhood narcolepsy — a safety signal raised in Finland and Sweden in August 2010 and confirmed by Nohynek et al. in 2012.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2010-08-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2010-08-27',
        datePrecision: 'DAY',
        reason: "After clusters of new childhood narcolepsy cases in Finland and Sweden, Finland's National Institute for Health and Welfare (THL) recommended suspending Pandemrix, and on 27 August 2010 the European Medicines Agency initiated an Article 20 review of a possible Pandemrix–narcolepsy link. The post-marketing safety signal was formally recorded.",
        source: {
          externalId: 'src:ema-pandemrix-narcolepsy-review-2010',
          name: 'European Medicines Agency. European Medicines Agency reviews further data on narcolepsy and possible association with Pandemrix (review initiated 27 August 2010). 2011.',
          url: 'https://www.ema.europa.eu/en/news/european-medicines-agency-reviews-further-data-narcolepsy-possible-association-pandemrix',
          publishedAt: '2011-02-18',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2012-03-28',
        datePrecision: 'DAY',
        reason: 'Nohynek et al. published a retrospective cohort of all Finnish children showing an abrupt rise in narcolepsy incidence among 4–19-year-olds vaccinated with Pandemrix (roughly a 12-fold increased risk), with no increase in other age groups. The epidemiological association became widely accepted, later attributed to an autoimmune molecular-mimicry mechanism, and Pandemrix use was restricted.',
        source: {
          externalId: 'src:nohynek-pandemrix-narcolepsy-plosone-2012',
          name: 'Nohynek H, Jokinen J, Partinen M, et al. AS03 adjuvanted AH1N1 vaccine associated with an abrupt increase in the incidence of childhood narcolepsy in Finland. PLoS One. 2012;7(3):e33536.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/22470453/',
          publishedAt: '2012-03-28',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // MODERN DRUG APPROVALS ERA (2014–2024)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 32. Donanemab (Kisunla) Alzheimer's approval — 2023–2024 ─────────────────
  {
    externalId: 'trajectory:donanemab-kisunla-alzheimers-approval-2024',
    text: "Eli Lilly's donanemab (Kisunla), an anti-amyloid-beta monoclonal antibody, slows clinical decline in early symptomatic Alzheimer's disease, as demonstrated by the phase 3 TRAILBLAZER-ALZ 2 trial reported on 17 July 2023 and ratified by FDA traditional approval on 2 July 2024.",
    claimType: 'HYBRID',
    claimEmergedAt: '2023-07-17',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2023-07-17',
        datePrecision: 'DAY',
        reason: 'Sims et al. published the TRAILBLAZER-ALZ 2 trial in JAMA, reporting that donanemab significantly slowed clinical progression (iADRS change -6.02 vs -9.27 for placebo at 76 weeks) in patients with low/medium tau and in the combined population. It was the second anti-amyloid antibody after lecanemab to show a prespecified clinical benefit in a large randomized trial, recording the claim in the expert literature against the backdrop of the contested amyloid hypothesis.',
        source: {
          externalId: 'src:sims-trailblazer-alz2-jama-2023',
          name: 'Sims JR, Zimmer JA, Evans CD, et al. Donanemab in Early Symptomatic Alzheimer Disease: The TRAILBLAZER-ALZ 2 Randomized Clinical Trial. JAMA. 2023;330(6):512-527.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/37459141/',
          publishedAt: '2023-07-17',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2024-07-02',
        datePrecision: 'DAY',
        reason: 'The FDA granted traditional (not accelerated) approval to donanemab for adults with early symptomatic Alzheimer\'s disease, including mild cognitive impairment or mild dementia. It became the second traditional Alzheimer\'s approval after lecanemab, institutionally ratifying that amyloid clearance with donanemab translates into measurable clinical benefit, while attaching ARIA monitoring requirements.',
        source: {
          externalId: 'src:fda-kisunla-donanemab-approval-2024',
          name: 'U.S. Food and Drug Administration. FDA Approves Treatment for Adults with Alzheimer\'s Disease (Kisunla, donanemab-azbt). July 2, 2024.',
          url: 'https://www.fda.gov/drugs/news-events-human-drugs/fda-approves-treatment-adults-alzheimers-disease',
          publishedAt: '2024-07-02',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 33. Paroxetine Study 329 adolescent depression — 2001 → reversed 2015 ────
  {
    externalId: 'trajectory:paroxetine-study-329-adolescent-depression-2001',
    text: 'Keller and colleagues reported in July 2001 (JAACAP), on the basis of SmithKline Beecham\'s Study 329, that paroxetine is generally well tolerated and effective for major depression in adolescents.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2001-07-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2001-07-01',
        datePrecision: 'MONTH',
        reason: 'Keller et al. published the SmithKline Beecham Study 329 in the Journal of the American Academy of Child & Adolescent Psychiatry, concluding paroxetine was \'generally well tolerated and effective for major depression in adolescents.\' The paper became a widely cited basis for off-label prescribing of paroxetine to minors, recording the efficacy-and-safety claim in the expert literature.',
        source: {
          externalId: 'src:keller-study329-jaacap-2001',
          name: 'Keller MB, Ryan ND, Strober M, et al. Efficacy of paroxetine in the treatment of adolescent major depression: a randomized, controlled trial. J Am Acad Child Adolesc Psychiatry. 2001;40(7):762-772.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11437014/',
          publishedAt: '2001-07-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'JUDICIAL',
        occurredAt: '2012-07-02',
        datePrecision: 'DAY',
        reason: 'The U.S. Department of Justice announced that GlaxoSmithKline would plead guilty and pay $3 billion, partly for unlawfully promoting Paxil (paroxetine) for depression in patients under 18 from 1998 to 2003 despite no pediatric approval, including by circulating company-funded studies touting its benefits. The largest health-care fraud settlement in U.S. history put the original efficacy claim and the conduct behind Study 329 into formal legal dispute.',
        source: {
          externalId: 'src:doj-gsk-3billion-paxil-2012',
          name: 'U.S. Department of Justice. GlaxoSmithKline to Plead Guilty and Pay $3 Billion to Resolve Fraud Allegations and Failure to Report Safety Data. July 2, 2012.',
          url: 'https://www.justice.gov/archives/opa/pr/glaxosmithkline-plead-guilty-and-pay-3-billion-resolve-fraud-allegations-and-failure-report',
          publishedAt: '2012-07-02',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2015-09-16',
        datePrecision: 'DAY',
        reason: 'Le Noury et al. published an independent reanalysis of the full Study 329 dataset in The BMJ under the RIAT (Restoring Invisible and Abandoned Trials) initiative, concluding that paroxetine and imipramine showed a lack of efficacy and serious harms in adolescents, directly contradicting the 2001 conclusion. The reanalysis became a landmark demonstration that access to raw trial data can reverse a published claim, overturning the original finding in the expert literature.',
        source: {
          externalId: 'src:lenoury-restoring-study329-bmj-2015',
          name: 'Le Noury J, Nardo JM, Healy D, et al. Restoring Study 329: efficacy and harms of paroxetine and imipramine in treatment of major depression in adolescence. BMJ. 2015;351:h4320.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/26376805/',
          publishedAt: '2015-09-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 34. Brexanolone (Zulresso) for postpartum depression — 2018–2019 ─────────
  {
    externalId: 'trajectory:brexanolone-zulresso-postpartum-depression-2019',
    text: 'Brexanolone (Zulresso, Sage Therapeutics), an intravenous neuroactive-steroid GABA-A modulator identical to endogenous allopregnanolone, is an effective treatment for postpartum depression, as shown in phase 3 trials reported on 22 September 2018 and approved by the FDA on 19 March 2019 as the first drug indicated specifically for postpartum depression.',
    claimType: 'HYBRID',
    claimEmergedAt: '2018-09-22',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-09-22',
        datePrecision: 'DAY',
        reason: 'Meltzer-Brody et al. published two phase 3 randomized, placebo-controlled trials in The Lancet showing brexanolone produced significant, rapid reductions in HAM-D depression scores within 60 hours in women with postpartum depression. The results recorded the claim that a neuroactive-steroid GABA-A modulator could rapidly treat postpartum depression, a mechanism distinct from monoamine antidepressants.',
        source: {
          externalId: 'src:meltzerbrody-brexanolone-lancet-2018',
          name: 'Meltzer-Brody S, Colquhoun H, Riesenberg R, et al. Brexanolone injection in post-partum depression: two multicentre, double-blind, randomised, placebo-controlled, phase 3 trials. Lancet. 2018;392(10152):1058-1070.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/30177236/',
          publishedAt: '2018-09-22',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2019-03-19',
        datePrecision: 'DAY',
        reason: 'The FDA approved brexanolone (NDA 211371, Sage Therapeutics) as the first treatment ever approved specifically for postpartum depression, administered as a single 60-hour IV infusion and restricted under a REMS owing to sedation and loss-of-consciousness risk. The approval institutionally established postpartum depression as a distinct, separately treatable indication and validated the allopregnanolone/GABA-A mechanism.',
        source: {
          externalId: 'src:fda-zulresso-brexanolone-approval-2019',
          name: 'U.S. Food and Drug Administration. Approval Package for Zulresso (brexanolone) injection, NDA 211371. March 19, 2019.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/nda/2019/211371Orig1s000Approv.pdf',
          publishedAt: '2019-03-19',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 35. Pimavanserin (Nuplazid) for Parkinson's disease psychosis — 2014–2018 ─
  {
    externalId: 'trajectory:pimavanserin-nuplazid-parkinsons-psychosis-2016',
    text: 'Pimavanserin (Nuplazid, Acadia), a selective 5-HT2A inverse agonist with no dopamine-receptor blockade, is an effective and safe treatment for hallucinations and delusions of Parkinson\'s disease psychosis, as shown in a phase 3 trial reported on 8 February 2014 and approved by the FDA on 29 April 2016 as the first drug for that indication.',
    claimType: 'HYBRID',
    claimEmergedAt: '2014-02-08',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2014-02-08',
        datePrecision: 'DAY',
        reason: 'Cummings et al. published a phase 3 randomized placebo-controlled trial in The Lancet showing pimavanserin significantly reduced psychotic symptoms (SAPS-PD change -5.79 vs -2.73 for placebo) in Parkinson\'s disease psychosis without worsening motor function. This recorded the claim that selective 5-HT2A inverse agonism, without dopamine antagonism, could treat psychosis in a population harmed by conventional antipsychotics.',
        source: {
          externalId: 'src:cummings-pimavanserin-lancet-2014',
          name: 'Cummings J, Isaacson S, Mills R, et al. Pimavanserin for patients with Parkinson\'s disease psychosis: a randomised, placebo-controlled phase 3 trial. Lancet. 2014;383(9916):533-540.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/24183563/',
          publishedAt: '2014-02-08',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2016-04-29',
        datePrecision: 'DAY',
        reason: 'The FDA approved pimavanserin (NDA 207318, Acadia) as the first and only drug for hallucinations and delusions associated with Parkinson\'s disease psychosis, carrying the antipsychotic class boxed warning for increased mortality in elderly dementia patients. The approval institutionally settled the mechanism\'s therapeutic legitimacy for this specific indication.',
        source: {
          externalId: 'src:fda-nuplazid-pimavanserin-label-2016',
          name: 'U.S. Food and Drug Administration. NUPLAZID (pimavanserin) prescribing information, NDA 207318. Initial U.S. Approval 2016.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2016/207318lbl.pdf',
          publishedAt: '2016-04-29',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '2018-09-20',
        datePrecision: 'DAY',
        reason: 'After post-marketing reports of deaths and serious adverse events drew public scrutiny (notably a 2018 CNN investigation), the FDA conducted a formal safety review and announced it had found no new or unexpected risks and that benefits outweighed risks for Parkinson\'s disease psychosis. Although the agency reaffirmed approval, the death-report controversy — compounded by the 2021 FDA rejection of pimavanserin for broader dementia-related psychosis (HARMONY trial) — left the drug\'s safety and efficacy claim in active dispute.',
        source: {
          externalId: 'src:fda-pimavanserin-safety-review-2018',
          name: 'U.S. Food and Drug Administration. FDA analysis finds no new or unexpected safety risks associated with Nuplazid (pimavanserin). September 20, 2018.',
          url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-analysis-finds-no-new-or-unexpected-safety-risks-associated-nuplazid-pimavanserin-medication',
          publishedAt: '2018-09-20',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ENDOCRINOLOGY ERA (1891–1924)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 36. Murray thyroid extract for myxoedema — 1891 ─────────────────────────
  {
    externalId: 'trajectory:murray-thyroid-extract-myxoedema-1891',
    text: 'George R. Murray reported in the British Medical Journal on 10 October 1891 that subcutaneous injections of an extract of sheep thyroid gland produced sustained amelioration of myxoedema, the first successful endocrine (hormone) replacement therapy in medicine.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1891-10-10',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1891-10-10',
        datePrecision: 'DAY',
        reason: 'Murray published \'Note on the Treatment of Myxoedema by Hypodermic Injections of an Extract of the Thyroid Gland of a Sheep\' in the BMJ, reporting a 46-year-old woman with characteristic myxoedema who, after injections begun 13 April 1891, was dramatically improved within three months. This recorded in the expert literature the claim that supplying thyroid-gland material could reverse a deficiency disease — the conceptual birth of hormone replacement therapy, before any thyroid hormone had been chemically identified.',
        source: {
          externalId: 'src:murray-myxoedema-bmj-1891',
          name: 'Murray GR. Note on the Treatment of Myxoedema by Hypodermic Injections of an Extract of the Thyroid Gland of a Sheep. Br Med J. 1891;2(1606):796–797.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2273741/',
          publishedAt: '1891-10-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1920-01-01',
        datePrecision: 'YEAR',
        reason: 'Thyroid therapy was rapidly and universally adopted: oral dried-thyroid extract replaced injections, entered the pharmacopoeias as standard treatment for myxoedema/hypothyroidism, and Murray\'s original patient survived 28 years on continuous treatment — confirming durable, reproducible benefit. By the 1920s thyroid replacement was the settled standard of care for hypothyroidism, a status it retains today (now as levothyroxine).',
        source: {
          externalId: 'src:slater-thyroid-replacement-history-jrsm-2011',
          name: 'Slater S. The discovery of thyroid replacement therapy. J R Soc Med. 2011;104(1):15–18 (Part 1) and related parts.',
          url: 'https://journals.sagepub.com/doi/10.1258/jrsm.2010.10k052',
          publishedAt: '2011-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 37. Kendall thyroxine isolation — 1914/1915 ──────────────────────────────
  {
    externalId: 'trajectory:kendall-thyroxine-isolation-1914',
    text: 'Edward C. Kendall isolated the active iodine-containing principle of the thyroid gland in pure crystalline form at the Mayo Clinic on 25 December 1914 (publishing in JAMA, 19 June 1915), identifying the substance he named thyroxin as the chemical agent of thyroid function.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1914-12-25',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1915-06-19',
        datePrecision: 'DAY',
        reason: 'Kendall published \'The Isolation in Crystalline Form of the Compound Containing Iodin, Which Occurs in the Thyroid: Its Chemical Nature and Physiologic Activity\' in JAMA, reporting a crystalline compound (~60–65% iodine) extracted from hog thyroid that produced the physiologic effects of thyroid administration in dogs and humans. This recorded the claim that a single iodine-bearing molecule was the active hormone of the thyroid, moving thyroid function from organ extract to defined chemistry.',
        source: {
          externalId: 'src:kendall-thyroxin-isolation-jama-1915',
          name: 'Kendall EC. The Isolation in Crystalline Form of the Compound Containing Iodin, Which Occurs in the Thyroid: Its Chemical Nature and Physiologic Activity. JAMA. 1915;64(25):2042–2043. (Landmark reprint: PMID 6352971.)',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6352971/',
          publishedAt: '1915-06-19',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1927-01-01',
        datePrecision: 'YEAR',
        reason: 'Charles Harington and George Barger established the correct chemical constitution of thyroxine and achieved its total synthesis, publishing \'Chemistry of Thyroxine: Constitution and Synthesis of Thyroxine\' in the Biochemical Journal. Synthesis from defined precursors proved the molecule\'s structure (Kendall\'s proposed formula was wrong) and made it reproducibly available, settling thyroxine\'s chemical identity as the thyroid hormone.',
        source: {
          externalId: 'src:harington-barger-thyroxine-synthesis-biochemj-1927',
          name: 'Harington CR, Barger G. Chemistry of Thyroxine: Constitution and Synthesis of Thyroxine. Biochem J. 1927;21(1):169–183.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1251886/',
          publishedAt: '1927-01-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 38. Marine & Kimball iodine prevents goiter — 1920 ───────────────────────
  {
    externalId: 'trajectory:marine-kimball-iodine-prevents-goiter-1920',
    text: 'David Marine and Oliver Kimball reported in Archives of Internal Medicine in 1920 that periodic sodium iodide supplementation prevented endemic (simple) goiter in Akron, Ohio schoolgirls, with goiter developing in only about 0.2% of treated girls versus a far higher rate in untreated controls — the controlled demonstration that iodine deficiency causes goiter.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1920-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1920-01-01',
        datePrecision: 'YEAR',
        reason: 'Marine and Kimball published \'The Prevention of Simple Goiter in Man\' (fourth paper) reporting their large controlled trial in ~2,000+ Akron schoolgirls given sodium iodide twice yearly versus untreated controls; goiter incidence in the treated group was a small fraction (≈0.2%) of that in controls. This recorded in the expert literature the first convincing controlled-trial evidence that iodine prevents endemic goiter, establishing the deficiency etiology.',
        source: {
          externalId: 'src:marine-kimball-prevention-goiter-aim-1920',
          name: 'Marine D, Kimball OP. The Prevention of Simple Goiter in Man (Fourth Paper). Arch Intern Med. 1920;25(6):661–672.',
          url: 'https://www.jameslindlibrary.org/marine-d-kimball-op-1920/',
          publishedAt: '1920-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1924-05-01',
        datePrecision: 'MONTH',
        reason: 'Acting on Marine\'s recommendation that iodized salt was the best population-level preventive, Michigan\'s goiter program and Morton Salt began nationwide distribution of iodized table salt in May 1924, making iodine prophylaxis routine public-health policy in the United States. Widespread iodization sharply reduced endemic goiter and cretinism, institutionally settling the iodine-deficiency model of goiter.',
        source: {
          externalId: 'src:iodized-salt-centennial-healio-2024',
          name: 'Healio/Endocrine Today. Iodized salt: Celebrating the centennial of a major US public health triumph. 13 Feb 2024.',
          url: 'https://www.healio.com/news/endocrinology/20240213/iodized-salt-celebrating-the-centennial-of-a-major-us-public-health-triumph',
          publishedAt: '2024-02-13',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 39. Elixir sulfanilamide disaster — FDCA premarket safety 1937–1938 ───────
  {
    externalId: 'trajectory:elixir-sulfanilamide-fdca-premarket-safety-1937',
    text: 'The Elixir Sulfanilamide disaster of autumn 1937 — in which a diethylene-glycol solvent in an untested liquid sulfanilamide preparation killed at least 105 people — established that drugs could be marketed without any safety testing, a gap closed when the U.S. Federal Food, Drug, and Cosmetic Act of 25 June 1938 first required proof of safety before a new drug could be sold.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1937-10-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1938-01-01',
        datePrecision: 'YEAR',
        reason: 'During September–October 1937 the S. E. Massengill Company\'s Elixir Sulfanilamide killed more than 100 people across 15 states; E. M. K. Geiling and P. R. Cannon\'s investigation, published in JAMA in 1938, established through animal studies that the diethylene-glycol solvent — not the sulfanilamide — was the lethal agent. This recorded in the expert literature that an untested, lawfully sold drug had caused mass death, exposing the absence of any premarket safety requirement.',
        source: {
          externalId: 'src:geiling-cannon-elixir-sulfanilamide-jama-1938',
          name: 'Geiling EMK, Cannon PR. Pathologic Effects of Elixir of Sulfanilamide (Diethylene Glycol) Poisoning. JAMA. 1938;111(10):919–926.',
          url: 'https://jamanetwork.com/journals/jama/fullarticle/282251',
          publishedAt: '1938-09-03',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1938-06-25',
        datePrecision: 'DAY',
        reason: 'Spurred directly by the disaster, President Franklin D. Roosevelt signed the Federal Food, Drug, and Cosmetic Act into law on 25 June 1938, replacing the 1906 Pure Food and Drug Act and for the first time requiring manufacturers to prove a new drug\'s safety to the FDA before marketing. This institutionalized mandatory premarket safety review — a settled principle of U.S. drug regulation that remains in force and was the foundation later extended to efficacy by the 1962 Kefauver-Harris Amendment.',
        source: {
          externalId: 'src:fda-1938-food-drug-cosmetic-act',
          name: 'U.S. Food and Drug Administration. Part II: 1938, Food, Drug, Cosmetic Act.',
          url: 'https://www.fda.gov/about-fda/changes-science-law-and-regulatory-authorities/part-ii-1938-food-drug-cosmetic-act',
          publishedAt: '1938-06-25',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // WOMEN'S HEALTH / POST-MARKET REVERSAL ERA (1992–2009)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 40. WHI estrogen-plus-progestin HRT reversal — 2002 ─────────────────────
  {
    externalId: 'trajectory:whi-estrogen-progestin-hrt-reversal-2002',
    text: 'The claim that combined estrogen-plus-progestin hormone replacement therapy was a safe long-term treatment that protected postmenopausal women against coronary heart disease and other chronic conditions was reversed when the Women\'s Health Initiative randomized trial, reported in JAMA on 17 July 2002, found that the therapy increased rather than reduced cardiovascular and breast-cancer risk.',
    claimType: 'HYBRID',
    claimEmergedAt: '1992-12',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1992-12',
        datePrecision: 'MONTH',
        reason: 'The American College of Physicians issued \'Guidelines for counseling postmenopausal women about preventive hormone therapy\' (Ann Intern Med 1992;117:1038-41), recommending preventive hormone therapy — chiefly for coronary disease prevention — for postmenopausal women. Drawing on observational data such as the Nurses\' Health Study, this codified as institutional standard the claim that long-term HRT was cardioprotective and broadly beneficial.',
        source: {
          externalId: 'src:acp-hrt-counseling-guideline-1992',
          name: 'American College of Physicians. Guidelines for counseling postmenopausal women about preventive hormone therapy. Ann Intern Med. 1992;117(12):1038-1041.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/1443972/',
          publishedAt: '1992-12-15',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2002-07-17',
        datePrecision: 'DAY',
        reason: 'The Writing Group for the Women\'s Health Initiative Investigators reported the principal results of the estrogen-plus-progestin (Prempro) randomized controlled trial in 16,608 healthy postmenopausal women. The data and safety monitoring board had stopped the trial early (mean 5.2 years) because invasive breast cancer crossed the stopping boundary and the global index showed risks exceeding benefits, with increased coronary heart disease, stroke, and pulmonary embolism. The first large RCT directly contradicted the observational consensus that combined HRT was protective.',
        source: {
          externalId: 'src:whi-estrogen-progestin-jama-2002',
          name: 'Writing Group for the Women\'s Health Initiative Investigators. Risks and Benefits of Estrogen Plus Progestin in Healthy Postmenopausal Women: Principal Results From the Women\'s Health Initiative Randomized Controlled Trial. JAMA. 2002;288(3):321-333.',
          url: 'https://jamanetwork.com/journals/jama/fullarticle/195120',
          publishedAt: '2002-07-17',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2002-11',
        datePrecision: 'MONTH',
        reason: 'The American College of Physicians published revised recommendations, \'Postmenopausal Hormone Replacement Therapy for Primary Prevention of Chronic Conditions\' (Ann Intern Med 2002;137:834-839), retracting its earlier endorsement of HRT for chronic-disease prevention in light of the WHI results. The body that had institutionalized the preventive claim in 1992 formally withdrew it, ratifying the reversal at the guideline level.',
        source: {
          externalId: 'src:acp-hrt-prevention-reversal-2002',
          name: 'American College of Physicians. Postmenopausal Hormone Replacement Therapy for Primary Prevention of Chronic Conditions: Recommendations and Rationale. Ann Intern Med. 2002;137(10):834-839.',
          url: 'https://www.acpjournals.org/doi/10.7326/0003-4819-137-10-200211190-00013',
          publishedAt: '2002-11-19',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 41. Vioxx (rofecoxib) voluntary withdrawal — 2004 ───────────────────────
  {
    externalId: 'trajectory:vioxx-rofecoxib-withdrawal-2004',
    text: 'The claim that rofecoxib (Vioxx), the COX-2-selective NSAID approved by the FDA in May 1999, was a safe anti-inflammatory drug for arthritis and chronic pain was reversed when Merck voluntarily withdrew it from the worldwide market on 30 September 2004 after a trial showed increased cardiovascular risk.',
    claimType: 'HYBRID',
    claimEmergedAt: '1999-05',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1999-05',
        datePrecision: 'MONTH',
        reason: 'The FDA approved rofecoxib (Vioxx), a cyclooxygenase-2-selective NSAID, for relief of osteoarthritis signs and symptoms, acute pain in adults, and menstrual pain; rheumatoid-arthritis indications followed. Regulatory approval established the drug as a safe, effective analgesic, and it went on to generate more than 84 million prescriptions, with over 2 million people taking it at the time of withdrawal.',
        source: {
          externalId: 'src:fda-vioxx-withdrawal-news-2004',
          name: 'U.S. Food and Drug Administration. FDA Issues Public Health Advisory on Vioxx as its Manufacturer Voluntarily Withdraws the Product (P04-95; documents May 1999 approval). 30 September 2004.',
          url: 'https://info.groupbenefits.org/docs/OGBforms/News/2004/FDAwithdrawsVioxx.pdf',
          publishedAt: '2004-09-30',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'MARKET',
        occurredAt: '2004-09-30',
        datePrecision: 'DAY',
        reason: 'Merck announced a voluntary worldwide withdrawal of Vioxx after halting the APPROVe (Adenomatous Polyp Prevention on Vioxx) trial, which showed an increased relative risk of confirmed cardiovascular events such as heart attack and stroke beginning after 18 months of treatment. The largest voluntary drug recall in history, it repudiated the drug\'s safety premise through manufacturer action and became a defining case in post-market surveillance.',
        source: {
          externalId: 'src:merck-vioxx-voluntary-withdrawal-2004',
          name: 'Merck & Co., Inc. Merck Announces Voluntary Worldwide Withdrawal of VIOXX. 30 September 2004.',
          url: 'https://info.groupbenefits.org/docs/OGBforms/News/2004/MerckAnnouncement.pdf',
          publishedAt: '2004-09-30',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 42. Tamoxifen breast-cancer prevention — NSABP P-1 1998 ─────────────────
  {
    externalId: 'trajectory:tamoxifen-breast-cancer-prevention-1998',
    text: 'Fisher and the National Surgical Adjuvant Breast and Bowel Project (NSABP) P-1 investigators reported in the Journal of the National Cancer Institute on 16 September 1998 that tamoxifen reduced the incidence of invasive breast cancer by about 49% in women at increased risk, establishing the first drug shown to prevent breast cancer in healthy high-risk women.',
    claimType: 'HYBRID',
    claimEmergedAt: '1998-09-16',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1998-09-16',
        datePrecision: 'DAY',
        reason: 'Fisher et al. reported the NSABP Breast Cancer Prevention Trial (P-1), a randomized placebo-controlled trial in 13,388 women at increased risk, finding that five years of tamoxifen reduced invasive breast cancer incidence by approximately 49%. This recorded in the expert literature the novel claim that breast cancer could be prevented pharmacologically in healthy high-risk women, while also documenting increased risks of endometrial cancer and thromboembolism.',
        source: {
          externalId: 'src:nsabp-p1-tamoxifen-jnci-1998',
          name: 'Fisher B, Costantino JP, Wickerham DL, et al. Tamoxifen for prevention of breast cancer: report of the National Surgical Adjuvant Breast and Bowel Project P-1 Study. J Natl Cancer Inst. 1998;90(18):1371-1388.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9747868/',
          publishedAt: '1998-09-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1998-10',
        datePrecision: 'MONTH',
        reason: 'The FDA approved tamoxifen (Nolvadex) to reduce the incidence of breast cancer in women at high risk, based on the NSABP P-1 results — the first regulatory approval of a drug for breast cancer chemoprevention. The approval institutionally settled the claim that tamoxifen reduces breast cancer risk, while the labeled serious harms (uterine cancer, thromboembolism, stroke) kept its use risk-stratified rather than universal.',
        source: {
          externalId: 'src:fda-tamoxifen-nolvadex-label-1998',
          name: 'U.S. Food and Drug Administration. NOLVADEX (tamoxifen citrate) approved labeling, NDA 17-970 (breast cancer risk reduction indication). 1998.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/1998/17970.pdf',
          publishedAt: '1998-10-29',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 43. Million Women Study — HRT and breast cancer 2003 ─────────────────────
  {
    externalId: 'trajectory:million-women-study-hrt-breast-cancer-2003',
    text: 'Beral and the Million Women Study collaborators reported in The Lancet on 9 August 2003 that current use of hormone replacement therapy — especially estrogen-progestin combinations — substantially increases the incidence and mortality of breast cancer, based on observational follow-up of over one million UK women.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2003-08-09',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2003-08-09',
        datePrecision: 'DAY',
        reason: 'The Million Women Study, a prospective cohort of more than one million UK women aged 50–64, reported that current HRT users had significantly elevated breast cancer incidence and mortality, with estrogen-progestin combinations carrying substantially greater risk than estrogen-only preparations. Arriving a year after the WHI trial, the largest observational dataset on the question converged with the RCT, recording the HRT–breast-cancer link in the expert literature with high statistical power.',
        source: {
          externalId: 'src:million-women-study-lancet-2003',
          name: 'Million Women Study Collaborators (Beral V, et al.). Breast cancer and hormone-replacement therapy in the Million Women Study. Lancet. 2003;362(9382):419-427.',
          url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(03)14596-5/fulltext',
          publishedAt: '2003-08-09',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2003-08',
        datePrecision: 'MONTH',
        reason: 'The UK Committee on Safety of Medicines and the Medicines and Healthcare products Regulatory Agency (MHRA) revised HRT advice in response to the study, requiring prescribers to inform patients of the breast-cancer risk of prolonged therapy and to review treatment annually. The regulatory action settled the breast-cancer risk as established prescribing guidance and helped drive a sharp decline in HRT use.',
        source: {
          externalId: 'src:mhra-hrt-breast-cancer-advice-2003',
          name: 'MHRA/Committee on Safety of Medicines advises vigilance after study links HRT with increased risk of breast cancer. The Pharmaceutical Journal. August 2003.',
          url: 'https://pharmaceutical-journal.com/article/news/mhra-advises-vigilance-after-study-links-hrt-with-increased-risk-of-breast-cancer',
          publishedAt: '2003-08-16',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 44. USPSTF mammography screening revision — 2009 ─────────────────────────
  {
    externalId: 'trajectory:uspstf-mammography-screening-revision-2009',
    text: 'The U.S. Preventive Services Task Force recommended on 17 November 2009 against routine screening mammography for average-risk women aged 40–49 and advised biennial rather than annual screening for women aged 50–74, revising the prior standard of routine screening from age 40.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2009-11-17',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2009-11-17',
        datePrecision: 'DAY',
        reason: 'The USPSTF published its updated breast cancer screening recommendation statement (Ann Intern Med 2009;151:716-726), grading routine screening for women 40–49 as not recommended (individualized decision) and recommending biennial screening for women 50–74, citing the balance of benefits against false positives and overdiagnosis. This recorded a formal institutional reversal of the earlier recommendation to screen from age 40.',
        source: {
          externalId: 'src:uspstf-breast-cancer-screening-2009',
          name: 'U.S. Preventive Services Task Force. Screening for Breast Cancer: U.S. Preventive Services Task Force Recommendation Statement. Ann Intern Med. 2009;151(10):716-726.',
          url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/breast-cancer-screening-2009',
          publishedAt: '2009-11-17',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'PUBLIC',
        occurredAt: '2009-12',
        datePrecision: 'MONTH',
        reason: 'The recommendation drew immediate, sustained opposition from the American Cancer Society, the American College of Radiology, and the American College of Obstetricians and Gynecologists, which retained their age-40 annual-screening guidelines. The backlash was severe enough that the U.S. Senate amended pending health-reform legislation to disregard the 2009 USPSTF guidance, and the Affordable Care Act specifically excluded it so insurers would continue covering screening from age 40 — leaving the recommendation institutionally contested rather than adopted.',
        source: {
          externalId: 'src:uspstf-mammography-agency-response-2009',
          name: 'Major Cancer Agencies Respond to USPSTF\'s New Mammography Guidelines. Cancer Network / ONCOLOGY. November 2009.',
          url: 'https://www.cancernetwork.com/view/major-cancer-agencies-respond-uspstfs-new-mammography-guidelines',
          publishedAt: '2009-11-20',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PEDIATRIC SAFETY ERA (1992–2017)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 45. AAP supine sleep / Back to Sleep — SIDS 1992 ─────────────────────────
  {
    externalId: 'trajectory:aap-supine-sleep-sids-1992',
    text: 'The American Academy of Pediatrics Task Force on Infant Positioning and SIDS recommended in June 1992 that healthy infants be placed on their side or back (non-prone) when put down to sleep, on the basis that the prone sleeping position is associated with an increased risk of sudden infant death syndrome — reversing the prevailing advice to place infants prone.',
    claimType: 'HYBRID',
    claimEmergedAt: '1992-06-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1992-06-01',
        datePrecision: 'MONTH',
        reason: 'The AAP Task Force on Infant Positioning and SIDS published its first policy statement, \'Positioning and SIDS,\' in Pediatrics, recommending non-prone (side or back) sleep for healthy infants after reviewing epidemiologic evidence associating prone sleep with SIDS. This formalized as institutional guidance a reversal of decades of advice (including Dr. Spock\'s) to place babies prone, marking the entry of the supine-sleep claim into the official record.',
        source: {
          externalId: 'src:aap-positioning-sids-pediatrics-1992',
          name: 'American Academy of Pediatrics Task Force on Infant Positioning and SIDS. Positioning and SIDS. Pediatrics. 1992;89(6 Pt 1):1120-1126.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/1503575/',
          publishedAt: '1992-06-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2011-10-17',
        datePrecision: 'DAY',
        reason: 'After the 1994 \'Back to Sleep\' campaign and a roughly 50% decline in U.S. SIDS rates, the AAP reaffirmed and expanded supine sleep into a comprehensive safe-sleep policy statement, by which point back sleeping was established standard of care worldwide. The accumulated mortality decline and international institutional adoption settled the once-novel claim that prone sleeping is dangerous.',
        source: {
          externalId: 'src:aap-safe-infant-sleep-pediatrics-2011',
          name: 'AAP Task Force on Sudden Infant Death Syndrome. SIDS and Other Sleep-Related Infant Deaths: Expansion of Recommendations for a Safe Infant Sleeping Environment. Pediatrics. 2011;128(5):1030-1039.',
          url: 'https://publications.aap.org/pediatrics/article/128/5/1030/30941/SIDS-and-Other-Sleep-Related-Infant-Deaths',
          publishedAt: '2011-10-17',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 46. LEAP early peanut introduction — 2015 ────────────────────────────────
  {
    externalId: 'trajectory:leap-early-peanut-introduction-2015',
    text: 'The LEAP randomized controlled trial (Du Toit et al.) reported in the New England Journal of Medicine on 23 February 2015 that early introduction of dietary peanut to high-risk infants reduced the development of peanut allergy by roughly 80% compared with peanut avoidance, contradicting the prior guidance that allergen avoidance in infancy prevents food allergy.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2015-02-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2015-02-23',
        datePrecision: 'DAY',
        reason: 'The NIAID-funded LEAP trial randomized 640 high-risk infants to peanut consumption or avoidance and found peanut allergy at 60 months in 13.7% of avoiders versus 1.9% of consumers (negative-skin-test stratum). This was the first high-quality experimental evidence that early allergen exposure, not avoidance, prevents peanut allergy — directly inverting the avoidance paradigm embodied in earlier AAP guidance.',
        source: {
          externalId: 'src:dutoit-leap-nejm-2015',
          name: 'Du Toit G, Roberts G, Sayre PH, et al. Randomized Trial of Peanut Consumption in Infants at Risk for Peanut Allergy. N Engl J Med. 2015;372(9):803-813.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/25705822/',
          publishedAt: '2015-02-23',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2017-01-01',
        datePrecision: 'MONTH',
        reason: 'A NIAID-sponsored expert panel issued Addendum Guidelines for the Prevention of Peanut Allergy recommending introduction of age-appropriate peanut-containing foods as early as 4–6 months in high-risk infants, codifying the LEAP finding into U.S. national clinical guidance. The translation of a single trial into formal prevention guidelines settled early peanut introduction as standard practice.',
        source: {
          externalId: 'src:niaid-peanut-addendum-guidelines-jaci-2017',
          name: 'Togias A, Cooper SF, Acebal ML, et al. Addendum Guidelines for the Prevention of Peanut Allergy in the United States: Report of the NIAID-Sponsored Expert Panel. J Allergy Clin Immunol. 2017;139(1):29-44.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5226648/',
          publishedAt: '2017-01-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 47. CDC childhood blood lead reference value 5 µg/dL — 2012 ──────────────
  {
    externalId: 'trajectory:cdc-blood-lead-reference-value-2012',
    text: 'The CDC adopted a childhood blood lead reference value of 5 µg/dL in 2012 (formally reported in MMWR on 5 April 2013), replacing the 10 µg/dL \'level of concern\' in place since 1991, on the determination that no safe blood lead level in children has been identified.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2012-05-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2013-04-05',
        datePrecision: 'DAY',
        reason: 'Accepting its Advisory Committee on Childhood Lead Poisoning Prevention recommendation, the CDC replaced the static 10 µg/dL \'level of concern\' with a population-based upper reference interval of 5 µg/dL (the 97.5th percentile of NHANES blood lead distributions). MMWR formally reported the new reference value, recording institutionally the principle that there is no identified safe blood lead level for children.',
        source: {
          externalId: 'src:cdc-mmwr-blood-lead-5-ugdl-2013',
          name: 'CDC. Blood Lead Levels in Children Aged 1–5 Years — United States, 1999–2010. MMWR Morb Mortal Wkly Rep. 2013;62(13):245-248.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/mm6213a3.htm',
          publishedAt: '2013-04-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2021-10-28',
        datePrecision: 'DAY',
        reason: 'The CDC updated the blood lead reference value downward from 5 µg/dL to 3.5 µg/dL based on 2015–2018 NHANES data, applying the same NHANES-percentile methodology adopted in 2012. The continued use and tightening of the reference-value framework cemented the no-safe-level approach as settled federal policy rather than a one-time revision.',
        source: {
          externalId: 'src:cdc-mmwr-blood-lead-3-5-ugdl-2021',
          name: 'Ruckart PZ, Jones RL, Courtney JG, et al. Update of the Blood Lead Reference Value — United States, 2021. MMWR Morb Mortal Wkly Rep. 2021;70(43):1509-1512.',
          url: 'https://www.cdc.gov/mmwr/volumes/70/wr/mm7043a4.htm',
          publishedAt: '2021-10-29',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 48. Codeine contraindicated in children — FDA 2013–2017 ──────────────────
  {
    externalId: 'trajectory:codeine-contraindicated-children-2013',
    text: 'The FDA determined that codeine is unsafe for pain management in young children — issuing a Boxed Warning and contraindication against codeine use after tonsillectomy/adenoidectomy on 20 February 2013 following reports of deaths in ultra-rapid CYP2D6 metabolizers, and extending the contraindication to all children younger than 12 on 20 April 2017.',
    claimType: 'HYBRID',
    claimEmergedAt: '2013-02-20',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2013-02-20',
        datePrecision: 'DAY',
        reason: 'After reviewing reports of child deaths and severe respiratory depression in codeine-treated children — linked to inherited CYP2D6 ultra-rapid metabolism that converts codeine to toxic morphine levels — the FDA added a Boxed Warning and contraindicated codeine for pain after tonsillectomy/adenoidectomy. This recorded the reversal of codeine\'s long-standing status as a routine pediatric analgesic.',
        source: {
          externalId: 'src:fda-codeine-boxed-warning-children-2013',
          name: 'FDA. Drug Safety Communication: Safety review update of codeine use in children; new Boxed Warning and Contraindication on use after tonsillectomy and/or adenoidectomy. February 20, 2013.',
          url: 'https://www.fda.gov/files/drugs/published/FDA-Drug-Safety-Communication--Safety-review-update-of-codeine-use-in-children--new-Boxed-Warning-and-Contraindication-on-use-after-tonsillectomy-and-or-adenoidectomy-(pdf).pdf',
          publishedAt: '2013-02-20',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2017-04-20',
        datePrecision: 'DAY',
        reason: 'The FDA broadened the action into a full contraindication of codeine for pain and cough in all children younger than 12, and of tramadol in the same group, with added warnings for adolescents 12–18 with obesity or sleep apnea. Generalizing the restriction beyond the surgical setting to all young children settled codeine\'s contraindication in pediatrics as established regulatory fact.',
        source: {
          externalId: 'src:aap-pediatrics-codeine-2017-dsc-impact-2022',
          name: 'Chua KP, Shrime MG, Conti RM, et al. Impact of the 2017 FDA Drug Safety Communication on Codeine and Tramadol Dispensing to Children. Pediatrics. 2022;150(5):e2021055887.',
          url: 'https://publications.aap.org/pediatrics/article/150/5/e2021055887/189746/Impact-of-the-2017-FDA-Drug-Safety-Communication',
          publishedAt: '2022-10-25',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // RARE DISEASE & ORPHAN DRUG ERA (1983–2016)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Orphan Drug Act — regulatory framework for rare diseases 1983 ────────────
  {
    externalId: 'trajectory:orphan-drug-act-1983',
    text: 'On January 4, 1983, U.S. President Ronald Reagan signed the Orphan Drug Act (Public Law 97-414), establishing federal incentives — tax credits, research grants, and seven years of marketing exclusivity — to make development of drugs for rare diseases commercially viable.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1983-01-04',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1983-01-04',
        datePrecision: 'DAY',
        reason: 'Reagan signed H.R. 5238 (sponsored by Rep. Henry Waxman), enacting Public Law 97-414 after voice-vote passage in both chambers in December 1982. The Act created a statutory category of \'orphan\' drugs and a federal policy claim that drugs for rare conditions deserve special development incentives — a new institutional fact in U.S. drug regulation.',
        source: {
          externalId: 'src:orphan-drug-act-pl-97-414-1983',
          name: 'U.S. Congress. Orphan Drug Act, Public Law 97-414, 96 Stat. 2049. January 4, 1983.',
          url: 'https://www.fda.gov/media/99546/download',
          publishedAt: '1983-01-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1984-10-30',
        datePrecision: 'DAY',
        reason: 'The 1984 amendment (Public Law 98-551) replaced the original subjective \'no reasonable expectation of cost recovery\' test with an objective prevalence definition — a disease affecting fewer than 200,000 persons in the United States. This made the orphan designation administrable and durable; over subsequent decades hundreds of designations and approvals (including the first enzyme replacement therapies) validated the framework as settled regulatory infrastructure.',
        source: {
          externalId: 'src:orphan-drug-act-purpose-plos-medicine-2017',
          name: 'Sarpatwari A, Kesselheim AS. What Is the Purpose of the Orphan Drug Act? PLoS Med. 2017;14(2):e1002191.',
          url: 'https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1002191',
          publishedAt: '2017-02-07',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Alglucerase (Ceredase) — first enzyme replacement therapy 1991 ────────────
  {
    externalId: 'trajectory:alglucerase-ceredase-first-ert-gaucher-1991',
    text: 'Macrophage-targeted glucocerebrosidase (alglucerase, Ceredase) is an effective enzyme replacement therapy for type 1 Gaucher disease, a claim established by Barton and Brady\'s National Institutes of Health trials and confirmed by the FDA\'s April 1991 approval — the first enzyme replacement therapy and first treatment for a lysosomal storage disease.',
    claimType: 'HYBRID',
    claimEmergedAt: '1990-03',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1990-03-01',
        datePrecision: 'MONTH',
        reason: 'Barton, Furbish, Murray, Garfield, and Brady reported in PNAS that weekly intravenous infusions of mannose-terminated (macrophage-targeted) human placental glucocerebrosidase produced sustained clinical improvement — rising hemoglobin and platelets — in a single type 1 Gaucher patient. After two decades in which enzyme replacement was only a theoretical strategy, this recorded the first durable therapeutic response and the proof-of-concept that targeting the enzyme to macrophages overcame prior failures.',
        source: {
          externalId: 'src:barton-glucocerebrosidase-pnas-1990',
          name: 'Barton NW, Furbish FS, Murray GJ, Garfield M, Brady RO. Therapeutic response to intravenous infusions of glucocerebrosidase in a patient with Gaucher disease. Proc Natl Acad Sci USA. 1990;87(5):1913-1916.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2308952/',
          publishedAt: '1990-03-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1991-04-01',
        datePrecision: 'MONTH',
        reason: 'Barton et al.\'s 12-patient trial (N Engl J Med, May 23, 1991) demonstrated objective clinical improvement — increased hemoglobin, reduced spleen size, improved biomarkers — providing the pivotal evidence behind the FDA\'s April 1991 approval of alglucerase (Ceredase). This was the first enzyme replacement therapy ever approved and the first treatment for any lysosomal storage disorder, establishing ERT as a viable therapeutic paradigm later cemented by recombinant imiglucerase (Cerezyme) in 1994.',
        source: {
          externalId: 'src:barton-glucocerebrosidase-nejm-1991',
          name: 'Barton NW, Brady RO, Dambrosia JM, et al. Replacement therapy for inherited enzyme deficiency — macrophage-targeted glucocerebrosidase for Gaucher\'s disease. N Engl J Med. 1991;324(21):1464-1470.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2023606/',
          publishedAt: '1991-05-23',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Nusinersen (Spinraza) — first SMA treatment 2016 ─────────────────────────
  {
    externalId: 'trajectory:nusinersen-spinraza-first-sma-treatment-2016',
    text: 'On December 23, 2016, the U.S. FDA approved nusinersen (Spinraza), an intrathecal SMN2-splicing antisense oligonucleotide, as the first drug to treat spinal muscular atrophy in pediatric and adult patients — a previously untreatable leading genetic cause of infant death.',
    claimType: 'HYBRID',
    claimEmergedAt: '2016-12-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2016-12-23',
        datePrecision: 'DAY',
        reason: 'Granted under priority review and fast track, the FDA approved Spinraza on December 23, 2016 based on a prespecified interim analysis of the ENDEAR trial, in which 41% of treated infants achieved a motor-milestone response versus 0% of sham controls. The approval established the first-ever effective therapy for SMA, converting a uniformly fatal or progressively disabling motor-neuron disease into a treatable one and validating antisense splice-modulation as a clinical modality.',
        source: {
          externalId: 'src:fda-spinraza-nusinersen-label-2016',
          name: 'U.S. FDA. SPINRAZA (nusinersen) injection, for intrathecal use — Prescribing Information (original approval). December 2016.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2016/209531lbl.pdf',
          publishedAt: '2016-12-23',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-11-02',
        datePrecision: 'DAY',
        reason: 'Full publication of the ENDEAR phase 3 trial in the New England Journal of Medicine reported a 51% reduction in the risk of death or permanent ventilation and significant motor-function gains, with the trial halted early for efficacy. Peer-reviewed confirmation entrenched nusinersen\'s benefit in the literature and helped catalyze SMA newborn-screening programs and subsequent approvals (onasemnogene abeparvovec 2019, risdiplam 2020).',
        source: {
          externalId: 'src:finkel-endear-nusinersen-nejm-2017',
          name: 'Finkel RS, Mercuri E, Darras BT, et al. Nusinersen versus Sham Control in Infantile-Onset Spinal Muscular Atrophy. N Engl J Med. 2017;377(18):1723-1732.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/29091570/',
          publishedAt: '2017-11-02',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Eteplirsen (Exondys 51) — accelerated approval over committee objection 2016 ─
  {
    externalId: 'trajectory:eteplirsen-exondys51-accelerated-approval-2016',
    text: 'On September 19, 2016, the U.S. FDA granted accelerated approval to eteplirsen (Exondys 51) for Duchenne muscular dystrophy amenable to exon 51 skipping, on the basis that a small increase in dystrophin (a surrogate endpoint) was reasonably likely to predict clinical benefit — a determination made over the objection of the agency\'s own advisory committee.',
    claimType: 'HYBRID',
    claimEmergedAt: '2016-09-19',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2016-09-19',
        datePrecision: 'DAY',
        reason: 'FDA approved eteplirsen via the accelerated-approval pathway based on a 12-boy study showing a small rise in muscle dystrophin, a surrogate the agency judged \'reasonably likely\' to predict benefit. The approval letter mandated a confirmatory 2-year randomized controlled trial, and the decision overrode an April 2016 advisory-committee vote against approval and internal scientific dissent — recording the efficacy claim only conditionally.',
        source: {
          externalId: 'src:fda-eteplirsen-exondys51-approval-letter-2016',
          name: 'U.S. FDA. NDA 206488 Accelerated Approval Letter — Exondys 51 (eteplirsen) Injection. September 19, 2016.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/appletter/2016/206488Orig1s000ltr.pdf',
          publishedAt: '2016-09-19',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-08-01',
        datePrecision: 'MONTH',
        reason: 'The approval became a touchstone for debate over accelerated-approval evidentiary standards: critics argued it rested on a dozen patients, an open-label design, and a dystrophin surrogate of unproven clinical relevance, while intense patient-advocate participation was credited with shifting the decision. The claim that eteplirsen produces meaningful clinical benefit remained unconfirmed and openly contested in the regulatory and clinical literature.',
        source: {
          externalId: 'src:fdli-eteplirsen-patient-participation-2017',
          name: 'Food and Drug Law Institute. The Role of Patient Participation in Drug Approvals: Lessons from the Accelerated Approval of Eteplirsen. FDLI. August 2017.',
          url: 'https://www.fdli.org/2017/08/role-patient-participation-drug-approvals-lessons-accelerated-approval-eteplirsen/',
          publishedAt: '2017-08-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SHAM-CONTROLLED SURGERY ERA (1958–1985)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Internal mammary artery ligation for angina — 1958 → reversed 1959 ──────
  {
    externalId: 'trajectory:internal-mammary-artery-ligation-angina-1958',
    text: 'Bilateral internal mammary artery ligation, reported by Kitchell, Glover, and Kyle in the American Journal of Cardiology in 1958, relieves angina pectoris by increasing collateral blood flow to the ischemic myocardium.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1958-01-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1958-01-01',
        datePrecision: 'MONTH',
        reason: 'Kitchell, Glover, and Kyle published a preliminary clinical report claiming that simple bilateral ligation of the internal mammary arteries relieved angina in a majority of patients, building on Battezzati\'s earlier Italian series. The operation was simple, low-risk, and rapidly adopted on the strength of uncontrolled before-and-after symptom reports, recording in the literature the claim that ligation diverted blood into the coronary circulation.',
        source: {
          externalId: 'src:kitchell-glover-kyle-ima-ligation-1958',
          name: 'Kitchell JR, Glover RP, Kyle RH. Bilateral internal mammary artery ligation for angina pectoris; preliminary clinical considerations. Am J Cardiol. 1958;1(1):46-50.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13497954/',
          publishedAt: '1958-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1959-05-28',
        datePrecision: 'DAY',
        reason: 'Cobb and colleagues conducted one of the first double-blind sham-controlled surgical trials, in which some angina patients received internal mammary artery ligation and others only a skin incision, with neither patients nor assessors knowing which. Both groups reported nearly identical symptomatic improvement, showing the benefit was a placebo response; Dimond, Kittle, and Crockett confirmed the result the following year, and the operation was abandoned.',
        source: {
          externalId: 'src:cobb-ima-ligation-double-blind-nejm-1959',
          name: 'Cobb LA, Thomas GI, Dillard DH, Merendino KA, Bruce RA. An evaluation of internal-mammary-artery ligation by a double-blind technic. N Engl J Med. 1959;260(22):1115-1118.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13657350/',
          publishedAt: '1959-05-28',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Gastric freezing for duodenal ulcer — 1962 → reversed 1969 ──────────────
  {
    externalId: 'trajectory:gastric-freezing-duodenal-ulcer-1962',
    text: 'Gastric freezing (gastric hypothermia), introduced by Owen Wangensteen and colleagues in JAMA in 1962, achieves a \'physiological gastrectomy\' that heals duodenal ulcers by durably suppressing gastric acid secretion.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1962-05-12',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1962-05-12',
        datePrecision: 'MONTH',
        reason: 'Wangensteen and colleagues reported experimental and clinical results claiming that circulating a coolant through a balloon in the stomach froze the gastric mucosa, suppressed acid secretion, and healed duodenal ulcers without surgery. The non-operative \'physiological gastrectomy\' was rapidly and widely adopted, with thousands of freezing machines deployed across the United States on the basis of these uncontrolled reports.',
        source: {
          externalId: 'src:wangensteen-gastric-freezing-jama-1962',
          name: 'Wangensteen OH, Peter ET, Nicoloff DM, Walder AI, Sosin H, Bernstein EF. Achieving \'physiological gastrectomy\' by gastric freezing. A preliminary report of an experimental and clinical study. JAMA. 1962;180:439-444.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/14004878/',
          publishedAt: '1962-05-12',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1969-07-03',
        datePrecision: 'DAY',
        reason: 'Ruffin and colleagues ran a multicenter cooperative double-blind trial comparing true gastric freezing against a sham procedure in which the balloon was perfused with fluid at body temperature. The two arms showed no meaningful difference in ulcer outcomes, demonstrating the treatment was ineffective; the procedure was abandoned, and the episode became a textbook case for why surgical and procedural therapies require controlled evaluation.',
        source: {
          externalId: 'src:ruffin-gastric-freezing-controlled-nejm-1969',
          name: 'Ruffin JM, Grizzle JE, Hightower NC, McHardy G, Shull H, Kirsner JB. A co-operative double-blind evaluation of gastric \'freezing\' in the treatment of duodenal ulcer. N Engl J Med. 1969;281(1):16-19.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/4891641/',
          publishedAt: '1969-07-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── EC-IC bypass for stroke prevention — 1978 → reversed 1985 ───────────────
  {
    externalId: 'trajectory:ec-ic-bypass-stroke-prevention-1985',
    text: 'Extracranial-intracranial (superficial temporal artery to middle cerebral artery) arterial bypass surgery reduces the risk of ischemic stroke in patients with symptomatic carotid or middle-cerebral-artery occlusive disease.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1978-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1978-01-01',
        datePrecision: 'YEAR',
        reason: 'Following Donaghy and Yaşargil\'s first human STA-MCA microvascular anastomosis in 1967, EC-IC bypass was performed with rapidly growing frequency through the 1970s, with surgical series reporting graft patency and symptom relief. Reviews such as Samson and Boone\'s summary of \'past performance and current concepts\' recorded the prevailing belief that revascularizing hypoperfused brain prevented stroke, although the evidence was uncontrolled.',
        source: {
          externalId: 'src:samson-boone-ec-ic-bypass-neurosurgery-1978',
          name: 'Samson DS, Boone S. Extracranial-intracranial (EC-IC) arterial bypass: past performance and current concepts. Neurosurgery. 1978;3(1):79-86.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/683500/',
          publishedAt: '1978-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1985-11-07',
        datePrecision: 'DAY',
        reason: 'The international EC/IC Bypass Study randomized 1,377 patients with symptomatic atherosclerotic carotid or middle-cerebral disease to bypass surgery plus best medical care or medical care alone. Surgery failed to reduce stroke or death and the surgical group fared somewhat worse early on, directly contradicting the procedure\'s rationale; the trial reversed a widely practiced operation and became a landmark in evidence-based surgery.',
        source: {
          externalId: 'src:ec-ic-bypass-study-group-nejm-1985',
          name: 'EC/IC Bypass Study Group. Failure of extracranial-intracranial arterial bypass to reduce the risk of ischemic stroke. Results of an international randomized trial. N Engl J Med. 1985;313(19):1191-1200.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2865674/',
          publishedAt: '1985-11-07',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Breast-conserving surgery equivalent to mastectomy — 1985 → settled 1990 ─
  {
    externalId: 'trajectory:breast-conserving-surgery-equivalent-mastectomy-1985',
    text: 'Breast-conserving surgery (segmental mastectomy/lumpectomy) plus radiation achieves disease-free and overall survival equivalent to total or radical mastectomy for early breast cancer, as established by Fisher and the NSABP B-06 trial reported in the New England Journal of Medicine in March 1985.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1985-03-14',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1985-03-14',
        datePrecision: 'DAY',
        reason: 'Fisher and the National Surgical Adjuvant Breast and Bowel Project reported the five-year results of the randomized B-06 trial, finding no significant difference in disease-free or overall survival among total mastectomy, lumpectomy alone, and lumpectomy plus radiation for tumors up to 4 cm. The result recorded in the literature the claim that conserving the breast was as safe as removing it, directly challenging the Halsted radical-mastectomy paradigm that had dominated surgery for roughly eighty years.',
        source: {
          externalId: 'src:fisher-nsabp-b06-mastectomy-lumpectomy-nejm-1985',
          name: 'Fisher B, Bauer M, Margolese R, et al. Five-year results of a randomized clinical trial comparing total mastectomy and segmental mastectomy with or without radiation in the treatment of breast cancer. N Engl J Med. 1985;312(11):665-673.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/3883167/',
          publishedAt: '1985-03-14',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1990-06-01',
        datePrecision: 'MONTH',
        reason: 'The NIH Consensus Development Conference on the Treatment of Early-Stage Breast Cancer, held in June 1990, concluded that breast-conserving treatment was an appropriate primary therapy preferable to mastectomy for most women with stage I and II disease because it preserved the breast without compromising survival. This consensus, published in JAMA in 1991, institutionally settled the equivalence claim and reoriented standard surgical practice away from routine mastectomy.',
        source: {
          externalId: 'src:nih-consensus-early-breast-cancer-jama-1991',
          name: 'NIH Consensus Conference. Treatment of early-stage breast cancer. JAMA. 1991;265(3):391-395.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/1984541/',
          publishedAt: '1991-01-18',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // TARGETED THERAPY & MONOCLONAL ANTIBODY ERA (1997–2011)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 26. Imatinib (Gleevec) for CML — 2001 ───────────────────────────────────
  {
    externalId: 'trajectory:imatinib-gleevec-cml-targeted-therapy-2001',
    text: 'Imatinib mesylate (STI571/Gleevec), a small-molecule inhibitor of the BCR-ABL tyrosine kinase, induces durable hematologic and cytogenetic remissions in chronic myeloid leukemia, as reported by Druker and colleagues in 2001 and approved by the FDA on 10 May 2001.',
    claimType: 'HYBRID',
    claimEmergedAt: '2001-04-05',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2001-04-05',
        datePrecision: 'DAY',
        reason: 'Druker et al. published the phase I dose-escalation results of STI571 in the New England Journal of Medicine, reporting complete hematologic responses in 53 of 54 chronic-phase CML patients treated at doses of 300 mg/day or more after interferon failure. This established the first proof that rationally designed inhibition of a single oncogenic kinase could produce remissions, founding the targeted-therapy paradigm in oncology.',
        source: {
          externalId: 'src:druker-imatinib-cml-nejm-2001',
          name: 'Druker BJ, Talpaz M, Resta DJ, et al. Efficacy and safety of a specific inhibitor of the BCR-ABL tyrosine kinase in chronic myeloid leukemia. N Engl J Med. 2001;344(14):1031-1037.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11287972/',
          publishedAt: '2001-04-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2001-05-10',
        datePrecision: 'DAY',
        reason: 'The FDA granted accelerated approval to Gleevec (imatinib mesylate) for chronic-, accelerated-, and blast-phase CML on 10 May 2001, roughly ten weeks after submission — its fastest cancer-drug review at the time. Institutional adoption of the first BCR-ABL inhibitor as standard CML therapy converted a one-year-old clinical observation into the accepted standard of care; the drug was converted to full approval in December 2003 on the strength of the IRIS trial.',
        source: {
          externalId: 'src:fda-gleevec-approval-2001',
          name: 'U.S. Food and Drug Administration. Gleevec (imatinib mesylate) Approval, NDA 21-335. 10 May 2001.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/nda/2001/21-335_Gleevec_Approv.pdf',
          publishedAt: '2001-05-10',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 27. Trastuzumab (Herceptin) for HER2+ breast cancer — 1998 ──────────────
  {
    externalId: 'trajectory:trastuzumab-herceptin-her2-breast-cancer-1998',
    text: 'Trastuzumab (Herceptin), a humanized monoclonal antibody against the HER2 receptor, improves response and survival when added to chemotherapy in HER2-overexpressing metastatic breast cancer, leading to FDA approval on 25 September 1998 as the first HER2-targeted therapy.',
    claimType: 'HYBRID',
    claimEmergedAt: '1998-09-25',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1998-09-25',
        datePrecision: 'DAY',
        reason: 'The FDA approved trastuzumab (Herceptin) for HER2-overexpressing metastatic breast cancer on 25 September 1998, simultaneously approving the HercepTest companion diagnostic to select patients. This was the first marketed HER2-targeted therapy and an early model of biomarker-guided drug approval, recording the claim that blocking HER2 yields clinical benefit in the subset of tumors that overexpress it.',
        source: {
          externalId: 'src:fda-herceptin-approval-1998',
          name: 'U.S. Food and Drug Administration. Trastuzumab (Herceptin) approval letter, BLA 103792. 25 September 1998.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/appletter/1998/trasgen092598l.pdf',
          publishedAt: '1998-09-25',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2001-03-15',
        datePrecision: 'DAY',
        reason: 'Slamon et al. published the pivotal randomized trial in the New England Journal of Medicine, showing that adding trastuzumab to chemotherapy in HER2-positive metastatic breast cancer increased the response rate, prolonged time to progression, and improved overall survival (25.1 vs 20.3 months). The survival benefit moved trastuzumab from a regulatory-approved option to an expert-consensus standard of care, later cemented by adjuvant trials in 2005.',
        source: {
          externalId: 'src:slamon-trastuzumab-nejm-2001',
          name: 'Slamon DJ, Leyland-Jones B, Shak S, et al. Use of chemotherapy plus a monoclonal antibody against HER2 for metastatic breast cancer that overexpresses HER2. N Engl J Med. 2001;344(11):783-792.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11248153/',
          publishedAt: '2001-03-15',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 28. Rituximab (Rituxan) — first anti-cancer monoclonal antibody 1997 ──────
  {
    externalId: 'trajectory:rituximab-rituxan-first-anticancer-monoclonal-1997',
    text: 'Rituximab (Rituxan), a chimeric anti-CD20 monoclonal antibody, produces responses in roughly half of patients with relapsed indolent B-cell lymphoma, leading to FDA approval on 26 November 1997 as the first monoclonal antibody approved to treat any cancer.',
    claimType: 'HYBRID',
    claimEmergedAt: '1997-11-26',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1997-11-26',
        datePrecision: 'DAY',
        reason: 'The FDA approved rituximab (Rituxan, Genentech/IDEC) for relapsed or refractory CD20-positive low-grade or follicular B-cell non-Hodgkin lymphoma on 26 November 1997 — the first monoclonal antibody approved for any malignancy. This recorded the claim that targeting a B-cell surface antigen could safely deplete malignant lymphocytes, opening the era of antibody-based cancer therapy.',
        source: {
          externalId: 'src:mclaughlin-rituximab-pivotal-jco-1998',
          name: 'McLaughlin P, Grillo-López AJ, Link BK, et al. Rituximab chimeric anti-CD20 monoclonal antibody therapy for relapsed indolent lymphoma: half of patients respond to a four-dose treatment program. J Clin Oncol. 1998;16(8):2825-2833.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9704735/',
          publishedAt: '1998-08-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2002-01-24',
        datePrecision: 'DAY',
        reason: 'Coiffier et al. (GELA LNH-98.5) published in the New England Journal of Medicine that adding rituximab to CHOP chemotherapy significantly improved complete response and overall survival in elderly diffuse large-B-cell lymphoma. Extending rituximab\'s benefit from indolent to aggressive lymphoma with a survival advantage entrenched it as a backbone of B-cell lymphoma therapy worldwide.',
        source: {
          externalId: 'src:coiffier-rchop-dlbcl-nejm-2002',
          name: 'Coiffier B, Lepage E, Brière J, et al. CHOP chemotherapy plus rituximab compared with CHOP alone in elderly patients with diffuse large-B-cell lymphoma. N Engl J Med. 2002;346(4):235-242.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11807147/',
          publishedAt: '2002-01-24',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 29. Gefitinib (Iressa) — accelerated approval reversed 2005 ──────────────
  {
    externalId: 'trajectory:gefitinib-iressa-accelerated-approval-reversal-2003',
    text: 'Gefitinib (Iressa) received FDA accelerated approval on 5 May 2003 for refractory non-small-cell lung cancer based on tumor response rate, but the confirmatory ISEL trial showed no overall survival benefit and the FDA restricted its use in June 2005.',
    claimType: 'HYBRID',
    claimEmergedAt: '2003-05-05',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2003-05-05',
        datePrecision: 'DAY',
        reason: 'The FDA granted accelerated approval to gefitinib (Iressa) as monotherapy for locally advanced or metastatic NSCLC after failure of platinum- and docetaxel-based chemotherapy, based on a ~10% objective response rate in an unselected population. The approval explicitly relied on tumor shrinkage as a surrogate endpoint, with no controlled evidence of symptom or survival benefit at the time — recording a provisional claim contingent on confirmatory trials.',
        source: {
          externalId: 'src:cohen-gefitinib-fda-summary-oncologist-2003',
          name: 'Cohen MH, Williams GA, Sridhara R, et al. FDA drug approval summary: gefitinib (ZD1839) (Iressa) tablets. Oncologist. 2003;8(4):303-306.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12897327/',
          publishedAt: '2003-08-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2005-10-29',
        datePrecision: 'DAY',
        reason: 'Thatcher et al. published the ISEL trial in The Lancet, the confirmatory study required by the accelerated approval, showing that gefitinib failed to significantly improve overall survival versus placebo in pretreated NSCLC (5.6 vs 5.1 months; p=0.087). The surrogate response endpoint had not translated into clinical benefit in the unselected population, directly contesting the basis of the 2003 approval.',
        source: {
          externalId: 'src:thatcher-isel-gefitinib-lancet-2005',
          name: 'Thatcher N, Chang A, Parikh P, et al. Gefitinib plus best supportive care in previously treated patients with refractory advanced non-small-cell lung cancer (ISEL): a randomised, placebo-controlled, multicentre study. Lancet. 2005;366(9496):1527-1537.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16257339/',
          publishedAt: '2005-10-29',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2005-06-17',
        datePrecision: 'DAY',
        reason: 'Following ISEL, the FDA revised the Iressa label on 17 June 2005 to restrict use to patients already benefiting from the drug and barred new patients outside approved trials, effectively withdrawing the broad refractory-NSCLC indication granted in 2003. It became a defining case of an accelerated approval reversed when the confirmatory trial failed; gefitinib was only re-approved in 2015 for the narrow EGFR-mutation-positive subgroup.',
        source: {
          externalId: 'src:kazandjian-gefitinib-fda-approval-ccr-2016',
          name: 'Kazandjian D, Blumenthal GM, Yuan W, et al. FDA Approval of Gefitinib for the Treatment of Patients with Metastatic EGFR Mutation–Positive Non–Small Cell Lung Cancer. Clin Cancer Res. 2016;22(6):1307-1312.',
          url: 'https://aacrjournals.org/clincancerres/article/22/6/1307/121642/',
          publishedAt: '2016-03-15',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 30. Bevacizumab (Avastin) breast cancer indication revoked 2011 ───────────
  {
    externalId: 'trajectory:bevacizumab-avastin-breast-cancer-indication-revoked-2011',
    text: 'Bevacizumab (Avastin) received FDA accelerated approval for metastatic HER2-negative breast cancer in February 2008 based on progression-free survival in the E2100 trial, but the FDA revoked that indication on 18 November 2011 after follow-up trials failed to confirm benefit.',
    claimType: 'HYBRID',
    claimEmergedAt: '2008-02-22',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2008-02-22',
        datePrecision: 'DAY',
        reason: 'The FDA granted accelerated approval to bevacizumab with paclitaxel for first-line metastatic HER2-negative breast cancer on 22 February 2008, based on the E2100 trial\'s near-doubling of progression-free survival (11.8 vs 5.9 months) despite no overall survival benefit. The approval came over the 5–4 negative vote of the Oncologic Drugs Advisory Committee, recording a contested claim that PFS gain alone justified the indication.',
        source: {
          externalId: 'src:miller-e2100-bevacizumab-nejm-2007',
          name: 'Miller K, Wang M, Gralow J, et al. Paclitaxel plus bevacizumab versus paclitaxel alone for metastatic breast cancer. N Engl J Med. 2007;357(26):2666-2676.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/18160686/',
          publishedAt: '2007-12-27',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2010-07-20',
        datePrecision: 'DAY',
        reason: 'The confirmatory AVADO and RIBBON-1 trials showed much smaller PFS gains (under one month median) than E2100 and again no overall-survival benefit, while exposing patients to hypertension, hemorrhage, and perforation risks. On these data the FDA\'s Oncologic Drugs Advisory Committee voted 12–1 in July 2010 to recommend withdrawing the breast cancer indication, contesting the durability of the original claim.',
        source: {
          externalId: 'src:fda-odac-avastin-breast-review-2010',
          name: 'Sridhara R, et al. / FDA. Regulatory withdrawal of medicines marketed with uncertain benefits: the bevacizumab (Avastin) breast cancer case study. (2015 review documenting AVADO/RIBBON-1 and the July 2010 ODAC vote).',
          url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4610052/',
          publishedAt: '2015-10-19',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2011-11-18',
        datePrecision: 'DAY',
        reason: 'FDA Commissioner Margaret Hamburg announced on 18 November 2011 the revocation of bevacizumab\'s breast cancer indication, concluding the drug had not been shown safe and effective for that use; the formal final decision was published in the Federal Register on 27 February 2012. It is the landmark case of the FDA rescinding an accelerated approval over manufacturer objection after confirmatory trials failed, while the drug remained approved for colon, lung, kidney, and brain cancers.',
        source: {
          externalId: 'src:fda-avastin-breast-withdrawal-fr-2012',
          name: 'U.S. Food and Drug Administration. Final Decision on Withdrawal of Breast Cancer Indication for AVASTIN (Bevacizumab) Following Public Hearing. Federal Register, 27 February 2012 (Docket FDA-2010-N-0621).',
          url: 'https://www.federalregister.gov/documents/2012/02/27/2012-4424/final-decision-on-withdrawal-of-breast-cancer-indication-for-avastin-bevacizumab-following-public',
          publishedAt: '2012-02-27',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 13. Esketamine (Spravato) for TRD — approved, efficacy contested ─────────
  {
    externalId: 'trajectory:esketamine-spravato-trd-approval-2019',
    text: 'The FDA approved esketamine (Spravato, Janssen) nasal spray on 5 March 2019, in conjunction with an oral antidepressant, for treatment-resistant depression in adults — the first NMDA-receptor-antagonist antidepressant and the first mechanistically novel antidepressant class approved in decades.',
    claimType: 'HYBRID',
    claimEmergedAt: '2019-03-05',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2019-03-05',
        datePrecision: 'DAY',
        reason: 'The FDA granted esketamine approval under Fast Track and Breakthrough Therapy designations, with a restricted-distribution REMS owing to sedation, dissociation, and abuse potential. After decades in which antidepressant development centered on monoamine reuptake, approval of a rapid-acting glutamatergic agent recorded a new pharmacological claim: that NMDA-receptor antagonism is a viable mechanism for treating depression that has failed conventional therapy.',
        source: {
          externalId: 'src:fda-spravato-approval-2019',
          name: 'U.S. Food and Drug Administration. FDA approves new nasal spray medication for treatment-resistant depression; available only at a certified doctor\'s office or clinic. March 5, 2019.',
          url: 'https://www.fda.gov/news-events/press-announcements/fda-approves-new-nasal-spray-medication-treatment-resistant-depression-available-only-certified',
          publishedAt: '2019-03-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2019-12-16',
        datePrecision: 'DAY',
        reason: 'Gastaldon, Papola, Ostuzzi, and Barbui argued in Epidemiology and Psychiatric Sciences that only one of three short-term phase 3 trials (TRANSFORM-2) showed superiority over placebo, that the pooled effect fell below the developer\'s own clinically meaningful threshold, and that the trials lacked an active comparator — framing the approval as a regulatory standard-of-evidence failure. The critique placed esketamine\'s efficacy claim into active expert dispute even as its institutional approval stood.',
        source: {
          externalId: 'src:gastaldon-esketamine-critique-2019',
          name: 'Gastaldon C, Papola D, Ostuzzi G, Barbui C. Esketamine for treatment resistant depression: a trick of smoke and mirrors? Epidemiol Psychiatr Sci. 2019;29:e79.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8061126/',
          publishedAt: '2019-12-16',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PEDIATRIC DOSING & NEONATAL PHARMACOLOGY ERA (1951–1982)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── RLF / Retinopathy of Prematurity — oxygen causes infant blindness 1956 ──
  {
    externalId: 'trajectory:rlf-oxygen-premature-infants-cooperative-study-1956',
    text: 'The 1954–1956 Cooperative Study of Retrolental Fibroplasia, reported by V. E. Kinsey in 1956, established through a controlled multi-hospital clinical trial that liberal supplemental oxygen given to premature infants causes retrolental fibroplasia (now retinopathy of prematurity), the leading cause of infant blindness of the era.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1951-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1951-01-01',
        datePrecision: 'YEAR',
        reason: 'Australian ophthalmologist Kate Campbell and others published clinical observations linking the postwar epidemic of premature-infant blindness to the routine high-concentration oxygen then used in incubators. The hypothesis was recorded but contested, since oxygen was widely believed to be protective and the association rested on uncontrolled case series.',
        source: {
          externalId: 'src:campbell-rlf-oxygen-1951',
          name: 'Campbell K. Intensive oxygen therapy as a possible cause of retrolental fibroplasia: a clinical approach. Med J Aust. 1951;2(2):48-50.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/14874698/',
          publishedAt: '1951-07-14',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1956-10-01',
        datePrecision: 'MONTH',
        reason: 'Kinsey\'s report of the 18-hospital Cooperative Study, a controlled trial of 786 infants weighing ≤1500 g, found cicatricial retrolental fibroplasia in 25% of routine-oxygen infants versus 6% of curtailed-oxygen infants, confirming the causal role of oxygen exposure. This was among the first multicenter randomized clinical trials in neonatology and settled the etiology, prompting nationwide oxygen restriction.',
        source: {
          externalId: 'src:kinsey-rlf-cooperative-study-1956',
          name: 'Kinsey VE. Retrolental fibroplasia; cooperative study of retrolental fibroplasia and the use of oxygen. AMA Arch Ophthalmol. 1956;56(4):481-543.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13361620/',
          publishedAt: '1956-10-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Gray baby syndrome — chloramphenicol toxicity in neonates 1959 ───────────
  {
    externalId: 'trajectory:gray-baby-syndrome-chloramphenicol-neonates-1959',
    text: 'In 1959 J. M. Sutherland and, separately, L. E. Burns and colleagues reported that standard adult-scaled doses of chloramphenicol cause fatal cardiovascular collapse (\'gray baby syndrome\') in newborns because their immature livers cannot conjugate and excrete the drug, establishing that neonates require pharmacologically distinct dosing.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1959-06-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1959-06-01',
        datePrecision: 'MONTH',
        reason: 'Sutherland reported three newborns who died of unexplained cardiovascular collapse during chloramphenicol treatment, documenting the ashen-gray coloration, abdominal distention, and cyanosis of the syndrome. The report identified a toxicity unique to infants and recorded the first clear case series, opening the question of immature neonatal drug metabolism.',
        source: {
          externalId: 'src:sutherland-chloramphenicol-collapse-1959',
          name: 'Sutherland JM. Fatal cardiovascular collapse of infants receiving large amounts of chloramphenicol. Am J Dis Child. 1959;97(6):761-767.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13649107/',
          publishedAt: '1959-06-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1959-12-24',
        datePrecision: 'DAY',
        reason: 'Burns, Hodgman, and Cass reported a controlled trial in premature infants in which prophylactic chloramphenicol roughly doubled mortality (45% vs ~25%), confirming the toxicity with comparative data in the same year. Together with subsequent pharmacokinetic work showing deficient glucuronidation in neonates, this settled gray baby syndrome as a textbook proof that children are not small adults for drug dosing.',
        source: {
          externalId: 'src:burns-chloramphenicol-premature-collapse-1959',
          name: 'Burns LE, Hodgman JE, Cass AB. Fatal circulatory collapse in premature infants receiving chloramphenicol. N Engl J Med. 1959;261(26):1318-1321.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13806261/',
          publishedAt: '1959-12-24',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Guthrie PKU newborn screening — 1963 ────────────────────────────────────
  {
    externalId: 'trajectory:guthrie-pku-newborn-screening-1963',
    text: 'Robert Guthrie and Ada Susi published in Pediatrics in September 1963 a simple bacterial-inhibition blood-spot assay capable of mass-screening newborns for phenylketonuria, and Massachusetts that year became the first U.S. state to mandate universal newborn PKU screening.',
    claimType: 'HYBRID',
    claimEmergedAt: '1963-09-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1963-09-01',
        datePrecision: 'MONTH',
        reason: 'Guthrie and Susi described a Bacillus subtilis inhibition assay measuring phenylalanine in dried heel-prick blood spots on filter paper, enabling cheap, high-throughput screening of hospital nurseries. The method recorded a practical population-screening capability for an inherited disorder whose neurological damage is preventable if caught at birth.',
        source: {
          externalId: 'src:guthrie-susi-pku-pediatrics-1963',
          name: 'Guthrie R, Susi A. A simple phenylalanine method for detecting phenylketonuria in large populations of newborn infants. Pediatrics. 1963;32:338-343.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/14063511/',
          publishedAt: '1963-09-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1963-01-01',
        datePrecision: 'YEAR',
        reason: 'In 1963 Massachusetts became the first state to legally mandate universal newborn PKU screening using the Guthrie test, followed rapidly by Delaware, Vermont, Oregon, and dozens of other states. Within two years roughly 400,000 infants had been tested across 29 states, institutionalizing the first mass genetic-disease screening program and settling blood-spot screening as standard newborn care.',
        source: {
          externalId: 'src:nichd-pku-newborn-screening-history',
          name: 'NICHD (NIH). Phenylketonuria (PKU) and Newborn Screening — history of Guthrie test adoption and state mandates.',
          url: 'https://www.nichd.nih.gov/about/accomplishments/contributions/pku',
          publishedAt: '1963-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SHAM-CONTROLLED SURGERY ERA (2002–2017)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Arthroscopic knee surgery for osteoarthritis reversed — 2002 ─────────────
  {
    externalId: 'trajectory:arthroscopic-knee-surgery-osteoarthritis-reversal-2002',
    text: 'Arthroscopic lavage and débridement relieve pain and improve function in osteoarthritis of the knee — a widely practiced procedure shown by a sham-controlled trial in 2002 to work no better than placebo surgery.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1990-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1990-01-01',
        datePrecision: 'YEAR',
        reason: 'Through the 1980s and 1990s arthroscopic lavage and débridement became one of the most commonly performed orthopedic operations for knee osteoarthritis, supported by uncontrolled case series reporting symptomatic relief; hundreds of thousands of these procedures were done annually in the United States on the belief that flushing debris and smoothing cartilage reduced pain.',
        source: {
          externalId: 'src:moseley-arthroscopy-pilot-am-j-knee-surg-1996',
          name: 'Moseley JB, Wray NP, Kuykendall D, Willis K, Landon G. Arthroscopic treatment of osteoarthritis of the knee: a prospective, randomized, placebo-controlled trial. Results of a pilot study. Am J Sports Med. 1996;24(1):28-34.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8638750/',
          publishedAt: '1996-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2002-07-11',
        datePrecision: 'DAY',
        reason: 'Moseley and colleagues randomized 180 patients to arthroscopic débridement, arthroscopic lavage, or a placebo operation (skin incisions with a simulated procedure), with patients and outcome assessors blinded. Over 24 months neither surgical group reported less pain or better function than the placebo group, demonstrating that the apparent benefit was a placebo response and providing the first rigorous evidence that the operation was ineffective for knee osteoarthritis.',
        source: {
          externalId: 'src:moseley-arthroscopy-sham-nejm-2002',
          name: 'Moseley JB, O\'Malley K, Petersen NJ, Menke TJ, Brody BA, et al. A controlled trial of arthroscopic surgery for osteoarthritis of the knee. N Engl J Med. 2002;347(2):81-88.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12110735/',
          publishedAt: '2002-07-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'REVERSED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2008-09-11',
        datePrecision: 'DAY',
        reason: 'Kirkley and colleagues independently randomized patients with moderate-to-severe knee osteoarthritis to arthroscopic surgery plus optimized medical and physical therapy versus optimized therapy alone, finding no additional benefit from surgery at two years. The confirmatory trial entrenched the reversal in the literature and underpinned subsequent guideline recommendations against the procedure for osteoarthritis.',
        source: {
          externalId: 'src:kirkley-arthroscopy-nejm-2008',
          name: 'Kirkley A, Birmingham TB, Litchfield RB, Giffin JR, Willits KR, et al. A randomized trial of arthroscopic surgery for osteoarthritis of the knee. N Engl J Med. 2008;359(11):1097-1107.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/18784099/',
          publishedAt: '2008-09-11',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Vertebroplasty sham-controlled trials — 2009 ────────────────────────────
  {
    externalId: 'trajectory:vertebroplasty-osteoporotic-fracture-sham-trials-2009',
    text: 'Percutaneous vertebroplasty — injecting bone cement into fractured vertebrae — relieves pain from osteoporotic vertebral compression fractures, a claim contradicted by two sham-controlled trials published together in August 2009.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1997-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1997-08-01',
        datePrecision: 'MONTH',
        reason: 'After the technique\'s introduction in France in 1987, US uncontrolled case series in the late 1990s reported rapid and dramatic pain relief from injecting polymethylmethacrylate cement into osteoporotic vertebral compression fractures. Reports such as Jensen and colleagues\' 1997 series drove rapid adoption of vertebroplasty as a standard interventional treatment on the basis of before-after observational data.',
        source: {
          externalId: 'src:jensen-vertebroplasty-ajnr-1997',
          name: 'Jensen ME, Evans AJ, Mathis JM, Kallmes DF, Cloft HJ, Dion JE. Percutaneous polymethylmethacrylate vertebroplasty in the treatment of osteoporotic vertebral body compression fractures: technical aspects. AJNR Am J Neuroradiol. 1997;18(10):1897-1904.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9403451/',
          publishedAt: '1997-11-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2009-08-06',
        datePrecision: 'DAY',
        reason: 'In the same issue of the New England Journal of Medicine, Buchbinder and colleagues and Kallmes and colleagues each reported multicenter, double-blind trials randomizing patients to vertebroplasty or a sham procedure (needle placement without cement injection). Neither trial found a significant advantage for vertebroplasty in pain or disability at any time point, indicating the observed benefit was largely a placebo effect and throwing the procedure\'s efficacy into ongoing dispute.',
        source: {
          externalId: 'src:buchbinder-vertebroplasty-sham-nejm-2009',
          name: 'Buchbinder R, Osborne RH, Ebeling PR, Wark JD, Mitchell P, et al. A randomized trial of vertebroplasty for painful osteoporotic vertebral fractures. N Engl J Med. 2009;361(6):557-568.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/19657121/',
          publishedAt: '2009-08-06',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── ORBITA trial — PCI for stable angina challenged — 2017 ──────────────────
  {
    externalId: 'trajectory:orbita-pci-stable-angina-placebo-2017',
    text: 'Percutaneous coronary intervention (stenting) relieves angina symptoms in patients with stable coronary disease beyond the effect of medical therapy — a long-assumed benefit that the placebo-controlled ORBITA trial failed to confirm in 2017.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1977-09-16',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1977-09-16',
        datePrecision: 'YEAR',
        reason: 'Following Andreas Grüntzig\'s first coronary balloon angioplasty in 1977, percutaneous coronary intervention became standard for symptomatic relief of stable angina, with unblinded trials and routine practice attributing patients\' reduced angina to the mechanical opening of stenosed arteries. The symptom benefit of PCI in stable angina was widely treated as established despite the absence of placebo-controlled evidence.',
        source: {
          externalId: 'src:gruentzig-angioplasty-lancet-1978',
          name: 'Grüntzig A. Transluminal dilatation of coronary-artery stenosis. Lancet. 1978;1(8058):263.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/74678/',
          publishedAt: '1978-02-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-11-02',
        datePrecision: 'DAY',
        reason: 'Al-Lamee and colleagues ran ORBITA, the first blinded, placebo-controlled trial of PCI for stable angina, randomizing 200 patients on optimal medical therapy to stenting or a sham catheterization procedure. PCI did not improve exercise time significantly more than placebo, undermining the assumption that the symptomatic benefit of stenting in stable angina is mechanical rather than a placebo response and opening sustained debate over the procedure\'s indications.',
        source: {
          externalId: 'src:al-lamee-orbita-lancet-2018',
          name: 'Al-Lamee R, Thompson DT, Dehbi HM, Sen S, Tang K, et al. Percutaneous coronary intervention in stable angina (ORBITA): a double-blind, randomised controlled trial. Lancet. 2018;391(10115):31-40.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/29103656/',
          publishedAt: '2018-01-06',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // GLP-1 / GENE THERAPY ERA (2021–2023)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Semaglutide (Wegovy) FDA approval for obesity — 2021 ────────────────────
  {
    externalId: 'trajectory:semaglutide-wegovy-obesity-approval-2021',
    text: 'Once-weekly semaglutide 2.4 mg (Wegovy), a GLP-1 receptor agonist, produces large and sustained weight loss in adults with obesity or overweight — established by the STEP 1 trial and approved by the FDA for chronic weight management on June 4, 2021.',
    claimType: 'HYBRID',
    claimEmergedAt: '2021-02-10',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2021-02-10',
        datePrecision: 'DAY',
        reason: 'Wilding and colleagues published the STEP 1 trial, a 68-week randomized, double-blind, placebo-controlled study of once-weekly semaglutide 2.4 mg in 1,961 adults with overweight or obesity. Mean body-weight change was −14.9% with semaglutide versus −2.4% with placebo, a magnitude of weight loss not previously achieved with pharmacotherapy and approaching that of bariatric surgery, recording GLP-1 agonism as a major new obesity treatment.',
        source: {
          externalId: 'src:wilding-step1-semaglutide-nejm-2021',
          name: 'Wilding JPH, Batterham RL, Calanna S, Davies M, Van Gaal LF, et al. Once-Weekly Semaglutide in Adults with Overweight or Obesity. N Engl J Med. 2021;384(11):989-1002.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/33567185/',
          publishedAt: '2021-02-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2021-06-04',
        datePrecision: 'DAY',
        reason: 'The FDA approved Wegovy (semaglutide 2.4 mg) injection (NDA 215256) for chronic weight management in adults with obesity or with overweight and at least one weight-related comorbidity — the first new obesity drug approved since 2014. The institutional approval converted the trial evidence into an authorized indication and launched the GLP-1 obesity-drug era that reshaped the field.',
        source: {
          externalId: 'src:fda-wegovy-approval-letter-2021',
          name: 'U.S. Food and Drug Administration. Wegovy (semaglutide) injection — NDA 215256 approval letter. June 4, 2021.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/appletter/2021/215256Orig1s000ltr.pdf',
          publishedAt: '2021-06-04',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Casgevy — first CRISPR gene therapy FDA approval — 2023 ─────────────────
  {
    externalId: 'trajectory:casgevy-crispr-gene-therapy-sickle-cell-2023',
    text: 'Ex vivo CRISPR-Cas9 editing of the BCL11A enhancer in a patient\'s own hematopoietic stem cells raises fetal hemoglobin and eliminates vaso-occlusive crises in sickle cell disease — first reported in 2021 and approved by the FDA as Casgevy, the first CRISPR-based therapy, on December 8, 2023.',
    claimType: 'HYBRID',
    claimEmergedAt: '2020-12-05',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2020-12-05',
        datePrecision: 'DAY',
        reason: 'Frangoul and colleagues reported the first two patients — one with transfusion-dependent β-thalassemia and one with sickle cell disease — treated with CTX001 (later exagamglogene autotemcel), autologous CD34+ cells edited with CRISPR-Cas9 to disrupt the BCL11A erythroid enhancer and reactivate fetal hemoglobin. Both achieved transfusion independence and elimination of vaso-occlusive episodes, recording the first clinical proof that CRISPR genome editing could treat a genetic disease.',
        source: {
          externalId: 'src:frangoul-crispr-sickle-thalassemia-nejm-2021',
          name: 'Frangoul H, Altshuler D, Cappellini MD, Chen YS, Domm J, et al. CRISPR-Cas9 Gene Editing for Sickle Cell Disease and β-Thalassemia. N Engl J Med. 2021;384(3):252-260.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/33283989/',
          publishedAt: '2020-12-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2023-12-08',
        datePrecision: 'DAY',
        reason: 'The FDA approved Casgevy (exagamglogene autotemcel) for sickle cell disease in patients 12 and older with recurrent vaso-occlusive crises — the first FDA-approved therapy using CRISPR/Cas9 genome editing — alongside the gene-addition therapy Lyfgenia. In the supporting trial, 29 of 44 evaluable patients (93.5%) were free of severe vaso-occlusive crises for at least 12 consecutive months, settling CRISPR editing as a regulator-sanctioned medical treatment.',
        source: {
          externalId: 'src:fda-casgevy-sickle-cell-approval-2023',
          name: 'U.S. Food and Drug Administration. FDA Approves First Gene Therapies to Treat Patients with Sickle Cell Disease. December 8, 2023.',
          url: 'https://www.fda.gov/news-events/press-announcements/fda-approves-first-gene-therapies-treat-patients-sickle-cell-disease',
          publishedAt: '2023-12-08',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Reye syndrome — aspirin in children reversed by Surgeon General 1982 ─────
  {
    externalId: 'trajectory:reye-syndrome-aspirin-children-surgeon-general-1982',
    text: 'Following CDC studies in 1980, the U.S. Surgeon General issued an advisory on 11 June 1982 that aspirin (salicylates) given to children with influenza or chickenpox is associated with Reye syndrome, reversing aspirin\'s status as the standard pediatric antipyretic.',
    claimType: 'HYBRID',
    claimEmergedAt: '1980-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1980-01-01',
        datePrecision: 'YEAR',
        reason: 'Epidemiologic case-control studies in Ohio, Michigan, and Arizona reported in 1980 found that children who developed Reye syndrome after a respiratory or varicella infection had far higher antecedent aspirin exposure than controls. CDC began publicly cautioning physicians and parents, contesting the long-settled assumption that aspirin was a safe routine antipyretic for children.',
        source: {
          externalId: 'src:starko-reye-salicylate-pediatrics-1980',
          name: 'Starko KM, Ray CG, Dominguez LB, et al. Reye\'s syndrome and salicylate use. Pediatrics. 1980;66(6):859-864.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/7454476/',
          publishedAt: '1980-12-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1982-06-11',
        datePrecision: 'DAY',
        reason: 'The U.S. Surgeon General, via an MMWR advisory, formally warned against giving salicylate-containing medications to children with influenza or chickenpox. This institutional act settled the aspirin–Reye association as actionable public-health fact; FDA label warnings followed in 1986–1988 and U.S. Reye syndrome incidence fell more than 90%, with the steep decline serving as confirmatory evidence.',
        source: {
          externalId: 'src:mmwr-surgeon-general-salicylates-reye-1982',
          name: 'CDC. Surgeon General\'s advisory on the use of salicylates and Reye syndrome. MMWR Morb Mortal Wkly Rep. 1982;31(22):289-290.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/00001108.htm',
          publishedAt: '1982-06-11',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // DRUG DISCOVERY ERA — PRE-1950 (continued)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── N+1. Nitrogen mustard — first chemotherapy agent 1946 ────────────────────
  {
    externalId: 'trajectory:nitrogen-mustard-first-chemotherapy-1946',
    text: 'Goodman, Wintrobe, Dameshek, Gilman and colleagues reported on 21 September 1946 in JAMA that the alkylating agent nitrogen mustard (methyl-bis(beta-chloroethyl)amine hydrochloride) produces objective tumor regression in Hodgkin\'s disease, lymphosarcoma, and the leukemias, establishing the first effective chemical agent against cancer.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1946-09-21',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1946-09-21',
        datePrecision: 'DAY',
        reason: 'Goodman, Wintrobe, Dameshek, Gilman and colleagues published the declassified results of wartime work begun in 1942, reporting that nitrogen mustard caused dramatic, if temporary, regression of lymphomas and leukemias in 67 patients. This was the first published demonstration that a systemic chemical could shrink human tumors, founding the field of cancer chemotherapy.',
        source: {
          externalId: 'src:goodman-nitrogen-mustard-jama-1946',
          name: 'Goodman LS, Wintrobe MM, Dameshek W, Goodman MJ, Gilman A, McLennan MT. Nitrogen mustard therapy: use of methyl-bis(beta-chloroethyl)amine hydrochloride and tris(beta-chloroethyl)amine hydrochloride for Hodgkin\'s disease, lymphosarcoma, leukemia and certain allied and miscellaneous disorders. JAMA. 1946;132:126-132.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6368885/',
          publishedAt: '1946-09-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1949-03-15',
        datePrecision: 'DAY',
        reason: 'The FDA approved mechlorethamine (Mustargen) on 15 March 1949 for the palliative treatment of Hodgkin\'s disease, lymphosarcoma, and leukemias, making it the first chemotherapy agent ever approved by the agency. Regulatory approval converted the experimental wartime finding into an institutionally sanctioned therapy and anchored the legitimacy of cytotoxic cancer drugs.',
        source: {
          externalId: 'src:mustargen-first-fda-chemo-mdedge',
          name: 'First FDA-Approved Chemo Agent Turns 60. MDedge / Federal Practitioner. 2009 (documenting 15 March 1949 FDA approval of mechlorethamine, Mustargen).',
          url: 'https://www.mdedge.com/internalmedicine/article/15283/oncology/first-fda-approved-chemo-agent-turns-60',
          publishedAt: '2009-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── N+2. Farber aminopterin — first drug-induced leukemia remission 1948 ──────
  {
    externalId: 'trajectory:farber-aminopterin-leukemia-remission-1948',
    text: 'Sidney Farber and colleagues reported on 3 June 1948 in the New England Journal of Medicine that the folic-acid antagonist aminopterin (4-aminopteroyl-glutamic acid) produced temporary clinical and hematologic remissions in children with acute leukemia, the first demonstration of drug-induced remission in childhood leukemia.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1948-06-03',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1948-06-03',
        datePrecision: 'DAY',
        reason: 'Farber, Diamond and co-workers treated 16 children with acute leukemia using the antifolate aminopterin and documented temporary remissions — with clinical, blood-count, and bone-marrow improvement — in ten of them. Against the prevailing view that childhood leukemia was wholly untreatable, the paper recorded the first evidence that a chemical could reverse the disease, even transiently.',
        source: {
          externalId: 'src:farber-aminopterin-nejm-1948',
          name: 'Farber S, Diamond LK, Mercer RD, Sylvester RF, Wolff JA. Temporary remissions in acute leukemia in children produced by folic acid antagonist, 4-aminopteroyl-glutamic acid (aminopterin). N Engl J Med. 1948;238(23):787-793.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/18860765/',
          publishedAt: '1948-06-03',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1965-01-01',
        datePrecision: 'YEAR',
        reason: 'Over the following decade Farber\'s transient remissions were extended into durable cures: by the mid-1960s methotrexate-containing combination regimens at St. Jude and the NCI produced the first long-term survivors of childhood acute lymphoblastic leukemia. Reproducible, curative results settled the once-radical claim that drugs could control and cure leukemia, retrospectively validating the 1948 finding as the birth of chemotherapy.',
        source: {
          externalId: 'src:ash-curing-pediatric-all-history',
          name: 'American Society of Hematology. Curing Pediatric Acute Lymphocytic Leukemia (50 Years in Hematology history).',
          url: 'https://www.hematology.org/about/history/50-years/curing-pediatric-all',
          publishedAt: '2008-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── N+3. Huggins — hormonal control of prostate cancer 1941 ──────────────────
  {
    externalId: 'trajectory:huggins-hormonal-prostate-cancer-1941',
    text: 'Charles Huggins and Clarence Hodges reported in 1941 in Cancer Research that castration or estrogen administration lowers serum acid phosphatase and causes regression of metastatic prostate carcinoma while androgen injection accelerates it, establishing that a cancer can be controlled by hormonal manipulation.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1941-04-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1941-04-01',
        datePrecision: 'MONTH',
        reason: 'Huggins and Hodges used serum acid and alkaline phosphatase as tumor markers to show that removing androgenic stimulation (by castration or estrogen) shrank metastatic prostate cancer, while androgen injection worsened it. This was the first demonstration that a malignant tumor depended on hormones and could be therapeutically controlled by altering the endocrine environment — founding hormonal (endocrine) cancer therapy.',
        source: {
          externalId: 'src:huggins-hodges-prostate-cancer-1941',
          name: 'Huggins C, Hodges CV. Studies on prostatic cancer. I. The effect of castration, of estrogen and of androgen injection on serum phosphatases in metastatic carcinoma of the prostate. Cancer Res. 1941;1(4):293-297.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12050481/',
          publishedAt: '1941-04-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1966-12-10',
        datePrecision: 'DAY',
        reason: 'Huggins received the 1966 Nobel Prize in Physiology or Medicine for his discoveries concerning the hormonal treatment of prostatic cancer. The award marked institutional acceptance that androgen deprivation is a foundational, durable principle of oncology — androgen-deprivation therapy remains the backbone of advanced prostate cancer treatment to this day.',
        source: {
          externalId: 'src:huggins-nobel-historical-review-2024',
          name: 'Benadada N, et al. Charles Brenton Huggins: a historical review of the Nobel laureate\'s pioneering discoveries. Cancer. 2024;130(?):(documenting the 1966 Nobel Prize for hormonal treatment of prostatic cancer).',
          url: 'https://acsjournals.onlinelibrary.wiley.com/doi/full/10.1002/cncr.35173',
          publishedAt: '2024-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CARDIOVASCULAR EPIDEMIOLOGY & THERAPEUTICS ERA (1961–1998)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── N+5. Framingham risk-factor concept — 1961 → settled 1998 ───────────────
  {
    externalId: 'trajectory:framingham-risk-factor-concept-1961',
    text: 'In July 1961 William Kannel and colleagues of the Framingham Heart Study reported that elevated serum cholesterol, high blood pressure, and electrocardiographic left ventricular hypertrophy were \'factors of risk\' predicting the development of coronary heart disease, introducing the risk-factor concept into cardiovascular medicine.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1961-07-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1961-07-01',
        datePrecision: 'MONTH',
        reason: 'In the Annals of Internal Medicine, Kannel et al. analyzed six-year follow-up of the Framingham cohort and reported that serum cholesterol, blood pressure, and ECG-LVH each independently predicted coronary heart disease, coining the phrase \'factors of risk.\' This put on the scientific record the then-novel claim that future heart disease could be statistically forecast from measurable antecedent characteristics, shifting cardiovascular thinking from acute events toward prospective prediction.',
        source: {
          externalId: 'src:kannel-factors-of-risk-framingham-annintmed-1961',
          name: 'Kannel WB, Dawber TR, Kagan A, Revotskie N, Stokes J 3rd. Factors of risk in the development of coronary heart disease--six year follow-up experience. The Framingham Study. Ann Intern Med. 1961;55:33-50.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13751193/',
          publishedAt: '1961-07-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1998-05-12',
        datePrecision: 'DAY',
        reason: 'Wilson et al. published the Framingham multivariable risk functions in Circulation, converting the qualitative risk-factor concept into validated sex-specific scoring algorithms that estimate an individual\'s 10-year coronary heart disease probability from cholesterol, blood pressure, age, diabetes, and smoking. Adopted into NCEP ATP III and successor prevention guidelines, this operationalized the 1961 claim as settled, routine clinical practice.',
        source: {
          externalId: 'src:wilson-framingham-risk-score-circulation-1998',
          name: 'Wilson PWF, D\'Agostino RB, Levy D, Belanger AM, Silbershatz H, Kannel WB. Prediction of coronary heart disease using risk factor categories. Circulation. 1998;97(18):1837-1847.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9603539/',
          publishedAt: '1998-05-12',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── N+6. Captopril — first ACE inhibitor FDA approval 1981 → SAVE trial 1992 ─
  {
    externalId: 'trajectory:captopril-first-ace-inhibitor-approval-1981',
    text: 'On 6 April 1981 the U.S. FDA approved captopril (Capoten, E.R. Squibb, NDA 18-343), the first orally active angiotensin-converting-enzyme (ACE) inhibitor, establishing a rationally designed new drug class for treating hypertension.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1981-04-06',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1981-04-06',
        datePrecision: 'DAY',
        reason: 'The FDA approved captopril under NDA 18-343, accepting evidence that inhibiting angiotensin-converting enzyme lowers blood pressure. Designed by Ondetti, Rubin, and Cushman at Squibb from the structure of the ACE active site, it was the first ACE inhibitor and a landmark of rational drug design, but its initial indication was limited to hypertension and a hard mortality benefit had not yet been demonstrated.',
        source: {
          externalId: 'src:fda-drugsfda-captopril-capoten-nda18343',
          name: 'FDA. Drugs@FDA record for CAPOTEN (captopril), NDA 018343, original approval (ORIG-1) dated 6 April 1981 (openFDA drugsfda endpoint).',
          url: 'https://api.fda.gov/drug/drugsfda.json?search=application_number:NDA018343&limit=1',
          publishedAt: '1981-04-06',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1992-09-03',
        datePrecision: 'DAY',
        reason: 'The SAVE trial (Pfeffer et al., NEJM) randomized 2,231 post-myocardial-infarction patients with left ventricular dysfunction and found captopril significantly reduced all-cause mortality and cardiovascular events. This demonstrated a hard survival benefit beyond blood-pressure lowering, settling ACE inhibition as evidence-based standard therapy for post-MI and heart-failure patients, a status the class retains.',
        source: {
          externalId: 'src:save-captopril-pfeffer-nejm-1992',
          name: 'Pfeffer MA, Braunwald E, Moyé LA, et al. Effect of captopril on mortality and morbidity in patients with left ventricular dysfunction after myocardial infarction. Results of the Survival and Ventricular Enlargement Trial. N Engl J Med. 1992;327(10):669-677.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/1386652/',
          publishedAt: '1992-09-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── N+7. LRC-CPPT — first RCT proof cholesterol lowering prevents CHD 1984 ───
  {
    externalId: 'trajectory:lrc-cppt-cholesterol-lowering-prevents-chd-1984',
    text: 'On 20 January 1984 the Lipid Research Clinics Coronary Primary Prevention Trial reported that lowering blood cholesterol with cholestyramine reduced the incidence of coronary heart disease in hypercholesterolemic men, the first randomized proof that reducing cholesterol prevents heart disease.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1984-01-20',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1984-01-20',
        datePrecision: 'DAY',
        reason: 'The LRC-CPPT, a multicenter randomized double-blind trial in 3,806 asymptomatic men with primary hypercholesterolemia, reported in JAMA that the bile-acid sequestrant cholestyramine lowered LDL cholesterol and cut definite coronary death and nonfatal myocardial infarction by 19% versus placebo. This was the first randomized demonstration that lowering cholesterol itself reduces coronary events, putting the long-debated \'lipid hypothesis\' on the experimental record.',
        source: {
          externalId: 'src:lrc-cppt-results-jama-1984',
          name: 'Lipid Research Clinics Program. The Lipid Research Clinics Coronary Primary Prevention Trial results. I. Reduction in incidence of coronary heart disease. JAMA. 1984;251(3):351-364.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6361299/',
          publishedAt: '1984-01-20',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1985-04-12',
        datePrecision: 'DAY',
        reason: 'An NIH Consensus Development Conference, drawing heavily on the LRC-CPPT, concluded that lowering elevated blood cholesterol reduces the risk of coronary heart disease and recommended population-wide cholesterol detection and treatment. Published in JAMA, the statement launched the National Cholesterol Education Program, institutionally settling cholesterol reduction as a national cardiovascular-prevention strategy.',
        source: {
          externalId: 'src:nih-consensus-lowering-cholesterol-jama-1985',
          name: 'Consensus Conference. Lowering blood cholesterol to prevent heart disease. JAMA. 1985;253(14):2080-2086.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/3974099/',
          publishedAt: '1985-04-12',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── N+8. GISSI — first large-trial proof thrombolysis saves lives in MI 1986 ──
  {
    externalId: 'trajectory:gissi-streptokinase-thrombolysis-acute-mi-1986',
    text: 'On 22 February 1986 the Italian GISSI trial reported that intravenous streptokinase given during acute myocardial infarction reduced 21-day mortality by about 18%, the first large-scale proof that thrombolytic therapy saves lives in heart attack.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1986-02-22',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1986-02-22',
        datePrecision: 'DAY',
        reason: 'The GISSI Collaborative Group\'s randomized trial in 11,806 patients, published in the Lancet, showed that intravenous streptokinase within 12 hours of acute MI significantly reduced in-hospital mortality, with the largest benefit when given early. This recorded the first unambiguous large-trial evidence that dissolving the coronary thrombus — not merely managing the infarct — reduces death, validating the thrombolytic/\'open-artery\' strategy.',
        source: {
          externalId: 'src:gissi-streptokinase-lancet-1986',
          name: 'Gruppo Italiano per lo Studio della Streptochinasi nell\'Infarto Miocardico (GISSI). Effectiveness of intravenous thrombolytic treatment in acute myocardial infarction. Lancet. 1986;1(8478):397-402.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2868337/',
          publishedAt: '1986-02-22',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1988-08-13',
        datePrecision: 'DAY',
        reason: 'The ISIS-2 trial confirmed and extended GISSI, showing streptokinase and aspirin each reduced vascular mortality in suspected acute MI and were additive together. The convergent results from two very large randomized trials settled thrombolysis as standard global treatment for acute myocardial infarction throughout the pre-angioplasty era.',
        source: {
          externalId: 'src:isis2-aspirin-streptokinase-lancet-1988-gissi-confirm',
          name: 'ISIS-2 (Second International Study of Infarct Survival) Collaborative Group. Randomised trial of intravenous streptokinase, oral aspirin, both, or neither among 17,187 cases of suspected acute myocardial infarction: ISIS-2. Lancet. 1988;2(8607):349-360.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2899772/',
          publishedAt: '1988-08-13',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── N+9. Physicians' Health Study — aspirin primary prevention 1988 → contested 2018 ─
  {
    externalId: 'trajectory:physicians-health-study-aspirin-primary-prevention-1988',
    text: 'On 28 January 1988 the Physicians\' Health Study reported that low-dose aspirin (325 mg every other day) reduced the risk of a first myocardial infarction by 44% in healthy middle-aged men, establishing aspirin for the primary prevention of heart attack.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1988-01-28',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1988-01-28',
        datePrecision: 'DAY',
        reason: 'The Steering Committee of the Physicians\' Health Study Research Group published a preliminary report in the NEJM after the aspirin arm of the 22,071-physician randomized trial was stopped early: aspirin produced a 44% reduction in first myocardial infarction. This recorded the claim that aspirin could prevent a first heart attack in apparently healthy people, distinct from its established use in treating acute events.',
        source: {
          externalId: 'src:physicians-health-study-aspirin-nejm-1988',
          name: 'Steering Committee of the Physicians\' Health Study Research Group. Preliminary report: findings from the aspirin component of the ongoing Physicians\' Health Study. N Engl J Med. 1988;318(4):262-264.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/3275899/',
          publishedAt: '1988-01-28',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-10-18',
        datePrecision: 'DAY',
        reason: 'The ASPREE trial (McNeil et al., NEJM) randomized 19,114 healthy older adults and found that low-dose aspirin did not reduce cardiovascular events while significantly increasing major hemorrhage, echoing the contemporaneous ARRIVE results. Together these contested routine aspirin for primary prevention, prompting guidelines (including 2019 ACC/AHA) to walk back broad recommendations — though aspirin\'s benefit in secondary prevention and acute MI remained settled.',
        source: {
          externalId: 'src:aspree-aspirin-healthy-elderly-nejm-2018',
          name: 'McNeil JJ, Wolfe R, Woods RL, et al. Effect of aspirin on cardiovascular events and bleeding in the healthy elderly. N Engl J Med. 2018;379(16):1509-1518.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/30221597/',
          publishedAt: '2018-10-18',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── N+4. Papanicolaou vaginal smear — first cancer screening test 1943 ────────
  {
    externalId: 'trajectory:papanicolaou-vaginal-smear-cancer-screening-1943',
    text: 'George Papanicolaou and Herbert Traut published in 1943 the monograph \'Diagnosis of Uterine Cancer by the Vaginal Smear\', establishing that exfoliative cytology of a vaginal/cervical smear can detect uterine cancer and its precursors before symptoms appear.',
    claimType: 'HYBRID',
    claimEmergedAt: '1943-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1943-01-01',
        datePrecision: 'YEAR',
        reason: 'After several years of collaborative study, Papanicolaou and Traut published a Commonwealth Fund monograph correlating cytologic smear findings with 179 cases of uterine cancer, demonstrating that malignant and premalignant cervical cells could be identified microscopically. This recorded the claim that a simple smear could diagnose uterine cancer cytologically, launching the modern era of cytopathology and population cancer screening.',
        source: {
          externalId: 'src:papanicolaou-traut-vaginal-smear-1943',
          name: 'Papanicolaou GN, Traut HF. Diagnosis of Uterine Cancer by the Vaginal Smear. New York: The Commonwealth Fund; 1943.',
          url: 'https://wellcomecollection.org/works/ccycn3cz',
          publishedAt: '1943-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1957-01-01',
        datePrecision: 'YEAR',
        reason: 'During the 1950s the American Cancer Society and National Cancer Institute endorsed and promoted the Papanicolaou (Pap) test, driving its adoption as routine cervical cancer screening by the 1960s. Institutional endorsement and mass population screening — followed by dramatic declines in cervical cancer mortality — settled the smear as the first widely successful cancer screening test.',
        source: {
          externalId: 'src:history-cervical-screening-pap-jogc',
          name: 'The History of Cervical Screening I: The Pap Test. Journal of Obstetrics and Gynaecology Canada (documenting ACS/NCI endorsement and adoption of Pap screening through the 1950s-60s).',
          url: 'https://www.jogc.com/article/S0849-5831(16)31416-1/pdf',
          publishedAt: '2016-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },


  // ═══════════════════════════════════════════════════════════════════════════════
  // ANTIBIOTIC RESISTANCE & EMERGING PATHOGENS ERA (1997–2000)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── N+5. VISA — vancomycin-intermediate S. aureus 1997 ──────────────────────
  {
    externalId: 'trajectory:visa-vancomycin-intermediate-saureus-1997',
    text: 'In 1997, Staphylococcus aureus strains with reduced (intermediate) susceptibility to vancomycin emerged independently in Japan and the United States, breaching the antibiotic widely regarded as the last reliable treatment for methicillin-resistant S. aureus (MRSA).',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1997-08-22',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1997-08-22',
        datePrecision: 'DAY',
        reason: 'The CDC reported in MMWR the first U.S. clinical isolate of S. aureus with reduced susceptibility to vancomycin (VISA; vancomycin MIC=8 µg/mL), from a Michigan dialysis patient. This was the first formal institutional recognition in the United States that the glycopeptide of last resort against MRSA was beginning to fail, converting a long-feared theoretical risk into a documented clinical fact.',
        source: {
          externalId: 'src:cdc-mmwr-visa-us-1997',
          name: 'CDC. Staphylococcus aureus with Reduced Susceptibility to Vancomycin — United States, 1997. MMWR Morb Mortal Wkly Rep. 1997 Aug 22;46(33):765-766.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/00049042.htm',
          publishedAt: '1997-08-22',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1997-12-06',
        datePrecision: 'DAY',
        reason: 'Kotaro Hiramatsu and colleagues reported in The Lancet that S. aureus strains heterogeneously resistant to vancomycin were already disseminated across Japanese hospitals (20% of MRSA isolates at one university hospital), following their earlier isolation of strain Mu50. The combination of independent Japanese and U.S. findings established VISA as a real, spreading phenomenon rather than an isolated curiosity, settling reduced vancomycin susceptibility in S. aureus as an established clinical reality.',
        source: {
          externalId: 'src:hiramatsu-lancet-visa-1997',
          name: 'Hiramatsu K, Aritaka N, Hanaki H, et al. Dissemination in Japanese hospitals of strains of Staphylococcus aureus heterogeneously resistant to vancomycin. Lancet. 1997 Dec 6;350(9092):1670-1673.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9400512/',
          publishedAt: '1997-12-06',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── N+6. Trovafloxacin (Trovan) hepatotoxicity — approved 1997, restricted 1999 ─
  {
    externalId: 'trajectory:trovafloxacin-trovan-hepatotoxicity-1999',
    text: 'The broad-spectrum fluoroquinolone antibiotic trovafloxacin (Trovan), FDA-approved on December 18, 1997 for numerous serious infections, was sharply restricted by the FDA on June 9, 1999 after post-marketing surveillance linked it to severe idiosyncratic liver injury, and was withdrawn from major markets later that year.',
    claimType: 'HYBRID',
    claimEmergedAt: '1997-12-18',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1997-12-18',
        datePrecision: 'DAY',
        reason: 'The FDA approved trovafloxacin tablets (NDA 20-759) and the IV prodrug alatrofloxacin (NDA 20-760) for once-daily treatment of a wide range of serious infections including nosocomial and community-acquired pneumonia and intra-abdominal infections. Phase III trials established efficacy, and Trovan was institutionally settled as a safe, effective broad-spectrum antibiotic and launched by Pfizer in February 1998.',
        source: {
          externalId: 'src:fda-trovan-approval-1997',
          name: 'FDA. Drug Approval Package: Trovan (trovafloxacin mesylate) / alatrofloxacin, NDA 020759/020760. Approved December 18, 1997.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/nda/97/020760a.cfm',
          publishedAt: '1997-12-18',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '1999-06-09',
        datePrecision: 'DAY',
        reason: 'Following more than 100 post-marketing reports of acute liver injury — including 14 cases of acute liver failure with deaths and transplants — the FDA issued a public health advisory restricting trovafloxacin to inpatient use for life- or limb-threatening infections only. The drug\'s safety profile, presumed settled at approval, was reversed by spontaneous adverse-event surveillance; marketing authorization was suspended in Europe in 1999 and the FDA withdrew it in 2000.',
        source: {
          externalId: 'src:jama-trovan-advisory-1999',
          name: 'Nightingale SL (From the Food and Drug Administration). Trovafloxacin Public Health Advisory. JAMA. 1999;282(8):722.',
          url: 'https://jamanetwork.com/journals/jama/fullarticle/1842429',
          publishedAt: '1999-08-25',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── N+7. Prevnar PCV7 — first pneumococcal conjugate vaccine for infants 2000 ──
  {
    externalId: 'trajectory:prevnar-pcv7-pneumococcal-conjugate-vaccine-2000',
    text: 'The 7-valent pneumococcal conjugate vaccine (Prevnar/PCV7) was shown in the Northern California Kaiser Permanente trial to be ~97% efficacious against invasive pneumococcal disease in infants, and the FDA licensed it in February 2000 as the first pneumococcal vaccine effective in children under two years of age.',
    claimType: 'HYBRID',
    claimEmergedAt: '1999-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1999-01-01',
        datePrecision: 'YEAR',
        reason: 'The double-blind Northern California Kaiser Permanente Efficacy Trial, enrolling 37,868 infants, reported in an interim analysis that the heptavalent CRM197 pneumococcal conjugate vaccine prevented invasive disease caused by vaccine serotypes with ~97% efficacy, prompting early termination of the controlled phase. For the first time, a pneumococcal vaccine was shown to protect children under two, the group at highest risk and unresponsive to the older polysaccharide vaccine.',
        source: {
          externalId: 'src:black-kaiser-pcv7-pediatric-research-1999',
          name: 'Black S, Shinefield H, et al. Efficacy of Heptavalent Conjugate Pneumococcal Vaccine in 7,000 Infants and Children: Results of the Northern California Kaiser Permanente Efficacy Trial. Pediatric Research. 1999;45:147A.',
          url: 'https://www.nature.com/articles/pr19991046',
          publishedAt: '1999-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2000-02-17',
        datePrecision: 'DAY',
        reason: 'The FDA licensed Prevnar (Wyeth Lederle) for active immunization of infants and toddlers against invasive pneumococcal disease, and the pivotal trial was published in full (Black et al., Pediatr Infect Dis J, March 2000) showing 97.4% efficacy against vaccine-serotype invasive disease. ACIP subsequently recommended universal infant vaccination, settling PCV7 as standard pediatric immunization.',
        source: {
          externalId: 'src:fda-prevnar-pcv7-license-2000',
          name: 'FDA. Pneumococcal 7-valent Conjugate Vaccine (Diphtheria CRM197 Protein) — Prevnar. Licensed February 2000.',
          url: 'https://www.fda.gov/vaccines-blood-biologics/pneumococcal-7-valent-conjugate-vaccine-diphtheria-crm197-protein',
          publishedAt: '2000-02-17',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PSYCHOPHARMACOLOGY & NEURO ERA (2021–2024)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Zuranolone (Zurzuvae) — first oral PPD treatment 2023 ───────────────────
  {
    externalId: 'trajectory:zuranolone-zurzuvae-postpartum-depression-approval-2023',
    text: 'On August 4, 2023, the FDA approved zuranolone (Zurzuvae), a neuroactive-steroid GABA-A modulator, as the first oral treatment for postpartum depression, while simultaneously issuing a Complete Response Letter declining approval for major depressive disorder.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2023-08-04',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2023-08-04',
        datePrecision: 'DAY',
        reason: 'The FDA approved zuranolone as the first oral, 14-day course for postpartum depression, establishing institutional acceptance of a rapid-acting neurosteroid antidepressant for that narrow indication. On the same day, the agency issued a Complete Response Letter for the broader major-depressive-disorder application, finding the evidence insufficient. The split decision is epistemically significant: the same molecule\'s efficacy was institutionally settled for PPD but rejected for general depression, illustrating indication-specific evidentiary thresholds.',
        source: {
          externalId: 'src:fda-zurzuvae-approval-2023',
          name: 'U.S. Food and Drug Administration. FDA Approves First Oral Treatment for Postpartum Depression. August 4, 2023.',
          url: 'https://www.fda.gov/news-events/press-announcements/fda-approves-first-oral-treatment-postpartum-depression',
          publishedAt: '2023-08-04',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Serotonin theory of depression — umbrella review 2022 ───────────────────
  {
    externalId: 'trajectory:serotonin-theory-depression-umbrella-review-2022',
    text: 'On July 20, 2022, Moncrieff and colleagues published a systematic umbrella review in Molecular Psychiatry concluding there is no consistent evidence that depression is caused by low serotonin, directly challenging the \'chemical imbalance\' rationale long used to explain SSRI antidepressants.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2022-07-20',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2022-07-20',
        datePrecision: 'DAY',
        reason: 'Moncrieff et al. synthesized the major strands of serotonin-depression research (CSF metabolites, receptor and transporter imaging, tryptophan-depletion studies, gene–environment interactions) and concluded none provided consistent support for the low-serotonin hypothesis. This formally recorded into the peer-reviewed literature a systematic refutation of the popular chemical-imbalance account that had underpinned public messaging about SSRIs since the 1990s.',
        source: {
          externalId: 'src:moncrieff-serotonin-umbrella-review-2022',
          name: 'Moncrieff J, Cooper RE, Stockmann T, Amendola S, Hengartner MP, Horowitz MA. The serotonin theory of depression: a systematic umbrella review of the evidence. Molecular Psychiatry. 2023;28(8):3243-3256.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/35854107/',
          publishedAt: '2022-07-20',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Psilocybin COMP360 phase 2b trial — treatment-resistant depression 2022 ──
  {
    externalId: 'trajectory:psilocybin-treatment-resistant-depression-trial-2022',
    text: 'On November 3, 2022, Goodwin and colleagues published in the New England Journal of Medicine the COMP360 phase 2b trial showing that a single 25-mg dose of synthetic psilocybin, with psychological support, significantly reduced depression scores at three weeks in treatment-resistant depression.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2022-11-03',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'RECORDED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2022-11-03',
        datePrecision: 'DAY',
        reason: 'This was the largest randomized, controlled, dose-ranging trial of psilocybin for treatment-resistant depression to date, recording into the top-tier literature evidence that a single high dose produced rapid antidepressant effects superior to a 1-mg comparator. It also documented durability limits and adverse events (suicidal ideation in some participants), marking psilocybin\'s transition from fringe/exploratory to a recorded, evidence-backed therapeutic candidate without yet establishing settled efficacy or approval.',
        source: {
          externalId: 'src:goodwin-psilocybin-trd-nejm-2022',
          name: 'Goodwin GM, Aaronson ST, Alvarez O, et al. Single-Dose Psilocybin for a Treatment-Resistant Episode of Major Depression. N Engl J Med. 2022;387(18):1637-1648.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/36322843/',
          publishedAt: '2022-11-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── MDMA-assisted therapy for PTSD — phase 3 → FDA rejection 2024 ───────────
  {
    externalId: 'trajectory:mdma-assisted-therapy-ptsd-fda-rejection-2024',
    text: 'Positive phase 3 evidence that MDMA-assisted therapy treats severe PTSD (Mitchell et al., Nature Medicine, 2021) was institutionally rejected when the FDA issued a Complete Response Letter to Lykos Therapeutics on August 8, 2024, declining approval and requiring an additional phase 3 trial.',
    claimType: 'HYBRID',
    claimEmergedAt: '2021-05-10',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2021-05-10',
        datePrecision: 'DAY',
        reason: 'The MAPP1 randomized, double-blind, placebo-controlled phase 3 trial reported that MDMA-assisted therapy significantly reduced PTSD symptoms versus placebo with therapy in patients with severe PTSD. Published online in Nature Medicine, it recorded the first phase 3-level evidence for a psychedelic-assisted psychotherapy, positioning MDMA for an anticipated regulatory approval.',
        source: {
          externalId: 'src:mitchell-mdma-ptsd-phase3-natmed-2021',
          name: 'Mitchell JM, Bogenschutz M, Lilienstein A, et al. MDMA-assisted therapy for severe PTSD: a randomized, double-blind, placebo-controlled phase 3 study. Nat Med. 2021;27(6):1025-1033.',
          url: 'https://doi.org/10.1038/s41591-021-01336-3',
          publishedAt: '2021-05-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '2024-08-08',
        datePrecision: 'DAY',
        reason: 'After an FDA advisory committee voted in June 2024 that the data did not show the treatment was effective and that benefits did not outweigh risks, the FDA issued a Complete Response Letter declining approval and requiring an additional phase 3 study. The agency cited functional unblinding, inadequate safety/abuse-event reporting, and trial-conduct and ethical concerns, institutionally contesting an efficacy claim that the published literature had treated as established.',
        source: {
          externalId: 'src:fda-crl-lykos-mdma-2024',
          name: 'U.S. Food and Drug Administration. Complete Response Letter, NDA 215455 (midomafetamine capsules), to Lykos Therapeutics. August 8, 2024.',
          url: 'https://download.open.fda.gov/crl/CRL_NDA215455_20240808.pdf',
          publishedAt: '2024-08-08',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── N+8. H5N1 avian influenza direct human infection — 1997 ─────────────────
  {
    externalId: 'trajectory:h5n1-avian-influenza-human-infection-1997',
    text: 'In 1997, a purely avian influenza A(H5N1) virus was isolated from a 3-year-old boy in Hong Kong who died of respiratory failure — the first documented instance of this wholly avian subtype directly infecting and killing humans, overturning the assumption that avian influenza viruses required reassortment in an intermediate host to infect people.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1997-08-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1997-12-19',
        datePrecision: 'DAY',
        reason: 'After the index virus was identified as subtype H5N1 in August 1997 by laboratories in Atlanta, Rotterdam, and London, the CDC reported in MMWR a cluster of human H5N1 infections in Hong Kong (May–December 1997), with multiple deaths. This formally documented that an avian influenza subtype was infecting humans directly from poultry — a recognized emerging public-health threat.',
        source: {
          externalId: 'src:cdc-mmwr-h5n1-hongkong-1997',
          name: 'CDC. Isolation of Avian Influenza A(H5N1) Viruses from Humans — Hong Kong, May–December 1997. MMWR Morb Mortal Wkly Rep. 1997 Dec 19;46(50):1204-1207.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9414153/',
          publishedAt: '1997-12-19',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1998-01-16',
        datePrecision: 'DAY',
        reason: 'Subbarao and colleagues published in Science the full molecular characterization of A/Hong Kong/156/97, demonstrating that all eight gene segments were of avian origin with no human-virus reassortment. This settled the previously contested possibility that a wholly avian influenza virus could cross directly into humans and cause fatal disease, reshaping pandemic-preparedness science.',
        source: {
          externalId: 'src:subbarao-science-h5n1-1998',
          name: 'Subbarao K, Klimov A, Katz J, et al. Characterization of an avian influenza A (H5N1) virus isolated from a child with a fatal respiratory illness. Science. 1998 Jan 16;279(5349):393-396.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9430591/',
          publishedAt: '1998-01-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ENDOCRINOLOGY & DIABETES ERA (pre-1950)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── von Mering & Minkowski pancreatectomy → diabetes 1889 ──────────────────
  {
    externalId: 'trajectory:minkowski-von-mering-pancreatectomy-diabetes-1889',
    text: 'Joseph von Mering and Oskar Minkowski reported in 1889–1890 (Archiv für experimentelle Pathologie und Pharmakologie) that total surgical removal of the pancreas in dogs produces severe, fatal diabetes with glycosuria, establishing that the pancreas governs carbohydrate metabolism and is the seat of the lesion in diabetes mellitus.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1889-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1890-01-01',
        datePrecision: 'YEAR',
        reason: 'After their 1889 experiments at Strassburg in which total pancreatectomy in dogs was followed within hours by glycosuria exceeding 10% and rapidly fatal diabetes, von Mering and Minkowski published their full report \'Diabetes mellitus nach Pankreasexstirpation\' in the Archiv für experimentelle Pathologie und Pharmakologie (1890;26:371–387), emphasizing that no other organ was damaged. This recorded in the expert literature the claim that the pancreas controls blood sugar and that its loss causes diabetes — the experimental foundation for the search for an internal pancreatic secretion.',
        source: {
          externalId: 'src:von-mering-minkowski-pankreasexstirpation-1890',
          name: 'von Mering J, Minkowski O. Diabetes mellitus nach Pankreasexstirpation. Archiv für experimentelle Pathologie und Pharmakologie. 1890;26:371–387.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9581824/',
          publishedAt: '1890-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1922-01-01',
        datePrecision: 'YEAR',
        reason: 'The pancreatic origin of diabetes, hypothesized from the 1889–1890 pancreatectomy work, was confirmed when Banting, Best, Collip and Macleod isolated insulin from pancreatic tissue in 1921–1922 and reversed diabetes in dogs and humans, directly demonstrating the internal secretion whose loss von Mering and Minkowski\'s experiment had implied. This settled the pancreatic-secretion model of diabetes as established physiological fact, a status it has retained.',
        source: {
          externalId: 'src:minkowski-gley-cradle-antidiabetic-review-2022',
          name: 'European research, the cradle of the discovery of the antidiabetic hormone: the pioneer roles and the relevance of Oskar Minkowski and Eugène Gley. (historical review). PMC9581824.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9581824/',
          publishedAt: '2022-10-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Janbon & Loubatières sulfonamide hypoglycemia 1942 ─────────────────────
  {
    externalId: 'trajectory:janbon-loubatieres-sulfonamide-hypoglycemia-1942',
    text: 'Marcel Janbon and Auguste Loubatières in 1942 at Montpellier reported that the sulfonamide 2254 RP (an antibacterial used for typhoid fever) causes severe, prolonged hypoglycemia that requires an intact pancreas and acts by stimulating insulin secretion, establishing that a synthetic oral drug could lower blood sugar through the pancreas — the discovery underlying the sulfonylurea class of oral antidiabetics.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1942-03-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1942-06-13',
        datePrecision: 'DAY',
        reason: 'In March 1942 Janbon attributed several deaths among typhoid patients treated with the new sulfonamide 2254 RP (VK 57) to severe prolonged hypoglycemia, and asked the physiologist Loubatières to investigate. On 13 June 1942 Loubatières observed in conscious fasting dogs that repeated oral 2254 RP produced a progressive, marked, long-lasting fall in blood glucose, and went on to show the effect required an intact pancreas and reflected stimulated insulin secretion. This recorded in the expert literature the claim that a synthetic sulfonamide could lower blood sugar via the pancreatic beta cells.',
        source: {
          externalId: 'src:janbon-2254rp-hypoglycemia-montpellier-1942',
          name: 'Janbon M, Chaptal J, Vedel A, Schaap J. Accidents hypoglycémiques graves par un sulfamidothiodiazol (le VK 57 ou 2254 RP). Montpellier Médical. 1942;441:21–22.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/34656290/',
          publishedAt: '1942-03-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1956-01-01',
        datePrecision: 'YEAR',
        reason: 'The 1942 observation became the basis of the sulfonylurea drug class: carbutamide and then tolbutamide were introduced in Germany in 1955–1956 as the first oral antidiabetic drugs marketed for type 2 diabetes, with Loubatières\' pancreatic-stimulation mechanism providing the rationale. Clinical adoption of oral sulfonylureas worldwide settled the claim that sulfonamide-derived compounds lower blood glucose through insulin secretion.',
        source: {
          externalId: 'src:lavabre-bertrand-hypoglycaemic-sulphonamides-therapie-2021',
          name: 'Lavabre-Bertrand T, Faillie JL. The discovery of hypoglycaemic sulphonamides – Montpellier, 1942. Therapie. 2021;76(6):559–566.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/34656290/',
          publishedAt: '2021-11-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Synthalin — first synthetic oral antidiabetic 1926 (REVERSED) ──────────
  {
    externalId: 'trajectory:synthalin-guanidine-oral-antidiabetic-1926',
    text: 'Ernst Frank and colleagues reported in 1926 that Synthalin (a decamethylene-diguanide), marketed by Schering AG, was an orally active synthetic drug with insulin-like glucose-lowering activity in diabetics — the first synthetic oral antidiabetic — a claim later reversed when the drug was withdrawn for hepatic and renal toxicity.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1926-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1926-01-01',
        datePrecision: 'YEAR',
        reason: 'Building on observations that guanidine derivatives lower blood glucose, Frank, Nothmann and Wagner — working in Oskar Minkowski\'s Breslau (Wroclaw) clinic — reported in 1926 that the synthetic guanidine compound Synthalin produced insulin-like hypoglycemic effects when given by mouth to normal and diabetic subjects. This recorded the claim that an orally active synthetic drug could substitute for injected insulin in managing diabetes.',
        source: {
          externalId: 'src:frank-nothmann-wagner-synthalin-klinwochenschr-1926',
          name: 'Frank E, Nothmann M, Wagner A. Über synthetisch dargestellte Körper mit insulinartiger Wirkung auf den normalen und diabetischen Organismus. Klin Wochenschr. 1926;5:2100–2107.',
          url: 'https://en.wikipedia.org/wiki/Synthalin',
          publishedAt: '1926-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'MARKET',
        occurredAt: '1927-01-01',
        datePrecision: 'YEAR',
        reason: 'Schering AG of Berlin marketed Synthalin A across Europe as a commercial oral antidiabetic with insulin-like properties, and it entered clinical use for diabetics who could not or would not take injected insulin. Commercial sale and clinical adoption established Synthalin, at the market and bedside level, as an accepted oral treatment for diabetes.',
        source: {
          externalId: 'src:synthalin-marketing-schering-wikipedia',
          name: 'Synthalin. (history of Schering AG marketing as the first synthetic oral antidiabetic). Wikipedia, with cited sources.',
          url: 'https://en.wikipedia.org/wiki/Synthalin',
          publishedAt: '1927-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'MARKET',
        occurredAt: '1940-01-01',
        datePrecision: 'YEAR',
        reason: 'Synthalin proved toxic to the liver and kidneys, with cases of fatal hepatic damage and acidosis, and — as purified injectable insulin became widely available — it was withdrawn from the market by the early 1940s. The reversal retired the first synthetic oral antidiabetic on safety grounds, leaving the field to insulin until the sulfonylureas and biguanides emerged after 1950.',
        source: {
          externalId: 'src:synthalin-withdrawal-toxicity-wikipedia',
          name: 'Synthalin. (withdrawal from market in the early 1940s due to hepatic and renal toxicity). Wikipedia, with cited sources.',
          url: 'https://en.wikipedia.org/wiki/Synthalin',
          publishedAt: '1940-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Hagedorn protamine insulin prolonged action 1936 ───────────────────────
  {
    externalId: 'trajectory:hagedorn-protamine-insulin-prolonged-action-1936',
    text: 'Hans Christian Hagedorn and colleagues reported in JAMA on 18 January 1936 that adding protamine (from trout sperm) to insulin produces \'protamine insulinate,\' a suspension whose glucose-lowering action is markedly prolonged, establishing the first clinically useful long-/intermediate-acting insulin and the principle of engineered insulin delivery.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1936-01-18',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1936-01-18',
        datePrecision: 'DAY',
        reason: 'Hagedorn, Jensen, Krarup and Wodstrup published \'Protamine insulinate\' in JAMA (1936;106:177–180), showing that combining insulin with protamine slowed its absorption and prolonged its hypoglycemic effect, after earlier attempts using gum arabic, oils, lecithin and vasoconstrictors had failed. This recorded the claim that insulin\'s duration of action could be deliberately extended by formulation, freeing diabetics from multiple daily injections.',
        source: {
          externalId: 'src:hagedorn-protamine-insulinate-jama-1936',
          name: 'Hagedorn HC, Jensen BN, Krarup NB, Wodstrup I. Protamine insulinate. JAMA. 1936;106:177–180. (Landmark reprint: JAMA. 1984;251(3):389–392; PMID 6361301.)',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6361301/',
          publishedAt: '1936-01-18',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1946-01-01',
        datePrecision: 'YEAR',
        reason: 'Hagedorn\'s protamine principle was refined into a stable neutral isophane formulation — NPH (Neutral Protamine Hagedorn) insulin — developed by Nordisk in 1946, which became the standard intermediate-acting insulin used worldwide for decades. Widespread clinical adoption of protamine-based insulins settled the claim that formulation can engineer insulin\'s duration of action.',
        source: {
          externalId: 'src:nph-insulin-prolonged-effect-review',
          name: 'Insulin Preparations with Prolonged Effect (review of protamine/NPH insulin development from Hagedorn 1936 to NPH 1946). Diabetes Technol Ther. 2011.',
          url: 'https://www.liebertpub.com/doi/10.1089/dia.2011.0068',
          publishedAt: '2011-06-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // OPIOID CRISIS ERA (1965–2018)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Dole & Nyswander methadone maintenance 1965 ────────────────────────────
  {
    externalId: 'trajectory:methadone-maintenance-heroin-addiction-1965',
    text: 'Vincent Dole and Marie Nyswander reported in JAMA on August 23, 1965, that daily oral methadone hydrochloride, administered in a stabilizing maintenance regimen, blocks heroin craving and allows people with heroin addiction to function normally — establishing addiction as a treatable medical condition rather than a purely behavioral failing.',
    claimType: 'HYBRID',
    claimEmergedAt: '1965-08-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1965-08-23',
        datePrecision: 'DAY',
        reason: 'Dole and Nyswander published their clinical trial of methadone hydrochloride in JAMA, reporting that maintenance dosing relieved narcotic hunger and allowed previously addicted patients to resume work and social function. The paper reframed heroin addiction as a metabolic medical disorder amenable to pharmacologic maintenance, entering the literature as the founding evidence for methadone maintenance treatment.',
        source: {
          externalId: 'src:dole-nyswander-methadone-jama-1965',
          name: 'Dole VP, Nyswander M. A medical treatment for diacetylmorphine (heroin) addiction. A clinical trial with methadone hydrochloride. JAMA. 1965 Aug 23;193:646-50.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/14321530/',
          publishedAt: '1965-08-23',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1972-12-15',
        datePrecision: 'DAY',
        reason: 'The FDA issued final methadone regulations on December 15, 1972 (37 FR 26790), formally authorizing methadone maintenance treatment programs and creating a closed distribution system for the drug\'s use in treating opiate addiction. Federal recognition and licensing of maintenance programs institutionally ratified the Dole-Nyswander claim, making methadone maintenance an established standard of addiction treatment.',
        source: {
          externalId: 'src:iom-federal-regulation-methadone-1972',
          name: 'Institute of Medicine. Federal Regulation of Methadone Treatment (documenting FDA final methadone regulations, 37 FR 26790, Dec. 15, 1972). National Academies Press; 1995.',
          url: 'https://www.ncbi.nlm.nih.gov/books/NBK232105/',
          publishedAt: '1972-12-15',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Portenoy & Foley opioids for chronic non-cancer pain 1986 ──────────────
  {
    externalId: 'trajectory:portenoy-foley-opioids-chronic-noncancer-pain-1986',
    text: 'Russell Portenoy and Kathleen Foley reported in the journal Pain in 1986, on the basis of 38 cases, that chronic opioid therapy can be a safe, effective, and humane treatment for selected patients with non-malignant pain, with addiction rarely developing in those without a prior substance-abuse history.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1986-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1986-01-01',
        datePrecision: 'YEAR',
        reason: 'Portenoy and Foley published a case series of 38 patients on long-term opioids for non-malignant pain, concluding that most needed only modest stable doses and that addiction was rare in patients without prior abuse histories. The paper became one of the most influential citations underpinning the liberalization of opioid prescribing for chronic non-cancer pain through the 1990s and 2000s.',
        source: {
          externalId: 'src:portenoy-foley-pain-1986',
          name: 'Portenoy RK, Foley KM. Chronic use of opioid analgesics in non-malignant pain: report of 38 cases. Pain. 1986;25(2):171-186.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2873550/',
          publishedAt: '1986-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-03-06',
        datePrecision: 'DAY',
        reason: 'Krebs and colleagues published the SPACE randomized clinical trial in JAMA on March 6, 2018, finding that opioid therapy was not superior to non-opioid medications for pain-related function over 12 months in chronic back or hip/knee osteoarthritis pain, while opioids produced more adverse effects. The rigorous randomized evidence directly contradicted the premise that opioids are a uniquely effective and benign option for chronic non-cancer pain, overturning the claim the 1986 report had helped establish.',
        source: {
          externalId: 'src:krebs-space-trial-jama-2018',
          name: 'Krebs EE, Gravely A, Nugent S, et al. Effect of Opioid vs Nonopioid Medications on Pain-Related Function in Patients With Chronic Back Pain or Hip or Knee Osteoarthritis Pain: The SPACE Randomized Clinical Trial. JAMA. 2018;319(9):872-882.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/29509867/',
          publishedAt: '2018-03-06',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Pain as the fifth vital sign 1996 ──────────────────────────────────────
  {
    externalId: 'trajectory:pain-fifth-vital-sign-1996',
    text: 'The American Pain Society introduced \'pain as the fifth vital sign\' in 1996, the doctrine that pain should be routinely measured and treated alongside temperature, pulse, respiration, and blood pressure — a standard subsequently adopted across U.S. health care and later judged to have driven opioid overprescribing.',
    claimType: 'HYBRID',
    claimEmergedAt: '1996-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1996-01-01',
        datePrecision: 'YEAR',
        reason: 'The American Pain Society introduced the phrase \'pain as the fifth vital sign\' in 1996, arguing that systematic pain assessment at every clinical encounter would correct the undertreatment of pain. The slogan entered professional discourse as a quality-of-care reform.',
        source: {
          externalId: 'src:joint-commission-opioid-blame-pmc-2018',
          name: 'Baker DW. History of The Joint Commission\'s Pain Standards: Lessons for Today\'s Prescription Opioid Epidemic / commentary documenting APS 1996 introduction of \'pain as the fifth vital sign.\' PMC6139759.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6139759/',
          publishedAt: '2018-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2000-10-01',
        datePrecision: 'MONTH',
        reason: 'The Veterans Health Administration issued its \'Pain as the 5th Vital Sign\' directive (March 1, 1999) and published the implementing toolkit in October 2000, mandating numeric pain scores at clinical encounters; the Joint Commission\'s 2001 pain-management standards extended routine pain assessment across accredited U.S. hospitals. Institutional adoption made the doctrine an enforced standard of care nationwide.',
        source: {
          externalId: 'src:va-pain-fifth-vital-sign-toolkit-2000',
          name: 'Veterans Health Administration, National Pain Management Coordinating Committee. Pain as the 5th Vital Sign Toolkit (Revised Edition). October 2000.',
          url: 'https://www.va.gov/painmanagement/docs/toolkit.pdf',
          publishedAt: '2000-10-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-06-01',
        datePrecision: 'MONTH',
        reason: 'Mularski and colleagues reported in the Journal of General Internal Medicine that routinely measuring pain as the fifth vital sign did not improve the quality of pain management in a VA study, providing empirical evidence that the assessment mandate failed to deliver its intended benefit and first calling the doctrine into question.',
        source: {
          externalId: 'src:mularski-fifth-vital-sign-jgim-2006',
          name: 'Mularski RA, White-Chu F, Overbay D, Miller L, Asch SM, Ganzini L. Measuring pain as the 5th vital sign does not improve quality of pain management. J Gen Intern Med. 2006 Jun;21(6):607-612.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1924634/',
          publishedAt: '2006-06-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2016-06-01',
        datePrecision: 'MONTH',
        reason: 'In June 2016 the American Medical Association House of Delegates adopted a recommendation that \'pain as the fifth vital sign\' be removed from professional standards and usage, concluding that the initiative had contributed to the opioid epidemic by encouraging overprescribing. The formal repudiation by organized medicine reversed the doctrine that had been institutional standard for over a decade.',
        source: {
          externalId: 'src:ama-drops-pain-fifth-vital-sign-2016',
          name: 'American Medical Association House of Delegates action, June 2016: \'Pain is not a vital sign—let\'s not treat it as one, AMA says.\' The DO (American Osteopathic Association), July 2016.',
          url: 'https://thedo.osteopathic.org/2016/07/pain-is-not-a-vital-sign-lets-not-treat-it-as-one-ama-says/',
          publishedAt: '2016-07-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Buprenorphine office-based opioid treatment 2002 ───────────────────────
  {
    externalId: 'trajectory:buprenorphine-office-based-opioid-treatment-2002',
    text: 'The FDA approved buprenorphine (Subutex) and buprenorphine/naloxone (Suboxone) sublingual tablets for the treatment of opioid dependence on October 8, 2002, the first opioid-dependence medications eligible for prescribing in office-based settings under the Drug Addiction Treatment Act of 2000.',
    claimType: 'HYBRID',
    claimEmergedAt: '2002-10-08',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2000-10-17',
        datePrecision: 'DAY',
        reason: 'The Drug Addiction Treatment Act of 2000 (Title XXXV of the Children\'s Health Act, Pub. L. 106-310), signed October 17, 2000, authorized qualified physicians to prescribe Schedule III-V narcotics for opioid-dependence treatment in office-based settings, breaking from the closed methadone-clinic model. The law recorded a new institutional premise: that opioid addiction could be treated in routine medical practice.',
        source: {
          externalId: 'src:buprenorphine-fda-history-pmc-2023',
          name: 'Campbell ND, et al. History of the discovery, development, and FDA-approval of buprenorphine medications for the treatment of opioid use disorder (documenting DATA 2000, Pub. L. 106-310). PMC10040330.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10040330/',
          publishedAt: '2023-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2002-10-08',
        datePrecision: 'DAY',
        reason: 'On October 8, 2002, the FDA approved Subutex (buprenorphine) and Suboxone (buprenorphine/naloxone) sublingual tablets for opioid dependence — the first and only Schedule III-V medications eligible for office-based use under DATA 2000. Regulatory approval ratified buprenorphine maintenance as an established treatment, expanding medication-assisted treatment beyond the methadone-clinic system.',
        source: {
          externalId: 'src:dea-buprenorphine-drug-info',
          name: 'U.S. Drug Enforcement Administration. Buprenorphine (Trade Names: Buprenex, Suboxone, Subutex) drug information sheet (FDA approval for opioid dependence, October 8, 2002).',
          url: 'https://www.deadiversion.usdoj.gov/drug_chem_info/buprenorphine.pdf',
          publishedAt: '2002-10-08',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PEDIATRIC & GENE THERAPY ERA (2015–2023)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Zolgensma FDA approval — gene therapy for SMA 2019 ─────────────────────
  {
    externalId: 'trajectory:zolgensma-onasemnogene-gene-therapy-sma-2019',
    text: 'On 24 May 2019 the US FDA approved Zolgensma (onasemnogene abeparvovec-xioi), a one-time intravenous AAV9 gene-replacement therapy, for children under 2 years of age with spinal muscular atrophy, establishing it as a clinically effective single-dose treatment addressing the genetic root cause of SMA.',
    claimType: 'HYBRID',
    claimEmergedAt: '2019-05-24',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2019-05-24',
        datePrecision: 'DAY',
        reason: 'The FDA approved onasemnogene abeparvovec for SMA patients under 2, the first systemic gene-replacement therapy for a pediatric genetic disease and (at ~$2.1M) the most expensive drug ever. The approval converted a one-time gene delivery from experimental claim to an established regulatory standard of care, validating in-vivo AAV gene therapy as a pediatric treatment modality alongside the antisense drug nusinersen.',
        source: {
          externalId: 'src:novartis-zolgensma-fda-approval-2019',
          name: 'Novartis (AveXis). AveXis receives FDA approval for Zolgensma, the first and only gene therapy for pediatric patients with spinal muscular atrophy (SMA). Media release. 24 May 2019.',
          url: 'https://www.novartis.com/news/media-releases/avexis-receives-fda-approval-zolgensma-first-and-only-gene-therapy-pediatric-patients-spinal-muscular-atrophy-sma',
          publishedAt: '2019-05-24',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Hanna-Attisha Flint childhood blood lead elevation 2015 ─────────────────
  {
    externalId: 'trajectory:hanna-attisha-flint-childhood-blood-lead-2015',
    text: 'On 24 September 2015 pediatrician Mona Hanna-Attisha presented (and subsequently published in the American Journal of Public Health, February 2016) analysis showing the proportion of Flint, Michigan children under 5 with elevated blood lead levels rose from 2.4% to 4.9% after the city switched to corrosive Flint River water in 2014.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2015-09-24',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2016-02-01',
        datePrecision: 'MONTH',
        reason: 'Hanna-Attisha and colleagues published a peer-reviewed spatial analysis in the American Journal of Public Health demonstrating a near-doubling of pediatric elevated blood lead incidence (and a tripling in high-water-lead neighborhoods) after the 2014 source switch. The publication converted an initially state-dismissed clinical alarm into a documented epidemiological finding, contradicting Michigan officials who had publicly denied any lead problem.',
        source: {
          externalId: 'src:hanna-attisha-flint-ajph-2016',
          name: 'Hanna-Attisha M, LaChance J, Sadler RC, Champney Schnepp A. Elevated Blood Lead Levels in Children Associated With the Flint Drinking Water Crisis: A Spatial Analysis of Risk and Public Health Response. Am J Public Health. 2016;106(2):283-290. PMID 26691115.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4985856/',
          publishedAt: '2016-02-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2016-06-24',
        datePrecision: 'DAY',
        reason: 'The CDC published its own MMWR analysis confirming that blood lead levels among Flint children rose during the period of Flint River water use and declined after the switch back to Detroit water, institutionally ratifying Hanna-Attisha\'s finding. Federal confirmation cemented the Flint pediatric lead exposure as established public-health fact and a reference case for childhood environmental lead policy.',
        source: {
          externalId: 'src:cdc-mmwr-flint-blood-lead-2016',
          name: 'Kennedy C, Yard E, Dignam T, et al. Blood Lead Levels Among Children Aged <6 Years — Flint, Michigan, 2013–2016. MMWR Morb Mortal Wkly Rep. 2016;65(25):650-654.',
          url: 'https://www.cdc.gov/mmwr/volumes/65/wr/mm6525e1.htm',
          publishedAt: '2016-06-24',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Nirsevimab (Beyfortus) FDA approval — infant RSV prevention 2023 ────────
  {
    externalId: 'trajectory:nirsevimab-beyfortus-infant-rsv-prevention-2023',
    text: 'On 17 July 2023 the US FDA approved Beyfortus (nirsevimab-alip), a single-dose long-acting monoclonal antibody, for the prevention of RSV lower respiratory tract disease in all newborns and infants entering their first RSV season, establishing passive immunization against RSV as a routine infant preventive.',
    claimType: 'HYBRID',
    claimEmergedAt: '2023-07-17',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2023-07-17',
        datePrecision: 'DAY',
        reason: 'The FDA approved nirsevimab for prevention of RSV lower respiratory tract disease in infants in their first RSV season and in vulnerable children up to 24 months, based on trials showing roughly 70–75% reduction in medically attended RSV. The approval recorded the first broadly indicated immunization-style product protecting all infants (not just high-risk preterm babies, as the older antibody palivizumab did) against the leading cause of infant hospitalization.',
        source: {
          externalId: 'src:sanofi-beyfortus-fda-approval-2023',
          name: 'Sanofi. Press Release: FDA approves Beyfortus (nirsevimab-alip) to protect infants against RSV disease. 17 July 2023.',
          url: 'https://www.news.sanofi.us/2023-07-17-FDA-approves-Beyfortus-TM-nirsevimab-alip-to-protect-infants-against-RSV-disease',
          publishedAt: '2023-07-17',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2023-08-03',
        datePrecision: 'DAY',
        reason: 'The CDC\'s Advisory Committee on Immunization Practices recommended nirsevimab for all infants younger than 8 months entering their first RSV season and for certain high-risk children 8–19 months, incorporating it into the childhood immunization schedule and the Vaccines for Children program. ACIP adoption moved nirsevimab from an approved product to a universally recommended element of routine infant preventive care.',
        source: {
          externalId: 'src:cdc-mmwr-nirsevimab-acip-2023',
          name: 'Jones JM, Fleming-Dutra KE, Prill MM, et al. Use of Nirsevimab for the Prevention of RSV Disease Among Infants and Young Children: Recommendations of the ACIP — United States, 2023. MMWR Morb Mortal Wkly Rep. 2023;72(34):920-925.',
          url: 'https://www.cdc.gov/mmwr/volumes/72/wr/mm7234a4.htm',
          publishedAt: '2023-08-25',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── FDA EUA Pfizer COVID vaccine — children 5–11 2021 ───────────────────────
  {
    externalId: 'trajectory:fda-eua-pfizer-covid-vaccine-children-5-11-2021',
    text: 'On 29 October 2021 the US FDA authorized emergency use of the Pfizer-BioNTech COVID-19 vaccine, at a 10-µg two-dose regimen, for children 5 through 11 years of age — the first COVID-19 vaccine made available to US elementary-school-age children, with reported efficacy of 90.7%.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2021-10-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2021-10-29',
        datePrecision: 'DAY',
        reason: 'Following an overwhelmingly favorable advisory committee vote, the FDA issued an Emergency Use Authorization extending the Pfizer-BioNTech vaccine to children 5–11 at a reduced 10-µg dose, citing 90.7% efficacy in a ~3,100-child trial. Days later the CDC/ACIP recommended it, settling pediatric COVID-19 vaccination as authorized institutional practice even as it remained publicly contested over uptake and necessity in low-risk children.',
        source: {
          externalId: 'src:fda-eua-covid-vaccine-children-5-11-2021',
          name: 'US FDA. FDA Authorizes Pfizer-BioNTech COVID-19 Vaccine for Emergency Use in Children 5 through 11 Years of Age. Press announcement. 29 October 2021.',
          url: 'https://www.fda.gov/news-events/press-announcements/fda-authorizes-pfizer-biontech-covid-19-vaccine-emergency-use-children-5-through-11-years-age',
          publishedAt: '2021-10-29',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CHEMOTHERAPY ERA (pre-1950) / EARLY PHARMACOLOGY
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Ehrlich & Hata — Salvarsan / arsphenamine 1910 ──────────────────────────
  {
    externalId: 'trajectory:ehrlich-hata-salvarsan-syphilis-1910',
    text: 'Paul Ehrlich and Sahachiro Hata announced on 19 April 1910 at the Congress for Internal Medicine in Wiesbaden that arsphenamine (compound \'606\', marketed as Salvarsan) cures experimental and human syphilis caused by Treponema pallidum, establishing the first deliberately designed effective chemotherapeutic agent — the original \'magic bullet\'.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1910-04-19',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1910-04-19',
        datePrecision: 'DAY',
        reason: 'At the Wiesbaden Congress for Internal Medicine, Ehrlich and Hata reported that arsenical compound 606 (arsphenamine) eradicated spirochaetes in animals and early human syphilis cases. This was the first agent rationally selected from a chemical screen to kill a specific pathogen without killing the host, founding the discipline of chemotherapy.',
        source: {
          externalId: 'src:williams-arsphenamine-magic-bullet-jrsm-2009',
          name: 'Williams KJ. The introduction of \'chemotherapy\' using arsphenamine — the first magic bullet. J R Soc Med. 2009;102(8):343–348. (PMC2726818)',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2726818/',
          publishedAt: '2009-08-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'MARKET',
        occurredAt: '1910-12-31',
        datePrecision: 'YEAR',
        reason: 'Hoechst marketed Salvarsan from 1910; by the end of that year roughly 65,000 doses had been administered to more than 20,000 patients worldwide, and it rapidly became the standard treatment for syphilis until penicillin superseded it in the 1940s. Rapid clinical and commercial adoption settled the efficacy claim across the medical community.',
        source: {
          externalId: 'src:bosch-rosich-ehrlich-pharmacology-2008',
          name: 'Bosch F, Rosich L. The contributions of Paul Ehrlich to pharmacology: a tribute on the occasion of the centenary of his Nobel Prize. Pharmacology. 2008;82(3):171–179. (PMC2790789)',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2790789/',
          publishedAt: '2008-10-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Minot & Murphy — liver therapy pernicious anemia 1926 ───────────────────
  {
    externalId: 'trajectory:minot-murphy-liver-therapy-pernicious-anemia-1926',
    text: 'George Minot and William Murphy reported in JAMA on 14 August 1926 that a special diet rich in liver produces prompt remission in patients with pernicious anemia, converting a previously uniformly fatal disease into a treatable one.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1926-08-14',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1926-08-14',
        datePrecision: 'DAY',
        reason: 'Minot and Murphy reported that feeding large quantities of liver induced reticulocyte responses and clinical remission in 45 consecutive patients with pernicious anemia. This was the first effective therapy for a disease that had been invariably fatal, and it later led to the isolation of vitamin B12.',
        source: {
          externalId: 'src:minot-murphy-liver-pernicious-anemia-jama-1926',
          name: 'Minot GR, Murphy WP. Treatment of pernicious anemia by a special diet. JAMA. 1926;87(7):470–476. (Full-text reprint: Yale J Biol Med. 2001;74(5):341–353, PMC2588744)',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2588744/',
          publishedAt: '1926-08-14',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1934-12-10',
        datePrecision: 'DAY',
        reason: 'The Nobel Prize in Physiology or Medicine 1934 was awarded jointly to George Whipple, George Minot, and William Murphy for their discoveries concerning liver therapy in anemias. The award marked institutional acceptance that dietary/liver therapy was a genuine cure for pernicious anemia.',
        source: {
          externalId: 'src:nobel-medicine-1934-liver-therapy',
          name: 'The Nobel Prize in Physiology or Medicine 1934 — George H. Whipple, George R. Minot, William P. Murphy, \'for their discoveries concerning liver therapy in cases of anaemia.\' Nobel Foundation.',
          url: 'https://www.nobelprize.org/prizes/medicine/1934/summary/',
          publishedAt: '1934-12-10',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ENZYME REPLACEMENT THERAPY ERA (2000s)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Laronidase / Aldurazyme — first MPS I treatment 2003 ────────────────────
  {
    externalId: 'trajectory:laronidase-aldurazyme-first-mps-i-treatment-2003',
    text: 'Recombinant human alpha-L-iduronidase (laronidase, Aldurazyme) is an effective enzyme replacement therapy for mucopolysaccharidosis I (Hurler/Hurler-Scheie/Scheie disease) — a claim first evidenced in Kakkis et al.\'s NEJM trial of 18 January 2001 and settled by the FDA\'s approval of 30 April 2003, the first treatment ever approved for MPS I.',
    claimType: 'HYBRID',
    claimEmergedAt: '2001-01-18',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2001-01-18',
        datePrecision: 'DAY',
        reason: 'Kakkis and colleagues reported a 52-week study of 10 patients showing that recombinant human alpha-L-iduronidase reduced hepatic lysosomal glycosaminoglycan storage and ameliorated clinical manifestations of MPS I. This provided the first human evidence that enzyme replacement could treat this lysosomal storage disorder.',
        source: {
          externalId: 'src:kakkis-rhidu-mps-i-nejm-2001',
          name: 'Kakkis ED, Muenzer J, Tiller GE, et al. Enzyme-replacement therapy in mucopolysaccharidosis I. N Engl J Med. 2001;344(3):182–188. PMID 11172140.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11172140/',
          publishedAt: '2001-01-18',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2003-04-30',
        datePrecision: 'DAY',
        reason: 'The FDA approved Aldurazyme (laronidase, BLA 125058) on 30 April 2003 with priority review and seven-year orphan-drug exclusivity — the first drug ever approved to treat MPS I. The phase 3 randomized trial (Wraith et al., J Pediatr 2004;144:581–588) subsequently confirmed improved respiratory function and physical capacity.',
        source: {
          externalId: 'src:fda-aldurazyme-bla-125058-2003',
          name: 'U.S. FDA, Drugs@FDA. Aldurazyme (laronidase), BLA 125058. Approved April 30, 2003.',
          url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=125058',
          publishedAt: '2003-04-30',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Agalsidase beta / Fabrazyme — first Fabry ERT 2003 ──────────────────────
  {
    externalId: 'trajectory:agalsidase-beta-fabrazyme-first-fabry-ert-2003',
    text: 'Recombinant human alpha-galactosidase A (agalsidase beta, Fabrazyme) clears globotriaosylceramide deposits in Fabry disease — a claim first evidenced in Eng et al.\'s placebo-controlled NEJM trial of 5 July 2001 and settled by the FDA\'s accelerated approval of 24 April 2003, the first enzyme replacement therapy approved for Fabry disease.',
    claimType: 'HYBRID',
    claimEmergedAt: '2001-07-05',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2001-07-05',
        datePrecision: 'DAY',
        reason: 'Eng and the International Collaborative Fabry Disease Study Group reported a double-blind, placebo-controlled trial in 58 patients showing that agalsidase beta cleared microvascular endothelial deposits of globotriaosylceramide from the kidneys, heart, and skin in 69% of treated patients versus none on placebo. This was the first controlled evidence that ERT could reverse the underlying lipid storage in Fabry disease.',
        source: {
          externalId: 'src:eng-agalsidase-fabry-nejm-2001',
          name: 'Eng CM, Guffon N, Wilcox WR, et al. Safety and efficacy of recombinant human alpha-galactosidase A replacement therapy in Fabry\'s disease. N Engl J Med. 2001;345(1):9–16. PMID 11439963.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11439963/',
          publishedAt: '2001-07-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2003-04-24',
        datePrecision: 'DAY',
        reason: 'The FDA granted accelerated (conditional) approval to Fabrazyme (agalsidase beta, BLA 103979) on 24 April 2003 — the first ERT approved in the U.S. for Fabry disease — based on the surrogate endpoint of cleared endothelial Gb3 deposits. Full approval followed in 2021 after confirmatory clinical-benefit data.',
        source: {
          externalId: 'src:fda-fabrazyme-bla-103979-2003',
          name: 'U.S. FDA, Drugs@FDA. Fabrazyme (agalsidase beta), BLA 103979. Accelerated approval April 24, 2003.',
          url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=103979',
          publishedAt: '2003-04-24',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SURGICAL & PROCEDURAL INNOVATION ERA (1950–1990)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Gibbon heart-lung machine — open-heart surgery 1953 ─────────────────────
  {
    externalId: 'trajectory:gibbon-heart-lung-machine-open-heart-surgery-1953',
    text: 'On 6 May 1953 John H. Gibbon Jr. performed the first successful open-heart operation using a mechanical heart-lung machine (cardiopulmonary bypass), closing an atrial septal defect in 18-year-old Cecelia Bavolek at Jefferson Medical College Hospital in Philadelphia.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1953-05-06',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1954-03-01',
        datePrecision: 'MONTH',
        reason: 'Gibbon reported the successful Bavolek operation and his extracorporeal pump-oxygenator in \'Application of a mechanical heart and lung apparatus to cardiac surgery\' in Minnesota Medicine in 1954, recording in the literature the claim that the heart and lungs could be safely bypassed by a machine while the heart was opened and repaired under direct vision. This established the technical feasibility of intracardiac surgery, previously impossible because the beating, blood-filled heart could not be operated on directly.',
        source: {
          externalId: 'src:gibbon-mechanical-heart-lung-minn-med-1954',
          name: 'Gibbon JH Jr. Application of a mechanical heart and lung apparatus to cardiac surgery. Minn Med. 1954;37(3):171-185.',
          url: 'https://www.semanticscholar.org/paper/Application-of-a-mechanical-heart-and-lung-to-Gibbon/ab5a9850b72dc5749cf023ef9dae03879128bfad',
          publishedAt: '1954-03-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1955-04-01',
        datePrecision: 'MONTH',
        reason: 'Within two years John Kirklin\'s team at the Mayo Clinic reproduced the technique, reporting eight intracardiac operations performed with a Gibbon-type pump-oxygenator system in 1955; together with Lillehei\'s cross-circulation work, this demonstrated reproducibility and launched routine open-heart surgery. Cardiopulmonary bypass became the indispensable foundation of cardiac surgery, settling the claim that mechanical perfusion could safely sustain a patient during intracardiac repair.',
        source: {
          externalId: 'src:kirklin-mayo-pump-oxygenator-1955',
          name: 'Kirklin JW, DuShane JW, Patrick RT, Donald DE, Hetzel PS, Harshbarger HG, Wood EH. Intracardiac surgery with the aid of a mechanical pump-oxygenator system (Gibbon type): report of eight cases. Proc Staff Meet Mayo Clin. 1955;30(10):201-206.',
          url: 'https://www.mayoclinicproceedings.org/article/S0025-6196(26)01694-0/fulltext',
          publishedAt: '1955-05-18',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Closed-chest cardiac massage — CPR 1960 ─────────────────────────────────
  {
    externalId: 'trajectory:closed-chest-cardiac-massage-cpr-1960',
    text: 'Kouwenhoven, Jude, and Knickerbocker reported in JAMA on 9 July 1960 that rhythmic external compression of the sternum (\'closed-chest cardiac massage\') could sustain circulation and resuscitate patients in cardiac arrest without opening the chest.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1960-07-09',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1960-07-09',
        datePrecision: 'DAY',
        reason: 'In \'Closed-chest cardiac massage\' the Johns Hopkins group reported that anyone, anywhere could maintain circulation during cardiac arrest using only their hands pressing on the sternum, citing a survival series and stating \'all that is needed are two hands.\' This recorded the claim that the chest no longer had to be surgically opened (open-cardiac massage) to resuscitate an arrested heart, overturning the prevailing standard for cardiac arrest.',
        source: {
          externalId: 'src:kouwenhoven-closed-chest-massage-jama-1960',
          name: 'Kouwenhoven WB, Jude JR, Knickerbocker GG. Closed-chest cardiac massage. JAMA. 1960;173(10):1064-1067.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/14411374/',
          publishedAt: '1960-07-09',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1966-10-24',
        datePrecision: 'DAY',
        reason: 'Following a May 1966 conference, the Ad Hoc Committee on Cardiopulmonary Resuscitation of the National Academy of Sciences–National Research Council published the first national CPR standards in JAMA, integrating closed-chest compression with Safar\'s mouth-to-mouth ventilation into the standardized A-B-C protocol. Institutional codification by the NAS-NRC (and subsequent American Heart Association adoption) settled chest-compression CPR as the universal standard of care for cardiac arrest.',
        source: {
          externalId: 'src:nas-nrc-cpr-standards-jama-1966',
          name: 'Ad Hoc Committee on Cardiopulmonary Resuscitation, Division of Medical Sciences, National Academy of Sciences–National Research Council. Cardiopulmonary Resuscitation. JAMA. 1966;198(4):372-379.',
          url: 'https://jamanetwork.com/journals/jama/article-abstract/661914',
          publishedAt: '1966-10-24',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Apgar score — newborn evaluation 1953 ───────────────────────────────────
  {
    externalId: 'trajectory:apgar-score-newborn-evaluation-1953',
    text: 'Virginia Apgar proposed in Current Researches in Anesthesia and Analgesia in 1953 a simple, rapid 0-to-10 scoring system (heart rate, respiratory effort, reflex irritability, muscle tone, color) for objectively evaluating the condition of the newborn infant in the first minute of life.',
    claimType: 'HYBRID',
    claimEmergedAt: '1953-07-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1953-07-01',
        datePrecision: 'MONTH',
        reason: 'In \'A proposal for a new method of evaluation of the newborn infant,\' anesthesiologist Virginia Apgar argued that the condition of the neonate at birth was being judged haphazardly and proposed five quickly observable signs scored 0–2 each. This recorded the claim that newborn vitality could be standardized into a single reproducible number, creating the first objective metric for triaging infants needing resuscitation.',
        source: {
          externalId: 'src:apgar-newborn-evaluation-1953',
          name: 'Apgar V. A proposal for a new method of evaluation of the newborn infant. Curr Res Anesth Analg. 1953;32(4):260-267.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13083014/',
          publishedAt: '1953-07-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1958-12-13',
        datePrecision: 'DAY',
        reason: 'Apgar and colleagues published a \'second report\' in JAMA validating the score against neonatal outcomes in a series of over 15,000 infants and showing it predicted mortality. The score was rapidly adopted into delivery-room routine worldwide and remains, decades later, the universal standard for assessing the newborn, settling the claim that a brief structured exam objectively measures neonatal condition.',
        source: {
          externalId: 'src:apgar-newborn-second-report-jama-1958',
          name: 'Apgar V, Holaday DA, James LS, Weisbrot IM, Berrien C. Evaluation of the newborn infant; second report. J Am Med Assoc. 1958;168(15):1985-1988.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13598635/',
          publishedAt: '1958-12-13',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Charnley low-friction hip arthroplasty — 1961 ───────────────────────────
  {
    externalId: 'trajectory:charnley-low-friction-hip-arthroplasty-1961',
    text: 'John Charnley reported in The Lancet on 27 May 1961 a new low-friction total hip arthroplasty — a small metal femoral head articulating in a high-density polymer acetabular socket fixed with acrylic bone cement — that durably relieved pain and restored function in arthritic hips.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1961-05-27',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1961-05-27',
        datePrecision: 'DAY',
        reason: 'In \'Arthroplasty of the hip: a new operation,\' Charnley set out his low-friction principle — replacing both the femoral head and the acetabular cup with artificial bearing surfaces anchored by self-curing acrylic cement — and reported relief of pain and restored mobility. This recorded the claim that an arthritic hip joint could be wholly and durably replaced by prosthetic components, a goal that earlier metal-on-metal and mould arthroplasties had failed to achieve reliably.',
        source: {
          externalId: 'src:charnley-hip-arthroplasty-lancet-1961',
          name: 'Charnley J. Arthroplasty of the hip: a new operation. Lancet. 1961;1(7187):1129-1132.',
          url: 'https://doi.org/10.1016/S0140-6736(61)92063-3',
          publishedAt: '1961-05-27',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2002-02-01',
        datePrecision: 'MONTH',
        reason: 'Long-term survivorship studies confirmed the durability Charnley claimed: a Mayo Clinic series of 2,000 consecutive primary Charnley total hip replacements showed roughly 80% implant survivorship at 25 years. Low-friction arthroplasty became the worldwide gold-standard design for hip replacement and one of the most successful operations in surgery, settling the claim that prosthetic hip replacement provides lasting relief.',
        source: {
          externalId: 'src:berry-charnley-25yr-survivorship-jbjs-2002',
          name: 'Berry DJ, Harmsen WS, Cabanela ME, Morrey BF. Twenty-five-year survivorship of two thousand consecutive primary Charnley total hip replacements. J Bone Joint Surg Am. 2002;84(2):171-177.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11861721/',
          publishedAt: '2002-02-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── CASS — CABG no survival benefit in stable disease 1983 ──────────────────
  {
    externalId: 'trajectory:cass-cabg-no-survival-benefit-stable-disease-1983',
    text: 'The Coronary Artery Surgery Study (CASS) randomized trial reported in Circulation in November 1983 that, in patients with mild stable angina and preserved left-ventricular function, coronary artery bypass grafting did not improve survival compared with initial medical therapy.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1983-11-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1983-11-01',
        datePrecision: 'MONTH',
        reason: 'The NHLBI-funded CASS randomized 780 patients with stable ischemic heart disease to bypass surgery or medical therapy and found near-identical survival at five years (annual mortality ~1.1% surgical vs ~1.6% medical, not significant). This recorded a controlled-trial result contesting the prevailing assumption — built on the rapid post-Favaloro spread of CABG — that bypass grafting prolonged life across coronary disease broadly, by showing no survival advantage in lower-risk stable patients.',
        source: {
          externalId: 'src:cass-randomized-survival-circulation-1983',
          name: 'CASS Principal Investigators and Associates. Coronary artery surgery study (CASS): a randomized trial of coronary artery bypass surgery. Survival data. Circulation. 1983;68(5):939-950.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6137292/',
          publishedAt: '1983-11-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2003-03-25',
        datePrecision: 'DAY',
        reason: 'Long-term follow-up confirmed and refined the finding: 10- and 20-year CASS data showed CABG\'s survival benefit was confined to higher-risk subgroups (e.g., depressed ejection fraction, three-vessel or left-main disease) while low-risk stable patients did equally well with medicine. This evidence settled the principle — codified in revascularization guidelines — that the survival benefit of CABG is risk-stratified rather than universal.',
        source: {
          externalId: 'src:cass-twenty-year-survival-circulation-2003',
          name: 'Myers WO, Blackstone EH, Davis K, Foster ED, Kaiser GC. Twenty-Year Survival After Coronary Artery Surgery (CASS). Circulation. 2003;107(11):e9013 (long-term follow-up of the CASS randomized cohort).',
          url: 'https://www.ahajournals.org/doi/full/10.1161/01.cir.0000053642.34528.d9',
          publishedAt: '2003-03-25',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRECISION MEDICINE ERA (2010s)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Ivacaftor / Kalydeco — first CFTR modulator 2012 ────────────────────────
  {
    externalId: 'trajectory:ivacaftor-kalydeco-first-cftr-modulator-2012',
    text: 'Ivacaftor (Kalydeco), a CFTR potentiator, improves lung function in cystic fibrosis patients carrying the G551D gating mutation — a claim first evidenced in Ramsey et al.\'s NEJM trial of 3 November 2011 and settled by the FDA\'s approval of 31 January 2012, the first drug to treat the underlying molecular cause of cystic fibrosis.',
    claimType: 'HYBRID',
    claimEmergedAt: '2011-11-03',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2011-11-03',
        datePrecision: 'DAY',
        reason: 'Ramsey and colleagues reported a randomized, double-blind, placebo-controlled trial showing that ivacaftor, a small-molecule potentiator of the defective CFTR protein, improved FEV1 by 10.6 percentage points through 24 weeks in patients aged 12 and older with the G551D mutation. This was the first demonstration that a drug could correct the function of the mutant CFTR channel rather than merely treat symptoms.',
        source: {
          externalId: 'src:ramsey-ivacaftor-g551d-nejm-2011',
          name: 'Ramsey BW, Davies J, McElvaney NG, et al. A CFTR potentiator in patients with cystic fibrosis and the G551D mutation. N Engl J Med. 2011;365(18):1663–1672. PMID 22047557.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/22047557/',
          publishedAt: '2011-11-03',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2012-01-31',
        datePrecision: 'DAY',
        reason: 'The FDA approved Kalydeco (ivacaftor, NDA 203188) on 31 January 2012 for cystic fibrosis patients aged 6 and older with the G551D-CFTR mutation — roughly three months after submission, one of the fastest approvals on record. It was the first approved CFTR modulator and the first agent to address the underlying cause of CF rather than its complications.',
        source: {
          externalId: 'src:fda-kalydeco-nda-203188-2012',
          name: 'U.S. FDA, Drugs@FDA. Kalydeco (ivacaftor), NDA 203188. Approved January 31, 2012.',
          url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=203188',
          publishedAt: '2012-01-31',
          methodologyType: 'primary',
        },
      },
    ],
  },

]

// ── Seeder (identical to history script) ────────────────────────────────────

async function upsertTrajectory(t: Trajectory) {
  const claim = await prisma.claim.upsert({
    where: { externalId: t.externalId },
    create: {
      externalId: t.externalId,
      text: t.text,
      claimType: t.claimType,
      claimEmergedAt: new Date(t.claimEmergedAt),
      claimEmergedPrecision: t.claimEmergedPrecision,
      epistemicAxis: t.currentAxis,
      currentStatus: 'DISPUTED',
      ingestedBy: 'seed:medicine-trajectories',
      autoApproved: true,
    },
    update: {
      text: t.text,
      claimType: t.claimType,
      claimEmergedAt: new Date(t.claimEmergedAt),
      claimEmergedPrecision: t.claimEmergedPrecision,
      epistemicAxis: t.currentAxis,
    },
  })

  for (let i = 0; i < t.transitions.length; i++) {
    const tr = t.transitions[i]

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'seed:medicine-trajectories',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const histId = `csh:${t.externalId}:${i}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: claim.id,
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: claim.id, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: claim.id, sourceId: source.id, type: 'FOR' } })
    }
  }

  console.log(`  ✓ ${t.externalId} (${t.transitions.length} transitions)`)
}

async function main() {
  console.log(`Seeding ${TRAJECTORIES.length} medicine trajectories${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  if (!DRY_RUN) {
    for (const t of TRAJECTORIES) {
      await upsertTrajectory(t)
    }
  } else {
    for (const t of TRAJECTORIES) {
      console.log(`  [dry] ${t.externalId} — ${t.transitions.length} transitions`)
    }
  }

  console.log(`\nDone. ${TRAJECTORIES.length} medicine trajectories seeded.`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
