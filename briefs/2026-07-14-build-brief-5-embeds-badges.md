# Build Brief #5 — Embeds & live status badges (site lane, read-only + one authorized middleware exception)

**To:** RobClaw / the Claude Code worker it dispatches on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-14)
**Lane:** site. **Zero database writes.** This brief carries ONE explicitly authorized exception to the standing "never touch middleware" rail — §2 defines its exact boundaries. Everything outside §2's diff is still forbidden.

**What this ships:** two distribution primitives that work while the site is still password-gated — (1) an iframe-able settling-curve embed for curated trajectories, (2) a shields-style SVG badge that renders a claim's *live* epistemic status. Every embed and badge is a backlink that stays current when the DB moves. That is the product pitch in miniature.

---

## 1. Gate + orientation

1. **Gate: Build Brief #3 merged to main.** B4 (split ledger) may be running concurrently — if so, work in a **separate worktree** branched from main (BUILD-STATUS.md documents the shared-working-dir race; do not repeat it). File overlap with B4 is nil by design; if you find yourself editing a file B4's brief names, STOP.
2. `git fetch && git checkout main && git reset --hard origin/main` (in your worktree). Orientation: `git log --oneline -25`, CONSULTANT.md head + 2026-07 entries.
3. Next.js 16 — read `node_modules/next/dist/docs/` before route code. Known gotchas: `ClaimStatusHistory.markerSource` (not `.source`); never `next build` on the VPS (Vercel preview is the build check).
4. Reuse points: `lib/status.ts` (canonical axis colors — the only source), `lib/og-shared.tsx` and the B3 receipt OG route (server SVG/image rendering patterns), the curve rail SVG pieces used by `DomainCurveRail`/carousel, `middleware.ts` + `lib/publicEdition.ts` (read both fully before B5-1), `next.config.ts` headers (the CSP `'unsafe-inline'` rule is untouchable).

## 2. The authorized middleware exception (exact boundaries)

The standing rail says middleware/auth/CSP changes are a STOP. The owner authorizes, for this brief only, this and nothing more:

1. In the `SITE_PASSWORD` gate's `allowedThrough` condition: add `pathname.startsWith("/embed/")` and `pathname.startsWith("/api/badge/")`. Nothing else joins the allowlist.
2. In `lib/publicEdition.ts` `PUBLIC_ROUTES` (deny-by-default): add `"/embed"` — so the future public edition serves embeds too. Badges live under `/api/*`, which that list already doesn't gate.
3. Framing: embeds must be iframe-able cross-origin. If a global `X-Frame-Options` / `frame-ancestors` header exists (check `next.config.ts` and middleware), override it for `/embed/*` **only** (allow all ancestors on that prefix). If none exists, add nothing globally — just don't emit one on `/embed/*`.

Out of bounds even inside this exception: the admin gate, `PUBLIC_WRITE_PATHS`, rate limiting (leave it applying to these routes — CDN caching absorbs load), the global CSP, `/api/login`, cookies, and any other prefix. The whole middleware diff should be a handful of lines; if it's growing past that, you've left the authorization.

**Consequence to record, not to fix:** these two prefixes become publicly reachable while the rest of the lab stays gated. That is the point. The report must list exactly what becomes public (§7).

## 3. Hard rails (standing, restated for a fresh worker)

No INSERT/UPDATE/DELETE, no `--execute`, no `ALLOW_EDITS`, no schema changes, no nav items, no MATERIAL-QUEUE edits. Never fabricate a value — badges and embeds render only what the DB says, statuses and dates included. Raw SQL bind-parameterized only (Prisma preferred throughout here). Branch `loop/site-b5-2026-07-14`, one commit per phase (`B5-n:`), ~400 lines per phase, push + PR, owner merges. Blocked beats invented.

## 4. Phases

### B5-1 — The carve-out (middleware + publicEdition, per §2)

Smallest possible diff, then prove it with a curl matrix in dev (SITE_PASSWORD set locally):

| Request (no auth cookie) | Expected |
|---|---|
| `/medicine`, `/claims/<id>`, `/feed` | redirect to `/login` (unchanged) |
| `/api/claims/...` or any non-allowlisted API | 401 (unchanged) |
| `/embed/trajectory/<curated-slug>` | 200 |
| `/api/badge/claim/<id>.svg` | 200, `image/svg+xml` |
| `/embed/../` traversal / non-embed path dressed as embed | still gated |
| `/embed/*` response headers | framing permitted; no auth cookie set |
| any other page | gated exactly as before |

Paste the matrix output into the PR. Acceptance: the diff touches only the §2 items; every "unchanged" row verified, not assumed.

### B5-2 — `/embed/trajectory/[slug]`

