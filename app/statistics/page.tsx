"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Method = {
  name: string;
  description: string;
  usedFor: string[];
  problem: string;
  keyInsight: string;
  example: string;
  figure?: string;
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
  gray: { headerBg: "bg-gray-900/60", headerBorder: "border-gray-700", headerText: "text-gray-200", chipBg: "bg-gray-800", chipText: "text-gray-400", cardBorder: "border-gray-800", cardHover: "hover:border-gray-600", accent: "text-gray-400" },
  blue: { headerBg: "bg-blue-950/40", headerBorder: "border-blue-900", headerText: "text-blue-200", chipBg: "bg-blue-950/60", chipText: "text-blue-300", cardBorder: "border-blue-950/70", cardHover: "hover:border-blue-700", accent: "text-blue-400" },
  green: { headerBg: "bg-emerald-950/40", headerBorder: "border-emerald-900", headerText: "text-emerald-200", chipBg: "bg-emerald-950/60", chipText: "text-emerald-300", cardBorder: "border-emerald-950/70", cardHover: "hover:border-emerald-700", accent: "text-emerald-400" },
  purple: { headerBg: "bg-purple-950/40", headerBorder: "border-purple-900", headerText: "text-purple-200", chipBg: "bg-purple-950/60", chipText: "text-purple-300", cardBorder: "border-purple-950/70", cardHover: "hover:border-purple-700", accent: "text-purple-400" },
  amber: { headerBg: "bg-amber-950/40", headerBorder: "border-amber-900", headerText: "text-amber-200", chipBg: "bg-amber-950/60", chipText: "text-amber-300", cardBorder: "border-amber-950/70", cardHover: "hover:border-amber-700", accent: "text-amber-400" },
  orange: { headerBg: "bg-orange-950/40", headerBorder: "border-orange-900", headerText: "text-orange-200", chipBg: "bg-orange-950/60", chipText: "text-orange-300", cardBorder: "border-orange-950/70", cardHover: "hover:border-orange-700", accent: "text-orange-400" },
  teal: { headerBg: "bg-teal-950/40", headerBorder: "border-teal-900", headerText: "text-teal-200", chipBg: "bg-teal-950/60", chipText: "text-teal-300", cardBorder: "border-teal-950/70", cardHover: "hover:border-teal-700", accent: "text-teal-400" },
  rose: { headerBg: "bg-rose-950/40", headerBorder: "border-rose-900", headerText: "text-rose-200", chipBg: "bg-rose-950/60", chipText: "text-rose-300", cardBorder: "border-rose-950/70", cardHover: "hover:border-rose-700", accent: "text-rose-400" },
  violet: { headerBg: "bg-violet-950/40", headerBorder: "border-violet-900", headerText: "text-violet-200", chipBg: "bg-violet-950/60", chipText: "text-violet-300", cardBorder: "border-violet-950/70", cardHover: "hover:border-violet-700", accent: "text-violet-400" },
};

const FIGURES: Record<string, string> = {
  meanSd: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-sm" preserveAspectRatio="xMidYMid meet"><line x1="20" y1="80" x2="180" y2="80" stroke="#374151" stroke-width="0.5"/><path d="M 20 80 C 55 80 70 80 80 55 C 92 14 108 14 120 55 C 130 80 145 80 180 80" fill="none" stroke="#9ca3af" stroke-width="1.5"/><line x1="100" y1="80" x2="100" y2="22" stroke="#e5e7eb" stroke-dasharray="2,2" stroke-width="0.7"/><line x1="80" y1="80" x2="80" y2="55" stroke="#6b7280" stroke-dasharray="1,2" stroke-width="0.7"/><line x1="120" y1="80" x2="120" y2="55" stroke="#6b7280" stroke-dasharray="1,2" stroke-width="0.7"/><text x="100" y="93" text-anchor="middle" fill="#9ca3af" font-size="9" font-family="ui-monospace, monospace">μ</text><text x="80" y="93" text-anchor="middle" fill="#6b7280" font-size="7" font-family="ui-monospace, monospace">μ−σ</text><text x="120" y="93" text-anchor="middle" fill="#6b7280" font-size="7" font-family="ui-monospace, monospace">μ+σ</text></svg>`,
  tTest: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-sm"><line x1="10" y1="80" x2="190" y2="80" stroke="#374151" stroke-width="0.5"/><path d="M 10 80 C 35 80 48 80 58 55 C 70 18 80 18 92 55 C 102 80 115 80 135 80 Z" fill="rgba(96,165,250,0.18)" stroke="#60a5fa" stroke-width="1.3"/><path d="M 65 80 C 85 80 98 80 108 55 C 120 18 130 18 142 55 C 152 80 165 80 190 80 Z" fill="rgba(244,114,182,0.18)" stroke="#f472b6" stroke-width="1.3"/><text x="75" y="14" text-anchor="middle" fill="#60a5fa" font-size="8" font-family="ui-monospace, monospace">x̄₁</text><text x="125" y="14" text-anchor="middle" fill="#f472b6" font-size="8" font-family="ui-monospace, monospace">x̄₂</text><line x1="75" y1="80" x2="75" y2="20" stroke="#60a5fa" stroke-width="0.5" stroke-dasharray="1,2"/><line x1="125" y1="80" x2="125" y2="20" stroke="#f472b6" stroke-width="0.5" stroke-dasharray="1,2"/></svg>`,
  linearReg: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-sm"><line x1="20" y1="85" x2="185" y2="85" stroke="#374151" stroke-width="0.5"/><line x1="20" y1="10" x2="20" y2="85" stroke="#374151" stroke-width="0.5"/><line x1="28" y1="80" x2="175" y2="20" stroke="#10b981" stroke-width="1.3"/><circle cx="35" cy="75" r="2" fill="#9ca3af"/><circle cx="50" cy="78" r="2" fill="#9ca3af"/><circle cx="60" cy="63" r="2" fill="#9ca3af"/><circle cx="75" cy="58" r="2" fill="#9ca3af"/><circle cx="85" cy="62" r="2" fill="#9ca3af"/><circle cx="95" cy="46" r="2" fill="#9ca3af"/><circle cx="110" cy="40" r="2" fill="#9ca3af"/><circle cx="120" cy="44" r="2" fill="#9ca3af"/><circle cx="135" cy="32" r="2" fill="#9ca3af"/><circle cx="150" cy="34" r="2" fill="#9ca3af"/><circle cx="165" cy="22" r="2" fill="#9ca3af"/><text x="25" y="18" fill="#6b7280" font-size="7" font-family="ui-monospace, monospace">y</text><text x="180" y="93" fill="#6b7280" font-size="7" font-family="ui-monospace, monospace">x</text></svg>`,
  logisticReg: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-sm"><line x1="20" y1="78" x2="185" y2="78" stroke="#374151" stroke-width="0.5"/><line x1="20" y1="14" x2="185" y2="14" stroke="#374151" stroke-width="0.5" stroke-dasharray="1,3"/><line x1="100" y1="14" x2="100" y2="78" stroke="#374151" stroke-width="0.5" stroke-dasharray="2,2"/><path d="M 20 76 C 55 76 75 76 90 50 C 105 24 125 18 185 16" fill="none" stroke="#10b981" stroke-width="1.6"/><text x="14" y="17" text-anchor="end" fill="#6b7280" font-size="7" font-family="ui-monospace, monospace">1</text><text x="14" y="81" text-anchor="end" fill="#6b7280" font-size="7" font-family="ui-monospace, monospace">0</text><text x="100" y="93" text-anchor="middle" fill="#6b7280" font-size="7" font-family="ui-monospace, monospace">x</text></svg>`,
  bayes: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-sm"><path d="M 6 75 C 14 75 17 75 22 55 C 30 28 38 28 46 55 C 50 75 53 75 62 75" fill="rgba(156,163,175,0.15)" stroke="#9ca3af" stroke-width="1.2"/><text x="34" y="90" text-anchor="middle" fill="#9ca3af" font-size="7" font-family="ui-monospace, monospace">prior</text><text x="72" y="55" text-anchor="middle" fill="#6b7280" font-size="11" font-family="ui-monospace, monospace">×</text><path d="M 82 75 C 92 75 96 75 102 60 C 110 38 118 38 126 60 C 130 75 134 75 144 75" fill="rgba(251,191,36,0.15)" stroke="#fbbf24" stroke-width="1.2"/><text x="113" y="90" text-anchor="middle" fill="#fbbf24" font-size="7" font-family="ui-monospace, monospace">likelihood</text><text x="153" y="55" text-anchor="middle" fill="#6b7280" font-size="11" font-family="ui-monospace, monospace">∝</text><path d="M 163 75 C 170 75 173 75 177 42 C 182 14 188 14 192 42 C 195 75 197 75 199 75" fill="rgba(167,139,250,0.2)" stroke="#a78bfa" stroke-width="1.5"/><text x="181" y="90" text-anchor="middle" fill="#a78bfa" font-size="7" font-family="ui-monospace, monospace">posterior</text></svg>`,
  mutualInfo: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-sm"><circle cx="80" cy="50" r="34" fill="rgba(244,114,182,0.18)" stroke="#f472b6" stroke-width="1.3"/><circle cx="120" cy="50" r="34" fill="rgba(96,165,250,0.18)" stroke="#60a5fa" stroke-width="1.3"/><text x="56" y="18" text-anchor="middle" fill="#f472b6" font-size="9" font-family="ui-monospace, monospace">H(X)</text><text x="144" y="18" text-anchor="middle" fill="#60a5fa" font-size="9" font-family="ui-monospace, monospace">H(Y)</text><text x="100" y="54" text-anchor="middle" fill="#e5e7eb" font-size="8" font-family="ui-monospace, monospace">I(X;Y)</text></svg>`,
  pca: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-sm"><circle cx="60" cy="72" r="1.6" fill="#9ca3af"/><circle cx="70" cy="68" r="1.6" fill="#9ca3af"/><circle cx="80" cy="62" r="1.6" fill="#9ca3af"/><circle cx="85" cy="56" r="1.6" fill="#9ca3af"/><circle cx="95" cy="52" r="1.6" fill="#9ca3af"/><circle cx="100" cy="48" r="1.6" fill="#9ca3af"/><circle cx="105" cy="44" r="1.6" fill="#9ca3af"/><circle cx="115" cy="38" r="1.6" fill="#9ca3af"/><circle cx="120" cy="35" r="1.6" fill="#9ca3af"/><circle cx="130" cy="30" r="1.6" fill="#9ca3af"/><circle cx="140" cy="26" r="1.6" fill="#9ca3af"/><circle cx="72" cy="78" r="1.6" fill="#9ca3af"/><circle cx="92" cy="64" r="1.6" fill="#9ca3af"/><circle cx="112" cy="48" r="1.6" fill="#9ca3af"/><circle cx="128" cy="40" r="1.6" fill="#9ca3af"/><defs><marker id="pcaArrow1" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><polygon points="0 0, 6 3, 0 6" fill="#8b5cf6"/></marker><marker id="pcaArrow2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><polygon points="0 0, 6 3, 0 6" fill="#a78bfa"/></marker></defs><line x1="55" y1="82" x2="150" y2="22" stroke="#8b5cf6" stroke-width="1.5" marker-end="url(#pcaArrow1)"/><line x1="93" y1="58" x2="118" y2="78" stroke="#a78bfa" stroke-width="1.2" marker-end="url(#pcaArrow2)"/><text x="155" y="22" fill="#8b5cf6" font-size="7" font-family="ui-monospace, monospace">PC1</text><text x="122" y="82" fill="#a78bfa" font-size="7" font-family="ui-monospace, monospace">PC2</text></svg>`,
  rocAuc: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-sm"><line x1="22" y1="90" x2="182" y2="90" stroke="#374151" stroke-width="0.5"/><line x1="22" y1="10" x2="22" y2="90" stroke="#374151" stroke-width="0.5"/><line x1="22" y1="90" x2="182" y2="10" stroke="#6b7280" stroke-width="0.7" stroke-dasharray="3,3"/><path d="M 22 90 C 34 50 60 20 100 14 C 140 11 162 10 182 10 L 182 90 Z" fill="rgba(139,92,246,0.15)" stroke="none"/><path d="M 22 90 C 34 50 60 20 100 14 C 140 11 162 10 182 10" fill="none" stroke="#8b5cf6" stroke-width="1.6"/><text x="105" y="55" text-anchor="middle" fill="#8b5cf6" font-size="9" font-family="ui-monospace, monospace">AUC</text><text x="180" y="98" text-anchor="end" fill="#6b7280" font-size="7" font-family="ui-monospace, monospace">FPR</text><text x="26" y="16" fill="#6b7280" font-size="7" font-family="ui-monospace, monospace">TPR</text></svg>`,
  power: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-sm"><line x1="10" y1="78" x2="190" y2="78" stroke="#374151" stroke-width="0.5"/><path d="M 10 78 C 30 78 42 78 52 55 C 65 18 75 18 88 55 C 98 78 110 78 130 78 Z" fill="rgba(96,165,250,0.12)" stroke="#60a5fa" stroke-width="1.2"/><path d="M 70 78 C 90 78 100 78 110 55 C 122 18 132 18 144 55 C 154 78 168 78 190 78 Z" fill="rgba(244,114,182,0.12)" stroke="#f472b6" stroke-width="1.2"/><path d="M 105 78 L 105 51 C 110 64 116 73 130 78 Z" fill="rgba(96,165,250,0.55)" stroke="none"/><path d="M 70 78 L 105 78 L 105 51 C 100 64 92 73 80 76 L 70 78 Z" fill="rgba(244,114,182,0.45)" stroke="none"/><line x1="105" y1="22" x2="105" y2="78" stroke="#e5e7eb" stroke-width="0.6" stroke-dasharray="2,2"/><text x="50" y="14" text-anchor="middle" fill="#60a5fa" font-size="8" font-family="ui-monospace, monospace">H₀</text><text x="150" y="14" text-anchor="middle" fill="#f472b6" font-size="8" font-family="ui-monospace, monospace">H₁</text><text x="118" y="74" fill="#bfdbfe" font-size="8" font-family="ui-monospace, monospace">α</text><text x="92" y="74" text-anchor="end" fill="#fbcfe8" font-size="8" font-family="ui-monospace, monospace">β</text><text x="105" y="93" text-anchor="middle" fill="#9ca3af" font-size="7" font-family="ui-monospace, monospace">crit</text></svg>`,
  kaplanMeier: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-sm"><line x1="22" y1="85" x2="185" y2="85" stroke="#374151" stroke-width="0.5"/><line x1="22" y1="14" x2="22" y2="85" stroke="#374151" stroke-width="0.5"/><line x1="22" y1="14" x2="185" y2="14" stroke="#374151" stroke-width="0.4" stroke-dasharray="1,3"/><path d="M 22 18 L 42 18 L 42 26 L 62 26 L 62 36 L 82 36 L 82 42 L 102 42 L 102 54 L 122 54 L 122 62 L 142 62 L 142 70 L 162 70 L 162 76 L 185 76" fill="none" stroke="#10b981" stroke-width="1.6"/><circle cx="42" cy="18" r="1.5" fill="#10b981"/><circle cx="62" cy="26" r="1.5" fill="#10b981"/><circle cx="82" cy="36" r="1.5" fill="#10b981"/><circle cx="102" cy="42" r="1.5" fill="#10b981"/><circle cx="122" cy="54" r="1.5" fill="#10b981"/><circle cx="142" cy="62" r="1.5" fill="#10b981"/><circle cx="162" cy="70" r="1.5" fill="#10b981"/><text x="26" y="14" fill="#6b7280" font-size="7" font-family="ui-monospace, monospace">S(t)</text><text x="180" y="93" text-anchor="end" fill="#6b7280" font-size="7" font-family="ui-monospace, monospace">time</text></svg>`,
  arima: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-sm"><line x1="10" y1="85" x2="190" y2="85" stroke="#374151" stroke-width="0.5"/><path d="M 12 62 L 22 56 L 32 64 L 42 50 L 52 58 L 62 44 L 72 52 L 82 38 L 92 46 L 102 34 L 112 40 L 122 30" fill="none" stroke="#14b8a6" stroke-width="1.4"/><line x1="122" y1="10" x2="122" y2="85" stroke="#6b7280" stroke-width="0.5" stroke-dasharray="2,2"/><path d="M 122 30 L 188 6 L 188 52 Z" fill="rgba(20,184,166,0.16)" stroke="none"/><path d="M 122 30 L 188 26" fill="none" stroke="#14b8a6" stroke-width="1.4" stroke-dasharray="3,2"/><text x="65" y="14" text-anchor="middle" fill="#6b7280" font-size="7" font-family="ui-monospace, monospace">observed</text><text x="155" y="16" text-anchor="middle" fill="#14b8a6" font-size="7" font-family="ui-monospace, monospace">forecast + CI</text></svg>`,
};

