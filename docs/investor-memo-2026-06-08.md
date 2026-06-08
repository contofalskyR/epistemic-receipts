# Epistemic Receipts — Strategic Memo & Skeptical-VC Pressure Test

*Prepared from a full walk-through of the live product (search, claim pages, Globe, Stats, Legislation, Datasets, Feed, Edges, About). Figures are as observed on the site in June 2026.*

---

## 1. One line

**In a world where generating plausible text is free and infinite, the scarce asset is *trust in a claim*. Epistemic Receipts is building the neutral, living provenance layer for facts — the thing an LLM structurally cannot be.**

---

## 2. What has actually been built (the real assets)

Most people would describe this as "a fact-check site." That undersells it and points at the wrong business. There are three distinct assets here:

**Asset 1 — A provenance knowledge graph at real scale.** 1,534,209 records across 176 live pipelines, ~993,000 of them geocoded onto a time-aware globe spanning 1789–present. The data model is the impressive part: every record is a *claim* with a typed **epistemic status** (hard fact, disputed, approved, retracted, registered-trial, confirmed, settled-judgment), connected by **typed edges** (CITES, CONTRADICTS, FUNDED_BY) and **meta-edges**, with a **review state** and a **threshold-event** system that fires when a claim's status changes. The crown-jewel behavior: when CrossRef logs a retraction, 11,319 CONTRADICTS edges automatically flip the original OpenAlex papers to *disputed*. That is a knowledge base that **changes its mind when the evidence does** — exactly what a frozen-weights model can't do.

**Asset 2 — An autonomous ingestion engine (OpenClaw).** The "About" page quietly states the pipelines are built and maintained by *OpenClaw, an AI agent runtime for autonomous research workflows.* The weekly feed shows it adding **157,000 OpenAlex claims, 69,000 Hungarian statutes, 46,000 FDA approvals, 38,000 archival records in seven days.** Whatever the knowledge graph is worth, the *machine that builds knowledge graphs* may be worth more. This is the picks-and-shovels asset hiding inside the product.

**Asset 3 — A small set of hand-built case studies that are the actual point.** Korematsu traced across its 70-year arc through coram nobis to the Civil Liberties Act; the tobacco industry's "doubt is our product" memo; the lab-leak debate; Pluto's reclassification; Ozempic from Phase 3 to approval to safety surveillance. These are the claims with *full receipts* — real timelines, real contradicting sources, real epistemic arcs. The founder's own framing: **"The case studies are what the tool is for."** They are correct, and this is the most important sentence on the site.

---

## 3. Why now

Three curves cross in your favor:

- **Generation collapsed to zero cost.** The marginal value has moved from *producing* an answer to *proving* it. Every serious AI deployment now shares one unsolved problem: *says who, and is it still true?*
- **The web is filling with synthetic, unsourced content.** Provenance — knowing where a claim came from and whether it still holds — becomes the scarce, defensible layer precisely as everything else becomes abundant.
- **Institutional trust is falling and the replication/retraction crisis is mainstream.** "Audit it yourself" is culturally ascendant over "trust the expert." You are building the substrate for audit-based trust.

---

## 4. The market and who actually pays

The consumer fact-browser is a **public good**: low willingness-to-pay, and the mind-space is owned by Google, Wikipedia, and (in memory) Snopes. Keep it — as **brand and data-flywheel**, not as the revenue engine. The same graph monetizes three other ways, and the editorial scope on the About page ("no sports, no celebrity, no pure financial, no engagement content") is compatible with all three.

**(a) The grounding/trust API for AI — the biggest prize.** Sell the graph as an endpoint: *pass in a generated statement, get back its provenance, its consensus status, the timeline of how that status was made or unmade, and any contradicting evidence.* This is RAG-with-receipts as infrastructure — usage-based, high-margin, and it sells the one thing labs can't build into the weights: freshness and retraction-awareness. Buyers: AI labs, enterprise AI deployments, agent builders, answer engines. **This is the clearest path to a venture-scale outcome.**

