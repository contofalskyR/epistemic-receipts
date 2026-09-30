# Epistemic Receipts: A Structured Knowledge Graph for Verifiable Claims

**Robert Contofalsky**  
Department of Psychology, Rutgers University  
Draft: May 25, 2026

---

## Abstract

The internet has no audit trail for facts. Claims circulate without timestamps, source chains, or verification status — making it structurally impossible to determine when a claim became verifiable, by what evidence, and at whose authority. This creates compounding failures: AI hallucinations built on ungrounded corpora, citation rot in academic literature, and misinformation that exploits the absence of provenance. Epistemic Receipts is a structured knowledge graph that addresses this gap directly. The system encodes verifiable claims as typed nodes with explicit provenance chains (Source → Edge → Claim), a categorical verification status (HARD\_FACT / PROVISIONAL / DISPUTED / DEPRECATED), and a ThresholdEvent — the immutable record of the moment and source that elevated a claim to verified status. As of May 2026, the database contains approximately 141,900 claims, 140,500 sources, and 141,500 edges, drawn from 25+ authoritative API sources across FDA drug regulation, seismic science, scientific retractions, international legislation, judicial decisions, and health metrics. This paper describes the epistemic problem motivating the project, the architecture of its solution, the current data assets, and its roadmap toward a self-auditing, living knowledge graph.

---

## 1. The Problem: Epistemic Infrastructure Does Not Exist

### 1.1 The Provenance Gap

Every factual claim exists in time. A drug was approved on a specific date. A law was enacted under a specific government. A scientific paper was retracted after a specific investigation. A seismic event occurred at a specific magnitude, at specific coordinates, as recorded by a specific instrument network. These timestamped, source-anchored facts are not merely useful — they are what distinguishes a verifiable claim from an assertion.

Yet the information environment treats facts as static and undated. Wikipedia entries do not indicate when a claim became verifiable. News articles cite facts without indicating the primary source chain behind them. Academic papers cite secondary literature that cites other secondary literature, creating chains that eventually lead to a single measurement or institutional record that itself may no longer be accessible. The result is a flattened epistemic landscape in which a 1965 finding and a 2024 replication carry the same undecorated confidence.

This is not primarily a quality-of-information problem. It is an architectural one. The web has no native layer for provenance metadata on factual claims. HTML encodes content and presentation; it does not encode epistemic state.

### 1.2 Three Downstream Failures

The absence of epistemic infrastructure produces at least three distinct classes of failure:

**AI hallucination.** Large language models trained on undated, unsourced web corpora inherit all of the provenance failures embedded in that corpus. They cannot distinguish a well-sourced claim from a confidently stated falsehood. Retrieval-augmented generation (RAG) systems improve on this by grounding generation in retrieved documents, but they remain limited by the quality of their retrieval corpus: if the corpus does not encode verification status or source chains, RAG cannot recover that information at inference time. The result is confident generation with no ability to flag claims that are disputed, retracted, or jurisdiction-specific.

**Citation rot and retraction blindness.** Approximately 10,000 scientific papers are retracted annually (Brainard & You, 2018), yet citations to retracted papers continue to accumulate after retraction at a rate that is only partially explained by publication lag (Budd et al., 1998; Schneider et al., 2020). CrossRef's retraction data — one of the sources feeding Epistemic Receipts — identifies ~26,500 retracted papers. Many of these remain cited in downstream literature without any indication of their retracted status. There is no operational infrastructure to flag, in context, that a cited paper was retracted after the citing paper was written.

**Regulatory compliance blindness.** In highly regulated domains — pharmaceutical approval, financial compliance, legislative interpretation — the effective date of a rule change is as important as the content of the rule. A drug interaction warning added to an FDA label in 2022 did not apply to prescriptions made in 2019. A financial regulation enacted in the Bundestag under coalition government X may have been amended under government Y. Without timestamped, government-annotated regulatory records cross-referenced to a political context layer, compliance analysis requires bespoke research for every query.

