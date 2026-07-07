# Spec 30 — Accounts, Orgs, Entitlements, SSO

Phase 3 · Depends on: 00 · Model: **Opus 4.8** · Scope: ~1–2 weeks of agent sessions
Auth architecture is the costliest thing to get wrong. Follow the decisions below; log disagreements as open questions rather than deviating.

## Objective
Real user accounts and organizations with entitlements, without disturbing the three auth systems that already work: admin token (ops), API keys (Spec 20), anonymous Profile (bookmarks). Institutional buyers need org seats, IP-range access, SSO, and usage reports.

## Design (decided)
- **Auth.js v5** (not Clerk — no per-MAU cost at library scale; WorkOS added later only for SAML). Email magic-link via Resend as the only login method at launch (no passwords to store, matches existing Resend usage). Database sessions via Prisma adapter.
- New models: `User` (email, name?, createdAt), `Org` (name, slug, tier, seats; extends/merges the billing Org from Spec 21 — single table, coordinate), `Membership` (userId, orgId, role: owner|admin|member), `OrgIpRange` (orgId, cidr, label), `OrgUsageDaily` (orgId, date, metric, count). `ApiKey` gains `orgId` FK.
- **Profile migration path:** on first login, if the browser carries an anonymous profile key, offer one-click claim: link `Profile.userId` (new nullable FK) → bookmarks/subscriptions follow the user. Never auto-merge without consent; never orphan existing anonymous profiles.
- **Entitlements:** single `lib/entitlements.ts` — `can(user|org, feature)` reading tier. Features at launch: `alerts.max` (free 3 / org 50), `collections.max`, `export.citations` (org only), `export.bulk` (tier ≥ pro), `api.keys` (org admins). Every gate goes through this module — no inline tier checks scattered in routes.
- **IP-range access** (the library pattern): middleware checks request IP against `OrgIpRange` (cache table in memory per instance, 5-min TTL); match → request context gets org-level entitlements WITHOUT a user session (reading + citation export; personal features still require login). CIDR matching via a small vetted lib, IPv6 included. Admin UI for ranges; validate ranges (reject 0.0.0.0/0 and anything broader than /16 without a confirm flag).
- **SSO:** stub now, build when first customer asks — add WorkOS-ready fields (`Org.ssoConnectionId?`) and an `/auth/sso` route returning "contact us." Do not integrate WorkOS speculatively.
- **Usage reports:** `OrgUsageDaily` incremented (Redis, flushed nightly — reuse Spec 20 plumbing) for: page views under org access, searches, citation exports, API calls (join from ApiUsage). Monthly report page `/org/usage` + CSV download (COUNTER-inspired columns: metric, month, count — actual COUNTER compliance is out of scope, note for later).
- Security: admin token system untouched. New session cookies: httpOnly, secure, sameSite=lax. Login route rate-limited + in `PUBLIC_WRITE_PATHS`. Magic-link tokens single-use, 15-min expiry. All new mutation routes: `requireAdminOrDev` replaced by session checks ONLY for user-owned resources (ownership asserted in every query's WHERE, not in app logic afterward).

## Deliverables
1. Migrations + models above; Auth.js wiring; login/logout UI (minimal, matches site style).
2. Org admin pages: members (invite by email), IP ranges, usage, API keys (surface Spec 20 admin creation for org admins on their own org).
3. Profile-claim flow.
4. Entitlements module + gates on existing features (alerts count, bookmarks→collections cap when Spec 31 lands).
5. `docs/runbooks/orgs.md`: provisioning an institutional org end-to-end (create, seats, IP ranges, invoice note pointing to Spec 21 manual path).

## Out of scope
SAML/OIDC integration, password auth, 2FA, COUNTER compliance, self-serve org signup (orgs are provisioned by admin at this stage — deliberate: sales-led).

## Acceptance criteria
- Auth matrix test in CI: {anonymous, user, org-member via session, org via IP-range, admin} × {read site, personal features, org features, admin routes} — every cell asserted.
- IP-range: request from a configured CIDR (simulate via header only in dev/test; real IP in prod — document Vercel IP header handling honestly, incl. spoofing considerations: trust `x-real-ip` from Vercel only) gets org reading access without login; adjacent IP does not.
- Profile claim: anonymous bookmarks visible after claim; declining leaves them anonymous; no cross-user leakage (test two users, same browser sequence).
- Magic link: reuse → rejected; expired → rejected; both tested.
- Ownership enforcement: user A cannot read/modify user B's collections/subscriptions by ID manipulation (explicit tests).
- Existing admin flows and anonymous bookmarks work unchanged (regression tests).

## Verification
Paste: auth-matrix test output, IP-range demo, ownership-attack test output.
