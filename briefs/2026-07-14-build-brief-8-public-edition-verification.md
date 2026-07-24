# Build Brief #8 — Public-edition verification (pre-flip go/no-go)

**To:** RobClaw / the Claude Code worker it dispatches on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-14)
**Lane:** site/verification. **Zero database writes.** This brief executes runbook L2-3 (`briefs/2026-07-14-launch-runbook.md`): verify the public edition on its private URL before any domain points at it. The deliverable is a **go / no-go report**, not features.

> **PROJECT_B_URL = `https://______________________.vercel.app`** ← owner fills this in before dispatch. Everything below runs against this URL (called **B**) and, for split checks, the lab deployment (called **A**).

---

## 0. Gate + orientation

1. **Gates:** Brief #7 merged to main; project B deployed from main with (per owner) `NEXT_PUBLIC_EDITION=public` and the `er_readonly` connection string. You cannot read Vercel env — every claim about B's configuration must be proven by observable behavior, which is the point of this brief.
2. `git fetch && git checkout main && git reset --hard origin/main`. Read: `lib/publicEdition.ts` (the allowlist + `isPublicRoute` semantics), `PUBLISH-CHECKLIST.md` (§Verification), `briefs/2026-07-14-b7-report.md`.
3. **Fix policy for this brief:** it is verification-first. Small hardening fixes go to main as usual (branch `loop/site-b8-2026-07-14`, `B8-n:` commits, PR — both editions inherit). Anything env-side (Vercel settings, roles, secrets) is an OWNER item in the report, never a code workaround. Anything structural → FLAG, no-go if launch-blocking. Blocked beats invented.

## Phases

### B8-1 — Edition + role proof (B is what we think it is)

- B serves with no password gate; A still gates (or is open if `SITE_PASSWORD` still unset there — record actual behavior).
- Nav on B shows no ⚗ Lab group; `/labs/*`, `/admin/*`, `/review`, `/edges`, `/claims/[id]/edit` all 404 on B.
- **Read-only role proof:** attempt one harmless write through a public surface (e.g., the feedback form) and confirm the DB rejects it at the role level or the app declines gracefully — the error path, status code, and user-visible result all recorded. This single test proves `DATABASE_URL` is really the read-only role. Do NOT hunt for write paths beyond the app's own forms.

### B8-2 — Route sweep (scripted, exhaustive)

Write `scripts/b8-route-sweep.ts` (read-only; takes a base URL): for every `PUBLIC_ROUTES` entry, fetch and assert 200 + a content marker (title or a known string — not just status); for a curated deny-list (labs, admin, review, edges, edit, account, org, pricing, alerts, collections, and the five orphan taxonomies: arts, criminology, materials-science, political-economy, religious-studies), assert 404. Include the three legal pages (B7-1) and one deep path per prefix family: a claim page, a trajectory, a story, a receipt, `/docs/api`, a domain page, `/embed/trajectory/<curated-slug>`, `/api/badge/claim/<id>.svg`. Run against B; paste the full pass/fail table. Any allowlisted route that 500s (not 404s) on B is a finding — likely a write-at-render or env dependency; diagnose before flagging.

### B8-3 — Write-path sweep (the step most likely to find surprises)

For each public write feature — feedback, flag-a-receipt (`/corrections`), bookmarks, alerts, search-miss, collections — exercise it on B and record one of:

- **WORKS** (writes succeed — means that path does NOT go through the read-only role; explain how, e.g. proxied or a scoped role, and whether that's intended),
- **DEGRADES** (clean user-facing failure, no 500, no dead-looking form),
- **BREAKS** (500 / silent failure / UI implies success while nothing persisted — the dishonest failure mode; automatic no-go item).

For BREAKS: small UI fixes (disable-with-notice on public edition, or an honest error state) are in-scope on main; anything needing a write-proxy design is a FLAG with options. Also record: does the Telegram notification fire from B for feedback/flag (env present?) — owner decides whether it should.

### B8-4 — Crawlability split

- `B/robots.txt` allows crawling and advertises the sitemap; `A/robots.txt` disallows everything (once A is flipped to lab — record current actual state of both).
- `B/sitemap.xml` returns the index; chunk URLs use B's host; spot-fetch one chunk of each type (static, topics, claims) and confirm the URLs inside resolve on B.
- OG: fetch homepage, a claim, a trajectory, a story on B — `og:image`/`og:url` absolute URLs point at B's host (the site-origin env), images actually render.
- noindex surfaces stay noindex on B: receipts, embeds. JSON-LD parses on a claim page and a receipt.

### B8-5 — Embeds + badges on B

`EmbedButton` snippets on B emit B's origin (not the lab host, not a hardcoded domain); `/embed/*` renders from a different origin in an iframe with framing headers present on that prefix only; badge SVG correct content-type, colors, cache headers as deployed (CDN may rewrite — record what actually reaches the client); oEmbed discovery link resolves and its JSON wraps B URLs.

### B8-6 — PUBLISH-CHECKLIST P0 definition-of-done, verbatim

Run the checklist's §Verification list against B and paste results: the two whitepaper claim URLs show curves (≥2 dated sourced transitions, no UNREVIEWED); zero hits for "Editing is disabled" as anonymous; admin surfaces 404; homepage//pipelines//sources totals agree or are labeled (record which, given the pending headline-count decision — if the owner decided, verify the decision is live; if not, FLAG as the last open P0); no raw `enrich:*`/cuid tags visible.

### B8-7 — Ops spots

- Rate-limit headers present on B responses; hammer one endpoint lightly (~30 req) to confirm 429 path works and recovers.
- Sentry: deliberate or absent on B — trigger a test error route if one exists, else grep the rendered HTML for the DSN presence and record the state for the owner.
- Crons: `vercel.json` schedules apply to both projects. On B, `CRON_SECRET` should be unset → cron routes 401 fail-closed (verify one directly). Report the recommendation: keep crons effectively disabled on B (unset secret) or dedupe scheduling — owner picks.
- Response headers sanity on B: HSTS present, `frame-ancestors 'none'` everywhere except `/embed/*`, no `X-Robots-Tag` surprises.

## Report — the deliverable

`briefs/2026-07-14-b8-report.md`: every check PASS / FIXED (commit) / OWNER-ITEM / FLAG, the two sweep tables in full, and a final section the owner can act on directly:

> **GO / NO-GO: ____.** No-go blockers: [list or none]. Owner items before domain flip: [list]. Post-flip re-checks: [the subset of B8-4/B8-5 that must re-run once the domain replaces the vercel.app host].

## STOP conditions

Project B unreachable or clearly mis-configured (wrong edition behavior) — report, don't guess at env; any fix wanting to touch middleware/auth/CSP script-src; a write-path redesign; two consecutive failures on one criterion. Blocked beats invented.
