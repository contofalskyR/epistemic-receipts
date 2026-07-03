import type { Family } from "./types";

export const FAMILIES_1_7: Family[] = [
  // ── Family 1 ──────────────────────────────────────────────────────────────
  {
    slug: "foundations-epidemiology",
    number: 1,
    name: "Foundations of Epidemiology",
    blurb: "The frame of the field: distribution and determinants of disease in populations, not patients.",
    section: "A",
    color: "teal",
    entries: [
      {
        name: "Epidemiology",
        description: "The study of disease distribution and determinants in populations.",
        principle:
          "Examines the frequency, pattern, and causes of health states in defined populations to inform prevention and control — the basic science of public health, operating at the group level, not the bedside.",
        tags: ["foundations"],
      },
      {
        name: "Population vs individual (the public-health frame)",
        description: "The defining stance of the field.",
        principle:
          "Public health reasons about populations and rates; clinical medicine reasons about the individual patient. A risk factor can matter enormously for a population yet little for any one person, and vice versa.",
        tags: ["foundations"],
        xref: ["medicine"],
      },
      {
        name: "Determinants of health",
        description: "What shapes health beyond care.",
        principle:
          "Health is produced by genetics, behavior, environment, social/economic conditions, and health services; medical care is only one input, often not the largest.",
        tags: ["foundations"],
        xref: ["sociology"],
      },
      {
        name: "Levels of prevention",
        description: "Where an intervention acts.",
        principle:
          "Primary (prevent onset, e.g. vaccination), secondary (early detection, e.g. screening), tertiary (limit disability from established disease), and primordial (prevent the risk factors themselves).",
        tags: ["prevention"],
      },
      {
        name: "The epidemiologic triad",
        description: "Host, agent, environment.",
        principle:
          "Classical infectious-disease causation frames disease as the interaction of a susceptible host, a causative agent, and an enabling environment, linked by a vector or route.",
        tags: ["foundations", "infectious"],
      },
      {
        name: "Web of causation",
        description: "Multicausal chronic-disease model.",
        principle:
          "Most chronic disease arises from an interlocking network of causes rather than a single agent; intervening anywhere in the web can reduce risk.",
        tags: ["foundations", "chronic"],
      },
      {
        name: "Natural history of disease",
        description: "The timeline from health to outcome.",
        principle:
          "Susceptibility → subclinical (pathologic onset, detectable at screening) → clinical → resolution/disability/death; prevention levels map onto its stages.",
        tags: ["foundations"],
      },
      {
        name: "Endemic, epidemic, pandemic",
        description: "Levels of occurrence.",
        principle:
          "Endemic = usual baseline level in an area; epidemic/outbreak = occurrence clearly above expected; pandemic = an epidemic across many countries or continents.",
        tags: ["foundations", "surveillance"],
      },
      {
        name: "Population at risk",
        description: "The correct denominator.",
        principle:
          "Only those susceptible and capable of the outcome belong in the denominator of a rate; excluding the already-immune or already-diseased is essential to a valid measure.",
        tags: ["foundations", "measures"],
      },
      {
        name: "Person, place, time",
        description: "Descriptive epidemiology's axes.",
        principle:
          "Characterizing who is affected, where, and when generates hypotheses about cause and is the first step of any outbreak or surveillance analysis.",
        tags: ["foundations", "descriptive"],
      },
    ],
  },

  // ── Family 2 ──────────────────────────────────────────────────────────────
  {
    slug: "observational-designs",
    number: 2,
    name: "Observational Study Designs",
    blurb: "Designs that observe rather than intervene: cohort, case-control, cross-sectional, and their hybrids.",
    section: "A",
    color: "teal",
    entries: [
      {
        name: "Cohort study",
        description: "Follow exposed and unexposed forward.",
        principle:
          "Classify by exposure, then follow over time to compare incidence; yields incidence, risk, and rates directly. Prospective or retrospective.",
        example: "Framingham Heart Study.",
        tags: ["design"],
        xref: ["statistics"],
      },
      {
        name: "Case-control study",
        description: "Start from outcome, look back at exposure.",
        principle:
          "Sample cases and comparable controls, compare prior exposure odds; efficient for rare diseases and long latency; yields the odds ratio.",
        example: "Doll & Hill on smoking and lung cancer.",
        tags: ["design"],
        xref: ["statistics"],
      },
      {
        name: "Cross-sectional study",
        description: "A snapshot in time.",
        principle:
          "Measure exposure and outcome simultaneously in a sample; yields prevalence and associations but cannot fix temporality.",
        example: "NHANES.",
        tags: ["design"],
        xref: ["statistics"],
      },
      {
        name: "Ecological study",
        description: "Groups, not individuals, as the unit.",
        principle:
          "Correlate exposure and outcome at the population level (countries, regions); cheap and hypothesis-generating but prone to the ecological fallacy.",
        tags: ["design"],
        xref: ["statistics"],
      },
      {
        name: "Nested case-control study",
        description: "Case-control inside a cohort.",
        principle:
          "Sample controls from the cohort's risk sets at each case's event time; retains cohort validity at lower measurement cost.",
        tags: ["design"],
        xref: ["statistics"],
      },
      {
        name: "Case-cohort study",
        description: "Subcohort plus all cases.",
        principle:
          "Compare all cases to a random subcohort baseline sample; one control group serves multiple outcomes.",
        tags: ["design"],
        xref: ["statistics"],
      },
      {
        name: "Case-crossover study",
        description: "Each case is its own control.",
        principle:
          "Compare exposure in a hazard window just before an acute event to the same person's control windows; removes fixed confounders.",
        example: "Air-pollution triggers of MI.",
        tags: ["design"],
      },
      {
        name: "Longitudinal / panel study",
        description: "Repeated measures on the same people.",
        principle:
          "Follow a cohort with repeated waves to model within-person change and trajectories over the life course.",
        tags: ["design"],
        xref: ["statistics"],
      },
      {
        name: "Case series & case reports",
        description: "Descriptive accounts without controls.",
        principle:
          "Describe a set of patients sharing a feature; no comparison group, so hypothesis-generating only.",
        example: "The 1981 cluster that opened HIV/AIDS.",
        tags: ["design"],
      },
      {
        name: "Serial cross-sectional (repeated surveys)",
        description: "Trends from independent snapshots.",
        principle:
          "Repeat a cross-section on fresh samples over time to track population-level trends (not individual change).",
        example: "Successive NHANES cycles.",
        tags: ["design"],
      },
    ],
  },

  // ── Family 3 ──────────────────────────────────────────────────────────────
  {
    slug: "experimental-designs",
    number: 3,
    name: "Experimental & Intervention Designs",
    blurb: "When we can allocate exposure ourselves: trials from bedside to community.",
    section: "A",
    color: "teal",
    entries: [
      {
        name: "Randomized controlled trial (RCT)",
        description: "The experimental gold standard.",
        principle:
          "Randomly allocate participants to intervention vs control so that, on average, confounders balance; the strongest design for causal effect of an intervention.",
        tags: ["design"],
        xref: ["statistics"],
      },
      {
        name: "Cluster-randomized trial",
        description: "Randomize groups, not individuals.",
        principle:
          "Allocate whole clusters (clinics, villages, schools) to arms when the intervention is delivered at group level or contamination is a risk; analysis must account for intracluster correlation.",
        tags: ["design"],
        xref: ["statistics"],
      },
      {
        name: "Field trial",
        description: "RCT of prevention in healthy people.",
        principle:
          "Enrol not-yet-diseased participants in the community to test a preventive (e.g. a vaccine or nutrient); large samples for rare outcomes.",
        example: "The 1954 Salk polio vaccine field trial.",
        tags: ["design", "prevention"],
      },
      {
        name: "Community intervention trial",
        description: "Whole communities as units.",
        principle:
          "Deliver and evaluate an intervention across entire communities; the ecological analogue of a field trial.",
        example: "Community water-fluoridation trials.",
        tags: ["design"],
      },
      {
        name: "Stepped-wedge design",
        description: "Roll out to all clusters in random order.",
        principle:
          "Every cluster eventually receives the intervention, crossing over at randomly assigned times; ethical when withholding a promising program is hard.",
        tags: ["design"],
        xref: ["statistics"],
      },
      {
        name: "Pragmatic vs explanatory trial",
        description: "Real-world vs ideal-conditions.",
        principle:
          "Explanatory trials test efficacy under tightly controlled conditions; pragmatic trials test effectiveness in routine practice with broad eligibility.",
        tags: ["design"],
        xref: ["statistics"],
      },
      {
        name: "Efficacy vs effectiveness",
        description: "Can it work vs does it work.",
        principle:
          "Efficacy is the effect under ideal/trial conditions; effectiveness is the effect in ordinary practice; the gap reflects adherence, access, and real-world heterogeneity.",
        tags: ["evaluation"],
      },
      {
        name: "Intention-to-treat vs per-protocol",
        description: "Two analysis populations.",
        principle:
          "ITT analyzes everyone as randomized (preserving randomization, estimating real-world policy effect); per-protocol analyzes only compliant participants (estimating biological effect, but re-introducing confounding).",
        tags: ["analysis"],
        xref: ["statistics"],
      },
      {
        name: "Blinding & allocation concealment",
        description: "Guarding against bias.",
        principle:
          "Concealing the upcoming allocation prevents selection bias at enrolment; blinding participants and assessors prevents performance and detection bias afterward.",
        tags: ["design"],
      },
      {
        name: "Number needed to treat (NNT)",
        description: "Clinical yield of an intervention.",
        definition: "$\\text{NNT} = \\dfrac{1}{\\text{ARR}}$, the reciprocal of the absolute risk reduction.",
        interpretation: "NNT = 20 ⇒ treat 20 people to prevent one event.",
        example: "NNH is the harm analogue.",
        tags: ["evaluation"],
      },
    ],
  },

  // ── Family 4 ──────────────────────────────────────────────────────────────
  {
    slug: "bias-confounding-validity",
    number: 4,
    name: "Bias, Confounding & Validity",
    blurb: "The systematic errors that can survive study design, and the frame for judging what a result means.",
    section: "A",
    color: "teal",
    entries: [
      {
        name: "Internal vs external validity",
        description: "Correct here vs generalizable.",
        principle:
          "Internal validity = the study estimates the truth in its own sample (free of bias and confounding); external validity = that result transports to other populations.",
        tags: ["validity"],
      },
      {
        name: "Selection bias",
        description: "Distortion from who gets in or stays.",
        principle:
          "Systematic error when study entry or retention depends jointly on exposure and outcome, so the sample misrepresents the target relationship.",
        example: "Healthy-worker effect; loss to follow-up.",
        tags: ["bias"],
      },
      {
        name: "Information (measurement) bias",
        description: "Distortion from how data are collected.",
        principle:
          "Systematic error in classifying exposure or outcome; misclassification may be non-differential (usually biases toward the null) or differential (biases either way).",
        tags: ["bias"],
      },
      {
        name: "Recall bias",
        description: "Differential memory of exposure.",
        principle:
          "Cases recall past exposures more (or less) completely than controls, distorting case-control associations.",
        tags: ["bias"],
      },
      {
        name: "Confounding",
        description: "A third factor mixing the effect.",
        principle:
          "A variable associated with the exposure and an independent cause of the outcome, not on the causal pathway, biases the crude association.",
        interpretation: "Control by restriction, matching, stratification, or regression.",
        tags: ["confounding"],
        xref: ["statistics"],
      },
      {
        name: "Effect modification / interaction",
        description: "The effect differs across a third variable.",
        principle:
          "The exposure–outcome association genuinely varies by a stratifying factor; unlike confounding it is a finding to report, not a bias to remove.",
        example: "A drug effect that differs by age.",
        tags: ["confounding"],
      },
      {
        name: "Collider bias",
        description: "Conditioning on a common effect.",
        principle:
          "Adjusting for or selecting on a variable caused by both exposure and outcome opens a spurious path between them.",
        example: "Selection into a hospital sample (Berkson's bias).",
        tags: ["bias"],
        xref: ["statistics"],
      },
      {
        name: "Lead-time & length-time bias",
        description: "Screening's illusions of benefit.",
        principle:
          "Lead-time bias makes earlier detection look like longer survival without delaying death; length-time bias oversamples slow, indolent cases at screening.",
        tags: ["bias", "screening"],
      },
      {
        name: "Immortal time bias",
        description: "Misclassified survival time.",
        principle:
          "A period during which the outcome could not occur (by design) is wrongly attributed to a treatment group, spuriously favoring it.",
        tags: ["bias"],
      },
      {
        name: "Ecological fallacy",
        description: "Group associations don't imply individual ones.",
        principle:
          "A correlation observed at the population level need not hold for individuals within it.",
        tags: ["bias"],
      },
      {
        name: "Healthy-worker effect",
        description: "Employed populations are healthier.",
        principle:
          "Workers are systematically healthier than the general population, biasing occupational cohort comparisons toward the null.",
        tags: ["bias", "occupational"],
      },
      {
        name: "Confounding by indication",
        description: "The reason for treatment confounds it.",
        principle:
          "In observational drug studies, the clinical indication that prompted treatment also predicts the outcome, mimicking a treatment effect.",
        tags: ["confounding"],
        xref: ["pharmacology"],
      },
    ],
  },

  // ── Family 5 ──────────────────────────────────────────────────────────────
  {
    slug: "causal-inference",
    number: 5,
    name: "Causal Inference in Epidemiology",
    blurb: "The frameworks and tools that turn association into a causal claim: counterfactuals, DAGs, natural experiments.",
    section: "A",
    color: "teal",
    entries: [
      {
        name: "Bradford Hill considerations",
        description: "A checklist for causation from association.",
        principle:
          "Strength, consistency, specificity, temporality, biological gradient, plausibility, coherence, experiment, analogy — viewpoints (not a scoring rubric) for judging whether an association is causal.",
        tags: ["causal"],
      },
      {
        name: "Counterfactual framework",
        description: "Causation as a contrast of possible worlds.",
        principle:
          "The causal effect for a unit is the difference between its outcome under exposure and under non-exposure; only one is observed (the fundamental problem of causal inference).",
        tags: ["causal"],
        xref: ["statistics"],
      },
      {
        name: "Potential outcomes & the average treatment effect",
        description: "Formalizing the contrast.",
        definition: "$\\text{ATE} = E[Y^{1} - Y^{0}]$, the mean difference between potential outcomes under treatment and control.",
        tags: ["causal"],
        xref: ["statistics"],
      },
      {
        name: "Directed acyclic graphs (DAGs)",
        description: "Drawing the causal structure.",
        principle:
          "Nodes are variables, arrows are direct causal effects; the graph identifies which variables to adjust for (to block back-door paths) and which to leave alone (colliders and mediators).",
        tags: ["causal"],
        xref: ["statistics"],
      },
      {
        name: "Confounder control (adjustment)",
        description: "Removing a mixing effect.",
        principle:
          "Stratification, matching, multivariable regression, or standardization estimate the exposure effect within levels of the confounder; valid only for measured confounders.",
        tags: ["causal"],
        xref: ["statistics"],
      },
      {
        name: "Propensity score methods",
        description: "Balancing on the probability of exposure.",
        definition: "$e(x) = P(\\text{exposed} \\mid X = x)$; match, weight, or stratify on $e(x)$ to balance measured confounders.",
        tags: ["causal"],
        xref: ["statistics"],
      },
      {
        name: "Instrumental variables",
        description: "A natural experiment as a lever.",
        principle:
          "A variable that affects the outcome only through the exposure (e.g. a policy, a genetic variant) can identify the effect despite unmeasured confounding.",
        example: "Mendelian randomization.",
        tags: ["causal"],
        xref: ["statistics"],
      },
      {
        name: "Mendelian randomization",
        description: "Genes as instruments.",
        principle:
          "Germline genotype, randomized at conception and fixed before disease, serves as an instrument for a modifiable exposure, mitigating confounding and reverse causation.",
        tags: ["causal"],
        xref: ["statistics"],
      },
      {
        name: "Difference-in-differences",
        description: "Compare trends across a policy change.",
        principle:
          "Contrast the before-after change in a treated group with the change in a control group, differencing out fixed group effects and common trends.",
        example: "Evaluating a state health law.",
        tags: ["causal"],
        xref: ["statistics"],
      },
      {
        name: "Regression discontinuity",
        description: "Effect at a threshold.",
        principle:
          "When treatment switches at a cutoff of a running variable, units just above and below are comparable, identifying a local effect.",
        tags: ["causal"],
        xref: ["statistics"],
      },
      {
        name: "Sufficient-component-cause model",
        description: "Causal pies.",
        principle:
          "A disease results when a sufficient cause (a complete pie of component causes) is met; a necessary component appears in every pie; most components are neither necessary nor sufficient alone.",
        tags: ["causal"],
      },
      {
        name: "Reverse causation",
        description: "The arrow may point the other way.",
        principle:
          "A cross-sectional or observational association may arise because early disease alters the exposure, not the exposure the disease.",
        tags: ["causal"],
      },
    ],
  },

  // ── Family 6 ──────────────────────────────────────────────────────────────
  {
    slug: "measures-frequency",
    number: 6,
    name: "Measures of Disease Frequency",
    blurb: "How much disease: the quantitative core, in incidence, prevalence, and mortality.",
    section: "B",
    color: "blue",
    dataSource: "WHO GHO indicators; GBD cause estimates; national vital-registration systems.",
    entries: [
      {
        name: "Incidence proportion (cumulative incidence / risk)",
        description: "Probability of new disease over a period.",
        definition: "$\\text{CI} = \\dfrac{\\text{new cases during period}}{\\text{population at risk at start}}$.",
        interpretation: "A risk between 0 and 1 over a stated interval.",
        tags: ["frequency"],
      },
      {
        name: "Incidence rate (incidence density)",
        description: "New cases per unit person-time.",
        definition: "$\\text{IR} = \\dfrac{\\text{new cases}}{\\text{total person-time at risk}}$.",
        interpretation: "Has units of per person-year; handles varying follow-up and dynamic populations.",
        tags: ["frequency"],
      },
      {
        name: "Person-time",
        description: "The denominator for rates.",
        definition: "$\\text{PT} = \\sum_i t_i$, the sum over individuals of time each remained at risk.",
        example: "100 people followed 2 years = 200 person-years.",
        tags: ["frequency"],
      },
      {
        name: "Prevalence (point)",
        description: "Existing cases at a moment.",
        definition: "$P = \\dfrac{\\text{existing cases}}{\\text{total population}}$ at a point in time.",
        interpretation: "A proportion; reflects both incidence and duration.",
        tags: ["frequency"],
      },
      {
        name: "Period prevalence",
        description: "Cases over an interval.",
        definition: "$P_{\\text{period}} = \\dfrac{\\text{cases present at any time in the interval}}{\\text{population}}$.",
        tags: ["frequency"],
      },
      {
        name: "Incidence-prevalence-duration relation",
        description: "How the three connect.",
        definition: "In steady state, $P \\approx I \\times \\bar{D}$ (for small $P$), where $\\bar{D}$ is mean disease duration.",
        interpretation: "A chronic disease can have high prevalence from long duration even at low incidence.",
        tags: ["frequency"],
      },
      {
        name: "Attack rate",
        description: "Cumulative incidence in an outbreak.",
        definition: "$\\text{AR} = \\dfrac{\\text{cases}}{\\text{population at risk}}$ over the outbreak period.",
        example: "Foodborne outbreak attack rate by dish eaten.",
        tags: ["frequency", "outbreak"],
      },
      {
        name: "Secondary attack rate",
        description: "Spread among contacts.",
        definition: "$\\text{SAR} = \\dfrac{\\text{new cases among contacts}}{\\text{susceptible contacts}}$.",
        interpretation: "Measures transmissibility within households and close contacts.",
        tags: ["frequency", "infectious"],
      },
      {
        name: "Crude mortality rate",
        description: "Deaths per population.",
        definition: "$\\text{CMR} = \\dfrac{\\text{deaths in period}}{\\text{mid-period population}}$, usually per 10^(5) per year.",
        tags: ["mortality"],
      },
      {
        name: "Cause-specific mortality rate",
        description: "Deaths from one cause.",
        definition: "$\\dfrac{\\text{deaths from cause } X}{\\text{population}}$, per 10^(5) per year.",
        dataSource: "GBD / ICD-11-coded death registration.",
        tags: ["mortality"],
      },
      {
        name: "Case fatality rate (CFR)",
        description: "Lethality among cases.",
        definition: "$\\text{CFR} = \\dfrac{\\text{deaths from disease}}{\\text{diagnosed cases}}$.",
        interpretation: "A proportion of cases who die; distinct from the infection fatality rate.",
        tags: ["mortality", "infectious"],
      },
      {
        name: "Infection fatality rate (IFR)",
        description: "Lethality among all infected.",
        definition: "$\\text{IFR} = \\dfrac{\\text{deaths}}{\\text{all infected (incl. undetected)}}$.",
        interpretation: "Lower than CFR because the denominator includes asymptomatic and undiagnosed infections.",
        tags: ["mortality", "infectious"],
      },
      {
        name: "Proportional mortality",
        description: "Share of deaths from a cause.",
        definition: "$\\text{PMR}_{\\text{prop}} = \\dfrac{\\text{deaths from cause } X}{\\text{all deaths}} \\times 100\\%$.",
        interpretation: "A proportion, not a rate — cannot show absolute risk.",
        tags: ["mortality"],
      },
      {
        name: "Infant & maternal mortality",
        description: "Bellwether population indicators.",
        definition: "IMR $= \\dfrac{\\text{deaths} < 1\\text{ yr}}{\\text{live births}} \\times 1000$; MMR $= \\dfrac{\\text{maternal deaths}}{\\text{live births}} \\times 10^{5}$.",
        dataSource: "WHO GHO.",
        tags: ["mortality", "global"],
      },
      {
        name: "Years of potential life lost (YPLL)",
        description: "Weighting premature death.",
        definition: "$\\text{YPLL} = \\sum (\\text{reference age} - \\text{age at death})$ over deaths below the reference age.",
        interpretation: "Upweights deaths that occur young.",
        tags: ["burden"],
      },
      {
        name: "Birth & fertility rates",
        description: "Population renewal measures.",
        definition: "Crude birth rate $= \\dfrac{\\text{live births}}{\\text{population}} \\times 1000$; general fertility rate uses women 15-49 as the denominator.",
        tags: ["demography"],
      },
    ],
  },

  // ── Family 7 ──────────────────────────────────────────────────────────────
  {
    slug: "measures-association",
    number: 7,
    name: "Measures of Association & Impact",
    blurb: "How strongly exposure and disease are linked, and how much of the burden is attributable.",
    section: "B",
    color: "blue",
    dataSource: "GBD risk-factor attribution; effect measures from the study designs above.",
    entries: [
      {
        name: "Risk ratio (relative risk, RR)",
        description: "Ratio of risks between groups.",
        definition: "$\\text{RR} = \\dfrac{\\text{CI}_{\\text{exposed}}}{\\text{CI}_{\\text{unexposed}}}$.",
        interpretation: "RR = 2 ⇒ exposed have twice the risk; RR = 1 ⇒ no association.",
        tags: ["association"],
      },
      {
        name: "Rate ratio",
        description: "Ratio of incidence rates.",
        definition: "$\\text{IRR} = \\dfrac{\\text{IR}_{\\text{exposed}}}{\\text{IR}_{\\text{unexposed}}}$.",
        interpretation: "The person-time analogue of the risk ratio.",
        tags: ["association"],
      },
      {
        name: "Odds ratio (OR)",
        description: "Ratio of odds, from the 2×2 table.",
        definition: "$\\text{OR} = \\dfrac{a\\,d}{b\\,c}$ for exposure/disease cells $a,b,c,d$.",
        interpretation: "Approximates RR when disease is rare; the native measure of case-control studies.",
        tags: ["association"],
      },
      {
        name: "The 2x2 table",
        description: "The scaffold for association measures.",
        definition: "Cells $a$ (exposed cases), $b$ (exposed non-cases), $c$ (unexposed cases), $d$ (unexposed non-cases) yield RR, OR, and attributable measures.",
        tags: ["association"],
      },
      {
        name: "Hazard ratio (HR)",
        description: "Ratio of instantaneous event rates.",
        definition: "$\\text{HR} = \\dfrac{h_1(t)}{h_0(t)}$, the ratio of hazard functions, estimated by Cox regression.",
        interpretation: "The survival-analysis effect measure.",
        tags: ["association"],
        xref: ["statistics"],
      },
      {
        name: "Attributable risk (risk difference)",
        description: "Excess risk in the exposed.",
        definition: "$\\text{AR} = \\text{CI}_{\\text{exposed}} - \\text{CI}_{\\text{unexposed}}$.",
        interpretation: "The absolute excess attributable to exposure among the exposed.",
        tags: ["impact"],
      },
      {
        name: "Attributable risk percent",
        description: "Share of the exposed's risk due to exposure.",
        definition: "$\\text{AR}\\% = \\dfrac{\\text{RR}-1}{\\text{RR}} \\times 100\\%$.",
        interpretation: "Fraction of disease in the exposed that exposure explains.",
        tags: ["impact"],
      },
      {
        name: "Population attributable risk (PAR)",
        description: "Excess risk in the whole population.",
        definition: "$\\text{PAR} = \\text{CI}_{\\text{total}} - \\text{CI}_{\\text{unexposed}}$.",
        interpretation: "How much of the population's risk exposure adds, given exposure prevalence.",
        tags: ["impact"],
      },
      {
        name: "Population attributable fraction (PAF)",
        description: "Share of population disease preventable.",
        definition: "$\\text{PAF} = \\dfrac{p(\\text{RR}-1)}{1 + p(\\text{RR}-1)}$, with $p$ the exposure prevalence.",
        interpretation: "The fraction of cases removable if exposure were eliminated — a core policy number.",
        dataSource: "GBD risk-factor attribution.",
        tags: ["impact"],
      },
      {
        name: "Preventable fraction",
        description: "Benefit of a protective exposure.",
        definition: "$\\text{PF} = \\dfrac{\\text{CI}_{\\text{unexposed}} - \\text{CI}_{\\text{exposed}}}{\\text{CI}_{\\text{unexposed}}} = 1 - \\text{RR}$.",
        example: "The fraction of cases a vaccine prevents.",
        tags: ["impact"],
      },
      {
        name: "Relative & absolute risk reduction",
        description: "Two framings of benefit.",
        definition: "$\\text{ARR} = \\text{CI}_{\\text{control}} - \\text{CI}_{\\text{treated}}$; $\\text{RRR} = \\text{ARR}/\\text{CI}_{\\text{control}}$.",
        interpretation: "The same effect looks larger as RRR than as ARR; report both.",
        tags: ["impact"],
      },
      {
        name: "Vaccine efficacy / effectiveness",
        description: "Protection conferred by vaccination.",
        definition: "$\\text{VE} = (1 - \\text{RR}) \\times 100\\% = \\dfrac{\\text{ARU} - \\text{ARV}}{\\text{ARU}} \\times 100\\%$ (attack rate unvaccinated vs vaccinated).",
        interpretation: "VE = 90% ⇒ 90% fewer cases than expected without vaccine.",
        tags: ["impact", "infectious"],
      },
    ],
  },
];
