# PR: spec/30 → main
# spec/30: Accounts, Orgs, Entitlements, SSO (Auth.js v5 + Prisma + magic-link)

## Summary

- **Auth.js v5** (next-auth@beta) wired with PrismaAdapter and Resend magic-link provider; database sessions; httpOnly/secure/sameSite=lax cookies; 15-min single-use tokens
- **Prisma schema**: User, Account, Session, VerificationToken (adapter tables); Org, Membership, OrgIpRange, OrgUsageDaily; Profile.userId + ApiKey.orgId nullable FKs; WorkOS `ssoConnectionId` stub; Spec 21 Stripe stubs
- **`lib/entitlements.ts`**: `can(ctx, feature)` with tier table (free/pro/team/enterprise); org context wins; no inline tier checks in routes
- **IP-range access**: pure-JS CIDR matching (`lib/cidr.ts`, Edge-safe), 5-min per-isolate cache in middleware, `x-org-id`/`x-org-tier` header injection
- **Org admin routes**: members (invite via Resend, seat limit), ip-ranges (validateCidr guard), usage (JSON + CSV), profile claim/unclaim
- **Org admin pages**: members, ip-ranges, usage, api-keys (entitlement-gated)
- **Tests**: 24 CIDR cases, 16 entitlement cases, 24 auth-matrix cases (mocked auth/prisma)
- **Runbook**: `docs/runbooks/orgs.md`

## Hard invariants

- Admin token system (`lib/adminAuth.ts`, `admin_auth` cookie) untouched
- No SAML/OIDC, no password auth, no self-serve org signup (admin-provisioned only)
- WorkOS: `ssoConnectionId` field only — no integration
- `ALLOW_EDITS` never set; no production env vars changed

## Open questions (from `specs/30-design-note.md`)

- **OQ-1**: Spec 21 Org coordination — Org table has Stripe stubs; Spec 21 should add indexes/relations rather than creating a second Org table
- **OQ-2**: Redis future swap for OrgRange cache (currently module-level per-isolate)
- **OQ-3**: x-real-ip trust boundary (currently preferred; assumes Vercel sets it before client headers reach middleware)
- **OQ-4**: Email template for magic-link (using Resend default)

## Test plan

- [ ] `npx prisma validate` passes (validated locally)
- [ ] `npm test tests/unit/spec30/` — cidr, entitlements, auth-matrix
- [ ] Sign in at `/auth/signin` with a real email → magic link → session cookie set
- [ ] `POST /api/user/claim-profile` with authenticated session → profile linked
- [ ] `GET /api/org/<id>/members` with member session → 200; with no session → 401
- [ ] `POST /api/org/<id>/ip-ranges` with admin session → CIDR stored; `/15` without confirmFlag → 422
- [ ] Request from IP in org range → `x-org-id` header in downstream request

## Commits on this branch (beyond main)

- `643fb4d` spec/30: implement Accounts, Orgs, Entitlements, SSO (full) — 26 files, 1831 insertions
- `67fe765` spec/30: Accounts, Orgs, Entitlements, Auth.js v5, IP-range access (package.json + lock)
- `3923bc4` spec/30: add design note (checkpoint before implementation)

Branch: `spec/30` → base: `main`
Repo: contofalskyR/epistemic-receipts
