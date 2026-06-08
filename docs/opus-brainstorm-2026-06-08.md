# Epistemic Receipts — Exhaustive Product & Data Roadmap

*Grounded in a full walk-through of the live site (June 2026). Every number below was read off the product: `/datasets`, `/stats`, `/legislation`, `/feed`, `/edges`, individual `/claims/...` pages, and the nav.*

The throughline of this entire document: **you have built a quantity machine on top of a quality data model. The next phase is not "add more rows" — it is "make the receipts real, surface the gems you already have, and industrialize the case studies." Deepen, don't widen.**

---

## Part 1 — The single most important fix (do this first)

**`HARD_FACT` is being stamped on claims with empty receipts.** Concretely, the semaglutide (Wegovy) FDA-approval claim and the helium FDA claims both render:

> `HARD_FACT` · `INSTITUTIONAL` · `FDA Approved` · `UNREVIEWED` — **0 edges · 0 sources** — "No dated sources." "No edges yet."

The legend promises *"Hard Fact — verified across independent sources."* A single-pipeline, zero-source, unreviewed record is not that. This is the one thing a hostile critic screenshots, and it quietly contradicts your own (excellent) About-page philosophy: *"It does not render verdicts; it preserves the record."*

**The fix is epistemic honesty in the label, and it's mostly a relabeling/UX job, not new data:**

- Replace the binary fact/disputed badge with a **provenance-grade** that reflects what's actually known: e.g. `Single official source` / `Corroborated (n independent sources)` / `Contested` / `Retracted` / `Unreviewed`. Reserve "Hard Fact" for claims that genuinely have ≥2 independent corroborating edges.
- Show the grade *honestly even when it's weak*. "1 source: FDA. Not independently corroborated." is **more** trust-building than a green "Hard Fact," because it proves the badge means something.
- Make `0 sources` claims visibly **provisional** ("reference scaffolding — receipt not yet built"). This also primes users to value the case studies.

This single change converts your biggest credibility liability into your biggest credibility *proof point*: a system honest enough to say "I only have one source for this."

---

## Part 2 — The quality / quantity asymmetry, quantified

Total: **1,534,209 records / 176 pipelines.** Category split as the site reports it:

| Category | Records | Reality |
|---|---:|---|
| **Other (uncategorized)** | 1,231,504 | ~80% of everything. Mostly mis-bucketed legislation/archives/bibliographic. A taxonomy debt. |
| Legislation | 219,410 | Huge count, thin epistemic value per row (statute *titles*). |
| Science | 55,712 | Mostly OpenAlex *metadata*, not extracted findings. |
| Clinical | 10,957 | ClinicalTrials.gov — genuinely valuable, underexploited. |
| Courts | 10,384 | Thin and templated (see below). |
| International | 3,257 | UN/NATO/treaties — high value, small. |
| Health | 2,606 | ICD-11/FAERS/essential-medicines — high value, small. |
| Finance | 379 | A rounding error. |

**The asymmetry in one sentence:** your *quantity* lives in low-epistemic-density sources (OpenAlex metadata 318,775; NARA archival catalog 176,003; foreign statute titles; Drugs@FDA approvals 85,068+46,255), while your *quality* — the contestable, high-stakes, "helps someone make a better decision" claims — lives in a handful of small sources and the curated case studies.

**Density map — sort your sources by epistemic value, not row count:**

- **High density, high value, UNDER-exploited (mine these):** voteview roll-calls (113,319 — see Part 4), Retracted Papers (26,624) + the 11,319 CONTRADICTS edges, ClinicalTrials.gov (10,957), SCOTUS/ECHR/ICJ/ICC opinions, UN Security Council resolutions with vote records (2,798), NIH Reporter grants (16,139), SIPRI military expenditure (8,435), UCDP conflict data (3,432).
- **High volume, LOW density (cap or compress these):** OpenAlex bibliographic (318,775 — "source-level provenance only"), NARA catalog (176,003), JACAR (44,600), Europeana WWI (10,000), the FDA approval firehose (helium/gas approvals repeated dozens of times), 50+ national statute-title dumps.
- **Started but EMPTY (either finish or hide):** `vdem_v1` = 1 record (V-Dem is a *premier* political-science dataset — a 1-row stub is a tragedy), `space_missions_v1` = 1, `who_gho_v1` = 5 (WHO Global Health Observatory has millions), `congress_stock_act_v1` = 8 (this is a *viral* feature — see Part 4), `slovenia_legislation` = 10, `IAU Constellations` = 1, `stasi_v1` = 2, `book-analysis` = 1.

**Two structural quality bugs found in the graph itself:**