### 1.3 The Root Cause

These failures share a common root: the web encodes facts but not the epistemic conditions under which they became facts. There is no standard representation for *when* a claim became verifiable, *what* made it verifiable, or *what* would falsify it. Epistemic Receipts is an attempt to build that layer.

---

## 2. The Solution: Epistemic Receipts

### 2.1 Core Concept

An "epistemic receipt" is the immutable record of the moment a claim crossed the threshold into verified territory — analogous to a blockchain transaction receipt, but for facts rather than value transfers. Just as a financial receipt encodes the amount, timestamp, merchant, and transaction hash, an epistemic receipt encodes:

- **The claim**: a structured text assertion
- **The verification status**: HARD\_FACT / PROVISIONAL / DISPUTED / DEPRECATED
- **The provenance chain**: Source → Edge → Claim, with the edge specifying relationship type (FOR / AGAINST / CITES / RETRACTS / CORRECTED)
- **The ThresholdEvent**: the specific source that triggered verification, the timestamp, and optionally the human reviewer who confirmed it

This is not a rating or a credibility score. It is a structured audit trail. The ThresholdEvent says: *at this moment, on the basis of this source, this claim became a HARD\_FACT*. The evidence is linkable, inspectable, and persistent.

### 2.2 Verification Status Semantics

Claims in the system carry one of four verification statuses:

| Status | Meaning |
|--------|---------|
| `HARD_FACT` | Supported by at least one authoritative primary source with a ThresholdEvent on file |
| `PROVISIONAL` | Supported by evidence but lacking a formal ThresholdEvent; pending review |
| `DISPUTED` | Evidence on both sides; no consensus verification |
| `DEPRECATED` | Previously verified but the claim has been superseded, retracted, or shown false |

The DEPRECATED status preserves epistemic history: a retracted finding is not erased from the graph — it remains with its original status annotated as DEPRECATED and a deprecation reason in metadata. This is the audit trail property.

### 2.3 The Source → Edge → Claim Graph

The core data model is a directed bipartite graph:

```
Source --[Edge]--> Claim
```

**Sources** are producers of evidence: institutions, APIs, datasets, documents. Each Source has an `externalId` for cross-referencing and is never hard-deleted (soft-deleted only, to preserve audit trails).

**Edges** represent epistemic relationships between a Source and a Claim. Relationship types include:
- `FOR` — Source provides affirmative evidence for the Claim
- `AGAINST` — Source provides counter-evidence
- `CITES` — Source references the Claim without asserting truth
- `RETRACTS` — Source explicitly withdraws a prior claim (e.g., a retraction notice)
- `CORRECTED` — Source corrects a prior version of the claim

Edges carry an evidenceType and a score. All score changes are recorded in `EdgeRevision` — an immutable audit log of how the evidentiary weight of a source-claim relationship evolved over time.

**Claims** are the central entities. Each claim has:
- A text assertion
- A verification status
- A type and optional parent (for hierarchical claims)
- Human review flags (`humanReviewed`, `reviewConfidence`) — distinct from pipeline quality flags (`autoApproved`)
- An optional ThresholdEvent — the receipt

**MetaEdges** allow the graph to reason about its own structure: a MetaEdge can suppress, amplify, or label an Edge, enabling second-order epistemic reasoning (e.g., "this Edge should be downweighted because the Source has a known conflict of interest").

### 2.4 ThresholdEvents: The Receipt

ThresholdEvents are the defining data structure of the system. A ThresholdEvent on a Claim records:

- The timestamp at which verification threshold was crossed
- The Source that triggered it (`triggeredBySourceId`)
- The human reviewer who confirmed it (`confirmedBy`)
- Optional notes

A Claim can have at most one ThresholdEvent — the moment of verification. Prior evidentiary accumulation is recorded via EdgeRevisions. The ThresholdEvent is the culminating record.

