# Security Review — 2026-06-12

Scope: full audit + hardening pass to prepare the site for **public read-only** launch (password gate removed, anonymous browsing, all mutations locked down). All ~92 API routes, middleware, raw SQL call sites, tracked files, and git history were reviewed.

## Verdict before changes

The baseline was better than most "vibe coded" projects: `.env.local` was never committed, git history is clean of secrets, gitleaks runs in CI, login already used timing-safe comparison, cron routes failed closed, security headers + CSP existed, and most raw SQL was parameterized. The real gaps were: ~14 mutation endpoints whose only protection was the site password you're about to remove, two API routes with no auth at all, and a few raw-SQL call sites that interpolated user input with hand-rolled escaping.

## What changed

### 1. New auth layer (`lib/adminAuth.ts`, new file)
`requireAdmin` / `requireAdminOrDev`: accepts `Authorization: Bearer <ADMIN_TOKEN>` or the `admin_auth` cookie, timing-safe comparisons, fails closed if `ADMIN_TOKEN` is unset. The `OrDev` variant stays open during `next dev` so your local editing workflow needs no setup.

### 2. Middleware rewrite (`middleware.ts`)
- **Public read-only by default**: leaving `SITE_PASSWORD` unset now means public site (previously it meant 503). Setting it restores the private gate — it's your toggle.
- **Global write gate**: any non-GET API request requires admin credentials, except an explicit allowlist of public writes (login, feedback, search-miss reports, topic subscribe, bookmarks). Defense in depth — route-level checks below still apply.
- **/admin, /review, and /api/review** now require an admin session even for reads (the review API previously had none — anyone could list and approve/reject claims).
- **Rate limiting extended** to all public write endpoints (login 10/min, feedback 5/min, search-miss 5/min, subscribe 5/min, bookmarks 30/min per IP) and is now method-aware.
- Admin Bearer comparison is hash-then-compare (Edge runtime has no `timingSafeEqual`).

### 3. Route-level guards added (defense in depth)
`requireAdminOrDev` added to every mutation handler: claims (create/update/topics), edges, meta-edges, sources, threshold-events, review approve/reject, and all book routes (upload, ingest, match, reasons, request-analysis — the last had **no auth at all** and let anyone trigger Telegram messages to you). Existing `isReadOnly()` and passphrase checks were kept as additional layers.

### 4. SQL injection hardening
- `app/api/foreign-legislation` and `app/api/retractions`: user search input was interpolated into `ILIKE` clauses with hand-rolled quote escaping. Now passed as bind parameters with LIKE-wildcard escaping. (Likely not exploitable on Postgres defaults, but interpolation + manual escaping is exactly how injections are born.)
- `app/api/curve-stats`: ID list interpolated into an `IN (...)` clause → bind parameters.
- `app/api/prereq-graph`: `?domain=constructor` crashed the route via prototype-chain lookup → `Object.hasOwn` guard.

### 5. Input validation & abuse limits
- `/api/feedback`: malformed JSON no longer 500s; email capped at 254 chars, pageContext at 300.
- `/api/subscribe/topic`: email/keyword/label length caps + control-character stripping (label flows into an email subject line).
- `/api/login`: malformed JSON handled; admin cookie lifetime reduced to 7 days (site cookie stays 30).
- Login now works with only `ADMIN_TOKEN` set (previously required `SITE_PASSWORD`, which would have locked you out of /admin after launch).

### 6. Headers & dependencies
- Added `Strict-Transport-Security` (2 years, includeSubDomains).
- `npm audit fix` applied (brace-expansion, moderate). Production dependencies: **0 vulnerabilities**.

## Launch checklist (your actions)

1. **Vercel env vars**: unset `SITE_PASSWORD` (this is what makes the site public). Set a long random `ADMIN_TOKEN` (32+ chars — it's now your only key to /admin, /review, and remote writes). Keep `CRON_SECRET` and `BOOK_UPLOAD_PASSPHRASE` set and strong. Leave `ALLOW_EDITS` unset.
2. **Log in at `/login` with your ADMIN_TOKEN** to use admin/review pages. Scripts hitting write APIs need an `Authorization: Bearer <ADMIN_TOKEN>` header now.
3. Verify after deploy: `/admin/feedback` redirects to login when logged out; `POST /api/claims` returns 401; `GET /api/ingest/scotus` without the cron bearer returns 401.

## Known remaining risks (accepted or your call)

- **xlsx (high, no fix available)**: dev-only dependency used in one local script (`scripts/ingest-sipri-milex.ts`); never runs on the server. Only parse SIPRI files from the official source, or swap to `exceljs` if you want it gone.
- **Rate limiting is per-Edge-isolate** (in-memory): it deters casual abuse, not distributed attacks. For real limits use Vercel WAF rules or Upstash Ratelimit.
- **Admin cookie is a static hash of ADMIN_TOKEN** with no server-side revocation — rotating the token invalidates all sessions; do that periodically and after any suspected leak.
- **Topic subscribe has no double opt-in**: someone can subscribe an email they don't own (rate-limited, unsubscribe link included). Fine at small scale; add confirmation emails if it grows.
- **CSP includes `unsafe-eval`/`unsafe-inline`** (needed by Next RSC streaming and the three.js globe). Acceptable; revisit with nonces if you ever handle sensitive user data.
- **If you open-source the repo**: history is clean (verified), but the planning docs (CONSULTANT.md, ROADMAP.md, etc.) reveal infra details and a Telegram chat ID baked into two routes — consider trimming. Also delete the stray `scripts/ingest-loc-collections.ts.bak` and `scripts/scripts/` cruft.

## Verification performed

`tsc --noEmit`: zero errors in all new/modified code (remaining errors are pre-existing and caused by the gitignored generated Prisma client being absent in the review sandbox). ESLint clean on all touched files. `npm audit --omit=dev`: 0 vulnerabilities.