A minimal server-rendered page for **curated trajectories only** (`externalId` prefix `trajectory:` — resolve the slug the same way `/case-studies`/`DomainCurveRail` do; anything else 404s). Pre-launch containment: the curated set is the editorial showpiece and the only thing embeds expose.

- Content: trajectory title/claim text, the settling-curve SVG rail (reuse existing server rendering — do not write a new renderer), latest axis + as-of date in canonical colors, precision-aware date labels, and a persistent attribution footer: "Epistemic Receipts" linking to the trajectory page (`target="_blank" rel="noopener"`).
- Form: no site chrome, no Nav, no client JS unless the existing rail requires it; fixed intrinsic height (~200px) so iframes don't jump; `?theme=dark|light` param, default dark, both readable (colors stay `lib/status.ts`).
- Head: `robots: noindex`, `rel=canonical` to the trajectory page; own tiny layout so the root layout's chrome/analytics don't leak in (verify what the root layout injects before deciding to nest or isolate).
- ISR `revalidate = 3600`.

Acceptance: view-source shows real claim text + SVG; an uncurated slug 404s; the page renders inside a sandboxed iframe on a scratch HTML file served from a different origin in dev.

### B5-3 — `/api/badge/claim/[id].svg`

Shields-style SVG route handler: left cell "epistemic status", right cell the claim's current stamped axis + year (`SETTLED · since 2017`), right-cell fill from `lib/status.ts` hex. Data = `epistemicAxis` + latest `ClaimStatusHistory.occurredAt` (fall back to axis alone if no history — never invent a date; single-step claims say just the axis).

- Validate `[id]` as a cuid before querying; unknown/soft-deleted/DEPRECATED → a neutral gray "unknown" badge with 404 status (no claim existence oracle beyond what pages already expose — claim pages are public-linkable anyway, this is consistent).
- **No claim text in the badge** — the embedding author provides context; the badge carries status, date, brand only. This keeps pre-launch exposure minimal and the artifact clean.
- Escape every dynamic string for XML; `Content-Type: image/svg+xml`; `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` — one hour is the freshness promise of a "live" badge.
- Pure template-string SVG is fine (shields geometry: ~20px tall, text-length-aware widths); no new deps.

Acceptance: badge renders in an `<img>` from another origin in dev; a REVERSED claim's badge shows the REVERSED color; the cache header is present; malformed id → 404 without a Prisma error in logs.

### B5-4 — The "Embed" affordance

On trajectory detail pages and the 8 story pages (where B3 put `CitationButton`), add a small "Embed" control that reveals two copyable snippets:

- iframe: `<iframe src="https://<site>/embed/trajectory/<slug>" width="100%" height="200" style="border:0" loading="lazy" title="<title> — settling curve"></iframe>`
- badge (only where the surface maps to a single claim — claim pages are natural owners of the badge snippet; check where claim detail composes and add it there too if it composes cleanly): `[![Epistemic status](https://<site>/api/badge/claim/<id>.svg)](https://<site>/claims/<id>)`

Build the absolute URL from the site-origin helper the codebase already uses for metadata/OG (find it; do not hardcode the vercel.app host in more than one place — public launch will change the domain). Snippets must be exactly what renders — copy what you tested, not what you hope.

Acceptance: copy → paste into a scratch HTML file → both render against the dev server.

### B5-5 — STRETCH (all prior green): oEmbed + trajectory badge + docs

`/api/oembed?url=<trajectory-url>` returning rich-type JSON wrapping the iframe; `<link rel="alternate" type="application/json+oembed">` on trajectory pages; `/api/badge/trajectory/[slug].svg` variant; a short "Embeds & badges" block on `/docs/api`. Whole or not at all.

## 5. Out of scope

Everything B4 owns (split ledger, communities, shapes); adaptive-timeline/follow-UI; any wider un-gating (the public edition flip stays a PUBLISH-CHECKLIST owner action); analytics on embed views (needs a store — separate decision); any DB write.

## 6. Verification (every phase)

`npx tsc --noEmit` exit 0; ESLint clean on touched files; `npx vitest run` green; the B5-1 curl matrix re-run after B5-2/B5-3 land (routes now real); cross-origin iframe + img render checks from a scratch page; Vercel preview green — and re-run the matrix once against the preview URL (SITE_PASSWORD is set there; this is the true test that the carve-out works deployed).

## 7. Report

`briefs/2026-07-14-b5-report.md` on the branch: per-phase done/stopped; the full middleware diff quoted verbatim; the curl matrix from dev AND preview; the exact list of what became publicly reachable (curated slugs exposed via /embed, badge semantics); snippet examples as shipped; anomalies.

## 8. STOP conditions

The middleware diff wanting to grow beyond §2; any global header/CSP change; a need to expose non-curated content to make embeds "more useful"; any write about to happen; two consecutive failures on one acceptance criterion; anything requiring an invented value. Blocked beats invented.
