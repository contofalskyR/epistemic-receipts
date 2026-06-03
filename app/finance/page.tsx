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
  | "violet"
  | "indigo"
  | "sky"
  | "cyan"
  | "lime"
  | "pink"
  | "fuchsia"
  | "red"
  | "yellow"
  | "zinc"
  | "slate"
  | "emerald"
  | "stone"
  | "neutral";

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
  indigo: { headerBg: "bg-indigo-950/40", headerBorder: "border-indigo-900", headerText: "text-indigo-200", chipBg: "bg-indigo-950/60", chipText: "text-indigo-300", cardBorder: "border-indigo-950/70", cardHover: "hover:border-indigo-700", accent: "text-indigo-400" },
  sky: { headerBg: "bg-sky-950/40", headerBorder: "border-sky-900", headerText: "text-sky-200", chipBg: "bg-sky-950/60", chipText: "text-sky-300", cardBorder: "border-sky-950/70", cardHover: "hover:border-sky-700", accent: "text-sky-400" },
  cyan: { headerBg: "bg-cyan-950/40", headerBorder: "border-cyan-900", headerText: "text-cyan-200", chipBg: "bg-cyan-950/60", chipText: "text-cyan-300", cardBorder: "border-cyan-950/70", cardHover: "hover:border-cyan-700", accent: "text-cyan-400" },
  lime: { headerBg: "bg-lime-950/40", headerBorder: "border-lime-900", headerText: "text-lime-200", chipBg: "bg-lime-950/60", chipText: "text-lime-300", cardBorder: "border-lime-950/70", cardHover: "hover:border-lime-700", accent: "text-lime-400" },
  pink: { headerBg: "bg-pink-950/40", headerBorder: "border-pink-900", headerText: "text-pink-200", chipBg: "bg-pink-950/60", chipText: "text-pink-300", cardBorder: "border-pink-950/70", cardHover: "hover:border-pink-700", accent: "text-pink-400" },
  fuchsia: { headerBg: "bg-fuchsia-950/40", headerBorder: "border-fuchsia-900", headerText: "text-fuchsia-200", chipBg: "bg-fuchsia-950/60", chipText: "text-fuchsia-300", cardBorder: "border-fuchsia-950/70", cardHover: "hover:border-fuchsia-700", accent: "text-fuchsia-400" },
  red: { headerBg: "bg-red-950/40", headerBorder: "border-red-900", headerText: "text-red-200", chipBg: "bg-red-950/60", chipText: "text-red-300", cardBorder: "border-red-950/70", cardHover: "hover:border-red-700", accent: "text-red-400" },
  yellow: { headerBg: "bg-yellow-950/40", headerBorder: "border-yellow-900", headerText: "text-yellow-200", chipBg: "bg-yellow-950/60", chipText: "text-yellow-300", cardBorder: "border-yellow-950/70", cardHover: "hover:border-yellow-700", accent: "text-yellow-400" },
  zinc: { headerBg: "bg-zinc-900/60", headerBorder: "border-zinc-700", headerText: "text-zinc-200", chipBg: "bg-zinc-800", chipText: "text-zinc-400", cardBorder: "border-zinc-800", cardHover: "hover:border-zinc-600", accent: "text-zinc-400" },
  slate: { headerBg: "bg-slate-900/60", headerBorder: "border-slate-700", headerText: "text-slate-200", chipBg: "bg-slate-800", chipText: "text-slate-400", cardBorder: "border-slate-800", cardHover: "hover:border-slate-600", accent: "text-slate-400" },
  emerald: { headerBg: "bg-emerald-950/40", headerBorder: "border-emerald-900", headerText: "text-emerald-200", chipBg: "bg-emerald-950/60", chipText: "text-emerald-300", cardBorder: "border-emerald-950/70", cardHover: "hover:border-emerald-700", accent: "text-emerald-400" },
  stone: { headerBg: "bg-stone-900/60", headerBorder: "border-stone-700", headerText: "text-stone-200", chipBg: "bg-stone-800", chipText: "text-stone-400", cardBorder: "border-stone-800", cardHover: "hover:border-stone-600", accent: "text-stone-400" },
  neutral: { headerBg: "bg-neutral-900/60", headerBorder: "border-neutral-700", headerText: "text-neutral-200", chipBg: "bg-neutral-800", chipText: "text-neutral-400", cardBorder: "border-neutral-800", cardHover: "hover:border-neutral-600", accent: "text-neutral-400" },
};

