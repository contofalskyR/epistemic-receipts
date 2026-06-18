// Seed: Nutritional Science epistemic trajectories
//
// Domain-specific settling curves: each trajectory is a dateable nutritional
// science claim with a verifiable epistemic arc — from initial expert
// literature finding through institutional adoption, dietary guideline
// adoption, or evidence reversal.
//
// Sources: PubMed, USDA, WHO Nutrition, JAMA, NEJM, BMJ, Lancet, Circulation,
// Senate records, FDA, Cochrane Reviews.
//
// Idempotent: upserts on externalId.
//
// Run:     npx tsx scripts/seed-nutrition-trajectories.ts
// Dry-run: npx tsx scripts/seed-nutrition-trajectories.ts --dry-run

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
  currentAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE'
  transitions: Transition[]
}

const TRAJECTORIES: Trajectory[] = [

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRE-MODERN NUTRITIONAL SCIENCE (before 1950)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 1. James Lind — scurvy controlled trial — 1747 ─────────────────────────
  {
    externalId: 'trajectory:lind-scurvy-citrus-trial-1747',
    text: 'James Lind conducted on May 20, 1747 the first controlled clinical trial in nutritional science, demonstrating that citrus fruit cured scurvy in sailors while five other dietary remedies failed, establishing that a dietary deficiency — later identified as vitamin C — causes scurvy.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1747-05-20',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1753-01-01',
        datePrecision: 'YEAR',
        reason: 'Lind publishes "A Treatise of the Scurvy" in 1753, describing his six-arm trial conducted May 20, 1747 aboard HMS Salisbury. Twelve scurvy patients were divided into pairs and given: cider, elixir vitriol, vinegar, seawater, a purgative mixture, or two oranges and a lemon. Only the citrus group recovered within a week. The treatise is the first published controlled trial in nutritional medicine, though uptake by the Royal Navy was delayed 50 years.',
        source: {
          externalId: 'src:lind-scurvy-treatise-1753',
          name: 'Lind J. A Treatise of the Scurvy. Edinburgh: Sands, Murray and Cochran. 1753.',
          url: 'https://www.jameslindlibrary.org/lind-j-1753/',
          publishedAt: '1753-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1795-01-01',
        datePrecision: 'YEAR',
        reason: 'The British Royal Navy mandates lemon juice rations for all sailors in 1795 — 48 years after Lind\'s trial — under Gilbert Blane\'s advocacy. Scurvy rates collapse. The institutional delay between controlled trial and policy adoption (five decades) became a canonical example of translational lag in medicine.',
        source: {
          externalId: 'src:royal-navy-lemon-1795',
          name: 'Blane G. Observations on the Diseases of Seamen. London: Murray. 1789 (policy enacted 1795).',
          url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1139482/',
          publishedAt: '1795-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1932-04-01',
        datePrecision: 'MONTH',
        reason: 'Albert Szent-Györgyi isolates crystalline vitamin C (ascorbic acid) from paprika in 1928–1930, and Glen King independently confirms it is the anti-scurvy factor in 1932. The Nobel Prize in Physiology or Medicine 1937 is awarded to Szent-Györgyi for the discovery. This completes the causal chain: Lind\'s empirical citrus finding is explained at the molecular level by vitamin C deficiency.',
        source: {
          externalId: 'src:king-vitamin-c-identification-1932',
          name: 'King CG, Waugh WA. The Chemical Nature of Vitamin C. Science. 1932;75(1944):357–358.',
          url: 'https://doi.org/10.1126/science.75.1944.357',
          publishedAt: '1932-04-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 2. Casimir Funk coins "vitamine" — 1912 ─────────────────────────────────
  {
    externalId: 'trajectory:funk-vitamine-coined-1912',
    text: 'Casimir Funk proposed in 1912 the "vitamine" hypothesis — that certain diseases (beriberi, scurvy, pellagra, rickets) are caused by deficiencies of specific organic substances present in small quantities in food, coining the term "vitamine" (vital amine) and founding the modern science of vitamins.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1912-07-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1912-07-01',
        datePrecision: 'MONTH',
        reason: 'Funk publishes "The Etiology of the Deficiency Diseases" in the Journal of State Medicine (July 1912), coining "vitamine" (later shortened to "vitamin" when it became clear not all were amines). He proposes that beriberi, scurvy, pellagra, and rickets are deficiency diseases caused by absence of essential organic compounds. He had previously isolated a rice-bran fraction (proto-B1) that cured beriberi in pigeons.',
        source: {
          externalId: 'src:funk-vitamine-1912',
          name: 'Funk C. The Etiology of the Deficiency Diseases. Journal of State Medicine. 1912;20:341–368.',
          url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2036688/',
          publishedAt: '1912-07-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1929-10-01',
        datePrecision: 'MONTH',
        reason: 'Frederick Gowland Hopkins and Christiaan Eijkman receive the Nobel Prize in Physiology or Medicine in 1929 for discovering vitamins and the vitamin deficiency disease beriberi, respectively. By 1929 vitamins A, B1, B2, C, D, and E have been identified or characterized. The vitamin deficiency framework is fully settled as the mechanistic explanation for Funk\'s 1912 hypothesis.',
        source: {
          externalId: 'src:nobel-vitamins-1929',
          name: 'Nobel Prize Committee. Nobel Prize in Physiology or Medicine 1929. NobelPrize.org.',
          url: 'https://www.nobelprize.org/prizes/medicine/1929/summary/',
          publishedAt: '1929-10-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // DIET-HEART HYPOTHESIS ERA (1950–1980)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 3. Ancel Keys — Seven Countries Study — 1970 ────────────────────────────
  {
    externalId: 'trajectory:ancel-keys-seven-countries-study-1970',
    text: 'Ancel Keys published the Seven Countries Study in January 1970 as a supplement to Circulation, concluding from 15-year follow-up of 12,770 men across seven countries that dietary saturated fat intake was the primary dietary determinant of coronary heart disease mortality, establishing the diet-heart hypothesis as the dominant paradigm in nutrition science.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1970-01-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1970-01-01',
        datePrecision: 'MONTH',
        reason: 'Keys and colleagues publish the Seven Countries Study monograph as Circulation Supplement I (January 1970), reporting 15-year follow-up of cohorts in Finland, Greece, Italy, Japan, Netherlands, USA, and Yugoslavia. Saturated fat intake showed the strongest correlation with coronary heart disease rates. The study was initiated in 1958 following Keys\'s influential 1953 ecological correlation of fat calories with CHD across six countries.',
        source: {
          externalId: 'src:keys-seven-countries-1970',
          name: 'Keys A et al. Coronary heart disease in seven countries. Circulation. 1970;41(suppl 1):I1–I211.',
          url: 'https://doi.org/10.1161/01.CIR.41.4S1.I-1',
          publishedAt: '1970-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1977-01-14',
        datePrecision: 'DAY',
        reason: 'The McGovern Report (Dietary Goals for the United States), issued January 14, 1977 by the Senate Select Committee on Nutrition and Human Needs, adopts the diet-heart hypothesis and recommends Americans reduce saturated fat to 10% of calories and dietary cholesterol to 300 mg/day. The report, heavily influenced by Keys\'s work, becomes the basis for subsequent USDA dietary guidelines. The diet-heart claim transitions from expert literature to binding institutional recommendation.',
        source: {
          externalId: 'src:mcgovern-dietary-goals-1977',
          name: 'U.S. Senate Select Committee on Nutrition and Human Needs. Dietary Goals for the United States. February 1977. (First edition released January 14, 1977.)',
          url: 'https://naldc.nal.usda.gov/catalog/1759572',
          publishedAt: '1977-01-14',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2010-03-23',
        datePrecision: 'DAY',
        reason: 'Siri-Tarino et al. publish a meta-analysis in the American Journal of Clinical Nutrition (March 23, 2010) of 21 prospective cohort studies (347,747 subjects, 5–23 year follow-up) finding no significant association between saturated fat intake and cardiovascular disease or stroke risk. Multiple subsequent meta-analyses and RCTs challenge the saturated fat-CHD causal link. The diet-heart hypothesis is now actively contested in the expert literature.',
        source: {
          externalId: 'src:siri-tarino-sat-fat-meta-2010',
          name: 'Siri-Tarino PW, Sun Q, Hu FB, Krauss RM. Meta-analysis of prospective cohort studies evaluating the association of saturated fat with cardiovascular disease. American Journal of Clinical Nutrition. 2010;91(3):535–546.',
          url: 'https://doi.org/10.3945/ajcn.2009.27725',
          publishedAt: '2010-03-23',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOW-FAT & DIETARY GUIDELINES ERA (1980–2005)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 4. USDA Food Pyramid published — 1992 ───────────────────────────────────
  {
    externalId: 'trajectory:usda-food-pyramid-1992',
    text: 'The USDA published the Food Guide Pyramid on April 28, 1992, recommending 6–11 daily servings of bread, cereal, rice, and pasta at its broad base and small amounts of fats and oils at the apex, institutionalizing the low-fat dietary paradigm for 230 million Americans for over a decade.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1992-04-28',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1992-04-28',
        datePrecision: 'DAY',
        reason: 'USDA releases the Food Guide Pyramid (Home and Garden Bulletin No. 252) on April 28, 1992, replacing the Basic Four food groups guide used since 1956. The pyramid places 6–11 servings of grains at the base, recommends low-fat dairy and lean meat in the middle, and places fats, oils, and sweets ("use sparingly") at the apex. The guide was delayed two years after initial development due to beef and dairy industry lobbying that found the original version too anti-fat.',
        source: {
          externalId: 'src:usda-food-pyramid-1992',
          name: 'U.S. Department of Agriculture. The Food Guide Pyramid. Home and Garden Bulletin Number 252. April 1992.',
          url: 'https://www.nal.usda.gov/legacy/fnic/food-guide-pyramid',
          publishedAt: '1992-04-28',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'PUBLIC',
        occurredAt: '1994-01-01',
        datePrecision: 'YEAR',
        reason: 'By 1994 the Food Guide Pyramid is integrated into USDA\'s nutrition education programs, the National School Lunch Program, and food labeling regulations under the Nutrition Labeling and Education Act (1990). The pyramid becomes the dominant public health nutrition framework in the U.S., distributed on cereal boxes and cafeteria posters. The low-grain-heavy, low-fat design shapes a generation of dietary advice.',
        source: {
          externalId: 'src:usda-nlea-implementation-1994',
          name: 'FDA. Nutrition Labeling and Education Act (NLEA) of 1990. Implementation 1994. 21 CFR Parts 100–199.',
          url: 'https://www.fda.gov/food/food-labeling-nutrition/nutrition-labeling-and-education-act-1990',
          publishedAt: '1994-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2011-06-02',
        datePrecision: 'DAY',
        reason: 'USDA retires the Food Guide Pyramid on June 2, 2011, replacing it with MyPlate — a simpler plate-based icon that eliminates the problematic grain-heavy base and reflects updated science on whole grains vs. refined grains, healthy fats, and reduced red meat. The pyramid is formally deprecated as flawed institutional guidance, reflecting two decades of criticism from nutritional scientists including Walter Willett of Harvard.',
        source: {
          externalId: 'src:usda-myplate-2011',
          name: 'U.S. Department of Agriculture. USDA Unveils MyPlate, the New American Icon for Healthy Eating. June 2, 2011.',
          url: 'https://www.choosemyplate.gov/',
          publishedAt: '2011-06-02',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 5. Women's Health Initiative — low-fat diet no benefit — 2006 ───────────
  {
    externalId: 'trajectory:whi-low-fat-no-benefit-2006',
    text: 'The Women\'s Health Initiative Dietary Modification Trial, published February 8, 2006 in JAMA, found that an 8-year low-fat dietary intervention (reducing fat to 20% of calories) did not significantly reduce the risk of coronary heart disease, stroke, or colorectal cancer in 48,835 postmenopausal women, directly contradicting the low-fat dietary hypothesis.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2006-02-08',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-02-08',
        datePrecision: 'DAY',
        reason: 'Howard BV et al. publish three simultaneous JAMA papers on February 8, 2006 reporting WHI Dietary Modification Trial results. After 8.1 years of follow-up in 48,835 postmenopausal women randomized to a low-fat intervention or control diet, there were no statistically significant differences in CHD events (HR 0.98, 95% CI 0.88–1.10), stroke, or colorectal cancer. This is the largest ever RCT of dietary fat reduction and found no cardiovascular benefit.',
        source: {
          externalId: 'src:whi-dietary-jama-2006',
          name: 'Howard BV et al. Low-fat dietary pattern and risk of cardiovascular disease: the Women\'s Health Initiative Randomized Controlled Dietary Modification Trial. JAMA. 2006;295(6):655–666.',
          url: 'https://doi.org/10.1001/jama.295.6.655',
          publishedAt: '2006-02-08',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2015-01-07',
        datePrecision: 'DAY',
        reason: 'The 2015 USDA Dietary Guidelines Advisory Committee Report (January 7, 2015) drops the dietary cholesterol limit of 300 mg/day, stating "cholesterol is not a nutrient of concern for overconsumption." The 2015 guidelines also no longer define an upper limit for total dietary fat. These changes formalize what the WHI and multiple subsequent meta-analyses showed: dietary fat restriction per se is not the key modifiable CHD risk factor.',
        source: {
          externalId: 'src:dgac-2015-cholesterol-dropped',
          name: 'USDA/HHS Dietary Guidelines Advisory Committee. Scientific Report of the 2015 Dietary Guidelines Advisory Committee. January 7, 2015.',
          url: 'https://health.gov/our-work/nutrition-physical-activity/dietary-guidelines/previous-dietary-guidelines/2015',
          publishedAt: '2015-01-07',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 6. PREDIMED Mediterranean diet trial — retracted and corrected — 2018 ───
  {
    externalId: 'trajectory:predimed-mediterranean-retraction-2018',
    text: 'The PREDIMED trial, originally published in the NEJM in 2013, was retracted and republished with corrected data on June 13, 2018 after errors in randomization and data collection were identified, providing a case study in post-publication peer review and the resilience (or fragility) of landmark nutrition RCT findings.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2018-06-13',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2013-04-04',
        datePrecision: 'DAY',
        reason: 'Estruch R et al. publish "Primary Prevention of Cardiovascular Disease with a Mediterranean Diet" in the NEJM on April 4, 2013. The trial randomized 7,447 high-cardiovascular-risk Spanish adults to Mediterranean diet supplemented with olive oil, Mediterranean diet supplemented with mixed nuts, or a control low-fat diet. It reports a 30% relative risk reduction in major cardiovascular events in the Mediterranean arms. The paper becomes the most influential nutrition RCT of the decade.',
        source: {
          externalId: 'src:predimed-original-nejm-2013',
          name: 'Estruch R et al. Primary Prevention of Cardiovascular Disease with a Mediterranean Diet. NEJM. 2013;368:1279–1290.',
          url: 'https://doi.org/10.1056/NEJMoa1200303',
          publishedAt: '2013-04-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-06-13',
        datePrecision: 'DAY',
        reason: 'NEJM retracts and republishes PREDIMED on June 13, 2018 with a corrected analysis after investigators found protocol deviations: in some sites, entire households (not individuals) were randomized, violating the pre-specified design; and at one site a single dietitian enrolled patients without proper randomization. The corrected analysis still shows significant cardiovascular benefit (HR 0.69, 95% CI 0.55–0.86), but the trial\'s credibility is contested due to the randomization failures.',
        source: {
          externalId: 'src:predimed-retraction-nejm-2018',
          name: 'Estruch R et al. Primary Prevention of Cardiovascular Disease with a Mediterranean Diet Supplemented with Extra-Virgin Olive Oil or Nuts [RETRACTION AND REPUBLICATION]. NEJM. 2018;378:e34.',
          url: 'https://doi.org/10.1056/NEJMoa1800389',
          publishedAt: '2018-06-13',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2022-01-01',
        datePrecision: 'YEAR',
        reason: 'Subsequent analyses and the independent PREDIMED-Plus trial (2020+) largely confirm the Mediterranean diet\'s cardiovascular benefits. A 2019 meta-analysis in JAHA and the European Society of Cardiology 2021 guidelines cite PREDIMED (corrected) as the highest-quality evidence for Mediterranean dietary patterns in cardiovascular prevention. The retraction episode becomes a case study in nutrition research methodology — the main finding survived re-analysis despite the procedural failures.',
        source: {
          externalId: 'src:esc-guidelines-mediterranean-2021',
          name: 'Visseren FLJ et al. 2021 ESC Guidelines on cardiovascular disease prevention in clinical practice. European Heart Journal. 2021;42(34):3227–3337.',
          url: 'https://doi.org/10.1093/eurheartj/ehab484',
          publishedAt: '2022-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // EVIDENCE REVERSAL ERA (2005–present)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 7. WHO processed meat as Group 1 carcinogen — 2015 ──────────────────────
  {
    externalId: 'trajectory:who-processed-meat-carcinogen-2015',
    text: 'The World Health Organization\'s International Agency for Research on Cancer classified processed meat as Group 1 (carcinogenic to humans) and red meat as Group 2A (probably carcinogenic) on October 26, 2015, based on sufficient evidence that processed meat consumption causes colorectal cancer.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2015-10-26',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2015-10-26',
        datePrecision: 'DAY',
        reason: 'IARC Working Group of 22 experts from 10 countries publishes its Monographs evaluation in The Lancet Oncology on October 26, 2015 (online), classifying processed meat (bacon, sausage, hot dogs, ham, salami) as Group 1 carcinogen and red meat (unprocessed beef, veal, pork, lamb) as Group 2A. The evaluation is based on 800 epidemiological studies. Each 50g/day of processed meat increases colorectal cancer risk by approximately 18%. The IARC press release generates worldwide media coverage.',
        source: {
          externalId: 'src:iarc-processed-meat-2015',
          name: 'Bouvard V et al. (IARC Working Group). Carcinogenicity of consumption of red and processed meat. Lancet Oncology. 2015;16(16):1599–1600.',
          url: 'https://doi.org/10.1016/S1470-2045(15)00444-1',
          publishedAt: '2015-10-26',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2018-01-01',
        datePrecision: 'YEAR',
        reason: 'The IARC classification is incorporated into WHO\'s global cancer prevention guidelines by 2018 and cited by the American Cancer Society, Cancer Research UK, and national dietary guidelines of multiple countries. The WHO\'s IARC Monographs (Volume 114) formally include processed meat in the Group 1 list alongside tobacco and asbestos — though IARC notes the absolute risk is much lower than tobacco. The classification is institutionally settled despite ongoing public controversy.',
        source: {
          externalId: 'src:iarc-monograph-114-2018',
          name: 'IARC. Red Meat and Processed Meat. IARC Monographs on the Evaluation of Carcinogenic Risks to Humans. Volume 114. IARC Press, Lyon. 2018.',
          url: 'https://publications.iarc.fr/Book-And-Report-Series/Iarc-Monographs-On-The-Identification-Of-Carcinogenic-Hazards-To-Humans/Red-Meat-And-Processed-Meat-2018',
          publishedAt: '2018-01-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 8. NOVA ultra-processed food classification — 2010 ──────────────────────
  {
    externalId: 'trajectory:nova-ultra-processed-food-2010',
    text: 'Carlos Monteiro and colleagues at the University of São Paulo proposed the NOVA food classification system in 2010, introducing "ultra-processed foods" (UPF) as a distinct category based on industrial processing degree rather than nutrient composition, establishing a new paradigm for nutritional epidemiology that has linked UPF intake to obesity, cancer, cardiovascular disease, and mortality.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2010-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2010-01-01',
        datePrecision: 'YEAR',
        reason: 'Monteiro CA publishes "Nutrition and health. The issue is not food, nor nutrients, so much as processing" in Public Health Nutrition (2009) and the NOVA classification is first systematically described in World Nutrition (2010). NOVA defines four groups: unprocessed/minimally processed foods, processed culinary ingredients, processed foods, and ultra-processed foods (industrially formulated, with additives for palatability and shelf life). The framework shifts nutritional epidemiology from nutrients to food matrices.',
        source: {
          externalId: 'src:monteiro-nova-world-nutrition-2010',
          name: 'Monteiro CA et al. A new classification of foods based on the extent and purpose of their processing. Cadernos de Saúde Pública. 2010;26(11):2039–2049.',
          url: 'https://doi.org/10.1590/S0102-311X2010001100005',
          publishedAt: '2010-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2019-05-29',
        datePrecision: 'DAY',
        reason: 'Hall KD et al. publish the first RCT of UPF vs. whole-food diets in Cell Metabolism (May 29, 2019). In a crossover trial of 20 adults, the ultra-processed diet led to significantly higher calorie intake (+508 kcal/day) and weight gain (+0.9 kg) versus the unprocessed diet, despite matched macronutrients. This is the first controlled experimental evidence supporting Monteiro\'s observational UPF-obesity link.',
        source: {
          externalId: 'src:hall-upf-rct-cell-metabolism-2019',
          name: 'Hall KD et al. Ultra-Processed Diets Cause Excess Calorie Intake and Weight Gain: An Inpatient Randomized Controlled Trial of Ad Libitum Food Intake. Cell Metabolism. 2019;30(1):67–77.',
          url: 'https://doi.org/10.1016/j.cmet.2019.05.008',
          publishedAt: '2019-05-29',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2024-01-01',
        datePrecision: 'YEAR',
        reason: 'Multiple researchers challenge the NOVA UPF framework as too broad (grouping yogurt, whole-grain bread, and fruit juices with junk food) and conflating processing with additive burden. van Tulleken\'s 2023 popular book drives public discourse; but scientific challenges from Drs. Kevin Hall, David Katz, and others argue the mechanism is unclear and NOVA\'s causal claims are still observational. The claim is settled in expert literature as associated with harm but remains contested on mechanism, directionality, and classification validity.',
        source: {
          externalId: 'src:monteiro-nova-critique-2023',
          name: 'Scrinis G, Monteiro CA. Ultra-processed foods and the limits of product reformulation. Public Health Nutrition. 2018;21(1):247–252. (See also multiple 2023–2024 critical commentaries in AJCN and BMJ.)',
          url: 'https://doi.org/10.1017/S1368980017001392',
          publishedAt: '2024-01-01',
          methodologyType: 'opinion',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUGAR SCIENCE ERA (1964–2016)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 9. Sugar industry–funded 1967 NEJM review — reversed 2016 ──────────────
  {
    externalId: 'trajectory:sugar-industry-funded-1967-nejm-review-1967',
    text: 'The 1967 New England Journal of Medicine review by Harvard nutritionists Robert McGandy, D. Mark Hegsted, and Fredrick Stare concluded on July 27, 1967 that dietary fat and cholesterol — not sugar — were the primary dietary causes of coronary heart disease, a review later revealed in 2016 to have been secretly funded and editorially steered by the Sugar Research Foundation.',
    claimType: 'HYBRID',
    claimEmergedAt: '1967-07-27',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1967-07-27',
        datePrecision: 'DAY',
        reason: 'McGandy RB, Hegsted DM, and Stare FJ publish a two-part literature review, \'Dietary Fats, Carbohydrates and Atherosclerotic Vascular Disease,\' in the NEJM (July 27 and August 3, 1967), concluding that the practical significance of dietary carbohydrate (sugar) was minimal compared with dietary fat and cholesterol in atherosclerosis. The review minimized epidemiological and animal evidence implicating sucrose and directed attention to fat as the dietary culprit. It became an authoritative reference shaping subsequent diet-heart consensus.',
        source: {
          externalId: 'src:mcgandy-hegsted-stare-nejm-1967',
          name: 'McGandy RB, Hegsted DM, Stare FJ. Dietary Fats, Carbohydrates and Atherosclerotic Vascular Disease. New England Journal of Medicine. 1967;277(4):186–192.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/5339699/',
          publishedAt: '1967-07-27',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1977-01-14',
        datePrecision: 'DAY',
        reason: 'D. Mark Hegsted, co-author of the 1967 review, served as a principal scientific drafter of the Senate Select Committee\'s Dietary Goals for the United States (the McGovern Report), released January 14, 1977. The report embedded the fat-and-cholesterol focus while treating sugar as a comparatively minor concern, institutionalizing the 1967 review\'s framing into federal dietary policy. The fat-centric, sugar-minimizing paradigm became settled consensus guiding U.S. guidelines for decades.',
        source: {
          externalId: 'src:mcgovern-dietary-goals-1977',
          name: 'U.S. Senate Select Committee on Nutrition and Human Needs. Dietary Goals for the United States. 1977. (First edition released January 14, 1977.)',
          url: 'https://naldc.nal.usda.gov/catalog/1759572',
          publishedAt: '1977-01-14',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2016-09-12',
        datePrecision: 'DAY',
        reason: 'Kearns, Schmidt, and Glantz publish \'Sugar Industry and Coronary Heart Disease Research: A Historical Analysis of Internal Industry Documents\' in JAMA Internal Medicine (online September 12, 2016), showing the Sugar Research Foundation paid Harvard researchers (Project 226), set the review\'s objectives, supplied articles, and reviewed drafts of the 1967 NEJM review — without disclosing its funding or role. The exposé discredits the review\'s conclusions as industry-shaped, reversing its standing as objective science.',
        source: {
          externalId: 'src:kearns-sugar-industry-jama-2016',
          name: 'Kearns CE, Schmidt LA, Glantz SA. Sugar Industry and Coronary Heart Disease Research: A Historical Analysis of Internal Industry Documents. JAMA Internal Medicine. 2016;176(11):1680–1685.',
          url: 'https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2548255',
          publishedAt: '2016-09-12',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 10. Yudkin sugar–heart disease hypothesis — 1964 ────────────────────────
  {
    externalId: 'trajectory:yudkin-sugar-heart-disease-hypothesis-1964',
    text: 'John Yudkin argued in July 1964 in The Lancet that dietary sucrose, rather than fat, was the principal dietary determinant of coronary heart disease and diabetes — a hypothesis marginalized for decades and later revived.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1964-07-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1964-07-01',
        datePrecision: 'MONTH',
        reason: 'Yudkin publishes \'Dietary Fat and Dietary Sugar in Relation to Ischaemic Heart-Disease and Diabetes\' in The Lancet (1964), reporting stronger correlations of sugar than fat intake with coronary mortality and proposing sucrose as the key dietary cause of heart disease and diabetes. The paper, building on his 1957 ecological correlations, frames the sugar hypothesis as a direct rival to Keys\'s diet-heart (saturated fat) paradigm.',
        source: {
          externalId: 'src:yudkin-lancet-sugar-1964',
          name: 'Yudkin J, Roddy J. Dietary Fat and Dietary Sugar in Relation to Ischaemic Heart-Disease and Diabetes. The Lancet. 1964;2(7349):4–5.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/14149218/',
          publishedAt: '1964-07-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'ABANDONED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1980-01-01',
        datePrecision: 'YEAR',
        reason: 'Through the 1970s the saturated-fat diet-heart paradigm (championed by Ancel Keys and institutionalized in the 1977 Dietary Goals) became dominant, while Yudkin\'s sugar hypothesis was publicly dismissed as alarmist; his 1972 book \'Pure, White and Deadly\' was attacked and his work sidelined. Later analysis showed the Sugar Research Foundation had actively helped downplay sugar\'s risks, contributing to the marginalization. By the early 1980s the sugar-CHD hypothesis was effectively abandoned by the mainstream nutrition establishment.',
        source: {
          externalId: 'src:yudkin-hypothesis-review-frontiers-2024',
          name: 'Review: John Yudkin\'s hypothesis — sugar is a major dietary culprit in the development of cardiovascular disease. Frontiers in Nutrition. 2024;11:1407108.',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11257042/',
          publishedAt: '2024-07-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'ABANDONED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2016-09-12',
        datePrecision: 'DAY',
        reason: 'The 2016 Kearns/Glantz exposé of sugar-industry funding behind the 1967 NEJM review, together with accumulating metabolic evidence advanced by researchers such as Robert Lustig, reframed Yudkin\'s earlier dismissal as partly engineered and reopened serious scientific debate over sugar\'s causal role in cardiovascular and metabolic disease. The hypothesis returned to active contestation in the expert literature rather than settled rejection.',
        source: {
          externalId: 'src:kearns-sugar-industry-jama-2016',
          name: 'Kearns CE, Schmidt LA, Glantz SA. Sugar Industry and Coronary Heart Disease Research: A Historical Analysis of Internal Industry Documents. JAMA Internal Medicine. 2016;176(11):1680–1685.',
          url: 'https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2548255',
          publishedAt: '2016-09-12',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 11. HFCS–obesity hypothesis — 2004 ──────────────────────────────────────
  {
    externalId: 'trajectory:hfcs-obesity-hypothesis-2004',
    text: 'Bray, Nielsen, and Popkin proposed in April 2004 in the American Journal of Clinical Nutrition that the sharp rise in high-fructose corn syrup consumption in beverages played a causal role in the U.S. obesity epidemic.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2004-04-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2004-04-01',
        datePrecision: 'MONTH',
        reason: 'Bray GA, Nielsen SJ, and Popkin BM publish \'Consumption of high-fructose corn syrup in beverages may play a role in the epidemic of obesity\' in AJCN (2004;79(4):537–543), noting that the temporal rise in HFCS use since the 1970s paralleled rising obesity and hypothesizing that fructose\'s distinct metabolism (failure to stimulate insulin/leptin) promoted excess energy intake. The paper launched a sustained scientific and public debate singling out HFCS as uniquely obesogenic.',
        source: {
          externalId: 'src:bray-hfcs-obesity-ajcn-2004',
          name: 'Bray GA, Nielsen SJ, Popkin BM. Consumption of high-fructose corn syrup in beverages may play a role in the epidemic of obesity. American Journal of Clinical Nutrition. 2004;79(4):537–543.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15051594/',
          publishedAt: '2004-04-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2012-02-21',
        datePrecision: 'DAY',
        reason: 'Sievenpiper et al. publish a systematic review and meta-analysis of controlled feeding trials in Annals of Internal Medicine (February 21, 2012) finding that fructose does not cause weight gain when isocalorically substituted for other carbohydrates, supporting the view that HFCS is metabolically equivalent to sucrose and not uniquely obesogenic. This and the American Medical Association\'s 2008 assessment placed the HFCS-specific obesity claim into active contestation over mechanism and causality.',
        source: {
          externalId: 'src:sievenpiper-fructose-meta-annals-2012',
          name: 'Sievenpiper JL et al. Effect of fructose on body weight in controlled feeding trials: a systematic review and meta-analysis. Annals of Internal Medicine. 2012;156(4):291–304.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/22351714/',
          publishedAt: '2012-02-21',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 12. WHO free sugars guideline — 2015 ────────────────────────────────────
  {
    externalId: 'trajectory:who-free-sugars-guideline-2015',
    text: 'The World Health Organization issued a guideline on March 4, 2015 strongly recommending that adults and children reduce free sugars intake to less than 10% of total energy, with a conditional recommendation to reduce intake below 5%.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2015-03-04',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2015-03-04',
        datePrecision: 'DAY',
        reason: 'WHO publishes \'Guideline: Sugars intake for adults and children\' (March 4, 2015), issuing a strong recommendation to limit free sugars to under 10% of total energy intake and a conditional recommendation for a further reduction to below 5%, based on systematic reviews linking free sugars to body weight and dental caries. This established a quantitative global public-health target specifically for sugar for the first time at WHO level.',
        source: {
          externalId: 'src:who-sugars-guideline-2015',
          name: 'World Health Organization. Guideline: Sugars intake for adults and children. Geneva: WHO. 4 March 2015.',
          url: 'https://www.who.int/publications/i/item/9789241549028',
          publishedAt: '2015-03-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2016-01-07',
        datePrecision: 'DAY',
        reason: 'The 2015–2020 Dietary Guidelines for Americans (released January 7, 2016) for the first time set a quantitative cap on added sugars — less than 10% of daily calories — aligning U.S. federal policy with the WHO free-sugars recommendation. The convergence of WHO and national guidelines established the under-10% sugar limit as settled institutional nutrition policy across major bodies.',
        source: {
          externalId: 'src:dga-2015-2020-added-sugars',
          name: 'U.S. Department of Health and Human Services and USDA. 2015–2020 Dietary Guidelines for Americans, 8th Edition. January 2016.',
          url: 'https://health.gov/our-work/nutrition-physical-activity/dietary-guidelines/previous-dietary-guidelines/2015',
          publishedAt: '2016-01-07',
          methodologyType: 'primary',
        },
      },
    ],
  },

]

// ── Seeder (identical to medicine script) ───────────────────────────────────

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
      ingestedBy: 'seed:nutrition-trajectories',
      deleted: false,
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
  console.log(`Seeding ${TRAJECTORIES.length} nutrition trajectories${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  if (!DRY_RUN) {
    for (const t of TRAJECTORIES) {
      await upsertTrajectory(t)
    }
  } else {
    for (const t of TRAJECTORIES) {
      console.log(`  [dry] ${t.externalId} — ${t.transitions.length} transitions`)
    }
  }

  console.log(`\nDone. ${TRAJECTORIES.length} nutrition trajectories seeded.`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
