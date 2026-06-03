# CourtListener Ingestion Roadmap

**Status:** Tier 1 fully automated — 4 perpetual loops running • Updated 2026-06-03
**Author:** Subagent audit (read-only research) + RobClaw implementation
**Scope:** CourtListener REST API v4 — what's there, what's already ingested, what to do next.

### Live ingestion state (as of 2026-06-03 14:00 EDT)

All four Tier 1 sources are running as **perpetual background loops** (no cron — true infinite loops with sleep between passes):

| Script | PID | Sleep | Status |
|---|---|---|---|
| `scripts/scotus-loop.sh` | 76976 | 8h | Running since ~12:34pm — citation floor auto-drops 5→2→0 |
| `scripts/circuits-loop.sh` | 74098 | 6h | Running since ~11:02am |
| `scripts/state-supreme-loop.sh` | 79152 | 6h | Started 2:09pm — top 15 states, citation floor 20→10→5→0 |
| `scripts/judges-loop.sh` | 79206 | 12h | Started 2:09pm — Article III appointments, all circuits + SCOTUS |

All use `--slow` mode and are idempotent via `externalId`. Logs at `/tmp/{scotus,circuits,state-supreme,judges}-loop.log`.

**Claim counts at Tier 1 launch:** 873 total (400 SCOTUS + 473 circuits). State supremes and judges starting from 0.

This roadmap follows the reference-tier discipline codified in `AGENTS.md`:

> A dataset is reference-tier (suitable for bulk ingestion) only if individual records will be directly cited by case-study Claims. If only aggregated views or third-party analyses of the dataset will be cited, the dataset is background-tier — link to specific records or analyses as Sources within case studies, do not ingest in bulk.

Each tier item below is scored against that test.

---

## Section 1 — CourtListener Data Inventory

### 1.1 Endpoints exposed by `/api/rest/v4/`

The API root advertises 45 endpoints. Grouped by topic:

| Group | Endpoints |
|---|---|
| **Opinions / case text** | `clusters`, `opinions`, `opinions-cited`, `citation-lookup` |
| **Dockets / case shells** | `dockets`, `docket-entries`, `bankruptcy-information`, `originating-court-information` |
| **PACER / RECAP** | `recap-documents`, `recap`, `recap-email`, `recap-fetch`, `recap-query`, `fjc-integrated-database` |
| **Courts** | `courts`, `parties`, `attorneys` |
| **Judges (`people`)** | `people`, `positions`, `educations`, `schools`, `political-affiliations`, `aba-ratings`, `retention-events`, `sources` |
| **Financial disclosures** | `financial-disclosures`, `agreements`, `debts`, `gifts`, `investments`, `non-investment-incomes`, `disclosure-positions`, `reimbursements`, `spouse-incomes` |
| **Audio / oral argument** | `audio` |
| **Tags / alerts (user-side)** | `tag`, `tags`, `docket-tags`, `alerts`, `docket-alerts`, `memberships`, `prayers` |
| **Visualizations** | `visualizations`, `visualizations/json` |
| **Search** | `search` (Elasticsearch facade) |
| **Scrapers / utility** | `scrapers/scotus-email`, `increment-event` |

### 1.2 Live record counts (queried 2026-06-03)

Counts confirmed against the live API with `?count=on` (rate limit: 5/min on count queries):

| Endpoint | Records |
|---|---|
| `opinions` | **10,785,922** |
| `clusters` | **10,058,697** |
| `positions` (judicial appointments) | **51,291** |
| `people` (judges) | **16,191** |
| `courts` | **3,358** |

`?count=on` for `dockets`, `audio`, `recap-documents`, `docket-entries`, `opinions-cited`, and `financial-disclosures` either returned a deferred Celery job or rate-limit-blocked during this audit. Published Free Law Project figures (cross-check before scripting; do not trust LLM recall — see § 5):

| Endpoint | Approx. records (FLP-reported) |
|---|---|
| `dockets` | ~25 M (RECAP archive + court scrapers) |
| `docket-entries` | hundreds of millions |
| `recap-documents` | 200 M+ PACER filings |
| `opinions-cited` | ~70 M citation edges |
| `audio` | ~93 k oral arguments |
| `financial-disclosures` | ~30 k disclosure forms (covers ~10 k judges 2003–2023) |

