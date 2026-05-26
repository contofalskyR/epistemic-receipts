# Epistemic Receipts: A Provenance-First Knowledge Graph of Institutional Claims

**Robert Contofalsky**
*Rutgers University*
*Draft — May 2026*

---

## Abstract

Most public knowledge bases store facts as static assertions: subject, predicate, object. They tell you *what* is believed but not *when* it became believable, *who* established it, or whether it has since been disputed. We present **Epistemic Receipts**, a knowledge graph that models facts as events with explicit provenance chains rather than timeless triples. Each claim carries a status (`HARD_FACT`, `DISPUTED`, `NEVER_RESOLVES`), a type (`EMPIRICAL`, `INSTITUTIONAL`, `INTERPRETIVE`, `HYBRID`), and an append-only log of `ThresholdEvent` records that record every status transition along with the source that triggered it. The current instance holds 660,000+ structured claims drawn from 91+ primary institutional pipelines spanning national legislatures, regulatory bodies, international courts, scientific registries, and historical archives. We argue that the receipt — not the assertion — is the appropriate atomic unit for a fact base meant to survive scrutiny, AI training, and time.

---

## 1. The Problem: Facts Without Receipts

Public knowledge graphs have largely converged on a triple-store abstraction: `(subject, predicate, object)`, optionally with confidence scores or named graphs. Wikidata, DBpedia, ConceptNet, and the various enterprise knowledge graphs that power consumer search treat a fact as a thing that *is true* until edited otherwise. This is a serviceable approximation for many lookup tasks. It is a poor approximation for the way institutional knowledge actually behaves.

Institutional facts are not timeless. They have moments of becoming. A bill is introduced, debated, amended, voted on, signed, codified, challenged, upheld, superseded. A clinical trial is registered, enrolled, completed, reported, retracted. A patent is filed, granted, litigated, expired. At each stage, the *epistemic status* of the underlying claim changes — and the change is itself the most important data point. Yet the dominant fact-base abstraction collapses this trajectory into a single mutable cell. When the Cohen-Boyer recombinant DNA patent (US4237224) expired in 1997, no triple-store representation natively captured the difference between "claim was false before 1980," "claim was true and exclusive 1980–1997," and "claim is true and public-domain after 1997." The provenance is reconstructable from edit history if you trust the editor's notes; it is not first-class.

This matters for three reasons that have grown more acute in the past five years.

**First, AI systems trained on these graphs inherit the flattening.** A large language model that ingests Wikidata learns that a claim either holds or does not. It does not learn — because the data does not encode — that the claim's truth value is a function of when you ask, what institution you trust to resolve it, and whether that institution has since reversed its position. The result is the well-documented behavior in which an LLM confidently asserts the title of a patent and gets the inventors wrong because the patent number it remembered was assigned to a different invention four years later (see §4 on the USPTO fabrication incident in this project's own audit log).

**Second, regulatory and legal work is structurally cross-jurisdictional and increasingly so.** A pharmaceutical compliance team needs to know not just whether semaglutide is approved, but in which jurisdictions, when, with what labeling, under what regulatory class, and whether any of those approvals have been withdrawn or amended. The relevant evidence lives in openFDA, the EMA database, the UK MHRA, Health Canada, the Therapeutic Goods Administration, and a dozen smaller national regulators. Each speaks its own schema and exposes its own audit trail. The compliance question is *fundamentally* about the receipts; the lookup is incidental.

**Third, the falsification problem is now industrial.** Generative models can fabricate plausible-sounding citations at a rate that exceeds any human reviewer's ability to debunk them. The defensive move is not "trust no source" but rather "demand a receipt" — a verifiable, timestamped pointer to a primary record at an institution that takes responsibility for that record. A fact base that cannot produce receipts cannot defend its claims against an adversarial generative substrate. The Pipeline 5 (USPTO patents) retirement documented in this project's `AGENTS.md` is the worked example: 182 records ingested from model recall rather than a primary API turned out to include at least two confirmed fabrications, including a patent number whose actual subject was a different invention with different inventors. Retiring the pipeline cost nothing structurally — every record was tagged `verificationStatus: DEPRECATED` and excluded from default views — *because the receipt model made the retirement legible*. In a flat triple-store, the same incident would have required either deletion (losing the audit trail) or trust in editor-written rationales (recreating the problem).

The premise of Epistemic Receipts is that these three pressures point at the same architectural fix: stop storing facts. Start storing receipts.

---

## 2. The Epistemic Receipt Model

