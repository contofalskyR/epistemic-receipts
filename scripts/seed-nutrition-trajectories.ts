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

  // ═══════════════════════════════════════════════════════════════════════════════
  // VITAMIN SUPPLEMENT ERA (1970–2013)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 12. Beta-carotene supplements — lung cancer reversal — 1981 ─────────────
  {
    externalId: 'trajectory:beta-carotene-supplements-lung-cancer-reversal-1981',
    text: 'The hypothesis that beta-carotene supplementation reduces human cancer risk, proposed by Richard Peto and colleagues in Nature on March 19, 1981, was reversed when the ATBC (1994) and CARET (1996) randomized trials found that beta-carotene supplements significantly increased lung cancer incidence and mortality in smokers.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1981-03-19',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1981-03-19',
        datePrecision: 'DAY',
        reason: 'Peto, Doll, Buckley, and Sporn publish \'Can dietary beta-carotene materially reduce human cancer rates?\' in Nature (March 19, 1981), noting that cancer rates were inversely correlated with dietary beta-carotene intake and proposing that beta-carotene might be a protective anti-cancer agent worth testing in controlled trials. The paper launched the antioxidant cancer-prevention paradigm and motivated large-scale supplementation trials in high-risk populations.',
        source: {
          externalId: 'src:peto-beta-carotene-nature-1981',
          name: 'Peto R, Doll R, Buckley JD, Sporn MB. Can dietary beta-carotene materially reduce human cancer rates? Nature. 1981;290(5803):201–208.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/7010181/',
          publishedAt: '1981-03-19',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1994-04-14',
        datePrecision: 'DAY',
        reason: 'The Alpha-Tocopherol, Beta Carotene (ATBC) Cancer Prevention Study Group publishes its results in the NEJM (April 14, 1994). In 29,133 Finnish male smokers randomized to beta-carotene, vitamin E, both, or placebo, the beta-carotene arm showed an 18% higher incidence of lung cancer and higher total mortality — the opposite of the predicted protective effect. The unexpected harm directly contradicted the Peto hypothesis and threw the antioxidant-prevention paradigm into contestation.',
        source: {
          externalId: 'src:atbc-beta-carotene-nejm-1994',
          name: 'The Alpha-Tocopherol, Beta Carotene Cancer Prevention Study Group. The effect of vitamin E and beta carotene on the incidence of lung cancer and other cancers in male smokers. New England Journal of Medicine. 1994;330(15):1029–1035.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8127329/',
          publishedAt: '1994-04-14',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1996-05-02',
        datePrecision: 'DAY',
        reason: 'Omenn et al. publish the Beta-Carotene and Retinol Efficacy Trial (CARET) in the NEJM (May 2, 1996). Among 18,314 smokers, former smokers, and asbestos-exposed workers given beta-carotene plus retinol, the active group had a 28% higher lung cancer incidence (RR 1.28) and 46% higher lung cancer mortality, prompting early termination of the trial. CARET independently confirmed ATBC\'s harm signal, reversing the beta-carotene cancer-prevention hypothesis and establishing that beta-carotene supplements harm high-risk smokers.',
        source: {
          externalId: 'src:caret-beta-carotene-nejm-1996',
          name: 'Omenn GS, Goodman GE, Thornquist MD, et al. Effects of a combination of beta carotene and vitamin A on lung cancer and cardiovascular disease. New England Journal of Medicine. 1996;334(18):1150–1155.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8602180/',
          publishedAt: '1996-05-02',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 13. Vitamin E supplements — cardiovascular mortality reversal — 1993 ─────
  {
    externalId: 'trajectory:vitamin-e-supplements-cardiovascular-mortality-reversal-1993',
    text: 'The belief that vitamin E supplementation reduces coronary heart disease risk — based on large observational cohorts such as Stampfer et al. (NEJM, May 20, 1993) — was reversed when a 2005 meta-analysis found that high-dose vitamin E increased all-cause mortality and the HOPE-TOO randomized trial (2005) found no cardiovascular benefit and increased heart failure.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1993-05-20',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1993-05-20',
        datePrecision: 'DAY',
        reason: 'Stampfer et al. publish \'Vitamin E consumption and the risk of coronary disease in women\' in the NEJM (May 20, 1993), reporting from the Nurses\' Health Study that women in the highest fifth of vitamin E intake had a relative risk of major coronary disease of 0.66, with the benefit strongest among long-term supplement users (RR 0.59). Together with a parallel male cohort, this observational evidence drove widespread adoption of vitamin E supplements for cardioprotection and shaped a decade of antioxidant enthusiasm.',
        source: {
          externalId: 'src:stampfer-vitamin-e-nejm-1993',
          name: 'Stampfer MJ, Hennekens CH, Manson JE, Colditz GA, Rosner B, Willett WC. Vitamin E consumption and the risk of coronary disease in women. New England Journal of Medicine. 1993;328(20):1444–1449.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8479463/',
          publishedAt: '1993-05-20',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2005-01-04',
        datePrecision: 'DAY',
        reason: 'Miller et al. publish \'Meta-analysis: high-dosage vitamin E supplementation may increase all-cause mortality\' in the Annals of Internal Medicine (January 4, 2005). Pooling 19 randomized trials with 135,967 participants, they found a dose-dependent increase in mortality above 150 IU/day, concluding that high-dose (≥400 IU/d) vitamin E should be avoided. The finding directly contradicted the observational benefit, placing the cardioprotection claim into active contestation.',
        source: {
          externalId: 'src:miller-vitamin-e-meta-annals-2005',
          name: 'Miller ER 3rd, Pastor-Barriuso R, Dalal D, Riemersma RA, Appel LJ, Guallar E. Meta-analysis: high-dosage vitamin E supplementation may increase all-cause mortality. Annals of Internal Medicine. 2005;142(1):37–46.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15537682/',
          publishedAt: '2005-01-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2005-03-16',
        datePrecision: 'DAY',
        reason: 'Lonn et al. publish the HOPE/HOPE-TOO randomized controlled trial in JAMA (March 16, 2005). In over 9,500 patients with vascular disease or diabetes followed a median of 7 years, long-term vitamin E supplementation prevented neither cancer nor major cardiovascular events and significantly increased the risk of heart failure (RR 1.13). The largest long-term RCT to date confirmed the absence of benefit and the signal of harm, reversing the vitamin E cardioprotection hypothesis.',
        source: {
          externalId: 'src:lonn-hope-too-vitamin-e-jama-2005',
          name: 'Lonn E, Bosch J, Yusuf S, et al. (HOPE and HOPE-TOO Trial Investigators). Effects of long-term vitamin E supplementation on cardiovascular events and cancer: a randomized controlled trial. JAMA. 2005;293(11):1338–1347.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/15769967/',
          publishedAt: '2005-03-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 14. Folic acid — neural tube defect prevention — 1991 ───────────────────
  {
    externalId: 'trajectory:folic-acid-neural-tube-defect-prevention-1991',
    text: 'The claim that periconceptional folic acid supplementation prevents neural tube defects, established by the MRC Vitamin Study (Lancet, July 20, 1991), settled into US public health policy through the 1992 Public Health Service recommendation and the FDA\'s 1996 mandate to fortify enriched grain products.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1991-07-20',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1991-07-20',
        datePrecision: 'DAY',
        reason: 'The MRC Vitamin Study Research Group publishes \'Prevention of neural tube defects: results of the Medical Research Council Vitamin Study\' in The Lancet (July 20, 1991). The randomized, double-blind, multi-country trial of 1,817 high-risk women showed that folic acid supplementation produced a 72% protective effect against NTD recurrence (RR 0.28), while other vitamins gave no benefit. This was the first definitive randomized evidence that folic acid specifically prevents neural tube defects.',
        source: {
          externalId: 'src:mrc-vitamin-study-lancet-1991',
          name: 'MRC Vitamin Study Research Group. Prevention of neural tube defects: results of the Medical Research Council Vitamin Study. The Lancet. 1991;338(8760):131–137.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/1677062/',
          publishedAt: '1991-07-20',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1992-09-11',
        datePrecision: 'DAY',
        reason: 'The U.S. Public Health Service issues its recommendation (MMWR 1992;41(RR-14), September 11, 1992) that all women of childbearing age capable of becoming pregnant consume 0.4 mg (400 µg) of folic acid daily to reduce the risk of NTD-affected pregnancies. The recommendation translated the MRC trial finding into binding national public-health guidance, marking institutional settlement of the folic-acid–NTD claim.',
        source: {
          externalId: 'src:phs-folic-acid-mmwr-1992',
          name: 'Centers for Disease Control and Prevention. Recommendations for the Use of Folic Acid to Reduce the Number of Cases of Spina Bifida and Other Neural Tube Defects. MMWR Recommendations and Reports. 1992;41(RR-14):1–7.',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/00019479.htm',
          publishedAt: '1992-09-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1996-03-05',
        datePrecision: 'DAY',
        reason: 'The FDA issues its final rule, \'Food Standards: Amendment of Standards of Identity for Enriched Grain Products to Require Addition of Folic Acid\' (61 FR 8781, March 5, 1996), mandating folic acid fortification of enriched bread, flour, cornmeal, rice, and pasta at 140 µg per 100 g, with compliance required by January 1, 1998. The mandate moved the claim from voluntary recommendation to enforceable nationwide fortification, reinforcing its settled status; NTD rates subsequently fell measurably across the US population.',
        source: {
          externalId: 'src:fda-folic-acid-fortification-rule-1996',
          name: 'U.S. Food and Drug Administration. Food Standards: Amendment of Standards of Identity for Enriched Grain Products to Require Addition of Folic Acid. Final Rule. 61 FR 8781. March 5, 1996.',
          url: 'https://www.govinfo.gov/content/pkg/FR-1996-03-05/html/96-5014.htm',
          publishedAt: '1996-03-05',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 15. Pauling vitamin C — common cold reversal — 1970 ─────────────────────
  {
    externalId: 'trajectory:pauling-vitamin-c-common-cold-1970',
    text: 'Linus Pauling\'s claim, advanced in 1970, that gram-scale doses of vitamin C prevent and reduce the common cold was contested by controlled trials in the mid-1970s and ultimately reversed for the prevention claim by the 2013 Cochrane systematic review, which found routine supplementation does not reduce cold incidence in the general population.',
    claimType: 'HYBRID',
    claimEmergedAt: '1970-12-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1970-12-01',
        datePrecision: 'MONTH',
        reason: 'Two-time Nobel laureate Linus Pauling publishes \'Evolution and the need for ascorbic acid\' in PNAS (December 1970), arguing that humans require far more vitamin C than dietary guidelines assume (roughly 2.3 g/day), and in the same year his popular book \'Vitamin C and the Common Cold\' claims that gram-scale daily doses prevent and ameliorate colds. Pauling\'s stature drove enormous public uptake of vitamin C megadosing and made the cold-prevention claim a widely held belief.',
        source: {
          externalId: 'src:pauling-ascorbic-acid-pnas-1970',
          name: 'Pauling L. Evolution and the need for ascorbic acid. Proceedings of the National Academy of Sciences USA. 1970;67(4):1643–1648.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/5275366/',
          publishedAt: '1970-12-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1975-03-10',
        datePrecision: 'DAY',
        reason: 'Dykes and Meier publish \'Ascorbic acid and the common cold: evaluation of its efficacy and toxicity\' in JAMA (March 10, 1975), reviewing the controlled-trial evidence and concluding that \'no clear, reproducible pattern of efficacy has emerged,\' and cautioning against unrestricted megadose use. This and contemporaneous NIH-era double-blind trials placed Pauling\'s prevention claim into active contestation, against the prevailing public enthusiasm.',
        source: {
          externalId: 'src:dykes-meier-vitamin-c-jama-1975',
          name: 'Dykes MHM, Meier P. Ascorbic acid and the common cold: evaluation of its efficacy and toxicity. JAMA. 1975;231(10):1073–1079.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/1089817/',
          publishedAt: '1975-03-10',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2013-01-31',
        datePrecision: 'DAY',
        reason: 'Hemilä and Chalker publish the updated Cochrane systematic review \'Vitamin C for preventing and treating the common cold\' (January 31, 2013), pooling decades of randomized trials and concluding that \'the failure of vitamin C supplementation to reduce the incidence of colds in the general population indicates that routine vitamin C supplementation is not justified.\' This definitively reversed Pauling\'s central prevention claim, though the review noted modest reductions in cold duration and a benefit under extreme physical stress.',
        source: {
          externalId: 'src:hemila-cochrane-vitamin-c-cold-2013',
          name: 'Hemilä H, Chalker E. Vitamin C for preventing and treating the common cold. Cochrane Database of Systematic Reviews. 2013;(1):CD000980.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/23440782/',
          publishedAt: '2013-01-31',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PRE-MODERN NUTRITIONAL SCIENCE (continued)
  // ─────────────────────────────────────────────────────────────────────────────

  // ── 16. Goldberger — pellagra dietary deficiency — 1914 ─────────────────────
  {
    externalId: 'trajectory:goldberger-pellagra-dietary-deficiency-1914',
    text: 'Joseph Goldberger established in 1914 that pellagra is a dietary deficiency disease rather than an infection, a finding confirmed by his human dietary-induction experiments and settled at the molecular level in 1937 when nicotinic acid (niacin) was identified as the pellagra-preventive factor.',
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
        reason: 'Joseph Goldberger publishes \'The etiology of pellagra: the significance of certain epidemiological observations with respect thereto\' in Public Health Reports (June 26, 1914). Observing that pellagra struck inmates and orphans but spared institutional staff who ate better, he argued the disease was caused by a deficient diet rather than an infectious agent — directly challenging the prevailing germ-theory consensus that pellagra was communicable.',
        source: {
          externalId: 'src:goldberger-etiology-pellagra-phr-1914',
          name: 'Goldberger J. The etiology of pellagra: the significance of certain epidemiological observations with respect thereto. Public Health Reports. 1914;29(26):1683–1686.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/808825/',
          publishedAt: '1914-06-26',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1920-01-01',
        datePrecision: 'YEAR',
        reason: 'Goldberger and Wheeler experimentally induce pellagra in eleven healthy volunteer convicts at Mississippi\'s Rankin State Prison Farm by restricting them to a corn-based diet deficient in meat, milk, and vegetables (experiment 1915; published in the Hygienic Laboratory Bulletin No. 120, 1920). Producing the disease at will by diet alone — having earlier failed to transmit it as an infection — causally confirmed the deficiency etiology and settled the dietary-cause claim in the expert literature.',
        source: {
          externalId: 'src:goldberger-wheeler-rankin-experiment-1920',
          name: 'Goldberger J, Wheeler GA. Experimental production of pellagra in human subjects by means of diet. Hygienic Laboratory Bulletin No. 120. 1920. (Reviewed in James Lind Library.)',
          url: 'https://www.jameslindlibrary.org/articles/joseph-goldbergers-research-on-the-prevention-of-pellagra/',
          publishedAt: '1920-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1937-01-01',
        datePrecision: 'YEAR',
        reason: 'Conrad Elvehjem and colleagues at the University of Wisconsin demonstrate in 1937 that nicotinic acid (niacin) cures canine black tongue, the dog analogue of pellagra, identifying niacin as the anti-pellagra factor. This completed the causal chain begun by Goldberger: the dietary deficiency he had identified epidemiologically was now pinned to a specific missing micronutrient, settling pellagra as a niacin-deficiency disease at the molecular level.',
        source: {
          externalId: 'src:elvehjem-nicotinic-acid-pellagra-1937',
          name: 'Simoni RD, Hill RL, Vaughan M. Copper as an essential nutrient and nicotinic acid as the anti-black tongue (pellagra) factor: the work of Conrad Arnold Elvehjem. Journal of Biological Chemistry. 2002;277(34):e22. (Historical account of Elvehjem et al., 1937.)',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12185207/',
          publishedAt: '2002-08-23',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PUBLIC HEALTH FORTIFICATION ERA (1917–1954)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 18. Water fluoridation — Grand Rapids — 1945 ────────────────────────────
  {
    externalId: 'trajectory:water-fluoridation-grand-rapids-1945',
    text: 'Grand Rapids, Michigan became the first city in the world to fluoridate its public drinking water on January 25, 1945, launching the controlled test of the claim that adjusting water fluoride to about 1 ppm safely reduces dental caries — a claim endorsed nationally by 1950 and then contested in U.S. federal court in 2024 over fluoride neurotoxicity.',
    claimType: 'HYBRID',
    claimEmergedAt: '1945-01-25',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1945-01-25',
        datePrecision: 'DAY',
        reason: 'On January 25, 1945, Grand Rapids began adding sodium fluoride to its municipal water, becoming the first city to fluoridate as part of a 15-year controlled study run with the U.S. Public Health Service, the Michigan Department of Health, and the University of Michigan. The trial was motivated by H. Trendley Dean\'s epidemiology linking naturally fluoridated water to lower caries (the \'mottled enamel\' work), and tested whether artificial fluoridation could reproduce that protection while comparing Grand Rapids against unfluoridated Muskegon.',
        source: {
          externalId: 'src:cdc-fluoridation-timeline-grand-rapids-1945',
          name: 'Centers for Disease Control and Prevention. Timeline for Community Water Fluoridation. (Grand Rapids, MI became the first U.S. city to fluoridate its water on January 25, 1945.)',
          url: 'https://www.cdc.gov/fluoridation/timeline-for-community-water-fluoridation/index.html',
          publishedAt: '1945-01-25',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1950-06-01',
        datePrecision: 'MONTH',
        reason: 'After interim Grand Rapids results showed large reductions in childhood tooth decay, the U.S. Public Health Service, the American Dental Association, and the Association of State and Territorial Dental Directors issued statements in June 1950 endorsing community water fluoridation, and the Surgeon General strongly encouraged communities to fluoridate. This converted an experimental intervention into settled national public-health policy, driving adoption that reached roughly 50 million Americans by 1960.',
        source: {
          externalId: 'src:cdc-fluoridation-endorsement-1950',
          name: 'Centers for Disease Control and Prevention. Timeline for Community Water Fluoridation. (USPHS, ADA, and ASTDD endorsed community water fluoridation in 1950; Surgeon General strongly encouraged adoption.)',
          url: 'https://www.cdc.gov/fluoridation/timeline-for-community-water-fluoridation/index.html',
          publishedAt: '1950-06-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'JUDICIAL',
        occurredAt: '2024-09-24',
        datePrecision: 'DAY',
        reason: 'On September 24, 2024, U.S. District Judge Edward Chen ruled in Food & Water Watch, Inc. v. EPA (N.D. Cal.) that fluoridation at the recommended 0.7 mg/L \'poses an unreasonable risk of reduced IQ in children\' and ordered the EPA to act under the Toxic Substances Control Act, relying on National Toxicology Program findings associating fluoride exposure with lowered childhood IQ. While the court stated it did not conclude with certainty that fluoridated water is injurious, the ruling reopened formal scientific and legal contestation of a public-health intervention settled for nearly 80 years.',
        source: {
          externalId: 'src:food-water-watch-v-epa-fluoride-2024',
          name: 'Food & Water Watch, Inc. v. U.S. EPA, No. 17-cv-02162-EMC (N.D. Cal., Sept. 24, 2024) — court order requiring EPA to regulate the unreasonable risk posed by water fluoridation under TSCA.',
          url: 'https://www.foodandwaterwatch.org/2024/09/25/historic-court-decision-in-fluoridation-toxicity-case-orders-epa-to-act/',
          publishedAt: '2024-09-24',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 19. Iodized salt — goiter prevention — 1924 ──────────────────────────────
  {
    externalId: 'trajectory:iodized-salt-goiter-prevention-1924',
    text: 'David Marine and O. P. Kimball reported in 1917 from their Akron, Ohio schoolgirl trial that iodine supplementation prevents endemic goiter, a finding that settled into U.S. public-health practice when Michigan introduced iodized salt in 1924 and Morton Salt rolled it out nationally that year, effectively eliminating goiter from the American \'goiter belt.\'',
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
        reason: 'Marine and Kimball published \'The prevention of simple goiter in man\' (1917), surveying thyroid enlargement among Akron schoolgirls and proposing a plan of iodine prophylaxis. Their controlled trial (1917–1920) gave sodium iodide to 2,190 girls while 2,305 untreated girls served as controls; goiter developed or worsened in only 0.2% of the iodine group versus about 14% of controls, providing the first rigorous human evidence that iodine prevents endemic goiter.',
        source: {
          externalId: 'src:marine-kimball-akron-goiter-1917',
          name: 'Marine D, Kimball OP. The prevention of simple goiter in man. A survey of the incidence and types of thyroid enlargements in the schoolgirls of Akron (Ohio), from the 5th to the 12th grades, inclusive — the plan of prevention proposed. 1917. (Reprinted J Lab Clin Med. 1990;115(1):128-136.)',
          url: 'https://pubmed.ncbi.nlm.nih.gov/2405081/',
          publishedAt: '1917-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1924-05-01',
        datePrecision: 'MONTH',
        reason: 'Acting on Marine and Kimball\'s evidence and David Cowie\'s advocacy, Michigan introduced iodized table salt in May 1924, and Morton Salt began distributing iodized salt nationally later that year — the first population-scale iodine fortification in the United States. Endemic goiter rates in the Great Lakes \'goiter belt\' fell dramatically, marking institutional settlement of iodine prophylaxis as a permanent public-health measure (its centennial was marked in 2024).',
        source: {
          externalId: 'src:iodized-salt-centennial-michigan-1924',
          name: 'Healio Endocrinology. Iodized salt: Celebrating the centennial of a major US public health triumph. (Michigan introduced iodized salt in 1924; Morton Salt rolled it out nationally that year.)',
          url: 'https://www.healio.com/news/endocrinology/20240213/iodized-salt-celebrating-the-centennial-of-a-major-us-public-health-triumph',
          publishedAt: '1924-05-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 20. Vipeholm — sugar causes dental caries — 1954 ────────────────────────
  {
    externalId: 'trajectory:vipeholm-sugar-dental-caries-1954',
    text: 'The Vipeholm dental caries study, published by Gustafsson and colleagues in 1954, established from a five-year controlled feeding experiment that dietary sugar — especially when consumed frequently and between meals in sticky form — causes dental caries, a sugar-disease link later confirmed by the systematic review that informed WHO sugar guidelines.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1954-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1954-01-01',
        datePrecision: 'YEAR',
        reason: 'Gustafsson et al. published \'The Vipeholm dental caries study: the effect of different levels of carbohydrate intake on caries activity in 436 individuals observed for five years\' in Acta Odontologica Scandinavica (1954). The trial, conducted on institutionalized patients at Vipeholm Hospital in Sweden, found that decayed/missing/filled teeth rose most in groups given extra sugar between meals — particularly a specially made sticky toffee — establishing that frequency and physical form of sugar exposure, not just quantity, drive caries. The study\'s coercive design on non-consenting intellectually disabled patients later became a landmark research-ethics case.',
        source: {
          externalId: 'src:gustafsson-vipeholm-caries-1954',
          name: 'Gustafsson BE, Quensel CE, Lanke LS, Lundqvist C, Grahnen H, Bonow BE, Krasse B. The Vipeholm dental caries study: the effect of different levels of carbohydrate intake on caries activity in 436 individuals observed for five years. Acta Odontol Scand. 1954;11(3-4):232-264.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13196991/',
          publishedAt: '1954-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2013-12-09',
        datePrecision: 'DAY',
        reason: 'Moynihan and Kelly published \'Effect on caries of restricting sugars intake: systematic review to inform WHO guidelines\' in the Journal of Dental Research (epub December 9, 2013), pooling decades of evidence and confirming a consistent dose-response relationship between sugar intake and dental caries, with lower caries at intakes below 10% and below 5% of energy. The review provided the formal evidentiary basis cited in WHO\'s sugar guidance, settling the sugar-caries causal link — first demonstrated experimentally at Vipeholm — as established science underpinning global policy.',
        source: {
          externalId: 'src:moynihan-kelly-sugar-caries-who-2014',
          name: 'Moynihan PJ, Kelly SAM. Effect on caries of restricting sugars intake: systematic review to inform WHO guidelines. J Dent Res. 2014;93(1):8-18.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/24323509/',
          publishedAt: '2013-12-09',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 21. First Recommended Dietary Allowances — 1943 ─────────────────────────
  {
    externalId: 'trajectory:first-recommended-dietary-allowances-1943',
    text: 'The U.S. National Research Council\'s Food and Nutrition Board published the first Recommended Dietary Allowances in 1943, establishing national quantitative reference standards for energy and eight nutrients — a framework institutionalized over subsequent decades and expanded into the modern Dietary Reference Intakes from 1997.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1941-05-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1943-01-01',
        datePrecision: 'YEAR',
        reason: 'The National Research Council\'s Food and Nutrition Board, formed in 1941 amid World War II national-defense nutrition concerns, published the first edition of the Recommended Dietary Allowances in 1943 with the stated objective of \'providing standards to serve as a goal for good nutrition.\' The RDAs set quantitative intake targets for energy and eight nutrients and became the foundational reference for U.S. food-assistance, military ration, and dietary-planning programs.',
        source: {
          externalId: 'src:nrc-first-rda-1943',
          name: 'National Research Council, Food and Nutrition Board. Recommended Dietary Allowances (1st edition, 1943). (History summarized in Recommended Dietary Allowances, 10th ed., National Academies Press / NCBI Bookshelf NBK234926.)',
          url: 'https://www.ncbi.nlm.nih.gov/books/NBK234926/',
          publishedAt: '1943-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1997-01-01',
        datePrecision: 'YEAR',
        reason: 'Beginning in 1997, the National Academy of Sciences (Institute of Medicine), in partnership with Health Canada, replaced and expanded the periodically revised RDAs with the Dietary Reference Intakes (DRIs) framework, issued in volumes through 2005. The DRIs retained the RDA as one of several reference values and became the authoritative basis for U.S. and Canadian nutrient guidance, food labeling, and dietary planning — consolidating the 1943 standard into the modern, durable institutional framework still in use.',
        source: {
          externalId: 'src:dietary-reference-intakes-1997',
          name: 'Institute of Medicine (National Academies). Dietary Reference Intakes — framework launched 1997, issued in volumes through 2005, expanding and replacing the Recommended Dietary Allowances.',
          url: 'https://en.wikipedia.org/wiki/Dietary_Reference_Intake',
          publishedAt: '1997-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // MICRONUTRIENT SUPPLEMENT REVERSAL ERA (1969–2014)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 22. Niacin — HDL cardioprotection reversal — 1975 ───────────────────────
  {
    externalId: 'trajectory:niacin-hdl-cardioprotection-reversal-1975',
    text: 'The claim that niacin (vitamin B3) supplementation reduces cardiovascular events, first supported by the Coronary Drug Project on January 27, 1975, was reversed when the AIM-HIGH (2011) and HPS2-THRIVE (2014) randomized trials found that adding niacin to statin therapy produced no cardiovascular benefit and increased serious adverse events.',
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
        reason: 'The Coronary Drug Project Research Group published \'Clofibrate and niacin in coronary heart disease\' in JAMA (January 27, 1975), reporting that among 8,341 men with prior myocardial infarction, the niacin arm had a statistically significant reduction in nonfatal recurrent MI versus placebo, while clofibrate showed no efficacy. This was the first large randomized evidence that niacin, a B-vitamin used at pharmacologic doses, conferred coronary benefit, launching its use as a lipid-modifying therapy.',
        source: {
          externalId: 'src:cdp-clofibrate-niacin-jama-1975',
          name: 'Coronary Drug Project Research Group. Clofibrate and niacin in coronary heart disease. JAMA. 1975;231(4):360–381.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/1088963/',
          publishedAt: '1975-01-27',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1986-12-01',
        datePrecision: 'MONTH',
        reason: 'Canner et al. published the 15-year follow-up of Coronary Drug Project patients in the Journal of the American College of Cardiology (December 1986), finding 11% lower all-cause mortality in the niacin group (52.0% vs 58.2%; p=0.0004) — a durable survival benefit appearing years after treatment ended. The long-term mortality reduction settled niacin as an established cardioprotective lipid therapy, and it was widely recommended for dyslipidemia, especially to raise HDL cholesterol.',
        source: {
          externalId: 'src:canner-cdp-15yr-jacc-1986',
          name: 'Canner PL, Berge KG, Wenger NK, et al. Fifteen year mortality in Coronary Drug Project patients: long-term benefit with niacin. J Am Coll Cardiol. 1986;8(6):1245–1255.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/3782631/',
          publishedAt: '1986-12-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2011-11-15',
        datePrecision: 'DAY',
        reason: 'Boden et al. published the AIM-HIGH trial in the NEJM (online November 15, 2011), in which 3,414 patients with cardiovascular disease and low HDL on intensive statin therapy were randomized to extended-release niacin or placebo. Despite niacin raising HDL and lowering triglycerides, there was no reduction in cardiovascular events, and the trial was stopped early for futility. The result placed niacin\'s cardioprotective value, in the statin era, into active contestation.',
        source: {
          externalId: 'src:aim-high-niacin-nejm-2011',
          name: 'AIM-HIGH Investigators (Boden WE, et al.). Niacin in patients with low HDL cholesterol levels receiving intensive statin therapy. NEJM. 2011;365(24):2255–2267.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/22085343/',
          publishedAt: '2011-11-15',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2014-07-17',
        datePrecision: 'DAY',
        reason: 'The HPS2-THRIVE Collaborative Group published in the NEJM (July 17, 2014) results from 25,673 high-risk patients randomized to extended-release niacin–laropiprant or placebo atop statin therapy: niacin produced no significant reduction in major vascular events (13.2% vs 13.7%; p=0.29) but significantly increased serious adverse events including new-onset diabetes, infection, and bleeding. The large definitive trial reversed the niacin cardioprotection hypothesis and led to withdrawal of the niacin–laropiprant product.',
        source: {
          externalId: 'src:hps2-thrive-niacin-nejm-2014',
          name: 'HPS2-THRIVE Collaborative Group. Effects of Extended-Release Niacin with Laropiprant in High-Risk Patients. NEJM. 2014;371(3):203–212.',
          url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa1300955',
          publishedAt: '2014-07-17',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 23. Homocysteine — B-vitamin CVD hypothesis reversal — 1969 ─────────────
  {
    externalId: 'trajectory:homocysteine-b-vitamin-cvd-hypothesis-1969',
    text: 'Kilmer McCully\'s 1969 homocysteine theory of arteriosclerosis — that elevated homocysteine causes vascular disease, implying that lowering it with folic acid and B vitamins would prevent cardiovascular events — was reversed when the NORVIT and HOPE-2 randomized trials in 2006 found that B-vitamin homocysteine lowering produced no cardiovascular benefit and possible harm.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1969-07-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1969-07-01',
        datePrecision: 'MONTH',
        reason: 'McCully published \'Vascular pathology of homocysteinemia: implications for the pathogenesis of arteriosclerosis\' in the American Journal of Pathology (1969), reporting that two children with inborn homocystinuria had died with extensive arterial disease, and proposing that elevated homocysteine is a cause of arteriosclerosis. The homocysteine theory implied that increasing folic acid and B-vitamin intake to lower homocysteine could prevent vascular disease.',
        source: {
          externalId: 'src:mccully-homocysteine-ajp-1969',
          name: 'McCully KS. Vascular pathology of homocysteinemia: implications for the pathogenesis of arteriosclerosis. American Journal of Pathology. 1969;56(1):111–128.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/5792556/',
          publishedAt: '1969-07-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1995-10-04',
        datePrecision: 'DAY',
        reason: 'Boushey et al. published a quantitative meta-analysis in JAMA (October 4, 1995) pooling 27 studies and concluding that elevated plasma homocysteine is an independent, graded risk factor for arteriosclerotic vascular disease, estimating that increased folic acid intake could prevent tens of thousands of coronary deaths annually. The analysis consolidated homocysteine as an accepted modifiable cardiovascular risk factor and helped drive folic-acid enthusiasm and the rationale for B-vitamin intervention trials.',
        source: {
          externalId: 'src:boushey-homocysteine-jama-1995',
          name: 'Boushey CJ, Beresford SAA, Omenn GS, Motulsky AG. A quantitative assessment of plasma homocysteine as a risk factor for vascular disease. JAMA. 1995;274(13):1049–1057.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/7563456/',
          publishedAt: '1995-10-04',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-03-12',
        datePrecision: 'DAY',
        reason: 'On March 12, 2006 the NEJM published two large randomized trials online: NORVIT (Bønaa et al., 3,749 post-MI patients) and HOPE-2 (Lonn et al., 5,522 vascular-disease patients). Both showed that folic acid plus vitamins B6/B12 lowered homocysteine by roughly 25–28% but produced no reduction in cardiovascular events, and NORVIT suggested possible harm. The trials reversed the therapeutic corollary of the homocysteine theory — that B-vitamin homocysteine lowering prevents cardiovascular disease.',
        source: {
          externalId: 'src:norvit-homocysteine-nejm-2006',
          name: 'Bønaa KH, Njølstad I, Ueland PM, et al. (NORVIT Trial). Homocysteine lowering and cardiovascular events after acute myocardial infarction. NEJM. 2006;354(15):1578–1588. (Companion trial: Lonn E, et al. HOPE-2, NEJM. 2006;354(15):1567–1577.)',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16531614/',
          publishedAt: '2006-03-12',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 24. Vitamin D — extra-skeletal prevention reversal — 1980 ───────────────
  {
    externalId: 'trajectory:vitamin-d-extraskeletal-prevention-reversal-1980',
    text: 'The hypothesis that vitamin D reduces the risk of cancer and cardiovascular disease, proposed by Cedric and Frank Garland in 1980 from sunlight–colon cancer geography, was contested by the 2010 Institute of Medicine review and reversed by the VITAL randomized trial (2018), which found high-dose vitamin D supplementation did not reduce cancer or major cardiovascular events.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1980-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1980-01-01',
        datePrecision: 'YEAR',
        reason: 'Garland CF and Garland FC published \'Do sunlight and vitamin D reduce the likelihood of colon cancer?\' in the International Journal of Epidemiology (1980), observing that U.S. colon cancer mortality was highest where solar radiation (and thus cutaneous vitamin D synthesis) was lowest, and proposing vitamin D as a protective factor. The paper launched decades of observational research linking higher vitamin D status to lower risk of cancer and cardiovascular disease.',
        source: {
          externalId: 'src:garland-sunlight-vitamin-d-colon-cancer-1980',
          name: 'Garland CF, Garland FC. Do sunlight and vitamin D reduce the likelihood of colon cancer? International Journal of Epidemiology. 1980;9(3):227–231.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/7440046/',
          publishedAt: '1980-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '2010-11-30',
        datePrecision: 'DAY',
        reason: 'The Institute of Medicine\'s report on Dietary Reference Intakes for Calcium and Vitamin D (released November 30, 2010) concluded that while evidence supported vitamin D\'s role in skeletal health, the evidence for extra-skeletal outcomes — cancer, cardiovascular disease, diabetes, and autoimmune disease — was \'inconsistent, inconclusive as to causality, and insufficient to inform nutritional requirements.\' This authoritative institutional review formally cast the Garland extra-skeletal prevention hypothesis into contestation against widespread public enthusiasm.',
        source: {
          externalId: 'src:iom-dri-calcium-vitamin-d-2010',
          name: 'Institute of Medicine (Committee to Review Dietary Reference Intakes for Vitamin D and Calcium). Dietary Reference Intakes for Calcium and Vitamin D. Washington, DC: National Academies Press; November 30, 2010.',
          url: 'https://www.ncbi.nlm.nih.gov/books/NBK56070/',
          publishedAt: '2010-11-30',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-11-10',
        datePrecision: 'DAY',
        reason: 'Manson et al. published the VITAL trial in the NEJM (online November 10, 2018), in which 25,871 initially healthy U.S. adults were randomized to vitamin D3 2000 IU/day or placebo for a median 5.3 years. Vitamin D did not reduce the incidence of invasive cancer (HR 0.96) or major cardiovascular events (HR 0.97). As the largest primary-prevention RCT of vitamin D, it reversed the extra-skeletal cancer/cardiovascular prevention hypothesis for general supplementation.',
        source: {
          externalId: 'src:vital-vitamin-d-nejm-2018',
          name: 'Manson JE, Cook NR, Lee IM, et al. (VITAL Research Group). Vitamin D Supplements and Prevention of Cancer and Cardiovascular Disease. NEJM. 2019;380(1):33–44 (published online November 10, 2018).',
          url: 'https://pubmed.ncbi.nlm.nih.gov/30415629/',
          publishedAt: '2018-11-10',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 25. IOM vitamin D RDA revision — 2010 ───────────────────────────────────
  {
    externalId: 'trajectory:iom-vitamin-d-rda-revision-2010',
    text: 'The U.S. recommended reference intake for vitamin D, first set as an Adequate Intake of 200 IU/day by the Institute of Medicine in 1997, was revised upward on November 30, 2010 to a Recommended Dietary Allowance of 600 IU/day (800 IU for adults over 70), with a tolerable upper limit of 4,000 IU/day, formalizing a population requirement based on bone health and rejecting higher intakes proposed by vitamin D advocates.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1997-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1997-01-01',
        datePrecision: 'YEAR',
        reason: 'The Institute of Medicine\'s 1997 report \'Dietary Reference Intakes for Calcium, Phosphorus, Magnesium, Vitamin D, and Fluoride\' set vitamin D as an Adequate Intake (AI) of 200 IU/day for younger adults (rising to 400–600 IU at older ages), explicitly declining to establish a Recommended Dietary Allowance because the evidence base was deemed insufficient. This established the first modern U.S. quantitative reference value for vitamin D intake.',
        source: {
          externalId: 'src:iom-dri-calcium-vitamin-d-1997',
          name: 'Institute of Medicine, Standing Committee on the Scientific Evaluation of Dietary Reference Intakes. Dietary Reference Intakes for Calcium, Phosphorus, Magnesium, Vitamin D, and Fluoride. Washington, DC: National Academies Press; 1997.',
          url: 'https://www.ncbi.nlm.nih.gov/books/NBK109825/',
          publishedAt: '1997-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2010-11-30',
        datePrecision: 'DAY',
        reason: 'On November 30, 2010 the Institute of Medicine replaced the 1997 AI with a formal Recommended Dietary Allowance for vitamin D of 600 IU/day (ages 1–70) and 800 IU/day (71+), corresponding to a serum 25-hydroxyvitamin D level of 20 ng/mL, and set a tolerable upper intake level of 4,000 IU/day. The committee explicitly pushed back on advocacy for much higher intakes, concluding most North Americans already had adequate vitamin D and that megadosing lacked evidence — establishing the current settled reference standard used in U.S. food labeling and dietary guidance.',
        source: {
          externalId: 'src:iom-dri-calcium-vitamin-d-2010',
          name: 'Institute of Medicine (Committee to Review Dietary Reference Intakes for Vitamin D and Calcium). Dietary Reference Intakes for Calcium and Vitamin D. Washington, DC: National Academies Press; November 30, 2010.',
          url: 'https://www.ncbi.nlm.nih.gov/books/NBK56070/',
          publishedAt: '2010-11-30',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 26. SELECT — vitamin E/selenium prostate cancer reversal — 1996 ──────────
  {
    externalId: 'trajectory:select-vitamin-e-selenium-prostate-cancer-1996',
    text: 'The hypothesis that selenium and vitamin E supplementation prevents prostate cancer — supported by the 1996 Nutritional Prevention of Cancer trial — was reversed by the SELECT trial, which found in 2009 no preventive effect and in its 2011 update that vitamin E supplementation significantly increased prostate cancer risk in healthy men.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1996-12-25',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1996-12-25',
        datePrecision: 'DAY',
        reason: 'Clark et al. published the Nutritional Prevention of Cancer trial in JAMA (December 25, 1996); although selenium supplementation did not reduce the primary skin-cancer endpoint, it produced significant secondary reductions in total cancer incidence and mortality and in prostate cancer incidence. Together with secondary vitamin E findings from the ATBC study, this generated the hypothesis that selenium and vitamin E supplements could prevent prostate cancer, motivating a dedicated large trial.',
        source: {
          externalId: 'src:clark-selenium-npc-jama-1996',
          name: 'Clark LC, Combs GF Jr, Turnbull BW, et al. Effects of selenium supplementation for cancer prevention in patients with carcinoma of the skin. JAMA. 1996;276(24):1957–1963.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/8971064/',
          publishedAt: '1996-12-25',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2009-01-07',
        datePrecision: 'DAY',
        reason: 'Lippman et al. published initial SELECT results in JAMA (January 7, 2009): among 35,533 men randomized to selenium, vitamin E, both, or placebo, neither agent alone nor in combination prevented prostate cancer, and the trial\'s supplementation was halted early. The null result directly contradicted the prevention hypothesis and placed it into active contestation.',
        source: {
          externalId: 'src:select-lippman-jama-2009',
          name: 'Lippman SM, Klein EA, Goodman PJ, et al. Effect of selenium and vitamin E on risk of prostate cancer and other cancers: the Selenium and Vitamin E Cancer Prevention Trial (SELECT). JAMA. 2009;301(1):39–51.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/19066370/',
          publishedAt: '2009-01-07',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'REVERSED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2011-10-12',
        datePrecision: 'DAY',
        reason: 'Klein et al. published the updated SELECT analysis in JAMA (October 12, 2011) after extended follow-up: men taking vitamin E alone had a statistically significant 17% increase in prostate cancer incidence versus placebo (HR 1.17). The finding reversed the protective hypothesis entirely — a supplement once thought preventive was shown to raise cancer risk — reinforcing the broader lesson that antioxidant micronutrient supplements can harm.',
        source: {
          externalId: 'src:select-klein-jama-2011',
          name: 'Klein EA, Thompson IM Jr, Tangen CM, et al. Vitamin E and the risk of prostate cancer: the Selenium and Vitamin E Cancer Prevention Trial (SELECT). JAMA. 2011;306(14):1549–1556.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/21990298/',
          publishedAt: '2011-10-12',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ADDED SUGAR POLICY ERA (2014–2020)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 27. Sugar Research Foundation — Project 259 suppression — 2017 ──────────
  {
    externalId: 'trajectory:sugar-industry-project-259-suppression-2017',
    text: 'Cristin Kearns, Dorie Apollonio, and Stanton Glantz revealed on November 21, 2017 in PLOS Biology that the Sugar Research Foundation funded, then terminated and never published, Project 259 (1967–1971) after its preliminary results suggested that sucrose, compared with starch, raised blood triglycerides and elevated beta-glucuronidase — an enzyme then linked to bladder cancer.',
    claimType: 'HYBRID',
    claimEmergedAt: '2017-11-21',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1971-01-01',
        datePrecision: 'YEAR',
        reason: 'The Sugar Research Foundation (later International Sugar Research Foundation) internally documented that Project 259 — \'Dietary Carbohydrate and Blood Lipids in Germ-Free Rats,\' run by W.F.R. Pover at the University of Birmingham — found sucrose raised serum triglycerides and beta-glucuronidase relative to starch. After the August 1970 progress report, the Foundation\'s research vice-president John Hickson valued the project at \'nil,\' denied continuation funding, and the adverse findings were never published. The result was recorded only in the industry\'s internal files.',
        source: {
          externalId: 'src:kearns-project-259-plos-biology-2017',
          name: 'Kearns CE, Apollonio D, Glantz SA. Sugar industry sponsorship of germ-free rodent studies linking sucrose to hyperlipidemia and cancer: An historical analysis of internal documents. PLOS Biology. 2017;15(11):e2003460.',
          url: 'https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2003460',
          publishedAt: '2017-11-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-11-21',
        datePrecision: 'DAY',
        reason: 'Kearns, Apollonio, and Glantz publish the internal Sugar Research Foundation correspondence and Project 259 reports in PLOS Biology, establishing as documented historical fact that the industry suppressed early evidence that sucrose may be more metabolically harmful and potentially carcinogenic than starch. Drawing on primary internal documents, the analysis is widely accepted and corroborates the same authors\' 2016 JAMA Internal Medicine exposé of the 1967 NEJM review, settling the suppression as an accepted episode in the history of nutrition science.',
        source: {
          externalId: 'src:kearns-project-259-plos-biology-2017',
          name: 'Kearns CE, Apollonio D, Glantz SA. Sugar industry sponsorship of germ-free rodent studies linking sucrose to hyperlipidemia and cancer: An historical analysis of internal documents. PLOS Biology. 2017;15(11):e2003460.',
          url: 'https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2003460',
          publishedAt: '2017-11-21',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 28. Mexico sugar-sweetened beverage tax — 2014 ──────────────────────────
  {
    externalId: 'trajectory:mexico-sugar-sweetened-beverage-tax-2014',
    text: 'Mexico imposed a 1-peso-per-liter excise tax on sugar-sweetened beverages effective January 1, 2014 — the first large national soda tax justified on obesity and diabetes grounds — and a 2016 BMJ evaluation found it cut taxed-beverage purchases by about 6% over the first year, rising to a 12% reduction by December 2014.',
    claimType: 'HYBRID',
    claimEmergedAt: '2014-01-01',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2014-01-01',
        datePrecision: 'DAY',
        reason: 'Mexico\'s federal government implements a 1-peso-per-liter (roughly 10%) excise tax on non-alcoholic sugar-sweetened beverages on January 1, 2014, as part of a fiscal-reform package aimed at the country\'s obesity and type 2 diabetes epidemics. It is the first sugar-sweetened beverage tax adopted at national scale by a large middle-income country, converting the contested metabolic hypothesis that sugary-drink consumption drives obesity into a concrete population-level policy lever.',
        source: {
          externalId: 'src:colchero-mexico-ssb-tax-bmj-2016',
          name: 'Colchero MA, Popkin BM, Rivera JA, Ng SW. Beverage purchases from stores in Mexico under the excise tax on sugar sweetened beverages: observational study. BMJ. 2016;352:h6704.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/26738745/',
          publishedAt: '2016-01-06',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2016-01-06',
        datePrecision: 'DAY',
        reason: 'Colchero, Popkin, Rivera, and Ng publish an observational analysis of store-purchase data in BMJ (January 6, 2016) showing that, relative to a counterfactual based on pre-tax trends, purchases of taxed sugar-sweetened beverages fell an average of 6% across 2014 and reached a 12% reduction by December, with the largest declines among low-income households, while untaxed-beverage purchases rose 4%. The result provides the first rigorous empirical evidence that a soda tax measurably reduces consumption, and is later reinforced by two-year follow-up data, settling SSB taxation as an effective demand-reduction tool now endorsed by the WHO.',
        source: {
          externalId: 'src:colchero-mexico-ssb-tax-bmj-2016',
          name: 'Colchero MA, Popkin BM, Rivera JA, Ng SW. Beverage purchases from stores in Mexico under the excise tax on sugar sweetened beverages: observational study. BMJ. 2016;352:h6704.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/26738745/',
          publishedAt: '2016-01-06',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 29. FDA added sugars label — 2016 ───────────────────────────────────────
  {
    externalId: 'trajectory:fda-added-sugars-label-2016',
    text: 'The U.S. Food and Drug Administration\'s final rule revising the Nutrition Facts label, published May 27, 2016, required for the first time a separate \'Added Sugars\' line and established a Daily Value of 10% of calories, formally recognizing added sugar as a distinct nutrient of public-health concern.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2016-05-27',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2016-05-27',
        datePrecision: 'DAY',
        reason: 'The FDA publishes its final rule \'Food Labeling: Revision of the Nutrition and Supplement Facts Labels\' in the Federal Register (81 FR 33742, May 27, 2016), mandating a mandatory \'Added Sugars\' declaration in grams and as a percent Daily Value, with the DV set at 50 g (10% of a 2,000-calorie diet). The rule marks the first time U.S. food labeling distinguishes added sugars from naturally occurring sugars, codifying added sugar as a separately regulated nutrient.',
        source: {
          externalId: 'src:fda-nutrition-facts-final-rule-2016',
          name: 'Food and Drug Administration. Food Labeling: Revision of the Nutrition and Supplement Facts Labels. Final rule. Federal Register. 2016;81(103):33742–33999.',
          url: 'https://www.federalregister.gov/documents/2016/05/27/2016-11867/food-labeling-revision-of-the-nutrition-and-supplement-facts-labels',
          publishedAt: '2016-05-27',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2020-01-01',
        datePrecision: 'DAY',
        reason: 'After the FDA extended the original July 2018 compliance deadline, the Added Sugars declaration became mandatory on January 1, 2020 for manufacturers with $10 million or more in annual food sales (and January 1, 2021 for smaller manufacturers), making the added-sugar line a standard, enforceable feature across the U.S. packaged-food supply. The labeling requirement is now fully in force and uncontested, settling added sugar as an institutionally recognized nutrient.',
        source: {
          externalId: 'src:fda-changes-nutrition-facts-label-compliance',
          name: 'Food and Drug Administration. Changes to the Nutrition Facts Label (compliance dates). FDA.gov.',
          url: 'https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/changes-nutrition-facts-label',
          publishedAt: '2020-01-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 30. Dietary Guidelines added sugar limit — 2016 ─────────────────────────
  {
    externalId: 'trajectory:dietary-guidelines-added-sugar-limit-2016',
    text: 'The 2015–2020 Dietary Guidelines for Americans (8th edition), released January 7, 2016 by USDA and HHS, set for the first time a specific quantitative limit on added sugars — less than 10% of daily calories — while simultaneously dropping the longstanding upper limit on total dietary fat.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2016-01-07',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2016-01-07',
        datePrecision: 'DAY',
        reason: 'USDA and HHS release the 8th edition of the Dietary Guidelines for Americans on January 7, 2016, recommending that Americans consume less than 10% of daily calories from added sugars — the first numeric cap on added sugar in the guidelines\' history — and removing the cap on total fat that had anchored federal advice since 1980. The shift relocates the primary dietary target from fat toward added sugar, marking institutional adoption of the sugar-focused reframing.',
        source: {
          externalId: 'src:dga-2015-2020-eighth-edition',
          name: 'U.S. Department of Agriculture and U.S. Department of Health and Human Services. Dietary Guidelines for Americans 2015–2020, 8th Edition. December 2015 (released January 7, 2016).',
          url: 'https://health.gov/our-work/nutrition-physical-activity/dietary-guidelines/previous-dietary-guidelines/2015',
          publishedAt: '2016-01-07',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2020-12-29',
        datePrecision: 'DAY',
        reason: 'The 2020–2025 Dietary Guidelines for Americans, issued December 29, 2020, retain the less-than-10%-of-calories added-sugar limit (after USDA and HHS declined to adopt the advisory committee\'s proposed stricter 6% cap), confirming the added-sugar ceiling as durable federal policy across two guideline cycles. The continuity settles the added-sugar limit as established institutional consensus rather than a one-time recommendation.',
        source: {
          externalId: 'src:dga-2020-2025-added-sugar-retained',
          name: 'U.S. Department of Agriculture and U.S. Department of Health and Human Services. Dietary Guidelines for Americans 2020–2025, 9th Edition. December 2020.',
          url: 'https://www.dietaryguidelines.gov/sites/default/files/2021-03/Dietary_Guidelines_for_Americans-2020-2025.pdf',
          publishedAt: '2020-12-29',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 17. WHO free sugars guideline — 2015 ────────────────────────────────────
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
