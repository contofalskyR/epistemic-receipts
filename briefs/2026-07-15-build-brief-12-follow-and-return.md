# Build Brief #12 — Follow & return (the retention loop)

**To:** RobClaw / Fable on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-15)
**Lane:** site. **Timing: now — post-launch.** Publicity brings a wave; this brief is the machinery that turns one-time visitors into returning ones. It closes the last MATERIAL-QUEUE site item (`follow-ui`) — note that in the report so the next tick marks it.

**Most of the machinery already exists — this brief is composition, not invention:** `TopicSubscription` (email, unsubscribe tokens, confirmed flag, frequency), Resend delivery in `app/api/cron/topic-alerts/route.ts` (needs `RESEND_API_KEY`), `auth()` + entitlements on `/api/alerts`, anonymous-UUID bookmarks already surfaced as "bookmarked claim activity" in `/feed`, and `lib/dormancy.ts`/feed recency queries for "what moved."

---

## 0. Gate + orientation

1. Read the newest fable-handoff file in the workspace first — current-state doc; it wins over this brief on repo state. Sync main. Orientation protocol.
2. Read: `prisma/schema.prisma` (TopicSubscription, Bookmark, User/entitlements), `app/api/alerts/*`, `app/api/cron/topic-alerts/route.ts`, `app/alerts/`, `app/bookmarks/`, `/feed`'s bookmark-activity section, `briefs/2026-07-14-b8-report.md` **write-path sweep results** — they determine everything about how follows behave on the public edition.
3. Standing rails: branch `loop/site-b12-<date>` (work in a dedicated worktree, er-* pattern), `B12-n:` commits, push + PR, owner merges. No DB writes by you; user-initiated writes through existing/new API routes are the feature, and any **schema change is an owner-gated migration** under the CONSULTANT.md Migration Runbook. The corpus promoter loop on the owner's Mac is untouchable; STOP on lock contention.

## Phases

### B12-1 — Census + design note (≤1 page, owner-reviewed BEFORE code)

Three design questions have multiple viable answers — census first, then propose, then STOP for owner review:

1. **What is a "follow"?** Options: (a) elevate anonymous bookmarks into follows (zero schema change, no email until claimed), (b) a new additive `Follow` table (userId-or-anonKey, entityType ∈ {claim, trajectory, topic, domain, story}, entityId — one small migration), (c) keyword-bridge into TopicSubscription (no schema change but lossy for claim-level follows). Recommend one; justify against what the census finds in bookmarks usage and the entitlements model.
2. **Where do follow-writes go on the public edition?** The public project runs a read-only DB role. Per the B8 sweep + PUBLISH-CHECKLIST's "decide per feature": scoped-writes role for exactly these tables, an API proxy to the lab deployment, or public-edition-degrades (follow = bookmark locally, email only for signed-in lab users). This is the crux decision — present options with the security tradeoff stated plainly; the owner picks.
3. **Delivery:** Resend path exists but is env-gated. If `RESEND_API_KEY` is absent/undecided, ship in-app (following page + feed section) and RSS-per-follow first; email becomes a flip, not a blocker. Confirmed-opt-in and unsubscribe tokens are non-negotiable wherever email ships.

### B12-2 — Follow affordances (after note approval)

A small `FollowButton` on claim pages, trajectory/settling-curve detail, topic pages, domain field guides, and story pages — same visual weight as CitationButton/EmbedButton, wired to whatever B12-1 decided. Anonymous-first (the bookmarks pattern); sign-in only where the decision requires it. No dark patterns: following never gates content.

### B12-3 — `/following` (one place, not three)

Unify the fragments: bookmarks view + topic subscriptions + new follows in one page ("Following"), with `/bookmarks` and `/alerts` redirecting or absorbed (their existing URLs keep working — permanent redirects). Each followed entity shows its latest status, `TrajectoryDepth`, and time-since-last-move (reuse `lib/dormancy.ts` patterns). Management: unfollow, frequency, email opt-in per B12-1's delivery decision.

### B12-4 — "What moved in what you follow"

The digest surface: a section at the top of `/feed` for follow-holders ("3 of your followed claims moved this week"), powered by the same recency queries the feed already runs, scoped to the follow set. If email shipped: the weekly Resend digest reuses this exact query module — one source of truth so page and email can't disagree. Honesty rules carry over: real transitions only, dated, no "activity" padding when nothing moved (an empty week renders nothing / sends nothing — never a filler email).

### B12-5 — Verification

tsc/ESLint/vitest green; follow→appear-in-following→unfollow round-trip on dev; the public-edition behavior matches the B12-1 decision exactly (re-run the relevant B8 write-path checks against the public URL); no-PII boundaries hold (emails never render anywhere public, never enter exports or /v1 — grep-verify); unsubscribe token path works end-to-end; rate limits apply to the new write routes; Vercel preview green on both projects' behavior.

## Report

`briefs/b12-report.md`: the design-note decisions as approved, what shipped per phase, the public-edition behavior table, email status (live / env-gated / deferred), queue-tick note for `follow-ui`, and the retention loop's one-line status: what a returning visitor now sees that they didn't last week.

## STOP conditions

Design note unapproved; any schema migration without its owner yes; follow-writes wanting a broader DB role than the decision granted; email without confirmed opt-in + unsubscribe; promoter-loop contention; two consecutive failures on one criterion. Blocked beats invented.
