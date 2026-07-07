# PR: spec/31 — Researcher Features (citations, collections, alert tiers)

Base: `spec/30` (Accounts, Orgs, Entitlements)

---

## What ships

### 1. Citation export

**New endpoint:** `GET /api/citations/{type}/{id}?format=bibtex|ris|csl-json`

- Types: `claim` (exports evidence sources), `source` (exports the source itself with optional OpenAlex enrichment for papers)
- All three formats: BibTeX, RIS, CSL-JSON
- Public for single items (goodwill + SEO), batch export gated on `export.citations` entitlement
- OpenAlex enrichment: when citing a source linked to a claim with `openAlexId`, fetches authors, journal, volume, DOI from OpenAlex API (3s timeout; graceful degradation if unreachable)
- Field mapping decisions documented in `lib/citations/mappings.md` — every decision recorded (what goes in author for unsigned FDA approvals → omit; legislation domains → `@misc`/`STAT`/`legislation` types; etc.)

**UI:** CitationButton component on all claim detail pages — copy-to-clipboard and file download for each format.

**Zotero translator:** stub note in mappings.md (out of scope per spec).

### 2. Collections (upgrade of Bookmark)

**New models:** `Collection`, `CollectionItem` (see migration `20260707050000_spec31_researcher_features`)

**API routes:**
- `GET/POST /api/collections` — list/create (capped by `collections.max` entitlement)
- `GET/PATCH/DELETE /api/collections/[id]`
- `POST /api/collections/[id]/items` — add claim (cap 500 items/collection)
- `PATCH/DELETE /api/collections/[id]/items/[claimId]` — update note/position, remove
- `GET /api/collections/[id]/export?format=bibtex|csl-json|ris|csv` — batch export (gated: `export.citations`)

**UI:** `/collections` list page, `/collections/[id]` detail page with inline notes, AddToCollection dropdown on claim pages.

**Bookmark migration:** `scripts/migrate-bookmarks-to-collections.ts` — idempotent, profiles without userId untouched (anonymous bookmarks unaffected).

Entitlement enforcement: creating past limit returns `402` with `upgrade: true` and `code: "collections_limit"` — friendly prompt, not error.

### 3. Alert tiers

**Schema:** `TopicSubscription` gains `userId?` (nullable FK → User) and `frequency` (daily/weekly, default: weekly). Existing email-only subs unaffected (userId = null, grandfathered in).

**API routes:**
- `GET/POST /api/alerts` — list/create (gated: `alerts.max`; upserts existing email subs to link userId)
- `PATCH/DELETE /api/alerts/[id]`

**UI:** `/alerts` management page — keyword/label input, frequency picker (daily/weekly), delete.

**Digest cron upgrade** (`/api/cron/topic-alerts`):
- `?mode=daily|weekly` parameter — call daily cron with `mode=daily`, weekly with `mode=weekly` (or omit for weekly)
- Digest now includes ClaimStatusHistory changes (fromAxis→toAxis transitions) in addition to new claims
- Email body has status-changes section + manage link (`/alerts`) for userId-linked subscribers
- Unsubscribe links preserved for all subscribers

---

## Tests

| File | Tests |
|------|-------|
| `tests/unit/spec31/citations.test.ts` | 27 — format functions, inferEntryType, makeCitationKey, renderCitation |
| `tests/unit/spec31/ownership.test.ts` | 6 — cross-user 401/404 enforcement on collections + alerts |

All 33 pass. Pre-existing failures in spec21/30/40 tests are unrelated to this spec.

---

## Owner actions required before using

1. **Run DB migration** on staging/production: the migration is in `prisma/migrations/20260707050000_spec31_researcher_features/migration.sql`. Apply via `prisma migrate deploy` or run the SQL directly.

2. **Run bookmark migration** (one-time, after migration):
   ```
   npx tsx scripts/migrate-bookmarks-to-collections.ts
   ```
   Logs `Collections created: N, already existed: M, items added: K`. Run twice = no-op.

3. **Update cron schedule** for daily digests: add a daily cron job calling `/api/cron/topic-alerts?mode=daily` in addition to the existing weekly job (or replace weekly with `mode=weekly`).

4. **Verify entitlements** match your current tier config — `collections.max` and `alerts.max` in `lib/entitlements.ts` are set from spec/30. Org context gets `collections.max = Infinity` and `alerts.max = 50`.

5. **Citation export gating** — `export.citations` is currently `org`-only (team+ orgs). Individual-tier citation exports require changing entitlements if desired.

6. **BibTeX acceptance criteria check** (manual): test 5 exemplar entities per spec — SCOTUS case, foreign statute, retracted paper, FDA approval, case study — validate with `bibtex-parse` and import to Zotero. Routes are live at `/api/citations/claim/{id}?format=bibtex`.

---

## Out of scope (per spec)

- Zotero translator (stub doc in mappings.md)
- Shared/team collections
- Annotations on claim text
- RSS feeds

---

## Notes

- Branch based on `spec/30` merge (8c66b4e), not latest `main` (which adds spec/21 billing). Spec/31 has no billing dependencies. Owner should merge into main after spec/21 billing is stable, or rebase first.
- `gh` CLI not installed on VPS — PR must be created manually at: https://github.com/contofalskyR/epistemic-receipts/pull/new/spec/31