1. **Search relevance is drowned by volume.** A query for **"helium"** returns 482 results that are almost entirely *"FDA Original Approval: HELIUM, USP… GAS;INHALATION"* repeated for every distributor — the element itself (chemistry, physics, discovery, the supply crisis) is buried. **"vaccine"** returns operations-research optimization papers, not vaccine science. High-volume institutional records are crowding out the claims people actually want. You need **per-source-type relevance weighting and aggressive dedup** (collapse 40 identical FDA gas approvals into one "FDA has approved helium for inhalation 40 times, 2016–2021" rollup claim).
2. **The edge graph is padded.** `/edges` is dominated by templated `Pakistan Code — … CITES / EVIDENTIARY —/100` self-references with no score. Your *valuable* edges (CONTRADICTS from retractions, FUNDED_BY to NIH grants) are buried under auto-generated legislative cites. Separate "structural" edges from "epistemic" edges in the UI and rank by the latter.

---

## Part 3 — Specific topics & datasets to add (not "fix 404s")

Organized by strategic value. The bias is toward **contested, decision-relevant, receipt-rich** topics — i.e., more *case studies*, fewer *scaffolding dumps*.

### 3A. The highest-value move: industrialize the case studies

Your About page is right — *the case studies are what the tool is for* — but there are ~6 of them against 1.5M scaffolding rows. Use OpenClaw to mass-produce *contested-claim receipts*, the thing nobody else has. Concrete near-term case studies, each with a real timeline + contradiction edges:

- **Science reversals / replication:** the amyloid-beta Alzheimer's hypothesis and the 2022 image-manipulation scandal; the Surgisphere/Lancet hydroxychloroquine retraction; Stanford/Stapel/Wansink (food-science) fabrications; power-posing; ego-depletion; the gut-microbiome overreach; Theranos.
- **Medicine where consensus *moved*:** hormone-replacement therapy (1990s→WHI→reappraisal); dietary fat & saturated-fat guidance; opioids & the Purdue/OxyContin record; Vioxx; beta-blockers in surgery; ulcers→H. pylori (a Nobel reversal you can tie to your Nobel dataset); peanut-allergy avoidance guidance reversal.
- **The contested questions that currently return "nothing found":** vaccines & autism (the Wakefield retraction is the *perfect* receipt — a paper, its 12 years to retraction, the GMC findings, the CONTRADICTS edges to the replication failures); does the death penalty deter; minimum-wage employment effects; nuclear power safety vs. coal; mask efficacy; lockdown effects. These are *exactly* the searches users run. Owning them with a structured-disagreement view (not a verdict) is the product.
- **"How power works" (your stated scope):** the tobacco "doubt is our product" pattern replicated across leaded gasoline, asbestos, PFAS/forever chemicals, sugar industry funding of nutrition science, fossil-fuel climate messaging. This is a *repeatable template* — the "manufactured doubt" receipt — and it's brand-defining.

### 3B. Deepen the spines you already started but left shallow

- **OpenAlex: go from metadata to claims.** Right now a science "receipt" is "this paper exists in this journal." Extract *the actual findings* (abstract claims, effect sizes, sample sizes, study type) and link them. This is the difference between a citation index and a knowledge graph. Pair every paper with its **replication/retraction/citation-sentiment** status.
- **ClinicalTrials.gov (10,957) → outcomes.** Link trials to their *results*, their publications, and **publication bias** (registered trials that never reported). "This drug's pivotal trial was registered, completed, and never published" is a killer receipt.
- **CourtListener is barely tapped.** SCOTUS = 400 opinions; circuits = 620; the bills-to-court linker produced **0 links** because the claim text is "a templated case-name summary." Ingest **opinion bodies and statutes-cited**, then the bill↔court linker activates and you get *"this law was challenged, here's the ruling"* — a genuinely valuable chain you've already scaffolded.
- **V-Dem (currently 1 row).** Varieties of Democracy is one of the most cited datasets in political science (democracy indices, 1789–present, every country). It would supercharge the Globe and the governance angle. This is the single highest-ROI "finish the stub" item.
- **WHO GHO (currently 5 rows).** Global Health Observatory — mortality, disease burden, coverage rates by country/year. Feeds the Globe and health case studies.

### 3C. New datasets that fit the editorial scope and add contestability

