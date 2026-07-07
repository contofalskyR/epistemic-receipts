# Citation Field Mappings — Epistemic Receipts

Every decision about how site entities map to citation fields is recorded here.
Where a clean mapping doesn't exist, we output fewer fields rather than wrong ones.

## Claim citations (`/api/citations/claim/{id}`)

Claim citations export the underlying *sources* (Evidence edges) as individual
entries, not the claim text itself. The claim provides context in the `note` field.

| Site field | BibTeX field | CSL field | RIS field | Notes |
|---|---|---|---|---|
| `Source.name` | `title` | `title` | `TI` | Required |
| `Source.url` | `howpublished` + `\url{…}` | `URL` | `UR` | Omit if null |
| `Source.publishedAt` | `year` / `month` | `issued` | `Y1` | Falls back to claimEmergedAt year; if neither, omit |
| Claim text (truncated 200 chars) | `note` | `note` | `N1` | Context for what claim this evidences |
| Edge.type | in `note` | in `note` | `N1` | Evidence relation type |
| `epistemicAxis` | in `note` | in `note` | `N1` | Epistemic classification |
| Site URL + claim ID | in `note` | `accessed` + `URL` | `N1` | Canonical provenance link |

**Entry type selection:**
- Default → `@misc` (BibTeX) / `webpage` (CSL) / `ELEC` (RIS)
- Source.url matches legislation domains (congress.gov, legislation.gov.uk, etc.) → `@misc` with `note = {Legislation}` / `legislation` (CSL)

## Source citations (`/api/citations/source/{id}`)

| Site field | BibTeX field | CSL field | RIS field | Notes |
|---|---|---|---|---|
| `Source.name` | `title` | `title` | `TI` | Required |
| `Source.url` | `howpublished` / `URL` | `URL` | `UR` | |
| `Source.publishedAt` | `year` | `issued` | `Y1` | |
| `Source.methodologyType` | in `note` | `note` | `N1` | e.g. "peer_reviewed", "official_record" |
| Organisation / publication | `organization` or `publisher` | `publisher` | `PB` | Inferred from `Source.name` prefix patterns (e.g. "FDA" → publisher = "Food and Drug Administration"). When inference fails: omit rather than guess. |

**Entry type selection:**
- `methodologyType = "peer_reviewed"` → `@article` / `article-journal` / `JOUR`
- `methodologyType = "legislation"` → `@misc` with type hint / `legislation` / `STAT`
- `methodologyType = "official_record"` → `@techreport` / `report` / `RPRT`
- Default → `@misc` / `document` / `GEN`

**OpenAlex enrichment (papers with `openAlexId`):**
Fetched at export time from `https://api.openalex.org/works/{openAlexId}`,
cached in-memory for the request (not persisted — avoids stale data).
Fields enriched: author list, journal name, volume, issue, DOI.
If OpenAlex is unreachable: export with base fields only (no error).

## Case Study citations (`/api/citations/casestudy/{id}`)

Case studies cite as institutional reports.

| Site field | BibTeX field | CSL field | RIS field | Notes |
|---|---|---|---|---|
| Title (from claim text) | `title` | `title` | `TI` | Truncated at 200 chars |
| Canonical URL | `howpublished` / `URL` | `URL` | `UR` | |
| `createdAt` year | `year` | `issued` | `Y1` | |
| "Epistemic Receipts" | `institution` | `publisher` | `PB` | |

Entry type: `@techreport` / `report` / `RPRT`.

## Batch export (collection-level)

- All items in a collection exported as a single `.bib` / `.ris` / `.json` file.
- Gated on `export.citations` entitlement.
- Each claim → its evidence sources (deduplicated by URL).
- BibTeX key format: `er_{claimSlug}_{year}_{index}` (collision-safe within the file).

## Deliberate omissions

- `author` is omitted when it cannot be determined without fabrication (e.g. unsigned FDA approvals, anonymous sources). Empty `author={}` is worse than no author field.
- `journal` is omitted unless OpenAlex confirms it (for papers).
- `pages`, `volume`, `issue` require OpenAlex enrichment; omitted otherwise.
