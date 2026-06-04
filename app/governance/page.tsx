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
    slug: "foundations-theories",
    name: "Foundations & Theories of Governance",
    blurb: "The conceptual bedrock — what governance is and why it exists.",
    color: "teal",
    methods: [
      {
        name: "Governance vs government",
        description: "The scope of the concept.",
        usedFor: ["foundations"],
        problem: "Is governance the same as government, or something broader?",
        keyInsight: "Governance is the broader process of steering collective action through rules, norms, and actors — with or without a formal government.",
        example: "The internet has no government, but it has governance: ICANN, the IETF, and private platforms all steer behavior through overlapping rule systems.",
      },
      {
        name: "Principal-agent problem",
        description: "The core governance tension.",
        usedFor: ["theory", "agency"],
        problem: "Why do agents (managers, officials) sometimes act against the interests of those they serve?",
        keyInsight: "When an agent acts for a principal under information asymmetry and diverging interests, it may not act in the principal's interest, creating agency costs.",
        example: "Shareholders (principal) hire a CEO (agent) who may prioritize empire-building over profit. The board exists to monitor this gap.",
      },
      {
        name: "Agency theory",
        description: "Governance as control of agents.",
        usedFor: ["theory"],
        problem: "How do you design systems so agents act for principals?",
        keyInsight: "Design monitoring and incentives so agents (managers, officials) act for principals (owners, citizens).",
        example: "Executive stock options align CEO interests with shareholders — the agent profits when the principal profits.",
      },
      {
        name: "Stewardship theory",
        description: "The counterpoint to agency.",
        usedFor: ["theory"],
        problem: "Is the principal-agent view too cynical?",
        keyInsight: "Agents are often intrinsically motivated stewards, so empowerment can outperform tight control.",
        example: "A mission-driven nonprofit director may serve the cause better with autonomy than under micromanagement — stewardship over agency.",
      },
      {
        name: "Transaction cost economics",
        description: "Why structures exist.",
        usedFor: ["theory"],
        problem: "Why do firms and hierarchies exist instead of pure markets?",
        keyInsight: "Hierarchies, firms, and contracts arise to economize on the costs of transacting (Williamson).",
        example: "A car company makes its own engines rather than contracting for each one because the transaction costs of constant bargaining exceed the cost of integration.",
      },
      {
        name: "Institutionalism",
        description: "Rules shape behavior.",
        usedFor: ["theory"],
        problem: "Why do countries with similar resources have such different outcomes?",
        keyInsight: "Institutions — the formal and informal rules of the game — structure incentives and persist over time (North).",
        example: "North vs. South Korea: same culture, different institutions. Property rights and rule of law (or their absence) explain the divergence.",
      },
      {
        name: "Public choice theory",
        description: "Self-interest in the public sphere.",
        usedFor: ["theory"],
        problem: "Do public officials act for the public good?",
        keyInsight: "Modeling voters, politicians, and bureaucrats as self-interested explains rent-seeking and government failure.",
        example: "A concentrated industry lobbies for a tariff that harms diffuse consumers — the gains are concentrated, the losses dispersed (Olson).",
      },
      {
        name: "Collective action problem",
        description: "Why cooperation is hard.",
        usedFor: ["theory"],
        problem: "Why do groups fail to act in their collective interest?",
        keyInsight: "Individually rational free-riding can produce collectively bad outcomes; governance supplies the missing coordination (Olson).",
        example: "Each fisherman overfishes because the cost is shared but the benefit is private. The fishery collapses unless governance limits catches.",
      },
      {
        name: "Tragedy of the commons",
        description: "Shared resources get depleted.",
        usedFor: ["commons"],
        problem: "Why are common-pool resources overused?",
        keyInsight: "Unmanaged common-pool resources are over-used because benefits are private but costs are shared (Hardin).",
        example: "Open-access grazing land is overgrazed to ruin. Privatization, regulation, or community self-governance can prevent it.",
      },
      {
        name: "Polycentric governance",
        description: "Many overlapping centers.",
        usedFor: ["theory"],
        problem: "Does governance require a single authority?",
        keyInsight: "Multiple semi-autonomous decision centers can govern shared problems better than one central authority (Ostrom).",
        example: "California water: federal, state, local, and private entities all govern portions, and the overlapping system often outperforms pure centralization.",
      },
    ],
  },
  // ── FUNCTIONS (amber/orange) ────────────────────────────────────────────────
  {
    slug: "structures-architectures",
    name: "Structures & Architectures of Authority",
    blurb: "How power is organized — centralized or diffused, layered or flat.",
    color: "amber",
    methods: [
      {
        name: "Centralization vs decentralization",
        description: "Where authority sits.",
        usedFor: ["structure"],
        problem: "Should decisions be made at the center or at the periphery?",
        keyInsight: "A trade-off between coordination and consistency (central) versus responsiveness and local knowledge (decentralized).",
        example: "A global company centralizes brand standards but decentralizes pricing — consistency where it matters, flexibility where local knowledge wins.",
      },
      {
        name: "Hierarchy",
        description: "Authority by tiers.",
        usedFor: ["structure"],
        problem: "How do large organizations coordinate at scale?",
        keyInsight: "Decision rights flow top-down through ranked layers — strong for control, weak for local adaptation.",
        example: "The military: clear chain of command enables rapid, coordinated action, but junior officers have little discretion.",
      },
      {
        name: "Separation of powers",
        description: "Divide to check.",
        usedFor: ["structure", "political"],
        problem: "How do you prevent any one actor from dominating?",
        keyInsight: "Splitting legislative, executive, and judicial functions prevents the concentration of power (Montesquieu).",
        example: "The U.S. Constitution: Congress makes law, the President executes, the courts interpret — each checks the others.",
      },
      {
        name: "Federalism & devolution",
        description: "Layered sovereignty.",
        usedFor: ["structure", "political"],
        problem: "How do you balance national unity with regional diversity?",
        keyInsight: "Authority is divided between central and regional units, each supreme in its sphere.",
        example: "U.S. federalism: states set education policy, the federal government sets immigration policy — neither can override the other in its domain.",
      },
      {
        name: "Subsidiarity",
        description: "Decide at the lowest effective level.",
        usedFor: ["structure"],
        problem: "At what level should a decision be made?",
        keyInsight: "Handle matters at the smallest competent authority, escalating only when necessary.",
        example: "EU subsidiarity: Brussels sets single-market rules, but member states govern schools — only escalate what local governance can't handle.",
      },
      {
        name: "Boards & committees",
        description: "Collective oversight bodies.",
        usedFor: ["structure", "corporate"],
        problem: "Why govern by group rather than individual?",
        keyInsight: "A group holds decision/oversight authority, diffusing power and pooling expertise.",
        example: "A corporate board: no single director controls, and diverse expertise (finance, law, operations) informs collective judgment.",
      },
      {
        name: "Networks as governance",
        description: "Coordination without a boss.",
        usedFor: ["structure"],
        problem: "Can you coordinate complex activity without hierarchy?",
        keyInsight: "Autonomous actors coordinate through ongoing relationships and mutual dependence, not commands.",
        example: "Open-source software: no boss, but maintainers, contributors, and users coordinate through norms, reputation, and shared protocols.",
      },
      {
        name: "Markets as governance",
        description: "Coordination by price.",
        usedFor: ["structure"],
        problem: "Is the price system a form of governance?",
        keyInsight: "Decentralized exchange coordinates behavior via prices and competition — an alternative to hierarchy.",
        example: "No one plans how many coffees New York needs; prices coordinate supply and demand. The market governs without a governor.",
      },
      {
        name: "Bicameralism",
        description: "Two-chamber legislatures.",
        usedFor: ["structure", "political"],
        problem: "Why have two legislative houses?",
        keyInsight: "A second chamber adds a veto point and review, moderating legislation.",
        example: "The U.S. Senate (states) and House (population) represent different interests; both must agree for law to pass — a structural check.",
      },
      {
        name: "Iron law of oligarchy",
        description: "Drift toward rule by few.",
        usedFor: ["structure"],
        problem: "Do democratic organizations stay democratic?",
        keyInsight: "Even democratic organizations tend to concentrate power in a small leadership over time (Michels).",
        example: "A labor union starts egalitarian, but over decades its leadership becomes entrenched, self-perpetuating, and detached from members.",
      },
    ],
  },
  {
    slug: "decision-making",
    name: "Decision-Making & Collective Choice",
    blurb: "How groups decide — voting rules, aggregation, and the paradoxes that haunt them.",
    color: "orange",
    methods: [
      {
        name: "Majority rule",
        description: "More than half decides.",
        usedFor: ["voting"],
        problem: "What's the simplest legitimate way for a group to decide?",
        keyInsight: "Simple and decisive, but can override intense minority preferences.",
        example: "A town votes 51-49 to build a park. The 49% who wanted a library are outvoted — majority rule is decisive but not necessarily fair to minorities.",
      },
      {
        name: "Supermajority & unanimity",
        description: "Higher thresholds.",
        usedFor: ["voting"],
        problem: "When should a bare majority not be enough?",
        keyInsight: "Raising the bar protects the status quo and minorities at the cost of decisiveness.",
        example: "Amending the U.S. Constitution requires 2/3 of Congress and 3/4 of states — the high bar protects against transient majorities.",
      },
      {
        name: "Plurality / first-past-the-post",
        description: "Most votes wins.",
        usedFor: ["voting", "electoral"],
        problem: "What if no option has a majority?",
        keyInsight: "The top vote-getter wins without needing a majority — can elect broadly unpopular winners.",
        example: "In a three-way race, a candidate wins with 35% — the 65% who preferred someone else are unrepresented.",
      },
      {
        name: "Proportional representation",
        description: "Seats track votes.",
        usedFor: ["voting", "electoral"],
        problem: "How do you ensure minority views get representation?",
        keyInsight: "Allocate seats in proportion to vote share — more representative, often less decisive.",
        example: "A party with 20% of votes gets 20% of seats. Coalitions are common, and small parties matter — unlike winner-take-all systems.",
      },
      {
        name: "Ranked-choice / instant runoff",
        description: "Rank, then redistribute.",
        usedFor: ["voting", "electoral"],
        problem: "Can you avoid spoiler effects and find a majority winner?",
        keyInsight: "Eliminate the lowest and transfer votes until someone holds a majority.",
        example: "Voters rank candidates 1-2-3. The last-place candidate is eliminated and their votes redistributed — repeat until one has a majority.",
      },
      {
        name: "Condorcet methods",
        description: "Beat all rivals pairwise.",
        usedFor: ["social choice"],
        problem: "Is there a candidate who would win every head-to-head matchup?",
        keyInsight: "A Condorcet winner beats every option head-to-head — but may not exist (the paradox: A beats B beats C beats A).",
        example: "In pairwise votes, Alice beats Bob, Bob beats Carol, but Carol beats Alice — no Condorcet winner exists, the cycle reveals collective irrationality.",
      },
      {
        name: "Arrow's impossibility theorem",
        description: "No perfect voting rule.",
        usedFor: ["social choice"],
        problem: "Is there a fair way to aggregate preferences?",
        keyInsight: "With 3+ options, no ranked method satisfies unrestricted domain, Pareto, independence of irrelevant alternatives, and non-dictatorship simultaneously.",
        example: "Arrow proved every voting system is flawed in some way — there is no perfect aggregation, only trade-offs.",
      },
      {
        name: "Median voter theorem",
        description: "The middle decides.",
        usedFor: ["social choice"],
        problem: "Why do candidates converge to the center?",
        keyInsight: "Under single-peaked preferences and majority rule, the outcome matches the median voter's ideal point.",
        example: "Two parties competing for votes converge toward the median voter's position — extremists lose elections in two-party systems.",
      },
      {
        name: "Consensus & deliberation",
        description: "Decide by discussion.",
        usedFor: ["decision process"],
        problem: "Can groups decide without voting?",
        keyInsight: "Seek broad agreement through reasoned exchange rather than aggregation — legitimacy-rich but slow.",
        example: "A Quaker meeting continues discussion until all assent. Slow, but the outcome reflects collective judgment rather than majority imposition.",
      },
      {
        name: "Delegation",
        description: "Hand decisions to agents.",
        usedFor: ["decision process"],
        problem: "What if the group is too large or the issue too technical?",
        keyInsight: "Assign decisions to specialists or lower levels to manage scale — which reintroduces the principal-agent problem.",
        example: "Congress delegates rule-making to the EPA. Expertise is gained, but now Congress must monitor an agent with its own interests.",
      },
    ],
  },
  {
    slug: "accountability-oversight",
    name: "Accountability & Oversight",
    blurb: "Holding power-holders to account — the mechanisms of answerability and sanction.",
    color: "amber",
    methods: [
      {
        name: "Vertical vs horizontal accountability",
        description: "Two directions.",
        usedFor: ["accountability"],
        problem: "To whom are power-holders accountable?",
        keyInsight: "Vertical = answerable to those below (voters, shareholders); horizontal = checked by peer institutions (courts, auditors).",
        example: "A president faces voters (vertical) and courts (horizontal). Both constrain, but in different ways.",
      },
      {
        name: "Answerability & sanction",
        description: "The two elements.",
        usedFor: ["accountability"],
        problem: "What makes accountability real?",
        keyInsight: "Accountability needs both an obligation to explain and real consequences for failure.",
        example: "A CEO must explain losses to the board (answerability) and can be fired if the explanation fails (sanction). Without both, accountability is hollow.",
      },
      {
        name: "Checks and balances",
        description: "Mutual constraint.",
        usedFor: ["oversight"],
        problem: "How do you prevent any one branch from dominating?",
        keyInsight: "Each body can limit the others, so none acts unchecked.",
        example: "Congress passes a law, the President vetoes, Congress overrides, the Supreme Court strikes it down — each checks the others.",
      },
      {
        name: "Audit",
        description: "Independent verification.",
        usedFor: ["oversight"],
        problem: "How do you verify that rules are being followed?",
        keyInsight: "An independent party examines conduct/records against standards and reports findings.",
        example: "An external auditor reviews a company's financials and issues an opinion — investors rely on the auditor's independence.",
      },
      {
        name: "Ombudsman",
        description: "A complaint channel.",
        usedFor: ["oversight"],
        problem: "How do citizens get redress when institutions fail them?",
        keyInsight: "An independent office investigates grievances against institutions and recommends redress.",
        example: "A citizen complains to the parliamentary ombudsman that a tax agency was unfair. The ombudsman investigates and can recommend corrective action.",
      },
      {
        name: "Legislative scrutiny",
        description: "Watching the executive.",
        usedFor: ["oversight", "political"],
        problem: "How does the legislature hold the executive accountable between elections?",
        keyInsight: "Hearings, questions, and committees hold the executive to account between elections.",
        example: "A parliamentary committee summons a minister to explain a policy failure. The minister must answer publicly.",
      },
      {
        name: "Internal oversight (inspector general)",
        description: "Watchdogs within.",
        usedFor: ["oversight"],
        problem: "Can organizations police themselves?",
        keyInsight: "An internal-but-independent unit audits and investigates its own organization.",
        example: "The Department of Justice Inspector General investigates misconduct within DOJ — internal but insulated from political interference.",
      },
      {
        name: "Performance monitoring",
        description: "Track against targets.",
        usedFor: ["accountability"],
        problem: "How do you know if an organization is delivering?",
        keyInsight: "Measure outputs and outcomes against objectives to surface underperformance.",
        example: "A school district tracks graduation rates against targets. Persistent underperformance triggers intervention.",
      },
      {
        name: "Term limits & rotation",
        description: "Bounded tenure.",
        usedFor: ["accountability"],
        problem: "How do you prevent entrenchment?",
        keyInsight: "Capping time in office curbs entrenchment and forces renewal.",
        example: "U.S. presidents are limited to two terms. The rule prevents indefinite rule and ensures fresh leadership.",
      },
      {
        name: "Recall & removal",
        description: "Ejecting power-holders.",
        usedFor: ["accountability", "political"],
        problem: "What if an official must go before their term ends?",
        keyInsight: "Impeachment, recall, and no-confidence votes remove officials before term's end.",
        example: "A California governor faces a recall election after voter petition. The electorate can remove before the term expires.",
      },
    ],
  },
  {
    slug: "transparency-disclosure",
    name: "Transparency & Disclosure",
    blurb: "Making the invisible visible — the mechanics of public information.",
    color: "orange",
    methods: [
      {
        name: "Transparency",
        description: "Visibility of decisions and process.",
        usedFor: ["transparency"],
        problem: "Why does governance need to be visible?",
        keyInsight: "Observable conduct enables monitoring — a means to accountability, not an end in itself.",
        example: "A city council that meets in public can be monitored by journalists and voters. Secrecy invites abuse.",
      },
      {
        name: "Disclosure regimes",
        description: "Mandated information release.",
        usedFor: ["disclosure"],
        problem: "How do you ensure relevant information gets out?",
        keyInsight: "Require actors to publish specified information (financials, conflicts, lobbying) on a schedule.",
        example: "Public companies must file quarterly reports (10-Q) disclosing financials. Investors can then price the stock.",
      },
      {
        name: "Freedom of information",
        description: "A right to ask.",
        usedFor: ["transparency", "political"],
        problem: "Can citizens access government records?",
        keyInsight: "Citizens can request public records, subject to defined exemptions.",
        example: "A journalist files a FOIA request for emails about a policy decision. The agency must release, redacting only exempt material.",
      },
      {
        name: "Open data",
        description: "Machine-readable public information.",
        usedFor: ["transparency"],
        problem: "How do you make disclosed information usable?",
        keyInsight: "Publishing reusable datasets enables external scrutiny and reuse.",
        example: "A city publishes bus arrival times as open data. Developers build apps; researchers study transit equity.",
      },
      {
        name: "Whistleblower protection",
        description: "Shielding insiders who report.",
        usedFor: ["transparency"],
        problem: "How do you get wrongdoing reported from inside?",
        keyInsight: "Protection from retaliation encourages the disclosure of wrongdoing.",
        example: "An SEC whistleblower reports securities fraud and receives a share of the fine. The law protects against employer retaliation.",
      },
      {
        name: "Conflict-of-interest disclosure",
        description: "Surface divided loyalties.",
        usedFor: ["disclosure"],
        problem: "How do you know if a decision-maker has a personal stake?",
        keyInsight: "Require declaration of interests that could bias decisions, enabling recusal.",
        example: "A judge must disclose stock holdings; if she owns Pfizer stock, she cannot hear a Pfizer case.",
      },
      {
        name: "Beneficial ownership transparency",
        description: "Who really owns it.",
        usedFor: ["disclosure"],
        problem: "How do you trace money through shell companies?",
        keyInsight: "Reveal the natural persons behind entities to deter illicit finance.",
        example: "The Corporate Transparency Act requires companies to report beneficial owners to FinCEN — no more anonymous shells.",
      },
      {
        name: "Reporting standards",
        description: "Comparable disclosure.",
        usedFor: ["disclosure"],
        problem: "How do you compare disclosures across entities?",
        keyInsight: "Standardized formats make disclosures comparable and verifiable.",
        example: "GAAP and IFRS standardize financial reporting. An investor can compare a U.S. and a European company on the same terms.",
      },
      {
        name: "Open meetings (sunshine rules)",
        description: "Deliberate in public.",
        usedFor: ["transparency", "political"],
        problem: "Should government bodies deliberate in secret?",
        keyInsight: "Require public bodies to meet and vote in the open.",
        example: "The Government in the Sunshine Act requires federal agencies to meet publicly. Citizens can observe and press can report.",
      },
      {
        name: "Explainability requirements",
        description: "Visible reasoning.",
        usedFor: ["transparency", "AI"],
        problem: "How do you justify a decision to those affected?",
        keyInsight: "Require consequential decisions, including algorithmic ones, to come with intelligible justifications.",
        example: "GDPR Article 22: if you're denied a loan by an algorithm, you can demand an explanation of the logic involved.",
      },
    ],
  },
  {
    slug: "rules-law",
    name: "Rules, Law & Regulatory Instruments",
    blurb: "The tools of steering — from statutes to nudges.",
    color: "amber",
    methods: [
      {
        name: "Hard law",
        description: "Binding, enforceable rules.",
        usedFor: ["instruments"],
        problem: "What gives a rule binding force?",
        keyInsight: "Statutes and regulations carry legal force and state-backed sanctions.",
        example: "The Clean Air Act mandates emission limits. Violators face fines, injunctions, and criminal penalties.",
      },
      {
        name: "Soft law",
        description: "Non-binding norms.",
        usedFor: ["instruments"],
        problem: "Can rules work without legal enforcement?",
        keyInsight: "Guidelines and codes shape behavior through expectation and reputation, not legal compulsion.",
        example: "The UN Global Compact is soft law: companies commit voluntarily, and the sanction for breach is reputational, not legal.",
      },
      {
        name: "Command-and-control regulation",
        description: "Mandate and enforce.",
        usedFor: ["regulation"],
        problem: "What's the most direct way to regulate?",
        keyInsight: "Prescribe conduct and penalize deviation — certain but rigid.",
        example: "A regulation mandates scrubbers on power plants. No flexibility, but certainty: install the scrubber or face shutdown.",
      },
      {
        name: "Market-based instruments",
        description: "Price the behavior.",
        usedFor: ["regulation"],
        problem: "Can you regulate without prescribing specific conduct?",
        keyInsight: "Taxes, tradable permits, and subsidies steer behavior via incentives rather than mandates.",
        example: "A carbon tax prices emissions; firms choose how to reduce. Efficient, but politically hard to set the right price.",
      },
      {
        name: "Principles- vs rules-based regulation",
        description: "How prescriptive?",
        usedFor: ["regulation"],
        problem: "Should rules be bright-line or flexible?",
        keyInsight: "Bright-line rules give certainty but invite gaming; principles flex but are less predictable.",
        example: "A speed limit (rule) vs. 'drive safely' (principle). Rules are enforceable; principles require judgment and invite disputes.",
      },
      {
        name: "Self-regulation",
        description: "Industry governs itself.",
        usedFor: ["regulation"],
        problem: "Can an industry regulate itself?",
        keyInsight: "A sector sets and enforces its own standards — low cost, but conflicts of interest.",
        example: "The advertising industry's self-regulatory codes. Fast and cheap, but the fox guards the henhouse.",
      },
      {
        name: "Co-regulation",
        description: "Shared public-private rule-making.",
        usedFor: ["regulation"],
        problem: "Can you combine public authority with industry expertise?",
        keyInsight: "Government sets objectives; industry develops and administers the details.",
        example: "EU product-safety directives set outcomes; industry develops the technical standards (via CEN/CENELEC) that satisfy them.",
      },
      {
        name: "Codes of conduct",
        description: "Stated behavioral standards.",
        usedFor: ["instruments", "corporate"],
        problem: "How do you articulate expected behavior?",
        keyInsight: "Articulate expected behavior, often comply-or-explain rather than mandatory.",
        example: "The UK Corporate Governance Code: companies must follow or explain why not. The market judges the explanation.",
      },
      {
        name: "Constitutions",
        description: "Foundational rules.",
        usedFor: ["instruments", "political"],
        problem: "What rules govern the rule-makers?",
        keyInsight: "The supreme rules that constitute and constrain government, deliberately hard to amend.",
        example: "The U.S. Constitution is the supreme law. Ordinary legislation that conflicts is void — the constitution constrains the legislature.",
      },
      {
        name: "Contracts",
        description: "Private governance.",
        usedFor: ["instruments"],
        problem: "Can parties govern themselves?",
        keyInsight: "Parties create tailored, binding rules between themselves, enforced by courts.",
        example: "A supply contract specifies quality standards, delivery, and penalties. The parties govern their relationship; courts enforce the bargain.",
      },
    ],
  },
  {
    slug: "legitimacy-rule-of-law",
    name: "Legitimacy, Authority & Rule of Law",
    blurb: "Why people obey — the sources of legitimate authority and the rule of law.",
    color: "orange",
    methods: [
      {
        name: "Sources of legitimate authority",
        description: "Why people comply.",
        usedFor: ["legitimacy"],
        problem: "What makes people accept a ruler's commands?",
        keyInsight: "Weber's three types — traditional, charismatic, and legal-rational authority.",
        example: "A king rules by tradition, a revolutionary by charisma, a bureaucrat by legal procedure. Each claims legitimacy differently.",
      },
      {
        name: "Rule of law",
        description: "No one above the law.",
        usedFor: ["rule of law"],
        problem: "What distinguishes law from arbitrary command?",
        keyInsight: "Power is exercised through known, general, prospective laws applied equally — not arbitrary will.",
        example: "A leader cannot punish an enemy retroactively. The law must be announced in advance and applied to all, including the powerful.",
      },
      {
        name: "Constitutionalism",
        description: "Limited, rule-bound government.",
        usedFor: ["rule of law", "political"],
        problem: "How do you constrain those who make the law?",
        keyInsight: "Government power is defined and constrained by a higher law.",
        example: "A legislature cannot pass a law violating free speech because the constitution forbids it. The constitution constrains even the lawmakers.",
      },
      {
        name: "Due process",
        description: "Fair procedure.",
        usedFor: ["rule of law"],
        problem: "What procedures must the state follow before depriving someone of rights?",
        keyInsight: "The state must follow fair, predictable procedures before depriving anyone of rights.",
        example: "Before the government takes your property, you must get notice and a hearing. Summary action violates due process.",
      },
      {
        name: "Judicial independence",
        description: "Courts free from pressure.",
        usedFor: ["rule of law"],
        problem: "How do you keep courts impartial?",
        keyInsight: "Insulating judges from political and financial influence lets law credibly constrain power.",
        example: "Lifetime tenure for federal judges: they cannot be fired for unpopular rulings, so they can rule against the government.",
      },
      {
        name: "Consent of the governed",
        description: "Authority from the people.",
        usedFor: ["legitimacy", "political"],
        problem: "Where does governmental authority come from?",
        keyInsight: "Legitimate authority derives from those subject to it (social-contract tradition).",
        example: "Democratic elections operationalize consent: the government rules because citizens have chosen it.",
      },
      {
        name: "Input vs output legitimacy",
        description: "Two ways to earn it.",
        usedFor: ["legitimacy"],
        problem: "Is legitimacy about how you decide or what you deliver?",
        keyInsight: "Legitimacy can flow from participatory process (input) or from effective results (output).",
        example: "An unelected central bank has weak input legitimacy but strong output legitimacy if it delivers stable prices.",
      },
      {
        name: "Procedural vs substantive legitimacy",
        description: "Fair how?",
        usedFor: ["legitimacy"],
        problem: "Is fairness about the process or the outcome?",
        keyInsight: "Fairness of the process versus fairness of the outcome — both can be demanded.",
        example: "A lottery is procedurally fair (everyone has equal chance), but substantively unfair if the prize goes to someone who doesn't need it.",
      },
      {
        name: "Separation of law and politics",
        description: "Bounded domains.",
        usedFor: ["rule of law"],
        problem: "Should courts be involved in political questions?",
        keyInsight: "Keeping adjudication distinct from political contestation protects impartiality.",
        example: "Courts decide legal questions; the political branches decide policy. When courts wade into policy, they lose legitimacy.",
      },
      {
        name: "Accountability of the rule-makers",
        description: "Who guards the guardians.",
        usedFor: ["rule of law"],
        problem: "Are legislators above the law they make?",
        keyInsight: "Those who make and enforce rules must themselves be bound and answerable.",
        example: "The Ethics in Government Act subjects members of Congress to ethics rules and financial disclosure — the lawmakers are not exempt.",
      },
    ],
  },
  {
    slug: "incentives-compliance",
    name: "Incentives, Compliance & Enforcement",
    blurb: "Making rules stick — carrots, sticks, and the psychology of compliance.",
    color: "amber",
    methods: [
      {
        name: "Incentive alignment",
        description: "Make the right thing the easy thing.",
        usedFor: ["incentives"],
        problem: "How do you get people to act in the collective interest?",
        keyInsight: "Structure rewards and penalties so self-interest serves the governance objective.",
        example: "A deposit on bottles: return the bottle and get your money back. Self-interest aligns with recycling.",
      },
      {
        name: "Executive compensation",
        description: "Pay as a lever.",
        usedFor: ["incentives", "corporate", "xref:finance"],
        problem: "How do you align CEO pay with shareholder value?",
        keyInsight: "Tie pay to performance to align managers with owners — but watch for gaming and short-termism.",
        example: "Stock options give CEOs upside when the stock rises. But if options vest quickly, the CEO may pump short-term results at long-term cost.",
      },
      {
        name: "Carrots vs sticks",
        description: "Reward or punish.",
        usedFor: ["incentives"],
        problem: "Should you reward good behavior or punish bad?",
        keyInsight: "Positive incentives build buy-in; sanctions deter, but over-reliance can crowd out intrinsic motivation.",
        example: "A tax credit for solar panels (carrot) vs. a fine for pollution (stick). Carrots invite; sticks deter.",
      },
      {
        name: "Enforcement & sanctions",
        description: "Consequences for breach.",
        usedFor: ["compliance"],
        problem: "What makes a rule binding?",
        keyInsight: "Credible, proportionate penalties make rules binding.",
        example: "A parking fine must be high enough to deter but not so high as to seem unjust. Credibility and proportionality matter.",
      },
      {
        name: "Compliance programs",
        description: "Build rule-following in.",
        usedFor: ["compliance"],
        problem: "How do organizations internalize external requirements?",
        keyInsight: "Policies, training, monitoring, and reporting operationalize legal and ethical requirements.",
        example: "An anti-bribery compliance program: written policy, training, hotline, audits. The organization builds rule-following into its operations.",
      },
      {
        name: "Monitoring & detection",
        description: "Catch violations.",
        usedFor: ["compliance"],
        problem: "How do you know if rules are being broken?",
        keyInsight: "Raising the probability of detection is the key deterrence lever.",
        example: "Random tax audits: even if the penalty is modest, high detection probability deters cheating.",
      },
      {
        name: "Reputation & social sanction",
        description: "Informal enforcement.",
        usedFor: ["incentives"],
        problem: "Can social pressure substitute for legal enforcement?",
        keyInsight: "Loss of standing disciplines behavior where formal sanctions can't reach.",
        example: "A company caught in a scandal loses customers and partners. Reputation is a powerful, decentralized enforcement mechanism.",
      },
      {
        name: "Nudges & choice architecture",
        description: "Steer without mandating.",
        usedFor: ["incentives"],
        problem: "Can you change behavior without rules?",
        keyInsight: "Shaping defaults and framing changes behavior while preserving free choice.",
        example: "Opt-out organ donation: the default is donor, but you can opt out. Most people stick with the default, so donation rates soar.",
      },
      {
        name: "Conflicts of interest",
        description: "Misaligned incentives.",
        usedFor: ["compliance"],
        problem: "When can personal interest corrupt official duty?",
        keyInsight: "A private interest that could improperly sway a duty; managed by disclosure, recusal, or prohibition.",
        example: "A procurement officer owns stock in a bidder. The conflict must be disclosed and the officer recused — or the procurement is tainted.",
      },
      {
        name: "Regulatory capture",
        description: "The regulated control the regulator.",
        usedFor: ["compliance"],
        problem: "Do regulators always serve the public interest?",
        keyInsight: "Concentrated interests can co-opt oversight bodies to serve them rather than the public.",
        example: "The revolving door: regulators move to industry, then back. The industry they regulate shapes their careers, and the regulator softens.",
      },
    ],
  },
  {
    slug: "risk-control-assurance",
    name: "Risk, Control & Assurance",
    blurb: "Governing uncertainty — frameworks for risk, internal controls, and assurance.",
    color: "orange",
    methods: [
      {
        name: "Risk governance",
        description: "Owning risk at the top.",
        usedFor: ["risk"],
        problem: "Who is responsible for managing risk?",
        keyInsight: "Leadership sets the risk appetite and ensures risks are identified, owned, and managed.",
        example: "The board approves a risk-appetite statement: 'We accept operational risk up to X but have zero tolerance for compliance risk.' Management implements.",
      },
      {
        name: "Three lines of defense",
        description: "Layered control.",
        usedFor: ["risk", "control"],
        problem: "How do you organize risk management across an organization?",
        keyInsight: "Operational management owns risk (1st), risk/compliance oversees (2nd), internal audit assures independently (3rd).",
        example: "A trader owns the position's risk (1st line). The risk department sets limits (2nd). Internal audit checks both (3rd).",
      },
      {
        name: "Internal controls",
        description: "Process safeguards.",
        usedFor: ["control"],
        problem: "How do you prevent errors and fraud in routine operations?",
        keyInsight: "Approvals, reconciliations, and segregation of duties prevent and detect errors and fraud.",
        example: "Two signatures required on checks over $10,000. Segregation of duties: the person who writes checks cannot reconcile the bank statement.",
      },
      {
        name: "Enterprise risk management",
        description: "Risk, portfolio-wide.",
        usedFor: ["risk"],
        problem: "How do you see risk across the whole organization?",
        keyInsight: "Manage risks holistically across the organization rather than in silos (COSO).",
        example: "ERM rolls up operational, financial, strategic, and compliance risks into a single dashboard. The board sees the whole risk picture.",
      },
      {
        name: "Risk appetite & tolerance",
        description: "How much is acceptable.",
        usedFor: ["risk"],
        problem: "How much risk should an organization accept?",
        keyInsight: "An explicit statement of the risk the entity will accept pursuing its objectives.",
        example: "A bank's risk appetite: 'We will not exceed a 1-in-200-year loss on our loan book.' This drives capital allocation and limit-setting.",
      },
      {
        name: "Audit committee",
        description: "Board-level assurance.",
        usedFor: ["control", "corporate"],
        problem: "Who oversees the external audit and internal controls?",
        keyInsight: "An independent board subcommittee oversees reporting, controls, and the external audit.",
        example: "The audit committee hires the external auditor, reviews internal audit findings, and signs off on financials. Independence is key.",
      },
      {
        name: "Assurance",
        description: "Independent confidence.",
        usedFor: ["control"],
        problem: "How do stakeholders know governance is working?",
        keyInsight: "An objective evaluation giving stakeholders confidence that processes work as intended.",
        example: "An auditor's 'clean opinion' on financial statements gives investors confidence. The assurance function provides external validation.",
      },
      {
        name: "Segregation of duties",
        description: "No single point of abuse.",
        usedFor: ["control"],
        problem: "How do you prevent fraud by a single actor?",
        keyInsight: "Split incompatible functions (authorize, record, custody) across people.",
        example: "The person who approves payments cannot also be the one who releases funds. Collusion would be required to defraud.",
      },
      {
        name: "Crisis & continuity governance",
        description: "Govern the worst case.",
        usedFor: ["risk"],
        problem: "How do you govern when things go wrong?",
        keyInsight: "Pre-defined authority, escalation, and continuity plans for disruptions.",
        example: "A pandemic plan: who decides to close offices, who communicates, and how critical functions continue. The crisis governance structure is pre-authorized.",
      },
      {
        name: "Model risk management",
        description: "Govern the models.",
        usedFor: ["risk", "AI"],
        problem: "What if the models driving decisions are wrong?",
        keyInsight: "Validate, monitor, and control reliance on quantitative and AI models that drive decisions.",
        example: "A bank's credit-scoring model must be validated before use and monitored for drift. Model risk is a first-class governance concern.",
      },
    ],
  },
  // ── DOMAINS (indigo/violet) ─────────────────────────────────────────────────
  {
    slug: "corporate-governance",
    name: "Corporate Governance",
    blurb: "Governing the firm — boards, shareholders, and the separation of ownership and control.",
    color: "indigo",
    methods: [
      {
        name: "Board of directors",
        description: "The governing body.",
        usedFor: ["corporate"],
        problem: "Who oversees the managers who run the company?",
        keyInsight: "An elected board oversees management for shareholders; independence and composition matter.",
        example: "Apple's board includes outsiders (academics, former executives) who can challenge Tim Cook. Independence disciplines management.",
      },
      {
        name: "Fiduciary duty",
        description: "The director's obligation.",
        usedFor: ["corporate"],
        problem: "What does a director owe the company?",
        keyInsight: "Duties of care (diligence) and loyalty (no self-dealing) to the company and its owners.",
        example: "A director who steers a contract to his brother's company breaches the duty of loyalty. Self-dealing is prohibited.",
      },
      {
        name: "Business judgment rule",
        description: "Deference to good-faith calls.",
        usedFor: ["corporate"],
        problem: "When can shareholders sue directors for bad decisions?",
        keyInsight: "Courts won't second-guess informed, disinterested, good-faith board decisions.",
        example: "A board approves a failed merger. If they did their homework and had no conflicts, courts defer — even if the deal loses money.",
      },
      {
        name: "Shareholder vs stakeholder primacy",
        description: "Whom does the firm serve?",
        usedFor: ["corporate"],
        problem: "Should directors maximize shareholder value or balance all stakeholders?",
        keyInsight: "Maximize shareholder value versus balance all stakeholders — a foundational debate.",
        example: "Milton Friedman: the business of business is shareholder returns. Critics: firms should serve employees, communities, and the environment too.",
      },
      {
        name: "Agency costs of the firm",
        description: "Owner-manager conflict.",
        usedFor: ["corporate", "xref:finance"],
        problem: "What is the cost of separating ownership from control?",
        keyInsight: "Costs of managers pursuing their own interests, plus the cost of monitoring them (Jensen-Meckling).",
        example: "A CEO builds a lavish headquarters (empire-building). Shareholders bear the cost, plus the cost of the board's monitoring.",
      },
      {
        name: "Executive pay & say-on-pay",
        description: "Aligning the top.",
        usedFor: ["corporate"],
        problem: "Is CEO pay too high, and who decides?",
        keyInsight: "Performance-linked pay aligns managers with owners; shareholder votes on pay add a check.",
        example: "Say-on-pay: shareholders vote (non-binding) on executive compensation. A failed vote embarrasses the board and can trigger change.",
      },
      {
        name: "Shareholder rights & proxy voting",
        description: "Owner control levers.",
        usedFor: ["corporate"],
        problem: "How do dispersed owners influence the firm?",
        keyInsight: "Voting, proposals, and proxy contests let dispersed owners influence the firm.",
        example: "An activist hedge fund runs a proxy contest, soliciting votes to replace board members. Shareholders decide.",
      },
      {
        name: "Takeover defenses",
        description: "Resisting acquisition.",
        usedFor: ["corporate", "xref:finance"],
        problem: "Can a board block an acquisition?",
        keyInsight: "Poison pills and staggered boards can protect against raiders — or entrench management.",
        example: "A poison pill: if an acquirer buys >15% of shares, existing shareholders can buy more at a discount, diluting the raider. Takeover blocked.",
      },
      {
        name: "Dual-class shares",
        description: "Unequal votes.",
        usedFor: ["corporate"],
        problem: "Can founders keep control with a minority stake?",
        keyInsight: "Founders keep control via super-voting shares despite minority economic ownership.",
        example: "Mark Zuckerberg owns ~13% of Meta's equity but controls ~58% of votes via Class B shares. Founder control without majority ownership.",
      },
      {
        name: "Comply-or-explain",
        description: "Flexible codes.",
        usedFor: ["corporate"],
        problem: "Should governance codes be mandatory?",
        keyInsight: "Firms follow a governance code or publicly explain departures — market-disciplined soft law.",
        example: "The UK Code says boards should have a majority of independent directors. A firm that doesn't must explain — the market judges the explanation.",
      },
    ],
  },
  {
    slug: "political-constitutional",
    name: "Political & Constitutional Governance",
    blurb: "Governing states — regimes, branches, and the constitutional order.",
    color: "violet",
    methods: [
      {
        name: "Regime types",
        description: "How states are organized.",
        usedFor: ["political"],
        problem: "What distinguishes democracies from autocracies?",
        keyInsight: "A descriptive spectrum from democracy through hybrid regimes to autocracy, by how power is acquired and constrained.",
        example: "V-Dem scores countries on dimensions of democracy. Sweden is near the top; North Korea is at the bottom. Most countries are somewhere in between.",
      },
      {
        name: "Presidential vs parliamentary systems",
        description: "Where executive power lives.",
        usedFor: ["political"],
        problem: "Who heads the executive, and to whom are they accountable?",
        keyInsight: "A separately elected president versus an executive drawn from and accountable to the legislature.",
        example: "The U.S. president is elected separately from Congress; the UK prime minister is drawn from and accountable to Parliament.",
      },
      {
        name: "Electoral systems",
        description: "Translating votes to power.",
        usedFor: ["political", "electoral"],
        problem: "How do votes become seats?",
        keyInsight: "The rule (plurality, PR, mixed) strongly shapes party systems and representation.",
        example: "First-past-the-post tends to two-party systems (Duverger's law). PR allows many parties. The rule shapes the political landscape.",
      },
      {
        name: "Separation of powers",
        description: "The three branches.",
        usedFor: ["political"],
        problem: "How do you divide government functions?",
        keyInsight: "Legislative, executive, and judicial functions held by distinct bodies that check each other.",
        example: "Montesquieu's trias politica: the legislature makes law, the executive enforces, the judiciary interprets. Each checks the others.",
      },
      {
        name: "Federal vs unitary states",
        description: "Layers of government.",
        usedFor: ["political"],
        problem: "Is sovereignty divided or concentrated?",
        keyInsight: "Power divided across levels (federal) versus concentrated centrally (unitary).",
        example: "Germany is federal: Länder have real power. France is unitary: regions are administrative conveniences, not sovereigns.",
      },
      {
        name: "Judicial review",
        description: "Courts versus the other branches.",
        usedFor: ["political"],
        problem: "Can courts strike down laws?",
        keyInsight: "Courts can strike down laws and acts that violate the constitution.",
        example: "Marbury v. Madison (1803) established that the U.S. Supreme Court can void unconstitutional laws. Judicial review constrains the legislature.",
      },
      {
        name: "Constitutional amendment",
        description: "Changing the rules.",
        usedFor: ["political"],
        problem: "How do you change the foundational law?",
        keyInsight: "Deliberately high thresholds make foundational rules stable and hard to capture.",
        example: "Amending the U.S. Constitution requires 2/3 of Congress and 3/4 of states. The high bar protects against transient majorities.",
      },
      {
        name: "Civil service & bureaucracy",
        description: "The permanent state.",
        usedFor: ["political"],
        problem: "Who implements policy across political cycles?",
        keyInsight: "A merit-based professional administration implements policy across political cycles.",
        example: "The Pendleton Act (1883) created the U.S. civil service. Career officials stay across administrations, providing continuity and expertise.",
      },
      {
        name: "Checks on majoritarianism",
        description: "Protecting minorities.",
        usedFor: ["political"],
        problem: "How do you prevent the majority from oppressing the minority?",
        keyInsight: "Rights, courts, and supermajority rules limit what a transient majority can do.",
        example: "The Bill of Rights: even a supermajority cannot abolish free speech. Constitutional rights check majoritarian excess.",
      },
      {
        name: "Veto players",
        description: "Who can block.",
        usedFor: ["political"],
        problem: "How easy is it to change policy?",
        keyInsight: "The more actors whose agreement is required, the harder policy change becomes (Tsebelis).",
        example: "U.S. federal legislation requires House, Senate, and President. Three veto players — gridlock is the norm.",
      },
    ],
  },
  {
    slug: "public-administration",
    name: "Public Administration & Policy",
    blurb: "Governing the state's work — bureaucracies, policy cycles, and implementation.",
    color: "indigo",
    methods: [
      {
        name: "Weberian bureaucracy",
        description: "Rule-bound administration.",
        usedFor: ["public admin"],
        problem: "What makes administration predictable and fair?",
        keyInsight: "Hierarchy, written rules, merit, and impersonality make administration predictable and fair.",
        example: "A bureaucrat follows the manual: same procedure for everyone, no favoritism. Weber saw this as the most efficient form of organization.",
      },
      {
        name: "New public management",
        description: "Run government like a business.",
        usedFor: ["public admin"],
        problem: "Is bureaucracy too slow and unresponsive?",
        keyInsight: "Import competition, contracting, and performance metrics into the public sector.",
        example: "The UK's 'Next Steps' agencies: carve out executive agencies with clear targets and managerial autonomy. Performance, not process.",
      },
      {
        name: "The policy cycle",
        description: "Stages of policymaking.",
        usedFor: ["policy"],
        problem: "How does policy get made?",
        keyInsight: "Agenda-setting to formulation to adoption to implementation to evaluation (a simplifying model).",
        example: "A problem reaches the agenda (media, crisis), options are formulated, a law passes, agencies implement, evaluators assess. Rinse and repeat.",
      },
      {
        name: "Regulatory agencies",
        description: "Delegated rule-making.",
        usedFor: ["public admin"],
        problem: "How do technical rules get made?",
        keyInsight: "Legislatures delegate technical rule-making and enforcement to specialized, semi-independent bodies.",
        example: "Congress says 'protect air quality.' The EPA writes the rules specifying emission limits. Technical expertise sits in the agency.",
      },
      {
        name: "Principal-agent in government",
        description: "Controlling bureaucrats.",
        usedFor: ["public admin"],
        problem: "Do bureaucrats do what elected officials want?",
        keyInsight: "Elected principals struggle to monitor expert agents with their own interests and information.",
        example: "A president orders a policy shift, but the bureaucracy slow-walks it. Information asymmetry and career incentives create slack.",
      },
      {
        name: "Street-level bureaucracy",
        description: "Policy at the front line.",
        usedFor: ["public admin"],
        problem: "Who really makes policy?",
        keyInsight: "Frontline workers' discretion effectively makes policy in daily implementation (Lipsky).",
        example: "A police officer decides whom to stop; a teacher decides how much attention each student gets. Discretion is policy in practice.",
      },
      {
        name: "Public goods provision",
        description: "Why the state supplies some things.",
        usedFor: ["policy"],
        problem: "Why can't markets provide everything?",
        keyInsight: "Non-excludable, non-rival goods are under-provided by markets, justifying collective provision.",
        example: "National defense: you can't exclude non-payers, and one person's protection doesn't reduce another's. Markets can't provide it; the state must.",
      },
      {
        name: "Regulatory impact assessment",
        description: "Test rules before adopting.",
        usedFor: ["policy"],
        problem: "Are regulations worth the cost?",
        keyInsight: "Analyze costs, benefits, and alternatives before regulating.",
        example: "Before issuing a rule, the EPA estimates compliance costs and health benefits. If costs exceed benefits, reconsider.",
      },
      {
        name: "Implementation gap",
        description: "Plans versus reality.",
        usedFor: ["policy"],
        problem: "Why do policies fail in practice?",
        keyInsight: "Adopted policies often fail in execution due to capacity, incentives, and discretion.",
        example: "A law mandates universal healthcare, but clinics are understaffed and underfunded. The policy exists on paper; implementation lags.",
      },
      {
        name: "E-government & digital services",
        description: "The administrative interface.",
        usedFor: ["public admin"],
        problem: "Can technology improve government?",
        keyInsight: "Digitizing delivery reshapes access, efficiency, and accountability.",
        example: "Estonia's X-Road: citizens do taxes, voting, and health records online. Digital government changes the citizen-state interface.",
      },
    ],
  },
  {
    slug: "international-global",
    name: "International & Global Governance",
    blurb: "Governing beyond borders — treaties, regimes, and coordination without a world government.",
    color: "violet",
    methods: [
      {
        name: "International organizations",
        description: "Standing cooperation bodies.",
        usedFor: ["international"],
        problem: "How do states cooperate on an ongoing basis?",
        keyInsight: "Bodies like the UN and WTO coordinate states but lack coercive sovereignty over them.",
        example: "The UN Security Council can authorize sanctions or force, but only if the P5 agree. No state is compelled against its will.",
      },
      {
        name: "Treaties & international law",
        description: "Binding interstate rules.",
        usedFor: ["international"],
        problem: "How do states commit to each other?",
        keyInsight: "States consent to be bound; enforcement rests on reciprocity and reputation, not a global police.",
        example: "The Paris Agreement: states pledge emissions cuts. No world police enforces it — compliance rests on domestic politics and peer pressure.",
      },
      {
        name: "International regimes",
        description: "Norms around an issue.",
        usedFor: ["international"],
        problem: "How do states coordinate on specific issues without a formal organization?",
        keyInsight: "Principles, norms, and rules converge actor expectations in an issue-area (trade, climate).",
        example: "The non-proliferation regime: the NPT, IAEA safeguards, export controls, and informal understandings all reinforce the norm against spreading nuclear weapons.",
      },
      {
        name: "Sovereignty",
        description: "The bedrock unit.",
        usedFor: ["international"],
        problem: "Who has the final say?",
        keyInsight: "States claim supreme authority within borders and formal equality without — in tension with global problems.",
        example: "Climate change ignores borders, but sovereignty means no global authority can mandate emissions cuts. The tension is real.",
      },
      {
        name: "Multilateralism",
        description: "Many states, common rules.",
        usedFor: ["international"],
        problem: "How do many states coordinate?",
        keyInsight: "Coordinating three or more states under shared principles, versus bilateral or unilateral action.",
        example: "The WTO: 164 members, one set of rules. Multilateralism creates a level playing field but requires consensus.",
      },
      {
        name: "Supranational governance",
        description: "Above the state.",
        usedFor: ["international"],
        problem: "Can states pool sovereignty?",
        keyInsight: "Members cede some sovereignty to a higher authority whose rules bind them (e.g., the EU).",
        example: "EU law is supreme over national law in its domain. Member states have ceded part of their sovereignty to Brussels.",
      },
      {
        name: "Global commons",
        description: "Shared planetary resources.",
        usedFor: ["international", "commons"],
        problem: "Who governs the atmosphere, oceans, and space?",
        keyInsight: "The atmosphere, high seas, and space resist national governance and need collective regimes.",
        example: "The Montreal Protocol: states agreed to phase out CFCs to protect the ozone layer. A successful commons governance story.",
      },
      {
        name: "Soft power & norm diffusion",
        description: "Influence without force.",
        usedFor: ["international"],
        problem: "Can you change behavior without coercion?",
        keyInsight: "Attraction, legitimacy, and spreading norms shape behavior beyond coercion (Nye).",
        example: "Human-rights norms spread not by force but by naming and shaming, socialization, and the appeal of legitimacy.",
      },
      {
        name: "Transnational private governance",
        description: "Rule-making beyond states.",
        usedFor: ["international"],
        problem: "Can non-state actors govern?",
        keyInsight: "Firms and NGOs set cross-border standards that states don't.",
        example: "ISO standards, fair-trade certification, and the Forest Stewardship Council: private actors govern global supply chains.",
      },
      {
        name: "Compliance without enforcement",
        description: "Why states obey.",
        usedFor: ["international"],
        problem: "Why do states follow international law without a world police?",
        keyInsight: "Reputation, reciprocity, and domestic interests drive compliance absent a global enforcer.",
        example: "States repay sovereign debt even when they could default because reputation in capital markets matters. Self-interest drives compliance.",
      },
    ],
  },
  {
    slug: "data-governance",
    name: "Data Governance",
    blurb: "Governing information — stewardship, quality, and the rules for data as an asset.",
    color: "indigo",
    methods: [
      {
        name: "Data stewardship & ownership",
        description: "Accountable custodians.",
        usedFor: ["data"],
        problem: "Who is responsible for data?",
        keyInsight: "Assign clear roles — owner (accountable), steward (manages), custodian (operates) — per data domain.",
        example: "The CFO owns financial data; a data steward in finance maintains definitions and quality; IT custodians operate the database.",
      },
      {
        name: "Data quality management",
        description: "Fit-for-purpose data.",
        usedFor: ["data"],
        problem: "How do you ensure data is accurate and usable?",
        keyInsight: "Govern accuracy, completeness, consistency, and timeliness against defined standards.",
        example: "A data quality dashboard tracks duplicate records, missing fields, and stale updates. Thresholds trigger remediation.",
      },
      {
        name: "Data lineage",
        description: "Where data came from.",
        usedFor: ["data"],
        problem: "How do you trace data through the system?",
        keyInsight: "Trace origin and transformations end-to-end for trust and impact analysis.",
        example: "A report shows revenue. Lineage traces it back through aggregations, joins, and source systems to the original transaction — full provenance.",
      },
      {
        name: "Master data management",
        description: "One source of truth.",
        usedFor: ["data"],
        problem: "How do you avoid conflicting versions of 'customer' or 'product'?",
        keyInsight: "Maintain a single authoritative version of core entities across systems.",
        example: "A master customer record: one ID, one address, one profile. All systems reference the master; no conflicting copies.",
      },
      {
        name: "Data classification",
        description: "Tier by sensitivity.",
        usedFor: ["data"],
        problem: "How do you know which data needs extra protection?",
        keyInsight: "Label data (public/internal/confidential/restricted) to drive access and protection.",
        example: "PII is classified 'confidential'; access requires approval and is logged. Public data is open to all.",
      },
      {
        name: "Privacy & consent",
        description: "Governing personal data.",
        usedFor: ["data", "privacy"],
        problem: "When can you collect and use personal data?",
        keyInsight: "Collect and use personal data only with a lawful basis and respect for data-subject rights.",
        example: "GDPR: you need consent or another lawful basis to process personal data. The data subject can demand access, correction, or deletion.",
      },
      {
        name: "Data retention & lifecycle",
        description: "Keep, then dispose.",
        usedFor: ["data"],
        problem: "How long should you keep data?",
        keyInsight: "Govern data from creation to defensible deletion per legal and business need.",
        example: "A retention schedule: tax records 7 years, marketing data 2 years, then delete. Holding data too long is a liability.",
      },
      {
        name: "Access control & security governance",
        description: "Who can touch what.",
        usedFor: ["data", "security"],
        problem: "How do you prevent unauthorized access?",
        keyInsight: "Least-privilege access tied to classification and role, with audit trails.",
        example: "A role-based access matrix: only HR can see salary data; only finance can see revenue. Access is logged and reviewed.",
      },
      {
        name: "Data ethics",
        description: "Beyond mere legality.",
        usedFor: ["data"],
        problem: "What if something is legal but wrong?",
        keyInsight: "Govern fairness, consent, and impact even where the law is silent.",
        example: "Using zip codes as a proxy for race is legal but ethically suspect. Data ethics asks: should we, not just can we?",
      },
      {
        name: "Data governance frameworks",
        description: "The operating model.",
        usedFor: ["data"],
        problem: "How do you organize data governance?",
        keyInsight: "DAMA-DMBOK-style frameworks define the roles, policies, and processes for data as an asset.",
        example: "A data governance council, domain stewards, and a data catalog operationalize the framework. Data is managed as an enterprise asset.",
      },
    ],
  },
  {
    slug: "ai-algorithmic",
    name: "AI & Algorithmic Governance",
    blurb: "Governing machines — accountability, explainability, and oversight of automated systems.",
    color: "violet",
    methods: [
      {
        name: "Algorithmic accountability",
        description: "Owning automated decisions.",
        usedFor: ["AI"],
        problem: "Who is responsible when an algorithm causes harm?",
        keyInsight: "A responsible party must answer for an algorithm's decisions and their effects.",
        example: "A hiring algorithm rejects a qualified candidate. Someone — the vendor, the employer, the developer — must be accountable for the outcome.",
      },
      {
        name: "AI risk frameworks",
        description: "Structured risk management.",
        usedFor: ["AI", "risk"],
        problem: "How do you manage AI risks systematically?",
        keyInsight: "Map, measure, manage, and govern AI risks across the lifecycle (e.g., NIST AI RMF).",
        example: "The NIST AI Risk Management Framework: identify risks, assess impact and likelihood, mitigate, and monitor. A structured approach to AI risk.",
      },
      {
        name: "Model validation & monitoring",
        description: "Check before and after deployment.",
        usedFor: ["AI", "xref:statistics"],
        problem: "How do you know if a model is working?",
        keyInsight: "Independently test models pre-release and monitor for drift and failure in production.",
        example: "A credit model is validated against holdout data before deployment. In production, it's monitored for drift — if accuracy degrades, retrain.",
      },
      {
        name: "Explainability & interpretability",
        description: "Intelligible AI.",
        usedFor: ["AI"],
        problem: "How do you explain an algorithm's decision?",
        keyInsight: "Require that automated decisions can be explained to those affected and to overseers.",
        example: "LIME or SHAP explain which features drove a prediction. The affected person can understand why they were denied a loan.",
      },
      {
        name: "Human-in-the-loop",
        description: "Keep people in control.",
        usedFor: ["AI"],
        problem: "Should algorithms ever act without human review?",
        keyInsight: "Insert meaningful human review and override for consequential automated decisions.",
        example: "A content-moderation system flags posts; a human reviewer makes the final call. The human is in the loop for consequential decisions.",
      },
      {
        name: "Bias & fairness auditing",
        description: "Test for disparate impact.",
        usedFor: ["AI", "xref:statistics"],
        problem: "Does the algorithm treat groups fairly?",
        keyInsight: "Systematically evaluate models for unjustified disparities across groups.",
        example: "A fairness audit finds the hiring model rejects women at a higher rate than men with similar qualifications. The model is biased.",
      },
      {
        name: "Red-teaming & evaluation",
        description: "Adversarial testing.",
        usedFor: ["AI"],
        problem: "How do you find failure modes before they hurt people?",
        keyInsight: "Probe systems for failure modes and misuse before and after release.",
        example: "A red team tries to jailbreak a language model, testing for harmful outputs. Failures found in testing are fixed before release.",
      },
      {
        name: "AI regulation",
        description: "Hard law for AI.",
        usedFor: ["AI", "regulation"],
        problem: "Should AI be legally regulated?",
        keyInsight: "Risk-tiered legal regimes (e.g., the EU AI Act) impose obligations scaled to potential harm.",
        example: "The EU AI Act: high-risk AI (hiring, credit, law enforcement) requires conformity assessment, documentation, and human oversight. Low-risk AI is unregulated.",
      },
      {
        name: "Oversight & alignment",
        description: "Keeping capable systems controllable.",
        usedFor: ["AI"],
        problem: "How do you ensure AI systems stay steerable?",
        keyInsight: "Mechanisms to ensure increasingly autonomous systems stay steerable and aligned with human intent.",
        example: "Alignment research asks: how do you ensure a powerful AI does what we want, not something literally correct but catastrophically wrong?",
      },
      {
        name: "Provenance & disclosure",
        description: "Label the machine's output.",
        usedFor: ["AI", "transparency"],
        problem: "How do you know if content is AI-generated?",
        keyInsight: "Disclose AI involvement and content provenance so audiences can calibrate trust.",
        example: "A watermark or metadata tag indicates an image is AI-generated. Audiences can judge authenticity.",
      },
    ],
  },
  // ── CROSS-CUTTING (emerald/green) ───────────────────────────────────────────
  {
    slug: "network-commons",
    name: "Multi-Stakeholder, Network & Commons Governance",
    blurb: "Governing together — partnerships, polycentricity, and self-governing communities.",
    color: "emerald",
    methods: [
      {
        name: "Ostrom's design principles",
        description: "Commons that work.",
        usedFor: ["commons"],
        problem: "How do communities govern shared resources without privatizing or regulating them?",
        keyInsight: "Durable commons share features — clear boundaries, local rule-making, monitoring, graduated sanctions, conflict resolution.",
        example: "Swiss alpine meadows: local farmers set grazing limits, monitor compliance, and impose graduated fines. The commons persists for centuries.",
      },
      {
        name: "Collaborative governance",
        description: "Govern by partnership.",
        usedFor: ["network"],
        problem: "Can government, business, and civil society govern together?",
        keyInsight: "Public, private, and civil actors jointly make and implement decisions through structured consensus.",
        example: "A watershed council: farmers, environmentalists, and regulators negotiate water-use rules together. Consensus replaces command.",
      },
      {
        name: "Multi-stakeholder initiatives",
        description: "Voluntary joint standards.",
        usedFor: ["network"],
        problem: "How do you govern an issue when no single actor has authority?",
        keyInsight: "Affected parties co-create and oversee standards (e.g., certification schemes).",
        example: "The Roundtable on Sustainable Palm Oil: producers, buyers, NGOs, and governments set and certify standards. No one actor dominates.",
      },
      {
        name: "Public-private partnerships",
        description: "Sharing delivery and risk.",
        usedFor: ["network"],
        problem: "Can government and business collaborate on infrastructure?",
        keyInsight: "Contractually allocate financing, building, and operating risk between government and private partners.",
        example: "A toll road PPP: the private partner builds and operates; the government sets standards and shares revenue risk. Risk is allocated to who manages it best.",
      },
      {
        name: "Self-governance",
        description: "Communities make their own rules.",
        usedFor: ["commons"],
        problem: "Can communities govern themselves without external authority?",
        keyInsight: "User groups craft and enforce their own rules, often outperforming external imposition.",
        example: "Lobster fishers in Maine self-regulate: territories, entry limits, and sanctions are community-enforced. It works better than state regulation.",
      },
      {
        name: "Standards bodies",
        description: "Voluntary technical governance.",
        usedFor: ["network"],
        problem: "How do technical standards get set?",
        keyInsight: "Consensus organizations (ISO, IETF) set widely adopted, non-state rules.",
        example: "The IETF sets internet protocols (HTTP, TCP/IP). No government mandates compliance; adoption is voluntary and near-universal.",
      },
      {
        name: "Polycentricity in practice",
        description: "Nested, overlapping authorities.",
        usedFor: ["network"],
        problem: "Does governance require a single center?",
        keyInsight: "Multiple decision centers at different scales coordinate on a shared problem.",
        example: "Climate governance: cities, states, countries, and international bodies all act. Overlapping jurisdictions can outperform centralization.",
      },
      {
        name: "Coase theorem",
        description: "Bargaining to efficiency.",
        usedFor: ["commons"],
        problem: "Can private bargaining solve externalities?",
        keyInsight: "With clear property rights and low transaction costs, parties negotiate efficient outcomes regardless of the initial allocation.",
        example: "A factory pollutes a river. If property rights are clear and transaction costs low, the factory and downstream users can bargain to the efficient level of pollution.",
      },
      {
        name: "Tiebout sorting",
        description: "Voting with your feet.",
        usedFor: ["network"],
        problem: "Can people choose their governance regime?",
        keyInsight: "Mobility across jurisdictions lets people sort into the rule-and-service bundle they prefer.",
        example: "Families move to towns with good schools and low taxes. Jurisdictions compete on governance; residents vote with their feet.",
      },
      {
        name: "Reputation systems",
        description: "Trust at scale.",
        usedFor: ["network"],
        problem: "How do strangers cooperate without hierarchy?",
        keyInsight: "Aggregated track records enable cooperation among strangers, governing platforms and markets.",
        example: "eBay seller ratings: a stranger in another country ships goods because their reputation is on the line. Reputation governs the marketplace.",
      },
    ],
  },
  {
    slug: "measurement-indicators",
    name: "Measurement, Indicators & Ratings",
    blurb: "Scoring governance — indices, rankings, and the limits of quantification.",
    color: "emerald",
    methods: [
      {
        name: "Composite governance indices",
        description: "Bundle indicators into a score.",
        usedFor: ["measurement", "xref:statistics"],
        problem: "How do you summarize governance in a single number?",
        keyInsight: "Aggregating many sub-indicators is convenient, but the weighting choices drive the result.",
        example: "The Worldwide Governance Indicators combine surveys and expert assessments into six dimensions. Convenient, but the aggregation hides a lot.",
      },
      {
        name: "Worldwide Governance Indicators",
        description: "Six dimensions.",
        usedFor: ["measurement"],
        problem: "What does 'good governance' mean, empirically?",
        keyInsight: "Voice/accountability, stability, government effectiveness, regulatory quality, rule of law, and control of corruption.",
        example: "The WGI ranks Denmark high on all six; Somalia low. The six dimensions operationalize the concept of governance quality.",
      },
      {
        name: "Corruption perceptions",
        description: "Measuring the hidden.",
        usedFor: ["measurement"],
        problem: "How do you measure something people hide?",
        keyInsight: "Corruption is gauged via perception surveys (e.g., CPI) because direct measurement is impossible.",
        example: "Transparency International's CPI: experts rate perceived corruption. It's a proxy — not the same as actual corruption — but it's what we can measure.",
      },
      {
        name: "Democracy indices",
        description: "Scoring political systems.",
        usedFor: ["measurement"],
        problem: "How democratic is a country?",
        keyInsight: "V-Dem, Polity, and Freedom House rate regimes on coded criteria — methodology shapes the rankings.",
        example: "V-Dem codes hundreds of indicators from expert surveys. Polity uses a smaller set. The scores differ because the methodologies differ.",
      },
      {
        name: "Rule-of-law index",
        description: "Operationalizing a principle.",
        usedFor: ["measurement"],
        problem: "How do you measure the rule of law?",
        keyInsight: "Experts and surveys score dimensions like constraints on power, order, and justice (WJP).",
        example: "The World Justice Project index: constraints on government, absence of corruption, open government, fundamental rights, etc. 140 countries ranked.",
      },
      {
        name: "ESG ratings",
        description: "Scoring corporate sustainability/governance.",
        usedFor: ["measurement", "xref:finance"],
        problem: "How sustainable is a company?",
        keyInsight: "Providers rate firms on E, S, and G — with notoriously low agreement across raters.",
        example: "MSCI gives Tesla a high E score (electric cars); S&P gives it a low one (labor issues). The ratings diverge because methodologies differ.",
      },
      {
        name: "Board effectiveness metrics",
        description: "Gauging the board.",
        usedFor: ["measurement", "corporate"],
        problem: "Is the board doing its job?",
        keyInsight: "Independence, diversity, attendance, and evaluation results proxy for board quality.",
        example: "Investors check: majority independent? Audit committee all independent? Annual board evaluation? These proxies signal board quality.",
      },
      {
        name: "Goodhart's law",
        description: "Targets distort measures.",
        usedFor: ["measurement"],
        problem: "What happens when a measure becomes a target?",
        keyInsight: "When a measure becomes a target, it ceases to be a good measure.",
        example: "A hospital targets wait times; patients are shuffled into holding rooms to stop the clock. The measure is hit, but care doesn't improve.",
      },
      {
        name: "Benchmarking & league tables",
        description: "Ranking to drive behavior.",
        usedFor: ["measurement"],
        problem: "Do rankings improve performance?",
        keyInsight: "Comparative rankings create reputational pressure to improve — and to game.",
        example: "University rankings: schools optimize for the indicators (faculty ratios, SAT scores), not necessarily for education quality.",
      },
      {
        name: "Validity & reliability of indices",
        description: "Do the scores mean anything?",
        usedFor: ["measurement", "xref:statistics"],
        problem: "Can you trust a governance index?",
        keyInsight: "A governance metric must measure what it claims (validity) and do so consistently (reliability).",
        example: "If two coders rate the same country differently, reliability is low. If the index tracks perceptions, not reality, validity is questionable.",
      },
    ],
  },
  // ── OPTIONAL (slate/gray) ───────────────────────────────────────────────────
  {
    slug: "nonprofit-civil-society",
    name: "Nonprofit & Civil-Society Governance",
    blurb: "Governing mission-driven organizations — boards without owners, accountability to purpose.",
    color: "slate",
    methods: [
      {
        name: "Nonprofit boards",
        description: "Stewardship without owners.",
        usedFor: ["nonprofit"],
        problem: "Who oversees a nonprofit when there are no shareholders?",
        keyInsight: "Boards hold fiduciary duty to the mission and beneficiaries, not shareholders.",
        example: "A hospital board's duty is to the community, not to profit. The board stewards the mission, not owner returns.",
      },
      {
        name: "Mission accountability",
        description: "Answerable for purpose.",
        usedFor: ["nonprofit"],
        problem: "To whom is a nonprofit accountable?",
        keyInsight: "Accountability runs to donors, beneficiaries, and the public mission rather than to profit.",
        example: "A charity must show donors that funds went to the stated cause. Mission drift — spending on overhead or unrelated activities — breaches accountability.",
      },
      {
        name: "Donor & grant governance",
        description: "Strings on the money.",
        usedFor: ["nonprofit"],
        problem: "How do funders shape nonprofits?",
        keyInsight: "Funders impose reporting and restrictions that shape behavior and create dependencies.",
        example: "A foundation grant requires quarterly reports and restricts spending to certain activities. The funder's requirements govern the grantee's operations.",
      },
      {
        name: "Membership governance",
        description: "Member-controlled bodies.",
        usedFor: ["nonprofit"],
        problem: "How do cooperatives and associations govern?",
        keyInsight: "Cooperatives and associations govern by one-member-one-vote, not capital share.",
        example: "A credit union: each member has one vote regardless of deposit size. The members own and govern the institution.",
      },
      {
        name: "Charity regulation",
        description: "Public-trust oversight.",
        usedFor: ["nonprofit"],
        problem: "Who regulates nonprofits?",
        keyInsight: "Regulators police charitable status, solvency, and against private benefit.",
        example: "The IRS can revoke 501(c)(3) status if a charity benefits insiders. State attorneys general can sue for misuse of charitable assets.",
      },
    ],
  },
  {
    slug: "esg-sustainability",
    name: "ESG & Sustainability Governance",
    blurb: "Governing for the long term — environmental, social, and governance integration.",
    color: "slate",
    methods: [
      {
        name: "ESG frameworks",
        description: "Structuring non-financial governance.",
        usedFor: ["ESG", "xref:finance"],
        problem: "How do you organize oversight of non-financial factors?",
        keyInsight: "Organize environmental, social, and governance factors into oversight and disclosure.",
        example: "An ESG committee of the board oversees climate risk, workforce issues, and governance practices — integrating non-financial factors into governance.",
      },
      {
        name: "Sustainability reporting standards",
        description: "Comparable ESG disclosure.",
        usedFor: ["ESG"],
        problem: "How do you compare ESG disclosures across companies?",
        keyInsight: "GRI, SASB, and ISSB/TCFD standardize what and how firms report.",
        example: "The ISSB standards: firms disclose climate risks in a comparable format. Investors can compare carbon exposure across portfolios.",
      },
      {
        name: "Materiality",
        description: "What matters enough to report.",
        usedFor: ["ESG"],
        problem: "Which ESG issues should a company disclose?",
        keyInsight: "Focus on issues affecting value (financial) or stakeholders (impact) — double materiality.",
        example: "For an oil company, carbon emissions are material — they affect both financial value (stranded assets) and stakeholders (climate). Disclose them.",
      },
      {
        name: "Board ESG oversight",
        description: "Sustainability at the top.",
        usedFor: ["ESG", "corporate"],
        problem: "Should boards oversee ESG?",
        keyInsight: "Boards increasingly own climate and social risk as a governance responsibility.",
        example: "Shell's board was held liable for insufficient climate ambition. ESG is now a board-level governance issue, not just CSR.",
      },
      {
        name: "Greenwashing controls",
        description: "Policing ESG claims.",
        usedFor: ["ESG"],
        problem: "How do you prevent false sustainability claims?",
        keyInsight: "Disclosure rules and assurance aim to keep sustainability claims truthful.",
        example: "The SEC's greenwashing enforcement: funds claiming to be 'green' must prove it. Assurance audits verify ESG disclosures.",
      },
    ],
  },
  {
    slug: "internet-digital",
    name: "Internet & Digital Governance",
    blurb: "Governing the net — platforms, protocols, and the new sovereigns of the digital age.",
    color: "slate",
    methods: [
      {
        name: "Multistakeholder internet governance",
        description: "Who runs the net.",
        usedFor: ["digital"],
        problem: "Who governs the internet?",
        keyInsight: "ICANN-style bodies govern internet resources via stakeholders, not states alone.",
        example: "ICANN assigns domain names through a multistakeholder process: governments, businesses, civil society, and technical experts all participate.",
      },
      {
        name: "Platform governance",
        description: "Private rule-makers at scale.",
        usedFor: ["digital"],
        problem: "Are platforms the new governments?",
        keyInsight: "Platforms set and enforce content and conduct rules over billions of users — quasi-regulatory power.",
        example: "Facebook bans a politician; Twitter labels misinformation. Private companies govern speech at a scale that rivals states.",
      },
      {
        name: "Content moderation",
        description: "Governing speech online.",
        usedFor: ["digital"],
        problem: "How do platforms decide what stays and what goes?",
        keyInsight: "Rules, automation, and appeals balance harm reduction against expression.",
        example: "YouTube's Community Guidelines, automated detection, and appeals process: a governance system for billions of hours of content.",
      },
      {
        name: "Interoperability & open standards",
        description: "Technical governance of the net.",
        usedFor: ["digital"],
        problem: "Why can any browser load any website?",
        keyInsight: "Open protocols (TCP/IP, HTTP) govern the internet through voluntary adoption.",
        example: "HTTP is not mandated by law; it's adopted because it works. Open standards govern the internet's architecture without coercion.",
      },
      {
        name: "Digital sovereignty",
        description: "States reclaiming the net.",
        usedFor: ["digital"],
        problem: "Can states control the internet within their borders?",
        keyInsight: "Governments assert control over data, infrastructure, and platforms within their borders.",
        example: "GDPR: the EU asserts jurisdiction over data about EU residents, wherever processed. China's Great Firewall: the state controls what citizens see.",
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

export default function GovernancePage() {
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
        <h1 className="text-2xl font-semibold text-white">Governance — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to governance concepts organized by family. Each card describes one concept,
          what it&apos;s used for, and links to claims on Epistemic Receipts that touch on it.
          Click any card for a textbook-style expansion: the problem the concept addresses, the
          key insight, and a concrete example. Color codes the family;
          clicking a header collapses its section.
        </p>
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">
          Cross-references to the{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">
            statistics taxonomy
          </Link>{" "}
          and{" "}
          <Link href="/finance" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">
            finance taxonomy
          </Link>{" "}
          are noted where concepts overlap (e.g., agency costs, ESG ratings, model validation).
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {FAMILIES.length} families · {totalMethods} concepts
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
          placeholder="Filter by name, description, insight, or tag — e.g. 'accountability', 'voting', 'AI'"
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
          No concepts match &ldquo;{query}&rdquo;. Try a broader term.
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
                      {family.methods.length} {family.methods.length === 1 ? "concept" : "concepts"}
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
          the claim is <em>about</em> that concept — only that the term is present. Cross-references
          to the <Link href="/statistics" className="text-gray-400 hover:text-gray-300 underline underline-offset-2">statistics taxonomy</Link> and{" "}
          <Link href="/finance" className="text-gray-400 hover:text-gray-300 underline underline-offset-2">finance taxonomy</Link> are
          marked with &ldquo;xref:&rdquo; tags.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated June 3, 2026 · {FAMILIES.length} families · {totalMethods} concepts
        </p>
      </div>
    </div>
  );
}
