# Build Prompt v2 — Extend the Statistics Taxonomy (reconciled with live state)

> **What changed since v1 (for you, not the builder):**
> - The page already grew from 105 → ~117 methods while v1 was being written, so v1's "preserve the 105 / M = 105 + new" arithmetic is wrong, and **~12 of my proposed additions may already be live**. v2 leads with a reconciliation step.
> - Each card now expands into a **textbook view** (problem · key insight + formula · worked example · optional SVG), and the filter now also searches a **key insight** field. v1's payload only had one-line descriptions + tags. v2 adds an accurate **key-insight seed (with formula)** for every new method so the builder's expansions are anchored to correct mechanics rather than invented ones.
> - Adding ~13 flat families to a 9-color scheme breaks the color coding (there aren't 13 more distinct hues). v2 raises this and recommends a fix.
> - Paste everything below the line.

---

## Current live state you must respect

`/statistics` (main): 9 families, ~117 methods. Sticky filter over name / description / **key insight** / tag. Collapsible color-coded family headers. Each card expands to a textbook view: **the problem it solves → the mechanistic key insight (with a formula) → a concrete real-world example → an inline SVG diagram for ~11 iconic methods.**
`/statistics/methods` (deep-dive): top-10 most-cited methods with full treatment (problem → mechanism → worked example → figure → pitfalls → related claims).
Family colors already taken: Descriptive=gray, Inferential/Frequentist=blue, Regression=green, Bayesian=amber, Experimental Design=orange, Causal=teal, Signal/Time Series=rose, Information Theory=violet, Machine Learning=purple.

## Step 0 — Reconcile before you add anything (do this first)

The numbers in this prompt are a snapshot and may already be stale. **Trust the live data, not any count written here.**

1. Read the current taxonomy data structure and **enumerate the method names already present in each family.**
2. For every method in the payload below, **skip it if a method of the same identity already exists** — even under a slightly different name. Some additions below were likely implemented from the prior prompt; finding duplicates is expected, not an error.
3. Treat every `[cross-link]` note as binding: those methods already exist elsewhere in the taxonomy — reference them, never re-add them. (PCA, t-SNE, UMAP, all clustering, MCMC, HMC, variational inference, bootstrap, k-fold CV, ROC/AUC, kNN, Bayes factors, Cox PH, Kaplan-Meier, stratified sampling.)

## How to build

- **Edit the data layer, not the markup.** Add entries to the taxonomy data structure and let the existing render logic produce cards; only touch presentational code if the page isn't data-driven.
- **Match the live schema exactly.** Each new method needs every field the existing 117 have: name, short description, "used-for" tags, **and the textbook-expansion fields** (problem, key insight, example; SVG optional — see below). Mirror the existing field names.
- **Populate the `key insight` field from the seeds below.** They're written to be accurate and formula-bearing because the filter now indexes this field and the card expansion displays it. Don't paraphrase the formula away.
- **Recompute the counts** ("N families · M methods" and any per-family counts) from the data after editing. Never hard-code a total.
- **Don't touch `/statistics/methods`.** The top-10 "most-cited" selection is claim-driven and those cross-references are still pending; new families do not auto-enter the top 10. Just don't break the page.
- **Keep working:** the sticky filter (now over name/description/key insight/tag), Expand all, Collapse all.
- **Keep the footer note** (free-text search caveat + roadmap line) and bump the "last updated" date.

## Textbook expansion for new methods

Every new card must expand like the existing ones, in the same voice and depth:
- **Problem** — the question the method answers (1–2 sentences).
- **Key insight** — the mechanism. **Use the seed provided below verbatim or lightly expanded; keep its formula.**
- **Worked example** — one concrete, real-world instance.
- **SVG diagram** — optional; add one only for a method as iconic as the ~11 that already have figures (don't force it).

**Accuracy guardrail (this site is about epistemic rigor):** the seeds below are vetted. For any prose *you* generate beyond them, if you're unsure of a formula or mechanism, **flag it for review rather than inventing one.** A "needs verification" note is acceptable; a confidently wrong formula is not.

If the textbook expansion for ~90 methods is too large for one pass, ship it in two: (1) cards with description + tags + key insight now (the filter and the collapsed view work immediately), (2) problem + example + any SVGs in a follow-up. Don't leave new cards permanently shallower than the existing ones.

---

# CONTENT PAYLOAD — NEW FAMILIES

> Per method: **Name** — short description. *Key insight:* mechanism/formula. `tags`

### Probability & Distributions  *(foundational — see grouping note; place at top)*
*Random variables, the major distribution families, and the limit theorems beneath all inference.*

- **Random variables** — Outcomes mapped to numbers. *Key insight:* a measurable map X: Ω→ℝ that pushes a probability measure onto the real line. `foundations`
- **Distributions (PMF/PDF/CDF)** — How probability spreads over values. *Key insight:* CDF F(x)=P(X≤x), density f=F′, discrete PMF p(x)=P(X=x); all probabilities are sums/areas under these. `foundations`
- **Expectation & moments** — Summaries of a distribution. *Key insight:* E[X]=∫x f(x)dx; central moments E[(X−μ)ᵏ] give variance (k=2), skew (3), kurtosis (4). `foundations` `moments`
- **Joint, marginal & conditional** — How variables co-vary. *Key insight:* p(x,y)=p(x)p(y|x); marginalize by integrating out; independence ⇔ p(x,y)=p(x)p(y). `foundations` `dependence`
- **Normal (Gaussian)** — The bell curve. *Key insight:* f(x)=(1/√(2πσ²))e^(−(x−μ)²/2σ²); maximum-entropy distribution for a fixed mean and variance. `distribution` `continuous`
- **Binomial & Bernoulli** — Successes in yes/no trials. *Key insight:* P(X=k)=C(n,k)pᵏ(1−p)ⁿ⁻ᵏ; a sum of n iid Bernoulli(p). `distribution` `discrete`
- **Poisson** — Counts of rare events. *Key insight:* P(X=k) = e^(−λ)·λ^k / k!; the limit of Binomial as n→∞, p→0, np→λ. `distribution` `count`
- **Exponential & gamma** — Waiting times. *Key insight:* exponential f(x) = λe^(−λx) is memoryless; Gamma(k,λ) is a sum of k exponentials. `distribution` `waiting time`
- **Beta & Dirichlet** — Distributions over proportions. *Key insight:* Beta(α,β)∝x^(α−1)(1−x)^(β−1) is conjugate to the binomial — the posterior just adds successes/failures to α,β; Dirichlet extends this to the simplex. `distribution` `conjugate`
- **Student's t, χ², F** — Sampling distributions. *Key insight:* χ²=ΣZ²; t=Z/√(χ²/ν); F = ratio of two scaled χ² — all arise from estimating variance from data. `distribution` `sampling`
- **Law of large numbers** — Averages stabilize. *Key insight:* X̄ₙ→μ as n→∞; independent noise cancels. `limit theorem`
- **Central limit theorem** — Sums go normal. *Key insight:* √n(X̄ₙ−μ)/σ → N(0,1) regardless of the parent distribution (finite variance). `limit theorem`
- **Markov chains** — Memoryless dynamics. *Key insight:* P(Xₜ₊₁|past)=P(Xₜ₊₁|Xₜ); a transition matrix governs everything, with long-run behavior set by the stationary distribution. `stochastic process`
- **Poisson & point processes** — Random events in space/time. *Key insight:* counts in disjoint regions are independent Poisson with mean ∫λ(s)ds. `stochastic process`
- **Brownian motion & diffusions** — Continuous random walks. *Key insight:* independent Gaussian increments, Wₜ−Wₛ ~ N(0,t−s). `stochastic process` `continuous time`
- **Martingales** — Fair-game processes. *Key insight:* E[Xₜ₊₁|ℱₜ]=Xₜ — no predictable drift; the basis of optional-stopping and convergence theorems. `stochastic process`

### Estimation & Inference Theory  *(foundational; place at top)*
*What makes an estimate good, and why the classical procedures work.*

- **Maximum likelihood (MLE)** — Fit by likelihood. *Key insight:* maximize ℓ(θ)=Σ log f(xᵢ;θ); asymptotically efficient and normal. `estimation`
- **Method of moments** — Match moments. *Key insight:* set sample moments equal to population moments and solve; simple and consistent, not always efficient. `estimation`
- **Maximum a posteriori (MAP)** — Regularized MLE. *Key insight:* maximize log-likelihood + log-prior; ridge/lasso are MAP with Gaussian/Laplace priors. `estimation` `bayesian`
- **Bias, consistency, efficiency** — Estimator quality. *Key insight:* MSE = bias² + variance; consistent ⇒ θ̂→θ; efficient ⇒ hits the Cramér-Rao bound. `estimator properties`
- **Sufficiency & likelihood principle** — Where the evidence lives. *Key insight:* T is sufficient if the likelihood factors as g(T,θ)h(x); all info about θ is in the likelihood. `foundations`
- **Fisher information & Cramér-Rao** — Precision limit. *Key insight:* I(θ)=−E[∂²ℓ/∂θ²]; Var(θ̂) ≥ 1/(nI(θ)) for any unbiased estimator. `parameter precision`
- **LR / Wald / score tests** — Three test views. *Key insight:* likelihood-ratio (drop in fit), Wald (estimate's distance from the null), score (gradient at the null) — asymptotically equivalent. `hypothesis testing`
- **Neyman-Pearson lemma** — Optimal testing. *Key insight:* the likelihood-ratio test maximizes power at fixed size α for simple-vs-simple hypotheses. `hypothesis testing`
- **Confidence-interval theory** — What a CI means. *Key insight:* a random interval covering θ in 95% of repetitions; build by inverting a test or using a pivot. `uncertainty`
- **Asymptotics & delta method** — Large-sample behavior. *Key insight:* if √n(θ̂−θ)→N(0,σ²), then √n(g(θ̂)−g(θ))→N(0, g′(θ)²σ²). `asymptotics`
- **Loss & risk functions** — Cost of error. *Key insight:* risk R(θ,δ)=E[L(θ,δ(X))]; squared-error loss yields MSE. `decision theory`
- **Minimax & admissibility** — Decision optimality. *Key insight:* minimax minimizes worst-case risk; a rule is inadmissible if another has ≤ risk everywhere, < somewhere. `decision theory`
- **Bayes risk** — Prior-averaged risk. *Key insight:* ∫R(θ,δ)π(θ)dθ; the posterior mean minimizes it under squared error. `decision theory` `bayesian`

### Model Selection & Evaluation  *(foundational; place at top)*
*Choosing among models and judging fit. (Cross-validation, bootstrap, ROC/AUC already exist under ML — `[cross-link]`.)*

- **AIC** — Predictive penalty. *Key insight:* AIC = 2k − 2 ln L̂; estimates out-of-sample loss; lower is better. `model selection`
- **BIC** — Consistency penalty. *Key insight:* BIC = k ln n − 2 ln L̂; heavier than AIC, consistent for the true model. `model selection`
- **Mallows' Cp** — Fit vs complexity. *Key insight:* Cp = RSS/σ̂² − n + 2k; Cp ≈ k indicates good fit. `model selection`
- **WAIC & DIC** — Bayesian criteria. *Key insight:* posterior fit minus an effective-parameter penalty; WAIC uses the log pointwise predictive density. `model selection` `bayesian`
- **Likelihood-ratio test (nested)** — Earn the parameters. *Key insight:* 2(ℓ_full − ℓ_reduced) ~ χ²_(Δdf) under the null. `model comparison`
- **Adjusted R² & deviance** — Penalized fit. *Key insight:* adj. R² = 1 − (1−R²)(n−1)/(n−k−1); deviance = −2 ln L vs a saturated model. `goodness-of-fit`
- **Stepwise & best-subset** — Predictor search. *Key insight:* greedily add/drop (or exhaustively search) by an IC; prone to selection bias — `[cross-link]` cross-validation. `variable selection`

### Survey Sampling & Design-Based Inference
*Randomness from the design, not a model — polls, censuses, surveys. (Stratified sampling exists under Experimental Design — `[cross-link]`.)*

- **Simple random sampling** — The baseline. *Key insight:* each size-n subset equally likely; Var(X̄)=(σ²/n)(1−n/N) with finite-population correction. `sampling`
- **Systematic sampling** — Every k-th unit. *Key insight:* random start then step k=N/n; efficient unless the frame has periodicity matching k. `sampling`
- **Cluster sampling** — Sample groups. *Key insight:* cheaper, but variance is inflated by the intra-cluster correlation ρ. `sampling` `group-level`
- **Multistage sampling** — Nested selection. *Key insight:* chain selections (regions→towns→households); variance combines across stages. `sampling`
- **Probability-proportional-to-size** — Size-weighted odds. *Key insight:* include unit i with probability ∝ its size; pairs with Horvitz-Thompson. `sampling`
- **Horvitz-Thompson** — Unbiased totals. *Key insight:* total̂ = Σ_(i∈s) yᵢ/πᵢ, weighting by inverse inclusion probability πᵢ. `design-based`
- **Ratio & regression estimators** — Borrow strength. *Key insight:* a correlated auxiliary with known total corrects ȳ; ratio est. = (ȳ/x̄)·X. `design-based` `efficiency`
- **Post-stratification & raking** — Reweight to known margins. *Key insight:* adjust weights so weighted margins match the population (iterative proportional fitting for raking). `weighting`
- **Design effect (DEFF)** — Cost of complexity. *Key insight:* DEFF = Var_design/Var_SRS; effective n = n/DEFF. `variance`
- **Replicate-weight variance** — Variance for weighted data. *Key insight:* recompute the estimate on perturbed weight sets (jackknife/BRR); their spread is the variance. `variance` `weighting`

### Nonparametric & Smoothing Methods
*Let the data choose the shape. (kNN, bootstrap exist under ML — `[cross-link]`.)*

- **Kernel density estimation** — Smooth histogram. *Key insight:* f̂(x)=(1/nh)ΣK((x−xᵢ)/h); bandwidth h sets the bias–variance trade-off. `density`
- **Kernel / local regression** — Local fits. *Key insight:* a kernel-weighted local mean/line; LOESS fits a local polynomial. `smoothing`
- **Splines** — Smooth piecewise curves. *Key insight:* polynomials joined at knots; smoothing splines penalize ∫(f″)² to control wiggliness. `smoothing`
- **Generalized additive models** — Smooth + interpretable. *Key insight:* g(E[y]) = β₀ + Σ fⱼ(xⱼ), each fⱼ a smooth term. `smoothing` `regression`
- **Permutation & randomization tests** — Shuffle the null. *Key insight:* build the null by relabeling; p = fraction of permutations at least as extreme. `resampling` `testing`
- **Empirical CDF & quantiles** — Distribution-free description. *Key insight:* F̂ₙ(x)=(1/n)Σ1{xᵢ≤x}; converges uniformly to F (Glivenko-Cantelli). `distribution`

### Multivariate Analysis
*Many correlated variables at once. (PCA, t-SNE, UMAP, clustering exist under ML — `[cross-link]`.)*

- **Factor analysis** — Latent common factors. *Key insight:* Σ = ΛΛ′ + Ψ — factors Λ explain shared covariance, Ψ the unique variances (unlike PCA, it models error). `latent variables`
- **LDA / QDA** — Gaussian classifiers. *Key insight:* class-conditional Gaussians; shared covariance ⇒ linear boundary (LDA), separate ⇒ quadratic (QDA). `classification`
- **Canonical correlation** — Align two variable sets. *Key insight:* find linear combos a′X, b′Y of maximal correlation — the SVD of the cross-covariance. `association`
- **Multidimensional scaling** — Distances → coordinates. *Key insight:* place points so pairwise distances match a dissimilarity matrix (classical MDS = eigendecomposition of centered distances). `dimensionality reduction`
- **Correspondence analysis** — Categorical MDS. *Key insight:* SVD of the standardized residuals of a contingency table maps rows and categories into one space. `categorical`
- **Hotelling's T²** — Multivariate t-test. *Key insight:* T² = n(x̄−μ)′S⁻¹(x̄−μ), distributed as a scaled F. `means` `multivariate`
- **Copulas** — Dependence apart from marginals. *Key insight:* Sklar's theorem — F(x,y)=C(F_X(x),F_Y(y)); the copula C carries all the dependence. `dependence`

### Spatial Statistics
*Near things are more alike than far things.*

- **Spatial autocorrelation (Moran's I)** — Do nearby values cluster? *Key insight:* I ∝ Σᵢⱼwᵢⱼ(xᵢ−x̄)(xⱼ−x̄)/Σ(xᵢ−x̄)²; ≈ +1 clustered, ≈ −1 dispersed. `dependence`
- **Variograms & kriging** — Optimal interpolation. *Key insight:* model semivariance γ(h) vs distance, then predict as a BLUP — a covariance-weighted average of neighbors. `interpolation` `geostatistics`
- **Gaussian processes** — Distributions over functions. *Key insight:* any finite set of locations is jointly Gaussian with covariance from a kernel k(s,s′); prediction is exact conditional Gaussian. `nonparametric` `bayesian`
- **Point process models** — Model event locations. *Key insight:* specify the intensity λ(s) — Poisson (independent), Cox (random λ), or cluster/Gibbs (interacting). `point pattern`
- **Areal models (CAR/SAR)** — Region-on-neighbor. *Key insight:* a value depends on neighbors via a spatial weights matrix W (conditional vs simultaneous autoregression). `lattice data`
- **Spatial regression** — Regression with spatial error. *Key insight:* y = Xβ + spatially-correlated error (or +ρWy); ignoring it biases the standard errors. `regression` `dependence`

### Meta-Analysis & Evidence Synthesis
*Pool effects across studies, quantify heterogeneity, probe bias — especially load-bearing for an evidence-aggregation site.*

- **Fixed-effect meta-analysis** — One true effect. *Key insight:* pooled = Σwᵢθ̂ᵢ/Σwᵢ with wᵢ = 1/varᵢ (inverse-variance weighting). `pooling`
- **Random-effects meta-analysis** — Effects vary. *Key insight:* add between-study variance τ² to the weights, wᵢ = 1/(varᵢ + τ²). `pooling` `heterogeneity`
- **Heterogeneity (I², τ², Q)** — How much studies differ. *Key insight:* Q = Σwᵢ(θ̂ᵢ−θ̄)²; I² = max(0,(Q−df)/Q) = % of variance from heterogeneity not chance. `heterogeneity`
- **Forest plots** — Visualize the pool. *Key insight:* one row per study (effect ± CI, box ∝ weight) with the pooled diamond beneath. `visualization`
- **Funnel plots & Egger's test** — Detect bias. *Key insight:* plot effect vs precision; asymmetry (Egger's intercept ≠ 0) signals small-study/publication bias. `publication bias`
- **Trim-and-fill** — Bias sensitivity. *Key insight:* impute the studies that would symmetrize the funnel, then re-pool. `publication bias`
- **Network meta-analysis** — Compare 3+ treatments. *Key insight:* combine direct and indirect evidence in one model, assuming consistency around closed loops. `indirect comparison`
- **Individual-participant-data MA** — Pool raw data. *Key insight:* one- or two-stage models on participant-level data enable consistent adjustment and subgroups. `pooling`
- **GRADE** — Grade the evidence. *Key insight:* rate certainty (high→very low), downgrading for risk of bias, inconsistency, indirectness, imprecision, publication bias. `evidence quality`

### Missing Data Methods
*Complete-case analysis quietly biases everything.*

- **Mechanisms (MCAR/MAR/MNAR)** — Why data are missing. *Key insight:* MCAR = independent of all data; MAR = depends only on observed; MNAR = depends on the unseen value (non-ignorable). `foundations`
- **Multiple imputation (MICE)** — Impute with uncertainty. *Key insight:* impute m datasets, analyze each, combine via Rubin's rules (within + between-imputation variance). `imputation`
- **Full-information ML** — Skip imputation. *Key insight:* maximize the observed-data likelihood directly, integrating over the missing values. `likelihood`
- **Expectation-maximization (EM)** — Iterate to convergence. *Key insight:* alternate E-step (expected complete-data log-likelihood) and M-step (maximize it); the likelihood increases monotonically. `algorithm`
- **IPW for missingness** — Reweight responders. *Key insight:* weight complete cases by 1/P(observed) to recover the full-sample distribution. `weighting`
- **Sensitivity analysis (MNAR)** — Stress-test the untestable. *Key insight:* shift imputed values by δ and watch whether conclusions move — MNAR can't be tested, only probed. `robustness`

### Robust Statistics
*Methods that survive a few bad points or broken assumptions.*

- **M-estimators** — Bounded influence. *Key insight:* minimize Σρ(residual) with a ρ that grows sub-quadratically (Huber, Tukey). `robust estimation`
- **Breakdown point** — Contamination tolerance. *Key insight:* the largest fraction of bad data before the estimate blows up (median 50%, mean 0%). `robustness`
- **Influence functions** — Sensitivity to contamination. *Key insight:* IF(x) is the derivative of the estimate w.r.t. a point mass at x; bounded IF ⇒ robust. `diagnostics`
- **Robust regression** — Outlier-resistant fits. *Key insight:* bounded-influence loss (Huber) or fit on the cleanest subset (LTS, RANSAC). `regression` `robust`
- **Trimmed & Winsorized means** — Tame the tails. *Key insight:* drop (trim) or cap (Winsorize) the extreme α% before averaging. `robust` `center`
- **Robust covariance (MCD)** — Resistant scatter. *Key insight:* estimate from the h-subset with the smallest covariance determinant. `multivariate` `robust`

### Computational Statistics
*When the integral won't close, simulate. (MCMC, HMC, VI, bootstrap exist under Bayesian/ML — `[cross-link]`.)*

- **Rejection & importance sampling** — Sample hard targets. *Key insight:* rejection accepts proposals ∝ target/proposal; importance reweights by w = p/q instead. `sampling`
- **Sequential Monte Carlo / particle filters** — Track evolving posteriors. *Key insight:* represent the posterior by weighted particles, propagating and resampling over time. `sampling` `latent state`
- **Approximate Bayesian computation** — Likelihood-free Bayes. *Key insight:* simulate from θ, keep θ whose summaries fall within ε of the observed. `likelihood-free`
- **Gibbs sampling** — Conditional-cycle MCMC. *Key insight:* draw each parameter from its full conditional p(θⱼ|θ₋ⱼ, data); converges to the joint posterior. `posterior sampling`
- **Bootstrap variants** — Resampling for structure. *Key insight:* block (dependent data), parametric (from a fitted model), or wild (random multipliers) bootstraps. `resampling`

### Psychometrics & Measurement
*Turning items and ratings into trustworthy scores.*

- **Classical test theory** — Score = truth + error. *Key insight:* X = T + E; reliability = Var(T)/Var(X). `measurement`
- **Item response theory** — Items and people on one scale. *Key insight:* P(correct) is logistic in (ability − difficulty), scaled by discrimination: a(θ−b) for the 2PL model. `measurement` `latent`
- **Reliability (α, ICC)** — Consistency of a measure. *Key insight:* Cronbach's α = (k/(k−1))(1 − Σσ²ᵢ/σ²_total); ICC partitions variance for inter-rater/test-retest. `reliability`
- **Validity** — Measuring the right thing. *Key insight:* content, criterion, and construct evidence that the instrument captures the intended trait. `validity`
- **Differential item functioning** — Item fairness. *Key insight:* at equal trait level, subgroups respond differently — a bias red flag. `fairness`
- **Generalizability theory** — Multi-source error. *Key insight:* an ANOVA-style decomposition of measurement error across facets (raters, items, occasions) at once. `reliability`

### [OPTIONAL] Extreme Value Theory
*Rare events and tails — finance, climate, insurance.*

- **Generalized extreme value (GEV)** — Block maxima law. *Key insight:* maxima converge to exp(−[1+ξ(x−μ)/σ]^(−1/ξ)); shape ξ sets the tail type. `tails`
- **Peaks-over-threshold / GPD** — Model exceedances. *Key insight:* values above a high threshold follow a Generalized Pareto distribution. `tails`
- **Return levels** — "1-in-N-year" sizes. *Key insight:* the m-period return level is the quantile exceeded once per m periods on average. `rare events`
- **Block maxima** — Fit on maxima. *Key insight:* fit GEV to maxima of equal-length blocks (e.g., annual maxima). `tails`

### [OPTIONAL] Statistical Quality Control
*Detect when a process drifts out of control.*

- **Shewhart control charts** — Out-of-control alarms. *Key insight:* plot a statistic with center ± 3σ limits; a point outside signals an assignable cause. `monitoring`
- **CUSUM** — Catch small shifts. *Key insight:* accumulate (xᵢ − target); a rising sum detects sustained shifts faster than Shewhart. `monitoring`
- **EWMA** — Drift detection. *Key insight:* zₜ = λxₜ + (1−λ)zₜ₋₁; exponentially weighted memory catches gradual change. `monitoring`
- **Process capability (Cp/Cpk)** — Spec conformance. *Key insight:* Cp = (USL−LSL)/6σ; Cpk also penalizes an off-center process. `capability`

### [OPTIONAL] Parametric Survival & Reliability
*Complements the semi-parametric Cox PH and Kaplan-Meier already present.*

- **Accelerated failure time (AFT)** — Time-scale model. *Key insight:* covariates scale survival time directly: log T = Xβ + error (vs Cox's hazard multiplication). `survival`
- **Parametric survival** — Assume a hazard shape. *Key insight:* Weibull h(t)=λp·t^(p−1), exponential constant hazard; fit by ML. `survival`
- **Competing risks** — Mutually exclusive events. *Key insight:* model cause-specific hazards or the cumulative incidence (Fine-Gray subdistribution). `survival`
- **Frailty models** — Unobserved heterogeneity. *Key insight:* a random effect multiplies the hazard to capture within-cluster correlation. `survival` `clustered data`

### [OPTIONAL] Functional & Specialized Data
*Data objects beyond scalars.*

- **Functional data analysis** — Curves as data. *Key insight:* each observation is a function; functional PCA finds the dominant modes of curve variation. `curves`
- **Circular / directional statistics** — Angles and directions. *Key insight:* summarize via the mean resultant vector — you can't average degrees (359° and 1° are close). `specialized`
- **Compositional data** — Parts of a whole. *Key insight:* proportions live on the simplex; analyze log-ratios (CLR/ILR), not raw shares. `specialized`

---

# CONTENT PAYLOAD — ADDITIONS TO EXISTING FAMILIES

> **Skip any already added** (Step 0). The Descriptive family still has no two-variable association measure — that gap is the priority.

### → Descriptive Statistics
- **Covariance** — Joint variability. *Key insight:* Cov(X,Y)=E[(X−μ_X)(Y−μ_Y)]; sign = direction, scale depends on units. `spread` `dependence`
- **Pearson correlation** — Linear association. *Key insight:* r = Cov(X,Y)/(σ_Xσ_Y) ∈ [−1,1]; linear only. `association`
- **Spearman & Kendall** — Monotone association. *Key insight:* correlation on ranks (Spearman) or concordant−discordant pairs (Kendall τ). `association` `robust`
- **Coefficient of variation** — Scale-free dispersion. *Key insight:* CV = σ/μ; compares spread across different scales. `spread`
- **Geometric & harmonic mean** — Means for ratios/rates. *Key insight:* GM = (∏xᵢ)^(1/n) for multiplicative growth; HM = n/Σ(1/xᵢ) for averaging rates. `center`
- **Range & MAD** — Simple/robust spread. *Key insight:* range = max−min (fragile); MAD = median(|xᵢ − median|) (robust). `spread` `robust`

### → Inferential Statistics (Frequentist)
- **Welch's t-test** — Unequal variances. *Key insight:* a t-test with Satterthwaite-adjusted df; the safer default over Student's. `means` `two groups`
- **McNemar's test** — Paired binary data. *Key insight:* tests the discordant pairs: (b−c)²/(b+c) ~ χ²₁. `categorical` `within-subjects`
- **Friedman test** — Nonparametric RM-ANOVA. *Key insight:* rank within each block, then test for differing mean ranks across conditions. `nonparametric` `within-subjects`
- **Levene's & Bartlett's** — Equal-variance tests. *Key insight:* H₀ of equal variances; Levene is robust to non-normality, Bartlett is sensitive to it. `variance` `assumptions`
- **Equivalence (TOST)** — Prove "no meaningful difference." *Key insight:* two one-sided tests against ±margins; reject both ⇒ effect within bounds. `equivalence`

### → Regression & Prediction
- **Generalized additive models** — Smooth GLM terms. *Key insight:* g(E[y]) = β₀ + Σfⱼ(xⱼ) — flexible yet interpretable. `smoothing` `nonlinear`
- **Generalized estimating equations** — Population-averaged. *Key insight:* a working correlation structure + robust (sandwich) SEs; the marginal counterpart to mixed models. `clustered data`
- **Tobit / censored regression** — Bounded outcomes. *Key insight:* model a latent y* observed only above/below a threshold; the likelihood mixes density and censoring probability. `censored outcome`
- **Zero-inflated / hurdle** — Excess zeros. *Key insight:* a two-part model — one process for the zeros, one for the counts. `count data`
- **Spline / polynomial regression** — Curvature in a linear model. *Key insight:* expand x into basis functions to fit nonlinearity. `nonlinear`

### → Bayesian Methods
- **Gibbs sampling** — Conditional-cycle MCMC. *Key insight:* draw each parameter from its full conditional in turn. `posterior sampling`
- **Conjugate priors** — Closed-form updates. *Key insight:* prior and posterior share a family (Beta-Binomial, Normal-Normal, Gamma-Poisson). `priors`
- **Prior elicitation & sensitivity** — Stress the prior. *Key insight:* vary the prior and check whether the posterior conclusions hold. `priors` `robustness`
- **Approximate Bayesian computation** — Likelihood-free Bayes. *Key insight:* simulate-and-compare against observed summaries. `likelihood-free`

### → Experimental Design
- **Response surface methodology** — Optimize over factors. *Key insight:* fit a low-order polynomial over factor space and climb toward the optimum (central composite designs). `optimization`
- **Split-plot designs** — Two randomization levels. *Key insight:* hard-to-change factors on whole plots, easy ones on subplots — two error terms. `multi-factor`
- **Group-sequential designs** — Planned interim looks. *Key insight:* α-spending (O'Brien-Fleming) preserves the overall Type-I rate across analyses. `adaptive`
- **Adaptive / platform trials** — Modify mid-trial. *Key insight:* pre-specified rules change allocation, arms, or sample size as data accrue. `adaptive`

### → Causal Inference
- **Doubly-robust (AIPW)** — Two shots at consistency. *Key insight:* combine outcome regression and IPW; consistent if *either* model is correct. `observational causal`
- **Targeted maximum likelihood (TMLE)** — Efficient + robust. *Key insight:* a targeting step updates an initial estimate to remove residual confounding bias. `observational causal`
- **Marginal structural models / g-methods** — Time-varying confounding. *Key insight:* weight by inverse probability of the treatment *history*. `longitudinal causal`
- **Front-door criterion** — Identify through a mediator. *Key insight:* a fully mediating M identifies X→Y even with unmeasured X–Y confounding. `identification`
- **Causal forests** — Heterogeneous effects. *Key insight:* random-forest machinery estimates the conditional treatment effect τ(x). `heterogeneous effects`

### → Signal Processing & Time Series
- **ARCH / GARCH** — Volatility clustering. *Key insight:* GARCH(1,1): σ²ₜ = ω + αε²ₜ₋₁ + βσ²ₜ₋₁ — variance is forecastable. `volatility`
- **Exponential smoothing (Holt-Winters)** — Weighted recent history. *Key insight:* recursive level/trend/season equations with exponentially decaying weights. `forecasting`
- **Hidden Markov models** — Latent states emit data. *Key insight:* an unobserved Markov chain drives observations; fit by Baum-Welch (EM), decode by Viterbi. `latent state`
- **Change-point detection** — Find regime shifts. *Key insight:* locate times where parameters change (CUSUM, PELT, Bayesian online). `structural break`
- **Dynamic time warping** — Align by shape. *Key insight:* the time alignment minimizing cumulative distance between two series, via dynamic programming. `alignment`

### → Information Theory
- **Conditional entropy** — Uncertainty given Y. *Key insight:* H(X|Y) = H(X,Y) − H(Y). `uncertainty`
- **Rate-distortion theory** — Lossy-compression limit. *Key insight:* R(D) = minimum bits/symbol to reconstruct within distortion D. `compression`
- **Minimum description length** — Occam, formalized. *Key insight:* pick the model giving the shortest description of model + data. `model selection`

### → Machine Learning Methods
- **Neural networks / deep learning** — Composable nonlinearity. *Key insight:* stack linear maps + nonlinear activations; train by backpropagation (chain-rule gradients). `deep learning`
- **CNNs / RNNs / transformers** — Architectural priors. *Key insight:* weight-sharing convolutions (space), recurrence (sequence), or self-attention (all-pairs context). `deep learning`
- **Reinforcement learning** — Learn from reward. *Key insight:* maximize expected cumulative reward; value/policy methods satisfy the Bellman equation. `sequential decisions`
- **Anomaly detection** — Flag the abnormal. *Key insight:* low density / high reconstruction error under a model of "normal." `detection`
- **Feature importance & SHAP** — Attribute predictions. *Key insight:* SHAP assigns each feature its Shapley value — fair credit averaged over all orderings. `interpretability`
- **Regularization (dropout, early stopping)** — Curb overfitting. *Key insight:* constrain effective capacity to improve generalization. `generalization`

---

# COLOR & GROUPING — resolve the 9-color saturation first

The existing scheme already spends gray, blue, green, amber, orange, teal, rose, violet, and purple. Adding ~13 flat families would need ~13 more perceptually distinct hues, which don't exist — neighbors like cyan/teal, indigo/blue/violet, lime/green, pink/rose collide. **Pick one of these before assigning colors:**

- **Option A (recommended) — add a tier above families.** Introduce three sections: **Foundations** (Probability & Distributions, Estimation & Inference Theory, Model Selection), **Core Methods** (the existing 9), **Specialized & Applied** (the rest). Color stays at family level, but related new families share a hue with shade steps. This scales and signals structure.
- **Option B — consolidate to fit a flat scheme.** Merge the 13 into ~6 color-bearing families: *Foundations & Theory* · *Sampling & Survey* · *Nonparametric, Robust & Computational* · *Multivariate & Spatial* · *Evidence Synthesis & Missing Data* · *Measurement & Psychometrics*. Six new hues on top of nine is tight but workable (e.g., indigo, cyan, lime, fuchsia, red, brown). Use sub-headers inside each.

If forced to stay flat without consolidating, lean on the label + structure (color is already not the sole differentiator) and use shade variation within a hue for related families. **Don't ship 15+ near-identical colors.**

---

# ACCEPTANCE CRITERIA

- [ ] Step 0 done: current methods enumerated; no method re-added that already exists; every `[cross-link]` honored.
- [ ] All pre-existing families and methods unchanged; counts recomputed from data (not hard-coded).
- [ ] Every new card has the full live schema, including a populated **key insight** field from the seeds.
- [ ] New cards expand to the textbook view (problem · key insight · example; SVG only where iconic), matching the existing voice and depth — not left permanently shallower.
- [ ] Any model-generated formula the builder was unsure of is flagged for review, not fabricated.
- [ ] Filter (name/description/key insight/tag), Expand all, Collapse all all include the new content.
- [ ] `/statistics/methods` still works; the top-10 selection is untouched.
- [ ] Color/grouping resolved via Option A or B; no wall of indistinguishable hues.
- [ ] Footer note intact; "last updated" date bumped.
