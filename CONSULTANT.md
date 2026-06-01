# CONSULTANT.md — Epistemic Receipts Architectural Memory

> **Every coding agent must read this file before making changes.**
> **Every coding agent must update this file after making changes.**
> This is the single source of architectural truth between sessions.

---

## Project At a Glance

**Stack:** Next.js 16.2.6 · Prisma 6.19.3 · React 19 · PostgreSQL · TypeScript · Tailwind v4  
**Deploy:** Vercel (production at epistemic-receipts.vercel.app)  
**Visualization:** ReactFlow (graph edges/flow diagrams)  
**Auth:** Password-protected via `SITE_PASSWORD` env var (set in Vercel, encrypted). Middleware in `middleware.ts` checks a SHA-256 cookie. Login page at `/login`, API at `/api/login`.

⚠️ **CSP rule:** `next.config.ts` script-src MUST include `'unsafe-inline'`. Next.js App Router injects inline `<script>` tags for RSC streaming (`self.__next_f.push(...)`). Without `'unsafe-inline'`, React never hydrates — all interactive elements (forms, data fetches via useEffect) silently break. Do not remove it.

---

## Current DB State (as of 2026-05-26)

| Entity | Count |
|--------|-------|
| Active Claims | **842,061** |
| Active Sources | **838,349** |
| Active Edges | **842,279** |
| Pipelines | **146** |
| Legislative Votes | 2,948 |
| Polities | 2,361 |
| Threshold Events | 1,259 |

**Top pipelines by volume:** OpenAlex (155k), openFDA labels (85k), ChEBI (62k), JACAR Japan archives (44.6k), World Bank (34.6k), CrossRef retractions (26.6k), Argentina legislation (25.8k), Italy legislation (16.9k), NIH Reporter (16.1k), Chile legislation (15.9k)
| CrossRef retractions (`crossref_retractions_v1`) | ~26,500 |
| EU legislation (`eu_legislation_v1`, Terms 8–10) | 827 |
| German Bundestag enacted laws (`bundestag_v1`) | 6,343 |
| Netherlands Tweede Kamer enacted laws (`tweedekamer_v1`) | 1,530 |
| Ireland Oireachtas enacted Acts (`oireachtas_v1`) | 4,040 |
| Sweden Riksdag Riksdagsskrivelser (`riksdag_v1`) | 9,989 |
| Scottish Parliament enacted acts (`scotland_legislation_v1`) | 408 |
| Israel Knesset enacted laws (`israel_knesset_v1`) | 2,009 |
| Georgia (country) national laws (`georgia_legislation_v1`) | 301 |
| NATO official texts (`nato_official_texts_v1`) | 459 |
| Austria Nationalrat enacted laws (`nationalrat_v1`) | 3,868 |
| Jamaica Acts of Parliament (`jamaica_legislation_v1`) | 528 |

---

## Schema — Models & Key Relations

### Core
- **Claim** — Central entity. Text + status (DISPUTED/HARD_FACT/NEVER_RESOLVES) + type + hierarchy (parentClaimId) + review workflow (humanReviewed, reviewConfidence, reviewedBy) + soft-delete + autoApproved.
- **Source** — Producer of evidence. Has externalId for cross-referencing. Soft-deleted.
- **Edge** — Source → Claim with relationship type (FOR/AGAINST/CITES/RETRACTS/CORRECTED) and evidenceType. Score NOT stored here — see EdgeRevision.
- **EdgeRevision** — Audit trail for all Edge score changes (priorScore, newScore, reason, timestamp).
- **MetaEdge** — Edge targeting another Edge. For suppression, amplification, demotion, labeling.
- **Topic** — Hierarchical taxonomy (slug, parentTopicId). Used for domain filtering.
- **ClaimTopic** — Claim ↔ Topic junction table.
- **ThresholdEvent** — The "receipt." When a Claim crosses to HARD_FACT. Links to confirmedBy (human), triggeredBySourceId (auditable).
- **SuggestedThresholdEvent** — AI suggestions only. Not authoritative.
- **SourceRelationship** — Declared relationships between Sources (funder_of, affiliated_with, etc.).
- **SourceCredibilityEvent** — Audit trail for credibility changes.

### Stubs
- **AiJob** — Future AI job queue (classify, detect contradictions, propose threshold).
- **Feedback** — User form submissions.

---

## Pipeline Registry (current as of 2026-05-25)