`SuggestedThresholdEvents` provide an AI-generated analogue: the system can propose that a Claim merits a ThresholdEvent based on its edge profile, but these proposals are not authoritative until confirmed by a human reviewer. This separation between AI suggestion and human confirmation is architectural, not a workflow detail — it prevents AI hallucination from silently propagating into the verified knowledge graph.

---

## 3. Current Data Assets

### 3.1 Database State (as of May 23–25, 2026)

| Entity | Count |
|--------|-------|
| Claims | ~141,900 |
| Sources | ~140,500 |
| Edges | ~141,500 |

These numbers reflect 25+ completed ingestion pipelines across multiple domains.

### 3.2 Biomedical and Scientific

**FDA Drug Labels (openFDA, `openfda_labels_v1`):** 85,068 claims — the single largest dataset. Each claim encodes a structured assertion from an FDA-approved drug label: indications, contraindications, dosing, warnings, interactions. Labels are dated and manufacturer-attributed. This corpus is uniquely valuable because FDA labels are primary regulatory documents — they have legal force — and they change over time, creating a natural ThresholdEvent structure.

**CrossRef Retractions (`crossref_retractions_v1`):** ~26,500 claims. CrossRef maintains a retraction registry covering major scientific publishers. Each claim encodes a retracted paper: DOI, retraction reason, publisher, retraction date. These are canonical DEPRECATED-status claims — the retraction notice is the EdgeRevision that flips status. This dataset directly addresses the retraction blindness failure mode described above.

**FAERS Drug Safety Data (`faers_v1`):** 995 aggregate records from the FDA Adverse Event Reporting System. Encoded as background-tier summaries (reference-tier individual FAERS reports are too granular to be directly citable by case studies).

**WHO Global Health Observatory (`who_gho_v1`):** 1,001 claims across 5 indicators — life expectancy, under-5 mortality rate, PM2.5 exposure, alcohol consumption, and obesity prevalence — for the most recent available year per country. WHO GHO is a canonical health statistics source.

### 3.3 Seismic and Physical Science

**USGS Earthquakes M6.5+ (`usgs_eq_v1`):** 4,696 seismic events since 1900. Each claim encodes an earthquake: magnitude, date, location, depth, USGS event ID. USGS ComCat is the authoritative US seismological record. These claims are paradigmatic HARD\_FACTs: instrumented measurements from a federal scientific agency.

### 3.4 Legislative and Regulatory

The legislative coverage is the most distinctive data asset in the system. As of May 2026, the database contains enacted legislation from 14 jurisdictions:

| Jurisdiction | Dataset Tag | Records |
|---|---|---|
| European Union (Terms 8–10, 2014–present) | `eu_legislation_v1` | 827 |
| Germany (Bundestag) | `bundestag_v1` | 6,343 |
| Ireland (Oireachtas) | `oireachtas_v1` | 4,040 |
| Sweden (Riksdag) | `riksdag_v1` | 9,989 |
| Netherlands (Tweede Kamer) | `tweedekamer_v1` | 1,530 |
| Austria (Nationalrat) | `nationalrat_v1` | 3,868 |
| Scotland | `scotland_legislation_v1` | 408 |
| Israel (Knesset) | `israel_knesset_v1` | 2,009 |
| Georgia (Matsne) | `georgia_legislation_v1` | 301 |
| Jamaica (MOJ) | `jamaica_legislation_v1` | 528 |
| US Congress (97th–119th) | `congress_bills_v1` | 2,236 |
| Federal Register (significant rules) | `fr_rules_v1` | 1,915 |
| NATO official texts | `nato_official_texts_v1` | 459 |
| UN GA Resolutions | `un_ga_v1` | 598 |

All legislative records are enriched with a **Political Context layer** via Wikidata SPARQL: each enacted law is annotated with the head of government at the time of enactment, their party, and in many cases coalition partner data. The political context enrichment covers 112,843 rows as of the Tier 2 completion on May 23, 2026. This means that for every enacted law in the database, it is possible to query: *what government was in power when this law passed?*