A receipt, in this system, is a tuple of four first-class objects: a `Claim`, a `Source`, an `Edge` connecting them, and one or more `ThresholdEvent` records that mark when the claim's epistemic status changed and which source triggered the change. We describe each in turn and then show how they compose.

### 2.1 Claim

A `Claim` is the unit of assertable content. It carries:

- `text` — natural-language statement of the claim.
- `currentStatus ∈ {HARD_FACT, DISPUTED, NEVER_RESOLVES}` — the present epistemic state. `NEVER_RESOLVES` is reserved for claims that are categorically not subject to evidentiary settlement (e.g., interpretive judgments, contested normative questions).
- `claimType ∈ {EMPIRICAL, INSTITUTIONAL, INTERPRETIVE, HYBRID}` — what kind of claim it is, which determines what would count as resolution. An `EMPIRICAL` claim resolves to measurement; an `INSTITUTIONAL` claim resolves to an institutional act (a vote, a ruling, an enactment); an `INTERPRETIVE` claim does not resolve at all in the same sense.
- `claimEmergedAt` with `claimEmergedPrecision ∈ {DAY, MONTH, QUARTER, YEAR}` — when the claim itself first became coherent (distinct from when it became true). A pre-Columbian claim about Australia did not exist as a contestable statement before the entity existed.
- `verificationStatus ∈ {VERIFIED, PROVISIONAL, DISPUTED, DEPRECATED}` — an orthogonal axis tracking the *audit* state of the record itself, not the truth of the claim it asserts. A claim can be `HARD_FACT` and `DEPRECATED` simultaneously: the claim is true but the record we ingested for it has been retired (as with Pipeline 5).
- `humanReviewed`, `autoApproved`, `ingestedBy` — provenance of the *record*, not the *fact*. These are separate signals and the AGENTS.md policy is explicit that conflating them corrupts the audit trail.

Crucially, a claim does not store its own truth as a boolean. Truth, in this model, is whatever the latest valid `ThresholdEvent` says it is.

### 2.2 Source

A `Source` is the primary document that establishes a fact: a Federal Register notice, a Hansard transcript, a CourtListener opinion, a GenBank accession, a Nobel laureate citation. Sources carry a `methodologyType ∈ {primary, derivative, opinion}` that determines how much epistemic weight an edge from this source can carry. A primary source — the institution's own canonical record — can trigger a `HARD_FACT` transition. A derivative or opinion source cannot, no matter how reputable.

Sources are themselves first-class enough to have `SourceRelationship` records (funded-by, employed-by, affiliated-with) and `SourceCredibilityEvent` records that track credibility downgrades and restorations. A retraction by a journal does not just affect the retracted paper; it leaves a credibility event on the publishing source.

A separate `WikidataLink` table cross-references Sources to Wikidata Q-numbers for enrichment, with the explicit constraint that Wikidata is never authoritative for `HARD_FACT` transitions. It is an enrichment surface, not a resolver. This distinction — between enrichment and resolution — is structural, not editorial, and prevents the slow drift in which secondary aggregators become de facto authorities.

### 2.3 Edge and EdgeRevision

An `Edge` connects a Source to a Claim with a `type ∈ {FOR, AGAINST, CITES, RETRACTS, CORRECTED}` and an `evidenceType ∈ {EVIDENTIARY, PROCEDURAL, ARGUMENTATIVE}`. The distinction between evidence types is critical for downstream reasoning. A procedural edge (the Senate held a cloture vote) is not interchangeable with an evidentiary edge (a clinical trial measured an outcome), even when both nominally support the same claim.

Edge weights are not stored on the Edge itself. They live in `EdgeRevision`, an append-only log of `(priorScore, newScore, reason, changedAt)` tuples. The current weight is the latest revision; the history is the audit trail. This mirrors how reputation actually moves in institutional settings — through documented revisions, not silent overwrites.

### 2.4 MetaEdge

A `MetaEdge` is an edge targeting another edge: suppression, amplification, labeling, demotion. This is the model's way of representing the act of one source acting on the epistemic standing of another's contribution — a journal retracting an article, a court vacating a lower-court opinion, a platform labeling a post. MetaEdges are necessary because the act of contesting an edge is itself a fact with provenance, and demands the same receipt treatment as the original.

### 2.5 ThresholdEvent: The Receipt Proper

The `ThresholdEvent` table is the heart of the model. Each row records:

- `claimId` — which claim's status changed.
- `triggeredBy` — free-text description of the institutional act (e.g., "FDA NDA approval," "Royal Assent," "Supreme Court judgment").
- `triggeredBySourceId` — the auditable source record that documents the trigger.
- `confirmedBy` — the human or automated agent that promoted the event.
- `evidenceSnapshot` — a JSON freeze of the evidence as it stood at the moment of transition, so the receipt remains interpretable even if upstream records later change.
- `suggestedEventId` — optional pointer back to a `SuggestedThresholdEvent` written by an AI agent and subsequently promoted by a human (see §6).

