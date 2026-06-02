"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Method = {
  name: string;
  description: string;
  usedFor: string[];
};

type Family = {
  slug: string;
  name: string;
  blurb: string;
  color: ColorKey;
  methods: Method[];
};

type ColorKey =
  | "gray"
  | "blue"
  | "green"
  | "purple"
  | "amber"
  | "orange"
  | "teal"
  | "rose"
  | "violet";

const COLOR_STYLES: Record<
  ColorKey,
  {
    headerBg: string;
    headerBorder: string;
    headerText: string;
    chipBg: string;
    chipText: string;
    cardBorder: string;
    cardHover: string;
    accent: string;
  }
> = {
  gray: {
    headerBg: "bg-gray-900/60",
    headerBorder: "border-gray-700",
    headerText: "text-gray-200",
    chipBg: "bg-gray-800",
    chipText: "text-gray-400",
    cardBorder: "border-gray-800",
    cardHover: "hover:border-gray-600",
    accent: "text-gray-400",
  },
  blue: {
    headerBg: "bg-blue-950/40",
    headerBorder: "border-blue-900",
    headerText: "text-blue-200",
    chipBg: "bg-blue-950/60",
    chipText: "text-blue-300",
    cardBorder: "border-blue-950/70",
    cardHover: "hover:border-blue-700",
    accent: "text-blue-400",
  },
  green: {
    headerBg: "bg-emerald-950/40",
    headerBorder: "border-emerald-900",
    headerText: "text-emerald-200",
    chipBg: "bg-emerald-950/60",
    chipText: "text-emerald-300",
    cardBorder: "border-emerald-950/70",
    cardHover: "hover:border-emerald-700",
    accent: "text-emerald-400",
  },
  purple: {
    headerBg: "bg-purple-950/40",
    headerBorder: "border-purple-900",
    headerText: "text-purple-200",
    chipBg: "bg-purple-950/60",
    chipText: "text-purple-300",
    cardBorder: "border-purple-950/70",
    cardHover: "hover:border-purple-700",
    accent: "text-purple-400",
  },
  amber: {
    headerBg: "bg-amber-950/40",
    headerBorder: "border-amber-900",
    headerText: "text-amber-200",
    chipBg: "bg-amber-950/60",
    chipText: "text-amber-300",
    cardBorder: "border-amber-950/70",
    cardHover: "hover:border-amber-700",
    accent: "text-amber-400",
  },
  orange: {
    headerBg: "bg-orange-950/40",
    headerBorder: "border-orange-900",
    headerText: "text-orange-200",
    chipBg: "bg-orange-950/60",
    chipText: "text-orange-300",
    cardBorder: "border-orange-950/70",
    cardHover: "hover:border-orange-700",
    accent: "text-orange-400",
  },
  teal: {
    headerBg: "bg-teal-950/40",
    headerBorder: "border-teal-900",
    headerText: "text-teal-200",
    chipBg: "bg-teal-950/60",
    chipText: "text-teal-300",
    cardBorder: "border-teal-950/70",
    cardHover: "hover:border-teal-700",
    accent: "text-teal-400",
  },
  rose: {
    headerBg: "bg-rose-950/40",
    headerBorder: "border-rose-900",
    headerText: "text-rose-200",
    chipBg: "bg-rose-950/60",
    chipText: "text-rose-300",
    cardBorder: "border-rose-950/70",
    cardHover: "hover:border-rose-700",
    accent: "text-rose-400",
  },
  violet: {
    headerBg: "bg-violet-950/40",
    headerBorder: "border-violet-900",
    headerText: "text-violet-200",
    chipBg: "bg-violet-950/60",
    chipText: "text-violet-300",
    cardBorder: "border-violet-950/70",
    cardHover: "hover:border-violet-700",
    accent: "text-violet-400",
  },
};