No other publicly available dataset cross-references multi-jurisdiction legislation with contemporaneous political context in a single queryable graph.

### 3.5 Judicial

**ECHR Judgments (`echr_v1`):** 10,296 Grand Chamber and Chamber judgments from the European Court of Human Rights, sourced via the HUDOC REST API. ECHR judgments are primary legal authority for European human rights law. The corpus covers the full range of Articles and applications, with judgment dates spanning the court's history.

### 3.6 Scientific Recognition

**Nobel Laureates (`nobel_v1`):** 1,026 canonical laureate records (1901–2024) from the Nobel Foundation API v2.1, plus 662 DEPRECATED stale records that were superseded in the canonical run. This is a clean demonstration of the deprecation model: old records are not deleted but are marked DEPRECATED with a deprecation reason in metadata.

### 3.7 Financial Regulatory

**SEC EDGAR Filings (`sec_edgar_v1`):** 379 curated filings covering landmark cases: Enron, Lehman Brothers, Boeing, GE, WorldCom. These are reference-tier because individual filings are directly citable in case studies about regulatory enforcement and corporate governance.

### 3.8 Congressional Voting Records

An emerging pipeline covers US Congressional roll-call votes (`congress_votes_v1`). Vote records are enriched via Clerk of the House and Senate XML APIs, and member-level voting behavior is being ingested. This dataset, combined with the political context layer, enables cross-referencing of legislative outcomes with individual representatives' voting history — a uniquely queryable combination.

---

## 4. Architecture

### 4.1 Stack

The system runs on a modern, deployment-native stack:

- **Frontend:** Next.js 16.2.6 / React 19, deployed on Vercel (epistemic-receipts.vercel.app)
- **ORM:** Prisma 6.19.3
- **Database:** Neon Postgres (serverless, auto-scaling)
- **Styling:** Tailwind CSS v4
- **Graph visualization:** ReactFlow (for provenance graph display)
- **Ingesters:** TypeScript (`tsx`) scripts run as one-shot CLI processes; all source data fetched from live APIs, no training-data recall

The serverless database architecture means the system scales read capacity automatically during traffic spikes — relevant for a knowledge graph that may receive burst query traffic from academic or enterprise users.

### 4.2 Schema Design Principles

Several architectural decisions warrant explanation:

**`humanReviewed` ≠ `autoApproved`.** These are distinct boolean flags on the Claim model. `autoApproved: true` means the pipeline's own quality gates passed. `humanReviewed: true` means a human reviewer confirmed the claim. Pipeline scripts may never set `humanReviewed: true`. This separation is enforced by convention and prevents automated ingestion from silently advancing claims to human-verified status.

**Audit trail always.** No records are hard-deleted. Deprecated records remain in the database with `verificationStatus: DEPRECATED` and a `metadata.deprecation_reason` field. EdgeRevisions preserve every score change with prior and new values, reason, and timestamp. This is the backbone of the audit-trail property.

**Reference-tier vs. Background-tier.** Not all datasets are appropriate for bulk ingestion as individual Claims. The system applies a reference-tier test: if the next 20 case studies built on this domain would directly cite individual records, the dataset is reference-tier and warrants bulk ingestion. If case studies would cite only aggregated analyses, the dataset is background-tier — appropriate as a Source within hand-curated case studies, not as a bulk ingestion target. FAERS adverse event reports (individual reports, not aggregate tallies) are background-tier. ECHR judgments are reference-tier.

**Political context as enrichment, not schema.** The PoliticalContext table is linked to Source via `sourceId` and populated by a separate enrichment script (`enrich-political-context-wikidata.ts`) after ingestion. This design keeps ingestion pipelines simple and makes political context an optional enrichment layer rather than a required schema field. The enrichment is idempotent — running it multiple times produces the same result.

### 4.3 Ingestion Pipeline Design

