# B12 Design Note

*B12-1 census + recommendations, 2026-07-16. Read-only pass; no code written. Owner review gates B12-2.*

## Q1: What is a "follow"?

**Recommend option (b): a new additive `Follow` table.** Census says the existing primitives can't stretch: `Bookmark` is claim-only (`profileId` + `claimId`, anonymous via sha256-hashed client key on `Profile`), while `TopicSubscription`/`ClaimSubscription` are email-keyed — the wrong identity primitive for the anonymous-first UX the brief requires, and both have **zero rows**, so there's no installed base to preserve. The brief wants follows on five entity types (claim, trajectory, topic, domain, story); one polymorphic table reusing the proven `Profile` anonymous-key pattern covers all of them in a single small migration, and email delivery later becomes "attach a subscription when the user supplies an email" — the consent mechanics (confirmed flag, unsubscribe token, frequency) already exist and stay where they are.

## Q2: Where do follow-writes go on the public edition?

**Caveat first: `briefs/2026-07-14-b8-report.md` does not exist.** The write-path sweep was planned (launch-runbook step 8, assigned AGENT) but no report was ever committed, and CONSULTANT.md has no B8 entry. So the "sweep results" this decision was supposed to rest on are missing — what follows rests on PUBLISH-CHECKLIST §4 alone ("default is read-only; decide per feature: scoped-writes role or lab proxy").

**Recommend the scoped-writes Neon role**, granted INSERT/UPDATE/DELETE on exactly `Profile`, `Bookmark`, `Follow` (and later the two subscription tables if email ships publicly), SELECT elsewhere. Tradeoff stated plainly: a compromise of the public app could then spam junk rows into those specific tables, but it still physically cannot touch the corpus (claims, transitions, sources) — that's the asset the read-only role exists to protect, and rate limits on the write routes bound the spam. The lab-proxy alternative keeps the public role pure but adds a cross-deployment auth surface (a shared secret that, if leaked, grants lab-side writes) plus latency and coupling; degrade-to-localStorage makes the flagship retention feature second-class on the only site the public sees. Owner picks; I'd take the small, well-fenced write surface.

## Q3: Email delivery

`RESEND_API_KEY` is **not set anywhere I can see**: absent from `.env.local`, no `.env.example` in the repo, and every code path (`subscribe/topic`, `subscribe/claim`, both alert crons, `lib/billing/email.ts`) env-gates it and degrades with a console log — which is also the only "prod evidence": the code assumes it may be unset. The topic-alerts cron's real delivery today is the owner Telegram digest via the OpenClaw gateway. **Recommend shipping in-app (`/following` + feed section) and RSS-per-follow first; email is a flip, not a blocker** — schema (confirmed flag, unsubscribe tokens, frequency) and send code already exist, so turning email on later is one env var plus domain verification, with confirmed opt-in + unsubscribe already non-negotiable in the existing paths.

## Census numbers

- Bookmarks in DB: **1**
- TopicSubscriptions in DB: **0**
- ClaimSubscriptions in DB: **0**
- Profiles: 2 · Users: 0 · WatchedTopics (owner Telegram digest): 10
- Entitlements: `alerts.max` = 3 free / 10 pro / 25 team / 50 enterprise (auth-gated `/api/alerts` only; bookmarks are ungated/anonymous)
- Corpus promoter loop: no tmux session on this VPS (runs on owner's Mac per handoff) — untouched.

## Proposed schema change (if any)

One additive migration, owner-gated per the Migration Runbook: `Follow { id, profileId?, userId?, entityType: string ∈ {claim, trajectory, topic, domain, story}, entityId: string, createdAt }` with `@@unique([profileId, entityType, entityId])` and indexes on `(entityType, entityId)` and `userId`. No changes to existing tables.