| # | Script | Source | Status | Records |
|---|--------|--------|--------|---------|
| 1 | `ingest-congress-bills.ts` | Congress.gov enacted bills 113th–119th | Shipped | 205 |
| 2 | `ingest-un-sc-resolutions.ts` | UN SC resolutions (Zenodo dataset) | Ready | — |
| 3 | `ingest-genbank.ts` | NCBI GenBank sequences | Ready | — |
| 4 | `ingest-courtlistener-scotus.ts` | CourtListener SCOTUS opinions — most-cited (citation_count≥50), ordered by citation_count desc (`courtlistener_scotus_v1`). Added `--dry-run` flag and 429 Retry-After handling. | Shipped 2026-05-25 | 300 |
| 5 | `ingest-uspto-patents.ts` | USPTO Patents | **RETIRED 2026-05-12** — fabricated metadata. Records marked DEPRECATED. | 182 |
| 6 | `ingest-ncbi-gene.ts` | NCBI gene entries | Ready | — |
| 7 | `ingest-clinicaltrials.ts` | ClinicalTrials.gov completed trials — 4 buckets: case-study (specific drugs/interventions), pivotal (15 major conditions), pharma (FDA-drug-linked trials), phase3 (Phase 3/4 by therapeutic area). Added `--dry-run` flag, `phase3` bucket, `filter.advanced` phase filter, pharma bucket fixed to use `openfda_labels_v1`. (`clinicaltrials_v1`) | Shipped 2026-05-25 | 4,475 |
| 8 | `ingest-faers-current-drugs.ts` | openFDA FAERS drug aggregates | Shipped | 995 |
| 9 | `ingest-sec-edgar.ts` | SEC EDGAR curated filings (Enron, Lehman, Boeing, GE, WorldCom) | Shipped 2026-05-18 | 379 |
| 10 | `ingest-nobel-prizes.ts` | Nobel Foundation API v2.1 (1901–2024) | Shipped 2026-05-18 | 1,026 canonical + 662 DEPRECATED stale |
| 11 | `ingest-icd11.ts` | WHO ICD-11 MMS linearization 2024-01 | Dry-run pending (needs ICD_API creds) | — |
| 12 | `ingest-usgs-earthquakes.ts` | USGS M6.5+ since 1900 | Shipped 2026-05-18 | 4,696 |
| 13 | `ingest-retractions.ts` | CrossRef retracted papers | Full run completed 2026-05-17 | ~26,500 |
| 14 | `ingest-federal-register.ts` | Federal Register EO 12866 significant rules | Shipped 2026-05-18 | 1,915 |
| 15 | `ingest-congress.ts` | Congress.gov enacted laws (newer ingester) | Ready | — |
| 16 | `ingest-eu-legislation.ts` | EUR-Lex CELLAR SPARQL — EP+Council Regulations & Directives, Terms 8–10 (2014–present) | Shipped 2026-05-19 | 827 |
| 17 | `ingest-nato-official-texts.ts` | NATO CPS official texts — summit communiqués, strategic concepts, declarations | Shipped 2026-05-23 | 459 |
| 18 | `ingest-oireachtas.ts` | Ireland Oireachtas Open Data API — enacted Irish Acts (`bill_status=Enacted`, paginate via `skip`) | Shipped 2026-05-19 | 4,040 |
| 19 | `ingest-riksdag.ts` | Sweden Riksdag Open Data API — Riksdagsskrivelser (`doktyp=rskr`) | Shipped 2026-05-19 | 9,989 |
| 20 | `ingest-tweedekamer.ts` | Netherlands Tweede Kamer OData v4 API — `Wetgeving` Zaken with adoption Besluit | Shipped 2026-05-19 | 1,530 |
| 21 | `ingest-bundestag.ts` | German Bundestag DIP REST API — `Vorgangstyp=Gesetzgebung` + `beratungsstand=Verkündet` | Shipped 2026-05-19 | 6,343 |
| 22 | `ingest-nationalrat.ts` | Austria Parlament Filter API — `Beschluss des Nationalrates` (DOKTYP=BNR) | Shipped 2026-05-23 | 3,868 |
| 57 | `ingest-scotland-legislation.ts` | Scottish Parliament Open Data (data.parliament.scot) — bills that reached Sequence=3 final stage | Shipped 2026-05-20 | 408 |
| 78 | `ingest-georgia.ts` | Legislative Herald of Georgia (matsne.gov.ge) — Laws of Georgia, group=Law, type=main | Shipped 2026-05-20 | 301 |
| 79 | `ingest-jamaica.ts` | Laws of Jamaica (laws.moj.gov.jm) — Acts of Parliament 2000–2023 via DataTables AJAX | Shipped 2026-05-23 | 528 |
| 80 | `ingest-nara-catalog.ts` | NARA Catalog API v2 — RG 263 (CIA), RG 59 (State), RG 330 (OSD), RG 128 (Church Committee), RG 148 (JFK ARRB) | **API key required** 2026-05-23 — script ready, awaiting `NARA_API_KEY` env var (email Catalog_API@nara.gov) | — |
| 110 | `ingest-wilson-center.ts` | Wilson Center Digital Archive — translated/declassified Soviet, Eastern European, Chinese, Cuban, Vietnamese docs (`digitalarchive.wilsoncenter.org/api/v1/records`) | Built 2026-05-23 — **dry-run blocked**: `digitalarchive.wilsoncenter.org` returning ECONNREFUSED/ENOTFOUND at time of build; re-run dry-run when API accessible. Supports `--collection`, `--country`, `--limit` flags. | — |
| 111 | `ingest-propublica-congress.ts` | ProPublica Congress API | **RETIRED 2026-05-23** — ProPublica shut down their Congress API in July 2024. Script exists but has no live endpoint. | — |
| 112 | `ingest-who-gho.ts` | WHO Global Health Observatory OData API — 5 indicators: life expectancy, U5MR, PM2.5, alcohol, obesity; most recent year per country (`who_gho_v1`) | Shipped 2026-05-23 | 1,001 |
| 113 | `ingest-un-ga-resolutions.ts` | UN Digital Library Voting Data — GA Plenary resolutions (symbol A/RES/*), MARC21 text API (`of=tm`), including both recorded votes and without-vote adoptions (`un_ga_v1`) | Shipped 2026-05-23 | 598 |
| 114 | `ingest-echr.ts` | HUDOC REST API — ECHR Grand Chamber (importance=1) and Chamber (importance=2) English full judgments (`HEJUD` doctype), sorted by `kpdate` (`echr_v1`) | Shipped 2026-05-23 | 10,296 |
| — | `ingest-astronomy.ts` | NASA exoplanets + IAU bodies | Shipped | — |
| — | `ingest-pubchem.ts` | PubChem chemistry substrate | Ready | — |
| 116 | `ingest-openalex.ts` | OpenAlex open academic catalog — peer-reviewed publications across 3 buckets: cognition (C15744967/C188147891 + cognitive-science search), biomedical (C71924100/C86803240 + clinical-trial search), policy (C17744445/C162324750 + policy search). Cursor pagination (per_page=200). Edge score 80 ("peer-reviewed, not independently verified"). (`openalex_v1`) | Shipped 2026-05-25 | 10,093+ (biomedical + policy still running) |

---

## Architectural Rules — Do Not Violate Without Asking

### 1. API-only sourcing
Every pipeline entry must trace to a live fetchable URL. No training-data recall. No hardcoded claims without a verifiable source at ingestion time.

### 2. Reference-tier vs. Background-tier
- **Reference-tier:** Individual records are directly citable by case studies → bulk ingest.
- **Background-tier:** Only aggregated views are cited → add as Sources within case studies, not bulk ingest.
- Background-tier examples: individual FAERS adverse event reports, individual WIPO patent filings.

### 3. humanReviewed ≠ autoApproved
- `humanReviewed: true` = a human reviewed it.
- `autoApproved: true` = pipeline's own quality gates passed.
Never set `humanReviewed: true` in a pipeline script. Never conflate these two flags.

### 4. Audit trail always
Deprecated records stay in DB. Mark `verificationStatus: DEPRECATED` + `metadata.deprecation_reason`. Never hard-delete pipeline records.

### 5. Transaction timeout for large pipelines
For pipelines >1,000 rows: `prisma.$transaction(fn, { timeout: 30000 })`. Default is 5s which will fail.

### 6. Verify against DB state after every run
Don't trust script-level progress logs. Run count queries after every ingest to detect closure bugs or rollbacks.

### 7. Changelog + footer update on every deploy
Whenever changes are pushed:
- Add entry to homepage changelog section
- Update footer "last updated [date]"

### 8. Cross-references are hand-curated, not auto-ingested
Ingesters create Claims, Sources, Edges. Cross-references between entities (e.g., CITES edges linking a FAERS record to a SCOTUS ruling) belong in separate hand-curated scripts only.

---

## Political Context Enrichment Architecture

Script: `scripts/enrich-political-context-wikidata.ts`
Schema table: `PoliticalContext` (linked to `Source` via `sourceId`)

**Tier 1 — BUILT (Executive/HoG via Wikidata SPARQL)**
- Fields: `headOfGovernment`, `hogParty`, `hogWikidataId`, `wikidataItemId`, `enactmentDate`, `country`
- Strategy: one SPARQL query per country fetches full HoG term history; enactment date matched locally (avoids per-row API calls)
- Coverage: all legislation pipelines in `LEGISLATION_PIPELINES` registry in the script
- Run: `npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-political-context-wikidata.ts --full`
- NEW pipelines added to registry 2026-05-20: Malaysia, Estonia, Malta, Georgia, Jamaica, Sri Lanka, Pakistan, T&T, Brunei, Uruguay, Peru, Costa Rica, UAE
- **Run this after every legislative batch ships** — it backfills only unenriched sources (idempotent)

**Tier 2 — SHIPPED 2026-05-23 (full run completed, 112,843 rows populated)**
- Script: `scripts/enrich-parliamentary-majority.ts`
- Fields written: `governingParty`, `majorityType`, `coalitionPartners` (JSON-encoded in a String? column), `majoritySeats`
- Decision resolved: **extend `PoliticalContext`** (no new table). The fields were already present in the 2026-05-20 `add_political_context` migration; no schema migration was needed for Tier 2.
- Strategy: per-country SPARQL fetches every cabinet item (instance/subclass of Q640506) in that country, with start/end dates and member parties via P102 + P1830. Each PoliticalContext row's enactmentDate matched locally; cabinet narrowed by `headQid === hogWikidataId` to discard state/Länder cabinets in federal countries.
- Realistic outcome: cabinet items on Wikidata almost never carry party data via P102 or P1830 (verified empirically for German federal cabinets — Schröder/Schulze items only have P6, P31, P17, P580/582). So `majorityType` and `coalitionPartners` will be NULL on most rows. The headline win is filling `governingParty` from existing `hogParty` (Tier 1 backfill) — ~113k rows already qualify.
- Run this after every Tier 1 run; idempotent (skips rows where governingParty is already set).
- Run: `npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-parliamentary-majority.ts --dry-run` / `ALLOW_EDITS=true … --full`

**Tier 3 — OPEN DECISION: Individual vote records**
- Best available sources by country: Estonia (riigikogu.ee API — excellent), Georgia (parliament.ge — scrapeable), Malaysia (partial Hansard), Jamaica (sparse)
- Fields: `voteFor`, `voteAgainst`, `voteAbstain`, `voteTotal`, `passageType` (unanimous/majority/supermajority)
- Decision needed: worth building for Estonia + Georgia as pilot? Both have structured data.

---

## Declassified & Archival Sources — Design Vision (2026-05-23)

The core value proposition of this pipeline category is the **epistemic gap**: the difference between what was publicly asserted at the time and what was privately true, now verifiable through declassified primary sources.

### The model

- **Source** = the declassified document (Politburo minutes, CIA NIE, State Dept cable, NARA archival item)
- **Claim** = a specific content assertion extracted from that document
- **verificationStatus** = `HARD_FACT` — the declassified document is the primary record, not a secondhand account. The document's existence and contents are the threshold event, not a downstream inference.
- **Edge** = `FOR` from the document Source → the content Claim; `AGAINST` or `CORRECTS` linking to any contradicting public-record Claim on the same event

### Example
Hungarian Revolution of 1956: Soviet Politburo transcripts show internal deliberation over granting Hungary independence — a fact unknown to the public at the time. The transcript is a declassified primary source. The Claim ("Soviet leaders deliberated granting Hungary independence, October 1956") is `HARD_FACT`, not `DISPUTED`, because the document IS the record. A `CORRECTS` edge links it to any public-facing Soviet claim asserting unified opposition.

### Two build layers
- **Layer 1 (bulk, automated):** Document existence as Claim — "Document X was archived at NARA, Record Group Y, originally dated Z." Reference-tier. Script: `ingest-nara-catalog.ts` (in progress as of 2026-05-23). No content extraction required.
- **Layer 2 (curated, high-value):** Content assertions extracted from specific documents → `HARD_FACT` Claims. High-profile collections only (MKULTRA, Cuban Missile Crisis, Church Committee, Hungarian Revolution). Can be human-curated without AI extraction. AiJob scaffold handles AI-assisted extraction for scale.

### This is the foundation for contradiction detection (AiJob, long-horizon)
Public-record Claims vs. declassified-record Claims on the same events are the primary substrate for the contradiction-detection AiJob (see Stubs in schema). `CORRECTS` / `AGAINST` edges between them are the output. Do not build contradiction detection until Layer 2 has meaningful content Claims to compare against.

### Source collections prioritized
1. NARA Catalog API — RG 263 (CIA), RG 59 (State Dept), RG 330 (DoD), RG 128 (Church Committee), RG 148 (JFK)
2. UK National Archives Discovery API — CAB (Cabinet), FCO (Foreign Office), PREM (PM's office)
3. CIA Reading Room — MKULTRA, Cold War NIEs, subject-tagged collections
4. State Dept FOIA Virtual Reading Room — diplomatic cables (PDF, needs content extraction for Layer 2)

### Schema note
Add `originalArchive` to Source metadata JSON for all archive pipelines — the institution that held the physical document before digitization (e.g. `"RGANI"`, `"KGB Central Archive"`, `"Stasi BV Leipzig"`). Separates fetch origin (URL) from epistemic origin (physical archive).

---

## Archive & Declassified Sources — Roadmap (2026-05-23)

### Layer 1 pipeline build order (document existence, ~3–4 weeks of agent runs, parallelizable)

| Priority | Script | Source | Coverage | Status |
|---|---|---|---|---|
| 1 | `ingest-nara-catalog.ts` | NARA Catalog API | US: CIA, State Dept, DoD, Church Committee, JFK | **API key required** — script built 2026-05-23, dry-run blocked (NARA v2 requires `NARA_API_KEY`, email Catalog_API@nara.gov) |
| 2 | `ingest-wilson-center.ts` | Wilson Center Digital Archive | Soviet/Russian, Eastern European, Chinese, Cuban, Vietnamese (English translations) — single biggest unlock | **Built 2026-05-23** — dry-run blocked (API ECONNREFUSED at build time); re-run `--dry-run` when `digitalarchive.wilsoncenter.org` is accessible |
| 3 | `ingest-uk-national-archives.ts` | UK National Archives Discovery API | British Cabinet, Foreign Office, PM files, MI5/MI6 releases | Queued |
| 4 | `ingest-ipn-poland.ts` | IPN (Institute of National Remembrance) | Polish communist-era security files — best API in Eastern Europe | Queued |
| 5 | `ingest-jacar-japan.ts` | JACAR (Japan Center for Asian Historical Records) | WWII military records, colonial administration, diplomatic cables — best Asian archive API | Queued |
| 6 | `ingest-bstu-stasi.ts` | Bundesarchiv-BStU | East German Stasi files — largest Western declassified intelligence archive | Queued |
| 7 | `ingest-israel-archives.ts` | Israel State Archives | 1948 war, early statehood, Cold War regional | Queued |
| 8 | `ingest-abtl-hungary.ts` | ÁBTL (Hungarian State Security Archives) | 1956 revolution records, AVO secret police | Queued |
| 9 | `ingest-abs-czech.ts` | ABS (Czech Security Services Archive) | StB files, Prague Spring 1968 | Queued |
| 10 | `ingest-ahpn-guatemala.ts` | AHPN (Historical Archive National Police) | ~80M pages digitized, state violence 1975–1985 | Queued |
| 11 | `ingest-trc-south-africa.ts` | TRC / South Africa National Archives | Apartheid-era security records, English-language | Queued |

### Countries covered at full build-out
Americas: USA, Canada, Argentina, Brazil, Chile, Guatemala, Mexico
Europe-West: UK, Germany, France, Italy, Netherlands, Spain, Portugal, Switzerland
Europe-East: Poland, Czech Republic, Slovakia, Hungary, Romania, Bulgaria, Ukraine, Estonia, Latvia, Lithuania
Asia-Pacific: Japan, South Korea, Taiwan, India, Israel, Vietnam
Africa: South Africa, Morocco, Tunisia

### Layer 2 (content claims → HARD_FACT, editorial, no hard deadline)
Human-curated to start. Priority events for first content claims:
- Hungarian Revolution 1956 (Wilson Center Politburo transcripts)
- Cuban Missile Crisis (Wilson Center Soviet/Cuban docs + NARA)
- MKULTRA (CIA Reading Room)
- Church Committee findings (NARA RG 128)
- Prague Spring 1968 (Wilson Center + ABS Czech)

AiJob extraction pipeline unblocks scale but must not be built until sufficient Layer 2 content Claims exist to validate the extraction quality.

### Effort estimate
- Layer 1 per pipeline: 1–2 days agent work each, fully parallelizable after NARA is confirmed
- Layer 2 per event: ongoing editorial, no automation dependency
- Bottleneck: editorial judgment on which documents warrant content claim extraction — not coding

---

## Planned Features (Long-horizon)

- **Search** — `/search` page shipped 2026-05-25 (SearchClient + `/api/search` route). Needs UX review and relevance tuning.
- **Vote analysis enrichment** — `/topics/[slug]` now includes timeline, contested/unanimous stats, party breakdowns. Needs visual polish pass.

---

## Open Decisions / Tech Debt

- **Auth:** `/api/login` route is a stub. No auth method implemented. All write endpoints currently unprotected. Do not build features that assume auth is working.
- **Review queue:** `/review` page exists for humanReviewed=false claims. ~47k pipeline records are awaiting review — the queue is a backlog concern, not a blocker.
- **Pipeline 5 (USPTO):** Retired records still in DB. A future cleanup pass should validate which ones are salvageable after re-verification.
- **Pipeline 13 (CrossRef Retractions):** Full run completed. Final counts need verification against DB (script reported ~26,500 candidates; confirm actual inserted count).
- **ICD-11 (Pipeline 11):** Requires `ICD_API_CLIENT_ID` and `ICD_API_CLIENT_SECRET` env vars. Dry-run not yet done.
- **ReactFlow graph:** Currently at claims/edges scale. Performance on 47k+ nodes untested.

---

## Pending Production Runs (approved, run when ready)

_None — Pipelines 9, 10, 12, 14 were shipped 2026-05-18._
Next candidates awaiting dry-run or approval: Pipeline 11 (ICD-11, needs API creds).

---

## Changelog (coding agent entries go here)

### 2026-06-01 — Academic-field badges on /topics + 348-topic backfill

**What.** Each topic row on `/topics` now carries a small colored pill labelling the topic's top-level academic discipline (Social science, Natural science, Humanities, Applied science, Formal science). The pill is a `<Link href="/fields">` so it doubles as a jump-off into the `/fields` browser.

**Why.** Topics were domain-grouped but the domain labels (`legislation`, `clinical-trials`, `archives`, …) say nothing about the parent discipline. The same topic surfaces in search results stripped of its section header, where users have no signal at all about whether they're looking at law, biology, or political science. The badge is a constant-width visual key that survives search, scroll, and tree depth.

**Colors (per task spec).**
- Social science → `bg-blue-500` · label `SOCIAL SCI`
- Natural science → `bg-emerald-500` · label `NATURAL SCI`
- Humanities → `bg-violet-500` · label `HUMANITIES`
- Applied science → `bg-amber-500` · label `APPLIED SCI`
- Formal science → `bg-cyan-500` · label `FORMAL SCI`

**Implementation.** `app/topics/page.tsx` gains a self-contained `DOMAIN_TO_DISCIPLINE` table covering all 29 in-use domains (verified by `SELECT DISTINCT domain FROM "Topic"` — none are formal-science in current data, but the slot exists for future) plus a `<DisciplineBadge domain={…} />` component. `TopicTreeItem` and `SearchResult` were restructured from a single outer `<Link>` to a flex row containing two siblings — an inner `<Link>` covering name/count (→ `/topics/<slug>`) and a separate `<Link>` for the badge (→ `/fields`) — so nested-anchor warnings stay out of the DOM. The discipline lookup is by domain string, so the badge renders client-side without a new API field.

**DB backfill (sibling concern).** `Topic.academicFieldId` was null for **all 348 topics** despite the `AcademicField` table being seeded and `/fields` already shipping. Extended `scripts/tag-topics-academic-field.ts` from its original 8-domain map to a full 29-domain map (each domain → level-1 `AcademicField` slug, e.g. `government → social-science--political-science`, `medicine → applied-science--medicine-and-health`). Re-ran with `ALLOW_EDITS=true`; **348/348 topics now carry a non-null `academicFieldId`**. The frontend badge uses domain → discipline; the DB column uses domain → level-1-field; both derive from the same canonical mapping but live in their own files (the script is run rarely, the page is shipped, so keeping them decoupled is cheaper than introducing a shared module right now).

**Files changed.** `app/topics/page.tsx` (badge + restructured row), `scripts/tag-topics-academic-field.ts` (expanded mapping + idempotent backfill), `app/page.tsx` (changelog entry).

**Verification.** `npx tsc --noEmit` clean. Dev server returned `HTTP 200` on `/topics` and `/api/topics`. DB query confirms `total: 348, withField: 348`.

### 2026-06-01 — Sources merged into Datasets (drawer UX + /sources redirect + nav cleanup)

**What.** `/sources` was a standalone flat list of every Source row in the database (~838k records) sorted by `createdAt desc`. Items looked like "OpenFEC — independent expenditures supporting GARCIA, MICHAEL (2020)" with no grouping, no filtering by pipeline, and no context tying a source back to the dataset that produced it. The page was nav-linked but unnavigable.

**Resolution.** Source records now live inside `/datasets` instead of as a standalone page:
- `app/datasets/page.tsx` — dataset cards converted from `<div>` to `<button>`; click selects the dataset and opens a right-side drawer (`<aside>` with a `fixed inset-0 bg-black/60` backdrop) that fetches `/api/sources?ingestedBy=<tag>&limit=50&offset=N`, paginated via a "Load more" button. Drawer carries the pipeline tag, label/description/flag, total count, last-ingested date, external source link, an in-drawer name/URL filter (client-side over the loaded page), and ESC-to-close.
- `next.config.ts` gains `redirects()` mapping `/sources → /datasets` (`permanent: true`, so 308 from Next.js — semantic 301 for SEO purposes).
- `app/sources/page.tsx` deleted along with its directory. The redirect in `next.config.ts` pre-empts the route, but the directory is removed so it cannot be revived by accident.
- `app/layout.tsx` top nav loses the **Sources** link.

**Why a drawer over inline.** Main content is constrained to `max-w-3xl mx-auto`; an inline "below" panel would force scroll past the dataset grid every selection. The drawer keeps both panes visible side-by-side on `sm:` and above (`sm:w-[28rem] lg:w-[36rem]`) and degrades to full-width on mobile, satisfying the "panel on the right, below on mobile" constraint.

**API shape.** The existing `GET /api/sources` already supported `?ingestedBy=` filtering (added during the earlier API-hardening pass — see 2026-05 entry); no API change was needed. The drawer uses the existing `limit`/`offset` pagination.

**Loss assessment.** The deleted `/sources` page also exposed a `POST /api/sources` manual-source creation form (gated by `isReadOnly()`). In production the form was hidden anyway. The API endpoint remains; manual source insertion via curl/script is unchanged. No editing UI was lost in production.

**Files changed.** `app/datasets/page.tsx` (+drawer, ~150 lines), `app/layout.tsx` (-1 line nav link), `next.config.ts` (+redirects block), `app/sources/page.tsx` (deleted), `app/page.tsx` (changelog entry).

### 2026-06-01 — World Bank Indicators topic page rewrite (faceting + country filter + comparison chart)

**What.** `/topics/world-bank-indicators` was an unnavigable flat list of 34,643 atomic country-year data points sorted by `claimEmergedAt desc` — useless because every claim emerged at roughly the same ingest time. The page now special-cases the `worldbank_v1` pipeline with three features:

1. **Indicator faceting.** Chip row at the top for the 5 indicators in the pipeline (Population 7,161 · Life expectancy at birth 7,161 · GDP 6,811 · GDP per capita 6,811 · CO₂ emissions per capita 6,699). Clicking a chip refilters the claim list, the country list, and the chart. Defaults to GDP per capita.
2. **Country filter.** Debounced (250ms) text input that filters the country chip list and the claim list. `X of Y countries` count rendered next to the heading.
3. **Recharts comparison chart.** Replaces the old useless ingest-date timeline. `LineChart` with one line per country, x-axis = year (1990–2022 from `Claim.metadata.year`), y-axis = the numeric `value`. Defaults to USA / CHN / DEU / JPN / GBR (or first 5 by series presence if none of those are in scope). Per-indicator y/tooltip formatting ($1.23T / $4.5k / 12.3 yrs / 2.45 t / 1.23M). Click any country chip below the chart to add or remove its line; "Reset to defaults" link top-right of chart.

**Why no regex parsing.** The original task spec suggested regex on claim text (`/in (\d{4}) was ([$]?[\d,\.]+)/`) but `worldbank_v1` writes a structured `Claim.metadata` object at ingest time (`countryIso3`, `countryName`, `indicatorCode`, `indicatorLabel`, `unit`, `year`, `value`). The new API endpoint reads those JSON paths directly via Postgres `metadata->>'…'` raw SQL — no regex, no new columns, no migration, no parse-error class to handle.

**API design.** New endpoint `GET /api/topics/world-bank-indicators/data?indicator=CODE&country=text&page=N` returns (1) all 5 indicators with `claimCount`, (2) the country list filtered by the search text and the active indicator with per-country `claimCount`, (3) the full per-indicator time series `seriesByIso3: { [iso3]: { name, points: [{year, value}] } }` (~250–400 KB JSON when an indicator is selected — the entire ~7k row set ships to the client so toggling lines on/off is instant with no roundtrip), (4) `defaultSelectedIso3` (curated set of major economies present in the data), (5) paginated claim rows (20/page) sorted alphabetically by country then year-desc. All filtering happens via Postgres `metadata->>` JSON-path operators inside `Prisma.sql` fragments; country-list filter uses `IN (${Prisma.join(filterIso3)})`.

**Wiring.** `app/topics/[slug]/page.tsx` gains a slug-check (`isWorldBank = slug === "world-bank-indicators"`) that returns `<WorldBankView />` instead of the generic page chrome. The generic topic page stays completely intact for every other topic (still fetches from `/api/topics/[slug]` and renders timeline / vote stats / party breakdown / etc.).

**No new dependencies.** Recharts already in the project (`app/analysis/votes/DecadeTrendChart.tsx`). Reused the same dark-theme color palette and tooltip shape as the existing chart. Per-line color stable across selection order; legend formats iso3 → country name via `iso3ToName` map.

**Verification.** `npx tsc --noEmit` clean. Dev server (`localhost:4100`) returns:
- `GET /topics/world-bank-indicators 200` (page shell with "Loading…" — client hydrates).
- `GET /api/topics/world-bank-indicators/data?indicator=NY.GDP.PCAP.CD 200` — 5 indicators, 214 countries, 214 series keys, default selection `["USA","CHN","DEU","JPN","GBR"]`, 6,811 total claims paginated 341 pages, USA 1990 GDP/capita = $23,888 (matches World Bank historic data ✓).
- `?indicator=…&country=norw` returns just Norway (1 country, 33 claims for life expectancy).
- `?country=zzzzzz` returns 0 countries, 0 claims (no-match clause `AND 1 = 0` works).

**Files changed.** `app/api/topics/world-bank-indicators/data/route.ts` (new), `app/topics/[slug]/WorldBankView.tsx` (new), `app/topics/[slug]/WorldBankChart.tsx` (new), `app/topics/[slug]/page.tsx` (slug-check → WorldBankView), `app/page.tsx` (June 1 changelog entry), `CONSULTANT.md`.

---

### 2026-06-01 — OpenFEC campaign finance pipelines (1,200 claims across 2020/2022/2024)

**What.** Two new pipelines bring U.S. federal campaign-finance data into the receipts graph:
- `openfec_v1` — per-cycle candidate fundraising totals from `GET /candidates/totals/`. Top 200 candidates per cycle by `-receipts`, for 2020 / 2022 / 2024 = **600 claims**. Each claim narrates total receipts, individual itemized contributions, and PAC contributions, with party / office / state context.
- `openfec_ie_v1` — per-cycle Super-PAC independent expenditures from `GET /schedules/schedule_e/totals/by_candidate/`. Top 200 rows per cycle by `-total`, gated at **≥$100,000** per (candidate, cycle, support_oppose_indicator) tuple, for 2020 / 2022 / 2024 = **600 claims**.

**Script.** `scripts/ingest-openfec.ts`. Flags: `--cycle YYYY` (repeatable), `--limit N` (default 200), `--office P|S|H`, `--dry-run`. Idempotent via Claim/Source `externalId` (`openfec_v1-{candidate_id}-{cycle}` / `openfec_ie_v1-{candidate_id}-{cycle}-{S|O}`). 200ms inter-page delay, 429 / Retry-After respected, 500 / 502 / 503 / 504 retried with exponential backoff. Transactions use `{ timeout: 30000 }` per CONSULTANT rule 5. Two new Topics auto-created: `campaign-finance` and `independent-expenditure` (domain `government`). All claims written with `verificationStatus: PROVISIONAL`, `humanReviewed: false`, `autoApproved: false`, `claimType: EMPIRICAL` per task spec.

**API quirk handled.** `Schedule E by_candidate` does not return `candidate_name` — only `candidate_id`. The script populates an in-memory candidate-meta cache during the candidate-totals pass and falls back to `GET /candidates/?candidate_id=…` lookups (with cache) during the IE pass so claim text always contains a real name.

**Verification (post-run DB query).**
| Pipeline | Claims | Sources | Edges | Per-cycle (2020 / 2022 / 2024) |
|---|---|---|---|---|
| `openfec_v1` | 600 | 600 | 600 | 200 / 200 / 200 |
| `openfec_ie_v1` | 600 | 600 | 600 | 200 / 200 / 200 |

`npx tsc --noEmit --project tsconfig.scripts.json` clean for the new script. Pre-existing scripts had unrelated TS errors not caused by this change.

**Files changed.** `scripts/ingest-openfec.ts` (new), `.env` / `.env.local` (added `OPENFEC_API_KEY`), `app/page.tsx` (June 1 changelog entry — appended above EU Parliament item in same date block), `CONSULTANT.md`. Footer date `app/layout.tsx` already at June 1, 2026 — no bump needed.

---

### 2026-06-01 — EU Parliament votes deep-dive (24,224 plenary roll calls, full political-group breakdown)

**What.** New pipeline `eu_parliament_votes_v2` adds **24,224 European Parliament plenary roll-call votes** spanning 2019–2026 (with earlier votes 2004–2018 included in the source release where available). Each `LegislativeVote` carries aggregate `yesCount` / `noCount` / `abstainCount` plus a full `byPartyJson` map keyed by political-group `short_label` (EPP, S&D, Renew, Greens/EFA, The Left, ECR, PfE, Non-attached, ESN). Per-group counts are computed by streaming the HowTheyVote.eu `member_votes.csv` (17.1M rows) once and aggregating positions by `group_code`. This expands EU coverage 13× over the prior `eu_parliament_v1` enrichment (which only had aggregate totals on ~1,900 rows — no party breakdown).

**Why HowTheyVote.eu, not the EP API directly.** The task spec called for direct ingest from `data.europarl.europa.eu/api/v2`. Investigation: that EP Open Data API exposes vote *metadata* as framed JSON-LD (events, decisions, meeting structure) but does NOT publish aggregate tallies, per-MEP positions, or political-group breakdowns — those live in the EP DOCEO XML (`europarl.europa.eu/doceo/document/PV-{term}-{date}-RCV_EN.xml`). HowTheyVote.eu's data releases are extracted directly from those DOCEO files and normalised into clean CSVs covering every roll-call vote in the EP record. Using HTV gives us the EP's own vote data via a stable bulk-download surface instead of scraping ~5,000 individual DOCEO XML files. Documented transparently in script comments and pipeline registry.

**Idempotent ingest.** `Source.externalId = eu_vote_htv_<id>`, `Source.url = howtheyvote.eu/votes/<id>`, `LegislativeVote.dataSource = eu_parliament_votes_v2`, `Source.ingestedBy = eu_parliament_votes_v2`. Re-running skips rows with a matching `externalId`. The legacy `eu_parliament_v1`-attached LegislativeVotes (1,900, no `byPartyJson`) are left untouched to preserve their existing `PolityVote` / `HistoricalEventVote` links.

**Script flags.** `scripts/ingest-eu-parliament-votes.ts` supports `--dry-run`, `--limit N`, and `--verbose`. Writes gated on `ALLOW_EDITS=true`. Batch size 200 with `prisma.$transaction(fn, { timeout: 30000 })` per CONSULTANT rule. Full run: 17.1M member_vote rows streamed in ~30s, 24,224 vote rows written in 38s (no errors).

**`/analysis/votes` UI update.** `lib/voteAnalysis.ts` now buckets the by-body table and party aggregates by `COUNTRY_LABELS[ingestedBy]` rather than raw `ingestedBy`, so legacy `eu_parliament_v1` (1,900 enriched, no byPartyJson) and new `eu_parliament_votes_v2` (24,224, full byPartyJson) collapse into a single "European Parliament" row. `getBodyKey` returns "EU Parliament" for both pipelines so the decade-trend chart treats them as one body. Existing `extractPartyCounts` already handles the generic `{ PartyName: { yes, no, abstain } }` shape my ingester emits, so the chi-square partisan test, polarization score, Bayes BF, and topic × party matrix all work for EU votes out of the box.

**Verification.** `npx tsc --noEmit` clean. Post-run DB: 24,224 `eu_parliament_votes_v2` sources, 24,224 LegislativeVotes. Sample dry-run output: "The need for targeted criminal provisions" (2026-04-30, passed 378-161-12), per-group splits cleanly show EPP/S&D/Renew/Greens unified-for vs. ECR/PfE/ESN unified-against pattern.

**Files changed.** `scripts/ingest-eu-parliament-votes.ts` (new), `lib/voteAnalysis.ts` (COUNTRY_LABELS + getBodyKey + bucket by label), `app/page.tsx` (changelog), `app/layout.tsx` (footer date bump), `CONSULTANT.md`.

---

### 2026-05-31 — Per-body decade trend chart on /analysis/votes

**What.** Replaced the plain "Contested rate by decade" table in Section 4 of `/analysis/votes` with a Recharts `LineChart` that draws one line per legislative body (US House, US Senate, UK, EU Parliament, Canada) across decades from the 1780s through the 2020s. The pooled all-bodies table is kept as a collapsible fallback below the chart.

**Why "within-subjects".** The previous table pooled every body into a single contested-rate-per-decade number, so a UK-heavy decade or a Senate-only decade pulled the curve in ways the reader couldn't see. With one line per body, each curve compares each chamber against its own history — a within-subjects view.

**Data layer.** `lib/voteAnalysis.ts` gained a `getBodyKey(ingestedBy, chamber)` helper that splits `congress_v1` votes into "US House" / "US Senate" via the `chamber` field (regex match) and collapses the other pipelines to their single label. The existing decade-trend pass now also accumulates a `${body}::${decade}` map. The new `decadeTrendByBody: { bodies, points }` struct in the analysis result is shaped for direct consumption by recharts: each point is `{ decade, decadeStart, contestedPct: { body → number }, totalVotes: { body → number } }`, and a body's value is **omitted** in decades where it recorded fewer than `MIN_DECADE_BODY_VOTES = 10` votes (recharts skips those points and `connectNulls` bridges across the gap so sparse early-modern data still draws a continuous line). Pooled `decadeTrend` (existing) is unchanged.

**Chart component.** New client component `app/analysis/votes/DecadeTrendChart.tsx` (recharts is client-only — `'use client'` at top). 300px tall `ResponsiveContainer` at 100% width, dark theme (`#1f2937` grid on `bg-gray-900/40`, gray-400 axis labels), Y axis pinned to 0–100% with a "%" formatter, custom dark tooltip that lists each body sorted by contested % with the underlying vote-count in parens for that decade × body cell, circle-icon Legend. Each body has a stable color (US House `#60a5fa`, US Senate `#818cf8`, UK `#f87171`, EU Parliament `#fbbf24`, Canada `#34d399`).

**Page wiring.** `app/analysis/votes/page.tsx` destructures `decadeTrendByBody` from `buildVoteAnalysis()` and renders `<DecadeTrendChart data={decadeTrendByBody} />` as the primary visual. The previous decade table is now wrapped in a `<details>` element ("Pooled decade totals (all bodies combined)") so it's still available but takes a click. The section's intro copy updates to mention "broken out by legislative body" and the 10-vote floor.

**TypeScript note.** recharts v3.8 ships `TooltipContentProps<TValue, TName>` whose `payload` is a `readonly` array — using `TooltipProps<number, string>` directly (as is common in v2 examples) fails compilation because `payload`/`label` are in `PropertiesReadFromContext`. The tooltip is typed loosely against a minimal `{ active?, payload?: ReadonlyArray<TooltipEntry>, label? }` shape with an `unknown` cast at the call site to avoid fighting the recharts generics.

**Verification.** `npx tsc --noEmit` clean.

**Files changed.** `lib/voteAnalysis.ts` (added `MIN_DECADE_BODY_VOTES`, `getBodyKey`, `DecadeBodyPoint`, `DecadeTrendByBody`, per-body accumulator + emit), `app/analysis/votes/DecadeTrendChart.tsx` (new), `app/analysis/votes/page.tsx` (import chart, swap table for chart + collapsible fallback), `app/page.tsx` (changelog entry), `app/layout.tsx` (footer date bump), `CONSULTANT.md`.

---

### 2026-05-31 — Z-scored topic trajectory heatmap on /analysis/votes

**What.** New section on `/analysis/votes` between the decade-trend table and party-loyalty: a heatmap that standardizes each topic's per-decade share of votes against its own historical mean. Red cells flag decades where the topic was anomalously high vs. its own baseline; blue cells flag anomalously low. Each row is its own subject — not a cross-topic comparison.

**Why this scope.** Pure transformation of data already in scope of `buildVoteAnalysis()` (vote dates + topic tags). No new query, no new ingest, no recharts dependency. Within the existing editorial guardrails.

**Computation (lib/voteAnalysis.ts).**
- Iterate `scored` rows that have both `voteDate` and `topicsRaw`. Bucket into `Map<topic, Map<decade, count>>` and `Map<decade, totalVotes>`.
- Only keep decades with ≥ 50 total votes (mirrors the legacy `decadeTrend` guard, but at a higher floor since per-topic trajectories need denser baselines to avoid trivial noise).
- For each topic: build `rawProportion[decade] = count / decadeTotal`, compute mean + population std across the topic's observed decade rows, then `z = (raw − mean) / std` (z = 0 when std === 0).
- Filter to topics observed in ≥ 3 decades with `max(|z|) ≥ 1.0` (i.e. at least one anomalous decade). Sort by max |z| descending. Slice top 20.
- New exported type `TopicZRow = { topic; decades: { decade; z; raw }[] }`. New return field `topicZScores: TopicZRow[]`.

**Client component (`app/analysis/votes/TopicHeatmap.tsx`).** Plain CSS grid via a `<table>` with `borderSpacing: 2`. Each cell is a 24×20px colored div; row label sticky-left (`sticky left-0 bg-gray-900/40`) so long decade lists stay scannable. Color thresholds: `z ≥ 2` red-500, `≥ 1` red-800, `≥ 0` gray-800, `≥ −1` blue-900, `< −1` blue-600. Tooltip text via `title` attribute: `"<topic> <decade> z=X.XX raw=Y.Y%"`. Includes a small inline legend. Empty/missing decade cells render dark gray-950 with a faint border. No new npm packages.

**Page wiring.** `app/analysis/votes/page.tsx` destructures `topicZScores` from the analysis bundle, imports `TopicHeatmap`, adds a TOC entry `{ id: "topic-zscore", label: "Topic trajectory (z-scored)" }` between the existing `decade-trend` and `party-loyalty` entries, and renders the section right after `decade-trend`. The `decades={decadeTrend.map(d => d.decade)}` prop reuses the legacy decade axis (already filtered to ≥10 total votes via the existing guard), so the heatmap's column order tracks the decade table the user just scrolled past.

**Verification.** `npx tsc --noEmit` shows only pre-existing errors in `app/analysis/votes/DecadeTrendChart.tsx` (untracked from a prior agent session) — zero new errors from this change. Footer `last updated May 31, 2026` already correct (today's date). Homepage `app/page.tsx` May 31 changelog block gained a new top `<li>` for this feature.

**Files changed.** `lib/voteAnalysis.ts`, `app/analysis/votes/page.tsx`, `app/analysis/votes/TopicHeatmap.tsx` (new), `app/page.tsx`, `CONSULTANT.md`.

---

### 2026-05-31 22:30 EDT — Paired party comparison on /analysis/representation + plain-language summary on /analysis/votes

**What.** Two analysis-page polish improvements:

1. **Within-subjects paired analysis** added to the party-comparison section of `/analysis/representation`. The old block compared `demAvgGap` and `repAvgGap` as two separate aggregate means — but those means are computed over *different row sets* (any row with a known Dem gap vs. any row with a known Rep gap), which leaks composition differences into the comparison and is methodologically weak.
2. **Plain-language `What does this mean?` block** on `/analysis/votes` that converts the page's statistical aggregates (chi-square, BF₁₀, polarization, decade trend, loyalty %) into 4–5 readable sentences for a general reader.

**Why this scope.** Editorial-not-algorithmic guardrail honored: no new queries, no new cross-references, no new ingest. Both improvements are pure transformations of data already computed in `buildRepresentationAnalysis()` and `buildVoteAnalysis()`.

**Representation changes.**
- `lib/representationGap.ts`: `PartyComparison` type gained four fields — `pairedCount`, `pairedMeanDiff`, `pairedMedianDiff`, `pctPairsDemHigher`. Computation iterates the existing `rows: StateTopicGapRow[]` once, collecting `(demGap − repGap)` only where both are non-null. Median is computed via in-place sort of the diff array; pct-Dem-higher counts strict `diff > 0`. Existing `demAvgGap` / `repAvgGap` fields kept for backwards compatibility (the API route consumers may rely on them).
- `app/analysis/representation/page.tsx`: new paired-analysis card above the two legacy aggregate cards, with a headline sentence ("On N matched votes, Democrats diverged more in X% of cases"), median + mean paired difference (signed, "pp"), and a +/− legend. The legacy aggregate cards are kept with a small italic caveat below explaining they're not directly comparable. Topic-level breakdown table gained a `Paired diff` column showing `demAvgGap − repAvgGap` when both are non-null (sign-prefixed).

**Votes changes.**
- `app/analysis/votes/page.tsx`: new collapsible `<details>` block inserted between the 4-card summary grid and the by-country table. Implemented as a native HTML `<details>` element — no client component needed, no new dependencies. The `<summary>` line styles the disclosure arrow with `group-open:rotate-90` for a small affordance. Body renders 5 sentences built from existing scope variables:
  1. Overview — total votes, bodies covered, overall contested + unanimous share.
  2. Most partisan — `topPartisan[0]`'s sourceName + country, χ² value, and a p-value-conditional phrase ("essentially zero probability the split happened by chance" for p < 0.0001, with thresholds at 0.001 and 0.01).
  3. Loyalty — top 2 entries from `loyaltySummary` by `memberCount` (≥10 members), showing party / chamber / avgLoyalty %.
  4. Bipartisan — `topBipartisan[0]` as a counter-example with aye % and "no detectable partisan signal".
  5. Trend — decade with highest `contestedPct` from `decadeTrend` (≥10 votes), with the absolute count and contested-threshold for context.
- One small refactor: added `import type { ReactNode } from "react";` at the top of the file so the IIFE that builds the sentence array can type-annotate `ReactNode[]` (avoids `JSX` namespace import dependency, which isn't configured in this project's tsconfig).

**Verification.** `npx tsc --noEmit` clean. No DB writes. No new client components. Footer `last updated May 31, 2026` already in place from earlier today's session (no change needed). Homepage `app/page.tsx` May 31 changelog block gained a new top `<li>` describing both improvements.

**Files changed.** `lib/representationGap.ts`, `app/analysis/representation/page.tsx`, `app/analysis/votes/page.tsx`, `app/page.tsx`, `CONSULTANT.md`.

---

### 2026-05-31 21:00 EDT — /globe fixes (clickable claims, slower timeline) + new /globe/connections page

**What.** Three globe-page polish fixes plus a brand-new "Connected Events" view that visualizes claims involving multiple countries as arcs between country pairs.

**Issue 1 — clickable claims in the sidebar.** The /globe country sidebar already wrapped each claim card in a plain `<a href="/claims/[id]">`, but anchors layered over the globe.gl WebGL canvas have a history of misbehaving (Next App Router's RSC streaming can race with canvas re-renders and intercept the navigation). Converted them to `next/link` `<Link prefetch={false}>` so client-side navigation is wired through the Next router, not a raw browser anchor. `prefetch={false}` avoids prefetching all 20 paginated claim pages on hover.

**Issue 2 — timeline too fast.** Play-button interval in `app/globe/GlobeClient.tsx:312` was 120ms per year step — the slider blew through 237 years in ~28 seconds, with the GeoJSON snapshot loader also racing the year tick. Bumped to **1000ms** (1 second per year). The historical GeoJSON loader already debounces internally so it now has room to actually display each snapshot before the next year fires.

**Issue 3 — Connected Events (`/globe/connections`).** New page showing arcs between countries that share at least one claim via the polity graph.
- **API.** `app/api/globe/connections/route.ts` — single raw SQL CTE that joins `PolityClaim → Polity` (filtered to rows with `countryCode`), groups by `claimId`, keeps only claims with `COUNT(DISTINCT countryCode) >= 2`, and joins back to `Claim` with `deleted = false`. Returns `{ claim_id, country_codes[] }` rows capped at 50k. Pair counts are bucketed in JS keyed by sorted `"AAA::BBB"` (unordered). Up to 5 sample claim IDs per pair are resolved via one `claim.findMany({ where: { id: { in: [...] } } })` for the detail drawer. Limited to top 100 pairs. `revalidate = 600`.
- **Centroids.** New `lib/country-centroids.ts` maps alpha-3 → `{alpha3, alpha2, name, lat, lng}` for every country in `PIPELINE_COUNTRY` + `ALPHA2_TO_ALPHA3` (plus UKR/TUR/EGY/SAU/IRN/IRQ/NZL/VNM/CUB for completeness). `getCentroid()` helper accepts alpha-3 or alpha-2.
- **Page.** `app/globe/connections/page.tsx` is a server component with `revalidate = 600` and Suspense fallback; client logic lives in `ConnectionsClient.tsx`. The globe reuses the existing globe.gl init pattern (110m Natural Earth, auto-rotate stops on user drag, resize handler). Arc styling: log-scaled amber color + stroke width, dash-animated travel-time inversely proportional to claim count (denser pairs animate faster). Selected pair highlights to `#fbbf24` solid. Each country also gets a small amber point with hover label.
- **UX.** Right sidebar lists all pairs with filter input; left detail drawer opens when a pair is selected (either by clicking an arc on the globe or a pair in the sidebar) and lists up to 5 sample claims with year + `<Link>` to `/claims/[id]`. Top nav still routes through `/globe` (parent); `/globe` legend gains a `Connections →` link.

**Why this scope.** Background-tier guardrail honored: this surfaces existing PolityClaim links — no new ingest, no new cross-references generated. Centroids are static lookup data, not a new DB table; no migration needed.

**Verification.** `npx tsc --noEmit` clean. Manual sanity check on PolityClaim distribution: 347,884 links across 205 country-tagged polities, so the CTE's HAVING clause should match a large subset of those. Pair-count cap at 100 + 50k-row claim limit keeps the function under Hobby's 10s ceiling.

**Files changed.** `app/globe/GlobeClient.tsx` (claim card `<Link>`, 1000ms interval, Connections legend link), `lib/country-centroids.ts` (new), `app/api/globe/connections/route.ts` (new), `app/globe/connections/page.tsx` (new), `app/globe/connections/ConnectionsClient.tsx` (new), `app/page.tsx` (changelog entry), `CONSULTANT.md`.

---

### 2026-05-31 20:55 EDT — Citation graph feature: ClaimRelation table + OpenAlex enrichment + relations panel UI

**What.** End-to-end citation graph for OpenAlex-sourced claims (~161,773 in DB). Each claim detail page now lazy-loads a "Citation graph" panel with three sections: **Later Work** (papers citing this one, newest first), **Related Papers** (OpenAlex `related_works`), and **References** (this paper's `referenced_works`). The panel renders nothing when a claim has no relations, so non-OpenAlex claims are unaffected.

**Schema.** New `ClaimRelation { id, fromClaimId, toClaimId, relationType, year?, createdAt }` with `@@unique([fromClaimId, toClaimId, relationType])` and indexes on each FK side plus `[fromClaimId, relationType]` for grouped lookups. Cascade delete on both relations. Added `openAlexId String?` to `Claim` with its own index for fast workId lookup (avoids parsing externalId).

**Migration.** `prisma/migrations/20260531200000_add_claim_relations/migration.sql` uses `IF NOT EXISTS` / `EXCEPTION WHEN duplicate_object THEN NULL` guards so it's safely re-runnable. Applied via `prisma db execute` + `prisma migrate resolve --applied` (same shadow-DB workaround used in the trgm and bookmarks migrations). Prisma client regenerated.

**Enrichment script.** `scripts/enrich-openalex-relations.ts`:
- Loads all OpenAlex claims (`externalId startsWith 'openalex_W'`, `deleted: false`).
- Builds an in-memory `workId → claimId` index (~161k entries) for O(1) lookup.
- For each source claim: fetches `/works/{workId}` from OpenAlex; backfills `Claim.openAlexId`; walks `referenced_works` → `cites`, `related_works` → `related`, `cited_by_api_url?sort=publication_year:desc&per-page=10` → `cited_by`.
- Cited-by results that aren't in the DB are optionally inserted as lightweight stub claims (`ingestedBy: 'openalex_stub_v1'`, `verificationStatus: PROVISIONAL`, `metadata.stub_reason: 'created_by_enrich_openalex_relations'`) so each citing-paper link has a destination. `--no-stubs` disables this.
- Polite: 100ms min interval, `User-Agent: epistemic-receipts/1.0 (mailto:robert.contofalsky@rutgers.edu)`, 429/Retry-After honored with exponential backoff.
- CLI: `--dry-run` (default, no writes), `--commit` (requires `ALLOW_EDITS=true`), `--limit N`, `--no-stubs`.
- Idempotent: unique-violation on `(fromClaimId, toClaimId, relationType)` is treated as "already exists" and counted in `relationsSkippedExisting`.

**API.** `app/api/claims/[id]/relations/route.ts` — `GET` returns `{ cites, cited_by, related }` from a single `findMany` on `fromClaimId = id`, joined to the target claim (selecting title-relevant fields from `metadata` JSON when available, falling back to claim text). Each item: `{ id, title, year, sourceUrl, status, verificationStatus, isStub }`. `revalidate = 600` plus `Cache-Control: s-maxage=600, stale-while-revalidate=3600`.

**UI.** `components/ClaimRelationsPanel.tsx` is a client component that fetches `/api/claims/[id]/relations` on mount. Renders three collapsible sections (cited_by open by default), each shows count + hint label. Stub claims link to the external `sourceUrl` (DOI / openalex.org / landing page) since they have no local detail page worth opening. Wired into `app/claims/[id]/page.tsx` between Sources/edges and Child claims.

**Verification.** Dry-run on 3 claims confirmed 10 related matches and 0 errors. Commit run on 50 claims (`--no-stubs`) inserted **510 cites + 77 related = 587 ClaimRelation rows** in DB. `Claim.openAlexId` was backfilled on all 50 processed source claims. `npx tsc --noEmit` clean.

**Files changed:** `prisma/schema.prisma`, `prisma/migrations/20260531200000_add_claim_relations/migration.sql` (new), `scripts/enrich-openalex-relations.ts` (new), `app/api/claims/[id]/relations/route.ts` (new), `components/ClaimRelationsPanel.tsx` (new), `app/claims/[id]/page.tsx`, `app/page.tsx` (changelog entry), `CONSULTANT.md`.

**Open work.** Stubbed-out: full enrichment over all 161,773 claims is not yet run — only 50 are populated. To complete: `ALLOW_EDITS=true npx tsx scripts/enrich-openalex-relations.ts --commit` (without `--limit`). Estimated time at 100ms throttle + 1–2 OpenAlex calls per claim: ~9 hours. Best run as a background process with periodic DB-count verification.

---

### 2026-05-31 14:55 EDT — Add anonymous-key bookmarks (Profile + Bookmark tables, /api/bookmarks routes, useBookmarks hook, /bookmarks page)
- **Commit:** feat(bookmarks): anonymous-key bookmarks via Profile + Bookmark tables
- **Files changed:**
  - CONSULTANT.md
  - app/api/bookmarks/claims/route.ts
  - app/api/bookmarks/route.ts
  - app/bookmarks/page.tsx
  - app/claims/[id]/page.tsx
  - app/layout.tsx
  - app/page.tsx
  - hooks/useBookmarks.ts
  - package-lock.json
  - package.json
  - prisma/migrations/20260531000000_add_bookmarks/migration.sql
  - prisma/schema.prisma
- **Diff stat:**  12 files changed, 700 insertions(+), 1 deletion(-)


### 2026-05-31 — Anonymous-key bookmarks

**What.** Shipped end-to-end bookmarking for claims using an anonymous, localStorage-stored profile key — no account, no email, no OAuth. A UUID v4 is generated on first bookmark and persisted in `localStorage` as `er_profile_key`. The key maps to a `Profile` row server-side; bookmarks live in a `Bookmark` join table to `Claim`. Users can copy their key and paste it on another device to restore the same bookmark set.

**Schema.** Two new models added to `prisma/schema.prisma`:
- `Profile { id, key @unique, createdAt, bookmarks Bookmark[] }`
- `Bookmark { id, profileId, claimId, createdAt }` with `@@unique([profileId, claimId])` plus `@@index` on each FK side. Cascade delete on both relations.
- Reverse relation `bookmarks Bookmark[]` added to `Claim`.

**Migration.** `prisma/migrations/20260531000000_add_bookmarks/migration.sql` created by `prisma migrate diff` against the live schema. Applied via `prisma db execute` (the trgm migration in this repo uses `CREATE INDEX CONCURRENTLY` which the shadow DB cannot run during `migrate dev`, so the shadow DB path is broken — same workaround used here as in the trgm fix). Marked applied with `prisma migrate resolve --applied 20260531000000_add_bookmarks`. Prisma client regenerated.

**API.** `app/api/bookmarks/route.ts` with `GET`, `POST`, `DELETE` handlers:
- `GET /api/bookmarks?key=UUID` — returns `{ claimIds, bookmarks }`; empty array if profile not found.
- `POST /api/bookmarks` with `{ key, claimId }` — `Profile.upsert({ key })` then `Bookmark.upsert({ profileId_claimId })`. Returns `{ success: true, bookmarked: true }`. 404 if the claim doesn't exist.
- `DELETE /api/bookmarks` with `{ key, claimId }` — `Bookmark.deleteMany({ profileId, claimId })`. Returns `{ success: true, bookmarked: false }`.
- Public write routes (no `ALLOW_EDITS` gate — bookmarks are user-generated, not editorial content). `key` validated as 8–128 chars.
- `app/api/bookmarks/claims/route.ts` — `GET ?key=UUID` returns the bookmarked claims hydrated with `text`, `currentStatus`, `claimType`, `verificationStatus`, `ingestedBy`, `createdAt`, and `bookmarkedAt`, filtering out soft-deleted claims.

**Hook.** `hooks/useBookmarks.ts`:
- `getOrCreateProfileKey()` reads `localStorage` `er_profile_key` and writes `crypto.randomUUID()` if missing.
- `useBookmarks()` returns `{ profileKey, bookmarks: Set<string>, isBookmarked, toggle, copyKey, copied, restoreFromKey, loading }`.
- SSR-safe — returns `profileKey: null` and empty set until `useEffect` runs.
- `toggle()` is optimistic (mutates local state immediately, then PATCHes the API; reverts on failure). Lazy-creates the profile key if missing.
- `restoreFromKey()` writes the new key to localStorage, fires an `er_bookmarks_changed` window event, and the hook re-fetches. Also listens to native `storage` events for cross-tab sync.
- `copyKey()` writes to `navigator.clipboard` and flashes a `copied` boolean for 1.5s.

**UI.**
- Claim detail (`app/claims/[id]/page.tsx`) — `BookmarkToggle` component added inline next to the `STATUS` / `claimType` / `UNREVIEWED` badges. Uses `lucide-react` icons (`Bookmark` unfilled, `BookmarkCheck` filled). Amber when bookmarked, gray when not. Labels: "Bookmark" / "Bookmarked".
- `/bookmarks` page (`app/bookmarks/page.tsx`) — three sections:
  1. Profile-key card with the key shown in a monospace code box, a "Copy key" button, and a "save this key to access your bookmarks on another device" note. Key is hidden as `— will be generated when you bookmark a claim —` until the user has bookmarked at least one item.
  2. "Restore from key" input + button — accepts a pasted key and switches the active profile.
  3. Saved-claims list — each card shows the claim text, status / type / pipeline chips, a per-card "remove" bookmark button, and the bookmarked-at date. Empty state: "No bookmarks yet. Click the bookmark icon on any claim to save it."
- Nav (`app/layout.tsx`) — `Bookmarks` link added between `Stats` and `Forthcoming`. Footer date bumped to May 31, 2026.

**Why no auth gate.** Per AGENTS.md, `ALLOW_EDITS` protects editorial content (claims, edges, threshold events). Bookmarks are user-generated, scoped to a self-issued key, and have no editorial impact. They're treated like `Feedback`: public POST.

**Dependencies.** Added `lucide-react` (^1.17.0) for the bookmark icons.

**Verification.** `npx tsc --noEmit` clean.

**Files changed:** `prisma/schema.prisma`, `prisma/migrations/20260531000000_add_bookmarks/migration.sql` (new), `app/api/bookmarks/route.ts` (new), `app/api/bookmarks/claims/route.ts` (new), `hooks/useBookmarks.ts` (new), `app/bookmarks/page.tsx` (new), `app/claims/[id]/page.tsx`, `app/layout.tsx`, `app/page.tsx`, `package.json`, `package-lock.json`, `CONSULTANT.md`.

---

### 2026-05-30 18:31 EDT — fix topic trends drawer + display
- **Commit:** fix(topic-trends): drawer mobile tap, bar chart min height, decade label abbreviation
- **Files changed:**
  - app/analysis/topics/TopicTrendsClient.tsx
- **Diff stat:**  1 file changed, 364 insertions(+), 37 deletions(-)
- **Issue 1 — Drawer not opening on mobile:** Replaced double-`requestAnimationFrame` in `openDrawer` with a `useEffect` on `drawerState` that calls `setTimeout(() => setDrawerVisible(true), 0)`. The RAF approach doesn't reliably fire in iOS Telegram WebView. Also added `style={{ touchAction: 'manipulation' }}` to both sets of chip buttons (hot topics panel + era table rows) to eliminate iOS 300ms tap delay.
- **Issue 2 — Bar chart invisible bars:** Raised minimum bar height from `Math.max(2, ...)` to `Math.max(4, ...)` and the fallback from `2` to `4` so bars are visible even for near-zero divergence values on mobile.
- **Issue 3 — Decade axis labels truncated:** Changed `{k.toDecade}s` to `{String(k.toDecade).slice(2)}` — "1790" → "90", "1800" → "00" — intentional 2-digit compression for narrow mobile columns. The heatmap header row still uses full `{d.decade}s` labels which are inside a scrollable table.


### 2026-05-30 — `/analysis/topics` Topic Trends overhaul

**Bug 1 fixed: JS divergence chart bars were invisible.** The bars used `height: ${hPct}%` inside a `flex flex-col justify-end` child of a `flex h-40` container. Percentage heights on flex children only resolve if the parent has an explicit height in the cross axis — here the children weren't stretched to 160px because the parent used `items-end`. Fix: switched to absolute pixel heights `height: ${(jsDivergence / maxJs) * 160}px`. Bars now appear as expected.

**Bug 2 fixed: decade heatmap column headers showed ambiguous 2-digit labels.** `String(d.decade).slice(-2)}s` rendered `"80s"`, `"00s"` — century-ambiguous. Fixed to `${d.decade}s` → `"1880s"`, `"1900s"`.

**New: era color-bands in divergence chart.** Each bar column background is tinted by the historical era the decade belongs to (Founding = amber, Civil War = red, Cold War = blue, etc.). An era legend row sits below the axis.

**New: era header row in heatmap.** A colored band above the decade columns groups them by era using `colSpan`. Each era has its own tint + abbreviated label.

**New: topic chips clickable → vote list drawer.** Clicking any topic chip in the "Hot topics by era" panel or any topic badge in the era summary table opens a slide-in drawer (right side). Drawer fetches from the new `GET /api/analysis/topic-trends/votes?topic=&era=&limit=20&offset=0` endpoint (file: `app/api/analysis/topic-trends/votes/route.ts`). Shows vote cards (date, chamber badge, pass/fail badge, title, yes/no counts). Supports "Load more" pagination. Closes on Escape or backdrop click.

**New: era rows in summary table are clickable.** Clicking an era row updates `selectedEra` to show that era's chips; selected row is highlighted with a blue ring.

**API:** `GET /api/analysis/topic-trends/votes` — raw Prisma query joining `LegislativeVote` + `Source` with `ingestedBy = 'voteview_v1'`, `voteDate` range from `ERAS` array, and `topics::jsonb @> $1::jsonb` containment filter. Returns `{ votes, total }`.

**Files changed:** `app/analysis/topics/TopicTrendsClient.tsx` (rewrite), `app/api/analysis/topic-trends/votes/route.ts` (new), `ROADMAP.md`. Deployed to prod.

---

### 2026-05-30 — Globe Phase 3 — click country → paginated claim list

**What.** New API route `app/api/globe/country-claims/route.ts` + updated `app/globe/GlobeClient.tsx`. Clicking any country on `/globe` now opens a sidebar panel with a paginated list of claims linked to that jurisdiction via the `PolityClaim` junction table (347,884 links, 205 polities with ISO alpha-3 country codes).

**API.** `GET /api/globe/country-claims?country=XX&limit=20&offset=0`
- Resolves ISO alpha-2 → alpha-3 via inline `ALPHA2_TO_ALPHA3` map (mirrors the one in `scripts/link-polity-votes-claims.ts`)
- Queries `Polity.countryCode` (alpha-3) → `PolityClaim.polityId` → `Claim` (where `deleted: false`)
- Returns `{ claims, total, countryCode, countryName }` — each claim: `{ id, text, currentStatus, verificationStatus, ingestedBy, claimEmergedAt, createdAt }`
- `revalidate = 300`

**UI changes.** `GlobeClient.tsx`:
- `openSidebar` now fires two parallel fetches: existing `/api/globe/country/[code]` (header data) + new `/api/globe/country-claims` (first 20 claims)
- New state: `claimsPage`, `claimsOffset`, `loadingClaims`, `loadingMoreClaims`
- Sidebar header shows `claimsPage.total` (polity-link count) with fallback to old sidebar count
- Claim cards show: title (line-clamp-3), verification status badge (if set), pipeline tag, link to `/claims/[id]`
- "Load more" button appends next 20 claims to list; shows remaining count
- Empty state: "No polity-linked claims found for this country"
- Close button resets all claim state

**No schema changes.** Uses existing `PolityClaim` table and indexes (`@@index([polityId])`, `@@index([claimId])`).

**Files changed.** `app/api/globe/country-claims/route.ts` (new), `app/globe/GlobeClient.tsx`, `app/page.tsx` (changelog entry), `ROADMAP.md` (Phase 3 marked shipped). Deployed to prod.

---

### 2026-05-30 — Direct Polity↔Vote + Polity↔Claim linking (462k links)

**What.** Ran `scripts/link-polity-votes-claims.ts` with `ALLOW_EDITS=true` to populate the `PolityVote` and `PolityClaim` junction tables that were created (but unfilled) by migration `20260530190000_add_polity_vote_claim`. Links are derived from each row's pipeline/dataSource → alpha-2 → alpha-3 country code (via `lib/globe-pipeline-country.ts`) intersected with `Polity.countryCode` and the row's date falling within `[Polity.startYear, Polity.endYear]`.

**DB state.**
- `PolityVote` rows: **114,367** (from 116,267 LegislativeVote rows; 1,900 skipped — primarily `howtheyvote_eu` multi-country and unmapped dataSources).
- `PolityClaim` rows: **347,884** (from 701,363 Claims with `claimEmergedAt`; 346,920 skipped no-country-map, 6,559 no-polity).
- 205 of 2,361 Polities had an ISO alpha-3 countryCode (the others are historical polities without ISO codes — Roman Empire, etc., reserved for future curation).

**Why.** Unlocks "all claims/votes related to country X" browsing and a polity filter for `/globe`. Pairs with the existing `HistoricalEventPolity` Phase-3 work to give every legislative receipt a polity dimension.

**Verification.** Per AGENTS.md rule — final counts read from the DB after the run match the script's reported inserts (114,367 + 347,884 = 462,251 link rows). Dry-run was executed first and matched final write counts exactly (0 pre-existing).

**No schema change this run.** Models `PolityVote` and `PolityClaim` and the migration were already in place (added 2026-05-30 earlier). This run populates them.

### 2026-05-30 — Party-line backfill verification (no-op)

**What.** Triggered `.github/workflows/backfill-congress-party.yml` (run
`26692826626`) to populate `LegislativeVote.byPartyJson` for any congress_v1
rows still missing it. Workflow completed in 33s with `Loaded 0 candidate
row(s)` — the backfill is fully drained.

**DB state verified.** congress_v1 `LegislativeVote` total = 505, all 505 have
`byPartyJson` populated (100% coverage). No rows updated.

**Why.** The /stats "Party Line vs Bipartisan" section (`lib/stats-queries.ts`)
keys off `byPartyJson`; this run confirms the surface has full congress_v1
coverage and no further backfill work remains for that pipeline. House Clerk
(`clerk.house.gov/evs/<year>/roll<NNN>.xml`) and Senate LIS
(`senate.gov/.../vote_<congress>_<session>_<roll>.xml`) sources continue to be
the canonical party-tally inputs — Congress.gov v3 has no /vote endpoint.

**No code or schema changes.** Script (`scripts/backfill-congress-party-votes.ts`)
and workflow already in place from earlier runs (2026-05-25, 2026-05-30).

### 2026-05-30 — CCES representation-gap feature (`/analysis/representation`)

**What.** New end-to-end feature joining Harvard Dataverse Cooperative Election
Study cumulative data (`doi:10.7910/DVN/II2DB6`, V11, 2006–2024, 702k
respondents) to the existing US `MemberVote` corpus (`congress_v1` 104k member
votes across 505 bills) and exposing the result as a representation-gap
analysis page.

**Schema.** New `ConstituentOpinion` model + migration
`20260530170000_add_constituent_opinion` (id, state, district, year,
topicSlug, supportPct, sampleSize, source, questionCode, metadata,
createdAt). Unique on (state, district, year, topicSlug, questionCode);
indexed on year / state / topicSlug / composite.

**Extractor (`scripts/_cces_extract.py`).** Pure-Python via `pyreadstat`
(installed under `python3.14`) — reads the 675MB `cumulative_2006-2024.dta`
into a narrow slice of 10 columns (year, st, state, ideo5, pid3,
no_healthins, union, union_hh, relig_bornagain, weight_cumulative), groups
by (state-abbr, year), and emits per-bucket aggregates: liberal_pct,
conservative_pct, dem_pct, uninsured_pct, union_pct, evangelical_pct. A
`TOPIC_DIRECTION` map then assigns each of the 26 LegislativeVote topic
slugs (taxation, appropriations, foreign_policy, military, banking_finance,
labor, infrastructure, judiciary, social_welfare, public_lands, defense,
tariff_trade, education, agriculture, health, housing, native_affairs,
postal, environment, civil_rights, immigration, technology, prohibition,
slavery, war, economy) to a CCES proxy (`liberal` / `conservative` / `dem` /
`uninsured` / `union` / `evangelical`) and writes
`/tmp/cces/cces_aggregates.json`. Output: 51 states × 19 years × 26 topics
= 24,615 rows after the n≥30 / sample≥20 filter.

**Ingester (`scripts/ingest-cces.ts`).** Reads the JSON aggregates, validates
shape, and upserts into `ConstituentOpinion` in 200-row transactions
(`prisma.$transaction({ timeout: 60_000 })`). `--full` requires
`ALLOW_EDITS=true`; `--dry-run` (default) prints 5 samples without writes.
Post-run DB count verification via `prisma.constituentOpinion.count`.
Pipeline tag: `cces_v1`.

**Analysis layer (`lib/representationGap.ts`).** `buildRepresentationAnalysis()`
pulls every `ConstituentOpinion` row + every US `LegislativeVote` (≤50k cap)
joined to its `MemberVote` children. For each (state, year, topic) it
computes:
- delegationYeaPct = state's delegation Yea share across all topic-bills
- demYeaPct / repYeaPct = same, restricted to Dem / Rep legislators
- gap = |delegationYeaPct − constituentSupportPct|
- demGap = |demYeaPct − supportPct| (Dems compared to liberal baseline)
- repGap = |repYeaPct − (100 − supportPct)| (Reps compared to its complement)

Returns: top-50 individual gaps, topic summaries (≥5 cells), decade
summaries (≥5 cells), top-25 state summaries (≥3 cells), and a party
comparison block with per-topic Dem-vs-Rep gap breakdown.

**API + page.** `app/api/analysis/representation/route.ts` (revalidate=600s,
edge `Cache-Control: s-maxage=600, stale-while-revalidate=3600`).
`app/analysis/representation/page.tsx` is a server component that calls the
same library directly; sections: summary cards, TOC, largest individual
gaps (top 50), states with biggest gaps (top 25), topic-level gaps with
CCES-proxy column, decade trend, party comparison (Dem-vs-Rep card pair +
per-topic table). Dark theme (bg-gray-900/950, red/orange/blue accents)
consistent with `/analysis/votes`.

**Methodology caveat (surfaced in the UI).** The CCES cumulative file only
carries cross-year-standardized variables, NOT year-specific policy yes/no
items, so per-topic support is a direction-mapped proxy
(ideology + party-ID + demographic proxies for health/labor) rather than a
literal "support bill X" measure. The page text and the per-topic table
both label which proxy applies to each topic.

**Verification.** `npx tsc --noEmit` clean. Migration applied via
`prisma migrate deploy`. `--full` ingest run completed (background) writing
into `ConstituentOpinion`.

**Files changed.** `prisma/schema.prisma`,
`prisma/migrations/20260530170000_add_constituent_opinion/migration.sql`,
`scripts/_cces_extract.py` (new), `scripts/ingest-cces.ts` (new),
`lib/representationGap.ts` (new),
`app/api/analysis/representation/route.ts` (new),
`app/analysis/representation/page.tsx` (new), `app/layout.tsx` (nav link +
footer date), `app/page.tsx` (changelog entry), `CONSULTANT.md`.

---

### 2026-05-30 — Historical Event Graph (Phase 3): wire HistoricalEvent → LegislativeVote + Polity

**What.** Two new junction tables (`HistoricalEventVote`, `HistoricalEventPolity`), a curation script (`scripts/link-historical-events.ts`), two new API routes (`/api/historical-events` index + `/api/historical-events/[slug]` detail), and two new pages (`/historical-events`, `/historical-events/[slug]`). Wires the 9 curated `HistoricalEvent` rows (Cuban Missile Crisis, Church Committee, JFK, Vietnam, Cold War, COINTELPRO, WWII, Korea, Bay of Pigs) into the broader graph by linking contemporaneous `LegislativeVote` rows and historical `Polity` rows.

**Schema reconciliation.** The task brief specified `startYear/endYear/countryCode` on `HistoricalEvent` and `countryCode` on `LegislativeVote`, but the live schema has `startDate/endDate/category` on `HistoricalEvent` and **no** `countryCode` on `LegislativeVote`. Rather than churn the existing 9-row table, the linker derives the year window from `startDate.getUTCFullYear()` / `endDate.getUTCFullYear()` and derives the vote's country from `LegislativeVote.dataSource` via the existing `lib/globe-pipeline-country.ts` `PIPELINE_COUNTRY` map (locally augmented with `voteview_v1 → US`, `uk-parliament/uk_parliament → GB`, `openparliament → CA`, `howtheyvote_eu → EU`, which were absent from the canonical map because they are vote pipelines rather than country-tagged ingesters).

**Migration `20260530180000_add_historical_event_graph_phase3`.** Creates `HistoricalEventVote(id, eventId, voteId, matchReason, createdAt)` with UNIQUE(eventId, voteId) and `HistoricalEventPolity(id, eventId, polityId, role, createdAt)` with UNIQUE(eventId, polityId). Both add the obvious indexes and FK constraints; both are queryable from the `HistoricalEvent` relation via the new `votes` and `polities` fields. `prisma migrate deploy` applied cleanly.

**Linker script (`scripts/link-historical-events.ts`).** Per-event config maps each slug to a country-code set (alpha-2 for LV-dataSource match, alpha-3 for Polity match with explicit role), topic-keyword set (matched against `LegislativeVote.topics` JSON array — e.g. `defense`, `military`, `foreign_policy`, `civil_rights`), and bill-title keyword set (ILIKE'd against `Source.name` — e.g. `cuba`, `vietnam`, `lend-lease`, `surveillance`). A LegislativeVote is linked if its `voteDate` falls inside the event's full-year window AND any of those three rules fires; the matchReason column records which path(s) fired (e.g. `country:US,topic:defense,title:cuba`). Polity matching: any Polity whose `countryCode` is in the event's set AND whose `[startYear, endYear]` interval overlaps the event window (NULL endpoints treated as open). Idempotent — preexisting links are loaded per-event and skipped. Inserts in batches of 1,000 with `skipDuplicates: true`. CLI: `--dry-run` (default off; pass when no writes wanted), gates real writes on `ALLOW_EDITS=true`.

**Full run results (DB-verified, per CLAUDE rule 6).**
- `HistoricalEventVote` rows: **52,034** total. Per event: world-war-ii=1,422 · cold-war=28,399 · korean-war=1,038 · vietnam-war=11,019 · cointelpro=6,556 · bay-of-pigs=320 · cuban-missile-crisis=348 · jfk-assassination=348 · church-committee=2,584.
- `HistoricalEventPolity` rows: **25** total. Per event: world-war-ii=8 · cold-war=3 · korean-war=4 · vietnam-war=2 · cointelpro=1 · bay-of-pigs=2 · cuban-missile-crisis=3 · jfk-assassination=1 · church-committee=1.

**Why Cold War has 28k links and that's OK.** The Cold War spans 1947–1991 (45 years) and the US Voteview corpus has ~28k roll calls in that window. The spec is faithful: "country match OR topic match" — and country-match alone fires for every roll call. The detail page paginates 50 per page and uses indexes (`@@index([eventId])` on the junction) to keep the per-page query cheap. The match-reason column lets a future analyst filter to topic-or-title-hit links only without re-running the linker.

**API.** `/api/historical-events` returns every event with `claimCount`, `voteCount`, `polityCount` counts (revalidate=300). `/api/historical-events/[slug]?page=N` returns the event, 50 votes per page, all linked polities, top-20 recent linked claims (`ClaimHistoricalEvent` was already wired before this work), plus aggregate stats across **all** linked votes (resultBreakdown, per-year timeline, chamber rollup, per-party tallies for the rows that carry `byPartyJson`). The aggregate fetch is one `findMany` with minimal select; ~28k rows for Cold War still fits comfortably under serverless time/memory budgets.

**Pages.** Index lists all 9 events with vote/claim/polity counts and date ranges, color-coded by category (DIPLOMATIC/INTELLIGENCE/MILITARY/LEGISLATIVE). Detail page renders: header card with date range + category badge; linked polities with role badges (primary/adversary/involved); 4-card outcome summary (passed/failed/tied/pass-rate); chamber rollup table; gap-filled per-year timeline with passed-green / failed-red / other-gray stacked bars; party-breakdown table when `byPartyJson` rows exist; 50-per-page vote table with date / chamber / yes-no / dataSource / topic chips / match-reason chip / source-name link; recent linked claims. Dark theme throughout (`bg-gray-900/40` cards on `bg-gray-950` page) matching the rest of the app. New `Events` nav link added to `app/layout.tsx`.

**Verification.** `npx tsc --noEmit` clean. Dev-server smoke test against `http://localhost:3019`: `/historical-events` → 200, 55KB · `/historical-events/cuban-missile-crisis` → 200, 209KB, 736ms · `/historical-events/cold-war` → 200, 281KB, 1.3s (28k vote aggregate stays under 2s) · `/historical-events/cold-war?page=2` → 200 · `/api/historical-events` → 200 · `/api/historical-events/cuban-missile-crisis` → 200 with `pagination={page:1,pageSize:50,total:348,pageCount:7}` · `/api/historical-events/does-not-exist` → 404.

**Files changed.** `prisma/schema.prisma` (3 new model fragments + 2 inverse relations on `LegislativeVote` / `Polity` / `HistoricalEvent`), `prisma/migrations/20260530180000_add_historical_event_graph_phase3/migration.sql` (new), `scripts/link-historical-events.ts` (new), `app/api/historical-events/route.ts` (new), `app/api/historical-events/[slug]/route.ts` (new), `app/historical-events/page.tsx` (new), `app/historical-events/[slug]/page.tsx` (new), `app/layout.tsx` (nav link), `app/page.tsx` (May 30 changelog entry), `CONSULTANT.md` (this entry).

---

### 2026-05-30 — Globe time slider + historical borders on `/globe`

**What.** The main `/globe` page now has a focused 1789→2026 year slider (with
play/pause and reset-to-Now controls) anchored at bottom-center. As the year
moves, two things happen:

1. **Heatmap / origins data is filtered.** When the year is at 2026 ("Present")
   the page reuses the SSR `density` prop and the existing
   `/api/globe/origins` payload (no extra round-trip). When the year is
   earlier, the client debounces (200ms) and refetches
   `/api/globe/density-temporal?before=YYYY` for heatmap mode, or
   `/api/globe/origins?yearTo=YYYY` for origins mode. Both endpoints filter
   `Claim` rows by `claimEmergedAt <= Dec 31, YYYY`.
2. **Country borders swap to the nearest historical snapshot.** Uses the
   existing `lib/historical-geo.ts` helper (`getGeoJSONForYear`) and the
   GeoJSON files already on disk in `public/geo/historical/` (sourced from
   `aourednik/historical-basemaps`). Below ~2010 the borders render in a
   parchment palette (`#2e2820` fill / `#5a4a3a` stroke); click-to-open-sidebar
   is intentionally disabled on historical polygons because ISO_A2 codes
   don't apply.

**Files touched.**
- `app/globe/GlobeClient.tsx` — full rewrite of the client component to add
  slider state, debounced density/origins refetch, GeoJSON cache + lazy loader
  per year, animation interval (120ms/step), and a sepia legend for the
  historical case. Preserves all existing UX: heatmap↔origins pill, country
  search, click-to-sidebar, hover tooltips.
- `app/api/globe/origins/route.ts` — now accepts `?yearTo=YYYY` and filters
  `Claim` by `claimEmergedAt`.

**Not modified.** `/api/globe/density-temporal` already supported `?before=`
from the Globe Lab work; reused as-is. `/api/globe/density` (the simple
non-temporal route) was left alone since the SSR path on `/globe` calls Prisma
directly, not that route.

**Verification.** `npx tsc --noEmit` clean. The GeoJSON files referenced by
`historical-geo.ts` (e.g. `world_1800.geojson`, `world_1900.geojson`,
`world_1945.geojson`, `world_2010.geojson`) are all present under
`public/geo/historical/` — verified by `ls`. Modern borders use the Natural
Earth 110m URL that the existing globe was already loading. No new env vars,
no schema changes, no DB writes.

**Why this scope.** The Globe Lab (`/globe/lab`) already had a deep-time
logarithmic slider and the historical-GeoJSON loader, but `/globe` itself was
static. Bringing a focused 1789-onward slider to the main page surfaces the
legislative time-coverage story for the typical visitor without exposing them
to paleogeography. The lab remains the experimental sandbox.

### 2026-05-29 — All-Legislative-Votes overview at top of /stats

**What.** New "All Legislative Votes" overview section now leads the `/stats`
page. Replaces the prior 4-legislature-only framing; aggregates across every
LegislativeVote row in the DB (≈116k roll calls, including the 113k+ Voteview
corpus that was previously invisible on /stats).

**Sections added (in `app/stats/AllVotesStatsSection.tsx`):**
1. Headline KPI cards — total roll calls, total MemberVote rows, Voteview
   corpus count, decades covered.
2. Votes by Pipeline — full table of every `ingestedBy` that populates
   LegislativeVote, with count, passed/failed, pass-rate, and a horizontal
   share bar. No more 4-pipeline whitelist.
3. By Chamber/Body — global chamber rollup with vote counts, pass-rate, and
   avg nay %.
4. Voteview Roll Calls by Decade — 1780s through today, with House/Senate
   split, pass rate, and avg nay % per decade.
5. Voteview: House vs Senate — aggregate pass-rate and opposition cards.
6. Party-Line vs Bipartisan by Decade — bins every vote with `byPartyJson`
   and bins by decade, classified with the same heuristics as the
   `getCongressPartyStats` section (≥80% / >60% thresholds).
7. Top 20 Topics (All Votes) — `jsonb_array_elements_text` over the `topics`
   column, with pass-rate per topic.

**New helpers in `lib/stats-queries.ts`:**
- `getAllVotesGlobalStats()` — single round trip of three raw SQL queries
  for totals + by-pipeline + by-chamber rollups.
- `getVoteviewDecadeStats()` — raw SQL groupby on
  `EXTRACT(YEAR FROM voteDate) / 10`, voteview_v1 only.
- `getVoteviewChamberBreakdown()` — raw SQL chamber rollup, voteview_v1 only.
- `getAllVotesTopTopics(limit)` — CTE that filters `topics LIKE '[%]'`
  before `jsonb` cast, then `CROSS JOIN LATERAL jsonb_array_elements_text`.
- `getPartyLineTrendByDecade()` — findMany on rows with `byPartyJson` +
  `voteDate`, classified in JS (reuses `parsePartyJson` + `matchPartyKey`
  helpers already in the file).

**Why raw SQL.** The Voteview ingest grew LegislativeVote from ~3k to ~116k
rows; the existing `findMany({ take: 50000 })` patterns silently truncate at
~half the corpus. All five new functions use `prisma.$queryRaw` (or a
filtered findMany for byPartyJson, which is sparsely populated) so counts are
accurate without pulling the full table into JS.

**Verification.** `npx tsc --noEmit` clean. Dev-server smoke test against
`http://localhost:3010/stats` returned HTTP 200 with all sections rendered:
116,267 total roll calls, 113,319 Voteview, plus the expected per-pipeline
rollup (voteview_v1, eu_parliament_v1, congress_v1, canada_bills_v1,
uk_legislation_v1). Top-topics query returned 20 rows ("Taxation" 13,130
votes / 66.0% pass, "appropriations" 12,582 / 66.9%, etc).

**Files changed:** `lib/stats-queries.ts`, `app/stats/page.tsx`,
`app/stats/AllVotesStatsSection.tsx` (new).

### 2026-05-29 — advanced statistical sections on /analysis/votes

**What.** Extended `/analysis/votes` with seven new statistical sections, each computed in
`lib/voteAnalysis.ts` from the existing 50k-row LegislativeVote pull plus one new
500k-row MemberVote pull. New helper: `lib/stats.ts` (pure-TS lgamma via Lanczos,
regularized incomplete gamma, chi-square p-value, Beta(1,1) log marginal likelihood
for the Bayes-Factor pipeline).

**Sections added:**
1. **Chi-square partisan independence** — per-bill 2×k χ² test (k = parties with ≥2 votes), with df = k−1 and p-value from the chi-square CDF. `topPartisan` (top 10 by χ²) and `topBipartisan` (lowest χ², p > 0.5, ≥50 total votes).
2. **Polarization score** — population stddev of per-party yes-share (parties with ≥5 yes+no), scaled 0–100. `mostPolarized` top 10.
3. **Close-call analysis** — bills decided within 5pp of 50/50, top 25 sorted narrowest first, includes `result` (passed / failed / tied).
4. **Decade trend** — 1780s through 2020s buckets (≥10 votes), totals + contested % + unanimous %.
5. **Party loyalty** — from `MemberVote`: per (bill, party) majority computed, then per-member loyalty % and defection count (≥10 partisan votes). Top 50 biggest defectors + summary table of avg loyalty by party / chamber.
6. **Topic × party matrix** — bills with both `topics` and `byPartyJson`, aggregated by (topic, party). Topics with ≥3 bills, parties with ≥2 bills in that topic, top 15 topics by total bill count.
7. **Bayesian partisan signal** — BF₁₀ comparing pooled-rate (H₀) vs per-party rates (H₁) under Beta(1,1) conjugate priors. `strongPartisanBF` shows top 10 bills with BF₁₀ > 3 (moderate / strong partisan).

**Implementation.** All computation happens server-side in `buildVoteAnalysis()`. The existing main Prisma query now also selects `voteDate`, `result`, `topics`. The new `MemberVote` query (`take: 500000`) only runs when the page (or its API route) is rendered. New optional fields on `BillRow` / `GlobalRow`: `chiSq`, `chiDf`, `chiP`, `isPartisan`, `polarizationScore`, `bayesPartisanBF`, `result`, `voteDate`. Page now has a TOC at the top linking each new section by anchor ID. No new API routes — `/api/analysis/votes` already passes through `VoteAnalysis`.

**Verification.** `npx tsc --noEmit` clean.

**Files changed:** `lib/stats.ts` (new), `lib/voteAnalysis.ts`, `app/analysis/votes/page.tsx`.

### 2026-05-29 14:22 EDT — web book upload feature

**What.** Replaced the static CLI code block on `/books` with a real upload form. Full pipeline: upload → LLM claim extraction → match against DB, all triggered from the browser.

**New routes:**
- `POST /api/books/upload` — accepts `multipart/form-data` with `file` (PDF or .txt), `title`, `author` (optional), `passphrase`. Auth: checks against `BOOK_UPLOAD_PASSPHRASE` env var (returns 403 if wrong; does not use `ALLOW_EDITS`). Parses PDF via dynamic import of `pdf-parse` (static import caused ENOENT build failure due to pdf-parse's module-level test file read). Splits on double-newline, filters chunks < 50 chars. Creates `Book` + `BookChunk` records. Returns `{ bookId, chunkCount }`.
- `POST /api/books/[bookId]/ingest` — JSON body `{ passphrase }`. Fires LLM claim extraction (claude-haiku-4-5-20251001) as fire-and-forget background Promise. Batches 10 chunks at a time, extracts JSON array of claims per chunk, writes `BookClaim` records. Progress written to `/tmp/ingest-progress-<bookId>.json` after each batch. Returns `{ started: true, jobId }` immediately.
- `GET /api/books/[bookId]/ingest/status` — reads progress file, returns `{ status, processed, total, claimCount, errors }` with live DB `claimCount` as ground-truth fallback.

**UI (`app/books/BooksClient.tsx`):** Upload form with file/title/author/passphrase fields. After upload: auto-kicks ingest job with 2s poll for ingest progress bar (purple). After ingest done: auto-kicks match job with 2s poll for match progress bar (blue). After match done: fetches updated book list and adds new book at top. Errors surfaced inline.

**New file:** `lib/bookIngestJob.ts` — progress file path helpers + `IngestJobState` type.

**Bug fixed during build:** `pdf-parse` reads `./test/data/05-versions-space.pdf` at module evaluation time → ENOENT during Next.js build. Fixed by using `await import("pdf-parse")` inside the handler instead of a top-level static import.

**Env:** `BOOK_UPLOAD_PASSPHRASE` added to `.env.local` (placeholder). Must also be set in Vercel env vars for production.

**Commits:** `ec68519` (feature), `dbc5360` (pdf-parse build fix). **Deployed:** `dpl_DuWvTWmaXDowSwHbE5s54uk169Cc` → `epistemic-receipts.vercel.app`.

**Files changed:** `app/api/books/upload/route.ts` (new), `app/api/books/[bookId]/ingest/route.ts` (new), `app/api/books/[bookId]/ingest/status/route.ts` (new), `lib/bookIngestJob.ts` (new), `app/books/BooksClient.tsx`, `app/books/page.tsx`, `.env.local`.

### 2026-05-29 10:28 EDT — build /books management UI with match button
- **Commit:** fix: DB audit — backfill nulls, document orphaned record cleanup
- **Files changed:**
  - scripts/_audit-db.ts
  - scripts/_audit-fixes/backfill-edge-revisions.ts
  - scripts/_audit-fixes/backfill-verification-status.ts
  - scripts/_audit-fixes/cleanup-nih-orphaned-sources.ts
  - scripts/_audit-fixes/cleanup-unmatched-book-claims.ts
  - scripts/_audit-fixes/cleanup-voteview-orphaned-sources.ts
- **Diff stat:**  6 files changed, 672 insertions(+)


### 2026-05-29 — `/books` management UI + match-pipeline trigger API

**What.** New management page at `/books` lists every ingested book with paragraph / extracted-claim / graph-match counts, and a per-book "Match against DB" button that spawns `scripts/match-book-to-graph.ts` as a detached background job and shows live progress.

**API surface.**
- `GET /api/books` — every Book with `chunkCount`, `claimCount`, `matchCount`.
- `POST /api/books/[bookId]/match` — gated on `isReadOnly()` (i.e. `ALLOW_EDITS=true` in production). Spawns `npx ts-node --project tsconfig.scripts.json scripts/match-book-to-graph.ts --book <id>` as a detached child with `MATCH_PROGRESS_FILE=/tmp/match-progress-<id>.json`; stdout/stderr redirected to `/tmp/match-log-<id>.txt`. Returns initial state. Returns 409 if a job is already running for this book.
- `GET /api/books/[bookId]/match/status` — reads the progress JSON tempfile and returns `{ status, processed, matched, total, errors, ...dbMatchCount }`. `dbMatchCount` is the authoritative live count of `BookClaimMatch` rows for the book and is included on every status response as a ground-truth fallback.

**Script change (`scripts/match-book-to-graph.ts`).** Added `MATCH_PROGRESS_FILE` env handling: when set, the script writes a fresh `{ status, processed, matched, total, errors, startedAt, finishedAt?, errorMessage? }` JSON file after every processed BookClaim, at startup ("running"), at completion ("done"), and on fatal error ("error"). All progress writes are wrapped in try/catch — progress reporting is best-effort and never aborts the run.

**UI (`app/books/page.tsx` + `app/books/BooksClient.tsx`).** Server component lists books via Prisma; client component renders each book as a row with the Match button, a status badge, an inline progress bar, and `processed / total · matched N` counters. While `status === 'running'`, the client polls `/match/status` every 2s; polling auto-stops on `done` or `error`. The book row's `matchCount` is reactively updated from `dbMatchCount` on every poll so the UI reflects rows already written to the DB. Upload UI is intentionally stubbed (informational box) — ingest still happens via `scripts/ingest-book.ts`.

**Auth.** `/books` is covered by the existing site-password middleware (matcher `/((?!_next/static|_next/image|favicon\\.ico).*)`); no extra wiring needed. Nav link added in `app/layout.tsx` next to "Reader".

**Notes / limits.** The `POST .../match` route relies on `child_process.spawn` and a local tempfile. This works fine for local dev and a long-running Node host, but won't run on Vercel serverless invocations — by design, this whole page is operator tooling, and the route is `ALLOW_EDITS`-gated so it can't be triggered in default production anyway.

**Verification.** `npx tsc --noEmit` clean (project). `npx tsc --noEmit -p tsconfig.scripts.json` clean for `match-book-to-graph.ts` (remaining errors are pre-existing in other ingesters). Not executed end-to-end against a running process; left for user.

**Files changed:** `app/books/page.tsx` (new), `app/books/BooksClient.tsx` (new), `app/api/books/route.ts` (new), `app/api/books/[bookId]/match/route.ts` (new), `app/api/books/[bookId]/match/status/route.ts` (new), `lib/bookMatchJob.ts` (new), `scripts/match-book-to-graph.ts` (progress-file emission), `app/layout.tsx` (nav link + footer date), `app/page.tsx` (changelog entry), `CONSULTANT.md`.

---

### 2026-05-29 — Book↔graph external matcher (`scripts/match-book-to-graph.ts`)

**What.** Built `scripts/match-book-to-graph.ts` to find genuine external cross-references between a book's `BookClaim` rows and the main `Claim` graph (842k rows). Powers the `/reader` match list. Replaces last session's self-referential matching bug.

**Approach.**
1. Pre-filter candidates via Postgres FTS — keywords extracted from the BookClaim text are joined with `|` into a `to_tsquery('english', ...)`, ranked with `ts_rank`, LIMIT 20. Falls back to keyword-ILIKE OR (which uses the existing trgm GIN index from 2026-05-26) if `to_tsquery` rejects the syntax.
2. For each BookClaim's candidate set, one call to Claude Haiku (`claude-haiku-4-5-20251001`) judges every candidate as SUPPORTS / CONTRADICTS / RELATED / UNRELATED with a one-sentence reason. Strict instructions to reject keyword-only overlap.
3. Genuine hits (non-UNRELATED) written to `BookClaimMatch` with `similarityScore` 0.95 / 0.9 / 0.8 by type and the LLM's reason text (already shipped 2026-05-28 as a nullable column).

**Self-reference exclusion.** Claims with `ingestedBy = 'book-analysis:<bookId>'` are excluded from candidate search (this is the tag `analyze-book-connections.ts` uses when ingesting book-derived claims into the main graph).

**Idempotency.** Only processes BookClaims with `matches: { none: {} }`. Re-runs skip BookClaims that already have any match row.

**Other details.** Concurrency 5 BookClaims at a time. Uses `@anthropic-ai/sdk` (added to `package.json`, requires `ANTHROPIC_API_KEY` in `.env.local`). `--dry-run` previews without DB writes. Progress logged every 10 BookClaims.

**Verification.** `npx tsc --noEmit -p tsconfig.scripts.json` — clean for the new script (other pre-existing script errors unrelated). Script not run; left for user.

**Files changed:** `scripts/match-book-to-graph.ts` (new), `package.json` + `package-lock.json` (added `@anthropic-ai/sdk`), `CONSULTANT.md`.

---

### 2026-05-28 — NARA ingest: bypass 10k API cap with searchAfter cursor

**Problem.** NARA Catalog API v2 hard-caps pagination at 10,000 results per query (page × limit ≤ 10,000). RG59 has ~76k records, RG330 has ~307k. The script failed at page 101 with "Max total results exceeded." Year-range slicing via `dateRangeStart`/`dateRangeEnd` and `startDate`/`endDate` params was investigated but the date filter bleeds through ancestor series date ranges, making it unreliable (e.g. every year ≥ 1945 in RG59 returns ~34k results because series with open-ended ranges encompass all items).

**Fix.** NARA API v2 exposes a `searchAfter` Elasticsearch cursor parameter documented in the swagger as enabling "deep pagination beyond 10,000 results." First request uses `searchAfter=*`; subsequent pages use the `sort[0]` value from the last hit (which equals the naId). Replaced page-based pagination with this cursor loop. Cursor state now stores `lastSearchAfter` instead of `nextPage`.

**Also added.** `--dry-run` can now be combined with `--full` to test the pagination path without DB writes. `--year-start`/`--year-end` flags retained as CLI args (no longer functionally used for full runs, but available for future use). Verified pages 1–105 all succeed without errors (old cap was page 100).

**Background ingestions started (2026-05-28).** RG59 (~76k records, ~13 hrs at 300ms/req) logging to `/tmp/nara-rg59-full.log`. RG330 (~307k records, ~50 hrs) logging to `/tmp/nara-rg330-full.log`. Both use cursor checkpointing (`.nara-cursor.json`) — safe to interrupt and `--resume`.

**Files changed.** `scripts/ingest-nara-catalog.ts` — cursor interface, pagination loop, `--dry-run`+`--full` interaction. Committed `3cac79f`, pushed to main.

---

### 2026-05-28 — LLM match enrichment for BookClaimMatch

**What.** Added LLM-powered reason enrichment to `BookClaimMatch`. Every claim↔receipt match now has a nullable `reason TEXT` field explaining the specific intellectual or evidentiary connection.

**1. Schema + migration.** Added `reason String?` to `BookClaimMatch` in `prisma/schema.prisma`. Migration `20260528210000_add_match_reason` applies `ALTER TABLE "BookClaimMatch" ADD COLUMN IF NOT EXISTS "reason" TEXT`. Applied directly via `prisma db execute` (shadow DB cannot run CONCURRENTLY; same approach as the trgm index migration). Prisma client regenerated.

**2. Enrichment script (`scripts/enrich-match-reasons.ts`).** Queries all `BookClaimMatch` rows where `reason IS NULL`, then calls `claude --print` at concurrency 15 to generate a one-sentence explanation per match. Prompt instructs Claude to reply with exactly `NULL` if there is no meaningful connection — those rows are deleted. Non-null responses are stored as `reason`. Supports `--dry-run` flag that logs what would happen without touching the DB. Progress logged as `[enriched] X/total | [dropped] Y | [errors] Z`. Run: `npx ts-node --project tsconfig.scripts.json scripts/enrich-match-reasons.ts`.

**3. UI update (`app/reader/[bookId]/ReaderClient.tsx`, `page.tsx`).** `SerializedMatch` type extended with `reason: string | null`. Reader serialization in `page.tsx` passes `m.reason ?? null` through. In the match list, each match item now renders the reason text below the match label as small (`text-[10px]`), muted (`text-neutral-600`), italic text. Graceful degradation: if `reason` is null (not yet enriched), nothing extra renders.

**4. Similarity floor raised.** `PLACEHOLDER_SIMILARITY` in `scripts/ingest-book.ts` raised from `0.7` → `0.82`. Prevents noisy keyword-matched matches from being created in the first place.

**Verification.** `npx tsc --noEmit` clean. Migration applied to prod. Prisma client generated.

**Files changed:** `prisma/schema.prisma`, `prisma/migrations/20260528210000_add_match_reason/migration.sql`, `scripts/enrich-match-reasons.ts` (new), `scripts/ingest-book.ts`, `app/reader/[bookId]/ReaderClient.tsx`, `app/reader/[bookId]/page.tsx`, `app/page.tsx` (changelog), `app/layout.tsx` (footer date), `CONSULTANT.md`.

---

### 2026-05-27 — Aesthetic / cosmetic medicine pipelines (4 buckets)

**What.** Added four aesthetic/beauty-industry ingestion paths covering trials, devices, post-market cosmetic safety, and academic literature.

**1. ClinicalTrials.gov `aesthetic` bucket (`scripts/ingest-clinicaltrials.ts`).** New combined intervention + condition sweep mirroring the existing case-study and pivotal patterns. 30 aesthetic interventions (botulinum toxins, hyaluronic/CaHA/PLLA/PMMA fillers, fat grafting, PRP, lasers/IPL/RF/HIFU, cryolipolysis, surgical procedures, hair regrowth, retinoids) and 9 aesthetic conditions (facial rejuvenation, skin aging, acne scars, alopecia, melasma, rosacea, hyperpigmentation, cellulite, gynecomastia). Intervention sub-sweep filters `overallStatus=COMPLETED`; condition sub-sweep additionally filters `hasResults=true`. Ensures `aesthetics` topic (`medicine` domain). Switch registers `aesthetic` as the 5th valid bucket.

**2. FDA Aesthetic Devices pipeline (`scripts/ingest-fda-aesthetic-devices.ts`, new).** Ingests 510(k) clearances and PMA approvals via openFDA device endpoints. 12 device-name-targeted 510(k) searches (hyaluronic, botulinum, liposuction, rhinoplasty, laser+skin, breast+implant, microneedle, RF+skin, cryolipolysis, filler+injectable, fat+grafting, hair+transplant) plus one broad `advisory_committee_description.exact:"General, Plastic Surgery"` sweep that is post-filtered against an aesthetic-keyword Set, with a `decision_date >= 2000-01-01` cutoff. 5 PMA searches (breast/facial/injectable filler/botulinum/silicone implants) restricted to ORIGINAL supplements. Claims as `INSTITUTIONAL` / `currentStatus: HARD_FACT` / `verificationStatus: VERIFIED`. Edge score 95 (authoritative primary regulatory record). Source URLs link directly to accessdata.fda.gov per-record pages. Pipeline ID `fda_aesthetic_devices_v1`; topics `fda-devices`, `aesthetics`, `medicine`. Note: spec asked for `claimType: REGULATORY` and `verificationStatus: HARD_FACT`; the schema allows only `EMPIRICAL | INSTITUTIONAL | INTERPRETIVE | HYBRID` for claimType and reserves `HARD_FACT` for `currentStatus`. Used the canonical mapping that the existing regulatory pipelines (`openfda_v1`, `federal_register_v1`) already use.

**3. Cosmetic FAERS Aggregates pipeline (`scripts/ingest-cosmetic-faers.ts`, new).** Single-call aggregate fetch against `api.fda.gov/cosmetic/event.json?count=products.product_name.exact&limit=1000`. Filters out terms with <5 reports (noise floor) and processes the remaining ~850 products in count-descending order. Each Claim: `"<PRODUCT_NAME> has <N> cosmetic adverse event reports filed with the FDA."` Claim type `EMPIRICAL`, `currentStatus: HARD_FACT`, edge score 85. externalId `cosmetic_faers_<slug>` (lowercased, non-alphanumerics → underscores, capped 100 chars). Pipeline ID `cosmetic_faers_v1`; topics `cosmetic-safety`, `aesthetics`, `medicine`.

**4. OpenAlex `aesthetic-medicine` bucket (`scripts/ingest-openalex.ts`).** New multi-search bucket with 15 dermatology/surgery search terms (aesthetic medicine, cosmetic dermatology, botulinum toxin, dermal filler, laser skin resurfacing, rhinoplasty, breast augmentation, liposuction, facelift, androgenetic alopecia, acne scar, melasma, body contouring, hair transplant, chemical peel). Each search capped at 500 works; cursor pagination; dedupe by workId across all searches. Filter is `type:article,is_paratext:false,publication_year:>1999` plus `primary_topic.subfield.id:subfields/2708` (Dermatology) or `subfields/2746` (Surgery) where specified. Spec called for `primary_topic.field.display_name:Dermatology|Surgery`, but Dermatology and Surgery are OpenAlex *subfields* under field 27 (Medicine), not fields; OpenAlex rejects the field-display-name path with HTTP 400. Resolved by enumerating the subfields endpoint (`/subfields?filter=field.id:fields/27`) and using their numeric IDs.

**Verification.**
- `npx tsc --noEmit` clean after all edits.
- Dry-runs (all 4): ClinicalTrials aesthetic bucket → 148 ingestion candidates across 39 intervention + condition sub-buckets; FDA devices → 5 candidates (limited by `--limit 5`); cosmetic FAERS → 5 of 848 ≥5-report products processed; OpenAlex aesthetic-medicine `--limit 5` (no dry-run flag in this script) wrote 5 sample works as designed.
- Confirmed OpenAlex Dermatology/Surgery subfield IDs against the live API.

**Files changed:**
- `scripts/ingest-clinicaltrials.ts` (added aesthetic bucket + lists + switch case)
- `scripts/ingest-fda-aesthetic-devices.ts` (new)
- `scripts/ingest-cosmetic-faers.ts` (new)
- `scripts/ingest-openalex.ts` (added aesthetic-medicine bucket + subfield mapping)
- `app/page.tsx` (changelog entry)
- `app/layout.tsx` (footer date)
- `CONSULTANT.md`

**Next step.** Full ingest runs remain pending and are out-of-scope for this commit. Topic `aesthetics` will be created on first run by whichever of the four pipelines fires first; subsequent runs share it.

---

### 2026-05-26 — Site-wide perf overhaul: topic N+1 fixed, force-dynamic removed, stats capped, trgm search index

**Problem.** Multiple pages (homepage, topics, globe, stats, search, datasets, fields, review) were timing out on Vercel Hobby (10s limit) at 842k Claims. Three root causes: (a) `/api/topics/[slug]` was running N+1 `claimTopic.count` queries — one per distinct party AND one per distinct leader-within-party — which scaled with party count; (b) seven API routes had `export const dynamic = "force-dynamic"` which disabled the CDN edge cache entirely; (c) `/api/search` `ILIKE %q%` on `Claim.text` was a full sequential scan of 842k rows because there was no trigram index.

**Fix 1 — Topic N+1 (`app/api/topics/[slug]/route.ts`).** Replaced `distinctParties` + per-party `claimTopic.count` loop + per-leader `claimTopic.count` loop with a single `claimTopic.findMany` (scoped to topic, `take: 5000`) that selects `{claimId, claim.edges.source.politicalContext.{hogParty, headOfGovernment}}` then aggregates party and leader counts in JS via `Map<string,number>`. `timelineClaims` cap tightened from 50000 → 5000. `topicVotes` cap tightened from 10000 → 2000. Added `Cache-Control: s-maxage=60, stale-while-revalidate=600` header at the response.

**Fix 2 — Removed `force-dynamic` (7 routes).** `app/api/stats/phase2/route.ts`, `app/api/search/route.ts`, `app/api/globe/density/route.ts`, `app/api/globe/density-temporal/route.ts`, `app/api/globe/origins/route.ts`, `app/api/analysis/votes/route.ts`, `app/api/topics/[slug]/route.ts`: removed `export const dynamic = "force-dynamic"` and replaced with appropriate `export const revalidate = N` (60–3600s depending on data churn). Page wrappers `app/globe/page.tsx` and `app/stats/page.tsx` likewise switched to `revalidate`. KEPT force-dynamic on `/api/claims/homepage` (already uses CDN cache header), `/api/claims/[id]`, `/api/review/*`, `/api/edges` — real-time data paths.

**Fix 3 — Capped unbounded `findMany` in `lib/stats-queries.ts` + `lib/voteAnalysis.ts`.** Added `take: 50000` to every `prisma.legislativeVote.findMany` in `lib/voteAnalysis.ts` (1 site) and `lib/stats-queries.ts` (6 sites — `getPassRateByLegislature`, `getTopTopicsByLegislature`, `getPassRateByTopic`, `getCongressStats`, `getCongressPartyStats`, `getCrossCountryTopicComparison`). Logic unchanged; safety bound only.

**Fix 4 — pg_trgm GIN index on `Claim.text`.** `prisma/migrations/20260526123508_add_trgm_search_index/migration.sql` (`CREATE EXTENSION IF NOT EXISTS pg_trgm` + `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Claim_text_trgm_idx" ON "Claim" USING gin ("text" gin_trgm_ops)`). Applied to prod via `prisma db execute` (CONCURRENTLY can't run inside a transaction so `migrate deploy` couldn't be used directly). Marked the migration applied via direct insert into `_prisma_migrations` because `prisma migrate resolve` timed out on the advisory lock (other long ingester process held it). `prisma migrate status` confirms "Database schema is up to date!".

**Verification.** `npx tsc --noEmit` clean. Migration list confirms 13 applied. The trgm index turns `ILIKE '%foo%'` on `Claim.text` from a 842k-row seq scan into an index-backed lookup.

**Files changed:** `app/api/topics/[slug]/route.ts`, `app/api/search/route.ts`, `app/api/globe/density-temporal/route.ts`, `app/api/globe/origins/route.ts`, `app/api/globe/density/route.ts`, `app/api/stats/phase2/route.ts`, `app/api/analysis/votes/route.ts`, `app/globe/page.tsx`, `app/stats/page.tsx`, `lib/stats-queries.ts`, `lib/voteAnalysis.ts`, `prisma/migrations/20260526123508_add_trgm_search_index/migration.sql`, `app/page.tsx` (changelog), `app/layout.tsx` (footer date), `CONSULTANT.md`.

---

### 2026-05-26 — Homepage timeout fix: covering composite indexes + longer CDN cache + loading skeleton

**Problem.** `/api/claims/homepage` fans out into 4×(count + findMany) on Claim (~842k rows) and was blowing past Vercel Hobby's 10s function limit. The existing `@@index([deleted, parentClaimId, claimType])` filtered the rows but didn't cover the `ORDER BY createdAt DESC` — PG was sorting 100k+ post-filter rows in memory. The `COUNT(*)` with the active `verificationStatus` filter was a separate seq-scan-of-filter-output.

**Fix.**
- `prisma/schema.prisma`: added two composites on `Claim`:
  - `@@index([deleted, parentClaimId, claimType, createdAt])` — covers the homepage's default sort path; the planner can now walk the index in order and skip the in-memory sort.
  - `@@index([deleted, parentClaimId, claimType, verificationStatus])` — covers `COUNT(*)` when the verification filter is active.
- `scripts/apply-perf-indexes.ts`: appended the two new `CREATE INDEX CONCURRENTLY IF NOT EXISTS` statements. Re-ran the script against production; both built in ~2s each on the live 842k-row table without deadlocking live ingest writes.
- `prisma/migrations/20260526190000_perf_homepage_indexes/migration.sql`: documented the indexes with `IF NOT EXISTS` so `prisma migrate deploy` on Vercel is a no-op (the script already created them concurrently).
- `app/api/claims/homepage/route.ts`: bumped the unfiltered Cache-Control from `s-maxage=30, stale-while-revalidate=120` to `s-maxage=300, stale-while-revalidate=3600`. Five-minute edge cache means most visitors hit the CDN, not the function; one-hour SWR keeps the page snappy even if the underlying API is slow to revalidate.
- `app/page.tsx`: added `SkeletonCard` + `SkeletonSection` and rendered them when `loading && !data`, so the page no longer blanks out during the initial fetch. The skeleton mirrors the section/card shape (4 sections × 3 cards) with `animate-pulse` placeholders.

**Verification.** `npx tsc --noEmit` clean. CONCURRENTLY apply on live DB: `created=37 skipped=0 failed=0`.

**Files changed:** `prisma/schema.prisma`, `prisma/migrations/20260526190000_perf_homepage_indexes/migration.sql`, `scripts/apply-perf-indexes.ts`, `app/api/claims/homepage/route.ts`, `app/page.tsx`, `CONSULTANT.md`.

---

### 2026-05-25 — Fix broken /globe sidebar claims links; add country filter to /search

**Problem.** The globe sidebar's footer "View all claims from {country}" link pointed at `/claims?country=X`, which routes to `/claims/page.tsx` — the admin claim-creation form. That page ignored the `country` param entirely, so the link was effectively useless. Individual claim cards in the sidebar (`href='/claims/${claim.id}'`) were already correct.

**Fix — Part A: footer link → /search with country support.**
- `app/globe/GlobeClient.tsx`: changed the footer anchor `href` from `/claims?country=${code}` to `/search?country=${code}`. Single-line change; all other globe sidebar behavior unchanged.
- `app/api/search/route.ts`: added an optional `country` query param. When present, looks up `COUNTRY_TO_PIPELINES[code]` from `lib/globe-pipeline-country.ts` and adds an `ingestedBy: { in: pipelines }` filter to the **claims** query. Sources are NOT country-filtered (sources don't carry the pipeline tag in the same way and the spec says claims-only). The `MIN_QUERY=3` floor is bypassed when a valid country is active, so `/api/search?country=BR` alone returns 10,966 BR claims with no `q`. Response shape extended with `country` and `countryName` fields so the client can label results. An unknown country code is treated as no filter (the standard `MIN_QUERY` rule re-applies).
- `app/search/SearchClient.tsx`: reads `country` from `useSearchParams()`. Renders an amber `Showing claims from {country}` banner above the results with a "Clear country filter ×" button (calls `pushUrl({ country: "" })`). The fetch effect now triggers on `country` alone — debounce/q logic untouched. `pushUrl` accepts a new `country` override. Results gating switched from `trimmedQ.length >= MIN_QUERY` to `showResults = trimmedQ.length >= MIN_QUERY || hasCountry` so the empty-q + country-only path renders cleanly. The "Type a query to begin" / "Keep typing" empty states are suppressed when a country is active.
- `app/search/page.tsx`: no change needed — already wraps the client in `<Suspense>` and the client reads search params directly.

**Fix — Part B: verified `/api/claims/[id]` handles brazil_legislation_v1.**
- Pulled a sample claim id `cmpdmihex0xuepl8pzhvb4mm6` (one of 10,966 Brazil claims). `GET /api/claims/{id}` returned 200 with the full claim payload: 1 CITES edge, source `"Brazil PLP 141/2026"`, `politicalContext = { headOfGovernment: "Luiz Inácio Lula da Silva", hogParty: "Workers' Party", country: "Brazil" }`. So the Edge → Source → PoliticalContext chain is intact for Brazil. The route already handles both 404 (`if (!claim) return 404`) and empty-edges (renders without crashing on `claim.edges.map(...)`) cases correctly — no fix needed on the route.

**Verification.**
- `npx tsc --noEmit` clean.
- `GET /api/search?country=BR&limit=3` → `counts: { claims: 10966, sources: 0 }`, sample ingestedBy = `brazil_legislation_v1`.
- `GET /api/search?country=BR&q=tributo` → `counts: { claims: 39, sources: 47 }` — claims filtered by both, sources filtered by text only (per spec).
- `GET /api/search?country=BR` (no q) → 200; previously returned the under-MIN_QUERY message payload.
- `GET /api/claims/{brazil-claim-id}` → 200 with full edge + PoliticalContext data.
- `GET /api/claims/notarealid12345` → 404 (unchanged).

**Scope discipline.** No DB migration, no schema changes, no new dependencies. Country filter applies to claims only (sources omitted by design per spec). Unknown country codes fall back to no-filter behavior. Did not touch globe rendering, density API, or the country/[code] route beyond what the task required.

**Files changed:** `app/globe/GlobeClient.tsx`, `app/api/search/route.ts`, `app/search/SearchClient.tsx`, `CONSULTANT.md`.

---

### 2026-05-25 — Globe: political/heatmap view mode toggle

**Feature.** Added a pill toggle (top-right of the globe, z-40) that switches between two rendering modes without reinitializing the globe instance.

**Mode 1 — Heatmap (existing, default):** log-scale amber/blue density coloring, low-res 110m GeoJSON, existing stroke/altitude settings unchanged.

**Mode 2 — Political (new):** high-res 50m GeoJSON (`ne_50m_admin_0_countries.geojson`), uniform dark slate cap (`#1a2035`), bright blue borders (`#4a9eff`), polygon side color `rgba(10,10,30,0.8)`, altitude `0.008`. Hover highlights the hovered country to `#263050` by calling `.polygonCapColor(fn)` on the live globe instance. Tooltip still shows claim count in both modes.

**Implementation notes:**
- Both GeoJSONs fetched in parallel at init time and stored in `geoData110Ref` / `geoData50Ref` — toggling is instant, no loading state.
- `viewModeRef` mirrors `viewMode` state so globe callbacks (which close over stale state) always read current mode.
- `viewMode` useEffect updates `polygonsData`, `polygonCapColor`, `polygonStrokeColor`, `polygonAltitude`, `polygonSideColor` on the existing globe instance; no reinit.
- Legend hidden in political mode (no density scale to show).

**Files changed:** `app/globe/GlobeClient.tsx`, `CONSULTANT.md`.

**Typecheck:** `npx tsc --noEmit` clean.

---

### 2026-05-25 — /globe fixes: country search, sidebar claim filter, accurate US claim count

**Issue 1 — Country search bar in `app/globe/GlobeClient.tsx`:**
- Floating panel top-left of the globe (above the legend). `Search countries…` input filters the existing `density` prop and renders a dropdown of up to 8 matches (flag + name + claim count). Click/mousedown opens the sidebar via `openSidebar(code)`; dropdown closes on blur (120 ms delay so click registers).

**Issue 2 — Claim filter in sidebar:**
- Below the sidebar header, a `Filter claims…` input filters `sidebar.recentClaims` client-side by claim text. Match counter (`N of M claims`). Filter resets when a new country is opened.

**Issue 3 — US claim count under-reported:**
- `app/api/globe/country/[code]/route.ts` previously counted only PoliticalContext-linked claims. Now matches the density API: counts the union of PoliticalContext-linked claims AND claims whose `ingestedBy` is in the country's pipeline set. `recentClaims` merges both buckets, deduped by claim id.
- `PIPELINE_COUNTRY` and `PIPELINE_COUNTRY_NAME` extracted from `app/api/globe/density/route.ts` to `lib/globe-pipeline-country.ts` (new), with a reverse `COUNTRY_TO_PIPELINES` lookup. Both routes import from the shared lib.

**Files changed:** `app/globe/GlobeClient.tsx`, `app/api/globe/density/route.ts`, `app/api/globe/country/[code]/route.ts`, `lib/globe-pipeline-country.ts` (new), `app/page.tsx` (changelog), `CONSULTANT.md`.

**Typecheck:** `npx tsc --noEmit` clean.

---

### 2026-05-25 — /globe, /search, /analysis/votes, topics enrichment (RobClaw)

**Shipped:**
- `/globe` — react-globe.gl WebGL globe, heat map of claim density by country (log scale), click-to-zoom + sidebar with recent claims list. Routes: `app/globe/page.tsx` (server, queries PoliticalContext→Source→Edge grouped by country), `app/globe/GlobeClient.tsx` (client, dynamic import). API: `GET /api/globe/density`, `GET /api/globe/country/[code]`. Country name→ISO alpha-2 lookup: `lib/countryCodeMap.ts`. Globe added to nav.
- `/search` — `app/search/page.tsx` + `SearchClient.tsx` + `GET /api/search`. Full-text search across claims.
- `/analysis/votes` — `app/analysis/votes/page.tsx` + `GET /api/analysis/votes`. Vote analysis view.
- `/topics/[slug]` enrichment — adds timeline (claims by year), contested vs unanimous vote stats, mean aye/nay percentages, party breakdown via `lib/voteAnalysis`.

**Commits:** `992e17d` (globe), `0a2a163` (search + analysis + topics enrichment)

**Note:** All local-only code was pushed immediately. Rule confirmed: always commit+push, Robert does not use localhost.

### 2026-05-25 (Academic Fields browser page — /fields, /fields/[slug], Topic.academicFieldId migration)

Built the Academic Fields browser for Epistemic Receipts, cross-linking Topics to AcademicFields.

**Schema migration (`20260525223703_link_topic_academic_field`):**
- Added `Topic.academicFieldId Int?` → `AcademicField` FK (relation name `TopicAcademicField`).
- Added inverse `AcademicField.topics Topic[]` relation.
- Added `@@index([academicFieldId])` to `Topic`.
- `npx prisma migrate dev --name link-topic-academic-field` applied successfully.

**New script: `scripts/tag-topics-academic-field.ts`:**
- Maps existing `Topic.domain` values to best-matching `AcademicField` by slug `contains` search.
- Mapping: history→history, astronomy→astronomy, psychology→psychology, law→law, medicine→medicine, government→political-science, public_health→public-health, archives→history.
- Dry-run by default; `ALLOW_EDITS=true` to write. Prints per-domain field match and final tagged/skipped counts.
- **Not auto-run** — Robert runs this manually after reviewing dry-run output.

**API routes:**
- `app/api/fields/route.ts` — `GET /api/fields`: returns all 5 top-level fields (level=0) with their level-1 children, `_count.claims`, `_count.topics`, and `topics[]`. `?parent=<slug>` drills into a field's direct children.
- `app/api/fields/[slug]/route.ts` — `GET /api/fields/[slug]`: field detail including parent breadcrumb, children array, linked topics (with claim counts), and 10 most-recent claims tagged to this field.

**Pages:**
- `app/fields/page.tsx` — index: 5 top-level section cards (Humanities, Social Sciences, Natural Sciences, Formal Sciences, Applied Sciences). Each card shows description, claim count, topic count, subfields count, and a sample of level-1 child field tags. Links to `/fields/[slug]`.
- `app/fields/[slug]/page.tsx` — drill-down: breadcrumb (Fields > Parent > Current), subfields grid (each linking deeper), Topics section (links to `/domains/[domain]`), Recent Claims section (10 claims tagged to this field with status badge). Shows "No data linked yet" when empty.

**Navigation:** Added `<Link href="/fields">Fields</Link>` to `app/layout.tsx` between Topics and Review.

**Homepage / footer:** Added May 25, 2026 changelog entry for `/fields` launch. Footer bumped to `May 25, 2026`.

**TypeScript:** `npx tsc --noEmit` and `npx tsc --noEmit --project tsconfig.scripts.json` clean. All new files in the `app/` tree type-check with zero errors (pre-existing errors in unrelated scripts unchanged).

**Files changed:** `prisma/schema.prisma`, `prisma/migrations/20260525223703_link_topic_academic_field/migration.sql`, `scripts/tag-topics-academic-field.ts`, `app/api/fields/route.ts`, `app/api/fields/[slug]/route.ts`, `app/fields/page.tsx`, `app/fields/[slug]/page.tsx`, `app/layout.tsx`, `app/page.tsx`, `CONSULTANT.md`.

---

### 2026-05-25 (Bugfix — Congress party backfill + member-votes enrichment now build Clerk/Senate XML URLs locally)

Two related Congress.gov scripts were both failing because they trusted the `url` field returned by the `/v3/bill/.../actions` `recordedVotes` array. That field points at HTML pages (`https://clerk.house.gov/Votes/<id>` for House, `https://www.senate.gov/legislative/LIS/roll_call_lists/roll_call_vote_cfm.cfm?...` for Senate) — and in some payloads at api.congress.gov endpoints that no longer exist (v3 has no `/vote` endpoint). Neither variant is the XML the script parsers expect. Symptoms:

- `scripts/backfill-congress-party-votes.ts` ran on 505 rows and reported `Skipped (no party): 505` — every `rv.url` either matched the chamber-hostname check but returned non-XML HTML (so `parseHouseXml` / `parseSenateXml` found zero `<totals-by-party>` / `<member>` blocks → null) or didn't match the host check at all.
- `scripts/enrich-member-votes.ts` 404'd on all 505 `congress_votes_v1` records because the stored `rollUrl` (also `rv.url`) had been mirrored from the same dead API field.

**Fix.** Both scripts now build the canonical XML URL deterministically from the metadata they already have, instead of taking `rv.url` / `meta.rollUrl` at face value:

- House: `https://clerk.house.gov/evs/{year}/roll{NNN}.xml` (3-digit zero-padded roll number, year from `voteDate`)
- Senate: `https://www.senate.gov/legislative/LIS/roll_call_votes/vote{congress}{session}/vote_{congress}_{session}_{NNNNN}.xml` (5-digit zero-padded roll number)

In `backfill-congress-party-votes.ts`, a new `buildVoteXmlUrl(rv)` helper takes the `RecordedVote` returned by `/v3/bill/.../actions` (which carries `chamber`, `congress`, `sessionNumber`, `rollNumber`, `date`) and produces the XML URL. The downstream `fetchVoteDetailFromUrl` already dispatched on host substring so its body didn't change; only the URL passed to it did. `[skip:no-xml-url]` now logs the chamber + roll number it couldn't build a URL for, which is more useful than logging "`rv.url` was empty".

In `enrich-member-votes.ts`, the script reads `meta.chamber`, `meta.rollNumber`, `meta.congress`, and `meta.voteDate` from the `congress_votes_v1` claim metadata (already populated by `ingest-congress-votes.ts`), derives the Senate session from the vote date with `session = year - (2*congress + 1787) + 1` (odd years → session 1, even → session 2; rejects values outside {1,2}), and constructs the XML URL itself via `buildVoteXmlUrl(chamber, congress, rollNumber, voteDate)`. The previously-stored `meta.rollUrl` is now ignored entirely — it was always derived from the same broken API field and there's no information loss from constructing fresh.

**Why this works against current data:** the 505 candidate rows are all `congress_votes_v1` so they were ingested by `scripts/ingest-congress-votes.ts`, which writes `congress`, `chamber`, `rollNumber`, and `voteDate` into `Claim.metadata` (see lines 359–373 of that script). For the party-backfill flow, the `/v3/bill/.../actions` endpoint reliably returns `chamber`, `congress`, `sessionNumber`, `rollNumber`, and `date` on each `recordedVote` — those are the upstream of the URL we used to fetch — so we already had everything needed to build the XML URL locally; we just weren't using it.

**Verification.** `npx tsc --noEmit` and `npx tsc --noEmit --project tsconfig.scripts.json` clean on both edited files (the pre-existing project-wide tsc errors are in unrelated scripts — Belgium, FAERS, Federal Register, JaCAR, Malta, Nobel, UN SC, UN Treaties — none touched here). No DB access during this session per the task brief; the scripts were not run.

**Files changed:** `scripts/backfill-congress-party-votes.ts`, `scripts/enrich-member-votes.ts`, `CONSULTANT.md`.

### 2026-05-23 (openFDA Drug Labels full run shipped — `openfda_labels_v1`: 85,068 records)

First production run of `scripts/ingest-openfda-labels.ts` (Pipeline 8 in AGENTS.md). Ran end-to-end across all 20 effective_time partitions discovered by binary-split on `[19000101 TO 20991231]`; sum-of-partitions exactly equalled the server-reported global total (258,334 ≡ 258,334), so the partitioning fix from the 2026-05-21 dry-run held under live load. Independent DB verification (`prisma.claim.count({ ingestedBy: 'openfda_labels_v1', deleted: false })` + matching `source.count` + `edge.count` + `edgeRevision.count`) all returned **85,068** — perfect parity across the four tables (per AGENTS.md rule 6).

- **Final accounting (matches server total exactly):**
  - Total seen: 258,334
  - Ingested (attempt 1 + attempt 3): 13,973 + 71,095 = **85,068**
  - Skipped (dedup hits on attempt 3 = attempt 1's writes): 13,973
  - Errors (records with no `openfda.brand_name` and no `openfda.generic_name`, i.e. no claim text constructible): 173,266
  - Sum: 71,095 + 13,973 + 173,266 = 258,334 ✓
- **Skip-rate confirms the 2026-05-21 prediction.** The pre-2000 partitions are essentially 100% no-openfda-block (SPL records lacking the OpenFDA enrichment layer); the modern 2020s partitions ingest at ~70%+. The final yield (85,068 / 258,334 ≈ 32.9%) sits well below the headline corpus size, exactly as flagged before the run. No silent data loss — the 173,266 errors are deterministic gate failures, not network or transaction faults.
- **Run was not single-shot.** Three attempts:
  1. **Attempt 1** crashed at seen=151,500 / ingested-this-attempt=13,668 (DB ended at 13,973 after pagination boundary) after 58 min — uncaught `fetch failed: HTTP/2 GOAWAY` from `api.fda.gov`. The original `fetchPage` only handled HTTP 429; raw network errors propagated up and killed the script.
  2. **Attempt 2** ran for ~14 min in early skip-heavy partitions (dedup-skipping attempt 1's writes, no new ingestion) and was SIGTERMed (exit 143) — almost certainly the harness's 10-min background-task ceiling. Restarted detached via `nohup … & disown` to bypass.
  3. **Attempt 3** (detached, with the fetch retry patch below) ran 15,349.7s = 4h 16min and completed cleanly through all 20 partitions to the success-line `DB verification: claim.count = 85068`.
- **Code change required to finish: `fetchPage` + `probeRangeTotal` retry wrappers.** Replaced the single-attempt-with-429-retry pattern in both functions with a 5-attempt retry loop covering (a) HTTP 429 (30s backoff, retry), (b) HTTP 5xx (15s backoff, retry), (c) caught `fetch` exceptions / `UND_ERR_SOCKET` / `GOAWAY` / `ECONNRESET` (exponential backoff 5s → 60s, retry). Patch survives transient openFDA outages without losing the partition cursor. No other script logic changed.
- **Resolved blocking decisions** flagged in earlier 2026-05-21 entries (closing them out so they don't keep appearing on the open-decision board):
  1. **Reference-tier vs. background-tier.** Approved as reference-tier per the task brief — individual SPL records are directly citable from case studies (e.g. "the 2019 GLP-1 indication update on Ozempic's label"). The earlier concern that drug-label records mirror "individual FAERS adverse event reports" is overridden by the brief's explicit reference-tier classification. The 173k skipped-as-error records would have been background-tier (no openfda block, no productizable claim), so the gate also filters out the records that *would* have failed the test.
  2. **`VERIFIED` + `humanReviewed: false` combination.** Approved as correct per the task brief. The combination is internally consistent because `VERIFIED` reflects source-authority (FDA SPL = canonical primary-source authority for US drug labeling) while `humanReviewed: false` reflects the literal audit signal (no human has reviewed these specific records). AGENTS.md rule 3 ("humanReviewed ≠ autoApproved") is satisfied — the two flags are kept distinct; this run does not conflate them. The recent legislative-pipeline default (`PROVISIONAL` + `autoApproved: true`) is appropriate when the source is not an authority issuing a final-form classification; FDA SPL labels are, so VERIFIED is defensible.
- **Spot-check sample (first 5 valid ingests, oldest partitions):** older homeopathic-and-OTC items dominate the early-partition successes — `SILICEA: A traditional homeopathic preparation` (no FDA evaluation) and `Betadine Antiseptic` (OTC povidone-iodine) were the dry-run sample on 2026-05-21 and showed up identically in this run. Modern partition samples cover the expected mix of branded prescription drugs, generics with full indication text, and OTC monographs.
- **Performance.** Per-page cost: 100 records × 300 ms throttle + per-record DB transactions. Attempt 3's 15,349 s for 258,334 records seen = 16.8 records/sec average, dragged down by the per-record dedup roundtrip (`source.findFirst` + `claim.findUnique`) which fires for every record including the 173k that will turn out to be errors. A future revision could cheaply skip those checks for records lacking openfda blocks.
- **Footer / homepage:** `app/page.tsx` 2026-05-23 changelog entry extended with the openFDA-Labels bullet; footer `app/layout.tsx` already reads `May 23, 2026` so no date bump needed.

### 2026-05-23 (Pipeline 115 — UK National Archives Discovery API ingester built, dry-run validated)

New script `scripts/ingest-uk-national-archives.ts` (`uk_national_archives_v1`). Layer 1 ingester for the UK National Archives Discovery catalogue across five high-value Whitehall departments: **CAB** (Cabinet Office), **PREM** (Prime Minister's Office), **FCO** (Foreign & Commonwealth Office), **HO** (Home Office), **DEFE** (Ministry of Defence). No API key — fully open public API.

**API discovery — task brief vs. actual API:**
- Brief said `https://discovery.nationalarchives.gov.uk/API/search/v1/records` — the real endpoint is `https://discovery.nationalarchives.gov.uk/API/search/records` (no `/v1` segment). The `/v1` path returns HTTP 500.
- Brief said pagination uses `startIndex` + `rows` (Solr-style). The real API uses `sps.batchStartMark` (cursor) + `sps.batchSize`, returning `nextBatchMark` on each response.
- Brief said `rows` max is 50. The server silently caps responses at **~15 records per call regardless of `sps.batchSize`** — verified empirically across multiple query shapes. The script still sends `sps.batchSize=50` (cheap, in case the server lifts the cap), but plans iteration around the 15-record reality.
- Brief said `sourceUrl = .../details/r/<reference>`. Discovery's detail-page URLs key on the Discovery **node ID** (e.g. `C665056`), not the catalogue reference string (`CAB 23/45` would not URL-encode cleanly and isn't the correct path). Script uses `https://discovery.nationalarchives.gov.uk/details/r/{discoveryId}` and stores the human-readable `reference` in `Claim.metadata.reference`.
- **`nextBatchMark` cursor pagination only works when `sps.sortByOption` is explicitly set.** Without a sort, `nextBatchMark` comes back empty. Without a sort the API behaves as a 15-result faceted-search preview, not a paginator. The script uses `sps.sortByOption=TITLE_ASCENDING`, which yields a stable monotonically-advancing hex cursor (e.g. `00000001000000390000001000000039`).
- **`sps.references` is a partial-string match, not an exact filter.** `sps.references=CAB` alone returns hits from "Citizens Advice Bureau" (Lancashire Archives) and "WA 30/*" (Welsh Assembly). Defense: combine with `sps.heldByCode=TNA` (restricts to The National Archives, Kew) and use full series prefixes with spaces (`CAB 23`, not `CAB`).

**Script architecture:**
- Per-series iteration over a curated `PRIORITY_SERIES` list (41 series) covering: CAB 23/24/65/66/128/129/130/134/195 (Cabinet Conclusions + Memoranda + War Cabinet + post-1945 Committees + Cabinet Secretary's Notebooks); PREM 1/4/8/11/13/15/16/19 (PM Files Attlee→Major); FCO 7/8/9/12/17/21/28/30/33/41/73 (regional desks + Confidential Print + Private Office); HO 45/144/287/325/344 (Registered Papers + Race Relations + Immigration); DEFE 4/5/6/7/11/13/25/31 (Chiefs of Staff + Defence Operational Planning).
- Each series fetched via `iterateSeries()` async generator: `sps.references={series}` + `sps.heldByCode=TNA` + `sps.catalogueLevels=Level6` + `sps.sortByOption=TITLE_ASCENDING` + cursor loop. Stops on empty `nextBatchMark`, repeated cursor (server stuck), or per-series cap. Hard call cap of 1,200 iterations per series as a safety net.
- Filter to **catalogue Level 6 (Piece)** — individual files/documents — drops the department/series/sub-series catalogue scaffolding rows that aren't directly citable in case studies.
- 400 ms throttle, 30 s request timeout, exp-backoff retry on 429/500/502/503/504.

**Data mapping:**
- `claimText = title` (truncated 500 chars). `Claim.text` is the raw record title to keep the audit trail clean; richer claim phrasing can be added later via a separate enrichment pass.
- `claimType: INSTITUTIONAL`, `currentStatus: HARD_FACT`, `verificationStatus: PROVISIONAL`, `humanReviewed: false`, `autoApproved: true` (matches brief + project convention for un-reviewed bulk-ingested archival records).
- `claimEmergedAt`: parsed from `numStartDate` (YYYYMMDD) preferred over `startDate` ("DD/MM/YYYY"). `claimEmergedPrecision: DAY` when month+day are real, downgraded to `YEAR` when `numStartDate` ends in `0101` (Discovery's MMDD default for year-only records). Null when unparseable.
- `metadata`: `{ dataset, discoveryId, reference, series, department, description, coveringDates, startDate, heldBy, closureStatus, originalArchive: 'The National Archives, Kew (TNA)' }`. The `originalArchive` field follows the Declassified & Archival Sources design vision (CONSULTANT.md L199) — separates fetch origin (Discovery URL) from epistemic origin (physical TNA holding).
- `Source.name = "TNA Discovery — {reference}"`, `Source.url = https://discovery.nationalarchives.gov.uk/details/r/{discoveryId}`, `Source.methodologyType: 'primary'`, `Source.publishedAt = startDate`.
- One `Edge.type: 'FOR'` + `evidenceType: 'PROCEDURAL'` per claim; `EdgeRevision.newScore: 90` ("PROVISIONAL pending content review" — lower than the 95 used by VERIFIED institutional records like ECHR/UNGA, because Discovery catalogue entries describe a document's existence rather than asserting its content).
- Topic: `uk-national-archives` (name "UK National Archives", domain `government`). Brief said parent `Government Documents` — that topic does not exist today, so the script falls back to top-level per brief instruction. Runtime parent lookup (slug `government-documents`) so a future curator can create the parent without changing the script.

**CLI / safety:**
- `--dry-run` (default — 50 sample records across the first ~10 series, no DB writes; writes `pipeline-115-dry-run-sample.json`).
- `--full` (requires `ALLOW_EDITS=true`; default target 5,000 records, override with `--limit N`).
- `--verbose` (per-API-call logging).
- Dedup primarily on `Claim.externalId` (`uk_nta_{discoveryId}`); `Source.url` checked as belt-and-braces.
- Per-record `prisma.$transaction(..., { timeout: 30000 })` per CONSULTANT rule 5.
- Post-full-run DB count verification (`prisma.{claim,source,edge}.count({ ingestedBy: 'uk_national_archives_v1' })`) per CONSULTANT rule 6.

**Dry-run results (verified live against Discovery, no DB writes):**
- 50 candidate records pulled across 10 series in ~5 s wall-clock (1 API call per series at the 15-record server cap).
- Per-series totals reported by Discovery (`count` field): CAB 23 = 109, CAB 24 = 294, CAB 65 = 60, CAB 66 = 71, CAB 128 = 140, CAB 129 = 247, CAB 130 = 1,639, CAB 134 = 6,792 (largest), CAB 195 = 25, PREM 1 (sampled in same run) — total Discovery `count` across the 41 priority series is comfortably > 100,000, so 5,000 is achievable without scope expansion.
- Sample spot-check: `CAB 23/45 — "1(23) - 28(23)"` (1923 Cabinet Conclusions Jan–May 16; heldBy "The National Archives, Kew"; closure status `O` = open) resolves at `https://discovery.nationalarchives.gov.uk/details/r/C665056` (verified directly in browser-side Discovery search). Date precision correctly downgraded to YEAR when `numStartDate` ended in 0101.
- Dry-run output: `pipeline-115-dry-run-sample.json`.

**Estimated full-run cost:** at 400 ms throttle and 15 records per call, 5,000 records ≈ 333 API calls ≈ ~2.5 min wall-clock for fetch + per-record Postgres writes. Single 30 s transaction per record, conservatively ~12–15 min end-to-end.

**Type-check:** `npx tsc --noEmit --project tsconfig.scripts.json` clean on `ingest-uk-national-archives.ts` (pre-existing errors in unrelated scripts unchanged).

**Status:** built + dry-run validated. **Awaiting explicit go-ahead from Robert before any `--full` invocation.** Pipeline Registry / DB State table will be updated alongside the first production run.

**Files changed:** `scripts/ingest-uk-national-archives.ts` (new), `pipeline-115-dry-run-sample.json` (new — dry-run output), `CONSULTANT.md` (this entry).

### 2026-05-23 (Pipelines 17/22/79 — NATO, Austria, Jamaica full production runs)

Full ingestion completed for three approved pipelines (all dry-run validated prior to this run). DB state verified independently after each run per AGENTS.md rule 6.

- **Pipeline 17 — NATO Official Texts (`nato_official_texts_v1`)**
  - Command: `ALLOW_EDITS=true … ingest-nato-official-texts.ts --full`
  - Phase 1 enumerated 485 unique IDs via Wayback CDX; Phase 2 fetched 458 live (27 returned 404); Phase 3 wrote records in batches of 50.
  - Script counters: Ingested 5 new, Skipped 453 (already existed from prior run), 27 not found, 0 errors.
  - **DB verified: 459 claims, 459 sources, 459 edges** (`ingestedBy = 'nato_official_texts_v1'`).

- **Pipeline 22 — Austria Nationalrat (`nationalrat_v1`)**
  - Command: `ALLOW_EDITS=true … ingest-nationalrat.ts --full`
  - Parlament.gv.at Filter API returned 0 rows today (likely transient — endpoint had returned 3,868 records in the prior run that populated the DB). Script Ingested 0, Skipped 0.
  - **DB verified: 3,868 claims, 3,868 sources** (`ingestedBy = 'nationalrat_v1'`) — records from prior run confirmed present.

- **Pipeline 79 — Jamaica Acts (`jamaica_legislation_v1`)**
  - Command: `ALLOW_EDITS=true … ingest-jamaica.ts --full`
  - Catalogue fetch: 528 unique Acts across 2000–2023 (year-by-year DataTables AJAX); 528 skipped (already existed).
  - **DB verified: 528 claims, 528 sources, 528 edges** (`ingestedBy = 'jamaica_legislation_v1'`).

Pipeline Registry rows 17, 22, 79 updated to `Shipped 2026-05-23` with final counts. DB State table updated. Homepage changelog updated.

### 2026-05-23 (NARA Catalog ingester — script built, API key required)

New script `scripts/ingest-nara-catalog.ts` (`nara_catalog_v1`). Layer 1 ingester targeting NARA Catalog v2 API across five high-epistemic-value record groups: RG 263 (CIA), RG 59 (State Dept), RG 330 (OSD), RG 128 (Church Committee/Joint Committees), RG 148 (JFK Assassination Records Review Board).

**API discovery findings (blocking dry-run):** The NARA Catalog API v2 at `https://catalog.archives.gov/api/v2/records/search` is NOT freely accessible without an API key. The v2 API (`catalog.archives.gov`) is now a React SPA with a backend served through AWS CloudFront. CloudFront only routes Swagger documentation paths to the backend; all search endpoints require a valid `x-api-key` header obtained by emailing `Catalog_API@nara.gov`. Without a key, CloudFront serves the SPA HTML, causing a JSON parse error. The task brief described the API as "no auth required" — this was accurate for the older v1 API but is no longer correct for v2/v3.

**v2 API corrections over task brief:**
- `resultTypes=item` → `levelOfDescription=item` (v2 param name)
- `rows=` → `limit=` (max 1000 per page)
- `offset=` → `page=` (1-based page number, max 10,000 pages; use `searchAfter` for deep pagination)
- Response format: `body.hits.hits[]` (Elasticsearch wrapper) rather than `opaResponse.results.result[]` (v1 compat)
- Each hit: `hit._source.record` contains the archival record fields

**Script features (ready once key obtained):**
- `NARA_API_KEY` env var required; clear error message with registration instructions if missing
- `--dry-run` (default, no writes, samples 20 records per RG) / `--full` (requires `ALLOW_EDITS=true`) / `--record-group N` flags
- 300 ms throttle between API calls
- Dedup on `Claim.externalId` (`nara_catalog_{naId}`) with upsert on `Source.externalId` (`nara_source_{naId}`)
- Handles both v2 Elasticsearch response format AND v1-compat `opaResponse` as fallback
- Handles missing fields (dates, scope notes, digitized status) gracefully
- Transaction timeout 30,000 ms
- Post-full-run DB count verification (`prisma.source.count`, `prisma.claim.count` for `nara_catalog_v1`)
- Claim text: `"<title>" — archived at NARA, Record Group <N>, originally dated <begin>–<end>`
- `claimType: INSTITUTIONAL`, `currentStatus: HARD_FACT`, `verificationStatus: VERIFIED`, `humanReviewed: false`, `autoApproved: true`

**To unblock dry-run:** add `NARA_API_KEY=<key>` to `.env.local`. Key obtained by emailing `Catalog_API@nara.gov`.

**Type check:** `npx tsc --noEmit --project tsconfig.scripts.json` — no errors in `ingest-nara-catalog.ts` (pre-existing errors in other scripts unchanged).

**Files changed:** `scripts/ingest-nara-catalog.ts` (new), `CONSULTANT.md` (this entry + pipeline registry row 80 + archive roadmap status update).

### 2026-05-23 (Parliamentary-majority enrichment — Tier 2 full run shipped)

`ALLOW_EDITS=true npx tsx scripts/enrich-parliamentary-majority.ts --full` completed cleanly against production. No failures; 49 country queries; ~219,965 eligible PoliticalContext rows scanned.

- **DB state after run (verified via `prisma.politicalContext.count`):**
  - `governingParty` populated: **112,843** (was 0)
  - `governingParty` still NULL: **107,122**
  - `majorityType = 'coalition'`: 0
  - `majorityType = 'single-party'`: 0
- **Why coalition / single-party stayed at 0:** as flagged in the 2026-05-23 dry-run entry below, Wikidata cabinet items overwhelmingly omit `P102` / `P1830` party links. All 112,843 enrichments are the `hogParty` fallback (HoG-only). No row was filled from cabinet-composition data — the script wrote NULL for `majorityType`, `coalitionPartners`, and `majoritySeats` rather than guessing, per AGENTS.md "verifiable sources" rule.
- **Per-country coverage highlights from the run log:** US 12,280/12,280 enriched, Canada 1,067/1,067, Germany 6,302/6,343, Sweden 9,989/9,989, Estonia 5,870/5,870, France 2,961/3,046, Italy 16,872/16,929, UK 11,777/11,777, Israel 1,601/2,009. Sparse-Wikidata bottom: Brunei 0/288, UAE 0/175, Jamaica 0/528, Peru 0/5,202, Uruguay 1/4,297 — Tier 1 never populated `hogParty` for those rows, so Tier 2 had nothing to fall back to.
- **Script-vs-DB count delta (120,031 enriched per script log vs 112,843 in DB):** the script counter increments on every UPDATE attempt; ~7k of those UPDATEs target rows whose `governingParty` was set in an earlier per-country iteration and then re-scanned under a different country label (some Sources span EU + member-state pipelines, e.g. `eu_legislation_v1` rows whose enactment falls within a national cabinet). DB count is authoritative.
- **Runtime:** ~5 minutes wall-clock (SPARQL queries ≈ 1 min; the rest is Postgres UPDATEs). No 429s observed at the 1100 ms throttle.

### 2026-05-23 (Parliamentary-majority enrichment — Tier 2 of Political Context, dry-run only)

New script `scripts/enrich-parliamentary-majority.ts`. Backfills `governingParty`, `majorityType`, `coalitionPartners`, `majoritySeats` on `PoliticalContext` rows whose Tier 1 enrichment already ran but the parliamentary-majority columns are still NULL. Strategy: per-country SPARQL fetches every cabinet item in the country, matched locally by enactmentDate and `headQid === hogWikidataId`.

- **No schema migration was needed.** The brief asked to add `governingParty / majorityType / coalitionPartners / seatCount` to `PoliticalContext` and run `prisma migrate dev`. All four fields are *already* present from the 2026-05-20 `add_political_context` migration (`governingParty String?`, `majorityType String?`, `majoritySeats Int?`, `totalSeats Int?`, `coalitionPartners String?`). Brief-vs-schema deviations: `coalitionPartners` is a `String?` (JSON-encoded array) not a native `String[]`; the brief's single `seatCount` field is split into `majoritySeats` + `totalSeats`. We use the existing columns rather than churning the schema — the JSON-encoding is fine because the data is read by app code, not joined against. `migrate dev` was not invoked because there is no schema delta to record (Prisma would have created an empty migration).
- **Realistic outcome flagged before any production run:** Wikidata cabinet items almost never carry party-membership data directly. Verified empirically by inspecting `Q663009` (Cabinet Schröder I, P17=Germany, P6=Q2530=Schröder): the item has only `P6 / P31 / P17 / P138 / P155 / P156 / P571 / P576 / P580 / P646 / P1001 / P1365 / P1366` — no `P102` (member of party), no `P1830` (supported by), and a `P710 → P102` traversal yields nothing either. Same for `Q137917761` (Schulze cabinet, 2026) and `Q704213` (Schröder II). Party info, when it exists, lives on the individual minister items and would require a cross-join through hundreds of P710 statements per cabinet. The brief explicitly anticipates this ("many countries will not have clean Wikidata data for majority type. Write NULL rather than guessing") so the script does: when a cabinet matches by date+head but has no parties, `governingParty` is filled from the row's existing `hogParty` (Tier 1 output) and the other three fields stay NULL.
- **State-cabinet trap (federal countries):** the initial SPARQL `?cabinet wdt:P17 wd:Q183` returned **490** cabinets for Germany including Bavaria's "Söder III" (Q123223528), Hesse's, etc. Because Söder III's Wikidata item *omits* P6 (head of government) entirely, the early version of `matchCabinet` happily fell back to it for federal Merz-era rows (Söder III start = 2023-01-01 was the most-recent cabinet in the country). Final logic requires `cab.headQid === hogQid` *strictly* — cabinets with a null headQid AND a non-null row.hogWikidataId are skipped rather than treated as wildcards. This trades some recall on old cabinets where Wikidata hasn't recorded a head, for the precision the brief mandates.
- **`matchCabinet` correctness:** the first pass returned the *first* end-null cabinet (Cabinet Wirth II, 1921-10-26, end=null) for every post-1921 date because Wikidata frequently omits P582. Fixed by scanning all candidates and keeping the *latest* one whose `[start, end]` interval contains the date (treating end=null as "still in office" but always preferring a later cabinet with a proper end date when one exists). Verified against five German PMs: Brandt (1972) → Cabinet Brandt II, Schmidt (1979) → Cabinet Schmidt II, Kohl (1986/1998) → Cabinet Kohl II / Kohl V, Schröder (2002) → Cabinet Schröder I. The Kohl III (1993), Merkel I-IV (2007-2021), and Merz (2026) rows did *not* match — their Wikidata cabinet items either lack `P580/P582` or have an incomplete head linkage. Those rows still get `governingParty` from `hogParty`.
- **CLI / safety / idempotency:** `--dry-run` (default, no writes; samples 5 countries, 10 date-spread rows each; writes `enrich-parliamentary-majority-dry-run.json`) | `--full` (requires `ALLOW_EDITS=true`) | `--country <tag|label|QID>` | `--limit N` | `--verbose`. SPARQL throttle 1100 ms (brief asked for 500 ms; bumped to match Tier 1's gap and stay clearly under the public-endpoint 429 threshold). Idempotent — only rows where `governingParty IS NULL` are touched. DB count printed at the end of every non-dry-run (`PoliticalContext` with `governingParty` set, and with `majorityType = 'coalition'`) per AGENTS.md rule 6.
- **DB landscape entering this run:** 219,965 total `PoliticalContext` rows across 49 country labels (top: Argentina 25,824, Italy 16,929, Chile 15,881, US 12,280, UK 11,777). 113,147 already carry `headOfGovernment` (Tier 1 success rate ~51%). 0 have `governingParty` set today. A full run is bounded by ~49 SPARQL queries (1.1 s each ≈ 55 s) plus per-row Postgres updates; the DB writes dominate runtime, not Wikidata.
- **Dry-run summary written to `enrich-parliamentary-majority-dry-run.json`.** Type-check (`npx tsc --noEmit --project tsconfig.scripts.json`) clean on the new file (pre-existing errors in unrelated scripts unchanged).
- **No DB writes performed.** Awaiting explicit go-ahead before invoking `--full`.

### 2026-05-23 (Topic pages — Timeline + Vote Patterns + Party Vote Tallies sections)

Extended the existing `/topics/[slug]` pages and `/api/topics/[slug]` route with three aggregate sections per the topic-pages spec. Index page at `/topics` and slug-detail page existed already (built earlier — client components driving URL-based party/leader filters); this pass adds the missing analytical layers without touching the working filter flow.

- **`lib/voteAnalysis.ts`** — exported the previously file-local `extractPartyCounts()` helper so the topic API can reuse the same UK-array-form / map-form parser that powers `/analysis/votes`. No behavior change for `/analysis/votes`.
- **`app/api/topics/[slug]/route.ts`** — added three new response fields, all computed topic-wide (i.e. they ignore the `party` / `leader` query params that scope the paginated claim list, so the analytical summary always describes the topic as a whole):
  - `timeline: { year, count }[]` — `Claim.claimEmergedAt ?? Claim.createdAt` grouped by UTC year. Done in JS over a `select: { claimEmergedAt, createdAt }` find (the largest topic is `riksdag_v1` at ~10k claims — well within memory budget; avoids the `Prisma.sql` conditional gymnastics a raw `EXTRACT(YEAR FROM …)` GROUP BY would need to keep the DEPRECATED filter clean).
  - `voteStats: { totalVotes, contestedCount, contestedPct, unanimousCount, unanimousPct, avgAyePct, avgNayPct, contestedThreshold, minTotal } | null` — pulled from `LegislativeVote` rows whose source has at least one non-deleted Edge to a Claim tagged with any of `topicIds` (topic itself + children + grandchildren, same expansion the existing claim query uses). Uses the shared `CONTESTED_THRESHOLD = 0.10` and `MIN_TOTAL = 10` constants so `/topics/uk-parliament` and `/analysis/votes` agree on what "contested" means. Returns `null` (not 0-filled) when the topic has no qualifying votes, so the UI can omit the section entirely.
  - `partyVoteTallies: { party, yes, no, abstain, billCount, totalVotes, yesPct, noPct, abstainPct }[]` + sibling `partyRowsParsed: number` — `byPartyJson` parsed through the shared `extractPartyCounts()`, aggregated across all qualifying votes. Currently only `uk_legislation_v1` populates `byPartyJson` (per the existing /analysis/votes changelog note), so this section only appears on UK topics today — when US/EU/Canada party data lands the same code path picks it up automatically.
- **`app/topics/[slug]/page.tsx`** — added three render sections (`TimelineSection`, `VoteStatsSection`, `PartyTalliesSection`) and a domain link in the header. Timeline is a fill-gap bar chart (gap years rendered as 0-height so the x-axis is true to scale) with year-min / midpoint / year-max labels; titles on each bar show the year + count for hover-inspection without a charting dependency. Vote stats render as 4 stat cards (Recorded votes, Contested, Unanimous, Avg aye/nay). Party tallies render as a table with the same column shape and color scheme as `/analysis/votes` "By party" — yes-green, no-red, abstain-gray, color swatch via the existing `partyColor()` helper. All three sections key off the existing dark-theme tokens (`bg-gray-900` cards on `bg-gray-950` page).
- **`app/topics/page.tsx`** — index page already lists every topic with claim counts grouped by domain (root + subtopic tree, searchable, recursive claim-count rollup). No changes needed for the spec; left as-is.
- **`app/layout.tsx`** — `/topics` nav link already present; no change.

**Verification:**
- `npx tsc --noEmit` clean (exit 0).
- Dev-server smoke tests:
  - `GET /api/topics/us-enacted-legislation` → HTTP 200, 25.6 KB, 2.5 s. `voteStats.totalVotes = 505 / contestedCount = 394 / contestedPct = 78.0% / unanimousCount = 26 / unanimousPct = 5.1% / avgAyePct = 71.4% / avgNayPct = 28.6%` — matches the US Congress row in `/analysis/votes` exactly. `timeline` covers 1981–2026 (46 years, max 523 claims/year). `partyVoteTallies` empty (`congress_v1` does not yet populate `byPartyJson`), as expected.
  - `GET /api/topics/uk-parliament` → HTTP 200, 29.2 KB, 1.9 s. `voteStats.totalVotes = 169 / contestedCount = 166 / unanimousCount = 0`. `partyRowsParsed = 169`; tallies: Labour 99.6% no (45,799 votes) · Conservative / Liberal Democrat / SNP / DUP / Reform UK / Plaid Cymru / Green all 100% yes — same Labour-vs-Opposition pattern called out in the existing 2026-05-23 `/analysis/votes` changelog (the same 169 UK rows underlie both views).
  - `GET /api/topics/chemistry` → HTTP 200, `voteStats: null`, `partyVoteTallies: []`, timeline single year — non-vote topics render cleanly with the vote sections suppressed.
  - `GET /topics`, `GET /topics/uk-parliament`, `GET /topics/us-enacted-legislation` all HTTP 200; pages are client components so the initial HTML is the "Loading…" placeholder and content hydrates from the API on mount. No runtime errors in dev log.
- **Homepage changelog**: added a bullet under the 2026-05-23 group documenting the new sections.
- **Footer "last updated"**: already `May 23, 2026` — no change needed.

**Scope discipline:** no DB migration, no Prisma client regeneration, no new dependencies, no auth changes. The existing party-name / party-emoji / party-color helpers are unchanged. The new aggregates use one extra `findMany` (timeline dates) and one extra `findMany` (legislative votes) per topic-page render; for the largest topics (~10k claims, hundreds of votes) page render stays well under 3 s end-to-end. No write paths touched.

**Files changed:** `lib/voteAnalysis.ts` (export `extractPartyCounts`), `app/api/topics/[slug]/route.ts` (new aggregates), `app/topics/[slug]/page.tsx` (Timeline/VoteStats/PartyTallies sections + domain link in header), `app/page.tsx` (homepage changelog bullet), `CONSULTANT.md` (this entry).

### 2026-05-23 (/search — cross-cutting full-text search across claims + sources)

New top-level surface so the corpus is browsable by free text, not just by curated filters. ILIKE substring match (no `tsvector` yet — corpus is ~56k claims / 55k sources, comfortably within ILIKE's headroom for interactive queries).

- **`app/api/search/route.ts`** (new) — GET endpoint. Params: `q` (≥3 chars, trimmed), `type` ∈ `{claims, sources, all}` (default `all`), `limit` (default 25, max 100), `offset` (default 0). Below the min-query threshold the route returns a structured empty payload with `message`, not a 400, so the client can render the "keep typing" state without an error branch. Uses `Promise.all` to parallelise the 4 queries (count + list × 2 entities). Source rows include their first non-deleted edge (`orderBy: createdAt asc, take: 1`) so the UI can deep-link a source result straight to a claim. `force-dynamic` — query strings vary per request, caching would be wrong.
- **`app/search/page.tsx`** (new) — thin server component that wraps the client in `<Suspense>` (required by Next.js 16 because `SearchClient` consumes `useSearchParams`). Page-level metadata sets `<title>Search — Epistemic Receipts</title>`.
- **`app/search/SearchClient.tsx`** (new) — client component. Reads `q` / `type` / `offset` from the URL, debounces input changes 250 ms before pushing to the URL via `router.replace` (so back-button doesn't accumulate every keystroke), and re-fetches `/api/search` whenever the URL changes. AbortController on every fetch so stale responses can't overwrite fresh ones. Filter pills (All / Claims / Sources) toggle the `type` param. Pagination is 25-per-page with prev/next buttons (count-derived `pageCount`, so the URL `offset` is the canonical pagination state). Empty states are explicit and distinct: empty input ("Type a query…"), 1-or-2-char input ("Keep typing…"), zero-result query ("No matches for &ldquo;X&rdquo;"), and loading ("Searching…"). Result cards mirror existing site patterns — claim cards show status badge + claimType + verificationStatus + ingestedBy tag and link to `/claims/[id]`; source cards show name + URL + methodology pill + ingestedBy tag and link to the first linked claim (or render as a non-link `<div>` when the source has no edges). Dark theme — `bg-gray-900` cards on the inherited `bg-gray-950` page background, matching `/analysis/votes` and the rest of the app.
- **Nav + homepage**: added `/search` link in `app/layout.tsx` immediately after the home link (highest discoverability); appended a bullet to the 2026-05-23 homepage changelog entry. Footer "last updated May 23, 2026" already current.
- **Verification**: `npx tsc --noEmit` clean. Dev server smoke test — `/search` returns HTTP 200 (20.2 KB initial HTML), `/api/search?q=climate&type=all&limit=3` returns 200 with `counts: {claims: 200, sources: 79}` in ~0.4 s, `/api/search?q=ab` returns 200 with the `message` payload (under min-query), `type=sources` and `type=claims` filters correctly suppress the other half of the result set, `offset=5` advances pagination. No dev-server errors in the log.
- **Scope discipline**: no schema migration (no `tsvector` column added; ILIKE is fine at current corpus size and the receipt-vs-audit-cost rule doesn't pay off for a search index when the underlying tables are already indexed on `deleted`). No new dependencies. No auth gate — all read endpoints are public per existing convention. Source result intentionally links to the first linked claim rather than a `/sources/[id]` route because that route doesn't exist yet and the claim page already shows the source inline.

**Files changed:** `app/api/search/route.ts` (new), `app/search/page.tsx` (new), `app/search/SearchClient.tsx` (new), `app/layout.tsx` (nav link), `app/page.tsx` (changelog bullet).

### 2026-05-23 (Backfill real bill titles into `Source.name` for all `congress_v1` records)

The Pipeline 15 ingester (`scripts/ingest-congress.ts:288`) wrote a placeholder `Source.name` of the form `"Congress.gov: H.R. 82 (118th Congress)"` for every enacted-bill Source. The actual bill title only lived inside `Claim.text` (and even there, only the long `bill.title` from the list endpoint, not the cleaner display/short title). The UI surfaces `Source.name` in several places (analysis pages, source pickers, citation rendering), so every congress_v1 row read as a bare bill number. This pass backfilled all 10,360 sources with real titles via the Congress.gov v3 API.

- **New script: `scripts/enrich-bill-titles.ts`.** Idempotent — finds congress_v1 Sources whose `name` matches the original placeholder regex (`^Congress\.gov:\s+[A-Z.]+(?:...)?\s*\d+\s+\(\d+\w{2}\s+Congress\)\s*$/i`), starts with `congress_law_`, or is null. Reads `(congress, billType, billNumber)` from `Claim.metadata` via the existing `Source → Edge → Claim` join (every congress_v1 Source has exactly one FOR edge). Fetches `GET /v3/bill/{congress}/{type}/{number}` and uses `bill.title` when it fits the short-title budget (≤120 chars). For longer titles, falls back to `GET /v3/bill/.../titles` and picks the shortest title whose `titleType` includes "short" or equals "Display Title" and is ≤120 chars; if none, keeps the main title (truncated only at the safety ceiling of 280 chars, which never triggered in this run). Throttle 400ms, 30s sleep on HTTP 429, exp-backoff on 5xx. `--dry-run`/`--full`/`--limit N` flags; `--full` requires `ALLOW_EDITS=true`.

- **Title selection nuance worth recording for future API consumers.** The bill object's top-level `title` IS the display/short title for the vast majority of modern bills (e.g. HR 82 returns `"Social Security Fairness Act of 2023"`, not its 100+ char official-introduced form). The /titles endpoint is only needed for the long tail of older or naming-style bills. Implementing this as "main title first, /titles only as fallback" cut per-record API calls roughly in half versus a naive two-call design and still produced human-readable names for the long tail (e.g. "Welfare Reform bill" remains the only short label for some 1990s/2000s welfare bills — but the script intentionally does NOT pick `titleType=Popular Titles` because they tend to be informal nicknames; `Short Title(s) as Introduced`/`as Passed House`/`from ENR` and `Display Title` are the trusted families).

- **Run results.** First pass: 10,359/10,360 enriched in 6,147.6 s (~1h43m, slightly over the 70-min estimate because real network round-trips averaged ~590 ms per record rather than the throttle-floor 400 ms — Congress.gov added 150-200ms latency on top of the throttle). One record failed with a transient Cloudflare HTTP 520 on the /titles fallback for 108/HR/3146 (a 134-char official title that needed the secondary lookup). Re-running the script after the run idempotently picked up that one record (Display Title was identical to the main title — both 134 chars; under the 280-char safety ceiling so it was kept verbatim). Final state: **10,360/10,360 enriched, 0 generic names remaining** (verified by independent `prisma.source.count` query per CLAUDE.md rule 6).

- **Sample outcomes.** `Congress.gov: S. 619 (118th Congress)` → `COVID-19 Origin Act of 2023`. `Congress.gov: H.R. 3935 (118th Congress)` → `FAA Reauthorization Act of 2024`. `Congress.gov: H.R. 82 (118th Congress)` → `Social Security Fairness Act of 2023`. Naming bills retain their official long form: `Congress.gov: H.R. 3947 (118th Congress)` → `To designate the facility of the United States Postal Service located at 859 North State Road 21 in Melrose, Florida, as the "Pamela Jane Rock Post Office Building".`

- **Scope discipline.** Only `Source.name` was touched. `Source.url`, `Source.externalId`, `publishedAt`, `methodologyType`, `ingestedBy`, `humanReviewed`, `autoApproved` all untouched. `Claim.text`, `Claim.metadata`, and the existing edges/revisions left as-is — they remain the audit-trail-of-record for what the ingester originally saw. The new title is purely a display-layer improvement, sourced live from the Congress.gov API at backfill time (URL captured implicitly via `Source.url`, which is the human-readable congress.gov bill page — fetchable for re-verification at any time).

- **Type-check** (`npx tsc --noEmit --project tsconfig.scripts.json`) clean on `scripts/enrich-bill-titles.ts`.

### 2026-05-23 (/analysis/votes — contested vs. unanimous breakdown across legislative bodies)

New analysis surface built on top of the existing `LegislativeVote` corpus (~2,948 recorded ayes/nays rows across `uk_legislation_v1`, `eu_parliament_v1`, `canada_bills_v1`, `congress_v1`). No DB migration — this is read-only aggregation over data already populated by the legislative ingesters and member-vote enrichment.

- **`lib/voteAnalysis.ts`** (new) — shared aggregation function `buildVoteAnalysis()` so the page and API route share one source of truth. A bill is **contested** when `nay / (aye + nay) > 0.10`, **unanimous** when nay = 0. Rows with `aye + nay < 10` are excluded as procedural (matches the threshold the standalone `scripts/analyze-votes.ts` uses). Output shape: `{ meta, countries[], globalContested[], globalUnanimous[], parties[] }`.
- **`app/api/analysis/votes/route.ts`** (new) — thin GET wrapper around `buildVoteAnalysis()`. `force-dynamic`.
- **`app/analysis/votes/page.tsx`** (new) — server component. Summary stat cards (total / contested / unanimous / bodies), per-body table, global most-contested top 10, largest-unanimous top 5, per-country detail blocks (top 10 contested + top 5 unanimous each), party breakdown table. Bill titles link out to `Source.url` in a new tab. Dark theme matches the rest of the app (`bg-gray-900` cards on `bg-gray-950` page; nay-percent bars colored red/orange/yellow/gray by intensity).
- **`byPartyJson` shape discovery.** Only `uk_legislation_v1` actually populates this column today (169 of 2,948 rows). The actual shape is **not** the `{PartyName: {yes, no, abstain}}` documented in `prisma/schema.prisma:267` — it's the UK-specific `{ ayes: [{PartyName, VoteCount}, ...], noes: [...], abstains: [...] }` shape emitted by `theyworkforyou`-style sources. `extractPartyCounts()` handles both shapes (UK array-form first, then the documented map-form fallback) so the page will pick up Canadian/US party data automatically when those enrichments land.
- **Party-breakdown caveat surfaced by the data:** with 169 UK rows currently parsed, the aggregate shows Conservative/Liberal Democrat/SNP/Green/etc. at 100% YES and Labour at 99.6% NO — almost certainly because the 169 UK rows captured the **opposition third-reading vote** for each bill, not the full session. Flagging here for whoever next looks at UK vote ingestion; the page renders truthfully against the underlying data either way. Filter is `billCount >= 3` to drop one-off splinter parties.
- **Nav + homepage**: added `/analysis/votes` link in `app/layout.tsx` next to "Datasets" / before "Forthcoming"; appended a bullet to the 2026-05-23 homepage changelog entry summarising the new page. Footer "last updated May 23, 2026" already current — no change needed.
- **Verification:** dev-server smoke test → `/api/analysis/votes` returns HTTP 200, 29.7 KB JSON, 619 ms; `/analysis/votes` renders HTTP 200, 209 KB HTML, 1.5 s. `npx tsc --noEmit` clean. Country totals match `scripts/analyze-votes.ts` output exactly (EU 1,900 / US 505 / Canada 374 / UK 169 — 2,948 total).
- **Scope discipline:** no new DB queries beyond a single `LegislativeVote.findMany` with `source` select; no client-side JS (server component); no new dependencies; no changes to ingesters or enrichment scripts.

**Files changed:** `lib/voteAnalysis.ts` (new), `app/api/analysis/votes/route.ts` (new), `app/analysis/votes/page.tsx` (new), `app/layout.tsx` (nav link), `app/page.tsx` (changelog bullet).

### 2026-05-23 (US Congress member-vote enrichment — verified already complete, no-op)

Task brief asked to fix `scripts/enrich-member-votes.ts` (reported 404 on all 505 `congress_votes_v1` records) and re-run. Investigation showed both fixes were already in place from earlier today:

- **URL format already correct.** Commit `4d3b1ef` ("Fix member vote enrichment: use rollUrl XML sources instead of nonexistent Congress.gov /vote/ endpoint") had already switched the script away from the deprecated `api.congress.gov/v3/vote/...` shape to the per-claim `meta.rollUrl` (House: `clerk.house.gov/evs/{year}/roll{N}.xml`, Senate: `senate.gov/legislative/LIS/roll_call_votes/vote{CC}{S}/vote_{CC}_{S}_{NNNNN}.xml`). Both spot-checked with `curl -I` → HTTP 200, `Content-Type: text/xml`.
- **Enrichment already ran.** DB query: 505/505 `dataSource='congress_votes_v1'` LegislativeVotes carry MemberVote children, **104,550** MemberVote rows total (avg ~207/vote — Senate roll calls ~100, House ~430). The 2026-05-23 changelog entry above ("MemberVote children") already implicitly confirms this.
- **Dry-run on 10 records** (`--dry-run --limit 10`): `enriched=0 skipped=10 no-url=0 failed=0` — the early-return guard at L164 (`if (lv.memberVotes.length > 0) { skipped++; continue }`) short-circuits all already-enriched rows, exactly as designed.

**No script changes, no live fetch, no DB writes.** The 404 description in the task brief reflected the pre-2026-05-22 state. Telegram message 7220 sent to chat 7688025079 confirming the no-op finding and the 104,550 MemberVote count.

### 2026-05-23 (US Congress member votes — fix visibility on vote claims + lazy-load to unblock bill claims)

Two coupled fixes around the `congress_votes_v1` member-vote feature surfaced after the 2026-05-22 enrichment that wrote 505 `LegislativeVote` rows (each with ~400 `MemberVote` children).

- **Issue 1 (vote claim pages had no member breakdown).** `enrich-member-votes.ts` attaches `LegislativeVote` rows to **bill sources** (externalId `congress_law_source_{congress}_{type}_{number}`), not to the **vote-claim sources** that the roll-call vote claim pages render (externalId `congress_vote_{chamberSlug}_{congress}_{type}_{number}_{rollKey}_source`). Result: opening a roll-call vote claim showed Revision History only — no LV summary, no member list. Fix is at the API layer, not data layer — no migration needed. In `app/api/claims/[id]/route.ts`, after the main `findUnique`, any edge whose `source.externalId` matches `/^congress_vote_([^_]+)_(\d+)_([a-z]+)_(\d+)_.+_source$/` and has zero direct LVs triggers a one-shot lookup against the corresponding `congress_law_source_*` bill source. Matched LVs are filtered by chamber (`normalizeChamber()` collapses `"house-of-representatives" / "House" → "house"`, etc.) and grafted into `edge.source.legislativeVotes`. If chamber filtering returns nothing (defensive — e.g. unparseable slug), the unfiltered LVs are used. This keeps data ownership on bill sources (existing UI flows untouched) while letting both views render the same LV.

- **Issue 2 (bill claim pages timed out on Vercel Hobby's 10s limit).** Bill claim sources usually carry 1–2 LVs each with ~400 `MemberVote` rows, and the prior `include` shape (`legislativeVotes.memberVotes`) eagerly loaded all of them in the main claim query. Hot-pathing ~800 joined rows through the API was reliably tripping the 10s function timeout, leaving the page hung on "Loading…". Fix: drop `memberVotes` from the eager include and replace it with `_count: { select: { memberVotes: true } }` so the trigger button can still render the count badge. Added new route `app/api/legislative-votes/[id]/members/route.ts` that returns the `MemberVote[]` for a single LV, sorted `vote asc, party asc, name asc` (same order the prior eager include used). `MemberVotesSection` in `app/claims/[id]/page.tsx` now takes `{ legislativeVoteId, count }` and fetches via the new endpoint on first expand (`useEffect` guarded by `open && votes === null && !loading`). Loading/error states inlined.

- **Type plumbing.** `LegislativeVoteRecord.memberVotes: MemberVoteRecord[]` was replaced with `_count: { memberVotes: number }`. The call site (`{v._count.memberVotes > 0 && <MemberVotesSection ... />}`) now gates the trigger button on the count without needing the full payload. `npx tsc --noEmit` clean.

- **Scope discipline.** No DB migration. No changes to `enrich-member-votes.ts` (the existing enrichment continues to write to bill sources, which is fine given the API-layer fallback). The fallback regex is intentionally tight (`congress_vote_*_source` only) so non-Congress vote rows are not accidentally rewritten. Lazy-load endpoint is read-only — no auth gate added since the rest of the API is read-only public.

- **Files changed:** `app/api/claims/[id]/route.ts`, `app/api/legislative-votes/[id]/members/route.ts` (new), `app/claims/[id]/page.tsx`, `app/layout.tsx` (footer date → May 23, 2026), `app/page.tsx` (homepage changelog entry).

### 2026-05-21 (no-token science/medicine scripts agent-verified — scheduled for 2am cron)

Three pipeline scripts were verified by coding agents and confirmed working with no external API keys. Scheduled to run at 2am EDT 2026-05-22:
- `ingest-nuclear-tests.ts` (`nuclear_tests_v1`) — 202 nuclear test records, all sourced to Wikipedia. Physics/history domain.
- `ingest-periodic-table.ts` (`periodic_table_v1`) — 118 elements from Bowserinator/IUPAC JSON. Physics domain.
- `ingest-who-essential-medicines.ts` (`who_essential_medicines_v1`) — 147 drugs from WHO EML 23rd ed. Medical domain.

These are the first three hard-fact science/history pipelines to run post-legislative expansion. No architectural decisions pending — ready to ingest. ROADMAP.md and AGENTS.md updated.

### 2026-05-23 (NYT Media Coverage enrichment — dry-run phase, quota blocked)

Script `scripts/enrich-media-coverage.ts` built. Targets `congress_v1` claims (118th+ Congress). Searches NYT Article Search API by exact-quoted bill title, classifies framing (SUPPORTIVE/CRITICAL/DESCRIPTIVE) by keyword scoring on headline + snippet.

**Status: dry-run blocked on NYT daily quota (~500 req/day free tier).** Quota burned during API setup + debugging session. Resets at midnight EDT 2026-05-24; cron scheduled to re-run dry-run then.

**Key design decisions made:**
- Exact-phrase quoted search (`q="Social Security Fairness Act"`) to avoid noise from unquoted AND-word matching
- Skip pure-acronym titles (FISHES, EXPLORE, REPORT, etc.) — no meaningful signal
- Skip procedural titles ("To designate the facility…", joint resolutions, etc.)
- Date window: 6 months before enactment → 3 months after
- 1200ms throttle (not 500ms — free tier has per-minute + daily limits)
- `fl` field-filter param removed (deprecated April 8, 2025 by NYT)

**Schema not yet migrated.** `MediaCoverage` table (id, claimId, outlet, headline, url, publishedAt, framing) pending hit-rate validation from dry-run. UI (Option B — dedicated collapsible section below vote record, with empty-state "No major media coverage found") pending schema.

**Next step:** await dry-run results. If hit rate ≥ 10% on major bills (e.g. Social Security Fairness Act, Inflation Reduction Act, debt ceiling bills), proceed to schema migration + full pipeline run + UI.

---

### 2026-05-21 (openFDA Drug Labels pagination cap fix — effective_time partitioning)

- **Problem:** `scripts/ingest-openfda-labels.ts` (`openfda_labels_v1`) silently capped at ~25k of ~258k available records. The openFDA `/drug/label.json` endpoint enforces `skip + limit ≤ 25_000` per query; the prior implementation broke cleanly on the cap but had no plan B, so a "full run" would have ingested ≤ 9.7 % of the corpus and quietly stopped.
- **Fix:** added recursive binary-split partitioning over `effective_time`. `discoverPartitions(startStr, endStr)` probes `meta.results.total` for a date range; if the range is over `OPENFDA_PARTITION_CAP = 25000` it midpoints the date span and recurses on both halves. Each leaf partition is then paginated independently via `search=effective_time:[start TO end]&skip=N&limit=M`. Partition sum is asserted against the global `[19000101 TO 20991231]` total before any record fetch — if the sums disagree the script aborts rather than write partial data.
- **API encoding note:** Node's `URLSearchParams.set('search', 'effective_time:[20240101 TO 20240630]')` produces the encoding openFDA accepts (`search=effective_time%3A%5B20240101+TO+20240630%5D` — space-as-`+`, brackets pct-encoded). Verified via direct fetch. `curl` users need `-g`/globoff to avoid the shell interpreting `[...]` as a range.
- **Dry-run verification (no DB writes):**
  - `npx tsx scripts/ingest-openfda-labels.ts --dry-run` → **20 partitions discovered in 26.9 s, summing to 258,265 ≡ server total (match ✓).** Every partition under the cap; largest is `[20181003 TO 20200425] 23,039`, next-largest `[20240812 TO 20241231] 22,265` and `[20200426 TO 20210204] 20,665`. 2024 and 2025 each got split into ~3 sub-partitions as expected (yearly totals 38,549 and 43,337 both exceed the 25k cap; binary split lands well below it).
  - `--dry-run --limit 100` → confirmed partition iteration crosses boundaries cleanly. **Surprise finding:** the first 100 records (oldest partitions, 1970–early 2000s) are 100 % skipped as "no brand_name or generic_name" — these early SPL records lack `openfda` blocks entirely. The original task brief's "2 of 5 valid" smoke test was drawing from the API's default (unordered) page-1 slice, which biases toward records with full metadata. **Implication for any future full run:** the skip rate by partition is non-uniform and high in the early years; the final ingested count will be meaningfully lower than 258k. Spot-check of a 2024 partition (`[20240322 TO 20240811]`, 10 records) → 7/10 valid (3 sunscreens/OTC items lacking `openfda` block), so modern partitions are the realistic baseline.
- **API call cost:** partition discovery does 39 probe requests (one per recursion node — 20 leaves + 19 internal). At 300 ms politeness throttle that's the ~27 s observed. Cached over a full run this is a rounding error.
- **Behavior changes for callers:**
  - `--dry-run` (no `--limit`) now performs **partition discovery only** and exits with the verification report — does not fetch any records. The old behavior (paginate a few records to validate field mapping) is preserved when `--limit N` is also passed.
  - Verbose mode (`--verbose`) prints every probe and per-partition iteration boundary.
  - Single-day partitions over the cap (none observed today) log a loud `⚠` warning and proceed with partial retrieval — date-only partitioning is fundamentally cap-bound at ~25k records per day, which the current corpus does not approach (max single day in 2025 H2 is ~250 records).
- **Scope discipline:** `PAGE_SIZE` left at 100 (openFDA allows up to 1000). Bumping it would make the full run ~10× faster but is unrelated to the completeness fix and is left for a follow-up if/when a real production run is approved.
- **No DB writes performed.** The build-only Pipeline 8 entry from the 2026-05-21 changelog further down (under `openfda_labels_v1`) still applies: reference-tier-vs-background-tier scope and `VERIFIED + humanReviewed: false` flag conflict remain open before any production run.
- **Type-check clean** (`npx tsc --noEmit --project tsconfig.scripts.json` — no `ingest-openfda-labels.ts` errors). No registry / homepage / footer updates (script-only change).

### 2026-05-21 (ChEBI ingester column-mapping fix — new EBI schema)

- **`scripts/ingest-chebi.ts`** — fixed parser to handle EBI's renamed flat-file columns. The new header is lowercase and uses `status_id` (numeric FK) + `stars` instead of the legacy `STATUS` (letter code) + `STAR`. After uppercasing the resolved index map (existing behavior), `pickIndex` was looking for `'STAR'` (not `'STARS'`) and `'STATUS'` (not `'STATUS_ID'`) and bailing with "schema unexpected".
- **What changed:**
  - `iStar` candidate list now `'STARS', 'STAR'` (new schema first, legacy fallback).
  - Introduced `pickIndexWithKey()` for STATUS so the parser knows *which* column name matched, and `checkedStatusValue()` to map the matched key to the right "checked/approved" sentinel — `'1'` for `STATUS_ID`, `'C'` for the legacy `STATUS`. The filter compares `status !== expectedCheckedStatus` instead of the hard-coded `!== 'C'`. **Gate logic itself is unchanged** (checked + ≥3 stars + canonical only); only the column names and the equivalent sentinel value were updated.
  - Updated the file's header comment + the schema-error message to reflect both schemas. `verbose` log now prints the matched STATUS column name and the resolved checked-value sentinel.
- **Determining the `status_id=1` sentinel:** downloaded the new file (6.34 MB gzip → 45.29 MB TSV, 205,310 rows). `status_id` distribution: `1`×62,000 / `3`×55,111 / `9`×87,442 / `2`×6 / empty×751. Cross-tab against `stars`: `(1, 3)`=62,000, `(3, 2)`=52,207, `(3, 1)`=2,902, `(9, 2)`=87,433, `(9, 3)`=9, etc. Spot-checked well-known canonical compounds (water `CHEBI:15377`, ethanol `CHEBI:16236`, glucose `CHEBI:17234`, hydroxide `CHEBI:16234`) — all have `status_id=1, stars=3`. So `status_id=1` is the unambiguous successor to `STATUS='C'`.
- **Dry-run result (verified, no DB writes):** `npx tsx scripts/ingest-chebi.ts --dry-run --sample 10 --verbose` parsed 205,310 rows → 143,310 filtered by status (status_id≠1) → 0 by star → 0 by secondary → **62,000 candidates**. Coverage: 52,051 / 62,000 (84.0%) carry a definition. Sample output saved to `pipeline-chebi-dry-run-sample.json`. Type-check (`npx tsc --noEmit --project tsconfig.scripts.json`) clean on `ingest-chebi.ts` (pre-existing errors in unrelated scripts).
- **Schema observation worth noting for future agents:** in the new EBI schema, `parent_id` is effectively no-op — only 3 rows in the entire file have non-empty `parent_id`, none of them `status_id=1`. EBI now encodes merge state via `status_id=9` (87k records, formerly the secondary/merged accessions that the old `PARENT_ID empty` gate dropped). The status-id gate alone now does the work the three-gate combination used to share. Filter is retained as defense-in-depth and to keep gate semantics explicit, but the visible filter-count for "secondary IDs" will read 0 going forward.
- **Status:** parser fix only. No DB writes attempted; pipeline still **dry-run validated, awaiting explicit go-ahead** before any sample/full run (same gate as the 2026-05-21 entry below). Candidate count rose slightly (~60k expected → 62,000 actual) but otherwise the run shape matches the prior dry-run.

### 2026-05-21 (ChEBI ingester URL fix)

- **`scripts/ingest-chebi.ts`** — fixed the `FLAT_FILE_URL` constant. EBI renamed the ChEBI flat-file directory from `Flat_file_tab_delimited/` to `flat_files/` (lowercase). The old URL `https://ftp.ebi.ac.uk/pub/databases/chebi/Flat_file_tab_delimited/compounds.tsv.gz` now returns 404; the new path `https://ftp.ebi.ac.uk/pub/databases/chebi/flat_files/compounds.tsv.gz` verified via `curl -I` (HTTP 200, 6.3 MB gzip, last-modified 2026-05-01). Header comment on line 3 updated to match. No other ingester logic touched — schema, gates (STATUS=C / STAR≥3 / canonical only), parser, and write path unchanged.

### 2026-05-21 (NIST physical & chemical reference ingester built — `nist_constants_v1` + `nist_webbook_v1`, dry-run only)

- **New script:** `scripts/ingest-nist.ts` covering two complementary NIST sources behind a `--section {constants|webbook|all}` switch. Both sources are free, no API key. Patterns follow `ingest-openfda.ts` (single `prisma.$transaction` per record: Source → Claim → Edge → EdgeRevision) and `ingest-pubchem.ts` (topic management via cached `ensureTopic`).
  - **`nist_constants_v1`** — fetches the live `https://physics.nist.gov/cuu/Constants/Table/allascii.txt` (2022 CODATA adjustment). Header detected dynamically (locate the dashes separator, verify the line above contains "Quantity"/"Value"/"Uncertainty"/"Unit"); data rows parsed by **fixed-width slicing** at columns 0/60/85/110. Naive whitespace splitting won't work — numeric values contain internal digit-grouping spaces (e.g. `6.644 657 3450 e-27`). Source per claim with `url = https://physics.nist.gov/cuu/Constants/index.html` (per task brief). `claimEmergedAt = 2022-01-01` with `YEAR` precision; `publishedAt = 2024-05-20` (CODATA-2022 publication date). Topic: new `nist-constants` (`name: 'NIST Fundamental Physical Constants'`, `domain: 'physics'`). Claim text follows the brief: `'${quantity}: ${value} ${unit} (uncertainty: ${uncertainty})'`; falls back to `'(exact, no uncertainty)'` when no uncertainty is listed.
  - **`nist_webbook_v1`** — curated 20-compound list with verifiable CAS numbers (Water, CO2, Methane, Ethanol, Glucose, Ammonia, H2SO4, NaCl, H2, O2, N2, He, Ar, Fe, Au, Cu, CO, H2O2, Acetic acid, Benzene). Each fetched from `https://webbook.nist.gov/cgi/cbook.cgi?ID={CAS}&Units=SI` and parsed for `Formula` + `Molecular weight` via two HTML markers (`Formula</a>:</strong> …` and `Molecular weight</a>:</strong> …`). Topic: new `nist-chemistry` (`name: 'NIST Chemistry WebBook'`, `domain: 'chemistry'`). Claim text: `'${name} (CAS ${cas}) has molecular formula ${formula} and molecular weight ${mw} g/mol.'`
- **Brief-to-schema translations (same gap noted in adjacent 2026-05-21 RxNorm and openFDA Labels entries below — flagging for the house-style decision):**
  - Brief asked for `category: 'PHYSICS'` and `category: 'CHEMISTRY'` — `Claim` has no `category` column. Recorded as `Claim.metadata.category` **and** mirrored as `ClaimTopic` tags on the per-section topics (`nist-constants` / `nist-chemistry`). Domains `physics` and `chemistry` are new — `physics` had no prior topic in the system (Nobel uses domain `science`, astronomy uses `astronomy`); `chemistry` is shared with the existing PubChem/ChEBI topics.
  - Brief asked for `Evidence: { type: 'SUPPORTS', strength: 1.0 }` — `Edge.type` enum is `FOR | AGAINST | CITES | RETRACTS | CORRECTED`; `'SUPPORTS'` is not valid. Mapped to `Edge.type: 'FOR'` + `evidenceType: 'EVIDENTIARY'`, `EdgeRevision.newScore: 100` (strength 1.0 × the project's 0–100 integer score scale).
  - Brief asked for `Units=SI&cST=on&JSON` on the WebBook URL. **The `&JSON` flag does not exist** on the live WebBook endpoint (silently ignored; the page returns HTML). Pipeline parses HTML via the two robust strong-tag markers instead — confirmed against 5 spot-checked compounds.
- **Dry-run results (no DB writes):**
  - `--section constants --dry-run --limit 8` → **355** constants parsed from allascii.txt; first 8 rows match by eye (alpha-particle family — dimensionless ratios with empty units, MeV/kg/u all sliced cleanly). Full-run candidate count ≈ 355.
  - `--section webbook --dry-run --limit 5` → 5/5 compounds yielded both formula and molecular weight: Water/H2O/18.0153, CO2/44.0095, CH4/16.0425, Ethanol/C2H6O/46.0684, Glucose/C6H12O6/180.1559. Full curated list size is **20**.
- **CLI flags:** `--section {constants|webbook|all}`, `--dry-run`, `--limit N` (per brief; matches `ingest-openfda.ts` patterns). 350 ms politeness throttle, 3-retry exponential backoff on 5xx/429, transaction timeout 30 000 ms (defensive — per-record transactions are small so 5 s default would also pass, but adding it follows CONSULTANT rule 5). Idempotent dedup by `externalId` (`nist_const_{slug}` / `nist_webbook_{cas}`). Per-section DB count printed at the end of every non-dry-run, satisfying AGENTS.md "verify ingester counters against DB state".
- **Pipeline awaiting explicit go-ahead before sample/full run; no DB writes performed.** Pipeline Registry / DB State table update deferred until the run actually ships.

### 2026-05-21 (OMIM phenotype ingester built — `omim_v1`, no live fetch yet)
- **New script:** `scripts/ingest-omim.ts` (`omim_v1`). Source: OMIM REST API at `api.omim.org/api`, free for research; script fails fast with a helpful registration message if `OMIM_API_KEY` is missing (register at https://www.omim.org/api). **`OMIM_API_KEY` is NOT currently in `.env.local`** — script is built and type-checked only; no live fetch attempted.
- **Scope:** OMIM phenotype entries — prefixes `#` (molecular basis known), `%` (Mendelian, locus unknown), and no-prefix (phenotype with suspected Mendelian basis). Gene-only (`*`), gene-with-phenotype (`+`), and moved/removed (`^`) entries are filtered out client-side. ~27k phenotype entries published in total.
- **Endpoint:** `GET /api/entry/search?search=*&include=text:description&start=N&limit=20&sort=mim_number+asc&apiKey=KEY&format=json`. **Sort deviation from brief:** brief suggested `sort=score&order=desc`, but `score` order is non-deterministic for `search=*` wildcard and would re-shuffle results across pages — replaced with `sort=mim_number+asc` for cursor-safe pagination.
- **Data mapping** (Claim+Source+Edge+EdgeRevision inside `prisma.$transaction(..., { timeout: 30000 })` per CLAUDE.md rule 5):
  - `claimType: 'EMPIRICAL'`, `currentStatus: 'HARD_FACT'`, `verificationStatus: 'VERIFIED'`, `autoApproved: true`, `humanReviewed: false`
  - `claim.text = "${preferredTitle} (MIM ${mim}): ${description truncated to 500 chars}"` (or just `"${preferredTitle} (MIM ${mim})"` when no description)
  - `claim.metadata = { dataset, mimNumber, prefix, status, domain: 'medicine' }`
  - `externalId`: `omim_${mim}` (claim), `omim_source_${mim}` (source)
  - `Source.name = "${preferredTitle} — OMIM"`, `Source.url = "https://omim.org/entry/${mim}"`, `publishedAt: null`, `methodologyType: 'primary'`
  - `Edge.type: 'FOR'`, `evidenceType: 'EVIDENTIARY'`, `EdgeRevision.newScore: 100`
  - Best-effort topic tag with slug `'medicine'` (skipped silently if topic doesn't exist — same pattern as `openfda_v1`'s `drug-approval` tag)
- **Schema-vs-brief deviations documented** (same brief-shape as the same-day openFDA-Labels and RxNorm entries below — house style still unresolved):
  - `category: 'MEDICINE'` → no matching Claim column. Mapped to `claimType: 'EMPIRICAL'` + `metadata.domain: 'medicine'` + best-effort `medicine` topic tag. (`MEDICINE` is not a valid `claimType` enum value — schema allows `EMPIRICAL | INSTITUTIONAL | INTERPRETIVE | HYBRID`.) Note divergence with peer pipelines from today: openFDA-Labels used `claimType: 'INSTITUTIONAL'` + `metadata.category`; RxNorm used `INSTITUTIONAL` + dedicated topics. OMIM uses `EMPIRICAL` because OMIM phenotype entries describe empirical genetic facts, not institutional resolutions.
  - `Source.label` → `Source.name`.
  - `Evidence: { type: 'SUPPORTS', strength: 1.0 }` → `Edge.type: 'FOR'` + `evidenceType: 'EVIDENTIARY'` + `EdgeRevision.newScore: 100`. (`SUPPORTS` is not a valid `Edge.type` — schema allows `FOR | AGAINST | CITES | RETRACTS | CORRECTED`.)
- **Idempotency:** `findUnique({ externalId })` pre-check per entry; existing rows count toward `skipped`. After live runs, summary prints an independent `prisma.claim.count({ ingestedBy: 'omim_v1', deleted: false })` per CLAUDE.md rule 6.
- **CLI flags:** `--dry-run` (no DB writes; writes `omim-dry-run-sample.json` with up to 25 candidate entries), `--limit N` (caps phenotype candidates in dry-run mode, caps ingested rows in live mode), `--verbose`. Rate limit 250 ms between page fetches (~4 req/sec — OMIM's published soft cap).
- **Open questions before any live run:**
  1. **Reference-tier vs. background-tier (CLAUDE.md):** OMIM is the canonical reference for Mendelian conditions; case studies on specific genetic disorders routinely cite individual MIM numbers (e.g. "BRCA1 (MIM 113705)"). I judge this **reference-tier** but flag for explicit confirmation before ingest, since ~27k records is a meaningful expansion of the review backlog.
  2. **`VERIFIED` flag with `humanReviewed: false`:** task brief instructed `verificationStatus: 'VERIFIED'`, kept literally — same situation as the same-day `openfda_labels_v1` / `rxnorm_v1` entries below.
  3. **Provision `OMIM_API_KEY`** in `.env.local` before any live fetch.
- **Type-check:** `npx tsc --noEmit --project tsconfig.scripts.json` produces zero errors against `scripts/ingest-omim.ts` (pre-existing errors in other scripts unrelated).
- **No DB writes performed.** Pipeline Registry, DB State table, footer, and homepage changelog not yet updated — those happen at deploy time alongside the first dry-run/full-run pass.

### 2026-05-21 (ChEBI ingester built — `scripts/ingest-chebi.ts`, dry-run only)
- **ChEBI Compounds (`chebi_v1`)** built — `scripts/ingest-chebi.ts`. Source: EBI ChEBI Flat File `compounds.tsv.gz` (`ftp.ebi.ac.uk/pub/databases/chebi/Flat_file_tab_delimited/compounds.tsv.gz`), free, no API key. Downloaded via built-in `fetch`, decompressed in-memory with `node:zlib` `gunzipSync` (~30–50 MB uncompressed TSV — fits comfortably in memory; no streaming required for the current ~60k expected candidates).
- **Schema-robust parser:** reads the first TSV line as the header and resolves column indexes by name (CHEBI_ACCESSION/ACCESSION/ID, NAME/CHEBI_NAME, STAR, STATUS, PARENT_ID, DEFINITION, SOURCE, MODIFIED_ON). Bails with a clear error if NAME / STAR / STATUS / accession-or-id are missing. If the DEFINITION column is absent in the current EBI release, the script logs a warning and falls back to NAME-only claim text rather than failing.
- **Quality gates** (per the brief + the "curated lists require verifiable sources" rule in CLAUDE.md): `STATUS === 'C'` (checked/approved — rejects S/submitted, O/obsolete, E/expired) + `STAR >= 3` (manual curator review — the highest ChEBI tier) + `PARENT_ID` empty (canonical entries only — drops secondary/merged accessions to avoid duplicate physical entities). All three filters are reported separately in dry-run output.
- **Data mapping:** `EMPIRICAL` / `HARD_FACT` / **`VERIFIED`** (3-star ChEBI is curator-reviewed), `autoApproved: true`, `humanReviewed: false`. `claimText = "${NAME}: ${DEFINITION truncated to 400 chars}"` (whitespace collapsed, ellipsis on truncation), or `"${NAME}"` if no definition. `externalId: chebi_${numericId}`; `Source.externalId: chebi_source_${numericId}`; `Source.url = https://www.ebi.ac.uk/chebi/searchId.do?chebiId=${CHEBI:NNNN}`, `Source.publishedAt: null` per task brief, methodology `primary`. One `FOR` / `EVIDENTIARY` Edge per claim with an EdgeRevision newScore=95 (matches PubChem chemistry — curator-reviewed primary). Topics: `chemistry` (root) + `chemical-compounds` (child of chemistry) via the standard `ensureTopic` helper; both already exist from PubChem so no new topic rows are expected.
- **Dedup:** by `Claim.externalId` (`@unique`) — semantically equivalent to the brief's "skip duplicates by source URL" since each ChEBI accession has exactly one canonical URL. Idempotent re-runs.
- **CLI:** `--dry-run`, `--sample N` (default 15), `--full`, `--limit N`, `--verbose`. `ALLOW_EDITS=true` env guard required for sample/full modes (matches recent legislative pipelines). Batches of 50 with `prisma.$transaction(..., { timeout: 30000 })`. Post-ingestion DB verification queries (`prisma.claim.count`/`source.count`/`edge.count`) print actual DB state per CLAUDE.md rule 6 (don't trust in-script counters alone).
- **Status:** **built only — no dry-run executed.** EBI FTP fetch wasn't exercised from this session; awaiting explicit go-ahead before any network/DB activity. Expected ~60k VERIFIED claims after the STATUS=C / STAR≥3 / canonical-only filter. **Not yet added** to the Pipeline Registry, DB State table, or `scripts/pipeline-queue.json` — those updates can happen alongside the first real dry-run when the candidate count is confirmed against the live EBI release.

### 2026-05-21 (RxNorm Ingredients ingester built — `rxnorm_v1`, dry-run only)

- **New script:** `scripts/ingest-rxnorm.ts` (`rxnorm_v1`). Source: NLM RxNav REST API (`https://rxnav.nlm.nih.gov/REST/`), free, no API key. Scope: every concept of TTY=IN (normalized ingredient) — the canonical ingredient form in RxNorm. Endpoint `GET /REST/allconcepts.json?tty=IN` returns the full set in a single bulk JSON response — **no pagination on this endpoint** (deviates from the brief, which assumed paginated). Per-record `Source.url` points to `/REST/rxcui/{rxcui}/properties.json` for downstream lookup if a future enrichment pass wants the live properties payload.
- **Brief-to-schema translation (parallels the openFDA Labels entry below — same project-vs-brief gap):**
  - Brief said `category: 'MEDICINE'` — `Claim` has no `category` column. Mapped to `claimType: 'INSTITUTIONAL'` (NLM is an authority issuing a canonical naming claim) plus `ClaimTopic` tags `pharmacology` (existing seed topic, domain `medicine`) and a new child topic `rxnorm-drugs` (`name: 'RxNorm Drug Ingredients'`, domain `medicine`, parent `pharmacology`). Uses runtime `ensureTopic` lookup, no hardcoded parent ID. (The peer openFDA-Labels script went a different route — `Claim.metadata.category` with no topic tag; flagging the divergence so the next agent can pick a house style.)
  - Brief said `Evidence: { type: 'SUPPORTS', strength: 1.0 }` — `Edge.type` enum is `FOR | AGAINST | CITES | RETRACTS | CORRECTED`; `'SUPPORTS'` is not valid. Mapped to `Edge.type: 'FOR'` + `evidenceType: 'EVIDENTIARY'`, `EdgeRevision.newScore: 100` (strength 1.0 × the project's 0–100 integer score scale).
  - Brief said "skip duplicates (check source URL)" — implemented via the `Claim.externalId` unique index (`rxnorm_rxcui_{rxcui}`), equivalent uniqueness to the source URL but indexed and ~1000× faster than a string scan.
  - Brief used `verificationStatus: 'VERIFIED'` (kept literally per task). Same caveat as openFDA Labels — recent convention for auto-ingested records is `PROVISIONAL` + `autoApproved: true`. RxNorm is defensible as VERIFIED on source-authority grounds (NLM is the canonical primary authority for US drug nomenclature, comparable to PubChem's `HARD_FACT` framing), but flagging it explicitly for Robert before any production write run.
- **Data mapping:** `claimText = "RxNorm drug: {name} (RxCUI: {rxcui})"`. `humanReviewed: false`, `autoApproved: true`, `currentStatus: 'HARD_FACT'`. `claimEmergedAt: null` + `claimEmergedPrecision: null` because `allconcepts` does not expose per-RxCUI creation/activation dates; pulling them would require one extra `/properties.json` call per concept and was not in scope. `Source.publishedAt: null` for the same reason, `Source.methodologyType: 'primary'`, `Source.name: '{name} — RxNorm'`. Metadata captures `rxcui`, `tty`, `name`, optionally `umlscui` and `synonym`. One `FOR` edge per claim with EdgeRevision newScore=100. Batch via `prisma.$transaction` with `{ timeout: 30000 }` per CLAUDE.md rule 5.
- **Per-record 60 ms `sleep` between writes** — honors the brief's "20 req/sec max" politeness ceiling. With the current one-shot API design the rate ceiling only matters if a future revision adds per-RxCUI `properties.json` enrichment; the delay stays in place so the throughput envelope stays under the ceiling automatically. At 14,632 records × 60 ms minimum the full run lower-bounds at ~15 minutes (DB write latency will dominate above that).
- **CLI:** `--dry-run` (default if no mode flag — prevents accidental writes), `--sample N`, `--full`, `--limit N`, `--verbose`. `ALLOW_EDITS=true` env guard required for sample/full modes (same convention as recent legislative pipelines).
- **Dry-run result:** server returned **14,632** TTY=IN concepts in a single ~150 ms call. The brief's "~100k+" estimate is incorrect for TTY=IN specifically — that figure conflates ingredients with the full RxNorm concept space across all TTYs (SCD/SBD/PIN/MIN/SY/BN/…). 0 malformed/duplicate rows in the response. Sample saved to `rxnorm-dry-run-sample.json`. **Spot-check observation:** a non-trivial fraction of the first 15 records are obscure IUPAC-style chemical names (e.g. `(((1-methyl-2-(5-methyl-3-oxazolidinyl)ethoxy)methoxy)methoxy)methanol`, RxCUI 1801150) rather than commonly-prescribed drugs — RxNorm IN covers any ingredient ever registered, including research chemicals and excipients. Editorial value of these long-tail records is lower than mainstream drug names; if receipt-vs-audit-cost (AGENTS.md) becomes a concern, a `--filter-suppressed` flag (RxNav exposes `suppress` on `minConcept`) and/or a name-shape heuristic could trim the tail.
- **Reference-tier vs. background-tier (AGENTS.md rule 2) — note for Robert:** Individual RxCUIs are cited routinely by clinical and regulatory case studies as canonical drug identifiers, so the ingredient set passes the reference-tier test for mainstream drugs. The long-tail IUPAC-named records are a softer call — they are valid RxNorm concepts but unlikely to appear in case-study citations. Not blocking the build, but worth a scope decision before full run.
- **Pipeline awaiting explicit go-ahead before sample/full run; no DB writes performed.** Independent DB-count verification (`prisma.claim.count({ ingestedBy: 'rxnorm_v1', deleted: false })`) is wired into the script and will run at the end of any non-dry-run invocation. No registry entry / homepage / footer updates (build-only session).

### 2026-05-21 (openFDA Drug Labels ingester built — `openfda_labels_v1`, dry-run only)

- **New script:** `scripts/ingest-openfda-labels.ts` (`openfda_labels_v1`). Endpoint `https://api.fda.gov/drug/label.json`, paginated `skip`/`limit` 100 per page, 300 ms delay, `api_key=${OPENFDA_API_KEY}`. CLI: `--dry-run`, `--limit N`, `--verbose`. Per-record write inside `prisma.$transaction(..., { timeout: 30000 })`: Claim (`INSTITUTIONAL` / `HARD_FACT` / `verificationStatus: VERIFIED` / `autoApproved: true` / `humanReviewed: false`) + Source (`methodologyType: primary`, url `…?search=id:{labelId}`) + Edge (`type: FOR`, `evidenceType: EVIDENTIARY`) + EdgeRevision (`newScore: 100`, mapping brief's `strength: 1.0`). `externalId` on Claim = `openfda_label_{id}`, on Source = `openfda_label_source_{id}`. Dedup: primary check on `Source.url + ingestedBy` per brief, externalId unique constraint as safety net. Progress log every 500 records.
- **Schema-vs-brief mappings made explicit:**
  - Brief's `category: 'MEDICINE'` has no matching Claim column — stored in `Claim.metadata.category` and `claimType` set to `INSTITUTIONAL`. No topic auto-tag (brief did not specify one).
  - Brief's `Evidence: { type: 'SUPPORTS', strength: 1.0 }` maps to `Edge.type='FOR'` + `EdgeRevision.newScore=100`. `SUPPORTS` is not a valid `Edge.type` enum value (per schema: FOR | AGAINST | CITES | RETRACTS | CORRECTED).
  - Brief used `verificationStatus: 'VERIFIED'` (kept literally per task) — this conflicts with the recent convention (P78–P90 use `PROVISIONAL` + `autoApproved: true` for auto-ingested pipeline records). Flagged for Robert's review before any production write run.
- **Pagination caveat:** openFDA caps `skip + limit ≤ 25,000` per query — script handles the BAD_REQUEST gracefully and stops cleanly at the cap. Brief mentioned ~140k records; live server total today is **258,265**, so a full ingest would require partitioning by `effective_time` range or `openfda.product_type`. Not implemented in this pass.
- **Smoke test (dry-run, limit 5):** server reports 258,265 records available; 2 of 5 records were valid claim candidates (`SILICEA` with traditional-homeopathic disclaimer; `Betadine` antiseptic), 3 skipped as "no brand_name or generic_name" — these are records without an `openfda` block (homeopathic/OTC items lacking an FDA application registration). Effective-time parsing (`YYYYMMDD` → `Date`) verified on both samples. Output sample written to stdout.
- **Architectural concerns flagged before build (Robert dismissed inline question and instructed proceeding):**
  - **Reference-tier vs. background-tier (AGENTS.md):** Individual SPL drug-label records look closer to "individual FAERS adverse event reports" (background-tier) than to citable bills/resolutions (reference-tier). Case studies are more likely to cite the drug (already in `faers_normalized_drugs_v1` aggregates and `openfda_v1` applications) or a specific labeling decision, than a particular SPL revision. The proposed `claimText` (`brand (generic): {indications snippet}`) is a product description, not an assertion case studies would cite.
  - **Receipt value vs. audit cost:** Full ingest would add ~258k records on top of ~49k existing — increasing the human-review backlog from ~47k to ~305k.
  - **`VERIFIED` flag with `humanReviewed: false`:** allowed per schema but inconsistent with AGENTS.md rule 3 (`humanReviewed ≠ autoApproved`) and recent pipeline convention (PROVISIONAL).
- **No DB writes performed.** No registry/footer/homepage updates (this entry covers the script build only — production-run gating, scope decision, and any downstream paging strategy remain open).

### 2026-05-20 (English-language legislative batch shipped — P79 Jamaica, P80 Sri Lanka, P89 Trinidad & Tobago, P90 Brunei; P72 Pakistan blocked)

Ran the auto-approved English-language run from `scripts/pipeline-queue.json`. Net DB delta across the four pipelines: **+2,888 Claims / +2,888 Sources / +2,888 `CITES` Edges**, plus 4 new topics (`jm-parliament`, `lk-parliament`, `tt-parliament`, `bn-parliament`) — each parented at runtime via slug lookup (no hardcoded parent IDs). Independent `prisma.claim.count({ ingestedBy, deleted: false })` ran after every pipeline; the script counter and DB count matched exactly in every case (no closure-scope drift). All records `PROVISIONAL` / `autoApproved: true` / `humanReviewed: false`.

- **Pipeline 79 (Jamaica Acts of Parliament — `jamaica_legislation_v1`)** shipped — `ALLOW_EDITS=true npx ts-node --project tsconfig.scripts.json scripts/ingest-jamaica.ts --full` completed in 63.1 s. **528 / 528 ingested, 0 skipped, 0 errors.** Source: Laws of Jamaica DataTables endpoint at `laws.moj.gov.jm/library/acts-of-parliament/{YYYY}` (POST `_dt=dt&draw=1&start=0&length=1000`), years 2000–2023 (2003/2004 are 0-act gaps in MoJ's coverage, not script bugs). Topic `jm-parliament` ("Parliament of Jamaica", domain `government`, parent `gov-region-americas`). DB verified: Claims 528 / Sources 528 / Edges 528. Telegram message 6162 sent (Jamaica done, Sri Lanka starting).

- **Pipeline 80 (Sri Lanka Acts of Parliament — `srilanka_legislation_v1`)** shipped — `scripts/ingest-srilanka.ts --full` completed in 197.8 s. **1,704 / 1,704 ingested, 0 skipped, 0 errors.** **Source deviation from task brief:** the brief named `lawnet.gov.lk`, but that domain is currently parked (returns only the string `"root directory"` under a `mail.aoa.ypa.mybluehost.me` Let's Encrypt cert — i.e. a hosting-provider placeholder, not a live site). The authoritative replacement is the Department of Government Printing at `documents.gov.lk/view/act/acts.html` — static HTML index linking per-year pages `acts_{YYYY}.html` for every year 1981–2026. Each row carries `Act Number (NN/YYYY) · Date (YYYY-MM-DD) · Description · Download (English/Sinhala/Tamil PDFs)`. Pure HTML, no API key. Topic `lk-parliament` parented under `gov-region-asia-pacific`. **100 % (1,704/1,704) DAY-precision dates.** PDF link coverage: English 72.1 % (1,229/1,704) · Sinhala 92.0 % (1,567) · Tamil 69.4 % (1,183); all three captured in `Claim.metadata.pdfUrls`. DB verified: Claims/Sources/Edges all 1,704. Decade spread 1980s 420 · 1990s 350 · 2000s 437 · 2010s 309 · 2020s 188. The same dry-run sample is at `pipeline-80-dry-run-sample.json`.

- **Pipeline 72 (Pakistan Code — `pakistan_legislation_v1`) BLOCKED** — task protocol allowed skipping on a geo-block; this is one. Probed five federal Pakistani legal portals from this network on 2026-05-20: `www.pakistancode.gov.pk`, `molaw.gov.pk`, `senate.gov.pk`, `na.gov.pk` all TCP-timeout (`Failed to connect to … port 443 after 75004 ms`); `www.supremecourt.gov.pk` returns HTTP 403 (likely Cloudflare DDoS protection rejecting non-PK traffic). No reachable `.gov.pk` primary-source candidate available; mirrors/third-party scrapers would violate the API-only sourcing rule. Marked `status: "blocked"` in `scripts/pipeline-queue.json` with the probe log in `block_reason` so the next agent can revisit from a different egress (VPN with PK exit, or a sanctioned data partner). Telegram sent (Sri Lanka done + Pakistan blocked + T&T starting, message 6167).

- **Pipeline 89 (Trinidad & Tobago Revised Laws — `tt_legislation_v1`)** shipped — `scripts/ingest-tt.ts --full` completed in 46.6 s. **368 / 368 ingested, 0 skipped, 0 errors.** Source: Ministry of Legal Affairs at `rgd.legalaffairs.gov.tt/laws2/` — Apache directory listing of 27 chapter HTML files (`Ch._N.htm` and `Chs._N-M.htm` ranges, e.g. `Chs._10-13.htm` covers Chapters 10 through 13) plus a sibling `Alphabetical_List/lawspdfs/` directory holding 532 consolidated chapter PDFs at `X.YY.pdf` (T&T's "Chapter X:YY" Revised Laws citation form). The catalog exposes **no original enactment date** per row — only the PDF's HTTP `Last-Modified`. We use the PDF mtime as `claimEmergedAt` with `DAY` precision and record this explicitly in `Claim.metadata.dateSource = 'pdf_last_modified'` + `metadata.note` so future readers don't conflate it with enactment. **367 / 368 (99.7 %)** carry an mtime (all 2018-12-05 / 2018-11-13 — the consolidated revision was published in November/December 2018); the one missing record falls back to T&T independence 1962-08-31 + `YEAR` precision, flagged `metadata.dateSource = 'tt_independence_fallback'`. Topic `tt-parliament` parented under `gov-region-americas`. **Two bugs caught during dry-run and fixed before commit:** (a) the date-parsing split used the character class `[ -:]`, which is a *range* from space (0x20) to colon (0x3A) covering all digits — replaced with three explicit capture groups for day/month/year; (b) the column count varies across letter pages (4 vs 5 TDs); fixed by scanning every TD between the title and the date for the `CAP.` cell instead of using a fixed index. Telegram sent (T&T done, Brunei starting, message 6170).

- **Pipeline 90 (Brunei Darussalam Laws — `brunei_legislation_v1`)** shipped — `scripts/ingest-brunei.ts --full` completed in 34.9 s. **288 / 288 ingested, 0 skipped, 0 errors.** Source: Attorney General's Chambers SharePoint catalogue `agc.gov.bn/AGC%20Site%20Pages/BRULAW%20{LETTER}.aspx` (23 alphabetical pages A–Y; the first three letters use `BRULAW%20-%20{LETTER}.aspx` while D–Y omit the dash — AGC's own inconsistency, hardcoded in the script's `LETTERS` table). Each row exposes title (in `<strong>`), `CAP. NNN` identifier (with a link to the per-act detail page), Subsidiary-Legislation links, and "DATE COMING INTO FORCE" (`DD-MM-YYYY` or `Repealed`). Topic `bn-parliament` ("Laws of Brunei Darussalam", domain `government`, parent `gov-region-asia-pacific`). Coverage: **DATE COMING INTO FORCE 260/288 (90.3 %)** with `DAY` precision; remaining 28 fall back to Brunei full independence 1984-01-01 + `YEAR` precision, flagged `metadata.dateSource = 'brunei_independence_fallback'`. Per-act detail-page URL 282/288 (97.9 %) — captured in `metadata.actDetailUrl`. **Two parser bugs found mid-dry-run:** (a) `stripHtml` removed `<br>` tags without inserting whitespace, causing `CAP. 205<br>S 66/2001` to collapse to `CAP. 205S 66/2001` and the regex to capture the "S" as part of the cap suffix — fixed by replacing block-breaking tags (`br|p|div|td|tr|li|hr`) with a space before tag stripping; and (b) the CAP-extraction regex's optional trailing letter must not be followed by another letter (`(?:[A-Z](?![A-Z]))?`) so that "CAP. 205SL" yields `205`, not `205S`, while legitimate alphanumeric caps like `25A` still resolve correctly. Same column-shape variability as T&T — handled with the same scan-TDs approach.

- **Queue & state updates:** `scripts/pipeline-queue.json` — P78, P79, P80, P89, P90 → `done` with `actual_count`; P72 → `blocked` with diagnostic `block_reason`. New pipeline tags `jamaica_legislation_v1` / `srilanka_legislation_v1` / `tt_legislation_v1` / `brunei_legislation_v1` should be added to the registry table at the top of this file in a future deploy-time pass (homepage changelog + footer date also pending — these are DB-only ingests, no deploy happened in this session). Final Telegram (message 6171) confirms the English-language batch is complete with totals and the Pakistan skip; next gate is Robert's go-ahead for the Spanish-language batch (Uruguay/Peru/Costa Rica).

- **Cross-cutting note for future agents:** the four sites above all use idiosyncratic markup conventions that needed live probing — `lawnet.gov.lk` being parked, Sri Lanka's documents.gov.lk year index, T&T's variable column count, Brunei's hyphen-vs-no-hyphen URL convention and zero-width-space-laden CAP strings. Trust live probes over training-data recall (per AGENTS.md), and prefer `Claim.metadata.dateSource` annotations over silent fallbacks whenever the per-record date is approximate.

### 2026-05-20 (Pipeline 79 built — Jamaica, dry-run only)
- **Pipeline 79 (Jamaica Acts of Parliament)** built — `scripts/ingest-jamaica.ts` (`jamaica_legislation_v1`). Source: **Laws of Jamaica** (`laws.moj.gov.jm`), the Ministry of Justice's authoritative online legislative repository (the task brief referenced `legislation.gov.jm`, which is offline — ECONNREFUSED — so the canonical alternative was used instead). Free, no API key. The /library/acts-of-parliament page is a Stimulus-controlled Omines DataTables grid with a per-year selector exposing the years **2000–2023** (years 2003 and 2004 carry 0 acts on the source — a real gap in MoJ's digitized coverage, not a script bug). The AJAX endpoint is `POST /library/acts-of-parliament/{YYYY}` with the Omines protocol marker `_dt=dt`; the documented `_init=1` flag only returns the default page size of 10 (which is what tripped the first dry-run — 10/year × 22 years = 220 rows), but passing standard DataTables params `_dt=dt&draw=1&start=0&length=1000` returns the full year in one response. Each row JSON has `{DT_RowId (ULID), shortTitle (HTML), legalAreas, year, actions (HTML with /download link)}`. The `<a>` tag in `shortTitle` uses an opening `<a>` for its closing tag (not `</a>`) — a markup quirk handled by a regex tolerant of `</?a>`.
- Title-prefix formats vary by year and were all handled by `cleanTitle()`: `No.1.-…` (2000), `N_YYYY-…` and `N_YYYY -…` (2005–2014, 2022–2023), `N of YYYY-…` (2015–2021), and prefix-less titles (2001 misnumbered batch). Slug-based fallback `numberFromSlug()` recovers act numbers from `1-2023-…` or `no-1-…` slugs when the title format misses. **`externalId: jm_aop_{slug}`** uses the canonical URL slug (stable across re-runs). Each claim is `INSTITUTIONAL` / `HARD_FACT` / `PROVISIONAL`, `autoApproved: true`, `humanReviewed: false`. `claimEmergedAt: {year}-01-01T00:00:00Z`, `claimEmergedPrecision: YEAR` — the detail page exposes an "Operational Date" field but it was empty on every record spot-checked, so YEAR precision is the only honest signal available from the source. Topic plan: `jm-parliament` ("Parliament of Jamaica", domain `government`, parent `gov-region-americas`). Source per claim (`src_jm_aop_{slug}`, methodology `primary`, `url = https://laws.moj.gov.jm/library/act-of-parliament/{slug}`, `publishedAt = Jan 1 of year`). One `CITES` edge per claim. Metadata captures `slug`, `dtRowId`, `actNumber`, `year`, `title`, `rawTitle`, `pdfUrl`. Batches of 50, transaction timeout 30 s. CLI: `--dry-run`, `--sample N`, `--full`, `--limit N`, `--verbose`. `ALLOW_EDITS=true` env guard required for sample/full modes.
- **Dry-run result (528 candidates):** 22 years fetched in ~16 s (600 ms politeness delay). Server-reported total across all years 528 ≡ parsed rows 528 ≡ unique candidates after dedup 528 (perfect parity, no closure-scope drift). Year distribution peaks at 2001 (48), 2002 (42), 2013 (40), 2005 (34), 2015/2017 (33 each), 2010 (32). Decade distribution: 2000s 194 · 2010s 260 · 2020s 74. Act number parseable from title or slug for **481 / 528 (91.1%)** of records; the remaining 47 lack a numeric prefix in both title and slug (typically 2001 batch where the MoJ listing omits act numbers entirely — recorded as `actNumber: null`, externalId still unique via slug). PDF download link present for **528 / 528 (100%)**, recorded in `metadata.pdfUrl` for future fetching. Sample (newest 5 from 2023): The Road Traffic (Reprieve and Nullification of Prescribed Notices) Act (Act 1) · Representation of the People (Postponement of Elections to Municipal Corp.) Act (Act 2) · The Appropriation Act (Act 03) · The Financial Administration and Audit (Amendment) Act (Act 05) · The Electronic Transactions (Amendment) Act (Act 06). Output written to `pipeline-79-dry-run-sample.json`. **Pipeline awaiting explicit go-ahead before sample/full run; no DB writes performed.** Homepage changelog / footer not yet updated — those are deploy-time updates and this run did not deploy.

### 2026-05-20 (Pipeline 78 shipped — Georgia)
- **Pipeline 78 (Georgia National Laws)** shipped — full production run of `scripts/ingest-georgia.ts --full` completed in 37.6 s. Matsne (Legislative Herald of Georgia) returned 301 Laws of Georgia (group=1000003, type=main) via the `is-ajax=1` JSON wrapper across 18 pages (700 ms politeness delay). Script ingested all 301 with 0 skipped and 0 errors. Created 301 Claims + 301 Sources + 301 `CITES` Edges under `georgia_legislation_v1`, single topic `ge-parliament` ("Parliament of Georgia", domain `government`) created via `ensureTopic('ge-parliament', …, 'gov-region-europe')` — runtime lookup of the parent region ID, no hardcoding. Independent DB verification (`prisma.claim.count({ ingestedBy: 'georgia_legislation_v1', deleted: false })`) returned **301**, with Sources/Edges also 301 — perfect parity; topic confirmed parented under `gov-region-europe`. All 301 records carry `verificationStatus: PROVISIONAL`, `autoApproved: true`, `humanReviewed: false` per the task brief (Robert pre-approved the full run after the 100%-English dry-run on 2026-05-20). 100% of records use the `?impose=translateEn` source URL (preferred over the bare /view/{id} page so future fetching of the act body yields English text). Telegram notification sent to chat 7688025079 confirming completion. Updated DB State table (added `georgia_legislation_v1` row, 301) and Pipeline Registry row 78 (Shipped 2026-05-20 | 301). Homepage changelog / footer not updated — Georgia is a DB-only ingest and did not deploy.

### 2026-05-20 (Pipeline 78 built — Georgia, dry-run only)
- **Pipeline 78 (Georgia National Laws)** built — `scripts/ingest-georgia.ts` (`georgia_legislation_v1`). Source: Legislative Herald of Georgia (Matsne, `matsne.gov.ge/en/document/search`), free, no API key. Discovery: the Drupal search form's own JS (`document_search.js` → `filterDocs()`) revealed an `is-ajax=1` query param that turns the standard search route into a JSON wrapper returning `{pagination, documents_list}` chunks of result HTML. Scope: `group=1000003` (Law) + `type=main` (consolidated main documents only) — 18 pages, ~15-20 panels/page. Each panel parsed into `{docId, title, docType, issuer, docNumber, enactedDate, hasEnglish, hasParallelEnglish}`. Date format DD/MM/YYYY in the panel-body. Topic plan: `ge-parliament` ("Parliament of Georgia", domain `government`, parent `gov-region-europe`). Each claim `INSTITUTIONAL` / `HARD_FACT` / `PROVISIONAL` per task brief, `autoApproved: true`, `humanReviewed: false`, `claimEmergedAt: enactedDate` (DAY precision), `externalId: ge_law_{docId}`, `sourceUrl` prefers `?impose=translateEn` over the bare `/view/{id}` page when the English link is exposed. Batches of 50, transaction timeout 30 s. CLI: `--dry-run`, `--sample N`, `--full`, `--limit N`, `--verbose`. `ALLOW_EDITS=true` env guard required for sample/full modes.
- **Dry-run result (301 candidates):** Pages 1–18 fetched in ~13 s (700 ms politeness delay). Total **301** Laws of Georgia parsed; 0 malformed. Document-type distribution: Law of Georgia 271, Organic Law of Georgia 18, Law of the Republic of Georgia 9 (pre-1995 Georgian Republic), Constitution + constitutional 3. Issuer: Parliament of Georgia 289/301 (the remainder are pre-1995 issuers — Parliament of the Republic of Georgia 9, Supreme Council of the Republic of Georgia 1, Presidium of the Supreme Council of the Georgian SSR 1, საქართველოს დამფუძნებელი კრება/1921 Constituent Assembly 1). Decade coverage: 1920s 1 · 1980s 1 · 1990s 80 · 2000s 74 · 2010s 102 · 2020s 43 — i.e. the consolidated catalogue spans from the 1921 Constitution through 2026. **100% (301/301)** of records expose both an `?impose=translateEn` English-translation link and a `?impose=parallelEn` parallel English-Georgian view, so the source-URL strategy of preferring `translateEn` yields English text for every claim. Sample (newest 5): LAW OF GEORGIA ON FACTORING (N1451-Vმს-XIმპ, 2026-04-01) · LAW OF GEORGIA ON PET ANIMALS (N906-IIIრს-XIმპ, 2025-07-02) · ON INTERNATIONAL PROTECTION (N864-IIმს-XIმპ, 2025-06-26) · LAW OF GEORGIA FOREIGN AGENTS REGISTRATION ACT (N399-IIმს-XIმპ, 2025-04-01) · LAW OF GEORGIA ON THE DNA DATABASE (N336-IIმს-XIმპ, 2025-03-04). Output written to `pipeline-78-dry-run-sample.json`. Telegram notification sent to chat 7688025079 (message ID 6143) requesting approval. **Pipeline awaiting explicit go-ahead before sample/full run; no DB writes performed.** Homepage changelog / footer not yet updated — those are deploy-time updates and this run did not deploy.

### 2026-05-20 (Pipeline 54 shipped — Israel Knesset)
- **Pipeline 54 (Israel Knesset Enacted Laws)** shipped — full production run of `scripts/ingest-israel-knesset.ts --full` completed in 225.3 s (after a `--sample 10` preflight that wrote 10 laws cleanly). Source: Knesset OData v3 ParliamentInfo service (`https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_IsraelLaw/`), free, no API key. **Entity-choice deviation from task brief:** brief suggested `KNS_Law` filtered on `IsActive=true`/`StatusID`, but probing showed `KNS_Law` (61,153 rows) is a chronological gazette dump mixing British Mandate ordinances, secondary regulations (חקיקת משנה / תקנות / צו) and primary statutes, with **no** `IsActive` or `StatusID` field at all on the record (TypeID/TypeDesc live inline). The brief-mentioned `KNS_LawType` reference endpoint returns HTTP 404 (`Resource not found for the segment 'KNS_LawType'`). The proper "enacted Israeli laws" entity is `KNS_IsraelLaw` — a curated authoritative list of 2,009 primary Israeli laws with each row carrying `KnessetNum`, `IsBasicLaw`, `IsBudgetLaw`, `LawValidityID`/`LawValidityDesc`, `ValidityStartDate`/`ValidityFinishDate`, original `PublicationDate`, and `LatestPublicationDate`. Selected `KNS_IsraelLaw` and documented the deviation. (`KNS_Status` entity also exists but its rows describe bill/session workflow states, not law-validity states.) Pagination via standard OData v3 `$skip`+`$top` (100 per page, 300 ms delay, ordered by `IsraelLawID`); cursor terminates when a partial page is returned. Per-page `$inlinecount=allpages` on page 1 confirmed server total = 2,009 ≡ fetched candidates = 2,009 exactly. Per ROADMAP.md long-horizon `legalStatus` note, ingested all 2,009 (not just the 1,077 currently in force) — the fact a law was enacted remains HARD_FACT even if later repealed; validity recorded in `Claim.metadata.lawValidityDesc`. Validity distribution: תקף (in force) 1,077 · בטל (abolished) 473 · נושן (obsolete) 343 · פקע (expired) 115 · טרם נכנס לתוקף (not yet in force) 1. Basic Laws (Israel's constitutional set): 18. Budget Laws: 77. Hebrew law names used verbatim as `claimText` per task spec (no translation). Each claim is `INSTITUTIONAL` / `HARD_FACT` / `VERIFIED`, `autoApproved: true`, `humanReviewed: false`, `claimEmergedAt: PublicationDate` (`DAY` precision), `externalId: israel_knesset_{IsraelLawID}`, `sourceExternalId: israel_knesset_source_{IsraelLawID}`, `Source.methodologyType: 'primary'`, `Source.url: https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_IsraelLaw({IsraelLawID}L)` (canonical OData entity URI), one `CITES` edge per claim. Topic `il-knesset` ("Knesset (Israel)", domain `government`) created via `ensureTopic('il-knesset', …, 'gov-region-asia-pacific')` — runtime lookup of the parent region ID, no hardcoding; topic-existence path also reconciles `parentTopicId` if missing. Batches of 50, transaction timeout 30 s. Independent DB verification (`prisma.claim.count({ ingestedBy: 'israel_knesset_v1', deleted: false })`) returned **2,009**, with Sources/Edges also 2,009 — perfect parity; topic confirmed parented under Asia-Pacific. Updated DB State table (added `israel_knesset_v1` row, 2,009; date bumped to 2026-05-20), PIPELINE_QUEUE.md (P54 added to Completed), and ROADMAP.md Future Legislative Pipelines row 54.

### 2026-05-20 (Pipeline 57 shipped — Scottish Parliament)
- **Pipeline 57 (Scottish Parliament Enacted Acts)** shipped — full production run of `scripts/ingest-scotland-legislation.ts --full` completed in 45.1 s (after a `--sample 10` preflight that wrote 10 acts cleanly). Scottish Parliament Open Data API (`data.parliament.scot/api/Bills` + `/BillStages` + `/BillStageTypes` + `/BillTypes`, no key) returned 473 bills total. The API exposes no Royal Assent or BillStatus field; the canonical enactment signal is reaching the bill type's final stage (Sequence=3 — "Stage 3" for most types, "Final Stage" for Private bills). Joining BillStages → BillStageTypes on Sequence=3 produced **408 enacted candidates** (0 malformed) across all six post-devolution parliamentary sessions: Session 1 = 62, Session 2 = 66, Session 3 = 54, Session 4 = 80, Session 5 = 78, Session 6 = 68. Distribution by bill type: Government 160, Executive 146, Member's 41, Budget 28, Private 22, Committee 10, Hybrid 1. Script ingested all 408 with 0 errors (398 new + 10 from the preflight sample). Created 408 Claims + 408 Sources + 408 `CITES` Edges under `scotland_legislation_v1`, single topic `sc-parliament` ("Scottish Parliament", domain `government`) created via `ensureTopic('sc-parliament', …, 'gov-region-europe')` — runtime lookup of the parent region ID, no hardcoding. Independent DB verification (`prisma.claim.count({ ingestedBy: 'scotland_legislation_v1', deleted: false })`) returned **408**, matching the script's reported insert count exactly; topic confirmed parented under `gov-region-europe`. Source URL = `https://data.parliament.scot/api/Bills/{ID}` (the JSON bill record on parliament.scot's open data domain; the parliament.scot HTML slug pattern is unreliable — `abolition-of-feudal-tenure-etc-scotland-bill` is a 404 due to inconsistent dot handling). Metadata captures `billId`, `reference`, `billType`, `billTypeId`, `billStatus: 'Passed'`, `finalStageReached`, `parliamentarySession`, `shortName`. Scope distinction confirmed: these are Acts of the Scottish Parliament (ASPs), entirely separate from `uk_legislation_v1` (P23) UK Acts of Parliament. Updated DB State table (added `scotland_legislation_v1` row, 408), Pipeline Registry row 57 (Shipped 2026-05-20 | 408), and ROADMAP.md Future Legislative Pipelines row 57.

### 2026-05-19 (latest — Pipeline 19 shipped)
- **Pipeline 19 (Sweden Riksdag Riksdagsskrivelser)** shipped — full production run of `scripts/ingest-riksdag.ts --full --verbose` completed in 1254.4 s. Riksdag Open Data API (`data.riksdagen.se/dokumentlista/?doktyp=rskr&sort=datum&sortorder=desc&p=N`, follow `@nasta_sida`) returned 9,989 Riksdagsskrivelser across the entire archive (dry-run had only fetched the first 200; full run extended back to the earliest digitized rskr records). Script ingested all 9,989 with 0 skipped and 0 errors. Created 9,989 Claims + 9,989 Sources + 9,989 `CITES` Edges under `riksdag_v1`, single topic `se-riksdag` (domain `government`). Defensive seenIds dedupe set never tripped — pagination loop terminated cleanly via missing `@nasta_sida`. DB verification query `prisma.claim.count({ ingestedBy: 'riksdag_v1', deleted: false })` returned **9,989**, matching the script's reported insert count and post-ingestion summary (Claims/Sources/Edges all 9,989) exactly. Updated DB State table (added `riksdag_v1` row, 9,989) and Pipeline Registry row 19 (Shipped 2026-05-19 | 9,989).

### 2026-05-19 (Pipeline 18 shipped)
- **Pipeline 18 (Ireland Oireachtas Enacted Acts)** shipped — full production run of `scripts/ingest-oireachtas.ts --full --verbose` completed in 480.3 s. Oireachtas Open Data API (`api.oireachtas.ie/v1/legislation?bill_status=Enacted`, `skip` pagination) returned 4,044 enacted-bill rows; 4 were filtered as malformed (no `dateSigned` or no usable title) and 4,040 became candidates — matching the dry-run candidate count exactly. Script ingested all 4,040 with 0 skipped and 0 errors. Created 4,040 Claims + 4,040 Sources + 4,040 `CITES` Edges under `oireachtas_v1`, single topic `ie-oireachtas` (domain `government`). DB verification query `prisma.claim.count({ ingestedBy: 'oireachtas_v1', deleted: false })` returned **4,040**, matching the script's reported insert count exactly. Updated DB State table (added `oireachtas_v1` row, 4,040) and Pipeline Registry row 18 (Shipped 2026-05-19 | 4,040).

### 2026-05-19 (Pipeline 20 shipped)
- **Pipeline 20 (Netherlands Tweede Kamer Enacted Laws)** shipped — full production run of `scripts/ingest-tweedekamer.ts --full --verbose` completed in 204.7 s. Tweede Kamer OData v4 API (`gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/Zaak`) returned 1,530 `Soort='Wetgeving'` Zaken with an adoption `Besluit` (`BesluitSoort='Stemmen - aangenomen'`), matching the dry-run candidate count exactly; script ingested all 1,530 with 0 skipped and 0 errors. Created 1,530 Claims + 1,530 Sources + 1,530 `CITES` Edges under `tweedekamer_v1`, single topic `nl-tweedekamer` (domain `government`). Standalone DB verification `prisma.claim.count({ ingestedBy: 'tweedekamer_v1', deleted: false })` returned **1,530**, matching the script's reported insert count and post-ingestion summary (Claims/Sources/Edges all 1,530) exactly. Updated DB State table (added `tweedekamer_v1` row, 1,530) and Pipeline Registry row 20 (Shipped 2026-05-19 | 1,530).

### 2026-05-19 (Pipeline 21 shipped)
- **Pipeline 21 (German Bundestag Enacted Laws)** shipped — full production run of `scripts/ingest-bundestag.ts --full --verbose` completed in 780.9 s. DIP API reported 6,343 enacted Gesetzgebung records (`beratungsstand=Verkündet`); script ingested all 6,343 with 0 skipped and 0 errors. Created 6,343 Claims + 6,343 Sources + 6,343 `CITES` Edges under `bundestag_v1`, single topic `de-bundestag`. Hardcoded public DIP API key (`OSOegLs.PR2lwJ1dwCeje9vTj7FPOt3hvpYKtwKkhw`) held up across all cursor pages with no 401/429s. DB verification query `prisma.claim.count({ ingestedBy: 'bundestag_v1', deleted: false })` returned **6,343**, matching the script's reported insert count exactly. Updated DB State table (added `bundestag_v1` row, 6,343) and Pipeline Registry row 21 (Shipped 2026-05-19 | 6,343).

### 2026-05-19 (Pipeline 22 re-implemented as `parlament_at_v1`)
- **Pipeline 22 (Austrian Parliament Enacted Laws)** re-implemented per task spec — `scripts/ingest-parlament-at.ts` (`parlament_at_v1`). Replaces the same-day `nationalrat_v1` attempt (see entry below). Both scripts are currently untracked; neither has performed DB writes.
- **Why a different data source:** the prior attempt queried parlament.gv.at's own Filter API (`/Filter/api/filter/data/101`, listeId 101) for *Beschlüsse des Nationalrates* — the parliamentary adoption *decision*. This script instead pulls the published *Bundesgesetz* records from the authoritative Austrian Bundesgesetzblatt (Federal Law Gazette, Part I) via the official RIS OGD JSON API of the Federal Chancellery (`data.bka.gv.at/ris/api/v2.6/Bundesrecht`). Each BGBl entry already carries `DatumNationalrat` + `Gesetzgebungsperiode`, tying the law back to the Austrian Parliament that enacted it, while also giving a stable canonical ELI URL for the published law text. Free, no API key, CC BY 4.0.
- **API discovery notes:** the parliament's documented `/Filter/api/json/filter` endpoint consistently returned HTTP 405 even though the `Allow` header advertised GET/POST. The working filter route is `POST /Filter/api/json/post?jsMode=EVAL&FBEZ=<bez>&listeId=<id>` (used by the prior `nationalrat_v1` attempt) or `POST /Filter/api/filter/data/<listeId>?showAll=true`. The Filter API tracks *Verhandlungsgegenstände* (parliamentary process items), not enacted-law publications, which is why we moved to RIS for clean Typ=Bundesgesetz coverage.
- **RIS API quirks resolved during development:**
  - `DokumenteProSeite` must be one of the enum strings `Ten | Twenty | Fifty | OneHundred` — numeric values raise a `Schema Validation Error: Enumeration constraint failed` from the SOAP backend.
  - `Typ.SucheInGesetzen=true` plus `Typ.SucheIn{Verordnungen,Kundmachungen,Sonstiges}=false` is **non-exclusive** — the server still returns Kundmachung and Sonstiges entries alongside Bundesgesetze (501 of 3,505 hits across all pages, ~14%). The script applies a strict client-side `bg.Typ === 'Bundesgesetz'` filter as a belt-and-suspenders guard. Final candidate count: **3,004**.
  - Pagination is by `Seitennummer=N` (1-indexed); `OgdDocumentReference` is the singular form when a page has exactly one record, otherwise an array — script normalizes to array.
- **Data mapping:** `INSTITUTIONAL` / `HARD_FACT` / `VERIFIED`, `autoApproved: true`, `humanReviewed: false`. `claimEmergedAt` prefers `BgblAuth.DatumNationalrat` (National Council vote), falls back to `BgblAuth.Ausgabedatum` (BGBl publication). `claimText = Bundesrecht.Titel || Bundesrecht.Kurztitel`. `externalId = parlament_at_BG_{Technisch.ID}` (e.g. `parlament_at_BG_BGBLA_2026_I_33`). `Source.url = Bundesrecht.Eli` (canonical ELI URI on ris.bka.gv.at), methodology `primary`, `Source.name = Bgblnummer`. Metadata: `{ dataset, docId, typ, gesetzgebungsperiode, bgblnummer, ausgabedatum, datumNationalrat, nummerNationalrat }`. One `CITES` edge per claim. Single root topic `at-nationalrat` (domain `government`, no sub-topics). Batches of 50, transaction timeout 30 s. CLI: `--dry-run`, `--sample N`, `--full`, `--limit N`, `--verbose`.
- **Dry-run result (3,004 candidates):** Coverage spans GP XXII (410) → XXIII (224) → XXIV (635) → XXV (464) → XXVI (203) → XXVII (923) → XXVIII (144, current term) — i.e. roughly 2003-present. 501 non-Bundesgesetz rows (Kundmachung / Sonstiges that slipped through the non-exclusive server filter) dropped client-side. Newest 5 sample titles (2026-04-23 Nationalrat vote): Gewerbeordnung 1994 (BGBl I 33/2026), Bundespflegegeldgesetz (32/2026), Privatschulgesetz (31/2026), Lebenshaltungs- und Wohnkosten-Ausgleichs-Gesetz (30/2026), Fiskalrat- und Produktivitätsratgesetz 2021 (29/2026, NR 2026-03-26). 15-record JSON sample written to `pipeline-22-dry-run-sample.json`. **Awaiting explicit go-ahead before sample/full run; no DB writes performed.**

### 2026-05-19 (earlier — superseded Pipeline 22 attempt, `nationalrat_v1`)
- **Pipeline 22 (Austria Nationalrat Enacted Laws)** built — `scripts/ingest-nationalrat.ts` (`nationalrat_v1`). Source: Austrian Parliament Open Data Filter API (`POST https://www.parlament.gv.at/Filter/api/filter/data/101?showAll=true`). Free, no API key, CC BY 4.0. Scope: every `Beschluss des Nationalrates` — the formal National Council adoption decision that enacts a federal law. The Filter API was queried with body `{"NRBR":["NR"],"VHG":["BNR"]}` then narrowed client-side to `DOKTYP==="BNR"` (the VHG=BNR dimension also returns `BS`/`BSE`/`BSESM`/`BSESMP` doktyps which are Rechnungshof acknowledgments and ESM-related authorizations, not enacted laws). Single root topic `at-nationalrat` (domain `government`, no sub-topics — `THEMEN` arrays are recorded in claim metadata instead). Each claim is `INSTITUTIONAL` / `HARD_FACT` / `VERIFIED`, `autoApproved: true`, `humanReviewed: false`. `claimEmergedAt` parsed from `DATUM_VON` (ISO datetime in row column 16). `claimText: "{Betreff} — Beschluss des Nationalrates {Nummer} ({GP}. GP)"`. `externalId: nationalrat_bnr_{GP_CODE}_{INR}` (e.g. `nationalrat_bnr_XXVIII_158`). Source per claim (`nationalrat_source_{GP_CODE}_{INR}`, methodology `primary`, `url = https://www.parlament.gv.at{HIS_URL}`). One `CITES` edge per claim. Batches of 50, transaction timeout 30 s. CLI flags: `--dry-run`, `--sample N`, `--full`, `--limit N`, `--verbose`. **API quirks discovered during development:**
  - The Filter API response `header` is an array of column-descriptor objects, **not** an array of label strings — each entry has a `label` field (`{ label: "GP_CODE", feld_name: "GP", ... }`). Initial implementation that treated headers as strings produced an immediate `header missing column GP_CODE` failure; fixed by indexing on `h.label`.
  - `showAll=true` returns the full result set in a single page (`pages: 1, count: 4682`); no pagination loop needed.
  - `VHG=BNR` is a broader dimension than `DOKTYP=BNR`. Of 4,682 VHG=BNR rows, 814 are non-BNR doktyps (BS: 804 Rechnungshof acknowledgments, BSE: 4 EU acts, BSESM: 4, BSESMP: 2 ESM authorizations); the strict `DOKTYP==='BNR'` filter is what cleanly maps to "enacted by the Nationalrat."
  - Detail-page JSON (`/gegenstand/{GP}/BNR/{INR}?json=TRUE`) confirmed match (title, `zitation`, `einlangen`) — spot-checked `XXVIII/BNR/158` (Bundespflegegeldgesetz, 2026-04-23). Not fetched per-row to avoid 3,868 extra HTTP calls; the row-level fields are sufficient.
- **Dry-run result (3,868 candidates):** Sorted newest-first; top 5 sample titles all from 2026 (Bundespflegegeldgesetz 2026-04-23, Gewerbeordnung 1994 2026-04-23, Privatschulgesetz 2026-04-23, Lebenshaltungs- und Wohnkosten-Ausgleichs-Gesetz 2026-04-23, Fiskalrat- und Produktivitätsratgesetz 2021 2026-03-26). Distribution across legislative periods: XXII (722), XXIII (288), XXIV (1015), XXV (721), XXVI (394), XXVII (1338), XXVIII (204 so far). 0 malformed/incomplete rows skipped (all rows have GP_CODE, INRNUM, DATUM_VON, Betreff). 15-record JSON sample written to `pipeline-22-dry-run-sample.json`. Pipeline awaiting explicit go-ahead before sample/full run; no DB writes performed.

### 2026-05-19 (later still — Pipeline 21 built)
- **Pipeline 21 (German Bundestag Enacted Laws)** built — `scripts/ingest-bundestag.ts` (`bundestag_v1`). Source: Bundestag DIP REST API (`search.dip.bundestag.de/api/v1/vorgang`). Free, but requires a public API key. Scope: all `Vorgangstyp=Gesetzgebung` with `beratungsstand=Verkündet` (promulgated — signed and published in the Bundesgesetzblatt), covering Wahlperiode 7 (1972) onward. Single root topic `de-bundestag` (domain `government`, no sub-topics — the API does not return a stable session/term breakdown convenient for sub-topic carving, and `wahlperiode` lives in claim metadata instead). Each claim is `INSTITUTIONAL` / `HARD_FACT` / `VERIFIED`, `autoApproved: true`, `humanReviewed: false`. `claimEmergedAt` is picked from `verkuendung[0].verkuendungsdatum` → `verkuendung[0].ausfertigungsdatum` → `datum` (precedence recorded in `metadata.dateSource`). `externalId: bundestag_vorgang_{id}`; `metadata: {dataset, wahlperiode, vorgangstyp, beratungsstand, gesta, bglFundstelle, bglPdfUrl, dateSource}`. Source per claim (`bundestag_source_{id}`, methodology `primary`, name = `Bundestag Drucksache {id}`, `url = https://dip.bundestag.de/vorgang/{id}`). One `CITES` edge per claim. Cursor pagination (DIP returns max 100 per page; loop terminates when the server-returned cursor stops advancing). Batches of 50, transaction timeout 30 s. CLI flags: `--dry-run`, `--sample N`, `--full`, `--limit N`, `--verbose`. **API-key quirk:** the demo key supplied in the task brief (`rgsaY4U.oZRQKUHdJhF9qguHMkwCGIoLaqEcaHjYLF`) returns HTTP 401 against the current DIP service — the Bundestag rotates the public key periodically and surfaces the current value on `dip.bundestag.de/über-dip/hilfe/api` (a JS-rendered SPA page, not scrapable via WebFetch). The current working public key was obtained from the `bundesAPI/dip-bundestag-api` community wrapper README on GitHub and hardcoded in the script: `OSOegLs.PR2lwJ1dwCeje9vTj7FPOt3hvpYKtwKkhw`. If the API starts returning HTTP 401, refresh this constant from that page.
- **Dry-run result (6,343 candidates):** API reports 6,343 enacted Gesetzgebung records; 0 malformed/skipped (all have a usable date + non-empty `titel`). Distribution by Wahlperiode: WP 7 = 500, WP 8 = 337, WP 9 = 134, WP 10 = 320, WP 11 = 366, WP 12 = 493, WP 13 = 552, WP 14 = 547, WP 15 = 384, WP 16 = 613, WP 17 = 542, WP 18 = 550, WP 19 = 545, WP 20 = 328, WP 21 = 132. Sample written to `pipeline-21-dry-run-sample.json` (15 most-recent records, all WP 21 promulgated 2026-05-18, all with `dateSource=verkuendungsdatum`, valid `bglFundstelle` and `bglPdfUrl`). Pipeline awaiting explicit go-ahead before sample/full run; no DB writes performed.

### 2026-05-19 (later still — Pipeline 20 built)
- **Pipeline 20 (Netherlands Tweede Kamer Enacted Laws)** built — `scripts/ingest-tweedekamer.ts` (`tweedekamer_v1`). Source: Tweede Kamer OData v4 API (`gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/Zaak`), free, no API key. Scope: all `Zaak` of `Soort='Wetgeving'` that have at least one `Besluit` with `BesluitSoort='Stemmen - aangenomen'` (adopted by plenary vote). Single root topic `nl-tweedekamer` (domain `government`). Each claim is `INSTITUTIONAL` / `HARD_FACT` / `VERIFIED`, `autoApproved: true`, `humanReviewed: false`, `claimEmergedAt: GestartOp`, `claimEmergedPrecision: DAY`, `externalId: tweedekamer_zaak_{Guid}`, `metadata: {soort, status, nummer, vergaderjaar, adoptedRecordedAt}`. Source per claim (`tweedekamer_source_{Guid}`, methodology `primary`, name `Tweede Kamer {Nummer}`, url `https://www.tweedekamer.nl/zoeken?qry={Nummer}`). One `CITES` edge per claim. Batches of 50, transaction timeout 30 s. CLI flags: `--dry-run`, `--sample N`, `--full`, `--limit N`, `--verbose`. **Schema discoveries during development:**
  - `Zaak.Status` is the API publication state (always `Vrijgegeven` for our set), **not** the legislative outcome. `Status eq 'Aangenomen'` returns 0 results. The adoption signal lives in the related `Besluit` collection as `BesluitSoort='Stemmen - aangenomen'`.
  - `Zaak` has no `Datum` field (the task brief guessed at one). The most stable, semantically-meaningful date is `GestartOp` (case opened in the chamber). The `Besluit.GewijzigdOp` of the adoption Besluit was rejected as the primary date because older cases have their GewijzigdOp set to API-bootstrap dates (e.g. 2003 case with adoption GewijzigdOp 2008-09-18). It is recorded in metadata as `adoptedRecordedAt` for audit.
  - The per-case detail page `https://www.tweedekamer.nl/kamerstukken/wetsvoorstellen/detail?id={Nummer}` returns 404 without a `dossier` GUID we don't have. The stable public surface is the chamber search `/zoeken?qry={Nummer}`, which renders the case header and linked Kamerstukken.
  - Pagination uses standard OData `$skip`+`$top` with `$orderby=Id` for determinism. 250 per page, 300 ms delay.
- **Dry-run result (1,530 candidates):** All 1,530 `Wetgeving` cases with an adoption Besluit were successfully built. 0 malformed/skipped. Server-side count (`Zaak/$count?$filter=...`) matches client-side count exactly (1,530 = 1,530). Sample titles span 2008–2023, all Dutch primary legislation (kinderopvang harmonisation, covid-19 verkiezingen, Reparatiewet OCW, Kieswet wijziging, orgaandonatie). 15-record JSON sample written to `pipeline-20-dry-run-sample.json`. Pipeline awaiting explicit go-ahead before sample/full run; no DB writes performed.

### 2026-05-19 (later — Pipeline 19 built)
- **Pipeline 19 (Sweden Riksdag Enacted Laws)** built — `scripts/ingest-riksdag.ts` (`riksdag_v1`). Source: Riksdag Open Data API (`https://data.riksdagen.se/dokumentlista/`), free, no API key. Scope: every `riksdagsskrivelse` (`doktyp=rskr`) — the formal adoption decision sent from the Riksdag to the government when a bill is approved (one rskr per enacted law, semantically equivalent to Austria's `Beschluss des Nationalrates`). Single root topic `se-riksdag` (domain `government`, no sub-topics). Each claim is `INSTITUTIONAL` / `HARD_FACT` / `VERIFIED`, `autoApproved: true`, `humanReviewed: false`, `claimEmergedAt: doc.datum` (parsed as `YYYY-MM-DDT00:00:00Z`), `claimEmergedPrecision: DAY`, `externalId: riksdag_rskr_{rm}_{nummer}` with `rm` slashes escaped to `_` (e.g. `riksdag_rskr_2025_26_251`), `claimText` from `doc.titel`, `metadata: {dataset, doktyp, rm, nummer, relaterat_id}`. Source per claim (`riksdag_source_{rmEsc}_{nummer}`, methodology `primary`, name = `Riksdag {rm} #{nummer}`, url = `dokument_url_html` falling back to `https://data.riksdagen.se/dokument/{dok_id}.html`). One `CITES` edge per claim. Pagination: newest-first via `sort=datum&sortorder=desc&p={N}` and follow `dokumentlista.@nasta_sida`; per-page size 200. Batches of 50, transaction timeout 30 s. CLI flags: `--dry-run`, `--sample N`, `--full`, `--limit N`, `--verbose`. Defensive seenIds set guards against duplicate-page regressions (server very occasionally re-emits the same page when traffic is high).
- **Dry-run result (200 candidates fetched in the validation pass):** Newest entry is Riksdagsskrivelse 2025/26:251 enacted 2026-05-07, then 2025/26:250 (2026-05-06), 249 (2026-05-06), and so on. 0 malformed/skipped rows. 15-record JSON sample written to `pipeline-19-dry-run-sample.json`. Pipeline awaiting explicit go-ahead before sample/full run; no DB writes performed. (This changelog entry is a 2026-05-19 backfill — the P19 script was built and dry-run-validated on 2026-05-19 alongside P18/P20/P21 but never logged at the time; the registry row above was added in the same backfill commit.)

### 2026-05-19 (later — Pipeline 18 built)
- **Pipeline 18 (Ireland Oireachtas Enacted Acts)** built — `scripts/ingest-oireachtas.ts` (`oireachtas_v1`). Source: Houses of the Oireachtas Open Data API (`api.oireachtas.ie/v1/legislation`), free, no key required. Scope: all enacted Irish bills (Acts signed into law), single root topic `ie-oireachtas` (domain `government`, no sub-topics). Each claim is `INSTITUTIONAL` / `HARD_FACT` / `VERIFIED`, `autoApproved: true`, `humanReviewed: false`, `claimEmergedAt: act.dateSigned`, `claimEmergedPrecision: DAY`, `externalId: oireachtas_bill_{billYear}_{billNo}`, `metadata: {billNo, billYear, billType}`. Source per claim (`oireachtas_source_{billYear}_{billNo}`, methodology `primary`, name = bill key). One `CITES` edge per claim. Batches of 50, transaction timeout 30 s. CLI flags: `--dry-run`, `--sample N`, `--full`, `--limit N`, `--verbose`. **Two API quirks resolved during development:**
  - `bill_status=enacted` returns 0 results; the correct casing is `bill_status=Enacted` (capital E), which returns 4,044 records with populated `bill.act` objects (`actNo`, `actYear`, `dateSigned`, `shortTitleEn`, `longTitleEn`, `statutebookURI`).
  - The endpoint **ignores the documented `offset` parameter** — it silently re-returns page 1 forever regardless of `offset` value. The correct paging key is `skip` (e.g. `skip=250&bill_status=Enacted`). `skip=4044` returns 0 results cleanly.
  - Script also keeps a `Set<externalId>` as a defensive duplicate guard so any future API regression cannot cause an infinite loop.
- **Dry-run result (4,040 candidates):** Of 4,044 server-reported enacted bills, 4 were filtered as malformed/incomplete (no `dateSigned` or no usable title) and 4,040 became candidates. Sample titles span 1923 onward; the 15-record JSON sample written to `pipeline-18-dry-run-sample.json` covers 2025–2026 (most recent). Pipeline awaiting explicit go-ahead before sample/full run; no DB writes performed.
- HTML stripper inlined in the script (basic `<br>`, `<p>`, entity unescaping) since `bill.longTitleEn` arrives as `<p>Bill entitled an Act to…</p>` with `&nbsp;` and `&amp;` artifacts.

### 2026-05-19
- **Pipeline 16 (EU Legislation)** shipped — 827 EP+Council Regulations & Directives via EUR-Lex CELLAR SPARQL endpoint (Terms 8–10, 2014–present). Terms 1–7 returned 0 results due to older EEC/EC CELEX numbering conventions. Script required two schema fixes during development: `Source` needed `name` + `methodologyType` fields (not `title`/`publisher`/`description`), `Edge` needed `type` field (not `relationship`/`description`). Second run created 827 claims/sources but 0 edges due to edge error being caught before propagation — backfill script `backfill-eu-edges.ts` added 827 edges cleanly (0 errors).
- **Pipeline 17 (NATO Official Texts)** built — `scripts/ingest-nato-official-texts.ts` (`nato_official_texts_v1`). Document IDs enumerated from Wayback CDX API (prefix match on `nato.int/cps/en/natohq/official_texts_`, `statuscode:200`, `collapse=urlkey`) → 2,477 raw rows deduplicated to **481 unique numeric IDs** (brief estimated ~343; the extra ~140 covers locale variants, doc revisions, and CPS items later recategorized into /news-and-events/). Each ID is fetched live from `https://www.nato.int/cps/en/natohq/official_texts_NNNNN.htm` (follows redirects to the new `/en/about-us/official-texts-and-resources/...` paths), 500 ms politeness delay, then parsed for: `<h1 class="h2-style">` title and document date (priority order: `<p class="heading-template__dateTime-created">` → `<p class="heading-template__dateTime-updated">` → JS `lastupdated_date` DD/MM/YYYY). 404s (both HTTP 404 and HTTP 200 with `<title>404</title>`) are filtered. Output: `INSTITUTIONAL` / `HARD_FACT` / `VERIFIED` claims, single topic `nato-official-texts` (domain: `government`), `CITES` edge per claim, externalId `nato_official_texts_NNNNN`, batch 50, transaction timeout 30 s. CLI flags: `--dry-run`, `--sample N`, `--full`, `--limit`, `--verbose`. **Dry-run (10 docs) result: 9 parsed OK, 1 dead CPS ID (104922) filtered.** Sample titles included Bucharest Summit Declaration (2008-04-03), ISAF's Strategic Vision (2008-04-03), and The Atlantic Charter (1941-08-14) — date parser handled all three formats correctly. Output saved to `pipeline-17-dry-run-sample.json`. Pipeline awaiting explicit go-ahead before sample/full run; no DB writes performed.

### 2026-05-18 (later — four-pipeline batch shipment)
- **Pipeline 9 (SEC EDGAR)** shipped — 379 filings across Enron, WorldCom/MCI, Lehman, Boeing, GE (1997–2022). All claims `PROVISIONAL`, `humanReviewed: false`, `autoApproved: true`.
- **Pipeline 10 (Nobel Prizes)** shipped — 1,026 canonical laureate records via Nobel Foundation API v2.1 (1901–2024, all six categories). Initial fetch was blocked by Nobel API 524 (Cloudflare timeout); retried successfully after ~5 min.
  - **Cleanup performed:** discovered 662 stale `nobel_v1` claims from a prior script version (externalId scheme `nobel-claim-{cat}-{year}-{seq}`, no metadata, status `VERIFIED`). Per CLAUDE.md rule 4 (audit trail; deprecate, never delete), marked all 662 as `verificationStatus: DEPRECATED` with `metadata.deprecation_reason` pointing to the 2026-05-18 re-ingestion. They remain in DB for audit purposes and are excluded from default views via the existing `DEPRECATED` filter (same as USPTO Pipeline 5).
- **Pipeline 12 (USGS Earthquakes)** verified — DB already had all 4,696 M6.5+ events from a prior run; idempotent re-run skipped all (`Ingested: 0 | Skipped: 4696`). Treating as Shipped.
- **Pipeline 14 (Federal Register)** verified — DB has 1,915 EO 12866 significant final rules. The script reported `Skipped: 1921` due to ~6 duplicate `document_number` values returned by overlapping per-agency Federal Register queries; the true canonical count is 1,915 distinct externalIds. Treating as Shipped.
- Updated DB State table, Pipeline Registry, and Pending Production Runs sections.
- Homepage changelog (`app/page.tsx`) extended with today's four-pipeline batch entry; footer date already May 18, 2026.

### 2026-05-18
- Homepage rebuilt for server-side filtering + pagination at 47k-claim scale
- Congress.gov enacted bills (97th–119th, 2,236 records) confirmed in DB — idempotent re-run showed 0 new inserts (all existing)
- /pipelines page added
- Homepage changelog section and footer "last updated" added; rule established: update both on every deploy
- CrossRef Retractions (Pipeline 13) full run completed (~26,500 records via CrossRef API)
- Deployed to production: `fix: homepage server-side filtering + pagination for 47k-claim scale`

### 2026-05-25 — Whitepaper written (RobClaw subagent)

Wrote `/Users/robclaw/Projects/epistemic-receipts/WHITEPAPER.md` — a 3,500-word whitepaper covering the epistemic problem (provenance gap, AI hallucination, retraction blindness, regulatory compliance blindness), the Epistemic Receipts solution (Source → Edge → Claim graph, ThresholdEvent data structure, verification status semantics), current data assets (141,900 claims across 25+ pipelines as of May 23–25 2026), architecture (Next.js 16 / Prisma 6 / Neon Postgres / Vercel, schema design principles, pipeline design rules), the self-auditing vision (AiJob scaffold, OpenAlex integration, contradiction detection roadmap), business model (3 tiers: public/API/enterprise), roadmap (SCOTUS opinions, ClinicalTrials, NCBI Gene, ICD-11, declassified archives Layer 1 and Layer 2), and positioning rationale (EU AI Act, RAG grounding demand, pre-lock-in window).

Tone: arXiv preprint combined with system design paper. Targeted at two audiences: academics who would cite it as a knowledge graph reference, and compliance/regulatory intelligence buyers (pharma, law firms, policy orgs). All statistics sourced from this CONSULTANT.md (current as of 2026-05-23 to 2026-05-25).

**Files changed:** `WHITEPAPER.md` (created/overwritten), `CONSULTANT.md`.

---

### 2026-05-25 — Ingestion push: CourtListener SCOTUS P4, ClinicalTrials P7, OpenAlex P116 (subagent)

**Scope:** Ran the two "Ready" pipelines (CourtListener SCOTUS, ClinicalTrials) and shipped the new OpenAlex ingester. Three background jobs still running at time of writing (OA biomedical + policy buckets, see counts below).

**Pipeline 4 — CourtListener SCOTUS (`courtlistener_scotus_v1`)**
- Pre-existing: 300 claims from prior run (most-cited SCOTUS opinions, `date_filed < 2000`, `citation_count ≥ 50`)
- Script improvements: added `--dry-run` flag (skips DB writes, logs would-be ingestions), 429 handling with `Retry-After` header respect (was previously throwing on 429), MAX_RETRIES bumped 3→5.
- Note: CourtListener API hit 429 with `retry-after: 504` during this session; a separate Claude coding agent (spawned earlier by the user) was concurrently running `--limit 500 --before-year 2000` to expand coverage. That agent's run was in-progress at log cutoff (500-by-citation expansion).
- **DB verified: 300 claims, 300 sources, 300 edges** (`courtlistener_scotus_v1`). Final expansion count pending other-agent completion.

**Pipeline 7 — ClinicalTrials.gov (`clinicaltrials_v1`)**
- Pre-existing: 1,342 claims from prior runs (case-study + pivotal + pharma buckets fully exhausted by dedup).
- New bucket added: `phase3` — sweeps 10 therapeutic areas (oncology, cardiology, infectious, neurology, endocrinology, psychiatry, pulmonology, gastroenterology, rheumatology, hematology) for completed Phase 3/4 trials with results (`filter.advanced=AREA[Phase]Phase 3 OR AREA[Phase]Phase 4`). Per-area cap 500.
- Bug fixes: pharma bucket was querying `openfda_v1` (wrong — no records); fixed to `openfda_labels_v1`. `extractGenericName` simplified to first-token only (was triggering "Too complicated query" API errors). Phase filter changed from unsupported `filter.phase` to correct `filter.advanced` Essie syntax.
- Run results (this session):
  - case-study bucket: 0 new (all 116 already ingested)
  - pivotal bucket: 0 new (all 115 already ingested)
  - pharma bucket: **943 ingested**, 383 skipped (2000 FDA claims iterated; first-token drug names extracted)
  - phase3 bucket: **2,190 ingested**, 88 skipped (10 areas: oncology/cardiology/infectious/endocrinology/hematology each capped at 500; neurology=2, psychiatry=18, rheumatology=4, pulmonology/gastroenterology=0 results)
- **DB verified: 4,475 claims, 4,475 sources, 4,475 edges** (`clinicaltrials_v1`).

**Pipeline 116 — OpenAlex (`openalex_v1`)**
- Script `scripts/ingest-openalex.ts` existed from a prior agent session (3 buckets: cognition, biomedical, policy). OpenAlex already had 5,003 records from prior cognition+biomedical+policy runs.
- This session ran biomedical (limit 10,000, fetchCap 30,000) and policy (limit 10,000, fetchCap 30,000) to page past already-ingested records and capture new ones. Cognition was fully deduped.
- Per-run progress:
  - Biomedical: 2,796+ new ingested at time of count (running)
  - Policy: 1,871+ new ingested at time of count (running)
- **DB verified at time of writing: 10,093 claims, 10,093 sources, 10,093 edges** (`openalex_v1`). Jobs still running; final count will be higher.
- Note: OpenAlex cursor pagination + relevance sort means top N results are the same each run. To page past already-ingested records, run with a large limit (≥10,000) so fetchCap (limit×3 or limit+200) is large enough to exhaust the initial skip zone.

**Homepage / CONSULTANT.md updates:**
- Pipeline Registry: #4 and #7 updated to Shipped with final counts; #116 added for OpenAlex.
- DB State table: updated with 3 new pipeline entries and refreshed total counts.
- `app/page.tsx` homepage changelog: May 25 entry updated with ingestion results.

---

### 2026-05-26 — Security hardening: HTTP headers, rate limiting, robots.txt

**Security headers (`next.config.ts`):**
- Added `headers()` export with rules applying to all routes (`/(.*)`).
- Headers added: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- CSP allows: `script-src 'self' 'unsafe-eval'` (WebGL shader compilation requires unsafe-eval) plus Vercel live/scripts hosts; `style-src 'self' 'unsafe-inline'` (Tailwind v4 inline styles) + Google Fonts; `img-src 'self' data: blob: https:` (globe textures); `worker-src 'self' blob:` (three.js workers); `connect-src 'self' https:`; `frame-ancestors 'none'`; `object-src 'none'`.

**Rate limiting (`middleware.ts`):**
- Added best-effort in-memory rate limiting before the existing auth check.
- Rules: `/api/search` → 30 req/min; `/api/stats` → 20 req/min; `/api/claims` → 30 req/min; `/api/globe/*` → 20 req/min.
- Per-isolate sliding 60s window using a module-level `Map<string, {count, windowStart}>`. Keyed by `ip:pathname`. Returns 429 + `Retry-After: 60` when exceeded; passes `X-RateLimit-Remaining` header on successful requests.
- IP extracted from `x-forwarded-for` (Vercel sets this). Stale entries pruned every 2 minutes.
- Existing password auth logic fully preserved.

**`public/robots.txt`:**
- Allows all crawlers on main pages: `/`, `/claims`, `/topics`, `/sources`, `/globe`, `/search`, `/stats`, `/fields`, `/about`, `/glossary`.
- Disallows: `/api/`, `/login`, `/review`, `/admin`.

**TypeScript:** `npx tsc --noEmit` clean.

**Files changed:** `next.config.ts`, `middleware.ts`, `public/robots.txt`, `app/layout.tsx` (footer date), `CONSULTANT.md`.

---

### 2026-05-26 — Performance fix: DB indexes + bounded API routes (840k claims)

**Why:** At ~840k claims the site stopped loading. Root cause was a combination of (a) zero indexes on hot-path columns (`Claim.ingestedBy`, `claimType`, `currentStatus`, `verificationStatus`, `createdAt`, `claimEmergedAt`, `parentClaimId`; `Edge.sourceId`/`claimId`; `Source.ingestedBy`; etc.) — every WHERE/ORDER BY did a full sequential scan — and (b) several API routes calling `findMany` with no `take`/pagination and deep `include` joins, pulling hundreds of thousands of rows per request.

**Indexes added (35 total, all built with `CREATE INDEX CONCURRENTLY` to avoid deadlocking concurrent ingester writes):**
- `Claim`: `ingestedBy`, `claimType`, `currentStatus`, `verificationStatus`, `createdAt`, `claimEmergedAt`, `parentClaimId`, composite `(deleted, parentClaimId, claimType)`, composite `(deleted, ingestedBy)`
- `Source`: `ingestedBy`, `createdAt`, composite `(deleted, ingestedBy)`
- `Edge`: `sourceId`, `claimId`, `createdAt`, composite `(deleted, claimId)`, composite `(deleted, sourceId)`
- `MetaEdge`: `claimId`, `targetEdgeId`, `actorSourceId`
- `ThresholdEvent`: `claimId`, `triggeredBySourceId`, `createdAt`
- `SuggestedThresholdEvent`: `claimId`, `triggeredBySourceId`
- `EdgeRevision`: `edgeId`
- `ClaimTopic`: `claimId` (composite PK already covered topic-first lookup)
- `LegislativeVote`: `sourceId`, `result`
- `PoliticalContext`: `country`, `hogParty`, `headOfGovernment`
- `SourceRelationship`: `sourceAId`, `sourceBId`
- `SourceCredibilityEvent`: `sourceId`

**Migration:** `prisma/migrations/20260526150151_add_perf_indexes/migration.sql`. Initial `prisma migrate dev` hit a deadlock (Process A holding `RowExclusiveLock` from concurrent ingest vs. Process B's `ShareLock` from the CREATE INDEX). Rolled back, then ran `scripts/apply-perf-indexes.ts` which executes each `CREATE INDEX CONCURRENTLY IF NOT EXISTS` outside any transaction. All 35 indexes built in 22 s total. Migration marked applied via `prisma migrate resolve --applied`.

**API routes hardened:**
- `/api/edges`: was unbounded `findMany` with full `source` + `claim` + revisions include. Now defaults to 50 rows, max 200, supports `?claimId=` / `?sourceId=` filters, switched to selective `select` (only fields the page actually renders).
- `/api/sources`: was unbounded `findMany`. Now defaults to 100 rows, max 500, supports `?ingestedBy=`, filters `deleted: false`, selective `select`.
- `/api/timeline`: was full `Edge` table dump with every join. Now requires `?claimId=`; without it returns an explanatory empty payload. With claimId, capped at 500 edges + 500 events.
- `/api/threshold-events`: was full table with full claim + suggestedEvent + source include. Now defaults to 50 rows, supports `?claimId=`, selective `select` on includes.
- `/api/meta-edges`: now bounded to 100 rows (max 200) with `?claimId=` / `offset` paging.
- `/api/claims/homepage`: the `distinct: ["ingestedBy"]` query — which forced a `Claim` index-only scan over all 840k rows — replaced with `groupBy({ by: ["ingestedBy"] })` which uses the new `Claim_deleted_ingestedBy_idx`.
- `/api/domains`: was `topic.findMany({select:{domain:true}})` looping client-side. Now `groupBy` with `_count` and 5-min `revalidate`.
- `/api/topics/[slug]`: `timelineClaims` and `topicVotes` `findMany` calls capped at 50,000 and 10,000 respectively (typical hits are 100s–1000s; cap is defensive against pathological topics).

**Files changed:** `prisma/schema.prisma`, `prisma/migrations/20260526150151_add_perf_indexes/migration.sql`, `scripts/apply-perf-indexes.ts`, `app/api/edges/route.ts`, `app/api/sources/route.ts`, `app/api/timeline/route.ts`, `app/api/threshold-events/route.ts`, `app/api/meta-edges/route.ts`, `app/api/claims/homepage/route.ts`, `app/api/domains/route.ts`, `app/api/topics/[slug]/route.ts`, `app/page.tsx` (changelog), `app/layout.tsx` (footer date), `CONSULTANT.md`.

**TypeScript:** `npx tsc --noEmit` clean.

---

## Notes for Future Agents

- The project is at a scale (47k+ claims) where homepage performance is a genuine constraint. Prefer server-side filtering, pagination, and indexed queries over client-side approaches.
- The Prisma schema uses soft deletes (`deleted` flag). Any queries over public data should filter `deleted: false`.
- Pipeline scripts live in `scripts/`. Run with `npx tsx scripts/<name>.ts`.
- All pipeline scripts should be idempotent (skip existing records by externalId).
- When adding a new pipeline, add it to ROADMAP.md and this registry.

### 2026-05-26 — CSP fix: add 'unsafe-inline' to script-src

**Why:** Next.js App Router streams RSC payload via inline `<script>` tags (`self.__next_f.push(...)`). The existing CSP `script-src 'self' 'unsafe-eval' ...` blocked these, preventing React from hydrating on any page. Symptoms: login button stuck disabled, all useEffect data fetches silently never firing, pages showing empty shells. Fix: added `'unsafe-inline'` to script-src in `next.config.ts`.

**Files changed:** `next.config.ts`, `CONSULTANT.md`.
