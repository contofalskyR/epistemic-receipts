# B12 Report — Follow & return (the retention loop)

**Branch:** `loop/site-b12-2026-07-16` · **Date:** 2026-07-16

## Design decisions (as approved)

- **Q1 — What is a "follow" → (b) new polymorphic `Follow` table.** `profileId` + `entityType` ∈ {claim, trajectory, topic, domain, story} + `entityId`, unique per (profile, entity), cascade on profile delete. Additive-only migration prepared at `prisma/migrations/20260716140000_add_follow/migration.sql` — **NOT executed** (owner-gated migration window).
- **Q2 — Public-edition writes → scoped-writes DB role.** Exact GRANTs in `docs/runbooks/er_scoped_writes.sql`: INSERT/UPDATE/DELETE on `Profile`/`Bookmark`/`Follow` only, SELECT everywhere else, **no access at all** to `TopicSubscription`/`ClaimSubscription` (email-bearing). All new write routes rate-limited twice (middleware + in-route).
- **Q3 — Delivery → in-app + RSS first, email later.** /following page, /feed digest, personal RSS. No email wiring; `RESEND_API_KEY` remains unset — email is a later env flip, not a blocker. Copy audit done: no surface promises email anymore.

## What shipped per phase

**B12-2 (`9b45501`) — Follow affordances**
- `Follow` model in `prisma/schema.prisma` + prepared migration (not run).
- `POST/DELETE /api/follow` (body `{key, entityType, entityId}`), `GET /api/follow/check`, `GET /api/follow` (resolved list for /following). entityType validated at the API layer; in-route rate limit 30 writes/10 min/IP (feedback-route pattern).
- Anonymous-first: same hashed-profile-key contract as bookmarks (client UUID in localStorage, SHA-256 hash in DB). Following never gates content.
- `FollowButton` (`app/components/FollowButton.tsx`) on claim detail, settling-curve detail, and topic pages — same visual weight as CitationButton/BookmarkToggle.
- Copy audit: replaced the email-promise `FollowClaim` component (claim pages) and the topic-page email "Watch" box with FollowButton; homepage "get an email when it moves" → "see every move". The privacy-page sentence about topic email alerts stays — it is a factual data-handling disclosure for the lab's existing TopicSubscription, not a promise.
- `docs/runbooks/er_scoped_writes.sql` (Q2 role).

**B12-3 (`da4cc92`) — /following**
- One unified page: follows grouped by type (Claims, Trajectories, Topics, Domains, Stories) + Bookmarks, each with current epistemic status and time-since-last-move; inline unfollow.
- Deprecated/deleted entities render a grayed "this claim was deprecated" card with an unfollow affordance — never a broken link.
- Profile-key copy/restore ported from /bookmarks; personal RSS link.
- Permanent redirects: `/bookmarks` → `/following`, `/alerts` → `/following`. `/following` added to `PUBLIC_ROUTES`.

**B12-4 (`ecaf622`) — "What moved" digest + RSS**
- `FollowingActivity` at the top of /feed: "N of your followed claims moved this week" with the transition (from → to axis, dated). Empty week → renders nothing (no filler).
- `GET /api/feed/following` (7-day window) and `GET /api/feed/following.rss` (90-day window) share one query module, `lib/following.loadFollowingMoves` — page and feed can't disagree. Real recorded transitions (`ClaimStatusHistory`) only, keyed on recordedAt for recency, displaying occurredAt as the dated move.
- RSS is keyed on the reader's existing unguessable anonymous profile key (client-generated UUID; only its hash is stored) — not a predictable ID.

**B12-5 — Verification + middleware fix**
- Middleware fix (caught by the B8-3 probe): the global write gate 401s any non-allowlisted API mutation — added `/api/follow` to `PUBLIC_WRITE_PATHS`, the middleware rate-limit rules (30/min/IP on POST/DELETE), and the SITE_PASSWORD pass-through (same class as /api/bookmarks). Without this, production POST /api/follow would have been dead on arrival.

## Verification results

| Check | Result |
|---|---|
| tsc | Clean on `tsconfig.b12-check.json` (all touched files). **Full-repo `tsc --noEmit` OOMs on this 3.8 GB VPS** (exit 137, same constraint B11d hit — precedent: scoped check-only tsconfigs). Vercel build is the full-repo check. |
| eslint | 0 errors on all touched files (4 pre-existing warnings in `app/topics/[slug]/page.tsx`, untouched pattern). |
| Follow round-trip | Partially blocked: the `Follow` table cannot exist until the owner-run migration, and DB writes are owner-gated — so the full follow→/following→unfollow round-trip **cannot run pre-window**. Verified on dev instead: /following renders (200), GET /api/follow → `{"follows":[]}`, check → `{"followed":false}`, POST validation 400s, entityType whitelist enforced, 31st POST → 429, DELETE → 429 while limited. |
| Email-promise grep | Only remaining hit is the privacy-page data-handling disclosure (kept deliberately). |
| RSS token | Uses the anonymous profile key (unguessable UUID, hash-only storage). Empty/invalid key → empty valid RSS. |
| Rate limits | Two layers on POST/DELETE /api/follow: middleware 30/min/IP + in-route 30/10min/IP. |
| B8-3 public URL | `POST https://epistemic-receipts.vercel.app/api/follow` → **401 Unauthorized** (middleware write gate — clear error, no silent failure); GET routes → 404 (branch not merged yet, expected). Post-merge, pre-window: POST will return the in-route 503 "Follows are not enabled on this edition yet." |
| No PII | `grep -r email app/api/follow/ app/following/` → zero hits. Follow API responses and /following carry no emails. |
| Redirects | /bookmarks → 308 → /following; /alerts → 308 → /following (dev-verified). |

## Public-edition behavior table

| Capability | Works now (pre-window) | Needs migration window | Needs RESEND_API_KEY |
|---|---|---|---|
| Read everything, no gating | ✅ | | |
| Follow button renders, never gates content | ✅ (POST returns clear 503/401 until window) | | |
| Follow/unfollow persists | | ✅ migration + `er_scoped_writes` role + public `DATABASE_URL` swap | |
| /following page | ✅ renders; shows bookmarks | ✅ for follow rows | |
| /feed "what moved" digest | ✅ renders nothing (honest empty) | ✅ for real content | |
| Personal RSS | ✅ valid empty feed | ✅ for items | |
| Email digests / alerts | ❌ deferred | | ✅ (plus confirmed opt-in + unsubscribe, non-negotiable) |

## Migration ping

**Migration ready in `prisma/migrations/20260716140000_add_follow/migration.sql` — owner must run a migration window before /api/follow writes work in prod.** In the same window, run `docs/runbooks/er_scoped_writes.sql` (after the migration — its Follow GRANTs fail if the table is missing, by design), then point the public project's `DATABASE_URL` at `er_scoped_writes`.

## Email status

Env-gated, deferred. No email code was wired; nothing promises email anywhere on the site.

## Queue + gap notes

- **MATERIAL-QUEUE:** `follow-ui` is the last open site item — this brief closes it; next material tick should mark it done.
- **B8 gap:** the B8 write-path sweep report (`briefs/2026-07-14-b8-report.md`) was never written; the B8-3 write-path checks were folded into B12-5 above (public-URL probe results recorded).

## Retention status (one line)

A returning visitor now has a Follow button on every claim, curve, and topic, one /following page holding everything they saved (with status and time-since-last-move), a "what moved this week" digest at the top of /feed, and a personal RSS feed — last week they had scattered bookmarks and an email form that never sent anything.
