import type { Family } from "./types";

export const FAMILIES_14_19: Family[] = [
  // ── Family 14 ─────────────────────────────────────────────────────────────
  {
    slug: "chronic-ncd",
    number: 14,
    name: "Chronic & Non-Communicable Disease Epidemiology",
    blurb: "The long-latency, multifactorial diseases that now dominate global mortality and disability.",
    section: "D",
    color: "rose",
    dataSource: "GBD 2021 cause hierarchy (leading global causes of death: ischemic heart disease, COVID-19, stroke — verify at build time); WHO GHO NCD indicators; national cancer registries; GLOBOCAN.",
    entries: [
      {
        name: "Non-communicable diseases (NCDs)",
        description: "The dominant global burden.",
        principle:
          "Cardiovascular disease, cancer, chronic respiratory disease, and diabetes — long-latency, multifactorial conditions now the leading causes of death worldwide.",
        dataSource: "GBD; WHO GHO NCD indicators.",
        tags: ["chronic"],
      },
      {
        name: "Cardiovascular disease epidemiology",
        description: "The leading killer.",
        principle:
          "Ischemic heart disease and stroke lead global mortality (GBD 2021), driven by hypertension, lipids, tobacco, diet, and inactivity; largely preventable at the population level.",
        example: "Framingham risk factors.",
        tags: ["chronic"],
      },
      {
        name: "Cancer epidemiology",
        description: "Distribution and causes of malignancy.",
        principle:
          "Studies incidence and mortality patterns and modifiable causes (tobacco, infection, diet, radiation, occupation) across cancer sites; registries anchor measurement.",
        dataSource: "National cancer registries; GLOBOCAN.",
        tags: ["chronic"],
      },
      {
        name: "Diabetes & metabolic epidemiology",
        description: "A rising pandemic of dysglycemia.",
        principle:
          "Tracks type 2 diabetes and metabolic syndrome driven by obesity, diet, and inactivity, with major downstream vascular burden.",
        tags: ["chronic"],
      },
      {
        name: "Obesity epidemiology",
        description: "A population-level risk driver.",
        definition: "$\\text{BMI} = \\dfrac{\\text{mass (kg)}}{\\text{height (m)}^{2}}$; population burden is measured via BMI distribution shifts.",
        interpretation: "A determinant of NCDs shaped by food environments and activity, treated as a population phenomenon, not merely individual choice.",
        tags: ["chronic"],
      },
      {
        name: "Risk-factor epidemiology",
        description: "Quantifying modifiable causes.",
        principle:
          "Estimates how much disease is attributable to exposures (via PAF) to prioritize prevention; the GBD comparative risk assessment is its global expression.",
        dataSource: "GBD risk factors.",
        tags: ["chronic"],
      },
      {
        name: "Life-course epidemiology",
        description: "Exposures across a lifetime.",
        principle:
          "Early-life and cumulative exposures (fetal, childhood, adult) shape adult chronic-disease risk through critical periods and accumulation.",
        example: "The developmental-origins (Barker) hypothesis.",
        tags: ["chronic"],
      },
      {
        name: "Multimorbidity & aging",
        description: "Concurrent chronic conditions.",
        principle:
          "As populations age, co-occurring chronic diseases become the norm, straining measurement (single-cause frames) and health systems.",
        tags: ["chronic", "demography"],
      },
      {
        name: "Injury & violence epidemiology",
        description: "Intentional and unintentional harm.",
        principle:
          "Road traffic, falls, self-harm, and interpersonal violence as patterned, preventable population health problems amenable to environmental and policy intervention.",
        tags: ["chronic", "injury"],
      },
      {
        name: "Mental health epidemiology",
        description: "Distribution of psychiatric disorders.",
        principle:
          "Population prevalence, determinants, and burden of depression, anxiety, substance use, and other disorders; a large and rising share of disability (YLDs).",
        tags: ["chronic"],
        xref: ["psychology"],
      },
    ],
  },

  // ── Family 15 ─────────────────────────────────────────────────────────────
  {
    slug: "environmental-occupational",
    number: 15,
    name: "Environmental & Occupational Health",
    blurb: "Population health as shaped by the physical world and the workplace.",
    section: "E",
    color: "green",
    dataSource: "WHO GHO environmental & risk indicators; GBD environmental/occupational risk factors; national air-quality monitoring.",
    entries: [
      {
        name: "Environmental epidemiology",
        description: "Health effects of environmental exposures.",
        principle:
          "Studies how air, water, soil, chemical, and physical agents in the ambient environment affect population health.",
        dataSource: "GBD environmental risks.",
        tags: ["environmental"],
        xref: ["environmental-science"],
      },
      {
        name: "Exposure assessment",
        description: "Measuring the dose to a population.",
        principle:
          "Quantifies contact with an agent (external concentration, biomarkers of internal dose) — the exposure axis of any environmental study; measurement error here biases everything downstream.",
        tags: ["environmental", "occupational"],
      },
      {
        name: "Dose-response relationship",
        description: "Effect rising with exposure.",
        principle:
          "Characterizes how health effect changes with dose (threshold vs linear-no-threshold); central to standard-setting.",
        interpretation: "A monotone gradient strengthens causal inference (Hill).",
        tags: ["environmental"],
        xref: ["pharmacology"],
      },
      {
        name: "Air pollution epidemiology",
        description: "Health burden of dirty air.",
        principle:
          "Links ambient and household particulate matter (PM2.5), ozone, and $\\text{NO}_2$ to cardiorespiratory mortality and morbidity; a leading global environmental risk.",
        dataSource: "WHO GHO air-quality; GBD.",
        tags: ["environmental"],
      },
      {
        name: "Water, sanitation & hygiene (WASH)",
        description: "Basic environmental prevention.",
        principle:
          "Safe water, sanitation, and hygiene prevent diarrheal and other diseases; among the highest-yield population health interventions historically.",
        example: "John Snow and the Broad Street pump.",
        tags: ["environmental", "global"],
      },
      {
        name: "Occupational epidemiology",
        description: "Health hazards of work.",
        principle:
          "Studies workplace exposures (chemical, physical, biological, ergonomic) and their disease outcomes in worker populations; complicated by the healthy-worker effect.",
        tags: ["occupational"],
      },
      {
        name: "Toxicology for public health",
        description: "Agents, dose, and harm.",
        principle:
          "The study of poisons — how chemical agents cause harm as a function of dose, route, and susceptibility; supplies the hazard side of risk assessment.",
        tags: ["environmental"],
        xref: ["pharmacology"],
      },
      {
        name: "Risk assessment (4-step)",
        description: "From hazard to policy input.",
        principle:
          "Hazard identification → dose-response assessment → exposure assessment → risk characterization; the formal framework translating toxicology and epidemiology into standards.",
        tags: ["environmental"],
      },
      {
        name: "Environmental justice",
        description: "Unequal exposure burdens.",
        principle:
          "Environmental hazards fall disproportionately on marginalized communities; a determinant of health inequity, not merely a distributional footnote.",
        tags: ["environmental"],
        xref: ["sociology"],
      },
      {
        name: "Climate change & health",
        description: "A threat multiplier.",
        principle:
          "Heat, shifting vector ranges, extreme weather, food and water insecurity, and displacement translate climate change into population health harm.",
        example: "Expanding dengue range.",
        tags: ["environmental"],
        xref: ["environmental-science"],
      },
      {
        name: "Built environment & health",
        description: "Design as a determinant.",
        principle:
          "Land use, walkability, green space, and housing shape physical activity, injury, and mental health at the population level.",
        tags: ["environmental"],
      },
      {
        name: "Food safety & foodborne disease",
        description: "Hazards in the food supply.",
        principle:
          "Surveillance and control of chemical and microbial contaminants from farm to fork; a classic outbreak-investigation domain.",
        tags: ["environmental", "outbreak"],
      },
    ],
  },

  // ── Family 16 ─────────────────────────────────────────────────────────────
  {
    slug: "global-population-health",
    number: 16,
    name: "Global & Population Health",
    blurb: "The transnational frame, the summary burden metrics, and the drive for health equity.",
    section: "E",
    color: "green",
    dataSource: "GBD (Global Burden of Disease); WHO GHO SDG indicators; disability weights from GBD.",
    entries: [
      {
        name: "Global health",
        description: "Health improvement and equity worldwide.",
        principle:
          "A field prioritizing transnational health issues and equity, transcending national borders and drawing on many disciplines; distinct from (but overlapping) international health.",
        tags: ["global"],
      },
      {
        name: "Epidemiologic transition",
        description: "The shifting disease profile.",
        principle:
          "As societies develop, the dominant burden shifts from infectious and famine mortality toward chronic and degenerative disease; frames the double burden many countries now face.",
        tags: ["global"],
      },
      {
        name: "Demographic transition",
        description: "From high to low birth/death rates.",
        principle:
          "Populations move through stages of falling mortality then fertility, reshaping age structure and disease burden.",
        tags: ["global", "demography"],
      },
      {
        name: "Health disparities & equity",
        description: "Unfair, avoidable differences.",
        principle:
          "Systematic health differences by social position (income, race, geography) that are avoidable and unjust; equity aims to remove them, distinct from mere equality.",
        dataSource: "WHO GHO disaggregated indicators.",
        tags: ["global"],
        xref: ["sociology"],
      },
      {
        name: "Sustainable Development Goals (health)",
        description: "The global health-targets framework.",
        principle:
          "SDG 3 and health-relevant goals set measurable population health targets (mortality, coverage, determinants) tracked via GHO indicators.",
        dataSource: "WHO GHO SDG indicators.",
        tags: ["global"],
        xref: ["governance"],
      },
      {
        name: "DALY (disability-adjusted life year)",
        description: "The summary burden metric.",
        definition: "$\\text{DALY} = \\text{YLL} + \\text{YLD}$ (years of life lost + years lived with disability).",
        interpretation: "One DALY = one lost healthy year; the currency of the GBD.",
        dataSource: "GBD.",
        tags: ["global", "burden"],
      },
      {
        name: "QALY (quality-adjusted life year)",
        description: "The economic-evaluation metric.",
        definition: "$\\text{QALY} = \\sum_t q_t \\, \\Delta t$, summing time weighted by a health-utility $q_t \\in [0,1]$.",
        interpretation: "The outcome unit of cost-utility analysis; higher = more quality-weighted life.",
        tags: ["global"],
      },
      {
        name: "YLL & YLD",
        description: "The two DALY components.",
        definition: "$\\text{YLL} = N \\times L$ (deaths × standard life expectancy lost); $\\text{YLD} = \\text{prevalence} \\times \\text{disability weight}$.",
        tags: ["global", "burden"],
      },
      {
        name: "Disability weights",
        description: "Pricing states worse than health.",
        principle:
          "Survey-derived weights (0 = full health, 1 = death) quantify the severity of living with a condition, enabling non-fatal burden to enter the DALY.",
        dataSource: "GBD disability weights.",
        tags: ["global", "burden"],
      },
      {
        name: "Global Burden of Disease (GBD) study",
        description: "The comprehensive burden accounting.",
        principle:
          "A systematic, comparable estimation of mortality and disability from hundreds of causes and risks across all countries and years — the platform's central burden dataset.",
        dataSource: "GBD.",
        tags: ["global", "burden"],
      },
      {
        name: "Life expectancy & HALE",
        description: "Summarizing survival and health.",
        principle:
          "Life expectancy is the mean years lived from a life table; HALE (healthy life expectancy) discounts years spent in poor health.",
        dataSource: "WHO GHO.",
        tags: ["global", "demography"],
      },
      {
        name: "Neglected tropical diseases (NTDs)",
        description: "Diseases of poverty.",
        principle:
          "A group of chronic parasitic and bacterial diseases concentrated in impoverished tropical populations, historically under-resourced despite large burden.",
        example: "Schistosomiasis, lymphatic filariasis.",
        tags: ["global", "infectious"],
      },
    ],
  },

  // ── Family 17 ─────────────────────────────────────────────────────────────
  {
    slug: "biostatistics",
    number: 17,
    name: "Biostatistics for Public Health",
    blurb: "The inferential engine of the field — the statistical machinery specialized for health data.",
    section: "F",
    color: "violet",
    dataSource: "Method internals shared with the /statistics sibling; health-study datasets from cohorts, trials, and surveys.",
    entries: [
      {
        name: "Biostatistics",
        description: "Statistics applied to health and biology.",
        principle:
          "The theory and methods for designing health studies and analyzing their data — the inferential engine beneath epidemiology; shares its core with general statistics.",
        tags: ["biostatistics"],
        xref: ["statistics"],
      },
      {
        name: "Confidence intervals for measures",
        description: "Uncertainty around a rate or ratio.",
        definition: "E.g. a 95% CI for $\\ln(\\text{RR})$ is $\\ln \\widehat{\\text{RR}} \\pm 1.96 \\times \\text{SE}$, exponentiated.",
        interpretation: "A CI excluding 1 (for a ratio) signals statistical significance at that level.",
        tags: ["biostatistics"],
        xref: ["statistics"],
      },
      {
        name: "Hypothesis testing & p-values",
        description: "Weighing evidence against a null.",
        principle:
          "Quantifies how surprising the data are under a null of no association; the $\\chi^2$ test for 2×2 tables is the epidemiologic workhorse.",
        interpretation: "Significance is not importance; magnitude and CI matter more.",
        tags: ["biostatistics"],
        xref: ["statistics"],
      },
      {
        name: "Chi-square & Fisher's exact test",
        description: "Association in contingency tables.",
        definition: "$\\chi^2 = \\sum \\dfrac{(O-E)^2}{E}$; Fisher's exact is used for small cells.",
        tags: ["biostatistics"],
        xref: ["statistics"],
      },
      {
        name: "Logistic regression",
        description: "Modeling binary outcomes.",
        definition: "$\\operatorname{logit} p = \\ln\\dfrac{p}{1-p} = \\beta_0 + \\sum \\beta_j x_j$; $e^{\\beta_j}$ is an adjusted odds ratio.",
        interpretation: "The standard tool for case-control and cross-sectional data.",
        tags: ["biostatistics"],
        xref: ["statistics"],
      },
      {
        name: "Poisson & negative-binomial regression",
        description: "Modeling rates and counts.",
        definition: "$\\ln E[Y] = \\ln(\\text{person-time}) + \\beta_0 + \\sum \\beta_j x_j$; $e^{\\beta_j}$ is a rate ratio.",
        interpretation: "The model for incidence-rate data (offset = person-time).",
        tags: ["biostatistics"],
        xref: ["statistics"],
      },
      {
        name: "Survival analysis (Kaplan-Meier & Cox)",
        description: "Time-to-event with censoring.",
        definition: "KM estimates $S(t)$ nonparametrically; Cox models $h(t) = h_0(t)\\,e^{\\sum \\beta_j x_j}$, giving hazard ratios.",
        interpretation: "Handles incomplete follow-up (censoring).",
        tags: ["biostatistics"],
        xref: ["statistics"],
      },
      {
        name: "Life tables",
        description: "Survival accounting by age.",
        principle:
          "Tabulate survival, deaths, and person-years by age interval to derive life expectancy and standardized survival; the actuarial backbone of demography.",
        tags: ["biostatistics", "demography"],
      },
      {
        name: "Sample-size & power calculation",
        description: "Sizing a study to detect an effect.",
        definition: "Power $= 1-\\beta$; required $n$ grows with variance and smaller detectable effect, and falls with larger $\\alpha$.",
        interpretation: "Underpowered studies waste resources and mislead.",
        tags: ["biostatistics"],
        xref: ["statistics"],
      },
      {
        name: "Meta-analysis & systematic review",
        description: "Synthesizing many studies.",
        principle:
          "Pool effect estimates across studies (fixed or random effects), quantify heterogeneity ($I^2$), and probe publication bias; the top of the evidence hierarchy for a question.",
        tags: ["biostatistics"],
        xref: ["statistics"],
      },
      {
        name: "Hierarchy of evidence",
        description: "Ranking study designs by internal validity.",
        principle:
          "From case reports → observational studies → RCTs → systematic reviews and meta-analyses; higher tiers better control bias, though fit-for-purpose matters more than rank.",
        tags: ["biostatistics", "evaluation"],
      },
      {
        name: "Multilevel / hierarchical models",
        description: "Nested health data.",
        principle:
          "Patients within clinics within regions violate independence; random-effects models partition variance across levels and borrow strength.",
        tags: ["biostatistics"],
        xref: ["statistics"],
      },
    ],
  },

  // ── Family 18 ─────────────────────────────────────────────────────────────
  {
    slug: "health-systems-policy",
    number: 18,
    name: "Health Systems, Policy & Economics",
    blurb: "The organized machinery that delivers care and acts on determinants, and the economic and policy levers on it.",
    section: "F",
    color: "violet",
    dataSource: "WHO GHO health-system indicators; OECD Health Statistics; cost-effectiveness league tables; aggregate FAERS/openFDA signals.",
    entries: [
      {
        name: "Health systems",
        description: "The organized machinery of health.",
        principle:
          "The people, institutions, and resources that deliver health services and act on determinants; WHO frames them by building blocks (service delivery, workforce, information, products, financing, governance).",
        dataSource: "WHO GHO health-system indicators.",
        tags: ["systems"],
        xref: ["governance"],
      },
      {
        name: "Universal health coverage (UHC)",
        description: "Access without financial ruin.",
        principle:
          "All people obtain needed quality health services without suffering financial hardship — a central global health-policy goal (SDG 3.8).",
        tags: ["systems", "global"],
      },
      {
        name: "Health-financing models",
        description: "How care is paid for.",
        principle:
          "Systems combine tax-funded (Beveridge), social-insurance (Bismarck), national-insurance, and out-of-pocket financing; the mix shapes equity and risk protection.",
        tags: ["systems", "economics"],
      },
      {
        name: "Cost-effectiveness analysis",
        description: "Value for money in health.",
        definition: "$\\text{ICER} = \\dfrac{C_1 - C_0}{E_1 - E_0}$, cost per unit of health gained (often per QALY or DALY averted).",
        interpretation: "Compared against a willingness-to-pay threshold.",
        tags: ["economics"],
        xref: ["economics"],
      },
      {
        name: "Cost-utility & cost-benefit analysis",
        description: "Weighing costs against outcomes.",
        principle:
          "Cost-utility measures outcomes in QALYs/DALYs; cost-benefit monetizes them; both inform allocation under scarcity.",
        tags: ["economics"],
        xref: ["economics"],
      },
      {
        name: "Health impact assessment",
        description: "Anticipating a policy's health effects.",
        principle:
          "A structured appraisal of the potential population health consequences (and their distribution) of a non-health policy or project before adoption.",
        tags: ["policy"],
      },
      {
        name: "Prevention paradox",
        description: "Population vs high-risk strategy.",
        principle:
          "A preventive measure bringing large benefit to the population may offer little to each participating individual, weakening motivation — Geoffrey Rose's central insight.",
        tags: ["policy", "prevention"],
      },
      {
        name: "Rose's population strategy",
        description: "Shift the whole distribution.",
        principle:
          "A small downward shift in a risk-factor distribution across everyone can prevent more disease than treating only the high-risk tail, because most cases arise from the many at modest risk.",
        tags: ["policy", "prevention"],
      },
      {
        name: "Health-in-all-policies",
        description: "Health beyond the health sector.",
        principle:
          "Because determinants lie largely outside health care, transport, housing, agriculture, and education policy should account for health impacts.",
        tags: ["policy"],
        xref: ["governance"],
      },
      {
        name: "Regulation, taxation & nudges",
        description: "Policy levers on behavior.",
        principle:
          "Taxes (tobacco, alcohol, sugar), bans, defaults, and information shape population exposure.",
        principalCritiques:
          "The coerciveness and effectiveness of these tools are contested. Proponents cite large reductions in smoking, alcohol harm, and sugar consumption from targeted taxes and defaults; opponents point to regressivity (sin taxes fall on lower-income households), paternalism concerns, and disputed elasticities. Adjudication of any specific tax or ban lives here, not in the card voice.",
        tags: ["policy"],
        xref: ["economics"],
      },
      {
        name: "Pharmacovigilance & post-market surveillance",
        description: "Watching drugs in populations.",
        principle:
          "Aggregate spontaneous-report analysis (disproportionality signals) detects rare adverse drug effects after approval, at the population and signal level.",
        dataSource: "FAERS/openFDA aggregate signals (not individual case reports).",
        tags: ["policy"],
        xref: ["pharmacology"],
      },
      {
        name: "Program evaluation",
        description: "Did the intervention work.",
        principle:
          "Systematic assessment of a program's process (implementation) and outcome (effect) against objectives, using experimental or quasi-experimental designs.",
        tags: ["policy", "evaluation"],
      },
    ],
  },

  // ── Family 19 ─────────────────────────────────────────────────────────────
  {
    slug: "social-behavioral",
    number: 19,
    name: "Social & Behavioral Determinants",
    blurb: "The upstream conditions that produce the population patterns everything else measures.",
    section: "F",
    color: "violet",
    dataSource: "WHO GHO equity indicators; behavioral risk-factor surveillance surveys (e.g. BRFSS-family systems).",
    entries: [
      {
        name: "Social determinants of health",
        description: "The conditions in which people live.",
        principle:
          "Income, education, employment, housing, food security, and social environment shape health more than medical care; the upstream causes of population health patterns.",
        dataSource: "WHO GHO equity indicators.",
        tags: ["determinants"],
        xref: ["sociology"],
      },
      {
        name: "Socioeconomic gradient in health",
        description: "Health rises with status, step by step.",
        principle:
          "Health improves monotonically with socioeconomic position across the whole range, not just for the poorest — a robust, near-universal finding.",
        example: "The Whitehall studies.",
        tags: ["determinants"],
        xref: ["sociology"],
      },
      {
        name: "Fundamental cause theory",
        description: "Why disparities persist.",
        principle:
          "Socioeconomic status is a fundamental cause of disease because it commands flexible resources that reproduce health advantage even as specific mechanisms and diseases change.",
        tags: ["determinants"],
        xref: ["sociology"],
      },
      {
        name: "Health behavior theories",
        description: "Explaining and changing behavior.",
        principle:
          "The Health Belief Model, Theory of Planned Behavior, Transtheoretical (stages-of-change), and Social Cognitive Theory model why people adopt or resist health behaviors, guiding intervention design.",
        tags: ["behavioral"],
        xref: ["psychology"],
      },
      {
        name: "Social-ecological model",
        description: "Nested levels of influence.",
        principle:
          "Behavior is shaped at individual, interpersonal, community, organizational, and policy levels simultaneously; effective programs intervene at several.",
        tags: ["behavioral"],
      },
      {
        name: "Health literacy",
        description: "Capacity to use health information.",
        principle:
          "The ability to obtain, understand, and act on health information; a determinant of adherence, prevention uptake, and outcomes.",
        tags: ["behavioral"],
        xref: ["communication"],
      },
      {
        name: "Health promotion (Ottawa Charter)",
        description: "Enabling people to increase control over health.",
        principle:
          "Builds healthy public policy, supportive environments, community action, personal skills, and reoriented services — health promotion beyond disease prevention.",
        tags: ["behavioral"],
      },
      {
        name: "Diffusion of innovations",
        description: "How practices spread.",
        principle:
          "New health behaviors and technologies spread through a population in an adopter sequence (innovators → laggards) shaped by perceived advantage and social networks.",
        tags: ["behavioral"],
        xref: ["sociology"],
      },
      {
        name: "Stress, allostatic load & the life course",
        description: "Biology of social adversity.",
        principle:
          "Chronic stress from social conditions accumulates physiological wear and tear (allostatic load), a pathway linking disadvantage to disease.",
        tags: ["determinants"],
        xref: ["psychology"],
      },
      {
        name: "Behavioral risk-factor surveillance",
        description: "Monitoring what people do.",
        principle:
          "Population surveys track modifiable behaviors (smoking, diet, activity, drinking) to guide and evaluate prevention.",
        dataSource: "Behavioral risk-factor survey systems (e.g. BRFSS-family surveys).",
        tags: ["behavioral", "surveillance"],
      },
      {
        name: "Harm reduction",
        description: "Reducing damage without requiring abstinence.",
        principle:
          "Meets risky behavior where it is (needle exchange, naloxone, safe-consumption sites) to cut morbidity and mortality.",
        principalCritiques:
          "The balance of benefits and harms of harm-reduction programs is contested. Proponents cite reductions in HIV/HCV transmission, overdose deaths, and re-engagement with care; critics argue that particular implementations (e.g. supervised consumption sites, drug decriminalization) may signal permission, concentrate visible drug use, or displace treatment resources. The card describes the doctrine; evaluation of specific programs lives here.",
        tags: ["behavioral", "policy"],
      },
    ],
  },
];