const FAMILIES: Family[] = [
  {
    slug: "descriptive",
    name: "Descriptive Statistics",
    blurb: "Summarize the shape, center, and spread of a sample — no inference.",
    color: "gray",
    methods: [
      {
        name: "Mean",
        description: "Arithmetic average — central tendency for symmetric distributions.",
        usedFor: ["center", "interval data"],
        problem: "How do you summarize where a distribution is centered when values are roughly balanced?",
        keyInsight: "Each observation contributes equally to a balance point: `x̄ = (1/n) Σxᵢ`. Move any point and the mean shifts by exactly Δx/n.",
        example: "Average GDP per capita across 50 EU regions tells you the typical regional output — but one Luxembourg-sized outlier visibly distorts the figure.",
        figure: FIGURES.meanSd,
      },
      {
        name: "Median",
        description: "Middle value — robust to outliers and skew.",
        usedFor: ["center", "robust"],
        problem: "How do you describe the center when a few extreme values would dominate the mean?",
        keyInsight: "The value at rank ⌈n/2⌉ after sorting — half the data lies above, half below. Moving any non-middle point by any amount leaves it unchanged.",
        example: "U.S. median household income (~$75k) vs. mean income (~$110k) — the gap is the top 1% pulling the mean upward while leaving the median alone.",
      },
      {
        name: "Mode",
        description: "Most frequent value — only useful summary for categorical data.",
        usedFor: ["center", "categorical"],
        problem: "What's the most likely outcome when the variable isn't even numeric?",
        keyInsight: "The value (or category) with the highest frequency — the only center summary that makes sense for nominal data, where order doesn't apply.",
        example: "The modal blood type in the U.S. is O+ (~37% of the population); the mean blood type is meaningless.",
      },
      {
        name: "Standard Deviation",
        description: "Average distance from the mean — units of the variable.",
        usedFor: ["spread"],
        problem: "Two distributions can share a mean but have wildly different spread — how do you quantify that in the original units?",
        keyInsight: "Root-mean-square distance from the mean: `σ = √(Σ(xᵢ−x̄)² / n)`. Reported in the same units as x, so it's directly comparable to the data.",
        example: "Two stocks each return 8% on average — but one with σ = 2% is bond-like, the other with σ = 30% is a casino.",
      },
      {
        name: "Variance",
        description: "Squared average distance from the mean — additive across independent sources.",
        usedFor: ["spread"],
        problem: "How do you make spreads additive — so the spread of a sum of independent variables is the sum of their spreads?",
        keyInsight: "`σ² = E[(X−μ)²]`. For independent variables `Var(X+Y) = Var(X) + Var(Y)` — a property standard deviations cannot share directly.",
        example: "Portfolio variance from 10 uncorrelated stocks is the sum of individual variances — the diversification math behind modern portfolio theory.",
      },
      {
        name: "Percentile",
        description: "Cut-point below which a given share of the data falls.",
        usedFor: ["position", "ranking"],
        problem: "How do you place a single observation in the context of the whole distribution?",
        keyInsight: "The p-th percentile is the value below which p% of observations fall — a rank converted to a unit-free position on the distribution.",
        example: "A baby's weight at the 90th percentile means 90% of same-age babies weigh less; below the 3rd percentile is when pediatricians intervene.",
      },
      {
        name: "Quartile",
        description: "25th / 50th / 75th percentiles — five-number summary backbone.",
        usedFor: ["position"],
        problem: "You want a compact summary of an entire distribution's shape, not just its center.",
        keyInsight: "Q1, Q2 (median), and Q3 split the data into four equal-count bins. Q1, median, Q3, plus min and max give Tukey's five-number summary.",
        example: "Salary bands published as `25th / 50th / 75th = $80k / $110k / $160k` describe band shape compactly with three numbers.",
      },
      {
        name: "IQR",
        description: "Interquartile range (Q3 − Q1) — robust spread measure used in boxplots.",
        usedFor: ["spread", "robust"],
        problem: "Standard deviation can be blown up by a single outlier — how do you measure spread in a way the tails can't dominate?",
        keyInsight: "`IQR = Q3 − Q1` covers the middle 50%. By construction, the bottom 25% and top 25% cannot influence it.",
        example: "A boxplot's whiskers typically extend to Q1 − 1.5·IQR and Q3 + 1.5·IQR; anything past that is flagged as a candidate outlier.",
      },
      {
        name: "Skewness",
        description: "Asymmetry of a distribution — positive tail right, negative tail left.",
        usedFor: ["shape"],
        problem: "Is the distribution lopsided — and if so, which way?",
        keyInsight: "Standardized third central moment: `γ = E[(X−μ)³] / σ³`. Sign tells you which tail is longer; magnitude tells you how lopsided.",
        example: "Income distributions are right-skewed (γ > 0) — a handful of high earners stretch the right tail far beyond any low-end bound.",
      },
      {
        name: "Kurtosis",
        description: "Tailedness of a distribution — high kurtosis = heavy tails / outlier prone.",
        usedFor: ["shape"],
        problem: "Two distributions can share mean and SD but differ dramatically in tail behavior — how often do extreme values happen?",
        keyInsight: "Standardized fourth central moment: `κ = E[(X−μ)⁴] / σ⁴`. Excess kurtosis > 0 means rare extreme events are more likely than a normal predicts.",
        example: "Daily stock returns have excess kurtosis > 5 — black-swan crashes occur far more often than Gaussian models imply, which is what blew up LTCM in 1998.",
      },
    ],
  },
  {
    slug: "inferential-frequentist",
    name: "Inferential Statistics (Frequentist)",
    blurb: "Null-hypothesis significance testing — p-values, confidence intervals, fixed parameters, random data.",
    color: "blue",
    methods: [
      {
        name: "One-sample t-test",
        description: "Test whether a sample mean differs from a known value.",
        usedFor: ["means", "one group"],
        problem: "Does the mean of a single sample differ from a specific hypothesized value, or could the gap be sampling noise?",
        keyInsight: "`t = (x̄ − μ₀) / (s/√n)` — how many standard errors your sample mean is from the hypothesized value, judged against a t-distribution with n−1 df.",
        example: "A factory claims bolts have mean length 100 mm; you measure 30 averaging 99.2 mm with SD 1.5 mm — t ≈ −2.92, p ≈ 0.007, reject.",
      },
      {
        name: "Independent t-test",
        description: "Compare means of two unpaired groups assuming approximate normality.",
        usedFor: ["means", "two groups"],
        problem: "Do two unrelated groups have meaningfully different means, or could the gap be sampling noise?",
        keyInsight: "Divides the observed mean difference by its pooled standard error: `t = (x̄₁ − x̄₂) / √(s²/n₁ + s²/n₂)` — how many standard errors apart the groups are.",
        example: "A drug trial with 50 patients per group shows treated mean = 142, control = 138, pooled SD ≈ 8 — t ≈ 2.5, p ≈ 0.014.",
        figure: FIGURES.tTest,
      },
      {
        name: "Paired t-test",
        description: "Compare two measurements on the same units — eliminates between-subject variance.",
        usedFor: ["means", "within-subjects"],
        problem: "When the same subjects are measured before and after, most variance is between subjects — how do you keep it from drowning the signal?",
        keyInsight: "Compute each subject's difference `dᵢ = post − pre`, then test whether their mean differs from zero. Between-subject variance cancels by construction.",
        example: "30 patients' blood pressure drops by an average of 6 mmHg after a drug, with SD of differences = 5 — t = 6.6, p < 0.001, even though raw pre/post distributions overlap heavily.",
      },
      {
        name: "ANOVA",
        description: "Compare means of 3+ groups — F-test on between vs. within variance.",
        usedFor: ["means", "multi-group"],
        problem: "With 3+ groups, running every pairwise t-test inflates the false-positive rate. Is there any difference among them at all?",
        keyInsight: "F = between-group variance / within-group variance. If groups are truly identical F ≈ 1; if at least one differs, F balloons.",
        example: "Comparing crop yield under 4 fertilizers across 100 plots — F = 8.2 on (3, 96) df, p < 0.001; follow-up tests pinpoint which fertilizer.",
      },
      {
        name: "MANOVA",
        description: "Multivariate ANOVA — multiple correlated outcomes at once.",
        usedFor: ["multivariate"],
        problem: "When an experiment affects multiple correlated outcomes (weight and blood pressure), univariate ANOVAs miss joint effects.",
        keyInsight: "Tests whether the mean vector of all outcomes differs across groups, using the covariance among outcomes to detect joint shifts no single variable captures.",
        example: "An education program might leave reading and math scores both marginal individually, but MANOVA reveals the joint vector shifted significantly.",
      },
      {
        name: "Chi-square test",
        description: "Test independence of two categorical variables in a contingency table.",
        usedFor: ["categorical", "independence"],
        problem: "Are two categorical variables independent, or does knowing one tell you something about the other?",
        keyInsight: "Compare observed cell counts O with those expected under independence E (= row × col / grand total): `χ² = Σ (O − E)² / E`.",
        example: "2×2 table of {smoker, lung cancer} in 1000 patients — observed vs. independence-expected cell counts give χ² = 38, p ≈ 10⁻⁹.",
      },
      {
        name: "Fisher's exact test",
        description: "Exact alternative to chi-square for small-sample 2×2 tables.",
        usedFor: ["categorical", "small sample"],
        problem: "Chi-square's approximation breaks when any expected cell count is below 5 — what do you use for small studies?",
        keyInsight: "Compute the exact probability of observing this table (or anything more extreme) under the null via the hypergeometric distribution — no approximation needed.",
        example: "A pilot study with 8 treated and 8 control patients showing 6 vs. 1 responders — too few subjects for chi-square; Fisher gives p = 0.041.",
      },
      {
        name: "Mann-Whitney U",
        description: "Nonparametric independent-samples test on ranks — no normality required.",
        usedFor: ["nonparametric", "two groups"],
        problem: "When data are skewed or ordinal, the t-test's normality assumption fails — can you still compare two groups?",
        keyInsight: "Rank all values across both groups, then test whether one group's rank sum departs from chance. Depends only on order, not on raw values.",
        example: "Comparing pain ratings on a 1–10 scale between two treatments — the t-test mishandles the bounded discrete scale, but U works directly on ranks.",
      },
      {
        name: "Wilcoxon signed-rank",
        description: "Nonparametric paired test on ranked differences.",
        usedFor: ["nonparametric", "within-subjects"],
        problem: "A paired t-test assumes the differences are roughly normal — if they're skewed or ordinal, what's the alternative?",
        keyInsight: "Rank the absolute differences, attach the sign of each difference, and test whether the signed-rank sum departs from zero.",
        example: "20 subjects rate a website on 1–5 before and after a redesign — Wilcoxon avoids assuming the score differences are normally distributed.",
      },
      {
        name: "Kruskal-Wallis",
        description: "Nonparametric ANOVA — extends Mann-Whitney to 3+ groups.",
        usedFor: ["nonparametric", "multi-group"],
        problem: "ANOVA fails when group distributions are non-normal or ordinal — how do you compare 3+ groups robustly?",
        keyInsight: "Pool all values, rank them globally, then compare mean ranks across groups via a chi-square approximation on the H statistic.",
        example: "Customer satisfaction (1–5) across 5 store locations — Kruskal-Wallis detects whether mean rank differs without assuming normality.",
      },
      {
        name: "Kolmogorov-Smirnov",
        description: "Compare two empirical CDFs or test against a reference distribution.",
        usedFor: ["distribution", "goodness-of-fit"],
        problem: "You want to test the entire shape of a distribution, not just its center.",
        keyInsight: "Statistic D = the largest vertical distance between two empirical CDFs (or between sample CDF and a reference). Tests goodness-of-fit at the distributional level.",
        example: "Comparing a sample of website load times to a fitted lognormal — KS rejects when the sample's tail is heavier than the model predicts.",
      },
      {
        name: "Shapiro-Wilk",
        description: "Test whether a sample is drawn from a normal distribution.",
        usedFor: ["normality"],
        problem: "Many tests assume normality — how do you know whether your sample plausibly came from a normal distribution?",
        keyInsight: "Ratio of an order-statistic-based estimate of variance to the sample variance: W ≈ 1 under normality, drops as the sample departs from it.",
        example: "Before running a t-test on n = 25 quality-control measurements, you run Shapiro-Wilk; W = 0.96, p = 0.43 — normality is not rejected.",
      },
      {
        name: "Bonferroni correction",
        description: "Conservative family-wise error control — divide α by the number of tests.",
        usedFor: ["multiple comparisons"],
        problem: "Running k independent tests at α = 0.05 means roughly 5% × k will be false positives. How do you control the family-wise error rate?",
        keyInsight: "Reject only if `p < α/k`. Crude but always valid: bounds the probability of any false positive across the entire family.",
        example: "A GWAS scans 1M SNPs at α = 5×10⁻⁸ (≈ 0.05 / 1M) — the threshold required to keep the global false-positive risk near 5%.",
      },
      {
        name: "FDR (Benjamini-Hochberg)",
        description: "Control expected proportion of false discoveries — less conservative than Bonferroni.",
        usedFor: ["multiple comparisons"],
        problem: "Bonferroni is so conservative that on a million-test screen you risk discovering nothing real.",
        keyInsight: "Sort p-values ascending; reject all up to the largest i where `pᵢ ≤ (i/m)·q`. Controls the expected fraction of false discoveries, not the chance of any.",
        example: "An RNA-seq experiment with 20k genes finds 800 significant at FDR = 0.05 — you expect ~40 false positives, a price worth paying for real findings.",
      },
    ],
  },
  {
    slug: "regression",
    name: "Regression & Prediction",
    blurb: "Model an outcome as a function of one or more predictors — explanation or prediction.",
    color: "green",
    methods: [
      {
        name: "Linear regression",
        description: "OLS — predict a continuous outcome from one or more predictors.",
        usedFor: ["continuous outcome"],
        problem: "How does a continuous outcome change as one or more predictors change?",
        keyInsight: "Minimize squared residuals: `β̂ = (XᵀX)⁻¹Xᵀy`. Each coefficient is the partial slope of y in xⱼ holding other predictors fixed.",
        example: "House price = $50k + $200·sqft − $8k·age — a square foot adds $200, a year of age subtracts $8k, all else equal.",
        figure: FIGURES.linearReg,
      },
      {
        name: "Logistic regression",
        description: "Predict a binary outcome via the logit link — coefficients in log-odds.",
        usedFor: ["binary outcome"],
        problem: "A binary 0/1 outcome doesn't have a linear relationship with predictors — but on the log-odds scale it does.",
        keyInsight: "Model the log-odds linearly: `log(p/(1−p)) = β₀ + β₁x`. Coefficients are log-odds ratios — `exp(β)` is the multiplicative effect on the odds.",
        example: "Loan default prediction — a one-point credit-score drop multiplies the odds of default by `exp(β)`, not the probability directly.",
        figure: FIGURES.logisticReg,
      },
      {
        name: "Multinomial logistic",
        description: "Generalization of logistic regression to >2 unordered outcome categories.",
        usedFor: ["categorical outcome"],
        problem: "Logistic handles two classes — what about 3+ unordered outcomes like which party someone votes for?",
        keyInsight: "Pick a reference category; model the log-odds of each other category relative to it as a linear function of predictors.",
        example: "Predicting transport mode (car / bus / bike / walk) from income, age, and weather — three coefficient vectors, each relative to 'car'.",
      },
      {
        name: "Ordinal regression",
        description: "Predict an ordered categorical outcome — proportional-odds assumption.",
        usedFor: ["ordered outcome"],
        problem: "When outcomes have a natural order (poor → excellent) but unequal spacing, neither linear nor multinomial fits cleanly.",
        keyInsight: "Proportional-odds model: `log(P(Y ≤ k) / P(Y > k)) = αₖ − βx`. One slope across all cutpoints; only the intercepts vary by threshold.",
        example: "Health survey responses on a 5-point scale — a one-year-older respondent's odds of being in or below any health bracket multiply by `exp(β)`.",
      },
      {
        name: "Poisson regression",
        description: "Model count data with mean = variance — log link.",
        usedFor: ["count data"],
        problem: "Count outcomes (events per period) are non-negative integers with mean-dependent variance — linear regression underperforms.",
        keyInsight: "`log(E[Y|x]) = β₀ + βᵀx` — model expected counts on the log scale; assumes `Var(Y) = E(Y)` (the Poisson signature).",
        example: "Modeling traffic accidents per intersection per year as a function of volume — each coefficient is a multiplicative effect on the rate.",
      },
      {
        name: "Negative binomial regression",
        description: "Count regression for overdispersed data — relaxes Poisson's equal mean/variance.",
        usedFor: ["count data", "overdispersion"],
        problem: "Real count data are usually overdispersed (variance > mean) — Poisson then underestimates uncertainty.",
        keyInsight: "Add a gamma-distributed random rate, giving `Var(Y) = μ + αμ²` where α captures the extra dispersion above Poisson.",
        example: "Insurance claim counts per customer — high variance from rare big claimers; NB widens confidence intervals to honest levels.",
      },
      {
        name: "Cox proportional hazards",
        description: "Semi-parametric survival model — hazard ratios without modeling baseline hazard.",
        usedFor: ["survival"],
        problem: "With time-to-event data that's often right-censored, you want covariate effects without specifying the baseline hazard shape.",
        keyInsight: "`h(t|x) = h₀(t)·exp(βᵀx)` — covariates multiply an unspecified baseline hazard. Coefficients are log hazard ratios.",
        example: "A cancer trial reports HR = 0.75 for treatment — the treated arm's instantaneous death risk is 25% lower at any time after enrollment.",
        figure: FIGURES.kaplanMeier,
      },
      {
        name: "Kaplan-Meier estimator",
        description: "Nonparametric estimator of survival curves with right-censored data.",
        usedFor: ["survival", "nonparametric"],
        problem: "Some patients in a survival study haven't died by the end of follow-up — how do you estimate the survival curve without discarding them?",
        keyInsight: "At each observed event time, multiply the previous survival probability by `(1 − dᵢ/nᵢ)` (events / at-risk). Censored cases leave the risk set but don't trigger a drop.",
        example: "Median survival reported in oncology trials comes from where the KM curve crosses 0.5 — the standard summary in nearly every Phase 3 cancer report.",
      },
      {
        name: "Mixed-effects models",
        description: "Combine fixed and random effects — for nested, clustered, or repeated-measures data.",
        usedFor: ["clustered data", "longitudinal"],
        problem: "Repeated measurements within subjects violate independence — standard regression then understates uncertainty.",
        keyInsight: "Add random effects: `yᵢⱼ = β₀ + uⱼ + βᵀxᵢⱼ + εᵢⱼ`. The `uⱼ` are subject- or cluster-specific intercepts/slopes drawn from a distribution.",
        example: "A longitudinal weight-loss study with 200 patients × 12 monthly visits — random intercepts per patient absorb baseline weight, freeing the fixed-effect slope to estimate the population trend.",
      },
      {
        name: "Hierarchical linear models (HLM)",
        description: "Multilevel regression for nested structures (students-in-schools, patients-in-clinics).",
        usedFor: ["nested data"],
        problem: "Data nested in groups have variation at multiple levels — how do you let a predictor's effect differ by group?",
        keyInsight: "Specify a regression at each level: level-1 coefficients are themselves modeled as outcomes of level-2 predictors. Achieves partial pooling between separate fits and a single fit.",
        example: "Student test scores predicted by individual SES (level 1) and school average SES (level 2) — letting SES's effect vary by school avoids ecological fallacy and Simpson's paradox.",
      },
      {
        name: "Generalized linear models (GLM)",
        description: "Framework unifying linear, logistic, Poisson via link function + exponential family.",
        usedFor: ["framework"],
        problem: "Linear, logistic, and Poisson regression look distinct but share the same machinery — can they be unified?",
        keyInsight: "`g(E[Y]) = Xβ` where g is a link function and Y is from the exponential family. Identity + normal = linear; logit + Bernoulli = logistic; log + Poisson = Poisson.",
        example: "A single statsmodels call switches between models by choosing `family=Binomial()` vs. `Poisson()` — the same IRLS fitting algorithm handles all.",
      },
      {
        name: "Structural equation modeling (SEM)",
        description: "Estimate networks of regression paths with latent variables and measurement error.",
        usedFor: ["latent variables", "path analysis"],
        problem: "Some constructs (intelligence, satisfaction) are latent — measured only via noisy indicators — and embedded in causal networks.",
        keyInsight: "Specify a system of regression paths plus a measurement model linking observed indicators to latent factors; fit by matching observed and model-implied covariances.",
        example: "A consumer-research model where 'loyalty' is a latent factor measured by 4 survey items, predicted by latent 'satisfaction' — all paths estimated jointly.",
      },
      {
        name: "Ridge regression",
        description: "L2-regularized linear regression — shrinks coefficients toward zero.",
        usedFor: ["regularization", "multicollinearity"],
        problem: "When predictors are collinear, OLS coefficients explode in variance and the model overfits.",
        keyInsight: "Minimize `‖y − Xβ‖² + λ‖β‖²`. Closed form: `β̂ = (XᵀX + λI)⁻¹Xᵀy`. Shrinks coefficients toward zero — but never exactly to zero.",
        example: "Predicting wine quality from 11 highly correlated chemistry measurements — ridge stabilizes coefficients that OLS made look randomly huge.",
      },
      {
        name: "Lasso regression",
        description: "L1-regularized — performs variable selection by zeroing some coefficients.",
        usedFor: ["regularization", "variable selection"],
        problem: "You have hundreds of candidate predictors but suspect most are irrelevant — you want a model that drops them automatically.",
        keyInsight: "Minimize `‖y − Xβ‖² + λ‖β‖₁`. The corner geometry of the L1 ball forces many coefficients to be exactly zero — built-in feature selection.",
        example: "In a 2,000-SNP genomic predictor of plant height, Lasso typically retains 30–50 SNPs and zeroes the rest — instant feature selection.",
      },
      {
        name: "Elastic Net",
        description: "Blend of L1 and L2 — handles correlated predictors better than pure Lasso.",
        usedFor: ["regularization"],
        problem: "Lasso arbitrarily picks one of a group of correlated predictors and drops the rest; ridge keeps them all but selects none.",
        keyInsight: "Combine both penalties: `λ(α‖β‖₁ + (1−α)‖β‖₂²/2)`. Selects variables (L1) while letting correlated groups enter together (L2).",
        example: "Microarray gene-expression studies where genes in the same pathway are correlated — Elastic Net keeps the whole pathway, Lasso would keep just one.",
      },
      {
        name: "Quantile regression",
        description: "Model conditional quantiles (e.g. median) — robust to outliers, captures distributional effects.",
        usedFor: ["robust", "heterogeneous effects"],
        problem: "Average effects can mask very different effects at the top and bottom of the outcome distribution.",
        keyInsight: "Minimize the asymmetric absolute-error loss `Σ ρτ(yᵢ − xᵢβ)` to estimate the τ-th conditional quantile (not the mean). Robust to outliers and effects can differ across quantiles.",
        example: "A minimum-wage hike might leave median wages unchanged but lift the 10th percentile sharply — only quantile regression at τ = 0.1 reveals this.",
      },
    ],
  },
  {
    slug: "bayesian",
    name: "Bayesian Methods",
    blurb: "Treat parameters as random — update prior beliefs with data to get a posterior.",
    color: "purple",
    methods: [
      {
        name: "Bayesian inference",
        description: "Update prior distribution over parameters using Bayes' rule and observed data.",
        usedFor: ["inference", "uncertainty"],
        problem: "Frequentist methods treat the parameter as fixed and the data as random — but often you actually want a probability distribution over the parameter itself.",
        keyInsight: "Bayes' rule: `posterior ∝ prior × likelihood`. Beliefs update multiplicatively as data arrive; the same machinery handles inference, prediction, and decision.",
        example: "Estimating a coin's bias from 6 heads in 10 flips with a Beta(2,2) prior gives posterior Beta(8,6), mean ≈ 0.57 — a credible interval falls out automatically.",
        figure: FIGURES.bayes,
      },
      {
        name: "Markov Chain Monte Carlo (MCMC)",
        description: "Sample from posterior distributions when closed-form integration is intractable.",
        usedFor: ["posterior sampling"],
        problem: "Posteriors usually lack a closed form — and the normalizing integral is intractable in any dimension above 3.",
        keyInsight: "Construct a Markov chain whose stationary distribution is the posterior; let it walk long enough and the samples represent draws from the posterior.",
        example: "Metropolis-Hastings on a hierarchical model with 50 group means — produces 10,000 posterior samples in minutes, no integrals required.",
      },
      {
        name: "Hamiltonian Monte Carlo",
        description: "Gradient-based MCMC (Stan, PyMC NUTS) — efficient on high-dimensional posteriors.",
        usedFor: ["posterior sampling", "high-dimensional"],
        problem: "Random-walk MCMC mixes terribly on high-dimensional or strongly correlated posteriors.",
        keyInsight: "Treat negative log-posterior as potential energy; use gradient-based Hamiltonian dynamics to propose long, informed jumps that the Metropolis step accepts/rejects.",
        example: "Stan and PyMC's NUTS sampler is HMC under the hood — fits Bayesian neural nets and 100-parameter hierarchical models that random-walk MCMC could never reach.",
      },
      {
        name: "Variational inference",
        description: "Approximate posteriors by optimization rather than sampling — fast but biased.",
        usedFor: ["approximate inference"],
        problem: "MCMC can be too slow for large datasets or millions of parameters — you want a faster posterior approximation.",
        keyInsight: "Choose a simpler family q (often factorized Gaussians) and find the q* that minimizes `KL(q ‖ posterior)` — turning inference into optimization.",
        example: "Latent Dirichlet Allocation on a million documents — VI fits in minutes where Gibbs sampling needs hours, at the cost of biased uncertainty intervals.",
      },
      {
        name: "Bayesian networks",
        description: "Directed acyclic graphs encoding conditional independence — probabilistic reasoning.",
        usedFor: ["graphical models"],
        problem: "How do you express the joint distribution of many variables in a compact, interpretable form?",
        keyInsight: "A DAG where each node's CPT depends only on its parents factorizes the joint as `P(x₁…xₙ) = Π P(xᵢ | parents(xᵢ))`. Conditional independencies read off the graph.",
        example: "A medical diagnostic network where 'fever' and 'rash' both depend on 'infection' — d-separation tells you how observing one symptom updates beliefs about the other.",
      },
      {
        name: "Bayes factors",
        description: "Ratio of marginal likelihoods — Bayesian model comparison alternative to p-values.",
        usedFor: ["model comparison"],
        problem: "P-values can't quantify evidence for the null — only against it.",
        keyInsight: "`BF₁₀ = P(data | M₁) / P(data | M₀)`. BF₁₀ > 10 is strong evidence for M₁; BF₁₀ < 0.1 is strong evidence for M₀.",
        example: "A psychology replication finds BF₀₁ = 8 — eight-to-one evidence the effect is null, something a p-value of 0.4 could never express.",
      },
      {
        name: "Hierarchical Bayesian models",
        description: "Multilevel priors enable partial pooling — shrinks group estimates toward the grand mean.",
        usedFor: ["multilevel", "partial pooling"],
        problem: "Per-group estimates are noisy with small samples per group; a single pooled estimate is biased.",
        keyInsight: "Group parameters share a higher-level prior; each group's posterior is pulled ('partial pooling') toward the grand mean by an amount proportional to its own noise.",
        example: "Baseball batting averages — Efron-Morris shrinkage outperformed each player's raw season average at predicting future performance, by exactly this mechanism.",
      },
      {
        name: "Bayesian model averaging",
        description: "Weight predictions by posterior model probabilities instead of selecting one model.",
        usedFor: ["model uncertainty"],
        problem: "Selecting a single model ignores the uncertainty that came from not knowing which model was right.",
        keyInsight: "Weight each candidate's predictions by its posterior probability `P(M | data)` and average — predictions then account for both parameter and model uncertainty.",
        example: "Forecasting GDP by averaging 50 candidate VAR specifications by posterior weight outperforms picking the single best by AIC.",
      },
      {
        name: "Empirical Bayes",
        description: "Estimate priors from the data itself — pragmatic shortcut for hierarchical models.",
        usedFor: ["shrinkage"],
        problem: "You want hierarchical-Bayes shrinkage benefits, but specifying a full prior on the prior is daunting or computationally heavy.",
        keyInsight: "Estimate the hyperprior from the data itself (often by marginal MLE), then treat it as fixed and proceed with standard Bayes.",
        example: "James-Stein estimator and local-FDR methods are empirical Bayes — using all genes' p-values to estimate the prior on per-gene effects.",
      },
      {
        name: "Posterior predictive checks",
        description: "Simulate data from the fitted model and compare to the observed — model criticism.",
        usedFor: ["model checking"],
        problem: "A fitted Bayesian model could still be wrong — how do you tell whether it captures features of the real data?",
        keyInsight: "Simulate datasets from the posterior predictive `p(ỹ | y)`, then compare a chosen statistic (max, variance, autocorrelation) of the simulated data to the observed.",
        example: "Posterior simulations of game scores all show fewer ties than the real data — a clue that the model misses a clustering mechanism worth adding.",
      },
    ],
  },
  {
    slug: "experimental-design",
    name: "Experimental Design",
    blurb: "Plan data collection so the resulting inference is unbiased and well-powered.",
    color: "amber",
    methods: [
      {
        name: "Randomized controlled trial (RCT)",
        description: "Random assignment to treatment vs. control — gold standard for causal inference.",
        usedFor: ["causal", "intervention"],
        problem: "Observational comparisons confound treatment with the type of person who chose it.",
        keyInsight: "Random assignment makes treatment statistically independent of all baseline covariates (observed or not), so the difference in outcomes estimates the causal effect.",
        example: "An RCT of a new vaccine assigns 20,000 volunteers 1:1 to treatment vs. placebo — efficacy is the difference in infection rates, no causal model required.",
      },
      {
        name: "Factorial design",
        description: "Vary multiple factors simultaneously — estimates main effects and interactions efficiently.",
        usedFor: ["multi-factor"],
        problem: "Studying factors one at a time misses interactions and wastes data — each subject contributes to only one comparison.",
        keyInsight: "Cross all factor levels; every subject contributes information to every main effect and every interaction simultaneously.",
        example: "A 2³ chemistry experiment (temperature × catalyst × pH) uses 8 runs to estimate 3 main effects + 4 interactions — far fewer runs than 3 separate experiments.",
      },
      {
        name: "Latin square",
        description: "Counterbalance order across treatments and time periods with one observation per cell.",
        usedFor: ["counterbalancing"],
        problem: "When two nuisance factors (e.g. driver and tire position) might affect outcome, you'd need a giant factorial to control both.",
        keyInsight: "Arrange treatments in an n×n grid so each treatment appears exactly once per row and once per column — counterbalancing both nuisance factors with n² runs.",
        example: "4 tire brands tested across 4 car positions × 4 drivers — 16 trials test all brand-vs-position and brand-vs-driver combinations simultaneously.",
      },
      {
        name: "Crossover design",
        description: "Each subject receives multiple treatments in sequence — controls between-subject variance.",
        usedFor: ["within-subjects"],
        problem: "Between-subject variability often dwarfs treatment effects in clinical research.",
        keyInsight: "Each subject receives all treatments in randomized sequence (with washout between). The within-subject difference cancels between-subject variance.",
        example: "A migraine drug crossover (drug → washout → placebo, randomized order) with n = 30 detects effects that a parallel RCT would need n = 200 to find.",
      },
      {
        name: "A/B testing",
        description: "Online randomized experiments — measure causal effect of a change at scale.",
        usedFor: ["online experimentation"],
        problem: "Companies want to know whether a product change actually helps, not whether it correlates with metrics moving.",
        keyInsight: "Randomly split users between current and new variants and measure the average difference — RCT logic deployed at internet scale, often millions of users.",
        example: "Netflix tests a new thumbnail by serving it to 5% of users for two weeks; a watch-rate gap of +0.4% at p < 0.001 is enough to ship.",
      },
      {
        name: "Multi-armed bandit",
        description: "Adaptively allocate traffic to better-performing variants — exploration vs. exploitation.",
        usedFor: ["adaptive allocation"],
        problem: "A/B tests waste traffic on inferior variants throughout the entire experiment.",
        keyInsight: "Adaptively allocate more traffic to variants currently looking better (Thompson sampling, UCB) — balances exploration of unknown arms with exploitation of known winners.",
        example: "A headline recommender quickly funnels 80% of traffic to the top performer once it's clearly ahead — capturing more value than a fixed 50/50 A/B test.",
      },
      {
        name: "Power analysis",
        description: "Compute sample size needed to detect a target effect with given α and power.",
        usedFor: ["sample size"],
        problem: "An underpowered study can't tell a real effect from a null one — you'll be inconclusive whatever you find.",
        keyInsight: "For target effect size δ, significance α, and power 1−β, solve for required n. Power is the probability of correctly rejecting a false null.",
        example: "To detect a 5-mmHg blood-pressure drop (SD = 10) with α = 0.05 and 80% power, you need roughly n = 64 per arm — fewer subjects guarantee inconclusive results.",
        figure: FIGURES.power,
      },
      {
        name: "Cluster randomization",
        description: "Randomize at group level (schools, clinics) when contamination between units is likely.",
        usedFor: ["group-level"],
        problem: "When an intervention is delivered to a whole group (a school, a clinic), randomizing individuals creates contamination — a vaccinated peer protects the unvaccinated.",
        keyInsight: "Randomize at the group level instead, then adjust standard errors for within-cluster correlation (design effect). Trades power for unbiasedness.",
        example: "A handwashing intervention randomized across 40 schools (not 4,000 students) — schools are the unit of treatment, so they should be the unit of randomization.",
      },
      {
        name: "Stratified sampling",
        description: "Sample within strata to guarantee representation and reduce variance.",
        usedFor: ["sampling"],
        problem: "A simple random sample of 1,000 might over- or under-represent small subgroups by chance.",
        keyInsight: "Partition the population into strata (region, age band), then sample within each. Guarantees representation and lowers variance by removing between-stratum variability.",
        example: "A U.S. election poll samples 200 each from Northeast / South / Midwest / West / Mountain — reweighted by population share, producing tighter national estimates than a 1,000-person SRS.",
      },
      {
        name: "Pre-registration",
        description: "Publicly commit to hypotheses and analysis plan before seeing data — bias prevention.",
        usedFor: ["bias prevention"],
        problem: "Researchers can — often unconsciously — pick the analysis that produces a significant result, inflating false positives across the literature.",
        keyInsight: "Lock down hypotheses and the analysis plan publicly before seeing data. Any deviation must be flagged as exploratory rather than confirmatory.",
        example: "After psychology's pre-registration push (post-2015), positive-result rates in pre-registered studies dropped from ~95% to ~50% — closer to the true base rate.",
      },
    ],
  },
  {
    slug: "causal-inference",
    name: "Causal Inference",
    blurb: "Estimate causal effects from observational data — when randomization is impossible.",
    color: "orange",
    methods: [
      {
        name: "Difference-in-differences (DiD)",
        description: "Compare pre/post changes between treated and untreated groups — parallel-trends assumption.",
        usedFor: ["policy evaluation"],
        problem: "A pre/post comparison conflates the treatment effect with anything else that changed over time.",
        keyInsight: "Subtract the treated group's pre-post change from the control group's pre-post change. Time-trend and group-level confounders cancel — under a parallel-trends assumption.",
        example: "Card & Krueger (1994) compared NJ fast-food employment before/after a minimum wage hike against PA's — DiD gave ≈ 0 effect on employment, upending textbook predictions.",
      },
      {
        name: "Instrumental variables (IV)",
        description: "Use an exogenous instrument to isolate the causal portion of variation in a predictor.",
        usedFor: ["endogeneity"],
        problem: "Endogenous predictors (treatment chosen non-randomly, omitted confounders) make OLS biased.",
        keyInsight: "Find an instrument Z that affects Y only through X. The IV estimator `β̂ = Cov(Z, Y) / Cov(Z, X)` recovers the causal effect on those whose X is shifted by Z (compliers).",
        example: "Angrist (1990) used Vietnam draft-lottery number as an instrument for military service to estimate the causal earnings penalty of serving — bypassing self-selection of who enlisted.",
      },
      {
        name: "Regression discontinuity (RD)",
        description: "Compare units just above and below a cutoff — local randomization argument.",
        usedFor: ["threshold effects"],
        problem: "Treatment assigned by a rule (test score ≥ cutoff → admission) looks confounded with ability — yet near the cutoff, assignment is effectively random.",
        keyInsight: "Compare units just above to those just below the cutoff. The discontinuity in y at the threshold equals the local average treatment effect.",
        example: "A scholarship awarded at a 1200 SAT cutoff — comparing 1198s to 1202s recovers the causal effect of the scholarship on enrollment.",
      },
      {
        name: "Propensity score matching",
        description: "Match treated and untreated units on estimated probability of treatment.",
        usedFor: ["observational causal"],
        problem: "With high-dimensional covariates, exact matching between treated and untreated is infeasible.",
        keyInsight: "Estimate each unit's propensity `e(x) = P(T=1 | x)`. Matching on this scalar achieves balance on all covariates that entered the propensity model.",
        example: "Studying the effect of MBA programs on earnings — match each MBA holder to a non-MBA with the same propensity score (from age, GPA, pre-MBA salary, sector).",
      },
      {
        name: "Inverse probability weighting",
        description: "Reweight observations by inverse treatment-probability to balance covariates.",
        usedFor: ["observational causal"],
        problem: "Matching discards unmatched units; you'd rather use the whole sample.",
        keyInsight: "Weight each unit by `1/e(x)` if treated and `1/(1−e(x))` if not. The reweighted sample has the same covariate distribution across groups, mimicking randomization.",
        example: "Marginal structural models of HIV treatment over time use IPW to handle time-varying confounders that standard regression can't address.",
      },
      {
        name: "Synthetic control",
        description: "Construct a weighted average of donor units that matches the treated unit pre-treatment.",
        usedFor: ["comparative case study"],
        problem: "For one treated unit (a country, a state), what's the right counterfactual?",
        keyInsight: "Build a weighted average of donor units that matches the treated unit's pre-treatment outcome path; post-treatment, the gap is the causal estimate.",
        example: "Abadie & Gardeazabal (2003) built a synthetic Basque region from other Spanish regions to estimate a ~10% GDP cost of terrorism — now a standard method for policy case studies.",
      },
      {
        name: "Directed acyclic graphs (DAGs)",
        description: "Encode causal assumptions graphically to identify valid adjustment sets.",
        usedFor: ["causal identification"],
        problem: "Knowing which covariates to 'control for' is not obvious — sometimes controlling for the wrong variable introduces bias.",
        keyInsight: "Draw the causal graph; the back-door criterion mechanically identifies a valid adjustment set. Conditioning on a collider opens a spurious path.",
        example: "To estimate education → earnings, you should not adjust for occupation (a mediator) — the DAG shows occupation lies on the causal path, so adjusting blocks the effect you want.",
      },
      {
        name: "Mediation analysis",
        description: "Decompose a total effect into direct and indirect (via mediator) components.",
        usedFor: ["mechanism"],
        problem: "When a treatment has both direct and indirect (through a mediator) effects, you want to decompose them.",
        keyInsight: "Direct effect = the residual X→Y effect when M is held fixed. Indirect effect = (X→M coefficient) × (M→Y coefficient) under linearity.",
        example: "Education → income — partly direct ('more skills'), partly mediated through occupation choice. Mediation analysis estimates each share separately.",
      },
      {
        name: "Mendelian randomization",
        description: "Genetic variants as instruments for modifiable exposures — IV applied to epidemiology.",
        usedFor: ["epidemiology", "IV"],
        problem: "Observational nutrition and lifestyle studies are riddled with confounding — can you reach a causal claim without an RCT?",
        keyInsight: "Use genetic variants as instruments for the modifiable exposure: variants are randomized at conception (Mendel's laws), so MR mimics a natural RCT.",
        example: "MR using LDL-lowering variants confirmed LDL → coronary heart disease causally, vindicating statin trials a decade before some confirmatory RCTs.",
      },
    ],
  },
  {
    slug: "signal-time-series",
    name: "Signal Processing & Time Series",
    blurb: "Methods for sequential / temporal data — decomposition, forecasting, and frequency analysis.",
    color: "teal",
    methods: [
      {
        name: "Autocorrelation (ACF)",
        description: "Correlation of a series with its lagged self — diagnose temporal dependence.",
        usedFor: ["dependence"],
        problem: "Is today's value informative about tomorrow's? How far back does that influence reach?",
        keyInsight: "`ρ(k) = Corr(Xₜ, Xₜ₋ₖ)`. Plot ρ(k) against lag k; significant nonzero values indicate temporal dependence that violates IID assumptions.",
        example: "Daily stock returns have ACF ≈ 0 (efficient-market consistent), but squared returns show strong positive ACF — volatility clusters even when returns don't.",
      },
      {
        name: "Fourier transform (FFT)",
        description: "Decompose a signal into sinusoidal frequency components.",
        usedFor: ["frequency"],
        problem: "Many signals look like noise in time but have hidden periodic structure.",
        keyInsight: "`X(f) = ∫ x(t) e⁻²πift dt` — decomposes the signal into a sum of sinusoids. Peaks in `|X(f)|` are dominant frequencies.",
        example: "An EEG that looks like noise in time shows a clear 10-Hz peak in the FFT — the alpha rhythm of a relaxed brain.",
      },
      {
        name: "Wavelet analysis",
        description: "Time-frequency decomposition — localizes when a frequency is present.",
        usedFor: ["non-stationary signals"],
        problem: "FFT assumes frequency content is constant — but real signals (speech, ECG) have transient frequencies.",
        keyInsight: "Decompose with localized basis functions (wavelets) at multiple scales; outputs a time-frequency map showing when each frequency is present.",
        example: "ECG analysis uses wavelets to localize the QRS complex within each heartbeat — FFT would smear it across the entire recording.",
      },
      {
        name: "ARIMA",
        description: "Autoregressive integrated moving-average — workhorse univariate forecasting model.",
        usedFor: ["forecasting"],
        problem: "How do you forecast a univariate time series that may have trend, autocorrelation, and noise?",
        keyInsight: "ARIMA(p,d,q): difference d times to remove trend, then model the result with p AR lags + q MA error terms: `(1 − Σϕᵢ Lⁱ)(1−L)ᵈ yₜ = (1 + Σθⱼ Lʲ) εₜ`.",
        example: "Monthly airline-passenger counts (the classic Box-Jenkins example) fit by ARIMA(0,1,1) — forecasts that have powered enterprise demand planning for 50 years.",
        figure: FIGURES.arima,
      },
      {
        name: "SARIMA",
        description: "Seasonal ARIMA — adds periodic structure to the baseline model.",
        usedFor: ["seasonal forecasting"],
        problem: "ARIMA misses obvious seasonal patterns — retail spikes every December, electricity peaks every summer.",
        keyInsight: "Add a seasonal ARIMA component at period s: `ARIMA(p,d,q)×(P,D,Q)ₛ`. Differences at lag s remove seasonal trend; seasonal lags model the seasonal pattern.",
        example: "`SARIMA(1,1,1)×(0,1,1)₁₂` fits monthly retail sales with both annual cycle and trend in a single coherent model.",
      },
      {
        name: "Vector autoregression (VAR)",
        description: "Multivariate AR — model joint dynamics of several series.",
        usedFor: ["multivariate forecasting"],
        problem: "Macro variables (GDP, inflation, rates) influence each other simultaneously — modeling them in isolation is wrong.",
        keyInsight: "`Yₜ = A₁Yₜ₋₁ + … + AₚYₜ₋ₚ + εₜ` where Y is a vector. Each variable is regressed on lags of all variables jointly.",
        example: "A 3-variable VAR on (GDP, unemployment, Fed funds rate) is the workhorse model behind modern monetary-policy impulse-response analysis.",
      },
      {
        name: "State-space / Kalman filter",
        description: "Recursive estimation of latent states from noisy observations.",
        usedFor: ["latent state", "tracking"],
        problem: "You observe noisy measurements of an unobserved system state — and you want recursive, real-time estimates of the state.",
        keyInsight: "Predict next state from model, update via Kalman gain weighted by uncertainty — combines model prediction and observation in inverse-variance proportion. Optimal under Gaussian linearity.",
        example: "GPS receivers fuse satellite signals (noisy) with the receiver's motion model (uncertain) via Kalman filtering 10× per second — that's how a phone tracks you accurately under trees.",
      },
      {
        name: "Granger causality",
        description: "Tests whether past values of X improve prediction of Y beyond Y's own past.",
        usedFor: ["temporal precedence"],
        problem: "Does past X help predict future Y beyond what Y's own past predicts?",
        keyInsight: "Fit Y on lags of Y alone and on lags of (Y, X); F-test whether adding X's lags improves the fit. Predictive precedence, not metaphysical causation.",
        example: "Money supply Granger-causes inflation in many monetarist VAR analyses — but only in the sense of forecast improvement, not necessarily underlying mechanism.",
      },
      {
        name: "Spectral density estimation",
        description: "Estimate the distribution of variance across frequencies (periodogram, Welch).",
        usedFor: ["frequency content"],
        problem: "How much variance lives at each frequency in a stationary process?",
        keyInsight: "The Fourier transform of the autocorrelation function. Estimators: raw periodogram (high variance) or Welch's averaged-segment method (smoothed).",
        example: "Climate scientists estimate the spectral density of sea-surface temperature to detect ENSO's 3–7-year cycle as a peak above the red-noise background.",
      },
      {
        name: "Cointegration",
        description: "Linear combination of non-stationary series that is itself stationary — long-run equilibrium.",
        usedFor: ["long-run relationship"],
        problem: "Two non-stationary series can produce spurious regression results — but sometimes their linear combination IS stationary, indicating a long-run equilibrium.",
        keyInsight: "If Y and X are I(1) but `Y − βX` is I(0), they cointegrate. Engle-Granger tests for a unit root in the residuals from the cointegrating regression.",
        example: "Spot and futures prices of oil are individually random walks, but their spread is mean-reverting — the basis of pairs trading and arbitrage models.",
      },
    ],
  },
  {
    slug: "information-theory",
    name: "Information Theory",
    blurb: "Quantify information, uncertainty, and statistical dependence in bits.",
    color: "rose",
    methods: [
      {
        name: "Shannon entropy",
        description: "Average uncertainty (in bits) of a discrete random variable.",
        usedFor: ["uncertainty"],
        problem: "How do you quantify the uncertainty (or 'surprisingness') of a random variable in a unit-free way?",
        keyInsight: "`H(X) = − Σ p(x) log₂ p(x)`. The average minimum number of bits needed to encode an outcome; maximized at the uniform distribution.",
        example: "A fair coin has H = 1 bit per flip; a biased coin with p = 0.9 has H ≈ 0.47 — fewer bits needed because outcomes are predictable.",
      },
      {
        name: "Mutual information",
        description: "Reduction in uncertainty about X from observing Y — captures nonlinear dependence.",
        usedFor: ["dependence", "nonlinear"],
        problem: "Correlation only captures linear dependence — how do you quantify any kind of statistical dependence?",
        keyInsight: "`I(X;Y) = H(X) + H(Y) − H(X,Y)`. Reduction in uncertainty about X from observing Y; zero iff X ⫫ Y.",
        example: "Image pixels in a photo have near-zero correlation with adjacent pixel-intensity differences but very high mutual information — compressors exploit MI, not just correlation.",
        figure: FIGURES.mutualInfo,
      },
      {
        name: "KL divergence",
        description: "Non-symmetric distance between two probability distributions.",
        usedFor: ["distribution comparison"],
        problem: "How do you measure how far one probability distribution is from another?",
        keyInsight: "`D_KL(P‖Q) = Σ p(x) log(p(x)/q(x))`. Extra average bits needed to encode P-samples with a code optimized for Q. Asymmetric and unbounded.",
        example: "Cross-entropy classifier training minimizes `D_KL(empirical ‖ model)` — every minibatch step pulls the model distribution toward the data distribution.",
      },
      {
        name: "Cross-entropy",
        description: "Average number of bits needed to encode samples from P using a model Q — standard ML loss.",
        usedFor: ["model fit", "loss"],
        problem: "How do you score a probabilistic predictor on observed outcomes?",
        keyInsight: "`H(P, Q) = − Σ p(x) log q(x) = H(P) + D_KL(P‖Q)`. Bits needed to encode P-samples using Q; minimized at Q = P.",
        example: "The standard classifier loss `− log(model probability of true class)`, averaged over the batch — identical to maximum likelihood under softmax.",
      },
      {
        name: "Jensen-Shannon divergence",
        description: "Symmetric, bounded variant of KL — square root is a metric.",
        usedFor: ["distribution comparison"],
        problem: "KL is asymmetric and goes to infinity if one distribution has zero mass where the other has positive mass.",
        keyInsight: "`JSD(P,Q) = ½ KL(P‖M) + ½ KL(Q‖M)` where `M = (P+Q)/2`. Symmetric, bounded by log 2, and `√JSD` is a true metric.",
        example: "Used in GAN training (the original Goodfellow objective) and in linguistics to compare vocabulary distributions across corpora.",
      },
      {
        name: "Fisher information",
        description: "Curvature of the log-likelihood — Cramér-Rao bound on parameter precision.",
        usedFor: ["parameter precision"],
        problem: "How tightly can you estimate a parameter from a sample — what's the theoretical lower bound on variance?",
        keyInsight: "`I(θ) = E[(∂/∂θ log L(θ;X))²]` — curvature of the log-likelihood. Cramér-Rao: `Var(θ̂) ≥ 1/(n·I(θ))`.",
        example: "MLE under a normal parameter μ has `I = 1/σ²` — so estimator variance bottoms out at σ²/n, the limit no estimator can beat asymptotically.",
      },
      {
        name: "Channel capacity",
        description: "Maximum rate of reliable information transmission across a noisy channel.",
        usedFor: ["communication"],
        problem: "How fast can you transmit data through a noisy channel without errors?",
        keyInsight: "`C = max_{p(x)} I(X;Y)` in bits/use. Shannon's theorem: rates below C are achievable with arbitrarily low error; rates above C are not.",
        example: "A telephone-bandwidth modem has C ≈ 56 kbps — V.92 modems hit this limit in the late 1990s, after which copper-line voice modems could not improve.",
      },
      {
        name: "Transfer entropy",
        description: "Directional information flow from one process to another — nonlinear Granger.",
        usedFor: ["directional dependence"],
        problem: "Granger causality assumes linearity — for nonlinear coupled systems, what's the directional information-flow measure?",
        keyInsight: "`T_{X→Y} = I(Yₜ₊₁; Xₜ | Yₜ)` — how much knowing X reduces uncertainty about Y's next value, beyond what Y's own past contributes. Asymmetric and nonparametric.",
        example: "Neuroscience uses TE to detect directional coupling between brain regions in EEG/fMRI, picking up nonlinear influences that Granger misses.",
      },
    ],
  },
  {
    slug: "machine-learning",
    name: "Machine Learning Methods",
    blurb: "Algorithms that learn patterns from data — supervised, unsupervised, and dimensionality reduction.",
    color: "violet",
    methods: [
      {
        name: "Cross-validation (k-fold)",
        description: "Estimate out-of-sample error by holding out folds in rotation.",
        usedFor: ["generalization", "tuning"],
        problem: "A model's training error overestimates how it'll perform on new data — how do you estimate out-of-sample error from a single dataset?",
        keyInsight: "Split data into k folds; train on k−1, test on 1, rotate. Average the test errors — an honest estimate of generalization and a model-selection criterion.",
        example: "Tuning λ in Lasso via 10-fold CV picks the regularization that minimizes held-out error — the standard `cv.glmnet` workflow.",
      },
      {
        name: "Bootstrap",
        description: "Resample with replacement to estimate sampling distributions and confidence intervals.",
        usedFor: ["resampling", "uncertainty"],
        problem: "You want a confidence interval for some statistic, but no closed-form formula exists.",
        keyInsight: "Resample your data with replacement B times, recompute the statistic on each — the empirical distribution of those B values approximates its sampling distribution.",
        example: "Confidence interval for the median income of a survey: bootstrap 10,000 samples of size n, take the 2.5th/97.5th percentile of the bootstrap medians.",
      },
      {
        name: "ROC / AUC",
        description: "Trade off true-positive vs. false-positive rate across classifier thresholds.",
        usedFor: ["classifier performance"],
        problem: "For a classifier outputting probabilities, every threshold trades sensitivity against specificity — how do you summarize performance across all of them?",
        keyInsight: "ROC plots TPR vs. FPR across thresholds. AUC = probability the model ranks a random positive above a random negative; 1.0 = perfect, 0.5 = chance.",
        example: "A breast-cancer classifier with AUC = 0.94 on held-out data is well-discriminative; choose a threshold on the curve based on clinically acceptable false-positive rate.",
        figure: FIGURES.rocAuc,
      },
      {
        name: "Precision-recall curve",
        description: "Better than ROC under heavy class imbalance.",
        usedFor: ["imbalanced classification"],
        problem: "With heavy class imbalance, ROC stays near the top-left even when most positive predictions are wrong — masking poor real-world performance.",
        keyInsight: "Plot precision (`TP/(TP+FP)`) against recall (`TP/(TP+FN)`). Sensitive to imbalance because precision penalizes the much-larger negative class flooding FP.",
        example: "Fraud detection at 1 fraud per 1,000 transactions — a model with AUC = 0.99 can still have precision = 0.05; a PR-AUC of 0.4 is honest about that.",
      },
      {
        name: "Confusion matrix",
        description: "Tabulate predictions vs. truth — basis for precision, recall, F1.",
        usedFor: ["classification metrics"],
        problem: "Single-number metrics hide what kinds of mistakes a classifier makes.",
        keyInsight: "2×2 (or k×k) table of predicted vs. true labels. Precision, recall, F1, specificity, FPR are all simple derivations from its cells.",
        example: "Inspecting a spam-filter confusion matrix shows 95% accuracy was hiding 8% false negatives on a specific spam type — a row-wise diagnosis the headline number suppressed.",
      },
      {
        name: "Decision trees",
        description: "Recursively partition feature space — interpretable but high variance alone.",
        usedFor: ["classification", "regression"],
        problem: "You want an interpretable nonlinear model — one a domain expert can read off as if-then rules.",
        keyInsight: "Recursively partition feature space by greedy split selection (maximize information gain or Gini reduction). Predict by the majority class (or mean) of the leaf.",
        example: "A credit-approval tree: `if income > 50k and credit_score > 700: approve; else if employment > 5y …` — directly auditable, regulator-friendly.",
      },
      {
        name: "Random forests",
        description: "Bagged ensemble of decorrelated decision trees — reduces variance.",
        usedFor: ["tabular data"],
        problem: "Single trees have high variance — small data perturbations produce very different splits.",
        keyInsight: "Build many trees on bootstrap samples with a random subset of features at each split, then average. Decorrelation via feature subsampling amplifies the variance reduction beyond bagging.",
        example: "scikit-learn's `RandomForestClassifier` is the default tabular baseline — typically beats a single tuned tree by 5–20% AUC and barely overfits.",
      },
      {
        name: "Gradient boosting",
        description: "Sequentially fit weak learners to residuals — XGBoost, LightGBM, CatBoost.",
        usedFor: ["tabular data", "competitions"],
        problem: "Bagged trees average independent learners — but sequential learners that fix each other's errors do better.",
        keyInsight: "At each step, fit a new weak learner to the residual gradient of the current ensemble's loss. Slowly steers the prediction in the negative-gradient direction.",
        example: "XGBoost / LightGBM / CatBoost dominate Kaggle tabular competitions — most winning solutions are gradient-boosted trees with feature engineering.",
      },
      {
        name: "Support vector machines (SVM)",
        description: "Maximum-margin classifier — kernels extend to nonlinear boundaries.",
        usedFor: ["classification"],
        problem: "With many possible decision boundaries between two classes, which one generalizes best?",
        keyInsight: "Maximize the margin — the distance from the boundary to the nearest training point. The kernel trick replaces inner products with `k(xᵢ, xⱼ)` for nonlinear boundaries in implicit high-D spaces.",
        example: "Pre-deep-learning text classification (~2005) — linear SVMs on TF-IDF features were the strongest off-the-shelf baseline for years.",
      },
      {
        name: "k-nearest neighbors (kNN)",
        description: "Predict from labels of the k closest training points — nonparametric.",
        usedFor: ["nonparametric"],
        problem: "Sometimes there's no good parametric model — just a labeled dataset and a need to label new points.",
        keyInsight: "Predict by majority vote (or mean) of the k closest training points by chosen distance metric. No training step beyond storing the data.",
        example: "Image-similarity retrieval — embed images via a CNN, then kNN over the embedding finds the closest matches for 'more like this' recommendations.",
      },
      {
        name: "Naive Bayes",
        description: "Apply Bayes' rule under strong feature-independence assumption — fast text baseline.",
        usedFor: ["text classification"],
        problem: "With thousands of features and limited data, full joint modeling is infeasible.",
        keyInsight: "Assume features are conditionally independent given the class: `P(C|x) ∝ P(C) Π P(xⱼ|C)`. Wrong but useful — surprisingly competitive when features are noisy.",
        example: "Bayesian spam filtering (mid-2000s) — Paul Graham's 'Plan for Spam' used naive Bayes on word counts to cut spam by orders of magnitude in early webmail.",
      },
      {
        name: "Principal component analysis (PCA)",
        description: "Linear dimensionality reduction along directions of greatest variance.",
        usedFor: ["dimensionality reduction"],
        problem: "You have 50 correlated features but suspect they really live on a much lower-dimensional manifold — how do you find it?",
        keyInsight: "Eigendecompose the covariance matrix: `Σ = VΛVᵀ`. The top-k eigenvectors give the directions of maximum variance; project the data onto them.",
        example: "Face image PCA (eigenfaces) — most face variation lives in a ~100-dimensional subspace despite the 65,536-pixel image space.",
        figure: FIGURES.pca,
      },
      {
        name: "t-SNE",
        description: "Nonlinear embedding optimized for local neighborhood preservation — visualization only.",
        usedFor: ["visualization"],
        problem: "Visualizing high-dimensional data in 2D: PCA preserves global structure but flattens local clusters together.",
        keyInsight: "Minimize KL between high-D pairwise similarities (Gaussian) and low-D similarities (Student-t). The heavy-tailed target separates clusters in the embedding.",
        example: "t-SNE plots of MNIST embeddings show 10 visually-distinct digit clusters — visualization that revolutionized how ML practitioners debug learned representations after 2008.",
      },
      {
        name: "UMAP",
        description: "Manifold-learning embedding — preserves more global structure than t-SNE.",
        usedFor: ["visualization", "embedding"],
        problem: "t-SNE is slow on big data and tends to distort global structure between clusters.",
        keyInsight: "Approximate the high-D manifold as a fuzzy simplicial complex, then optimize a low-D layout to match it — preserves both local neighborhoods and global topology faster than t-SNE.",
        example: "Single-cell RNA-seq pipelines (Seurat, scanpy) now default to UMAP — cell-type clusters preserve developmental relationships that t-SNE scrambles.",
      },
      {
        name: "k-means clustering",
        description: "Partition data into k clusters minimizing within-cluster variance.",
        usedFor: ["clustering"],
        problem: "You want to partition unlabeled data into k coherent groups.",
        keyInsight: "Iterate: (1) assign each point to nearest centroid, (2) recompute centroids as cluster means. Converges to a local minimum of within-cluster sum of squares.",
        example: "Customer segmentation on (recency, frequency, monetary value) into 5 buyer clusters — actionable marketing segments produced in milliseconds.",
      },
      {
        name: "Hierarchical clustering",
        description: "Build a dendrogram by iteratively merging (agglomerative) or splitting (divisive).",
        usedFor: ["clustering"],
        problem: "k-means needs k upfront; you'd rather see the structure at every scale and pick.",
        keyInsight: "Agglomerative: start with singletons and merge the closest pair (single, complete, average, or Ward linkage). Produces a dendrogram you cut at any height.",
        example: "Phylogenetic trees of species from genetic distance — agglomerative clustering with average linkage produces the trees evolutionary biologists publish.",
      },
      {
        name: "DBSCAN",
        description: "Density-based clustering — finds arbitrary shapes, labels low-density points as noise.",
        usedFor: ["clustering", "noise"],
        problem: "k-means and hierarchical struggle with non-convex clusters and assume every point belongs somewhere.",
        keyInsight: "Two parameters (ε, minPts) define density. A point is 'core' if it has minPts neighbors within ε; clusters grow by chaining core points; isolated points are labeled noise.",
        example: "Geospatial event clustering — DBSCAN finds dense city clusters of 911 calls while correctly labeling rural sparse calls as noise, something k-means can't do.",
      },
      {
        name: "Gaussian mixture models",
        description: "Soft clustering as a mixture of Gaussians fit by EM — gives membership probabilities.",
        usedFor: ["soft clustering"],
        problem: "k-means forces hard assignments — but a point could plausibly belong to multiple clusters.",
        keyInsight: "Model data as `Σₖ πₖ N(μₖ, Σₖ)`. EM alternates: E-step computes membership probabilities, M-step updates Gaussian parameters by responsibility-weighted MLE.",
        example: "Speaker diarization — segment audio into utterances by clustering MFCC features with a GMM; each frame gets a soft assignment across speakers.",
      },
    ],
  },
];