**(b) Claim-substantiation for regulated industries — where "show your evidence" is the law.** Pharma medical-legal-regulatory (MLR) review is the natural beachhead because you *already* ingest OpenAlex + NIH grants + ClinicalTrials.gov + Drugs@FDA + the retraction graph. "Prove this marketing claim is still supported and rests on nothing retracted" is a six-figure-per-seat problem. Adjacent: research-integrity offices (universities, publishers, funders), legal (you already pull CourtListener, ECHR, ICJ, ICC), and audit/ESG substantiation.

**(c) Media & policy intelligence.** Your Stats engine already computes legislative polarization, party-line vs. bipartisan rates, vote margins, and — the sleeper — *which 119th-Congress bills the NYT covers vs. ignores.* That "dark-matter bills" view is a media-monitoring product in embryo. Buyers: newsrooms, public-affairs and lobbying firms, think tanks, oversight bodies.

The mental model is **Bloomberg**: a famous front-end sitting on a data-and-API franchise that is the real business. You are early enough to become the *Bloomberg terminal for verifiable facts* — with the important amendment that your editorial scope deliberately excludes the markets-data core, so the franchise is **accountability and evidence, not tickers.**

---

## 5. The moat

- **A living, temporal, cross-source provenance graph.** A static knowledge base is a commodity; one that re-scores its own claims when sources retract, settle, or get superseded is not. Lean on this as the headline, not a footnote.
- **Neutrality as brand.** If it becomes the *neutral* reference, that trust is itself defensible (PubMed, Wikipedia). The flip side: the day it's perceived as biased, the franchise is gone. Governance and method-transparency are not nice-to-haves; they are the asset.
- **OpenClaw velocity.** If a single operator can stand up 176 provenance pipelines and add ~300k claims/week, the cost curve to *comprehensiveness* is unlike anyone else's. Comprehensiveness plus freshness is the combination incumbents find expensive.
- **The demand-routed flywheel.** The "suggest this topic / we track what's missing" mechanic turns user demand into an ingestion queue. Usage literally directs coverage.

---

## 6. The honest risks (don't skip these)

1. **The receipts are mostly empty today.** A typical bulk claim (e.g., an FDA approval for semaglutide) is stamped `HARD_FACT` while showing **0 sources, 0 edges, UNREVIEWED.** The promise is "every claim is sourced"; the median claim is not. The product's credibility lives or dies on closing this gap (see the roadmap doc — it's the #1 item).
2. **The label overclaims.** "Hard Fact = verified across independent sources" is the stated definition, but the status is auto-assigned from a single institutional pipeline. That is a contradiction baked into the data model, and it's exactly the kind of thing a hostile critic screenshots.
3. **Quantity is concentrated in low-value records.** ~80% of records are uncategorized "Other"; the biggest pipelines are bibliographic metadata (OpenAlex), foreign statute titles, and archival catalogs — thin "this exists" facts, not contestable claims with arcs.
4. **The hard cases are unanswered.** "Do vaccines cause autism?" returns *nothing found.* The highest-demand, highest-value contested questions are precisely where coverage is thinnest.
5. **Editorial purity caps some markets.** "No pure financial claims, no engagement content" is what makes it trustworthy — and what forecloses some of the easiest revenue. That tension should be a conscious choice, not an accident.
6. **Key-person + agent-runtime concentration.** The same thing that makes velocity extraordinary (one operator + OpenClaw) is a concentration risk and a "could a lab replicate this in a quarter?" question.

---

## 7. Skeptical-VC pressure test

*The questions a good investor will actually ask, and the strongest honest answers.*

**"Why won't OpenAI / Anthropic / Google / Perplexity just build this?"**
They'll build *citations* — they already are. What they won't do is run a *neutral, cross-source, continuously-re-scored provenance graph* as a public good, because (a) it's off-mission — they sell models and answers, not a referee that contradicts their own outputs; (b) neutrality requires *not* being owned by an answer-engine with a horse in the race; and (c) the value is in the boring, unglamorous freshness/retraction/contradiction maintenance that labs deprioritize. The wedge is to be the **Switzerland the labs license** rather than competing on answers. If you're framed as "a better Perplexity," you lose. If you're framed as "the provenance layer every answer engine calls," you win.