`ThresholdEvent` is append-only. A claim's life is the ordered list of its `ThresholdEvent` rows. To ask "when did this become an established fact" is to read the first row whose transition was to `HARD_FACT`. To ask "has it ever been disputed" is to scan for transitions back to `DISPUTED`. To ask "what would change my mind" is to look at the `claimType` and read off what evidence type the model considers admissible.

### 2.6 What the Composition Yields

Putting these together: a fact, in this system, is not a triple. It is a `Claim` whose `text` describes the proposition, whose `currentStatus` reports the present epistemic state, whose `ThresholdEvent` log reports the trajectory by which it arrived there, whose `Edge` set documents the sources cited in each transition, and whose `MetaEdge` set documents any contestation of those edges. Reading a single claim returns not a value but a complete provenance chain.

The cost of this model is verbosity. The benefit is that every assertion the system makes is challengeable in the same medium it was made in. There is no privileged narrative layer; the receipts *are* the narrative.

---

## 3. Architecture and Scale

The current production instance is a Next.js 14 application deployed on Vercel, backed by Neon Postgres through Prisma. The data layer is intentionally boring: a single relational schema with foreign keys and append-only history tables, no graph database, no triple store. The expressive work is done by the schema design, not the engine.

### 3.1 Ingestion pipelines

As of May 2026 the system runs **91+ ingestion pipelines**, each implemented as a standalone TypeScript script in `scripts/` that calls a primary institutional API and writes `Claim`, `Source`, and `Edge` records (plus an initial `ThresholdEvent` when the institutional act warrants `HARD_FACT` status). The pipeline registry in `AGENTS.md` enumerates current state; selected anchors include:

| Domain | Pipelines (selection) | Approx. records |
|---|---|---|
| US legislation | Congress enacted laws, Federal Register significant rules, SCOTUS via CourtListener | 366 + 1,915 + 300 |
| Comparative legislatures | Bundestag (DE), Riksdag (SE), Tweede Kamer (NL), Nationalrat (AT), Oireachtas (IE), Parliament of Canada, UK Public General Acts, and 40+ more | ~30,000+ |
| Regulatory / scientific | openFDA (drug events + labels), ClinicalTrials.gov, NIH RePORTER, SEC EDGAR | ~4,000 |
| International law | UN Security Council resolutions, ECHR, ICC, African Court | 2,798 + planned |
| Academic | CrossRef Retractions, Nobel Prize laureates 1901–2024, OpenAlex | 26,595 + 1,688 + (in progress) |
| Reference scientific | NASA Exoplanet Archive, USGS earthquakes M6.5+ since 1900, IAU constellations, GenBank, PubChem | 6,277 + 4,696 + 88 + 99 + 355 |
| Historical archives | JFK files, CIA FOIA, NARA, IPN, JACAR (WWII Japanese archives, ~360k records) | (large, in progress) |

Each pipeline is required to satisfy the **reference-tier test** documented in `AGENTS.md`: of the next 20 plausible case studies built on the system, at least some would *directly cite individual records* from this dataset. Datasets that fail the test — for example, raw individual FAERS adverse-event reports, where case studies cite analyses rather than individual reports — are explicitly *not* ingested in bulk. They are linked as background sources from case-study claims instead. This editorial constraint is what keeps the database from drifting into a generic data lake; the receipt has to be load-bearing for the inclusion to justify itself.

### 3.2 Auxiliary structures

Beyond the core schema, several support tables enrich what a receipt can carry:

- `PoliticalContext` attaches to legislative `Source` records and captures head of government, governing party, majority type, and coalition partners at the moment of enactment. A receipt for a German law thus carries not just the law text and date but the composition of the Bundestag that passed it.
- `LegislativeVote` and `MemberVote` capture roll-call vote breakdowns. The current instance holds **2,948 LegislativeVote rows** across US Congress, EU Parliament, and the UK Parliament, with per-party tallies and individual member votes where the upstream API exposes them. This is what powers the polarization and party-line analysis at `/stats`.
- `AcademicField` and `Topic` provide hierarchical classification, independent of the source's own taxonomy.
- `Polity` separately catalogs governments with start/end years (including BCE), allowing claims to attach to political entities that no longer exist without overloading the modern country-code dimension.

### 3.3 Surfaces

The public surfaces are deliberately thin:

- `/claims` paginates the entire fact base (100 per page, ~6,600 pages at present).
- `/search` provides full-text search across claim text.
- `/stats` exposes legislative vote analysis: polarization scores, party-line breakdowns, cross-jurisdictional comparison.
- `/globe` is a WebGL visualization of claim density and origin geography (heatmap and origins modes), useful for spotting jurisdictional gaps.

The surfaces are deliberately not the product. The product is the schema and the discipline by which it is populated.

### 3.4 Engineering invariants

Three operational invariants are encoded as project policy in `AGENTS.md` and worth surfacing here because they are load-bearing for the integrity claim:

1. **`humanReviewed` and `autoApproved` are separate signals and must not be conflated.** If a filtering bug hides auto-ingested records, fix the filter, not the field. Setting `humanReviewed: true` to work around visibility issues corrupts the audit trail.
2. **Ingester counters are not the source of truth for what was written.** Closure-scope bugs and silent transaction rollbacks can cause progress logs to misreport. Every pipeline run is verified against database state with count queries.
3. **Curated lists in `HARD_FACT` pipelines require verifiable sources.** Training-data recall is not a verifiable source. The USPTO pipeline retirement is the canonical incident here; the policy is the institutional response.

These are not aspirational. They are enforced by the existence of the `verificationStatus: DEPRECATED` mechanism, by the retired-pipeline registry, and by the AGENTS.md preamble that any contributor encounters before writing a single ingester.

---

## 4. Cross-Jurisdictional Intelligence

Single-source fact bases are commodity. The structural value of Epistemic Receipts comes from holding parallel institutional records across jurisdictions in the same schema. Three observations follow from doing this systematically.

**Comparable acts are not comparable receipts.** When the Bundestag passes a `Gesetz` and the UK Parliament passes a `Public General Act`, the *acts* are roughly analogous; the *procedural receipts* are not. The Bundestag receipt includes coalition composition data because the DIP REST API exposes it; the UK receipt traditionally does not, because the relevant data lives separately in the Hansard transcript. Storing both in the same `LegislativeVote` and `PoliticalContext` shape forces the schema to confront the asymmetry, which in turn surfaces where downstream comparative analysis is structurally underdetermined. A flat triple-store hides this; a receipt-first model exposes it.

**Cross-jurisdictional contradiction is detectable mechanically.** When two `HARD_FACT` claims attached to primary regulatory sources in different jurisdictions disagree on the same underlying empirical question — e.g., approved indications for a drug, classification of a substance, designation of an organization — the contradiction is a queryable structural property of the graph, not a research finding that requires a human to assemble. The reasoning is straightforward: same claim text (or same `parentClaimId` in the claim hierarchy), incompatible status, different `triggeredBySource` jurisdictions, both with `methodologyType: primary`. This is the kind of analysis that pharma regulatory teams currently pay analysts to do by hand.

**Editorial connections remain editorial.** A core policy in `AGENTS.md` is that cross-references between bulk-ingested claims and curated case studies are editorial work, not algorithmic. Ingesters produce facts; humans curate the `CITES` edges that compose them into narratives. This is not a limitation; it is the design. Automated cross-referencing across jurisdictions produces plausible-looking junk at industrial scale. The receipts make the editorial work *cheaper* — each curated connection has primary-source backing on both ends — without pretending to eliminate it.

The point is not that the system answers cross-jurisdictional questions better than a sufficiently skilled human researcher with sufficient time. The point is that it answers them *in a form that another human can audit in the same medium*, which a skilled researcher's notes generally cannot offer.

---

## 5. The Self-Auditing Vision

The receipt model is designed to be queryable by autonomous agents, not just human readers. The roadmap places an embedded AI agent at the center of the medium-term work, with a tightly scoped mandate:

1. **Re-query primary APIs on a schedule** for any `Source` whose underlying institutional process is still active (bills in committee, trials in progress, regulations under review).
2. **Detect status changes** — a bill receives Royal Assent, a trial completes, a regulation is superseded, a paper is retracted — by diffing the latest API response against the most recent `ThresholdEvent`'s `evidenceSnapshot`.
3. **Write `SuggestedThresholdEvent` records** with full reasoning and a pointer to the source that the agent believes resolved the change.
4. **Surface the suggestion for human promotion** to a `ThresholdEvent` proper.

The schema is already shaped for this. `SuggestedThresholdEvent` exists explicitly to hold AI-authored proposals that have not yet been promoted. The promotion path — `SuggestedThresholdEvent` → `ThresholdEvent` with the suggestion's id carried in `suggestedEventId` — preserves the audit trail of "an AI thought this; a human signed off." The `AiJob` table provides a stub for the queue. Nothing in the data layer needs to change to make the agent real.