const FAMILIES: Family[] = [
  // ── FOUNDATIONS (teal/cyan) ────────────────────────────────────────────────
  {
    slug: "time-value-discounting",
    name: "Time Value of Money & Discounting",
    blurb: "The mathematical foundation of finance — a dollar today is worth more than a dollar tomorrow.",
    color: "teal",
    methods: [
      {
        name: "Present value (PV)",
        description: "Today's worth of future cash.",
        usedFor: ["foundations", "discounting"],
        problem: "How do you compare cash flows that occur at different times?",
        keyInsight: "PV = FV / (1+r)^n.",
        example: "$1,000 received in 5 years at 8% discount is worth $1,000/(1.08)^5 = $681 today — the amount you'd need to invest now to reach $1,000 in 5 years.",
      },
      {
        name: "Future value (FV)",
        description: "What money grows to.",
        usedFor: ["foundations"],
        problem: "If I invest a sum today, how much will it be worth in the future?",
        keyInsight: "FV = PV*(1+r)^n.",
        example: "$10,000 invested at 7% for 30 years grows to $10,000*(1.07)^30 = $76,123 — the power of compound growth over time.",
      },
      {
        name: "Net present value (NPV)",
        description: "Value a project creates.",
        usedFor: ["capital budgeting"],
        problem: "Should a company undertake a project that requires upfront investment for future cash flows?",
        keyInsight: "NPV = sum CF_t / (1+r)^t minus C0; accept if NPV > 0.",
        example: "A factory costs $5M now and generates $1.5M/year for 5 years at 10% discount. NPV = $1.5M × [1-(1.1)^(-5)]/0.1 - $5M = $686k > 0, so accept.",
      },
      {
        name: "Internal rate of return (IRR)",
        description: "Project break-even rate.",
        usedFor: ["capital budgeting"],
        problem: "What rate of return does a project actually deliver?",
        keyInsight: "the r that sets NPV = 0; compare to hurdle rate.",
        example: "A $100k investment returning $30k/year for 5 years has IRR ≈ 15.2%. If the hurdle rate is 12%, the project clears the bar.",
      },
      {
        name: "Annuity",
        description: "Level periodic payments.",
        usedFor: ["cash flows"],
        problem: "What's the value of a fixed stream of equal payments over time?",
        keyInsight: "PV = C*[1 - (1+r)^(-n)] / r.",
        example: "A 30-year mortgage of $300k at 6% requires monthly payment C such that $300k = C × [1-(1.005)^(-360)]/0.005, giving C = $1,799/month.",
      },
      {
        name: "Perpetuity",
        description: "Cash flows forever.",
        usedFor: ["cash flows"],
        problem: "What's the value of a payment stream that continues indefinitely?",
        keyInsight: "PV = C / r; growing perpetuity = C / (r - g).",
        example: "A stock paying $2/share in perpetuity at 8% required return is worth $2/0.08 = $25. If dividends grow 3%, value = $2/(0.08-0.03) = $40.",
      },
      {
        name: "Discounted cash flow (DCF)",
        description: "Value = discounted future cash.",
        usedFor: ["valuation"],
        problem: "How do you value an asset that generates uncertain future cash flows?",
        keyInsight: "sum projected cash flows at the required return; terminal value usually dominates.",
        example: "Valuing a company: project 5 years of free cash flow, add terminal value (perpetuity growth), discount all at WACC — terminal value is often 60-80% of total.",
      },
      {
        name: "Compounding frequency & EAR",
        description: "How often interest compounds.",
        usedFor: ["interest"],
        problem: "A bank quotes 12% annually compounded monthly — what's the actual annual rate?",
        keyInsight: "EAR = (1 + r/m)^m - 1; continuous compounding gives e^r - 1.",
        example: "12% compounded monthly: EAR = (1+0.12/12)^12 - 1 = 12.68%. Continuous: e^0.12 - 1 = 12.75%.",
      },
      {
        name: "Nominal vs real rates",
        description: "Stripping out inflation.",
        usedFor: ["interest", "inflation"],
        problem: "How do you separate the purchasing-power return from the nominal return?",
        keyInsight: "(1 + nominal) = (1 + real)*(1 + inflation) — the Fisher equation.",
        example: "A bond yields 5% nominal with 2% inflation. Real return ≈ (1.05/1.02) - 1 = 2.94%, the actual increase in purchasing power.",
      },
      {
        name: "Amortization",
        description: "Paying down a loan.",
        usedFor: ["loans"],
        problem: "How is each loan payment split between interest and principal?",
        keyInsight: "each payment is interest on the balance plus principal; schedules front-load interest.",
        example: "A $200k mortgage at 5% over 30 years: the first payment is $1,073, of which $833 is interest and $240 is principal. By year 20, it flips to $240 interest and $833 principal.",
      },
    ],
  },
  // ── CORPORATE & VALUATION (amber/orange) ───────────────────────────────────
  {
    slug: "financial-statement-analysis",
    name: "Financial Statement & Ratio Analysis",
    blurb: "Reading the numbers — extracting insight from balance sheets, income statements, and cash flows.",
    color: "amber",
    methods: [
      {
        name: "Liquidity ratios",
        description: "Can it cover short-term bills?",
        usedFor: ["solvency"],
        problem: "Can a company meet its near-term obligations without raising new capital?",
        keyInsight: "current ratio = current assets / current liabilities; quick ratio excludes inventory.",
        example: "A retailer with $50M current assets and $40M current liabilities has a current ratio of 1.25 — adequate but not comfortably liquid.",
      },
      {
        name: "Leverage ratios",
        description: "How much debt?",
        usedFor: ["leverage"],
        problem: "How indebted is the company, and can it service its debt?",
        keyInsight: "D/E, debt/assets, interest coverage = EBIT / interest.",
        example: "A company with $200M debt, $100M equity, and $50M EBIT paying $20M interest has D/E = 2x and interest coverage = 2.5x — highly leveraged but still covering.",
      },
      {
        name: "Profitability ratios",
        description: "Profit per dollar of what?",
        usedFor: ["profitability"],
        problem: "How efficiently does the company convert revenue or assets into profit?",
        keyInsight: "margins (gross/operating/net), ROA = NI/assets, ROE = NI/equity.",
        example: "A software company with 80% gross margin, 25% operating margin, and 15% net margin is highly profitable — each dollar of revenue yields $0.15 after all expenses.",
      },
      {
        name: "Efficiency ratios",
        description: "How hard do assets work?",
        usedFor: ["efficiency"],
        problem: "How quickly does the company turn assets into sales or collect on receivables?",
        keyInsight: "asset, inventory, and receivables turnover; days outstanding.",
        example: "A manufacturer with $50M inventory and $200M COGS has inventory turnover of 4x, or 91 days of inventory on hand — slower than a grocer at 12x (30 days).",
      },
      {
        name: "DuPont analysis",
        description: "Decompose ROE.",
        usedFor: ["decomposition"],
        problem: "Is high ROE coming from profit, efficiency, or leverage?",
        keyInsight: "ROE = net margin * asset turnover * equity multiplier.",
        example: "Two companies with 15% ROE: one has 5% margin × 1x turnover × 3x leverage (levered finance), the other 15% margin × 1x turnover × 1x leverage (unlevered tech).",
      },
      {
        name: "Common-size statements",
        description: "Scale-free comparison.",
        usedFor: ["comparison"],
        problem: "How do you compare companies of vastly different sizes?",
        keyInsight: "express each line as % of revenue (income statement) or assets (balance sheet).",
        example: "Walmart's SG&A is 20% of revenue vs. a boutique retailer at 35% — common-sizing reveals the efficiency gap that raw dollar amounts hide.",
      },
      {
        name: "Cash flow analysis",
        description: "Cash is not earnings.",
        usedFor: ["cash flow"],
        problem: "A company reports profits but is running out of cash — how?",
        keyInsight: "split cash into operating/investing/financing; free cash flow = CFO - capex.",
        example: "A growing company shows $50M net income but -$20M FCF because it's investing $70M in new plants — profitable but cash-hungry.",
      },
      {
        name: "EBITDA",
        description: "A proxy for operating cash.",
        usedFor: ["earnings"],
        problem: "How do you compare operating performance across firms with different capital structures and tax situations?",
        keyInsight: "earnings before interest, tax, depreciation, amortization — capital-structure neutral but ignores capex and working capital.",
        example: "An acquirer uses EV/EBITDA to compare targets: Company A at 8x vs. B at 12x — A looks cheaper, but B may have lower capex needs.",
      },
      {
        name: "Working capital management",
        description: "Funding day-to-day operations.",
        usedFor: ["operations"],
        problem: "How much cash is tied up in the operating cycle?",
        keyInsight: "cash conversion cycle = DIO + DSO - DPO.",
        example: "A manufacturer holds 60 days inventory, collects in 45 days, pays suppliers in 30 days: CCC = 60 + 45 - 30 = 75 days of cash tied up in operations.",
      },
      {
        name: "Accruals & earnings quality",
        description: "Are the earnings real?",
        usedFor: ["quality"],
        problem: "How much of reported earnings is backed by actual cash?",
        keyInsight: "large accruals (NI - CFO) signal lower-quality, less persistent earnings.",
        example: "If net income is $100M but CFO is only $30M, the $70M gap is accruals — revenue recognized but not collected, or expenses deferred.",
      },
    ],
  },
  {
    slug: "corporate-finance",
    name: "Corporate Finance & Capital Structure",
    blurb: "How firms fund themselves and allocate capital — the interplay of debt, equity, and investment decisions.",
    color: "orange",
    methods: [
      {
        name: "Capital budgeting",
        description: "Which projects to fund.",
        usedFor: ["investment decisions"],
        problem: "A firm has limited capital — which projects should get funded?",
        keyInsight: "rank by NPV; IRR and payback as supplements.",
        example: "Three projects with NPVs of $5M, $3M, and $1M: fund in order until capital runs out. IRR helps when NPVs are close but scale differs.",
      },
      {
        name: "WACC",
        description: "Blended financing cost.",
        usedFor: ["cost of capital"],
        problem: "What discount rate reflects the firm's overall cost of financing?",
        keyInsight: "WACC = (E/V)*r_e + (D/V)*r_d*(1 - tax_rate).",
        example: "50% equity at 12% cost, 50% debt at 6% with 25% tax rate: WACC = 0.5×12% + 0.5×6%×0.75 = 8.25%.",
      },
      {
        name: "Modigliani-Miller",
        description: "Does leverage matter?",
        usedFor: ["capital structure"],
        problem: "In a perfect world, does capital structure affect firm value?",
        keyInsight: "with no taxes/frictions, firm value is capital-structure independent; value comes from the tax shield net of distress costs.",
        example: "MM says a firm worth $100M stays worth $100M whether it's 100% equity or 50/50 debt-equity — in reality, the tax shield adds value until distress risk dominates.",
      },
      {
        name: "Trade-off theory",
        description: "The optimal debt level.",
        usedFor: ["capital structure"],
        problem: "How much debt should a firm carry?",
        keyInsight: "balance the debt tax shield against expected bankruptcy costs.",
        example: "A stable utility can carry 60% debt (low distress risk, high tax shield). A volatile tech startup should stay under 20% to avoid financial distress.",
      },
      {
        name: "Pecking-order theory",
        description: "Financing preference.",
        usedFor: ["capital structure"],
        problem: "Why do firms prefer certain financing sources over others?",
        keyInsight: "firms prefer internal funds, then debt, then equity — driven by adverse selection.",
        example: "Apple sat on $200B cash rather than issue equity because external financing signals information asymmetry — management knows more than the market.",
      },
      {
        name: "Cost of equity",
        description: "Shareholders' required return.",
        usedFor: ["cost of capital"],
        problem: "What return do shareholders demand for holding equity risk?",
        keyInsight: "CAPM gives r_e = Rf + beta*(ERP); dividend-growth gives D1/P + g.",
        example: "With 4% risk-free, beta of 1.2, and 5% equity risk premium: r_e = 4% + 1.2×5% = 10%.",
      },
      {
        name: "Dividend policy",
        description: "Pay out or retain.",
        usedFor: ["payout"],
        problem: "Should a company pay dividends or reinvest profits?",
        keyInsight: "MM dividend irrelevance under perfect markets; signaling and clientele effects in practice.",
        example: "Tech firms reinvest; utilities pay steady dividends. A dividend cut signals trouble, while an initiation signals confidence.",
      },
      {
        name: "Share repurchases",
        description: "Returning cash via buybacks.",
        usedFor: ["payout"],
        problem: "Why buy back stock instead of paying dividends?",
        keyInsight: "cut share count to lift EPS; tax-advantaged vs dividends and a signal of undervaluation.",
        example: "A company earning $1B with 100M shares ($10 EPS) buys back 10M shares at $100 each: now $1B over 90M shares = $11.11 EPS.",
      },
      {
        name: "Mergers & acquisitions",
        description: "Buying growth or synergy.",
        usedFor: ["M&A"],
        problem: "When does acquiring another company create value?",
        keyInsight: "value created only if synergies exceed the premium paid.",
        example: "Acquirer pays $10B for a target worth $7B standalone. The $3B premium requires $3B+ in synergies (cost cuts, revenue gains) to justify the deal.",
      },
      {
        name: "Leveraged buyout (LBO)",
        description: "Acquiring with debt.",
        usedFor: ["private equity"],
        problem: "How do PE firms generate returns using heavy leverage?",
        keyInsight: "returns come from debt paydown, multiple expansion, and operational improvement.",
        example: "A PE firm buys a company for $500M (20% equity, 80% debt). After 5 years, debt is paid down, EBITDA has grown, and they exit at 8x vs. 6x entry — 25% IRR.",
      },
      {
        name: "Real options",
        description: "Managerial flexibility has value.",
        usedFor: ["flexibility"],
        problem: "How do you value the ability to expand, delay, or abandon a project?",
        keyInsight: "value the options to expand, defer, or abandon using option-pricing logic, not static NPV.",
        example: "An oil company's drilling right is worth more than the NPV of expected oil because it includes the option to wait for higher prices — real option value.",
      },
    ],
  },
  {
    slug: "valuation",
    name: "Valuation",
    blurb: "What is something worth? Intrinsic value, relative value, and the art of pricing assets.",
    color: "amber",
    methods: [
      {
        name: "Dividend discount model (DDM)",
        description: "Value = discounted dividends.",
        usedFor: ["equity valuation"],
        problem: "What is a stock worth if you're only getting paid through dividends?",
        keyInsight: "Gordon growth gives P = D1 / (r - g).",
        example: "A stock paying $3 next year, growing at 4% forever, required return 10%: P = $3/(0.10-0.04) = $50.",
      },
      {
        name: "Free cash flow valuation",
        description: "Value the cash, not dividends.",
        usedFor: ["equity valuation"],
        problem: "Many firms don't pay dividends — how do you value their equity?",
        keyInsight: "discount FCFF at WACC (enterprise) or FCFE at r_e (equity).",
        example: "A firm generating $100M FCFF, growing 3% perpetually, WACC 9%: EV = $100M/(0.09-0.03) = $1.67B. Subtract net debt for equity value.",
      },
      {
        name: "Relative valuation (multiples)",
        description: "Price by comparables.",
        usedFor: ["multiples"],
        problem: "What should I pay for a company relative to its peers?",
        keyInsight: "apply peer multiples (P/E, EV/EBITDA, P/B) to the target metric.",
        example: "Peer companies trade at 12x P/E. Your target earns $50M: implied value = 12 × $50M = $600M.",
      },
      {
        name: "Enterprise value",
        description: "Value of the whole business.",
        usedFor: ["enterprise"],
        problem: "How do you measure total firm value independent of capital structure?",
        keyInsight: "EV = market cap + net debt; capital-structure neutral.",
        example: "A company with $1B market cap, $300M debt, $50M cash: EV = $1B + $300M - $50M = $1.25B — what an acquirer would pay for the whole firm.",
      },
      {
        name: "Terminal value",
        description: "Value beyond the forecast.",
        usedFor: ["DCF"],
        problem: "A DCF projects 5-10 years, but the company lives forever — how do you capture the rest?",
        keyInsight: "TV = FCF_n*(1+g) / (r - g) or an exit multiple.",
        example: "Year 5 FCF is $80M, growing 2.5% perpetually at 10% WACC: TV = $80M×1.025/(0.10-0.025) = $1.09B, discounted back 5 years.",
      },
      {
        name: "Residual income model",
        description: "Value added over the equity charge.",
        usedFor: ["accounting-based"],
        problem: "How do you value a firm based on accounting earnings rather than cash flows?",
        keyInsight: "value = book + sum (earnings - r_e*book) / (1 + r_e)^t.",
        example: "Book value $500M, ROE 15%, cost of equity 10%: annual residual income = (15%-10%)×$500M = $25M — the excess return above the equity charge.",
      },
      {
        name: "Economic value added (EVA)",
        description: "Profit above the capital charge.",
        usedFor: ["value creation"],
        problem: "Is a division really creating value after accounting for capital employed?",
        keyInsight: "EVA = NOPAT - WACC*invested capital.",
        example: "A division earns $50M NOPAT on $400M capital, WACC 10%: EVA = $50M - $40M = $10M — genuinely creating shareholder value.",
      },
      {
        name: "Sum-of-the-parts",
        description: "Value segments separately.",
        usedFor: ["conglomerates"],
        problem: "A conglomerate has unrelated businesses — how do you value the whole?",
        keyInsight: "value each division, aggregate, subtract net debt.",
        example: "A conglomerate's retail arm is worth $2B and tech arm $1.5B; net debt $500M: SOTP value = $3B. If trading at $2.5B, there's a conglomerate discount.",
      },
      {
        name: "Comparable transactions",
        description: "Price from past deals.",
        usedFor: ["M&A"],
        problem: "What's a fair price for an acquisition target?",
        keyInsight: "apply multiples paid in similar acquisitions including a control premium.",
        example: "Recent software acquisitions averaged 5x revenue with 30% control premium. Your target has $200M revenue: indicative value = $1B.",
      },
      {
        name: "Asset-based valuation",
        description: "Value from the balance sheet.",
        usedFor: ["liquidation"],
        problem: "What's a company worth in liquidation or when earnings are unreliable?",
        keyInsight: "net asset value = fair value of assets minus liabilities; a floor for asset-heavy firms.",
        example: "A real estate company with properties worth $500M and $200M debt: NAV = $300M — a floor even if operations are unprofitable.",
      },
    ],
  },
  // ── INVESTMENTS (indigo/violet) ────────────────────────────────────────────
  {
    slug: "portfolio-theory",
    name: "Portfolio Theory & Asset Allocation",
    blurb: "Combining assets to optimize the risk-return trade-off — Markowitz and beyond.",
    color: "indigo",
    methods: [
      {
        name: "Mean-variance optimization",
        description: "The efficient trade-off.",
        usedFor: ["Markowitz"],
        problem: "How do you construct a portfolio that maximizes return for a given level of risk?",
        keyInsight: "minimize portfolio variance w'Sw for a target return; diversification exploits covariances.",
        example: "An optimizer finds that 60% stocks / 40% bonds achieves 7% expected return at 10% volatility — the same return as 70/30 but with lower risk due to correlation.",
      },
      {
        name: "Efficient frontier",
        description: "Best return per unit of risk.",
        usedFor: ["Markowitz"],
        problem: "Which portfolios offer the best possible trade-off between risk and return?",
        keyInsight: "the locus of portfolios with maximum return for each variance level.",
        example: "Plotting all possible stock/bond combinations, the upper edge of the bullet-shaped region is the efficient frontier — anything below is suboptimal.",
      },
      {
        name: "Capital market line (CML)",
        description: "Adding a risk-free asset.",
        usedFor: ["asset allocation"],
        problem: "How does the availability of a risk-free asset change the optimal portfolio?",
        keyInsight: "tangent from Rf to the market portfolio; everyone holds a mix of the two.",
        example: "The tangent line from 3% risk-free to the market portfolio dominates the efficient frontier — all investors hold market plus T-bills, just different mixes.",
      },
      {
        name: "Diversification",
        description: "Don't concentrate.",
        usedFor: ["risk reduction"],
        problem: "Why does holding more assets reduce risk even if each is individually risky?",
        keyInsight: "portfolio variance falls with low/negative correlations; idiosyncratic risk diversifies away, systematic does not.",
        example: "A 30-stock portfolio eliminates ~90% of idiosyncratic risk. Beyond 50 stocks, you're left with market risk that can't be diversified away.",
      },
      {
        name: "Sharpe ratio",
        description: "Reward per unit of total risk.",
        usedFor: ["risk-adjusted"],
        problem: "How do you compare two portfolios with different risks and returns?",
        keyInsight: "(Rp - Rf) / sigma_p.",
        example: "Portfolio A: 10% return, 15% vol, 3% Rf → Sharpe = 0.47. Portfolio B: 8% return, 8% vol → Sharpe = 0.63. B is better risk-adjusted.",
      },
      {
        name: "Sortino ratio",
        description: "Penalize only downside.",
        usedFor: ["risk-adjusted", "downside"],
        problem: "Why punish upside volatility the same as downside?",
        keyInsight: "(Rp - Rf) / downside deviation.",
        example: "A hedge fund with high upside volatility (good) and low downside volatility has Sortino >> Sharpe — rewarding asymmetric return profiles.",
      },
      {
        name: "Risk parity",
        description: "Equalize risk, not capital.",
        usedFor: ["allocation"],
        problem: "A 60/40 portfolio gets 90% of its risk from stocks — is that balanced?",
        keyInsight: "weight assets so each contributes equal risk to the portfolio.",
        example: "Risk parity might allocate 25% stocks, 55% bonds, 20% commodities so each contributes ~33% of portfolio risk — very different from 60/40.",
      },
      {
        name: "Black-Litterman",
        description: "Blend views with the market.",
        usedFor: ["allocation", "bayesian"],
        problem: "Mean-variance is sensitive to return estimates — how do you stabilize it?",
        keyInsight: "start from market-implied equilibrium returns and Bayesian-update with investor views.",
        example: "Market-implied return for EM is 7%. You believe it's 9%. Black-Litterman blends these based on your confidence, avoiding corner solutions.",
      },
      {
        name: "Kelly criterion",
        description: "Optimal bet sizing.",
        usedFor: ["position sizing"],
        problem: "How much of your capital should you bet when you have an edge?",
        keyInsight: "fraction f* = edge/odds maximizes long-run log growth of capital.",
        example: "A coin flip pays 2:1 with 60% win probability: edge = 0.6×2 - 0.4 = 0.8, odds = 2, so f* = 0.8/2 = 40% of capital per bet.",
      },
      {
        name: "Rebalancing",
        description: "Hold the target mix.",
        usedFor: ["maintenance"],
        problem: "As asset prices move, the portfolio drifts from target weights — what to do?",
        keyInsight: "periodically trade back to target weights — controls drift and harvests mean reversion.",
        example: "A 60/40 portfolio drifts to 70/30 after a stock rally. Rebalancing sells stocks high and buys bonds — disciplined contrarianism.",
      },
    ],
  },
  {
    slug: "asset-pricing",
    name: "Asset Pricing & Factor Models",
    blurb: "Why do some assets earn higher returns? The equilibrium models that explain risk premia.",
    color: "violet",
    methods: [
      {
        name: "CAPM",
        description: "Price systematic risk.",
        usedFor: ["equilibrium"],
        problem: "What return should an asset earn given its risk?",
        keyInsight: "E[R] = Rf + beta*(E[Rm] - Rf); only market beta is compensated.",
        example: "Risk-free 3%, market premium 5%, stock beta 1.3: expected return = 3% + 1.3×5% = 9.5%.",
      },
      {
        name: "Beta",
        description: "Sensitivity to the market.",
        usedFor: ["systematic risk"],
        problem: "How much does a stock move when the market moves?",
        keyInsight: "beta = Cov(Ri, Rm) / Var(Rm); greater than 1 amplifies market moves.",
        example: "A tech stock with beta 1.5 rises 15% when the market rises 10%, but falls 15% when the market falls 10% — amplified systematic risk.",
      },
      {
        name: "Security market line (SML)",
        description: "CAPM drawn.",
        usedFor: ["equilibrium"],
        problem: "Which stocks are overpriced or underpriced according to CAPM?",
        keyInsight: "expected return is linear in beta; assets off the line are mispriced.",
        example: "A stock plots above the SML — its expected return exceeds what CAPM predicts for its beta. Either it's underpriced or CAPM is missing something.",
      },
      {
        name: "Arbitrage pricing theory (APT)",
        description: "Many priced factors.",
        usedFor: ["multi-factor"],
        problem: "What if risk comes from multiple sources, not just the market?",
        keyInsight: "E[R] = Rf + sum beta_k*lambda_k, enforced by no-arbitrage.",
        example: "Returns might depend on GDP growth, inflation surprises, and credit spreads — each with its own beta and risk premium.",
      },
      {
        name: "Fama-French three-factor",
        description: "Beyond the market.",
        usedFor: ["factors"],
        problem: "CAPM can't explain why small and value stocks outperform — what can?",
        keyInsight: "add size (SMB) and value (HML) to the market factor.",
        example: "A small-cap value fund's return = alpha + beta_mkt×Rm + beta_smb×SMB + beta_hml×HML. High loadings on SMB and HML explain the 'alpha' vs. CAPM.",
      },
      {
        name: "Carhart four-factor",
        description: "Add momentum.",
        usedFor: ["factors"],
        problem: "Stocks that went up keep going up — how do you capture that?",
        keyInsight: "FF3 plus a momentum factor (WML).",
        example: "A momentum strategy's return is explained by high loading on WML — it's not alpha, it's systematic exposure to the momentum premium.",
      },
      {
        name: "Fama-French five-factor",
        description: "Profitability & investment.",
        usedFor: ["factors"],
        problem: "Quality and conservative-investment stocks also outperform — expand the model.",
        keyInsight: "FF3 plus profitability (RMW) and investment (CMA).",
        example: "Profitable firms that invest conservatively (high RMW, high CMA) earn higher returns — the five-factor model captures this.",
      },
      {
        name: "Jensen's alpha",
        description: "Skill versus the model.",
        usedFor: ["performance"],
        problem: "Did the fund manager actually beat the market on a risk-adjusted basis?",
        keyInsight: "alpha = actual return minus CAPM-predicted return.",
        example: "A fund returned 12% with beta 1.1, Rf 3%, Rm 10%. Expected = 3% + 1.1×7% = 10.7%. Alpha = 12% - 10.7% = 1.3% — genuine outperformance.",
      },
      {
        name: "Factor investing / smart beta",
        description: "Rules-based factor tilts.",
        usedFor: ["factors"],
        problem: "Can you systematically harvest factor premia without active management?",
        keyInsight: "harvest persistent premia (value, momentum, quality, low-vol, size) systematically.",
        example: "A low-volatility ETF tilts toward stocks with beta < 1, harvesting the low-vol anomaly — higher risk-adjusted returns than the market.",
      },
      {
        name: "Consumption CAPM / ICAPM",
        description: "Risk from the macro state.",
        usedFor: ["equilibrium"],
        problem: "Why should market beta be the only thing that matters for pricing?",
        keyInsight: "assets paying off in bad-consumption states have lower required return.",
        example: "Luxury goods stocks pay off when consumption is high (good times), so they must offer higher expected returns to compensate for that correlation.",
      },
    ],
  },
  {
    slug: "performance-measurement",
    name: "Performance Measurement & Attribution",
    blurb: "Did the strategy actually work? Measuring returns, attributing sources, and avoiding self-deception.",
    color: "indigo",
    methods: [
      {
        name: "Time- vs money-weighted returns",
        description: "Whose performance?",
        usedFor: ["returns"],
        problem: "Cash flows in and out distort returns — whose performance are we measuring?",
        keyInsight: "TWR removes cash-flow timing (judges the manager); MWR/IRR reflects the investor's experience.",
        example: "A fund returned 20% in year 1, -10% in year 2. An investor who added money after year 1 has a worse MWR than the fund's TWR.",
      },
      {
        name: "Arithmetic vs geometric returns",
        description: "Averaging matters.",
        usedFor: ["returns"],
        problem: "Which average return should you report — the arithmetic or geometric?",
        keyInsight: "geometric return is less than or equal to arithmetic; geometric reflects true multi-period growth.",
        example: "+50% then -50%: arithmetic mean = 0%, geometric mean = -13.4%. You lost 25% of your money — geometric tells the truth.",
      },
      {
        name: "Jensen's alpha",
        description: "Risk-adjusted outperformance.",
        usedFor: ["risk-adjusted"],
        problem: "A fund beat the market, but was that just because it took more risk?",
        keyInsight: "return above the CAPM benchmark for the portfolio's beta.",
        example: "A fund with beta 0.8 should return Rf + 0.8×(Rm-Rf). Any excess is alpha — skill or luck?",
      },
      {
        name: "Information ratio",
        description: "Active return per active risk.",
        usedFor: ["active management"],
        problem: "Is the fund's deviation from benchmark rewarded with excess return?",
        keyInsight: "(Rp - R_benchmark) / tracking error.",
        example: "A fund beats its benchmark by 2% with 4% tracking error: IR = 0.5. An IR of 0.5 is good; 1.0 is excellent.",
      },
      {
        name: "Tracking error",
        description: "Distance from the benchmark.",
        usedFor: ["active management"],
        problem: "How much does the portfolio deviate from its benchmark?",
        keyInsight: "the standard deviation of active returns.",
        example: "An index fund has 0.1% tracking error; an active fund has 5%. Higher tracking error means more active bets — good or bad.",
      },
      {
        name: "Treynor ratio",
        description: "Reward per unit of systematic risk.",
        usedFor: ["risk-adjusted"],
        problem: "For a diversified investor, only beta matters — what's the reward per unit of beta?",
        keyInsight: "(Rp - Rf) / beta.",
        example: "Two funds: A has 10% excess return with beta 1.5 (Treynor = 6.7%), B has 8% excess with beta 0.8 (Treynor = 10%). B is better for a diversified investor.",
      },
      {
        name: "Maximum drawdown",
        description: "Worst peak-to-trough loss.",
        usedFor: ["risk"],
        problem: "What's the worst loss an investor could have experienced?",
        keyInsight: "the largest cumulative decline from a high.",
        example: "A fund peaked at $100, dropped to $60, then recovered to $90 before dropping to $70. Max drawdown = 40% (100→60), not 30%.",
      },
      {
        name: "Brinson attribution",
        description: "Why we beat the benchmark.",
        usedFor: ["attribution"],
        problem: "The fund beat the benchmark by 2% — was it sector allocation or stock selection?",
        keyInsight: "decompose active return into allocation, selection, and interaction effects.",
        example: "Overweighting tech (+allocation) and picking winning tech stocks (+selection) both contributed — attribution separates the sources.",
      },
      {
        name: "Benchmark selection",
        description: "The yardstick matters.",
        usedFor: ["evaluation"],
        problem: "A fund beats the S&P 500 but holds small caps — is that fair?",
        keyInsight: "a valid benchmark is investable, unambiguous, and specified in advance.",
        example: "A small-cap fund should be measured against Russell 2000, not S&P 500 — mismatched benchmarks create false alpha.",
      },
      {
        name: "GIPS standards",
        description: "Comparable reporting.",
        usedFor: ["reporting"],
        problem: "Managers cherry-pick their best accounts for marketing — how do you ensure honest reporting?",
        keyInsight: "standardized rules for calculating and presenting performance, to prevent cherry-picking.",
        example: "GIPS requires composite reporting — all accounts managed to a strategy must be included, not just the best performers.",
      },
    ],
  },
  // ── MARKETS & INSTRUMENTS (emerald/green) ──────────────────────────────────
  {
    slug: "fixed-income",
    name: "Fixed Income & Interest Rates",
    blurb: "Bonds, yield curves, and the mathematics of interest-rate risk.",
    color: "emerald",
    methods: [
      {
        name: "Bond pricing",
        description: "PV of coupons plus face.",
        usedFor: ["bonds"],
        problem: "What is a bond worth today?",
        keyInsight: "price = sum C/(1+y)^t + F/(1+y)^n; price moves inversely to yield.",
        example: "A 5-year bond, 4% coupon, $1000 face, yield 5%: price = $40×[1-(1.05)^-5]/0.05 + $1000/1.05^5 = $957 — trading at a discount.",
      },
      {
        name: "Yield to maturity (YTM)",
        description: "A bond's IRR.",
        usedFor: ["yield"],
        problem: "What single rate summarizes a bond's total return if held to maturity?",
        keyInsight: "the single rate equating price to discounted cash flows.",
        example: "A bond priced at $950 with $40 annual coupons for 5 years and $1000 face has YTM ≈ 5.3% — the discount rate that makes PV = $950.",
      },
      {
        name: "Spot & forward rates",
        description: "Yield-curve building blocks.",
        usedFor: ["term structure"],
        problem: "What are the zero-coupon rates for each maturity, and what do they imply about future rates?",
        keyInsight: "forwards are implied by no-arbitrage between spot rates.",
        example: "1-year spot 4%, 2-year spot 4.5%. The 1-year forward rate 1 year from now: (1.045)²/(1.04) - 1 = 5% — market's implied future rate.",
      },
      {
        name: "Macaulay & modified duration",
        description: "Rate sensitivity.",
        usedFor: ["interest-rate risk"],
        problem: "How much will a bond's price change if rates move?",
        keyInsight: "modified duration approx -(1/P)(dP/dy); % price change approx -D_mod*delta_y.",
        example: "A bond with modified duration 7 loses ~7% if rates rise 1%. Duration = 7 years means the weighted-average time to cash flows is 7 years.",
      },
      {
        name: "Convexity",
        description: "The curvature correction.",
        usedFor: ["interest-rate risk"],
        problem: "Duration is a linear approximation — what about large rate moves?",
        keyInsight: "delta_P/P approx -D*delta_y + 0.5*C*(delta_y)^2.",
        example: "For a 2% rate rise, duration predicts -14% but convexity adds back ~+1%, so actual loss is ~-13%. Convexity is always positive for plain bonds.",
      },
      {
        name: "Term structure / yield curve",
        description: "Rates by maturity.",
        usedFor: ["curve"],
        problem: "Why do short-term and long-term rates differ?",
        keyInsight: "shape (normal/inverted/flat) reflects expectations, term premia, and supply-demand.",
        example: "An inverted yield curve (short rates > long rates) often precedes recession — the market expects the Fed to cut rates.",
      },
      {
        name: "Immunization",
        description: "Lock in a horizon return.",
        usedFor: ["ALM"],
        problem: "A pension fund must pay $100M in 10 years — how does it guarantee the payout?",
        keyInsight: "match asset and liability duration so rate moves offset.",
        example: "Buy bonds with duration = 10 years. If rates rise, reinvestment gains offset price losses, and vice versa — the 10-year horizon return is locked.",
      },
      {
        name: "Credit spreads",
        description: "Pay for default risk.",
        usedFor: ["credit"],
        problem: "Why do corporate bonds yield more than Treasuries?",
        keyInsight: "spread = corporate yield minus Treasury yield; widens with default risk and illiquidity.",
        example: "A BBB bond yields 6% vs. Treasury 4%: 200bp spread compensates for ~2% expected loss and illiquidity premium.",
      },
      {
        name: "Vasicek & CIR models",
        description: "Short-rate dynamics.",
        usedFor: ["term-structure models"],
        problem: "How do you model the evolution of interest rates over time?",
        keyInsight: "mean-reverting SDEs; CIR keeps rates positive via sqrt(r) diffusion.",
        example: "Vasicek: dr = a(b-r)dt + σdW. Mean-reversion pulls rates toward b; CIR's sqrt(r) term prevents negative rates.",
      },
      {
        name: "Heath-Jarrow-Morton (HJM)",
        description: "Model the whole curve.",
        usedFor: ["term-structure models"],
        problem: "Instead of modeling the short rate, can you model the entire forward curve directly?",
        keyInsight: "specify forward-rate dynamics directly with no-arbitrage drift restrictions.",
        example: "HJM models each forward rate's evolution simultaneously, with drifts constrained by no-arbitrage — more flexible but more complex.",
      },
    ],
  },
  {
    slug: "derivatives",
    name: "Derivatives & Options Pricing",
    blurb: "Forwards, futures, swaps, and options — the instruments that transfer and transform risk.",
    color: "emerald",
    methods: [
      {
        name: "Forwards & futures",
        description: "Lock in a future price.",
        usedFor: ["linear derivatives"],
        problem: "How do you lock in a price today for a transaction in the future?",
        keyInsight: "forward price = S*e^((r-q)T); futures settle daily (mark-to-market).",
        example: "Oil at $80/barrel, 6-month rate 5%, no convenience yield: forward = $80×e^(0.05×0.5) = $82.02.",
      },
      {
        name: "Swaps",
        description: "Exchange cash-flow streams.",
        usedFor: ["swaps"],
        problem: "How do you exchange fixed for floating interest payments without exchanging principal?",
        keyInsight: "an interest-rate swap is a strip of forwards; value = fixed-leg PV minus floating-leg PV.",
        example: "A 5-year swap: pay 4% fixed, receive LIBOR. If rates rise, the fixed payer wins — locked in a lower rate.",
      },
      {
        name: "Put-call parity",
        description: "Calls and puts are linked.",
        usedFor: ["no-arbitrage"],
        problem: "What's the relationship between a call and a put on the same underlying?",
        keyInsight: "C - P = S - K*e^(-rT); arbitrage enforces it.",
        example: "Stock at $100, 1-year call (K=100) at $12, put at $8, 5% rate: $12 - $8 = $4 vs. $100 - $100/1.05 = $4.76 — close to parity.",
      },
      {
        name: "Black-Scholes-Merton",
        description: "Closed-form option price.",
        usedFor: ["options"],
        problem: "What is the fair price of a European option?",
        keyInsight: "C = S*N(d1) - K*e^(-rT)*N(d2); risk-neutral pricing under GBM.",
        example: "Stock $100, strike $100, 1 year, 5% rate, 20% vol: d1 = 0.35, d2 = 0.15, C = $10.45.",
      },
      {
        name: "Binomial option pricing",
        description: "Lattice valuation.",
        usedFor: ["options", "numerical"],
        problem: "How do you price options when closed-form solutions don't exist?",
        keyInsight: "model up/down steps; price by risk-neutral backward induction.",
        example: "A 3-step binomial tree with u=1.1, d=0.9: work backward from terminal payoffs, discounting at the risk-free rate with risk-neutral probabilities.",
      },
      {
        name: "The Greeks",
        description: "Risk sensitivities.",
        usedFor: ["hedging"],
        problem: "How does option value change with spot, vol, time, and rates?",
        keyInsight: "delta (dV/dS), gamma (d2V/dS2), vega (dV/d_sigma), theta (dV/dt), rho (dV/dr).",
        example: "A delta of 0.5 means the option moves $0.50 for every $1 move in the stock — a 50% sensitivity to the underlying.",
      },
      {
        name: "Implied volatility",
        description: "The market's vol estimate.",
        usedFor: ["volatility"],
        problem: "What volatility does the market expect?",
        keyInsight: "the sigma that makes Black-Scholes match the traded price.",
        example: "An option trades at $12; Black-Scholes with 20% vol gives $10. Solving for sigma gives IV = 25% — the market expects more vol than 20%.",
      },
      {
        name: "Volatility smile / surface",
        description: "Implied vol is not flat.",
        usedFor: ["volatility"],
        problem: "If Black-Scholes were right, IV would be the same for all strikes — why isn't it?",
        keyInsight: "IV varies with strike and maturity, revealing fat tails and skew that violate log-normality.",
        example: "Out-of-the-money puts trade at higher IV than ATM options — the 'skew' reflects crash risk that Black-Scholes ignores.",
      },
      {
        name: "Exotic options",
        description: "Path-dependent payoffs.",
        usedFor: ["exotics"],
        problem: "What if the payoff depends on the path, not just the final price?",
        keyInsight: "barriers, Asians, lookbacks — usually priced by Monte Carlo or PDE.",
        example: "An Asian call pays max(avg_price - K, 0) — averages out manipulation risk and is cheaper than a vanilla call.",
      },
      {
        name: "Monte Carlo option pricing",
        description: "Simulate the payoff.",
        usedFor: ["numerical"],
        problem: "How do you price complex derivatives without closed-form solutions?",
        keyInsight: "average discounted payoff over many risk-neutral price paths.",
        example: "Simulate 100,000 GBM paths, compute the payoff for each, discount at the risk-free rate, and average — Monte Carlo gives an unbiased estimate.",
      },
    ],
  },
  {
    slug: "market-microstructure",
    name: "Market Microstructure & Trading",
    blurb: "How markets actually work — order books, spreads, price impact, and execution.",
    color: "emerald",
    methods: [
      {
        name: "Bid-ask spread",
        description: "The cost of immediacy.",
        usedFor: ["liquidity"],
        problem: "Why is the price you pay to buy higher than the price you receive to sell?",
        keyInsight: "the gap compensates market makers for processing, inventory, and adverse-selection risk.",
        example: "A stock quotes 99.90 bid / 100.10 ask: the $0.20 spread is the round-trip cost of immediacy — you pay to trade now rather than wait.",
      },
      {
        name: "Order book & market depth",
        description: "Visible supply and demand.",
        usedFor: ["liquidity"],
        problem: "How much can you trade before moving the price?",
        keyInsight: "the ladder of resting limit orders; depth is how much can trade before price moves.",
        example: "The order book shows 10,000 shares at $100.00, 5,000 at $100.05, 3,000 at $100.10. A 15,000-share buy clears through to $100.05.",
      },
      {
        name: "Kyle model",
        description: "Informed trading and price impact.",
        usedFor: ["price impact"],
        problem: "How do market makers set prices when some traders are informed?",
        keyInsight: "informed orders move price linearly (Kyle's lambda) as market makers infer information.",
        example: "Kyle's lambda measures price impact: if λ = 0.01, a 10,000-share order moves the price by $100. Informed traders optimize order size to hide their information.",
      },
      {
        name: "Roll model",
        description: "Spread from prices alone.",
        usedFor: ["spread estimation"],
        problem: "How do you estimate the spread when you only observe transaction prices?",
        keyInsight: "bid-ask bounce induces negative serial covariance; spread approx 2*sqrt(-Cov).",
        example: "Prices alternate between bid and ask, creating negative autocorrelation. If Cov = -0.01, estimated spread = 2×sqrt(0.01) = $0.20.",
      },
      {
        name: "Price impact",
        description: "Trading moves the market.",
        usedFor: ["execution"],
        problem: "How much will your trade move the price against you?",
        keyInsight: "impact rises with order size, roughly proportional to sqrt(volume).",
        example: "The square-root law: to buy 4x the shares, you pay ~2x the impact. A 1% volume trade might move the price 10bp; 4% volume moves it 20bp.",
      },
      {
        name: "Market making",
        description: "Liquidity for a spread.",
        usedFor: ["liquidity provision"],
        problem: "How do market makers profit while providing liquidity?",
        keyInsight: "quote both sides, manage inventory, earn the spread net of adverse-selection losses.",
        example: "A market maker quotes 99.95 / 100.05, earns $0.10 per round-trip, but loses $0.50 when informed traders pick off stale quotes.",
      },
      {
        name: "Execution algorithms (VWAP/TWAP)",
        description: "Trade without tipping.",
        usedFor: ["execution"],
        problem: "How do you execute a large order without signaling your intent?",
        keyInsight: "slice large orders over time to track a benchmark.",
        example: "VWAP slices a 100,000-share order to match intraday volume — trading 5% of volume each period to blend into normal flow.",
      },
      {
        name: "Implementation shortfall",
        description: "The true cost of trading.",
        usedFor: ["execution"],
        problem: "What is the total cost of executing a trade, including everything?",
        keyInsight: "the gap between decision price and achieved price (impact + delay + opportunity cost).",
        example: "You decide to buy at $100, but execution averages $101 after market impact and delay: implementation shortfall = 1%, or $1 per share.",
      },
      {
        name: "High-frequency trading",
        description: "Speed as edge.",
        usedFor: ["HFT"],
        problem: "How do some traders profit from being microseconds faster?",
        keyInsight: "latency-sensitive market-making and arbitrage from microsecond advantages.",
        example: "An HFT firm sees a buy order arrive at Exchange A and races to buy at Exchange B before the quote updates — latency arbitrage measured in microseconds.",
      },
      {
        name: "Limit vs market orders",
        description: "Price versus certainty.",
        usedFor: ["order types"],
        problem: "Should you demand liquidity (market order) or provide it (limit order)?",
        keyInsight: "market orders pay the spread for immediacy; limit orders save it but risk non-execution.",
        example: "A market order to buy 1,000 shares at $100.10 executes instantly. A limit at $100.00 might save $0.10/share but could miss the trade entirely.",
      },
    ],
  },
  // ── RISK & QUANT (rose/red) ────────────────────────────────────────────────
  {
    slug: "risk-management",
    name: "Risk Management",
    blurb: "Measuring and managing financial risk — VaR, stress testing, and hedging.",
    color: "rose",
    methods: [
      {
        name: "Value at Risk (VaR)",
        description: "Worst loss at a confidence level.",
        usedFor: ["market risk"],
        problem: "How bad could things get with 99% confidence?",
        keyInsight: "the loss not exceeded with probability alpha over a horizon (e.g., 99% 1-day VaR).",
        example: "A portfolio has 1-day 99% VaR of $5M: there's a 1% chance of losing more than $5M tomorrow.",
      },
      {
        name: "Historical simulation VaR",
        description: "Let history speak.",
        usedFor: ["market risk"],
        problem: "How do you estimate VaR without assuming a distribution?",
        keyInsight: "reprice portfolio over past return scenarios and read off the quantile.",
        example: "Apply each of the last 500 daily returns to today's portfolio, sort the P&L, and take the 5th-worst as 99% VaR — no distribution assumed.",
      },
      {
        name: "Parametric VaR",
        description: "Assume normality.",
        usedFor: ["market risk"],
        problem: "Can you compute VaR quickly with a closed-form formula?",
        keyInsight: "VaR = z_alpha*sigma_portfolio*sqrt(h); fast but understates fat tails.",
        example: "Portfolio vol = $10M, 99% z = 2.33: 1-day VaR = 2.33 × $10M = $23.3M. Fast, but misses tail risk.",
      },
      {
        name: "Expected shortfall (CVaR)",
        description: "Average loss in the tail.",
        usedFor: ["tail risk"],
        problem: "VaR tells you the threshold — but how bad is bad when you exceed it?",
        keyInsight: "the mean loss beyond VaR; coherent (subadditive) where VaR is not.",
        example: "99% VaR is $5M, but the average loss in the worst 1% of scenarios is $8M — CVaR of $8M is more conservative and mathematically well-behaved.",
      },
      {
        name: "Stress testing & scenario analysis",
        description: "What if it breaks?",
        usedFor: ["tail risk"],
        problem: "VaR uses historical or assumed distributions — what about extreme but plausible scenarios?",
        keyInsight: "reprice under extreme-but-plausible shocks rather than historical probabilities.",
        example: "What if rates spike 300bp, equities fall 40%, and credit spreads blow out? Stress test reprices the portfolio under this scenario to find the loss.",
      },
      {
        name: "Credit risk (PD/LGD/EAD)",
        description: "Expected-loss components.",
        usedFor: ["credit risk"],
        problem: "How do you estimate expected loss from a credit exposure?",
        keyInsight: "expected loss = PD * LGD * EAD.",
        example: "A $10M loan with 2% default probability and 40% loss given default: EL = 2% × 40% × $10M = $80k — the actuarial reserve needed.",
      },
      {
        name: "Merton structural model",
        description: "Default as an option.",
        usedFor: ["credit risk"],
        problem: "How do you model default using option theory?",
        keyInsight: "equity is a call on firm assets struck at the debt; default when asset value < debt.",
        example: "A firm with $100M assets and $80M debt: equity = call(assets, strike=80). If assets fall below $80M, the 'call' expires worthless (default).",
      },
      {
        name: "Hedging",
        description: "Offset unwanted exposure.",
        usedFor: ["mitigation"],
        problem: "How do you reduce risk without liquidating the position?",
        keyInsight: "take an opposing position (hedge ratio = exposure / contract sensitivity).",
        example: "Long $10M of stock, hedge with futures: sell 100 contracts at $100k notional each. Delta-1 hedge eliminates market exposure.",
      },
      {
        name: "Greeks-based hedging",
        description: "Dynamic option hedging.",
        usedFor: ["mitigation"],
        problem: "An option position has complex risk — how do you neutralize it?",
        keyInsight: "delta-hedge to remove directional risk, rebalancing as gamma shifts delta.",
        example: "An option with delta 0.5 on 1,000 shares: sell 500 shares to be delta-neutral. As the stock moves, gamma shifts delta, requiring rebalancing.",
      },
      {
        name: "Liquidity risk",
        description: "Can't trade without moving price.",
        usedFor: ["liquidity"],
        problem: "What if you can't sell at a reasonable price when you need to?",
        keyInsight: "funding vs market liquidity; spreads and haircuts blow out in stress.",
        example: "In 2008, repo haircuts on mortgage bonds spiked from 2% to 45% — the same asset required 20x more equity to hold, forcing fire sales.",
      },
    ],
  },
  {
    slug: "financial-econometrics",
    name: "Financial Econometrics & Time Series",
    blurb: "Modeling returns, volatility, and their statistical properties.",
    color: "rose",
    methods: [
      {
        name: "Returns & log returns",
        description: "The unit of analysis.",
        usedFor: ["returns"],
        problem: "What's the right way to measure price changes over time?",
        keyInsight: "log return = ln(P_t / P_{t-1}); additive over time and roughly stationary.",
        example: "A stock goes from $100 to $110: simple return = 10%, log return = ln(1.10) = 9.53%. For multi-period, log returns simply add.",
      },
      {
        name: "Stylized facts of returns",
        description: "What returns actually do.",
        usedFor: ["properties"],
        problem: "What empirical regularities do financial returns exhibit?",
        keyInsight: "near-zero autocorrelation, volatility clustering, fat tails, and a leverage effect.",
        example: "Returns are unpredictable (random walk), but absolute returns are autocorrelated (volatility clusters). Tails are fatter than normal — crashes happen.",
      },
      {
        name: "GARCH family",
        description: "Volatility clustering.",
        usedFor: ["volatility", "xref: statistics"],
        problem: "Volatility is not constant — how do you model its dynamics?",
        keyInsight: "sigma^2_t = omega + alpha*epsilon^2_{t-1} + beta*sigma^2_{t-1}.",
        example: "GARCH(1,1) captures the fact that a large return today predicts high volatility tomorrow — alpha captures shock impact, beta captures persistence.",
      },
      {
        name: "Stochastic volatility models",
        description: "Vol as a latent process.",
        usedFor: ["volatility"],
        problem: "What if volatility itself is random, not just deterministic?",
        keyInsight: "volatility follows its own random process, not a deterministic GARCH recursion.",
        example: "In Heston, variance follows a mean-reverting square-root process: dv = kappa*(theta - v)dt + xi*sqrt(v)*dW_v, with correlation to price shocks.",
      },
      {
        name: "Realized volatility",
        description: "Vol from high-frequency data.",
        usedFor: ["volatility", "high-frequency"],
        problem: "Can you measure volatility directly rather than modeling it?",
        keyInsight: "sum of squared intraday returns estimates the day's integrated variance.",
        example: "Sum squared 5-minute returns over a trading day: RV = Σr²_i ≈ integrated variance. More accurate than daily squared returns.",
      },
      {
        name: "Cointegration & pairs trading",
        description: "Long-run equilibrium.",
        usedFor: ["mean reversion", "xref: statistics"],
        problem: "Two non-stationary series move together — how do you exploit that?",
        keyInsight: "two non-stationary prices with a stationary linear combination mean-revert — trade the spread.",
        example: "Coca-Cola and Pepsi are cointegrated: when KO/PEP ratio deviates from its mean, bet on reversion. The spread is stationary even if prices aren't.",
      },
      {
        name: "Event studies",
        description: "Did the news move the price?",
        usedFor: ["abnormal returns"],
        problem: "How do you measure the impact of a specific event on stock price?",
        keyInsight: "measure abnormal returns (actual minus expected) around an event window.",
        example: "Around an earnings announcement: CAR (cumulative abnormal return) over [-1, +1] days measures the information content of the release.",
      },
      {
        name: "Factor regressions",
        description: "Decompose returns.",
        usedFor: ["factors"],
        problem: "How much of a fund's return is explained by known factors vs. skill?",
        keyInsight: "regress excess returns on factors; betas are exposures, alpha is the unexplained remainder.",
        example: "A hedge fund's return regressed on market, SMB, HML, and MOM: R² = 60% means 40% is unexplained — potential alpha or missing factors.",
      },
      {
        name: "Jump-diffusion models",
        description: "Prices jump.",
        usedFor: ["jumps"],
        problem: "Continuous price paths can't explain crashes — how do you model discontinuities?",
        keyInsight: "add a Poisson jump term to Brownian diffusion to capture crashes and gaps.",
        example: "Merton's jump-diffusion: dS/S = μdt + σdW + J*dN, where N is Poisson. Captures both continuous moves and sudden jumps (good or bad).",
      },
      {
        name: "VaR backtesting",
        description: "Is the model honest?",
        usedFor: ["validation"],
        problem: "How do you test whether a VaR model is accurate?",
        keyInsight: "count exceptions (losses beyond VaR); too many means the model understates risk.",
        example: "A 99% VaR should be exceeded ~2.5 times per year (1% of 250 trading days). If you see 10 exceptions, the model is broken.",
      },
    ],
  },
  {
    slug: "quantitative-computational",
    name: "Quantitative & Computational Finance",
    blurb: "The mathematical and computational machinery underlying modern finance.",
    color: "red",
    methods: [
      {
        name: "Stochastic calculus & Ito's lemma",
        description: "Calculus for random paths.",
        usedFor: ["math foundations"],
        problem: "How do you take derivatives of functions of random processes?",
        keyInsight: "for dS = mu*S*dt + sigma*S*dW, Ito gives df = (f_t + mu*S*f_S + 0.5*sigma^2*S^2*f_SS)*dt + sigma*S*f_S*dW.",
        example: "If S follows GBM and f = ln(S), Ito's lemma gives d(lnS) = (mu - sigma²/2)dt + sigma*dW — the famous drift adjustment.",
      },
      {
        name: "Geometric Brownian motion",
        description: "The standard price model.",
        usedFor: ["math foundations"],
        problem: "What's the simplest model for stock prices that captures randomness and growth?",
        keyInsight: "dS/S = mu*dt + sigma*dW gives log-normal prices; the basis of Black-Scholes.",
        example: "GBM with μ=10% and σ=20%: expected price doubles in ~7 years, but realized paths vary wildly around that expectation.",
      },
      {
        name: "Risk-neutral pricing",
        description: "Price as a discounted expectation.",
        usedFor: ["pricing theory"],
        problem: "How do you price derivatives without knowing investor risk preferences?",
        keyInsight: "under the risk-neutral measure Q, price = e^(-rT)*E^Q[payoff].",
        example: "Under Q, all assets drift at the risk-free rate. The option price is just the discounted expected payoff under Q — no need to estimate risk premia.",
      },
      {
        name: "Martingale & no-arbitrage",
        description: "The pricing backbone.",
        usedFor: ["pricing theory"],
        problem: "What mathematical structure ensures prices are arbitrage-free?",
        keyInsight: "discounted prices are martingales under Q; arbitrage-free iff such a measure exists.",
        example: "The First Fundamental Theorem: no arbitrage ⟺ an equivalent martingale measure exists. This is why we can use risk-neutral pricing.",
      },
      {
        name: "Monte Carlo simulation",
        description: "Price by sampling paths.",
        usedFor: ["numerical"],
        problem: "How do you price path-dependent or high-dimensional derivatives?",
        keyInsight: "simulate many risk-neutral scenarios and average discounted payoffs.",
        example: "Price a basket option on 50 stocks: simulate 100,000 correlated GBM paths, compute each payoff, discount, and average.",
      },
      {
        name: "Finite difference methods",
        description: "Solve the pricing PDE.",
        usedFor: ["numerical"],
        problem: "How do you solve the Black-Scholes PDE numerically?",
        keyInsight: "discretize the Black-Scholes PDE on a grid (explicit / implicit / Crank-Nicolson).",
        example: "An implicit finite-difference scheme on a 100×100 grid solves for option values at all S and t simultaneously — stable and accurate.",
      },
      {
        name: "Binomial & trinomial trees",
        description: "Discrete lattices.",
        usedFor: ["numerical"],
        problem: "How do you price American options that can be exercised early?",
        keyInsight: "model the underlying as recombining moves and price by backward induction.",
        example: "A 50-step binomial tree: at each node, compare exercise value to continuation value. Work backward to get today's price.",
      },
      {
        name: "Copulas in finance",
        description: "Joint defaults and tail dependence.",
        usedFor: ["dependence", "xref: statistics"],
        problem: "How do you model the dependence between credit defaults?",
        keyInsight: "separate marginals from dependence; the Gaussian copula (in)famously underpinned CDO pricing.",
        example: "The Gaussian copula assumes correlation is the same in good and bad times. 2008 showed tail dependence is actually much higher in crashes.",
      },
      {
        name: "Machine learning in finance",
        description: "Data-driven prediction.",
        usedFor: ["ML"],
        problem: "Can ML improve on traditional financial models?",
        keyInsight: "powerful for signals, pricing, and risk, but prone to overfitting noisy non-stationary markets.",
        example: "Neural networks can price complex derivatives faster than Monte Carlo, but overfit to historical patterns that may not repeat.",
      },
      {
        name: "Numerical optimization",
        description: "Calibrate and allocate.",
        usedFor: ["calibration"],
        problem: "How do you fit model parameters to market prices?",
        keyInsight: "fit model parameters to market prices via constrained optimization.",
        example: "Calibrate a Heston model to the vol surface: minimize sum of squared errors between model and market IV across 50 strikes and maturities.",
      },
    ],
  },
  // ── BEHAVIOR & MACRO (sky/blue) ────────────────────────────────────────────
  {
    slug: "behavioral-finance",
    name: "Behavioral Finance & Market Efficiency",
    blurb: "When markets aren't efficient — biases, anomalies, and the limits to arbitrage.",
    color: "sky",
    methods: [
      {
        name: "Efficient market hypothesis (EMH)",
        description: "Prices reflect information.",
        usedFor: ["EMH"],
        problem: "Can you beat the market consistently?",
        keyInsight: "weak (past prices), semi-strong (public info), strong (all info) forms; consistently beating the market should be impossible.",
        example: "Weak EMH: technical analysis shouldn't work. Semi-strong: fundamental analysis shouldn't work. Strong: even insiders can't beat it (clearly false).",
      },
      {
        name: "Random walk",
        description: "Prices are unpredictable.",
        usedFor: ["EMH"],
        problem: "Can past prices predict future prices?",
        keyInsight: "P_t = P_{t-1} + epsilon_t; price changes are unforecastable if markets are efficient.",
        example: "Tomorrow's return is independent of today's return — like a coin flip. The best forecast of tomorrow's price is today's price.",
      },
      {
        name: "Limits to arbitrage",
        description: "Why mispricing persists.",
        usedFor: ["frictions"],
        problem: "If markets are wrong, why don't arbitrageurs correct them?",
        keyInsight: "noise-trader risk, costs, and short horizons stop arbitrageurs from fully correcting prices.",
        example: "In 1998, LTCM bet on bond convergence — correct in the long run but forced to close at massive losses when spreads widened further first.",
      },
      {
        name: "Prospect theory",
        description: "How people really weigh gains and losses.",
        usedFor: ["biases"],
        problem: "Do people evaluate risks rationally?",
        keyInsight: "value is defined over changes from a reference point, with loss aversion and probability weighting.",
        example: "A 50/50 bet to win $100 or lose $100 is rejected — the pain of -$100 exceeds the joy of +$100. People also overweight small probabilities.",
      },
      {
        name: "Loss aversion",
        description: "Losses hurt more.",
        usedFor: ["biases"],
        problem: "Why do people hold losing positions too long and sell winners too early?",
        keyInsight: "the pain of a loss is roughly twice the pleasure of an equal gain.",
        example: "Selling a stock at a loss feels like admitting failure. Loss aversion drives the disposition effect — hold losers, sell winners.",
      },
      {
        name: "Overconfidence",
        description: "Trading too much.",
        usedFor: ["biases"],
        problem: "Why do active traders underperform?",
        keyInsight: "investors overestimate their skill, driving excess trading and underperformance.",
        example: "Barber and Odean found that the most active traders underperformed by 6.5%/year — trading costs plus poor timing driven by overconfidence.",
      },
      {
        name: "Herding",
        description: "Following the crowd.",
        usedFor: ["biases"],
        problem: "Why do bubbles form?",
        keyInsight: "correlated behavior amplifies bubbles and crashes.",
        example: "Dotcom bubble: everyone bought because everyone else was buying. The same mechanism works in reverse during crashes.",
      },
      {
        name: "Anchoring & mental accounting",
        description: "Framing distorts choices.",
        usedFor: ["biases"],
        problem: "Why do irrelevant numbers influence financial decisions?",
        keyInsight: "decisions cling to irrelevant reference points and treat fungible money in separate buckets.",
        example: "An investor anchors to their purchase price, treating it as special. Mental accounting: treating a bonus as 'fun money' vs. salary as 'serious money.'",
      },
      {
        name: "Disposition effect",
        description: "Sell winners, hold losers.",
        usedFor: ["biases"],
        problem: "Why do investors have such poor timing on sales?",
        keyInsight: "investors realize gains too early and ride losses too long.",
        example: "Selling a stock up 20% but holding one down 30% hoping it will recover — exactly backwards from tax-loss harvesting.",
      },
      {
        name: "Market anomalies",
        description: "Cracks in efficiency.",
        usedFor: ["anomalies"],
        problem: "Are there patterns that persistently beat the market?",
        keyInsight: "persistent patterns (value, momentum, size, low-vol, post-earnings drift) that EMH struggles to explain.",
        example: "Momentum: stocks that went up continue to go up for ~12 months. Value: cheap stocks outperform over 3-5 years. Both are hard to reconcile with EMH.",
      },
    ],
  },
  {
    slug: "international-macro",
    name: "International & Macro Finance",
    blurb: "Exchange rates, interest-rate parity, and the connection between finance and the macroeconomy.",
    color: "blue",
    methods: [
      {
        name: "Exchange-rate quotes",
        description: "Pricing one currency in another.",
        usedFor: ["FX"],
        problem: "What does it mean for EUR/USD to be 1.10?",
        keyInsight: "direct vs indirect quotes; appreciation vs depreciation.",
        example: "EUR/USD = 1.10 means $1.10 per euro. If it rises to 1.15, the euro appreciated (dollar depreciated) by ~4.5%.",
      },
      {
        name: "Covered interest-rate parity",
        description: "No-arbitrage FX pricing.",
        usedFor: ["parity"],
        problem: "What's the relationship between spot, forward, and interest rates?",
        keyInsight: "forward/spot = (1 + r_domestic) / (1 + r_foreign).",
        example: "US rate 5%, UK rate 3%, spot GBP/USD = 1.30. Forward = 1.30 × (1.05/1.03) = 1.325 — no arbitrage between borrowing in £ and investing in $.",
      },
      {
        name: "Uncovered interest-rate parity",
        description: "Expected currency moves.",
        usedFor: ["parity"],
        problem: "Do high-interest currencies depreciate to offset the rate advantage?",
        keyInsight: "expected depreciation approx the interest-rate differential — empirically violated (the forward-premium puzzle).",
        example: "UIP says high-yield currencies should depreciate. In reality, they don't — the carry trade profits from this violation.",
      },
      {
        name: "Purchasing power parity",
        description: "Prices across borders.",
        usedFor: ["parity"],
        problem: "Should exchange rates equalize prices across countries?",
        keyInsight: "exchange rates should equalize the cost of a common basket (law of one price).",
        example: "A Big Mac costs $5 in the US and £3.50 in the UK. Implied PPP: GBP/USD = 5/3.5 = 1.43. Actual rate = 1.25 → pound is undervalued by the Big Mac Index.",
      },
      {
        name: "Carry trade",
        description: "Borrow low, invest high.",
        usedFor: ["strategy"],
        problem: "Can you profit from interest-rate differentials?",
        keyInsight: "profit from rate differentials when UIP fails; exposed to crash risk.",
        example: "Borrow in yen at 0%, invest in AUD at 4%, earn the spread. Works until a risk-off event causes AUD to crash and yen to spike — 'picking up nickels in front of a steamroller.'",
      },
      {
        name: "Currency risk & hedging",
        description: "Managing FX exposure.",
        usedFor: ["risk"],
        problem: "How do you reduce currency risk in international investments?",
        keyInsight: "hedge transaction, translation, and economic exposure with forwards, futures, or options.",
        example: "A US investor holding European stocks hedges EUR/USD with a forward. If EUR weakens, stock gains in EUR are offset by FX losses — hedge removes currency from the equation.",
      },
      {
        name: "International diversification",
        description: "Beyond the home market.",
        usedFor: ["allocation"],
        problem: "Does adding foreign assets improve the risk-return trade-off?",
        keyInsight: "historically low cross-country correlations cut portfolio risk — eroding as markets integrate.",
        example: "In the 1980s, adding EM to a US portfolio dramatically improved the efficient frontier. Today, correlations are higher, but diversification still helps.",
      },
      {
        name: "Balance of payments",
        description: "A country's external accounts.",
        usedFor: ["macro"],
        problem: "How do you track money flowing in and out of a country?",
        keyInsight: "current account + capital/financial account approx 0; persistent imbalances pressure the currency.",
        example: "The US runs a current account deficit (imports > exports) financed by foreign capital inflows (Chinese buying Treasuries). The accounts balance.",
      },
      {
        name: "Sovereign risk",
        description: "Countries default too.",
        usedFor: ["credit"],
        problem: "How do you assess the credit risk of a country?",
        keyInsight: "priced via sovereign spreads and CDS; reflects fiscal capacity and willingness to pay.",
        example: "Greek 10-year bonds yielded 30%+ in 2012 vs. German bunds at 1.5% — the spread reflected real default risk, which materialized in restructuring.",
      },
      {
        name: "Monetary policy & rates",
        description: "The macro driver.",
        usedFor: ["macro"],
        problem: "How do central banks influence asset prices?",
        keyInsight: "central-bank policy rates anchor the short end and transmit to all asset prices.",
        example: "When the Fed cuts rates, bond prices rise, stocks rise (lower discount rate), and the dollar weakens (lower yield). Everything is connected to the policy rate.",
      },
    ],
  },
  // ── SPECIALIZED (slate/gray) ───────────────────────────────────────────────
  {
    slug: "private-equity-vc",
    name: "Private Equity & Venture Capital",
    blurb: "Alternative investments — illiquid, high-return, and structurally different from public markets.",
    color: "slate",
    methods: [
      {
        name: "IRR & MOIC",
        description: "PE return metrics.",
        usedFor: ["returns"],
        problem: "How do you measure returns in private markets with irregular cash flows?",
        keyInsight: "IRR (time-weighted rate) and MOIC (total value / invested) together capture speed and magnitude.",
        example: "A fund returns 2.5x MOIC over 8 years: IRR ~12%. A faster fund returns 2.0x in 4 years: IRR ~19%. MOIC measures magnitude; IRR measures speed.",
      },
      {
        name: "J-curve",
        description: "Returns dip, then rise.",
        usedFor: ["fund dynamics"],
        problem: "Why do PE funds show negative returns in early years?",
        keyInsight: "early fees and write-downs depress returns before exits lift them.",
        example: "Years 1-3: negative returns as fees are paid and investments are marked down. Years 4-8: exits generate realized gains, and the curve turns up.",
      },
      {
        name: "Carried interest & fees",
        description: "GP economics.",
        usedFor: ["fees"],
        problem: "How do PE fund managers get paid?",
        keyInsight: "'2 and 20' — management fee plus a profit share above a hurdle.",
        example: "2% management fee on $1B = $20M/year. 20% carry above an 8% hurdle: if the fund returns 20%, the GP gets 20% of (20%-8%) = 2.4% of capital.",
      },
      {
        name: "Venture valuation",
        description: "Pricing startups.",
        usedFor: ["valuation"],
        problem: "How do you value a company with no revenue and no comparables?",
        keyInsight: "the VC method works backward from an expected exit value and target return.",
        example: "Target exit $100M in 5 years, VC wants 10x return: post-money valuation today = $10M. Invest $2M for 20% ownership.",
      },
      {
        name: "Cap tables & dilution",
        description: "Who owns what.",
        usedFor: ["ownership"],
        problem: "How does each funding round affect ownership?",
        keyInsight: "each financing round and option pool dilutes existing holders.",
        example: "Founder owns 100% → seed takes 20% → Series A takes 25% of the new total. After A, founder owns 100% × 0.8 × 0.75 = 60%.",
      },
    ],
  },
  {
    slug: "real-estate",
    name: "Real Estate Finance",
    blurb: "Valuing and financing property — cap rates, NOI, and mortgage math.",
    color: "slate",
    methods: [
      {
        name: "Capitalization rate",
        description: "Yield on a property.",
        usedFor: ["valuation"],
        problem: "What's the implied return from buying a property at today's price?",
        keyInsight: "cap rate = NOI / value; inverse to the price multiple.",
        example: "A property with $500k NOI trading at $10M: cap rate = 5%. Lower cap rates mean higher prices and lower yields.",
      },
      {
        name: "Net operating income (NOI)",
        description: "Property cash flow.",
        usedFor: ["cash flow"],
        problem: "What's the property's operating profit before financing?",
        keyInsight: "rental income minus operating expenses, before financing and tax.",
        example: "A building collects $1M rent, pays $400k operating expenses: NOI = $600k. Mortgage payments and taxes are not included.",
      },
      {
        name: "Mortgage math",
        description: "Amortizing property loans.",
        usedFor: ["lending"],
        problem: "Can the property support the debt?",
        keyInsight: "LTV, DSCR = NOI / debt service, and amortization schedules.",
        example: "A $10M property with $7M loan: LTV = 70%. NOI $600k, debt service $500k: DSCR = 1.2x — meets the typical 1.2x minimum.",
      },
      {
        name: "REITs",
        description: "Securitized real estate.",
        usedFor: ["securities"],
        problem: "How do you get real estate exposure without buying property?",
        keyInsight: "pass-through vehicles distributing most income; valued on FFO/AFFO.",
        example: "A REIT with AFFO of $5/share trading at $50 has a 10% AFFO yield — comparable to a 10% cap rate for direct property.",
      },
      {
        name: "Property DCF",
        description: "Project, then discount.",
        usedFor: ["valuation"],
        problem: "What's a property worth based on projected cash flows?",
        keyInsight: "model NOI plus terminal sale (exit cap rate) and discount at required return.",
        example: "Project 10 years of NOI growing at 2%, exit at a 6% cap rate in year 10, discount at 8%: value = sum of discounted NOI + discounted terminal value.",
      },
    ],
  },
  {
    slug: "credit-banking",
    name: "Credit & Banking",
    blurb: "How banks work — lending, capital, and the plumbing of the financial system.",
    color: "slate",
    methods: [
      {
        name: "Net interest margin",
        description: "A bank's core spread.",
        usedFor: ["banking"],
        problem: "How do banks make money on lending?",
        keyInsight: "(interest income minus interest expense) / earning assets.",
        example: "A bank earns 5% on loans and pays 2% on deposits with $100B earning assets: NIM = 3%, generating $3B in net interest income.",
      },
      {
        name: "Capital adequacy (Basel)",
        description: "Loss-absorbing buffers.",
        usedFor: ["regulation"],
        problem: "How much capital must a bank hold against its risks?",
        keyInsight: "CET1 / risk-weighted assets above regulatory minimums.",
        example: "Basel III requires 4.5% CET1 minimum + 2.5% buffer = 7%. A bank with $1T RWA needs $70B equity minimum to survive stress.",
      },
      {
        name: "Asset-liability management",
        description: "Matching maturities.",
        usedFor: ["ALM"],
        problem: "Banks borrow short and lend long — how do they manage that mismatch?",
        keyInsight: "manage the duration/repricing gap between assets and liabilities.",
        example: "A bank with 5-year loans funded by 1-year deposits has a 4-year duration gap. If rates rise 1%, equity value falls by ~4%.",
      },
      {
        name: "Loan-loss provisioning",
        description: "Reserving for defaults.",
        usedFor: ["credit"],
        problem: "How do banks reserve for loans that will go bad?",
        keyInsight: "expected-credit-loss models (CECL / IFRS 9) set reserves forward-looking.",
        example: "Under CECL, a bank must reserve for lifetime expected losses at origination, not wait for delinquency — more conservative and procyclical.",
      },
      {
        name: "Securitization",
        description: "Pooling and tranching.",
        usedFor: ["structured"],
        problem: "How do you turn illiquid loans into tradeable securities?",
        keyInsight: "repackage cash flows into senior/junior tranches with different risk (ABS / MBS / CDO).",
        example: "A $1B mortgage pool becomes an MBS: senior tranche (80%, AAA) absorbs losses last, mezzanine (15%, BBB) in the middle, equity (5%) first loss.",
      },
    ],
  },
  {
    slug: "crypto-defi",
    name: "Crypto & DeFi",
    blurb: "Decentralized finance — tokenomics, AMMs, and on-chain valuation.",
    color: "slate",
    methods: [
      {
        name: "Tokenomics",
        description: "Crypto-asset economics.",
        usedFor: ["crypto"],
        problem: "What gives a crypto token value?",
        keyInsight: "supply schedule, emission, and utility/governance rights drive value and incentives.",
        example: "Bitcoin's halving schedule caps supply at 21M. Ethereum's burn mechanism makes ETH deflationary at high usage. Supply + demand = price.",
      },
      {
        name: "Automated market makers (AMMs)",
        description: "DEX pricing.",
        usedFor: ["DeFi"],
        problem: "How do decentralized exchanges set prices without order books?",
        keyInsight: "constant-product x*y = k sets price from pool reserves; LPs bear impermanent loss.",
        example: "A Uniswap pool with 100 ETH and 300,000 USDC: price = 300k/100 = $3,000/ETH. A large buy shifts the ratio and moves the price — slippage.",
      },
      {
        name: "Staking & yield",
        description: "Earning on-chain returns.",
        usedFor: ["DeFi"],
        problem: "How do you earn yield in crypto?",
        keyInsight: "lock tokens to secure a proof-of-stake network or provide liquidity for protocol rewards.",
        example: "Stake ETH to earn ~4% APR from network rewards. Provide liquidity to Uniswap and earn trading fees — but watch for impermanent loss.",
      },
      {
        name: "On-chain valuation metrics",
        description: "Pricing networks.",
        usedFor: ["valuation"],
        problem: "How do you value a crypto network like a stock?",
        keyInsight: "NVT, MVRV, and realized cap act as analogues to traditional multiples.",
        example: "NVT (network value to transactions) is like P/E for crypto. High NVT = expensive relative to usage. MVRV > 3 has historically signaled tops.",
      },
      {
        name: "Stablecoins",
        description: "Pegged crypto.",
        usedFor: ["crypto"],
        problem: "How do you create a dollar-pegged asset on-chain?",
        keyInsight: "fiat-collateralized, over-collateralized crypto, or algorithmic peg mechanisms — with different failure modes.",
        example: "USDC: $1 in a bank for each USDC (custodial risk). DAI: $1.50+ of ETH locked per DAI (liquidation risk). UST: algorithmic peg that failed spectacularly.",
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

export default function FinancePage() {
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
        <h1 className="text-2xl font-semibold text-white">Finance — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to financial methods organized by family. Each card describes one method,
          what it&apos;s used for, and links to claims on Epistemic Receipts that touch on it.
          Click any card for a textbook-style expansion: the problem the method answers, the
          key insight (often with a formula), and a concrete example. Color codes the family;
          clicking a header collapses its section.
        </p>
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">
          Cross-references to the{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">
            statistics taxonomy
          </Link>{" "}
          are noted where methods overlap (e.g., GARCH, copulas, cointegration).
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
          placeholder="Filter by name, description, insight, or tag — e.g. 'valuation', 'options', 'risk'"
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
          the claim is <em>about</em> that method — only that the term is present. Cross-references
          to the <Link href="/statistics" className="text-gray-400 hover:text-gray-300 underline underline-offset-2">statistics taxonomy</Link> are
          marked with &ldquo;xref: statistics&rdquo; tags.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated June 3, 2026 · {FAMILIES.length} families · {totalMethods} methods
        </p>
      </div>
    </div>
  );
}