### 1.3 Data quality per type

| Type | Quality | Notes |
|---|---|---|
| `clusters` | High | Authoritative bibliographic record per case. `case_name`, `date_filed`, `citation_count`, parallel citations, precedential status. The de facto Claim anchor. |
| `opinions` | High | Cluster-children. Plain text + HTML for the majority, concurrence, and dissent. Use for AI-extracted holdings. |
| `dockets` | Mixed | RECAP-sourced dockets are high quality; scraper-sourced vary. Includes parties, attorneys, judge assignment. |
| `recap-documents` | Mixed | PACER filings (motions, briefs, orders). Most are routine; ~10 % are substantive. |
| `people` | High | All federal Article III judges with full biographies (positions, schools, ABA ratings, political affiliations). |
| `positions` | High | Term-bounded judicial appointments — president, predecessor, successor, dates. |
| `financial-disclosures` | High (when extracted) | Annual judge disclosures (2003–present). Bulk `has_been_extracted` flag tells you if line items are queryable. |
| `audio` | Mixed | Oral argument MP3s. Many SCOTUS and circuit argument transcripts; less coverage of district courts. |
| `opinions-cited` | High | Pre-computed citation graph between opinions. Source for citation-count rankings. |
| `parties`, `attorneys` | Mixed | Heavy normalisation issues across courts (same firm appears with multiple spellings). |
| `bankruptcy-information` | Low recall | Specialised; rarely cited in non-legal case studies. |

---

## Section 2 — Current Ingestion State (verified against DB 2026-06-03)

```
ingestedBy = 'courtlistener_scotus_v1'    →  400 Claims
ingestedBy = 'courtlistener_circuits_v1'  →  473 Claims
                                          ─────────
TOTAL                                        873 Claims
```

### 2.1 What's in

- **`courtlistener_scotus_v1`** (`scripts/ingest-courtlistener-scotus.ts`)
  - SCOTUS opinions sorted `-citation_count`, filterable by `--before-year`, `--after-year`, `--min-citations`.
  - Edge score 90 (court of last resort), `evidenceType: PROCEDURAL`.
  - Auto-tags `supreme-court-ruling`.
  - 400 of ~28 000 SCOTUS clusters → top ~1.4 % by citation.

- **`courtlistener_circuits_v1`** (`scripts/ingest-courtlistener-circuits.ts`)
  - 13 federal circuit courts (`ca1`–`ca11`, `cadc`, `cafc`).
  - `precedential_status=Published` only, `--min-citations 20` default.
  - Edge score 80 (binding circuit precedent), `evidenceType: PROCEDURAL`.
  - Topic hierarchy: `federal-courts` → `us-court-of-appeals-Nth-circuit`.
  - 473 ingested so far → ~36 / circuit on average.
  - **Actively running**: `scripts/circuits-loop.sh` repeats `--slow --limit 100 --min-citations 20` every 6 h; idempotent via `externalId = courtlistener_circuits_v1-<clusterId>`.

### 2.2 What's missing / still filling in

| Layer | Gap | Status |
|---|---|---|
| **Opinion text** | Only `cluster.case_name` is stored. No `Source.metadata` field yet — AI-extracted holdings deferred. | Not started |
| **State supreme courts** | Running via `state-supreme-loop.sh` — starting to fill in top 15 states. | **Loop running** |
| **Specialised federal courts** | Bankruptcy, Tax Court, Court of Federal Claims, FISA, immigration BIA — none ingested. | Tier 4 — on-demand |
| **District courts** | None. ~94 federal districts; landmark rulings (e.g., *Texas v. United States*) missing. | Tier 4 — on-demand |
| **Pre-2026 backlog of high-cite circuit opinions** | Citation floor auto-dropping in `circuits-loop.sh`; will surface more over time. | Filling in via loop |
| **Judge metadata** | Running via `judges-loop.sh` — Article III appointments (SCOTUS + 13 circuits). | **Loop running** |
| **Financial disclosures** | None — Thomas/Crow/Alito investigations cite specific forms; cannot link yet. | **Tier 2 — next** |
| **Citation graph** | `opinions-cited` not ingested. `ClaimRelation` edges deferred. | Tier 3 — deferred |
| **Oral argument transcripts** | None. | Tier 3 — deferred |

