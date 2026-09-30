# What problem does this solve? (the observatory thesis)

*Robert + Claude, 2026-07-08. Written the night the corpus hit ~177k curves.
This is the product's north-star document. The launch-research report
(marketing/launch-research-report.md) is the how; this is the why.*

## The wrong fight

For looking up a fact — "was Pluto a planet?" — Google and Wikipedia win,
today and forever. Wikipedia's prose narrative of a famous case will always
beat a structured timeline for casual curiosity. That fight is unwinnable and
not worth funding. This product is not a lookup.

## The right fight

The curious person's question shifts from a fact to a **pattern**:

- How often does settled law actually get reversed?
- What's the half-life of a scientific consensus?
- Which fields retract fastest? How long does a statute live before repeal?
- What did the courts believe while the literature already believed otherwise?
- When institutions bury evidence, how long does it stay buried?

Google has nothing for these. Not "worse results" — nothing. They can only be
answered by a corpus where every status change is dated and sourced, and this
is the only such corpus that exists.

**The revelation is not "here's a fact you didn't know." It is "knowledge has
a shape, and nobody had ever plotted it before."**

## The OWID lesson

Nobody visits Our World in Data to look up France's GDP — Google wins that.
They visit because OWID showed them the child-mortality chart: a pattern that
could not exist without the assembled dataset underneath. The dataset is the
substrate; the chart is the product.

Here: the 1.76M claims are the substrate. The settling-rate page, the
reversals atlas, the suppression records, the refusal ledger — those are the
charts. The honest v1 gap is not the corpus (done); it is the thinness of the
revelation layer on top of it — roughly five such pages when there could be
thirty.

The future version that wows the curious is **not more claims — it is more
questions asked of the claims we already have.** Each new question is a query
plus a page (days, not ingestion-years), and each doubles as launch content
(the Substack essay, the r/dataisbeautiful visualization, the digest issue):

- "The half-life of knowledge, measured."
- "Every reversal of settled American law, on one page."
- "The year in unraveling: everything that stopped being true in 2026."

## The steer (Robert, 2026-07-08): trim the fat

The settling curve should be **steered toward the domains where knowledge
status genuinely moves** — where second documents are abundant, so curves
bend instead of lying flat:

- **Law & courts** — overrulings, precedent erosion (proven: SCOTUS arcs).
- **Legislation** — repeals, amendments, sunset clauses (proven: 442 NZ arcs;
  EUR-Lex / legislation.gov.uk force-status queued in briefing 08).
- **Scientific discovery via OpenAlex** — 318,775 papers already in the
  corpus; curve them through retraction/correction/replication status. The
  DOI identity join openalex ↔ crossref_retractions is ALREADY in the
  briefing-08 tier-2 queue — "both halves of thousands of arcs may already be
  in the DB." This is the single highest-value pipeline on the board.
- **RCTs & medical claims** — trials ↔ approvals ↔ withdrawals
  (clinicaltrials ↔ drugsatfda joins, FDA withdrawal notices, WHO EML
  deletions — all queued). The "medical reversal" literature (Prasad/Cifu's
  ~400 documented reversals of established practice) is a ready-made curated
  seed pipeline with a citable source.
- **Journalism-facing contested claims** — the editorial layer where the
  digest lives.

**The fat being trimmed:** the born-static reference bulk — archival catalogs
(NARA), chemical/medical ontologies (ChEBI, RxNorm, MeSH), taxonomies,
constellation lists. A NARA photograph's production date will never be
contested; its curve is honest but inert. This bulk KEEPS its roles — scale,
substrate for aggregate statistics, proof of the refusal-ledger discipline —
but it stops receiving effort, stops leading demos, and stops being how the
product describes itself. No deprecation, no deletion: a re-aim.

**One sentence:** Google answers "what is true." Wikipedia answers "what
happened." Epistemic Receipts answers "how did we come to believe it, how
long did it hold, and what does that look like across a million claims" — and
concentrates that answer where belief actually moves: law, legislation,
science, medicine.