- **Government accountability:** GAO reports & recommendations; Congressional Research Service reports; agency Inspector-General findings; the Federal Register rule-making *with* public-comment counts; OMB regulatory cost-benefit analyses.
- **Money & influence (accountability, not markets — respects "no pure financial"):** you have FEC (3,500) and FARA (811) started — extend to **lobbying disclosures (LDA)**, **OpenSecrets-style donor→legislator→vote linkage**, and the **STOCK Act congressional trades** (your `congress_stock_act_v1` has 8 rows — this is a viral feature waiting to happen: "this member traded this stock N days before this committee vote").
- **Science integrity infrastructure:** PubPeer comments, Retraction Watch (you have 110 — the full DB is ~50k), the Open Science Framework registrations, COVID-preprint outcomes, ClinicalTrials results-reporting compliance.
- **Standards & measurement (pristine, high-trust anchors):** you have NIST constants (355), CODATA, PDG particles (226), periodic table. Add **IPCC assessment-report statements with confidence levels** (the IPCC literally publishes calibrated-uncertainty language — a perfect fit for your status model), **metrology/SI redefinitions**, **IAU resolutions** (tie to the Pluto case study).
- **International / conflict:** you have UCDP (3,432), SIPRI (8,435), UN SC resolutions (2,798) — add **ACLED** (conflict events), **Correlates of War**, **treaty ratification/withdrawal timelines**, **sanctions** (you have OFAC SDN 19,034 — link sanctions to the resolutions and events that triggered them).
- **Economics with provenance (not tickers):** you have FRED (4,349) and World Bank (54,567) — the valuable layer is **forecast-vs-outcome receipts**: CBO/Fed/IMF projections vs. what actually happened. "The CBO projected X; reality was Y" is a provenance product, not a financial one, and it's squarely in scope.

---

## Part 4 — VOTES deep-dive (you said it's great — here's what you might not know, and what to add)

**What you may not realize you already have:** the curated "US Congress Votes" view shows **505** roll-calls, but the underlying **`voteview_v1` pipeline holds 113,319 records.** Voteview is the canonical Poole-Rosenthal dataset behind **DW-NOMINATE** — *every* roll-call in US congressional history, every member, with ideal-point ideology scores. **You are surfacing less than half a percent of one of the best political-science datasets in existence.** That's the biggest "hidden gem" on the site. Plus `eu_parliament_votes_v2` = 24,224 and UN SC vote records (2,798) sit alongside it.

### Why Votes is structurally your best section
Roll-call votes are the rare data type that is simultaneously **high-volume AND high-epistemic-density**: each is an unambiguous primary-source fact (member X voted Y on bill Z on date D), they compose into *rich* derived claims (polarization, party unity, flip-flops), and they carry a built-in *receipt* (the official record). Most of your other high-volume sources are low-density; votes are the exception. Lean in hard.

### Exhaustive list of what to add to Votes

**Surface what's already ingested:**
- Expose the full **113k Voteview roll-calls**, not just 505. Member-level vote pages; bill-level vote pages; Congress-by-Congress.
- Add **DW-NOMINATE ideal points** (you have the source): every member placed on the economic & social dimensions, over time. This is the single most powerful thing you can build from data you *already hold*.

