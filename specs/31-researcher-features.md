# Spec 31 — Researcher Features (citations, collections, alert tiers)

Phase 3 · Depends on: 30 · Model: Sonnet 5 · Scope: ~2–4 agent sessions

## Objective
The features that make institutional subscriptions renew: citation export, collections with notes, and entitlement-tiered alerts. All gated through `lib/entitlements.ts` (Spec 30).

## Deliverables

### 1. Citation export
- Formats: BibTeX, CSL-JSON, RIS. Exposed on: claim detail (cite the claim: site as container, claim as entry, canonical URL, accessed date, pipeline provenance in note field), source detail (cite the underlying source properly: map `Source.name/url/publishedAt/methodologyType`; legislation → `@misc`/`legislation` types with jurisdiction from PoliticalContext; papers with openAlexId → proper `@article` fields fetched from OpenAlex at export time, cached), case studies (cite as report).
- Field-mapping table checked in as `lib/citations/mappings.md` — document every decision (what goes in author for an FDA approval? organization as author) so it's reviewable. Where a clean mapping doesn't exist, output fewer fields rather than wrong ones.
- Endpoint `GET /api/citations/{type}/{id}?format=` — public for single items (goodwill + SEO), batch export (collection-level) gated `export.citations`.
- Copy-to-clipboard UI on detail pages; `.bib` download for batches. Zotero translator: out of scope, leave a stub doc.

### 2. Collections (upgrade of Bookmark)
- New `Collection` (id, ownerId user, name, description?, createdAt) + `CollectionItem` (collectionId, claimId, note?, addedAt, position). Existing bookmarks auto-migrate into a default "Bookmarks" collection per profile/user (idempotent migration script; anonymous profiles keep working — collections beyond the default require login).
- UI: `/collections`, add-to-collection on claim pages, inline notes, reorder. Export: CSV + BibTeX batch (gated).
- Caps via entitlements (`collections.max`, items per collection cap 500 — protect batch export costs).

### 3. Alert tiers
- `TopicSubscription` gains `userId?` (nullable — existing email-only subs unaffected). Logged-in management page `/alerts`: list, add (search-driven keyword picker), frequency (daily/weekly digest — extend the existing cron), delete.
- Entitlement `alerts.max` enforced at creation (free 3, org 50). Existing anonymous email subs: grandfathered, count toward the cap only after the email is claimed by a user.
- Digest email upgrade: group by topic, show epistemicAxis changes and new receipts since last alert (query ClaimStatusHistory + Edge createdAt windows), not just new claims. Include unsubscribe + manage links.

## Out of scope
Zotero translator, shared/team collections, annotations on claim text, RSS (note as candidates).

## Acceptance criteria
- BibTeX output for 5 exemplar entities (SCOTUS case, foreign statute, retracted paper, FDA approval, case study) validates under `bibtex-parse` AND imports cleanly into Zotero (manual check, screenshot) with sensible fields — no empty `author={}`, no wrong years.
- Bookmark migration: counts before/after equal; anonymous flow regression passes; running migration twice is a no-op.
- Caps enforced: creating past the limit → friendly upgrade prompt, not error; org member inherits org cap.
- Digest email renders correctly in a real inbox (screenshot) and its "changes since" logic verified against a hand-checked window on staging.
- Ownership tests: collections/alerts inaccessible cross-user by ID manipulation.

## Verification
Paste: bibtex validation output + Zotero import screenshot, migration counts, cap behavior, digest screenshot.
