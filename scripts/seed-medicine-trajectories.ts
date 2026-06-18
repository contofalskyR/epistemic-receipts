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