const FAMILIES: Family[] = [
  {
    slug: "descriptive",
    name: "Descriptive Statistics",
    blurb: "Summarize the shape, center, and spread of a sample — no inference.",
    color: "gray",
    methods: [
      { name: "Mean", description: "Arithmetic average — central tendency for symmetric distributions.", usedFor: ["center", "interval data"] },
      { name: "Median", description: "Middle value — robust to outliers and skew.", usedFor: ["center", "robust"] },
      { name: "Mode", description: "Most frequent value — only useful summary for categorical data.", usedFor: ["center", "categorical"] },
      { name: "Standard Deviation", description: "Average distance from the mean — units of the variable.", usedFor: ["spread"] },
      { name: "Variance", description: "Squared average distance from the mean — additive across independent sources.", usedFor: ["spread"] },
      { name: "Percentile", description: "Cut-point below which a given share of the data falls.", usedFor: ["position", "ranking"] },
      { name: "Quartile", description: "25th / 50th / 75th percentiles — five-number summary backbone.", usedFor: ["position"] },
      { name: "IQR", description: "Interquartile range (Q3 − Q1) — robust spread measure used in boxplots.", usedFor: ["spread", "robust"] },
      { name: "Skewness", description: "Asymmetry of a distribution — positive tail right, negative tail left.", usedFor: ["shape"] },
      { name: "Kurtosis", description: "Tailedness of a distribution — high kurtosis = heavy tails / outlier prone.", usedFor: ["shape"] },
    ],
  },
  {
    slug: "inferential-frequentist",
    name: "Inferential Statistics (Frequentist)",
    blurb: "Null-hypothesis significance testing — p-values, confidence intervals, fixed parameters, random data.",
    color: "blue",
    methods: [
      { name: "One-sample t-test", description: "Test whether a sample mean differs from a known value.", usedFor: ["means", "one group"] },
      { name: "Independent t-test", description: "Compare means of two unpaired groups assuming approximate normality.", usedFor: ["means", "two groups"] },
      { name: "Paired t-test", description: "Compare two measurements on the same units — eliminates between-subject variance.", usedFor: ["means", "within-subjects"] },
      { name: "ANOVA", description: "Compare means of 3+ groups — F-test on between vs. within variance.", usedFor: ["means", "multi-group"] },
      { name: "MANOVA", description: "Multivariate ANOVA — multiple correlated outcomes at once.", usedFor: ["multivariate"] },
      { name: "Chi-square test", description: "Test independence of two categorical variables in a contingency table.", usedFor: ["categorical", "independence"] },
      { name: "Fisher's exact test", description: "Exact alternative to chi-square for small-sample 2×2 tables.", usedFor: ["categorical", "small sample"] },
      { name: "Mann-Whitney U", description: "Nonparametric independent-samples test on ranks — no normality required.", usedFor: ["nonparametric", "two groups"] },
      { name: "Wilcoxon signed-rank", description: "Nonparametric paired test on ranked differences.", usedFor: ["nonparametric", "within-subjects"] },
      { name: "Kruskal-Wallis", description: "Nonparametric ANOVA — extends Mann-Whitney to 3+ groups.", usedFor: ["nonparametric", "multi-group"] },
      { name: "Kolmogorov-Smirnov", description: "Compare two empirical CDFs or test against a reference distribution.", usedFor: ["distribution", "goodness-of-fit"] },
      { name: "Shapiro-Wilk", description: "Test whether a sample is drawn from a normal distribution.", usedFor: ["normality"] },
      { name: "Bonferroni correction", description: "Conservative family-wise error control — divide α by the number of tests.", usedFor: ["multiple comparisons"] },
      { name: "FDR (Benjamini-Hochberg)", description: "Control expected proportion of false discoveries — less conservative than Bonferroni.", usedFor: ["multiple comparisons"] },
    ],
  },
  {
    slug: "regression",
    name: "Regression & Prediction",
    blurb: "Model an outcome as a function of one or more predictors — explanation or prediction.",
    color: "green",
    methods: [
      { name: "Linear regression", description: "OLS — predict a continuous outcome from one or more predictors.", usedFor: ["continuous outcome"] },
      { name: "Logistic regression", description: "Predict a binary outcome via the logit link — coefficients in log-odds.", usedFor: ["binary outcome"] },
      { name: "Multinomial logistic", description: "Generalization of logistic regression to >2 unordered outcome categories.", usedFor: ["categorical outcome"] },
      { name: "Ordinal regression", description: "Predict an ordered categorical outcome — proportional-odds assumption.", usedFor: ["ordered outcome"] },
      { name: "Poisson regression", description: "Model count data with mean = variance — log link.", usedFor: ["count data"] },
      { name: "Negative binomial regression", description: "Count regression for overdispersed data — relaxes Poisson's equal mean/variance.", usedFor: ["count data", "overdispersion"] },
      { name: "Cox proportional hazards", description: "Semi-parametric survival model — hazard ratios without modeling baseline hazard.", usedFor: ["survival"] },
      { name: "Kaplan-Meier estimator", description: "Nonparametric estimator of survival curves with right-censored data.", usedFor: ["survival", "nonparametric"] },
      { name: "Mixed-effects models", description: "Combine fixed and random effects — for nested, clustered, or repeated-measures data.", usedFor: ["clustered data", "longitudinal"] },
      { name: "Hierarchical linear models (HLM)", description: "Multilevel regression for nested structures (students-in-schools, patients-in-clinics).", usedFor: ["nested data"] },
      { name: "Generalized linear models (GLM)", description: "Framework unifying linear, logistic, Poisson via link function + exponential family.", usedFor: ["framework"] },
      { name: "Structural equation modeling (SEM)", description: "Estimate networks of regression paths with latent variables and measurement error.", usedFor: ["latent variables", "path analysis"] },
      { name: "Ridge regression", description: "L2-regularized linear regression — shrinks coefficients toward zero.", usedFor: ["regularization", "multicollinearity"] },
      { name: "Lasso regression", description: "L1-regularized — performs variable selection by zeroing some coefficients.", usedFor: ["regularization", "variable selection"] },
      { name: "Elastic Net", description: "Blend of L1 and L2 — handles correlated predictors better than pure Lasso.", usedFor: ["regularization"] },
      { name: "Quantile regression", description: "Model conditional quantiles (e.g. median) — robust to outliers, captures distributional effects.", usedFor: ["robust", "heterogeneous effects"] },
    ],
  },
  {
    slug: "bayesian",
    name: "Bayesian Methods",
    blurb: "Treat parameters as random — update prior beliefs with data to get a posterior.",
    color: "purple",
    methods: [
      { name: "Bayesian inference", description: "Update prior distribution over parameters using Bayes' rule and observed data.", usedFor: ["inference", "uncertainty"] },
      { name: "Markov Chain Monte Carlo (MCMC)", description: "Sample from posterior distributions when closed-form integration is intractable.", usedFor: ["posterior sampling"] },
      { name: "Hamiltonian Monte Carlo", description: "Gradient-based MCMC (Stan, PyMC NUTS) — efficient on high-dimensional posteriors.", usedFor: ["posterior sampling", "high-dimensional"] },
      { name: "Variational inference", description: "Approximate posteriors by optimization rather than sampling — fast but biased.", usedFor: ["approximate inference"] },
      { name: "Bayesian networks", description: "Directed acyclic graphs encoding conditional independence — probabilistic reasoning.", usedFor: ["graphical models"] },
      { name: "Bayes factors", description: "Ratio of marginal likelihoods — Bayesian model comparison alternative to p-values.", usedFor: ["model comparison"] },
      { name: "Hierarchical Bayesian models", description: "Multilevel priors enable partial pooling — shrinks group estimates toward the grand mean.", usedFor: ["multilevel", "partial pooling"] },
      { name: "Bayesian model averaging", description: "Weight predictions by posterior model probabilities instead of selecting one model.", usedFor: ["model uncertainty"] },
      { name: "Empirical Bayes", description: "Estimate priors from the data itself — pragmatic shortcut for hierarchical models.", usedFor: ["shrinkage"] },
      { name: "Posterior predictive checks", description: "Simulate data from the fitted model and compare to the observed — model criticism.", usedFor: ["model checking"] },
    ],
  },
  {
    slug: "experimental-design",
    name: "Experimental Design",
    blurb: "Plan data collection so the resulting inference is unbiased and well-powered.",
    color: "amber",
    methods: [
      { name: "Randomized controlled trial (RCT)", description: "Random assignment to treatment vs. control — gold standard for causal inference.", usedFor: ["causal", "intervention"] },
      { name: "Factorial design", description: "Vary multiple factors simultaneously — estimates main effects and interactions efficiently.", usedFor: ["multi-factor"] },
      { name: "Latin square", description: "Counterbalance order across treatments and time periods with one observation per cell.", usedFor: ["counterbalancing"] },
      { name: "Crossover design", description: "Each subject receives multiple treatments in sequence — controls between-subject variance.", usedFor: ["within-subjects"] },
      { name: "A/B testing", description: "Online randomized experiments — measure causal effect of a change at scale.", usedFor: ["online experimentation"] },
      { name: "Multi-armed bandit", description: "Adaptively allocate traffic to better-performing variants — exploration vs. exploitation.", usedFor: ["adaptive allocation"] },
      { name: "Power analysis", description: "Compute sample size needed to detect a target effect with given α and power.", usedFor: ["sample size"] },
      { name: "Cluster randomization", description: "Randomize at group level (schools, clinics) when contamination between units is likely.", usedFor: ["group-level"] },
      { name: "Stratified sampling", description: "Sample within strata to guarantee representation and reduce variance.", usedFor: ["sampling"] },
      { name: "Pre-registration", description: "Publicly commit to hypotheses and analysis plan before seeing data — bias prevention.", usedFor: ["bias prevention"] },
    ],
  },
  {
    slug: "causal-inference",
    name: "Causal Inference",
    blurb: "Estimate causal effects from observational data — when randomization is impossible.",
    color: "orange",
    methods: [
      { name: "Difference-in-differences (DiD)", description: "Compare pre/post changes between treated and untreated groups — parallel-trends assumption.", usedFor: ["policy evaluation"] },
      { name: "Instrumental variables (IV)", description: "Use an exogenous instrument to isolate the causal portion of variation in a predictor.", usedFor: ["endogeneity"] },
      { name: "Regression discontinuity (RD)", description: "Compare units just above and below a cutoff — local randomization argument.", usedFor: ["threshold effects"] },
      { name: "Propensity score matching", description: "Match treated and untreated units on estimated probability of treatment.", usedFor: ["observational causal"] },
      { name: "Inverse probability weighting", description: "Reweight observations by inverse treatment-probability to balance covariates.", usedFor: ["observational causal"] },
      { name: "Synthetic control", description: "Construct a weighted average of donor units that matches the treated unit pre-treatment.", usedFor: ["comparative case study"] },
      { name: "Directed acyclic graphs (DAGs)", description: "Encode causal assumptions graphically to identify valid adjustment sets.", usedFor: ["causal identification"] },
      { name: "Mediation analysis", description: "Decompose a total effect into direct and indirect (via mediator) components.", usedFor: ["mechanism"] },
      { name: "Mendelian randomization", description: "Genetic variants as instruments for modifiable exposures — IV applied to epidemiology.", usedFor: ["epidemiology", "IV"] },
    ],
  },
  {
    slug: "signal-time-series",
    name: "Signal Processing & Time Series",
    blurb: "Methods for sequential / temporal data — decomposition, forecasting, and frequency analysis.",
    color: "teal",
    methods: [
      { name: "Autocorrelation (ACF)", description: "Correlation of a series with its lagged self — diagnose temporal dependence.", usedFor: ["dependence"] },
      { name: "Fourier transform (FFT)", description: "Decompose a signal into sinusoidal frequency components.", usedFor: ["frequency"] },
      { name: "Wavelet analysis", description: "Time-frequency decomposition — localizes when a frequency is present.", usedFor: ["non-stationary signals"] },
      { name: "ARIMA", description: "Autoregressive integrated moving-average — workhorse univariate forecasting model.", usedFor: ["forecasting"] },
      { name: "SARIMA", description: "Seasonal ARIMA — adds periodic structure to the baseline model.", usedFor: ["seasonal forecasting"] },
      { name: "Vector autoregression (VAR)", description: "Multivariate AR — model joint dynamics of several series.", usedFor: ["multivariate forecasting"] },
      { name: "State-space / Kalman filter", description: "Recursive estimation of latent states from noisy observations.", usedFor: ["latent state", "tracking"] },
      { name: "Granger causality", description: "Tests whether past values of X improve prediction of Y beyond Y's own past.", usedFor: ["temporal precedence"] },
      { name: "Spectral density estimation", description: "Estimate the distribution of variance across frequencies (periodogram, Welch).", usedFor: ["frequency content"] },
      { name: "Cointegration", description: "Linear combination of non-stationary series that is itself stationary — long-run equilibrium.", usedFor: ["long-run relationship"] },
    ],
  },
  {
    slug: "information-theory",
    name: "Information Theory",
    blurb: "Quantify information, uncertainty, and statistical dependence in bits.",
    color: "rose",
    methods: [
      { name: "Shannon entropy", description: "Average uncertainty (in bits) of a discrete random variable.", usedFor: ["uncertainty"] },
      { name: "Mutual information", description: "Reduction in uncertainty about X from observing Y — captures nonlinear dependence.", usedFor: ["dependence", "nonlinear"] },
      { name: "KL divergence", description: "Non-symmetric distance between two probability distributions.", usedFor: ["distribution comparison"] },
      { name: "Cross-entropy", description: "Average number of bits needed to encode samples from P using a model Q — standard ML loss.", usedFor: ["model fit", "loss"] },
      { name: "Jensen-Shannon divergence", description: "Symmetric, bounded variant of KL — square root is a metric.", usedFor: ["distribution comparison"] },
      { name: "Fisher information", description: "Curvature of the log-likelihood — Cramér-Rao bound on parameter precision.", usedFor: ["parameter precision"] },
      { name: "Channel capacity", description: "Maximum rate of reliable information transmission across a noisy channel.", usedFor: ["communication"] },
      { name: "Transfer entropy", description: "Directional information flow from one process to another — nonlinear Granger.", usedFor: ["directional dependence"] },
    ],
  },
  {
    slug: "machine-learning",
    name: "Machine Learning Methods",
    blurb: "Algorithms that learn patterns from data — supervised, unsupervised, and dimensionality reduction.",
    color: "violet",
    methods: [
      { name: "Cross-validation (k-fold)", description: "Estimate out-of-sample error by holding out folds in rotation.", usedFor: ["generalization", "tuning"] },
      { name: "Bootstrap", description: "Resample with replacement to estimate sampling distributions and confidence intervals.", usedFor: ["resampling", "uncertainty"] },
      { name: "ROC / AUC", description: "Trade off true-positive vs. false-positive rate across classifier thresholds.", usedFor: ["classifier performance"] },
      { name: "Precision-recall curve", description: "Better than ROC under heavy class imbalance.", usedFor: ["imbalanced classification"] },
      { name: "Confusion matrix", description: "Tabulate predictions vs. truth — basis for precision, recall, F1.", usedFor: ["classification metrics"] },
      { name: "Decision trees", description: "Recursively partition feature space — interpretable but high variance alone.", usedFor: ["classification", "regression"] },
      { name: "Random forests", description: "Bagged ensemble of decorrelated decision trees — reduces variance.", usedFor: ["tabular data"] },
      { name: "Gradient boosting", description: "Sequentially fit weak learners to residuals — XGBoost, LightGBM, CatBoost.", usedFor: ["tabular data", "competitions"] },
      { name: "Support vector machines (SVM)", description: "Maximum-margin classifier — kernels extend to nonlinear boundaries.", usedFor: ["classification"] },
      { name: "k-nearest neighbors (kNN)", description: "Predict from labels of the k closest training points — nonparametric.", usedFor: ["nonparametric"] },
      { name: "Naive Bayes", description: "Apply Bayes' rule under strong feature-independence assumption — fast text baseline.", usedFor: ["text classification"] },
      { name: "Principal component analysis (PCA)", description: "Linear dimensionality reduction along directions of greatest variance.", usedFor: ["dimensionality reduction"] },
      { name: "t-SNE", description: "Nonlinear embedding optimized for local neighborhood preservation — visualization only.", usedFor: ["visualization"] },
      { name: "UMAP", description: "Manifold-learning embedding — preserves more global structure than t-SNE.", usedFor: ["visualization", "embedding"] },
      { name: "k-means clustering", description: "Partition data into k clusters minimizing within-cluster variance.", usedFor: ["clustering"] },
      { name: "Hierarchical clustering", description: "Build a dendrogram by iteratively merging (agglomerative) or splitting (divisive).", usedFor: ["clustering"] },
      { name: "DBSCAN", description: "Density-based clustering — finds arbitrary shapes, labels low-density points as noise.", usedFor: ["clustering", "noise"] },
      { name: "Gaussian mixture models", description: "Soft clustering as a mixture of Gaussians fit by EM — gives membership probabilities.", usedFor: ["soft clustering"] },
    ],
  },
];