Every pipeline follows the same pattern:

1. Fetch from a live, citable API (no training-data recall; no hardcoded claims)
2. Upsert Source records with stable `externalId` values
3. Create Claims with initial `verificationStatus` and `ingestedBy` tag
4. Create Edges linking Sources to Claims with appropriate relationship types
5. Write `autoApproved: true` when pipeline quality gates pass
6. Run in a transaction with a 30-second timeout for pipelines exceeding 1,000 rows (default 5-second timeout would fail)
7. Verify against DB counts after completion — never trust script-level progress logs

Pipelines are idempotent: re-running produces no duplicate records. All retirement of pipeline data is done by status change (DEPRECATED + metadata annotation), never by deletion.

### 4.4 Visualization: The Globe

A WebGL globe visualization (`/globe`) renders claim density by country on a log-scale heatmap. Users can click any country to open a sidebar showing recent claims from that jurisdiction, with a filter input. The globe supports two view modes: a heat-density mode (log-scale amber/blue coloring) and a political mode (high-resolution 50m GeoJSON with country borders). The political context enrichment makes the globe a navigable political geography of the knowledge graph — each country's claims are annotated with the government under which they were produced.

---

## 5. The Self-Auditing Vision

### 5.1 The Static Knowledge Problem

A knowledge graph that is only ingested once is a snapshot. Primary sources change: FDA labels are updated when new safety signals emerge; scientific papers are retracted months or years after publication; legislation is amended; USGS revises earthquake magnitudes after further analysis. A snapshot graph has a reliability horizon — beyond that horizon, claims that were HARD\_FACTs at ingestion time may have become DEPRECATED or DISPUTED without the graph knowing.

The self-auditing vision addresses this directly: an AI agent embedded in the system continuously monitors source APIs for updates, re-queries authoritative endpoints, flags claims whose source data has changed, and proposes `SuggestedThresholdEvent` upgrades or DEPRECATED status changes. This makes the knowledge graph *living* — not a static snapshot but a continuously updated epistemic state machine.

### 5.2 The AiJob Scaffold

The schema includes an `AiJob` table (currently stubbed) for a queue-based AI job system. Planned job types include:

- **`classify`**: Assign verification status to newly ingested claims based on edge profile
- **`detect_contradictions`**: Identify Claims on the same subject with conflicting verification statuses — especially relevant for the declassified archives layer, where public assertions can be compared against classified primary sources now available
- **`propose_threshold`**: Generate `SuggestedThresholdEvents` for claims whose edge profiles cross a confidence threshold
- **`deprecation_watch`**: Monitor source APIs for retraction notices, label updates, or amendment records

All AiJob outputs are proposals only — they create `SuggestedThresholdEvents` or flag candidates for human review. They do not directly modify Claim status. Human confirmation is required to advance from AI suggestion to formal ThresholdEvent.

### 5.3 Google Scholar / OpenAlex Integration

A planned integration with OpenAlex (which provides a fully open alternative to Google Scholar) would surface:

- **Citation counts** for Claims derived from academic papers — a proxy for uptake
- **Retraction watches** — new CrossRef retraction records matched against existing Claims
- **Altmetric scores** — social and media attention as a signal of public salience

This integration is distinct from the main ingestion system: it provides enrichment metadata on existing Claims, not new Claims.

### 5.4 Contradiction Detection as Long-Horizon Feature

The most epistemically interesting long-term capability is contradiction detection between public-record Claims and declassified-primary-source Claims on the same events. The AGAINST and CORRECTS edge types provide the data model; the AiJob scaffold provides the execution framework. But this capability requires a prerequisite: sufficient Layer 2 content Claims extracted from declassified documents (see Section 7) to provide meaningful comparison targets. Building the contradiction detection system before Layer 2 exists would produce nothing to compare.

---

## 6. Business Model

### 6.1 The Market

Epistemic Receipts operates at the intersection of three growing markets:

1. **AI grounding infrastructure.** As regulatory pressure on AI outputs increases (EU AI Act, proposed NIST AI RMF extensions), the demand for verifiable, sourced corpora for RAG systems is growing. Current RAG systems use Wikipedia, Common Crawl, or proprietary datasets — none of which encode verification status or source chains.

2. **Regulatory intelligence.** Pharma, financial services, and legal firms maintain dedicated teams for tracking regulatory change across jurisdictions. A cross-jurisdictional, timestamped, politically-annotated regulatory database reduces the research burden for compliance teams.

3. **Academic infrastructure.** Researchers in political science, public health, legal studies, and science policy lack a unified, queryable graph that cross-references legislation, judicial decisions, health metrics, and scientific literature.

### 6.2 Revenue Tiers

**Tier 1 — Public access (free):** Search, globe visualization, claim browsing, and the Academic Fields browser. This is the discovery layer that drives awareness and citation.

**Tier 2 — API access (subscription):** Structured query access via the REST API. Enterprise-grade rate limits, bulk export, and programmatic access to Claims, Edges, ThresholdEvents, and political context data. Target: AI companies building RAG pipelines, academic data labs, research aggregators. Pricing: subscription-based (market-rate for similar data APIs).

**Tier 3 — Regulatory Intelligence (enterprise):** Curated domain views with enriched metadata, custom ingestion pipelines for specific jurisdictions, and integration support. Target: pharma compliance, financial regulatory, legal intelligence firms. Pricing: enterprise contract, project-based.

### 6.3 The Cross-Jurisdiction Advantage

The core competitive moat is the multi-jurisdiction legislative layer combined with political context enrichment. No other publicly available system cross-references enacted legislation from Ireland, Germany, Sweden, the Netherlands, Austria, Israel, and the EU in a single queryable graph, further annotated with the governing party and head of government at the time of enactment.

For regulatory intelligence buyers, this is a direct cost reduction: jurisdictional regulatory research that currently requires a team of analysts can be partially automated against a structured, queryable graph. The integration of ECHR judgments, WHO health metrics, and FDA data within the same schema extends this advantage into health policy and human rights domains.

---

## 7. Roadmap

### 7.1 Near-Term (Q3 2026)

**CourtListener SCOTUS opinions (`ingest-courtlistener-scotus.ts`):** Pipeline built, awaiting production run. SCOTUS opinions are reference-tier primary legal authority — individual decisions are directly citable. Coverage: full opinion corpus, searchable by term and docket.

**ClinicalTrials.gov (`ingest-clinicaltrials.ts`):** Pipeline ready. Clinical trial registrations provide a unique time-stamped record of the state of evidence in human subjects research at registration. Combined with CrossRef retractions, this creates a longitudinal view of the scientific evidence lifecycle.

**NCBI Gene (`ingest-ncbi-gene.ts`):** NCBI gene entries provide a molecular biology substrate — canonical identifiers for human genes, with associated disease links and literature citations. Reference-tier for biomedical claims.

**ICD-11 (`ingest-icd11.ts`):** WHO ICD-11 MMS linearization — awaiting API credentials. Once provisioned, the dry-run is ready to execute.

**OpenAlex academic papers:** OpenAlex provides a fully open alternative to Google Scholar for academic citation data. Integration planned as enrichment metadata on Claims derived from academic sources.

### 7.2 Medium-Term: Declassified Archives (Q4 2026–Q1 2027)