---

## Section 3 — Ingestion Roadmap (tiered)

> Each item passes / fails the reference-tier test before being proposed for bulk ingestion. Failing items are listed under **§ 3.5 Background-tier — link, don't ingest**.

### Tier 1 — Highest epistemic value (do soon)

#### 1A. Lower the SCOTUS citation floor toward "all published SCOTUS opinions"
- **Reference-tier:** PASS — case studies routinely cite specific SCOTUS rulings.
- **Endpoint:** `/clusters/?docket__court=scotus&precedential_status=Published&page_size=100`
- **Approximate gap:** ~28 000 published SCOTUS clusters total; 400 ingested. Remaining ~27 600.
- **Recommended next step:** rerun the existing SCOTUS ingester with `--min-citations 5 --limit 5000`, then `--min-citations 1 --limit 10000`, then `--min-citations 0 --limit 30000` in three passes.
- **Rate budget:** ~28 000 records ÷ ~75 records/min (at REQUEST_DELAY_MS=800) ≈ 6 hours of clock time if uninterrupted.
- **Claim mapping:** unchanged from current SCOTUS script (edge score 90).

#### 1B. Expand circuit ingestion to the long tail
- **Reference-tier:** PASS for published opinions (binding circuit precedent).
- **Endpoint:** `/clusters/?docket__court=caX&precedential_status=Published&citation_count__gte=N`
- **Approximate gap:** dropping `--min-citations` from 20 → 5 across 13 circuits surfaces an estimated ~5 000 – 10 000 additional opinions worth ingesting.
- **Recommended next step:** before lowering the citation floor globally, run one circuit (`ca9`) at `--min-citations 5 --limit 500` and inspect quality.
- **Claim mapping:** unchanged from current circuits script (edge score 80).