const ALL_SLUGS = FAMILIES.map(f => f.slug);

function methodMatches(method: Method, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (method.name.toLowerCase().includes(q)) return true;
  if (method.description.toLowerCase().includes(q)) return true;
  return method.usedFor.some(t => t.toLowerCase().includes(q));
}

export default function StatisticsPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return FAMILIES.map(f => ({
      ...f,
      methods: f.methods.filter(m => methodMatches(m, query)),
    })).filter(f => f.methods.length > 0);
  }, [query]);

  const totalMethods = FAMILIES.reduce((s, f) => s + f.methods.length, 0);
  const matchCount = filtered.reduce((s, f) => s + f.methods.length, 0);

  const toggle = (slug: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(ALL_SLUGS));

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Statistics — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to statistical methods organized by family. Each card describes one method,
          what it&apos;s used for, and links to claims on Epistemic Receipts that touch on it.
          Color codes the family; clicking a header collapses its section.
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {FAMILIES.length} families · {totalMethods} methods
          {query && (
            <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>
          )}
        </p>
      </div>

      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by name, description, or tag — e.g. 'survival', 'bayesian', 'count data'"
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        <div className="flex gap-2 text-xs">
          <button
            onClick={expandAll}
            className="px-3 py-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            Collapse all
          </button>
          {query && (
            <button
              onClick={() => setQuery("")}
              className="px-3 py-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">
          No methods match &ldquo;{query}&rdquo;. Try a broader term.
        </p>
      ) : (
        <div className="space-y-5">
          {filtered.map(family => {
            const c = COLOR_STYLES[family.color];
            const isCollapsed = collapsed.has(family.slug);
            return (
              <section
                key={family.slug}
                className={`rounded-lg border ${c.headerBorder} overflow-hidden`}
              >
                <button
                  onClick={() => toggle(family.slug)}
                  className={`w-full text-left px-5 py-3 ${c.headerBg} hover:brightness-125 transition-all flex items-baseline justify-between gap-4`}
                >
                  <div className="min-w-0">
                    <h2 className={`text-base font-semibold ${c.headerText}`}>
                      {family.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-500">{family.blurb}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-mono ${c.accent}`}>
                      {family.methods.length} {family.methods.length === 1 ? "method" : "methods"}
                    </span>
                    <span className={`text-xs ${c.accent}`}>
                      {isCollapsed ? "▸" : "▾"}
                    </span>
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="bg-gray-950/40 p-4 grid gap-3 sm:grid-cols-2">
                    {family.methods.map(method => (
                      <Link
                        key={method.name}
                        href={`/search?q=${encodeURIComponent(method.name)}`}
                        className={`block rounded border ${c.cardBorder} ${c.cardHover} bg-gray-900/40 px-4 py-3 transition-colors group`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="text-sm font-semibold text-white group-hover:text-gray-100">
                            {method.name}
                          </h3>
                          <span className={`text-[10px] font-mono ${c.accent} opacity-0 group-hover:opacity-100 transition-opacity`}>
                            search →
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-400 leading-snug">
                          {method.description}
                        </p>
                        {method.usedFor.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {method.usedFor.map(tag => (
                              <span
                                key={tag}
                                className={`text-[10px] px-1.5 py-0.5 rounded ${c.chipBg} ${c.chipText} font-mono`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <div className="border-t border-gray-800 pt-6 mt-12 space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Note:</span> the &ldquo;search&rdquo; link on each card runs
          a free-text search over claim and source text. A method appearing in a claim does not mean
          the claim is <em>about</em> that method — only that the term is present. A claim-powered
          method explorer that links statistical methods to the specific receipts that apply them is
          on the roadmap.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-06-02 · cross-references to Epistemic Receipts claims pending
        </p>
      </div>
    </div>
  );
}