const ALL_SLUGS = FAMILIES.map(f => f.slug);

function methodMatches(method: Method, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (method.name.toLowerCase().includes(q)) return true;
  if (method.description.toLowerCase().includes(q)) return true;
  if (method.problem.toLowerCase().includes(q)) return true;
  if (method.keyInsight.toLowerCase().includes(q)) return true;
  if (method.example.toLowerCase().includes(q)) return true;
  return method.usedFor.some(t => t.toLowerCase().includes(q));
}

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code
          key={i}
          className="font-mono text-[11px] bg-gray-800/70 px-1 py-0.5 rounded text-gray-100"
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export default function StatisticsPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return FAMILIES.map(f => ({
      ...f,
      methods: f.methods.filter(m => methodMatches(m, query)),
    })).filter(f => f.methods.length > 0);
  }, [query]);

  const totalMethods = FAMILIES.reduce((s, f) => s + f.methods.length, 0);
  const matchCount = filtered.reduce((s, f) => s + f.methods.length, 0);

  const toggleFamily = (slug: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleExpand = (key: string) => {
    setExpanded(prev => (prev === key ? null : key));
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
          Click any card for a textbook-style expansion: the problem the method answers, the
          mechanistic key insight (often with a formula), and a concrete example. A handful of the
          most iconic methods carry inline diagrams. Color codes the family; clicking a header
          collapses its section.
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
          placeholder="Filter by name, description, insight, or tag — e.g. 'survival', 'bayesian', 'count data'"
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
                  onClick={() => toggleFamily(family.slug)}
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
                    {family.methods.map(method => {
                      const key = `${family.slug}::${method.name}`;
                      const isExpanded = expanded === key;
                      return (
                        <div
                          key={method.name}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          onClick={() => toggleExpand(key)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleExpand(key);
                            }
                          }}
                          className={`block rounded border ${c.cardBorder} ${
                            isExpanded ? "border-gray-600" : c.cardHover
                          } bg-gray-900/40 px-4 py-3 transition-colors group cursor-pointer focus:outline-none focus:border-gray-500 sm:col-span-1 ${
                            isExpanded ? "sm:col-span-2" : ""
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="text-sm font-semibold text-white group-hover:text-gray-100">
                              {method.name}
                            </h3>
                            <Link
                              href={`/search?q=${encodeURIComponent(method.name)}`}
                              onClick={(e) => e.stopPropagation()}
                              className={`text-[10px] font-mono ${c.accent} opacity-60 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:underline`}
                            >
                              search →
                            </Link>
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
                          {isExpanded && (
                            <div className="mt-3 pt-3 -mx-4 -mb-3 px-4 pb-4 border-t border-gray-700/70 bg-gray-900/80 rounded-b space-y-3">
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-gray-500">
                                  Problem
                                </p>
                                <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                                  {renderInline(method.problem)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-gray-500">
                                  Key insight
                                </p>
                                <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                                  {renderInline(method.keyInsight)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-gray-500">
                                  Example
                                </p>
                                <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                                  {renderInline(method.example)}
                                </p>
                              </div>
                              {method.figure && (
                                <div>
                                  <p className="text-[10px] uppercase tracking-widest text-gray-500">
                                    Figure
                                  </p>
                                  <div
                                    className="mt-1 rounded bg-gray-950/70 border border-gray-800/60 p-2 max-w-md"
                                    dangerouslySetInnerHTML={{ __html: method.figure }}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
          taxonomy curated 2026-06-02 · textbook-depth expansion added 2026-06-02 · cross-references
          to Epistemic Receipts claims pending
        </p>
      </div>
    </div>
  );
}