The declassified archives pipeline category represents the most epistemically distinctive data in the roadmap. The core model: declassified documents are primary sources; the claims they contain are HARD\_FACTs (the document's existence and contents are the threshold, not a downstream inference); and where declassified content contradicts public-record claims on the same events, AGAINST and CORRECTS edges encode the epistemic gap.

**Layer 1 (document existence, automated):** Bulk ingestion of document-level claims — "Document X was archived at NARA, Record Group Y, originally dated Z." No content extraction required.

Pipeline build order:

1. **NARA Catalog API:** RG 263 (CIA), RG 59 (State Dept), RG 330 (DoD), RG 128 (Church Committee), RG 148 (JFK ARRB). Script built; awaiting `NARA_API_KEY`.
2. **Wilson Center Digital Archive:** Soviet, Eastern European, Chinese, Cuban, Vietnamese translated/declassified documents. Script built; API temporarily inaccessible at build time.
3. **UK National Archives Discovery API:** Cabinet, Foreign Office, PM files.
4. **IPN Poland:** Polish communist-era security files.
5. **JACAR Japan:** WWII military records, colonial administration, diplomatic cables.
6. **Bundesarchiv-BStU (Stasi):** East German intelligence files — largest Western declassified intelligence archive.

**Layer 2 (content claims, editorial):** Human-curated content assertions from specific high-value documents. Priority events:
- Hungarian Revolution 1956 (Wilson Center Politburo transcripts)
- Cuban Missile Crisis (Wilson Center Soviet/Cuban docs + NARA)
- MKULTRA (CIA Reading Room)
- Church Committee findings (NARA RG 128)
- Prague Spring 1968 (Wilson Center + ABS Czech)

Layer 2 is the prerequisite for contradiction detection — it provides the comparison targets for public-record vs. classified-record AGAINST edge analysis.

### 7.3 Long-Term: Layer 2 at Scale + Contradiction Detection

**AI-assisted content extraction:** The `AiJob` scaffold enables automated content claim extraction from declassified documents at scale. This is appropriate only after sufficient manually-curated Layer 2 content exists to validate extraction quality. The extraction pipeline reads structured document text, identifies factual assertions, and creates Claim + Source + Edge triples with `autoApproved: false`, pending human review.

**Contradiction detection:** Once Layer 2 has meaningful coverage, AiJob jobs compare public-record Claims and declassified-record Claims on the same events, identify semantic contradictions, and propose AGAINST or CORRECTS edges. This is the highest-value epistemic output of the system: a structured record of where official public narratives diverged from classified knowledge.

---

## 8. Why Now

### 8.1 AI Makes Provenance a First-Order Problem

Until large language models became widely deployed, the provenance gap in online information was a background problem. Most users could roughly estimate the credibility of a source; hallucination was a human rather than automated failure mode.

The deployment of LLMs at scale changed this. AI-generated content now circulates at volume, with the confident register of expert output and none of the conventional signals of credibility (author attribution, institutional affiliation, source citation). Fact-checking individual AI outputs is not scalable. The structural solution is a sourced, timestamped, verification-status-annotated knowledge layer that AI systems can query — a layer that allows an AI to say not just "this fact appears in my training data" but "this claim is HARD\_FACT, verified by this source, with a ThresholdEvent dated to this moment."

RAG systems need this. Currently, RAG retrieval treats all documents in the corpus as equally credible. A retracted paper, an FDA label from ten years ago, and a current regulatory guideline are retrieved on the same evidence basis if their embeddings match the query. Epistemic Receipts provides the metadata layer that allows RAG systems to weight retrieved evidence by verification status — or to filter out DEPRECATED claims entirely.

### 8.2 Regulation Is Coming for AI Outputs

The EU AI Act (in force from 2024, with staggered rollout through 2026) imposes transparency and accuracy requirements on high-risk AI systems operating in domains including healthcare, legal services, and public administration. In these domains, AI outputs need provenance — they need to be traceable to primary sources that can be audited. Epistemic Receipts provides that substrate.

More broadly, courts in multiple jurisdictions are beginning to address AI-generated evidence. A structured, citable knowledge graph with immutable audit trails is better-positioned for forensic use than raw LLM output, precisely because ThresholdEvents provide the temporal and source anchoring that legal proceedings require.

### 8.3 The Moment Before Lock-In

Knowledge graph infrastructure tends toward monopoly: the dominant graph captures network effects (citations, integrations, downstream dependencies) that make switching prohibitively costly. Wikidata currently holds this position for general-purpose structured knowledge, but it does not encode verification status, ThresholdEvents, or political context enrichment. Academic resources like OpenAlex and CrossRef provide domain-specific structured data without a unified graph model. The window for a new entrant that combines these properties — provenance-native, multi-domain, cross-jurisdictional — is open, but it is not indefinitely open.

---

## 9. Limitations and Open Questions

**Human review backlog.** Approximately 47,000 pipeline records are currently queued for human review (`humanReviewed: false`). This backlog is a function of the speed of pipeline ingestion outpacing editorial review capacity. Scaling the human review process — whether through crowdsourcing, tiered reviewer networks, or AI-assisted triage — is an open operational challenge.

**ThresholdEvent sparsity.** The ThresholdEvent is the defining data structure, but relatively few Claims currently have one. Most ingested claims are in PROVISIONAL status pending formal review. The ThresholdEvent layer will be populated incrementally as editorial workflows mature. The current value proposition is the graph structure and provenance chains — the ThresholdEvent layer is the long-term differentiator.

**Auth is a stub.** Write endpoints are currently unprotected. This is appropriate for a development-stage system but must be addressed before any enterprise deployment.

**Graph performance at scale.** ReactFlow visualization is currently adequate for the claims/edges scale being displayed in UI views. At full graph scale (141k+ nodes), client-side graph rendering will require pagination, progressive loading, or server-side layout computation.

**Cross-reference edges.** The current graph contains Source → Claim edges from individual pipeline ingesters, but lacks cross-source edges: CITES edges linking an ECHR judgment to the legislation it interprets, or AGAINST edges linking a retracted paper to the corrected finding. These cross-reference edges are architecturally supported but require editorial work to populate.

---

## 10. Conclusion

The absence of epistemic infrastructure is not an abstract problem. It produces concrete failures: AI systems that hallucinate without provenance, scientific literature that cites retracted papers, regulatory compliance work that cannot query when a rule changed and under which government. These are solvable problems — not through better content moderation or improved search ranking, but through a structural layer that encodes when claims became verifiable, by what evidence, and under what conditions they might cease to be.

Epistemic Receipts is that layer. The ThresholdEvent is not a metaphor — it is a data structure that records the moment of verification with the precision of a transaction log. The Source → Edge → Claim graph is not a convenience — it is the provenance chain that makes every claim in the system auditable back to a primary source. The political context enrichment is not decoration — it is the annotation that makes cross-jurisdictional regulatory queries answerable without bespoke research.

As of May 2026, the system contains approximately 141,900 structured claims across domains spanning drug safety, seismic science, scientific retractions, multi-jurisdiction legislation, judicial decisions, and health metrics — with political context enriched across 112,843 legislative records. The architecture is production-deployed, the schema is stable, and the pipeline registry is growing.

The self-auditing vision — a living knowledge graph that monitors its own sources for changes, flags stale claims, and proposes new ThresholdEvents — is the long-term trajectory. The foundation is in place.

---

## References

Brainard, J., & You, J. (2018). What a massive database of retracted papers reveals about science publishing's 'death penalty'. *Science*. https://doi.org/10.1126/science.aav8384

Budd, J. M., Sievert, M., & Schultz, T. R. (1998). Phenomena of retraction: Reasons for retraction and citations to the publications. *JAMA, 280*(3), 296–297. https://doi.org/10.1001/jama.280.3.296

Schneider, J., Ye, D., Hill, A. M., & Whitehorn, A. S. (2020). Continued citation of retracted alcohol studies: five years after retraction. *Alcohol and Alcoholism, 55*(1), 99–108. https://doi.org/10.1093/alcalc/agz090

---

*Epistemic Receipts is available at: https://epistemic-receipts.vercel.app*  
*Database state reflects ingestion runs completed through May 25, 2026*
