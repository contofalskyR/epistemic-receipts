# T6 — UI: board, thread detail, authoring form

**Size:** 2–3 sessions. **Depends on:** T1 (schema); shows live data once T5
runs. Can proceed in parallel with T4/T5 after T2.

## Objective

The "Open Questions" section of the site: a board that makes orphans visible
at a glance, a detail page that shows the receipts behind a status, and an
admin-only authoring form. ADMIN-GATED until T7's gate passes — add
`/threads` to middleware `ADMIN_PATHS` in this spec; removing it later is
T7's one-line celebration.

## Pages

1. **`/threads` (board).** Cards: question (truncate >180 chars with the
   SHOW FULL affordance pattern from SettlingCurve), status badge, domain
   chip, last-material date ("42d quiet"), one-line reason, tiny coverage
   sparkline from coverageCurve. Sort: ORPHANED first, then by dropped-score
   when it exists (post-MVP), then last-material asc. Filters: status,
   domain. Server component + client filters, house dark styling.
   **Status badges get their OWN visual vocabulary** — do NOT reuse the
   FactStatus badge component or colors (two status systems must not be
   conflatable): 🟢 OPEN · 🔴 STALLED · ⚪ RESOLVED · 🟠 ORPHANED, prefixed
   "Question:" contextually.
2. **`/threads/[id]` (detail).** Question + the three resolution criteria
   verbatim; status + reason + guardsApplied chips (e.g. "venue floor",
   "needs-human-review"); pending trigger box; material-event timeline
   (ThreadEvents, merits/procedural/substantive typed, sourceUrl links);
   activity-signal strip (per feed, latest few); coverage-vs-activity: MVP =
   coverage sparkline + activity tick marks on one axis (the full divergence
   chart is post-MVP); status history table (computedAt, status, reason) —
   the thread's own audit trail, rendered proudly like the corrections page.
   Successor/parent thread links when set.
3. **`/threads/new` + edit (admin).** Fields: question, the three criteria
   textareas, domain (select), venue (select — with one-line explanations of
   what each does to dormancy floors), gdeltQuery (with a "test query" button
   → server action calls fetchGdeltArticles and shows the top 5 headlines so
   Robert can tune the query BEFORE saving — this is the single biggest
   quality lever in the whole product), activityRefs (billIds/docketIds/
   frDocketNos as tag inputs), knownPendingTrigger, importance slider.
   Server actions require admin (requireAdminOrDev), per security model
   rule 1 — middleware is defense in depth, not the gate.

## API

Reads via server components (no new public API needed for MVP). If a route
is added anyway, GETs are public-read like the rest of the site; any
mutation route follows security rules (requireAdminOrDev + isReadOnly).

## Acceptance criteria

- Typecheck 0 errors; board + detail render the T5 pilot threads with real
  data (Robert screenshots — his eyeball is the acceptance).
- `/threads*` 401s logged-out in production build; renders in dev.
- Authoring form round-trips: create → poll (T5 single-thread flag) →
  status appears on board.
- The GDELT query-test button works (tee a server log of one test call).
- Nav: add to the Lab/⚗ group while admin-gated (NOT Discover yet — that
  promotion is T7's).

## Do not

- Reuse FactStatus badges/colors for thread statuses.
- Show ORPHANED language publicly anywhere while the middleware gate is on —
  even og-tags/sitemaps (check both).
- Build the newsletter UI — that's post-shadow (Buttondown, per briefing 12).