**"Isn't this just Wikidata / Google Scholar / Semantic Scholar / Snopes?"**
Wikidata has entities and relations but no epistemic *status* and no temporal "how consensus was made and unmade." Scholar/Semantic Scholar have citation graphs but treat a retracted paper and a replicated one as equal nodes. Snopes renders verdicts by hand and doesn't scale. The differentiated primitive here is the **status-bearing, time-aware claim with typed contradiction edges.** Nobody neutral operates that at scale. (Caveat: that primitive is currently under-populated — the moat is the *design plus the engine to fill it*, which must be demonstrated.)

**"The trails are empty — is there a there there?"**
Today, partially. The architecture is right and a few case studies prove the ceiling; the median claim hasn't been built out. This is the central diligence risk and the central roadmap priority. The bull case is that OpenClaw makes *filling* trails cheap; the bear case is that filling high-quality contested trails is irreducibly manual. The honest investment thesis rides on **how much of case-study quality can be automated.** That's the number to prove.

**"Who pays, and how much?"**
Not consumers. The revenue is (a) per-call grounding/verification API to AI builders, and (b) seat-and-substantiation licenses in pharma MLR / research-integrity / legal. One regulated vertical at real penetration is a venture-scale business on its own; the API is the option on a much larger one.

**"Single operator plus AI agents — is this defensible, or a replicable demo?"**
The pipelines are individually replicable; the *integrated graph + the velocity to keep it comprehensive and fresh + the neutrality brand* is not, and compounds. But "defensible" here is earned over time through coverage, trust, and switching costs (people building on the API), not via a patent. Be honest that the moat is a *flywheel*, not a *wall*.

**"Editorial purity limits TAM — how big can this really get?"**
The purity caps the *consumer-ad* and *markets-data* paths, which you don't want anyway. It does **not** cap the API or compliance paths — regulated buyers *prefer* a source that refuses engagement-bait and tickers. Purity is a feature for the buyers who pay the most.

**"Contested claims are exactly where you punt. Have you solved the hard part?"**
Not yet — and neither has anyone. But the *right* answer to a contested claim is not a verdict; it's a structured map of the disagreement: who claims what, on what evidence, since when, and how strong. The product's stated philosophy ("it preserves the record; disputed claims stay disputed") is the correct one. The gap is that the *implementation* still stamps binary `HARD_FACT` badges. Closing philosophy-to-implementation is both the credibility fix and the thing that makes the contested cases — the most valuable ones — tractable.

---

## 8. The defensible wedge (recommendation)

Don't lead with "a fact website." Lead with **"the provenance layer for the AI era,"** proven by:

1. A **grounding/verification API** with one AI or enterprise design partner.
2. **One** regulated vertical pilot — pharma claim-substantiation or research-integrity, because the data spine already exists.
3. **Industrialized case studies** as the public proof of the ceiling (and the brand).
4. **Open methodology** published early, to bank the neutrality that is the whole franchise.

Win condition: become the neutral source other answer engines and regulated teams *call*, not another engine competing for the user's question.

---

## 9. How big — comparables

"Receipts for facts" maps onto categories that are already large: scholarly/research information (Web of Science, Dimensions), legal research (Westlaw, LexisNexis), compliance/regtech, and the *emerging* AI-grounding/eval/trust category that has no neutral incumbent yet. A $1B outcome does not require winning all of them — **one** of {the grounding API at scale, pharma claim-substantiation, research-integrity infrastructure} gets there. The blue-sky version is the neutral provenance graph that sits underneath a large share of AI answers, which is a multi-billion-dollar position.

---

*Companion document: **Product & Data Roadmap** (opus-brainstorm-2026-06-08.md) — the specific topics to add, the quality/quantity asymmetry map, the Votes deep-dive, and the hidden strengths.*
