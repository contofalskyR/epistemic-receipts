// Pure TS statistical primitives. No external dependencies.
// Used by lib/voteAnalysis.ts for partisan-independence tests
// and Bayes-Factor partisan-signal computation.

// Lanczos approximation for log Gamma. Accurate to ~15 digits for x > 0.
const LANCZOS_G = 7;
const LANCZOS_P = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];

export function lgamma(x: number): number {
  if (x < 0.5) {
    // Reflection formula: Γ(x)Γ(1-x) = π / sin(πx)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }
  x -= 1;
  let a = LANCZOS_P[0];
  const t = x + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_P.length; i++) {
    a += LANCZOS_P[i] / (x + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// Regularized lower incomplete gamma function P(a, x) = γ(a,x) / Γ(a).
// Series expansion for x < a+1, continued fraction for x >= a+1.
// Convergence-tested to ~1e-12 for the ranges we use (df 1..1000, x 0..1000).
function gammaP(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 0;
  if (x < a + 1) {
    // Series expansion
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
  }
  // Continued fraction (Lentz's method)
  const FPMIN = 1e-300;
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  const q = Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  return 1 - q;
}

// Chi-square CDF: P(X^2 <= x | df)
export function chiSquareCdf(x: number, df: number): number {
  if (x <= 0) return 0;
  return gammaP(df / 2, x / 2);
}

// One-sided p-value: P(X^2 >= stat | df)
export function chiSquarePValue(stat: number, df: number): number {
  if (!Number.isFinite(stat) || stat <= 0 || df <= 0) return 1;
  return 1 - chiSquareCdf(stat, df);
}

// log B(y+1, n-y+1) = log marginal likelihood under Beta(1,1) prior and
// Binomial(n, θ) likelihood with y successes. This is the conjugate-pair
// closed form used in the Bayes Factor partisan-signal computation.
export function logMarginalLikelihood(yes: number, n: number): number {
  if (yes < 0 || n < 0 || yes > n) return -Infinity;
  return lgamma(yes + 1) + lgamma(n - yes + 1) - lgamma(n + 2);
}
