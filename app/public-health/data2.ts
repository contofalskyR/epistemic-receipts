import type { Family } from "./types";

export const FAMILIES_8_13: Family[] = [
  // ── Family 8 ──────────────────────────────────────────────────────────────
  {
    slug: "standardization",
    number: 8,
    name: "Standardization & Rate Adjustment",
    blurb: "Making rates comparable across populations with different age (and other) structures.",
    section: "B",
    color: "blue",
    dataSource: "GBD and WHO GHO report age-standardized rates by default; census age structures as weights.",
    entries: [
      {
        name: "Crude vs adjusted rates",
        description: "Raw vs comparable.",
        principle:
          "Crude rates reflect a population's actual burden but confound comparisons through differing age structures; adjusted rates remove that structural difference.",
        tags: ["standardization"],
      },
      {
        name: "Direct standardization",
        description: "Apply observed rates to a standard population.",
        definition: "$\\text{ASR} = \\dfrac{\\sum_i w_i \\, r_i}{\\sum_i w_i}$, weighting stratum-specific rates $r_i$ by a standard population's weights $w_i$.",
        interpretation: "The rate the study population would have with the standard's age distribution.",
        tags: ["standardization"],
      },
      {
        name: "Indirect standardization & the SMR",
        description: "Apply standard rates to the observed structure.",
        definition: "$\\text{SMR} = \\dfrac{\\text{observed deaths}}{\\text{expected deaths}}$, where expected applies standard age-specific rates to the study's population.",
        interpretation: "SMR > 1 ⇒ more deaths than the standard predicts.",
        tags: ["standardization", "occupational"],
      },
      {
        name: "Age-standardized rate",
        description: "The workhorse comparison.",
        principle:
          "The most common standardized measure; lets us compare disease burden across regions or eras despite different age profiles.",
        dataSource: "GBD and WHO report age-standardized rates by default.",
        tags: ["standardization"],
      },
      {
        name: "Standard population",
        description: "The common yardstick.",
        principle:
          "A reference age distribution (WHO World Standard, Segi world, US 2000) applied to all groups so that standardized rates are mutually comparable — but the choice of standard shifts the numbers.",
        tags: ["standardization"],
      },
      {
        name: "Proportionate mortality ratio (PMR)",
        description: "Adjusted proportional mortality.",
        definition: "The ratio of observed to expected proportional mortality for a cause; used when person-time denominators are unavailable.",
        tags: ["standardization", "occupational"],
      },
    ],
  },

  // ── Family 9 ──────────────────────────────────────────────────────────────
  {
    slug: "screening-metrics",
    number: 9,
    name: "Screening, Diagnostic Testing & Surveillance Metrics",
    blurb: "The performance calculus of tests and surveillance systems: what a positive means, and how good the system is.",
    section: "B",
    color: "blue",
    dataSource: "Test-performance studies; surveillance-system evaluations (e.g. CDC's Updated Guidelines).",
    entries: [
      {
        name: "Sensitivity",
        description: "Detecting true cases.",
        definition: "$\\text{Se} = \\dfrac{\\text{TP}}{\\text{TP} + \\text{FN}}$.",
        interpretation: "The probability a diseased person tests positive; a sensitive test rules out disease when negative (SnNout).",
        tags: ["screening"],
        xref: ["statistics"],
      },
      {
        name: "Specificity",
        description: "Correctly clearing the healthy.",
        definition: "$\\text{Sp} = \\dfrac{\\text{TN}}{\\text{TN} + \\text{FP}}$.",
        interpretation: "The probability a non-diseased person tests negative; a specific test rules in disease when positive (SpPin).",
        tags: ["screening"],
        xref: ["statistics"],
      },
      {
        name: "Positive & negative predictive value",
        description: "What a result means for a person.",
        definition: "$\\text{PPV} = \\dfrac{\\text{TP}}{\\text{TP}+\\text{FP}}$, $\\text{NPV} = \\dfrac{\\text{TN}}{\\text{TN}+\\text{FN}}$.",
        interpretation: "PPV falls as prevalence falls, even for a fixed test.",
        tags: ["screening"],
        xref: ["statistics"],
      },
      {
        name: "Likelihood ratios",
        description: "How a result shifts the odds.",
        definition: "$\\text{LR}^{+} = \\dfrac{\\text{Se}}{1-\\text{Sp}}$, $\\text{LR}^{-} = \\dfrac{1-\\text{Se}}{\\text{Sp}}$.",
        interpretation: "Multiply pre-test odds by the LR to get post-test odds; prevalence-independent.",
        tags: ["screening"],
        xref: ["statistics"],
      },
      {
        name: "ROC curve & AUC",
        description: "Trading sensitivity against specificity.",
        definition: "Plot Se vs $1-\\text{Sp}$ across thresholds; AUC = probability a random case scores above a random non-case.",
        interpretation: "AUC = 0.5 is chance, 1.0 is perfect.",
        tags: ["screening"],
        xref: ["statistics"],
      },
      {
        name: "Youden's J",
        description: "A single-threshold summary.",
        definition: "$J = \\text{Se} + \\text{Sp} - 1$; the threshold maximizing $J$ balances the two errors.",
        tags: ["screening"],
        xref: ["statistics"],
      },
      {
        name: "Screening program criteria (Wilson-Jungner)",
        description: "When to screen a population.",
        principle:
          "Screen only when the condition is important, has a detectable early stage and an accepted treatment, the test is acceptable and accurate, and the program does more good than harm at acceptable cost.",
        principalCritiques:
          "Aggressive lowering of screening thresholds (e.g. some cancer or metabolic screens) is contested: proponents argue earlier detection saves lives; critics point to overdiagnosis, false-positive cascades, and net harm at low prevalence. The Wilson-Jungner test is meant to keep the calculus explicit, not to decide it.",
        tags: ["screening"],
      },
      {
        name: "Overdiagnosis",
        description: "Detecting disease that would never have harmed.",
        principle:
          "Screening can find indolent lesions that would never have progressed, leading to treatment (and its harms) without benefit — a core critique of aggressive screening.",
        principalCritiques:
          "Overdiagnosis is empirically hard to quantify (the counterfactual is unobserved). Debate persists over the size of the effect in mammography, PSA screening, and thyroid-cancer detection; opponents of screening cite it, proponents dispute its magnitude.",
        tags: ["screening"],
      },
      {
        name: "Case definition",
        description: "The rule for who counts.",
        principle:
          "Explicit clinical/lab/epidemiologic criteria (often tiered suspected/probable/confirmed) that standardize case counting across time and place; changing it changes the curve.",
        tags: ["surveillance"],
      },
      {
        name: "Sensitivity & timeliness of surveillance",
        description: "System performance metrics.",
        principle:
          "A surveillance system is judged on sensitivity (fraction of true cases captured), timeliness, representativeness, positive predictive value, and simplicity — trade-offs among them shape design.",
        tags: ["surveillance"],
      },
    ],
  },

  // ── Family 10 ─────────────────────────────────────────────────────────────
  {
    slug: "surveillance-systems",
    number: 10,
    name: "Surveillance Systems",
    blurb: "The information infrastructure of public health: data flows for action, not for archives.",
    section: "C",
    color: "amber",
    dataSource: "Notifiable-disease systems; WHO/IHR event reporting; syndromic surveillance feeds; ICD-11 for case coding.",
    entries: [
      {
        name: "Public health surveillance",
        description: "Ongoing systematic health-data collection for action.",
        principle:
          "The continuous collection, analysis, and dissemination of health data to guide prevention and control — information for action.",
        tags: ["surveillance"],
      },
      {
        name: "Passive vs active surveillance",
        description: "Who does the reporting.",
        principle:
          "Passive relies on providers and labs to report (cheap, timely, but under-reports); active has health authorities solicit cases (complete but resource-heavy).",
        tags: ["surveillance"],
      },
      {
        name: "Sentinel surveillance",
        description: "A few high-quality sites.",
        principle:
          "Selected reporting sites provide detailed, timely data to detect trends when full population coverage is impractical.",
        example: "Influenza sentinel networks.",
        tags: ["surveillance", "infectious"],
      },
      {
        name: "Syndromic surveillance",
        description: "Watching symptoms, not diagnoses.",
        principle:
          "Monitor pre-diagnostic signals (ED chief complaints, pharmacy sales, search trends) for early outbreak detection before lab confirmation.",
        tags: ["surveillance"],
      },
      {
        name: "Notifiable disease reporting",
        description: "Legally mandated case reports.",
        principle:
          "Statutes require clinicians and labs to report specified conditions to public health authorities, enabling response and national statistics.",
        dataSource: "National notifiable-disease systems.",
        tags: ["surveillance"],
      },
      {
        name: "Vital statistics & registries",
        description: "Births, deaths, and disease registers.",
        principle:
          "Civil registration (births/deaths, cause-of-death coded to ICD-11) and disease registries (cancer, birth defects) are the backbone of population health measurement.",
        dataSource: "Vital registration; cancer registries.",
        tags: ["surveillance"],
      },
      {
        name: "Vital registration & verbal autopsy",
        description: "Counting deaths where records are thin.",
        principle:
          "Where medical certification is incomplete, structured interviews with caregivers assign probable cause of death, feeding global mortality estimates.",
        dataSource: "GBD input data.",
        tags: ["surveillance", "global"],
      },
      {
        name: "International Health Regulations (IHR 2005)",
        description: "The global reporting treaty.",
        principle:
          "Legally binding rules obliging WHO member states to detect, assess, and report events that may constitute a public health emergency, and to build core surveillance and response capacities.",
        tags: ["surveillance", "global"],
        xref: ["governance"],
      },
      {
        name: "Public health emergency of international concern (PHEIC)",
        description: "The top alert.",
        principle:
          "An extraordinary event that (per the IHR) may spread internationally and require a coordinated response; declared by the WHO Director-General.",
        example:
          "As of 2026 the active PHEICs are polio (declared 2014, still standing), mpox (re-declared 14 Aug 2024), and Ebola disease due to Bundibugyo virus in DRC and Uganda (declared 17 May 2026); COVID-19's PHEIC ended 5 May 2023. Verify the current list at build time — this changes.",
        tags: ["surveillance", "global"],
      },
      {
        name: "Digital & genomic surveillance",
        description: "New data streams.",
        principle:
          "Pathogen genome sequencing (variant tracking), wastewater monitoring, and digital signals extend traditional case-based surveillance.",
        example: "SARS-CoV-2 variant and wastewater surveillance.",
        tags: ["surveillance", "infectious"],
      },
    ],
  },

  // ── Family 11 ─────────────────────────────────────────────────────────────
  {
    slug: "outbreak-investigation",
    number: 11,
    name: "Outbreak Investigation",
    blurb: "The systematic method for detecting, characterizing, and controlling an epidemic in real time.",
    section: "C",
    color: "amber",
    dataSource: "Line-list data during an outbreak; laboratory confirmation; environmental sampling.",
    entries: [
      {
        name: "Outbreak investigation steps",
        description: "The systematic response sequence.",
        principle:
          "Confirm the outbreak and diagnosis, establish a case definition, find cases, describe by person/place/time, generate and test hypotheses, implement control, and communicate — an ordered method, not a fixed order.",
        tags: ["outbreak"],
      },
      {
        name: "Epidemic curve (epi curve)",
        description: "Cases plotted over time.",
        principle:
          "A histogram of onset dates whose shape distinguishes a point-source (single sharp peak), continuous-common-source, or propagated (successive generations) outbreak and locates the likely exposure window.",
        tags: ["outbreak"],
      },
      {
        name: "Point-source vs propagated outbreak",
        description: "Reading the curve's shape.",
        principle:
          "A point source produces one incubation-period-wide peak; a propagated outbreak shows progressively larger waves one serial interval apart as person-to-person spread continues.",
        tags: ["outbreak", "infectious"],
      },
      {
        name: "Attack rate table",
        description: "Finding the culprit exposure.",
        definition: "Compare attack rates among exposed vs unexposed for each candidate (e.g. each food): $\\text{RR} = \\dfrac{\\text{AR}_{\\text{exposed}}}{\\text{AR}_{\\text{unexposed}}}$; the exposure with high RR and high attributable cases is implicated.",
        tags: ["outbreak"],
      },
      {
        name: "Incubation & latent period",
        description: "Time from exposure to onset.",
        principle:
          "The incubation period (infection to symptom onset) sets the epi-curve spacing and back-calculates the exposure time; the latent period (infection to infectiousness) governs transmission dynamics.",
        tags: ["outbreak", "infectious"],
      },
      {
        name: "Contact tracing",
        description: "Following the chain of transmission.",
        principle:
          "Identify, notify, and monitor or quarantine the contacts of a case to interrupt onward spread; effectiveness depends on speed and coverage relative to the serial interval.",
        tags: ["outbreak", "infectious"],
      },
      {
        name: "Case finding & the transmission chain",
        description: "Reconstructing spread.",
        principle:
          "Systematic search for additional cases (active case finding) and linkage of who-infected-whom maps the outbreak and reveals super-spreading and missed links.",
        tags: ["outbreak", "infectious"],
      },
      {
        name: "Quarantine vs isolation",
        description: "Two containment tools.",
        principle:
          "Isolation separates known/symptomatic cases; quarantine restricts exposed-but-not-yet-ill contacts for the incubation period.",
        principalCritiques:
          "Use of quarantine and isolation in policy is contested. Proponents argue they are core public-health tools proven to blunt transmission when applied early and briefly; critics point to civil-liberty costs, economic and psychological harm at scale (as in prolonged COVID-19 measures), and unequal enforcement. The card describes the tools; evaluation of any specific application belongs here.",
        tags: ["outbreak", "infectious"],
      },
      {
        name: "Outbreak control measures",
        description: "Breaking transmission.",
        principle:
          "Interventions target the source (remove contaminated product), the route (sanitation, vector control, PPE), or susceptibility (vaccination, prophylaxis); the choice follows the epidemiologic triad.",
        tags: ["outbreak"],
      },
      {
        name: "Risk communication",
        description: "Informing without inciting panic.",
        principle:
          "Timely, transparent, empathetic communication of risk and uncertainty sustains trust and adherence during emergencies; failures amplify harm.",
        tags: ["outbreak"],
        xref: ["communication"],
      },
    ],
  },

  // ── Family 12 ─────────────────────────────────────────────────────────────
  {
    slug: "infectious-dynamics",
    number: 12,
    name: "Infectious-Disease Dynamics",
    blurb: "The quantitative machinery of transmission: reproduction numbers, compartments, and how epidemics grow and stop.",
    section: "D",
    color: "rose",
    dataSource: "GBD communicable-disease estimates; WHO GHO infectious indicators; ICD-11 chapters 1 (infectious).",
    entries: [
      {
        name: "Basic reproduction number (R_0)",
        description: "Transmissibility in a fully susceptible population.",
        definition: "$R_0 = \\beta \\, c \\, D$ (transmission probability per contact × contact rate × infectious duration).",
        interpretation: "$R_0 > 1$ ⇒ an epidemic can grow; $R_0 < 1$ ⇒ it dies out.",
        example: "Measles $R_0 \\approx 12$-18.",
        tags: ["infectious", "dynamics"],
      },
      {
        name: "Effective reproduction number (R_t)",
        description: "Transmission as immunity accrues.",
        definition: "$R_t = R_0 \\, s(t)$, with $s(t)$ the susceptible fraction at time $t$.",
        interpretation: "Control aims to hold $R_t < 1$; tracked in real time during epidemics.",
        tags: ["infectious", "dynamics"],
      },
      {
        name: "Herd immunity threshold",
        description: "Immunity that halts spread.",
        definition: "$\\text{HIT} = 1 - \\dfrac{1}{R_0}$.",
        interpretation: "The susceptible fraction must fall below $1/R_0$; e.g. $R_0 = 4$ ⇒ ~75% immune to stop sustained transmission.",
        tags: ["infectious", "dynamics"],
      },
      {
        name: "SIR / SEIR compartmental models",
        description: "Flows between disease states.",
        principle:
          "Partition the population into Susceptible-(Exposed)-Infectious-Recovered compartments governed by differential equations; the workhorse framework for epidemic dynamics.",
        interpretation: "Threshold behavior at $R_0 = 1$.",
        tags: ["infectious", "dynamics"],
        xref: ["mathematics"],
      },
      {
        name: "Serial interval & generation time",
        description: "Spacing between infections.",
        principle:
          "The serial interval (onset-to-onset between infector and infectee) and generation time (infection-to-infection) set the tempo of spread and calibrate $R_t$ estimation.",
        tags: ["infectious", "dynamics"],
      },
      {
        name: "Force of infection",
        description: "The rate susceptibles get infected.",
        definition: "$\\lambda(t)$, the per-susceptible instantaneous hazard of infection; rises with prevalence of infectious individuals.",
        tags: ["infectious", "dynamics"],
      },
      {
        name: "Modes of transmission",
        description: "How agents move between hosts.",
        principle:
          "Direct (contact, droplet), airborne, vehicle-borne (food, water, fomites), vector-borne, and vertical (mother-to-child); the mode dictates control.",
        tags: ["infectious"],
      },
      {
        name: "Vector-borne disease",
        description: "Transmission via arthropods.",
        principle:
          "Pathogens carried by mosquitoes, ticks, and other arthropods; dynamics depend on vector abundance, biting rate, and extrinsic incubation, expanding with climate.",
        example: "Malaria, dengue.",
        tags: ["infectious"],
        xref: ["environmental-science"],
      },
      {
        name: "Zoonoses & spillover",
        description: "Animal-to-human emergence.",
        principle:
          "Most emerging infections originate in animal reservoirs and spill over at the human-animal interface; surveillance at that interface (One Health) is preventive.",
        example: "Influenza, Ebola, SARS-CoV-2.",
        tags: ["infectious", "emerging"],
      },
      {
        name: "Antimicrobial resistance (AMR)",
        description: "Evolution against our drugs.",
        principle:
          "Selective pressure from antimicrobial use drives resistant strains; a population-level threat requiring stewardship and surveillance.",
        dataSource: "WHO GLASS (Global Antimicrobial Resistance and Use Surveillance System).",
        tags: ["infectious"],
        xref: ["pharmacology"],
      },
      {
        name: "Latency, carriers & asymptomatic infection",
        description: "Hidden transmission.",
        principle:
          "Asymptomatic carriers and latent infections sustain spread invisibly, complicating control and inflating the true infected denominator (IFR vs CFR).",
        tags: ["infectious"],
      },
      {
        name: "Emerging & re-emerging infections",
        description: "New and returning threats.",
        principle:
          "Newly recognized (HIV, SARS-CoV-2) or resurgent (measles, TB) pathogens driven by ecological change, travel, resistance, and waning immunity.",
        tags: ["infectious", "emerging"],
      },
    ],
  },

  // ── Family 13 ─────────────────────────────────────────────────────────────
  {
    slug: "immunization",
    number: 13,
    name: "Immunization & Vaccine Epidemiology",
    blurb: "How population-scale immunity is built and measured — and how it fails.",
    section: "D",
    color: "rose",
    dataSource: "WHO/UNICEF immunization coverage (WUENIC); post-licensure vaccine-safety surveillance signals; aggregate VAERS/FAERS.",
    entries: [
      {
        name: "Vaccination & active immunity",
        description: "Priming the immune system.",
        principle:
          "Administering an antigen induces durable, memory-based protection without natural disease; the foundational primary-prevention tool.",
        tags: ["immunization"],
        xref: ["pharmacology"],
      },
      {
        name: "Herd (community) protection",
        description: "Indirect benefit of coverage.",
        principle:
          "Vaccinating enough of a population protects the unvaccinated by removing transmission routes; the population-level payoff beyond individual protection.",
        tags: ["immunization"],
      },
      {
        name: "Vaccine efficacy vs effectiveness",
        description: "Trial vs field protection.",
        definition: "$\\text{VE} = (1 - \\text{RR}) \\times 100\\%$; efficacy is measured in RCTs, effectiveness in observational field studies.",
        tags: ["immunization"],
      },
      {
        name: "Critical vaccination coverage",
        description: "Threshold for elimination.",
        definition: "$V_c = \\dfrac{1}{E}\\left(1 - \\dfrac{1}{R_0}\\right)$, dividing the herd-immunity threshold by vaccine efficacy $E$.",
        interpretation: "Imperfect vaccines require higher coverage.",
        tags: ["immunization"],
      },
      {
        name: "Cold chain & program logistics",
        description: "Delivering potency.",
        principle:
          "Temperature-controlled storage and transport and reliable supply determine whether an efficacious vaccine actually protects a population.",
        tags: ["immunization", "global"],
      },
      {
        name: "Vaccine hesitancy",
        description: "Delay or refusal despite availability.",
        principle:
          "A behavioral determinant of coverage shaped by confidence, complacency, and convenience; addressed by trust-building.",
        principalCritiques:
          "Policy responses to hesitancy are contested. Proponents of mandates argue they are effective at raising coverage and preventing outbreaks; opponents cite bodily-autonomy and consent concerns, unequal enforcement, and long-run trust costs. The card describes the phenomenon; adjudication of specific mandate policies lives here.",
        tags: ["immunization"],
        xref: ["psychology"],
      },
      {
        name: "Vaccine safety surveillance",
        description: "Watching for rare harms.",
        principle:
          "Passive (spontaneous-report) and active systems detect rare adverse events after licensure that trials were too small to see.",
        dataSource: "Aggregate spontaneous-report signals (e.g. VAERS/FAERS at the signal level, not individual-case content).",
        tags: ["immunization"],
        xref: ["pharmacology"],
      },
      {
        name: "Elimination vs eradication",
        description: "Two end states.",
        principle:
          "Elimination = zero incidence in a defined area (maintained by control); eradication = permanent global zero (control can stop).",
        example: "Smallpox eradicated (1980); polio near elimination.",
        tags: ["immunization", "global"],
      },
    ],
  },
];
