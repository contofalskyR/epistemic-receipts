# Briefing 05 — Integrity Fixes (the credibility punch list)

## Why

The product's entire differentiator is auditability. `AUDIT-WHITEPAPER-GAP-2026-07-03.md` §2/§4 lists small items that individually look cosmetic but collectively hand a skeptic ammunition. Do these after (or alongside) briefing 04 — several become much more visible once pages are crawlable.

## Tasks

### 1. "5,000+" homepage figure → live count

`HomeHero.tsx` line ~437 hardcodes "5,000+ trajectories". Replace with a real count (server-fetched, cached daily). Decide WHAT it counts and label it honestly: curated trajectories (dozens), multi-step settling curves (~350k after the waves), or retraction survival-pairs (5,474 — a different quantity the audit flagged as conflated). Recommendation: show multi-step curve count with precise wording; it's now the impressive AND true number. Whatever is chosen, one source of truth — a shared stats helper, not copy-pasted queries.

### 2. Retraction count: one source of truth

Paper says ~26,600; AGENTS.md registry says 26,595; the live page says 26,624. Derive the displayed number from a query; update AGENTS.md registry only via its sync process; note the paper uses "~".

### 3. Curate the claims the white paper cites

The paper's own footnotes land on receipts marked UNREVIEWED with 50/100 sources (Surgeon General smoking claim = reference [1]; H. pylori [2]). Human-review these specific claims to the curated standard: proper sources, scored, `humanReviewed: true` set truthfully (AGENTS.md: humanReviewed means a human actually reviewed — this briefing's executor prepares the review packet; the OWNER clicks approve). Also reconcile the semaglutide receipt with the paper (paper says five transitions, site shows six — decide which is canonical and align the other).

### 4. Scope contradiction: sports/finance routes

About page + paper promise "no sports, no celebrity news, no pure financial claims"; `/sports`, `/financial`, `/finance`, `/congress-trades`, `/stock-act` are live nav routes. This is an OWNER DECISION — prepare the two options as a short memo (delist routes vs. rewrite the scope copy), with a route/claim inventory for each. Do not implement either without sign-off.

### 5. Evidence score legend

"Score 50/100" appears with no explanation. Add a tooltip/legend component wherever the score renders, sourced from how the score is actually computed (find it in `lib/` — do not invent a rationale). If the score is currently a default-50 placeholder, say so in the legend ("unscored default") — that's more honest than a fabricated methodology blurb.

### 6. HTML entity double-escaping

Retraction cards render literal `&amp;` (e.g. "Science &amp; Justice") on `/retraction-explorer`. Find where titles are escaped twice (likely escaped at ingest AND by React). Fix at the render layer; check whether stored data itself contains entities and needs a one-time normalization backfill (dry-run + count first, house rules).

### 7. White paper drift

Repo contains `WHITEPAPER.md` (Jun 11) and the newer paper (Jul 1, `Robert Contofalsky.md` per the audit). Confirm with the owner which is canonical, mark the other as superseded in its header. Don't delete.

### 8. Promote `/corrections`

The audit's strongest finding: the public audit log (USPTO retirement documented honestly) is the most persuasive page on the site and it's buried in the footer. Add it to primary nav and link it from the About/credibility copy. Cheap, high leverage.

## Constraints

- Numbers on pages must be queried or derived — no new hardcoded stats anywhere.
- `humanReviewed`/`autoApproved` semantics are load-bearing (AGENTS.md): never set flags to make UI filters pass.
- Items 3, 4, 7 end in owner sign-off, not silent implementation.

## Verification

- Grep the repo for hardcoded counts after: `5,000|5000\+|26,6` should return only derived/labeled uses.
- The paper's footnote links resolve to reviewed receipts.
- `/retraction-explorer` renders "&" correctly; a DB query confirms whether stored titles are clean.
- Nav shows /corrections; Lighthouse a11y unaffected.