What does need to change is the operational discipline around it. Three policies will govern the agent in production:

- **The agent never sets `humanReviewed: true` on its own output.** The promotion to a confirmed `ThresholdEvent` is a separate gesture that requires a `confirmedBy` field naming a human.
- **The agent's suggestions are subject to the same reference-tier and verifiable-source rules as any other ingestion path.** A suggestion that cannot point to a primary source URL is discarded, not stored.
- **Agent runs are themselves logged as `SourceCredibilityEvent`-style records** so that a future audit can ask "what did the agent claim on date X, and was it later confirmed or reversed."

The endpoint of this work is a knowledge graph that evolves in continuous conversation with the institutions it documents — bills changing status as they pass through committee, trials transitioning as they complete, retractions appearing as journals issue them — without losing the property that every transition is a receipt that a skeptical reader can challenge. This is the substantive sense in which the graph is "living": not that it is updated frequently, but that every update is itself an artifact.

---

## 6. Use Cases

The receipt model is not optimized for any single application. The bet is that several distinct workflows share the same underlying need for verifiable provenance, and that consolidating the substrate creates leverage across them.

**Regulatory and compliance intelligence.** Pharmaceutical, legal, and compliance teams need cross-jurisdictional structured queries over current and historical regulatory state: "which drugs containing this active ingredient are approved in any G20 country as of date X, and how have those approvals changed since date Y." The current public surface answers a non-trivial subset of this question; a paid API tier that exposes the same data with SLA guarantees is a near-term path. The competitive substitute — manually maintained spreadsheets of regulatory state at large enterprises — is widespread, expensive, and consistently out of date.

**Academic citation infrastructure.** Citation today points at documents; for institutional claims this is the wrong granularity. A historian arguing that a particular Senate vote shifted in 1972 wants to cite the *vote*, not just the Congressional Record volume. A pharmacologist arguing that a drug was withdrawn in one jurisdiction but not another wants to cite the *withdrawal event*, not just the document that announced it. Epistemic Receipts assigns durable identifiers to claims and to the `ThresholdEvent` records that establish them, making versioned citation possible: cite-by-claim-and-event rather than cite-by-document. This is a natural fit for citation infrastructure projects that have struggled to operationalize provenance below the document level.

**AI training and evaluation.** LLM fine-tuning corpora and RLHF datasets have a chronic provenance problem: the model learns assertions without the receipts that would let downstream evaluators check whether the assertion is still correct as of the model's deployment date. Epistemic Receipts emits structured records that explicitly carry the trigger source, the trigger date, and the current status, in a shape that downstream consumers can use either as training data (with claim, status, and provenance jointly modeled) or as an evaluation harness (test whether the model's output matches the current `currentStatus`). The `claimType` distinction is particularly useful for evaluation, because it prevents the common confusion in which a model is penalized for failing to "settle" an `INTERPRETIVE` claim that was never meant to settle.

**Newsroom verification.** Investigative reporting routinely re-derives provenance chains that another reporter derived three years ago and never structurally captured. A fact-provenance tool seeded with primary-source ingesters across legislatures, courts, and regulators reduces that re-derivation cost by an order of magnitude. The newsroom doesn't need the AI agent at all for this; they need the receipts and the search surface.

These applications share a common technical posture toward the database: read-heavy, append-only, history-sensitive. The schema is shaped accordingly.

---

## 7. Conclusion

Knowledge graphs that flatten institutional reality into timeless triples are no longer fit for purpose. They cannot survive the generative pressure to fabricate; they cannot represent the temporal trajectory of an institutional fact; they cannot serve the cross-jurisdictional comparative work that compliance, scholarship, and journalism increasingly demand.

The Epistemic Receipt model proposes a structural alternative: store facts as receipts. A receipt is a claim plus a provenance chain plus an append-only log of the institutional events by which the claim acquired and may yet lose its status. The model is built out of boring parts — Postgres, Prisma, TypeScript ingestion scripts — but the discipline by which those parts are populated is the point. 660,000+ claims across 91+ pipelines establishes that the model scales; the retirement of Pipeline 5 establishes that the model fails gracefully; the planned autonomous agent establishes that the model is ready for the next pressure wave from generative systems.

The bet is that in a world where confidently-asserted text is essentially free, the scarce resource is *the receipt*. This project is an attempt to take that scarcity seriously at the level of the data model itself.

---

*Source code, schema, and pipeline registry are available at the project repository. Comments on this draft are welcome at robert.contofalsky@rutgers.edu.*
