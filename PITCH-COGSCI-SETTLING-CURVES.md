# Settling Curves for Cognitive Science

*One-pager for discussion — Robert Contofalsky, draft 2026-07-04*

## The idea in one sentence

A curated, citable registry that records the **status trajectory of empirical claims in cognitive science** — when a finding entered the literature, when it was contested, and when (if ever) the field's evidence adjudicated it — as dated, sourced transitions rather than as narrative.

## The framing

A scientific field maintains something like a posterior over its own claims, updated by discrete evidence events: a replication report, a meta-analysis, a registered adversarial collaboration. Today that belief state is invisible — distributed across citation patterns, review articles, and conference hallway consensus. The instrument makes the update history explicit: each claim gets a **settling curve**, a sequence of dated status transitions (RECORDED → CONTESTED → SETTLED / REVERSED / ABANDONED), each anchored to the specific document that caused it, each tagged with the community that ratified it (expert literature, institutional, judicial, market). The curve is the field's inference process, made visible and citable.

Two design principles keep it rigorous: **(1) status, not truth** — the registry records what the documentary evidence shows the field concluded, never the curators' own verdict; **(2) no document, no transition** — a claim's status changes only when something citable and dated changed it. "Everyone knows that finding is dead" is not a receipt until a review, replication, or retraction wrote it down.

## Why it doesn't exist yet

scite tracks citation sentiment (supporting/contrasting) but has no time axis and no status. MetaLab maintains living meta-analyses but per-phenomenon effect sizes, not claim trajectories. Curate Science / FORRT catalogue replications but not the arc a claim travels through communities. Retraction databases only see formal retractions — the rarest way findings die. The dated, cross-community status trajectory is unoccupied territory.

## The seed corpus (why cog sci is the right field)

Cognitive science supplies every curve shape needed to demonstrate the instrument honestly:

- **The long arc:** the mental imagery debate (Kosslyn–Pylyshyn) — decades of contest, partially adjudicated by neuroimaging.
- **A live contest:** cognitive penetrability of perception — Firestone & Scholl (2016, BBS) contesting forty years of top-down-effects findings; slots vs. resources in VWM; the bilingual executive-function advantage.
- **Clean reversals:** ego depletion (2016 registered replication report); working-memory training transfer (Melby-Lervåg & Hulme meta-analyses); the action-sentence compatibility effect (multi-lab replication).
- **A reversal of a debunking:** the hot hand (Gilovich et al. 1985 → Miller & Sanjurjo 2018). Nothing but a trajectory can represent this shape.
- **Settled positives as anchors:** spacing effect, testing effect, infant statistical learning. (An instrument that only shows failures is a gotcha site; most curves should end well.)
- **Cross-community transitions:** brain-training claims — contested in the literature, then a dated *regulatory* transition (FTC/Lumosity settlement, 2016). No meta-analytic database can represent a claim moving between expert and institutional communities.

Launch scope: **~100 claims in perception and cognition**, curated by named contributors, each transition documented — not a scraped corpus.

## Methodological commitments (the respectability requirements)

1. Every transition cites its adjudicating document with date and DOI; transition criteria are written down and versioned before curation starts.
2. Where possible, transitions carry a quantitative anchor — the cumulative meta-analytic effect estimate at that date — so the curve has numbers under the labels.
3. Named curators; contested statuses require two-curator agreement.
4. **Right of reply:** original authors get a visible response slot on any claim marked CONTESTED or REVERSED.
5. Open data with a versioned DOI (Zenodo); BibTeX/RIS export per claim; methods preprint (PsyArXiv) before any publicity.

## The research payoff (this is not just service work)

The registry *is* a dataset: dated status transitions across ~100 claims support survival analysis on the field's self-correction — how long does a contested finding take to resolve? Does resolution speed differ by subfield, methodology, or effect size of the original? Which evidence genres (RRRs vs. meta-analyses vs. critiques) actually move status? That's a meta-science paper (AMPPS / Meta-Psychology) with the instrument as its engine, and plausibly a dissertation component rather than a competitor to one.

## What already exists

The full technical stack is built and running in production for a general-domain version (epistemic-receipts): claim/transition schema, curve visualization, deterministic + LLM-assisted curation pipelines with document-verification discipline, export formats, and a public corrections log. The cog-sci instrument is a scoped, curated instance — the engineering cost is already paid; the work is editorial and methodological.

## The ask

1. Your read on the framing and the transition criteria — where would a reviewer at *Psych Review* or a VSS audience push back?
2. A one-hour seed-claim session: the 20 findings in perception/cognition whose trajectories the field would most want to see written down.
3. Whether RuCCS is the right home (hosting, a couple of curator-collaborators, and the credibility of an institutional address).
4. Scope check: is "perception and cognition, 100 claims" the right first bite, or narrower still?