**Member-centric layer (you're currently bill-centric):**
- **Legislator profiles:** lifetime vote record, party-unity %, ideology trajectory, attendance/missed votes, "most/least predictable" votes.
- **Flip-flop detection:** members who voted opposite ways on substantively similar bills — an automatic, defensible "receipt."
- **Key-vote vs. show-vote classification:** distinguish substantive votes from the procedural/naming-bill noise that floods `/legislation` (16,478 bills, many "Reserved for the Speaker").

**Vote → money → outcome chains (this is where it gets powerful):**
- Link **FEC/lobbying/donor data → member → vote** ("members who voted Nay received $X from the affected industry"). You have FEC + FARA started.
- Link **STOCK Act trades → committee assignment → vote timing.**
- Link **vote → enacted law → court challenge → ruling** (combine voteview + congress bills + CourtListener). The full lifecycle of a law as one receipt.
- Link **sponsor/cosponsor networks** (who co-sponsors with whom — bipartisanship graphs).

**Analytical layer:**
- **Amendment and procedural votes** (cloture, motions to recommit) — often more revealing than final passage.
- **Committee votes** (where bills actually die).
- **Predicted vs. actual** outcomes; **"closest votes that flipped history"** (you already compute margins — CARES Act 47-47, reconciliation 215-214).
- **Presidential position vs. vote** (support scores).
- **Veto/override tracking.**

**International expansion (you have the spine):**
- Full member-level voting for **EU Parliament** (24k votes ingested) and **UK/Canada** divisions; **cross-national polarization comparison over time** (you already show UK avg 47.6% nay vs EU 14.9%).
- **UN Security Council & General Assembly** vote-pattern analysis (alignment blocs, veto usage) from the 2,798 SC records.

**The flagship "Votes" product:** a **"How did my representative actually vote — and who paid for it?"** page. Enter a name or ZIP → ideology score, key votes with receipts, donor-to-vote correlations, flip-flops, committee record. That is a *consumer-viral + civically important* artifact built almost entirely from data you already have.

---

## Part 5 — Hidden strengths to exploit (things you may be undervaluing)

1. **The retraction→CONTRADICTS auto-flip is your single most demo-able miracle.** 11,319 papers automatically marked disputed when CrossRef logged a retraction. *This is the entire thesis in one feature* — a knowledge base that changes its mind. It should be on the homepage, not buried in a changelog. Build a live "**Retraction Wall**": papers that flipped to disputed this week, with citation-impact ("this retracted paper is still cited by N others you might trust").
2. **You caught and deprecated a lying source.** `USPTO Patents (retired) — fabricated patent metadata confirmed on audit; 182 claims flagged DEPRECATED.` This is *gold* for trust-building. Most data products hide their mistakes; a public "**we audited a source, it failed, here's what we removed**" audit log is a neutrality flex. Make a `/corrections` page a first-class feature.
3. **The "Settling Curve" is a genuinely novel primitive.** Tracing a claim's epistemic arc (semaglutide: Phase 3 → approval → safety surveillance) is the kind of thing no competitor has. Generalize it into a gallery and make it the signature visualization.
4. **The Media-Coverage "dark-matter bills" analysis is a latent product.** "Which 119th-Congress bills the NYT covers vs. ignores" is media-criticism-as-data. Extend across outlets (WSJ, Fox, AP, Reuters) and you have a *bias-and-attention* dashboard newsrooms and researchers would pay for.
5. **The data model is ahead of the data.** Typed edges + meta-edges + epistemic-status lifecycle + threshold events + review queue is genuinely sophisticated infrastructure. The gap is population, not design — which is the good kind of gap to have. It means the API (Part 6) is closer than it looks.
6. **OpenClaw is a second company.** The autonomous-pipeline runtime that built 176 ingesters is, itself, a sellable "provenance-pipeline-as-code" engine. At minimum it's the story that makes the velocity credible to investors.
7. **The Globe time-machine.** 993k geocoded claims with an 1789→now slider and an "Origins/Connections" mode is a stunning top-of-funnel demo. Most people will never read a claim page but will *play* with the globe. Treat it as the marketing front door.

---

## Part 6 — The API you're closer to than you think

Because the data model already has claims + typed edges + status + provenance, a **read API** is mostly an exposure layer over what exists:

- `GET /verify?statement=...` → nearest claim(s), provenance grade, source list, contradiction edges, status timeline.
- `GET /claim/{id}` → the full receipt as JSON (status, sources, edges, settling curve).
- `GET /retractions/since/{date}` → a feed regulated/research customers will *pull daily*.
- A **browser extension / "Reader"** (you already have a "Reader" nav item) that overlays provenance grades on claims as you read the web — the consumer wedge that feeds the data flywheel.

Ship the retraction feed first: it's the lowest-effort, highest-trust, most-clearly-monetizable endpoint, and it's powered by the feature you already nailed.

---

## Part 7 — Sequenced roadmap

**Now (next 30 days) — credibility & surfacing, mostly using data you already have:**
1. Fix the `HARD_FACT`-on-empty-receipt labeling (Part 1). Highest priority.
2. Dedup/rollup the FDA-approval & statute-title firehoses; fix "helium"/"vaccine" relevance.
3. Surface the full 113k Voteview roll-calls + DW-NOMINATE (Part 4).
4. Promote the Retraction Wall, the `/corrections` audit log, and the Settling Curve to the homepage.
5. Re-categorize the 1.23M "Other" records (taxonomy debt).

**Next (1–2 quarters) — deepen the spine & build the wedge:**
6. OpenAlex metadata → extracted findings + replication status (turn the citation index into a claim graph).
7. Ship the **retraction feed API** + `verify` endpoint; land one design partner.
8. Industrialize **contested-claim case studies** (3A), starting with the ones that currently return "nothing found" (vaccines/autism, minimum wage, nuclear).
9. Finish the high-ROI stubs: V-Dem, WHO GHO, CourtListener opinion bodies (activates the bill↔court linker), STOCK Act.
10. Build the "How did my rep vote — and who paid?" flagship.

**Later (2–4 quarters) — the franchise:**
11. Vote→money→law→court lifecycle chains; cross-national vote analysis.
12. Manufactured-doubt template across tobacco/lead/asbestos/PFAS/sugar/climate.
13. Pharma claim-substantiation or research-integrity pilot (the compliance revenue line).
14. Multi-outlet media-attention dashboard.
15. The Reader browser extension as the consumer flywheel.

---

### The one-paragraph version
You've built an extraordinary *quantity* engine and an even better *quality* data model, but they're out of balance: the badges over-promise, the receipts are mostly empty, and your best assets (113k roll-calls, the retraction auto-flip, the case studies, OpenClaw) are under-surfaced. The next chapter isn't more rows — it's **make the receipts real, expose the gems you already have, and turn case studies from a craft into a factory.** Do that and the API and compliance businesses in the companion memo become reachable.
