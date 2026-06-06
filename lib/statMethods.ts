// Catalogue of statistical methods used by the OpenAlex-claim enrichment
// pipeline and the /statistics/explorer UI. The slug is the storage key written
// to `Claim.metadata.statMethods`. Patterns are used by
// scripts/enrich-stat-methods.ts; label/description are surfaced in the UI.
//
// Adding a method: pick a new slug, list the regex patterns that should tag a
// claim, write a one-line description. Re-run the enrichment with --force
// after a sufficient number of new patterns to re-tag everything.

export type StatMethod = {
  slug: string;
  label: string;
  description: string;
  patterns: RegExp[];
};

export const STAT_METHODS: StatMethod[] = [
  {
    slug: "regression",
    label: "Regression (general)",
    description: "Linear or multiple regression, OLS, regression modeling.",
    patterns: [
      /\bregression analysis\b/i,
      /\blinear regression\b/i,
      /\bmultiple regression\b/i,
      /\bregression model\b/i,
      /\bordinary least squares\b/i,
      /\bOLS\b/,
    ],
  },
  {
    slug: "logistic-regression",
    label: "Logistic regression",
    description: "Binary or multinomial logistic / logit models.",
    patterns: [/\blogistic regression\b/i, /\blogit model\b/i, /\bmultinomial logit\b/i],
  },
  {
    slug: "anova",
    label: "ANOVA",
    description: "Analysis of variance — one-way, two-way, repeated-measures, MANOVA.",
    patterns: [
      /\bANOVA\b/,
      /\banalysis of variance\b/i,
      /\bMANOVA\b/,
      /\bone[- ]way ANOVA\b/i,
      /\btwo[- ]way ANOVA\b/i,
      /\brepeated[- ]measures ANOVA\b/i,
    ],
  },
  {
    slug: "t-test",
    label: "t-test",
    description: "Student / Welch t-tests, paired or two-sample.",
    patterns: [
      /\bt-test\b/i,
      /\bt test\b/i,
      /\bStudent['’]s t\b/i,
      /\btwo[- ]sample t\b/i,
      /\bpaired t/i,
      /\bWelch['’]s t\b/i,
    ],
  },
  {
    slug: "chi-square",
    label: "Chi-square test",
    description: "Chi-square, chi-squared, and Fisher's exact test for contingency tables.",
    patterns: [/\bchi[- ]square\b/i, /\bchi[- ]squared\b/i, /χ²/, /χ2/, /\bFisher['’]s exact\b/i],
  },
  {
    slug: "bayesian",
    label: "Bayesian inference",
    description: "Posteriors, priors, Bayes factors, MCMC / Gibbs / HMC.",
    patterns: [
      /\bBayesian\b/i,
      /\bposterior probability\b/i,
      /\bposterior distribution\b/i,
      /\bBayes factor/i,
      /\bMarkov chain Monte Carlo\b/i,
      /\bMCMC\b/,
      /\bGibbs sampling\b/i,
      /\bHamiltonian Monte Carlo\b/i,
    ],
  },
  {
    slug: "mixed-effects",
    label: "Mixed-effects / multilevel",
    description: "Linear mixed models, GLMM, hierarchical models, multilevel regression.",
    patterns: [
      /\bmixed[- ]effects?\b/i,
      /\brandom effects?\b/i,
      /\blinear mixed model/i,
      /\bLMM\b/,
      /\bGLMM\b/,
      /\bmultilevel model/i,
      /\bhierarchical (?:linear |bayesian )?model/i,
    ],
  },
  {
    slug: "sem",
    label: "Structural equation modeling",
    description: "SEM, path analysis, latent variable models.",
    patterns: [/\bstructural equation model/i, /\bpath analysis\b/i, /\blatent variable model/i, /\bSEM\b/],
  },
  {
    slug: "factor-analysis",
    label: "Factor analysis",
    description: "Exploratory and confirmatory factor analysis.",
    patterns: [
      /\bfactor analysis\b/i,
      /\bexploratory factor\b/i,
      /\bconfirmatory factor\b/i,
      /\bEFA\b/,
      /\bCFA\b/,
    ],
  },
  {
    slug: "pca",
    label: "PCA / dimensionality reduction",
    description: "Principal components, t-SNE, UMAP, ICA.",
    patterns: [/\bprincipal component(?:s)? analysis\b/i, /\bPCA\b/, /\bt[- ]SNE\b/i, /\bUMAP\b/, /\bICA\b/],
  },
  {
    slug: "rct",
    label: "Randomized controlled trial",
    description: "RCTs, double-blind, placebo-controlled, cluster-randomized designs.",
    patterns: [
      /\brandomi[sz]ed controlled trial/i,
      /\bRCTs?\b/,
      /\bdouble[- ]blind\b/i,
      /\bplacebo[- ]controlled\b/i,
      /\bcluster[- ]randomi[sz]ed\b/i,
    ],
  },
  {
    slug: "meta-analysis",
    label: "Meta-analysis",
    description: "Meta-analysis, systematic review, forest plot, heterogeneity statistics.",
    patterns: [
      /\bmeta[- ]analys[ie]s\b/i,
      /\bsystematic review\b/i,
      /\bforest plot\b/i,
      /\bI² statistic\b/i,
      /\bheterogeneity I2\b/i,
    ],
  },
  {
    slug: "machine-learning",
    label: "Machine learning",
    description: "Supervised / unsupervised / reinforcement learning (general).",
    patterns: [
      /\bmachine learning\b/i,
      /\bsupervised learning\b/i,
      /\bunsupervised learning\b/i,
      /\breinforcement learning\b/i,
    ],
  },
  {
    slug: "deep-learning",
    label: "Deep learning",
    description: "Deep neural network methods.",
    patterns: [/\bdeep learning\b/i, /\bdeep neural\b/i],
  },
  {
    slug: "neural-network",
    label: "Neural network",
    description: "Neural networks broadly — CNN, RNN, LSTM, transformer, attention.",
    patterns: [
      /\bneural network/i,
      /\bconvolutional neural\b/i,
      /\bCNN\b/,
      /\bLSTM\b/,
      /\bRNN\b/,
      /\btransformer model/i,
      /\bartificial neural\b/i,
      /\battention mechanism\b/i,
    ],
  },
  {
    slug: "survival-analysis",
    label: "Survival analysis",
    description: "Kaplan-Meier, Cox PH, hazard ratios, accelerated failure time.",
    patterns: [
      /\bsurvival analysis\b/i,
      /\bKaplan[- ]Meier\b/i,
      /\bhazard ratio\b/i,
      /\bCox (?:proportional hazards|regression|model)\b/i,
      /\baccelerated failure time\b/i,
    ],
  },
  {
    slug: "confidence-interval",
    label: "Confidence interval",
    description: "Frequentist interval estimates (95% / 99% CI).",
    patterns: [/\bconfidence interval\b/i, /\b95\s?% CI\b/i, /\b95\s?% confidence\b/i, /\b99\s?% CI\b/i],
  },
  {
    slug: "p-value",
    label: "p-value / NHST",
    description: "p-values, null hypothesis significance testing.",
    patterns: [/\bp[- ]value/i, /\bp ?[<>=] ?0\.0\d+/i, /\bstatistical(ly)? significan/i, /\bnull hypothesis/i],
  },
  {
    slug: "odds-ratio",
    label: "Odds / risk ratio",
    description: "Odds ratio, relative risk, risk ratio.",
    patterns: [/\bodds ratio\b/i, /\brelative risk\b/i, /\brisk ratio\b/i],
  },
  {
    slug: "correlation",
    label: "Correlation",
    description: "Pearson, Spearman, Kendall correlation coefficients.",
    patterns: [
      /\bPearson(?:['’]s)? correlation\b/i,
      /\bSpearman(?:['’]s)?\b/i,
      /\bcorrelation coefficient\b/i,
      /\bKendall['’]s tau\b/i,
      /\bcorrelation matrix\b/i,
    ],
  },
  {
    slug: "cross-validation",
    label: "Cross-validation",
    description: "k-fold, leave-one-out, model validation.",
    patterns: [/\bcross[- ]validation\b/i, /\bk[- ]fold\b/i, /\bleave[- ]one[- ]out\b/i],
  },
  {
    slug: "bootstrap",
    label: "Bootstrap / resampling",
    description: "Bootstrap, jackknife, permutation tests.",
    patterns: [/\bbootstrap(?:ping|ped)?\b/i, /\bresampling method/i, /\bjackknife\b/i, /\bpermutation test\b/i],
  },
  {
    slug: "propensity-score",
    label: "Propensity score / IPW",
    description: "Propensity score matching, IPW / IPTW, doubly robust estimation.",
    patterns: [
      /\bpropensity score/i,
      /\bPSM\b/,
      /\binverse probability weighting\b/i,
      /\bIPTW\b/,
      /\bIPW\b/,
      /\bdoubly robust\b/i,
    ],
  },
  {
    slug: "instrumental-variable",
    label: "Instrumental variable",
    description: "IV regression, 2SLS, Mendelian randomization.",
    patterns: [
      /\binstrumental variable/i,
      /\b2SLS\b/,
      /\btwo[- ]stage least squares\b/i,
      /\bMendelian randomi[sz]ation\b/i,
    ],
  },
  {
    slug: "diff-in-diff",
    label: "Difference-in-differences",
    description: "DiD estimator for quasi-experimental designs.",
    patterns: [/\bdifference[- ]in[- ]differences?\b/i, /\bdiff[- ]in[- ]diff\b/i, /\bDID estimator\b/i, /\bDiD\b/],
  },
  {
    slug: "regression-discontinuity",
    label: "Regression discontinuity",
    description: "Sharp / fuzzy RDD around cutoffs.",
    patterns: [/\bregression discontinuity\b/i, /\bRDD\b/],
  },
  {
    slug: "time-series",
    label: "Time-series",
    description: "ARIMA, autoregressive, GARCH, VAR, Kalman filter.",
    patterns: [
      /\btime[- ]series\b/i,
      /\bARIMA\b/,
      /\bautoregressive\b/i,
      /\bGARCH\b/,
      /\bVAR model\b/,
      /\bvector autoregression\b/i,
      /\bKalman filter\b/i,
    ],
  },
  {
    slug: "clustering",
    label: "Clustering",
    description: "k-means, hierarchical, DBSCAN, Gaussian mixture.",
    patterns: [
      /\bk[- ]means\b/i,
      /\bhierarchical cluster/i,
      /\bDBSCAN\b/,
      /\bclustering algorithm/i,
      /\bGaussian mixture\b/i,
    ],
  },
  {
    slug: "random-forest",
    label: "Random forest / boosting",
    description: "Random forest, gradient boosting, XGBoost, LightGBM, decision trees.",
    patterns: [
      /\brandom forest\b/i,
      /\bgradient boosting\b/i,
      /\bXGBoost\b/i,
      /\bdecision tree\b/i,
      /\bLightGBM\b/i,
      /\bCatBoost\b/i,
    ],
  },
  {
    slug: "svm",
    label: "Support vector machine",
    description: "SVM / support vector machines.",
    patterns: [/\bsupport vector machine/i, /\bSVM\b/],
  },
  {
    slug: "gee",
    label: "GEE / longitudinal",
    description: "Generalized estimating equations, longitudinal repeated-measures.",
    patterns: [
      /\bgeneralized estimating equation/i,
      /\bGEE\b/,
      /\blongitudinal data analysis/i,
      /\brepeated measures\b/i,
    ],
  },
  {
    slug: "gwas",
    label: "GWAS / multiple testing",
    description: "Genome-wide association, Bonferroni, FDR, Benjamini-Hochberg.",
    patterns: [
      /\bgenome[- ]wide association\b/i,
      /\bGWAS\b/,
      /\bBonferroni\b/i,
      /\bfalse discovery rate\b/i,
      /\bFDR\b/,
      /\bBenjamini[- ]Hochberg\b/i,
    ],
  },
  {
    slug: "effect-size",
    label: "Effect size",
    description: "Cohen's d, eta², standardized mean difference.",
    patterns: [
      /\beffect size\b/i,
      /\bCohen['’]s d\b/i,
      /\beta squared\b/i,
      /\bη²\b/i,
      /\bstandardized mean difference\b/i,
    ],
  },
  {
    slug: "power-analysis",
    label: "Power / sample size",
    description: "A priori power, sample-size calculation, underpowered designs.",
    patterns: [
      /\bpower analysis\b/i,
      /\bstatistical power\b/i,
      /\bsample size calculation\b/i,
      /\ba priori power\b/i,
      /\bunderpowered\b/i,
    ],
  },
];

export const STAT_METHOD_BY_SLUG: Record<string, StatMethod> = Object.fromEntries(
  STAT_METHODS.map(m => [m.slug, m]),
);

export const STAT_METHOD_SLUGS: string[] = STAT_METHODS.map(m => m.slug);

export function detectStatMethods(haystack: string): string[] {
  const found = new Set<string>();
  for (const m of STAT_METHODS) {
    for (const re of m.patterns) {
      if (re.test(haystack)) {
        found.add(m.slug);
        break;
      }
    }
  }
  return [...found];
}