#### 1C. State supreme courts (top tier, court of last resort)
- **Reference-tier:** PASS — state supreme court rulings are routinely cited (e.g., *Hawai'i v. Office of Hawaiian Affairs*, *People v. O.J. Simpson* in CA Sup. Ct.).
- **Endpoint:** `/clusters/?docket__court__jurisdiction=S` (state supreme court) or per-court (`docket__court=cal`, `docket__court=nytrial`, …)
- **Approximate gap:** ~50 state courts of last resort × estimated 5 000 – 50 000 published opinions each. Start with the largest: CA (`cal`), NY (`ny`), TX (`tex`), FL (`fla`), IL (`ill`), PA (`pa`).
- **Recommended new script:** `scripts/ingest-courtlistener-state-supreme.ts` — same architecture as `ingest-courtlistener-circuits.ts`, swap circuit catalogue for a state-supreme catalogue.
- **Edge score:** 75 (binding within state, lower than federal circuits).
- **Topic hierarchy:** `state-supreme-courts` → `<state>-supreme-court`.
- **Initial threshold:** `--min-citations 20 --limit 200` per court.

#### 1D. Federal judges (`people`) + `positions`
- **Reference-tier:** PASS for federal judges. Case studies cite specific judges, dissents-by-author, and appointment-by-administration.
- **Endpoints:** `/people/` (16 191 records, confirmed), `/positions/` (51 291 records, confirmed).
- **Recommended new script:** `scripts/ingest-courtlistener-judges.ts`
  - One Claim per judge: `claimType: INSTITUTIONAL`, text *"X was confirmed as a [position] of [court] in [year]"* — anchored to the **position**, not the person, so that each appointment is a separate Claim.
  - Edge score 70 (executive appointment confirmed by Senate is a procedural HARD_FACT).
  - Topic: `federal-judiciary` + `appointing-president-<name>`.
  - Polity link: each appointment ties to the US polity at the confirmation date — surfaces partisan composition naturally.
  - `metadata` JSON on Claim: `{ courtListenerPersonId, courtListenerPositionId, appointingPresident, predecessor, successor }`.
- **Rate budget:** 51 k records ÷ 75 records/min ≈ 11 hours.

### Tier 2 — Rich context (do next)

#### 2A. Financial disclosures (judge-level + extracted line items)
- **Reference-tier:** PASS — the Thomas/Crow, Alito, Sotomayor disclosure investigations all cite specific disclosure forms.
- **Endpoints:**
  - `/financial-disclosures/` (~30 k forms)
  - `/investments/`, `/gifts/`, `/reimbursements/`, `/agreements/`, `/debts/`, `/non-investment-incomes/`, `/spouse-incomes/`, `/disclosure-positions/` (line items embedded in disclosure)
- **Recommended new script:** `scripts/ingest-courtlistener-disclosures.ts`
  - Two-pass: first ingest each `/financial-disclosures/` form as a `Source` linked to its judge (`person`).
  - Second pass: extract line items only where `has_been_extracted: true`; create individual Claims for high-value gifts/reimbursements above an editorial threshold (e.g., gifts ≥ $5 000, foreign reimbursements).
- **Edge score:** 70 for the form (court-filed sworn document); line-item Claims inherit 70.
- **Topic:** `judicial-ethics` + `financial-disclosures`.
- **Special handling:** redacted disclosures (`addendum_redacted: true`) must be flagged in `Source.name` so editorial readers know.

#### 2B. Court catalogue
- **Reference-tier:** PASS — every existing Topic (`us-court-of-appeals-9th-circuit`, etc.) is informally a court. The `courts` endpoint gives the canonical list with start/end dates, jurisdiction codes, and Wikidata-friendly identifiers.
- **Endpoint:** `/courts/` (3 358 records, confirmed).
- **Script built:** `scripts/ingest-courtlistener-courts.ts` — **DO NOT RUN YET. Pending slug decision.**
  - Script uses slugs `court-<id>` (e.g., `court-scotus`, `court-ca9`). This creates a **parallel topic tree** alongside the existing `us-court-of-appeals-9th-circuit` slugs from the circuits ingester.
  - **Open decision:** either (a) run as-is and clean up duplication later, or (b) update the script to upsert using existing descriptive slugs so the court catalogue *merges* into the existing tree.
  - Backfills descriptions from `full_name` + `start_date`/`end_date`; never renames existing topics.
- **No Claims created** — Topics only.
- **Rate budget:** trivial (3 358 records, single pass under 10 min). First run on 2026-06-03 rate-limited immediately due to 5 concurrent loops; re-run when quota resets.

#### 2C. Oral argument index (metadata, not audio bytes)
- **Reference-tier:** **MARGINAL — likely BACKGROUND-tier.** Case studies typically cite specific moments in oral argument by *quote*, not by recording. The CL audio MP3 itself rarely shows up as a citation.
- **Recommendation:** **defer**; if compelling case-study demand materialises (e.g., a series of pieces on questioning patterns), revisit with metadata-only ingestion (no MP3 binary; just `date_argued`, `case_name`, link).
- **If ingested:** one Claim per argument, edge score 50 (argument ≠ ruling), topic `oral-arguments`.

### Tier 3 — Deep legal graph (large-scale; build only after Tier 1+2 settle)

#### 3A. Opinion citation graph (`opinions-cited`)
- **Reference-tier:** **EDITORIAL-NOT-ALGORITHMIC** territory. The graph isn't a Claim itself — it's a relation between Claims we already have.
- **Recommendation:** **do not bulk-ingest as Claims.** Instead, build a one-shot ETL that materialises `ClaimRelation` edges between already-ingested SCOTUS/circuit Claims when both ends are in our DB. `relationType: "cites"`.
- **Endpoint:** `/opinions-cited/?citing_opinion__cluster__id__in=<our list>` — query in chunks of 100 cluster IDs.
- **Estimate:** ~70 M edges global, ~10 k – 100 k within our ingested set.

#### 3B. RECAP / PACER documents (the dragon)
- **Reference-tier:** **FAIL in bulk**, **PASS for editorially selected landmark filings.**
  - The vast majority of the ~200 M `recap-documents` are routine motions (scheduling orders, certificates of service) that no case study will ever cite.
  - But a small set — the *Trump v. United States* indictments, the *Cohen* search-warrant affidavit, the FTC pre-merger briefs — are exactly the kind of thing case studies cite directly.
- **Recommendation:** **no bulk ingester.** Instead, add hand-curated Sources by docket number when case studies need them. Treat RECAP like the FAERS rule in AGENTS.md: link by query URL, do not bulk-ingest.

#### 3C. Docket entries
- **Reference-tier:** FAIL — docket entries are sub-records of dockets, and case studies cite the case (cluster), not "docket entry #14".
- **Recommendation:** **do not ingest.**

### Tier 4 — Specialised (build only on case-study demand)

| Item | Reference-tier? | Approach |
|---|---|---|
| State appellate (intermediate) courts | Mixed — only the most-cited surface in case studies | If ingested, follow Tier 1C pattern but with `--min-citations 30`. |
| State trial courts | FAIL in bulk | Hand-curated only. |
| Bankruptcy courts | Mostly FAIL | Hand-curated only. |
| Immigration BIA decisions | PASS for precedent decisions (~5 000 published) | Build dedicated script: `--court=bia --precedential_status=Published`. |
| Tax Court / Court of Federal Claims | PASS for published precedential opinions | Build dedicated script per court code. |
| Tribal courts | Mostly FAIL — sparse coverage | Hand-curated only. |
| Military / Service-Branch CCA | PASS for landmark UCMJ rulings | Hand-curated only initially. |

---

## Section 4 — Quick Wins (<1 day of work)

These can be executed against the existing scripts with no new code.

1. **Lower SCOTUS citation floor to surface more anchor cases** — run the existing script over a weekend at successive thresholds (`--min-citations 5, 2, 0`).
   ```bash
   cd ~/Projects/epistemic-receipts
   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-scotus.ts \
     --limit 3000 --min-citations 5
   ```
   Estimated gain: ~2 000 additional Claims.

2. **Drop circuit citation floor from 20 → 10 on a single circuit** for a quality probe:
   ```bash
   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-circuits.ts \
     --slow --court ca9 --limit 300 --min-citations 10
   ```
   Inspect the output before doing this globally.

3. **Run a SCOTUS time-window backfill** for pre-1900 opinions (Marshall, Taney, Field eras) — these are often citation-poor by today's metric but historically pivotal:
   ```bash
   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-scotus.ts \
     --limit 1000 --min-citations 0 --before-year 1900
   ```

4. **Backfill missing topics for already-ingested SCOTUS Claims** — current SCOTUS script auto-tags `supreme-court-ruling` only when the topic exists. Confirm the topic exists; if not, create it once and run a small re-tagging pass.

---

## Section 5 — Script Improvements

The existing scripts are already well-engineered (retries with backoff, 429 handling with retry-after, transactional writes, idempotent dedup, defensive type coercion, slow mode, resume-from). The improvements below are incremental.

### 5.1 Resumability beyond `--resume-from`

Current behaviour: `--resume-from ca3` is circuit-grained. Page-grained resume would help when a circuit aborts mid-run.

**Recommendation:** persist `nextUrl` after each successful page write to a small `metadata/courtlistener_circuits_v1.cursor.json` file. On startup, if a cursor exists, resume from it (unless `--restart` is passed). This survives the 6 h loop cleanly.

### 5.2 Adopt the `Claim.metadata` JSON field

The current scripts hash key bibliographic data into `claim.text` (`"X v. Y (1972) issued a ruling..."`). The case name, citation, and court code do not survive structurally. Per AGENTS.md ("Source/Edge/MetaEdge metadata fields pending"), use `Claim.metadata` for now:

```ts
data: {
  // ...existing fields...
  metadata: {
    dataset: 'courtlistener',
    courtListenerClusterId: clusterId,
    courtCode: circuit.code,
    citation,          // "410 U.S. 113" etc.
    citationCount,
    caseNameShort: cluster.case_name_short,
    precedentialStatus: cluster.precedential_status,
  },
}
```

This enables future filtering (`metadata->>'courtCode' = 'ca9'`) without touching the schema.

### 5.3 Verify against DB after every run

AGENTS.md is explicit: "Do not trust in-script progress logs as the source of truth for how many rows were written." Add a post-pass verifier:

```ts
const inDb = await prisma.claim.count({
  where: { ingestedBy: 'courtlistener_circuits_v1' },
});
console.log(`DB total for this ingester after pass: ${inDb}`);
```

Print at the end of `main()` and at the end of each circuit in the circuits script.

### 5.4 Rate-limit budget logging

CourtListener has a tiered rate limit (5/min on `count=on`, 50/hr on some endpoints, 5 000/day overall for authenticated). Today the only signal is "got a 429, sleeping". A counter that logs `requests_this_hour` and `requests_this_day` to a sidecar file (with hourly rollover) would surface budget exhaustion before the 429 cascade.

### 5.5 Centralise the CourtListener API client

`clFetch`, `parseDate`, `formatCitation`, `buildSourceUrl`, `toCitationCount`, the retry constants — copy-pasted between `ingest-courtlistener-scotus.ts` and `ingest-courtlistener-circuits.ts`. As Tier 1C (state supreme) and Tier 1D (judges) come online, this duplication explodes.

**Recommendation:** extract `scripts/lib/courtlistener.ts` exporting `clFetch`, `parseClDate`, `formatClCitation`, `buildClSourceUrl`, `toClCitationCount`. Keep per-ingester scripts thin.

### 5.6 Live-verify endpoint counts before each new script

Per AGENTS.md ("Curated lists require verifiable sources … Training-data recall is not a verifiable source"), before scripting a new endpoint, hit it with `?count=on` and record the real count in a sidecar `metadata/courtlistener-counts.json` (with timestamp). This prevents drift between roadmap estimates and live counts.

The counts in § 1.2 of this document marked "FLP-reported" are **not** live-verified — the live `?count=on` query was throttled during this audit. Before building Tier 2 / Tier 3 scripts, run a slow background probe (one endpoint / 30 s) to refresh these.

---

## Open questions to resolve before Tier 1D / Tier 2

1. **Does the `Source.metadata` migration land before judges + disclosures ship?** If yes, `Source.metadata` becomes the home for PDF URLs, sha1, year, etc. If no, those continue to live on `Claim.metadata`.
2. **For `positions`, should we mint one Claim per *appointment* or one per *judge*?** Recommendation above is per appointment — but this multiplies the row count (51 k vs 16 k) and may overwhelm the SCOTUS justices' page in the UI. Decide before scripting.
3. **For state supreme courts, do we mirror the circuit topic tree (`state-supreme-courts → <state>-supreme-court`) or fold them under a flatter `courts-of-last-resort` umbrella?** Tree depth choice affects UI surface area.
4. **Citation graph as `ClaimRelation` — what `year` field do we use?** The current `ClaimRelation` model has an optional `year`; for citations it's the citing-opinion year, not the cited-opinion year. Document this convention in the relation script's header.

---

## Appendix — endpoints intentionally **not** ingested

| Endpoint | Why |
|---|---|
| `recap`, `recap-email`, `recap-fetch`, `recap-query` | RECAP ingestion APIs (writes to CL), not read APIs. Out of scope for us. |
| `tag`, `tags`, `docket-tags`, `alerts`, `docket-alerts`, `memberships`, `prayers` | User-account CL features. Not facts about the world. |
| `scrapers/scotus-email`, `increment-event` | Operational endpoints. |
| `visualizations`, `visualizations/json` | CL user-generated citation network visualisations. Editorial-not-algorithmic territory. |
| `bankruptcy-information`, `originating-court-information` | Sub-records of dockets; out of scope unless dockets get ingested (and they shouldn't, per § 3C / 3B). |
| `fjc-integrated-database` | FJC integrated-database mirror; large but background-tier (research dataset, not case-citable). |
