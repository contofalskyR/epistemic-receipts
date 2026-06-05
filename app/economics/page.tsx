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
    slug: "micro-foundations",
    name: "Microeconomic Foundations",
    blurb: "The bedrock — preferences, scarcity, marginal analysis, and equilibrium.",
    color: "teal",
    methods: [
      { name: "Scarcity & opportunity cost", description: "The first principle.", usedFor: ["foundations"], problem: "Why must every choice involve trade-offs?", keyInsight: "resources are finite; the true cost of any action is the next-best alternative forgone.", example: "Spending an hour studying instead of working: the opportunity cost is the wage you would have earned, not the zero cash outlay." },
      { name: "Marginal analysis", description: "Think at the edge.", usedFor: ["foundations"], problem: "How should a rational agent decide how much of an activity to do?", keyInsight: "compare marginal benefit to marginal cost; optimum is where `MB = MC`.", example: "A firm hires workers up to the point where the extra revenue from one more worker equals the wage — not where average profit per worker is highest." },
      { name: "Utility & preferences", description: "Ranking what people want.", usedFor: ["foundations", "consumer"], problem: "How do we represent what an agent prefers in a tractable way?", keyInsight: "complete, transitive preferences over bundles can be represented by a utility function `U(x)`.", example: "Cobb-Douglas `U = x^α y^(1-α)` lets a consumer with income M and prices p split spending between two goods in fixed shares α and 1-α." },
      { name: "Rational choice", description: "Constrained optimization.", usedFor: ["foundations"], problem: "What does it mean to act 'rationally' in economics?", keyInsight: "agents maximize an objective subject to a constraint; first-order conditions characterize the optimum.", example: "A consumer maximizes `U(x,y)` subject to `p_x x + p_y y = M`, yielding the tangency condition `MU_x/MU_y = p_x/p_y`." },
      { name: "Equilibrium", description: "No agent wants to deviate.", usedFor: ["foundations"], problem: "How do we predict the resting point of a system of interacting agents?", keyInsight: "a state where each agent's best response is consistent with all others — supply equals demand, no arbitrage.", example: "In a competitive market the equilibrium price clears the market: quantity supplied equals quantity demanded and neither side can profit by changing behavior unilaterally." },
      { name: "Positive vs normative", description: "What is vs what ought.", usedFor: ["foundations", "methodology"], problem: "What kinds of claims can economics actually make?", keyInsight: "positive claims describe (testable); normative claims prescribe (value-laden).", example: "'A minimum wage above the equilibrium reduces employment in the affected segment' is positive. 'We should raise the minimum wage' is normative." },
      { name: "Ceteris paribus", description: "Holding other things equal.", usedFor: ["foundations", "methodology"], problem: "How do we isolate the effect of one variable when many move at once?", keyInsight: "reason about one variable's effect while pretending the rest are frozen; the empirical analogue is controlled identification.", example: "'A demand curve slopes down' is a ceteris-paribus claim: at a higher price, quantity demanded falls — holding income, tastes, and other prices fixed." },
      { name: "Sunk cost", description: "Past spending is past.", usedFor: ["foundations"], problem: "Should prior unrecoverable spending affect a forward-looking decision?", keyInsight: "rational agents ignore sunk costs; only marginal future costs and benefits matter.", example: "A firm that has spent $10M on a project should continue only if the remaining expected cash flow exceeds the remaining cost — regardless of what was already spent." },
      { name: "Comparative statics", description: "How equilibria shift.", usedFor: ["foundations", "methodology"], problem: "How does the equilibrium move when an exogenous parameter changes?", keyInsight: "differentiate the equilibrium condition with respect to the parameter; sign tells the direction.", example: "If demand shifts right and supply is fixed, equilibrium price and quantity both rise — formalized by total-differentiating `D(p) = S(p)`." },
      { name: "General vs partial equilibrium", description: "One market or all.", usedFor: ["foundations"], problem: "Should we model one market in isolation or the full economy at once?", keyInsight: "partial equilibrium fixes other markets; general equilibrium clears them all simultaneously.", example: "A gas-tax study using partial equilibrium ignores feedback on labor markets; a general-equilibrium CGE model traces taxes through wages, prices, and trade." },
      { name: "Production possibilities frontier", description: "What an economy can make.", usedFor: ["foundations"], problem: "How do we visualize an economy's productive capacity and the cost of one good in terms of another?", keyInsight: "the PPF is the boundary of feasible outputs; its slope is the marginal rate of transformation.", example: "An economy producing only guns and butter: moving from 100 guns/50 butter to 80 guns/70 butter implies a marginal cost of 1 butter = 1 gun at that point." },
      { name: "Comparative advantage", description: "Specialize where the cost is lowest.", usedFor: ["foundations", "trade"], problem: "Why do agents (or countries) gain from specializing and trading even if one is better at everything?", keyInsight: "trade by opportunity cost, not absolute productivity; both sides gain.", example: "If a lawyer types twice as fast as her secretary but earns 10× more practicing law, both gain when the lawyer specializes in law and the secretary in typing." },
      { name: "Gains from trade", description: "Why exchange creates value.", usedFor: ["foundations", "welfare"], problem: "How can voluntary exchange make both parties better off when no goods are created?", keyInsight: "differences in valuation create surplus; trade reallocates goods toward those who value them most.", example: "Two people swap a baseball card and a comic; each ends up with the item they value more, so total welfare rises even though aggregate goods are unchanged." },
      { name: "Methodological individualism", description: "Start with the agent.", usedFor: ["methodology"], problem: "Should economic explanation start from individuals or from aggregates?", keyInsight: "explain aggregate outcomes as the consequence of individual choices and constraints — the 'micro-foundations' research program.", example: "The Lucas critique argued that macro models without micro-foundations break down under policy changes because they ignore how agents re-optimize." },
    ],
  },
  {
    slug: "consumer-demand",
    name: "Consumer Theory & Demand",
    blurb: "How prices and income shape what households buy.",
    color: "teal",
    methods: [
      { name: "Budget constraint", description: "Affordable bundles.", usedFor: ["consumer"], problem: "What set of consumption choices is feasible given prices and income?", keyInsight: "`p_x x + p_y y ≤ M` defines the feasible region; its slope is the relative price.", example: "With M = $100, p_x = $5, p_y = $10, the budget line is x/20 + y/10 = 1, and any point on or below it is affordable." },
      { name: "Indifference curves", description: "Equally good bundles.", usedFor: ["consumer"], problem: "How do we represent a consumer's preferences over bundles?", keyInsight: "level sets of `U(x,y)`; slope is the marginal rate of substitution `MRS = MU_x / MU_y`.", example: "Along an indifference curve, giving up 1 unit of y for 3 units of x leaves utility unchanged — MRS = 3 at that point." },
      { name: "Marshallian demand", description: "Demand from utility max.", usedFor: ["consumer"], problem: "Given prices and income, how much of each good does a utility-maximizing consumer buy?", keyInsight: "solve `max U(x) s.t. p·x = M`; the solution `x*(p, M)` is the (uncompensated) demand.", example: "For Cobb-Douglas `U = x^α y^(1-α)`, Marshallian demand is `x* = α M / p_x` — a constant share of income regardless of prices." },
      { name: "Hicksian demand", description: "Compensated demand.", usedFor: ["consumer"], problem: "How does demand change when prices change but the consumer is compensated to stay on the same indifference curve?", keyInsight: "solve `min p·x s.t. U(x) = u`; isolates pure substitution effect.", example: "If the price of x doubles but the consumer receives just enough extra income to reach the original utility, the consumer still substitutes away from x — the Hicksian curve slopes down." },
      { name: "Slutsky equation", description: "Income + substitution.", usedFor: ["consumer"], problem: "How can we decompose a price change into substitution and income effects?", keyInsight: "`∂x/∂p = ∂x^h/∂p − x · ∂x/∂M`; the first term is substitution, the second is income.", example: "When gas prices rise, drivers substitute toward fuel-efficient cars (substitution effect) and also feel poorer, cutting overall consumption (income effect)." },
      { name: "Elasticity of demand", description: "Responsiveness to price.", usedFor: ["consumer"], problem: "How sensitive is quantity demanded to changes in price?", keyInsight: "`ε = (%ΔQ)/(%ΔP)`; elastic if `|ε|>1`, inelastic if `<1`.", example: "Cigarettes have short-run elasticity ≈ −0.4 (inelastic); a 10% price hike cuts consumption ~4% — which is why excise taxes raise revenue effectively." },
      { name: "Cross-price elasticity", description: "Substitutes and complements.", usedFor: ["consumer"], problem: "How does the demand for one good respond to the price of another?", keyInsight: "positive cross-elasticity → substitutes; negative → complements.", example: "Coffee and tea have positive cross-price elasticity (substitutes); printers and ink cartridges have negative (complements)." },
      { name: "Income elasticity", description: "Normal, inferior, luxury.", usedFor: ["consumer"], problem: "How does demand change as income rises?", keyInsight: "income elasticity > 0 for normal goods, > 1 for luxuries, < 0 for inferior goods.", example: "Restaurant meals have income elasticity > 1 (luxury); generic ramen has < 0 (inferior — bought less as income rises)." },
      { name: "Engel curve", description: "Demand vs income.", usedFor: ["consumer"], problem: "How does the consumption of a good change as income varies, holding prices fixed?", keyInsight: "plot of optimal `x*` as a function of `M`; shape reveals normal/inferior/luxury status.", example: "Engel's law: as household income rises, the share spent on food falls — even though absolute food spending rises." },
      { name: "Revealed preference", description: "Inferring tastes from choices.", usedFor: ["consumer", "methodology"], problem: "How can we test preference theory without observing utility?", keyInsight: "the Weak Axiom of Revealed Preference (WARP): if x is chosen when y is affordable, y is not chosen when x is affordable.", example: "If a consumer picks an apple over an orange when both cost $1, then chooses an orange when oranges are $2 and apples $1 — preferences violate WARP and aren't rationalizable." },
      { name: "Consumer surplus", description: "Value above what's paid.", usedFor: ["welfare"], problem: "How much does a consumer benefit from being able to buy at the market price rather than her reservation price?", keyInsight: "area below demand and above price; the integral `∫(P_max − P) dQ`.", example: "If you'd pay $50 for a concert ticket and the price is $30, your consumer surplus is $20." },
      { name: "Giffen goods", description: "Demand rising with price.", usedFor: ["consumer", "contested"], problem: "Can a good's demand ever rise when its price rises?", keyInsight: "yes — if it's a strongly inferior good dominating a large budget share; the income effect overwhelms substitution.", example: "Jensen and Miller (2008) found a Giffen effect for rice among very poor Chinese households — rare and contested empirically." },
      { name: "Veblen goods", description: "Status from price.", usedFor: ["consumer", "behavioral"], problem: "Can higher prices increase demand by signaling exclusivity?", keyInsight: "luxury goods may slope up because consumption signals wealth; price *is* part of the utility.", example: "Hermès Birkin bags: lower prices would reduce signaling value and demand — a Veblen-style violation of the standard model." },
    ],
  },
  {
    slug: "producer-firms",
    name: "Producer Theory & Firms",
    blurb: "How firms turn inputs into outputs, and where their cost curves come from.",
    color: "cyan",
    methods: [
      { name: "Production function", description: "Output from inputs.", usedFor: ["producer"], problem: "How do we describe the technology that turns labor and capital into output?", keyInsight: "`Q = f(K, L)`; properties (returns to scale, substitutability) determine cost structure.", example: "Cobb-Douglas `Q = A K^α L^(1−α)` is the canonical functional form, with α the capital share — empirically ~1/3 in many economies." },
      { name: "Marginal product", description: "Extra output per input.", usedFor: ["producer"], problem: "How much additional output does one more unit of an input produce?", keyInsight: "`MP_L = ∂Q/∂L`; competitive firms hire until `MP_L = w/P`.", example: "A bakery's 10th worker adds 50 loaves/day; the wage divided by loaf price tells whether it's profitable to hire that worker." },
      { name: "Diminishing returns", description: "Each extra unit adds less.", usedFor: ["producer"], problem: "Why does productivity per worker fall as more workers are added to a fixed factory?", keyInsight: "with at least one fixed factor, marginal product eventually falls.", example: "Adding cooks to a fixed-size kitchen: at some point they get in each other's way and each new cook adds less food than the last." },
      { name: "Returns to scale", description: "Doubling all inputs.", usedFor: ["producer"], problem: "What happens to output when all inputs scale proportionally?", keyInsight: "constant / increasing / decreasing returns to scale depending on whether output scales 1:1, more, or less.", example: "Software has strongly increasing returns (one codebase, many users); restaurants have roughly constant returns (each new restaurant ≈ same revenue)." },
      { name: "Isoquants & MRTS", description: "Input combos for fixed output.", usedFor: ["producer"], problem: "What combinations of inputs can produce the same level of output?", keyInsight: "level sets of f(K,L); slope is `MRTS = MP_L/MP_K`.", example: "A factory producing 1000 widgets can use 10K + 50L or 20K + 25L; at the cost-minimum the MRTS equals the input price ratio w/r." },
      { name: "Cost minimization", description: "Cheapest input mix.", usedFor: ["producer"], problem: "Given input prices, what input mix produces a target output most cheaply?", keyInsight: "minimize `wL + rK` s.t. `f(K,L) = Q*`; FOC: `MP_L/w = MP_K/r`.", example: "If wages rise relative to capital rentals, the firm substitutes K for L — moving along the isoquant toward a more capital-intensive technique." },
      { name: "Short vs long run", description: "What's fixed depends on time.", usedFor: ["producer"], problem: "Why do firms respond differently to shocks at different horizons?", keyInsight: "short run: at least one factor fixed; long run: all factors variable.", example: "A trucking firm hit by a fuel-price shock cuts deliveries short-run (variable fuel) but invests in efficient trucks long-run (variable capital)." },
      { name: "Average vs marginal cost", description: "Per-unit vs incremental.", usedFor: ["producer"], problem: "How are total, average, and marginal costs related?", keyInsight: "`AC = TC/Q`, `MC = dTC/dQ`; MC cuts AC at its minimum.", example: "If AC is falling, MC < AC; if AC is rising, MC > AC. The minimum of AC is where the two intersect — a useful diagnostic." },
      { name: "Economies of scale", description: "Cheaper as you grow.", usedFor: ["producer", "IO"], problem: "Why does average cost fall as a firm grows?", keyInsight: "spreading fixed costs, specialization, bulk procurement, and learning all lower AC at scale.", example: "Cloud computing: a $100M data center spread over 10M users costs $10/user; over 100M users, $1/user — Amazon's structural advantage." },
      { name: "Diseconomies of scale", description: "Bigger isn't always cheaper.", usedFor: ["producer"], problem: "Why do average costs eventually rise as firms get very large?", keyInsight: "coordination, bureaucracy, and information bottlenecks raise AC at scale.", example: "GM and IBM both became less productive per employee as they grew past a certain size — managerial overhead exceeded scale benefits." },
      { name: "Profit maximization", description: "Where MR = MC.", usedFor: ["producer"], problem: "How much output should a firm produce to maximize profit?", keyInsight: "produce where marginal revenue equals marginal cost; check the second-order condition.", example: "A monopolist with linear demand P = 100 − Q and MC = 20 sets MR = 100 − 2Q = 20, so Q* = 40 and P* = 60." },
      { name: "Theory of the firm", description: "Why firms exist at all.", usedFor: ["IO"], problem: "Why does production happen inside firms rather than via market contracts?", keyInsight: "Coase: firms exist when transaction costs of market contracting exceed internal coordination costs.", example: "Auto manufacturers internalize stamping but outsource tires — the make-or-buy boundary tracks contracting costs and asset specificity." },
      { name: "Principal-agent problem", description: "Hidden actions.", usedFor: ["IO", "contracts"], problem: "How do you align an agent's incentives with a principal's interests when actions are unobservable?", keyInsight: "use contracts that condition pay on observable outcomes; trade off risk-sharing against incentives.", example: "CEO stock options tie pay to share price — but expose the CEO to risk, so optimal contracts blend salary, bonus, and equity." },
    ],
  },
  {
    slug: "market-structures",
    name: "Market Structures & Strategic Interaction",
    blurb: "From perfect competition to monopoly — and the game theory in between.",
    color: "cyan",
    methods: [
      { name: "Perfect competition", description: "Many small price-takers.", usedFor: ["IO"], problem: "What outcome emerges when many small firms produce identical goods?", keyInsight: "price equals marginal cost, profits are zero in the long run, allocation is efficient.", example: "Wheat markets approximate this: thousands of producers, near-identical product, prices set globally and individual farmers take them as given." },
      { name: "Monopoly", description: "Single seller.", usedFor: ["IO"], problem: "What happens when one firm faces the whole market demand?", keyInsight: "sets MR = MC, charges P > MC, creates deadweight loss; markup `(P−MC)/P = 1/|ε|`.", example: "A patented drug priced 20× above marginal cost: socially inefficient, but the patent grants temporary monopoly to incentivize R&D." },
      { name: "Monopolistic competition", description: "Differentiated many.", usedFor: ["IO"], problem: "What if many firms compete but each sells a slightly differentiated product?", keyInsight: "each firm faces a downward-sloping demand, sets P > MC, free entry drives profit to zero.", example: "Restaurants in a city: many competitors, each with location/cuisine differentiation, slight pricing power, but free entry erodes long-run profits." },
      { name: "Oligopoly", description: "Few large firms.", usedFor: ["IO"], problem: "How do a small number of large firms interact?", keyInsight: "strategic interdependence — game-theoretic analysis required; outcomes range from collusive to competitive.", example: "OPEC, global aircraft (Boeing/Airbus), and smartphone OS (Apple/Google) all show oligopolistic dynamics with quantity or price coordination problems." },
      { name: "Cournot competition", description: "Quantity-setting duopoly.", usedFor: ["IO"], problem: "What happens when two firms simultaneously choose quantities?", keyInsight: "each best-responds to the other's quantity; Nash equilibrium lies between monopoly and competition.", example: "Two firms with linear demand and identical MC = c produce Q* = (a−c)/(3b) each — total output is 2/3 of the competitive level." },
      { name: "Bertrand competition", description: "Price-setting duopoly.", usedFor: ["IO"], problem: "What happens when two firms compete by setting prices?", keyInsight: "with identical products and constant MC, price competition drives `P = MC` — the Bertrand paradox.", example: "Two gas stations across the street with identical products: undercutting continues until margins disappear — a stark contrast to the Cournot outcome." },
      { name: "Stackelberg leadership", description: "Sequential moves.", usedFor: ["IO"], problem: "How does the equilibrium change when one firm moves first?", keyInsight: "the leader internalizes the follower's reaction function; produces more than Cournot.", example: "A dominant first-mover (e.g., Intel in early CPUs) can deter or exploit followers by committing to high output before competitors enter." },
      { name: "Game theory & Nash equilibrium", description: "No profitable deviation.", usedFor: ["IO", "foundations"], problem: "What is the natural solution concept for strategic interaction?", keyInsight: "each player's strategy is a best response to the others'; no unilateral deviation pays.", example: "Prisoner's dilemma: both confess is the Nash equilibrium even though both staying silent gives higher joint payoff — a textbook case of strategic failure." },
      { name: "Repeated games & cooperation", description: "Future shadows.", usedFor: ["IO"], problem: "Can rational players sustain cooperation in prisoner's-dilemma-like situations?", keyInsight: "with sufficient patience and indefinite repetition, trigger strategies sustain cooperation (Folk Theorem).", example: "OPEC cartels survive in part because members value future cooperation, sustaining output restraint despite short-run incentives to cheat." },
      { name: "Collusion & cartels", description: "Joint profit max.", usedFor: ["IO", "antitrust"], problem: "When can firms jointly behave like a monopolist?", keyInsight: "stable when defection is detectable and punishable, and entry is limited; usually illegal.", example: "The 2010s LIBOR-rigging cartel: detection was costly because rates were quoted privately, sustaining collusion until regulators intervened." },
      { name: "Price discrimination", description: "Different prices, same good.", usedFor: ["IO"], problem: "When and how can a firm charge different prices for the same product?", keyInsight: "requires market power, identifiable buyer types, and no arbitrage; raises profit and often output.", example: "Airline fares: business travelers pay 5× leisure prices for identical seats, segmented by booking time and refundability." },
      { name: "Network effects", description: "More users, more value.", usedFor: ["IO"], problem: "How do user numbers affect a product's value?", keyInsight: "direct network effects (phones), indirect (platforms with two sides) → winner-take-most dynamics.", example: "Telephone networks needed enough users to be useful; the same logic drives platform competition for Visa, Facebook, and Uber today." },
      { name: "Two-sided markets", description: "Platforms.", usedFor: ["IO"], problem: "How do firms price when serving two distinct customer groups that benefit from each other?", keyInsight: "subsidize one side to bootstrap network effects; charge the other; below-cost prices can be efficient.", example: "Adobe gives away PDF readers (subsidized) but charges authors for Acrobat (monetized) — bootstrapping the install base." },
    ],
  },
  {
    slug: "welfare-externalities",
    name: "Welfare Economics & Market Failures",
    blurb: "When markets allocate efficiently, when they don't, and how we judge outcomes.",
    color: "teal",
    methods: [
      { name: "Pareto efficiency", description: "No win-win left.", usedFor: ["welfare"], problem: "When is an allocation as good as it can be without losing one person to gain another?", keyInsight: "no reallocation can make someone better off without making someone worse off.", example: "Two friends with apples and oranges trade until neither can gain without hurting the other — that endpoint is Pareto-efficient even if very unequal." },
      { name: "Edgeworth box", description: "Two-agent exchange diagram.", usedFor: ["welfare"], problem: "How do we visualize the set of Pareto-efficient allocations between two agents?", keyInsight: "the contract curve traces points where indifference curves are tangent inside the box.", example: "Trading allocations along the contract curve are all efficient; which one is selected depends on bargaining power and initial endowments." },
      { name: "First Welfare Theorem", description: "Competitive markets are efficient.", usedFor: ["welfare"], problem: "Under what conditions does laissez-faire produce a Pareto-efficient allocation?", keyInsight: "any competitive equilibrium with complete markets and no externalities is Pareto-efficient.", example: "Idealized textbook market with perfect competition: the invisible hand actually proves a theorem — under strong assumptions that rarely hold cleanly." },
      { name: "Second Welfare Theorem", description: "Any efficient point is reachable.", usedFor: ["welfare"], problem: "Can we achieve any desired Pareto-efficient allocation through markets plus lump-sum transfers?", keyInsight: "yes, given convex preferences and technology — separates efficiency from distribution.", example: "Policymakers can in principle redistribute endowments and let markets decentralize an egalitarian allocation — though lump-sum transfers are impractical in practice." },
      { name: "Deadweight loss", description: "Surplus destroyed.", usedFor: ["welfare"], problem: "How do we measure the inefficiency of a tax, monopoly, or quota?", keyInsight: "the triangle between supply and demand corresponding to trades that don't happen.", example: "A $1 tax on a market with elasticity-1 demand creates a DWL roughly equal to half the tax times the quantity reduction — small for inelastic, large for elastic markets." },
      { name: "Externalities", description: "Costs/benefits outside the market.", usedFor: ["welfare"], problem: "What happens when an action affects bystanders not party to a transaction?", keyInsight: "private MC ≠ social MC; markets under-produce positive externalities and over-produce negative.", example: "Industrial pollution imposes costs on neighbors not reflected in the firm's costs — leading to too much output and too little abatement." },
      { name: "Pigouvian tax", description: "Tax the harm.", usedFor: ["welfare", "policy"], problem: "How do you correct a negative externality with prices?", keyInsight: "set the tax equal to the marginal external damage; restores socially efficient quantity.", example: "A carbon tax of $50/tCO2 — close to estimated marginal damages — internalizes climate costs into producer decisions." },
      { name: "Coase theorem", description: "Bargaining over rights.", usedFor: ["welfare"], problem: "Can parties to an externality resolve it efficiently without government?", keyInsight: "with well-defined property rights and zero transaction costs, private bargaining reaches an efficient outcome — regardless of initial assignment.", example: "Beekeepers and apple farmers can bargain over pollination/honey; the efficiency hinges on low transaction costs, which are rare for large groups." },
      { name: "Public goods", description: "Non-rival, non-excludable.", usedFor: ["welfare", "public"], problem: "Why do markets undersupply national defense and lighthouses?", keyInsight: "non-rivalry plus non-excludability creates free-rider incentives; private provision fails.", example: "A lighthouse benefits every passing ship; no shipowner would voluntarily pay for it, so government provision (or club coordination) emerges." },
      { name: "Tragedy of the commons", description: "Overuse of shared resources.", usedFor: ["welfare", "environment"], problem: "What happens to a resource owned by no one and used by many?", keyInsight: "rivalry without excludability leads to overharvesting; private costs ignore depletion.", example: "Overfishing on the high seas: each boat captures full benefit but spreads the depletion cost — fishery collapses are the rule." },
      { name: "Asymmetric information", description: "One side knows more.", usedFor: ["welfare", "contracts"], problem: "What happens when buyers and sellers don't have the same information?", keyInsight: "adverse selection and moral hazard distort or destroy markets.", example: "Akerlof's used-car market: bad cars drive out good when buyers can't tell quality, causing the lemons problem and unraveling of the market." },
      { name: "Adverse selection", description: "Hidden type.", usedFor: ["contracts"], problem: "What happens when one side's hidden characteristics distort participation?", keyInsight: "high-risk types over-participate, raising prices and driving low-risk types out.", example: "Health insurance: if premiums are flat, the sickest sign up most eagerly, premiums rise, and the healthy drop out — the death spiral." },
      { name: "Moral hazard", description: "Hidden action.", usedFor: ["contracts"], problem: "How does insurance distort behavior?", keyInsight: "once insured, agents take more risk; contracts use deductibles and copays to restore incentives.", example: "Drivers with full collision coverage drive less carefully on the margin — insurers use deductibles to share enough risk to discipline behavior." },
    ],
  },

  // ── SCHOOLS OF THOUGHT (amber/orange) ──────────────────────────────────────
  {
    slug: "classical-neoclassical",
    name: "Classical & Neoclassical Schools",
    blurb: "From Smith and Ricardo to Marshall, Walras, and the marginalist revolution.",
    color: "amber",
    methods: [
      { name: "Adam Smith — invisible hand", description: "Self-interest aggregates.", usedFor: ["schools", "classical"], problem: "How can pursuit of individual gain produce social welfare?", keyInsight: "in competitive markets, decentralized self-interest is coordinated by prices to allocate resources efficiently.", example: "The Wealth of Nations (1776) famously argued the butcher and brewer serve us 'not from benevolence' but from interest, with prices guiding the social outcome." },
      { name: "Division of labor", description: "Productivity from specialization.", usedFor: ["classical"], problem: "Why does breaking production into specialized tasks increase output?", keyInsight: "specialization raises productivity via dexterity, time-saving, and mechanization.", example: "Smith's pin factory: a single worker could make perhaps 20 pins/day; divided into 18 specialized operations, 10 workers produced 48,000/day." },
      { name: "Ricardian comparative advantage", description: "Trade by relative cost.", usedFor: ["classical", "trade"], problem: "Why do countries gain from trade even when one is more productive at everything?", keyInsight: "specialize in the good where your opportunity cost is lowest; both sides gain.", example: "Ricardo's England-Portugal wine-cloth example formalized the gains-from-trade argument that still underlies modern trade theory." },
      { name: "Labor theory of value (classical)", description: "Value from labor input.", usedFor: ["classical", "contested"], problem: "What determines the long-run value of a good?", keyInsight: "Smith, Ricardo: labor required to produce it; Marx extended this to a theory of exploitation.", example: "The marginalist revolution (1870s) largely displaced LTV with subjective value theory, though it persists in some heterodox frameworks." },
      { name: "Malthusian trap", description: "Population vs subsistence.", usedFor: ["classical", "growth"], problem: "Why does pre-industrial income per person stagnate near subsistence?", keyInsight: "population grows geometrically while output grows arithmetically; living standards revert to subsistence.", example: "Pre-industrial European wages stayed near subsistence for centuries — the Industrial Revolution finally broke the Malthusian trap." },
      { name: "Say's law", description: "Supply creates demand.", usedFor: ["classical", "contested"], problem: "Can an economy suffer a general glut of unsold goods?", keyInsight: "classical view: production generates the income needed to purchase it; aggregate demand failures impossible. Keynes disputed this.", example: "The Great Depression's mass unemployment was the empirical case against Say's law that motivated Keynes's General Theory." },
      { name: "Marshallian scissors", description: "Supply and demand.", usedFor: ["neoclassical"], problem: "What determines a market's equilibrium price?", keyInsight: "neither supply nor demand alone — both blades of the scissors are needed to cut the paper.", example: "Marshall (1890) cemented the diagrammatic supply-demand framework still taught as the first model in every intro micro class." },
      { name: "Walrasian general equilibrium", description: "All markets at once.", usedFor: ["neoclassical"], problem: "Does a system of prices exist that clears all markets simultaneously?", keyInsight: "Walras formalized it; Arrow-Debreu (1954) proved existence under convex preferences and complete markets.", example: "Modern CGE models implement Walrasian equilibrium numerically to evaluate trade and tax policy across multiple sectors." },
      { name: "Marginalist revolution", description: "Value at the margin.", usedFor: ["neoclassical"], problem: "Why does water (vital) cost less than diamonds (frivolous)?", keyInsight: "value depends on marginal utility, not total — and water is abundant relative to demand.", example: "Jevons, Menger, and Walras independently solved Smith's diamond-water paradox around 1871, shifting economics from labor to subjective value." },
      { name: "Pigou — externalities", description: "Welfare economics founder.", usedFor: ["neoclassical", "welfare"], problem: "How do market prices fail to reflect social costs?", keyInsight: "social marginal cost differs from private; corrective taxes and subsidies restore efficiency.", example: "Pigou's 1920 Economics of Welfare built the rigorous case for taxing pollution — modern carbon taxes are direct intellectual descendants." },
      { name: "Arrow-Debreu model", description: "Existence of equilibrium.", usedFor: ["neoclassical"], problem: "Does a price vector clearing all markets simultaneously exist?", keyInsight: "Arrow-Debreu (1954): yes, under convex preferences/technology, complete markets, no externalities.", example: "The proof underpins modern general-equilibrium theory; both authors received Nobel Prizes (Arrow 1972, Debreu 1983)." },
      { name: "Modigliani-Miller", description: "Capital structure irrelevance.", usedFor: ["neoclassical", "finance"], problem: "Does the mix of debt and equity affect firm value?", keyInsight: "in frictionless markets, no — value depends on assets, not financing. (xref: finance)", example: "MM (1958) — a stylized result whose interest lies in the deviations: taxes, bankruptcy costs, and asymmetric information make structure matter." },
      { name: "Lucas critique", description: "Policy changes change behavior.", usedFor: ["neoclassical", "macro"], problem: "Can we forecast policy effects from historical reduced-form relationships?", keyInsight: "no — agents re-optimize when rules change, so estimated parameters shift; need micro-foundations.", example: "1970s Phillips-curve-based stabilization failed when expectations adjusted; Lucas (1976) showed why structural models are necessary." },
    ],
  },
  {
    slug: "keynesian",
    name: "Keynesian & Post-Keynesian",
    blurb: "Aggregate demand, sticky prices, and the case for stabilization.",
    color: "orange",
    methods: [
      { name: "Keynes — General Theory", description: "Demand drives output.", usedFor: ["schools", "keynesian"], problem: "Why can economies stay stuck below full employment?", keyInsight: "aggregate demand can fall short of supply; sticky wages and prices prevent automatic adjustment.", example: "Keynes's 1936 General Theory argued that mass unemployment in the 1930s was a coordination failure, not a labor-market problem — and called for fiscal stimulus." },
      { name: "Aggregate demand & multiplier", description: "Spending begets spending.", usedFor: ["keynesian", "macro"], problem: "How much does a dollar of government spending raise GDP?", keyInsight: "multiplier = 1/(1−MPC); each round of spending creates further income.", example: "If MPC = 0.6, a $100 fiscal injection raises GDP by ~$250; empirical multipliers are typically smaller and depend on slack and monetary stance." },
      { name: "Liquidity preference", description: "Money demand for liquidity.", usedFor: ["keynesian", "monetary"], problem: "Why do people hold non-interest-bearing money?", keyInsight: "for transactions, precaution, and speculation; demand falls with the interest rate.", example: "Keynes argued money demand could become 'absolutely elastic' at very low rates — the liquidity trap, where monetary policy loses traction." },
      { name: "Liquidity trap", description: "Monetary policy stalls.", usedFor: ["keynesian"], problem: "What happens when nominal rates hit zero?", keyInsight: "additional monetary easing fails to lower rates; fiscal policy becomes essential.", example: "Japan post-1995, US 2008–2015, and the eurozone post-2014 all hit the zero lower bound, motivating QE and forward guidance." },
      { name: "IS-LM model", description: "Goods × money equilibrium.", usedFor: ["keynesian", "macro"], problem: "How do interest rates and output jointly adjust to shocks?", keyInsight: "the IS curve (goods market) and LM curve (money market) intersect at equilibrium Y and r.", example: "Hicks (1937) translated Keynes into IS-LM; despite Lucas-critique objections, it remains a workhorse teaching tool for short-run macro." },
      { name: "Sticky prices/wages", description: "Slow adjustment.", usedFor: ["keynesian"], problem: "Why don't prices adjust instantly to clear markets?", keyInsight: "menu costs, contracts, and coordination failures slow price/wage adjustment; New Keynesian models formalize this.", example: "Sectors like services and manufacturing show median price-change durations of 8–11 months — Bils–Klenow empirical work." },
      { name: "Aggregate supply (AS-AD)", description: "Output and price level.", usedFor: ["keynesian", "macro"], problem: "How do supply and demand interact at the macro level?", keyInsight: "short-run AS is upward-sloping (sticky prices); long-run is vertical at potential output.", example: "An oil price shock shifts SRAS left, raising prices and lowering output — the stagflation diagnosis used to interpret the 1970s." },
      { name: "Animal spirits", description: "Sentiment moves investment.", usedFor: ["keynesian", "behavioral"], problem: "Why do investment decisions swing on more than calculation?", keyInsight: "Keynes: spontaneous urges, optimism/pessimism waves drive investment — formalized later by Akerlof-Shiller.", example: "The 2008 collapse and the 2020 vaccine-driven recovery both reflect dramatic shifts in business sentiment that pure rational models struggle to capture." },
      { name: "New Keynesian DSGE", description: "Sticky-price micro-foundations.", usedFor: ["keynesian", "macro"], problem: "How can we combine Keynesian frictions with rational-expectations micro-foundations?", keyInsight: "Calvo pricing + monopolistic competition + a Taylor rule gives a tractable DSGE workhorse.", example: "Smets-Wouters (2003, 2007) models — the canonical NK-DSGE — are routinely estimated at central banks for forecasting and policy analysis." },
      { name: "Minsky financial instability", description: "Stability breeds instability.", usedFor: ["keynesian", "finance"], problem: "Why do financial systems endogenously generate crises?", keyInsight: "stable periods → leverage → speculation → Ponzi finance → 'Minsky moment'.", example: "Minsky's framework was largely ignored until 2008, when the subprime/Lehman cascade matched his template almost step-for-step." },
      { name: "Fiscal policy & automatic stabilizers", description: "Counter-cyclical taxes & transfers.", usedFor: ["keynesian", "fiscal"], problem: "How does the budget cushion the economy without active intervention?", keyInsight: "progressive taxes fall and transfers rise in recessions, partially offsetting demand shortfalls.", example: "EU automatic stabilizers absorb roughly half of an output shock; US stabilizers absorb about a third — a structural difference in cyclical resilience." },
      { name: "Paradox of thrift", description: "Saving more, earning less.", usedFor: ["keynesian"], problem: "Can collective saving reduce aggregate output?", keyInsight: "when everyone saves more in a slump, aggregate demand falls and incomes drop — reducing total saving.", example: "Post-2008 household deleveraging cut consumption and helped extend the slump, illustrating the paradox at scale." },
    ],
  },
  {
    slug: "monetarist-chicago",
    name: "Monetarist & Chicago School",
    blurb: "Money matters — Friedman, rational expectations, and the case for rules.",
    color: "amber",
    methods: [
      { name: "Quantity theory of money", description: "MV = PY.", usedFor: ["monetarist", "monetary"], problem: "What is the long-run relationship between money and prices?", keyInsight: "with stable velocity, money growth above output growth produces inflation.", example: "Friedman: 'Inflation is always and everywhere a monetary phenomenon.' Post-2008 QE complicated this by collapsing velocity." },
      { name: "Friedman — Monetary History", description: "Money mismanagement = depression.", usedFor: ["monetarist"], problem: "Could the Great Depression have been avoided?", keyInsight: "Friedman-Schwartz argued the Fed's failure to prevent monetary collapse turned a recession into the Depression.", example: "Bernanke (2002): 'You're right, we did it. We're very sorry. But thanks to you, we won't do it again' — guidance that shaped 2008 Fed response." },
      { name: "Permanent income hypothesis", description: "Consumption smooths income.", usedFor: ["monetarist", "consumer"], problem: "Why don't consumers spend windfalls fully?", keyInsight: "consumption tracks permanent (expected lifetime) income, not transient shocks.", example: "Friedman's PIH (1957) implies tax rebates have small consumption effects — partly confirmed empirically (MPCs of 0.1–0.4 typical)." },
      { name: "Natural rate of unemployment", description: "Long-run NAIRU.", usedFor: ["monetarist", "labor"], problem: "Is there a long-run trade-off between inflation and unemployment?", keyInsight: "Friedman-Phelps: no — the long-run Phillips curve is vertical at the natural rate.", example: "1970s stagflation confirmed the vertical Phillips curve: rising inflation expectations broke the apparent short-run trade-off." },
      { name: "Rational expectations", description: "Forecasts use the model.", usedFor: ["monetarist", "macro"], problem: "How should we model expectations in dynamic systems?", keyInsight: "Muth-Lucas: expectations are model-consistent — agents make no systematic mistakes.", example: "Rational expectations transformed macro in the 1970s; combined with policy rules, it implies systematic monetary policy can be neutral." },
      { name: "Policy ineffectiveness", description: "Anticipated policy doesn't matter.", usedFor: ["monetarist"], problem: "Can systematic monetary policy stabilize output?", keyInsight: "Sargent-Wallace: under rational expectations and flexible prices, only unanticipated policy affects real variables.", example: "A pre-announced rate cut is already priced in — only surprises move output, a major motivation for transparent central banking." },
      { name: "Time inconsistency", description: "Promises today, defection tomorrow.", usedFor: ["monetarist", "macro"], problem: "Why do discretionary policymakers produce worse outcomes than rule-bound ones?", keyInsight: "Kydland-Prescott: optimal ex-ante plans become suboptimal ex-post; commitment dominates discretion.", example: "Central-bank independence and inflation targeting were institutional responses to time-inconsistency problems identified in the 1977 paper." },
      { name: "Real business cycle theory", description: "Productivity shocks drive cycles.", usedFor: ["monetarist"], problem: "Can business cycles arise from supply-side shocks in a frictionless model?", keyInsight: "Kydland-Prescott RBC: yes — productivity shocks alone can generate observed cyclical patterns.", example: "RBC models fit some moments well but struggle with employment volatility — a key motivation for adding NK frictions." },
      { name: "Coase — social cost", description: "Property rights matter.", usedFor: ["chicago", "welfare"], problem: "Who should bear the cost of an externality?", keyInsight: "Coase: with clear rights and low transaction costs, parties bargain to the efficient outcome regardless of assignment.", example: "Modern emissions-trading systems implement Coasean logic — define and trade pollution rights to reach the efficient abatement level." },
      { name: "Becker — economics of everything", description: "Rational-choice imperialism.", usedFor: ["chicago"], problem: "Can rational-choice tools illuminate non-market behavior?", keyInsight: "yes — Becker applied prices and incentives to crime, marriage, discrimination, and human capital.", example: "Becker's 1957 discrimination theory and 1968 crime model launched the application of micro tools to entire fields once outside economics." },
    ],
  },
  {
    slug: "austrian",
    name: "Austrian School",
    blurb: "Subjectivism, dispersed knowledge, and skepticism of central planning.",
    color: "orange",
    methods: [
      { name: "Subjective value", description: "Value in the eye of the beholder.", usedFor: ["austrian"], problem: "Where does economic value come from?", keyInsight: "Menger: from individual preferences, not labor input or objective properties.", example: "A bottle of water on a beach vs. in a desert: same object, different marginal utility — the subjectivist insight underpinning all modern micro." },
      { name: "Methodological individualism", description: "Aggregates are emergent.", usedFor: ["austrian", "methodology"], problem: "Should economic analysis start from groups or individuals?", keyInsight: "Mises: all economic phenomena trace to individual choices under constraints.", example: "Inflation in Austrian terms is not a property of 'the economy' but the aggregate result of agents bidding up prices in response to expanded money." },
      { name: "Mises — economic calculation", description: "Without prices, no calculation.", usedFor: ["austrian", "contested"], problem: "Can a socialist economy allocate resources rationally without prices?", keyInsight: "Mises (1920): no — without market prices for capital, planners can't compare alternative uses.", example: "20th-century planned economies' chronic misallocation of capital goods was the empirical case the Austrians cited as vindication." },
      { name: "Hayek — knowledge problem", description: "Dispersed local information.", usedFor: ["austrian"], problem: "Why can't a central planner replicate the market?", keyInsight: "Hayek: relevant knowledge is dispersed, tacit, and continually changing; prices aggregate it.", example: "Hayek's 1945 'Use of Knowledge in Society' framed markets as information-processing systems — a view widely adopted across the political spectrum." },
      { name: "Spontaneous order", description: "Order without design.", usedFor: ["austrian"], problem: "Can complex coordination emerge without a designer?", keyInsight: "Hayek: institutions like prices, language, and common law emerge spontaneously from many interactions.", example: "The internet's TCP/IP routing, much like markets, coordinates without central direction — a modern instance of Hayekian spontaneous order." },
      { name: "Entrepreneurship & discovery", description: "Alertness to opportunity.", usedFor: ["austrian"], problem: "What role does the entrepreneur play that neoclassical models miss?", keyInsight: "Kirzner: entrepreneurs discover and act on price misalignments; this drives the market process.", example: "Schumpeter's 'creative destruction' and Kirzner's 'alertness' both emphasize that markets are processes of discovery, not equilibrium states." },
      { name: "Austrian business cycle theory", description: "Credit-driven malinvestment.", usedFor: ["austrian", "contested"], problem: "What causes booms and busts?", keyInsight: "artificially low interest rates from credit expansion mislead investors into long-horizon malinvestments that later liquidate.", example: "Austrians interpret the 2000s housing bubble as ABCT in action; mainstream macro disputes its quantitative importance." },
      { name: "Praxeology", description: "Action axioms.", usedFor: ["austrian", "methodology", "contested"], problem: "What is the proper method for economic theory?", keyInsight: "Mises: deductive reasoning from the axiom of human action; empirical testing limited.", example: "Praxeology distinguishes Austrian methodology from mainstream economics' econometric focus — a sharp and lasting methodological divide." },
      { name: "Schumpeterian creative destruction", description: "Innovation kills incumbents.", usedFor: ["austrian", "growth"], problem: "How does long-run growth occur in a market economy?", keyInsight: "innovation creates new industries while destroying old ones; firms must adapt or die.", example: "Smartphones obliterated camera, GPS, and MP3-player industries within a decade — textbook Schumpeterian destruction." },
      { name: "Calculation debate", description: "Mises-Lange controversy.", usedFor: ["austrian"], problem: "Could a planning board use 'shadow prices' to replicate market allocation?", keyInsight: "Lange-Lerner said yes in principle; Hayek countered that knowledge problems remain insurmountable.", example: "Post-1990 transition economies' difficulties confirmed at least the practical difficulty of replicating market allocation even when planners tried." },
    ],
  },
  {
    slug: "behavioral",
    name: "Behavioral & Experimental Economics",
    blurb: "What real humans actually do — and how it departs from textbook rationality.",
    color: "amber",
    methods: [
      { name: "Bounded rationality", description: "Cognition has limits.", usedFor: ["behavioral"], problem: "How should we model agents with limited time, info, and computation?", keyInsight: "Simon: satisficing replaces maximizing; choose 'good enough' under cognitive constraints.", example: "Most consumers don't optimize over hundreds of toothpaste varieties — they pick a familiar brand fast, illustrating Simon's satisficing." },
      { name: "Prospect theory", description: "Loss aversion + reference points.", usedFor: ["behavioral"], problem: "How do people actually choose under risk?", keyInsight: "Kahneman-Tversky: outcomes evaluated relative to a reference point; losses hurt about twice as much as equivalent gains.", example: "Investors hold losing stocks too long and sell winners too early — the 'disposition effect' predicted by prospect theory." },
      { name: "Heuristics & biases", description: "Mental shortcuts.", usedFor: ["behavioral"], problem: "What mental shortcuts do people use, and where do they fail?", keyInsight: "availability, representativeness, anchoring drive systematic errors.", example: "After a plane crash, people overestimate flying risk (availability) — the bias is detectable, predictable, and influences insurance markets." },
      { name: "Hyperbolic discounting", description: "Now-bias.", usedFor: ["behavioral", "intertemporal"], problem: "Why do people make plans they later abandon?", keyInsight: "discount rates fall with horizon — preferences are dynamically inconsistent; today vs. tomorrow weighted disproportionately.", example: "Gym memberships bought in January with confidence about future workouts — and abandoned by March; classic present-bias." },
      { name: "Mental accounting", description: "Money has labels.", usedFor: ["behavioral"], problem: "Why do people treat fungible money differently by source or purpose?", keyInsight: "Thaler: people categorize money into 'accounts' (gas, groceries, gambling winnings) and spend differently from each.", example: "Households simultaneously hold credit-card debt at 18% and savings at 1% — a violation of fungibility that mental accounting explains." },
      { name: "Framing effects", description: "Wording shapes choice.", usedFor: ["behavioral"], problem: "Can equivalent descriptions of a decision produce different choices?", keyInsight: "yes — '90% survive' is chosen more than '10% die' for the same procedure.", example: "Default opt-in vs opt-out organ donation moves participation from ~15% to ~90% — same underlying choice, different frame." },
      { name: "Endowment effect", description: "Owning raises perceived value.", usedFor: ["behavioral"], problem: "Why do people demand more to sell something than they would pay to buy it?", keyInsight: "loss aversion applied to ownership — willingness-to-accept exceeds willingness-to-pay.", example: "Kahneman-Knetsch-Thaler's mug experiments showed WTA roughly 2× WTP — robust across many goods and settings." },
      { name: "Nudge & choice architecture", description: "Defaults steer behavior.", usedFor: ["behavioral", "policy"], problem: "How can policymakers improve choices without restricting freedom?", keyInsight: "Thaler-Sunstein 'libertarian paternalism': design defaults and framings to nudge welfare-improving choices.", example: "Automatic 401(k) enrollment raises participation from ~50% to ~90% — the canonical nudge, adopted across many countries." },
      { name: "Experimental economics", description: "Lab tests of theory.", usedFor: ["behavioral", "methods"], problem: "Can we test economic theory under controlled conditions?", keyInsight: "Smith pioneered induced-value methods to bring economic theory into the lab.", example: "Double-auction experiments converge to competitive equilibrium with as few as 4 traders — vindicating Smith's confidence in market efficiency." },
      { name: "Ultimatum & dictator games", description: "Fairness and reciprocity.", usedFor: ["behavioral"], problem: "Do people maximize own payoff or also weigh fairness?", keyInsight: "responders reject low offers; dictators give nonzero amounts — both inconsistent with pure self-interest.", example: "Median ultimatum offers ~40-50% with rejections common below 30% — robust across cultures, though magnitudes vary." },
      { name: "Field experiments / RCTs", description: "Real-world randomization.", usedFor: ["behavioral", "methods", "development"], problem: "Can controlled experiments work in real economies?", keyInsight: "yes — Banerjee, Duflo, Kremer extended RCTs to development, anti-poverty, and education programs.", example: "The 2019 Nobel went to Banerjee/Duflo/Kremer for embedding RCTs in development economics — deworming and microfinance trials are landmark cases." },
      { name: "Status quo bias", description: "Inertia in choice.", usedFor: ["behavioral"], problem: "Why do people stick with prior choices even when alternatives dominate?", keyInsight: "Samuelson-Zeckhauser: defaults, switching costs, and loss aversion all anchor people to current state.", example: "Employees rarely rebalance retirement portfolios after initial allocation — the inertia justifies auto-rebalancing defaults." },
    ],
  },
  {
    slug: "heterodox",
    name: "Heterodox Schools",
    blurb: "Marxist, Modern Monetary Theory, Ecological, and Feminist economics.",
    color: "orange",
    methods: [
      { name: "Marx — labor theory of value", description: "Value from labor time.", usedFor: ["marxist", "contested"], problem: "What determines exchange value under capitalism?", keyInsight: "socially necessary labor time; profit derived from surplus extracted from workers.", example: "Marx's analysis underlies critiques of capitalism but is rejected by mainstream theory after the marginalist revolution." },
      { name: "Capital accumulation & crisis", description: "Tendency of profit to fall.", usedFor: ["marxist", "contested"], problem: "Why do capitalist economies experience recurrent crises?", keyInsight: "Marx: rising organic composition of capital depresses profit rates, generating periodic crises.", example: "Long-run profit-rate data are debated; Marxist macro frameworks reinterpret 2008 and the 1970s through this lens." },
      { name: "Modern Monetary Theory (MMT)", description: "Sovereign-currency macro.", usedFor: ["heterodox", "monetary", "contested"], problem: "Are sovereign-currency governments financially constrained?", keyInsight: "MMT: no — they're constrained by inflation, not insolvency; taxes drive currency demand.", example: "MMT advocates favor running deficits to full employment, constrained by inflation. Mainstream economists dispute the implication for fiscal limits." },
      { name: "Chartalism", description: "Money is a creature of the state.", usedFor: ["heterodox"], problem: "What gives a currency value?", keyInsight: "Knapp: state demand (taxes payable in it) plus legal-tender status anchor currency value.", example: "Tax-driven money demand is a central plank of MMT; mainstream accepts the historical insight while disputing the policy conclusions." },
      { name: "Functional finance", description: "Budget for outcomes, not balance.", usedFor: ["heterodox"], problem: "How should governments use the budget?", keyInsight: "Lerner: fiscal policy should target full employment and price stability, not arbitrary deficit targets.", example: "Functional finance underlies MMT prescriptions; mainstream uses similar logic in the New Keynesian framework but with stronger sustainability constraints." },
      { name: "Ecological economics", description: "Economy embedded in biosphere.", usedFor: ["ecological"], problem: "How do we account for ecological limits and entropy?", keyInsight: "Daly, Georgescu-Roegen: economy is a subsystem of the finite biosphere; growth has thermodynamic limits.", example: "Steady-state economics challenges GDP-growth focus; planetary-boundaries framework is the modern empirical descendant." },
      { name: "Degrowth", description: "Planned reduction of throughput.", usedFor: ["ecological", "contested"], problem: "Can rich economies remain prosperous while reducing material/energy use?", keyInsight: "degrowth advocates argue for planned scale-down; mainstream growth economists are skeptical of the political and welfare implications.", example: "European degrowth scholars (Hickel, Kallis) propose work-time reduction and consumption caps; sharply contested within and beyond economics." },
      { name: "Feminist economics", description: "Unpaid work and care.", usedFor: ["heterodox"], problem: "Why does mainstream economics largely ignore unpaid household labor?", keyInsight: "incorporating care and reproduction reframes growth, productivity, and gender gaps.", example: "Marilyn Waring (1988) showed how SNA excluded unpaid care; influencing GDP-revision discussions and time-use surveys at national statistics offices." },
      { name: "Institutional economics (old)", description: "Habits, rules, power.", usedFor: ["heterodox"], problem: "Why are institutions not just frictions but central?", keyInsight: "Veblen, Commons: economic behavior shaped by habits, rules, and power — not just preferences and prices.", example: "Veblen's 'conspicuous consumption' and 'leisure class' captured signaling behavior decades before neoclassical signaling theory rediscovered it." },
      { name: "Post-Keynesian economics", description: "Uncertainty over equilibrium.", usedFor: ["heterodox"], problem: "How should Keynes's insights be extended?", keyInsight: "fundamental (Knightian) uncertainty, endogenous money, demand-led growth.", example: "Post-Keynesian endogenous-money theory anticipated central-bank reserves-do-not-cause-loans empirical findings of the 2010s." },
      { name: "Stock-flow consistent models", description: "Every flow has a counterpart.", usedFor: ["heterodox", "macro"], problem: "How do we model an economy with consistent accounting across sectors?", keyInsight: "Godley-Lavoie SFC: every flow has an origin and a destination; sectoral balances must add to zero.", example: "SFC models project sectoral balances and were used to predict 2008 vulnerabilities by tracking household debt trajectories." },
      { name: "World-systems theory", description: "Core, periphery, semi-periphery.", usedFor: ["heterodox", "development", "contested"], problem: "Why do global inequalities persist?", keyInsight: "Wallerstein: capital-labor relations span national borders; core economies extract from peripheries.", example: "World-systems frameworks influence dependency theory and post-colonial economics; mainstream development economics critiques their lack of microfoundations." },
    ],
  },

  // ── APPLIED SUBFIELDS (blue/indigo) ────────────────────────────────────────
  {
    slug: "macroeconomics",
    name: "Macroeconomics",
    blurb: "Output, inflation, unemployment, and growth at the national level.",
    color: "blue",
    methods: [
      { name: "Gross domestic product (GDP)", description: "Total output.", usedFor: ["macro", "national accounts"], problem: "How do we measure total economic activity?", keyInsight: "value of all final goods/services produced; computed by expenditure, income, or output approaches.", example: "Y = C + I + G + (X − M) is the expenditure identity used to decompose every national-accounts release." },
      { name: "Real vs nominal GDP", description: "Stripping out prices.", usedFor: ["macro"], problem: "How do we separate output growth from price increases?", keyInsight: "nominal is current prices; real holds prices fixed; ratio = GDP deflator.", example: "2026 nominal US GDP higher than 2020's, but the real rise is smaller after deflating by the ~25% cumulative price change." },
      { name: "Inflation measurement", description: "CPI, PCE, GDP deflator.", usedFor: ["macro"], problem: "How do we measure changes in the cost of living?", keyInsight: "Laspeyres-style CPI fixes a basket; chain-weighted PCE updates basket; both yield similar but distinct measures.", example: "PCE typically runs 30–50 bps below CPI due to chain-weighting and broader coverage — relevant because the Fed targets PCE." },
      { name: "Unemployment measures", description: "U-3, U-6, participation.", usedFor: ["macro", "labor"], problem: "Is the official unemployment rate a complete picture?", keyInsight: "U-3 is headline; U-6 adds marginally attached and part-time-for-economic-reasons; participation captures dropouts.", example: "US U-3 reached 50-year lows in 2023; U-6 rose more visibly during 2020 COVID-shock, showing the limits of single-number measures." },
      { name: "Business cycle", description: "Expansions and recessions.", usedFor: ["macro"], problem: "Why does economic activity fluctuate around its trend?", keyInsight: "interplay of demand shocks, supply shocks, and policy; NBER dates US cycles judgmentally.", example: "The 2020 COVID recession was the shortest on record (Feb–Apr 2020) per NBER; as of 2026 NBER has not dated a subsequent US recession (verify at build time)." },
      { name: "Solow growth model", description: "Capital, labor, technology.", usedFor: ["macro", "growth"], problem: "What determines long-run growth?", keyInsight: "diminishing returns to capital → convergence to steady state; only TFP growth raises per-capita income permanently.", example: "Solow accounting suggests ~half of US 20th-century growth came from TFP, not capital deepening — making the residual the central puzzle." },
      { name: "Endogenous growth", description: "Innovation inside the model.", usedFor: ["macro", "growth"], problem: "Where does TFP growth come from?", keyInsight: "Romer (1990), Aghion-Howitt: knowledge spillovers, R&D, and creative destruction generate sustained growth.", example: "The 2018 Nobel went to Nordhaus and Romer for endogenous-growth/climate-economics. Aghion-Howitt-Mokyr received the 2025 Nobel for innovation-led growth (verify at build time)." },
      { name: "Total factor productivity", description: "Solow residual.", usedFor: ["macro", "growth"], problem: "What's left over after accounting for labor and capital growth?", keyInsight: "TFP captures technology, organization, and unmeasured inputs; the source of long-run growth.", example: "Post-2005 US TFP growth has slowed markedly — a leading hypothesis for the productivity puzzle of the 2010s." },
      { name: "Okun's law", description: "Output-unemployment link.", usedFor: ["macro"], problem: "By how much does unemployment respond to output gaps?", keyInsight: "≈ 1 pp rise in unemployment for every ~2 pp shortfall of real GDP from potential.", example: "The 2020 COVID-shock briefly broke Okun's law as labor-force dropouts disguised the output collapse — a reminder that empirical regularities aren't laws." },
      { name: "Phillips curve", description: "Inflation-unemployment trade-off.", usedFor: ["macro", "contested"], problem: "Is there a stable trade-off between inflation and unemployment?", keyInsight: "short run yes; long run vertical at the natural rate; flatness has been debated since the 2010s.", example: "Post-2010 the Phillips curve appeared 'flat' in the US — until 2021–2022 inflation suggested it had only been dormant; status remains contested." },
      { name: "Output gap", description: "Actual vs potential GDP.", usedFor: ["macro"], problem: "How far is the economy from its potential?", keyInsight: "gap = (actual − potential)/potential; signals slack and informs policy.", example: "CBO and IMF publish output-gap estimates; their large revisions historically illustrate the difficulty of measuring potential output in real time." },
      { name: "Aggregate demand & supply shocks", description: "What hit, and from where.", usedFor: ["macro"], problem: "How do we distinguish supply from demand shocks?", keyInsight: "demand shocks move prices and output the same direction; supply shocks move them opposite ways.", example: "The 2021–22 inflation episode mixed supply (energy, supply chains) and demand (fiscal stimulus) — debate over the mix shaped policy disputes." },
      { name: "Stagflation", description: "Inflation + stagnation.", usedFor: ["macro"], problem: "Can inflation and unemployment rise together?", keyInsight: "yes, under adverse supply shocks; the 1970s gave Keynesian-only frameworks trouble.", example: "1970s oil shocks plus loose monetary policy produced stagflation, ultimately broken by the Volcker disinflation of 1979–82." },
      { name: "Hyperinflation", description: "Out-of-control prices.", usedFor: ["macro"], problem: "How do extreme inflations arise and end?", keyInsight: "fiscal dominance, monetization of deficits, and collapse of money demand spiral together.", example: "Weimar Germany (1923), Zimbabwe (2008), Venezuela (2017–) — all featured deficit monetization and rapid currency-substitution dynamics." },
    ],
  },
  {
    slug: "monetary",
    name: "Monetary Economics",
    blurb: "Central banks, interest rates, and the transmission of monetary policy.",
    color: "indigo",
    methods: [
      { name: "Central bank", description: "Sets the price of money.", usedFor: ["monetary"], problem: "Why does almost every country have a central bank?", keyInsight: "lender of last resort, monetary policy, financial-system supervisor; managers of the currency.", example: "The Fed, ECB, BoE, BoJ, PBoC together run policy for most of world GDP; their independence levels vary but converged in recent decades." },
      { name: "Monetary policy transmission", description: "From rates to economy.", usedFor: ["monetary"], problem: "How do policy rates affect inflation and output?", keyInsight: "via interest, credit, asset-price, exchange-rate, and expectations channels — with lags of 6–18 months.", example: "Fed hikes 2022–23 cycle worked through mortgage rates → housing → eventually wages and core inflation, with each channel firing at different speeds." },
      { name: "Taylor rule", description: "Rate from gaps.", usedFor: ["monetary"], problem: "How can a central bank's behavior be summarized?", keyInsight: "`i = r* + π + 0.5(π − π*) + 0.5 y_gap`; reaction function used as benchmark.", example: "Taylor-rule prescriptions tracked actual Fed funds closely from 1987–2002, less so during the post-2008 zero-lower-bound period." },
      { name: "Fed funds rate / policy rate", description: "Overnight benchmark.", usedFor: ["monetary"], problem: "What rate do central banks actually control?", keyInsight: "the overnight rate at which banks lend reserves to each other; floor-system tools (IORB, RRP) keep it at target.", example: "Fed funds target peaked at 5.25–5.50% in 2023; the Fed began cutting in late 2024 and has eased further through 2025–26 (verify at build time)." },
      { name: "Quantitative easing", description: "Buying long-dated assets.", usedFor: ["monetary"], problem: "What do central banks do when policy rates hit zero?", keyInsight: "large-scale asset purchases compress long-rate term premia and signal commitment.", example: "Fed's 2008–14 QE expanded the balance sheet from ~$0.9T to ~$4.5T; ECB and BoJ adopted similar tools; effects on output remain debated." },
      { name: "Forward guidance", description: "Promising future policy.", usedFor: ["monetary"], problem: "How can a central bank affect long rates without changing policy now?", keyInsight: "credible communication about future paths shifts expectations and the yield curve.", example: "ECB's 2013 forward guidance and Fed's post-2020 'liftoff' guidance moved long rates substantially without immediate rate changes." },
      { name: "Inflation targeting", description: "Anchor with a number.", usedFor: ["monetary"], problem: "How do central banks commit to price stability?", keyInsight: "publish a target (usually 2%) and pursue it with policy rates; flexible IT allows weight on output.", example: "New Zealand pioneered IT in 1990; nearly all advanced economies now follow the framework (mostly at 2%)." },
      { name: "Zero lower bound", description: "Rates can't go far negative.", usedFor: ["monetary"], problem: "What limits conventional policy?", keyInsight: "cash substitution constrains how negative policy rates can fall; binding constraint motivates QE and fiscal action.", example: "Eurozone and Swiss negative rates (−0.1% to −0.75%) showed the ZLB isn't precisely zero, but practical limits remain narrow." },
      { name: "Velocity of money", description: "How often money turns over.", usedFor: ["monetary"], problem: "What's the relationship between money supply and nominal income?", keyInsight: "`V = PY/M`; stability of V underlies monetarism and breaks down at the ZLB.", example: "US M2 velocity collapsed after 2008 and 2020, severing the monetarist link between M2 growth and inflation — at least temporarily." },
      { name: "Money multiplier", description: "Reserves → deposits.", usedFor: ["monetary"], problem: "How do reserves translate into broader money?", keyInsight: "textbook: m = 1/RR; post-2008 reality: banks hold huge excess reserves so the link breaks down.", example: "Post-2008 the multiplier became nearly meaningless; central banks shifted to interest-on-reserves frameworks to control the policy rate directly." },
      { name: "Seigniorage", description: "Profit from issuing money.", usedFor: ["monetary"], problem: "How much can a government earn by creating currency?", keyInsight: "`S = ΔM/P`; large if inflation taxes money holders heavily.", example: "Argentina and Venezuela have relied heavily on seigniorage in crisis periods, at the cost of high inflation and currency substitution." },
      { name: "Central-bank independence", description: "Insulating from politics.", usedFor: ["monetary"], problem: "Why are most modern central banks formally independent?", keyInsight: "to avoid time-inconsistency: politicians want surprise inflation; independence makes commitment credible.", example: "Cross-country studies (Cukierman, Alesina-Summers) find independent central banks deliver lower inflation without higher unemployment." },
    ],
  },
  {
    slug: "public-fiscal",
    name: "Public & Fiscal Economics",
    blurb: "Taxes, spending, deficits, and the design of government finance.",
    color: "blue",
    methods: [
      { name: "Tax incidence", description: "Who really pays?", usedFor: ["fiscal"], problem: "Where does the burden of a tax actually fall?", keyInsight: "the less elastic side bears more of the tax, regardless of who 'writes the check'.", example: "Payroll taxes are split nominally between worker and firm but empirical incidence is mostly on workers because labor supply is relatively inelastic." },
      { name: "Optimal taxation", description: "Min distortion, max equity.", usedFor: ["fiscal"], problem: "What tax structure raises needed revenue at least social cost?", keyInsight: "Ramsey: tax inelastic goods more; Mirrlees: trade off equity and efficiency in nonlinear income tax.", example: "Mirrleesian optimal-tax theory underpins the modern preference for broad-base, low-rate income taxes with separate redistribution." },
      { name: "Laffer curve", description: "Hump-shaped revenue.", usedFor: ["fiscal", "contested"], problem: "Can lower rates ever raise revenue?", keyInsight: "possible at very high marginal rates; empirical revenue-maximizing rates for top incomes are estimated near 60–70%, far above current US rates.", example: "Reagan-era tax cuts did not pay for themselves on most estimates, but extreme top rates (e.g., 90%) likely sat on the high side of the Laffer curve." },
      { name: "Progressive vs flat taxation", description: "Rate structure.", usedFor: ["fiscal"], problem: "How should marginal rates vary across the income distribution?", keyInsight: "progressivity equates marginal disutilities; flat taxes minimize distortions but raise inequality.", example: "OECD countries cluster between 30–55% top marginal rates; the trade-off between revenue, redistribution, and behavioral response is the policy question." },
      { name: "Deadweight loss of taxation", description: "Wedge cost.", usedFor: ["fiscal"], problem: "What's the efficiency cost of raising tax revenue?", keyInsight: "DWL ≈ ½ τ² · ε · base; grows with tax-rate squared and elasticity.", example: "Top-income labor-supply elasticities of ~0.3 imply moderate DWL at current rates; capital-income elasticities are higher and contested." },
      { name: "Public goods provision", description: "Government supply.", usedFor: ["fiscal", "welfare"], problem: "How much public good should be provided?", keyInsight: "Samuelson rule: sum of MRS across consumers equals the marginal rate of transformation.", example: "Optimal national-defense spending: equalize the aggregate willingness-to-pay with the marginal cost of provision — operationalized via cost-benefit." },
      { name: "Optimal public-debt level", description: "How much to borrow.", usedFor: ["fiscal", "contested"], problem: "When does government debt become problematic?", keyInsight: "tax-smoothing argues for debt in shocks; debt-sustainability requires r < g or running primary surpluses.", example: "Japan sustains 250%+ debt-to-GDP with low rates; emerging markets default at much lower ratios — the level alone doesn't determine sustainability." },
      { name: "Ricardian equivalence", description: "Debt = future taxes.", usedFor: ["fiscal", "contested"], problem: "Does it matter whether spending is financed by taxes or debt?", keyInsight: "Barro: under strong assumptions, no — rational households save the offset.", example: "Empirical Ricardian behavior is at best partial; finite lifetimes, credit constraints, and uncertainty break the equivalence." },
      { name: "Fiscal multiplier", description: "GDP per dollar spent.", usedFor: ["fiscal"], problem: "What's the bang per buck of government spending?", keyInsight: "estimates 0.5–2.0; higher in slumps, at the ZLB, and with concentrated marginal recipients.", example: "Romer-Romer, Blanchard-Leigh, IMF estimates put short-run spending multipliers around 1.0–1.7 in recessions — much lower in booms." },
      { name: "Crowding out", description: "Public spending displaces private.", usedFor: ["fiscal", "contested"], problem: "Does government spending reduce private investment?", keyInsight: "in normal times, higher deficits raise rates and crowd out investment; not at the ZLB.", example: "The 2009 ARRA had limited crowd-out because rates were stuck near zero; classical crowding-out estimates apply to non-ZLB periods." },
      { name: "Cost-benefit analysis", description: "Net social value.", usedFor: ["fiscal", "welfare"], problem: "How do we evaluate public projects systematically?", keyInsight: "sum discounted social benefits minus costs; use willingness-to-pay and shadow prices.", example: "OMB Circular A-4 and HM Treasury Green Book operationalize CBA for US/UK regulation — discount-rate choice often dominates conclusions." },
      { name: "Social Security & pensions", description: "Pay-as-you-go vs funded.", usedFor: ["fiscal", "social"], problem: "How should public pensions be structured?", keyInsight: "PAYG transfers between cohorts; funded systems accumulate assets — each has demographic and political-economy risks.", example: "US Social Security is largely PAYG; demographic aging is shifting many systems toward higher retirement ages or partial funding." },
    ],
  },
  {
    slug: "labor",
    name: "Labor Economics",
    blurb: "Wages, employment, human capital, and labor-market institutions.",
    color: "indigo",
    methods: [
      { name: "Labor supply", description: "How much to work.", usedFor: ["labor"], problem: "How does the labor-leisure choice respond to wages and taxes?", keyInsight: "income vs substitution effects; backward-bending supply at high wages possible.", example: "Empirical labor-supply elasticities are small for prime-age men (~0.1) and larger for secondary earners (~0.5)." },
      { name: "Labor demand", description: "Hiring decisions.", usedFor: ["labor"], problem: "How many workers should a firm hire?", keyInsight: "hire while `MP_L · P ≥ w`; demand curve slopes down in wages.", example: "Robotization shifts labor demand toward higher-skill workers — visible in widening wage premia for college graduates since the 1980s." },
      { name: "Human capital", description: "Investment in skills.", usedFor: ["labor"], problem: "Why does education raise wages?", keyInsight: "Becker: schooling, training, and experience are productive investments with measurable returns.", example: "Mincer-style earnings regressions find ~8–10% return per year of schooling — though signaling, ability bias, and selection complicate causal interpretation." },
      { name: "Minimum wage", description: "Wage floor.", usedFor: ["labor", "contested"], problem: "Does a binding minimum wage reduce employment?", keyInsight: "classical answer: yes (competitive labor market); modern empirical work (Card-Krueger, Cengiz et al.) finds modest disemployment effects at observed levels.", example: "Long-running debate: Card-Krueger NJ fast-food study, Seattle and California studies show small effects; large hikes (e.g., $15→$20) remain contested." },
      { name: "Search & matching", description: "Frictional unemployment.", usedFor: ["labor"], problem: "Why is there always some unemployment?", keyInsight: "Mortensen-Pissarides: heterogeneous matches and search frictions imply equilibrium unemployment.", example: "The 2010 Nobel went to Diamond, Mortensen, Pissarides for search-matching theory — used to interpret Beveridge curve shifts after 2020." },
      { name: "Beveridge curve", description: "Vacancies vs unemployment.", usedFor: ["labor"], problem: "What does the V-U trade-off tell us?", keyInsight: "matching efficiency shifts the curve; cyclical movements trace along it.", example: "Post-2020 the US Beveridge curve shifted outward — high vacancies and elevated unemployment — interpreted as labor-market mismatch." },
      { name: "Compensating differentials", description: "Wages for unpleasant jobs.", usedFor: ["labor"], problem: "Why do dangerous or unpleasant jobs pay more (or less, if attractive)?", keyInsight: "wages equalize utility across jobs; hazard pay is a compensating differential.", example: "Estimates of the 'value of a statistical life' often come from compensating wage differentials for risky occupations." },
      { name: "Discrimination", description: "Wage gaps unexplained by skills.", usedFor: ["labor"], problem: "Why do wages differ across demographic groups for similar work?", keyInsight: "Becker taste-based vs Phelps/Arrow statistical discrimination; field experiments isolate it.", example: "Bertrand-Mullainathan resume audits found callback rates 50% lower for African-American-sounding names — clean experimental evidence of discrimination." },
      { name: "Monopsony", description: "Single-buyer labor markets.", usedFor: ["labor"], problem: "What if firms have wage-setting power?", keyInsight: "monopsony lowers wages and employment; minimum wages can raise both in this case.", example: "Manning, Azar-Marinescu-Steinbaum find substantial labor-market concentration; provides theoretical room for minimum-wage effects." },
      { name: "Unions & collective bargaining", description: "Worker market power.", usedFor: ["labor"], problem: "What do unions do?", keyInsight: "raise wages for members, compress wage distribution, affect productivity and turnover ambiguously.", example: "Union-membership decline in US (from ~30% in 1955 to ~10% in 2026) is one channel for rising wage inequality (verify at build time)." },
      { name: "Skill-biased technical change", description: "Technology rewards skills.", usedFor: ["labor", "macro"], problem: "Why has the college wage premium risen since 1980?", keyInsight: "Katz-Murphy, Autor-Levy-Murnane: computer-era technology complements high-skill, substitutes for routine middle-skill work.", example: "US college-wage premium roughly doubled from 1980–2010; AI may shift the pattern further toward non-routine analytical and creative work." },
      { name: "Roy model", description: "Self-selection by talent.", usedFor: ["labor"], problem: "How do workers sort into occupations?", keyInsight: "agents pick the occupation where they have comparative advantage.", example: "Migration patterns: high-skill workers move to high-return countries when returns to skill differ — a Roy-model interpretation of brain drain." },
    ],
  },
  {
    slug: "international",
    name: "International Trade & Finance",
    blurb: "Trade flows, exchange rates, and open-economy macro.",
    color: "blue",
    methods: [
      { name: "Heckscher-Ohlin", description: "Trade by factor endowments.", usedFor: ["trade"], problem: "What goods do countries export?", keyInsight: "countries export goods intensive in their abundant factor.", example: "Capital-abundant economies export capital-intensive goods; labor-abundant ones export labor-intensive goods — partially confirmed empirically (Leontief paradox aside)." },
      { name: "Stolper-Samuelson", description: "Trade and factor returns.", usedFor: ["trade"], problem: "Who wins and loses from trade?", keyInsight: "owners of the abundant factor gain, scarce factor owners lose — even if aggregate gains are positive.", example: "US-China trade hurts low-skill labor (US's scarce factor); compensation via trade-adjustment programs is the policy response." },
      { name: "New trade theory", description: "Scale and variety.", usedFor: ["trade"], problem: "Why do similar countries trade similar goods?", keyInsight: "Krugman: monopolistic competition + increasing returns generates intra-industry trade.", example: "Germany exports BMWs to France while importing Renaults — explained by love-of-variety + scale economies, not factor endowments." },
      { name: "Heterogeneous firms (Melitz)", description: "Only the best export.", usedFor: ["trade"], problem: "Why do only some firms export?", keyInsight: "fixed export costs select the most productive firms; trade reallocates output toward them.", example: "Melitz (2003) explained a large empirical regularity: in every country, exporters are larger and more productive than non-exporters." },
      { name: "Trade policy: tariffs", description: "Taxes on imports.", usedFor: ["trade"], problem: "What are the effects of import tariffs?", keyInsight: "raise domestic prices, redistribute from consumers to producers/government, create deadweight loss.", example: "US 2018–24 China tariffs raised consumer prices and reduced trade volumes; long-run reshoring effects remain contested." },
      { name: "Optimal tariff", description: "Terms-of-trade exploitation.", usedFor: ["trade", "contested"], problem: "Can a large country gain from a tariff by improving its terms of trade?", keyInsight: "yes — but at world cost; provokes retaliation in practice.", example: "Optimal-tariff theory is mostly a theoretical curiosity; in practice retaliation makes unilateral tariffs welfare-reducing for all sides." },
      { name: "Exchange rate determination", description: "What sets the FX price.", usedFor: ["FX"], problem: "Why does a currency cost what it does?", keyInsight: "balance of payments + interest parity + relative prices; PPP holds long-run, deviations large short-run.", example: "Big Mac index tracks PPP deviations; large emerging-market currencies often trade 30–50% below PPP for years." },
      { name: "Purchasing power parity", description: "Same basket, same price.", usedFor: ["FX"], problem: "Should the same basket cost the same in different currencies?", keyInsight: "PPP: yes in the long run; deviations persist short-run due to non-tradables and frictions.", example: "Cross-country price-level comparisons use PPP exchange rates; emerging-market GDPs ~50% higher at PPP than at market rates." },
      { name: "Uncovered interest parity (UIP)", description: "Expected returns equalize.", usedFor: ["FX"], problem: "Why does the FX market equilibrate?", keyInsight: "`E[ΔS]/S = i_home − i_foreign`; expected depreciation equals interest differential.", example: "UIP fails empirically (the forward-premium puzzle): high-rate currencies tend to appreciate, not depreciate — a leading anomaly in international finance." },
      { name: "Mundell-Fleming model", description: "Open-economy IS-LM.", usedFor: ["macro", "FX"], problem: "How does monetary/fiscal policy work in an open economy?", keyInsight: "with fixed FX, monetary policy is impotent; with flexible FX, fiscal is.", example: "Eurozone members cannot run independent monetary policy — Mundell-Fleming's 'trilemma' is one reason monetary union creates fiscal stress." },
      { name: "Trilemma (impossible trinity)", description: "Pick two of three.", usedFor: ["FX", "monetary"], problem: "Can a country have fixed exchange rate, free capital flows, and independent monetary policy?", keyInsight: "no — only two of three. Choice defines the macro regime.", example: "China combines partial capital controls with managed FX and quasi-independent policy; eurozone has free capital + fixed FX (within euro) and gave up policy." },
      { name: "Current account & capital account", description: "Balance of payments.", usedFor: ["macro", "trade"], problem: "How do trade and capital flows fit together?", keyInsight: "CA + KA ≈ 0 by accounting identity; persistent CA deficits financed by capital inflows.", example: "US chronic CA deficits ~3–6% of GDP are financed by foreign demand for dollar assets — the 'exorbitant privilege' in Eichengreen's phrase." },
      { name: "Currency crises", description: "Speculative attacks.", usedFor: ["FX", "macro"], problem: "Why do pegs collapse?", keyInsight: "first-gen models: fiscal-monetary inconsistency; second-gen: self-fulfilling expectations.", example: "1997 Asian crisis combined both: weak fundamentals plus runs on currencies; 2022 sterling mini-budget illustrated rapid expectations-driven currency moves." },
    ],
  },
  {
    slug: "development",
    name: "Development Economics",
    blurb: "Why some countries are rich and others poor — and what to do about it.",
    color: "indigo",
    methods: [
      { name: "Cross-country growth empirics", description: "Conditional convergence.", usedFor: ["development", "growth"], problem: "Do poor countries catch up?", keyInsight: "convergence is conditional on institutions and human capital; unconditionally, divergence persists.", example: "East Asian tigers converged dramatically; sub-Saharan Africa did not — empirical literature explains this via institutions, geography, and policy." },
      { name: "Acemoglu-Robinson institutions", description: "Why nations fail.", usedFor: ["development", "institutions"], problem: "What deep causes explain long-run income differences?", keyInsight: "inclusive vs extractive institutions; colonial origins matter empirically.", example: "Acemoglu, Johnson, Robinson (2001) used settler-mortality as instrument for institutions — and won the 2024 Nobel for the broader research program (verify at build time)." },
      { name: "Geography hypothesis", description: "Climate and location.", usedFor: ["development", "contested"], problem: "Do natural endowments determine prosperity?", keyInsight: "Diamond, Sachs: latitude, disease environment, and access to seas matter — but mostly mediated by institutions.", example: "Tropical disease burdens (malaria) correlate with low GDP; the institutional vs geographic explanation remains contested in development economics." },
      { name: "Big push & coordination failure", description: "Stuck at low equilibrium.", usedFor: ["development"], problem: "Why do some economies stay poor despite available technology?", keyInsight: "Rosenstein-Rodan: simultaneous large investments needed to escape low-equilibrium traps.", example: "Murphy-Shleifer-Vishny formalization explains why piecemeal investments fail without coordinated scale — informing modern infrastructure-bundle policy." },
      { name: "Microfinance", description: "Small loans to the poor.", usedFor: ["development"], problem: "Can access to credit lift the poor?", keyInsight: "modest effects on consumption and small business; not a poverty silver bullet as initially hoped.", example: "Grameen Bank scaled to millions; rigorous RCTs (Banerjee et al.) found smaller effects than early enthusiasts predicted — but still positive." },
      { name: "Conditional cash transfers", description: "Pay for school/health.", usedFor: ["development"], problem: "Can incentives improve human-capital investment in poor households?", keyInsight: "yes — Mexico's Progresa/Oportunidades showed measurable gains in schooling and health.", example: "Progresa RCT (1997) anchored a global wave of CCT programs; remains one of the most replicated development success stories." },
      { name: "RCTs in development", description: "Randomized policy testing.", usedFor: ["development", "methods"], problem: "Can we know what actually works in development?", keyInsight: "Banerjee-Duflo-Kremer: randomize program assignment; measure causal effects directly.", example: "The 2019 Nobel celebrated RCTs in development — deworming, microfinance, and school-incentive experiments are the canonical applications." },
      { name: "Resource curse", description: "Natural-resource paradox.", usedFor: ["development", "contested"], problem: "Why are resource-rich countries often poor?", keyInsight: "Dutch disease, rent-seeking, weak institutions, and commodity price volatility all suppress development.", example: "Norway escaped via its sovereign-wealth fund (~$1.7T as of 2026) and strong institutions; Venezuela and Nigeria illustrate the curse (verify SWF figure)." },
      { name: "Dutch disease", description: "Resource boom kills manufacturing.", usedFor: ["development"], problem: "Why do resource booms damage non-resource sectors?", keyInsight: "FX appreciation makes other exports uncompetitive; resource sector absorbs labor and capital.", example: "Norway's 1970s oil boom appreciated the krone and squeezed manufacturing — countered by aggressive fiscal sterilization via its SWF." },
      { name: "Poverty traps", description: "Stuck below threshold.", usedFor: ["development", "contested"], problem: "Can households be trapped in low-productivity states by their own poverty?", keyInsight: "nutrition, credit, and skill thresholds may create traps; empirically partial.", example: "Banerjee-Duflo find some evidence of poverty traps for the very poor but argue most poverty is not trap-driven — a contested empirical question." },
      { name: "Structural transformation", description: "From farms to factories to services.", usedFor: ["development"], problem: "How do economies move out of agriculture?", keyInsight: "rising productivity in agriculture releases labor; demand patterns shift toward manufacturing then services.", example: "China's transformation since 1980: agricultural employment share fell from 70% to ~20%; services now lead — textbook structural change at speed." },
      { name: "Globalization and inequality", description: "Distributional effects of trade.", usedFor: ["development", "trade"], problem: "Who wins and loses globally from globalization?", keyInsight: "Milanovic 'elephant curve': global middle (Asian workers) and global top gained; advanced-economy middle stagnated.", example: "Milanovic's elephant graph (1988–2008) became the iconic image of globalization's distributional effects — debate continues over its post-2008 update." },
    ],
  },
  {
    slug: "environmental-health",
    name: "Environmental & Health Economics",
    blurb: "Pricing pollution, valuing life, and the economics of health care.",
    color: "blue",
    methods: [
      { name: "Cap-and-trade", description: "Tradable pollution permits.", usedFor: ["environment", "policy"], problem: "How do we limit pollution efficiently?", keyInsight: "set quantity, let prices adjust; firms with low abatement costs trade with high-cost firms.", example: "EU ETS prices carbon at €60–100/tCO2 (2026) — verify current; covers ~40% of EU emissions and has driven measurable reductions." },
      { name: "Carbon tax", description: "Price the externality.", usedFor: ["environment", "policy"], problem: "How do we internalize climate damage?", keyInsight: "Pigouvian tax at the social cost of carbon (estimates $50–250/tCO2).", example: "Canada's federal carbon tax ($65/tCO2 in 2023, rising) shows full-scale implementation; revenue is rebated to households via direct payments." },
      { name: "Social cost of carbon", description: "Damage per ton.", usedFor: ["environment"], problem: "How much harm does emitting a ton of CO2 cause?", keyInsight: "estimates from integrated assessment models — Nordhaus DICE ~$50, EPA 2023 update ~$190/tCO2.", example: "EPA's 2023 SCC raised the central estimate to $190/tCO2 (2020 dollars) — substantially above earlier US government estimates." },
      { name: "Pigouvian tax (recap)", description: "Tax the harm.", usedFor: ["environment", "welfare"], problem: "What's the efficient corrective for negative externalities?", keyInsight: "set the tax equal to marginal external damage at the optimal quantity.", example: "Sweden's carbon tax (~$130/tCO2) — among the highest globally — is a real-world Pigouvian instrument cited in textbooks." },
      { name: "DICE model", description: "Climate-economy integration.", usedFor: ["environment"], problem: "How do we model climate and economy together?", keyInsight: "Nordhaus integrated-assessment model couples damage functions to growth.", example: "Nordhaus's 2018 Nobel cited DICE and its descendants; debates over discount rates and damage functions dominate quantitative climate policy." },
      { name: "QALY / DALY", description: "Quality-adjusted life metric.", usedFor: ["health"], problem: "How do we compare health interventions on a common scale?", keyInsight: "weight life years by health quality; gives a single metric for cost-effectiveness.", example: "UK NICE uses ~£20–30k/QALY as a treatment-approval threshold — a transparent if controversial way to ration scarce health resources." },
      { name: "Value of statistical life", description: "WTP for safety.", usedFor: ["health", "policy"], problem: "How do we value mortality-reduction policies?", keyInsight: "infer from wage premia, hedonic prices, or stated preference; US federal value ~$11M (2026) (verify).", example: "Regulatory cost-benefit analyses use VSL to compare safety regulations across agencies — a practical use of hedonic and contingent-valuation methods." },
      { name: "Adverse selection in insurance", description: "Sick people enroll more.", usedFor: ["health", "contracts"], problem: "Why do voluntary insurance markets unravel?", keyInsight: "high-risk types disproportionately enroll, raising prices and driving low-risk types out.", example: "Pre-ACA US individual insurance markets showed this clearly; mandates and risk-adjustment partly address it." },
      { name: "Moral hazard in insurance", description: "Insurance lowers care.", usedFor: ["health"], problem: "Does insurance increase risky behavior or unnecessary care?", keyInsight: "yes, on the margin; RAND health-insurance experiment showed ~30% lower utilization with cost-sharing.", example: "RAND HIE (1974–82) remains the gold-standard estimate of demand elasticities in health care — used in modern plan design." },
      { name: "Health-care cost-disease", description: "Baumol effect.", usedFor: ["health"], problem: "Why do health-care costs keep outpacing inflation?", keyInsight: "labor-intensive services with limited productivity growth must pay rising market wages — Baumol's cost disease.", example: "Education and healthcare cost growth track the cost-disease prediction across rich countries — a structural force behind rising public budgets." },
    ],
  },
  {
    slug: "industrial-organization",
    name: "Industrial Organization & Antitrust",
    blurb: "Market power, antitrust, and the strategic behavior of firms.",
    color: "indigo",
    methods: [
      { name: "Structure-conduct-performance", description: "Old-school IO.", usedFor: ["IO"], problem: "How do market structure and firm behavior link to performance?", keyInsight: "Bain: concentration → market power → higher prices/profits; later challenged by Chicago/empirical IO.", example: "SCP framework dominated IO until the 1970s; modern empirical IO replaces it with structural estimation of demand and conduct." },
      { name: "Empirical IO", description: "Estimating demand and costs.", usedFor: ["IO", "methods"], problem: "How do we measure market power from data?", keyInsight: "BLP-style discrete-choice demand estimation + supply-side first-order conditions identifies markups and merger effects.", example: "BLP (1995) automobile-market analysis is the canonical structural IO paper — methods now standard at the FTC, DOJ, and EU DG-COMP." },
      { name: "Horizontal mergers", description: "Same-stage combination.", usedFor: ["IO", "antitrust"], problem: "When does a merger between competitors harm consumers?", keyInsight: "raises concentration; balanced against efficiencies; simulation methods predict price effects.", example: "FTC challenges to T-Mobile/Sprint, Bertelsmann/Simon & Schuster used merger-simulation evidence — sometimes successfully, sometimes not." },
      { name: "Vertical mergers", description: "Different-stage combination.", usedFor: ["IO", "antitrust", "contested"], problem: "When does a vertical merger harm competition?", keyInsight: "may foreclose rivals or coordinate; balanced against double-marginalization fix; mostly tolerated.", example: "AT&T-Time Warner (2018) was allowed despite DOJ challenge; vertical-merger enforcement remains the most contested area of antitrust." },
      { name: "Predatory pricing", description: "Price below cost to drive out rivals.", usedFor: ["IO", "antitrust", "contested"], problem: "Do firms actually price below cost to monopolize?", keyInsight: "Areeda-Turner: rare empirically; Chicago school skeptical; modern view sees more scope.", example: "Brooke Group (1993) set a high US bar — predator must show below-cost pricing + likely recoupment — rarely met in practice." },
      { name: "Antitrust enforcement", description: "Sherman/Clayton/EU TFEU.", usedFor: ["antitrust"], problem: "What conduct does competition law forbid?", keyInsight: "agreements that restrain trade, monopolization, anticompetitive mergers — with varying tests in different jurisdictions.", example: "Microsoft (2001) and Google (2017 EU, 2024 US) shape modern antitrust against tech platforms; debates over consumer-welfare vs broader standards persist." },
      { name: "Platform competition", description: "Two-sided market dynamics.", usedFor: ["IO", "antitrust"], problem: "How does competition work for platforms?", keyInsight: "network effects, switching costs, and multi-homing shape outcomes; standard tools require adaptation.", example: "EU Digital Markets Act (2023) imposes ex-ante rules on 'gatekeepers' — a regulatory response to platform-specific competition concerns." },
      { name: "Patents and innovation", description: "Monopoly for invention.", usedFor: ["IO", "innovation"], problem: "How long and broad should patents be?", keyInsight: "trade off ex-ante incentives vs ex-post deadweight loss; optimal lengths depend on industry.", example: "Pharma patents (20 years from filing) provide strong incentives for costly R&D; software patents are more controversial." },
      { name: "R&D and innovation policy", description: "Public funding of knowledge.", usedFor: ["innovation"], problem: "Why subsidize private R&D?", keyInsight: "knowledge spillovers make social returns exceed private; market under-invests.", example: "R&D tax credits in OECD countries reflect this logic; estimates of social returns to R&D commonly exceed private returns by 2–4×." },
      { name: "Auctions", description: "Designing sales.", usedFor: ["IO"], problem: "Which auction format extracts the most value or revenue?", keyInsight: "Vickrey, Myerson: revenue equivalence under benchmark assumptions; design depends on goal and constraints.", example: "FCC spectrum auctions (1994 onward) raised hundreds of billions and are the canonical large-scale auction design success — Milgrom won the 2020 Nobel for the underlying theory." },
    ],
  },

  // ── EMPIRICAL METHODS (rose/violet) ────────────────────────────────────────
  {
    slug: "econometrics",
    name: "Econometrics & Causal Inference",
    blurb: "Tools for estimating causal effects from observational and experimental data.",
    color: "rose",
    methods: [
      { name: "OLS regression", description: "Linear conditional expectation.", usedFor: ["methods"], problem: "How do we summarize the linear relationship between Y and X?", keyInsight: "minimize squared residuals; consistent under exogeneity. (xref: statistics)", example: "Mincer earnings regressions, Phillips curves, and growth regressions are all OLS at heart — interpretation depends on exogeneity assumptions." },
      { name: "Instrumental variables (IV)", description: "Exogenous variation in X.", usedFor: ["methods", "causal"], problem: "How do we estimate causal effects when X is endogenous?", keyInsight: "find an instrument Z that affects X but not Y directly; 2SLS recovers the LATE. (xref: statistics)", example: "Angrist-Krueger quarter-of-birth IV for schooling; Acemoglu-Johnson-Robinson settler mortality for institutions — landmark applications." },
      { name: "Difference-in-differences", description: "Treatment vs control over time.", usedFor: ["methods", "causal"], problem: "How do we identify causal effects from policy changes?", keyInsight: "compare pre/post differences in treated vs untreated units; identification = parallel trends.", example: "Card-Krueger NJ-PA minimum-wage study and many DiD analyses since; parallel-trends and staggered-adoption issues now central concerns." },
      { name: "Regression discontinuity", description: "Local randomization at a cutoff.", usedFor: ["methods", "causal"], problem: "Can we exploit threshold-based eligibility rules?", keyInsight: "agents just above/below a cutoff are similar; treatment varies sharply — local LATE identification.", example: "Thistlethwaite-Campbell (1960) origin; modern uses include test-score cutoffs, age-discontinuity benefit eligibility, and election margins." },
      { name: "Synthetic control", description: "Building a counterfactual.", usedFor: ["methods", "causal"], problem: "What would have happened to one unit absent treatment?", keyInsight: "Abadie: weighted average of donor units matches pre-treatment trajectory; the post-trajectory is the counterfactual.", example: "Abadie-Gardeazabal (2003) Basque terrorism case popularized synthetic control; now standard for single-treated-unit comparative case studies." },
      { name: "Panel data fixed effects", description: "Within-unit variation only.", usedFor: ["methods"], problem: "How do we control for time-invariant heterogeneity?", keyInsight: "unit fixed effects absorb everything constant within unit; identification from within-unit variation. (xref: statistics)", example: "Wage regressions with worker fixed effects; firm-level studies with firm + year FEs; the standard workhorse for many micro panels." },
      { name: "Heteroskedasticity & robust SE", description: "Variance corrections.", usedFor: ["methods"], problem: "What if errors don't have constant variance?", keyInsight: "use heteroskedasticity-robust (White) or clustered standard errors. (xref: statistics)", example: "Stata's `, robust` and `cluster()` options operationalize this; mostly default since the 1990s for serious applied work." },
      { name: "GMM", description: "Generalized method of moments.", usedFor: ["methods"], problem: "How do we estimate with multiple moment conditions?", keyInsight: "Hansen: choose parameters to match sample moments to theoretical moments; encompasses OLS, IV, MLE as special cases. (xref: statistics)", example: "Standard for dynamic panel data (Arellano-Bond) and structural macro estimation; Hansen won the 2013 Nobel partly for GMM." },
      { name: "Maximum likelihood", description: "Parameters that fit the data best.", usedFor: ["methods"], problem: "How do we estimate parametric models?", keyInsight: "choose parameters that maximize the joint density of observed data; efficient under correct specification. (xref: statistics)", example: "Discrete-choice models, duration models, and many structural-IO models use MLE — sometimes computationally intensive." },
      { name: "Time-series: ARIMA", description: "Autoregressive forecasting.", usedFor: ["methods", "macro"], problem: "How do we model and forecast time series?", keyInsight: "AR, MA, integrated components capture serial dependence; ARIMA is the basic forecasting workhorse. (xref: statistics)", example: "Central bank short-run forecasts rely on ARIMA-style models; more elaborate alternatives include VAR and DSGE." },
      { name: "VAR / Bayesian VAR", description: "Vector autoregression.", usedFor: ["methods", "macro"], problem: "How do we jointly model several macro time series?", keyInsight: "Sims: treat all variables symmetrically; structural shocks identified by orthogonalization or sign restrictions.", example: "Sims's 1980 'Macroeconomics and Reality' launched VAR macroeconometrics; modern Bayesian VARs are central-bank workhorses." },
      { name: "Cointegration", description: "Long-run relationship in I(1) series.", usedFor: ["methods", "macro"], problem: "Can non-stationary series be in stable long-run relationship?", keyInsight: "Engle-Granger, Johansen: yes; linear combinations may be stationary even when each series isn't. (xref: statistics, finance)", example: "Money-income and consumption-income cointegration are workhorse macro applications; Engle-Granger shared the 2003 Nobel." },
      { name: "Event studies", description: "Effects around announcements.", usedFor: ["methods", "finance"], problem: "How do markets respond to news?", keyInsight: "compare actual vs expected returns in a window around the event; cumulative abnormal returns capture the effect.", example: "Standard for merger announcements, earnings, monetary-policy surprises; the canonical empirical tool in finance and macroeconomic-finance work." },
      { name: "Machine learning in econometrics", description: "Prediction-causal hybrid.", usedFor: ["methods"], problem: "How do ML methods fit into causal estimation?", keyInsight: "double-ML, causal forests use ML for nuisance estimation while preserving causal interpretation. (xref: statistics)", example: "Chernozhukov et al. double-ML and Athey-Wager causal forests are now common in applied policy evaluation and heterogeneity analysis." },
    ],
  },

  // ── CROSS-CUTTING GOLD (yellow) ────────────────────────────────────────────
  {
    slug: "gold-famous-open",
    name: "Nobel Ideas, Famous Models & Open Problems",
    blurb: "The most-cited results, contested debates, and the puzzles still open.",
    color: "yellow",
    methods: [
      { name: "Arrow's impossibility theorem", description: "No perfect voting rule.", usedFor: ["theory", "voting"], problem: "Can we aggregate individual preferences into a coherent social ranking?", keyInsight: "Arrow: no rule satisfying universal domain, non-dictatorship, IIA, and Pareto exists with ≥3 alternatives.", example: "Arrow (1951) launched social choice theory; his 1972 Nobel and the result still shape welfare economics and voting research." },
      { name: "Modigliani-Miller theorem", description: "Capital structure irrelevance.", usedFor: ["theory", "finance"], problem: "Does the mix of debt and equity matter for firm value? (xref: finance)", keyInsight: "MM (1958): in frictionless markets, no — value depends on assets. Real-world deviations: taxes, bankruptcy, agency, information.", example: "MM was a starting point for modern corporate finance; entire research programs map deviations from its benchmark." },
      { name: "Black-Scholes / Merton", description: "Option pricing formula.", usedFor: ["theory", "finance"], problem: "What's the no-arbitrage price of a European option? (xref: finance)", keyInsight: "Black-Scholes-Merton (1973): price = `S N(d1) − K e^(−rT) N(d2)` under GBM dynamics.", example: "Earned Merton and Scholes the 1997 Nobel; revolutionized derivatives pricing despite well-known empirical departures from the GBM assumption." },
      { name: "Lucas critique", description: "Policy changes change parameters.", usedFor: ["theory", "macro"], problem: "Can policy be evaluated using historical correlations?", keyInsight: "Lucas (1976): no — agents re-optimize when policy rules change; deep parameters needed.", example: "Drove the rational-expectations and micro-foundations revolutions; reshaped academic macro and central-bank modeling alike." },
      { name: "Equity premium puzzle", description: "Stocks beat bonds by too much.", usedFor: ["puzzles", "finance"], problem: "Why does the historical equity premium (~6% pa real) exceed what standard models predict? (xref: finance)", keyInsight: "Mehra-Prescott (1985): plausible risk aversion implies premia of ~0.5%, not 6%.", example: "Decades of proposed resolutions: rare disasters, habit formation, long-run risk, ambiguity aversion; no consensus winner." },
      { name: "Risk-free rate puzzle", description: "Real rates too low.", usedFor: ["puzzles", "finance"], problem: "Why is the historical real risk-free rate so low (~1%) given consumption growth?", keyInsight: "Weil: standard preferences predict much higher rates; another moment standard models miss.", example: "Often viewed as the flip side of the equity premium puzzle — both reflect deep tension between asset returns and consumption-based models." },
      { name: "Home bias puzzle", description: "Underdiversification.", usedFor: ["puzzles", "finance"], problem: "Why do investors hold too much domestic equity? (xref: finance)", keyInsight: "transaction costs and frictions explain part; behavioral familiarity bias explains the rest.", example: "US investors typically hold 70%+ US equities vs ~50% market-cap weight — robust across countries and time." },
      { name: "Solow residual puzzle", description: "What is technology?", usedFor: ["puzzles", "growth"], problem: "What lies behind the unexplained productivity residual?", keyInsight: "TFP includes technology, organization, institutions, measurement error — disentangling them is an ongoing research program.", example: "Two-thirds of US growth attributed to TFP; growth accounting's central unresolved question — and the focus of the 2025 innovation-growth Nobel." },
      { name: "Productivity slowdown puzzle", description: "Tech boom, slow stats.", usedFor: ["puzzles", "growth"], problem: "Why has measured productivity growth slowed since 2005 despite apparent tech advances?", keyInsight: "candidates: mismeasurement of digital goods, exhaustion of past innovations, secular stagnation, rising market power.", example: "Gordon's 'Rise and Fall of American Growth' (2016) argues 1870–1970 innovations were uniquely transformative; Brynjolfsson-Mitchell push back." },
      { name: "Secular stagnation hypothesis", description: "Chronically weak demand.", usedFor: ["puzzles", "macro", "contested"], problem: "Are advanced economies stuck with low rates and weak demand?", keyInsight: "Summers, Eggertsson: aging, inequality, and savings glut push r* down; could justify persistent stimulus.", example: "2010s low rates were cited as evidence; 2022–24 inflation and rate normalization complicate but don't resolve the debate." },
      { name: "Optimal-currency-area criteria", description: "When to share a currency.", usedFor: ["theory", "trade"], problem: "Should countries adopt a common currency?", keyInsight: "Mundell: synchronized cycles, factor mobility, fiscal transfers — eurozone struggled on the second and third.", example: "Eurozone crisis (2010–12) revealed OCA-criteria gaps; reforms (banking union, ESM) addressed some but not all." },
      { name: "Phillips curve flatness debate", description: "Has the trade-off died?", usedFor: ["contested", "monetary"], problem: "Is the inflation-unemployment slope flat or hidden?", keyInsight: "2010s: appeared near-zero; 2021–22 inflation suggested non-linearity; status remains contested.", example: "Williams (2019) argued the curve was flat; subsequent inflation surprised the consensus and re-opened the debate." },
      { name: "Minimum wage debate", description: "Disemployment or not.", usedFor: ["contested", "labor"], problem: "Does a moderate minimum-wage hike reduce employment?", keyInsight: "modern empirical literature finds small effects at observed levels; effects of very large hikes ($15→$20+) remain contested.", example: "Card-Krueger (1994), Dube-Lester-Reich (2010), Cengiz et al. (2019) — and ongoing California/Seattle studies — frame the live debate." },
      { name: "MMT vs mainstream", description: "Fiscal constraints debate.", usedFor: ["contested", "monetary"], problem: "Are sovereign-currency governments financially unconstrained?", keyInsight: "MMT: limited only by inflation; mainstream: yes in principle but with strict practical limits and risk premia at high debt.", example: "2021–22 inflation following large US fiscal expansion is cited by both sides — MMT proponents see fiscal-supply mismatch, critics see vindication of standard limits." },
      { name: "Austerity debate (R&R)", description: "Does debt slow growth at 90%?", usedFor: ["contested", "fiscal"], problem: "Is there a debt/GDP threshold above which growth collapses?", keyInsight: "Reinhart-Rogoff (2010) said yes near 90%; Herndon-Ash-Pollin (2013) showed coding error; consensus: no sharp threshold.", example: "The R&R episode is a touchstone for reproducibility and policy-relevant empirical fragility — the original claim heavily influenced 2010s austerity debates." },
      { name: "Optimal capital-tax debate", description: "Tax wealth or income?", usedFor: ["contested", "fiscal"], problem: "What's the optimal tax rate on capital?", keyInsight: "Chamley-Judd: zero in steady state under strong assumptions; Piketty and others argue for high wealth/capital taxes given inequality.", example: "Piketty's 'Capital in the Twenty-First Century' (2014) revived the debate; modern optimal-tax literature finds non-zero rates under realistic assumptions." },
      { name: "Top-income inequality", description: "Why the rich pulled away.", usedFor: ["inequality"], problem: "What explains rising top income shares since 1980?", keyInsight: "globalization, technology, top-end tax cuts, finance and CEO pay, capital-share dynamics — likely all contribute.", example: "Piketty-Saez top-income shares document the rise; Auten-Splinter critiques recalibrate but don't reverse the trend." },
      { name: "Optimal monetary policy at ZLB", description: "Make-up strategies.", usedFor: ["open", "monetary"], problem: "How should central banks respond to chronically low natural rates?", keyInsight: "average inflation targeting, price-level targeting, and higher inflation targets are all proposals; consensus elusive.", example: "Fed's 2020 FAIT framework was one response; 2025 framework review (verify date) revisited it after the post-COVID inflation episode." },
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

export default function EconomicsPage() {
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
        <h1 className="text-2xl font-semibold text-white">Economics — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to economic ideas organized by family. Each card describes one concept,
          model, or result, what it&apos;s used for, and links to claims on Epistemic Receipts
          that touch on it. Click any card for a textbook-style expansion: the problem the idea
          answers, the key insight (often with a formula or named theorem), and a concrete
          example. Color codes the family; clicking a header collapses its section.
        </p>
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">
          Cross-references to the{" "}
          <Link href="/finance" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">
            finance
          </Link>
          ,{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">
            statistics
          </Link>
          , and{" "}
          <Link href="/governance" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">
            governance
          </Link>{" "}
          taxonomies are noted where ideas overlap (e.g., Modigliani-Miller, econometric methods,
          fiscal and monetary policy).
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {FAMILIES.length} families · {totalMethods} ideas
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
          placeholder="Filter by name, description, insight, or tag — e.g. 'inflation', 'trade', 'Nobel'"
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
          No ideas match &ldquo;{query}&rdquo;. Try a broader term.
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
                      {family.methods.length} {family.methods.length === 1 ? "idea" : "ideas"}
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
          a free-text search over claim and source text. A concept appearing in a claim does not mean
          the claim is <em>about</em> that concept — only that the term is present. Cross-references to{" "}
          <Link href="/finance" className="text-gray-400 hover:text-gray-300 underline underline-offset-2">finance</Link>,{" "}
          <Link href="/statistics" className="text-gray-400 hover:text-gray-300 underline underline-offset-2">statistics</Link>, and{" "}
          <Link href="/governance" className="text-gray-400 hover:text-gray-300 underline underline-offset-2">governance</Link>{" "}
          taxonomies are marked with &ldquo;xref:&rdquo; tags. Volatile facts (current Nobel laureates,
          policy rates, NBER recession dating) are noted &ldquo;verify at build time&rdquo;.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated June 4, 2026 · {FAMILIES.length} families · {totalMethods} ideas
        </p>
      </div>
    </div>
  );
}
