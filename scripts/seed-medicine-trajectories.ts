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

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCREENING / REGULATORY / SAFETY REASSESSMENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── PSA prostate-cancer screening — ERSPC/PLCO 2009 ──────────────────────────
  {
    externalId: 'trajectory:psa-prostate-screening-mortality-contested-2009',
    text: 'On 18 March 2009 the New England Journal of Medicine published the European (ERSPC) and U.S. (PLCO) randomized trials, whose conflicting mortality results undermined the prevailing consensus that routine population-wide PSA-based prostate-cancer screening reduces prostate-cancer mortality.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2009-03-18',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2009-03-18',
        datePrecision: 'DAY',
        reason: 'Two large RCTs published simultaneously gave incompatible answers: ERSPC found a 20% relative reduction in prostate-cancer mortality but at the cost of needing to screen 1,410 men and treat 48 extra cases to prevent one death, while PLCO found no significant mortality difference. Together they replaced the prior practice consensus with genuine scientific uncertainty about screening\'s net benefit, foregrounding overdiagnosis and overtreatment.',
        source: {
          externalId: 'src:schroder-erspc-nejm-2009',
          name: 'Schröder FH, Hugosson J, Roobol MJ, et al. Screening and prostate-cancer mortality in a randomized European study. N Engl J Med. 2009;360(13):1320-1328.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/19297566/',
          publishedAt: '2009-03-18',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2012-05',
        datePrecision: 'MONTH',
        reason: 'Drawing on the 2009 trial evidence, the U.S. Preventive Services Task Force issued a Grade D recommendation against PSA-based screening for men of all ages, concluding the harms outweighed the benefits. This institutionalized the reversal of routine-screening advice; the Task Force later softened the position to Grade C (shared decision-making for men 55–69) in 2018, leaving the question genuinely contested rather than fully settled.',
        source: {
          externalId: 'src:uspstf-prostate-screening-2012',
          name: 'U.S. Preventive Services Task Force. Recommendation: Prostate Cancer Screening (2012 Grade D recommendation).',
          url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/prostate-cancer-screening',
          publishedAt: '2012-05-21',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Gemtuzumab/Mylotarg accelerated-approval reversal — 2000/2010 ───────────
  {
    externalId: 'trajectory:gemtuzumab-mylotarg-accelerated-approval-reversal-2000',
    text: 'On 17 May 2000 the FDA granted accelerated approval to Mylotarg (gemtuzumab ozogamicin)—the first antibody-drug conjugate—for CD33-positive acute myeloid leukemia in first relapse, on the basis of surrogate response-rate endpoints rather than survival.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2000-05-17',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2000-05-17',
        datePrecision: 'DAY',
        reason: 'The FDA approved gemtuzumab ozogamicin under Subpart H accelerated approval based on a 30% overall response rate in single-arm studies, with a confirmatory post-marketing trial required to verify clinical benefit. As the first marketed antibody-drug conjugate, it recorded a provisional regulatory claim of efficacy pending verification.',
        source: {
          externalId: 'src:fda-approval-summary-mylotarg-2018',
          name: 'Norsworthy KJ, et al. FDA Approval Summary: Mylotarg for Treatment of Relapsed or Refractory CD33-Positive Acute Myeloid Leukemia. Oncologist. 2018;23(9):1103-1108.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6192608/',
          publishedAt: '2018-05-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2010-06',
        datePrecision: 'MONTH',
        reason: 'The required confirmatory trial SWOG S0106 failed to demonstrate clinical benefit and showed a higher rate of fatal induction toxicity in the gemtuzumab arm (5.7% vs 1.4%). At the FDA\'s 21 May 2010 request, the manufacturer voluntarily withdrew the drug in June 2010 (NDA withdrawal effective 15 October 2010), a textbook accelerated-approval reversal; a fractionated lower-dose regimen was later re-approved in 2017.',
        source: {
          externalId: 'src:fed-register-mylotarg-withdrawal-2011',
          name: 'Wyeth Pharmaceuticals, Inc.; Withdrawal of Approval of a New Drug Application for MYLOTARG. Federal Register, 28 Nov 2011.',
          url: 'https://www.federalregister.gov/documents/2011/11/28/2011-30473/wyeth-pharmaceuticals-inc-withdrawal-of-approval-of-a-new-drug-application-for-mylotarg',
          publishedAt: '2011-11-28',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── FDA pediatric antidepressant black-box suicidality warning — 2004 ────────
  {
    externalId: 'trajectory:fda-pediatric-antidepressant-black-box-suicidality-2004',
    text: 'In October 2004 the FDA directed the manufacturers of all antidepressants to add a boxed (\'black box\') warning stating that the drugs increase the risk of suicidal thinking and behavior in children and adolescents, based on a pooled analysis of 24 placebo-controlled trials showing a 4% versus 2% risk.',
    claimType: 'HYBRID',
    claimEmergedAt: '2004-10-15',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2004-10-15',
        datePrecision: 'DAY',
        reason: 'Following a September 2004 advisory-committee review of an FDA meta-analysis of 24 pediatric trials (~4,400 patients) finding roughly double the rate of suicidality on drug versus placebo, the FDA mandated the most serious labeling warning across the entire antidepressant class and required patient MedGuides. This established, as institutional fact, the claim that antidepressants raise pediatric suicidality risk.',
        source: {
          externalId: 'src:fda-antidepressant-suicidality-warning-2004',
          name: 'FDA. Suicidality in Children and Adolescents Being Treated With Antidepressant Medications (boxed warning directive, Oct 2004).',
          url: 'https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/suicidality-children-and-adolescents-being-treated-antidepressant-medications',
          publishedAt: '2004-10-15',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2014-06-18',
        datePrecision: 'DAY',
        reason: 'A quasi-experimental BMJ study by Lu et al. reported that the warning and its media coverage were followed by reduced antidepressant treatment of young people and an increase in psychotropic drug poisonings (a suicide-attempt proxy), arguing the warning caused net harm. The finding—vigorously disputed by other researchers who found no contemporaneous rise in completed suicides—reopened debate over whether the warning\'s benefits outweigh its harms.',
        source: {
          externalId: 'src:lu-bmj-black-box-2014',
          name: 'Lu CY, Zhang F, Lakoma MD, et al. Changes in antidepressant use by young people and suicidal behavior after FDA warnings and media coverage: quasi-experimental study. BMJ. 2014;348:g3596.',
          url: 'https://www.bmj.com/content/348/bmj.g3596',
          publishedAt: '2014-06-18',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── NLST low-dose CT lung-cancer screening — 2010 ────────────────────────────
  {
    externalId: 'trajectory:nlst-low-dose-ct-lung-cancer-screening-2010',
    text: 'On 4 November 2010 the U.S. National Cancer Institute announced that the National Lung Screening Trial (NLST) had found low-dose CT screening reduced lung-cancer mortality by about 20% relative to chest X-ray in high-risk smokers, establishing the first screening modality proven to lower lung-cancer death.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2010-11-04',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2010-11-04',
        datePrecision: 'DAY',
        reason: 'After the data and safety monitoring board found a statistically significant 20.3% reduction in lung-cancer mortality among 53,454 heavy smokers screened with low-dose helical CT versus chest radiography, the NCI director accepted its recommendation and publicly announced the interim result, recording for the first time that any lung-cancer screening method reduces mortality.',
        source: {
          externalId: 'src:nci-nlst-announcement-2010',
          name: 'National Cancer Institute. National Lung Screening Trial (NLST) — results announced 4 Nov 2010.',
          url: 'https://www.cancer.gov/types/lung/research/nlst',
          publishedAt: '2010-11-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2011-08-04',
        datePrecision: 'DAY',
        reason: 'The full peer-reviewed results were published in the New England Journal of Medicine (online 29 June 2011; print 4 August 2011), reporting a 20.0% relative reduction in lung-cancer mortality. This peer-reviewed publication settled the empirical claim and became the evidentiary basis for the 2013 USPSTF Grade B recommendation endorsing low-dose CT screening for high-risk smokers.',
        source: {
          externalId: 'src:nlst-nejm-2011',
          name: 'National Lung Screening Trial Research Team. Reduced Lung-Cancer Mortality with Low-Dose Computed Tomographic Screening. N Engl J Med. 2011;365(5):395-409. doi:10.1056/NEJMoa1102873.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/21714641/',
          publishedAt: '2011-08-04',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CARDIOVASCULAR MEDICINE ERA (2010–2024)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── SPRINT intensive BP control — 2015 ─────────────────────────────────────
  {
    externalId: 'trajectory:sprint-intensive-bp-control-2015',
    text: 'On 9 November 2015 the SPRINT trial reported that targeting a systolic blood pressure below 120 mm Hg, rather than below 140 mm Hg, reduced fatal and nonfatal major cardiovascular events and all-cause mortality in high-risk non-diabetic adults, evidence that subsequently drove the redefinition of hypertension at 130/80 mm Hg.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2015-11-09',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2015-11-09',
        datePrecision: 'DAY',
        reason: 'The NIH-sponsored SPRINT trial (9,361 high-risk non-diabetic adults) was stopped early when intensive systolic control to <120 mm Hg reduced the primary composite cardiovascular endpoint (hazard ratio 0.75) and all-cause mortality (hazard ratio 0.73) versus the standard <140 mm Hg target. This put on the scientific record the claim that a substantially lower blood-pressure target prevents cardiovascular events and death, challenging the long-standing 140/90 treatment threshold.',
        source: {
          externalId: 'src:sprint-intensive-bp-nejm-2015',
          name: 'SPRINT Research Group; Wright JT Jr, Williamson JD, Whelton PK, et al. A randomized trial of intensive versus standard blood-pressure control. N Engl J Med. 2015;373(22):2103-2116.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/26551272/',
          publishedAt: '2015-11-09',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2017-11-13',
        datePrecision: 'DAY',
        reason: 'The 2017 ACC/AHA multi-society high-blood-pressure guideline (Whelton, Carey, et al.), drawing heavily on SPRINT, redefined hypertension downward from 140/90 to 130/80 mm Hg and recommended lower treatment targets. This institutionally settled the lower-threshold claim into clinical practice, reclassifying roughly 46% of U.S. adults as hypertensive overnight.',
        source: {
          externalId: 'src:acc-aha-2017-hypertension-guideline',
          name: 'Whelton PK, Carey RM, Aronow WS, et al. 2017 ACC/AHA/AAPA/ABC/ACPM/AGS/APhA/ASH/ASPC/NMA/PCNA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults. Hypertension. 2018;71(6):e13-e115.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/29133356/',
          publishedAt: '2017-11-13',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Evolocumab PCSK9 / FOURIER CV outcomes — 2015–2017 ─────────────────────
  {
    externalId: 'trajectory:evolocumab-pcsk9-fourier-cv-outcomes-2017',
    text: 'PCSK9 inhibition with evolocumab, approved by the FDA on 27 August 2015 as an LDL-cholesterol-lowering adjunct to statins, was proven on 17 March 2017 by the FOURIER trial to reduce cardiovascular events in patients with established atherosclerotic disease.',
    claimType: 'HYBRID',
    claimEmergedAt: '2015-08-27',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2015-08-27',
        datePrecision: 'DAY',
        reason: 'The FDA approved evolocumab (Repatha, Amgen) as an adjunct to diet and maximally tolerated statins for patients needing further LDL lowering, accepting evidence that PCSK9 inhibition dramatically reduces LDL cholesterol. The approval rested on a surrogate (LDL) endpoint; whether this large LDL reduction translated into fewer hard cardiovascular events remained unproven and openly debated.',
        source: {
          externalId: 'src:amgen-fda-repatha-approval-2015',
          name: 'Amgen. FDA Approves Amgen\'s New Cholesterol-Lowering Medication Repatha (evolocumab). Press release, 27 August 2015.',
          url: 'https://www.amgen.com/newsroom/press-releases/2015/08/fda-approves-amgens-new-cholesterollowering-medication-repatha-evolocumab',
          publishedAt: '2015-08-27',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-03-17',
        datePrecision: 'DAY',
        reason: 'The FOURIER trial (27,564 patients with atherosclerotic disease on statins) showed that adding evolocumab lowered median LDL to 30 mg/dL and reduced the primary composite cardiovascular endpoint by 15% (hazard ratio 0.85) over 2.2 years. The first hard-outcome trial of a PCSK9 inhibitor, it converted the LDL surrogate into a demonstrated cardiovascular benefit and validated the \'lower-is-better\' LDL hypothesis at extreme low levels.',
        source: {
          externalId: 'src:fourier-evolocumab-nejm-2017',
          name: 'Sabatine MS, Giugliano RP, Keech AC, et al. Evolocumab and clinical outcomes in patients with cardiovascular disease. N Engl J Med. 2017;376(18):1713-1722.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/28304224/',
          publishedAt: '2017-03-17',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Niacin add-on to statin reversed — 1975–2014 ───────────────────────────
  {
    externalId: 'trajectory:niacin-add-on-statin-reversed-2014',
    text: 'The claim that niacin — shown by the 1975 Coronary Drug Project to reduce nonfatal myocardial infarction — confers additional cardiovascular benefit when added to statin therapy was reversed when the AIM-HIGH (2011) and HPS2-THRIVE (2014) trials found no reduction in events despite favorable changes in HDL and triglycerides.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1975-01-27',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1975-01-27',
        datePrecision: 'DAY',
        reason: 'The Coronary Drug Project, a large randomized secondary-prevention trial, reported in JAMA that niacin reduced nonfatal myocardial infarction in men with prior MI (a long-term mortality benefit was later seen on follow-up). This recorded niacin as an evidence-based lipid-modifying cardiovascular therapy, a status it held for decades on the strength of its HDL-raising and triglyceride-lowering effects.',
        source: {
          externalId: 'src:coronary-drug-project-niacin-jama-1975',
          name: 'Coronary Drug Project Research Group. Clofibrate and niacin in coronary heart disease. JAMA. 1975;231(4):360-381.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/1088963/',
          publishedAt: '1975-01-27',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2011-12-15',
        datePrecision: 'DAY',
        reason: 'The NHLBI AIM-HIGH trial was stopped early for futility: adding extended-release niacin to intensive statin therapy in patients with low HDL produced no incremental clinical benefit over 36 months despite significantly improving HDL and triglycerides. This directly contested the assumption that niacin\'s lipid effects add cardiovascular protection in the statin era.',
        source: {
          externalId: 'src:aim-high-niacin-nejm-2011',
          name: 'AIM-HIGH Investigators; Boden WE, Probstfield JL, Anderson T, et al. Niacin in patients with low HDL cholesterol levels receiving intensive statin therapy. N Engl J Med. 2011;365(24):2255-2267.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/22085343/',
          publishedAt: '2011-12-15',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2014-07-17',
        datePrecision: 'DAY',
        reason: 'The much larger HPS2-THRIVE trial (25,673 patients, 3.9-year follow-up) confirmed that extended-release niacin/laropiprant added to statins produced no significant reduction in major vascular events while causing significant excess harms (new diabetes, infections, bleeding, gastrointestinal effects). The convergent null result reversed niacin\'s standing as a beneficial add-on therapy and led to withdrawal of niacin/laropiprant and downgrading of niacin in guidelines.',
        source: {
          externalId: 'src:hps2-thrive-niacin-nejm-2014',
          name: 'HPS2-THRIVE Collaborative Group; Landray MJ, Haynes R, Hopewell JC, et al. Effects of extended-release niacin with laropiprant in high-risk patients. N Engl J Med. 2014;371(3):203-212.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/25014686/',
          publishedAt: '2014-07-17',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Apixaban vs warfarin ARISTOTLE — 2011–2012 ─────────────────────────────
  {
    externalId: 'trajectory:apixaban-vs-warfarin-aristotle-2011',
    text: 'On 27 August 2011 the ARISTOTLE trial reported that the direct oral anticoagulant apixaban was superior to warfarin in patients with atrial fibrillation, reducing stroke or systemic embolism, major bleeding, and all-cause mortality.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2011-08-27',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2011-08-27',
        datePrecision: 'DAY',
        reason: 'The ARISTOTLE trial (18,201 patients with atrial fibrillation) found apixaban superior to dose-adjusted warfarin, reducing stroke or systemic embolism by 21%, major bleeding by 31%, and all-cause mortality, without the need for INR monitoring. This recorded the claim that a fixed-dose direct factor Xa inhibitor could outperform the decades-old warfarin standard for stroke prevention in AF.',
        source: {
          externalId: 'src:aristotle-apixaban-nejm-2011',
          name: 'Granger CB, Alexander JH, McMurray JJV, et al. Apixaban versus warfarin in patients with atrial fibrillation. N Engl J Med. 2011;365(11):981-992.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/21870978/',
          publishedAt: '2011-08-27',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2012-12-28',
        datePrecision: 'DAY',
        reason: 'The FDA approved apixaban (Eliquis, Bristol-Myers Squibb/Pfizer; NDA 202155) to reduce the risk of stroke and systemic embolism in non-valvular atrial fibrillation, on the basis of ARISTOTLE. Together with the approvals of dabigatran and rivaroxaban, this institutionally settled direct oral anticoagulants as standard alternatives to warfarin, which subsequent guidelines came to prefer for most AF patients.',
        source: {
          externalId: 'src:fda-eliquis-apixaban-label-2012',
          name: 'FDA. ELIQUIS (apixaban) Prescribing Information, NDA 202155 (initial U.S. approval 28 December 2012).',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2012/202155s000lbl.pdf',
          publishedAt: '2012-12-28',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Semaglutide SELECT CV outcomes in obesity — 2023–2024 ──────────────────
  {
    externalId: 'trajectory:semaglutide-select-cv-outcomes-obesity-2023',
    text: 'On 11 November 2023 the SELECT trial reported that weekly subcutaneous semaglutide 2.4 mg reduced major adverse cardiovascular events by about 20% in overweight or obese adults with established cardiovascular disease but without diabetes, a finding the FDA adopted as a labeled cardiovascular indication on 8 March 2024.',
    claimType: 'HYBRID',
    claimEmergedAt: '2023-11-11',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2023-11-11',
        datePrecision: 'DAY',
        reason: 'The SELECT trial (17,604 adults with prior cardiovascular disease and overweight/obesity but no diabetes) found that semaglutide reduced the primary composite of cardiovascular death, nonfatal MI, or nonfatal stroke from 8.0% to 6.5% (hazard ratio 0.80). This recorded for the first time that a GLP-1 receptor agonist prescribed for obesity, independent of diabetes, prevents hard cardiovascular events — extending the GLP-1 evidence base from glycemic control to cardiovascular prevention.',
        source: {
          externalId: 'src:select-semaglutide-nejm-2023',
          name: 'Lincoff AM, Brown-Frandsen K, Colhoun HM, et al. Semaglutide and cardiovascular outcomes in obesity without diabetes (SELECT). N Engl J Med. 2023;389(24):2221-2232.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/37952131/',
          publishedAt: '2023-11-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2024-03-08',
        datePrecision: 'DAY',
        reason: 'On the basis of SELECT, the FDA expanded the Wegovy (semaglutide 2.4 mg) label to include reducing the risk of cardiovascular death, nonfatal myocardial infarction, and nonfatal stroke in adults with cardiovascular disease and overweight or obesity — the first drug approved for cardiovascular risk reduction specifically in overweight/obese patients. The institutional act settled the claim and reframed obesity pharmacotherapy as cardiovascular prevention.',
        source: {
          externalId: 'src:fda-wegovy-cv-indication-2024',
          name: 'Novo Nordisk. Wegovy receives FDA approval for cardiovascular risk reduction in adults with known heart disease and overweight or obesity. Press release, 8 March 2024.',
          url: 'https://www.prnewswire.com/news-releases/wegovy-receives-fda-approval-for-cardiovascular-risk-reduction-in-adults-with-known-heart-disease-and-overweight-or-obesity-302084454.html',
          publishedAt: '2024-03-08',
          methodologyType: 'primary',
        },
      },
    ],
  },


  // ═══════════════════════════════════════════════════════════════════════════════
  // DRUG DISCOVERY ERA / VACCINE SAFETY (pre-1950)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Abraham & Chain penicillinase resistance — 1940 ─────────────────────────
  {
    externalId: 'trajectory:abraham-chain-penicillinase-resistance-1940',
    text: 'Edward Abraham and Ernst Chain reported in Nature on 28 December 1940 that certain bacteria produce an enzyme (later named penicillinase, a β-lactamase) able to destroy penicillin, identifying the first known mechanism of bacterial resistance to the antibiotic — described before penicillin had entered clinical use.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1940-12-28',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1940-12-28',
        datePrecision: 'DAY',
        reason: 'In a one-page Nature note, Abraham and Chain reported that extracts of certain coli-group bacteria contained an enzyme that inactivated penicillin, explaining why those organisms were unaffected by it. This was the first documented bacterial mechanism for destroying penicillin, recording the existence of antibiotic resistance in the literature even before penicillin was used to treat patients.',
        source: {
          externalId: 'src:abraham-chain-penicillinase-nature-1940',
          name: 'Abraham EP, Chain E. An enzyme from bacteria able to destroy penicillin. Nature. 1940;146(3713):837.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/3055168/',
          publishedAt: '1940-12-28',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1948-10-23',
        datePrecision: 'DAY',
        reason: 'Mary Barber and Mary Rozwadowska-Dowzenko reported in the Lancet that the majority of Staphylococcus aureus strains causing hospital infections had become penicillin-resistant within a few years of the drug\'s introduction. This converted the in-vitro enzyme observation of 1940 into a settled clinical reality: penicillinase-producing resistance had emerged and spread as a routine therapeutic problem.',
        source: {
          externalId: 'src:barber-penicillin-resistant-staph-lancet-1948',
          name: 'Barber M, Rozwadowska-Dowzenko M. Infection by penicillin-resistant staphylococci. Lancet. 1948;2(6530):641-644.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/18890505/',
          publishedAt: '1948-10-23',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── MRC streptomycin tuberculosis RCT — 1948 ────────────────────────────────
  {
    externalId: 'trajectory:mrc-streptomycin-tuberculosis-trial-1948',
    text: 'The Medical Research Council reported in the BMJ on 30 October 1948 that streptomycin plus bed rest produced significantly better survival and radiological improvement than bed rest alone in acute progressive pulmonary tuberculosis — the first published clinical trial to use concealed random-number allocation, designed by Austin Bradford Hill.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1948-10-30',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1948-10-30',
        datePrecision: 'DAY',
        reason: 'The MRC Streptomycin in Tuberculosis Trials Committee published results of 107 patients randomly allocated by a concealed schedule of random numbers to streptomycin-plus-bed-rest or bed-rest-alone, finding markedly lower mortality and better chest-radiograph outcomes with streptomycin. The paper recorded both the efficacy of streptomycin in tuberculosis and the new methodology of randomized concealed allocation that became the template for the modern controlled trial.',
        source: {
          externalId: 'src:mrc-streptomycin-tuberculosis-bmj-1948',
          name: 'Medical Research Council. Streptomycin treatment of pulmonary tuberculosis: a Medical Research Council investigation. BMJ. 1948;2(4582):769-782.',
          url: 'https://www.jameslindlibrary.org/medical-research-council-1948b/',
          publishedAt: '1948-10-30',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1950-11-04',
        datePrecision: 'DAY',
        reason: 'A follow-up MRC randomized trial showed that combining streptomycin with para-aminosalicylic acid (PAS) sharply reduced the emergence of streptomycin-resistant tubercle bacilli that had crippled streptomycin monotherapy in the 1948 trial. This settled combination chemotherapy as the standard of TB care and entrenched the randomized controlled trial as the accepted method for establishing drug efficacy.',
        source: {
          externalId: 'src:mrc-streptomycin-pas-bmj-1950',
          name: 'Medical Research Council. Treatment of pulmonary tuberculosis with streptomycin and para-amino-salicylic acid: a Medical Research Council investigation. BMJ. 1950;2(4688):1073-1085.',
          url: 'https://www.jameslindlibrary.org/medical-research-council-1950/',
          publishedAt: '1950-11-04',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Theiler 17D yellow fever vaccine — 1937 ─────────────────────────────────
  {
    externalId: 'trajectory:theiler-17d-yellow-fever-vaccine-1937',
    text: 'Max Theiler and Hugh Smith reported in the Journal of Experimental Medicine in 1937 that the 17D strain of yellow fever virus, attenuated by serial passage in chick-embryo tissue, safely immunized humans against yellow fever — the first effective live attenuated yellow fever vaccine.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1937-06-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1937-06-01',
        datePrecision: 'MONTH',
        reason: 'Theiler and Smith reported that the 17D strain, derived from the virulent Asibi virus by repeated passage in mouse and then chick-embryo tissue, had lost neurotropism and viscerotropism yet still induced protective antibodies when given to human volunteers. This recorded the first laboratory-attenuated yellow fever virus shown to immunize people safely.',
        source: {
          externalId: 'src:theiler-smith-17d-jem-1937',
          name: 'Theiler M, Smith HH. The use of yellow fever virus modified by in vitro cultivation for human immunization. J Exp Med. 1937;65(6):787-800.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2118520/',
          publishedAt: '1937-06-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1951-12-10',
        datePrecision: 'DAY',
        reason: 'After large-scale 17D field vaccination began in Brazil in 1938 and the vaccine was distributed in the millions of doses, Max Theiler received the Nobel Prize in Physiology or Medicine on 10 December 1951 for his discoveries concerning yellow fever and its control — the only Nobel Prize ever awarded for the development of a virus vaccine, ratifying 17D as established preventive medicine.',
        source: {
          externalId: 'src:theiler-nobel-1951',
          name: 'The Nobel Prize in Physiology or Medicine 1951 — Max Theiler, \'for his discoveries concerning yellow fever and how to combat it.\' Nobel Foundation.',
          url: 'https://www.nobelprize.org/prizes/medicine/1951/theiler/facts/',
          publishedAt: '1951-12-10',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Lübeck BCG vaccine disaster — 1930 ──────────────────────────────────────
  {
    externalId: 'trajectory:lubeck-bcg-vaccine-disaster-1930',
    text: 'The Lübeck disaster of 1930 — in which 251 newborns received oral BCG doses accidentally contaminated with virulent Mycobacterium tuberculosis, killing at least 72 — initially cast doubt on the safety of the BCG tuberculosis vaccine, but a German government inquiry and a 1932 criminal trial established that the deaths were caused by local laboratory contamination rather than the BCG strain, which was exonerated.',
    claimType: 'HYBRID',
    claimEmergedAt: '1930-04-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'CONTESTED',
        community: 'PUBLIC',
        occurredAt: '1930-04-01',
        datePrecision: 'MONTH',
        reason: 'After 251 Lübeck infants were vaccinated with BCG in early 1930, dozens fell ill with tuberculosis and many died, provoking public alarm and a medical controversy over whether the BCG vaccine itself was dangerous, including the hypothesis that the attenuated strain had reverted to full virulence. The deaths placed the safety of BCG — in use since 1921 — into open dispute.',
        source: {
          externalId: 'src:lubeck-bcg-plos-pathogens-2016',
          name: 'Tuberculosis in Newborns: The Lessons of the \'Lübeck Disaster\' (1929–1933). PLOS Pathogens. 2016;12(1):e1005271.',
          url: 'https://journals.plos.org/plospathogens/article?id=10.1371/journal.ppat.1005271',
          publishedAt: '2016-01-21',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'JUDICIAL',
        occurredAt: '1932-02-06',
        datePrecision: 'MONTH',
        reason: 'The official inquiry led by Robert Koch Institute investigators and the subsequent Lübeck criminal trial concluded that the vaccine had been accidentally contaminated with a virulent human tubercle strain stored in the same laboratory, disproving the reversion hypothesis and exonerating the BCG strain itself; laboratory officials were convicted. This settled that the catastrophe was a manufacturing failure, preserving BCG as a usable vaccine.',
        source: {
          externalId: 'src:nakayama-lubeck-bcg-trial-2025',
          name: 'Nakayama DK. A Novel Microbe, Immunization Deaths, and Vaccination on Trial: BCG and the Lübeck Disaster of 1930. The American Surgeon. 2025.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/39788567/',
          publishedAt: '2025-01-09',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PSYCHOPHARMACOLOGY ERA (1950–1990)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Chlorpromazine first antipsychotic — Delay & Deniker 1952 ───────────────
  {
    externalId: 'trajectory:chlorpromazine-first-antipsychotic-1952',
    text: 'On 25 May 1952, Jean Delay and Pierre Deniker reported that chlorpromazine (4560 RP) alone controlled psychotic agitation, hallucinations, and delusions in psychiatric patients — acting as a specific antipsychotic rather than a mere sedative.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1952-05-25',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1952-05-25',
        datePrecision: 'DAY',
        reason: 'After clinical trials began at Sainte-Anne Hospital under Deniker on 24 March 1952, Delay and Deniker presented their first findings on 25 May 1952 and published a rapid series of papers in the Annales Médico-Psychologiques, reporting that chlorpromazine at ~75 mg/day controlled psychotic excitation and improved thinking and emotional behavior without simple sedation. This recorded the first claim that a drug could specifically treat psychosis, founding modern psychopharmacology.',
        source: {
          externalId: 'src:ban-fifty-years-chlorpromazine-2007',
          name: 'Ban TA. Fifty years chlorpromazine: a historical perspective. Neuropsychiatr Dis Treat. 2007;3(4):495–500.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2655089/',
          publishedAt: '2007-08-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1957-01-01',
        datePrecision: 'YEAR',
        reason: 'Chlorpromazine was adopted internationally within two years and in 1957 Henri Laborit, Jean Delay, Pierre Deniker, and Heinz Lehmann received the Albert Lasker Clinical Medical Research Award for introducing antipsychotic medication. The award, alongside the drug\'s worldwide clinical use and its displacement of lobotomy, ratified chlorpromazine\'s antipsychotic efficacy as settled medical knowledge.',
        source: {
          externalId: 'src:ban-fifty-years-chlorpromazine-2007',
          name: 'Ban TA. Fifty years chlorpromazine: a historical perspective. Neuropsychiatr Dis Treat. 2007;3(4):495–500.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2655089/',
          publishedAt: '2007-08-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Imipramine first tricyclic antidepressant — Kuhn 1957 ───────────────────
  {
    externalId: 'trajectory:imipramine-first-tricyclic-antidepressant-1957',
    text: 'On 31 August 1957, Swiss psychiatrist Roland Kuhn reported in the Schweizerische Medizinische Wochenschrift that the iminodibenzyl compound G22355 (imipramine) relieved depressive states, establishing the first antidepressant drug.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1957-08-31',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1957-08-31',
        datePrecision: 'DAY',
        reason: 'Kuhn, testing Geigy\'s antihistamine-like compound G22355 in roughly 100 patients, observed that it did not help psychosis but lifted mood in depressed patients, and published \'Über die Behandlung depressiver Zustände mit einem Iminodibenzylderivat (G 22355)\'. This recorded the first claim that a drug could specifically treat depression, launching the tricyclic antidepressant era.',
        source: {
          externalId: 'src:kuhn-imipramine-g22355-1957',
          name: 'Kuhn R. Über die Behandlung depressiver Zustände mit einem Iminodibenzylderivat (G 22355). Schweiz Med Wochenschr. 1957;87(35–36):1135–40.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13467194/',
          publishedAt: '1957-08-31',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'MARKET',
        occurredAt: '1959-01-01',
        datePrecision: 'YEAR',
        reason: 'Geigy marketed imipramine as Tofranil (Europe 1958, United States 1959), and tricyclic antidepressants rapidly became the mainstay of pharmacological depression treatment for the next three decades. Clinical adoption and regulatory marketing settled imipramine\'s antidepressant efficacy as established practice.',
        source: {
          externalId: 'src:wikipedia-imipramine',
          name: 'Imipramine. Wikipedia (history and medical use sections).',
          url: 'https://en.wikipedia.org/wiki/Imipramine',
          publishedAt: '2026-06-18',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Levodopa chronic treatment for Parkinson's — Cotzias 1969 ───────────────
  {
    externalId: 'trajectory:levodopa-chronic-treatment-parkinsons-1969',
    text: 'On 13 February 1969, George Cotzias and colleagues reported in the New England Journal of Medicine that gradually escalated high-dose oral L-dopa (levodopa) produced sustained, often dramatic improvement in patients with Parkinson\'s disease.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1969-02-13',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1969-02-13',
        datePrecision: 'DAY',
        reason: 'Building on his 1967 report of high-dose DL-dopa, Cotzias published \'Modification of Parkinsonism — Chronic Treatment with L-Dopa,\' showing that slowly increased oral levodopa improved 28 patients (marked or dramatic benefit in 20) sustained up to two years. This recorded the claim that replenishing dopamine precursor could reverse parkinsonian disability, overturning therapeutic nihilism about Parkinson\'s disease.',
        source: {
          externalId: 'src:cotzias-modification-parkinsonism-ldopa-1969',
          name: 'Cotzias GC, Papavasiliou PS, Gellene R. Modification of Parkinsonism — chronic treatment with L-dopa. N Engl J Med. 1969;280(7):337–45.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/4178641/',
          publishedAt: '1969-02-13',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'MARKET',
        occurredAt: '1970-01-01',
        datePrecision: 'YEAR',
        reason: 'Cotzias\'s work won the 1969 Lasker Prize, and levodopa was first marketed in 1970 by Roche as Larodopa, becoming the standard first-line treatment for Parkinson\'s disease — a status it retains today. Regulatory approval and universal clinical adoption settled levodopa\'s efficacy.',
        source: {
          externalId: 'src:wikipedia-levodopa',
          name: 'Levodopa. Wikipedia (history and medical use sections).',
          url: 'https://en.wikipedia.org/wiki/Levodopa',
          publishedAt: '2026-06-18',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Fluoxetine (Prozac) first SSRI FDA approval — 1987 ──────────────────────
  {
    externalId: 'trajectory:fluoxetine-prozac-first-ssri-approval-1987',
    text: 'On 29 December 1987, the U.S. FDA approved Eli Lilly\'s fluoxetine hydrochloride (Prozac, NDA 018936) for major depression — the first selective serotonin reuptake inhibitor (SSRI) marketed in the United States.',
    claimType: 'HYBRID',
    claimEmergedAt: '1987-12-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1987-12-29',
        datePrecision: 'DAY',
        reason: 'After four years of FDA review, fluoxetine was approved under NDA 018936 as a safe and effective antidepressant with a more favorable side-effect profile than tricyclics and MAOIs. As the first SSRI on the U.S. market, its approval institutionally settled the serotonin-selective approach to depression and launched the modern antidepressant era.',
        source: {
          externalId: 'src:openfda-prozac-nda018936',
          name: 'U.S. FDA. Drugs@FDA application NDA 018936 (PROZAC / fluoxetine hydrochloride, Eli Lilly), original approval 1987-12-29. openFDA drug/drugsfda API.',
          url: 'https://api.fda.gov/drug/drugsfda.json?search=openfda.application_number:NDA018936&limit=1',
          publishedAt: '1987-12-29',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Benzodiazepine dependence reversal — 1981 ───────────────────────────────
  {
    externalId: 'trajectory:benzodiazepine-dependence-reversal-1981',
    text: 'Benzodiazepines such as chlordiazepoxide (Librium, 1960) and diazepam (Valium, 1963) were marketed and accepted as safe, non-addictive anxiolytics suitable for long-term use — a claim reversed after physical dependence at therapeutic doses was demonstrated.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1963-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'MARKET',
        occurredAt: '1977-01-01',
        datePrecision: 'YEAR',
        reason: 'Promoted as safer than barbiturates and free of meaningful addiction risk, benzodiazepines became the most prescribed class of drugs in the world by 1977, with long-term use for anxiety and insomnia regarded as routine and safe. Market dominance and prescribing norms settled the non-addictive claim in practice.',
        source: {
          externalId: 'src:wikipedia-benzodiazepine-history',
          name: 'Benzodiazepine. Wikipedia (history and dependence sections).',
          url: 'https://en.wikipedia.org/wiki/Benzodiazepine',
          publishedAt: '2026-06-18',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1981-09-05',
        datePrecision: 'DAY',
        reason: 'Petursson and Lader published \'Withdrawal from long-term benzodiazepine treatment\' in the BMJ, documenting a reproducible withdrawal syndrome on gradual discontinuation in patients taking therapeutic doses. This established that benzodiazepines produce genuine physical dependence even when used as prescribed, directly contesting the non-addictive claim.',
        source: {
          externalId: 'src:petursson-lader-benzodiazepine-withdrawal-1981',
          name: 'Petursson H, Lader MH. Withdrawal from long-term benzodiazepine treatment. Br Med J (Clin Res Ed). 1981;283(6292):643–5.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6114776/',
          publishedAt: '1981-09-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '1988-01-01',
        datePrecision: 'YEAR',
        reason: 'The UK Committee on Safety of Medicines issued guidance (Current Problems No. 21) restricting benzodiazepines to short-term use of 2–4 weeks for anxiety or insomnia that is severe and disabling, citing dependence and withdrawal. This regulatory reversal overturned the prior standard of safe long-term prescribing.',
        source: {
          externalId: 'src:wikipedia-benzodiazepine-csm-1988',
          name: 'Benzodiazepine. Wikipedia (Committee on Safety of Medicines 1988 guidance).',
          url: 'https://en.wikipedia.org/wiki/Benzodiazepine',
          publishedAt: '2026-06-18',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // POST-MARKET SURVEILLANCE & REVERSAL ERA (1996–2008)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Fen-phen valvulopathy reversal — 1997 ───────────────────────────────────
  {
    externalId: 'trajectory:fenfluramine-phentermine-valvulopathy-1997',
    text: "The combination appetite-suppressant regimen fenfluramine-phentermine ('fen-phen'), together with dexfenfluramine (Redux, FDA-approved 29 April 1996), was promoted as a safe and effective pharmacological treatment for obesity until Connolly and colleagues reported in the New England Journal of Medicine on 28 August 1997 that it caused valvular heart disease, prompting FDA-requested withdrawal of fenfluramine and dexfenfluramine on 15 September 1997.",
    claimType: 'HYBRID',
    claimEmergedAt: '1996-04-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1996-04-29',
        datePrecision: 'DAY',
        reason: "The FDA approved dexfenfluramine (Redux), the first new prescription weight-loss drug in 23 years, validating serotonergic appetite suppressants for obesity. Combined with the already-popular off-label fenfluramine-phentermine ('fen-phen') regimen, this drove millions of prescriptions and institutionally established the drugs as a safe, effective obesity treatment.",
        source: {
          externalId: 'src:fda-redux-dexfenfluramine-approval-1996',
          name: 'U.S. Food and Drug Administration. Drugs@FDA: Redux (dexfenfluramine hydrochloride), NDA 020419, approved 29 April 1996.',
          url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=020419',
          publishedAt: '1996-04-29',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1997-08-28',
        datePrecision: 'DAY',
        reason: 'Connolly et al. reported 24 women who developed unusual valvular heart disease (histopathology identical to carcinoid/ergotamine valve damage) after taking fenfluramine-phentermine. The case series identified a previously unrecognized serious cardiac toxicity of the appetite-suppressant regimen, directly contesting its safety profile in the expert literature.',
        source: {
          externalId: 'src:connolly-fenphen-valvular-nejm-1997',
          name: 'Connolly HM, Crary JL, McGoon MD, et al. Valvular heart disease associated with fenfluramine-phentermine. N Engl J Med. 1997;337(9):581-588.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9271479/',
          publishedAt: '1997-08-28',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '1997-09-15',
        datePrecision: 'DAY',
        reason: "After echocardiographic surveys confirmed valvular abnormalities in roughly a third of fen-phen users, the FDA requested that manufacturers voluntarily withdraw fenfluramine (Pondimin) and dexfenfluramine (Redux) from the U.S. market on 15 September 1997. The withdrawal reversed the drugs' safety claim and became a landmark post-market surveillance case, later driving multibillion-dollar product-liability settlements.",
        source: {
          externalId: 'src:fda-fenfluramine-dexfenfluramine-withdrawal-1997',
          name: 'U.S. Food and Drug Administration. FDA Announces Withdrawal of Fenfluramine and Dexfenfluramine (Fen-Phen). 15 September 1997.',
          url: 'https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/fda-announces-withdrawal-fenfluramine-and-dexfenfluramine-fen-phen',
          publishedAt: '1997-09-15',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Troglitazone (Rezulin) liver-failure withdrawal — 2000 ──────────────────
  {
    externalId: 'trajectory:troglitazone-rezulin-withdrawal-2000',
    text: 'Troglitazone (Rezulin, Warner-Lambert/Parke-Davis), the first thiazolidinedione insulin-sensitizer, was approved by the FDA on 29 January 1997 as a safe and effective oral treatment for type 2 diabetes, a claim reversed when the FDA requested its withdrawal from the U.S. market in March 2000 after reports of fatal liver failure.',
    claimType: 'HYBRID',
    claimEmergedAt: '1997-01-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1997-01-29',
        datePrecision: 'DAY',
        reason: 'The FDA approved troglitazone (Rezulin), the first drug in the thiazolidinedione class, which lowered blood glucose by improving insulin sensitivity — a novel mechanism for type 2 diabetes. Approval established it as a safe, effective oral antidiabetic, and it generated more than $2.1 billion in sales.',
        source: {
          externalId: 'src:fda-rezulin-troglitazone-approval-1997',
          name: 'U.S. Food and Drug Administration. Drugs@FDA: Rezulin (troglitazone), NDA 020720, approved 29 January 1997.',
          url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=020720',
          publishedAt: '1997-01-29',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2000-03-21',
        datePrecision: 'DAY',
        reason: 'After post-marketing reports of idiosyncratic hepatotoxicity (ultimately dozens of liver-failure deaths), and once the safer congeners rosiglitazone and pioglitazone were available, the FDA requested withdrawal of Rezulin from the U.S. market. The reversal retired the first thiazolidinedione on liver-safety grounds and became a defining post-market surveillance failure of the 1990s.',
        source: {
          externalId: 'src:bmj-rezulin-troglitazone-withdrawal-2001',
          name: 'Charatan F. Company played down drug\'s risks, report says (troglitazone/Rezulin withdrawn from market March 2000 over liver failure). BMJ. 2001;322(7288):694.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1119902/',
          publishedAt: '2001-03-24',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Rosiglitazone (Avandia) MI signal — 2007 ────────────────────────────────
  {
    externalId: 'trajectory:rosiglitazone-avandia-myocardial-infarction-2007',
    text: 'Rosiglitazone (Avandia, GlaxoSmithKline), a thiazolidinedione approved by the FDA on 25 May 1999 and widely used for type 2 diabetes, was placed under serious cardiovascular-safety doubt when Nissen and Wolski reported a meta-analysis in the New England Journal of Medicine (online 21 May 2007) finding the drug significantly increased the risk of myocardial infarction.',
    claimType: 'HYBRID',
    claimEmergedAt: '1999-05-25',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1999-05-25',
        datePrecision: 'DAY',
        reason: 'The FDA approved rosiglitazone (Avandia), positioning it as a safer thiazolidinedione successor to the withdrawn troglitazone. It became one of the best-selling diabetes drugs worldwide, institutionally settled as a safe, effective glucose-lowering agent.',
        source: {
          externalId: 'src:fda-avandia-rosiglitazone-approval-1999',
          name: 'U.S. Food and Drug Administration. Drugs@FDA: Avandia (rosiglitazone maleate), NDA 021071, approved 25 May 1999.',
          url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=021071',
          publishedAt: '1999-05-25',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2007-05-21',
        datePrecision: 'DAY',
        reason: 'Nissen and Wolski pooled 42 trials and found rosiglitazone associated with a significant 43% increase in myocardial infarction (odds ratio 1.43) and a borderline increase in cardiovascular death (OR 1.64). The early-online NEJM release triggered a regulatory and scientific firestorm, congressional hearings, a 2007 boxed warning, and 2010 prescribing restrictions, decisively contesting the drug\'s cardiovascular safety.',
        source: {
          externalId: 'src:nissen-rosiglitazone-mi-nejm-2007',
          name: 'Nissen SE, Wolski K. Effect of rosiglitazone on the risk of myocardial infarction and death from cardiovascular causes. N Engl J Med. 2007;356(24):2457-2471.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/17517853/',
          publishedAt: '2007-05-21',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Cerivastatin (Baycol) rhabdomyolysis withdrawal — 2001 ──────────────────
  {
    externalId: 'trajectory:cerivastatin-baycol-withdrawal-2001',
    text: "Cerivastatin (Baycol/Lipobay, Bayer), an HMG-CoA reductase inhibitor approved by the FDA in 1997 and marketed as a safe and effective cholesterol-lowering statin, was voluntarily withdrawn from the market on 8 August 2001 after post-marketing surveillance linked it to fatal rhabdomyolysis at rates roughly 5–10 times higher than other statins.",
    claimType: 'HYBRID',
    claimEmergedAt: '1997-06-26',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1997-06-26',
        datePrecision: 'DAY',
        reason: 'The FDA approved cerivastatin (Baycol), establishing it as a safe and effective statin for lowering LDL cholesterol. It was marketed globally (as Lipobay outside the U.S.) and competed in the rapidly expanding statin market.',
        source: {
          externalId: 'src:fda-baycol-cerivastatin-approval-1997',
          name: 'U.S. Food and Drug Administration. Drugs@FDA: Baycol (cerivastatin sodium), NDA 020740, approved 26 June 1997.',
          url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=020740',
          publishedAt: '1997-06-26',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'MARKET',
        occurredAt: '2001-08-08',
        datePrecision: 'DAY',
        reason: "Bayer voluntarily withdrew cerivastatin worldwide after post-marketing reports of fatal rhabdomyolysis (52 deaths, with markedly elevated risk at the 0.8 mg dose and in combination with gemfibrozil). Communicated in an 8 August 2001 letter to health professionals and supported by the FDA, the withdrawal reversed the drug's safety claim and reinforced muscle toxicity as a recognized statin class risk requiring careful dosing and drug-interaction vigilance.",
        source: {
          externalId: 'src:bmj-cerivastatin-baycol-withdrawal-2001',
          name: 'Charatan F. Bayer decides to withdraw cholesterol lowering drug (cerivastatin/Baycol withdrawn 8 August 2001 over rhabdomyolysis deaths). BMJ. 2001;323(7309):359.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1120974/',
          publishedAt: '2001-08-18',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── DEA tramadol Schedule IV — 2014 ─────────────────────────────────────────
  {
    externalId: 'trajectory:dea-tramadol-schedule-iv-2014',
    text: 'The U.S. Drug Enforcement Administration published a final rule on July 2, 2014 placing tramadol into Schedule IV of the Controlled Substances Act effective August 18, 2014, formally reclassifying as a controlled substance with abuse potential a drug that had been marketed and prescribed in the United States since 1995 as a uniquely low-risk, non-scheduled opioid analgesic.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2014-07-02',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2014-07-02',
        datePrecision: 'DAY',
        reason: 'After accumulating reports of dependence, withdrawal, and abuse, the DEA — following an HHS scientific and medical evaluation — published a final rule (79 FR 37623) placing tramadol into Schedule IV, effective August 18, 2014. The action overturned the long-standing institutional premise, in place since tramadol\'s 1995 U.S. launch as an unscheduled analgesic, that the drug carried negligible abuse liability, formally recognizing it as a controlled substance with potential for psychological and physical dependence.',
        source: {
          externalId: 'src:dea-tramadol-schedule-iv-fr-2014',
          name: 'Drug Enforcement Administration. Schedules of Controlled Substances: Placement of Tramadol Into Schedule IV. Final rule. Fed. Reg. 79(127):37623-37630, July 2, 2014.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/25016619/',
          publishedAt: '2014-07-02',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Oklahoma J&J opioid public-nuisance verdict — 2019 (REVERSED) ────────────
  {
    externalId: 'trajectory:oklahoma-johnson-johnson-opioid-nuisance-2019',
    text: 'On August 26, 2019, Cleveland County District Court Judge Thad Balkman ruled in State of Oklahoma ex rel. Hunter v. Johnson & Johnson that the company\'s misleading opioid marketing had created a public nuisance fueling the state\'s opioid epidemic, ordering a $572.1 million abatement payment (later corrected to $465 million) — the first court verdict holding an opioid manufacturer liable under public nuisance law.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2019-08-26',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'JUDICIAL',
        occurredAt: '2019-08-26',
        datePrecision: 'DAY',
        reason: 'Following the first state opioid trial to reach verdict, Judge Balkman found that Johnson & Johnson and its Janssen subsidiary had run a deceptive marketing campaign convincing Oklahoma prescribers that opioids were safe and effective for chronic non-malignant pain, thereby creating a public nuisance, and ordered a $572.1 million abatement plan (amended to $465 million in November 2019 to correct a math error). The ruling judicially established product-marketing-as-public-nuisance as a viable theory of manufacturer liability for the epidemic.',
        source: {
          externalId: 'src:balkman-oklahoma-jj-opioid-ruling-2019',
          name: 'Cleveland County District Court (Judge Thad Balkman). State of Oklahoma ex rel. Hunter v. Purdue Pharma / Johnson & Johnson, Findings of Fact and Conclusions of Law, CJ-2017-816, Aug. 26, 2019.',
          url: 'https://nondoc.com/2019/08/26/read-the-full-johnson-johnson-opioid-ruling-from-judge-thad-balkman/',
          publishedAt: '2019-08-26',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'JUDICIAL',
        occurredAt: '2021-11-09',
        datePrecision: 'DAY',
        reason: 'The Oklahoma Supreme Court, in a 5-1 decision (2021 OK 54), vacated the verdict and held that the state\'s public nuisance statute does not extend to the manufacturing, marketing, and selling of products, warning that doing so would convert product-liability actions into unbounded public nuisance claims. The reversal repudiated the legal theory the 2019 ruling had established and became a leading precedent cutting off public-nuisance opioid suits against manufacturers nationwide.',
        source: {
          externalId: 'src:okla-supreme-court-jj-opioid-2021-ok-54',
          name: 'Oklahoma Supreme Court. State of Oklahoma ex rel. Hunter v. Johnson & Johnson, 2021 OK 54, No. 118,474, Nov. 9, 2021.',
          url: 'https://law.justia.com/cases/oklahoma/supreme-court/2021/118474.html',
          publishedAt: '2021-11-09',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Purdue Sackler nonconsensual bankruptcy release — 2021 (REVERSED) ────────
  {
    externalId: 'trajectory:purdue-sackler-nonconsensual-release-2021',
    text: 'Purdue Pharma\'s Chapter 11 reorganization plan, confirmed by the U.S. Bankruptcy Court on September 1, 2021, granted the Sackler family nonconsensual third-party releases extinguishing victims\' civil opioid claims against them in exchange for roughly $6 billion — a settlement structure affirmed by the Second Circuit before the U.S. Supreme Court held it unauthorized.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2021-09-01',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'JUDICIAL',
        occurredAt: '2021-09-01',
        datePrecision: 'DAY',
        reason: 'Bankruptcy Judge Robert Drain confirmed Purdue\'s plan over the objection of thousands of creditors, including eight states and the District of Columbia, ratifying nonconsensual releases that barred opioid victims from suing the Sackler family in return for the family\'s ~$6 billion contribution. The U.S. Court of Appeals for the Second Circuit affirmed the plan on May 30, 2023, settling at the appellate level the premise that a Chapter 11 plan could discharge claims against non-debtor third parties without claimant consent.',
        source: {
          externalId: 'src:crs-purdue-third-party-release-2024',
          name: 'Congressional Research Service. Harrington v. Purdue Pharma: Supreme Court Holds That a Chapter 11 Reorganization Plan Cannot Include a Nonconsensual Release of Claims Against Non-Debtors. LSB11201, 2024.',
          url: 'https://www.congress.gov/crs-product/LSB11201',
          publishedAt: '2024-07-15',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'JUDICIAL',
        occurredAt: '2024-06-27',
        datePrecision: 'DAY',
        reason: 'In Harrington v. Purdue Pharma L.P. the U.S. Supreme Court, 5-4 (Gorsuch, J.), held that the Bankruptcy Code does not authorize a release and injunction that, as part of a Chapter 11 plan, effectively discharge claims against a non-debtor without the affected claimants\' consent. The decision invalidated the Sackler releases and the settlement built on them, reversing the Second Circuit and unwinding the central legal mechanism by which the Sacklers had sought to extinguish opioid liability through Purdue\'s bankruptcy.',
        source: {
          externalId: 'src:scotus-harrington-purdue-2024',
          name: 'Supreme Court of the United States. Harrington v. Purdue Pharma L.P., No. 23-124, 603 U.S. ___ (June 27, 2024).',
          url: 'https://www.supremecourt.gov/opinions/23pdf/23-124_8nk0.pdf',
          publishedAt: '2024-06-27',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── FDA OTC naloxone (Narcan) approval — 2023 ────────────────────────────────
  {
    externalId: 'trajectory:fda-otc-naloxone-narcan-2023',
    text: 'The U.S. Food and Drug Administration approved Narcan (4 mg naloxone hydrochloride nasal spray) for over-the-counter, nonprescription use on March 29, 2023 — the first opioid-overdose-reversal product cleared for sale without a prescription, reclassifying the overdose antidote from a prescription-gated drug to a consumer good available in retail stores.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2023-03-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2023-03-29',
        datePrecision: 'DAY',
        reason: 'After its advisory committee voted unanimously in February 2023 that the benefits of nonprescription access outweighed the risks, the FDA approved Narcan 4 mg naloxone nasal spray — first approved as a prescription drug in 2015 — for over-the-counter use, allowing direct retail sale in drug stores, convenience stores, and online. The decision institutionally settled the judgment that laypersons can safely use naloxone to reverse opioid overdose without clinical gatekeeping, a reversal of the decades-long premise that the antidote required prescription control.',
        source: {
          externalId: 'src:fda-otc-naloxone-narcan-2023',
          name: 'U.S. Food and Drug Administration. FDA Approves First Over-the-Counter Naloxone Nasal Spray. News release, March 29, 2023.',
          url: 'https://www.fda.gov/news-events/press-announcements/fda-approves-first-over-counter-naloxone-nasal-spray',
          publishedAt: '2023-03-29',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── DSM-5 substance use disorder reclassification — 2013 ─────────────────────
  {
    externalId: 'trajectory:dsm5-substance-use-disorder-reclassification-2013',
    text: 'On May 18, 2013 the American Psychiatric Association released the DSM-5, which abolished the separate DSM-IV diagnoses of \'substance abuse\' and \'substance dependence\' and merged them into a single \'substance use disorder\' graded on a mild–moderate–severe severity continuum — reclassifying addiction, including opioid use disorder, as a unitary spectrum condition.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2013-05-18',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2013-05-18',
        datePrecision: 'DAY',
        reason: 'Released at the APA annual meeting, DSM-5 eliminated the dichotomous abuse/dependence categories — which research (summarized by Hasin and colleagues in the American Journal of Psychiatry) had shown did not reflect a true diagnostic boundary and which conflated physiological dependence with addiction — and replaced them with one \'substance use disorder\' diagnosis requiring two or more of eleven criteria, dropping legal-problems and adding craving, scored by severity. The reclassification became the institutional standard for diagnosing addiction, including opioid use disorder, across U.S. clinical, research, and payer systems.',
        source: {
          externalId: 'src:apa-dsm5-substance-use-disorder-2013',
          name: 'American Psychiatric Association. Substance-Related and Addictive Disorders (DSM-5 fact sheet documenting merger of abuse and dependence into substance use disorder). 2013.',
          url: 'https://www.psychiatry.org/file%20library/psychiatrists/practice/dsm/apa_dsm-5-substance-use-disorder.pdf',
          publishedAt: '2013-05-18',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── ACCORD trial — intensive glucose lowering mortality — 2008 ───────────────
  {
    externalId: 'trajectory:accord-intensive-glucose-lowering-mortality-2008',
    text: "The prevailing 'lower-is-better' premise — that driving HbA1c toward the normal range (<6.0%) in type 2 diabetes would reduce cardiovascular events and death, supported by the UKPDS 35 observational analysis (BMJ, 12 August 2000) showing each 1% HbA1c reduction associated with ~14% fewer myocardial infarctions — was reversed for intensive glycemic targets when the ACCORD trial reported in the NEJM on 12 June 2008 that intensive glucose lowering increased mortality and was stopped early.",
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2000-08-12',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2000-08-12',
        datePrecision: 'DAY',
        reason: 'The UKPDS 35 prospective observational analysis reported that lower HbA1c correlated continuously with reduced complications — each 1% reduction associated with a 14% lower risk of myocardial infarction, with the lowest risk in those with HbA1c in the normal range (<6.0%). This recorded in the literature the rationale that pushing glycemia toward normal would reduce cardiovascular events, the hypothesis large intensive-control RCTs were designed to confirm.',
        source: {
          externalId: 'src:ukpds35-glycaemia-complications-bmj-2000',
          name: 'Stratton IM, Adler AI, Neil HA, et al. (UKPDS Group). Association of glycaemia with macrovascular and microvascular complications of type 2 diabetes (UKPDS 35). BMJ. 2000;321(7258):405-412.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/10938048/',
          publishedAt: '2000-08-12',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2008-06-12',
        datePrecision: 'DAY',
        reason: 'The ACCORD trial randomized 10,251 high-risk type 2 diabetics to intensive (HbA1c <6.0%) versus standard glucose control and found higher all-cause mortality in the intensive arm, forcing early discontinuation of intensive therapy after 3.5 years without a cardiovascular benefit. The result reversed the assumption that near-normal glycemic targets reduce cardiovascular death; together with ADVANCE and VADT it drove guidelines to abandon universal intensive targets in favor of individualized goals (~7%).',
        source: {
          externalId: 'src:accord-intensive-glucose-mortality-nejm-2008',
          name: 'The Action to Control Cardiovascular Risk in Diabetes Study Group. Effects of intensive glucose lowering in type 2 diabetes. N Engl J Med. 2008;358(24):2545-2559.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/18539917/',
          publishedAt: '2008-06-12',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // WOMEN'S HEALTH & HORMONES ERA (1894–1960)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Allen–Doisy ovarian hormone / estrogen — 1923 ───────────────────────────
  {
    externalId: 'trajectory:allen-doisy-ovarian-hormone-estrogen-1923',
    text: 'Edgar Allen and Edward A. Doisy reported in JAMA on 8 September 1923 that an extract of ovarian follicular fluid produced characteristic estrus changes in spayed test animals, establishing the existence of a specific ovarian hormone (later named estrogen) and a quantitative bioassay (the Allen–Doisy test) for it.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1923-09-08',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1923-09-08',
        datePrecision: 'DAY',
        reason: 'Allen and Doisy published \'An ovarian hormone: preliminary report on its localization, extraction and partial purification, and action in test animals\' in JAMA (1923;81:819–821), showing that follicular-fluid extract induced cornification of the vaginal epithelium and estrus in ovariectomized rodents. This recorded in the expert literature the claim that the ovary secretes a discrete chemical hormone and provided the first reproducible bioassay to detect and measure it, founding the field of estrogen endocrinology.',
        source: {
          externalId: 'src:allen-doisy-ovarian-hormone-jama-1923',
          name: 'Allen E, Doisy EA. An ovarian hormone: preliminary report on its localization, extraction and partial purification, and action in test animals. JAMA. 1923;81(10):819–821. (Landmark article reproduced JAMA. 1983;250(19):2681–2683.)',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6355545/',
          publishedAt: '1923-09-08',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1929-08-01',
        datePrecision: 'MONTH',
        reason: 'Doisy, working with Clement Veler and Sidney Thayer, isolated pure crystalline estrone (\'theelin\') from pregnancy urine (announced at the 13th International Physiological Congress, Boston, August 1929; published as \'The preparation of the crystalline follicular ovarian hormone: theelin,\' J Biol Chem 1930;87:357–371), with Adolf Butenandt crystallizing the same compound independently. Reducing the bioassay-defined hormone to a defined, weighable chemical substance settled the claim that the ovarian hormone was a single isolable molecule and made standardized estrogen therapy and synthesis possible.',
        source: {
          externalId: 'src:doisy-crystalline-theelin-jbc-1930',
          name: 'Doisy EA, Veler CD, Thayer S. The preparation of the crystalline follicular ovarian hormone: theelin. J Biol Chem. 1930;87:357–371.',
          url: 'https://www.jbc.org/article/S0021-9258(19)66427-6/pdf',
          publishedAt: '1930-01-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Halsted radical mastectomy — 1894 → 2002 ────────────────────────────────
  {
    externalId: 'trajectory:halsted-radical-mastectomy-breast-cancer-1894',
    text: 'William Stewart Halsted reported in Annals of Surgery in 1894 that en bloc removal of the entire breast, underlying pectoral muscles, and axillary lymph nodes (the radical mastectomy) reduced local recurrence of breast cancer to roughly 6% in 50 cases at Johns Hopkins, establishing the claim that maximally wide anatomical resection was necessary to cure breast cancer.',
    claimType: 'HYBRID',
    claimEmergedAt: '1894-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1894-01-01',
        datePrecision: 'YEAR',
        reason: 'Halsted published \'The results of operations for the cure of cancer of the breast performed at the Johns Hopkins Hospital from June, 1889, to January, 1894\' (Annals of Surgery 1894;20:497–555), reporting local-recurrence rates of about 6% versus the 51–82% of leading European surgeons. The dramatic results rapidly established the radical mastectomy as the unquestioned standard of care for breast cancer for the better part of a century, embodying the doctrine that cancer spreads by contiguous local extension and is cured by ever-wider resection.',
        source: {
          externalId: 'src:halsted-radical-mastectomy-annals-1894',
          name: 'Halsted WS. The results of operations for the cure of cancer of the breast performed at the Johns Hopkins Hospital from June, 1889, to January, 1894. Ann Surg. 1894;20(5):497–555.',
          url: 'https://embryo.asu.edu/pages/results-operations-cure-cancer-breast-performed-johns-hopkins-hospital-june-1889-january-1894',
          publishedAt: '1894-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2002-08-22',
        datePrecision: 'DAY',
        reason: 'Fisher and the NSABP reported 25-year follow-up of the randomized B-04 trial (NEJM 2002;347:567–575), which had compared radical mastectomy with total mastectomy with or without radiation: there was no significant difference in disease-free survival, distant-disease-free survival, or overall survival. The trial directly refuted the Halstedian rationale that wider en bloc resection improves cure, confirming that outcomes are governed by occult micrometastatic spread, and the disfiguring radical mastectomy was abandoned in favor of less extensive surgery.',
        source: {
          externalId: 'src:fisher-nsabp-b04-25yr-nejm-2002',
          name: 'Fisher B, Jeong J-H, Anderson S, Bryant J, Fisher ER, Wolmark N. Twenty-five-year follow-up of a randomized trial comparing radical mastectomy, total mastectomy, and total mastectomy followed by irradiation. N Engl J Med. 2002;347(8):567–575.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12192016/',
          publishedAt: '2002-08-22',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Premarin conjugated estrogens for menopause — 1942 → 2004 ───────────────
  {
    externalId: 'trajectory:premarin-conjugated-estrogens-menopause-1942',
    text: 'The U.S. Food and Drug Administration approved Premarin (conjugated equine estrogens, Wyeth-Ayerst) in 1942 for the treatment of menopausal symptoms such as hot flashes, establishing it as a safe and effective hormone therapy for menopausal women.',
    claimType: 'HYBRID',
    claimEmergedAt: '1942-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1942-01-01',
        datePrecision: 'YEAR',
        reason: 'In 1942 the FDA approved conjugated equine estrogens (Premarin), extracted from the urine of pregnant mares, for relief of menopausal symptoms — one of the first products cleared under the 1938 Federal Food, Drug, and Cosmetic Act\'s new safety-review regime. Institutional approval settled the claim that conjugated estrogen replacement was a safe, effective treatment for menopause, and Premarin went on to become one of the most prescribed drugs in the United States.',
        source: {
          externalId: 'src:stefanick-estrogens-history-amjmed-2005',
          name: 'Stefanick ML. Estrogens and progestins: background and history, trends in use, and guidelines and regimens approved by the US Food and Drug Administration. Am J Med. 2005;118(12 Suppl 2):64–73.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16414329/',
          publishedAt: '2005-12-19',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2004-04-14',
        datePrecision: 'DAY',
        reason: 'The Women\'s Health Initiative reported the estrogen-alone arm (conjugated equine estrogen — i.e., Premarin — in 10,739 women with prior hysterectomy; JAMA 2004;291:1701–1712); the NIH had stopped the trial early on 29 February 2004 because CEE increased the risk of stroke (hazard ratio 1.39) without reducing coronary heart disease. The first large randomized trial of Premarin itself overturned the assumption of net cardiovascular benefit and threw the long-settled safety premise of conjugated-estrogen therapy into dispute, sharply curtailing its use.',
        source: {
          externalId: 'src:whi-estrogen-alone-cee-jama-2004',
          name: 'Women\'s Health Initiative Steering Committee. Effects of conjugated equine estrogen in postmenopausal women with hysterectomy: the Women\'s Health Initiative randomized controlled trial. JAMA. 2004;291(14):1701–1712.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15082697/',
          publishedAt: '2004-04-14',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Enovid oral contraceptive FDA approval — 1960 → 1968 ────────────────────
  {
    externalId: 'trajectory:enovid-oral-contraceptive-fda-approval-1960',
    text: 'The U.S. Food and Drug Administration approved Enovid (mestranol/norethynodrel, G.D. Searle) for use as an oral contraceptive in 1960, establishing the first hormonal birth-control pill as a safe and effective means of preventing pregnancy.',
    claimType: 'HYBRID',
    claimEmergedAt: '1960-06-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1960-06-23',
        datePrecision: 'DAY',
        reason: 'After G.D. Searle filed in 1959 to market Enovid (already sold since 1957 for menstrual disorders) for contraception, the FDA announced its decision to approve on 11 May 1960 and the clearance to market Enovid as an oral contraceptive took effect on 23 June 1960. The first regulatory approval of a hormonal contraceptive institutionally settled the claim that an oral steroid could safely and effectively prevent pregnancy, launching the modern era of the birth-control pill.',
        source: {
          externalId: 'src:planned-parenthood-pill-history-enovid-1960',
          name: 'Planned Parenthood Federation of America. Birth Control — A History of the Pill (fact sheet documenting FDA approval of Enovid, 1960).',
          url: 'https://www.plannedparenthood.org/files/1514/3518/7100/Pill_History_FactSheet.pdf',
          publishedAt: '2015-05-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1968-04-27',
        datePrecision: 'DAY',
        reason: 'Inman and Vessey reported in the BMJ (1968;2(5599):193–199) a controlled investigation of deaths from pulmonary, coronary, and cerebral thrombosis and embolism in women of childbearing age, demonstrating a significant association between oral-contraceptive use and fatal thromboembolism. This and parallel UK studies converted the pill\'s settled safety profile into an active safety controversy, prompting U.S. Senate (Nelson Pill) hearings, the first patient package insert, and a shift to lower-dose formulations; high-estrogen Enovid was eventually withdrawn in 1988.',
        source: {
          externalId: 'src:inman-vessey-oc-thromboembolism-bmj-1968',
          name: 'Inman WHW, Vessey MP. Investigation of deaths from pulmonary, coronary, and cerebral thrombosis and embolism in women of child-bearing age. Br Med J. 1968;2(5599):193–199.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1985904/',
          publishedAt: '1968-04-27',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PEDIATRIC & NEONATAL MEDICINE ERA (1958–1991)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Cremer phototherapy neonatal jaundice 1958 ─────────────────────────────
  {
    externalId: 'trajectory:cremer-phototherapy-neonatal-jaundice-1958',
    text: 'Richard Cremer, P.W. Perryman, and D.H. Richards reported in The Lancet on 24 May 1958 that exposure to light lowered serum bilirubin in jaundiced newborns, the first description of phototherapy for neonatal hyperbilirubinaemia.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1958-05-24',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1958-05-24',
        datePrecision: 'DAY',
        reason: 'Following a ward nurse\'s observation that sunlit infants were less jaundiced and that serum left in light lost its yellow color, Cremer and colleagues at Rochford General Hospital showed that controlled light exposure reduced hyperbilirubinaemia in newborns. The Lancet report identified light as a physical treatment for neonatal jaundice — a condition that could otherwise progress to bilirubin encephalopathy (kernicterus).',
        source: {
          externalId: 'src:cremer-lancet-phototherapy-1958',
          name: 'Cremer RJ, Perryman PW, Richards DH. Influence of light on the hyperbilirubinaemia of infants. Lancet. 1958;1(7030):1094-1097.',
          url: 'https://doi.org/10.1016/S0140-6736(58)91849-X',
          publishedAt: '1958-05-24',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1968-01-01',
        datePrecision: 'YEAR',
        reason: 'Cremer\'s finding was largely neglected for about a decade until controlled trials in the United States — notably Lucey and colleagues (Pediatrics, 1968) — confirmed that phototherapy prevented and treated hyperbilirubinaemia of prematurity. Phototherapy then entered routine neonatal practice worldwide, becoming the standard first-line treatment that has spared millions of infants from kernicterus and exchange transfusion.',
        source: {
          externalId: 'src:sixty-years-phototherapy-review-2019',
          name: 'Maisels MJ. Sixty years of phototherapy for neonatal jaundice — from serendipitous observation to standardized treatment and rescue for millions. J Perinatol. 2019;39:1316-1320.',
          url: 'https://www.nature.com/articles/s41372-019-0439-1',
          publishedAt: '2019-06-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── RhoGAM Rh immune globulin HDN prevention 1968 ──────────────────────────
  {
    externalId: 'trajectory:rhogam-rh-immune-globulin-hdn-prevention-1968',
    text: 'On 29 May 1968 U.S. regulators approved Rh₀(D) immune globulin (RhoGAM), developed by Freda, Gorman, and Pollack at Columbia, for postpartum administration to Rh-negative mothers to prevent Rh sensitization and hemolytic disease of the fetus and newborn.',
    claimType: 'HYBRID',
    claimEmergedAt: '1968-05-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1968-05-29',
        datePrecision: 'DAY',
        reason: 'After clinical trials by Freda, Gorman, and Pollack (and independently Clarke\'s Liverpool group) showed that anti-D immunoglobulin given after delivery prevented maternal sensitization, the Division of Biologics Standards (forerunner of the FDA) approved RhoGAM on 29 May 1968. The approval converted an experimental immunoprophylaxis into licensed standard obstetric care; with routine use, hemolytic disease of the newborn — which had killed roughly 10,000 U.S. infants a year — fell dramatically, and the team received the 1980 Lasker Award.',
        source: {
          externalId: 'src:columbia-rhogam-at-50-2018',
          name: 'Columbia University Vagelos College of Physicians and Surgeons. RhoGAM at 50: A Drug Still Saving Lives of Newborns. Columbia Medicine Magazine, Spring/Summer 2018.',
          url: 'https://www.vagelos.columbia.edu/about-us/columbia-medicine-magazine/archives/spring-summer-2018/vp-s-news/rhogam-50-drug-still-saving-lives-newborns',
          publishedAt: '2018-06-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Needleman subclinical lead neurotoxicity children 1979 ─────────────────
  {
    externalId: 'trajectory:needleman-subclinical-lead-neurotoxicity-children-1979',
    text: 'Herbert Needleman and colleagues reported in the New England Journal of Medicine on 29 March 1979 that children with elevated dentine lead levels but no clinical lead poisoning showed measurable IQ deficits and classroom-behavior impairments, establishing the concept of subclinical lead neurotoxicity.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1979-03-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1979-03-29',
        datePrecision: 'DAY',
        reason: 'Needleman et al. published a controlled study in NEJM comparing children with high versus low dentine (tooth) lead, finding significantly lower full-scale IQ on the WISC-R and dose-related deficits in attention and classroom behavior, at exposures below the clinical poisoning threshold. The paper introduced the idea that lead harms children\'s neurodevelopment with no overt symptoms, shifting the question from acute poisoning to population-level subclinical injury.',
        source: {
          externalId: 'src:needleman-nejm-dentine-lead-1979',
          name: 'Needleman HL, Gunnoe C, Leviton A, Reed R, Peresie H, Maher C, Barrett P. Deficits in psychologic and classroom performance of children with elevated dentine lead levels. N Engl J Med. 1979;300(13):689-695.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/763299/',
          publishedAt: '1979-03-29',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1991-10-01',
        datePrecision: 'MONTH',
        reason: 'The CDC\'s 1991 statement Preventing Lead Poisoning in Young Children lowered the blood-lead level of concern from 25 to 10 µg/dL and called for near-universal screening of 1–6-year-olds, citing the accumulated evidence of harm at low levels that Needleman\'s work anchored. Although Needleman personally faced a scientific-misconduct inquiry (1990–1994) from which he was ultimately exonerated, his core finding was independently replicated, and the subclinical-neurotoxicity claim became the basis of U.S. lead policy.',
        source: {
          externalId: 'src:cdc-preventing-lead-poisoning-1991',
          name: 'Centers for Disease Control. Preventing Lead Poisoning in Young Children: A Statement by the Centers for Disease Control. October 1991.',
          url: 'https://stacks.cdc.gov/view/cdc/147840/cdc_147840_DS1.pdf',
          publishedAt: '1991-10-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Fujiwara surfactant replacement RDS 1980 ────────────────────────────────
  {
    externalId: 'trajectory:fujiwara-surfactant-replacement-rds-1980',
    text: 'Tetsuro Fujiwara and colleagues reported in The Lancet on 12 January 1980 that endotracheal instillation of a modified bovine surfactant rapidly improved oxygenation in ten preterm infants with severe hyaline-membrane disease, demonstrating the first successful surfactant-replacement therapy for neonatal respiratory distress syndrome.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1980-01-12',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1980-01-12',
        datePrecision: 'DAY',
        reason: 'Building on Avery and Mead\'s 1959 finding that hyaline-membrane disease reflects surfactant deficiency, Fujiwara\'s team gave a bolus of modified bovine (\'artificial\') surfactant to ten severely ill preterm infants and observed rapid improvement in oxygenation, reduced ventilator pressures, and resolution of radiographic changes, with no apparent harm. This first clinical demonstration that the deficiency could be directly replaced reframed RDS from a supportive-care problem to a treatable one.',
        source: {
          externalId: 'src:fujiwara-lancet-surfactant-1980',
          name: 'Fujiwara T, Maeta H, Chida S, Morita T, Watabe Y, Abe T. Artificial surfactant therapy in hyaline-membrane disease. Lancet. 1980;1(8159):55-59.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6101413/',
          publishedAt: '1980-01-12',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1990-08-01',
        datePrecision: 'MONTH',
        reason: 'A decade of randomized controlled trials confirmed that exogenous surfactant reduced neonatal mortality and pneumothorax in preterm RDS, culminating in the FDA\'s August 1990 approval of the first surfactant product (Exosurf Neonatal, colfosceril) and rapid clinical adoption. Surfactant replacement became standard neonatal-intensive-care practice and a documented driver of falling infant mortality.',
        source: {
          externalId: 'src:surfactant-evolution-review-2017',
          name: 'Halliday HL. The evolution of surfactant therapy for respiratory distress syndrome: past, present and future. Pediatr Res. 2017;81:240-248.',
          url: 'https://www.nature.com/articles/pr2016203',
          publishedAt: '2016-12-21',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── National Childhood Vaccine Injury Act 1986 ──────────────────────────────
  {
    externalId: 'trajectory:national-childhood-vaccine-injury-act-1986',
    text: 'On 14 November 1986 the United States enacted the National Childhood Vaccine Injury Act (Public Law 99-660), creating a no-fault federal compensation program and a Vaccine Injury Table for children injured by mandated childhood vaccines.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1986-11-14',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1986-11-14',
        datePrecision: 'DAY',
        reason: 'Amid a wave of DTP-vaccine injury lawsuits that threatened vaccine supply, Congress enacted the National Childhood Vaccine Injury Act as part of Public Law 99-660, signed 14 November 1986. The Act institutionalized the position that certain childhood vaccines can rarely cause serious injury warranting compensation, replacing tort litigation with a no-fault system funded by a per-dose excise tax and a defined Vaccine Injury Table.',
        source: {
          externalId: 'src:pl-99-660-statute-1986',
          name: 'Public Law 99-660, Nov. 14, 1986, 100 Stat. 3743 (Title III — National Childhood Vaccine Injury Act of 1986). U.S. Statutes at Large.',
          url: 'https://www.congress.gov/99/statute/STATUTE-100/STATUTE-100-Pg3743.pdf',
          publishedAt: '1986-11-14',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1988-10-01',
        datePrecision: 'DAY',
        reason: 'The Vaccine Injury Compensation Program became operational on 1 October 1988, with the Court of Federal Claims and special masters beginning to adjudicate petitions under the Vaccine Injury Table. The no-fault program became the settled, exclusive first route for childhood-vaccine injury claims and has stabilized U.S. vaccine supply and liability for decades.',
        source: {
          externalId: 'src:ncvia-national-vaccine-plan-iom',
          name: 'Institute of Medicine. 1986 National Childhood Vaccine Injury Act (Public Law 99-660), in Priorities for the National Vaccine Plan. National Academies Press, 2010.',
          url: 'https://www.ncbi.nlm.nih.gov/books/NBK220067/',
          publishedAt: '2010-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // GENE THERAPY & RARE DISEASE ERA (1995–2007)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 1. Jesse Gelsinger gene-therapy death — 1999 ───────────────────────────
  {
    externalId: 'trajectory:gelsinger-otc-gene-therapy-death-1999',
    text: 'On 17 September 1999, 18-year-old Jesse Gelsinger died of a fatal systemic inflammatory response 98 hours after receiving an adenoviral vector carrying the ornithine transcarbamylase (OTC) gene at the University of Pennsylvania, the first death directly attributed to a gene-therapy vector.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1999-09-17',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1999-09-17',
        datePrecision: 'DAY',
        reason: 'Jesse Gelsinger, a patient with partial OTC deficiency enrolled in a University of Pennsylvania phase I gene-therapy study, died 98 hours after hepatic-artery infusion of a high-dose adenovirus type 5 vector. The death was reported to the FDA and NIH, triggering federal investigation that halted the Penn Institute for Human Gene Therapy\'s trials and exposed undisclosed adverse events and conflicts of interest. It marked the first recorded human death caused directly by a gene-therapy vector.',
        source: {
          externalId: 'src:raper-gelsinger-otc-2003',
          name: 'Raper SE, Chirmule N, Lee FS, Wivel NA, Bagg A, Gao GP, Wilson JM, Batshaw ML. Fatal systemic inflammatory response syndrome in an ornithine transcarbamylase deficient patient following adenoviral gene transfer. Mol Genet Metab. 2003;80(1-2):148-158.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/14567964/',
          publishedAt: '2003-09-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2003-09-01',
        datePrecision: 'MONTH',
        reason: 'Raper and colleagues published the detailed clinical and pathophysiological analysis of Gelsinger\'s death, establishing that a dose-dependent innate immune (systemic inflammatory) response to the adenoviral vector, not the transgene, caused disseminated intravascular coagulation and multi-organ failure. The peer-reviewed account settled the causal mechanism and reframed adenoviral vector immunotoxicity as a central safety constraint for the gene-therapy field.',
        source: {
          externalId: 'src:raper-gelsinger-otc-2003-analysis',
          name: 'Raper SE, et al. Fatal systemic inflammatory response syndrome in an ornithine transcarbamylase deficient patient following adenoviral gene transfer. Mol Genet Metab. 2003;80(1-2):148-158.',
          url: 'https://www.sciencedirect.com/science/article/abs/pii/S1096719203001690',
          publishedAt: '2003-09-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 2. Riluzole — first ALS drug approval — 1995 ──────────────────────────
  {
    externalId: 'trajectory:riluzole-first-als-drug-approval-1995',
    text: 'On 12 December 1995 the U.S. FDA approved riluzole (Rilutek, NDA 20-599) for amyotrophic lateral sclerosis, the first drug shown to prolong survival in ALS and the first disease-modifying therapy approved for the orphan disease.',
    claimType: 'HYBRID',
    claimEmergedAt: '1994-03-03',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1994-03-03',
        datePrecision: 'DAY',
        reason: 'Bensimon, Lacomblez and Meininger published a randomized, double-blind, placebo-controlled trial in 155 ALS patients showing that riluzole, a glutamate-release inhibitor, lengthened survival (time to death or tracheostomy) versus placebo. This was the first controlled evidence that any drug could alter the course of ALS, recording a candidate disease-modifying effect for a previously untreatable fatal motor neuron disease.',
        source: {
          externalId: 'src:bensimon-riluzole-als-nejm-1994',
          name: 'Bensimon G, Lacomblez L, Meininger V. A controlled trial of riluzole in amyotrophic lateral sclerosis. ALS/Riluzole Study Group. N Engl J Med. 1994;330(9):585-591.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8302340/',
          publishedAt: '1994-03-03',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1995-12-12',
        datePrecision: 'DAY',
        reason: 'The FDA approved riluzole as an orphan drug for ALS on the basis of two controlled trials in which time to tracheostomy or death was longer with riluzole than placebo. The approval established riluzole as the regulatory standard of care and the first survival-prolonging ALS therapy, a status it retained for over two decades despite the survival benefit being modest (a few months).',
        source: {
          externalId: 'src:fda-rilutek-riluzole-nda-20599',
          name: 'FDA. Rilutek (riluzole) — Drugs@FDA, NDA 020599 (original approval 12 Dec 1995).',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/nda/2009/020599Orig1s013.pdf',
          publishedAt: '1995-12-12',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 3. Eculizumab (Soliris) — first PNH therapy — 2007 ────────────────────
  {
    externalId: 'trajectory:eculizumab-soliris-first-pnh-therapy-2007',
    text: 'On 16 March 2007 the U.S. FDA granted accelerated approval to eculizumab (Soliris, BLA 125166), an anti-C5 complement inhibitor, as the first therapy for paroxysmal nocturnal hemoglobinuria (PNH), establishing terminal complement blockade as effective treatment for the orphan hemolytic disease.',
    claimType: 'HYBRID',
    claimEmergedAt: '2006-09-21',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-09-21',
        datePrecision: 'DAY',
        reason: 'The TRIUMPH trial (Hillmen et al.) randomized 87 transfusion-dependent PNH patients to eculizumab or placebo for 26 weeks; hemoglobin stabilization without transfusion was achieved in 49% on eculizumab versus none on placebo, with reduced hemolysis. This provided the first controlled evidence that monoclonal blockade of complement protein C5 could control intravascular hemolysis in PNH.',
        source: {
          externalId: 'src:hillmen-triumph-eculizumab-nejm-2006',
          name: 'Hillmen P, et al. The complement inhibitor eculizumab in paroxysmal nocturnal hemoglobinuria. N Engl J Med. 2006;355(12):1233-1243.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16990386/',
          publishedAt: '2006-09-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2007-03-16',
        datePrecision: 'DAY',
        reason: 'The FDA granted Soliris accelerated orphan-drug approval to reduce hemolysis in PNH, the first approved therapy for the disease and the first terminal-complement inhibitor. The approval settled complement C5 blockade as the standard of care for PNH and inaugurated the complement-inhibitor drug class; Soliris later became emblematic of ultra-high orphan-drug pricing.',
        source: {
          externalId: 'src:fda-soliris-eculizumab-label-2007',
          name: 'FDA. Soliris (eculizumab) prescribing information, BLA 125166 (approved 16 Mar 2007).',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2007/125166lbl.pdf',
          publishedAt: '2007-03-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 4. Alglucosidase alfa (Myozyme) — first Pompe ERT — 2006 ──────────────
  {
    externalId: 'trajectory:alglucosidase-alfa-myozyme-first-pompe-ert-2006',
    text: 'On 28 April 2006 the U.S. FDA approved alglucosidase alfa (Myozyme, Genzyme, BLA 125141), recombinant human acid alpha-glucosidase, as the first enzyme replacement therapy for Pompe disease (GAA deficiency).',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2006-04-28',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-04-28',
        datePrecision: 'DAY',
        reason: 'Pivotal trial data in infantile-onset Pompe disease showed that recombinant acid alpha-glucosidase prolonged ventilator-free survival in a uniformly fatal disorder, supporting Myozyme as the first disease-specific treatment for Pompe disease. The clinical evidence recorded enzyme replacement as effective against the underlying glycogen-storage defect.',
        source: {
          externalId: 'src:myozyme-alglucosidase-history',
          name: 'Drugs.com. Myozyme (alglucosidase alfa) FDA Approval History.',
          url: 'https://www.drugs.com/history/myozyme.html',
          publishedAt: '2006-04-28',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2006-04-28',
        datePrecision: 'DAY',
        reason: 'The FDA approved Myozyme as the first treatment for Pompe disease, an orphan lysosomal storage disorder, establishing enzyme replacement with recombinant GAA as the standard of care. The approval extended the Gaucher/Fabry/MPS enzyme-replacement paradigm to glycogen-storage disease and set the regulatory baseline against which later formulations (Lumizyme, Nexviazyme) were measured.',
        source: {
          externalId: 'src:fda-myozyme-alglucosidase-alfa-2006',
          name: 'FDA / Genzyme. Myozyme (alglucosidase alfa) approval, BLA 125141 (approved 28 Apr 2006).',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2006/125141lbl.pdf',
          publishedAt: '2006-04-28',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 5. Laronidase (Aldurazyme) — first MPS ERT — 2003 ────────────────────
  {
    externalId: 'trajectory:laronidase-aldurazyme-first-mps-ert-2003',
    text: 'On 30 April 2003 the U.S. FDA approved laronidase (Aldurazyme, BioMarin/Genzyme), recombinant human alpha-L-iduronidase, as the first enzyme replacement therapy for mucopolysaccharidosis I (Hurler, Hurler-Scheie, and Scheie syndromes).',
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
        reason: 'Kakkis et al. reported that 52 weeks of recombinant human alpha-L-iduronidase in 10 MPS I patients reduced lysosomal glycosaminoglycan storage (hepatomegaly, urinary GAG) and improved clinical measures such as growth, joint mobility, and apnea. This was the first evidence that enzyme replacement could ameliorate a mucopolysaccharidosis, recording laronidase as a candidate therapy for MPS I.',
        source: {
          externalId: 'src:kakkis-mps1-ert-nejm-2001',
          name: 'Kakkis ED, et al. Enzyme-replacement therapy in mucopolysaccharidosis I. N Engl J Med. 2001;344(3):182-188.',
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
        reason: 'Following a randomized placebo-controlled confirmatory trial, the FDA approved Aldurazyme as an orphan drug with priority review for MPS I, the first enzyme replacement therapy approved for any mucopolysaccharidosis. The approval settled enzyme replacement as the standard of care for MPS I and opened the path to subsequent MPS therapies (galsulfase for MPS VI, idursulfase for MPS II).',
        source: {
          externalId: 'src:fda-aldurazyme-laronidase-2003',
          name: 'FDA. Aldurazyme (laronidase) approval, BLA 125058 (approved 30 Apr 2003).',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2023/125058s246lbl.pdf',
          publishedAt: '2003-04-30',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SURGICAL PROCEDURE REVERSALS (1990–2020)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── LACC trial: minimally invasive radical hysterectomy reversal 2018 ────────
  {
    externalId: 'trajectory:lacc-minimally-invasive-radical-hysterectomy-reversal-2018',
    text: 'The LACC trial (Ramirez et al., New England Journal of Medicine, 31 October 2018) established that minimally invasive (laparoscopic/robotic) radical hysterectomy for early-stage cervical cancer produced significantly lower disease-free and overall survival than open abdominal surgery, reversing the prevailing belief that the minimally invasive approach was oncologically equivalent.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2006-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2006-01-01',
        datePrecision: 'YEAR',
        reason: "Following the introduction of laparoscopic radical hysterectomy in the early 1990s and the clearance and rapid uptake of robotic surgical systems in the mid-2000s, minimally invasive radical hysterectomy was widely adopted as standard for early-stage cervical cancer on the strength of retrospective series suggesting equivalent oncologic outcomes with less surgical morbidity. As the LACC investigators document, the approach 'has been widely adopted' largely on the basis of this non-randomized evidence.",
        source: {
          externalId: 'src:ramirez-lacc-nejm-2018-adoption',
          name: 'Ramirez PT, et al. Minimally Invasive versus Abdominal Radical Hysterectomy for Cervical Cancer. N Engl J Med. 2018;379(20):1895–1904 (background documenting prior adoption from retrospective data).',
          url: 'https://pubmed.ncbi.nlm.nih.gov/30380365/',
          publishedAt: '2018-10-31',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-10-31',
        datePrecision: 'DAY',
        reason: 'The randomized LACC trial (631 women) was stopped early when minimally invasive radical hysterectomy showed markedly worse outcomes than open surgery: 4.5-year disease-free survival 86.0% vs 96.5% and 3-year overall survival 93.8% vs 99.0%. The unexpected result contradicted the retrospective evidence base, prompting NCCN and professional societies to revise guidance toward open surgery and overturning a settled surgical preference.',
        source: {
          externalId: 'src:ramirez-lacc-nejm-2018',
          name: 'Ramirez PT, Frumovitz M, Pareja R, et al. Minimally Invasive versus Abdominal Radical Hysterectomy for Cervical Cancer. N Engl J Med. 2018;379(20):1895–1904.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/30380365/',
          publishedAt: '2018-10-31',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Routine episiotomy reversal 2005 ─────────────────────────────────────────
  {
    externalId: 'trajectory:routine-episiotomy-reversal-2005',
    text: 'The JAMA systematic review by Hartmann et al. (4 May 2005) concluded that routine episiotomy provides none of the maternal benefits long ascribed to it and is associated with worse outcomes, reversing the early-20th-century obstetric doctrine — promoted by DeLee from 1920 — that prophylactic episiotomy should be performed routinely in vaginal birth.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1920-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1979-01-01',
        datePrecision: 'YEAR',
        reason: 'After Joseph DeLee advocated prophylactic episiotomy in 1920, routine episiotomy became entrenched standard obstetric practice through the mid-20th century, performed in a majority of US vaginal deliveries on the belief that the controlled surgical incision prevented severe perineal tearing and protected pelvic-floor function. The Hartmann review documents that the procedure became one of the most common surgical interventions in obstetrics without supporting randomized evidence.',
        source: {
          externalId: 'src:hartmann-episiotomy-jama-2005-history',
          name: 'Hartmann K, et al. Outcomes of routine episiotomy: a systematic review. JAMA. 2005;293(17):2141–2148 (documenting historical routine use).',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15870418/',
          publishedAt: '2005-05-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2005-05-04',
        datePrecision: 'DAY',
        reason: "The systematic review of randomized and observational evidence found that routine episiotomy did not reduce severe perineal trauma, improve healing, or protect pelvic-floor function, and that outcomes 'can be considered worse since some proportion of women who would have had lesser injury instead had a surgical incision.' The conclusion that 'evidence does not support maternal benefits traditionally ascribed to routine episiotomy' was rapidly codified by ACOG Practice Bulletin No. 71 (2006), which recommended restricted rather than routine use.",
        source: {
          externalId: 'src:hartmann-episiotomy-jama-2005',
          name: 'Hartmann K, Viswanathan M, Palmieri R, Gartlehner G, Thorp J Jr, Lohr KN. Outcomes of routine episiotomy: a systematic review. JAMA. 2005;293(17):2141–2148.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15870418/',
          publishedAt: '2005-05-04',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Pulmonary artery catheter reversal 1996–2005 ──────────────────────────────
  {
    externalId: 'trajectory:pulmonary-artery-catheter-reversal-1996',
    text: 'Connors et al. (JAMA, 18 September 1996) reported that pulmonary artery (Swan-Ganz) catheterization in the first 24 hours of ICU care was associated with increased 30-day mortality and resource use in critically ill patients, contesting — and ultimately, with the PAC-Man randomized trial (Lancet, 2005), reversing — the long-settled belief that routine right-heart catheterization improves outcomes.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1970-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1980-01-01',
        datePrecision: 'YEAR',
        reason: 'After Swan and Ganz introduced the balloon-flotation pulmonary artery catheter in 1970, bedside right-heart catheterization was adopted across intensive care and cardiac units worldwide as a routine tool for hemodynamic monitoring, on the assumption that the physiologic data it provided guided better therapy and improved survival. By the early 1990s it was one of the most widely used invasive monitoring procedures in critical care, with little randomized evidence of benefit.',
        source: {
          externalId: 'src:connors-pac-jama-1996-context',
          name: 'Connors AF Jr, et al. The effectiveness of right heart catheterization in the initial care of critically ill patients. JAMA. 1996;276(11):889–897 (documenting widespread prior use).',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8782638/',
          publishedAt: '1996-09-18',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1996-09-18',
        datePrecision: 'DAY',
        reason: "The SUPPORT prospective cohort study (5,735 critically ill patients) found that receiving a pulmonary artery catheter was associated with increased 30-day mortality (roughly 24% higher risk), greater costs, and longer ICU stays, with no patient subgroup identified as benefiting. The finding that 'RHC was associated with increased mortality and increased utilization of resources' overturned the presumption of benefit and triggered calls for a moratorium and for randomized trials.",
        source: {
          externalId: 'src:connors-pac-jama-1996',
          name: 'Connors AF Jr, Speroff T, Dawson NV, et al. The effectiveness of right heart catheterization in the initial care of critically ill patients (SUPPORT). JAMA. 1996;276(11):889–897.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8782638/',
          publishedAt: '1996-09-18',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2005-08-06',
        datePrecision: 'DAY',
        reason: 'The PAC-Man randomized controlled trial (Harvey et al., 1,041 patients across 65 UK ICUs) found no difference in hospital mortality between management with or without a pulmonary artery catheter, providing definitive evidence that routine PAC use conferred no survival benefit. Combined with concurrent negative trials (e.g., ESCAPE), the result drove a sharp and sustained decline in PAC use, abandoning the procedure as routine critical-care practice.',
        source: {
          externalId: 'src:harvey-pacman-lancet-2005',
          name: 'Harvey S, Harrison DA, Singer M, et al. Assessment of the clinical effectiveness of pulmonary artery catheters in management of patients in intensive care (PAC-Man): a randomised controlled trial. Lancet. 2005;366(9484):472–477.',
          url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(05)67061-4/abstract',
          publishedAt: '2005-08-06',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── FDA power morcellation uterine fibroids reversal 2014 ────────────────────
  {
    externalId: 'trajectory:fda-power-morcellation-uterine-fibroids-reversal-2014',
    text: 'On 17 April 2014 the US FDA issued a safety communication discouraging laparoscopic power morcellation for uterine fibroids — estimating roughly 1 in 350 women undergoing hysterectomy/myomectomy for presumed fibroids harbors an unsuspected uterine sarcoma that morcellation can disseminate — reversing the prior status of power morcellation as a routinely safe minimally invasive technique.',
    claimType: 'HYBRID',
    claimEmergedAt: '1995-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1995-01-01',
        datePrecision: 'YEAR',
        reason: 'After electric power morcellators were cleared for marketing in the mid-1990s, laparoscopic power morcellation became a common technique in gynecologic surgery, enabling minimally invasive removal of large fibroid uteri through small incisions and widely regarded as a safe, morbidity-reducing alternative to open surgery. It was incorporated into routine hysterectomy and myomectomy practice without systematic assessment of occult-malignancy dissemination risk.',
        source: {
          externalId: 'src:gao-morcellation-17-231-background',
          name: 'U.S. Government Accountability Office. Medical Devices: Cancer Risk Led FDA to Warn Against Certain Uses of Power Morcellators and Recommend New Labeling. GAO-17-231. 2017 (background on prior use).',
          url: 'https://www.gao.gov/products/gao-17-231',
          publishedAt: '2017-02-07',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '2014-04-17',
        datePrecision: 'DAY',
        reason: "The FDA's April 2014 safety communication discouraged laparoscopic power morcellation for fibroids after reassessing the prevalence of unsuspected uterine sarcoma (~1 in 350) and the risk that morcellation spreads such cancer through the abdomen and pelvis, worsening survival. The warning prompted Johnson & Johnson/Ethicon, the largest manufacturer, to withdraw its morcellators from the market in mid-2014 and threw a routine surgical technique into open dispute.",
        source: {
          externalId: 'src:gao-morcellation-17-231-april2014',
          name: 'U.S. GAO. Medical Devices: Cancer Risk Led FDA to Warn Against Certain Uses of Power Morcellators. GAO-17-231. 2017 (documenting the April 2014 FDA reassessment and safety communication).',
          url: 'https://www.gao.gov/products/gao-17-231',
          publishedAt: '2017-02-07',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2014-11-24',
        datePrecision: 'DAY',
        reason: 'In its updated November 2014 safety communication the FDA recommended a boxed warning and declared power morcellators contraindicated for removing uterine tissue suspected of containing malignancy and in peri-/postmenopausal women or candidates for en bloc removal; all manufacturers adopted the labeling. Routine intraperitoneal power morcellation was effectively abandoned in favor of contained morcellation or alternative approaches, completing the reversal.',
        source: {
          externalId: 'src:gao-morcellation-17-231-nov2014',
          name: 'U.S. GAO. Medical Devices: Cancer Risk Led FDA to Warn Against Certain Uses of Power Morcellators and Recommend New Labeling. GAO-17-231. 2017 (documenting the November 2014 boxed warning and contraindications).',
          url: 'https://www.gao.gov/products/gao-17-231',
          publishedAt: '2017-02-07',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ONCOLOGY FOUNDATIONS ERA (1941–1956)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Huggins hormonal therapy for prostate cancer — 1941 ────────────────────
  {
    externalId: 'trajectory:huggins-hormonal-therapy-prostate-cancer-1941',
    text: 'In April 1941, Charles Huggins and Clarence Hodges reported that castration or estrogen injection lowered serum acid phosphatase and produced regression in metastatic prostate carcinoma, establishing that a cancer could be controlled by manipulating hormones.',
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
        reason: 'Huggins and Hodges published the first of their \'Studies on Prostatic Cancer\' in Cancer Research, showing that androgen deprivation (surgical castration or estrogen) reduced serum acid phosphatase and clinically regressed metastatic prostate cancer, while androgen injection worsened it. This was arguably the first demonstration that a human malignancy is hormone-dependent and could be treated systemically by altering the hormonal environment rather than by surgery or radiation.',
        source: {
          externalId: 'src:huggins-hodges-prostatic-cancer-cancerres-1941',
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
        reason: 'Charles Huggins received the 1966 Nobel Prize in Physiology or Medicine \'for his discoveries concerning hormonal treatment of prostatic cancer.\' The award marked institutional canonization of androgen-deprivation therapy, which remains the foundation of advanced prostate cancer treatment to the present day.',
        source: {
          externalId: 'src:nobel-huggins-prostatic-cancer-1966',
          name: 'The Nobel Prize in Physiology or Medicine 1966 — Charles Brenton Huggins. Nobel Foundation.',
          url: 'https://www.nobelprize.org/prizes/medicine/1966/huggins/facts/',
          publishedAt: '1966-12-10',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Papanicolaou & Traut Pap smear cervical cancer screening — 1941 ────────
  {
    externalId: 'trajectory:papanicolaou-traut-pap-smear-cervical-cancer-1941',
    text: 'In 1941, George Papanicolaou and Herbert Traut reported in the American Journal of Obstetrics and Gynecology that vaginal smear cytology could detect carcinoma of the uterus before symptoms, founding cytological cancer screening.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1941-08-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1941-08-01',
        datePrecision: 'MONTH',
        reason: 'Papanicolaou and Traut published systematic evidence that exfoliative vaginal/cervical cytology could identify uterine and cervical carcinoma, including pre-symptomatic cases. After Papanicolaou\'s 1928 observation had been dismissed for over a decade, this paper established cytological smears as a diagnostic method and laid the foundation for population-based cervical cancer screening.',
        source: {
          externalId: 'src:papanicolaou-traut-vaginal-smears-ajog-1941',
          name: 'Papanicolaou GN, Traut HF. The diagnostic value of vaginal smears in carcinoma of the uterus. Am J Obstet Gynecol. 1941;42:193-206.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9111103/',
          publishedAt: '1941-08-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1943-01-01',
        datePrecision: 'YEAR',
        reason: 'Papanicolaou and Traut\'s 1943 monograph \'Diagnosis of Uterine Cancer by the Vaginal Smear\' systematized the technique, and through the late 1940s and 1950s the American Cancer Society and gynecologic community promoted mass Pap screening, driving a large documented decline in cervical cancer mortality. The test became the institutionally adopted standard of cervical cancer prevention worldwide.',
        source: {
          externalId: 'src:cervical-cancer-screening-history-pmc-2012',
          name: 'Safaeian M, Solomon D, Castle PE (context review). New insights into cervical cancer screening. (history of Pap test adoption following Papanicolaou & Traut). PMC3469864.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3469864/',
          publishedAt: '2012-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CARDIOVASCULAR PHARMACOLOGY ERA (1964–1991)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── WHO clofibrate primary prevention reversal — 1978 ──────────────────────
  {
    externalId: 'trajectory:who-clofibrate-primary-prevention-reversal-1978',
    text: 'The WHO Cooperative Trial reported (British Heart Journal, October 1978) that clofibrate, the first widely used cholesterol-lowering drug, reduced ischaemic heart disease incidence by about 20% in hypercholesterolaemic men but increased total mortality — a finding the 1980 mortality follow-up confirmed as a 25% excess of deaths, discrediting clofibrate for primary prevention.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1978-10-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1978-10-01',
        datePrecision: 'MONTH',
        reason: 'The Committee of Principal Investigators published the primary report of the WHO Cooperative Trial in 15,745 men, documenting a ~20% reduction in non-fatal ischaemic heart disease with clofibrate but simultaneously flagging a statistically significant increase in non-cardiovascular and total mortality in the treated group. This was the first large randomized primary-prevention trial of a lipid-lowering drug, and it recorded the efficacy signal and the mortality alarm together.',
        source: {
          externalId: 'src:who-clofibrate-bhj-1978',
          name: 'Committee of Principal Investigators. A co-operative trial in the primary prevention of ischaemic heart disease using clofibrate. Br Heart J. 1978;40(10):1069-1118.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/361054/',
          publishedAt: '1978-10-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1980-08-23',
        datePrecision: 'DAY',
        reason: 'The Committee\'s mortality follow-up in The Lancet reported 25% more deaths in the clofibrate group than in the high-cholesterol control group (p<0.01), with the excess persisting even after participants stopped the drug. The net-harm verdict overturned the case for clofibrate in primary prevention; clofibrate was subsequently abandoned for cholesterol lowering and the trial became a landmark warning that surrogate (cholesterol) improvement does not guarantee mortality benefit.',
        source: {
          externalId: 'src:who-clofibrate-mortality-lancet-1980',
          name: 'Committee of Principal Investigators. WHO cooperative trial on primary prevention of ischaemic heart disease using clofibrate to lower serum cholesterol: mortality follow-up. Lancet. 1980;2(8191):379-385.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6105515/',
          publishedAt: '1980-08-23',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── CONSENSUS enalapril heart failure mortality — 1987 ─────────────────────
  {
    externalId: 'trajectory:consensus-enalapril-heart-failure-mortality-1987',
    text: 'The CONSENSUS trial reported in the New England Journal of Medicine on 4 June 1987 that the ACE inhibitor enalapril reduced six-month mortality by 40% in patients with severe (NYHA class IV) congestive heart failure, the first demonstration that any drug reduces mortality in heart failure.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1987-06-04',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1987-06-04',
        datePrecision: 'DAY',
        reason: 'The Cooperative North Scandinavian Enalapril Survival Study (CONSENSUS) was stopped early after enalapril added to standard therapy cut six-month mortality from 44% to 26% (a 40% relative reduction) in severe heart failure. This was the first randomized evidence that a pharmacologic agent prolongs survival in heart failure, shifting ACE inhibition from a blood-pressure-lowering use to a survival therapy.',
        source: {
          externalId: 'src:consensus-enalapril-nejm-1987',
          name: 'CONSENSUS Trial Study Group. Effects of enalapril on mortality in severe congestive heart failure. Results of the Cooperative North Scandinavian Enalapril Survival Study (CONSENSUS). N Engl J Med. 1987;316(23):1429-1435.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2883575/',
          publishedAt: '1987-06-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1991-08-01',
        datePrecision: 'DAY',
        reason: 'The SOLVD treatment trial extended the survival benefit of enalapril to the much larger population of patients with mild-to-moderate heart failure and reduced ejection fraction, showing a 16% mortality reduction over ~41 months. Together with CONSENSUS, this established ACE inhibition as a cornerstone of heart-failure therapy and it was incorporated into clinical guidelines worldwide.',
        source: {
          externalId: 'src:solvd-enalapril-nejm-1991',
          name: 'The SOLVD Investigators. Effect of enalapril on survival in patients with reduced left ventricular ejection fractions and congestive heart failure. N Engl J Med. 1991;325(5):293-302.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2057034/',
          publishedAt: '1991-08-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Black propranolol first beta-blocker — 1964 ────────────────────────────
  {
    externalId: 'trajectory:black-propranolol-first-beta-blocker-1964',
    text: 'Black and colleagues reported in The Lancet on 16 May 1964 the first clinically effective beta-adrenergic receptor antagonist, propranolol, demonstrating relief of angina and founding the beta-blocker drug class.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1964-05-16',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1964-05-16',
        datePrecision: 'DAY',
        reason: 'James Black\'s team at ICI reported propranolol, a beta-receptor antagonist roughly ten times more potent and free of the toxicity that had doomed the earlier compound pronethalol, and showed it relieved angina pectoris. The paper introduced rational receptor-targeted drug design to cardiovascular medicine and recorded the founding evidence for the beta-blocker class.',
        source: {
          externalId: 'src:black-propranolol-lancet-1964',
          name: 'Black JW, Crowther AF, Shanks RG, Smith LH, Dornhorst AC. A new adrenergic beta-receptor antagonist. Lancet. 1964;1(7342):1080-1081.',
          url: 'https://doi.org/10.1016/s0140-6736(64)91275-9',
          publishedAt: '1964-05-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1988-10-01',
        datePrecision: 'MONTH',
        reason: 'James W. Black was awarded a share of the 1988 Nobel Prize in Physiology or Medicine for discoveries of important principles in drug treatment, with propranolol and the beta-blocker concept cited as the foundational achievement. By then beta-blockers were entrenched in the treatment of angina, hypertension, and post-myocardial-infarction secondary prevention, marking the institutional settling of the class.',
        source: {
          externalId: 'src:nobel-medicine-1988-black',
          name: 'Nobel Prize in Physiology or Medicine 1988 (James W. Black, Gertrude B. Elion, George H. Hitchings). NobelPrize.org.',
          url: 'https://www.nobelprize.org/prizes/medicine/1988/summary/',
          publishedAt: '1988-10-17',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── MRFIT multifactor intervention null result — 1982 ──────────────────────
  {
    externalId: 'trajectory:mrfit-multifactor-intervention-null-1982',
    text: 'The Multiple Risk Factor Intervention Trial (MRFIT) reported in JAMA on 24 September 1982 that six years of intensive intervention on smoking, blood pressure, and serum cholesterol in 12,866 high-risk men produced no statistically significant reduction in coronary heart disease or all-cause mortality versus usual care.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1982-09-24',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1982-09-24',
        datePrecision: 'DAY',
        reason: 'MRFIT, one of the largest and most expensive prevention trials of its era, found that special multifactor intervention did not significantly lower coronary or total mortality at seven years (CHD death 17.9 vs 19.3 per 1000), an unexpected null that challenged the assumption that aggressive coordinated risk-factor modification would deliver clear mortality benefit. Investigators attributed the result partly to greater-than-expected risk-factor improvement in the usual-care group and raised concern about the antihypertensive (diuretic) regimen in some subgroups.',
        source: {
          externalId: 'src:mrfit-jama-1982',
          name: 'Multiple Risk Factor Intervention Trial Research Group. Multiple Risk Factor Intervention Trial: risk factor changes and mortality results. JAMA. 1982;248(12):1465-1477.',
          url: 'https://biolincc.nhlbi.nih.gov/studies/mrfit/',
          publishedAt: '1982-09-24',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1996-09-01',
        datePrecision: 'MONTH',
        reason: 'The 16-year mortality follow-up in Circulation found lower coronary (11.4%), cardiovascular, and total mortality rates in the special-intervention group, suggesting a delayed and modest benefit that the original 7-year analysis had been too short and underpowered to detect. The reinterpretation left the value of coordinated multifactor primary-prevention intervention genuinely contested rather than cleanly refuted.',
        source: {
          externalId: 'src:mrfit-16yr-circulation-1996',
          name: 'Multiple Risk Factor Intervention Trial Research Group. Mortality after 16 years for participants randomized to the Multiple Risk Factor Intervention Trial. Circulation. 1996;94(5):946-951.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8790030/',
          publishedAt: '1996-09-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // MODERN ERA — INFECTIOUS DISEASE & VACCINE SAFETY (1994–2006)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── ACTG 076 — zidovudine perinatal HIV transmission 1994 ───────────────────
  {
    externalId: 'trajectory:actg-076-zidovudine-perinatal-hiv-transmission-1994',
    text: 'In February 1994, the ACTG 076 data safety monitoring board halted Protocol 076 early after interim analysis showed zidovudine given to HIV-infected pregnant women and their newborns reduced mother-to-child HIV-1 transmission by 67.5% (8.3% vs 25.5%), the first demonstration that an antiretroviral intervention could interrupt vertical HIV transmission.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1994-04-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1994-04-29',
        datePrecision: 'DAY',
        reason: 'The CDC published an MMWR interim report documenting that the ACTG 076 DSMB had halted the trial in February 1994 because interim results showed a 67.5% reduction in perinatal HIV transmission. This was the first formal public record of the finding, establishing the empirical claim before the full NEJM paper (Connor et al., November 1994) confirmed the final results.',
        source: {
          externalId: 'src:actg076-interim-mmwr-1994',
          name: 'CDC. Zidovudine for the Prevention of HIV Transmission from Mother to Infant. MMWR Morb Mortal Wkly Rep. 1994;43(16):285-287.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/00025249.htm',
          publishedAt: '1994-04-29',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1994-08-05',
        datePrecision: 'DAY',
        reason: 'Following the trial\'s early termination, the U.S. Public Health Service issued recommendations (MMWR, August 1994) for routine zidovudine use in pregnancy to reduce perinatal transmission, making the ACTG 076 regimen standard of care. Institutional adoption rapidly drove down U.S. perinatal HIV infection rates over the following years.',
        source: {
          externalId: 'src:phs-zidovudine-perinatal-mmwr-1994',
          name: 'CDC. Recommendations of the U.S. Public Health Service Task Force on the Use of Zidovudine to Reduce Perinatal Transmission of Human Immunodeficiency Virus. MMWR Recomm Rep. 1994;43(RR-11):1-20.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/00032271.htm',
          publishedAt: '1994-08-05',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── NIH consensus H. pylori peptic ulcer 1994 ────────────────────────────────
  {
    externalId: 'trajectory:nih-consensus-h-pylori-peptic-ulcer-1994',
    text: 'On 9 February 1994, an NIH Consensus Development Panel concluded that Helicobacter pylori infection causes most peptic ulcer disease and that ulcer patients with H. pylori should receive antimicrobial therapy, reclassifying peptic ulcer as an infectious disease.',
    claimType: 'HYBRID',
    claimEmergedAt: '1994-02-09',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1994-02-09',
        datePrecision: 'DAY',
        reason: 'After a decade of contested evidence following Marshall and Warren\'s 1983 isolation of H. pylori, the NIH convened a consensus conference (Feb 7-9, 1994) that formally endorsed the bacterial causation of peptic ulcer and recommended antibiotic eradication as treatment. This shifted ulcer disease from an acid/stress paradigm to an infectious one and was published in JAMA in July 1994.',
        source: {
          externalId: 'src:nih-consensus-h-pylori-jama-1994',
          name: 'NIH Consensus Development Panel. Helicobacter pylori in peptic ulcer disease. JAMA. 1994;272(1):65-69.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8007082/',
          publishedAt: '1994-07-06',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── XDR-TB global emergence 2006 ─────────────────────────────────────────────
  {
    externalId: 'trajectory:xdr-tb-global-emergence-2006',
    text: 'On 24 March 2006, the CDC and WHO reported the worldwide emergence of extensively drug-resistant tuberculosis (XDR-TB), finding that 2% of surveyed TB isolates (2000–2004) were resistant to second-line drugs, defining a nearly untreatable form of TB.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2006-03-24',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2006-03-24',
        datePrecision: 'DAY',
        reason: 'A joint CDC/WHO MMWR report analyzed surveillance data and defined XDR-TB, documenting that among 17,690 isolates 20% were MDR and 2% were XDR, with markedly worse mortality. This established the empirical claim that drug-resistance had progressed beyond multidrug-resistant TB to strains resistant to the best second-line regimens.',
        source: {
          externalId: 'src:cdc-who-xdr-tb-mmwr-2006',
          name: 'CDC. Emergence of Mycobacterium tuberculosis with Extensive Resistance to Second-Line Drugs — Worldwide, 2000–2004. MMWR Morb Mortal Wkly Rep. 2006;55(11):301-305.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/mm5511a2.htm',
          publishedAt: '2006-03-24',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-11-04',
        datePrecision: 'DAY',
        reason: 'Gandhi and colleagues reported in The Lancet the explosive Tugela Ferry (KwaZulu-Natal) outbreak in which 52 of 53 XDR-TB patients died, most HIV-coinfected, with a median survival of 16 days. The outbreak validated XDR-TB as a lethal real-world clinical entity and galvanized global TB-control and infection-control policy.',
        source: {
          externalId: 'src:gandhi-xdr-tb-tugela-ferry-lancet-2006',
          name: 'Gandhi NR, Moll A, Sturm AW, et al. Extensively drug-resistant tuberculosis as a cause of death in patients co-infected with tuberculosis and HIV in a rural area of South Africa. Lancet. 2006;368(9547):1575-1580.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/17084757/',
          publishedAt: '2006-11-04',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Thimerosal precautionary removal 1999 ────────────────────────────────────
  {
    externalId: 'trajectory:thimerosal-vaccine-precautionary-removal-1999',
    text: 'On 9 July 1999, the American Academy of Pediatrics and the U.S. Public Health Service issued a joint statement recommending removal of the mercury-based preservative thimerosal from childhood vaccines as a precaution, despite no evidence of harm.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1999-07-09',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1999-07-09',
        datePrecision: 'DAY',
        reason: 'After a cumulative-exposure review found infants could exceed federal methylmercury guidelines from thimerosal-containing vaccines, the AAP and PHS jointly recommended its removal as a precautionary measure while affirming no evidence of harm. The statement embodied the precautionary-principle claim that exposure should be minimized even absent demonstrated toxicity.',
        source: {
          externalId: 'src:thimerosal-joint-statement-mmwr-1999',
          name: 'CDC. Notice to Readers: Thimerosal in Vaccines: A Joint Statement of the American Academy of Pediatrics and the Public Health Service. MMWR Morb Mortal Wkly Rep. 1999;48(26):563-565.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/mm4826a3.htm',
          publishedAt: '1999-07-09',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2004-05-17',
        datePrecision: 'DAY',
        reason: 'The Institute of Medicine\'s Immunization Safety Review committee concluded that the body of epidemiological evidence favored rejection of a causal relationship between thimerosal-containing vaccines and autism, settling the safety question. Thimerosal had by then been removed from routine U.S. childhood vaccines, confirming the precautionary action without validating a harm claim.',
        source: {
          externalId: 'src:iom-immunization-safety-vaccines-autism-2004',
          name: 'Institute of Medicine. Immunization Safety Review: Vaccines and Autism. Washington, DC: National Academies Press; 2004.',
          url: 'https://www.ncbi.nlm.nih.gov/books/NBK25344/',
          publishedAt: '2004-05-17',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Community-acquired MRSA pediatric deaths 1999 ────────────────────────────
  {
    externalId: 'trajectory:community-acquired-mrsa-pediatric-deaths-1999',
    text: 'On 20 August 1999, the CDC reported four fatal community-acquired MRSA infections in previously healthy children in Minnesota and North Dakota (1997–1999), documenting that methicillin-resistant Staphylococcus aureus had emerged outside healthcare settings in people without established risk factors.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1999-08-20',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1999-08-20',
        datePrecision: 'DAY',
        reason: 'A CDC MMWR report described four children who died of MRSA despite having none of the recognized healthcare-associated risk factors, with isolates distinct from hospital strains. This established the empirical claim that MRSA had become a community pathogen, overturning the assumption that methicillin resistance was confined to healthcare settings.',
        source: {
          externalId: 'src:cdc-ca-mrsa-pediatric-deaths-mmwr-1999',
          name: 'CDC. Four Pediatric Deaths From Community-Acquired Methicillin-Resistant Staphylococcus aureus — Minnesota and North Dakota, 1997-1999. MMWR Morb Mortal Wkly Rep. 1999;48(32):707-710.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/mm4832a2.htm',
          publishedAt: '1999-08-20',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2005-04-07',
        datePrecision: 'DAY',
        reason: 'Fridkin and colleagues published population-based surveillance in NEJM confirming community-associated MRSA (largely the USA300 clone) as a widespread cause of disease in people without healthcare exposure across multiple U.S. metropolitan areas. This settled CA-MRSA as an established, epidemiologically characterized entity rather than a cluster of anomalous cases.',
        source: {
          externalId: 'src:fridkin-ca-mrsa-nejm-2005',
          name: 'Fridkin SK, Hageman JC, Morrison M, et al. Methicillin-resistant Staphylococcus aureus disease in three communities. N Engl J Med. 2005;352(14):1436-1444.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15814879/',
          publishedAt: '2005-04-07',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PSYCHOPHARMACOLOGY & NEUROLOGY (2005–2023)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Citalopram high-dose QT safety reversal — FDA 2011 ───────────────────────
  {
    externalId: 'trajectory:citalopram-high-dose-qt-safety-reversal-2011',
    text: 'The U.S. FDA, in a Drug Safety Communication dated 24 August 2011, reversed the prior labeling that had permitted citalopram (Celexa) at doses up to 60 mg/day, warning that doses above 40 mg/day cause dose-dependent QT-interval prolongation without additional antidepressant benefit and should no longer be used.',
    claimType: 'HYBRID',
    claimEmergedAt: '1998-07-17',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1998-07-17',
        datePrecision: 'DAY',
        reason: 'The FDA approved citalopram (Celexa, NDA 020822, Forest Laboratories) for major depression with labeling that permitted titration up to 60 mg/day. For over a decade higher doses were accepted clinical practice for inadequate responders, institutionally settling the premise that citalopram could be safely dosed above 40 mg/day.',
        source: {
          externalId: 'src:fda-celexa-approval-nda020822-1998',
          name: 'U.S. Food and Drug Administration. Drugs@FDA: Celexa (citalopram hydrobromide), NDA 020822 approval. July 17, 1998.',
          url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=020822',
          publishedAt: '1998-07-17',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2011-08-24',
        datePrecision: 'DAY',
        reason: 'The FDA issued a Drug Safety Communication stating that citalopram should no longer be used at doses above 40 mg/day because it causes dose-dependent QT-interval prolongation (with post-marketing reports of Torsade de Pointes) and showed no added antidepressant benefit at higher doses, with still lower limits for patients over 60. The agency revised the drug label, formally reversing the previously accepted high-dose use.',
        source: {
          externalId: 'src:fda-dsc-citalopram-qt-2011',
          name: 'U.S. Food and Drug Administration. FDA Drug Safety Communication: Abnormal heart rhythms associated with high doses of Celexa (citalopram hydrobromide). August 24, 2011.',
          url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-abnormal-heart-rhythms-associated-high-doses-celexa-citalopram',
          publishedAt: '2011-08-24',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'REVERSED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2013-06-01',
        datePrecision: 'MONTH',
        reason: 'Zivin and colleagues, analyzing a large Veterans Health Administration cohort, found no elevated risk of ventricular arrhythmia, cardiac mortality, or all-cause mortality at citalopram doses above 40 mg/day, and reported higher mortality at doses at or below 20 mg, directly questioning the empirical basis of the FDA dose cap. The study placed the agency\'s reversal into active expert dispute even as the labeling restriction remained in force.',
        source: {
          externalId: 'src:zivin-citalopram-fda-warning-ajp-2013',
          name: 'Zivin K, Pfeiffer PN, Bohnert ASB, et al. Evaluation of the FDA warning against prescribing citalopram at doses exceeding 40 mg. Am J Psychiatry. 2013;170(6):642-650.',
          url: 'https://psychiatryonline.org/doi/10.1176/appi.ajp.2013.12030408',
          publishedAt: '2013-06-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── STAR*D cumulative remission rate — reanalysis 2023 ───────────────────────
  {
    externalId: 'trajectory:stard-cumulative-remission-rate-reanalysis-2006',
    text: 'Rush and colleagues reported in the American Journal of Psychiatry in November 2006 that the STAR*D trial achieved a 67% cumulative remission rate after up to four sequential antidepressant treatment steps in real-world outpatients with major depression.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2006-11-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-11-01',
        datePrecision: 'MONTH',
        reason: 'Rush et al. published the summary STAR*D report in the American Journal of Psychiatry, reporting a theoretical cumulative remission rate of 67% across up to four treatment steps. As the largest and most expensive NIMH-funded antidepressant effectiveness trial, the figure became one of the most-cited results in psychiatry and was widely incorporated into treatment guidelines and clinical teaching as evidence that persistence through sequential antidepressants yields high remission.',
        source: {
          externalId: 'src:rush-stard-ajp-2006',
          name: 'Rush AJ, Trivedi MH, Wisniewski SR, et al. Acute and longer-term outcomes in depressed outpatients requiring one or several treatment steps: a STAR*D report. Am J Psychiatry. 2006;163(11):1905-1917.',
          url: 'https://psychiatryonline.org/doi/10.1176/ajp.2006.163.11.1905',
          publishedAt: '2006-11-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2023-07-25',
        datePrecision: 'DAY',
        reason: 'Pigott and colleagues reanalyzed the STAR*D patient-level data with fidelity to the original research protocol and found a cumulative remission rate of 35.0% on the protocol-specified HRSD measure (41.3% when supplemented with QIDS-SR), roughly half the reported 67%, attributing the inflation to post-hoc protocol deviations. The original STAR*D investigators published a defense in the American Journal of Psychiatry, leaving the canonical remission figure in open and ongoing dispute.',
        source: {
          externalId: 'src:pigott-stard-reanalysis-bmjopen-2023',
          name: 'Pigott HE, Kim T, Xu C, Kirsch I, Amsterdam J. What are the treatment remission, response and extent of improvement rates after up to four trials of antidepressant therapies in real-world depressed patients? A reanalysis of the STAR*D study\'s patient-level data with fidelity to the original research protocol. BMJ Open. 2023;13(7):e063095.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10373710/',
          publishedAt: '2023-07-25',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Subcallosal cingulate DBS for depression — BROADEN futility 2017 ─────────
  {
    externalId: 'trajectory:subcallosal-cingulate-dbs-depression-broaden-futility-2017',
    text: 'Mayberg and colleagues reported in Neuron in March 2005 that chronic deep brain stimulation of the subcallosal/subgenual cingulate region (Brodmann area 25) produces sustained remission in treatment-resistant depression, establishing area 25 DBS as a candidate therapy.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2005-03-03',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2005-03-03',
        datePrecision: 'DAY',
        reason: 'Mayberg, Lozano, Voon and colleagues reported that chronic stimulation of white-matter tracts adjacent to the subgenual cingulate (Cg25) produced striking, sustained antidepressant remission in four of six patients with treatment-resistant depression, accompanied by normalization of cingulate metabolism. The open-label proof-of-concept recorded into the literature the claim that focal DBS of area 25 could relieve otherwise intractable depression, launching a decade of device development and pivotal-trial planning.',
        source: {
          externalId: 'src:mayberg-scc-dbs-neuron-2005',
          name: 'Mayberg HS, Lozano AM, Voon V, et al. Deep brain stimulation for treatment-resistant depression. Neuron. 2005;45(5):651-660.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15748841/',
          publishedAt: '2005-03-03',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-11-01',
        datePrecision: 'MONTH',
        reason: 'Holtzheimer and colleagues reported the multisite, randomized, sham-controlled BROADEN trial of subcallosal cingulate DBS, which was halted after a prespecified futility analysis showed no significant difference between active and sham stimulation at six months. The failure of the pivotal blinded trial—against persistent positive open-label and long-term follow-up data—threw the efficacy of area 25 DBS for depression into serious contest and stalled its regulatory path.',
        source: {
          externalId: 'src:holtzheimer-broaden-lancetpsych-2017',
          name: 'Holtzheimer PE, Husain MM, Lisanby SH, et al. Subcallosal cingulate deep brain stimulation for treatment-resistant depression: a multisite, randomised, sham-controlled trial. Lancet Psychiatry. 2017;4(11):839-849.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/28988904/',
          publishedAt: '2017-11-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Takamine — first pure hormone isolated (adrenaline) 1901 ───────────────
  {
    externalId: 'trajectory:takamine-adrenaline-isolation-1901',
    text: 'Jokichi Takamine announced in 1901 that he had isolated the active blood-pressure-raising principle of the adrenal (suprarenal) gland in pure, stable, crystalline form — which he named Adrenalin — the first hormone to be isolated from animal tissue in pure form.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1901-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1901-01-01',
        datePrecision: 'YEAR',
        reason: 'Building on Oliver and Schäfer\'s 1895 demonstration (J Physiol) that adrenal extract raises blood pressure and on Abel\'s impure \'epinephrin\' (1897–1899), Takamine — aided by Keizo Uenaka — crystallized the pure active base in 1900 and announced and published the isolation in 1901 (Am J Pharm 1901;73:523–535). Thomas Aldrich at Parke, Davis independently confirmed the crystalline substance in the American Journal of Physiology (1901;5:457–461), recording in the expert literature the claim that a single isolable molecule is the active hormone of the adrenal gland.',
        source: {
          externalId: 'src:litfl-adrenaline-epinephrine-history',
          name: 'Adrenaline or epinephrine? (LITFL Eponymictionary — dated history of Oliver & Schäfer 1895, Abel 1897–99, Takamine 1900–01 crystalline Adrenalin, Aldrich Am J Physiol 1901;5:457–461, Parke-Davis commercialization).',
          url: 'https://litfl.com/epinephrine-or-adrenaline/',
          publishedAt: '1901-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'MARKET',
        occurredAt: '1901-01-01',
        datePrecision: 'YEAR',
        reason: 'Parke, Davis & Co. commercialized Takamine\'s crystalline substance under the trademark \'Adrenalin\' beginning in 1901, and independent confirmation by Aldrich plus rapid clinical use as a vasopressor and local hemostatic established adrenaline as the first pure hormone in routine medical use. Its isolation became the proof-of-concept that the body\'s internal secretions are discrete, isolable chemical compounds, founding the field of endocrine chemistry.',
        source: {
          externalId: 'src:litfl-adrenaline-epinephrine-history',
          name: 'Adrenaline or epinephrine? (LITFL Eponymictionary — dated history of Oliver & Schäfer 1895, Abel 1897–99, Takamine 1900–01 crystalline Adrenalin, Aldrich Am J Physiol 1901;5:457–461, Parke-Davis commercialization).',
          url: 'https://litfl.com/epinephrine-or-adrenaline/',
          publishedAt: '1901-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Banting–Best insulin — clinical treatment 1922 ───────────────────────
  {
    externalId: 'trajectory:banting-best-insulin-clinical-treatment-1922',
    text: 'Frederick Banting, Charles Best, James Collip and colleagues reported in the Canadian Medical Association Journal in March 1922 that injection of a pancreatic extract (insulin) into diabetic patients — beginning with 14-year-old Leonard Thompson on 11 January 1922 — abolished glycosuria and ketosis and reversed the metabolic derangement of diabetes mellitus, establishing insulin as an effective treatment for human diabetes.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1922-01-11',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1922-03-01',
        datePrecision: 'MONTH',
        reason: 'After the first administration of Banting–Best pancreatic extract to Leonard Thompson on 11 January 1922 and a markedly more effective dose of Collip\'s purified extract on 23 January, the Toronto group published \'Pancreatic Extracts in the Treatment of Diabetes Mellitus\' in the Canadian Medical Association Journal (1922;12:141–146), reporting that the extract reduced blood and urine sugar and cleared ketonuria in seven diabetic patients. This recorded in the expert literature the claim that an injectable pancreatic internal secretion could treat human diabetes.',
        source: {
          externalId: 'src:banting-best-pancreatic-extracts-cmaj-1922',
          name: 'Banting FG, Best CH, Collip JB, Campbell WR, Fletcher AA. Pancreatic Extracts in the Treatment of Diabetes Mellitus. Can Med Assoc J. 1922;12(3):141–146. (PMID 20314060; PMC1524425.)',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1524425/',
          publishedAt: '1922-03-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1923-10-25',
        datePrecision: 'DAY',
        reason: 'On 25 October 1923 the Karolinska Institute awarded Frederick Banting and John Macleod the Nobel Prize in Physiology or Medicine for the discovery of insulin, barely 18 months after the first clinical report; by then Eli Lilly was mass-producing insulin in the United States and Connaught Laboratories in Canada, and the drug was being used worldwide. This institutional recognition and rapid clinical adoption settled the claim that insulin is an effective treatment for diabetes — a status it has never lost.',
        source: {
          externalId: 'src:nobel-medicine-1923-insulin',
          name: 'Nobel Prize Committee. The Nobel Prize in Physiology or Medicine 1923 — Frederick G. Banting and John J. R. Macleod \'for the discovery of insulin\'.',
          url: 'https://www.nobelprize.org/prizes/medicine/1923/summary/',
          publishedAt: '1923-10-25',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Abel — crystalline insulin as discrete protein 1926 ──────────────────
  {
    externalId: 'trajectory:abel-crystalline-insulin-protein-1926',
    text: 'John Jacob Abel reported in the Proceedings of the National Academy of Sciences in February 1926 that he had obtained insulin in pure crystalline form, demonstrating that the antidiabetic hormone is a discrete crystallizable protein rather than an ill-defined colloidal extract.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1926-02-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1926-02-01',
        datePrecision: 'MONTH',
        reason: 'Abel published \'Crystalline Insulin\' in PNAS (1926;12(2):132–136), describing reproducible preparation of crystalline insulin and arguing that the hormone itself was a protein. This recorded the claim that insulin is a definite crystallizable protein molecule, against the then-prevailing colloid-chemistry view (Willstätter and others) that the active principle might be a small molecule merely adsorbed onto an inert protein carrier.',
        source: {
          externalId: 'src:abel-crystalline-insulin-pnas-1926',
          name: 'Abel JJ. Crystalline Insulin. Proc Natl Acad Sci U S A. 1926;12(2):132–136. (PMC1253372.)',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1253372/',
          publishedAt: '1926-02-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1955-01-01',
        datePrecision: 'YEAR',
        reason: 'Abel\'s protein claim was contested through the 1920s–30s but was decisively confirmed when Frederick Sanger completed the full amino-acid sequence of bovine insulin (1951–1955), proving it to be a defined 51-residue, two-chain polypeptide — the first protein ever sequenced. Sanger\'s work definitively settled that insulin is itself a protein, vindicating Abel\'s crystallization, and earned the 1958 Nobel Prize in Chemistry.',
        source: {
          externalId: 'src:insulin-pacesetter-nobel-history-pmc8513142',
          name: 'Insulin: A pacesetter for the shape of modern biomedical science and the Nobel Prize. (historical review covering Abel\'s 1926 crystallization and Sanger\'s 1951–55 sequencing). PMC8513142.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8513142/',
          publishedAt: '2021-09-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── David–Laqueur — testosterone isolated and named 1935 ────────────────
  {
    externalId: 'trajectory:testosterone-first-isolation-synthesis-1935',
    text: 'Karoly Gyula David, Elisabeth Dingemanse, Janos Freud and Ernst Laqueur (Organon, Amsterdam) reported in Hoppe-Seyler\'s Zeitschrift für physiologische Chemie in May 1935 that they had isolated the principal crystalline male sex hormone from testicular tissue, naming it testosterone; it was chemically synthesized the same year by Adolf Butenandt and Leopold Ruzicka.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1935-05-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1935-05-01',
        datePrecision: 'MONTH',
        reason: 'David and colleagues in Laqueur\'s Organon laboratory published \'Über krystallinisches männliches Hormon aus Hoden (Testosteron), wirksamer als aus Harn oder aus Cholesterin bereitetes Androsteron\' in Hoppe-Seyler\'s Z Physiol Chem (1935;233:281), the first description of the isolation of crystalline testosterone and the source of its name. This recorded in the expert literature the claim that testosterone is the principal hormone of the testis.',
        source: {
          externalId: 'src:david-laqueur-testosteron-hoppe-seyler-1935',
          name: 'David KG, Dingemanse E, Freud J, Laqueur E. Über krystallinisches männliches Hormon aus Hoden (Testosteron)... Hoppe-Seyler\'s Z Physiol Chem. 1935;233(5–6):281–282. (DOI 10.1515/bchm2.1935.233.5-6.281.)',
          url: 'https://doi.org/10.1515/bchm2.1935.233.5-6.281',
          publishedAt: '1935-05-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1939-01-01',
        datePrecision: 'YEAR',
        reason: 'Within months of the isolation, Butenandt (working from cholesterol/dehydroandrosterone) and Ruzicka independently achieved the chemical synthesis of testosterone in 1935, making it reproducibly available and proving its structure. The 1939 Nobel Prize in Chemistry, awarded to Butenandt for his work on the sex hormones and to Ruzicka for work on polymethylenes and higher terpenes, institutionally ratified the chemistry of the sex steroids and settled testosterone\'s identity as the chief androgenic hormone.',
        source: {
          externalId: 'src:nobel-chemistry-1939-butenandt-ruzicka',
          name: 'Nobel Prize Committee. The Nobel Prize in Chemistry 1939 — Adolf Butenandt (work on sex hormones) and Leopold Ruzicka (polymethylenes and higher terpenes).',
          url: 'https://www.nobelprize.org/prizes/chemistry/1939/summary/',
          publishedAt: '1939-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Brexpiprazole — first FDA-approved drug for Alzheimer's agitation 2023 ───
  {
    externalId: 'trajectory:brexpiprazole-alzheimers-agitation-approval-2023',
    text: 'Brexpiprazole (Rexulti, Otsuka/Lundbeck), an atypical antipsychotic, is a safe and effective treatment for agitation associated with dementia due to Alzheimer\'s disease, as shown in phase 3 trials reported in 2020 and ratified by FDA approval on 10 May 2023 as the first drug approved for that indication.',
    claimType: 'HYBRID',
    claimEmergedAt: '2020-04-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2020-04-01',
        datePrecision: 'MONTH',
        reason: 'Grossberg and colleagues published two 12-week, randomized, double-blind, placebo-controlled phase 3 trials in the American Journal of Geriatric Psychiatry, reporting that brexpiprazole 2 mg/day was superior to placebo on the Cohen-Mansfield Agitation Inventory in Alzheimer\'s-dementia agitation with acceptable tolerability. The trials recorded into the literature the claim that a dopamine-serotonin partial agonist could specifically treat dementia-related agitation—a symptom previously addressed only off-label and under the antipsychotic class mortality warning.',
        source: {
          externalId: 'src:grossberg-brexpiprazole-ajgp-2020',
          name: 'Grossberg GT, Kohegyi E, Mergel V, et al. Efficacy and Safety of Brexpiprazole for the Treatment of Agitation in Alzheimer\'s Dementia: Two 12-Week, Randomized, Double-Blind, Placebo-Controlled Trials. Am J Geriatr Psychiatry. 2020;28(4):383-400.',
          url: 'https://www.sciencedirect.com/science/article/pii/S1064748119305214',
          publishedAt: '2020-04-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2023-05-10',
        datePrecision: 'DAY',
        reason: 'The FDA approved brexpiprazole (Rexulti, sNDA) as the first and only drug indicated for agitation associated with dementia due to Alzheimer\'s disease, institutionally ratifying its efficacy for that indication while retaining the atypical-antipsychotic boxed warning for increased mortality in elderly patients with dementia-related psychosis. The approval settled, at the regulatory level, that a defined pharmacologic treatment for dementia agitation exists, despite the standing class safety concern.',
        source: {
          externalId: 'src:fda-rexulti-alzheimers-agitation-approval-2023',
          name: 'U.S. Food and Drug Administration. FDA Approves First Drug to Treat Agitation Symptoms Associated with Dementia due to Alzheimer\'s Disease. May 11, 2023.',
          url: 'https://www.fda.gov/news-events/press-announcements/fda-approves-first-drug-treat-agitation-symptoms-associated-dementia-due-alzheimers-disease',
          publishedAt: '2023-05-11',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // OPIOID REGULATION & POLICY
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Controlled Substances Act — drug scheduling 1970 ───────────────────────
  {
    externalId: 'trajectory:controlled-substances-act-drug-scheduling-1970',
    text: 'The Controlled Substances Act, enacted October 27, 1970 as Title II of the Comprehensive Drug Abuse Prevention and Control Act (Pub. L. 91-513) and signed by President Richard Nixon, created five federal drug schedules classifying narcotics and other substances by abuse potential, accepted medical use, and dependence liability — placing heroin in Schedule I and medical opioids such as morphine and oxycodone in Schedule II.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1970-10-27',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1970-10-27',
        datePrecision: 'DAY',
        reason: 'Congress enacted the Comprehensive Drug Abuse Prevention and Control Act of 1970, whose Title II (the Controlled Substances Act) replaced the patchwork of earlier narcotics statutes with a single federal scheduling framework administered by the Attorney General and HEW/FDA. The schedules became the institutional foundation for all subsequent U.S. opioid classification and rescheduling decisions, fixing the regulatory premise that a drug\'s legal status follows from a graded assessment of abuse potential and medical utility.',
        source: {
          externalId: 'src:csa-pub-l-91-513-1970',
          name: 'Comprehensive Drug Abuse Prevention and Control Act of 1970 (Controlled Substances Act, Title II). Pub. L. 91-513, 84 Stat. 1236, Oct. 27, 1970.',
          url: 'https://www.govinfo.gov/content/pkg/STATUTE-84/pdf/STATUTE-84-Pg1236.pdf',
          publishedAt: '1970-10-27',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── CDC prescription opioid overdose epidemic — 2011 ───────────────────────
  {
    externalId: 'trajectory:cdc-prescription-opioid-overdose-epidemic-2011',
    text: 'The CDC reported in its November 4, 2011 MMWR Vital Signs that prescription opioid pain relievers were involved in 14,800 overdose deaths in 2008 — 73.8% of all prescription-drug overdose deaths and more than heroin and cocaine combined — and that opioid sales had quadrupled from 1999 to 2010, formally characterizing prescription-opioid overdose death as a U.S. epidemic.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2011-11-04',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2011-11-04',
        datePrecision: 'DAY',
        reason: 'CDC\'s Vital Signs surveillance report quantified the parallel rise in opioid prescribing and overdose deaths from 1999 to 2008–2010 and stated that death from opioid pain relievers had become an epidemic in the United States. The report placed on the official public-health record the empirical claim that the prescribing of medical opioids — not illicit narcotics — was the principal driver of the overdose surge.',
        source: {
          externalId: 'src:cdc-vital-signs-opr-overdose-mmwr-2011',
          name: 'CDC. Vital Signs: Overdoses of Prescription Opioid Pain Relievers — United States, 1999–2008. MMWR Morb Mortal Wkly Rep. 2011;60(43):1487-1492.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/mm6043a4.htm',
          publishedAt: '2011-11-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2016-03-18',
        datePrecision: 'DAY',
        reason: 'The CDC\'s 2016 Guideline for Prescribing Opioids for Chronic Pain was premised explicitly on the now-accepted finding that prescription-opioid prescribing had driven the overdose epidemic, and tied national prescribing policy to it. The epidemic characterization first recorded in 2011 had become the settled institutional basis for federal, state, and payer action.',
        source: {
          externalId: 'src:cdc-opioid-guideline-mmwr-2016-epidemic-ratification',
          name: 'Dowell D, Haegerich TM, Chou R. CDC Guideline for Prescribing Opioids for Chronic Pain — United States, 2016. MMWR Recomm Rep. 2016;65(1):1-49.',
          url: 'https://www.cdc.gov/mmwr/volumes/65/rr/rr6501e1.htm',
          publishedAt: '2016-03-18',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Vivitrol / naltrexone injectable — opioid dependence approval 2010 ─────
  {
    externalId: 'trajectory:vivitrol-naltrexone-opioid-dependence-2010',
    text: 'The FDA approved Vivitrol (naltrexone for extended-release injectable suspension, NDA 21-897) on October 12, 2010 for the prevention of relapse to opioid dependence following opioid detoxification — the first non-narcotic, non-agonist, once-monthly injectable approved for opioid-use-disorder maintenance, establishing a receptor-blockade alternative to the agonist treatments methadone and buprenorphine.',
    claimType: 'HYBRID',
    claimEmergedAt: '2010-10-12',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2010-10-12',
        datePrecision: 'DAY',
        reason: 'On the basis of a randomized placebo-controlled trial in opioid-dependent patients, the FDA approved extended-release injectable naltrexone (Vivitrol) for prevention of relapse after detoxification — its first opioid indication, having previously been approved only for alcohol dependence. The approval institutionally ratified opioid-receptor antagonism, rather than agonist substitution, as an established medication-assisted-treatment modality, broadening the recognized pharmacologic options for opioid use disorder.',
        source: {
          externalId: 'src:alkermes-vivitrol-fda-opioid-approval-2010',
          name: 'Alkermes, Inc. Alkermes Announces FDA Approval of VIVITROL for Prevention of Relapse to Opioid Dependence. News release, October 12, 2010.',
          url: 'https://investor.alkermes.com/news-releases/news-release-details/alkermes-announces-fda-approval-vivitrolr-prevention-relapse',
          publishedAt: '2010-10-12',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── MAT Act / X-waiver elimination — 2022 ──────────────────────────────────
  {
    externalId: 'trajectory:mat-act-x-waiver-elimination-2022',
    text: 'Section 1262 of the Consolidated Appropriations Act, 2023 (the Mainstreaming Addiction Treatment / MAT Act), enacted December 29, 2022, eliminated the DATA-2000 \'X-waiver\' requirement, allowing any clinician holding a standard Schedule III DEA registration to prescribe buprenorphine for opioid use disorder without a special waiver, training certification, or cap on patient numbers.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2022-12-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2022-12-29',
        datePrecision: 'DAY',
        reason: 'Congress repealed the special-registration regime that the Drug Addiction Treatment Act of 2000 had imposed on office-based buprenorphine prescribing, removing the X-waiver, its eight-hour training prerequisite, and patient caps. The change reversed the long-settled institutional premise — established by DATA 2000 — that buprenorphine treatment for opioid use disorder required a gatekeeping credential distinct from ordinary controlled-substance prescribing authority, folding it into standard medical practice. The DEA subsequently notified all registrants that X-waiver registration numbers were no longer required.',
        source: {
          externalId: 'src:caa-2023-mat-act-x-waiver-pmc-2023',
          name: 'Frank D, Krawczyk N, Cerdá M, et al. Will the End of the X-Waiver Expand Access to Buprenorphine Treatment? Achieving the Full Potential of the 2023 Consolidated Appropriations Act. (documenting Section 1262 repeal of the DATA-2000 waiver). PMC10719867. 2023.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10719867/',
          publishedAt: '2023-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // HORMONE THERAPY & CONTRACEPTION (1995–2013)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── HERS: HRT does not prevent cardiac events — Hulley 1998 ────────────────
  {
    externalId: 'trajectory:hers-hrt-secondary-cardiac-prevention-1998',
    text: 'Susan Hulley and the HERS investigators reported in JAMA on 19 August 1998 that estrogen plus progestin (conjugated equine estrogen + medroxyprogesterone) did not reduce coronary events and caused early excess risk in postmenopausal women with established coronary heart disease, contradicting the prevailing belief that hormone therapy protects the female heart.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1998-08-19',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1998-08-19',
        datePrecision: 'DAY',
        reason: 'HERS, the first large randomized secondary-prevention trial of HRT, enrolled 2,763 postmenopausal women with documented coronary disease and found no overall reduction in CHD events despite favorable lipid changes, plus a significant excess of events in the first year and increased venous thromboembolism. This was the first RCT-level evidence directly contradicting the strong observational consensus (e.g., Nurses\' Health Study) that estrogen is cardioprotective.',
        source: {
          externalId: 'src:hulley-hers-jama-1998',
          name: 'Hulley S, Grady D, Bush T, Furberg C, Herrington D, Riggs B, Vittinghoff E. Randomized trial of estrogen plus progestin for secondary prevention of coronary heart disease in postmenopausal women (HERS). JAMA. 1998;280(7):605-613.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9718051/',
          publishedAt: '1998-08-19',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2002-07-03',
        datePrecision: 'DAY',
        reason: 'The HERS II open-label extension followed the cohort for 6.8 years and confirmed that hormone therapy produced no cardiovascular benefit and should not be used to reduce cardiovascular risk in women with established disease. Combined with the WHI primary-prevention result published two weeks later, this settled the reversal: HRT was removed from cardioprotective indications in clinical guidance.',
        source: {
          externalId: 'src:grady-hers2-jama-2002',
          name: 'Grady D, Herrington D, Bittner V, et al. Cardiovascular disease outcomes during 6.8 years of hormone therapy: Heart and Estrogen/progestin Replacement Study follow-up (HERS II). JAMA. 2002;288(1):49-57.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12090862/',
          publishedAt: '2002-07-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── WHI estrogen-alone trial stopped early — Anderson 2004 ─────────────────
  {
    externalId: 'trajectory:whi-estrogen-alone-stroke-no-benefit-2004',
    text: 'Garnet Anderson and the Women\'s Health Initiative investigators reported in JAMA on 14 April 2004 that conjugated equine estrogen alone, given to postmenopausal women with prior hysterectomy, did not reduce coronary heart disease and significantly increased stroke risk, leading the NIH to halt the estrogen-only arm early and extending the 2002 HRT reversal to unopposed estrogen.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2004-04-14',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2004-04-14',
        datePrecision: 'DAY',
        reason: 'The WHI estrogen-alone trial randomized 10,739 hysterectomized women aged 50–79 to conjugated equine estrogen or placebo; the NIH stopped it early (mean 6.8 years) after estrogen increased stroke, produced no coronary benefit, and showed an unfavorable global index. Unlike the combined-therapy arm, it did not raise breast cancer risk, refining rather than simply repeating the 2002 finding and recording that unopposed estrogen also fails as chronic-disease prevention.',
        source: {
          externalId: 'src:anderson-whi-estrogen-alone-jama-2004',
          name: 'Anderson GL, Limacher M, Assaf AR, et al. Effects of conjugated equine estrogen in postmenopausal women with hysterectomy: the Women\'s Health Initiative randomized controlled trial. JAMA. 2004;291(14):1701-1712.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15082697/',
          publishedAt: '2004-04-14',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2013-10-02',
        datePrecision: 'DAY',
        reason: 'The WHI 13-year cumulative follow-up of both hormone-therapy trials reaffirmed that the health risks of estrogen alone and estrogen-plus-progestin outweighed benefits for chronic-disease prevention, with effects attenuating after stopping. This pooled long-term analysis settled the conclusion that menopausal hormone therapy should not be used for primary prevention in either regimen.',
        source: {
          externalId: 'src:manson-whi-13yr-jama-2013',
          name: 'Manson JE, Chlebowski RT, Stefanick ML, et al. Menopausal hormone therapy and health outcomes during the intervention and extended poststopping phases of the Women\'s Health Initiative randomized trials. JAMA. 2013;310(13):1353-1368.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/24084921/',
          publishedAt: '2013-10-02',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Third-generation OC VTE scare — UK CSM 1995 ────────────────────────────
  {
    externalId: 'trajectory:third-generation-oral-contraceptive-vte-scare-1995',
    text: 'The UK Committee on Safety of Medicines announced on 18 October 1995 that third-generation combined oral contraceptives containing desogestrel or gestodene carried roughly twice the risk of venous thromboembolism of older levonorgestrel pills, overturning the assumption that the newer progestins were at least as safe and triggering the European \'pill scare\'.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1995-10-18',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1995-10-18',
        datePrecision: 'DAY',
        reason: 'Acting on three then-unpublished epidemiologic studies, the UK CSM issued an urgent \'Dear Doctor\' communication warning that desogestrel- and gestodene-containing pills doubled VTE risk relative to levonorgestrel products, advising they not be used as first choice. The abrupt institutional warning ahead of publication caused third-generation use to collapse from ~53% to ~14% of prescriptions and is associated with a rise in unintended pregnancies and abortions.',
        source: {
          externalId: 'src:csm-third-gen-oc-vte-medsafe-1996',
          name: 'Medicines Safety Authority (Medsafe). The Risk of Venous Thromboembolism with Third Generation Oral Contraceptives (documenting the UK CSM October 1995 warning). Feb 1996.',
          url: 'https://www.medsafe.govt.nz/profs/PUarticles/contraceptivesFeb96.htm',
          publishedAt: '1996-02-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1998-03-01',
        datePrecision: 'MONTH',
        reason: 'After the four studies underlying the warning were published and widely criticized for methodological bias, formal review concluded that confounding (preferential prescribing, diagnostic and healthy-user bias) was insufficient to explain the signal and that desogestrel/gestodene do carry a modestly elevated VTE risk versus levonorgestrel. The ~2-fold relative risk became the settled expert position, later reaffirmed by EMA reviews.',
        source: {
          externalId: 'src:walker-newer-oc-vte-contraception-1998',
          name: 'Walker AM. Newer oral contraceptives and the risk of venous thromboembolism. Contraception. 1998;57(3):169-181.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9617533/',
          publishedAt: '1998-03-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Drospirenone/Yaz VTE safety signal — FDA 2012 ──────────────────────────
  {
    externalId: 'trajectory:drospirenone-yaz-vte-safety-signal-2012',
    text: 'Post-marketing epidemiologic studies from 2009 and the FDA\'s safety review concluded on 10 April 2012 that drospirenone-containing oral contraceptives (Yaz, Yasmin, Beyaz, Safyral) may carry a higher venous thromboembolism risk than levonorgestrel-containing pills, prompting an FDA-mandated label change while keeping the drugs on the market.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2009-08-13',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2009-08-13',
        datePrecision: 'DAY',
        reason: 'Lidegaard\'s Danish national cohort (10.4 million woman-years) reported that drospirenone-containing combined oral contraceptives carried about a 1.6-fold higher VTE rate than levonorgestrel pills, with companion BMJ studies that year giving estimates up to 2–3 fold. This was the first large-scale epidemiologic signal that the heavily marketed drospirenone pills (Yasmin approved 2001, Yaz 2006) were not as safe as their levonorgestrel predecessors.',
        source: {
          externalId: 'src:lidegaard-hormonal-contraception-vte-bmj-2009',
          name: 'Lidegaard Ø, Løkkegaard E, Svendsen AL, Agger C. Hormonal contraception and risk of venous thromboembolism: national follow-up study. BMJ. 2009;339:b2890.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/19679613/',
          publishedAt: '2009-08-13',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '2012-04-10',
        datePrecision: 'DAY',
        reason: 'After reviewing the epidemiologic studies and an FDA-funded cohort, the FDA issued a Drug Safety Communication concluding that drospirenone-containing pills may be associated with higher blood-clot risk (estimated ~10 vs ~6 per 10,000 woman-years) and required manufacturers to add this to product labels. The agency stopped short of withdrawal, and the magnitude of the risk remained actively disputed among industry-funded and independent studies, leaving the claim contested.',
        source: {
          externalId: 'src:fda-drospirenone-dsc-2012',
          name: 'U.S. Food and Drug Administration. FDA Drug Safety Communication: Updated information about the risk of blood clots in women taking birth control pills containing drospirenone. 10 April 2012.',
          url: 'https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/information-about-drospirenone',
          publishedAt: '2012-04-10',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // VACCINE SAFETY & POLICY (2010s–2020s)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Dengvaxia serostatus reversal — 2015–2017 ───────────────────────────────
  {
    externalId: 'trajectory:dengvaxia-dengue-vaccine-serostatus-reversal-2017',
    text: 'Sanofi Pasteur\'s dengue vaccine Dengvaxia (CYD-TDV), licensed for children on the basis of ~60% efficacy and deployed in the Philippines\' mass school-based immunization program, was found on 29 November 2017 to increase the risk of severe dengue and hospitalization in recipients who had not been previously infected with dengue.',
    claimType: 'HYBRID',
    claimEmergedAt: '2015-01-08',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2015-01-08',
        datePrecision: 'DAY',
        reason: 'Villar et al. published the CYD15 phase 3 randomized trial in the New England Journal of Medicine, reporting 60.8% vaccine efficacy against virologically confirmed dengue in children aged 9–16 across five Latin American countries. This efficacy result, alongside the parallel Asian trial, was the empirical basis for licensure in roughly 20 countries and for the Philippines launching the world\'s first public dengue immunization program for schoolchildren in 2016.',
        source: {
          externalId: 'src:villar-nejm-dengvaxia-2015',
          name: 'Villar L, Dayan GH, Arredondo-García JL, et al. Efficacy of a Tetravalent Dengue Vaccine in Children in Latin America. N Engl J Med. 2015;372(2):113-123.',
          url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa1411037',
          publishedAt: '2015-01-08',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-11-29',
        datePrecision: 'DAY',
        reason: 'On 29 November 2017 Sanofi announced that a new analysis stratified by baseline serostatus showed Dengvaxia increased the risk of severe dengue and hospitalization in dengue-naïve (seronegative) recipients. The reanalysis, formally published by Sridhar et al. in NEJM in 2018, prompted the WHO to restrict the vaccine to seropositive persons and the Philippines to suspend its program, reversing the prior basis for routine pediatric vaccination.',
        source: {
          externalId: 'src:sridhar-nejm-dengue-serostatus-2018',
          name: 'Sridhar S, Luedtke A, Langevin E, et al. Effect of Dengue Serostatus on Dengue Vaccine Safety and Efficacy. N Engl J Med. 2018;379(4):327-340.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/29897841/',
          publishedAt: '2018-07-26',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── NTP fluoride child IQ — 2024–2025 ───────────────────────────────────────
  {
    externalId: 'trajectory:ntp-fluoride-child-iq-2024',
    text: 'The U.S. National Toxicology Program concluded on 21 August 2024, with moderate confidence, that higher fluoride exposure — drinking water above 1.5 mg/L — is associated with lower IQ in children.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2024-08-21',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2024-08-21',
        datePrecision: 'DAY',
        reason: 'After years of internal review and litigation, the NTP released its state-of-the-science monograph concluding with moderate confidence that fluoride exposure above 1.5 mg/L is associated with lower child IQ, while stating there were insufficient data to assess the 0.7 mg/L level used in U.S. community water fluoridation. A U.S. federal agency formally recording a neurodevelopmental fluoride signal marked a transition from contested journal literature to an institutional finding.',
        source: {
          externalId: 'src:ntp-fluoride-monograph-2024',
          name: 'National Toxicology Program. NTP Monograph on the State of the Science Concerning Fluoride Exposure and Neurodevelopment and Cognition: A Systematic Review. NIEHS. 21 August 2024.',
          url: 'https://ntp.niehs.nih.gov/research/assessments/noncancer/completed/fluoride',
          publishedAt: '2024-08-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2025-01-06',
        datePrecision: 'DAY',
        reason: 'The NTP authors published a peer-reviewed meta-analysis of 74 studies in JAMA Pediatrics reporting a statistically significant inverse association between fluoride exposure and child IQ. It was published alongside an editorial (\'Caution Needed in Interpreting the Evidence Base on Fluoride and IQ\') and intense methodological dispute over reliance on high-exposure foreign studies and the unresolved applicability to U.S. fluoridation levels, leaving the claim openly contested.',
        source: {
          externalId: 'src:taylor-jama-pediatrics-fluoride-iq-2025',
          name: 'Taylor KW, Eftim SE, Sibrizzi CA, et al. Fluoride Exposure and Children\'s IQ Scores: A Systematic Review and Meta-Analysis. JAMA Pediatr. 2025;179(3):282-292.',
          url: 'https://jamanetwork.com/journals/jamapediatrics/fullarticle/2828425',
          publishedAt: '2025-01-06',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── ACIP Tdap every pregnancy — 2012 ────────────────────────────────────────
  {
    externalId: 'trajectory:acip-tdap-every-pregnancy-2012',
    text: 'On 24 October 2012 the U.S. Advisory Committee on Immunization Practices recommended a dose of Tdap during every pregnancy (27–36 weeks\' gestation), regardless of prior vaccination, to transfer maternal antibodies that protect newborns from pertussis before their own vaccinations begin.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2012-10-24',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2012-10-24',
        datePrecision: 'DAY',
        reason: 'Responding to resurgent infant pertussis deaths, ACIP voted to recommend Tdap during every pregnancy regardless of prior receipt — superseding its 2011 recommendation that exempted previously vaccinated women — on the rationale that placental transfer of maternal antipertussis antibodies protects infants during the vulnerable first two months. The recommendation, published in MMWR on 22 February 2013, established maternal immunization as standard U.S. obstetric practice and was subsequently shown effective at preventing infant pertussis.',
        source: {
          externalId: 'src:acip-tdap-pregnancy-mmwr-2013',
          name: 'Advisory Committee on Immunization Practices (ACIP). Updated Recommendations for Use of Tetanus Toxoid, Reduced Diphtheria Toxoid, and Acellular Pertussis Vaccine (Tdap) in Pregnant Women — ACIP, 2012. MMWR Morb Mortal Wkly Rep. 2013;62(7):131-135.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/23425962/',
          publishedAt: '2013-02-22',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Acetaminophen in pregnancy & neurodevelopment — 2021–2024 ───────────────
  {
    externalId: 'trajectory:acetaminophen-pregnancy-neurodevelopment-2021',
    text: 'An international consensus statement led by Ann Bauer published on 23 September 2021 in Nature Reviews Endocrinology asserted that prenatal acetaminophen (paracetamol) exposure may increase the risk of neurodevelopmental disorders such as autism and ADHD, calling for precautionary restriction of its use in pregnancy.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2021-09-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2021-09-23',
        datePrecision: 'DAY',
        reason: 'A consensus statement signed by 91 scientists and clinicians synthesized observational evidence linking prenatal acetaminophen exposure to neurodevelopmental and urogenital disorders and recommended that pregnant individuals forego the drug unless medically indicated. The statement formally elevated a scattered observational signal into a recorded precautionary position, drawing an immediate dissenting commentary in the same journal warning against causal inference.',
        source: {
          externalId: 'src:bauer-nat-rev-endocrinol-paracetamol-2021',
          name: 'Bauer AZ, Swan SH, Kriebel D, et al. Paracetamol use during pregnancy — a call for precautionary action. Nat Rev Endocrinol. 2021;17(12):757-766.',
          url: 'https://www.nature.com/articles/s41574-021-00553-7',
          publishedAt: '2021-09-23',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2024-04-09',
        datePrecision: 'DAY',
        reason: 'Ahlqvist et al. published a Swedish nationwide study of 2.48 million children in JAMA, finding that an initial association between prenatal acetaminophen and autism, ADHD, and intellectual disability disappeared in sibling-control analyses that adjust for familial confounding. The largest and methodologically strongest study to date undercut the causal interpretation, leaving the field contested between precautionary advocates and bodies such as ACOG that affirm acetaminophen as the safest analgesic in pregnancy.',
        source: {
          externalId: 'src:ahlqvist-jama-acetaminophen-2024',
          name: 'Ahlqvist VH, Sjöqvist H, Dalman C, et al. Acetaminophen Use During Pregnancy and Children\'s Risk of Autism, ADHD, and Intellectual Disability. JAMA. 2024;331(14):1205-1214.',
          url: 'https://jamanetwork.com/journals/jama/fullarticle/2817406',
          publishedAt: '2024-04-09',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // BIOLOGICS & GENE THERAPY ERA (1990–2020)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Adagen — first enzyme replacement therapy & first PEGylated protein drug 1990 ──
  {
    externalId: 'trajectory:pegademase-adagen-first-enzyme-replacement-therapy-1990',
    text: 'On 21 March 1990 the U.S. FDA approved Adagen (pegademase bovine, NDA 019818) for enzyme replacement therapy in adenosine deaminase (ADA) deficiency causing severe combined immunodeficiency, the first enzyme replacement therapy — and first PEGylated protein drug — ever approved, predating Ceredase (alglucerase, 1991).',
    claimType: 'HYBRID',
    claimEmergedAt: '1987-03-05',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1987-03-05',
        datePrecision: 'DAY',
        reason: 'Michael S. Hershfield and colleagues reported in the New England Journal of Medicine that polyethylene glycol-modified bovine adenosine deaminase (PEG-ADA) corrected the metabolic abnormalities and restored immune function in two children with ADA-deficient SCID. This established in the expert literature that systemic replacement of a deficient enzyme could be a viable therapeutic strategy for an inherited metabolic immunodeficiency.',
        source: {
          externalId: 'src:hershfield-peg-ada-nejm-1987',
          name: 'Hershfield MS, Buckley RH, Greenberg ML, et al. Treatment of adenosine deaminase deficiency with polyethylene glycol-modified adenosine deaminase. N Engl J Med. 1987;316(10):589-596.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/3807953/',
          publishedAt: '1987-03-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1990-03-21',
        datePrecision: 'DAY',
        reason: 'The FDA approved Adagen (pegademase bovine, NDA 019818, sponsor Enzon) for ADA deficiency in patients with SCID who are not candidates for or have failed bone marrow transplantation. As the first enzyme replacement therapy and first PEGylated therapeutic protein ever licensed, the approval institutionally settled enzyme replacement as a regulatory and clinical category and opened the path to subsequent ERTs (alglucerase 1991, laronidase, agalsidase).',
        source: {
          externalId: 'src:fda-adagen-label-019818',
          name: 'U.S. Food and Drug Administration. ADAGEN (pegademase bovine) Injection — Prescribing Information (NDA 019818). Original approval 21 March 1990.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2014/019818s053lbl.pdf',
          publishedAt: '1990-03-21',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Luxturna — first in vivo gene therapy for inherited disease 2017 ─────────
  {
    externalId: 'trajectory:voretigene-neparvovec-luxturna-first-inherited-disease-gene-therapy-2017',
    text: 'On 19 December 2017 the U.S. FDA approved Luxturna (voretigene neparvovec-rzyl, Spark Therapeutics) for biallelic RPE65 mutation-associated retinal dystrophy, the first directly administered (in vivo) gene therapy approved in the United States to target a disease caused by mutations in a specific gene.',
    claimType: 'HYBRID',
    claimEmergedAt: '2017-07-14',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-07-14',
        datePrecision: 'DAY',
        reason: 'Stephen Russell and colleagues published in The Lancet a randomised, controlled, open-label phase 3 trial showing that a one-time subretinal injection of voretigene neparvovec (AAV2-hRPE65v2) significantly improved functional vision on a multi-luminance mobility test in patients with RPE65-mediated inherited retinal dystrophy. This recorded the first phase 3 evidence that subretinal gene replacement could durably restore vision in an inherited blinding disease.',
        source: {
          externalId: 'src:russell-voretigene-phase3-lancet-2017',
          name: 'Russell S, Bennett J, Wellman JA, et al. Efficacy and safety of voretigene neparvovec (AAV2-hRPE65v2) in patients with RPE65-mediated inherited retinal dystrophy: a randomised, controlled, open-label, phase 3 trial. Lancet. 2017;390(10097):849-860.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/28712537/',
          publishedAt: '2017-07-14',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2017-12-19',
        datePrecision: 'DAY',
        reason: 'The FDA approved Luxturna for patients with confirmed biallelic RPE65 mutation-associated retinal dystrophy with viable retinal cells. The agency described it as the first directly administered gene therapy approved in the U.S. that targets a disease caused by mutations in a specific gene, institutionally settling in vivo gene replacement as an approvable therapeutic modality for inherited disease.',
        source: {
          externalId: 'src:fda-luxturna-product-page-2017',
          name: 'U.S. Food and Drug Administration. LUXTURNA (voretigene neparvovec-rzyl) — Cellular & Gene Therapy Products. Approved 19 December 2017.',
          url: 'https://www.fda.gov/vaccines-blood-biologics/cellular-gene-therapy-products/luxturna',
          publishedAt: '2017-12-19',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Onpattro — first RNAi / siRNA therapeutic 2018 ──────────────────────────
  {
    externalId: 'trajectory:patisiran-onpattro-first-rnai-sirna-therapeutic-2018',
    text: 'On 10 August 2018 the U.S. FDA approved Onpattro (patisiran, Alnylam) for the polyneuropathy of hereditary transthyretin-mediated (hATTR) amyloidosis, the first-ever approved RNA interference (siRNA) therapeutic and the first approved treatment for that indication.',
    claimType: 'HYBRID',
    claimEmergedAt: '2018-07-05',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-07-05',
        datePrecision: 'DAY',
        reason: 'David Adams and colleagues published the APOLLO trial in the New England Journal of Medicine, showing that patisiran — a lipid-nanoparticle-delivered small interfering RNA that silences hepatic transthyretin production — significantly improved the modified Neuropathy Impairment Score (mNIS+7) and quality of life versus placebo in hATTR amyloidosis with polyneuropathy. This recorded the first phase 3 proof that an RNAi therapeutic could alter the course of a human genetic disease.',
        source: {
          externalId: 'src:adams-apollo-patisiran-nejm-2018',
          name: 'Adams D, Gonzalez-Duarte A, O\'Riordan WD, et al. Patisiran, an RNAi Therapeutic, for Hereditary Transthyretin Amyloidosis. N Engl J Med. 2018;379(1):11-21.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/29972753/',
          publishedAt: '2018-07-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2018-08-10',
        datePrecision: 'DAY',
        reason: 'The FDA approved Onpattro (patisiran, NDA 210922) for the polyneuropathy of hATTR amyloidosis in adults, granting it Priority Review, Fast Track, Breakthrough Therapy, and Orphan Drug designations. As the first-of-its-kind RNAi therapeutic, the approval institutionally settled gene silencing by siRNA as a clinically validated and approvable drug class.',
        source: {
          externalId: 'src:fda-onpattro-label-210922',
          name: 'U.S. Food and Drug Administration. ONPATTRO (patisiran) lipid complex injection — Prescribing Information (NDA 210922). Initial U.S. Approval 10 August 2018.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2018/210922s000lbl.pdf',
          publishedAt: '2018-08-10',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Dicumarol — first oral anticoagulant — Campbell & Link 1941 ─────────────
  {
    externalId: 'trajectory:campbell-link-dicumarol-first-oral-anticoagulant-1941',
    text: 'In 1941 Harold A. Campbell and Karl Paul Link reported the isolation and crystallization of dicumarol, the hemorrhagic agent of spoiled sweet clover, identifying the first orally active anticoagulant drug and founding the coumarin class that culminated in warfarin.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1941-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1941-01-01',
        datePrecision: 'YEAR',
        reason: 'Campbell and Link published in the Journal of Biological Chemistry the isolation and crystallization of the hemorrhagic agent responsible for cattle deaths from spoiled sweet clover hay, later named dicumarol (3,3\'-methylenebis-(4-hydroxycoumarin)). This recorded in the literature the structure of the first orally active anticoagulant, converting a veterinary toxicology puzzle into a defined therapeutic compound.',
        source: {
          externalId: 'src:campbell-link-dicumarol-jbc-1941',
          name: 'Campbell HA, Link KP. Studies on the hemorrhagic sweet clover disease. IV. The isolation and crystallization of the hemorrhagic agent. J Biol Chem. 1941;138:21-33. (documented in JBC Reflections: Hemorrhagic Sweet Clover Disease, Dicumarol, and Warfarin: the Work of Karl Paul Link.)',
          url: 'https://www.jbc.org/article/S0021-9258(19)62862-0/fulltext',
          publishedAt: '1941-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1954-01-01',
        datePrecision: 'YEAR',
        reason: 'Dicumarol entered clinical anticoagulant use in the early 1940s, and warfarin — the more potent synthetic coumarin Link\'s laboratory developed from the same chemistry — was approved for human clinical use in 1954. The adoption of oral coumarin anticoagulants institutionally settled oral anticoagulation as standard therapy for thromboembolic disease, a status the class still holds.',
        source: {
          externalId: 'src:acs-invention-of-warfarin-landmark',
          name: 'American Chemical Society. The Invention of Warfarin — National Historic Chemical Landmarks.',
          url: 'https://www.acs.org/education/whatischemistry/landmarks/warfarin.html',
          publishedAt: '2017-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SURGICAL FIRSTS & CRITICAL CARE (1944–1954)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Blalock-Taussig 'blue baby' operation — 1944 ────────────────────────────
  {
    externalId: 'trajectory:blalock-taussig-blue-baby-operation-1944',
    text: 'On 29 November 1944 Alfred Blalock, guided by Helen Taussig\'s pathophysiologic reasoning and Vivien Thomas\'s surgical groundwork, performed the first systemic-to-pulmonary shunt (\'blue baby\' operation) at Johns Hopkins, anastomosing the subclavian to the pulmonary artery to relieve cyanosis in a child with tetralogy of Fallot.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1944-11-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1945-05-19',
        datePrecision: 'DAY',
        reason: 'Blalock and Taussig reported three cases of severe pulmonary stenosis/atresia treated by the subclavian-to-pulmonary shunt in JAMA on 19 May 1945, documenting that the two deeply cyanotic patients had their cyanosis greatly diminished or abolished after surgery. This recorded the claim that a congenital cyanotic heart malformation could be palliated surgically — previously considered inoperable — and is widely regarded as the operation that launched the field of cardiac surgery.',
        source: {
          externalId: 'src:blalock-taussig-jama-1945',
          name: 'Blalock A, Taussig HB. The surgical treatment of malformations of the heart in which there is pulmonary stenosis or pulmonary atresia. JAMA. 1945 May 19;128(3):189-202.',
          url: 'https://www.jameslindlibrary.org/wp-data/uploads/2017/04/Blalock-Taussig-1945x.pdf',
          publishedAt: '1945-05-19',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1951-01-01',
        datePrecision: 'YEAR',
        reason: 'The operation was adopted internationally with remarkable speed: surgeons travelled to Johns Hopkins to learn it, and by 1951 over a thousand Blalock-Taussig shunts had been performed there alone, with the procedure established worldwide as standard palliation for cyanotic congenital heart disease. Its rapid, reproducible success settled the claim and opened the era of systematic surgical correction of the heart.',
        source: {
          externalId: 'src:blalock-taussig-james-lind-library',
          name: 'Blalock A, Taussig HB (1945). The James Lind Library — commentary on the surgical treatment of malformations of the heart with pulmonary stenosis or atresia.',
          url: 'https://www.jameslindlibrary.org/blalock-taussig-hb-1945/',
          publishedAt: '2017-04-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Lassen-Ibsen positive-pressure ventilation / ICU — 1952 ─────────────────
  {
    externalId: 'trajectory:lassen-ibsen-positive-pressure-ventilation-1952',
    text: 'On 27 August 1952, during the Copenhagen poliomyelitis epidemic, anaesthetist Bjørn Ibsen demonstrated that manual positive-pressure ventilation through a tracheostomy could rescue a patient dying of bulbar polio respiratory failure, displacing the negative-pressure iron lung and founding modern intensive care and mechanical ventilation.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1952-08-27',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1953-01',
        datePrecision: 'MONTH',
        reason: 'H.C.A. Lassen reported the epidemic in The Lancet in January 1953, documenting that switching from iron lungs to manual positive-pressure ventilation via tracheostomy — sustained around the clock by relays of medical and dental students squeezing rubber bags — cut mortality from bulbar/respiratory polio from roughly 80-90% to about 25%. This recorded in the literature the claim that active airway management and positive-pressure ventilation, not the iron lung, was the effective treatment for acute respiratory failure.',
        source: {
          externalId: 'src:lassen-copenhagen-polio-lancet-1953',
          name: 'Lassen HCA. A preliminary report on the 1952 epidemic of poliomyelitis in Copenhagen with special reference to the treatment of acute respiratory insufficiency. Lancet. 1953 Jan 3;261(6749):37-41.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13011944/',
          publishedAt: '1953-01-03',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1953-12',
        datePrecision: 'MONTH',
        reason: 'The Copenhagen experience drove the rapid replacement of negative-pressure ventilators with positive-pressure ventilation and the gathering of critically ill patients into dedicated, continuously staffed units; Ibsen organized what is generally regarded as the world\'s first intensive care unit at the Copenhagen Municipal Hospital in December 1953. Positive-pressure ventilation and intensive care became the global standard for respiratory failure, settling the claim that founded critical-care medicine.',
        source: {
          externalId: 'src:copenhagen-polio-icu-renaissance-review',
          name: 'Reisner-Sénélar L et al. / West JB. The physiological challenges of the 1952 Copenhagen poliomyelitis epidemic and a renaissance in clinical respiratory physiology. J Appl Physiol. 2005;99(2):424-432.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1351016/',
          publishedAt: '2005-08-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Merrill-Murray first kidney transplant between twins — 1954 ──────────────
  {
    externalId: 'trajectory:merrill-murray-first-kidney-transplant-twins-1954',
    text: 'On 23 December 1954 Joseph E. Murray and J. Hartwell Harrison performed the first enduringly successful human organ transplant at the Peter Bent Brigham Hospital in Boston, grafting a kidney from Ronald Herrick into his identical twin Richard, who survived with restored renal function.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1954-12-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1956-01-28',
        datePrecision: 'DAY',
        reason: 'Merrill, Murray, Harrison and Guild published the case in JAMA on 28 January 1956, reporting that a kidney transplanted between genetically identical twins functioned without rejection and restored the dying recipient to health. This recorded in the expert literature the first proof that a vascularized solid human organ could be transplanted and sustain life, demonstrating that the immunologic barrier — not surgical technique — was the obstacle to transplantation.',
        source: {
          externalId: 'src:merrill-kidney-twins-jama-1956',
          name: 'Merrill JP, Murray JE, Harrison JH, Guild WR. Successful homotransplantation of the human kidney between identical twins. J Am Med Assoc. 1956 Jan 28;160(4):277-282.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6371266/',
          publishedAt: '1956-01-28',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1990-10-08',
        datePrecision: 'DAY',
        reason: 'After immunosuppression (azathioprine and steroids, later ciclosporin) extended the technique to non-twin donors, kidney transplantation became established standard therapy for end-stage renal disease, and on 8 October 1990 Murray was awarded the Nobel Prize in Physiology or Medicine for his discoveries concerning organ transplantation. The highest institutional honor in medicine ratified the 1954 operation as the founding case of a now-routine clinical practice.',
        source: {
          externalId: 'src:nobel-murray-transplantation-1990',
          name: 'Nobel Prize Committee. The Nobel Prize in Physiology or Medicine 1990 — Joseph E. Murray, Facts. NobelPrize.org.',
          url: 'https://www.nobelprize.org/prizes/medicine/1990/murray/facts/',
          publishedAt: '1990-10-08',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Dublin EFM trial — routine electronic fetal monitoring contested — 1985 ──
  {
    externalId: 'trajectory:dublin-trial-electronic-fetal-monitoring-1985',
    text: 'The Dublin randomised controlled trial (MacDonald, Grant, Sheridan-Pereira, Boylan and Chalmers), published in the American Journal of Obstetrics & Gynecology in 1985, found that routine continuous electronic fetal heart-rate monitoring in labour roughly halved neonatal seizures but did not reduce perinatal death or one-year neurological disability versus intermittent auscultation, while increasing operative deliveries — contradicting the basis on which EFM had become standard intrapartum care.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1971-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1978-01-01',
        datePrecision: 'YEAR',
        reason: 'After continuous electronic fetal monitoring was introduced into clinical practice in the early 1970s — largely on the strength of animal experiments and observational data and the expectation that it would prevent intrapartum hypoxic injury and cerebral palsy — it diffused rapidly through US and UK labour wards, so that by 1978 roughly two-thirds of American births were electronically monitored. Routine EFM became the de facto institutional standard of intrapartum care before any randomized evidence of benefit existed.',
        source: {
          externalId: 'src:efm-half-century-bioethics-2017',
          name: 'Sartwelle TP, Johnston JC, Arda B. A half century of electronic fetal monitoring and bioethics: silence speaks louder than words. Matern Health Neonatol Perinatol. 2017;3:21.',
          url: 'https://mhnpjournal.biomedcentral.com/articles/10.1186/s40748-017-0060-2',
          publishedAt: '2017-11-13',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1985-07',
        datePrecision: 'MONTH',
        reason: 'MacDonald and colleagues reported the Dublin trial, randomizing 12,964 women to continuous EFM (with fetal scalp pH) versus intermittent auscultation. Continuous EFM approximately halved neonatal seizures but produced no significant reduction in perinatal mortality or in neurological abnormality at one year, while identifying more fetuses for intervention — contradicting the assumption that routine EFM improved hard outcomes. Together with the earlier Haverkamp trials and subsequent Cochrane reviews, this opened a durable controversy over routine intrapartum EFM that remains unresolved despite its continued near-universal use.',
        source: {
          externalId: 'src:macdonald-dublin-efm-ajog-1985',
          name: 'MacDonald D, Grant A, Sheridan-Pereira M, Boylan P, Chalmers I. The Dublin randomized controlled trial of intrapartum fetal heart rate monitoring. Am J Obstet Gynecol. 1985;152(5):524-539.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/3893132/',
          publishedAt: '1985-07-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ONCOLOGY & PRECISION MEDICINE ERA (1990–2010)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Paclitaxel (Taxol) FDA approval — first taxane — 1992 ──────────────────
  {
    externalId: 'trajectory:paclitaxel-taxol-ovarian-cancer-approval-1992',
    text: 'The FDA approved paclitaxel (Taxol) on 29 December 1992 for the treatment of metastatic ovarian carcinoma refractory to prior chemotherapy, establishing the first taxane (microtubule-stabilizing) anticancer drug.',
    claimType: 'HYBRID',
    claimEmergedAt: '1992-12-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1992-12-29',
        datePrecision: 'DAY',
        reason: 'The FDA approved Bristol-Myers Squibb\'s NDA 20-262 for paclitaxel (Taxol) in patients with metastatic ovarian cancer after failure of first-line or subsequent chemotherapy. The approval institutionalized a wholly new mechanistic class — the taxanes, which stabilize microtubules rather than damaging DNA — and opened the way to subsequent approvals in breast (1994) and non-small-cell lung cancer (1999). It marked the regulatory settling of paclitaxel\'s clinical efficacy.',
        source: {
          externalId: 'src:fda-taxol-paclitaxel-nda-20262-1992',
          name: 'U.S. Food and Drug Administration. Drug Approval Package: Taxol (paclitaxel) NDA 20-262. Approved 29 December 1992.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/nda/98/020262s026s027s028.cfm',
          publishedAt: '1992-12-29',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── EGFR mutations predict gefitinib response — Lynch 2004 / IPASS 2009 ────
  {
    externalId: 'trajectory:egfr-mutations-predict-gefitinib-response-2004',
    text: 'Lynch and colleagues reported in the New England Journal of Medicine on 20 May 2004 that somatic activating mutations in the tyrosine-kinase domain of the EGFR gene underlie and predict the dramatic responsiveness of non-small-cell lung cancer to the inhibitor gefitinib.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2004-04-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2004-04-29',
        datePrecision: 'DAY',
        reason: 'Lynch et al. (and concurrently Paez et al. in Science) found EGFR kinase-domain mutations in 8 of 9 gefitinib responders versus 0 of 7 non-responders, explaining why only a minority of lung-cancer patients responded dramatically to the drug. This recorded, for the first time, a molecular predictive biomarker of response to a targeted small-molecule inhibitor — a foundational result for precision oncology. Published online 29 April 2004, print 20 May 2004.',
        source: {
          externalId: 'src:lynch-egfr-gefitinib-nejm-2004',
          name: 'Lynch TJ, Bell DW, Sordella R, et al. Activating mutations in the epidermal growth factor receptor underlying responsiveness of non-small-cell lung cancer to gefitinib. N Engl J Med. 2004;350(21):2129-2139.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15118073/',
          publishedAt: '2004-05-20',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2009-09-03',
        datePrecision: 'DAY',
        reason: 'The randomized phase III IPASS trial (Mok et al., NEJM) confirmed prospectively that EGFR mutation status is a strong predictor of benefit: mutation-positive patients had superior progression-free survival with gefitinib while mutation-negative patients did better with chemotherapy. This settled mutation-guided treatment selection as the standard of care in advanced NSCLC.',
        source: {
          externalId: 'src:mok-ipass-gefitinib-nejm-2009',
          name: 'Mok TS, Wu YL, Thongprasert S, et al. Gefitinib or carboplatin-paclitaxel in pulmonary adenocarcinoma. N Engl J Med. 2009;361(10):947-957.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/19692680/',
          publishedAt: '2009-09-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── R-CHOP for DLBCL — Coiffier / GELA 2002 ────────────────────────────────
  {
    externalId: 'trajectory:rituximab-rchop-dlbcl-immunochemotherapy-2002',
    text: 'Coiffier and the GELA investigators reported in the New England Journal of Medicine on 24 January 2002 that adding rituximab to CHOP chemotherapy (R-CHOP) significantly improves complete-response, event-free and overall survival in elderly patients with diffuse large B-cell lymphoma without added toxicity.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2002-01-24',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2002-01-24',
        datePrecision: 'DAY',
        reason: 'The GELA LNH-98.5 randomized trial showed R-CHOP raised the complete-response rate (76% vs 63%, P=0.005) and significantly improved event-free and overall survival versus CHOP alone in patients aged 60-80. The result was immediately practice-changing and established immunochemotherapy (chemotherapy plus a monoclonal antibody) as the global standard of care for aggressive B-cell lymphoma, extending rituximab\'s role from monotherapy to curative-intent combination treatment.',
        source: {
          externalId: 'src:coiffier-rchop-dlbcl-nejm-2002',
          name: 'Coiffier B, Lepage E, Briere J, et al. CHOP chemotherapy plus rituximab compared with CHOP alone in elderly patients with diffuse large-B-cell lymphoma. N Engl J Med. 2002;346(4):235-242.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11807147/',
          publishedAt: '2002-01-24',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── KRAS mutation predicts anti-EGFR non-response in CRC — Karapetis 2008 ──
  {
    externalId: 'trajectory:kras-mutation-predicts-anti-egfr-nonresponse-crc-2008',
    text: 'Karapetis and colleagues reported in the New England Journal of Medicine on 23 October 2008 that K-ras tumor mutations predict lack of benefit from cetuximab in metastatic colorectal cancer, refining the prior claim that the anti-EGFR antibody benefited colorectal-cancer patients broadly.',
    claimType: 'HYBRID',
    claimEmergedAt: '2008-10-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2008-10-23',
        datePrecision: 'DAY',
        reason: 'Analyzing the NCIC CTG CO.17 trial, Karapetis et al. found cetuximab improved survival only in patients with wild-type K-ras tumors (median OS 9.5 vs 4.8 months), while patients with K-ras codon 12/13 mutations derived no benefit. This recorded the first negative predictive biomarker for a targeted antibody, establishing that a downstream pathway mutation could abrogate an upstream-receptor-directed therapy.',
        source: {
          externalId: 'src:karapetis-kras-cetuximab-nejm-2008',
          name: 'Karapetis CS, Khambata-Ford S, Jonker DJ, et al. K-ras mutations and benefit from cetuximab in advanced colorectal cancer. N Engl J Med. 2008;359(17):1757-1765.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/18946061/',
          publishedAt: '2008-10-23',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2009-04-20',
        datePrecision: 'DAY',
        reason: 'The American Society of Clinical Oncology issued a provisional clinical opinion recommending that all metastatic colorectal-cancer candidates for anti-EGFR antibody therapy be tested for KRAS mutations, and that those with codon 12/13 mutations not receive cetuximab or panitumumab. Together with the FDA\'s July 2009 label changes for both antibodies, this institutionalized mandatory predictive biomarker testing before therapy.',
        source: {
          externalId: 'src:allegra-asco-kras-pco-jco-2009',
          name: 'Allegra CJ, Jessup JM, Somerfield MR, et al. American Society of Clinical Oncology provisional clinical opinion: testing for KRAS gene mutations in patients with metastatic colorectal carcinoma to predict response to anti-EGFR monoclonal antibody therapy. J Clin Oncol. 2009;27(12):2091-2096.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/19188670/',
          publishedAt: '2009-04-20',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // WOMEN'S HEALTH & MATERNAL MEDICINE
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Colebrook & Kenny — Prontosil for puerperal fever — 1936 ────────────────
  {
    externalId: 'trajectory:colebrook-kenny-prontosil-puerperal-fever-1936',
    text: 'Leonard Colebrook and Méave Kenny reported in The Lancet on 5 December 1936 that treatment with Prontosil (the sulphonamide releasing sulfanilamide) dramatically reduced mortality from puerperal fever caused by haemolytic streptococci, cutting the case-fatality rate among treated women from about 25% to under 5%.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1936-12-05',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1936-12-05',
        datePrecision: 'DAY',
        reason: 'Working for the Medical Research Council\'s Therapeutic Trials Committee at Queen Charlotte\'s Hospital, Colebrook and Kenny published \'Treatment with prontosil of puerperal infections due to haemolytic streptococci\' in The Lancet, reporting 8 deaths among 64 Prontosil-treated cases (4.7%) versus 19 of 76 (25%) in the preceding untreated series. This recorded the first clinical evidence that a synthetic chemotherapeutic agent could cure an established bacterial infection and slash maternal mortality from childbed fever.',
        source: {
          externalId: 'src:colebrook-kenny-prontosil-puerperal-lancet-1936',
          name: 'Colebrook L, Kenny M. Treatment of human puerperal infections, and of experimental infections in mice, with prontosil. Lancet. 1936;228(5884):1279–1286; and Treatment with prontosil of puerperal infections due to haemolytic streptococci. Lancet. 1936;228(5887):1319–1322.',
          url: 'https://embryo.asu.edu/pages/leonard-colebrooks-use-sulfonamides-treatment-puerperal-fever-1935-1937',
          publishedAt: '1936-12-05',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1937-12-01',
        datePrecision: 'YEAR',
        reason: 'Colebrook and A. W. Purdie published a larger confirmatory two-part series in The Lancet, \'Treatment of 106 cases of puerperal fever by sulphanilamide,\' showing that sulfanilamide itself (the active moiety of Prontosil) produced equally dramatic results in a larger cohort. The independent, scaled-up confirmation settled within the expert community the claim that sulphonamide chemotherapy is effective treatment for puerperal streptococcal sepsis, ushering in the steep fall in maternal mortality recorded across Britain in the late 1930s.',
        source: {
          externalId: 'src:colebrook-purdie-106-cases-sulphanilamide-lancet-1937',
          name: 'Colebrook L, Purdie AW. Treatment of 106 cases of puerperal fever by sulphanilamide (streptocide). Lancet. 1937;2:1237–1242 & 1291–1294.',
          url: 'https://www.jameslindlibrary.org/colebrook-l-purdie-aw-1937/',
          publishedAt: '1937-12-04',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Lucy Wills — pregnancy macrocytic anaemia / folate — 1931 ───────────────
  {
    externalId: 'trajectory:lucy-wills-pregnancy-macrocytic-anaemia-1931',
    text: 'Lucy Wills reported in the British Medical Journal on 20 June 1931 that the macrocytic (\'pernicious\') anaemia of pregnancy in Bombay was cured by a heat-stable, water-soluble dietary factor present in yeast extract (Marmite) but absent from the purified liver extracts that cure true pernicious anaemia — identifying a distinct anti-anaemic nutrient later named the \'Wills factor.\'',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1931-06-20',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1931-06-20',
        datePrecision: 'DAY',
        reason: 'Wills published \'Treatment of "Pernicious Anaemia of Pregnancy" and "Tropical Anaemia"\' in the BMJ, showing that pregnant women in Bombay with severe macrocytic anaemia who failed to respond to purified liver extract (the antipernicious/B12 factor) nonetheless recovered when given crude yeast extract. This recorded the claim that a previously unrecognised dietary haemopoietic factor — heat-stable and water-soluble — was responsible for the macrocytic anaemia of pregnancy.',
        source: {
          externalId: 'src:wills-pernicious-anaemia-pregnancy-bmj-1931',
          name: 'Wills L. Treatment of \'pernicious anaemia of pregnancy\' and \'tropical anaemia\' with special reference to yeast extract as a curative agent. Br Med J. 1931;1(3676):1059–1064.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2314785/',
          publishedAt: '1931-06-20',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1945-01-01',
        datePrecision: 'YEAR',
        reason: 'Over the 1940s the \'Wills factor\' was chemically characterised, isolated, and synthesised as folic acid (pteroylglutamic acid), and folic acid was shown to cure the megaloblastic anaemia of pregnancy and tropical macrocytic anaemia. This identification settled Wills\'s claim that her dietary factor was a discrete vitamin distinct from B12, establishing folate as a foundational nutrient of maternal and fetal health.',
        source: {
          externalId: 'src:james-lind-library-lucy-wills-folate',
          name: 'Bastian H. Lucy Wills (1888–1964): the life and research of an adventurous independent woman. James Lind Library / J R Coll Physicians Edinb. 2008;38(1):89–91.',
          url: 'https://www.jameslindlibrary.org/articles/lucy-wills-1888-1964-the-life-and-research-of-an-adventurous-independent-woman/',
          publishedAt: '2008-03-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── HIP trial — mammography screening reduces breast cancer mortality — 1971 ─
  {
    externalId: 'trajectory:hip-mammography-screening-reduces-breast-cancer-mortality-1971',
    text: 'Sam Shapiro, Philip Strax, and Louis Venet reported in JAMA on 15 March 1971 that the Health Insurance Plan of Greater New York (HIP) randomized trial showed periodic screening with mammography plus clinical breast examination reduced breast cancer mortality by roughly one third in women aged 40–64.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1971-03-15',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1971-03-15',
        datePrecision: 'DAY',
        reason: 'Shapiro, Strax, and Venet published the HIP results in JAMA, the first randomized controlled trial evidence that inviting women to periodic mammographic screening lowered breast cancer mortality — about 30% fewer breast cancer deaths in the screened group at follow-up. This recorded the claim that early radiographic detection of breast cancer could prevent deaths, launching the modern breast-screening era.',
        source: {
          externalId: 'src:shapiro-hip-mammography-mortality-jama-1971',
          name: 'Shapiro S, Strax P, Venet L. Periodic breast cancer screening in reducing mortality from breast cancer. JAMA. 1971;215(11):1777–1785.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/5107709/',
          publishedAt: '1971-03-15',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1985-04-13',
        datePrecision: 'DAY',
        reason: 'László Tabár and colleagues published the Swedish Two-County randomized trial in The Lancet, reporting a 31% reduction in breast cancer mortality among women invited to mammographic screening across 134,867 participants. This large, independent confirmation of the HIP finding settled, within the expert community, the claim that population mammographic screening reduces breast cancer mortality and underpinned national screening programs.',
        source: {
          externalId: 'src:tabar-swedish-two-county-mammography-lancet-1985',
          name: 'Tabár L, Fagerberg CJ, Gad A, et al. Reduction in mortality from breast cancer after mass screening with mammography. Randomised trial from the Breast Cancer Screening Working Group of the Swedish National Board of Health and Welfare. Lancet. 1985;1(8433):829–832.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2858707/',
          publishedAt: '1985-04-13',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── RhoGAM / Rho(D) immune globulin — prevents Rh disease of newborn — 1964 ─
  {
    externalId: 'trajectory:rho-d-immune-globulin-rhogam-prevents-rh-disease-1964',
    text: 'Vincent Freda, John Gorman, and William Pollack reported in Transfusion in early 1964 that an anti-Rh (anti-D) gamma-globulin preparation, given to Rh-negative individuals after exposure to Rh-positive blood, prevented Rh sensitization — the basis for RhoGAM, which prevents haemolytic disease of the fetus and newborn.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1964-01-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1964-01-01',
        datePrecision: 'MONTH',
        reason: 'Freda (obstetrician), Gorman (pathologist), and Pollack (Ortho research scientist) published \'Successful prevention of experimental Rh sensitization in man with an anti-Rh gamma2-globulin antibody preparation: a preliminary report\' in Transfusion. In Rh-negative male volunteers repeatedly challenged with Rh-positive blood, those given the anti-Rh globulin did not form anti-Rh antibodies while controls became sensitized. This recorded the claim that passive anti-D immunoprophylaxis could prevent maternal Rh isoimmunization.',
        source: {
          externalId: 'src:freda-gorman-pollack-rh-sensitization-transfusion-1964',
          name: 'Freda VJ, Gorman JG, Pollack W. Successful prevention of experimental Rh sensitization in man with an anti-Rh gamma2-globulin antibody preparation: a preliminary report. Transfusion. 1964;4(1):26–32.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/14105934/',
          publishedAt: '1964-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1968-04-01',
        datePrecision: 'MONTH',
        reason: 'After multicentre clinical trials in Rh-negative mothers (including the 1966 Science report) confirmed efficacy, the U.S. FDA licensed RhoGAM (Rho[D] immune globulin, produced by Ortho) in April 1968; the first dose was administered on 29 May 1968. This institutional approval settled the claim that postpartum anti-D prophylaxis prevents Rh haemolytic disease of the newborn, after which Rh-disease deaths fell precipitously.',
        source: {
          externalId: 'src:columbia-rhogam-at-50-fda-1968',
          name: 'Columbia University Irving Medical Center. RhoGAM at 50: A Columbia Drug Still Saving Lives of Newborns. 2018.',
          url: 'https://www.cuimc.columbia.edu/news/rhogam-50-columbia-drug-still-saving-lives-newborns',
          publishedAt: '2018-05-29',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Sipuleucel-T (Provenge) — first therapeutic cancer vaccine — 2010 ───────
  {
    externalId: 'trajectory:sipuleucel-t-provenge-first-cancer-vaccine-2010',
    text: 'The FDA approved sipuleucel-T (Provenge) on 29 April 2010 for asymptomatic or minimally symptomatic metastatic castration-resistant prostate cancer, making it the first therapeutic (active cellular immunotherapy) cancer vaccine approved for any cancer.',
    claimType: 'HYBRID',
    claimEmergedAt: '2010-04-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2010-04-29',
        datePrecision: 'DAY',
        reason: 'On the strength of the phase III IMPACT trial (Kantoff et al., NEJM 2010), which showed a 4.1-month median overall-survival improvement (25.8 vs 21.7 months) and a 22% relative reduction in death risk versus placebo, the FDA approved sipuleucel-T, an autologous antigen-presenting-cell product targeting prostatic acid phosphatase. The approval institutionally validated therapeutic cancer vaccination as a viable treatment modality after decades of failed cancer-vaccine attempts.',
        source: {
          externalId: 'src:fda-provenge-sipuleucel-t-approval-2010',
          name: 'U.S. Food and Drug Administration. PROVENGE (sipuleucel-T) — approval for metastatic castration-resistant prostate cancer. 29 April 2010.',
          url: 'https://www.fda.gov/vaccines-blood-biologics/cellular-gene-therapy-products/provenge-sipuleucel-t',
          publishedAt: '2010-04-29',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // VACCINES — EPISTEMIC REVERSALS & SAFETY CRISES
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Salk inactivated polio vaccine — Francis report & Cutter incident 1955 ──
  {
    externalId: 'trajectory:salk-inactivated-polio-vaccine-1955',
    text: 'Thomas Francis Jr. reported on 12 April 1955 that Jonas Salk\'s formalin-inactivated poliovirus vaccine was safe, effective, and potent in preventing paralytic poliomyelitis, and the vaccine was licensed for use in U.S. children the same day.',
    claimType: 'HYBRID',
    claimEmergedAt: '1955-04-12',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1955-04-12',
        datePrecision: 'DAY',
        reason: 'At the University of Michigan, Thomas Francis Jr., director of the Poliomyelitis Vaccine Evaluation Center, announced the results of the 1954 field trial of roughly 1.8 million children, declaring the Salk inactivated vaccine \'safe, effective, and potent\' (60–90% efficacy against paralytic polio). The federal government licensed six manufacturers the same day, placing on the official record the claim that an inactivated poliovirus vaccine could prevent paralytic disease.',
        source: {
          externalId: 'src:francis-1954-polio-vaccine-trials-1955',
          name: 'Francis T Jr, Korns RF, Voight RB, et al. An evaluation of the 1954 poliomyelitis vaccine trials. Am J Public Health. 1955;45(5 Pt 2):1-63.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/14361811/',
          publishedAt: '1955-05-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '1955-05-07',
        datePrecision: 'DAY',
        reason: 'Defective lots produced by Cutter Laboratories contained incompletely inactivated live poliovirus, causing roughly 40,000 cases of abortive polio, 51 cases of permanent paralysis, and 5 deaths among vaccinees and their contacts. The U.S. Surgeon General suspended the national immunization program in early May 1955, throwing the safety of the inactivated vaccine into immediate public and institutional doubt.',
        source: {
          externalId: 'src:offit-cutter-incident-50-years-2005',
          name: 'Offit PA. The Cutter incident, 50 years later. N Engl J Med. 2005;352(14):1411-1412.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15814877/',
          publishedAt: '2005-04-07',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1963-07-01',
        datePrecision: 'MONTH',
        reason: 'Nathanson and Langmuir\'s epidemiologic investigation established that the 1955 cases stemmed from the specific Cutter manufacturing failure—cell debris shielding virus from formaldehyde—rather than any flaw in the inactivated-vaccine concept. With tightened production and testing standards the program resumed, and paralytic polio incidence in the U.S. fell from tens of thousands of cases annually to a few hundred, re-settling the vaccine\'s efficacy and safety.',
        source: {
          externalId: 'src:nathanson-langmuir-cutter-incident-1963',
          name: 'Nathanson N, Langmuir AD. The Cutter incident. Poliomyelitis following formaldehyde-inactivated poliovirus vaccination in the United States during the spring of 1955. Am J Hyg. 1963;78(1):16-28.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/14043545/',
          publishedAt: '1963-07-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Low-level lead exposure / childhood cognition — Needleman 1979 ──────────
  {
    externalId: 'trajectory:needleman-low-level-lead-childhood-cognition-1979',
    text: 'Herbert Needleman and colleagues reported on 29 March 1979 that children with elevated dentine (tooth) lead levels but no clinical lead poisoning showed measurable deficits in IQ, attention, and classroom performance, establishing that low-level, subclinical lead exposure impairs children\'s cognitive development.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1979-03-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1979-03-29',
        datePrecision: 'DAY',
        reason: 'Needleman et al. published in the New England Journal of Medicine a study of first- and second-grade children classified by dentine lead, finding that higher-lead children scored significantly lower on full-scale IQ, verbal performance, and attention and were rated worse by teachers on classroom behavior. The paper put on record the claim that lead causes neurobehavioral harm at exposures below the threshold for diagnosed lead poisoning.',
        source: {
          externalId: 'src:needleman-dentine-lead-deficits-nejm-1979',
          name: 'Needleman HL, Gunnoe C, Leviton A, et al. Deficits in psychologic and classroom performance of children with elevated dentine lead levels. N Engl J Med. 1979;300(13):689-695.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/763299/',
          publishedAt: '1979-03-29',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1990-01-11',
        datePrecision: 'DAY',
        reason: 'Needleman\'s 11-year follow-up of the original cohort showed that childhood lead exposure predicted lower class standing, reading disability, and higher school dropout into young adulthood, confirming durable harm. Combined with the EPA\'s phasedown of leaded gasoline and the CDC\'s progressive lowering of the blood-lead level of concern, the no-safe-threshold view became scientific consensus; data-integrity allegations raised against Needleman in 1990–1991 were investigated and ultimately dismissed, leaving the finding intact.',
        source: {
          externalId: 'src:needleman-11-year-lead-followup-nejm-1990',
          name: 'Needleman HL, Schell A, Bellinger D, Leviton A, Allred EN. The long-term effects of exposure to low doses of lead in childhood. An 11-year follow-up report. N Engl J Med. 1990;322(2):83-88.',
          url: 'https://www.nejm.org/doi/full/10.1056/NEJM199001113220203',
          publishedAt: '1990-01-11',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Killed inactivated measles vaccine — withdrawal 1967 ────────────────────
  {
    externalId: 'trajectory:killed-inactivated-measles-vaccine-withdrawal-1967',
    text: 'A formalin-inactivated (\'killed\') measles virus vaccine was licensed in the United States in 1963 as a safe and effective means of immunizing children against measles, then withdrawn in 1967–1968 after recipients were found to develop severe atypical measles on later exposure to wild virus.',
    claimType: 'HYBRID',
    claimEmergedAt: '1963-03',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1963-03',
        datePrecision: 'MONTH',
        reason: 'In March 1963 U.S. regulators licensed both a live attenuated (Edmonston-B) measles vaccine and a formalin-inactivated \'killed\' measles vaccine, the latter offered as a less reactogenic option and given to hundreds of thousands of children. This recorded the claim that an inactivated measles vaccine could safely protect children against measles.',
        source: {
          externalId: 'src:cdc-pinkbook-measles-chapter13',
          name: 'CDC. Epidemiology and Prevention of Vaccine-Preventable Diseases (Pink Book), Chapter 13: Measles.',
          url: 'https://www.cdc.gov/pinkbook/hcp/table-of-contents/chapter-13-measles.html',
          publishedAt: '2021-08-18',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1967-12-18',
        datePrecision: 'DAY',
        reason: 'Fulginiti and colleagues reported in JAMA that children immunized years earlier with killed measles vaccine developed atypical measles—high fever, an unusual peripheral rash, and pneumonia—when later exposed to wild virus, showing the vaccine sensitized rather than durably protected. The killed vaccine was withdrawn from the U.S. market, reversing the original safety-and-efficacy claim.',
        source: {
          externalId: 'src:fulginiti-atypical-measles-killed-vaccine-jama-1967',
          name: 'Fulginiti VA, Eller JJ, Downie AW, Kempe CH. Altered reactivity to measles virus. Atypical measles in children previously immunized with inactivated measles virus vaccines. JAMA. 1967;202(12):1075-1080.',
          url: 'https://jamanetwork.com/journals/jama/article-abstract/336928',
          publishedAt: '1967-12-18',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Hib polysaccharide vaccine — ineffective in infants 1985 ────────────────
  {
    externalId: 'trajectory:hib-polysaccharide-vaccine-ineffective-infants-1985',
    text: 'The unconjugated PRP capsular polysaccharide Haemophilus influenzae type b (Hib) vaccine, licensed in the United States in April 1985, was claimed to protect young children against invasive Hib disease but was found to give little or no protection to the highest-risk children and was superseded by conjugate vaccines within three years.',
    claimType: 'HYBRID',
    claimEmergedAt: '1985-04',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1985-04',
        datePrecision: 'MONTH',
        reason: 'The FDA licensed the first Hib vaccine, an unconjugated PRP capsular polysaccharide, and it was recommended for children 18–59 months of age. This recorded the claim that a polysaccharide vaccine could protect young children against invasive Haemophilus influenzae type b disease—then a leading cause of childhood bacterial meningitis.',
        source: {
          externalId: 'src:cdc-pinkbook-hib-chapter8',
          name: 'CDC. Epidemiology and Prevention of Vaccine-Preventable Diseases (Pink Book), Chapter 8: Haemophilus influenzae type b.',
          url: 'https://www.cdc.gov/pinkbook/hcp/table-of-contents/chapter-8-haemophilus-influenzae.html',
          publishedAt: '2021-08-18',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1988-09-09',
        datePrecision: 'DAY',
        reason: 'Osterholm et al. reported in JAMA that the PRP polysaccharide vaccine provided no measurable protection in Minnesota children—including those in the licensed 18–59-month range—and may even have been associated with increased early risk. The finding directly contradicted the licensed efficacy claim and, with poor immunogenicity under 18 months already known, put the vaccine\'s usefulness in serious dispute.',
        source: {
          externalId: 'src:osterholm-hib-polysaccharide-no-efficacy-jama-1988',
          name: 'Osterholm MT, Rambeck JH, White KE, et al. Lack of efficacy of Haemophilus b polysaccharide vaccine in Minnesota. JAMA. 1988;260(10):1423-1428.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/3261349/',
          publishedAt: '1988-09-09',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1990-11-15',
        datePrecision: 'DAY',
        reason: 'Eskola et al. showed in a large randomized Finnish field trial that a Hib conjugate vaccine—linking the PRP polysaccharide to a protein carrier—protected infants and young children, the group the plain polysaccharide vaccine could not. Conjugate vaccines (the first, PRP-D, licensed December 1987) replaced the polysaccharide vaccine, which was discontinued; the original polysaccharide claim was abandoned in favor of the conjugate technology.',
        source: {
          externalId: 'src:eskola-hib-conjugate-field-trial-nejm-1990',
          name: 'Eskola J, Käyhty H, Takala AK, et al. A randomized, prospective field trial of a conjugate vaccine in the protection of infants and young children against invasive Haemophilus influenzae type b disease. N Engl J Med. 1990;323(20):1381-1387.',
          url: 'https://www.nejm.org/doi/full/10.1056/NEJM199011153232004',
          publishedAt: '1990-11-15',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Whole-cell pertussis vaccine / brain damage claim — Kulenkampff 1974 ────
  {
    externalId: 'trajectory:whole-cell-pertussis-vaccine-brain-damage-1974',
    text: 'Kulenkampff, Schwartzman and Wilson reported in January 1974 that whole-cell pertussis (DTP) vaccine could cause serious acute neurological reactions and permanent brain damage in young children—a claim that triggered a collapse in UK vaccination coverage and was later not upheld.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1974-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1974-01',
        datePrecision: 'MONTH',
        reason: 'Kulenkampff et al. described in Archives of Disease in Childhood 36 children with neurological complications—including convulsions and apparent permanent brain damage—temporally clustered after pertussis (triple) vaccination, suggesting a causal rather than coincidental relation. Amplified by the press and the Association of Parents of Vaccine Damaged Children, the claim drove UK pertussis vaccine uptake from about 80% to 30% between 1974 and 1978 and precipitated whooping-cough epidemics.',
        source: {
          externalId: 'src:kulenkampff-pertussis-neurological-complications-1974',
          name: 'Kulenkampff M, Schwartzman JS, Wilson J. Neurological complications of pertussis inoculation. Arch Dis Child. 1974;49(1):46-49.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/4818092/',
          publishedAt: '1974-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1981-05-16',
        datePrecision: 'DAY',
        reason: 'The National Childhood Encephalopathy Study (NCES), reported by Miller et al. in the British Medical Journal, found that serious acute neurological illness within seven days of DTP was rare and the attributable-risk estimate was statistically marginal with very wide confidence intervals; crucially, it found no case of resulting permanent brain damage. The original strong causal claim was sharply qualified and placed in dispute.',
        source: {
          externalId: 'src:miller-nces-pertussis-neurological-bmj-1981',
          name: 'Miller DL, Ross EM, Alderslade R, Bellman MH, Rawson NSB. Pertussis immunisation and serious acute neurological illness in children. Br Med J (Clin Res Ed). 1981;282(6276):1595-1599.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6786580/',
          publishedAt: '1981-05-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'JUDICIAL',
        occurredAt: '1988-03-30',
        datePrecision: 'DAY',
        reason: 'In Loveday v Renton, after a 61-day trial weighing the NCES and expert epidemiologic evidence, Lord Justice Stuart-Smith of the English High Court held that it had not been proved on the balance of probabilities that whole-cell pertussis vaccine can cause permanent brain damage in young children. The ruling effectively ended the major UK vaccine-damage litigation and reflected the emerging consensus that the permanent-brain-damage claim was unsubstantiated.',
        source: {
          externalId: 'src:iom-pertussis-rubella-chronology-1991',
          name: 'Institute of Medicine. Pertussis and Rubella Vaccines: A Brief Chronology. In: Adverse Effects of Pertussis and Rubella Vaccines. Washington (DC): National Academies Press; 1991.',
          url: 'https://www.ncbi.nlm.nih.gov/books/NBK234365/',
          publishedAt: '1991-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ORPHAN DRUGS, RARE DISEASE THERAPY & POST-MARKET REVERSALS (2001–2010)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Sapropterin / Kuvan — first PKU drug 2007 ───────────────────────────────
  {
    externalId: 'trajectory:sapropterin-kuvan-first-pku-drug-2007',
    text: 'On 13 December 2007 the U.S. FDA approved sapropterin dihydrochloride (Kuvan, BioMarin, NDA 022181), a synthetic form of the cofactor tetrahydrobiopterin (6R-BH4), as the first drug therapy for phenylketonuria (PKU), establishing pharmacologic reduction of blood phenylalanine in BH4-responsive patients as effective adjunct to the long-standing dietary-only management of the inborn error of metabolism.',
    claimType: 'HYBRID',
    claimEmergedAt: '2007-08-11',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2007-08-11',
        datePrecision: 'DAY',
        reason: 'Levy and colleagues published a phase III randomised placebo-controlled trial in The Lancet showing that sapropterin (6R-BH4) significantly reduced blood phenylalanine concentrations in BH4-responsive PKU patients versus placebo. This provided the first controlled evidence that a drug, rather than dietary protein restriction alone, could lower phenylalanine in PKU, recording the efficacy claim in the peer-reviewed literature.',
        source: {
          externalId: 'src:levy-sapropterin-pku-lancet-2007',
          name: 'Levy HL, Milanowski A, Chakrapani A, et al. Efficacy of sapropterin dihydrochloride (tetrahydrobiopterin, 6R-BH4) for reduction of phenylalanine concentration in patients with phenylketonuria: a phase III randomised placebo-controlled study. Lancet. 2007 Aug 11;370(9586):504-510.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/17693179/',
          publishedAt: '2007-08-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2007-12-13',
        datePrecision: 'DAY',
        reason: 'The FDA approved Kuvan as the first specific drug therapy for PKU, to reduce blood phenylalanine in patients with BH4-responsive hyperphenylalaninemia in conjunction with a phenylalanine-restricted diet. The approval settled, as institutional fact, that pharmacologic cofactor supplementation is a recognized treatment for an inborn error of metabolism previously managed only by diet, and opened the modern era of PKU drug therapy.',
        source: {
          externalId: 'src:biomarin-fda-kuvan-approval-2007',
          name: 'BioMarin Pharmaceutical. BioMarin Announces FDA Approval for Kuvan (sapropterin dihydrochloride) — first drug therapy approved for phenylketonuria (PKU). 13 December 2007.',
          url: 'https://www.biomarin.com/news/press-releases/biomarin-announces-fda-approval-for-kuvan/',
          publishedAt: '2007-12-13',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Galsulfase / Naglazyme — first MPS VI ERT 2005 ─────────────────────────
  {
    externalId: 'trajectory:galsulfase-naglazyme-first-mps-vi-ert-2005',
    text: 'On 31 May 2005 the U.S. FDA approved galsulfase (Naglazyme, BioMarin, BLA 125117), a recombinant human N-acetylgalactosamine 4-sulfatase (arylsulfatase B), as the first specific treatment for mucopolysaccharidosis VI (Maroteaux-Lamy syndrome), establishing enzyme replacement therapy as effective for the orphan lysosomal storage disorder.',
    claimType: 'HYBRID',
    claimEmergedAt: '2005-05-31',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2005-05-31',
        datePrecision: 'DAY',
        reason: 'Following a randomized placebo-controlled phase 3 trial showing improved endurance (walking and stair-climbing capacity) and reduced urinary glycosaminoglycans, the FDA granted Naglazyme orphan-drug approval as the first therapy for MPS VI, a deficiency of N-acetylgalactosamine 4-sulfatase. The approval settled weekly enzyme infusion as the standard of care for a previously untreatable lysosomal storage disease, extending the ERT paradigm established for Gaucher and MPS I to MPS VI.',
        source: {
          externalId: 'src:fda-naglazyme-galsulfase-label-2005',
          name: 'FDA. Naglazyme (galsulfase) prescribing information / original product label, BLA 125117 (approved 31 May 2005).',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2005/125117_0000_lbl.pdf',
          publishedAt: '2005-05-31',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Idursulfase / Elaprase — first MPS II ERT 2006 ──────────────────────────
  {
    externalId: 'trajectory:idursulfase-elaprase-first-mps-ii-ert-2006',
    text: 'On 24 July 2006 the U.S. FDA approved idursulfase (Elaprase, Shire, BLA 125151), a recombinant human iduronate-2-sulfatase, as the first treatment for mucopolysaccharidosis II (Hunter syndrome), establishing enzyme replacement therapy as effective for the X-linked orphan lysosomal storage disorder.',
    claimType: 'HYBRID',
    claimEmergedAt: '2006-07-24',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2006-07-24',
        datePrecision: 'DAY',
        reason: 'On the basis of a phase II/III randomized study (Muenzer et al., 96 patients) showing significant improvement in a composite endpoint of six-minute walk distance and pulmonary function on weekly idursulfase versus placebo, the FDA approved Elaprase as the first and only specific therapy for Hunter syndrome (MPS II), caused by iduronate-2-sulfatase deficiency. The approval settled weekly enzyme infusion as the standard of care for a previously untreatable disease.',
        source: {
          externalId: 'src:muenzer-idursulfase-mps-ii-genetmed-2006',
          name: 'Muenzer J, Wraith JE, Beck M, et al. A phase II/III clinical study of enzyme replacement therapy with idursulfase in mucopolysaccharidosis II (Hunter syndrome). Genet Med. 2006 Aug;8(8):465-473.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16912578/',
          publishedAt: '2006-08-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Drotrecogin alfa (Xigris) — sepsis approval reversal 2001/2011 ──────────
  {
    externalId: 'trajectory:drotrecogin-xigris-sepsis-approval-reversal-2001',
    text: 'Drotrecogin alfa (activated) (Xigris, Eli Lilly), a recombinant human activated protein C, was approved by the U.S. FDA on 21 November 2001 as the first drug to reduce mortality in adults with severe sepsis at high risk of death — a claim Lilly reversed on 25 October 2011 by withdrawing the drug worldwide after the confirmatory PROWESS-SHOCK trial found no survival benefit.',
    claimType: 'HYBRID',
    claimEmergedAt: '2001-03-08',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2001-03-08',
        datePrecision: 'DAY',
        reason: 'The PROWESS trial (Bernard et al., NEJM) reported that recombinant human activated protein C reduced 28-day all-cause mortality in severe sepsis by an absolute 6.1% (relative reduction ~19%) versus placebo, and was stopped early for efficacy. This recorded in the literature the first apparently effective pharmacologic therapy for a syndrome with no specific treatment.',
        source: {
          externalId: 'src:bernard-prowess-apc-sepsis-nejm-2001',
          name: 'Bernard GR, Vincent JL, Laterre PF, et al. Efficacy and safety of recombinant human activated protein C for severe sepsis. N Engl J Med. 2001 Mar 8;344(10):699-709.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11236773/',
          publishedAt: '2001-03-08',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2001-11-21',
        datePrecision: 'DAY',
        reason: 'The FDA approved Xigris to reduce mortality in adults with severe sepsis at high risk of death, the first drug ever approved for sepsis. The approval — granted by a narrow advisory-committee margin and based on a single pivotal trial — institutionally settled activated protein C as a treatment and made it the standard of care in many ICUs despite ongoing debate over its bleeding risk and the strength of the evidence.',
        source: {
          externalId: 'src:fda-xigris-drotrecogin-withdrawal-communication-2011',
          name: 'FDA. Drug Safety Communication: Voluntary market withdrawal of Xigris [drotrecogin alfa (activated)] due to failure to show a survival benefit (documenting the Nov 2001 approval and Oct 2011 withdrawal). 25 October 2011.',
          url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-voluntary-market-withdrawal-xigris-drotrecogin-alfa-activated-due',
          publishedAt: '2011-10-25',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2011-10-25',
        datePrecision: 'DAY',
        reason: 'After the FDA-required confirmatory PROWESS-SHOCK trial showed no statistically significant reduction in 28-day mortality in septic shock, Eli Lilly withdrew Xigris from all markets worldwide. The withdrawal reversed the decade-old claim that activated protein C improves sepsis survival and became a landmark post-market surveillance case of an early-stopped single-trial approval overturned by a rigorous confirmatory study.',
        source: {
          externalId: 'src:lilly-xigris-worldwide-withdrawal-2011',
          name: 'Eli Lilly and Company. Lilly Announces Withdrawal of Xigris Following Recent Clinical Trial Results (PROWESS-SHOCK). 25 October 2011.',
          url: 'https://investor.lilly.com/news-releases/news-release-details/lilly-announces-withdrawal-xigrisr-following-recent-clinical',
          publishedAt: '2011-10-25',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Nitisinone / Orfadin — first tyrosinemia treatment 2002 ─────────────────
  {
    externalId: 'trajectory:nitisinone-orfadin-first-tyrosinemia-treatment-2002',
    text: 'On 18 January 2002 the U.S. FDA approved nitisinone (Orfadin, Swedish Orphan/NDA 021232), an inhibitor of 4-hydroxyphenylpyruvate dioxygenase repurposed from a herbicide compound, as the first drug treatment for hereditary tyrosinemia type 1 — a previously fatal pediatric metabolic disease managed only by diet or liver transplantation.',
    claimType: 'HYBRID',
    claimEmergedAt: '1992-10-03',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1992-10-03',
        datePrecision: 'DAY',
        reason: 'Lindstedt and colleagues reported in The Lancet that NTBC (nitisinone), an inhibitor of 4-hydroxyphenylpyruvate dioxygenase, reduced toxic tyrosine-pathway metabolites and produced clinical improvement in five children with hereditary tyrosinemia type 1. This recorded the first evidence that pharmacologic blockade upstream of the deficient enzyme could halt the disease, offering an alternative to liver transplantation.',
        source: {
          externalId: 'src:lindstedt-ntbc-tyrosinemia-lancet-1992',
          name: 'Lindstedt S, Holme E, Lock EA, Hjalmarson O, Strandvik B. Treatment of hereditary tyrosinaemia type I by inhibition of 4-hydroxyphenylpyruvate dioxygenase. Lancet. 1992 Oct 3;340(8823):813-817.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/1383656/',
          publishedAt: '1992-10-03',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2002-01-18',
        datePrecision: 'DAY',
        reason: 'On the basis of a study of more than 180 patients showing roughly 88% four-year survival in early-treated infants versus ~29% historically with diet alone, the FDA approved Orfadin as the first drug for hereditary tyrosinemia type 1. The approval settled nitisinone plus dietary restriction as the standard of care, transforming a once-fatal disease into a manageable condition and exemplifying mechanism-based orphan-drug repurposing.',
        source: {
          externalId: 'src:fda-orfadin-nitisinone-label-2002',
          name: 'FDA. Orfadin (nitisinone) capsules prescribing information / original label, NDA 021232 (approved 18 January 2002).',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2002/21232lbl.pdf',
          publishedAt: '2002-01-18',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SURGICAL PROCEDURES ERA
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Morton ether anesthesia — 1846 ──────────────────────────────────────────
  {
    externalId: 'trajectory:morton-ether-surgical-anesthesia-1846',
    text: 'Inhaled diethyl ether renders patients insensible to pain during surgical operations, as publicly demonstrated by William T. G. Morton at the Massachusetts General Hospital on 16 October 1846 and first reported in the medical literature by Henry J. Bigelow.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1846-10-16',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1846-11-18',
        datePrecision: 'DAY',
        reason: 'After Morton\'s 16 October 1846 demonstration in which surgeon John Collins Warren removed a neck tumor from a patient rendered insensible by ether, Henry J. Bigelow published the first medical account, \'Insensibility during Surgical Operations Produced by Inhalation,\' in the Boston Medical and Surgical Journal. The paper recorded into the formal literature the claim that inhaled ether abolishes surgical pain, the founding document of surgical anesthesia.',
        source: {
          externalId: 'src:bigelow-insensibility-inhalation-1846',
          name: 'Bigelow HJ. Insensibility during Surgical Operations Produced by Inhalation. Boston Medical and Surgical Journal. 1846;35(16):309-317.',
          url: 'https://archive.org/details/39002011124139.med.yale.edu',
          publishedAt: '1846-11-18',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1847-01-01',
        datePrecision: 'YEAR',
        reason: 'Within weeks of Bigelow\'s report the demonstration was reproduced internationally—Robert Liston operated under ether in London on 21 December 1846—and inhalational anesthesia was rapidly adopted as standard surgical practice across Europe and North America during 1847. Surgical anesthesia became a permanent, uncontested fixture of operative medicine, the most consequential American medical contribution of the nineteenth century.',
        source: {
          externalId: 'src:bigelow-insensibility-pmc-reprint-2023',
          name: 'Bigelow HJ. Insensibility during Surgical Operations Produced by Inhalation (historical reprint and commentary). PMC. 2023.',
          url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10424980/',
          publishedAt: '2023-08-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CARDIOVASCULAR — STATINS, HYPERTENSION & ANTICOAGULATION ERA
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 4S simvastatin — first statin survival benefit 1994 ─────────────────────
  {
    externalId: 'trajectory:4s-simvastatin-survival-chd-1994',
    text: 'On 19 November 1994 the Scandinavian Simvastatin Survival Study (4S) reported that simvastatin reduced all-cause mortality by 30% in 4,444 patients with coronary heart disease and elevated cholesterol, the first randomized trial to show that a statin saves lives.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1994-11-19',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1994-11-19',
        datePrecision: 'DAY',
        reason: 'The 4S investigators reported in The Lancet that, over a median 5.4 years, simvastatin cut the relative risk of death to 0.70 (87.6% vs 91.3% survival), reduced major coronary events by 34%, and lowered revascularization by 37% in CHD patients. Earlier cholesterol trials (LRC-CPPT, clofibrate) had shown event reductions but never a survival benefit; 4S was the first to demonstrate that lipid lowering with a statin reduces total mortality, putting statin survival benefit on the experimental record.',
        source: {
          externalId: 'src:4s-simvastatin-lancet-1994',
          name: 'Scandinavian Simvastatin Survival Study Group. Randomised trial of cholesterol lowering in 4444 patients with coronary heart disease: the Scandinavian Simvastatin Survival Study (4S). Lancet. 1994;344(8934):1383-1389.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/7968073/',
          publishedAt: '1994-11-19',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2001-05-16',
        datePrecision: 'DAY',
        reason: 'The NCEP Adult Treatment Panel III guideline, drawing on 4S and subsequent statin outcome trials, made LDL-lowering with statins the centerpiece of coronary risk management and codified aggressive LDL targets for patients with established CHD. By embedding statin therapy in national guidelines, the institutional community settled simvastatin\'s survival benefit as standard secondary-prevention practice.',
        source: {
          externalId: 'src:ncep-atp-iii-jama-2001',
          name: 'Expert Panel on Detection, Evaluation, and Treatment of High Blood Cholesterol in Adults. Executive Summary of the Third Report of the NCEP Expert Panel (Adult Treatment Panel III). JAMA. 2001;285(19):2486-2497.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11368702/',
          publishedAt: '2001-05-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── WOSCOPS pravastatin — first statin primary prevention 1995 ──────────────
  {
    externalId: 'trajectory:woscops-pravastatin-primary-prevention-1995',
    text: 'On 16 November 1995 the West of Scotland Coronary Prevention Study (WOSCOPS) reported that pravastatin reduced coronary events by 31% in 6,595 hypercholesterolemic men with no prior myocardial infarction, the first statin trial to prove benefit in primary prevention.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1995-11-16',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1995-11-16',
        datePrecision: 'DAY',
        reason: 'WOSCOPS, reported in the New England Journal of Medicine, randomized 6,595 men aged 45–64 with high cholesterol but no history of myocardial infarction to pravastatin or placebo and found a 31% reduction in nonfatal MI or coronary death over 4.9 years, with a 22% reduction in all-cause mortality. Where 4S had proven benefit in patients with existing disease, WOSCOPS extended the statin claim to apparently healthy high-cholesterol men, establishing statins for primary prevention in the literature.',
        source: {
          externalId: 'src:woscops-pravastatin-nejm-1995',
          name: 'Shepherd J, Cobbe SM, Ford I, et al. Prevention of coronary heart disease with pravastatin in men with hypercholesterolemia. West of Scotland Coronary Prevention Study Group. N Engl J Med. 1995;333(20):1301-1307.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/7566020/',
          publishedAt: '1995-11-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2001-05-16',
        datePrecision: 'DAY',
        reason: 'The NCEP ATP III guideline incorporated primary-prevention statin trials such as WOSCOPS and AFCAPS/TexCAPS into a global-risk framework that recommended statin therapy for higher-risk individuals without established CHD. This institutionalized statins for primary prevention, settling the WOSCOPS claim into routine preventive cardiology.',
        source: {
          externalId: 'src:ncep-atp-iii-jama-2001',
          name: 'Expert Panel on Detection, Evaluation, and Treatment of High Blood Cholesterol in Adults. Executive Summary of the Third Report of the NCEP Expert Panel (Adult Treatment Panel III). JAMA. 2001;285(19):2486-2497.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11368702/',
          publishedAt: '2001-05-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── SHEP — isolated systolic hypertension in elderly treatable 1991 ──────────
  {
    externalId: 'trajectory:shep-isolated-systolic-hypertension-elderly-1991',
    text: 'On 26 June 1991 the Systolic Hypertension in the Elderly Program (SHEP) reported that treating isolated systolic hypertension in adults aged 60 and older with low-dose chlorthalidone reduced stroke by 36%, establishing that isolated systolic hypertension is a treatable condition.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1991-06-26',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1991-06-26',
        datePrecision: 'DAY',
        reason: 'SHEP, a randomized double-blind placebo-controlled trial of 4,736 participants aged 60+ with systolic BP 160–219 mmHg and diastolic <90 mmHg, reported in JAMA that stepped-care treatment beginning with low-dose chlorthalidone cut total stroke by 36% over ~4.5 years. Isolated systolic hypertension in the elderly had previously been regarded by many clinicians as a benign or untreatable consequence of aging; SHEP put on record that treating it prevents stroke.',
        source: {
          externalId: 'src:shep-isolated-systolic-jama-1991',
          name: 'SHEP Cooperative Research Group. Prevention of stroke by antihypertensive drug treatment in older persons with isolated systolic hypertension. Final results of the Systolic Hypertension in the Elderly Program (SHEP). JAMA. 1991;265(24):3255-3264.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2046107/',
          publishedAt: '1991-06-26',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── AFASAK warfarin — anticoagulation for stroke prevention in AF 1989 ───────
  {
    externalId: 'trajectory:afasak-warfarin-atrial-fibrillation-stroke-1989',
    text: 'On 28 January 1989 the Copenhagen AFASAK study reported that warfarin anticoagulation prevented thromboembolic stroke in chronic non-rheumatic atrial fibrillation, the first randomized trial to establish anticoagulation for stroke prevention in atrial fibrillation.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1989-01-28',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1989-01-28',
        datePrecision: 'DAY',
        reason: 'AFASAK randomized 1,007 patients with chronic atrial fibrillation to warfarin, aspirin, or placebo and found 5 thromboembolic events on warfarin versus 20 on aspirin and 21 on placebo, reported in The Lancet by Petersen and colleagues. It was the first placebo-controlled randomized trial to demonstrate that anticoagulation prevents stroke in non-rheumatic atrial fibrillation, opening the field of AF anticoagulation later confirmed by SPAF, BAATAF, and pooled analyses.',
        source: {
          externalId: 'src:afasak-warfarin-lancet-1989',
          name: 'Petersen P, Boysen G, Godtfredsen J, Andersen ED, Andersen B. Placebo-controlled, randomised trial of warfarin and aspirin for prevention of thromboembolic complications in chronic atrial fibrillation. The Copenhagen AFASAK study. Lancet. 1989;1(8631):175-179.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2563096/',
          publishedAt: '1989-01-28',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Coronary Drug Project high-dose estrogen — reversed in men 1970 ──────────
  {
    externalId: 'trajectory:coronary-drug-project-high-dose-estrogen-discontinued-1970',
    text: 'On 16 November 1970 the Coronary Drug Project reported that high-dose conjugated estrogen (5.0 mg/day) given to men after myocardial infarction increased cardiovascular harm rather than protecting them, leading the trial to discontinue its high-dose estrogen and high-dose dextrothyroxine arms.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1970-11-16',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1970-11-16',
        datePrecision: 'DAY',
        reason: 'The Coronary Drug Project, a large randomized secondary-prevention trial in men with prior myocardial infarction, had included a high-dose conjugated-estrogen arm on the hypothesis that estrogen\'s apparent cardioprotection in women might benefit men. The 16 November 1970 JAMA report announced that the 5.0 mg/day estrogen group showed excess non-fatal reinfarction, thromboembolism, and a trend to higher mortality, and that this arm—together with high-dose dextrothyroxine—was being discontinued. The trial reversed the estrogen-cardioprotection hypothesis in men through pre-specified randomized surveillance, an early demonstration of a trial stopping a harmful arm.',
        source: {
          externalId: 'src:coronary-drug-project-initial-findings-jama-1970',
          name: 'The Coronary Drug Project Research Group. The Coronary Drug Project. Initial findings leading to modifications of its research protocol. JAMA. 1970;214(7):1303-1313.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/4320008/',
          publishedAt: '1970-11-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── WHO Surgical Safety Checklist — 2009 ────────────────────────────────────
  {
    externalId: 'trajectory:who-surgical-safety-checklist-2009',
    text: 'Use of the WHO 19-item Surgical Safety Checklist before, during, and after operations reduces postoperative death and complications, as shown by Haynes and colleagues in an eight-hospital global study published in the New England Journal of Medicine on 14 January 2009.',
    claimType: 'HYBRID',
    claimEmergedAt: '2009-01-14',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2009-01-14',
        datePrecision: 'DAY',
        reason: 'Atul Gawande\'s Safe Surgery Saves Lives Study Group reported that introducing the WHO checklist across eight hospitals in eight countries cut the inpatient death rate from 1.5% to 0.8% and major complications from 11.0% to 7.0% among roughly 7,700 non-cardiac surgical patients. The NEJM paper recorded the first large-scale evidence that a simple structured checklist reduces surgical morbidity and mortality.',
        source: {
          externalId: 'src:haynes-who-checklist-nejm-2009',
          name: 'Haynes AB, Weiser TG, Berry WR, et al. A surgical safety checklist to reduce morbidity and mortality in a global population. N Engl J Med. 2009;360(5):491-499.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/19144931/',
          publishedAt: '2009-01-14',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2009-04-03',
        datePrecision: 'DAY',
        reason: 'The World Health Organization published \'WHO Guidelines for Safe Surgery: Safe Surgery Saves Lives\' on 3 April 2009, formalizing the checklist as a global safety standard under its Second Global Patient Safety Challenge. National health systems, including England\'s NHS, subsequently mandated the checklist, settling it as routine institutional practice in operating theatres worldwide.',
        source: {
          externalId: 'src:who-guidelines-safe-surgery-2009',
          name: 'World Health Organization. WHO Guidelines for Safe Surgery 2009: Safe Surgery Saves Lives. Geneva: WHO; 2009.',
          url: 'https://www.who.int/teams/integrated-health-services/patient-safety/research/safe-surgery',
          publishedAt: '2009-04-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // HIV/AIDS TREATMENT ERA (1990–2010)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── ACTG 076 — zidovudine cuts perinatal HIV transmission 1994 ─────────────
  {
    externalId: 'trajectory:actg076-zidovudine-perinatal-hiv-transmission-1994',
    text: 'The AIDS Clinical Trials Group Protocol 076, whose interim results were announced in February 1994 and published in full by Connor and colleagues in the New England Journal of Medicine on 3 November 1994, established that giving zidovudine to HIV-infected pregnant women and their newborns reduces the risk of mother-to-child HIV transmission by approximately two-thirds (67.5%).',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1994-02',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1994-02',
        datePrecision: 'MONTH',
        reason: 'An interim analysis of the placebo-controlled ACTG 076 trial showed so large a reduction in perinatal HIV transmission that the Data and Safety Monitoring Board halted the study early in February 1994. The finding — a 67.5% relative reduction (25.5% transmission on placebo vs 8.3% on zidovudine) — was published in full by Connor et al. in the NEJM later that year, recording in the expert literature the first proven pharmacologic means of preventing mother-to-child HIV transmission.',
        source: {
          externalId: 'src:connor-actg076-nejm-1994',
          name: 'Connor EM, Sperling RS, Gelber R, et al. Reduction of maternal-infant transmission of human immunodeficiency virus type 1 with zidovudine treatment. N Engl J Med. 1994;331(18):1173-1180.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/7935654/',
          publishedAt: '1994-11-03',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1994-08-05',
        datePrecision: 'DAY',
        reason: 'On 5 August 1994 the U.S. Public Health Service Task Force issued formal recommendations adopting the full ACTG 076 zidovudine regimen (antepartum oral, intrapartum intravenous, and six weeks of neonatal dosing) as the standard of care to reduce perinatal HIV transmission. Institutional codification within months of the trial converted the empirical finding into mandated clinical practice across the United States.',
        source: {
          externalId: 'src:phs-zidovudine-perinatal-mmwr-rr11-1994',
          name: 'CDC. Recommendations of the U.S. Public Health Service Task Force on the Use of Zidovudine to Reduce Perinatal Transmission of Human Immunodeficiency Virus. MMWR Recomm Rep. 1994;43(RR-11):1-20.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/00032271.htm',
          publishedAt: '1994-08-05',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Concorde — early zidovudine monotherapy for asymptomatic HIV reversed 1994 ─
  {
    externalId: 'trajectory:concorde-zidovudine-asymptomatic-hiv-reversal-1994',
    text: 'The claim that early zidovudine monotherapy benefits people with asymptomatic HIV infection — established by ACTG 019 (Volberding et al., NEJM, 5 April 1990) and used to expand zidovudine\'s label to asymptomatic patients — was reversed when the Concorde trial, reported in The Lancet on 9 April 1994, found that immediate zidovudine gave no survival or clinical-progression benefit over deferred treatment.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1990-04-05',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1990-04-05',
        datePrecision: 'DAY',
        reason: 'Volberding et al. reported the ACTG 019 placebo-controlled trial in the NEJM, concluding that zidovudine was \'safe and effective\' in asymptomatic HIV-infected persons with fewer than 500 CD4 cells, significantly delaying progression to AIDS. The result, which underpinned the FDA\'s expansion of zidovudine to asymptomatic infection, settled early antiretroviral monotherapy as the standard of care for early HIV.',
        source: {
          externalId: 'src:volberding-actg019-nejm-1990',
          name: 'Volberding PA, Lagakos SW, Koch MA, et al. Zidovudine in asymptomatic human immunodeficiency virus infection. A controlled trial in persons with fewer than 500 CD4-positive cells per cubic millimeter. N Engl J Med. 1990;322(14):941-949.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/1969115/',
          publishedAt: '1990-04-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1994-04-09',
        datePrecision: 'DAY',
        reason: 'The Concorde trial, a 1,749-patient double-blind MRC/ANRS study with a median 3.3 years of follow-up, found no significant difference in survival or disease progression between immediate and deferred zidovudine in symptom-free HIV infection, despite an early transient rise in CD4 counts. The result overturned the rationale for early monotherapy, discrediting CD4 surrogate-endpoint reasoning and reshaping HIV treatment strategy until combination therapy emerged.',
        source: {
          externalId: 'src:concorde-lancet-1994',
          name: 'Concorde Coordinating Committee. Concorde: MRC/ANRS randomised double-blind controlled trial of immediate and deferred zidovudine in symptom-free HIV infection. Lancet. 1994;343(8902):871-881.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/7908356/',
          publishedAt: '1994-04-09',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // EMERGING INFECTIOUS DISEASE ERA (2000–2010)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── US measles elimination declared — CDC expert panel March 2000 ──────────
  {
    externalId: 'trajectory:us-measles-elimination-declared-2000',
    text: 'Endemic measles transmission was declared eliminated in the United States following a March 16–17, 2000 expert panel convened by the CDC, which concluded that sustained two-dose MMR vaccination coverage had interrupted year-round indigenous measles circulation — the first elimination of an endemic vaccine-preventable disease in a large industrialized nation.',
    claimType: 'HYBRID',
    claimEmergedAt: '2000-03',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2000-03',
        datePrecision: 'MONTH',
        reason: 'A CDC-convened expert panel reviewing surveillance and molecular-epidemiology data concluded at its 16–17 March 2000 meeting that measles was no longer endemic in the United States — defined as the absence of continuous year-round transmission for 12 months under adequate surveillance — with virtually all remaining cases traceable to importation. The summary published by Katz and Hinman documents this institutional determination, settling measles elimination as official U.S. public-health status and validating the two-dose vaccination strategy adopted after the 1989–1991 resurgence.',
        source: {
          externalId: 'src:katz-hinman-measles-elimination-jid-2004',
          name: 'Katz SL, Hinman AR. Summary and conclusions: measles elimination meeting, 16-17 March 2000. J Infect Dis. 2004;189(Suppl 1):S43-S47.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15106088/',
          publishedAt: '2004-05-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── SARS-CoV identified as cause of SARS — Drosten/Fouchier 2003 ───────────
  {
    externalId: 'trajectory:sars-novel-coronavirus-identification-2003',
    text: 'A previously unknown coronavirus (SARS-CoV) was identified as the cause of severe acute respiratory syndrome — first reported by Drosten and colleagues in the New England Journal of Medicine (online 10 April 2003) and confirmed as the etiologic agent by Fouchier and colleagues fulfilling Koch\'s postulates in Nature on 15 May 2003.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2003-04-10',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2003-04-10',
        datePrecision: 'DAY',
        reason: 'Drosten et al. reported the isolation, cell-culture growth, and partial sequencing of a novel coronavirus from SARS patients, distinct from all previously known human and animal coronaviruses, and developed a PCR assay detecting it in respiratory specimens. Published as part of WHO\'s collaborative laboratory network response to the unfolding outbreak, this recorded in the expert literature the candidate causative agent of an emerging epidemic disease within weeks of the global alert.',
        source: {
          externalId: 'src:drosten-sars-coronavirus-nejm-2003',
          name: 'Drosten C, Günther S, Preiser W, et al. Identification of a novel coronavirus in patients with severe acute respiratory syndrome. N Engl J Med. 2003;348(20):1967-1976.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12690091/',
          publishedAt: '2003-04-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2003-05-15',
        datePrecision: 'DAY',
        reason: 'Fouchier et al. experimentally infected cynomolgus macaques with the new coronavirus, reproducing SARS pathology and thereby fulfilling Koch\'s postulates — establishing the virus not merely as an association but as the proven etiologic agent. Coupled with WHO\'s mid-April announcement naming the coronavirus as the cause of SARS, this settled the etiology of the first novel epidemic of the 21st century and reshaped global pandemic-preparedness science.',
        source: {
          externalId: 'src:fouchier-sars-kochs-postulates-nature-2003',
          name: 'Fouchier RAM, Kuiken T, Schutten M, et al. Aetiology: Koch\'s postulates fulfilled for SARS virus. Nature. 2003;423(6937):240.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12748632/',
          publishedAt: '2003-05-15',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── WHO H1N1 pandemic phase-6 declaration — 11 June 2009 ───────────────────
  {
    externalId: 'trajectory:who-2009-h1n1-pandemic-declaration',
    text: 'On 11 June 2009 WHO Director-General Margaret Chan raised the influenza pandemic alert from phase 5 to phase 6, formally declaring the 2009 influenza A(H1N1) virus a global pandemic — the first pandemic so declared under the modern WHO alert framework and the first influenza pandemic since 1968.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2009-06-11',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2009-06-11',
        datePrecision: 'DAY',
        reason: 'Following the fourth meeting of the Emergency Committee convened under the International Health Regulations, the WHO Director-General concluded that the scientific criteria for an influenza pandemic had been met — sustained community-level transmission of a novel A(H1N1) virus in multiple WHO regions — and raised the alert to phase 6. The declaration triggered national pandemic response plans, vaccine procurement, and antiviral stockpiling worldwide, settling the institutional recognition that a pandemic was underway.',
        source: {
          externalId: 'src:who-h1n1-phase6-statement-2009',
          name: 'WHO. Statement to the press by WHO Director-General Dr Margaret Chan following the fourth meeting of the Emergency Committee (raising pandemic alert to phase 6). 11 June 2009.',
          url: 'https://www.who.int/news/item/11-06-2009-director-general-statement-following-the-fourth-meeting-of-the-emergency-committee',
          publishedAt: '2009-06-11',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PSYCHIATRY & NEUROLOGY ERA (2017–2019)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Cipriani 21-antidepressants network meta-analysis — Lancet 2018 ─────────
  {
    externalId: 'trajectory:cipriani-21-antidepressants-network-meta-analysis-2018',
    text: 'On 21 February 2018, Andrea Cipriani and colleagues published in The Lancet a network meta-analysis of 522 randomized trials (116,477 patients) concluding that all 21 antidepressants studied were more efficacious than placebo for the acute treatment of major depressive disorder in adults.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2018-02-21',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-02-21',
        datePrecision: 'DAY',
        reason: 'Cipriani and colleagues published online in The Lancet the largest-ever network meta-analysis of antidepressants, pooling 522 double-blind trials. Its headline finding — that all 21 drugs beat placebo, with effect sizes ranging modestly — directly answered the long-running \'antidepressants are no better than placebo\' debate sparked by Kirsch\'s 2008 meta-analysis. The paper entered the literature as the new reference evidence base.',
        source: {
          externalId: 'src:cipriani-lancet-antidepressants-2018',
          name: 'Cipriani A, Furukawa TA, Salanti G, et al. Comparative efficacy and acceptability of 21 antidepressant drugs for the acute treatment of adults with major depressive disorder: a systematic review and network meta-analysis. Lancet. 2018;391(10128):1357-1366.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/29477251/',
          publishedAt: '2018-02-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-04-07',
        datePrecision: 'DAY',
        reason: 'On print publication in the 7 April 2018 issue, the analysis was rapidly adopted as the authoritative comparative-efficacy reference and cited across major depression guidelines and editorials. Despite methodological critiques, the core conclusion that antidepressants outperform placebo became the settled mainstream position, displacing the earlier placebo-equivalence controversy.',
        source: {
          externalId: 'src:cipriani-lancet-antidepressants-print-2018',
          name: 'Cipriani A, et al. Comparative efficacy and acceptability of 21 antidepressant drugs for major depressive disorder. Lancet. 2018;391(10128):1357-1366 (print issue, 7 April 2018).',
          url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(17)32802-7/fulltext',
          publishedAt: '2018-04-07',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Valbenazine (Ingrezza) — first tardive dyskinesia drug, FDA 2017 ─────────
  {
    externalId: 'trajectory:valbenazine-ingrezza-first-tardive-dyskinesia-drug-2017',
    text: 'On 11 April 2017, the U.S. FDA approved Neurocrine Biosciences\' valbenazine (Ingrezza), the first drug ever approved to treat tardive dyskinesia, the involuntary movement disorder caused by long-term antipsychotic use.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2017-04-11',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-03-21',
        datePrecision: 'MONTH',
        reason: 'The pivotal KINECT 3 phase 3 trial, published in the American Journal of Psychiatry, randomized 225 patients with moderate-to-severe tardive dyskinesia and showed that once-daily valbenazine 80 mg significantly reduced abnormal involuntary movements versus placebo over six weeks. This provided the first rigorous randomized evidence that a VMAT2 inhibitor could treat a condition long considered largely irreversible.',
        source: {
          externalId: 'src:hauser-kinect3-valbenazine-2017',
          name: 'Hauser RA, Factor SA, Marder SR, et al. KINECT 3: A Phase 3 Randomized, Double-Blind, Placebo-Controlled Trial of Valbenazine for Tardive Dyskinesia. Am J Psychiatry. 2017;174(5):476-484.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/28320223/',
          publishedAt: '2017-03-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2017-04-11',
        datePrecision: 'DAY',
        reason: 'The FDA approved valbenazine (Ingrezza) as the first treatment for tardive dyskinesia, having granted it breakthrough therapy, fast track, and priority review designations. The approval institutionally established that tardive dyskinesia — previously managed only by reducing or switching the offending antipsychotic — had a dedicated, evidence-backed pharmacological treatment.',
        source: {
          externalId: 'src:neurocrine-ingrezza-fda-approval-2017',
          name: 'Neurocrine Biosciences. FDA Approval of INGREZZA (valbenazine) Capsules as the First and Only Approved Treatment for Adults with Tardive Dyskinesia. 11 April 2017.',
          url: 'https://www.prnewswire.com/news-releases/neurocrine-announces-fda-approval-of-ingrezza-valbenazine-capsules-as-the-first-and-only-approved-treatment-for-adults-with-tardive-dyskinesia-td-with-multimedia-300438365.html',
          publishedAt: '2017-04-11',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Ocrelizumab (Ocrevus) — first primary progressive MS drug, FDA 2017 ─────
  {
    externalId: 'trajectory:ocrelizumab-ocrevus-first-primary-progressive-ms-drug-2017',
    text: 'On 28 March 2017, the U.S. FDA approved ocrelizumab (Ocrevus), the first therapy ever shown to slow disability progression in primary progressive multiple sclerosis, a form of MS for which no disease-modifying treatment had previously existed.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2017-03-28',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2016-12-21',
        datePrecision: 'DAY',
        reason: 'The ORATORIO phase 3 trial, published in the New England Journal of Medicine, randomized 732 primary progressive MS patients and found that the anti-CD20 antibody ocrelizumab significantly reduced the proportion with confirmed disability progression versus placebo. This was the first positive pivotal trial in a disease subtype that had defeated every prior disease-modifying candidate.',
        source: {
          externalId: 'src:montalban-oratorio-ocrelizumab-2017',
          name: 'Montalban X, Hauser SL, Kappos L, et al. Ocrelizumab versus Placebo in Primary Progressive Multiple Sclerosis. N Engl J Med. 2017;376(3):209-220.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/28002688/',
          publishedAt: '2016-12-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2017-03-28',
        datePrecision: 'DAY',
        reason: 'The FDA approved ocrelizumab for both relapsing and primary progressive MS, making it the first product ever approved for the primary progressive form. The approval institutionally settled that primary progressive MS — long regarded as untreatable — had a disease-modifying therapy, validating B-cell depletion as a mechanism across the MS spectrum.',
        source: {
          externalId: 'src:genentech-ocrevus-fda-approval-2017',
          name: 'Genentech. FDA Approves Genentech\'s OCREVUS (ocrelizumab) for Relapsing and Primary Progressive Multiple Sclerosis. 28 March 2017.',
          url: 'https://www.gene.com/media/press-releases/14657/2017-03-28/fda-approves-genentechs-ocrevus-ocrelizu',
          publishedAt: '2017-03-28',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── EMA valproate pregnancy contraindication — 2018 ─────────────────────────
  {
    externalId: 'trajectory:ema-valproate-pregnancy-contraindication-2018',
    text: 'On 21 March 2018, EU regulators (the CMDh, endorsing the PRAC recommendation) contraindicated valproate during pregnancy and barred its use in women of childbearing potential unless the conditions of a strict pregnancy prevention programme are met, owing to risks of congenital malformations and neurodevelopmental disorders in exposed children.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2018-03-21',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2014-11-21',
        datePrecision: 'MONTH',
        reason: 'Following its first EU-wide review, the EMA strengthened warnings in 2014 and restricted valproate in girls and women of childbearing potential, requiring use only when other treatments were ineffective or not tolerated. This formally recorded the teratogenic and neurodevelopmental risk but stopped short of a contraindication, leaving prescribing largely to clinician discretion.',
        source: {
          externalId: 'src:ema-valproate-referral-2014',
          name: 'European Medicines Agency. Valproate and related substances — referral (2014 risk-minimisation measures and 2018 update).',
          url: 'https://www.ema.europa.eu/en/medicines/human/referrals/valproate-related-substances-0',
          publishedAt: '2014-11-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2018-03-21',
        datePrecision: 'DAY',
        reason: 'A second PRAC review found that, despite the 2014 measures, many women remained inadequately informed and in-utero exposure persisted. The CMDh endorsed the PRAC recommendation to contraindicate valproate in pregnancy and mandate a pregnancy prevention programme, reversing the prior permissive labeling and settling valproate\'s status as a teratogen requiring active exposure controls.',
        source: {
          externalId: 'src:ema-valproate-new-measures-2018',
          name: 'European Medicines Agency. New measures to avoid valproate exposure in pregnancy endorsed (CMDh/PRAC). 21 March 2018.',
          url: 'https://www.ema.europa.eu/en/news/new-measures-avoid-valproate-exposure-pregnancy-endorsed',
          publishedAt: '2018-03-21',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── RCPsych antidepressant withdrawal recognition — 2019 ────────────────────
  {
    externalId: 'trajectory:rcpsych-antidepressant-withdrawal-recognition-2019',
    text: 'On 30 May 2019, the UK Royal College of Psychiatrists issued position statement PS04/19 acknowledging that antidepressant withdrawal symptoms can be severe and long-lasting in some patients, contradicting prior NICE guidance that such symptoms are usually mild and resolve within about a week.',
    claimType: 'HYBRID',
    claimEmergedAt: '2019-05-30',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-09-04',
        datePrecision: 'MONTH',
        reason: 'Davies and Read published a systematic review of 24 studies finding that antidepressant withdrawal affected on average 56% of patients, that nearly half of cases were rated severe, and that most duration studies contradicted the guideline assertion of a one-to-two-week course. The review directly challenged the evidence base of existing UK and US guidelines.',
        source: {
          externalId: 'src:davies-read-antidepressant-withdrawal-2019',
          name: 'Davies J, Read J. A systematic review into the incidence, severity and duration of antidepressant withdrawal effects: Are guidelines evidence-based? Addict Behav. 2019;97:111-121.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/30292574/',
          publishedAt: '2018-09-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2019-05-30',
        datePrecision: 'DAY',
        reason: 'The Royal College of Psychiatrists issued position statement PS04/19, accepting that it had under-recognised severe, prolonged withdrawal and calling for NICE to update its guidance and for slower, treatment-duration-proportionate tapering. This reversed the College\'s earlier stance and shifted the institutional consensus, subsequently reflected in NICE\'s 2022 depression guideline.',
        source: {
          externalId: 'src:rcpsych-ps04-19-antidepressant-withdrawal-2019',
          name: 'Royal College of Psychiatrists. Position statement PS04/19: Antidepressants and depression. 30 May 2019.',
          url: 'https://www.rcpsych.ac.uk/improving-care/campaigning-for-better-mental-health-policy/position-statements/position-statements-2019',
          publishedAt: '2019-05-30',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ENDOCRINE / NUTRITION ERA (1891–1949)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Marine & Kimball — iodine prevents goiter — 1920 ───────────────────────
  {
    externalId: 'trajectory:marine-kimball-iodine-goiter-1920',
    text: 'David Marine and Oliver Kimball reported, from a controlled trial in Akron, Ohio schoolgirls completed by 1920, that iodine supplementation prevents simple (endemic) goiter, establishing iodine prophylaxis as an effective public-health intervention.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1917-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1917-01-01',
        datePrecision: 'YEAR',
        reason: 'Marine and Kimball published their plan and baseline survey of thyroid enlargement among Akron schoolgirls and proposed a controlled trial of sodium iodide prophylaxis. This recorded the testable claim that iodine deficiency causes simple goiter and that supplementation would prevent it.',
        source: {
          externalId: 'src:marine-kimball-goiter-plan-1917',
          name: 'Marine D, Kimball OP. The prevention of simple goiter in man (first paper): survey of schoolgirls of Akron, Ohio, and the plan of prevention. Journal of Laboratory and Clinical Medicine. 1917;3:40–48.',
          url: 'https://www.jameslindlibrary.org/marine-d-kimball-op-1920/',
          publishedAt: '1917-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1920-01-01',
        datePrecision: 'YEAR',
        reason: 'The completed controlled trial of ~4,500 Akron schoolgirls, published in Archives of Internal Medicine in 1920, showed that iodine-supplemented girls developed far less goiter than untreated controls, demonstrating safe and effective prophylaxis. The result was rapidly accepted and led to the introduction of iodized salt in Michigan in 1924 and nationwide thereafter, settling iodine prophylaxis as standard practice.',
        source: {
          externalId: 'src:marine-kimball-goiter-archintmed-1920',
          name: 'Marine D, Kimball OP. Prevention of simple goiter in man (fourth paper). Archives of Internal Medicine. 1920;25(6):661–672. doi:10.1001/archinte.1920.00090350088005.',
          url: 'https://www.jameslindlibrary.org/marine-d-kimball-op-1920/',
          publishedAt: '1920-06-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // OPIOID POLICY & PALLIATIVE CARE ERA (1970–2007)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Naloxone (Narcan) — opioid antagonist approval — 1971 ───────────────────
  {
    externalId: 'trajectory:naloxone-narcan-opioid-antagonist-approval-1971',
    text: 'The FDA approved naloxone (Narcan injection, NDA 016636) in 1971 as a pure opioid antagonist for the complete or partial reversal of opioid-induced respiratory depression and the treatment of suspected opioid overdose — establishing the first specific opioid antidote without agonist activity of its own.',
    claimType: 'HYBRID',
    claimEmergedAt: '1971-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1971-01-01',
        datePrecision: 'YEAR',
        reason: 'Naloxone, synthesized in the early 1960s by Jack Fishman and Mozes Lewenstein, was approved by the FDA in 1971 (Narcan injection, NDA 016636) for intravenous, intramuscular, and subcutaneous use to reverse opioid depression and treat suspected opioid overdose. Unlike the earlier mixed agonist-antagonist nalorphine, naloxone is a pure antagonist with no opioid effect of its own, making it a clean and reliable antidote. FDA approval established naloxone as the standard pharmacologic reversal agent for opioid toxicity, the foundation for every later overdose-rescue formulation.',
        source: {
          externalId: 'src:naloxone-fda-1971-approval',
          name: 'Harm Reduction Therapeutics. Naloxone (history) — naloxone first approved by the FDA in 1971 for emergency treatment of known or suspected opioid overdose; corroborated by FDA review NDA 016636 (Narcan).',
          url: 'https://www.harmreductiontherapeutics.org/naloxone/',
          publishedAt: '1971-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Twycross — oral morphine for terminal cancer pain — 1977 ────────────────
  {
    externalId: 'trajectory:twycross-oral-morphine-terminal-cancer-1977',
    text: 'Robert Twycross reported in the journal Pain in 1977, from a controlled trial of 699 terminal-cancer patients, that oral morphine and oral diamorphine (heroin) have essentially identical analgesic actions and side effects once dose-adjusted (diamorphine being about 1.5 times more potent) — establishing regularly dosed oral morphine, not diamorphine or the Brompton cocktail, as the strong analgesic of choice for terminal cancer pain.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1977-04-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1977-04-01',
        datePrecision: 'MONTH',
        reason: 'Twycross published a controlled trial in which 699 terminal-cancer patients received regular oral diamorphine or morphine, with 146 crossing over after about two weeks at a 1.5:1 potency ratio. He found additional-medication needs, survival, pain control, and side effects closely similar between the two drugs, concluding that oral morphine could fully replace diamorphine. The paper entered the palliative-care literature as the evidence dissolving the long-standing British belief that diamorphine was uniquely effective for the dying, and it underpinned the hospice movement\'s shift to regular oral morphine.',
        source: {
          externalId: 'src:twycross-diamorphine-morphine-pain-1977',
          name: 'Twycross RG. Choice of strong analgesic in terminal cancer: diamorphine or morphine? Pain. 1977 Apr;3(2):93-104.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/69290/',
          publishedAt: '1977-04-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2007-10-17',
        datePrecision: 'DAY',
        reason: 'The Cochrane systematic review \'Oral morphine for cancer pain\' (Wiffen & McQuay, 2007) aggregated 54 studies and confirmed that oral morphine is an effective analgesic for cancer pain with a well-characterized, manageable side-effect profile, formalizing the expert-literature consensus. Combined with oral morphine\'s incorporation into the WHO analgesic ladder, the systematic-review evidence settled regularly dosed oral morphine as the reference strong opioid for cancer pain worldwide.',
        source: {
          externalId: 'src:wiffen-oral-morphine-cochrane-2007',
          name: 'Wiffen PJ, McQuay HJ. Oral morphine for cancer pain. Cochrane Database of Systematic Reviews. 2007;(4):CD003868.',
          url: 'https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD003868.pub2/full',
          publishedAt: '2007-10-17',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── WHO analgesic ladder — cancer pain — 1986 ───────────────────────────────
  {
    externalId: 'trajectory:who-analgesic-ladder-cancer-pain-1986',
    text: 'The World Health Organization published the three-step analgesic ladder in its 1986 monograph \'Cancer Pain Relief,\' establishing a stepwise protocol — non-opioids, then weak opioids, then strong opioids such as morphine — as the global standard method for cancer pain management.',
    claimType: 'HYBRID',
    claimEmergedAt: '1986-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1986-01-01',
        datePrecision: 'YEAR',
        reason: 'Following a 1982 WHO expert consultation, the WHO published \'Cancer Pain Relief\' in 1986, setting out the three-step analgesic ladder that matched analgesic potency to pain intensity and explicitly endorsed strong oral opioids for severe cancer pain. The small monograph, later translated into more than 20 languages, recorded a new global premise: that most cancer pain could be controlled with inexpensive, orally administered, stepwise pharmacotherapy.',
        source: {
          externalId: 'src:who-cancer-pain-relief-1986',
          name: 'World Health Organization. Cancer Pain Relief. Geneva: WHO; 1986 (three-step analgesic ladder), as documented in Anekar AA, Cascella M. WHO Analgesic Ladder. StatPearls.',
          url: 'https://www.ncbi.nlm.nih.gov/books/NBK554435/',
          publishedAt: '1986-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1996-01-01',
        datePrecision: 'YEAR',
        reason: 'Validation studies through the late 1980s and 1990s reported that the WHO ladder achieved adequate pain relief in roughly 70-90% of cancer patients, and WHO issued an expanded second edition in 1996; national cancer-pain guidelines worldwide adopted the ladder as their organizing framework. Institutional endorsement and reproduced effectiveness settled the ladder as the established standard of cancer pain care, even as its later extension to chronic non-cancer pain became contested.',
        source: {
          externalId: 'src:who-ladder-effectiveness-review-pmc4965221',
          name: 'Integrative review of the effectiveness of the WHO cancer pain relief guidelines (documenting 70-90% adequate relief and global adoption). PMC4965221.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4965221/',
          publishedAt: '1996-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // DRUG SAFETY & SCREENING ERA (1971–2004)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── DES transplacental carcinogenesis — Herbst 1971 ─────────────────────────
  {
    externalId: 'trajectory:des-clear-cell-adenocarcinoma-daughters-1971',
    text: 'Herbst, Ulfelder, and Poskanzer reported in the New England Journal of Medicine on 22 April 1971 that in-utero exposure to diethylstilbestrol (DES) taken by pregnant women caused clear-cell adenocarcinoma of the vagina in their adolescent and young-adult daughters — the first demonstrated instance of transplacental chemical carcinogenesis in humans.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1971-04-22',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1971-04-22',
        datePrecision: 'DAY',
        reason: 'Herbst and colleagues conducted a matched case-control study of eight young women aged 15–22 with clear-cell adenocarcinoma of the vagina at one Boston hospital and found that seven of the eight mothers had taken stilbestrol (DES) during the relevant pregnancy versus none of the matched controls. This established prenatal DES as a transplacental carcinogen, overturning the assumption that the placenta protected the fetus from a maternal drug\'s cancer risk.',
        source: {
          externalId: 'src:herbst-nejm-des-vaginal-adenocarcinoma-1971',
          name: 'Herbst AL, Ulfelder H, Poskanzer DC. Adenocarcinoma of the vagina: association of maternal stilbestrol therapy with tumor appearance in young women. N Engl J Med. 1971 Apr 22;284(15):878-881.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/5549830/',
          publishedAt: '1971-04-22',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1971-11-01',
        datePrecision: 'MONTH',
        reason: 'Within months of the Herbst report, the U.S. FDA issued a Drug Bulletin in November 1971 declaring diethylstilbestrol contraindicated in pregnancy. The regulator\'s adoption of the literature finding converted an emerging case-control signal into settled institutional policy and effectively ended obstetric use of DES in the United States.',
        source: {
          externalId: 'src:fda-drug-bulletin-des-contraindicated-pregnancy-1971',
          name: 'U.S. Food and Drug Administration. Diethylstilbestrol Contraindicated in Pregnancy. FDA Drug Bulletin, November 1971 (reprinted in PMC).',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1518220/',
          publishedAt: '1971-11-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Nurses' Health Study estrogen cardioprotection — Stampfer 1991 ──────────
  {
    externalId: 'trajectory:nurses-health-study-estrogen-cardioprotection-1991',
    text: 'Stampfer and colleagues reported in the New England Journal of Medicine on 12 September 1991, from ten-year follow-up of the Nurses\' Health Study cohort, that current postmenopausal estrogen use was associated with roughly a 44% reduction in coronary heart disease, establishing the observational claim that hormone therapy protects women\'s hearts.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1991-09-12',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1991-09-12',
        datePrecision: 'DAY',
        reason: 'The Nurses\' Health Study prospective cohort (48,470 postmenopausal women) reported a relative risk of 0.56 for major coronary disease and reduced cardiovascular mortality among current estrogen users. This was the most influential observational evidence for the cardioprotective hypothesis and shaped a generation of preventive prescribing.',
        source: {
          externalId: 'src:stampfer-nejm-nhs-estrogen-cvd-1991',
          name: 'Stampfer MJ, Colditz GA, Willett WC, Manson JE, Rosner B, Speizer FE, Hennekens CH. Postmenopausal estrogen therapy and cardiovascular disease: ten-year follow-up from the Nurses\' Health Study. N Engl J Med. 1991 Sep 12;325(11):756-762.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/1870648/',
          publishedAt: '1991-09-12',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1992-12-15',
        datePrecision: 'MONTH',
        reason: 'The American College of Physicians published clinical guidelines recommending that postmenopausal women consider preventive hormone therapy, citing the pooled observational coronary benefit. A major professional society endorsing HRT for chronic-disease prevention moved the cardioprotection claim from literature finding to settled standard of care.',
        source: {
          externalId: 'src:acp-guidelines-preventive-hormone-therapy-1992',
          name: 'American College of Physicians. Guidelines for counseling postmenopausal women about preventive hormone therapy. Ann Intern Med. 1992 Dec 15;117(12):1038-1041.',
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
        reason: 'The Women\'s Health Initiative randomized controlled trial found that combined estrogen-plus-progestin therapy increased rather than reduced coronary heart disease, stroke, and breast cancer, halting the trial early. The RCT directly contradicted the Nurses\' Health Study observational claim and is the canonical example of confounding-by-healthy-user bias overturning a cohort-based consensus.',
        source: {
          externalId: 'src:whi-jama-estrogen-progestin-2002',
          name: 'Writing Group for the Women\'s Health Initiative Investigators (Rossouw JE, et al). Risks and benefits of estrogen plus progestin in healthy postmenopausal women: principal results from the Women\'s Health Initiative randomized controlled trial. JAMA. 2002 Jul 17;288(3):321-333.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12117397/',
          publishedAt: '2002-07-17',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Fen-phen valvulopathy and withdrawal — 1996–1997 ────────────────────────
  {
    externalId: 'trajectory:fenfluramine-dexfenfluramine-valvulopathy-withdrawal-1997',
    text: 'Dexfenfluramine (Redux), approved by the U.S. FDA on 29 April 1996, and fenfluramine (Pondimin) were marketed as safe appetite suppressants until Connolly and colleagues reported fen-phen-associated valvular heart disease and the FDA requested both drugs\' withdrawal on 15 September 1997.',
    claimType: 'HYBRID',
    claimEmergedAt: '1996-04-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1996-04-29',
        datePrecision: 'DAY',
        reason: 'The FDA approved dexfenfluramine (Redux) — the first new anti-obesity drug in over two decades — as a safe and effective appetite suppressant, and it was widely co-prescribed with phentermine as \'fen-phen\', filling about 1.2 million prescriptions within five months. Regulatory approval and mass prescribing made the safety claim settled.',
        source: {
          externalId: 'src:upi-fda-approves-redux-1996',
          name: 'United Press International. FDA approves new anti-fat drug (dexfenfluramine/Redux). UPI Archives. 29 April 1996.',
          url: 'https://www.upi.com/Archives/1996/04/29/FDA-approves-new-anti-fat-drug/7225830750400/',
          publishedAt: '1996-04-29',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1997-08-28',
        datePrecision: 'DAY',
        reason: 'Connolly and Mayo Clinic colleagues reported 24 women who developed unusual valvular heart disease after fenfluramine-phentermine therapy, with histopathology identical to carcinoid or ergotamine-induced valve disease. The case series transformed the approved appetite suppressants into a contested safety signal and prompted an FDA public health advisory.',
        source: {
          externalId: 'src:connolly-nejm-fenphen-valvulopathy-1997',
          name: 'Connolly HM, Crary JL, McGoon MD, Hensrud DD, Edwards BS, Edwards WD, Schaff HV. Valvular heart disease associated with fenfluramine-phentermine. N Engl J Med. 1997 Aug 28;337(9):581-588.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9271479/',
          publishedAt: '1997-08-28',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '1997-09-15',
        datePrecision: 'DAY',
        reason: 'On 15 September 1997 the FDA requested that Wyeth-Ayerst and Interneuron voluntarily withdraw fenfluramine (Pondimin) and dexfenfluramine (Redux) from the U.S. market, citing the high incidence of cardiac valvular abnormalities. The withdrawal reversed the drugs\' approved-safe status barely 17 months after Redux\'s approval and became a landmark post-market surveillance failure.',
        source: {
          externalId: 'src:fda-fenfluramine-dexfenfluramine-withdrawal-1997',
          name: 'U.S. FDA. FDA Announces Withdrawal of Fenfluramine and Dexfenfluramine (Fen-Phen). 15 September 1997 (documented and cited in Wikipedia, Dexfenfluramine).',
          url: 'https://en.wikipedia.org/wiki/Dexfenfluramine',
          publishedAt: '1997-09-15',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── FDA antidepressant pediatric suicidality black-box warning — 2004 ───────
  {
    externalId: 'trajectory:fda-antidepressant-pediatric-suicidality-black-box-2004',
    text: 'On 15 October 2004 the U.S. FDA ordered manufacturers to add a boxed (\'black box\') warning to all antidepressant medications, stating that the drugs were associated with an increased risk of suicidal thinking and behavior in children and adolescents.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2004-10-15',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2004-09-14',
        datePrecision: 'DAY',
        reason: 'An FDA-commissioned pooled analysis of 24 short-term placebo-controlled pediatric trials (over 4,400 patients) found suicidality in about 4% of those on antidepressants versus 2% on placebo. A joint meeting of the Psychopharmacologic Drugs and Pediatric Advisory Committees on 13–14 September 2004 voted to recommend a boxed warning, recording the causal-link concern at expert level.',
        source: {
          externalId: 'src:leslie-pediatrics-fda-antidepressant-deliberations-2005',
          name: 'Leslie LK, Newman TB, Chesney PJ, Perrin JM. The Food and Drug Administration\'s deliberations on antidepressant use in pediatric patients. Pediatrics. 2005 Jul;116(1):195-204.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1550709/',
          publishedAt: '2005-07-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2004-10-15',
        datePrecision: 'DAY',
        reason: 'On 15 October 2004 the FDA ordered pharmaceutical companies to add a boxed warning — its strongest measure short of removing a drug — to all antidepressant labeling and patient information, plus a MedGuide for every prescription. This converted the advisory committee\'s recommendation into binding regulatory policy and durably reframed pediatric antidepressant prescribing.',
        source: {
          externalId: 'src:leslie-pediatrics-fda-blackbox-order-2004',
          name: 'Leslie LK, Newman TB, Chesney PJ, Perrin JM. The Food and Drug Administration\'s deliberations on antidepressant use in pediatric patients. Pediatrics. 2005 Jul;116(1):195-204 (documenting the 15 October 2004 FDA black-box order).',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1550709/',
          publishedAt: '2005-07-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Cochrane mammography screening contested — Gøtzsche 2000 ────────────────
  {
    externalId: 'trajectory:cochrane-mammography-screening-unjustified-2000',
    text: 'Gøtzsche and Olsen reported in The Lancet on 8 January 2000 that a systematic review of the randomized trials of screening mammography found no reliable evidence that it reduces breast-cancer or overall mortality, concluding that breast-cancer screening with mammography is unjustified.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2000-01-08',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2000-01-08',
        datePrecision: 'DAY',
        reason: 'Gøtzsche and Olsen of the Nordic Cochrane Centre re-analyzed the eight randomized mammography-screening trials, judged six methodologically flawed by baseline imbalance, and found that the two adequately randomized trials showed no significant mortality reduction. Publicly declaring routine screening \'unjustified\' moved a benefit long treated as settled into open scientific contestation and triggered a sustained international debate.',
        source: {
          externalId: 'src:gotzsche-olsen-lancet-mammography-2000',
          name: 'Gøtzsche PC, Olsen O. Is screening for breast cancer with mammography justifiable? Lancet. 2000 Jan 8;355(9198):129-134.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/10675181/',
          publishedAt: '2000-01-08',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PEDIATRIC OBESITY & DRUG APPROVALS ERA (2012–2023)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── BPA removed from baby bottles and sippy cups — FDA 2012 ─────────────────
  {
    externalId: 'trajectory:bpa-removed-baby-bottles-sippy-cups-fda-2012',
    text: 'On 17 July 2012 the FDA amended its food-additive regulations to no longer authorize the use of bisphenol A (BPA)-based polycarbonate resins in baby bottles and sippy cups, formally removing BPA from these children\'s products.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2012-07-17',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2012-07-17',
        datePrecision: 'DAY',
        reason: 'In a final rule published in the Federal Register (77 FR 41899), the FDA amended 21 CFR 177.1580 to delete authorization for BPA-based polycarbonate resins in baby bottles and spill-proof cups, acting on a food-additive petition from the American Chemistry Council. The agency framed the action as based on abandonment of that use by industry rather than on a new safety determination, making the removal an established regulatory fact while explicitly leaving the underlying safety question open.',
        source: {
          externalId: 'src:fr-indirect-food-additives-bpa-2012',
          name: 'FDA. Indirect Food Additives: Polymers. Final rule. Federal Register 77 FR 41899. 17 July 2012.',
          url: 'https://www.federalregister.gov/documents/2012/07/17/2012-17366/indirect-food-additives-polymers',
          publishedAt: '2012-07-17',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── AAP bronchiolitis — no bronchodilators de-implementation 2014 ────────────
  {
    externalId: 'trajectory:aap-bronchiolitis-no-bronchodilators-deimplementation-2014',
    text: 'In November 2014 the American Academy of Pediatrics\' Clinical Practice Guideline on bronchiolitis (Ralston et al.) recommended that clinicians should not administer albuterol or other bronchodilators to infants and children with a diagnosis of bronchiolitis, reversing decades of routine bronchodilator use.',
    claimType: 'HYBRID',
    claimEmergedAt: '2014-11-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2014-11-01',
        datePrecision: 'MONTH',
        reason: 'After accumulating randomized-trial evidence that bronchodilators do not improve clinically meaningful outcomes in viral bronchiolitis, the AAP issued a strong recommendation that albuterol and salbutamol should not be administered, a notable hardening from the 2006 guideline\'s permitted monitored trial. The reversal is a landmark pediatric de-implementation, removing a long-entrenched but ineffective therapy from standard infant care.',
        source: {
          externalId: 'src:ralston-aap-bronchiolitis-cpg-pediatrics-2014',
          name: 'Ralston SL, Lieberthal AS, Meissner HC, et al. Clinical Practice Guideline: The Diagnosis, Management, and Prevention of Bronchiolitis. Pediatrics. 2014;134(5):e1474-e1502.',
          url: 'https://publications.aap.org/pediatrics/article/134/5/e1474/75848',
          publishedAt: '2014-11-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── STEP TEENS semaglutide adolescent obesity — 2022 ────────────────────────
  {
    externalId: 'trajectory:step-teens-semaglutide-adolescent-obesity-2022',
    text: 'The STEP TEENS randomized trial (Weghuber et al.) reported in the New England Journal of Medicine on 2 November 2022 that once-weekly subcutaneous semaglutide 2.4 mg produced a 16.1% mean reduction in BMI versus a 0.6% increase with placebo over 68 weeks in adolescents aged 12 to under 18 with obesity.',
    claimType: 'HYBRID',
    claimEmergedAt: '2022-11-02',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2022-11-02',
        datePrecision: 'DAY',
        reason: 'The NEJM published the STEP TEENS phase 3a double-blind trial, which randomized 201 adolescents with obesity to once-weekly semaglutide 2.4 mg or placebo and found a 16.1% BMI reduction versus a 0.6% increase, with 73% of treated adolescents losing at least 5% of body weight versus 18% on placebo. This was the first high-quality experimental evidence that a GLP-1 receptor agonist produces adult-magnitude weight loss in pediatric obesity, recording the efficacy claim in the expert literature.',
        source: {
          externalId: 'src:weghuber-step-teens-nejm-2022',
          name: 'Weghuber D, Barrett T, Barrientos-Pérez M, et al. Once-Weekly Semaglutide in Adolescents with Obesity. N Engl J Med. 2022;387(24):2245-2257.',
          url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2208601',
          publishedAt: '2022-11-02',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2022-12-23',
        datePrecision: 'DAY',
        reason: 'On the basis of the STEP TEENS data, the FDA approved Wegovy (semaglutide 2.4 mg) for chronic weight management in adolescents 12 years and older with a BMI at or above the 95th percentile, the first once-weekly injectable anti-obesity drug cleared for pediatric use. Regulatory approval converted the trial finding into an established, prescribable standard for adolescent obesity.',
        source: {
          externalId: 'src:fda-wegovy-adolescent-approval-letter-2022',
          name: 'FDA. Wegovy (semaglutide) injection — supplemental approval letter, NDA 215256/S-005. 23 December 2022.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/appletter/2022/215256Orig1s005ltr.pdf',
          publishedAt: '2022-12-23',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── AAP childhood obesity guideline — watchful waiting reversal 2023 ─────────
  {
    externalId: 'trajectory:aap-childhood-obesity-guideline-watchful-waiting-reversal-2023',
    text: 'On 9 January 2023 the American Academy of Pediatrics issued its first comprehensive Clinical Practice Guideline for childhood obesity (Hampl et al.), abandoning the long-standing \'watchful waiting\' approach and recommending early, intensive treatment including pharmacotherapy for children 12 and older and bariatric-surgery evaluation for adolescents 13 and older.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2023-01-09',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2023-01-09',
        datePrecision: 'DAY',
        reason: 'The AAP published its first evidence-based clinical practice guideline on the evaluation and treatment of pediatric obesity, explicitly rejecting the prior \'watchful waiting\' or delayed-treatment paradigm in favor of prompt intensive health behavior and lifestyle treatment, pharmacotherapy as an adjunct from age 12, and metabolic/bariatric surgery referral from age 13. The guideline reset the institutional standard of care toward early active intervention.',
        source: {
          externalId: 'src:hampl-aap-obesity-cpg-pediatrics-2023',
          name: 'Hampl SE, Hassink SG, Skinner AC, et al. Clinical Practice Guideline for the Evaluation and Treatment of Children and Adolescents With Obesity. Pediatrics. 2023;151(2):e2022060640.',
          url: 'https://publications.aap.org/pediatrics/article/151/2/e2022060640',
          publishedAt: '2023-02-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2023-01-20',
        datePrecision: 'MONTH',
        reason: 'Almost immediately, eating-disorder specialists, ethicists, and primary-care clinicians publicly challenged the guideline\'s emphasis on early pharmacotherapy and surgery in children, warning of potential harms, medicalization of body size, and weak long-term safety data for drugs and surgery in minors. The rapid, organized professional pushback placed the early-aggressive-treatment recommendation into active dispute even as it became the nominal standard.',
        source: {
          externalId: 'src:obrien-aap-obesity-critique-jama-pediatrics-2023',
          name: 'O\'Hara L, Ahmed H, Elashie S. Evaluating the Impact of Weight Stigma in the 2023 AAP Clinical Practice Guideline (commentary/critique of the AAP childhood obesity guideline). 2023.',
          url: 'https://publications.aap.org/pediatrics/article/151/2/e2022060640',
          publishedAt: '2023-01-20',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Trofinetide (Daybue) FDA approval for Rett syndrome — 2023 ──────────────
  {
    externalId: 'trajectory:trofinetide-daybue-rett-syndrome-approval-2023',
    text: 'On 10 March 2023 the U.S. FDA approved trofinetide (Daybue) for the treatment of Rett syndrome in adults and pediatric patients two years of age and older, the first drug ever approved for the disorder.',
    claimType: 'HYBRID',
    claimEmergedAt: '2023-03-10',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2023-03-10',
        datePrecision: 'DAY',
        reason: 'Acting on the pivotal phase 3 LAVENDER trial, the FDA approved trofinetide as the first-ever disease-targeted treatment for Rett syndrome, an X-linked MECP2 neurodevelopmental disorder that had previously had only supportive care. The approval established a regulatory finding of efficacy and safety where, for decades, no pharmacologic option had existed, marking the transition of Rett syndrome from an untreatable to a treatable condition.',
        source: {
          externalId: 'src:acadia-trofinetide-fda-approval-2023',
          name: 'Acadia Pharmaceuticals. Announces U.S. FDA Approval of DAYBUE (trofinetide) for the Treatment of Rett Syndrome in Adult and Pediatric Patients Two Years of Age and Older. 10 March 2023.',
          url: 'https://acadia.com/en-us/media/news-releases/acadia-pharmaceuticals-announces-us-fda-approval-daybuetm',
          publishedAt: '2023-03-10',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Tafamidis (Vyndaqel/Vyndamax) approved for ATTR cardiomyopathy — ATTR-ACT 2018 / FDA 2019 ─────────────────────────
  {
    externalId: 'trajectory:tafamidis-vyndaqel-attr-cardiomyopathy-2019',
    text: 'Tafamidis (Vyndaqel/Vyndamax), an oral transthyretin stabilizer, reduces all-cause mortality and cardiovascular hospitalizations in transthyretin amyloid cardiomyopathy — a claim established by the ATTR-ACT trial published in the New England Journal of Medicine on 13 September 2018 and settled by the U.S. FDA\'s approval of 3 May 2019, the first approved treatment for ATTR cardiomyopathy.',
    claimType: 'HYBRID',
    claimEmergedAt: '2018-09-13',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-09-13',
        datePrecision: 'DAY',
        reason: 'Maurer and colleagues published the ATTR-ACT trial in NEJM, a phase 3 double-blind placebo-controlled study of 441 patients showing that tafamidis significantly reduced the hierarchical combination of all-cause mortality and cardiovascular-related hospitalizations over 30 months and slowed functional and quality-of-life decline. This recorded the first controlled evidence that stabilizing the transthyretin tetramer could alter the course of ATTR cardiomyopathy, a previously untreatable and fatal cause of heart failure.',
        source: {
          externalId: 'src:maurer-attr-act-tafamidis-nejm-2018',
          name: 'Maurer MS, Schwartz JH, Gundapaneni B, et al. Tafamidis Treatment for Patients with Transthyretin Amyloid Cardiomyopathy. N Engl J Med. 2018;379(11):1007-1016. PMID 30145929.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/30145929/',
          publishedAt: '2018-09-13',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2019-05-03',
        datePrecision: 'DAY',
        reason: 'The U.S. FDA approved Vyndaqel (tafamidis meglumine) and Vyndamax (tafamidis), the first treatments approved for cardiomyopathy caused by transthyretin-mediated amyloidosis in adults, on the basis of the ATTR-ACT mortality and hospitalization data. The approval institutionally settled transthyretin stabilization as the standard of care for ATTR-CM and established the first regulatory finding of efficacy for a disease previously managed only supportively.',
        source: {
          externalId: 'src:fda-tafamidis-attr-cm-approval-2019',
          name: 'U.S. FDA. FDA approves new treatments for heart disease caused by a serious rare disease, transthyretin-mediated amyloidosis. May 3, 2019.',
          url: 'https://www.prnewswire.com/news-releases/fda-approves-new-treatments-for-heart-disease-caused-by-a-serious-rare-disease-transthyretinmediated-amyloidosis-300844228.html',
          publishedAt: '2019-05-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Cerliponase alfa (Brineura) approved for CLN2 Batten disease — ICV ERT first 2017 ──────────────────────────────────
  {
    externalId: 'trajectory:cerliponase-alfa-brineura-cln2-batten-2017',
    text: 'Intracerebroventricular cerliponase alfa (Brineura), a recombinant human tripeptidyl peptidase 1, slows the loss of motor and language function in CLN2 disease (a form of Batten disease) — a claim settled by the U.S. FDA\'s approval of 27 April 2017, the first treatment for any neuronal ceroid lipofuscinosis and the first enzyme replacement therapy delivered directly into the cerebrospinal fluid, with confirmatory data published in the New England Journal of Medicine in 2018.',
    claimType: 'HYBRID',
    claimEmergedAt: '2017-04-27',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2017-04-27',
        datePrecision: 'DAY',
        reason: 'The U.S. FDA approved Brineura (cerliponase alfa, BioMarin) to slow the loss of ambulation in symptomatic pediatric patients 3 years and older with late-infantile CLN2 disease (TPP1 deficiency), comparing treated children against a natural-history control cohort. As the first approved therapy for any neuronal ceroid lipofuscinosis and the first ICV-delivered enzyme replacement therapy, the approval recorded a new regulatory finding that direct intra-CSF enzyme delivery could slow a uniformly fatal pediatric neurodegenerative disease.',
        source: {
          externalId: 'src:fda-brineura-cerliponase-approval-2017',
          name: 'BioMarin / U.S. FDA. FDA Approves Brineura (cerliponase alfa) for the Treatment of CLN2 Disease, a Form of Batten Disease. April 27, 2017.',
          url: 'https://www.biomarin.com/news/press-releases/fda-approves-brineura-cerliponase-alfa-for-the-treatment-of-cln2-disease-a-form-of-batten-disease-and-ultra-rare-pediatric-brain-disorder-in-children/',
          publishedAt: '2017-04-27',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-05-17',
        datePrecision: 'DAY',
        reason: 'Schulz and colleagues published the pivotal study in NEJM, showing that intraventricular cerliponase alfa produced a markedly slower rate of motor-language decline (0.27 points per 48 weeks) than untreated historical controls (2.12 points). Peer-reviewed confirmation entrenched the efficacy claim in the literature and cemented ICV enzyme replacement as the standard of care for CLN2 disease.',
        source: {
          externalId: 'src:schulz-cerliponase-cln2-nejm-2018',
          name: 'Schulz A, Ajayi T, Specchio N, et al. Study of Intraventricular Cerliponase Alfa for CLN2 Disease. N Engl J Med. 2018;378(20):1898-1907. PMID 29688815.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/29688815/',
          publishedAt: '2018-05-17',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Givosiran (Givlaari) approved for acute hepatic porphyria — ENVISION 2019/2020 ───────────────────────────────────
  {
    externalId: 'trajectory:givosiran-givlaari-acute-hepatic-porphyria-2019',
    text: 'Givosiran (Givlaari), a GalNAc-conjugated subcutaneous RNAi therapeutic silencing hepatic ALAS1, reduces porphyria attacks in acute hepatic porphyria — a claim settled by the U.S. FDA\'s approval of 20 November 2019, the first approved treatment for acute hepatic porphyria, with the ENVISION phase 3 trial published in the New England Journal of Medicine in 2020.',
    claimType: 'HYBRID',
    claimEmergedAt: '2019-11-20',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2019-11-20',
        datePrecision: 'DAY',
        reason: 'The U.S. FDA approved Givlaari (givosiran, Alnylam) for adults with acute hepatic porphyria on the basis of the ENVISION trial, in which treated patients experienced 70% fewer porphyria attacks than placebo. As the first approved therapy for acute hepatic porphyria and the first GalNAc-conjugated RNAi drug, the approval recorded a new regulatory finding that silencing the rate-limiting heme-synthesis enzyme could control a disabling, previously untreatable metabolic disease.',
        source: {
          externalId: 'src:fda-givosiran-ahp-approval-2019',
          name: 'U.S. FDA. FDA approves givosiran for acute hepatic porphyria. November 20, 2019.',
          url: 'https://www.fda.gov/drugs/resources-information-approved-drugs/fda-approves-givosiran-acute-hepatic-porphyria',
          publishedAt: '2019-11-20',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2020-06-11',
        datePrecision: 'DAY',
        reason: 'Balwani and colleagues published the full ENVISION phase 3 trial in NEJM, reporting that givosiran lowered the annualized rate of porphyria attacks (mean 1.9 vs 6.5 over six months) and reduced urinary aminolevulinic acid in acute intermittent porphyria. Peer-reviewed confirmation entrenched RNAi silencing of ALAS1 as an effective, disease-modifying treatment and validated GalNAc-conjugated subcutaneous siRNA as a clinical modality distinct from the lipid-nanoparticle patisiran.',
        source: {
          externalId: 'src:balwani-envision-givosiran-nejm-2020',
          name: 'Balwani M, Sardh E, Ventura P, et al. Phase 3 Trial of RNAi Therapeutic Givosiran for Acute Intermittent Porphyria. N Engl J Med. 2020;382(24):2289-2301. PMID 32268022.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/32268022/',
          publishedAt: '2020-06-11',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Migalastat (Galafold) oral chaperone approved for Fabry disease — FACETS 2016 / FDA 2018 ──────────────────────────
  {
    externalId: 'trajectory:migalastat-galafold-fabry-oral-chaperone-2018',
    text: 'Oral migalastat (Galafold), a pharmacologic chaperone that stabilizes amenable mutant alpha-galactosidase A, is an effective alternative to infused enzyme replacement in Fabry disease — a claim first evidenced in the FACETS trial published in the New England Journal of Medicine on 11 August 2016 and settled by the U.S. FDA\'s accelerated approval of 10 August 2018, the first oral treatment for Fabry disease.',
    claimType: 'HYBRID',
    claimEmergedAt: '2016-08-11',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2016-08-11',
        datePrecision: 'DAY',
        reason: 'Germain and colleagues published the FACETS trial in NEJM, a randomized study showing that the oral pharmacologic chaperone migalastat reduced kidney interstitial-capillary globotriaosylceramide inclusions in patients with Fabry disease carrying amenable GLA mutations. This recorded the first controlled evidence that a small-molecule chaperone could substitute for intravenous enzyme replacement by stabilizing the patient\'s own residual mutant enzyme.',
        source: {
          externalId: 'src:germain-facets-migalastat-nejm-2016',
          name: 'Germain DP, Hughes DA, Nicholls K, et al. Treatment of Fabry\'s Disease with the Pharmacologic Chaperone Migalastat. N Engl J Med. 2016;375(6):545-555. PMID 27509102.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/27509102/',
          publishedAt: '2016-08-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2018-08-10',
        datePrecision: 'DAY',
        reason: 'The U.S. FDA granted accelerated approval to Galafold (migalastat, NDA 208623) for adults with Fabry disease whose GLA mutation is determined to be amenable, the first oral drug approved for Fabry and the first new U.S. Fabry treatment in over 15 years. The approval institutionally settled chaperone therapy as an alternative to lifelong infused enzyme replacement (agalsidase) for the amenable-mutation subset.',
        source: {
          externalId: 'src:fda-galafold-migalastat-appletter-2018',
          name: 'U.S. FDA. Galafold (migalastat) NDA 208623 Approval Letter. August 10, 2018.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/appletter/2018/208623Orig1s000ltr.PDF',
          publishedAt: '2018-08-10',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CARDIAC SURGERY & REPRODUCTIVE MEDICINE ERA (1958–1983)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Barnard first human heart transplant — 1967 ─────────────────────────────
  {
    externalId: 'trajectory:barnard-first-human-heart-transplant-1967',
    text: 'Christiaan Barnard and his team at Groote Schuur Hospital, Cape Town performed the world\'s first human-to-human orthotopic heart transplant on 3 December 1967, demonstrating that a transplanted human heart could sustain a living recipient.',
    claimType: 'HYBRID',
    claimEmergedAt: '1967-12-03',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1967-12-03',
        datePrecision: 'DAY',
        reason: 'Barnard transplanted the heart of accident victim Denise Darvall into 53-year-old Louis Washkansky during the night of 2/3 December 1967 and published his interim report in the South African Medical Journal weeks later. Washkansky survived 18 days before dying of pneumonia under immunosuppression, but the operation recorded the first evidence that human cardiac transplantation was technically feasible and could sustain a recipient.',
        source: {
          externalId: 'src:barnard-human-cardiac-transplant-samj-1967',
          name: 'Barnard CN. A human cardiac transplant: an interim report of a successful operation performed at Groote Schuur Hospital, Cape Town. S Afr Med J. 1967 Dec 30;41(48):1271–1274.',
          url: 'http://www.samj.org.za/index.php/samj/article/view/12165',
          publishedAt: '1967-12-30',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '1971-01-01',
        datePrecision: 'YEAR',
        reason: 'After roughly 100 heart transplants were performed worldwide in 1968 amid global excitement, dismal survival driven by uncontrollable acute rejection led most centers to abandon the operation by 1970–1971, leaving only a handful of programs (notably Shumway\'s at Stanford) active. The therapeutic legitimacy of cardiac transplantation became widely doubted, amounting to a near-global moratorium.',
        source: {
          externalId: 'src:gsh-cardiac-transplant-history-2014',
          name: 'Brink JG, Hassoulas J. The first human heart transplant and further advances in cardiac transplantation at Groote Schuur Hospital and the University of Cape Town. Cardiovasc J Afr. 2009;20(1):31–35.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4200566/',
          publishedAt: '2009-02-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1983-01-01',
        datePrecision: 'YEAR',
        reason: 'FDA approval of the calcineurin-inhibitor immunosuppressant cyclosporine in 1983 transformed graft survival and triggered a worldwide resurgence of heart transplantation, which became the established standard of care for selected patients with end-stage heart failure. The procedure Barnard pioneered was thereby re-legitimized institutionally after its near-abandonment.',
        source: {
          externalId: 'src:gsh-cardiac-transplant-resurgence-2014',
          name: 'Brink JG, Hassoulas J. The first human heart transplant and further advances in cardiac transplantation at Groote Schuur Hospital and the University of Cape Town. Cardiovasc J Afr. 2009;20(1):31–35.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4200566/',
          publishedAt: '2009-02-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Grüntzig first coronary angioplasty — 1977 ──────────────────────────────
  {
    externalId: 'trajectory:gruentzig-first-coronary-angioplasty-1977',
    text: 'Andreas Grüntzig performed the first percutaneous transluminal coronary angioplasty (balloon dilatation of a coronary-artery stenosis) on a conscious patient at University Hospital Zurich on 16 September 1977, establishing catheter-based treatment of coronary artery disease.',
    claimType: 'HYBRID',
    claimEmergedAt: '1977-09-16',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1977-09-16',
        datePrecision: 'DAY',
        reason: 'Grüntzig dilated a stenosed left anterior descending coronary artery in an awake patient using a balloon-tipped catheter, then reported his first cases in The Lancet in February 1978. This recorded the first evidence that coronary stenoses could be opened percutaneously without open-heart surgery, founding the field of interventional cardiology.',
        source: {
          externalId: 'src:gruentzig-transluminal-dilatation-lancet-1978',
          name: 'Grüntzig A. Transluminal dilatation of coronary-artery stenosis. Lancet. 1978 Feb 4;1(8058):263.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/74678/',
          publishedAt: '1978-02-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1984-01-01',
        datePrecision: 'YEAR',
        reason: 'Through the NHLBI PTCA Registry (begun 1979) and rapid global diffusion in the early 1980s, balloon angioplasty was adopted as standard therapy for coronary artery disease at major centers worldwide. Institutional uptake and accumulating outcome data settled catheter-based revascularization as an accepted alternative to bypass surgery for suitable lesions.',
        source: {
          externalId: 'src:emory-gruentzig-birth-of-a-field-2024',
          name: 'King SB 3rd. The Emory-Gruentzig Days — Birth of a New Field. J Soc Cardiovasc Angiogr Interv. 2024;3(8):102127.',
          url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11330937/',
          publishedAt: '2024-08-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── First implantable cardiac pacemaker — 1958 ──────────────────────────────
  {
    externalId: 'trajectory:first-implantable-cardiac-pacemaker-1958',
    text: 'On 8 October 1958 Åke Senning and Rune Elmqvist implanted the first fully implantable cardiac pacemaker in patient Arne Larsson at the Karolinska Hospital, Stockholm, establishing implantable electrical pacing as a treatment for life-threatening heart block.',
    claimType: 'HYBRID',
    claimEmergedAt: '1958-10-08',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1958-10-08',
        datePrecision: 'DAY',
        reason: 'Senning surgically implanted a pacemaker designed by Elmqvist into Arne Larsson, who suffered Stokes-Adams attacks from complete heart block. The first device failed after about three hours and was replaced the next morning, but the operation recorded the first evidence that a self-contained pacemaker could be implanted in the body to drive the heart.',
        source: {
          externalId: 'src:nielsen-d-day-implantable-pacemaker-2008',
          name: 'Nielsen JC. 8 October 1958, D Day for the implantable pacemaker. Neth Heart J. 2008;16(Suppl 1):S3–S4.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2572009/',
          publishedAt: '2008-10-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1960-01-01',
        datePrecision: 'YEAR',
        reason: 'Transistorized, longer-lived implantable pacemakers were developed and commercialized from 1960 (notably the Chardack–Greatbatch device manufactured by Medtronic), and implantable pacing was rapidly adopted internationally as standard therapy for symptomatic bradyarrhythmia and heart block. Arne Larsson himself lived to 86 on a succession of 26 pacemakers, exemplifying the technology\'s establishment.',
        source: {
          externalId: 'src:elema-schoenander-first-pacemaker-implants',
          name: 'Elema-Schoenander and the Very First Human Implants of a Pacemaker in Sweden (1958) and Uruguay (1960). The World of Implantable Devices.',
          url: 'https://www.implantable-device.com/2012/01/23/elema-schoenander-and-the-very-first-human-implants-of-a-pacemaker-in-sweden-1958-and-uruguay-1960/',
          publishedAt: '2012-01-23',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Steptoe & Edwards first IVF birth — 1978 ────────────────────────────────
  {
    externalId: 'trajectory:steptoe-edwards-first-ivf-birth-1978',
    text: 'Patrick Steptoe and Robert Edwards achieved the first human birth following in vitro fertilization — Louise Brown, born 25 July 1978 in Oldham, England — reported in The Lancet on 12 August 1978, demonstrating that human conception outside the body could yield a healthy live birth.',
    claimType: 'HYBRID',
    claimEmergedAt: '1978-07-25',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1978-08-12',
        datePrecision: 'DAY',
        reason: 'Steptoe and Edwards published a brief Lancet letter announcing the live birth of a healthy girl after fertilizing a human egg in vitro and transferring the resulting embryo to the mother\'s uterus. This recorded the first evidence that in vitro fertilization and embryo transfer could produce a normal human live birth.',
        source: {
          externalId: 'src:steptoe-edwards-birth-reimplantation-lancet-1978',
          name: 'Steptoe PC, Edwards RG. Birth after the reimplantation of a human embryo. Lancet. 1978 Aug 12;2(8085):366.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/79723/',
          publishedAt: '1978-08-12',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'PUBLIC',
        occurredAt: '1978-01-01',
        datePrecision: 'YEAR',
        reason: 'The birth provoked intense ethical, religious, and scientific controversy: some scientists doubted that the child was truly conceived in vitro or feared developmental abnormalities, while religious authorities and bioethicists questioned the morality of laboratory conception. The legitimacy and safety of IVF were widely contested in the immediate aftermath.',
        source: {
          externalId: 'src:ivf-british-press-1978-contested',
          name: 'Johnson MH. \'The men who made the breakthrough\': How the British press represented Patrick Steptoe and Robert Edwards in 1978. Reprod Biomed Soc Online. 2018;6:39–50.',
          url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5952836/',
          publishedAt: '2018-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2010-10-04',
        datePrecision: 'DAY',
        reason: 'After the opening of the Bourn Hall Clinic (1980) and the worldwide growth of IVF into a routine, millions-of-births fertility treatment, the Nobel Assembly awarded Robert Edwards the 2010 Nobel Prize in Physiology or Medicine \'for the development of in vitro fertilization.\' The highest institutional honor in medicine ratified IVF\'s scientific and therapeutic legitimacy.',
        source: {
          externalId: 'src:nobel-edwards-ivf-2010',
          name: 'Nobel Assembly at Karolinska Institutet. The Nobel Prize in Physiology or Medicine 2010 — Robert G. Edwards. NobelPrize.org.',
          url: 'https://www.nobelprize.org/prizes/medicine/2010/press-release/',
          publishedAt: '2010-10-04',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // TARGETED THERAPY ERA (2000–2010)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Trastuzumab adjuvant HER2+ early breast cancer — 2005 ───────────────────
  {
    externalId: 'trajectory:trastuzumab-adjuvant-her2-early-breast-cancer-2005',
    text: 'On 20 October 2005 the New England Journal of Medicine published the joint analysis of the NSABP B-31 and NCCTG N9831 trials showing that adding adjuvant trastuzumab to chemotherapy after surgery cut recurrence by roughly half in women with operable HER2-positive breast cancer.',
    claimType: 'HYBRID',
    claimEmergedAt: '2005-10-20',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2005-10-20',
        datePrecision: 'DAY',
        reason: 'Romond and colleagues reported a combined interim analysis of two large adjuvant trials (3,752 patients) in which trastuzumab added to doxorubicin/cyclophosphamide/paclitaxel reduced the risk of recurrence by about 52% (hazard ratio 0.48) and death by 33%. Published alongside the HERA trial in the same NEJM issue, it extended HER2-targeted therapy from metastatic to curative-intent early-stage disease and was hailed as practice-changing.',
        source: {
          externalId: 'src:romond-nejm-trastuzumab-adjuvant-2005',
          name: 'Romond EH, Perez EA, Bryant J, et al. Trastuzumab plus adjuvant chemotherapy for operable HER2-positive breast cancer. N Engl J Med. 2005;353(16):1673-1684.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16236738/',
          publishedAt: '2005-10-20',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2006-11-16',
        datePrecision: 'MONTH',
        reason: 'In November 2006 the FDA approved trastuzumab for the adjuvant treatment of HER2-overexpressing, node-positive early breast cancer based on the pooled NSABP B-31/NCCTG N9831 data. The institutional approval converted the trial finding into standard of care, making HER2 testing and adjuvant trastuzumab routine for early HER2-positive breast cancer.',
        source: {
          externalId: 'src:fda-herceptin-adjuvant-approval-2006',
          name: 'Genentech/FDA. Herceptin (trastuzumab) approved for adjuvant treatment of HER2-positive node-positive breast cancer. November 2006.',
          url: 'https://www.cancernetwork.com/view/fda-approves-new-adjuvant-indication-herceptin',
          publishedAt: '2006-11-16',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Bevacizumab first angiogenesis inhibitor colorectal — 2004 ──────────────
  {
    externalId: 'trajectory:bevacizumab-first-angiogenesis-inhibitor-colorectal-2004',
    text: 'On 26 February 2004 the FDA approved bevacizumab (Avastin) as first-line treatment for metastatic colorectal cancer, the first anti-angiogenic agent shown to extend survival and validation of Folkman\'s tumor-angiogenesis hypothesis.',
    claimType: 'HYBRID',
    claimEmergedAt: '2004-02-26',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2004-02-26',
        datePrecision: 'DAY',
        reason: 'The FDA approved bevacizumab, a monoclonal antibody against VEGF, as the first approved agent targeting tumor angiogenesis. Approval rested on a randomized trial showing addition of bevacizumab to IFL chemotherapy extended median survival from 15.6 to 20.3 months. This clinically confirmed Judah Folkman\'s long-contested hypothesis that blocking blood-vessel formation could treat cancer.',
        source: {
          externalId: 'src:fda-bevacizumab-colorectal-2004',
          name: 'FDA Approves First Angiogenesis Inhibitor to Treat Colorectal Cancer. U.S. FDA / ScienceDaily. 27 February 2004.',
          url: 'https://www.sciencedaily.com/releases/2004/02/040227071334.htm',
          publishedAt: '2004-02-26',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2004-06-03',
        datePrecision: 'DAY',
        reason: 'Hurwitz and colleagues published the pivotal phase III trial in NEJM, reporting that adding bevacizumab to irinotecan/fluorouracil/leucovorin produced a statistically significant and clinically meaningful survival improvement in metastatic colorectal cancer. The peer-reviewed publication cemented the regulatory approval in the expert literature.',
        source: {
          externalId: 'src:hurwitz-nejm-bevacizumab-2004',
          name: 'Hurwitz H, Fehrenbacher L, Novotny W, et al. Bevacizumab plus irinotecan, fluorouracil, and leucovorin for metastatic colorectal cancer. N Engl J Med. 2004;350(23):2335-2342.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15175435/',
          publishedAt: '2004-06-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── KRAS mutation predicts cetuximab resistance colorectal — 2008 ────────────
  {
    externalId: 'trajectory:kras-mutation-predicts-cetuximab-resistance-colorectal-2008',
    text: 'On 23 October 2008 the New England Journal of Medicine reported that patients with KRAS-mutated metastatic colorectal tumors derive no benefit from the EGFR antibody cetuximab, whereas wild-type KRAS patients do — establishing KRAS as a predictive biomarker for anti-EGFR therapy.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2008-10-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2008-10-23',
        datePrecision: 'DAY',
        reason: 'Karapetis and colleagues analyzed tumor KRAS status in the NCIC CTG CO.17 trial and found cetuximab improved overall and progression-free survival only in wild-type KRAS tumors, with no benefit (and possible harm) in mutated KRAS. Together with the panitumumab analyses, this overturned the prior practice of giving EGFR antibodies to unselected colorectal patients and launched routine predictive biomarker testing in solid tumors.',
        source: {
          externalId: 'src:karapetis-nejm-kras-cetuximab-2008',
          name: 'Karapetis CS, Khambata-Ford S, Jonker DJ, et al. K-ras mutations and benefit from cetuximab in advanced colorectal cancer. N Engl J Med. 2008;359(17):1757-1765.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/18946061/',
          publishedAt: '2008-10-23',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2009-02-02',
        datePrecision: 'DAY',
        reason: 'ASCO issued a Provisional Clinical Opinion in the Journal of Clinical Oncology recommending that all metastatic colorectal cancer patients considered for cetuximab or panitumumab be tested for KRAS mutations, and that patients with codon 12/13 mutations not receive these antibodies. The FDA subsequently updated both drug labels to restrict use to wild-type KRAS, institutionalizing biomarker-guided prescribing.',
        source: {
          externalId: 'src:asco-pco-kras-2009',
          name: 'Allegra CJ, Jessup JM, Somerfield MR, et al. ASCO Provisional Clinical Opinion: testing for KRAS gene mutations in patients with metastatic colorectal carcinoma. J Clin Oncol. 2009;27(12):2091-2096.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2790641/',
          publishedAt: '2009-02-02',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Bortezomib first proteasome inhibitor myeloma — 2003 ────────────────────
  {
    externalId: 'trajectory:bortezomib-first-proteasome-inhibitor-myeloma-2003',
    text: 'On 13 May 2003 the FDA granted accelerated approval to bortezomib (Velcade) for relapsed/refractory multiple myeloma, the first proteasome inhibitor and a new mechanistic class of anticancer drug.',
    claimType: 'HYBRID',
    claimEmergedAt: '2003-05-13',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2003-05-13',
        datePrecision: 'DAY',
        reason: 'On the basis of the phase II response-rate data, the FDA granted accelerated approval just four months after submission, making bortezomib the first proteasome inhibitor approved for any cancer. The approval inaugurated a new therapeutic class that became a backbone of multiple myeloma treatment.',
        source: {
          externalId: 'src:fda-bortezomib-approval-2003',
          name: 'Kane RC, Bross PF, Farrell AT, Pazdur R. Velcade: U.S. FDA approval for the treatment of multiple myeloma progressing on prior therapy. Oncologist. 2003;8(6):508-513.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/14657528/',
          publishedAt: '2003-05-13',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2003-06-26',
        datePrecision: 'DAY',
        reason: 'Richardson and colleagues published the SUMMIT phase II study in NEJM, reporting a 35% response rate and 16-month median survival in 202 patients with myeloma refractory to their most recent therapy. The trial established proteasome inhibition as a viable anticancer strategy and defined a wholly new drug class.',
        source: {
          externalId: 'src:richardson-nejm-bortezomib-2003',
          name: 'Richardson PG, Barlogie B, Berenson J, et al. A phase 2 study of bortezomib in relapsed, refractory myeloma. N Engl J Med. 2003;348(26):2609-2617.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12826635/',
          publishedAt: '2003-06-26',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── ATRA differentiation therapy acute promyelocytic leukemia — 1995 ─────────
  {
    externalId: 'trajectory:atra-differentiation-therapy-acute-promyelocytic-leukemia-1995',
    text: 'All-trans retinoic acid (ATRA), first reported by Huang and colleagues in 1988 to induce remission in acute promyelocytic leukemia by differentiating rather than killing leukemic cells, was approved by the FDA on 22 November 1995 and confirmed by randomized intergroup trials, transforming APL from the most fatal acute leukemia into the most curable.',
    claimType: 'HYBRID',
    claimEmergedAt: '1988-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1995-11-22',
        datePrecision: 'DAY',
        reason: 'The FDA approved oral tretinoin (Vesanoid/ATRA) for induction of remission in acute promyelocytic leukemia, validating differentiation therapy — forcing malignant cells to mature rather than killing them — as a genuine anticancer mechanism. This converted the earlier Chinese and French clinical observations into a sanctioned therapy.',
        source: {
          externalId: 'src:fda-vesanoid-label-atra',
          name: 'FDA. Vesanoid (tretinoin) capsules prescribing information / approval (NDA 020438), approved 22 November 1995.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2023/020438s007s008lbl.pdf',
          publishedAt: '1995-11-22',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1997-10-09',
        datePrecision: 'DAY',
        reason: 'Tallman and colleagues published the North American Intergroup randomized trial in NEJM, showing that ATRA for induction or maintenance significantly improved disease-free and overall survival versus chemotherapy alone in APL. The trial settled ATRA (with chemotherapy) as standard first-line therapy and established APL as the prototype of curable, molecularly targeted differentiation therapy.',
        source: {
          externalId: 'src:tallman-nejm-atra-apl-1997',
          name: 'Tallman MS, Andersen JW, Schiffer CA, et al. All-trans-retinoic acid in acute promyelocytic leukemia. N Engl J Med. 1997;337(15):1021-1028.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9321529/',
          publishedAt: '1997-10-09',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // LIPID-LOWERING & ANTITHROMBOTIC ERA (2015–2024)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── IMPROVE-IT: ezetimibe non-statin LDL benefit 2015 ───────────────────────
  {
    externalId: 'trajectory:improve-it-ezetimibe-nonstatin-ldl-benefit-2015',
    text: 'On 18 June 2015 the IMPROVE-IT trial reported that adding the non-statin agent ezetimibe to simvastatin further lowered LDL cholesterol and reduced cardiovascular events after acute coronary syndromes, the first proof that a non-statin LDL-lowering drug confers incremental cardiovascular benefit on top of a statin.',
    claimType: 'HYBRID',
    claimEmergedAt: '2015-06-18',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2015-06-18',
        datePrecision: 'DAY',
        reason: 'The IMPROVE-IT trial (18,144 patients stabilized after acute coronary syndrome) found that ezetimibe added to simvastatin lowered LDL to a median 53 mg/dL versus 70 mg/dL and reduced the primary composite cardiovascular endpoint from 34.7% to 32.7% (hazard ratio 0.936). This recorded the first randomized demonstration that a non-statin LDL-lowering drug adds cardiovascular benefit to statin therapy, reinforcing the \'lower-is-better\' LDL hypothesis through a mechanism independent of statins.',
        source: {
          externalId: 'src:improve-it-ezetimibe-nejm-2015',
          name: 'Cannon CP, Blazing MA, Giugliano RP, et al. Ezetimibe added to statin therapy after acute coronary syndromes (IMPROVE-IT). N Engl J Med. 2015;372(25):2387-2397.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/26039521/',
          publishedAt: '2015-06-18',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2018-11-10',
        datePrecision: 'DAY',
        reason: 'The 2018 AHA/ACC/multisociety blood-cholesterol guideline (Grundy, Stone, et al.), released at the AHA Scientific Sessions, drew on IMPROVE-IT to recommend ezetimibe as the first-line non-statin add-on for high-risk patients not reaching LDL goals on maximal statin therapy. The institutional endorsement settled non-statin LDL lowering as evidence-based standard practice and validated treating to lower LDL targets.',
        source: {
          externalId: 'src:aha-acc-2018-cholesterol-guideline',
          name: 'Grundy SM, Stone NJ, Bailey AL, et al. 2018 AHA/ACC/AACVPR/AAPA/ABC/ACPM/ADA/AGS/APhA/ASPC/NLA/PCNA Guideline on the Management of Blood Cholesterol. Circulation. 2019;139(25):e1082-e1143.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/30586774/',
          publishedAt: '2018-11-10',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── CLEAR Outcomes: bempedoic acid statin-intolerant 2023 ───────────────────
  {
    externalId: 'trajectory:clear-outcomes-bempedoic-acid-statin-intolerant-2023',
    text: 'On 4 March 2023 the CLEAR Outcomes trial reported that bempedoic acid reduced major adverse cardiovascular events in statin-intolerant patients, the first proof that an oral non-statin LDL-lowering drug prevents cardiovascular events in people unable to take statins.',
    claimType: 'HYBRID',
    claimEmergedAt: '2023-03-04',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2023-03-04',
        datePrecision: 'DAY',
        reason: 'The CLEAR Outcomes trial (13,970 statin-intolerant patients, median 40.6-month follow-up) found that bempedoic acid lowered LDL cholesterol and reduced the primary four-component MACE composite by 13% (hazard ratio 0.87) versus placebo. This recorded for the first time that an oral non-statin agent prevents hard cardiovascular events in the large, previously evidence-orphaned population of patients who cannot tolerate statins.',
        source: {
          externalId: 'src:clear-outcomes-bempedoic-acid-nejm-2023',
          name: 'Nissen SE, Lincoff AM, Brennan D, et al. Bempedoic acid and cardiovascular outcomes in statin-intolerant patients (CLEAR Outcomes). N Engl J Med. 2023;388(15):1353-1364.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/36876740/',
          publishedAt: '2023-03-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2024-03-22',
        datePrecision: 'DAY',
        reason: 'On the basis of CLEAR Outcomes, the FDA approved broad new labels for Nexletol (bempedoic acid) and Nexlizet (bempedoic acid/ezetimibe) for cardiovascular risk reduction in both primary and secondary prevention, with or without statins — making them the only non-statin LDL-lowering drugs indicated for primary prevention. The regulatory act settled bempedoic acid as an established cardiovascular-prevention therapy for statin-intolerant patients.',
        source: {
          externalId: 'src:esperion-fda-nexletol-cv-indication-2024',
          name: 'Esperion Therapeutics. U.S. FDA Approves Broad New Labels for NEXLETOL and NEXLIZET to Prevent Heart Attacks and Cardiovascular Procedures in Both Primary and Secondary Prevention Patients, Regardless of Statin Use. Press release, 22 March 2024.',
          url: 'https://www.globenewswire.com/news-release/2024/03/22/2851118/0/en/U-S-FDA-Approves-Broad-New-Labels-for-NEXLETOL-and-NEXLIZET-to-Prevent-Heart-Attacks-and-Cardiovascular-Procedures-in-Both-Primary-and-Secondary-Prevention-Patients-Regardless-of-S.html',
          publishedAt: '2024-03-22',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── REDUCE-IT: icosapent ethyl contested omega-3 benefit 2018 ───────────────
  {
    externalId: 'trajectory:reduce-it-icosapent-ethyl-cv-benefit-contested-2018',
    text: 'On 10 November 2018 the REDUCE-IT trial reported that high-dose icosapent ethyl (purified EPA) reduced major cardiovascular events by 25% in statin-treated patients with elevated triglycerides, a claim the FDA adopted as a cardiovascular indication in December 2019 but which was contested after the 2020 STRENGTH trial found no benefit from a different omega-3 formulation and raised concerns about REDUCE-IT\'s mineral-oil placebo.',
    claimType: 'HYBRID',
    claimEmergedAt: '2018-11-10',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-11-10',
        datePrecision: 'DAY',
        reason: 'The REDUCE-IT trial (8,179 statin-treated patients with elevated triglycerides) found that icosapent ethyl 4 g/day reduced the primary cardiovascular composite from 22.0% to 17.2% (hazard ratio 0.75). After decades of largely null omega-3 trials, this recorded a striking positive cardiovascular result for a purified high-dose EPA formulation, reviving the hypothesis that triglyceride-rich pathways are a modifiable cardiovascular target.',
        source: {
          externalId: 'src:reduce-it-icosapent-ethyl-nejm-2019',
          name: 'Bhatt DL, Steg PG, Miller M, et al. Cardiovascular risk reduction with icosapent ethyl for hypertriglyceridemia (REDUCE-IT). N Engl J Med. 2019;380(1):11-22.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/30415628/',
          publishedAt: '2018-11-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2019-12-13',
        datePrecision: 'DAY',
        reason: 'On the basis of REDUCE-IT, the FDA approved an expanded label for Vascepa (icosapent ethyl) to reduce cardiovascular risk in adults with triglycerides ≥150 mg/dL plus established cardiovascular disease or diabetes and additional risk factors — the first drug approved for cardiovascular risk reduction beyond cholesterol lowering. This institutionally adopted the REDUCE-IT claim into clinical practice.',
        source: {
          externalId: 'src:amarin-fda-vascepa-cv-approval-2019',
          name: 'Amarin Corporation. Amarin Receives FDA Approval of VASCEPA (icosapent ethyl) to Reduce Cardiovascular Risk. Press release, 13 December 2019.',
          url: 'https://www.globenewswire.com/news-release/2019/12/13/1960603/0/en/Amarin-Receives-FDA-Approval-of-VASCEPA-icosapent-ethyl-to-Reduce-Cardiovascular-Risk.html',
          publishedAt: '2019-12-13',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2020-11-15',
        datePrecision: 'DAY',
        reason: 'The STRENGTH trial (13,078 high-risk statin-treated patients) found that a high-dose omega-3 carboxylic acid (EPA+DHA) produced no reduction in cardiovascular events versus a corn-oil comparator (hazard ratio 0.99), directly conflicting with REDUCE-IT. Because STRENGTH used corn oil while REDUCE-IT used mineral oil — which raised LDL and inflammatory markers in the placebo arm — investigators argued REDUCE-IT\'s benefit may have been partly an artifact of a harmful placebo, contesting whether icosapent ethyl\'s effect is genuine.',
        source: {
          externalId: 'src:strength-omega3-corn-oil-jama-2020',
          name: 'Nicholls SJ, Lincoff AM, Garcia M, et al. Effect of high-dose omega-3 fatty acids vs corn oil on major adverse cardiovascular events in patients at high cardiovascular risk (STRENGTH). JAMA. 2020;324(22):2268-2280.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/33190147/',
          publishedAt: '2020-11-15',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── REDUCE-AMI: beta-blockers no benefit preserved EF 2024 ──────────────────
  {
    externalId: 'trajectory:reduce-ami-beta-blockers-preserved-ef-no-benefit-2024',
    text: 'On 7 April 2024 the REDUCE-AMI trial reported that long-term beta-blocker therapy provided no reduction in death or recurrent myocardial infarction in heart-attack survivors with preserved left ventricular ejection fraction, contesting the decades-old doctrine — established in the pre-reperfusion era — that all post-MI patients should receive beta-blockers.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2024-04-07',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'RECORDED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2024-04-07',
        datePrecision: 'DAY',
        reason: 'The REDUCE-AMI trial (5,020 patients with acute MI and preserved ejection fraction ≥50% in the modern reperfusion era) found no difference in the composite of death or new myocardial infarction between beta-blocker and no-beta-blocker groups (hazard ratio 0.96) over a median 3.5 years. This recorded a direct empirical challenge to the routine post-MI beta-blockade standard derived from 1980s trials like BHAT, which predated reperfusion and enrolled patients with larger infarcts and reduced ejection fraction.',
        source: {
          externalId: 'src:reduce-ami-betablockers-nejm-2024',
          name: 'Yndigegn T, Lindahl B, Mars K, et al. Beta-blockers after myocardial infarction and preserved ejection fraction (REDUCE-AMI). N Engl J Med. 2024;390(15):1372-1381.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/38587241/',
          publishedAt: '2024-04-07',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── COMPASS: low-dose rivaroxaban + aspirin stable CAD/PAD 2017 ─────────────
  {
    externalId: 'trajectory:compass-low-dose-rivaroxaban-aspirin-stable-cad-pad-2017',
    text: 'On 27 August 2017 the COMPASS trial reported that adding low-dose rivaroxaban (2.5 mg twice daily) to aspirin reduced cardiovascular death, stroke, and myocardial infarction in patients with stable coronary or peripheral artery disease, establishing dual antithrombotic therapy as a new option for secondary prevention.',
    claimType: 'HYBRID',
    claimEmergedAt: '2017-08-27',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-08-27',
        datePrecision: 'DAY',
        reason: 'The COMPASS trial (27,395 patients with stable atherosclerotic disease) was stopped early when rivaroxaban 2.5 mg twice daily plus aspirin reduced the primary composite of cardiovascular death, stroke, or MI by 24% (hazard ratio 0.76) versus aspirin alone, at the cost of more major bleeding. This recorded the claim that a \'vascular dose\' of a direct oral anticoagulant added to aspirin improves outcomes in stable CAD/PAD — a distinct indication from the atrial-fibrillation use that defined the DOAC class.',
        source: {
          externalId: 'src:compass-rivaroxaban-aspirin-nejm-2017',
          name: 'Eikelboom JW, Connolly SJ, Bosch J, et al. Rivaroxaban with or without aspirin in stable cardiovascular disease (COMPASS). N Engl J Med. 2017;377(14):1319-1330.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/28844192/',
          publishedAt: '2017-08-27',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2018-10-11',
        datePrecision: 'DAY',
        reason: 'On the basis of COMPASS, the FDA approved rivaroxaban 2.5 mg twice daily with low-dose aspirin to reduce the risk of major cardiovascular events in patients with chronic coronary or peripheral artery disease — the first and only oral anticoagulant indicated for this secondary-prevention use. The regulatory act settled low-dose rivaroxaban-plus-aspirin as an established therapeutic option for stable atherosclerotic disease.',
        source: {
          externalId: 'src:fda-xarelto-cad-pad-approval-2018',
          name: 'Janssen/Johnson & Johnson. U.S. FDA Approves XARELTO (rivaroxaban) to Reduce the Risk of Major Cardiovascular Events in Patients with Chronic Coronary Artery Disease (CAD) or Peripheral Artery Disease (PAD). Press release, 11 October 2018.',
          url: 'https://www.prnewswire.com/news-releases/us-fda-approves-xarelto-rivaroxaban-to-reduce-the-risk-of-major-cardiovascular-events-in-patients-with-chronic-coronary-artery-disease-cad-or-peripheral-artery-disease-pad-300729832.html',
          publishedAt: '2018-10-11',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // GERM THEORY & INFECTIOUS DISEASE ERA (1885–1933)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Pasteur rabies vaccine — Joseph Meister 1885 ────────────────────────────
  {
    externalId: 'trajectory:pasteur-rabies-vaccine-joseph-meister-1885',
    text: 'Louis Pasteur demonstrated that a post-exposure series of attenuated spinal-cord inoculations could prevent rabies in a bitten human, first treating nine-year-old Joseph Meister beginning July 6, 1885.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1885-07-06',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1885-10-26',
        datePrecision: 'DAY',
        reason: 'Having treated Joseph Meister (bitten 14 times by a rabid dog) from July 6, 1885 with 13 progressively more virulent injections of dried rabbit spinal cord, Pasteur reported the boy\'s survival to the Académie des sciences on October 26, 1885 in \'Méthode pour prévenir la rage après morsure.\' This was the first recorded demonstration of post-exposure immunoprophylaxis in a human and the birth of the modern era of vaccination beyond Jenner\'s cowpox.',
        source: {
          externalId: 'src:pasteur-rage-cr-acad-sci-1885',
          name: 'Pasteur L. Méthode pour prévenir la rage après morsure. Comptes rendus hebdomadaires des séances de l\'Académie des sciences. 1885;101:765–774.',
          url: 'https://www.pasteur.fr/en/research-journal/news/history-first-rabies-vaccination-1885',
          publishedAt: '1885-10-26',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1888-11-14',
        datePrecision: 'DAY',
        reason: 'After Pasteur reported in March 1886 that of some 350 bitten patients treated only one had died, public subscription funded the Institut Pasteur, inaugurated November 14, 1888, as a dedicated rabies-treatment and research institution. Institutional establishment and the worldwide replication of Pasteur clinics settled post-exposure rabies vaccination as accepted practice.',
        source: {
          externalId: 'src:institut-pasteur-founding-1888',
          name: 'Institut Pasteur. The final years 1877–1887 and the founding of the Institut Pasteur (inaugurated 14 November 1888).',
          url: 'https://www.pasteur.fr/en/institut-pasteur/history/troisieme-epoque-1877-1887',
          publishedAt: '1888-11-14',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Behring & Kitasato diphtheria/tetanus antitoxin — 1890 ─────────────────
  {
    externalId: 'trajectory:behring-kitasato-diphtheria-tetanus-antitoxin-1890',
    text: 'Emil von Behring and Kitasato Shibasaburō demonstrated that serum from animals immunized against tetanus and diphtheria toxin could transfer protection to other animals, founding serum therapy (antitoxin), published December 1890.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1890-12-04',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1890-12-04',
        datePrecision: 'DAY',
        reason: 'In the December 4, 1890 issue of the Deutsche Medizinische Wochenschrift, Behring and Kitasato reported that blood serum from animals rendered immune to tetanus toxin could neutralize the toxin and protect naive animals; Behring extended the finding to diphtheria one week later. This first demonstrated humoral (antitoxin) immunity and launched serum therapy as a recordable therapeutic principle.',
        source: {
          externalId: 'src:behring-kitasato-dmw-1890',
          name: 'von Behring E, Kitasato S. Ueber das Zustandekommen der Diphtherie-Immunität und der Tetanus-Immunität bei Thieren. Deutsche Medizinische Wochenschrift. 1890;16(49):1113–1114.',
          url: 'https://www.nobelprize.org/prizes/medicine/1901/behring/article/',
          publishedAt: '1890-12-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1901-12-10',
        datePrecision: 'DAY',
        reason: 'After Émile Roux\'s 1894 clinical confirmation and the rapid worldwide adoption of diphtheria antitoxin (sharply cutting case-fatality), Behring received the inaugural Nobel Prize in Physiology or Medicine on December 10, 1901 \'for his work on serum therapy, especially its application against diphtheria.\' The award marked institutional settlement of antitoxin therapy as established medicine.',
        source: {
          externalId: 'src:nobel-behring-1901',
          name: 'The Nobel Prize in Physiology or Medicine 1901: Emil Adolf von Behring — \'for his work on serum therapy, especially its application against diphtheria.\'',
          url: 'https://www.nobelprize.org/prizes/medicine/1901/behring/article/',
          publishedAt: '1901-12-10',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Walter Reed yellow fever mosquito vector — 1900 ─────────────────────────
  {
    externalId: 'trajectory:walter-reed-yellow-fever-mosquito-vector-1900',
    text: 'The U.S. Army Yellow Fever Commission led by Walter Reed demonstrated that yellow fever is transmitted by the Aedes aegypti mosquito rather than by fomites or filth, reported in a preliminary note read October 23, 1900.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1900-10-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1900-10-23',
        datePrecision: 'DAY',
        reason: 'Reed, Carroll, Agramonte, and Lazear, testing Carlos Finlay\'s mosquito hypothesis in Cuba, found that volunteers developed yellow fever only after bites from mosquitoes that had fed on patients 12+ days earlier. Their preliminary note was read to the American Public Health Association on October 23, 1900 and published days later, recording the mosquito-vector claim against the entrenched fomite/filth theory.',
        source: {
          externalId: 'src:reed-etiology-yellow-fever-preliminary-1900',
          name: 'Reed W, Carroll J, Agramonte A, Lazear JW. The etiology of yellow fever: a preliminary note. Philadelphia Medical Journal. 1900 Oct 27;6:790–796.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/30327122/',
          publishedAt: '1900-10-27',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1901-02-16',
        datePrecision: 'DAY',
        reason: 'Controlled experiments at Camp Lazear (with screened huts isolating mosquito bites from contaminated fomites) confirmed the vector, published as \'an additional note\' in JAMA on February 16, 1901. William Gorgas\'s mosquito-control campaign in Havana in 1901 then eliminated yellow fever from the city, operationally validating the theory and settling it as the basis for vector control (and later the Panama Canal sanitation).',
        source: {
          externalId: 'src:reed-etiology-yellow-fever-additional-1901',
          name: 'Reed W, Carroll J, Agramonte A. The etiology of yellow fever: an additional note. JAMA. 1901;36(7):431–440.',
          url: 'https://armyhistory.org/major-walter-reed-and-the-eradication-of-yellow-fever/',
          publishedAt: '1901-02-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Goldberger pellagra dietary not infectious — 1914 ───────────────────────
  {
    externalId: 'trajectory:goldberger-pellagra-dietary-not-infectious-1914',
    text: 'Joseph Goldberger of the U.S. Public Health Service concluded that pellagra is a disease of dietary deficiency rather than a communicable infection, reported in Public Health Reports on June 26, 1914.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1914-06-26',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1914-06-26',
        datePrecision: 'DAY',
        reason: 'In \'The etiology of pellagra,\' Goldberger argued from epidemiological observation (the disease struck inmates and patients but spared staff at the same institutions) that pellagra was dietary, not infectious — directly contradicting the prevailing infectious-disease consensus championed by the Thompson-McFadden Commission. The claim entered the literature as a hypothesis against the dominant germ-theory view.',
        source: {
          externalId: 'src:goldberger-etiology-pellagra-1914',
          name: 'Goldberger J. The etiology of pellagra. The significance of certain epidemiological observations with respect thereto. Public Health Reports. 1914;29(26):1683–1686. (PMID 808825)',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1437745/',
          publishedAt: '1914-06-26',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1915-11-01',
        datePrecision: 'MONTH',
        reason: 'Goldberger and Wheeler induced pellagra in eleven previously healthy Mississippi convict volunteers fed a restricted corn-based diet (announced via Public Health Reports in late 1915), providing experimental causal proof that diet — not contagion — produces the disease. The controlled induction shifted expert opinion away from the infectious theory; the dietary etiology was definitively mechanized when Elvehjem identified nicotinic acid (niacin) as the missing factor in 1937.',
        source: {
          externalId: 'src:harkness-prisoners-pellagra-1996',
          name: 'Harkness JM. Prisoners and pellagra. Public Health Reports. 1996;111(5):463–467 (documenting Goldberger\'s 1915 convict-diet experiment at Rankin Prison Farm).',
          url: 'https://stacks.cdc.gov/view/cdc/64410',
          publishedAt: '1996-09-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Smith, Andrewes & Laidlaw influenza virus isolation — 1933 ──────────────
  {
    externalId: 'trajectory:smith-andrewes-laidlaw-influenza-virus-isolation-1933',
    text: 'Wilson Smith, Christopher Andrewes, and Patrick Laidlaw isolated a filterable virus from human influenza patients and transmitted it to ferrets, establishing that influenza is caused by a virus, published in The Lancet on July 8, 1933.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1933-07-08',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1933-07-08',
        datePrecision: 'DAY',
        reason: 'Filtering bacteria from throat washings of influenza patients and instilling the cell-free filtrate into ferrets reproduced influenza, demonstrating a filterable viral agent. Published in The Lancet (\'A virus obtained from influenza patients\'), the result overturned the decades-old belief — dating to Pfeiffer\'s 1892 \'Bacillus influenzae\' — that influenza was a bacterial disease, recording its true viral etiology.',
        source: {
          externalId: 'src:smith-andrewes-laidlaw-lancet-1933',
          name: 'Smith W, Andrewes CH, Laidlaw PP. A virus obtained from influenza patients. The Lancet. 1933;222(5732):66–68.',
          url: 'https://www.sciencedirect.com/science/article/pii/S0140673600785412',
          publishedAt: '1933-07-08',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1945-01-01',
        datePrecision: 'YEAR',
        reason: 'The viral etiology was rapidly replicated, the virus was propagated in embryonated hens\' eggs (Burnet, 1936), and influenza B was identified (Francis, 1940). This culminated in the first inactivated influenza vaccine licensed for U.S. military use in 1945, institutionally settling influenza as a vaccine-preventable viral disease and definitively closing out the bacterial theory.',
        source: {
          externalId: 'src:who-history-influenza-vaccination',
          name: 'World Health Organization. History of influenza vaccination.',
          url: 'https://www.who.int/news-room/spotlight/history-of-vaccination/history-of-influenza-vaccination',
          publishedAt: '2024-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PSYCHOPHARMACOLOGY ERA (1949–1990)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Lithium for mania — Cade 1949 ───────────────────────────────────────────
  {
    externalId: 'trajectory:cade-lithium-mania-1949',
    text: 'On 3 September 1949, Australian psychiatrist John Cade reported in the Medical Journal of Australia that lithium salts calmed and often resolved psychotic excitement in patients with mania, introducing the first effective pharmacological treatment for manic illness.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1949-09-03',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1949-09-03',
        datePrecision: 'DAY',
        reason: 'Cade, working at Bundoora Repatriation Mental Hospital in Melbourne, treated ten manic patients with lithium citrate and carbonate and observed that several previously chronic, agitated patients became calm enough for discharge. His paper \'Lithium salts in the treatment of psychotic excitement\' recorded the first claim that a simple ion could specifically treat a major psychiatric illness, predating chlorpromazine and helping launch psychopharmacology.',
        source: {
          externalId: 'src:cade-lithium-psychotic-excitement-1949',
          name: 'Cade JFJ. Lithium salts in the treatment of psychotic excitement. Med J Aust. 1949;2(10):349–52. (Reprinted Bull World Health Organ. 2000;78(4):518–20.)',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2560740/',
          publishedAt: '1949-09-03',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1970-04-06',
        datePrecision: 'DAY',
        reason: 'After Mogens Schou\'s controlled trials in the 1950s–60s confirmed lithium\'s antimanic and prophylactic efficacy, the U.S. FDA approved lithium carbonate for acute mania on 6 April 1970 (and for maintenance therapy in 1974). Regulatory approval and global clinical adoption settled lithium as the standard mood-stabilizing treatment for bipolar disorder, a status it retains.',
        source: {
          externalId: 'src:wikipedia-lithium-medication-history',
          name: 'Lithium (medication). Wikipedia (history and medical use sections).',
          url: 'https://en.wikipedia.org/wiki/Lithium_(medication)',
          publishedAt: '2026-06-18',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Iproniazid first MAOI antidepressant — 1957 ──────────────────────────────
  {
    externalId: 'trajectory:iproniazid-first-maoi-antidepressant-1957',
    text: 'In December 1957, Harry Loomer, John Saunders, and Nathan Kline reported in Psychiatric Research Reports that the antitubercular drug iproniazid (Marsilid), a monoamine oxidase inhibitor, acted as a \'psychic energizer\' that lifted mood in depressed patients — establishing the first MAOI antidepressant, a claim later reversed for iproniazid itself.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1957-12-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1957-12-01',
        datePrecision: 'MONTH',
        reason: 'Loomer, Saunders, and Kline published \'A clinical and pharmacodynamic evaluation of iproniazid as a psychic energizer,\' reporting that iproniazid energized rather than sedated withdrawn, depressed patients. This recorded the first claim that monoamine oxidase inhibition could treat depression, founding the MAOI antidepressant class alongside Kuhn\'s contemporaneous tricyclic work.',
        source: {
          externalId: 'src:loomer-saunders-kline-iproniazid-1957',
          name: 'Loomer HP, Saunders JC, Kline NS. A clinical and pharmacodynamic evaluation of iproniazid as a psychic energizer. Psychiatr Res Rep Am Psychiatr Assoc. 1957;8:129–41.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13542681/',
          publishedAt: '1957-12-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'MARKET',
        occurredAt: '1961-01-01',
        datePrecision: 'YEAR',
        reason: 'Iproniazid was widely prescribed as an antidepressant after 1957, but mounting reports of severe, sometimes fatal hepatotoxicity (drug-induced hepatitis) led to its withdrawal from the U.S. market in 1961. While MAO inhibition as an antidepressant principle survived in safer successors, the specific claim that iproniazid was an acceptable antidepressant was reversed on safety grounds.',
        source: {
          externalId: 'src:lopez-munoz-history-antidepressants-2009',
          name: 'López-Muñoz F, Alamo C. Monoaminergic neurotransmission: the history of the discovery of antidepressants from 1950s until today. Curr Pharm Des. 2009;15(14):1563–86.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3136031/',
          publishedAt: '2009-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── APA removes homosexuality from DSM — 1952 & 1973 ────────────────────────
  {
    externalId: 'trajectory:apa-homosexuality-removed-dsm-1973',
    text: 'Homosexuality, classified as a sociopathic personality disturbance and mental disorder in DSM-I (1952) and DSM-II (1968), was a psychiatric claim reversed when the American Psychiatric Association\'s Board of Trustees voted on 15 December 1973 to remove homosexuality per se from the diagnostic manual.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1952-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1952-01-01',
        datePrecision: 'YEAR',
        reason: 'The American Psychiatric Association\'s first Diagnostic and Statistical Manual (DSM-I, 1952) listed homosexuality as a \'sociopathic personality disturbance,\' carried forward in DSM-II (1968). This institutionally settled the classification of homosexuality as a mental disorder within mainstream American psychiatry.',
        source: {
          externalId: 'src:drescher-out-of-dsm-2015',
          name: 'Drescher J. Out of DSM: Depathologizing Homosexuality. Behav Sci (Basel). 2015;5(4):565–75.',
          url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4695779/',
          publishedAt: '2015-12-04',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '1973-12-15',
        datePrecision: 'DAY',
        reason: 'After activist pressure and Robert Spitzer\'s review of the evidence that homosexuality met no clinical criterion for disorder in well-functioning individuals, the APA Board of Trustees voted on 15 December 1973 to delete homosexuality from DSM-II, replacing it with \'sexual orientation disturbance\' (a referendum of the membership upheld the decision in 1974). This reversed a two-decade institutional classification and is a landmark instance of medical depathologization.',
        source: {
          externalId: 'src:pace-spitzer-depathologization-2024',
          name: 'Pace G. R. Spitzer and the depathologization of homosexuality: some considerations on the 50th anniversary. (PMC) 2024.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11083874/',
          publishedAt: '2024-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Clozapine for treatment-resistant schizophrenia — 1988 ──────────────────
  {
    externalId: 'trajectory:clozapine-treatment-resistant-schizophrenia-1988',
    text: 'On publication in September 1988 (Archives of General Psychiatry), John Kane and colleagues reported that clozapine was significantly more effective than chlorpromazine in treatment-resistant schizophrenia, establishing clozapine\'s unique efficacy and reviving a drug withdrawn after agranulocytosis deaths.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1988-09-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1988-09-01',
        datePrecision: 'MONTH',
        reason: 'Clozapine had been largely abandoned after a 1975 cluster of fatal agranulocytosis cases in Finland. Kane, Honigfeld, Singer, and Meltzer\'s double-blind multicenter trial of 268 treatment-resistant patients found 30% responded to clozapine versus 4% to chlorpromazine, recording the claim that clozapine had unique efficacy where other antipsychotics failed and justifying its use under hematologic monitoring.',
        source: {
          externalId: 'src:kane-clozapine-treatment-resistant-1988',
          name: 'Kane J, Honigfeld G, Singer J, Meltzer H. Clozapine for the treatment-resistant schizophrenic. A double-blind comparison with chlorpromazine. Arch Gen Psychiatry. 1988;45(9):789–96.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/3046553/',
          publishedAt: '1988-09-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1989-09-26',
        datePrecision: 'DAY',
        reason: 'On 26 September 1989 the U.S. FDA approved clozapine (Clozaril, NDA 019758) for treatment-resistant schizophrenia, conditioned on mandatory weekly white-blood-cell monitoring to detect agranulocytosis. The approval institutionally settled clozapine as the benchmark agent for refractory schizophrenia and established the model of risk-managed reintroduction of a previously withdrawn drug.',
        source: {
          externalId: 'src:fda-clozaril-nda019758-1989',
          name: 'U.S. FDA. CLOZARIL (clozapine) NDA 019758, original approval 26 September 1989. Drugs@FDA / FDA label history.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2017/019758s084lbl.pdf',
          publishedAt: '1989-09-26',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // DIABETES & METABOLIC DISEASE ERA (1993–2010)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── DCCT intensive glycemic control type 1 diabetes — 1993 ──────────────────
  {
    externalId: 'trajectory:dcct-intensive-glycemic-control-type1-1993',
    text: 'The Diabetes Control and Complications Trial (DCCT) Research Group reported in the New England Journal of Medicine on 30 September 1993 that intensive insulin therapy aimed at near-normal blood glucose substantially reduces the development and progression of retinopathy, nephropathy, and neuropathy in type 1 diabetes, proving that microvascular complications are driven by hyperglycemia.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1993-09-30',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1993-09-30',
        datePrecision: 'DAY',
        reason: 'The DCCT, a randomized controlled trial in 1,441 type 1 diabetes patients followed a mean 6.5 years, found intensive therapy reduced the risk of clinically meaningful retinopathy by 76% in primary prevention and slowed established retinopathy progression by 54%, with parallel reductions in nephropathy and neuropathy. The landmark trial definitively settled the long-debated \'glucose hypothesis,\' establishing in the expert literature that tight glycemic control prevents microvascular complications — at the cost of a two-to-threefold increase in severe hypoglycemia.',
        source: {
          externalId: 'src:dcct-intensive-therapy-nejm-1993',
          name: 'The Diabetes Control and Complications Trial Research Group. The effect of intensive treatment of diabetes on the development and progression of long-term complications in insulin-dependent diabetes mellitus. N Engl J Med. 1993;329(14):977-986.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8366922/',
          publishedAt: '1993-09-30',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Metformin (Glucophage) U.S. FDA approval — 1994 ─────────────────────────
  {
    externalId: 'trajectory:metformin-glucophage-us-approval-1994',
    text: 'Metformin (Glucophage), a biguanide oral antihyperglycemic used in Europe since the late 1950s but long kept out of the United States over biguanide lactic-acidosis fears, was approved by the FDA for type 2 diabetes on 29 December 1994, establishing it on the U.S. regulatory record as a safe and effective therapy.',
    claimType: 'HYBRID',
    claimEmergedAt: '1994-12-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1994-12-29',
        datePrecision: 'DAY',
        reason: 'The FDA approved metformin hydrochloride (Glucophage, NDA 020357, Bristol-Myers Squibb) for type 2 diabetes, with U.S. marketing beginning March 1995. Approval ended decades of American absence of the biguanide class — driven by the lactic-acidosis deaths that had led to phenformin\'s U.S. withdrawal in 1977 — and recorded institutionally that metformin\'s safety profile was distinct and acceptable; it subsequently became the first-line oral agent for type 2 diabetes worldwide.',
        source: {
          externalId: 'src:fda-glucophage-metformin-nda-020357-1994',
          name: 'U.S. FDA Center for Drug Evaluation and Research. Drug Approval Package, NDA 020357, GLUCOPHAGE (metformin hydrochloride) Tablets. 29 December 1994.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/nda/pre96/020357Orig1s000rev.pdf',
          publishedAt: '1994-12-29',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Exenatide (Byetta) first GLP-1 receptor agonist — 2005 ──────────────────
  {
    externalId: 'trajectory:exenatide-byetta-first-glp1-agonist-2005',
    text: 'Exenatide (Byetta), a synthetic analogue of a Gila monster venom peptide and the first glucagon-like peptide-1 (GLP-1) receptor agonist, was established as an effective new class of type 2 diabetes therapy by pivotal trials beginning in 2004 and approved by the FDA on 28 April 2005.',
    claimType: 'HYBRID',
    claimEmergedAt: '2004-11-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2004-11-01',
        datePrecision: 'MONTH',
        reason: 'Buse and colleagues published the first of the pivotal AMIGO trials in Diabetes Care, a 30-week triple-blind placebo-controlled study at 101 U.S. sites showing that exenatide lowered HbA1c by up to 0.86% in sulfonylurea-treated type 2 diabetes patients with modest weight loss. This recorded in the expert literature the efficacy of the first incretin-mimetic GLP-1 receptor agonist, a mechanistically novel drug class.',
        source: {
          externalId: 'src:buse-exenatide-sulfonylurea-diabetes-care-2004',
          name: 'Buse JB, Henry RR, Han J, et al. Effects of exenatide (exendin-4) on glycemic control over 30 weeks in sulfonylurea-treated patients with type 2 diabetes. Diabetes Care. 2004;27(11):2628-2635.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15504997/',
          publishedAt: '2004-11-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2005-04-28',
        datePrecision: 'DAY',
        reason: 'The FDA approved exenatide (Byetta, NDA 021773, Amylin/Eli Lilly) as adjunctive therapy for type 2 diabetes inadequately controlled on metformin, a sulfonylurea, or both — the first approval of a GLP-1 receptor agonist. The decision established the incretin-mimetic class on the regulatory record and opened the therapeutic lineage that later produced liraglutide and semaglutide.',
        source: {
          externalId: 'src:fda-byetta-exenatide-label-2005',
          name: 'U.S. FDA. BYETTA (exenatide) injection — Original FDA-approved label, NDA 021773. 2005.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2005/021773lbl.pdf',
          publishedAt: '2005-04-28',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Sibutramine (Meridia) cardiovascular withdrawal — 2010 ──────────────────
  {
    externalId: 'trajectory:sibutramine-meridia-cardiovascular-withdrawal-2010',
    text: 'The claim that sibutramine (Meridia), the serotonin-norepinephrine reuptake inhibitor appetite suppressant approved by the FDA on 22 November 1997 for weight loss, was a safe long-term obesity treatment was reversed when the SCOUT trial showed it increased cardiovascular events and Abbott withdrew it from the U.S. market on 8 October 2010.',
    claimType: 'HYBRID',
    claimEmergedAt: '1997-11-22',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1997-11-22',
        datePrecision: 'DAY',
        reason: 'The FDA approved sibutramine (Meridia, NDA 020632) for the management of obesity, including weight loss and maintenance, in patients with a BMI ≥30 or ≥27 with cardiovascular risk factors. Approval established the drug on the regulatory record as a safe, effective anti-obesity agent despite a divided advisory committee and a reviewing medical officer\'s concern about its blood-pressure and heart-rate effects.',
        source: {
          externalId: 'src:fda-meridia-sibutramine-approval-1997',
          name: 'U.S. FDA Center for Drug Evaluation and Research. Approval Letter, NDA 020632, MERIDIA (sibutramine hydrochloride monohydrate) Capsules. 22 November 1997.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/nda/97/020632a_apltr_thr_%20mor.pdf',
          publishedAt: '1997-11-22',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2010-09-02',
        datePrecision: 'DAY',
        reason: 'The Sibutramine Cardiovascular Outcomes (SCOUT) trial, a randomized study of 10,744 overweight/obese subjects aged 55+ with pre-existing cardiovascular disease or type 2 diabetes, reported in the NEJM that sibutramine significantly increased the risk of nonfatal myocardial infarction and nonfatal stroke. The first large cardiovascular-outcomes trial of the drug directly contested its long-term safety in the population most likely to use it.',
        source: {
          externalId: 'src:scout-sibutramine-cardiovascular-nejm-2010',
          name: 'James WPT, Caterson ID, Coutinho W, et al. Effect of sibutramine on cardiovascular outcomes in overweight and obese subjects. N Engl J Med. 2010;363(10):905-917.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/20818901/',
          publishedAt: '2010-09-02',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2010-10-08',
        datePrecision: 'DAY',
        reason: 'At the FDA\'s request, Abbott Laboratories voluntarily withdrew Meridia from the U.S. market on 8 October 2010 in light of the SCOUT cardiovascular findings, a decision formalized by the FDA\'s withdrawal of approval of NDA 020632 published in the Federal Register on 21 December 2010. The action repudiated the drug\'s safety premise and removed the last centrally-acting prescription obesity drug of its era from the market.',
        source: {
          externalId: 'src:fda-meridia-nda-withdrawal-fr-2010',
          name: 'U.S. FDA. Abbott Laboratories, Inc.; Withdrawal of Approval of a New Drug Application for MERIDIA. Federal Register, Vol. 75, No. 244. 21 December 2010.',
          url: 'https://www.govinfo.gov/content/pkg/FR-2010-12-21/pdf/2010-31986.pdf',
          publishedAt: '2010-12-21',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // OPIOID EPIDEMIC ERA (2011–2024)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── SPACE trial: opioids not superior for chronic pain — Krebs 2018 ─────────
  {
    externalId: 'trajectory:krebs-space-trial-opioids-not-superior-chronic-pain-2018',
    text: 'Erin Krebs and colleagues reported in JAMA on March 6, 2018, that in the SPACE randomized clinical trial of 240 Veterans Affairs patients with chronic back pain or hip/knee osteoarthritis pain, opioid therapy was not superior to nonopioid medications for improving pain-related function over 12 months.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2018-03-06',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-03-06',
        datePrecision: 'DAY',
        reason: 'Krebs et al. published the SPACE trial in JAMA, the first pragmatic randomized trial directly comparing opioid to nonopioid medication regimens for chronic musculoskeletal pain over 12 months. It found opioids were not superior on pain-related function and produced worse pain intensity and more adverse effects, entering the literature as direct experimental evidence against the long-standing clinical premise that opioids are uniquely effective for chronic non-cancer pain.',
        source: {
          externalId: 'src:krebs-space-jama-2018',
          name: 'Krebs EE, Gravely A, Nugent S, et al. Effect of Opioid vs Nonopioid Medications on Pain-Related Function in Patients With Chronic Back Pain or Hip or Knee Osteoarthritis Pain: The SPACE Randomized Clinical Trial. JAMA. 2018 Mar 6;319(9):872-882.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/29509867/',
          publishedAt: '2018-03-06',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2022-11-03',
        datePrecision: 'DAY',
        reason: 'The CDC\'s 2022 Clinical Practice Guideline for Prescribing Opioids for Pain cited SPACE among the evidence supporting nonopioid therapies as at least as effective as opioids for many chronic pain conditions, institutionally ratifying the trial\'s finding. The experimental result was thereby absorbed into national prescribing doctrine rather than remaining a contested single study.',
        source: {
          externalId: 'src:cdc-opioid-guideline-mmwr-2022-space',
          name: 'Dowell D, Ragan KR, Jones CM, Baldwin GT, Chou R. CDC Clinical Practice Guideline for Prescribing Opioids for Pain — United States, 2022. MMWR Recomm Rep. 2022;71(3):1-95.',
          url: 'https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm',
          publishedAt: '2022-11-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Opana ER reformulation approved then removed — 2011–2020 ────────────────
  {
    externalId: 'trajectory:opana-er-reformulation-removed-abuse-2011',
    text: 'The FDA approved Endo Pharmaceuticals\' reformulated Opana ER (oxymorphone hydrochloride extended-release, NDA 201655) on December 9, 2011, with physicochemical properties intended to resist crushing for abuse by snorting and injection — a benefit premise the agency repudiated on June 8, 2017, when it requested the drug\'s removal as the first marketed opioid pulled for the public-health consequences of abuse.',
    claimType: 'HYBRID',
    claimEmergedAt: '2011-12-09',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2011-12-09',
        datePrecision: 'DAY',
        reason: 'The FDA approved reformulated Opana ER under NDA 201655, engineered to be resistant to physical and chemical manipulation for abuse. Although the FDA declined Endo\'s request for abuse-deterrent labeling, the product was marketed as a safer crush-resistant reformulation and replaced the original tablets, establishing the reformulation as a net-beneficial product.',
        source: {
          externalId: 'src:fr-opana-nda-201655-withdrawal-2020',
          name: 'FDA. Endo Pharmaceuticals, Inc.; Withdrawal of Approval of a New Drug Application for OPANA (Oxymorphone Hydrochloride) Extended-Release Tablets. Fed. Reg. 85(247), Dec. 23, 2020.',
          url: 'https://www.federalregister.gov/documents/2020/12/23/2020-28283/endo-pharmaceuticals-inc-withdrawal-of-approval-of-a-new-drug-application-for-opana-oxymorphone',
          publishedAt: '2020-12-23',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2017-06-08',
        datePrecision: 'DAY',
        reason: 'The FDA requested that Endo remove reformulated Opana ER from the market, finding that the benefits no longer outweighed the risks. Postmarketing data showed the reformulation shifted abuse from nasal to injection, associated with an HIV and hepatitis C outbreak (Scott County, Indiana) and cases of thrombotic microangiopathy. It was the first time the agency sought removal of a currently marketed opioid for the public-health consequences of abuse, reversing the reformulation\'s net-benefit premise.',
        source: {
          externalId: 'src:fda-opana-removal-request-2017',
          name: 'FDA. FDA requests removal of Opana ER for risks related to abuse. News announcement, June 8, 2017 (reproduced by HIV.gov).',
          url: 'https://www.hiv.gov/blog/fda-requests-removal-opana-er-risks-related-abuse',
          publishedAt: '2017-06-08',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'REVERSED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2020-12-23',
        datePrecision: 'DAY',
        reason: 'The FDA formally withdrew approval of NDA 201655 for Opana ER in the Federal Register, completing the administrative reversal after Endo voluntarily ceased marketing in 2017. The product\'s regulatory existence was extinguished, confirming the repudiation of the reformulated drug\'s benefit-risk profile.',
        source: {
          externalId: 'src:fr-opana-nda-withdrawal-final-2020',
          name: 'FDA. Endo Pharmaceuticals, Inc.; Withdrawal of Approval of a New Drug Application for OPANA (Oxymorphone Hydrochloride) Extended-Release Tablets. Fed. Reg. 85(247), Dec. 23, 2020.',
          url: 'https://www.federalregister.gov/documents/2020/12/23/2020-28283/endo-pharmaceuticals-inc-withdrawal-of-approval-of-a-new-drug-application-for-opana-oxymorphone',
          publishedAt: '2020-12-23',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Zohydro ER approved over advisory committee 11-2 vote — 2013 ─────────────
  {
    externalId: 'trajectory:zohydro-er-fda-approval-over-advisory-committee-2013',
    text: 'The FDA approved Zogenix\'s Zohydro ER (extended-release hydrocodone bitartrate, NDA 202880) on October 25, 2013 — the first single-entity, long-acting hydrocodone product without acetaminophen — over the 11-to-2 vote of its own Anesthetic and Analgesic Drug Products Advisory Committee against approval.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2013-10-25',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2013-10-25',
        datePrecision: 'DAY',
        reason: 'The FDA approved Zohydro ER as having a favorable benefit-risk profile for around-the-clock management of severe pain, overruling its own advisory committee, which had voted 11-2 against approval amid the prescription-opioid overdose epidemic. The approval institutionally established the drug as safe and effective despite expert-panel dissent.',
        source: {
          externalId: 'src:manchikanti-zohydro-pain-physician-2014',
          name: 'Manchikanti L, Atluri S, Candido KD, et al. Zohydro approval by Food and Drug Administration: controversial or frightening? Pain Physician. 2014 Jul-Aug;17(4):E437-E450.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/25054396/',
          publishedAt: '2014-07-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2014-07-01',
        datePrecision: 'MONTH',
        reason: 'Pain specialists publicly challenged the FDA\'s benefit-risk determination in Pain Physician, arguing that approving a high-dose, non-abuse-deterrent hydrocodone product against the advisory panel\'s 11-2 recommendation and amid an escalating overdose epidemic was unjustified. Combined with state and congressional opposition, the approval\'s safety premise became formally contested rather than settled.',
        source: {
          externalId: 'src:manchikanti-zohydro-contested-2014',
          name: 'Manchikanti L, Atluri S, Candido KD, et al. Zohydro approval by Food and Drug Administration: controversial or frightening? Pain Physician. 2014 Jul-Aug;17(4):E437-E450.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/25054396/',
          publishedAt: '2014-07-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── DATA-Waiver (X-waiver) eliminated — MAT Act 2022 ────────────────────────
  {
    externalId: 'trajectory:data-waiver-x-waiver-eliminated-mat-act-2022',
    text: 'Section 1262 of the Consolidated Appropriations Act, 2023, signed December 29, 2022, eliminated the federal DATA-Waiver (\'X-waiver\') requirement, allowing any clinician with a Schedule III DEA registration to prescribe buprenorphine for opioid use disorder without the special waiver and patient caps that had governed office-based treatment since the Drug Addiction Treatment Act of 2000.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2022-12-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2022-12-29',
        datePrecision: 'DAY',
        reason: 'Congress enacted the Mainstreaming Addiction Treatment (MAT) Act within the Consolidated Appropriations Act, 2023, removing the DATA-2000 waiver, the Notice of Intent, and per-prescriber patient caps for buprenorphine. The reversal repudiated two decades of gatekeeping premised on the idea that office-based opioid-dependence treatment required special restriction, reclassifying buprenorphine for OUD as an ordinary Schedule III prescribing activity.',
        source: {
          externalId: 'src:samhsa-mat-act-waiver-elimination',
          name: 'SAMHSA. Waiver Elimination (MAT Act). Statutes, Regulations, and Guidelines.',
          url: 'https://www.samhsa.gov/substance-use/treatment/statutes-regulations-guidelines/mat-act',
          publishedAt: '2023-01-03',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2023-01-01',
        datePrecision: 'MONTH',
        reason: 'The DEA operationalized the change in a Dear Registrant letter notifying practitioners that an X-waiver was no longer required to prescribe buprenorphine for opioid use disorder and that DATA-Waiver registration numbers would no longer be issued. The statutory reversal was thereby implemented across the federal controlled-substance registration system.',
        source: {
          externalId: 'src:dea-dear-registrant-x-waiver-2023',
          name: 'DEA Diversion Control Division. Dear Registrant Letter on Elimination of the DATA-Waiver (X-Waiver) Requirement (A-23-0020).',
          url: 'https://www.deadiversion.usdoj.gov/pubs/docs/A-23-0020-Dear-Registrant-Letter-Signed.pdf',
          publishedAt: '2023-01-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Pharmacy public-nuisance opioid verdict — MDL 2021 / Ohio Supreme Court 2024
  {
    externalId: 'trajectory:pharmacy-public-nuisance-opioid-verdict-mdl-2021',
    text: 'A federal jury in the National Prescription Opiate Litigation (MDL 2804) found on November 23, 2021, that CVS, Walgreens, and Walmart had created a public nuisance by recklessly dispensing prescription opioids in Lake and Trumbull Counties, Ohio — the first trial verdict holding retail pharmacy chains liable for the opioid epidemic — a public-nuisance theory the Ohio Supreme Court later held barred by state product-liability law.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2021-11-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'JUDICIAL',
        occurredAt: '2021-11-23',
        datePrecision: 'DAY',
        reason: 'After a six-week trial in the federal opioid MDL before Judge Dan Aaron Polster, a jury found that CVS, Walgreens, and Walmart failed to maintain effective controls and created a public nuisance by oversupplying opioids in two Ohio counties. It was the first time pharmacy chains were held liable at trial for their role in the opioid crisis, establishing pharmacy dispensing conduct as a judicially cognizable public nuisance (Judge Polster later set abatement at $650.5 million).',
        source: {
          externalId: 'src:cnbc-pharmacy-opioid-verdict-2021',
          name: 'CNBC. Jury holds CVS, Walgreens and Walmart responsible for role in opioid crisis. November 23, 2021.',
          url: 'https://www.cnbc.com/2021/11/23/jury-holds-cvs-walgreens-and-walmart-responsible-for-role-in-opioid-crisis.html',
          publishedAt: '2021-11-23',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'JUDICIAL',
        occurredAt: '2024-12-10',
        datePrecision: 'DAY',
        reason: 'Answering a certified question from the Sixth Circuit in In re National Prescription Opiate Litigation (2024-Ohio-5744), the Ohio Supreme Court held that all common-law public-nuisance claims arising from the sale of a product have been abrogated by the Ohio Product Liability Act. The ruling cut the legal foundation out from under the 2021 verdict and the $650.5 million judgment, repudiating the public-nuisance theory that had held the pharmacies liable.',
        source: {
          externalId: 'src:ohio-sct-opiate-nuisance-opla-2024',
          name: 'Supreme Court of Ohio. In re National Prescription Opiate Litigation, 2024-Ohio-5744, 179 Ohio St.3d 74. Decided December 10, 2024.',
          url: 'https://www.supremecourt.ohio.gov/rod/docs/pdf/0/2024/2024-ohio-5744.pdf',
          publishedAt: '2024-12-10',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ONCOLOGY & WOMEN'S HEALTH ERA (1894–1996)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Progesterone isolation — 1934 → 1935 ────────────────────────────────────
  {
    externalId: 'trajectory:progesterone-isolation-corpus-luteum-hormone-1934',
    text: 'Willard Allen and Oskar Wintersteiner reported in Science in 1934 the isolation of a pure crystalline hormone of the corpus luteum, later named progesterone, establishing the pregnancy-maintaining ovarian hormone as a single defined steroid.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1934-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1934-01-01',
        datePrecision: 'YEAR',
        reason: 'In 1934 four independent teams (Allen & Wintersteiner in the US; Butenandt & Westphal, Slotta et al., and Hartmann & Wettstein in Europe) crystallized the corpus-luteum hormone responsible for maintaining pregnancy. Allen and Wintersteiner\'s Science report of \'crystalline progestin\' recorded the claim that the long-sought progestational principle was a single pure steroid that could be isolated and characterized.',
        source: {
          externalId: 'src:ninety-years-progesterone-review-2020',
          name: 'Taraborrelli S. Ninety years of progesterone: the \'other\' ovarian hormone (review documenting the 1934 isolation by Allen & Wintersteiner and three European teams). PMC.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7354701/',
          publishedAt: '2020-07-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1935-01-01',
        datePrecision: 'YEAR',
        reason: 'In 1935 an international agreement standardized the name \'progesterone\' for the corpus-luteum hormone (as recorded in Nature), resolving competing names assigned by the rival 1934 isolation teams; the steroid\'s structure was concurrently established by Butenandt. The nomenclature and structural consensus institutionally settled the identity of progesterone as a defined hormone, underpinning all later progestational and contraceptive chemistry.',
        source: {
          externalId: 'src:nomenclature-corpus-luteum-hormone-nature-1935',
          name: 'Nomenclature of Corpus Luteum Hormone. Nature. 1935;136:303.',
          url: 'https://www.nature.com/articles/136303a0',
          publishedAt: '1935-08-24',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Ziel & Finkle unopposed estrogen / endometrial cancer — 1975 → 1996 ────
  {
    externalId: 'trajectory:ziel-finkle-unopposed-estrogen-endometrial-cancer-1975',
    text: 'Harry Ziel and William Finkle reported in the New England Journal of Medicine on 4 December 1975 that postmenopausal women using conjugated estrogens had a roughly 7.6-fold increased risk of endometrial carcinoma, rising with duration of use.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1975-12-04',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1975-12-04',
        datePrecision: 'DAY',
        reason: 'Ziel and Finkle published a case-control study (94 endometrial-carcinoma cases) finding conjugated-estrogen use in 57% of cases versus 15% of controls, a risk ratio of 7.6 that climbed to 13.9 with seven or more years of exposure. Together with a companion paper by Smith et al. in the same issue, this recorded the claim that unopposed estrogen replacement is a cause of endometrial cancer, challenging the prevailing assumption that estrogen therapy was benign.',
        source: {
          externalId: 'src:ziel-finkle-endometrial-carcinoma-nejm-1975',
          name: 'Ziel HK, Finkle WD. Increased risk of endometrial carcinoma among users of conjugated estrogens. N Engl J Med. 1975;293(23):1167–1170.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/171569/',
          publishedAt: '1975-12-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1978-11-16',
        datePrecision: 'DAY',
        reason: 'Ralph Horwitz and Alvan Feinstein argued in the New England Journal of Medicine that the estrogen–endometrial-cancer association was inflated by detection bias: women on estrogen bleed more, prompting more diagnostic curettage and detection of cancer. Using an \'alternative\' control group of women who had all undergone curettage or hysterectomy, the odds ratio fell from ~12 to 1.7. This methodological challenge threw the causal claim into active dispute.',
        source: {
          externalId: 'src:horwitz-feinstein-detection-bias-nejm-1978',
          name: 'Horwitz RI, Feinstein AR. Alternative analytic methods for case-control studies of estrogens and endometrial cancer. N Engl J Med. 1978;299(20):1089–1094.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/703785/',
          publishedAt: '1978-11-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1996-02-07',
        datePrecision: 'DAY',
        reason: 'The randomized, placebo-controlled PEPI trial reported in JAMA that 62% of postmenopausal women given unopposed conjugated equine estrogen developed endometrial hyperplasia over three years versus 2% on placebo, while adding a progestin nearly abolished the excess. Randomized evidence immune to the detection-bias critique confirmed that unopposed estrogen is an endometrial carcinogen, settling the causal claim and entrenching combined estrogen–progestin regimens for women with a uterus.',
        source: {
          externalId: 'src:pepi-endometrial-histology-jama-1996',
          name: 'Writing Group for the PEPI Trial. Effects of hormone replacement therapy on endometrial histology in postmenopausal women: the Postmenopausal Estrogen/Progestin Interventions (PEPI) Trial. JAMA. 1996;275(5):370–375.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8569016/',
          publishedAt: '1996-02-07',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PEDIATRICS & NEONATOLOGY ERA (1971–1989)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Jones–Smith fetal alcohol syndrome — Lancet 1973 ────────────────────────
  {
    externalId: 'trajectory:jones-smith-fetal-alcohol-syndrome-1973',
    text: 'Kenneth Jones, David Smith, and colleagues reported in The Lancet on 9 June 1973 that the offspring of chronic alcoholic mothers share a distinct pattern of craniofacial, limb, and cardiovascular malformation with prenatal growth deficiency and developmental delay, the first documented association between maternal alcoholism and a recognizable birth-defect syndrome (later named fetal alcohol syndrome).',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1973-06-09',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1973-06-09',
        datePrecision: 'DAY',
        reason: 'Jones, Smith, Ulleland, and Streissguth at the University of Washington described eight unrelated children of chronic alcoholic mothers who showed a consistent pattern of malformation, the first report in the literature linking maternal alcoholism to aberrant morphogenesis. A companion Lancet paper later that year coined the term \'fetal alcohol syndrome,\' converting alcohol from a presumed-benign exposure in pregnancy into a recorded teratogen.',
        source: {
          externalId: 'src:jones-smith-fas-lancet-1973',
          name: 'Jones KL, Smith DW, Ulleland CN, Streissguth AP. Pattern of malformation in offspring of chronic alcoholic mothers. Lancet. 1973;1(7815):1267-1271.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/4126070/',
          publishedAt: '1973-06-09',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1981-05-01',
        datePrecision: 'MONTH',
        reason: 'In May 1981 the U.S. Surgeon General issued the first federal public-health advisory on alcohol and pregnancy, advising women who are pregnant or considering pregnancy not to drink alcoholic beverages. The advisory, published in the FDA Drug Bulletin, institutionalized fetal alcohol syndrome as an established, preventable cause of birth defects.',
        source: {
          externalId: 'src:surgeon-general-alcohol-pregnancy-1981',
          name: 'Surgeon General\'s Advisory on Alcohol and Pregnancy. FDA Drug Bulletin. 1981;11:9-10.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/7250574/',
          publishedAt: '1981-05-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Hexachlorophene newborn neurotoxicity — FDA 1972 ────────────────────────
  {
    externalId: 'trajectory:hexachlorophene-newborn-neurotoxicity-1972',
    text: 'Hexachlorophene (pHisoHex), routinely used since the 1950s to bathe newborns for staphylococcal prophylaxis, was recognized in 1972 to cause vacuolar spongiform brain lesions (myelinopathy) in infants, prompting the FDA in September 1972 to reclassify it as prescription-only and end its routine use in newborn nurseries.',
    claimType: 'HYBRID',
    claimEmergedAt: '1972-09-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1972-09-01',
        datePrecision: 'MONTH',
        reason: 'Acting on animal neurotoxicity data and the contemporaneous Morhange talc disaster in France (in which baby powder contaminated with hexachlorophene killed 36 infants), the FDA in September 1972 reclassified hexachlorophene products as prescription-only (\'Rx only\') and warned against routine total-body bathing of newborns. The action reversed a decade of standard nursery practice that had presumed the antiseptic safe.',
        source: {
          externalId: 'src:fda-hexachlorophene-21cfr-250-250',
          name: 'FDA. 21 CFR 250.250 — Hexachlorophene, as a component of drug and cosmetic products. (1972 restriction codified).',
          url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-C/part-250/subpart-D/section-250.250',
          publishedAt: '1972-09-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1973-06-01',
        datePrecision: 'MONTH',
        reason: 'Powell, Swarner, Gluck, and Lampert reported in the Journal of Pediatrics in June 1973 that seven of 69 premature infants examined at autopsy had spongiform myelinopathy of the brainstem, with multiple hexachlorophene exposures, prematurity, and broken skin as common factors—matching the lesions produced experimentally in animals. The clinicopathologic confirmation settled hexachlorophene as a proven infant neurotoxin.',
        source: {
          externalId: 'src:powell-hexachlorophene-myelinopathy-jpediatr-1973',
          name: 'Powell H, Swarner O, Gluck L, Lampert P. Hexachlorophene myelinopathy in premature infants. J Pediatr. 1973;82(6):976-981.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/4702917/',
          publishedAt: '1973-06-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── AAP routine circumcision policy reversal — 1971/1989 ────────────────────
  {
    externalId: 'trajectory:aap-routine-circumcision-policy-reversal-1989',
    text: 'The American Academy of Pediatrics stated in 1971 that there are no valid medical indications for routine neonatal circumcision, a position it reversed in 1989 when its Task Force on Circumcision concluded that newborn circumcision has potential medical benefits.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1971-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1971-01-01',
        datePrecision: 'YEAR',
        reason: 'The AAP Committee on Fetus and Newborn declared in the 1971 edition of its Standards and Recommendations for Hospital Care of Newborn Infants that there are no valid medical indications for circumcision in the neonatal period. The statement established the professional consensus that routine newborn circumcision was medically unjustified.',
        source: {
          externalId: 'src:aap-standards-newborn-circumcision-1971',
          name: 'American Academy of Pediatrics, Committee on Fetus and Newborn. Standards and Recommendations for Hospital Care of Newborn Infants, 5th ed. Evanston, IL: AAP; 1971.',
          url: 'https://www.cirp.org/library/statements/aap/',
          publishedAt: '1971-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '1989-08-01',
        datePrecision: 'MONTH',
        reason: 'The AAP Task Force on Circumcision reported in Pediatrics in August 1989 that newborn circumcision has potential medical benefits and advantages, citing associations with reduced urinary tract infection, penile cancer, and sexually transmitted disease. The report explicitly reversed the academy\'s earlier \'no valid medical indication\' stance, restoring circumcision to a position of recognized possible benefit.',
        source: {
          externalId: 'src:aap-task-force-circumcision-1989',
          name: 'American Academy of Pediatrics, Task Force on Circumcision. Report of the Task Force on Circumcision. Pediatrics. 1989;84(2):388-391.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2664697/',
          publishedAt: '1989-08-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Dussault congenital hypothyroidism newborn screening — 1973/1975 ────────
  {
    externalId: 'trajectory:dussault-congenital-hypothyroidism-newborn-screening-1973',
    text: 'Jean Dussault and Claude Laberge developed in Quebec in 1973 a radioimmunoassay measuring thyroxine (T4) in dried blood-spot filter-paper specimens, demonstrating that congenital hypothyroidism—a leading preventable cause of intellectual disability—could be detected by mass newborn screening, with results from 47,000 infants reported in 1975.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1973-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1975-05-01',
        datePrecision: 'MONTH',
        reason: 'Dussault and colleagues reported in the Journal of Pediatrics in May 1975 the first large-scale mass screening program for neonatal hypothyroidism, measuring T4 on the same dried blood spots already collected for PKU screening and detecting congenital hypothyroidism in roughly one of every 7,000 Quebec newborns. The report demonstrated that a previously undetectable cause of preventable mental retardation could be caught at birth.',
        source: {
          externalId: 'src:dussault-neonatal-hypothyroidism-screening-jpediatr-1975',
          name: 'Dussault JH, Coulombe P, Laberge C, Letarte J, Guyda H, Khoury K. Preliminary report on a mass screening program for neonatal hypothyroidism. J Pediatr. 1975;86(5):670-674.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/1133648/',
          publishedAt: '1975-05-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1979-01-01',
        datePrecision: 'YEAR',
        reason: 'Within a few years the Dussault dried-blood-spot T4 method was adopted across North American and European newborn-screening programs, becoming a routine universal test added to existing PKU panels by the late 1970s. Congenital hypothyroidism screening is now established worldwide as a standard of newborn care.',
        source: {
          externalId: 'src:newborn-screening-congenital-hypothyroidism-review-2025',
          name: 'Newborn screening for primary congenital hypothyroidism: past, present and future. Eur Thyroid J. 2025;14(2):e240358.',
          url: 'https://etj.bioscientifica.com/view/journals/etj/14/2/ETJ-24-0358.xml',
          publishedAt: '2025-03-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // RARE DISEASE & ORPHAN DRUG ERA (1993–2008)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Tetrabenazine / Xenazine — first Huntington's chorea drug 2008 ──────────
  {
    externalId: 'trajectory:tetrabenazine-xenazine-first-huntington-chorea-drug-2008',
    text: 'On 15 August 2008 the U.S. FDA approved tetrabenazine (Xenazine, NDA 021894), a VMAT2 inhibitor, for chorea associated with Huntington\'s disease — the first drug ever approved in the United States for any symptom of Huntington\'s disease.',
    claimType: 'HYBRID',
    claimEmergedAt: '2006-02-14',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-02-14',
        datePrecision: 'DAY',
        reason: 'The Huntington Study Group published a 12-week multicenter, randomized, double-blind, placebo-controlled trial in 84 ambulatory patients (TETRA-HD) showing tetrabenazine reduced chorea severity by 5.0 units versus 1.5 units on placebo on the Unified Huntington\'s Disease Rating Scale. This was the first controlled evidence that any drug could meaningfully suppress chorea in Huntington\'s disease, recording a candidate symptomatic therapy for a previously untreatable movement disorder.',
        source: {
          externalId: 'src:huntington-study-group-tetrabenazine-neurology-2006',
          name: 'Huntington Study Group. Tetrabenazine as antichorea therapy in Huntington disease: a randomized controlled trial. Neurology. 2006;66(3):366-372. PMID 16476934.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16476934/',
          publishedAt: '2006-02-14',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2008-08-15',
        datePrecision: 'DAY',
        reason: 'After a unanimous favorable vote by the FDA\'s Peripheral and Central Nervous System Drugs Advisory Committee on 6 December 2007, the FDA approved tetrabenazine (Xenazine, Prestwick Pharmaceuticals, NDA 021894) for chorea in Huntington\'s disease. It was the first agent of any kind approved in the U.S. for a Huntington\'s disease symptom, establishing VMAT2 inhibition as the regulatory standard of care for HD chorea (with a boxed warning for depression and suicidality).',
        source: {
          externalId: 'src:fda-xenazine-tetrabenazine-approval-2008',
          name: 'FDA. Xenazine (tetrabenazine) approval, NDA 021894 — first drug for chorea in Huntington\'s disease. August 15, 2008.',
          url: 'https://www.drugs.com/history/xenazine.html',
          publishedAt: '2008-08-15',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Bosentan / Tracleer — first oral PAH therapy 2001 ──────────────────────
  {
    externalId: 'trajectory:bosentan-tracleer-first-oral-pah-therapy-2001',
    text: 'On 20 November 2001 the U.S. FDA approved bosentan (Tracleer, NDA 21-290), a dual endothelin-receptor antagonist, for pulmonary arterial hypertension — the first oral therapy approved for PAH, a rare disease previously treatable only with continuously infused intravenous epoprostenol.',
    claimType: 'HYBRID',
    claimEmergedAt: '2001-10-06',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2001-10-06',
        datePrecision: 'DAY',
        reason: 'Channick and colleagues published the first randomized, double-blind, placebo-controlled trial of oral bosentan in pulmonary hypertension in the Lancet, showing the 6-minute walk distance improved by 70 m at 12 weeks versus worsening on placebo, with reduced pulmonary vascular resistance. This recorded the first controlled evidence that an oral drug could improve exercise capacity and hemodynamics in PAH.',
        source: {
          externalId: 'src:channick-bosentan-pah-lancet-2001',
          name: 'Channick RN, Simonneau G, Sitbon O, et al. Effects of the dual endothelin-receptor antagonist bosentan in patients with pulmonary hypertension: a randomised placebo-controlled study. Lancet. 2001;358(9288):1119-1123. PMID 11597664.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11597664/',
          publishedAt: '2001-10-06',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2001-11-20',
        datePrecision: 'DAY',
        reason: 'The FDA approved Tracleer (bosentan, Actelion, NDA 21-290) for PAH patients with WHO functional class III–IV symptoms, to improve exercise ability and slow clinical worsening — the first orally active treatment for PAH. The approval rested on the Channick study and the larger BREATHE-1 trial (Rubin et al., N Engl J Med. 2002;346:896-903, PMID 11907289), and transformed PAH management from infusion-only prostacyclin to oral therapy.',
        source: {
          externalId: 'src:fda-tracleer-bosentan-approval-2001',
          name: 'Actelion / FDA. Tracleer (bosentan) approved by the US FDA — first oral treatment of pulmonary arterial hypertension, NDA 21-290. November 20, 2001.',
          url: 'https://www.eurekalert.org/news-releases/690660',
          publishedAt: '2001-11-20',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Dornase alfa / Pulmozyme — first CF-specific drug 1993 ─────────────────
  {
    externalId: 'trajectory:dornase-alfa-pulmozyme-first-cf-specific-drug-1993',
    text: 'On 30 December 1993 the U.S. FDA approved dornase alfa (Pulmozyme, BLA 103532), a recombinant human DNase I, for cystic fibrosis — the first drug developed specifically to treat CF, acting by cleaving the extracellular DNA that makes CF airway secretions viscous.',
    claimType: 'HYBRID',
    claimEmergedAt: '1990-12-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1990-12-01',
        datePrecision: 'MONTH',
        reason: 'Shak and colleagues at Genentech reported in PNAS that recombinant human DNase I depolymerizes the high-molecular-weight DNA released by degenerating neutrophils in cystic fibrosis sputum, sharply reducing its viscoelasticity in vitro. This recorded the molecular rationale and first laboratory evidence for a CF-specific mucolytic, launching the rhDNase development program.',
        source: {
          externalId: 'src:shak-rhdnase-cf-sputum-pnas-1990',
          name: 'Shak S, Capon DJ, Hellmiss R, Marsters SA, Baker CL. Recombinant human DNase I reduces the viscosity of cystic fibrosis sputum. Proc Natl Acad Sci U S A. 1990;87(23):9188-9192. PMID 2251263.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2251263/',
          publishedAt: '1990-12-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1993-12-30',
        datePrecision: 'DAY',
        reason: 'The FDA approved Pulmozyme (dornase alfa, Genentech, BLA 103532) for cystic fibrosis, the first drug developed specifically for CF. The pivotal Phase III evidence was published shortly after as Fuchs et al. (N Engl J Med. 1994;331(10):637-642, PMID 7503821), where twice-daily inhaled rhDNase reduced the risk of respiratory exacerbations by 37% versus placebo, cementing rhDNase as standard maintenance therapy.',
        source: {
          externalId: 'src:fda-pulmozyme-dornase-alfa-label-1993',
          name: 'FDA. Pulmozyme (dornase alfa) inhalation solution, BLA 103532 (original approval 30 December 1993), Genentech. FDA label.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2014/103532s5175lbl.pdf',
          publishedAt: '1993-12-30',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Cinryze C1-inhibitor — first HAE prophylaxis therapy 2008 ───────────────
  {
    externalId: 'trajectory:cinryze-c1-inhibitor-first-hae-prophylaxis-2008',
    text: 'On 10 October 2008 the U.S. FDA approved Cinryze (C1 esterase inhibitor [human]), a plasma-derived complement-regulator concentrate, for routine prophylaxis against attacks in patients with hereditary angioedema — the first C1-inhibitor product and first therapy approved in the United States for routine HAE prophylaxis.',
    claimType: 'HYBRID',
    claimEmergedAt: '1996-06-20',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1996-06-20',
        datePrecision: 'DAY',
        reason: 'Waytes, Rosen and Frank reported two double-blind, placebo-controlled studies in the New England Journal of Medicine showing that a vapor-heated C1 inhibitor concentrate both prevented attacks during prophylaxis and shortened acute attacks in hereditary angioedema. This recorded the first controlled evidence that replacing the deficient C1-inhibitor protein corrects the underlying defect of HAE.',
        source: {
          externalId: 'src:waytes-c1-inhibitor-hae-nejm-1996',
          name: 'Waytes AT, Rosen FS, Frank MM. Treatment of hereditary angioedema with a vapor-heated C1 inhibitor concentrate. N Engl J Med. 1996;334(25):1630-1634. PMID 8628358.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8628358/',
          publishedAt: '1996-06-20',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2008-10-10',
        datePrecision: 'DAY',
        reason: 'The FDA approved Cinryze (C1 esterase inhibitor [human], Lev/ViroPharma) for routine prophylaxis against angioedema attacks in adolescents and adults with HAE — the first C1-inhibitor product licensed in the U.S. and the first agent approved specifically for routine HAE prophylaxis. The pivotal randomized data were published as Zuraw et al. (N Engl J Med. 2010;363(6):513-522, PMID 20818886), confirming reduced attack frequency on prophylaxis.',
        source: {
          externalId: 'src:fda-cinryze-c1-inhibitor-approval-2008',
          name: 'FDA. Cinryze (C1 esterase inhibitor [human]) approval — first C1-inhibitor for routine prophylaxis of hereditary angioedema. October 10, 2008.',
          url: 'https://www.drugs.com/history/cinryze.html',
          publishedAt: '2008-10-10',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEVICE & PROCEDURE REVERSAL ERA (2010–2025)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Renal denervation for resistant hypertension — SYMPLICITY HTN-3 2014 ────
  {
    externalId: 'trajectory:symplicity-htn3-renal-denervation-reversal-2014',
    text: 'Catheter-based renal sympathetic denervation lowers blood pressure in patients with treatment-resistant hypertension — a claim advanced by the unblinded SYMPLICITY HTN-1 cohort study (Krum et al., The Lancet, 11 April 2009) and refuted by the blinded, sham-controlled SYMPLICITY HTN-3 trial (Bhatt et al., NEJM, 10 April 2014).',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2009-04-11',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2009-04-11',
        datePrecision: 'DAY',
        reason: 'Krum, Schlaich, and colleagues published the SYMPLICITY HTN-1 multicentre, non-randomised proof-of-principle cohort study in The Lancet, reporting that percutaneous radiofrequency renal sympathetic denervation in 45 patients with resistant hypertension produced office blood-pressure falls of about 27/17 mm Hg at 12 months. This first clinical evidence launched intense enthusiasm for a device-based cure of resistant hypertension, reinforced by the unblinded randomised SYMPLICITY HTN-2 trial in 2010.',
        source: {
          externalId: 'src:krum-symplicity-htn1-lancet-2009',
          name: 'Krum H, Schlaich M, Whitbourn R, et al. Catheter-based renal sympathetic denervation for resistant hypertension: a multicentre safety and proof-of-principle cohort study. Lancet. 2009;373(9671):1275–1281.',
          url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(09)60566-3/abstract',
          publishedAt: '2009-04-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2014-04-10',
        datePrecision: 'DAY',
        reason: 'Bhatt and the SYMPLICITY HTN-3 investigators published the first blinded, sham-controlled randomised trial of renal denervation in the New England Journal of Medicine. With patients and assessors blinded and a sham (renal angiography only) control arm, denervation produced only a 2.39 mm Hg greater office systolic reduction at 6 months — failing the 5 mm Hg superiority margin and showing no significant benefit. The blinding exposed the earlier open-label results as largely placebo and regression effects, collapsing clinical enthusiasm and halting device programs.',
        source: {
          externalId: 'src:bhatt-symplicity-htn3-nejm-2014',
          name: 'Bhatt DL, Kandzari DE, O\'Neill WW, et al. A controlled trial of renal denervation for resistant hypertension. N Engl J Med. 2014;370(15):1393–1401.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/24678939/',
          publishedAt: '2014-04-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'REVERSED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '2023-11-17',
        datePrecision: 'DAY',
        reason: 'After a second generation of properly sham-controlled trials (the SPYRAL HTN-OFF MED and ON MED programs) showed modest but real blood-pressure reductions, the FDA approved Medtronic\'s Symplicity Spyral renal denervation system on 17 November 2023 — days after approving ReCor Medical\'s Paradise ultrasound system — as an adjunctive treatment for hypertension. The approvals, granted over a divided advisory-committee vote, partially rehabilitated a procedure declared dead in 2014, leaving its true clinical value genuinely contested rather than settled.',
        source: {
          externalId: 'src:medtronic-symplicity-spyral-fda-2023',
          name: 'Medtronic. Medtronic announces FDA approval of minimally invasive device to treat hypertension. Press release, 17 November 2023.',
          url: 'https://news.medtronic.com/2023-11-17-Medtronic-announces-FDA-approval-of-minimally-invasive-device-to-treat-hypertension',
          publishedAt: '2023-11-17',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── FDA transvaginal mesh for pelvic organ prolapse — withdrawal 2019 ────────
  {
    externalId: 'trajectory:fda-transvaginal-mesh-pop-withdrawal-2019',
    text: 'Surgical mesh implanted transvaginally is a safe and effective option for repair of pelvic organ prolapse — a premise behind 510(k)-cleared mesh kits marketed from the early 2000s that the FDA reversed on 16 April 2019 by ordering all such devices off the U.S. market.',
    claimType: 'HYBRID',
    claimEmergedAt: '2002-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2002-01-01',
        datePrecision: 'YEAR',
        reason: 'Beginning in the early 2000s, manufacturers brought transvaginal surgical-mesh "kits" for pelvic organ prolapse (POP) to market through the FDA 510(k) pathway, cleared as substantially equivalent to predicate devices without independent premarket safety or efficacy trials. The devices were rapidly adopted as a standard surgical option for POP repair on the assumption that permanent mesh reinforcement improved durability over native-tissue repair.',
        source: {
          externalId: 'src:fda-urogyn-mesh-activities',
          name: 'U.S. Food and Drug Administration. FDA\'s Activities: Urogynecologic Surgical Mesh. Regulatory history of transvaginal mesh for pelvic organ prolapse.',
          url: 'https://www.fda.gov/medical-devices/urogynecologic-surgical-mesh-implants/fdas-activities-urogynecologic-surgical-mesh',
          publishedAt: '2019-04-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '2008-10-20',
        datePrecision: 'MONTH',
        reason: 'In October 2008 the FDA issued a Public Health Notification alerting clinicians and patients to serious adverse events — mesh erosion, pain, infection, organ perforation, and dyspareunia — associated with transvaginal placement of surgical mesh for POP and stress urinary incontinence. A July 2011 Safety Communication escalated the warning, finding that complications were "not rare" and that transvaginal mesh for POP had not been shown to be more effective than non-mesh repair, formally putting the safety/efficacy claim in dispute.',
        source: {
          externalId: 'src:fda-mesh-2011-safety-communication',
          name: 'U.S. Food and Drug Administration. Urogynecologic Surgical Mesh: Update on the Safety and Effectiveness of Transvaginal Placement for Pelvic Organ Prolapse. Safety Communication, 13 July 2011 (following the October 2008 Public Health Notification).',
          url: 'https://www.fda.gov/media/81123/download',
          publishedAt: '2011-07-13',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2019-04-16',
        datePrecision: 'DAY',
        reason: 'Having reclassified transvaginal POP mesh from Class II to Class III (high-risk) in 2016 and required premarket approval applications, the FDA on 16 April 2019 ordered the two remaining manufacturers — Boston Scientific (Uphold Lite, Xenform) and Coloplast (Restorelle DirectFix Anterior) — to stop selling and distributing the devices immediately, finding they had failed to demonstrate reasonable assurance of safety and effectiveness or any long-term benefit over native-tissue repair. The action effectively withdrew the entire device class from the U.S. market.',
        source: {
          externalId: 'src:fda-mesh-stop-selling-2019',
          name: 'U.S. Food and Drug Administration. FDA takes action to protect women\'s health, orders manufacturers of surgical mesh intended for transvaginal repair of pelvic organ prolapse to stop selling all devices. Press announcement, 16 April 2019.',
          url: 'https://www.prnewswire.com/news-releases/fda-takes-action-to-protect-womens-health-orders-manufacturers-of-surgical-mesh-intended-for-transvaginal-repair-of-pelvic-organ-prolapse-to-stop-selling-all-devices-300833010.html',
          publishedAt: '2019-04-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Arthroscopic partial meniscectomy for degenerative tear — Sihvonen 2013 ──
  {
    externalId: 'trajectory:sihvonen-arthroscopic-meniscectomy-degenerative-tear-reversal-2013',
    text: 'Arthroscopic partial meniscectomy relieves symptoms in patients with a degenerative meniscal tear — a rationale behind one of the most common orthopedic operations that a blinded sham-controlled trial (Sihvonen et al., NEJM, 26 December 2013) showed worked no better than placebo surgery.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2000-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2000-01-01',
        datePrecision: 'YEAR',
        reason: 'Through the 1990s and 2000s arthroscopic partial meniscectomy (APM) for degenerative meniscal tears became one of the most frequently performed orthopedic procedures — on the order of 700,000 operations per year in the United States — justified by uncontrolled case series and the intuitive rationale that trimming the torn meniscus relieves mechanical knee symptoms. The practice was standard of care without placebo-controlled validation.',
        source: {
          externalId: 'src:sihvonen-apm-background-nejm-2013',
          name: 'Sihvonen R, Paavola M, Malmivaara A, et al. Arthroscopic partial meniscectomy versus sham surgery for a degenerative meniscal tear (background: APM among the most common orthopedic procedures). N Engl J Med. 2013;369(26):2515–2524.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/24369076/',
          publishedAt: '2013-12-26',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2013-12-26',
        datePrecision: 'DAY',
        reason: 'Sihvonen and the Finnish Degenerative Meniscal Lesion Study Group randomised 146 patients with a degenerative medial meniscal tear and no knee osteoarthritis to arthroscopic partial meniscectomy or a sham arthroscopic procedure, with patients and assessors blinded. At 12 months the two groups showed equivalent improvements in pain and function, demonstrating that the apparent benefit of APM for degenerative tears was a placebo response and providing rigorous evidence that the operation is ineffective for this indication — a finding reinforced by the trial group\'s later multi-year follow-ups.',
        source: {
          externalId: 'src:sihvonen-apm-sham-nejm-2013',
          name: 'Sihvonen R, Paavola M, Malmivaara A, et al. Arthroscopic partial meniscectomy versus sham surgery for a degenerative meniscal tear. N Engl J Med. 2013;369(26):2515–2524.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/24369076/',
          publishedAt: '2013-12-26',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── MR CLEAN endovascular thrombectomy for acute ischemic stroke — 2015 ──────
  {
    externalId: 'trajectory:mr-clean-endovascular-thrombectomy-stroke-2015',
    text: 'Endovascular (intra-arterial) thrombectomy added to standard care improves functional outcomes in acute ischemic stroke from proximal anterior-circulation large-vessel occlusion — a claim established by the MR CLEAN randomized trial (Berkhemer et al., NEJM, online 17 December 2014 / print 1 January 2015) after three 2013 trials had found no benefit.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2015-01-01',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2015-01-01',
        datePrecision: 'DAY',
        reason: 'Berkhemer and the MR CLEAN investigators randomised 500 patients with acute anterior-circulation large-vessel-occlusion stroke to intra-arterial treatment (mostly retrievable-stent thrombectomy) within 6 hours plus usual care versus usual care alone. Endovascular treatment produced a significant shift toward functional independence on the modified Rankin scale at 90 days (32.6% vs 19.1% achieving mRS 0–2). This was the first positive randomised evidence, overturning the pessimism created by the 2013 IMS III, SYNTHESIS Expansion, and MR RESCUE trials, which had shown no benefit using mostly older devices.',
        source: {
          externalId: 'src:berkhemer-mr-clean-nejm-2015',
          name: 'Berkhemer OA, Fransen PSS, Beumer D, et al. A randomized trial of intraarterial treatment for acute ischemic stroke (MR CLEAN). N Engl J Med. 2015;372(1):11–20.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/25517348/',
          publishedAt: '2015-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2015-06-01',
        datePrecision: 'MONTH',
        reason: 'In the first half of 2015 four further randomised trials (ESCAPE, EXTEND-IA, SWIFT PRIME, and REVASCAT) were stopped early after interim analyses showed consistent, large benefits of stent-retriever thrombectomy, replicating MR CLEAN. The HERMES collaboration pooled the trials and confirmed a robust treatment effect, and within the year endovascular thrombectomy was incorporated into AHA/ASA and international stroke guidelines as standard care — settling the claim across the expert community.',
        source: {
          externalId: 'src:hermes-thrombectomy-meta-lancet-2016',
          name: 'Goyal M, Menon BK, van Zwam WH, et al. (HERMES collaborators). Endovascular thrombectomy after large-vessel ischaemic stroke: a meta-analysis of individual patient data from five randomised trials. Lancet. 2016;387(10029):1723–1731.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/26898852/',
          publishedAt: '2016-04-23',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── PARTNER cohort B TAVR for inoperable aortic stenosis — 2010–2011 ─────────
  {
    externalId: 'trajectory:partner-tavr-inoperable-aortic-stenosis-2010',
    text: 'Transcatheter aortic-valve implantation reduces mortality versus standard therapy in patients with severe symptomatic aortic stenosis who cannot undergo open surgery — established by the PARTNER cohort B trial (Leon et al., NEJM, 21 October 2010) and confirmed by FDA approval of the Edwards Sapien valve on 2 November 2011.',
    claimType: 'HYBRID',
    claimEmergedAt: '2010-10-21',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2010-10-21',
        datePrecision: 'DAY',
        reason: 'Leon and the PARTNER investigators published cohort B, the first randomised trial of transcatheter aortic-valve implantation (TAVI) versus standard therapy (including balloon valvuloplasty) in patients with severe aortic stenosis deemed unsuitable for surgery. At one year, all-cause mortality was 30.7% with TAVI versus 50.7% with standard therapy (hazard ratio 0.55), the first rigorous evidence that a catheter-delivered valve could prolong life in inoperable patients, despite higher early stroke and vascular-complication rates.',
        source: {
          externalId: 'src:leon-partner-cohort-b-nejm-2010',
          name: 'Leon MB, Smith CR, Mack M, et al. Transcatheter aortic-valve implantation for aortic stenosis in patients who cannot undergo surgery (PARTNER cohort B). N Engl J Med. 2010;363(17):1597–1607.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/20961243/',
          publishedAt: '2010-10-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2011-11-02',
        datePrecision: 'DAY',
        reason: 'On 2 November 2011 the FDA approved the Edwards Sapien transcatheter heart valve for transfemoral delivery in patients with severe symptomatic aortic stenosis judged unsuitable for open surgery — the first commercial approval of a transcatheter aortic valve in the United States, based on the PARTNER pivotal study. Regulatory approval institutionalized TAVI as standard therapy for inoperable aortic stenosis, after which the indication progressively expanded to high-, intermediate-, and low-surgical-risk patients.',
        source: {
          externalId: 'src:edwards-sapien-fda-approval-2011',
          name: 'U.S. FDA / Edwards Lifesciences. FDA approval of the Edwards Sapien transcatheter aortic heart valve for inoperable severe symptomatic aortic stenosis, 2 November 2011 (TCTMD report).',
          url: 'https://www.tctmd.com/news/fda-approves-sapien-transcatheter-valve-inoperable-aortic-stenosis',
          publishedAt: '2011-11-02',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CANCER BIOLOGY & ONCOLOGY FOUNDATIONS (1896–1966)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 1. Beatson oophorectomy — hormone-dependent breast cancer 1896 ───────────
  {
    externalId: 'trajectory:beatson-oophorectomy-breast-cancer-hormone-dependence-1896',
    text: 'George Beatson reported in The Lancet in July 1896 that removing the ovaries (oophorectomy) caused regression of advanced inoperable breast cancer in premenopausal women, the first demonstration that a cancer\'s growth depends on an endocrine (ovarian) influence.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1896-07-11',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1896-07-11',
        datePrecision: 'DAY',
        reason: 'Beatson, a Glasgow surgeon, reasoning from the ovarian control of lactation, removed the ovaries in women with inoperable breast cancer and observed marked tumor regression in a responding case (a remission lasting some 42 months). Published in The Lancet, this recorded the claim that breast cancer can be hormonally dependent and controlled by ablating an endocrine organ — decades before estrogen or its receptor were known.',
        source: {
          externalId: 'src:beatson-inoperable-carcinoma-mamma-lancet-1896',
          name: 'Beatson GT. On the Treatment of Inoperable Cases of Carcinoma of the Mamma: Suggestions for a New Method of Treatment, with Illustrative Cases. Lancet. 1896;148(3802):104–107; (3803):162–165.',
          url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(01)72384-7/fulltext',
          publishedAt: '1896-07-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1966-12-10',
        datePrecision: 'DAY',
        reason: 'Ovarian ablation became accepted as standard treatment for premenopausal advanced breast cancer by the 1960s, and the broader principle that hormone manipulation can control cancer was vindicated when Charles Huggins shared the 1966 Nobel Prize for endocrine therapy of cancer — work that began from Beatson\'s insight. The hormone-dependence claim was further mechanistically settled by the later identification of the estrogen receptor, making endocrine therapy a permanent pillar of oncology.',
        source: {
          externalId: 'src:ovarian-ablation-breast-cancer-lancet-oncol-2007',
          name: 'Ovarian ablation as a non-surgical treatment for breast cancer. Lancet Oncology. 2007;8(8):700. (reviews Beatson\'s legacy and the establishment of ovarian ablation as standard treatment)',
          url: 'https://www.thelancet.com/journals/lanonc/article/PIIS1470-2045(07)70412-6/abstract',
          publishedAt: '2007-08-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 2. Rous sarcoma virus — filterable tumor agent 1911 ──────────────────────
  {
    externalId: 'trajectory:rous-sarcoma-virus-filterable-tumor-agent-1911',
    text: 'Peyton Rous reported in the Journal of Experimental Medicine in April 1911 that a malignant sarcoma of the domestic fowl could be transmitted to healthy chickens by a cell-free filtrate of the tumor, establishing that a sub-microscopic transmissible agent (a virus) could cause cancer.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1911-04-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1911-04-01',
        datePrecision: 'MONTH',
        reason: 'Rous, at the Rockefeller Institute, showed that a spindle-cell sarcoma in Plymouth Rock hens could be propagated in new birds using a Berkefeld-filtered, cell-free tumor extract that excluded both tumor cells and bacteria. This recorded in the expert literature the radical claim that cancer could be caused by a filterable infectious agent. The finding was widely doubted for decades because it was thought to be a peculiarity of birds with no bearing on mammalian or human cancer.',
        source: {
          externalId: 'src:rous-fowl-sarcoma-jem-1911',
          name: 'Rous P. A Sarcoma of the Fowl Transmissible by an Agent Separable from the Tumor Cells. J Exp Med. 1911;13(4):397–411.',
          url: 'https://rupress.org/jem/article/13/4/397/6143/A-SARCOMA-OF-THE-FOWL-TRANSMISSIBLE-BY-AN-AGENT',
          publishedAt: '1911-04-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1966-12-10',
        datePrecision: 'DAY',
        reason: 'After tumor viruses were repeatedly confirmed in mammals and the molecular mechanism of viral oncogenesis began to be understood, the Nobel Assembly awarded Peyton Rous the 1966 Nobel Prize in Physiology or Medicine \'for his discovery of tumour-inducing viruses,\' 55 years after his original report. The award marked institutional acceptance of the once-dismissed claim that viruses can cause cancer, vindicating the 1911 finding.',
        source: {
          externalId: 'src:nobel-medicine-rous-1966',
          name: 'The Nobel Prize in Physiology or Medicine 1966 — Peyton Rous (shared with Charles B. Huggins). Nobel Foundation.',
          url: 'https://www.nobelprize.org/prizes/medicine/1966/summary/',
          publishedAt: '1966-12-10',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 3. Fibiger Spiroptera worm causes cancer 1913 (reversed) ─────────────────
  {
    externalId: 'trajectory:fibiger-spiroptera-worm-causes-cancer-1913',
    text: 'Johannes Fibiger claimed in 1913 that the nematode worm Spiroptera (Gongylonema neoplasticum) causes carcinoma of the stomach in rats, a hypothesis institutionally endorsed by the 1926 Nobel Prize and later overturned as the lesions were shown to be vitamin-A-deficiency changes, not worm-induced cancer.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1913-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1913-01-01',
        datePrecision: 'YEAR',
        reason: 'Fibiger published experiments reporting that rats fed cockroaches infected with a nematode he called Spiroptera developed papillomatous and carcinomatous tumors of the stomach, asserting the first deliberate experimental induction of cancer by a defined parasitic cause. This recorded in the literature the claim that a worm could cause cancer.',
        source: {
          externalId: 'src:fibiger-spiroptera-krebsforschung-1913',
          name: 'Fibiger J. Untersuchungen über eine Nematode (Spiroptera sp. n.) und deren Fähigkeit, papillomatöse und carcinomatöse Geschwulstbildungen im Magen der Ratte hervorzurufen. Zeitschrift für Krebsforschung. 1913;13:217–280. (history in Wikipedia: Johannes Fibiger)',
          url: 'https://en.wikipedia.org/wiki/Johannes_Fibiger',
          publishedAt: '1913-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1927-12-10',
        datePrecision: 'DAY',
        reason: 'The Nobel Assembly awarded Fibiger the 1926 Nobel Prize in Physiology or Medicine (reserved in 1926 and conferred in 1927) \'for his discovery of the Spiroptera carcinoma,\' the highest institutional endorsement available. The award treated the worm-causes-stomach-cancer claim as established fact and made it canonical in textbooks of the period.',
        source: {
          externalId: 'src:nobel-medicine-fibiger-1926',
          name: 'The Nobel Prize in Physiology or Medicine 1926 — Johannes Andreas Grib Fibiger, \'for his discovery of the Spiroptera carcinoma.\' Nobel Foundation.',
          url: 'https://www.nobelprize.org/prizes/medicine/1926/fibiger/facts/',
          publishedAt: '1927-12-10',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1952-01-01',
        datePrecision: 'YEAR',
        reason: 'Controlled experiments — culminating in Hitchcock and Bell\'s 1952 study — showed that the nematode is not carcinogenic and that the gastric lesions Fibiger observed were largely vitamin-A-deficiency-driven metaplasia and benign papillomas, not true invasive carcinomas. Historical reanalysis confirmed Fibiger had mistaken non-malignant lesions for cancer, overturning the prize-winning claim; it is now the canonical example of a \'wrong\' Nobel Prize.',
        source: {
          externalId: 'src:fibiger-wrong-nobel-annals-1992',
          name: 'Stolt CM, et al. Johannes Fibiger and His Nobel Prize for the Hypothesis That a Worm Causes Stomach Cancer. Ann Intern Med. 1992;116(9):765–769. (documents 1952 disproof and vitamin-A explanation)',
          url: 'https://www.acpjournals.org/doi/10.7326/0003-4819-116-9-765',
          publishedAt: '1992-05-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 4. Yamagiwa–Ichikawa coal-tar chemical carcinogenesis 1915 ───────────────
  {
    externalId: 'trajectory:yamagiwa-ichikawa-coal-tar-chemical-carcinogenesis-1915',
    text: 'Katsusaburo Yamagiwa and Koichi Ichikawa reported in 1915 that repeatedly painting coal tar on the inner ears of rabbits induced squamous-cell carcinoma, providing the first experimental proof that a chemical agent can cause cancer.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1915-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1915-01-01',
        datePrecision: 'YEAR',
        reason: 'Yamagiwa and Ichikawa of Tokyo Imperial University, after months of repeated coal-tar application to rabbit ears, observed progression from papillomas to true squamous-cell carcinoma and published the first report of \'Experimental study on the pathogenesis of epithelial tumors\' (in German, Mitteilungen of the Medical Faculty, 1915; English translation in the Journal of Cancer Research, 1918). This recorded the claim that cancer could be artificially produced by a chemical, transforming Percivall Pott\'s epidemiologic observation into reproducible laboratory science.',
        source: {
          externalId: 'src:yamagiwa-ichikawa-epithelial-tumors-1915',
          name: 'Yamagiwa K, Ichikawa K. Experimental study on the pathogenesis of epithelial tumors (I report), 1915; English: Experimental study of the pathogenesis of carcinoma. J Cancer Res. 1918;3:1–29. (reproduced/summarized in Nakayama, Cancer Sci. 2015, PMC4317818)',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4317818/',
          publishedAt: '1915-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1933-01-01',
        datePrecision: 'YEAR',
        reason: 'The coal-tar result was reproduced internationally (e.g., the rabbit-ear and mouse-skin models of the 1920s) and culminated in Cook, Hewett and Hieger\'s 1933 isolation of a pure carcinogenic hydrocarbon (benzo[a]pyrene) from coal tar, identifying a single defined chemical sufficient to cause cancer. Reproducibility and chemical identification settled experimental chemical carcinogenesis as a foundational discipline of oncology.',
        source: {
          externalId: 'src:yamagiwa-origins-chemical-carcinogenesis-jsis',
          name: 'Yamagiwa and the Origins of Chemical Carcinogenesis. Univ. of Washington Jackson School of International Studies. (documents reproduction and the foundational status of experimental chemical carcinogenesis)',
          url: 'https://jsis.washington.edu/archive/5379.html',
          publishedAt: '2015-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 5. Boveri chromosome somatic-mutation theory of cancer 1914 ──────────────
  {
    externalId: 'trajectory:boveri-chromosome-somatic-mutation-theory-cancer-1914',
    text: 'Theodor Boveri proposed in his 1914 monograph \'Zur Frage der Entstehung maligner Tumoren\' that malignant tumors arise as clonal outgrowths of a single cell carrying an abnormal chromosome constitution, anticipating somatic-mutation, oncogene, and tumor-suppressor concepts of cancer.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1914-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1914-01-01',
        datePrecision: 'YEAR',
        reason: 'Drawing on his sea-urchin work showing that abnormal chromosome combinations disrupt cell development, Boveri argued that a tumor is the clonal progeny of one cell with an aberrant chromosome complement, and presciently posited factors that promote and others that inhibit division (anticipating oncogenes and tumor suppressors). This recorded the chromosomal/somatic-mutation theory of cancer origin in the scientific literature.',
        source: {
          externalId: 'src:boveri-malignant-tumours-jcs-1914',
          name: 'Boveri T. Zur Frage der Entstehung maligner Tumoren. Jena: Gustav Fischer; 1914. (Concerning the Origin of Malignant Tumours, trans./annot. H. Harris, J Cell Sci 2008;121 Suppl 1.)',
          url: 'https://doi.org/10.1242/jcs.025759',
          publishedAt: '1914-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2008-01-01',
        datePrecision: 'YEAR',
        reason: 'Late-20th-century cancer genetics — the demonstration of clonal somatic mutation, cellular oncogenes, tumor-suppressor genes, and aneuploidy in tumors — confirmed Boveri\'s core predictions, and Henry Harris\'s authoritative 2008 translation and reassessment recognized the 1914 monograph as a foundational, vindicated statement of how cancer originates. The somatic-mutation theory Boveri sketched is now the settled framework of molecular oncology.',
        source: {
          externalId: 'src:harris-boveri-reassessment-jcs-2008',
          name: 'Harris H. Concerning the Origin of Malignant Tumours by Theodor Boveri — translation and commentary. J Cell Sci. 2008;121(Suppl 1):1–84.',
          url: 'https://doi.org/10.1242/jcs.025759',
          publishedAt: '2008-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ANTITHROMBOTIC & VASODILATOR ERA (1979–1994)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── AFASAK — warfarin prevents stroke in atrial fibrillation 1989 ───────────
  {
    externalId: 'trajectory:afasak-warfarin-atrial-fibrillation-stroke-1989',
    text: 'The Copenhagen AFASAK trial reported in The Lancet on 28 January 1989 that low-dose warfarin anticoagulation significantly reduced thromboembolic complications and vascular mortality versus aspirin and placebo in patients with chronic nonrheumatic atrial fibrillation, the first randomized proof that oral anticoagulation prevents stroke in atrial fibrillation.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1989-01-28',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1989-01-28',
        datePrecision: 'DAY',
        reason: 'Petersen and colleagues reported the placebo-controlled AFASAK trial of 1,007 patients with chronic atrial fibrillation: 5 thromboembolic events on warfarin versus 20 on aspirin and 21 on placebo. This was the first randomized controlled trial to demonstrate that warfarin prevents stroke in nonvalvular atrial fibrillation, opening the modern era of anticoagulation for the arrhythmia.',
        source: {
          externalId: 'src:afasak-warfarin-lancet-1989',
          name: 'Petersen P, Boysen G, Godtfredsen J, Andersen ED, Andersen B. Placebo-controlled, randomised trial of warfarin and aspirin for prevention of thromboembolic complications in chronic atrial fibrillation. The Copenhagen AFASAK study. Lancet. 1989;1(8631):175-179.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2563096/',
          publishedAt: '1989-01-28',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1994-07-11',
        datePrecision: 'DAY',
        reason: 'The Atrial Fibrillation Investigators pooled individual-patient data from five randomized trials (AFASAK, SPAF, BAATAF, CAFA, SPINAF), confirming that adjusted-dose warfarin reduced stroke risk by about 68% with low bleeding rates. The consistent cross-trial effect settled anticoagulation as standard stroke prophylaxis in atrial fibrillation and shaped subsequent guidelines.',
        source: {
          externalId: 'src:afi-pooled-antithrombotic-af-archintmed-1994',
          name: 'Atrial Fibrillation Investigators. Risk factors for stroke and efficacy of antithrombotic therapy in atrial fibrillation. Analysis of pooled data from five randomized controlled trials. Arch Intern Med. 1994;154(13):1449-1457.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8018000/',
          publishedAt: '1994-07-11',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── V-HeFT I — hydralazine/isosorbide reduces mortality in heart failure 1986 ─
  {
    externalId: 'trajectory:vheft-hydralazine-isosorbide-heart-failure-mortality-1986',
    text: 'The first Vasodilator-Heart Failure Trial (V-HeFT I), reported in the New England Journal of Medicine on 12 June 1986, found that adding hydralazine plus isosorbide dinitrate to standard therapy reduced mortality in chronic congestive heart failure (about a 34% risk reduction at two years), the first demonstration that a vasodilator regimen prolongs survival in heart failure.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1986-06-12',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1986-06-12',
        datePrecision: 'DAY',
        reason: 'Cohn and colleagues reported the Veterans Administration Cooperative V-HeFT I trial, in which hydralazine plus isosorbide dinitrate added to digoxin and diuretics reduced mortality versus placebo and versus prazosin. This was the first trial to show that any pharmacologic regimen reduces mortality in chronic heart failure, establishing the vasodilator/afterload-reduction paradigm.',
        source: {
          externalId: 'src:vheft1-cohn-nejm-1986',
          name: 'Cohn JN, Archibald DG, Ziesche S, et al. Effect of vasodilator therapy on mortality in chronic congestive heart failure. Results of a Veterans Administration Cooperative Study (V-HeFT). N Engl J Med. 1986;314(24):1547-1552.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/3520315/',
          publishedAt: '1986-06-12',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2004-11-11',
        datePrecision: 'DAY',
        reason: 'Although ACE inhibitors later became first-line and V-HeFT II (1991) showed enalapril superior overall, the A-HeFT trial confirmed and revived the hydralazine-isosorbide regimen by showing a 43% mortality reduction in self-identified Black patients with advanced heart failure, leading to FDA approval of the fixed-dose combination (BiDil) in 2005 and settling the regimen\'s place in guideline therapy.',
        source: {
          externalId: 'src:aheft-taylor-nejm-2004',
          name: 'Taylor AL, Ziesche S, Yancy C, et al. Combination of isosorbide dinitrate and hydralazine in blacks with heart failure. N Engl J Med. 2004;351(20):2049-2057.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15533851/',
          publishedAt: '2004-11-11',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── NCEP ATP-I — national cholesterol treatment guidelines 1988 ─────────────
  {
    externalId: 'trajectory:ncep-atp1-cholesterol-treatment-guidelines-1988',
    text: 'On its publication in Archives of Internal Medicine in January 1988, the first National Cholesterol Education Program (NCEP) Adult Treatment Panel report established national clinical guidelines defining blood-cholesterol thresholds (desirable <200 mg/dL, borderline-high 200–239, high ≥240) and LDL-based criteria for diet and drug treatment in adults, institutionalizing population-wide cholesterol detection and management.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1988-01-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1988-01-01',
        datePrecision: 'MONTH',
        reason: 'The NCEP Adult Treatment Panel I report translated the 1984 LRC-CPPT and 1985 NIH Consensus findings into operational national guidelines, setting standardized cholesterol cut points and LDL-driven treatment thresholds for U.S. clinicians. It established cholesterol measurement and lowering as routine institutional practice, a framework that successive ATP updates (1993, 2001) extended rather than overturned.',
        source: {
          externalId: 'src:ncep-atp1-archintmed-1988',
          name: 'Expert Panel. Report of the National Cholesterol Education Program Expert Panel on Detection, Evaluation, and Treatment of High Blood Cholesterol in Adults. Arch Intern Med. 1988;148(1):36-69.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/3422148/',
          publishedAt: '1988-01-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── HDFP — mild hypertension treatment reduces mortality 1979 ───────────────
  {
    externalId: 'trajectory:hdfp-mild-hypertension-treatment-benefit-1979',
    text: 'The Hypertension Detection and Follow-up Program reported in JAMA on 7 December 1979 that systematic stepped-care antihypertensive treatment reduced five-year all-cause mortality by 17% overall and by 20% in the mild-hypertension subgroup (entry diastolic 90–104 mm Hg) versus referred community care, extending the proven benefit of blood-pressure lowering to mild hypertension.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1979-12-07',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1979-12-07',
        datePrecision: 'DAY',
        reason: 'Earlier VA Cooperative trials had proven benefit only for severe and moderate hypertension; the HDFP, randomizing 10,940 participants to stepped care versus referred care, showed that treating even mild hypertension reduced mortality. This established the case for community-wide detection and treatment of mild hypertension and drove the broadening of antihypertensive treatment thresholds in subsequent JNC guidelines.',
        source: {
          externalId: 'src:hdfp-five-year-jama-1979',
          name: 'Hypertension Detection and Follow-up Program Cooperative Group. Five-year findings of the hypertension detection and follow-up program. I. Reduction in mortality of persons with high blood pressure, including mild hypertension. JAMA. 1979;242(23):2562-2571.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/490882/',
          publishedAt: '1979-12-07',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Alteplase (tPA) — TIMI Phase I and FDA approval 1985/1987 ───────────────
  {
    externalId: 'trajectory:alteplase-tpa-first-approval-acute-mi-1987',
    text: 'Recombinant tissue plasminogen activator (alteplase, Activase, Genentech) was shown in the TIMI Phase I trial (NEJM, 4 April 1985) to open occluded coronary arteries more often than streptokinase and was approved by the FDA on 13 November 1987 as the first recombinant thrombolytic for acute myocardial infarction.',
    claimType: 'HYBRID',
    claimEmergedAt: '1985-04-04',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1985-04-04',
        datePrecision: 'DAY',
        reason: 'The TIMI Study Group reported that intravenous recombinant tPA achieved coronary artery reperfusion in roughly twice as many patients as streptokinase, and the streptokinase-versus-tPA comparison phase was stopped early because of tPA\'s superior recanalization. This angiographic evidence established tPA as a clot-selective thrombolytic and the basis for its development in acute MI.',
        source: {
          externalId: 'src:timi-phase1-nejm-1985',
          name: 'TIMI Study Group. The Thrombolysis in Myocardial Infarction (TIMI) trial. Phase I findings. N Engl J Med. 1985;312(14):932-936.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/4038784/',
          publishedAt: '1985-04-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1987-11-13',
        datePrecision: 'DAY',
        reason: 'After the FDA\'s Cardiovascular and Renal Drugs Advisory Committee declined to recommend approval in May 1987 citing the lack of mortality data and reliance on the angiographic patency surrogate, the agency approved Activase (alteplase) on 13 November 1987 once additional trial data were submitted. The approval institutionalized recombinant tPA for acute MI and exemplified the controversy over surrogate-endpoint drug approvals.',
        source: {
          externalId: 'src:ninds-tpa-alteplase-activase-approval',
          name: 'National Institute of Neurological Disorders and Stroke. Tissue Plasminogen Activator for Acute Ischemic Stroke (Alteplase, Activase) — NINDS Contributions to Approved Therapies.',
          url: 'https://www.ninds.nih.gov/about-ninds/what-we-do/impact/ninds-contributions-approved-therapies/tissue-plasminogen-activator-acute-ischemic-stroke-alteplase-activaser',
          publishedAt: '1987-11-13',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // POST-MARKET SURVEILLANCE & VACCINE SAFETY ERA (1996–2009)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── vCJD / BSE human transmission 1996 ─────────────────────────────────────
  {
    externalId: 'trajectory:vcjd-bse-human-transmission-1996',
    text: 'On 20 March 1996 the UK government, on the advice of the Spongiform Encephalopathy Advisory Committee (SEAC), announced that a newly identified variant of Creutzfeldt-Jakob disease (vCJD) in humans was most plausibly caused by dietary exposure to bovine spongiform encephalopathy (BSE, \'mad cow disease\').',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1996-03-20',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1996-04-06',
        datePrecision: 'DAY',
        reason: 'Seventeen days after the SEAC/government announcement, Will and colleagues published in The Lancet the first peer-reviewed description of ten cases of a clinically and neuropathologically distinct new variant of CJD clustering in unusually young UK patients. They argued a causal link to BSE was the most plausible explanation while explicitly cautioning it \'cannot be confirmed on the basis of this evidence alone,\' placing the BSE-to-human hypothesis on the formal scientific record as a serious but unproven claim.',
        source: {
          externalId: 'src:will-lancet-new-variant-cjd-1996',
          name: 'Will RG, Ironside JW, Zeidler M, et al. A new variant of Creutzfeldt-Jakob disease in the UK. Lancet. 1996 Apr 6;347(9006):921-925.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8598754/',
          publishedAt: '1996-04-06',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1997-10-02',
        datePrecision: 'DAY',
        reason: 'Bruce and colleagues transmitted both BSE and vCJD to panels of inbred mice and showed that vCJD produced the same characteristic incubation-period and lesion-profile \'signature\' as BSE, distinct from sporadic CJD. This strain-typing experiment provided strong biological evidence that the same agent strain underlies BSE and vCJD, converting the 1996 hypothesis into an established causal link and confirming cross-species prion transmission to humans via the food supply.',
        source: {
          externalId: 'src:bruce-nature-vcjd-bse-agent-1997',
          name: 'Bruce ME, Will RG, Ironside JW, et al. Transmissions to mice indicate that \'new variant\' CJD is caused by the BSE agent. Nature. 1997 Oct 2;389(6650):498-501.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/9333239/',
          publishedAt: '1997-10-02',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── RotaTeq REST trial intussusception safety 2006 ─────────────────────────
  {
    externalId: 'trajectory:rotateq-rest-trial-intussusception-safety-2006',
    text: 'On 5 January 2006 the New England Journal of Medicine published the Rotavirus Efficacy and Safety Trial (REST), showing that the pentavalent rotavirus vaccine RotaTeq, evaluated in roughly 68,000 infants, did not increase the risk of intussusception — re-establishing that rotavirus vaccination could be conducted safely after the 1999 withdrawal of RotaShield.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2006-01-05',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-01-05',
        datePrecision: 'DAY',
        reason: 'Vesikari and colleagues reported REST, a trial powered specifically to detect the intussusception signal that had ended RotaShield: intussusception occurred in 12 vaccine versus 15 placebo recipients within one year (relative risk 1.6, 95% CI 0.4-6.4), with no significant excess, alongside a 94.5% reduction in rotavirus-related hospitalizations. This put on record the empirical case that a rotavirus vaccine could be both efficacious and free of the catastrophic safety signal that had previously halted the field.',
        source: {
          externalId: 'src:vesikari-nejm-rest-rotateq-2006',
          name: 'Vesikari T, Matson DO, Dennehy P, et al. Safety and efficacy of a pentavalent human-bovine (WC3) reassortant rotavirus vaccine. N Engl J Med. 2006 Jan 5;354(1):23-33.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16394299/',
          publishedAt: '2006-01-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2006-02-03',
        datePrecision: 'DAY',
        reason: 'The FDA licensed RotaTeq on 3 February 2006 and the ACIP subsequently recommended routine infant immunization, formally returning rotavirus vaccination to the US schedule seven years after RotaShield\'s withdrawal. Post-licensure surveillance of RotaTeq and Rotarix later detected a small intussusception risk (roughly one to six excess cases per 100,000 vaccinees), but this risk was judged far outweighed by the prevention of severe gastroenteritis, leaving the recommendation intact.',
        source: {
          externalId: 'src:fda-rotateq-approval-2006',
          name: 'U.S. Food and Drug Administration. RotaTeq (Rotavirus Vaccine, Live, Oral, Pentavalent) — approval and product information. FDA. 2006.',
          url: 'https://www.fda.gov/vaccines-blood-biologics/vaccines/rotateq',
          publishedAt: '2006-02-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Hispaniola circulating vaccine-derived poliovirus 2000 ─────────────────
  {
    externalId: 'trajectory:hispaniola-circulating-vaccine-derived-poliovirus-2000',
    text: 'During 2000–2001 an outbreak of paralytic poliomyelitis in the Dominican Republic and Haiti was shown to be caused by a circulating vaccine-derived poliovirus (cVDPV) — the first documented proof that attenuated oral polio vaccine (OPV) strains can mutate, regain neurovirulence and transmissibility, and cause polio outbreaks in under-immunized populations.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2000-07-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2002-04-12',
        datePrecision: 'DAY',
        reason: 'Kew and 22 co-authors at CDC and partner institutions used genomic sequencing to show that the 21 confirmed paralytic cases (13 in the Dominican Republic, 8 including 2 fatal in Haiti) were caused by a derivative of the type 1 OPV strain that had reverted and circulated through a population with low vaccine coverage. This was the first rigorous molecular demonstration that the live vaccine itself could seed paralytic polio outbreaks, formally recording cVDPV as a real phenomenon.',
        source: {
          externalId: 'src:kew-science-hispaniola-cvdpv-2002',
          name: 'Kew O, Morris-Glasgow V, Landaverde M, et al. Outbreak of poliomyelitis in Hispaniola associated with circulating type 1 vaccine-derived poliovirus. Science. 2002 Apr 12;296(5566):356-359.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11896235/',
          publishedAt: '2002-04-12',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2016-04-01',
        datePrecision: 'MONTH',
        reason: 'cVDPV became a central organizing concept of the WHO Global Polio Eradication Initiative endgame: because type-2 cVDPVs accounted for over 97% of cVDPV paralysis, all 155 OPV-using countries synchronously withdrew the type-2 component in the globally coordinated trivalent-to-bivalent OPV \'switch\' of April 2016. This institutional action — removing a component of the vaccine specifically because of its own reversion risk — settled the once-novel claim that OPV strains can cause outbreaks as established programmatic fact.',
        source: {
          externalId: 'src:who-gpei-cvdpv-factsheet-2017',
          name: 'World Health Organization / Global Polio Eradication Initiative. Circulating vaccine-derived poliovirus (cVDPV) fact sheet. WHO. March 2017.',
          url: 'https://www.who.int/docs/default-source/documents/gpei-cvdpv-factsheet-march-2017.pdf',
          publishedAt: '2017-03-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Oseltamivir / Tamiflu complication-efficacy contested 2009 ─────────────
  {
    externalId: 'trajectory:oseltamivir-tamiflu-complication-efficacy-contested-2009',
    text: 'A 2003 meta-analysis claimed that oseltamivir (Tamiflu) reduces influenza-related lower respiratory tract complications and hospitalizations — a claim that underpinned multibillion-dollar government pandemic stockpiling but was contested on 8 December 2009 when a Cochrane/BMJ review found the supporting trial data largely unpublished and inadequate to support it.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2003-07-28',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2003-07-28',
        datePrecision: 'DAY',
        reason: 'Kaiser and colleagues pooled ten oseltamivir treatment trials and reported that the drug cut lower respiratory tract complications requiring antibiotics by 55% (4.6% vs 10.3%) and hospitalizations by 59%. This pooled analysis became the central published evidence that oseltamivir prevents serious influenza outcomes, recording the complication-reduction claim that would justify pandemic procurement.',
        source: {
          externalId: 'src:kaiser-archintmed-oseltamivir-complications-2003',
          name: 'Kaiser L, Wat C, Mills T, Mahoney P, Ward P, Hayden F. Impact of oseltamivir treatment on influenza-related lower respiratory tract complications and hospitalizations. Arch Intern Med. 2003 Jul 28;163(14):1667-1672.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12885681/',
          publishedAt: '2003-07-28',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2005-11-01',
        datePrecision: 'MONTH',
        reason: 'The US HHS Pandemic Influenza Plan of November 2005 set a national goal of stockpiling 81 million antiviral treatment courses, with oseltamivir as the primary agent, and the WHO and numerous governments built comparable stockpiles on the rationale that neuraminidase inhibitors reduce complications. The complication-reduction claim thereby moved from journal finding to settled policy embedded in national pandemic-preparedness strategy.',
        source: {
          externalId: 'src:hhs-pandemic-influenza-plan-2005',
          name: 'U.S. Department of Health and Human Services. HHS Pandemic Influenza Plan. November 2005.',
          url: 'https://www.cdc.gov/pandemic-flu/media/hhspandemicinfluenzaplan.pdf',
          publishedAt: '2005-11-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2009-12-08',
        datePrecision: 'DAY',
        reason: 'Jefferson, Doshi and colleagues, updating the Cochrane review in the BMJ, found oseltamivir gave only modest symptom relief and concluded the evidence did not support reduced lower respiratory complications, because most of the underlying manufacturer trials behind the Kaiser analysis were unpublished and unavailable for independent scrutiny. This launched a multi-year campaign for full clinical-study-report access and reframed a previously settled efficacy claim — and the stockpiling it justified — as contested; the 2014 Cochrane update reaffirmed the contestation.',
        source: {
          externalId: 'src:jefferson-bmj-neuraminidase-inhibitors-2009',
          name: 'Jefferson T, Jones M, Doshi P, Del Mar C. Neuraminidase inhibitors for preventing and treating influenza in healthy adults: systematic review and meta-analysis. BMJ. 2009 Dec 8;339:b5106.',
          url: 'https://www.bmj.com/content/339/bmj.b5106',
          publishedAt: '2009-12-08',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Telithromycin / Ketek hepatotoxicity reversal 2007 ─────────────────────
  {
    externalId: 'trajectory:telithromycin-ketek-hepatotoxicity-reversal-2007',
    text: 'The FDA approved telithromycin (Ketek) on 1 April 2004 as a safe and effective antibiotic for acute bacterial sinusitis, acute exacerbations of chronic bronchitis, and community-acquired pneumonia; after reports of severe liver injury and the discovery that a pivotal safety study was fraudulent, the FDA in February 2007 added a boxed warning and withdrew the sinusitis and bronchitis indications.',
    claimType: 'HYBRID',
    claimEmergedAt: '2004-04-01',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2004-04-01',
        datePrecision: 'DAY',
        reason: 'The FDA approved telithromycin, the first ketolide antibiotic, for three common respiratory indications, institutionally certifying it as safe and effective. The approval relied in part on Study 3014, a large safety study later found to be permeated by fraud, so the favorable benefit-risk judgment rested on a compromised evidence base from the outset.',
        source: {
          externalId: 'src:ross-nejm-fda-ketek-2007',
          name: 'Ross DB. The FDA and the case of Ketek. N Engl J Med. 2007 Apr 19;356(16):1601-1604.',
          url: 'https://www.nejm.org/doi/full/10.1056/NEJMp078032',
          publishedAt: '2007-04-19',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-03-21',
        datePrecision: 'DAY',
        reason: 'Clay and colleagues reported three patients who developed acute hepatitis shortly after starting telithromycin — one recovered, one required a liver transplant, and one died — and concluded the drug can cause severe hepatotoxicity. This case series, published in Annals of Internal Medicine, surfaced a post-market safety signal that directly challenged the drug\'s approved safety profile.',
        source: {
          externalId: 'src:clay-annintmed-telithromycin-hepatotoxicity-2006',
          name: 'Clay KD, Hanson JS, Pope SD, Rissmiller RW, Purdum PP 3rd, Banks PM. Brief communication: severe hepatotoxicity of telithromycin: three case reports and literature review. Ann Intern Med. 2006 Mar 21;144(6):415-420.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16481451/',
          publishedAt: '2006-03-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2007-02-12',
        datePrecision: 'DAY',
        reason: 'In February 2007 the FDA added a boxed warning for hepatotoxicity and a Medication Guide and removed two of telithromycin\'s three indications — acute bacterial sinusitis and acute exacerbations of chronic bronchitis — leaving only community-acquired pneumonia. Combined with the fraud finding in the supporting safety study, this regulatory action reversed the original safe-and-effective-for-common-respiratory-infections claim; the drug was subsequently effectively withdrawn from the US market.',
        source: {
          externalId: 'src:ross-nejm-fda-ketek-action-2007',
          name: 'Ross DB. The FDA and the case of Ketek. N Engl J Med. 2007 Apr 19;356(16):1601-1604.',
          url: 'https://www.nejm.org/doi/full/10.1056/NEJMp078032',
          publishedAt: '2007-04-19',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRECISION MEDICINE & NOVEL MECHANISMS ERA (2020–2024)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Relyvrio (AMX0035) ALS — CENTAUR 2020 / FDA approval 2022 / withdrawal 2024
  {
    externalId: 'trajectory:relyvrio-amx0035-als-approval-withdrawal-2022',
    text: 'Sodium phenylbutyrate–taurursodiol (AMX0035, marketed as Relyvrio/Albrioza, Amylyx) slows the loss of physical function in amyotrophic lateral sclerosis, as reported in the phase 2 CENTAUR trial on 3 September 2020 and ratified by FDA approval on 29 September 2022.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2020-09-03',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2020-09-03',
        datePrecision: 'DAY',
        reason: 'Paganoni and colleagues published the 24-week, randomized, placebo-controlled phase 2 CENTAUR trial in the New England Journal of Medicine, reporting a 2.32-point difference favoring AMX0035 on the ALSFRS-R functional scale, with a later survival analysis suggesting prolonged survival. The result recorded into the top-tier literature the claim that a sodium phenylbutyrate–taurursodiol combination could slow ALS progression, on the strength of a single modest-sized phase 2 study.',
        source: {
          externalId: 'src:paganoni-centaur-amx0035-nejm-2020',
          name: 'Paganoni S, Macklin EA, Hendrix S, et al. Trial of Sodium Phenylbutyrate–Taurursodiol for Amyotrophic Lateral Sclerosis. N Engl J Med. 2020;383(10):919-930.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/32877582/',
          publishedAt: '2020-09-03',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2022-09-29',
        datePrecision: 'DAY',
        reason: 'The FDA approved Relyvrio for adults with ALS on the basis of the single phase 2 CENTAUR trial, after an advisory committee reversed an initial negative vote — an unusual approval given persistent doubts about whether one mid-sized trial established efficacy. The clearance institutionally ratified AMX0035 as a treatment for a uniformly fatal disease, with Amylyx publicly committing to confirm benefit in the ongoing phase 3 PHOENIX trial.',
        source: {
          externalId: 'src:amylyx-relyvrio-fda-approval-2022',
          name: 'Amylyx Pharmaceuticals. Amylyx Pharmaceuticals Announces FDA Approval of RELYVRIO for the Treatment of ALS. September 29, 2022.',
          url: 'https://www.amylyx.com/news/amylyx-pharmaceuticals-announces-fda-approval-of-relyvriotm-for-the-treatment-of-als',
          publishedAt: '2022-09-29',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2024-04-04',
        datePrecision: 'DAY',
        reason: 'After the confirmatory phase 3 PHOENIX trial failed to meet its primary or secondary endpoints (topline announced 8 March 2024), Amylyx announced on 4 April 2024 that it would voluntarily discontinue marketing of Relyvrio/Albrioza and remove the drug from the U.S. and Canadian markets. The withdrawal — a rare voluntary pull of an approved drug after a negative confirmatory trial — reversed the efficacy claim and became a touchstone case against approving drugs on thin single-trial evidence.',
        source: {
          externalId: 'src:amylyx-relyvrio-market-withdrawal-2024',
          name: 'Amylyx Pharmaceuticals. Amylyx Pharmaceuticals Announces Formal Intention to Remove RELYVRIO/ALBRIOZA from the Market; Provides Updates on Access to Therapy, Pipeline, Corporate Restructuring, and Strategy. April 4, 2024.',
          url: 'https://www.amylyx.com/news/amylyx-pharmaceuticals-announces-formal-intention-to-remove-relyvrior/albriozatm-from-the-market-provides-updates-on-access-to-therapy-pipeline-corporate-restructuring-and-strategy',
          publishedAt: '2024-04-04',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Tofersen (Qalsody) SOD1-ALS — VALOR 2022 / FDA accelerated approval 2023
  {
    externalId: 'trajectory:tofersen-qalsody-sod1-als-accelerated-approval-2022',
    text: 'Tofersen (Qalsody, Biogen/Ionis), an intrathecal antisense oligonucleotide that lowers synthesis of the SOD1 protein, reduces plasma neurofilament light chain in SOD1-mutation ALS, as reported in the VALOR trial on 22 September 2022 and ratified by FDA accelerated approval on 25 April 2023 — the first therapy targeting a genetic cause of ALS.',
    claimType: 'HYBRID',
    claimEmergedAt: '2022-09-22',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2022-09-22',
        datePrecision: 'DAY',
        reason: 'Miller and colleagues published the phase 3 VALOR trial in the New England Journal of Medicine, reporting that tofersen did NOT meet its primary clinical endpoint (ALSFRS-R change at 28 weeks) but did produce substantial reductions in SOD1 protein and in plasma neurofilament light chain, a biomarker of neurodegeneration. The paper recorded a mixed claim into the literature: a clear biomarker effect without demonstrated clinical benefit, framing neurofilament as a candidate surrogate endpoint.',
        source: {
          externalId: 'src:miller-valor-tofersen-nejm-2022',
          name: 'Miller TM, Cudkowicz ME, Genge A, et al. Trial of Antisense Oligonucleotide Tofersen for SOD1 ALS. N Engl J Med. 2022;387(12):1099-1110.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/36129998/',
          publishedAt: '2022-09-22',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2023-04-25',
        datePrecision: 'DAY',
        reason: 'The FDA granted accelerated approval to tofersen for SOD1-ALS based solely on the reduction in plasma neurofilament light chain, after its advisory committee voted 9-0 in March 2023 that the biomarker change was reasonably likely to predict clinical benefit despite the failed primary clinical endpoint. This was the first ALS approval to rest on a biomarker surrogate and the first therapy targeting a genetic cause of the disease, with the phase 3 ATLAS study designated as the confirmatory trial.',
        source: {
          externalId: 'src:biogen-qalsody-tofersen-fda-accelerated-approval-2023',
          name: 'Biogen. FDA Grants Accelerated Approval for QALSODY (tofersen) for SOD1-ALS, a Major Scientific Advancement as the First Treatment to Target a Genetic Cause of ALS. April 25, 2023.',
          url: 'https://investors.biogen.com/news-releases/news-release-details/fda-grants-accelerated-approval-qalsodytm-tofersen-sod1-als',
          publishedAt: '2023-04-25',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Xanomeline–trospium (KarXT / Cobenfy) schizophrenia — EMERGENT-2 2023 / FDA approval 2024
  {
    externalId: 'trajectory:xanomeline-trospium-karxt-cobenfy-schizophrenia-approval-2023',
    text: 'Xanomeline–trospium (KarXT, marketed as Cobenfy, Karuna/Bristol Myers Squibb), a dual M1/M4 muscarinic-receptor agonist paired with a peripheral muscarinic antagonist and acting without dopamine D2 blockade, reduces schizophrenia symptoms, as shown in the phase 3 EMERGENT-2 trial published 13 December 2023 and ratified by FDA approval on 26 September 2024 — the first antipsychotic with a fundamentally new mechanism in decades.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2023-12-13',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2023-12-13',
        datePrecision: 'DAY',
        reason: 'Kaul and colleagues published the randomized, double-blind, placebo-controlled phase 3 EMERGENT-2 trial in The Lancet, reporting that KarXT significantly reduced PANSS total scores at five weeks in acutely psychotic adults with schizophrenia and was generally well tolerated, without the weight gain and movement effects tied to dopamine antagonists. The trial recorded pivotal evidence that muscarinic agonism, with no D2 blockade, could treat schizophrenia — challenging the seventy-year dopamine-centric paradigm of antipsychotic action.',
        source: {
          externalId: 'src:kaul-emergent2-karxt-lancet-2024',
          name: 'Kaul I, Sawchak S, Correll CU, et al. Efficacy and safety of the muscarinic receptor agonist KarXT (xanomeline–trospium) in schizophrenia (EMERGENT-2) in the USA: results from a randomised, double-blind, placebo-controlled, flexible-dose phase 3 trial. Lancet. 2024;403(10422):160-170.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/38104575/',
          publishedAt: '2023-12-13',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2024-09-26',
        datePrecision: 'DAY',
        reason: 'The FDA approved Cobenfy (xanomeline and trospium chloride) for schizophrenia in adults, the first new pharmacological class for the disorder in decades and the first antipsychotic to act through cholinergic (M1/M4) rather than dopamine receptors. The approval institutionally settled the claim that muscarinic agonism is a viable antipsychotic mechanism, opening a non-dopaminergic therapeutic pathway after a half-century in which every approved antipsychotic blocked D2 receptors.',
        source: {
          externalId: 'src:bms-cobenfy-karxt-fda-approval-2024',
          name: 'Bristol Myers Squibb. U.S. Food and Drug Administration Approves Bristol Myers Squibb\'s COBENFY (xanomeline and trospium chloride), a First-In-Class Muscarinic Agonist for the Treatment of Schizophrenia in Adults. September 26, 2024.',
          url: 'https://news.bms.com/news/details/2024/U.S.-Food-and-Drug-Administration-Approves-Bristol-Myers-Squibbs-COBENFY-xanomeline-and-trospium-chloride-a-First-In-Class-Muscarinic-Agonist-for-the-Treatment-of-Schizophrenia-in-Adults/default.aspx',
          publishedAt: '2024-09-26',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Dextromethorphan–bupropion (AXS-05 / Auvelity) MDD — GEMINI 2022 / FDA approval 2022
  {
    externalId: 'trajectory:dextromethorphan-bupropion-auvelity-mdd-approval-2022',
    text: 'Dextromethorphan–bupropion (AXS-05, marketed as Auvelity, Axsome), an oral combination of an NMDA-receptor antagonist/sigma-1 agonist with a metabolic enhancer, is a rapid-acting treatment for major depressive disorder, as shown in the phase 3 GEMINI trial published 30 May 2022 and ratified by FDA approval on 18 August 2022.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2022-05-30',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2022-05-30',
        datePrecision: 'DAY',
        reason: 'Iosifescu and colleagues published the phase 3 GEMINI trial in the Journal of Clinical Psychiatry, reporting that once-daily dextromethorphan–bupropion produced rapid, statistically significant reductions in MADRS depression scores versus placebo, with separation as early as one week. The trial recorded into the literature the claim that an oral glutamatergic (NMDA-antagonist) agent could rapidly treat major depression, a mechanism distinct from the monoamine reuptake basis of conventional oral antidepressants.',
        source: {
          externalId: 'src:iosifescu-gemini-axs05-jcp-2022',
          name: 'Iosifescu DV, Jones A, O\'Gorman C, et al. Efficacy and Safety of AXS-05 (Dextromethorphan-Bupropion) in Patients With Major Depressive Disorder: A Phase 3 Randomized Clinical Trial (GEMINI). J Clin Psychiatry. 2022;83(4):21m14345.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/35649167/',
          publishedAt: '2022-05-30',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2022-08-18',
        datePrecision: 'DAY',
        reason: 'The FDA approved Auvelity (dextromethorphan–bupropion extended-release) for major depressive disorder in adults, the first oral antidepressant to act through an NMDA-receptor-antagonist mechanism and, per the manufacturer, the first new oral antidepressant mechanism cleared in more than sixty years. The approval institutionally established a rapid-acting oral glutamatergic option for general MDD, extending to the broad outpatient population the mechanism that esketamine had previously reached only for treatment-resistant depression under a restricted REMS.',
        source: {
          externalId: 'src:auvelity-axs05-fda-approval-history-2022',
          name: 'Drugs.com. Auvelity (dextromethorphan and bupropion) FDA Approval History. Approval date August 18, 2022.',
          url: 'https://www.drugs.com/history/auvelity.html',
          publishedAt: '2022-08-18',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // HORMONE DISCOVERY ERA (1902–1957)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Bayliss & Starling secretin / first hormone — 1902 ─────────────────────
  {
    externalId: 'trajectory:bayliss-starling-secretin-first-hormone-1902',
    text: 'William Bayliss and Ernest Starling reported in The Journal of Physiology in 1902 that a chemical substance they named secretin, released from the duodenal mucosa into the bloodstream by acid, stimulates pancreatic secretion — the first demonstration that a blood-borne chemical messenger (later termed a hormone) coordinates a bodily function.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1902-09-12',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1902-09-12',
        datePrecision: 'DAY',
        reason: 'Bayliss and Starling published \'The mechanism of pancreatic secretion\' in The Journal of Physiology, showing that injecting an extract of acid-treated duodenal mucosa into the bloodstream of a dog with severed pancreatic nerves still produced a flow of pancreatic juice. They named the active agent \'secretin\' and concluded that a chemical carried by the blood, not a nervous reflex, drives pancreatic secretion. This recorded in the expert literature the first instance of chemical (humoral) control of a distant organ.',
        source: {
          externalId: 'src:bayliss-starling-pancreatic-secretion-jphysiol-1902',
          name: 'Bayliss WM, Starling EH. The mechanism of pancreatic secretion. J Physiol. 1902;28(5):325–353.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1540572/',
          publishedAt: '1902-09-12',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1905-01-01',
        datePrecision: 'YEAR',
        reason: 'In his 1905 Croonian Lectures to the Royal College of Physicians, Starling generalized the secretin finding into a unifying principle, coining the word \'hormone\' (from the Greek for \'I arouse to activity\') for blood-borne chemical messengers produced in one organ to act on another. The conceptual generalization, rapidly adopted by physiologists, settled secretin\'s status as the founding example of hormonal control and established endocrinology as a discipline.',
        source: {
          externalId: 'src:henderson-secretin-hormonal-control-review',
          name: 'Henderson J. Ernest Starling and \'Hormones\': an historical commentary / Secretin and the exposition of hormonal control. J Endocrinol / J R Soc Med (historical review documenting the 1902 discovery and 1905 Croonian Lectures coinage of \'hormone\').',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1665254/',
          publishedAt: '2005-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Paulescu pancreine / insulin priority — 1921 ────────────────────────────
  {
    externalId: 'trajectory:paulescu-pancreine-insulin-priority-1921',
    text: 'Nicolae Paulescu reported in the Archives Internationales de Physiologie on 31 August 1921 that an aqueous pancreatic extract he called \'pancréine\' markedly lowered blood glucose, glycosuria, and ketonemia when injected into diabetic dogs — a claim to priority in discovering the antidiabetic pancreatic hormone that remains contested against the Toronto group\'s later isolation of insulin.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1921-08-31',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1921-08-31',
        datePrecision: 'DAY',
        reason: 'Paulescu published \'Recherche sur le rôle du pancréas dans l\'assimilation nutritive\' in the Archives Internationales de Physiologie, presenting for the first time the quantitative effect of an intravenous pancreatic extract on glycemia, glycosuria, acetonemia, and acetonuria in diabetic dogs — months before the Toronto group\'s first dog experiments. This recorded in the expert literature the claim that a pancreatic internal secretion could reverse diabetic derangement, and Paulescu secured a Romanian patent on the manufacture of \'pancréine\' in April 1922.',
        source: {
          externalId: 'src:paulescu-role-pancreas-arch-int-physiol-1921',
          name: 'Paulescu NC. Recherche sur le rôle du pancréas dans l\'assimilation nutritive. Arch Int Physiol. 1921;17:85–109.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8919497/',
          publishedAt: '1921-08-31',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '1923-10-25',
        datePrecision: 'DAY',
        reason: 'When the 1923 Nobel Prize in Physiology or Medicine was awarded to Banting and Macleod for the discovery of insulin, Paulescu wrote to the Nobel Committee asserting priority on the basis of his August 1921 publication; the claim was rejected. The dispute — fueled by Banting and Best\'s citation of Paulescu\'s earlier work and by the difference between Paulescu\'s crude pancréine and the clinically usable Toronto extract — left his priority permanently contested rather than settled, a controversy still actively debated in the historical literature a century later.',
        source: {
          externalId: 'src:bentia-paulescu-centenary-acta-endocrinol-2021',
          name: 'Benția D, Saceleanu MV, Marinescu AA, Ciurea AV. Centenary of Insulin Discovery (1921–2021): Nicolae Paulescu\'s Original Contributions. Acta Endocrinol (Buchar). 2021;17(3):406–411.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8919497/',
          publishedAt: '2021-09-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Cushing pituitary basophilism / Cushing's disease — 1932 ───────────────
  {
    externalId: 'trajectory:cushing-pituitary-basophilism-1932',
    text: 'Harvey Cushing reported in the Bulletin of the Johns Hopkins Hospital in 1932 that a constellation of obesity, hypertension, glucose intolerance, and other signs (\'pituitary basophilism\') is caused by basophil adenomas of the anterior pituitary, establishing a discrete pituitary-driven endocrine syndrome later named Cushing\'s disease.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1932-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1932-01-01',
        datePrecision: 'YEAR',
        reason: 'Cushing published \'The basophil adenomas of the pituitary body and their clinical manifestations (pituitary basophilism)\' in the Bulletin of the Johns Hopkins Hospital (1932;50:137–195), gathering twelve patients with a shared clinical picture and proposing that pituitary basophil adenomas were the cause. This recorded in the expert literature the claim that a specific pituitary lesion produces a defined metabolic/endocrine syndrome, distinguishing it from generic obesity or adrenal disorders.',
        source: {
          externalId: 'src:cushing-basophil-adenomas-pituitary-bjhh-1932',
          name: 'Cushing H. The basophil adenomas of the pituitary body and their clinical manifestations (pituitary basophilism). Bull Johns Hopkins Hosp. 1932;50:137–195. (Landmark reprint: PMID 16353601.)',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16353601/',
          publishedAt: '1932-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1943-01-01',
        datePrecision: 'YEAR',
        reason: 'The isolation and characterization of the pituitary\'s adrenocorticotropic hormone (ACTH) in the early 1940s supplied the mechanistic basis for Cushing\'s syndrome — ACTH-secreting pituitary adenomas driving adrenal cortisol excess — confirming that the clinical picture Cushing described is mediated by a pituitary corticotropic hormone. The entity was institutionalized under the eponym Cushing\'s disease and remains a settled, standard diagnosis in endocrinology.',
        source: {
          externalId: 'src:cushing-hench-pituitary-basophilism-history-scielo',
          name: 'Harvey Cushing and Philip Hench: pituitary basophilism meets cortisone excess (historical review of the establishment of Cushing\'s disease as a pituitary-ACTH syndrome). Arq Bras Endocrinol Metabol.',
          url: 'https://www.scielo.br/j/abem/a/QVr8CgXvvbsDf3RDNB79z8P/?lang=en',
          publishedAt: '2011-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Sakel insulin coma therapy for schizophrenia — 1933 / reversed 1957 ────
  {
    externalId: 'trajectory:sakel-insulin-coma-therapy-schizophrenia-1933',
    text: 'Manfred Sakel announced in 1933 that deliberately inducing hypoglycemic coma with large insulin doses (\'insulin shock therapy\') produced lasting remission in schizophrenia, reporting recovery in as many as 88% of patients — a claim that became standard psychiatric practice before a controlled trial showed it offered no specific benefit.',
    claimType: 'HYBRID',
    claimEmergedAt: '1933-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1933-01-01',
        datePrecision: 'YEAR',
        reason: 'Sakel, having observed that accidental insulin overdose calmed agitated patients, made his results public in 1933 (with fuller reports in the Wiener klinische Wochenschrift in 1934), claiming that controlled insulin-induced hypoglycemic coma produced remission in schizophrenia. This recorded in the expert literature the claim that a metabolic intervention with insulin could treat a major psychiatric illness.',
        source: {
          externalId: 'src:sakel-insulin-coma-therapy-history-pmc',
          name: 'Freudenthal R, Moncrieff J. \'A landmark in psychiatric progress\'? The role of evidence in the rise and fall of insulin coma therapy (documenting Sakel\'s 1933 introduction and ~88% improvement claim). Hist Psychiatry. 2022. PMC8886299.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8886299/',
          publishedAt: '2022-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1937-01-01',
        datePrecision: 'YEAR',
        reason: 'Insulin coma therapy spread rapidly through psychiatric hospitals across Europe and North America in the late 1930s and 1940s, with dedicated \'insulin units\' established as standard infrastructure and the method endorsed at international meetings (notably the 1937 Münsingen conference on the new shock therapies). Institutional adoption made insulin coma a settled, mainstream treatment for schizophrenia for roughly two decades.',
        source: {
          externalId: 'src:insulin-shock-therapy-decline-britannica',
          name: 'Insulin shock therapy: description, uses, effects, and decline (documenting widespread institutional adoption in the 1930s–1950s). Encyclopædia Britannica.',
          url: 'https://www.britannica.com/science/insulin-shock-therapy',
          publishedAt: '2023-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1957-03-23',
        datePrecision: 'DAY',
        reason: 'Brian Ackner, Arthur Harris, and A. J. Oldham published a randomized controlled trial in The Lancet on 23 March 1957 comparing insulin coma with barbiturate-induced unconsciousness in schizophrenia and found no difference in outcome — showing insulin\'s apparent benefit was attributable to nonspecific factors and patient selection, not the hypoglycemic coma. This rigorous trial (among the first RCTs in psychiatry) reversed the claim, and insulin coma therapy was abandoned as neuroleptic drugs took its place.',
        source: {
          externalId: 'src:ackner-insulin-treatment-schizophrenia-lancet-1957',
          name: 'Ackner B, Harris A, Oldham AJ. Insulin treatment of schizophrenia; a controlled study. Lancet. 1957 Mar 23;272(6969):607–611. (PMID 13407078.)',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13407078/',
          publishedAt: '1957-03-23',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // WOMEN'S HEALTH & PREVENTION ERA (1992–2007)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── STAR trial — raloxifene vs tamoxifen breast cancer prevention 2006 ──────
  {
    externalId: 'trajectory:star-trial-raloxifene-tamoxifen-breast-cancer-prevention-2006',
    text: 'The NSABP Study of Tamoxifen and Raloxifene (STAR/P-2) trial established that raloxifene is as effective as tamoxifen in reducing the risk of invasive breast cancer in high-risk postmenopausal women, with a lower risk of thromboembolic events and cataracts, as reported by Vogel et al. on 21 June 2006.',
    claimType: 'HYBRID',
    claimEmergedAt: '2006-06-21',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-06-21',
        datePrecision: 'DAY',
        reason: 'Vogel and colleagues published the STAR (NSABP P-2) randomized double-blind trial of nearly 20,000 high-risk postmenopausal women in JAMA, concluding that raloxifene was as effective as tamoxifen at reducing invasive breast cancer while causing fewer thromboembolic events and cataracts. This recorded into the literature the first head-to-head evidence that a second selective estrogen receptor modulator could be used for chemoprevention, expanding options beyond tamoxifen (NSABP P-1, 1998).',
        source: {
          externalId: 'src:vogel-star-p2-jama-2006',
          name: 'Vogel VG, Costantino JP, Wickerham DL, et al. Effects of tamoxifen vs raloxifene on the risk of developing invasive breast cancer and other disease outcomes: the NSABP Study of Tamoxifen and Raloxifene (STAR) P-2 trial. JAMA. 2006;295(23):2727-2741.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16754727/',
          publishedAt: '2006-06-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2007-09-14',
        datePrecision: 'DAY',
        reason: 'Following a July 2007 Oncologic Drugs Advisory Committee recommendation, the FDA approved raloxifene (Evista, Eli Lilly) in September 2007 for reducing the risk of invasive breast cancer in postmenopausal women with osteoporosis and in those at high risk. The regulatory approval institutionally ratified the STAR finding, making raloxifene the first SERM approved for breast cancer risk reduction alongside tamoxifen.',
        source: {
          externalId: 'src:fda-odac-evista-raloxifene-2007',
          name: 'U.S. Food and Drug Administration. Oncologic Drugs Advisory Committee; Notice of Meeting (review of EVISTA/raloxifene hydrochloride for reduction in risk of invasive breast cancer in postmenopausal women). Federal Register. 14 June 2007.',
          url: 'https://www.federalregister.gov/documents/2007/06/14/E7-11496/oncologic-drugs-advisory-committee-notice-of-meeting',
          publishedAt: '2007-06-14',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── WHIMS — estrogen plus progestin dementia risk 2003 ───────────────────────
  {
    externalId: 'trajectory:whims-estrogen-progestin-dementia-risk-2003',
    text: 'The Women\'s Health Initiative Memory Study (WHIMS) established that estrogen plus progestin therapy approximately doubles the risk of probable dementia in postmenopausal women aged 65 and older, as reported by Shumaker et al. on 28 May 2003.',
    claimType: 'HYBRID',
    claimEmergedAt: '2003-05-28',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2003-05-28',
        datePrecision: 'DAY',
        reason: 'Shumaker and the WHIMS investigators published a randomized, placebo-controlled trial of 4,532 women aged 65+ in JAMA, finding that combined conjugated equine estrogen plus medroxyprogesterone roughly doubled the hazard of probable dementia (HR 2.05) without preventing mild cognitive impairment. This directly contradicted prior observational suggestions (e.g., Nurses\' Health Study) that estrogen was cognitively protective, recording a reversal of the menopausal-hormone neuroprotection hypothesis.',
        source: {
          externalId: 'src:shumaker-whims-dementia-jama-2003',
          name: 'Shumaker SA, Legault C, Rapp SR, et al. Estrogen plus progestin and the incidence of dementia and mild cognitive impairment in postmenopausal women: the Women\'s Health Initiative Memory Study: a randomized controlled trial. JAMA. 2003;289(20):2651-2662.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12771112/',
          publishedAt: '2003-05-28',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2004-06-23',
        datePrecision: 'DAY',
        reason: 'The WHIMS estrogen-alone arm (conjugated equine estrogens without progestin) published in JAMA confirmed an adverse effect on global cognitive function and an increased risk of dementia/MCI, demonstrating the harm was not limited to the progestin component. The convergence of both hormone arms settled the conclusion that systemic menopausal hormone therapy does not protect, and can harm, cognition in older women.',
        source: {
          externalId: 'src:espeland-whims-estrogen-alone-jama-2004',
          name: 'Espeland MA, Rapp SR, Shumaker SA, et al. Conjugated equine estrogens and global cognitive function in postmenopausal women: Women\'s Health Initiative Memory Study. JAMA. 2004;291(24):2959-2968.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15213207/',
          publishedAt: '2004-06-23',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Phenylpropanolamine — hemorrhagic stroke risk 2000 ───────────────────────
  {
    externalId: 'trajectory:phenylpropanolamine-hemorrhagic-stroke-2000',
    text: 'Phenylpropanolamine, an ingredient in over-the-counter decongestants and appetite suppressants, is an independent risk factor for hemorrhagic stroke—particularly in women using it for weight loss—as established by the Yale Hemorrhagic Stroke Project (Kernan et al.) reported on 21 December 2000.',
    claimType: 'HYBRID',
    claimEmergedAt: '2000-12-21',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2000-12-21',
        datePrecision: 'DAY',
        reason: 'Kernan et al. published the FDA-commissioned Hemorrhagic Stroke Project, a case-control study of 702 patients and 1,376 controls, in the New England Journal of Medicine, finding phenylpropanolamine an independent risk factor for hemorrhagic stroke—with a striking adjusted odds ratio of 16.6 among women taking appetite suppressants. The FDA had already issued a public health advisory on 6 November 2000 based on the study\'s pre-publication report and requested manufacturers voluntarily stop marketing PPA products.',
        source: {
          externalId: 'src:kernan-ppa-hemorrhagic-stroke-nejm-2000',
          name: 'Kernan WN, Viscoli CM, Brass LM, et al. Phenylpropanolamine and the risk of hemorrhagic stroke. N Engl J Med. 2000;343(25):1826-1832.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11117973/',
          publishedAt: '2000-12-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2005-12-22',
        datePrecision: 'DAY',
        reason: 'The FDA published a tentative final monograph proposing to reclassify phenylpropanolamine as a nonmonograph (Category II) ingredient—not generally recognized as safe and effective—for over-the-counter use, formalizing the removal initiated by the 2000 advisory. This institutionally settled that PPA\'s stroke risk outweighed its benefit, completing the drug\'s exit from the U.S. market.',
        source: {
          externalId: 'src:fda-ppa-tentative-final-monograph-2005',
          name: 'U.S. Food and Drug Administration. Phenylpropanolamine-Containing Drug Products for Over-the-Counter Human Use; Tentative Final Monograph. Federal Register. 22 December 2005.',
          url: 'https://www.federalregister.gov/documents/2005/12/22/E5-7646/phenylpropanolamine-containing-drug-products-for-over-the-counter-human-use-tentative-final',
          publishedAt: '2005-12-22',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── WHI calcium + vitamin D fracture prevention contested 2006 ───────────────
  {
    externalId: 'trajectory:whi-calcium-vitamin-d-fracture-prevention-contested-2006',
    text: 'Routine daily calcium plus vitamin D supplementation prevents fractures in healthy postmenopausal women—a claim established by the Chapuy DECALYOS trial in 1992 and substantially narrowed when the Women\'s Health Initiative found no significant reduction in hip fractures (Jackson et al., 16 February 2006).',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1992-12-03',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1992-12-03',
        datePrecision: 'DAY',
        reason: 'Chapuy et al. published the DECALYOS trial in the New England Journal of Medicine, reporting that vitamin D3 plus calcium reduced hip fractures by 43% and nonvertebral fractures by 32% in elderly women. The result established the widely adopted belief that calcium-plus-vitamin-D supplementation prevents fractures, underpinning decades of guideline recommendations for postmenopausal women.',
        source: {
          externalId: 'src:chapuy-decalyos-vitd-calcium-nejm-1992',
          name: 'Chapuy MC, Arlot ME, Duboeuf F, et al. Vitamin D3 and calcium to prevent hip fractures in elderly women. N Engl J Med. 1992;327(23):1637-1642.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/1331788/',
          publishedAt: '1992-12-03',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-02-16',
        datePrecision: 'DAY',
        reason: 'The Women\'s Health Initiative randomized 36,282 generally healthy postmenopausal women to calcium carbonate plus vitamin D3 (400 IU) or placebo (Jackson et al., NEJM), finding only a small bone-density gain, no statistically significant reduction in hip fracture, and a 17% increase in kidney stones. The large null result contested the routine-supplementation paradigm built on Chapuy\'s frail-elderly population, narrowing the prevention claim and prompting guideline bodies to qualify their recommendations.',
        source: {
          externalId: 'src:jackson-whi-calcium-vitd-nejm-2006',
          name: 'Jackson RD, LaCroix AZ, Gass M, et al. Calcium plus vitamin D supplementation and the risk of fractures. N Engl J Med. 2006;354(7):669-683.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16481635/',
          publishedAt: '2006-02-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // MODERN ERA — PEDIATRIC & EMERGENCY MEDICINE (2011–2022)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Palforzia peanut OIT FDA approval 2020 ──────────────────────────────────
  {
    externalId: 'trajectory:palforzia-peanut-oral-immunotherapy-2020',
    text: 'AR101 (Palforzia), a standardized peanut-protein oral immunotherapy, desensitizes peanut-allergic children aged 4–17 and was approved by the FDA on 31 January 2020 as the first drug ever approved to treat a food allergy.',
    claimType: 'HYBRID',
    claimEmergedAt: '2018-11-22',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-11-22',
        datePrecision: 'DAY',
        reason: 'The phase 3 PALISADE trial, published in the New England Journal of Medicine, randomized 496 peanut-allergic participants and found that 67.2% of children aged 4–17 receiving AR101 could tolerate ≥600 mg of peanut protein versus 4.0% on placebo. This recorded the first large randomized evidence that a standardized oral immunotherapy product could reliably desensitize peanut-allergic children, while showing no benefit in adults.',
        source: {
          externalId: 'src:palisade-ar101-nejm-2018',
          name: 'PALISADE Group of Clinical Investigators; Vickery BP, et al. AR101 Oral Immunotherapy for Peanut Allergy. N Engl J Med. 2018;379(21):1991-2001.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/30449234/',
          publishedAt: '2018-11-22',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2019-04-25',
        datePrecision: 'DAY',
        reason: 'The PACE systematic review and meta-analysis in The Lancet pooled 12 trials and found that peanut oral immunotherapy, despite achieving desensitization, more than tripled the risk of anaphylaxis (risk ratio 3.12) and increased adrenaline use compared with avoidance or placebo. The high-certainty finding contested the net clinical benefit of OIT in the very interval before regulatory approval, arguing current protocols caused more allergic reactions than they prevented.',
        source: {
          externalId: 'src:chu-pace-oit-lancet-2019',
          name: 'Chu DK, Wood RA, French S, et al. Oral immunotherapy for peanut allergy (PACE): a systematic review and meta-analysis of efficacy and safety. Lancet. 2019;393(10187):2222-2232.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/31030987/',
          publishedAt: '2019-04-25',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2020-01-31',
        datePrecision: 'DAY',
        reason: 'The FDA approved Palforzia (peanut allergen powder-dnfp) for peanut-allergic patients aged 4–17, the first approved treatment for any food allergy, dispensed under a risk-mitigation (REMS) program because of the anaphylaxis risk. The approval settled the product as authorized institutional practice—accepting the desensitization benefit while structurally managing the safety signal the meta-analysis had raised.',
        source: {
          externalId: 'src:fda-palforzia-approval-2020',
          name: 'U.S. Food and Drug Administration. Palforzia [Peanut (Arachis hypogaea) Allergen Powder-dnfp] — first treatment for peanut allergy. Approved January 31, 2020.',
          url: 'https://www.fda.gov/vaccines-blood-biologics/allergenics/palforzia',
          publishedAt: '2020-01-31',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── FEAST fluid bolus mortality African children 2011 ───────────────────────
  {
    externalId: 'trajectory:feast-fluid-bolus-mortality-african-children-2011',
    text: 'The FEAST randomized trial reported on 26 May 2011 that rapid intravenous fluid boluses increased 48-hour mortality in African children with severe febrile illness and impaired perfusion, contradicting the long-standing resuscitation doctrine that aggressive early fluid expansion saves lives in shock.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2011-05-26',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2011-05-26',
        datePrecision: 'DAY',
        reason: 'The FEAST trial (3,141 children at six East African centers), published in the New England Journal of Medicine, found 48-hour mortality of 10.5–10.6% with saline or albumin boluses versus 7.3% with no bolus—a 45% relative increase in death. This recorded the first large randomized evidence that bolus fluid resuscitation, a near-universal element of pediatric emergency care, actively increased mortality in this population.',
        source: {
          externalId: 'src:maitland-feast-nejm-2011',
          name: 'Maitland K, Kiguli S, Opoka RO, et al. Mortality after Fluid Bolus in African Children with Severe Infection. N Engl J Med. 2011;364(26):2483-2495.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/21615299/',
          publishedAt: '2011-06-30',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '2014-01-15',
        datePrecision: 'MONTH',
        reason: 'Despite FEAST, the WHO\'s 2013 pediatric guidance retained the recommendation to give rapid 20 mL/kg crystalloid boluses for childhood shock. The FEAST investigators publicly contested this in the BMJ, arguing the WHO had failed to incorporate high-quality randomized evidence per its own GRADE process and was endangering children—leaving the bolus question institutionally unsettled even as the trial result stood in the literature.',
        source: {
          externalId: 'src:kiguli-who-missing-feast-bmj-2014',
          name: 'Kiguli S, Akech SO, Mtove G, et al. WHO guidelines on fluid resuscitation in children: missing the FEAST data. BMJ. 2014;348:f7003.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/24423891/',
          publishedAt: '2014-01-15',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── CCHD pulse-oximetry newborn screening RUSP 2011 ────────────────────────
  {
    externalId: 'trajectory:cchd-pulse-oximetry-newborn-screening-rusp-2011',
    text: 'On 21 September 2011 the U.S. Secretary of Health and Human Services adopted the recommendation to add pulse-oximetry screening for critical congenital heart disease to the Recommended Uniform Screening Panel, establishing universal point-of-care CCHD screening of newborns.',
    claimType: 'HYBRID',
    claimEmergedAt: '2011-09-21',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2011-09-21',
        datePrecision: 'DAY',
        reason: 'Acting on the Secretary\'s Advisory Committee on Heritable Disorders in Newborns and Children, HHS Secretary Kathleen Sebelius recommended adding CCHD to the RUSP, and the American Academy of Pediatrics formally endorsed the recommendation. This recorded pulse oximetry—previously a screening question debated in the literature—as a nationally recommended newborn screen, with implementation strategies (Kemper et al.) issued the same year.',
        source: {
          externalId: 'src:mahle-aap-cchd-endorsement-pediatrics-2012',
          name: 'Mahle WT, Martin GR, Beekman RH, Morrow WR; Section on Cardiology and Cardiac Surgery. Endorsement of Health and Human Services Recommendation for Pulse Oximetry Screening for Critical Congenital Heart Disease. Pediatrics. 2012;129(1):190-192.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/22201143/',
          publishedAt: '2011-12-26',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2018-12-31',
        datePrecision: 'YEAR',
        reason: 'By the end of 2018 all 50 U.S. states and the District of Columbia had implemented mandated or universal newborn CCHD pulse-oximetry screening, as documented in the CDC\'s MMWR review of actions taken from 2011–2018. The transition from a federal recommendation to near-complete legislative and operational uptake nationwide settled CCHD pulse-oximetry screening as standard newborn care.',
        source: {
          externalId: 'src:cdc-mmwr-cchd-screening-actions-2019',
          name: 'Glidewell J, Olney RS, Hinton C, et al. Actions in Support of Newborn Screening for Critical Congenital Heart Disease — United States, 2011–2018. MMWR Morb Mortal Wkly Rep. 2019;68(5):107-111.',
          url: 'https://www.cdc.gov/mmwr/volumes/68/wr/mm6805a3.htm',
          publishedAt: '2019-02-08',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── TODAY trial youth-onset type 2 diabetes metformin failure 2012 ──────────
  {
    externalId: 'trajectory:today-youth-onset-type2-diabetes-metformin-failure-2012',
    text: 'The TODAY trial reported on 29 April 2012 that metformin monotherapy failed to maintain glycemic control in roughly half of youth with type 2 diabetes within about four years, establishing that pediatric-onset type 2 diabetes is more aggressive and treatment-resistant than adult-onset disease.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2012-04-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2012-04-29',
        datePrecision: 'DAY',
        reason: 'The NIH-funded TODAY trial (699 youth, the first major randomized comparison of treatments for pediatric type 2 diabetes), published in the New England Journal of Medicine, found that metformin alone failed in 51.7% of participants over a mean 3.9 years, with metformin-plus-lifestyle no better. This recorded the unexpected finding that youth-onset type 2 diabetes loses glycemic control far faster than adult disease, undercutting the assumption that pediatric T2D could be managed like the adult form.',
        source: {
          externalId: 'src:today-glycemic-control-nejm-2012',
          name: 'TODAY Study Group; Zeitler P, Hirst K, Pyle L, et al. A Clinical Trial to Maintain Glycemic Control in Youth with Type 2 Diabetes. N Engl J Med. 2012;366(24):2247-2256.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/22540912/',
          publishedAt: '2012-06-14',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2021-07-29',
        datePrecision: 'DAY',
        reason: 'The TODAY2 long-term follow-up in the New England Journal of Medicine reported that by a mean of 13 years from diagnosis, 60.1% of the youth-onset cohort had at least one diabetes complication and 28.4% had two or more—rates exceeding those for adult type 2 or pediatric type 1 diabetes. The decade-long confirmation settled youth-onset type 2 diabetes as a distinctly aggressive, high-complication phenotype rather than an early form of typical adult disease.',
        source: {
          externalId: 'src:today2-long-term-complications-nejm-2021',
          name: 'TODAY Study Group. Long-Term Complications in Youth-Onset Type 2 Diabetes. N Engl J Med. 2021;385(5):416-426.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/34320286/',
          publishedAt: '2021-07-29',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // DRUG DISCOVERY ERA (pre-1950) — continued
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Phenytoin — first rationally screened anticonvulsant — Merritt & Putnam 1938
  {
    externalId: 'trajectory:merritt-putnam-phenytoin-nonsedative-anticonvulsant-1938',
    text: 'H. Houston Merritt and Tracy J. Putnam reported in JAMA on 17 September 1938 that sodium diphenyl hydantoinate (phenytoin/Dilantin) controlled grand mal and psychomotor seizures in patients without the sedation caused by bromides and barbiturates, the first anticonvulsant identified by systematic animal screening rather than by chance observation of sedative effect.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1938-09-17',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1938-09-17',
        datePrecision: 'DAY',
        reason: 'Merritt and Putnam reported clinical results in a series of patients with epilepsy whose seizures were unresponsive to prior treatment, finding grand mal attacks relieved in 58% and greatly reduced in a further 27%, with control achieved without the sedation that limited bromides and phenobarbital. The work recorded both a new effective drug and a new discovery method: phenytoin had been selected by screening compounds against electrically induced convulsions in cats, the first rationally screened anticonvulsant.',
        source: {
          externalId: 'src:merritt-putnam-jama-1938',
          name: 'Merritt HH, Putnam TJ. Sodium diphenyl hydantoinate in the treatment of convulsive disorders. JAMA. 1938;111(12):1068-1073 (reprinted JAMA. 1984;251(8):1062-1067).',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6363736/',
          publishedAt: '1938-09-17',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1984-02-24',
        datePrecision: 'DAY',
        reason: 'Phenytoin became and remained a first-line anticonvulsant, and the electroshock-screening paradigm it pioneered became the template for anticonvulsant drug discovery. JAMA marked this settled, canonical status by republishing the 1938 report as a \'Landmark Article\' in 1984, recognizing it as foundational to modern epilepsy therapy.',
        source: {
          externalId: 'src:merritt-putnam-jama-landmark-1984',
          name: 'Merritt HH, Putnam TJ. Landmark article Sept 17, 1938: Sodium diphenyl hydantoinate in the treatment of convulsive disorders. JAMA. 1984;251(8):1062-1067.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6363736/',
          publishedAt: '1984-02-24',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Curare in anesthesia — Griffith & Johnson 1942 ─────────────────────────
  {
    externalId: 'trajectory:griffith-johnson-curare-general-anesthesia-1942',
    text: 'Harold R. Griffith and G. Enid Johnson reported in Anesthesiology in July 1942 that the curare extract Intocostrin produced safe, controllable skeletal-muscle relaxation in 25 patients undergoing general anesthesia, beginning with an appendectomy on 23 January 1942, establishing deliberate neuromuscular blockade as a component of surgical anesthesia.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1942-07-01',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1942-07-01',
        datePrecision: 'DAY',
        reason: 'Griffith and Johnson administered the standardized curare extract Intocostrin to a 20-year-old patient during cyclopropane anesthesia for appendectomy on 23 January 1942 and reproduced controllable muscle relaxation in 25 patients, publishing the series in Anesthesiology in July 1942. The report recorded for the first time that a paralytic agent long feared as \'arrow poison\' could be used deliberately and reversibly to provide surgical relaxation without deep anesthesia.',
        source: {
          externalId: 'src:griffith-johnson-anesthesiology-1942',
          name: 'Griffith HR, Johnson GE. The use of curare in general anesthesia. Anesthesiology. 1942;3(4):418-420.',
          url: 'https://journals.lww.com/anesthesiology/citation/1942/07000/the_use_of_curare_in_general_anesthesia.6.aspx',
          publishedAt: '1942-07-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-01-01',
        datePrecision: 'YEAR',
        reason: 'Neuromuscular blockade was rapidly adopted worldwide and became one of the three pillars of balanced anesthesia (hypnosis, analgesia, relaxation), enabling abdominal and thoracic surgery without dangerously deep anesthesia. On the 75th anniversary of Griffith and Johnson\'s report, the Canadian Journal of Anesthesia published a historical tribute documenting how the 1942 demonstration transformed anesthetic practice into a permanent standard.',
        source: {
          externalId: 'src:cja-griffith-curare-tribute-2017',
          name: 'Raghavendra T, et al. Harold Griffith\'s legacy: a tribute on the 75th anniversary of the introduction of curare into anesthetic practice. Can J Anaesth. 2017;64(5):559-568.',
          url: 'https://link.springer.com/article/10.1007/s12630-017-0864-6',
          publishedAt: '2017-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // MODERN ERA (2010–present) — regulatory & rare disease
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── FDA Breakthrough Therapy designation — FDASIA 2012 ─────────────────────
  {
    externalId: 'trajectory:fda-breakthrough-therapy-designation-fdasia-2012',
    text: 'The Food and Drug Administration Safety and Innovation Act, signed into law on 9 July 2012, created in Section 902 the Breakthrough Therapy designation, requiring the FDA to expedite development and review of drugs for serious or life-threatening conditions when preliminary clinical evidence indicates substantial improvement over existing therapies on a clinically significant endpoint.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2012-07-09',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2012-07-09',
        datePrecision: 'DAY',
        reason: 'Congress enacted FDASIA (S.3187, Public Law 112-144), whose Section 902 amended Section 506 of the Federal Food, Drug, and Cosmetic Act to establish the Breakthrough Therapy designation. The provision codified a new expedited pathway intended to accelerate drugs—frequently for rare and serious diseases—that show early evidence of substantial clinical advantage, recording a statutory commitment that did not yet have operational proof.',
        source: {
          externalId: 'src:fdasia-s3187-pl112-144',
          name: 'Food and Drug Administration Safety and Innovation Act, Pub. L. No. 112-144, §902 (S.3187, 112th Congress). Signed July 9, 2012.',
          url: 'https://www.congress.gov/bill/112th-congress/senate-bill/3187',
          publishedAt: '2012-07-09',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2013-11-01',
        datePrecision: 'DAY',
        reason: 'On 1 November 2013 the FDA approved obinutuzumab (Gazyva) for chronic lymphocytic leukemia, the first drug carrying a Breakthrough Therapy designation to reach approval, demonstrating that the statutory pathway functioned operationally. The designation thereafter became an entrenched, heavily used FDA mechanism granted to hundreds of therapies, settling it as a permanent feature of US drug regulation.',
        source: {
          externalId: 'src:gazyva-first-breakthrough-approval-2013',
          name: 'Gazyva (obinutuzumab) FDA Approval History — first Breakthrough Therapy-designated drug approved, November 1, 2013. Drugs.com.',
          url: 'https://www.drugs.com/history/gazyva.html',
          publishedAt: '2013-11-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Elosulfase alfa (Vimizim) — first Morquio A treatment — 2014 ───────────
  {
    externalId: 'trajectory:elosulfase-alfa-vimizim-first-morquio-a-treatment-2014',
    text: 'The FDA approved elosulfase alfa (Vimizim) on 14 February 2014 as the first treatment for mucopolysaccharidosis type IVA (Morquio A syndrome), a rare lysosomal storage disorder caused by deficiency of N-acetylgalactosamine-6-sulfatase (GALNS), establishing the first enzyme replacement therapy targeting the disease\'s underlying cause.',
    claimType: 'HYBRID',
    claimEmergedAt: '2014-02-14',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2014-02-14',
        datePrecision: 'DAY',
        reason: 'The FDA approved elosulfase alfa (Vimizim, BioMarin, BLA 125460) as the first treatment for Morquio A syndrome on 14 February 2014, and it became the first drug ever to receive a Rare Pediatric Disease Priority Review Voucher. The approval institutionally recorded GALNS enzyme replacement as a viable disease-modifying therapy for a condition that previously had no approved treatment beyond supportive care.',
        source: {
          externalId: 'src:sanford-elosulfase-first-approval-2014',
          name: 'Sanford M, Lo JH. Elosulfase alfa: first global approval (US FDA approval 14 February 2014 for MPS IVA). Drugs. 2014;74(6):713-718.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/24700469/',
          publishedAt: '2014-04-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2014-05-10',
        datePrecision: 'DAY',
        reason: 'Hendriksz and colleagues published the pivotal MOR-004 phase 3 randomized, double-blind, placebo-controlled trial in the Journal of Inherited Metabolic Disease, reporting that weekly elosulfase alfa significantly improved 6-minute walk distance versus placebo over 24 weeks. The peer-reviewed publication settled the first controlled clinical evidence that GALNS enzyme replacement improved functional endurance in Morquio A, confirming the clinical basis underlying the FDA approval.',
        source: {
          externalId: 'src:hendriksz-elosulfase-jimd-2014',
          name: 'Hendriksz CJ, et al. Efficacy and safety of enzyme replacement therapy with BMN 110 (elosulfase alfa) for Morquio A syndrome (mucopolysaccharidosis IVA): a phase 3 randomised placebo-controlled study. J Inherit Metab Dis. 2014;37(6):979-990.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/24810369/',
          publishedAt: '2014-05-10',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Asfotase alfa (Strensiq) — first hypophosphatasia treatment — 2015 ──────
  {
    externalId: 'trajectory:asfotase-alfa-strensiq-first-hypophosphatasia-treatment-2015',
    text: 'The FDA approved asfotase alfa (Strensiq) on 23 October 2015 as the first treatment for perinatal-, infantile-, and juvenile-onset hypophosphatasia, a rare inherited deficiency of tissue-nonspecific alkaline phosphatase, making it the first bone-targeted enzyme replacement therapy for the disease.',
    claimType: 'HYBRID',
    claimEmergedAt: '2012-03-08',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2012-03-08',
        datePrecision: 'DAY',
        reason: 'Whyte and colleagues reported in the New England Journal of Medicine that bone-targeted recombinant human TNSALP (ENB-0040, later asfotase alfa) improved skeletal radiographs and pulmonary and physical function in infants and young children with life-threatening hypophosphatasia, a disease that until then had no disease-modifying therapy. The trial recorded the first clinical evidence that enzyme replacement could reverse the skeletal manifestations of HPP.',
        source: {
          externalId: 'src:whyte-asfotase-nejm-2012',
          name: 'Whyte MP, et al. Enzyme-replacement therapy in life-threatening hypophosphatasia. N Engl J Med. 2012;366(10):904-913.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/22397652/',
          publishedAt: '2012-03-08',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2015-10-23',
        datePrecision: 'DAY',
        reason: 'The FDA approved asfotase alfa (Strensiq, Alexion, BLA 125513) for perinatal/infantile- and juvenile-onset hypophosphatasia, the first-ever approved treatment for the condition, following approvals in Japan (July 2015) and the EU (August 2015). The approval institutionally settled bone-targeted enzyme replacement as the standard of care for a disease previously managed only with supportive measures.',
        source: {
          externalId: 'src:scott-asfotase-first-approval-2016',
          name: 'Scott LJ. Asfotase alfa: enzyme replacement for the treatment of bone disease in hypophosphatasia (first US FDA approval 23 October 2015). BioDrugs. 2016;30(1):41-48.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/27376160/',
          publishedAt: '2016-02-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // INFECTION CONTROL & ANTISEPSIS (1847–1867)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Semmelweis handwashing / puerperal fever — 1847 ────────────────────────
  {
    externalId: 'trajectory:semmelweis-handwashing-puerperal-fever-1847',
    text: 'Ignaz Semmelweis demonstrated at the Vienna General Hospital First Obstetrical Clinic that requiring physicians to wash their hands in a chlorinated-lime solution before examining maternity patients sharply reduced deaths from puerperal (childbed) fever, an intervention he instituted in May 1847.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1847-05-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1848-01-01',
        datePrecision: 'YEAR',
        reason: 'After his colleague Jakob Kolletschka died in March 1847 from a wound sustained during an autopsy and showed the same pathology as women dying of puerperal fever, Semmelweis inferred that \'cadaverous particles\' carried on physicians\' hands caused the disease and ordered chlorinated-lime handwashing; monthly maternal mortality in the doctors\' clinic fell from roughly 18% to under 2%. His findings were communicated to the Vienna medical community and published in editorials by Ferdinand von Hebra in the journal of the Vienna Medical Society in 1847–1848, recording the claim in the expert literature.',
        source: {
          externalId: 'src:best-neuhauser-semmelweis-qshc-2004',
          name: 'Best M, Neuhauser D. Ignaz Semmelweis and the birth of infection control. Qual Saf Health Care. 2004;13(3):233-234.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1743827/',
          publishedAt: '2004-06-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1861-01-01',
        datePrecision: 'YEAR',
        reason: 'Semmelweis published his definitive treatise \'Die Ätiologie, der Begriff und die Prophylaxis des Kindbettfiebers\' in 1861, but his doctrine was widely rejected and disputed across the European medical establishment. Lacking the germ theory of disease, contemporaries could not accept a mechanism by which invisible particles caused infection, and the claim that physicians themselves transmitted lethal disease was professionally unwelcome; his work met hostile reviews and the practice was not adopted in his lifetime.',
        source: {
          externalId: 'src:semmelweis-aetiologie-kindbettfieber-1861',
          name: 'Semmelweis IP. Die Ätiologie, der Begriff und die Prophylaxis des Kindbettfiebers. Pest, Wien und Leipzig: C. A. Hartleben\'s Verlags-Expedition; 1861.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1743827/',
          publishedAt: '1861-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1879-01-01',
        datePrecision: 'YEAR',
        reason: 'The germ theory of disease developed by Louis Pasteur and the antiseptic surgery of Joseph Lister supplied the causal mechanism Semmelweis had lacked; Pasteur identified streptococci in puerperal-fever cases at the Académie de médecine in 1879, vindicating Semmelweis\'s empirical observation. By the late nineteenth century handwashing and antisepsis had become accepted standards of obstetric and surgical practice, settling the claim posthumously.',
        source: {
          externalId: 'src:best-neuhauser-semmelweis-qshc-2004',
          name: 'Best M, Neuhauser D. Ignaz Semmelweis and the birth of infection control. Qual Saf Health Care. 2004;13(3):233-234.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1743827/',
          publishedAt: '2004-06-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Lister antiseptic surgery — 1867 ───────────────────────────────────────
  {
    externalId: 'trajectory:lister-antiseptic-surgery-1867',
    text: 'Joseph Lister announced in 1867 that applying carbolic acid (phenol) to wounds and the surgical field—an \'antiseptic principle\' grounded in Pasteur\'s germ theory—prevents wound suppuration and sepsis, after he reported a dramatic fall in mortality among compound-fracture and amputation patients at the Glasgow Royal Infirmary.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1867-08-09',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1867-09-21',
        datePrecision: 'DAY',
        reason: 'Following his Lancet series \'On a New Method of Treating Compound Fracture, Abscess, etc.\' earlier in 1867, Lister read \'On the Antiseptic Principle in the Practice of Surgery\' before the British Medical Association in Dublin on 9 August 1867, published in the British Medical Journal on 21 September 1867. He generalized his clinical results into a principle—that wound putrefaction is caused by airborne germs and can be prevented by carbolic-acid antisepsis—recording the claim in the expert literature.',
        source: {
          externalId: 'src:lister-antiseptic-principle-bmj-1867',
          name: 'Lister J. On the Antiseptic Principle in the Practice of Surgery. Br Med J. 1867;2(351):246-248.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1841140/',
          publishedAt: '1867-09-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1879-01-01',
        datePrecision: 'YEAR',
        reason: 'Initially resisted in Britain, Listerian antisepsis was rapidly adopted by German surgeons (Volkmann, Nussbaum, von Bergmann) after Lister\'s mid-1870s Continental tours, where falling postoperative mortality validated the method. Reinforced by the consolidating germ theory of Pasteur and Koch, antiseptic—and soon aseptic—surgery became the accepted international standard by the early 1880s, settling the claim that microbial contamination causes surgical sepsis and can be prevented.',
        source: {
          externalId: 'src:antiseptic-principle-adoption-wikipedia',
          name: 'Antiseptic Principle of the Practice of Surgery (Joseph Lister, 1867) — adoption and legacy. Wikipedia.',
          url: 'https://en.wikipedia.org/wiki/Antiseptic_Principle_of_the_Practice_of_Surgery',
          publishedAt: '2024-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SURGICAL TRANSPLANTATION ERA (1954–1967)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Barnard first heart transplant — 1967 ──────────────────────────────────
  {
    externalId: 'trajectory:barnard-first-heart-transplant-1967',
    text: 'On 3 December 1967 Christiaan Barnard performed the first human-to-human heart transplant at Groote Schuur Hospital in Cape Town, replacing the irreparably damaged heart of 54-year-old Louis Washkansky with a donor heart; the patient survived 18 days, establishing that orthotopic cardiac transplantation in humans was technically achievable.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1967-12-03',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1967-12-30',
        datePrecision: 'DAY',
        reason: 'Barnard published \'The operation. A human cardiac transplant: an interim report of a successful operation performed at Groote Schuur Hospital, Cape Town\' in the South African Medical Journal on 30 December 1967, describing the transplant of a cadaver heart into a 54-year-old man with end-stage ischemic heart disease. The report recorded the claim that the human heart could be surgically transplanted and resume function in a recipient.',
        source: {
          externalId: 'src:barnard-cardiac-transplant-samj-1967',
          name: 'Barnard CN. The operation. A human cardiac transplant: an interim report of a successful operation performed at Groote Schuur Hospital, Cape Town. S Afr Med J. 1967;41(48):1271-1274.',
          url: 'https://scielo.org.za/scielo.php?script=sci_arttext&pid=S0256-95742017001200004',
          publishedAt: '1967-12-30',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1971-01-01',
        datePrecision: 'YEAR',
        reason: 'Barnard\'s operation triggered a global heart-transplant boom in 1968, with roughly a hundred procedures performed worldwide, but most recipients died within weeks from acute rejection and infection. By 1970–1971 dismal survival led the great majority of centers to abandon the operation, and the medical community openly questioned whether cardiac transplantation was clinically or ethically justifiable—throwing the procedure\'s viability into serious dispute.',
        source: {
          externalId: 'src:groote-schuur-heart-transplant-history-pmc',
          name: 'Brink JG, Hassoulas J. The first human heart transplant and further advances in cardiac transplantation at Groote Schuur Hospital and the University of Cape Town. Cardiovasc J Afr. 2009;20(1):31-35.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4200566/',
          publishedAt: '2009-02-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1983-11-01',
        datePrecision: 'MONTH',
        reason: 'The introduction of the immunosuppressant ciclosporin—approved by the FDA in November 1983—transformed transplant survival by controlling rejection, while persistent programs (notably Stanford under Shumway) demonstrated steadily improving outcomes. Heart transplantation was re-established as a standard, life-extending therapy for selected patients with end-stage heart failure, settling the claim that human cardiac transplantation is a viable treatment.',
        source: {
          externalId: 'src:groote-schuur-heart-transplant-history-pmc',
          name: 'Brink JG, Hassoulas J. The first human heart transplant and further advances in cardiac transplantation at Groote Schuur Hospital and the University of Cape Town. Cardiovasc J Afr. 2009;20(1):31-35.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4200566/',
          publishedAt: '2009-02-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // TARGETED THERAPY & PERSONALIZED MEDICINE ERA (1990–2010)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Imatinib / BCR-ABL targeted therapy — Druker 2001 ──────────────────────
  {
    externalId: 'trajectory:imatinib-cml-targeted-therapy-2001',
    text: 'Druker and colleagues reported in the New England Journal of Medicine on 5 April 2001 that the BCR-ABL tyrosine kinase inhibitor imatinib (STI571, Gleevec) produced complete hematologic responses in 53 of 54 chronic-phase chronic myeloid leukemia patients who had failed interferon, establishing the first molecularly targeted small-molecule therapy directed at the specific oncogenic kinase driving a cancer.',
    claimType: 'EMPIRICAL',
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
        reason: 'Druker et al. published the phase 1 trial of STI571 (imatinib) in chronic myeloid leukemia, reporting complete hematologic responses in 53 of 54 chronic-phase patients at daily doses of 300 mg or more, with cytogenetic responses and minimal toxicity. This recorded in the expert literature the claim that selectively inhibiting the BCR-ABL fusion kinase could control CML — proof of principle for rational, target-driven cancer drug design.',
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
        reason: 'The FDA granted accelerated approval to imatinib mesylate (Gleevec, Novartis) for chronic myeloid leukemia roughly ten weeks after the new drug application was submitted — among the fastest oncology approvals on record. Regulatory adoption settled imatinib as standard therapy and validated the targeted-kinase-inhibitor paradigm as a clinically and institutionally accepted approach to cancer treatment.',
        source: {
          externalId: 'src:fda-imatinib-cml-approval-summary-2002',
          name: 'Cohen MH, Williams G, Johnson JR, et al. Approval summary for imatinib mesylate capsules in the treatment of chronic myelogenous leukemia. Clin Cancer Res. 2002;8(5):935-942. (Documents FDA accelerated approval 10 May 2001.)',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12006504/',
          publishedAt: '2002-05-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Trastuzumab / HER2 breast cancer — FDA approval 1998 ───────────────────
  {
    externalId: 'trajectory:trastuzumab-her2-breast-cancer-1998',
    text: 'The U.S. FDA approved trastuzumab (Herceptin, Genentech) on 25 September 1998 for HER2-overexpressing metastatic breast cancer, establishing the first therapeutic monoclonal antibody directed at a defined molecular target in a solid tumor and co-approved with a companion diagnostic (HercepTest) used to select patients.',
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
        reason: 'The FDA approved trastuzumab for HER2-overexpressing metastatic breast cancer, alongside the HercepTest companion assay used to identify eligible patients. The approval recorded on the regulatory record the claim that an antibody against the HER2 receptor benefits the molecularly defined subset of breast-cancer patients, and inaugurated the drug-with-companion-diagnostic co-development model.',
        source: {
          externalId: 'src:fda-trastuzumab-approval-letter-1998',
          name: 'U.S. Food and Drug Administration. Trastuzumab (Herceptin), Genentech — approval letter, BLA/STN 98-0369 (approved 25 September 1998).',
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
        reason: 'Slamon et al. published the pivotal randomized trial in the New England Journal of Medicine, showing that adding trastuzumab to chemotherapy in HER2-positive metastatic breast cancer prolonged time to disease progression (median 7.4 vs 4.6 months) and improved overall survival. The peer-reviewed survival benefit settled in the expert literature the efficacy claim underlying the 1998 approval and confirmed HER2-targeted therapy as standard of care.',
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

  // ── PSA screening / prostate mortality — contested 2009 ────────────────────
  {
    externalId: 'trajectory:psa-screening-prostate-mortality-contested-2009',
    text: 'The claim that PSA-based screening reduces prostate-cancer mortality and warrants routine use in older men — institutionalized after the FDA cleared the PSA blood test for prostate-cancer detection in August 1994 — was thrown into contestation on 18 March 2009 when two large randomized trials, the U.S. PLCO and the European ERSPC, published in the New England Journal of Medicine reported, respectively, no mortality benefit and only a small benefit offset by substantial overdiagnosis.',
    claimType: 'HYBRID',
    claimEmergedAt: '1994-08-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1994-08-01',
        datePrecision: 'MONTH',
        reason: 'The FDA approved the Tandem PSA assay (Hybritech) for use with digital rectal examination to aid detection of prostate cancer in men aged 50 and older. Combined with professional-society endorsement of annual testing, this drove rapid, widespread adoption of PSA screening in U.S. practice, settling in clinical routine the assumption that early PSA-based detection reduces prostate-cancer deaths — a claim never yet tested in a randomized mortality trial.',
        source: {
          externalId: 'src:fda-psa-tandem-screening-clearance-1994',
          name: 'Research Corporation Technologies. Prostate-Specific Antigen Blood Test for Prostate Cancer (documents FDA approval of the Tandem PSA test for prostate-cancer detection, August 1994).',
          url: 'https://rctech.com/technologies/psa-blood-test-for-prostate-cancer/',
          publishedAt: '1994-08-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2009-03-18',
        datePrecision: 'DAY',
        reason: 'Two long-awaited randomized trials appeared together in the NEJM: the U.S. PLCO trial (Andriole et al.) found no significant prostate-cancer mortality difference between screened and usual-care groups, while the European ERSPC trial (Schröder et al.) found a 20% relative mortality reduction but estimated that 1,410 men would need screening and 48 additional cancers treated to prevent one death, with high overdiagnosis. The conflicting and at-best-marginal results directly challenged the settled assumption of net benefit and moved routine PSA screening into open expert contestation, foreshadowing the USPSTF\'s 2012 recommendation against it.',
        source: {
          externalId: 'src:erspc-schroder-psa-screening-nejm-2009',
          name: 'Schröder FH, Hugosson J, Roobol MJ, et al. Screening and prostate-cancer mortality in a randomized European study (ERSPC). N Engl J Med. 2009;360(13):1320-1328. (Companion: Andriole GL, et al. PLCO. N Engl J Med. 2009;360(13):1310-1319, PMID 19297565.)',
          url: 'https://pubmed.ncbi.nlm.nih.gov/19297566/',
          publishedAt: '2009-03-18',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Gefitinib / NSCLC accelerated approval — contested 2005 ────────────────
  {
    externalId: 'trajectory:gefitinib-nsclc-accelerated-approval-contested-2005',
    text: 'The claim that gefitinib (Iressa, AstraZeneca) — granted FDA accelerated approval on 5 May 2003 for advanced non-small-cell lung cancer after chemotherapy failure on the basis of tumor-response rates — provided clinical benefit in the broad refractory NSCLC population was overturned when the ISEL trial, published in The Lancet on 29 October 2005, found no significant survival benefit versus placebo, prompting the FDA to restrict the drug\'s labeling in June 2005 to patients already benefiting.',
    claimType: 'HYBRID',
    claimEmergedAt: '2003-05-05',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2003-05-05',
        datePrecision: 'DAY',
        reason: 'The FDA granted accelerated approval to gefitinib as monotherapy for locally advanced or metastatic NSCLC after failure of platinum- and docetaxel-based chemotherapy, relying on objective tumor-response rate as a surrogate endpoint rather than a survival benefit. The approval recorded on the regulatory record the conditional claim that gefitinib helps refractory lung-cancer patients, pending confirmatory survival data.',
        source: {
          externalId: 'src:fda-gefitinib-approval-summary-2003',
          name: 'Cohen MH, Williams GA, Sridhara R, et al. FDA drug approval summary: gefitinib (ZD1839) (Iressa) tablets. Oncologist. 2003;8(4):303-306. (Documents accelerated approval 5 May 2003.)',
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
        reason: 'Thatcher and colleagues published the ISEL (Iressa Survival Evaluation in Lung Cancer) trial — 1,692 refractory NSCLC patients randomized to gefitinib or placebo — reporting no statistically significant improvement in overall survival in either co-primary population, with benefit confined to subgroups such as never-smokers and patients of Asian origin. The negative confirmatory trial undercut the surrogate-based 2003 approval; on its topline results the FDA had already restricted the label in June 2005 to patients currently or previously benefiting, effectively closing access to new patients. (Gefitinib was later re-approved in 2015 for the narrower EGFR-mutation-positive population.)',
        source: {
          externalId: 'src:isel-thatcher-gefitinib-lancet-2005',
          name: 'Thatcher N, Chang A, Parikh P, et al. Gefitinib plus best supportive care in previously treated patients with refractory advanced non-small-cell lung cancer: results from a randomised, placebo-controlled, multicentre study (ISEL). Lancet. 2005;366(9496):1527-1537.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16257339/',
          publishedAt: '2005-10-29',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Bevacizumab / breast cancer accelerated approval — contested 2010 ───────
  {
    externalId: 'trajectory:bevacizumab-breast-cancer-accelerated-approval-contested-2010',
    text: 'The claim that adding bevacizumab (Avastin, Genentech) to paclitaxel benefits patients with HER2-negative metastatic breast cancer — granted FDA accelerated approval on 22 February 2008 on the basis of a progression-free-survival gain in the E2100 trial — was contested when confirmatory trials failed to show an overall-survival benefit, leading the FDA to issue a notice on 16 December 2010 proposing to withdraw the breast-cancer indication.',
    claimType: 'HYBRID',
    claimEmergedAt: '2008-02-22',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2008-02-22',
        datePrecision: 'DAY',
        reason: 'The FDA\'s Center for Drug Evaluation and Research granted accelerated approval for bevacizumab plus paclitaxel in HER2-negative metastatic breast cancer, based on the single E2100 trial\'s progression-free-survival advantage (about 5.5 months) despite no overall-survival benefit and a December 2007 ODAC vote against approval. The decision recorded on the regulatory record the contested claim that bevacizumab benefits metastatic breast cancer, conditioned on confirmatory trials.',
        source: {
          externalId: 'src:fda-bevacizumab-breast-decision-2008-approval',
          name: 'U.S. Food and Drug Administration. Proposal to Withdraw Approval of the Breast Cancer Indication for Avastin (bevacizumab) — Commissioner\'s decision (documents accelerated approval 22 February 2008 based on E2100).',
          url: 'https://www.fda.gov/media/79525/download',
          publishedAt: '2011-11-18',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '2010-12-16',
        datePrecision: 'DAY',
        reason: 'After Genentech\'s confirmatory trials (AVADO, RIBBON-1) showed only small progression-free-survival gains and no overall-survival benefit, and after a July 2010 ODAC vote recommending withdrawal, CDER determined the trials failed to verify clinical benefit and issued a notice of opportunity for a hearing proposing to withdraw the breast-cancer indication. The action placed the 2008 claim into formal regulatory dispute; the indication was ultimately revoked effective 18 November 2011, a landmark test of the accelerated-approval confirmatory-evidence framework.',
        source: {
          externalId: 'src:fda-bevacizumab-breast-withdrawal-fr-2012',
          name: 'U.S. Food and Drug Administration. Final Decision on Withdrawal of Breast Cancer Indication for AVASTIN (Bevacizumab) Following Public Hearing. Federal Register. 2012;77(38):11631 (27 Feb 2012); documents 16 December 2010 notice of opportunity for hearing.',
          url: 'https://www.federalregister.gov/documents/2012/02/27/2012-4424/final-decision-on-withdrawal-of-breast-cancer-indication-for-avastin-bevacizumab-following-public',
          publishedAt: '2012-02-27',
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
