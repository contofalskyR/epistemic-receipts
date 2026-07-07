# Spec 30 Design Note — Accounts, Orgs, Entitlements, SSO

Written before any production code. Records architectural decisions and open questions.

---

## (a) Auth.js session vs existing admin token coexistence

Two auth systems coexist without interference:

**Admin token** (unchanged): `admin_auth` cookie or `Authorization: Bearer <ADMIN_TOKEN>` header, validated by `lib/adminAuth.ts` and `middleware.ts`. Guards `/admin`, `/review`, all mutation API routes not in `PUBLIC_WRITE_PATHS`. No changes.

**Auth.js v5 session** (new): `authjs.session-token` cookie — different name, different flow. Auth.js `/api/auth/*` routes added to `PUBLIC_WRITE_PATHS` (the magic-link POST and callback are write ops). User-session cookie is `httpOnly, secure, sameSite=lax`.

Middleware routing order (no conflicts):
1. Rate limiting (unchanged, new rules added for `/api/auth/*`).
2. Admin-path gate (unchanged).
3. **New — IP-range check**: resolve client IP → check OrgIpRange cache → if match, inject `x-org-id` + `x-org-tier` as request headers via `NextResponse.next({ request: { headers } })`. Downstream RSC/handlers read these to grant org-level entitlements without a session.
4. Global write gate (unchanged — `/api/auth/*` added to `PUBLIC_WRITE_PATHS`).

New user-owned resource routes (`/api/user/*`, `/api/org/*`) use Auth.js `auth()` session check internally, not admin token. Ownership enforced in `WHERE userId = session.user.id` clauses. Admin token continues to work for all its existing routes.

---

## (b) New Prisma models and FK relationships

**Single `Org` table** — forward-compatible with Spec 21's billing Org (if Spec 21 lands after this spec, it adds stripe fields via a new migration rather than creating a second Org table; if Spec 21 landed first, this spec would extend it):

```
User           id (cuid), email (unique), name?, emailVerified?, image?, createdAt
Account        id, userId→User, type, provider, providerAccountId, ... (Auth.js adapter)
Session        id, sessionToken (unique), userId→User, expires (Auth.js adapter)
VerificationToken  identifier, token (unique), expires (Auth.js adapter)

Org            id (cuid), name, slug (unique), tier (free|pro|team|enterprise default free),
               seats (default 5), ssoConnectionId? (WorkOS stub, nullable),
               stripeCustomerId? (stub for Spec 21), stripeSubscriptionId? (stub),
               pastDueSince? (stub), createdAt, updatedAt

Membership     userId→User, orgId→Org, role (owner|admin|member), createdAt
               PK [userId, orgId]

OrgIpRange     id (cuid), orgId→Org, cidr (string e.g. "192.168.1.0/24"), label,
               confirmFlag (bool default false — required to save /0 or prefix < /16),
               createdAt

OrgUsageDaily  id (cuid), orgId→Org, date (string YYYY-MM-DD), metric (string),
               count (int default 0)
               Unique [orgId, date, metric]

Profile        add userId? (nullable FK → User) — for claim flow; existing rows unaffected
ApiKey         add orgId? (nullable FK → Org) — org-scoped keys
```

---

## (c) Entitlements module interface (`lib/entitlements.ts`)

```typescript
type Tier = 'free' | 'pro' | 'team' | 'enterprise'
type EntitlementContext = {
  user?: { id: string; tier?: Tier } | null
  org?: { id: string; tier: Tier } | null
  isOrgAdmin?: boolean  // for api.keys feature
}
type Feature = 'alerts.max' | 'collections.max' | 'export.citations' | 'export.bulk' | 'api.keys'

// Returns number for max-type features, boolean for flag-type features.
// org context wins over user context when both present (IP-range session uses org only).
export function can(ctx: EntitlementContext | null, feature: Feature): boolean | number
```

Tier table:

| Feature           | free | pro  | team | enterprise | org (any tier) |
|-------------------|------|------|------|------------|----------------|
| alerts.max        | 3    | 10   | 25   | 50         | 50             |
| collections.max   | 10   | 50   | 200  | ∞          | ∞              |
| export.citations  | ✗    | ✗    | ✓    | ✓          | ✓              |
| export.bulk       | ✗    | ✓    | ✓    | ✓          | ✓ (tier≥pro)  |
| api.keys          | ✗    | ✗    | ✗    | ✓          | org admins only|

All gates go through `can()` — no inline tier checks in routes.

---

## (d) Middleware changes for IP-range access

**Cache structure** (module-level, per-isolate, best-effort like existing rate limiter):
```typescript
type OrgRangeEntry = { orgId: string; tier: string; cidr: string }
let ipRangeCache: OrgRangeEntry[] = []
let ipRangeCacheExpires = 0  // unix ms
const IP_RANGE_CACHE_TTL = 5 * 60 * 1000
```

**Per-request flow**:
1. `resolveClientIp(req)` → prefer `x-real-ip` (Vercel infrastructure header, not spoofable by clients); fall back to `x-forwarded-for[0]`.
2. If cache stale → query `OrgIpRange` joined to `Org` via Neon Edge-compatible Prisma client.
3. `cidrContains(cidr, ip)` → pure-JS CIDR matching utility (IPv4 + IPv6, no Node.js imports → Edge runtime safe).
4. First matching entry → `NextResponse.next({ request: { headers: new Headers({ 'x-org-id': entry.orgId, 'x-org-tier': entry.tier }) } })`.
5. No match → passthrough (session auth may still apply).

**CIDR validation** (admin save path): reject prefix length < 16 (i.e. /0–/15) unless `confirmFlag = true`. Reject /0 entirely (too broad). IPv4 and IPv6 parsed; invalid CIDR → 400.

---

## Open questions (record only — do not invent answers)

**OQ-1 (Spec 21 coordination)**: Spec 21 may not yet be built. This spec creates the `Org` model with stub stripe fields. If Spec 21 lands after this PR, the merge plan is: Spec 21's migration adds stripe fields to the existing `Org` table — no table duplication. Noted in runbook.

**OQ-2 (Redis for OrgUsageDaily)**: Spec 20's Redis flush plumbing may not be available. This spec uses direct DB upsert (`increment` in Prisma) for usage counting. Redis buffer can be layered in when Spec 20 is built. Note in runbook.

**OQ-3 (x-real-ip spoofing)**: `x-real-ip` is Vercel-injected on their edge network. Client requests cannot set it on Vercel's infrastructure (the header is overwritten). However, this should be documented honestly: if the deployment moves off Vercel or uses a custom proxy, the IP-trust model must be re-evaluated. Documented in runbook.

**OQ-4 (Magic-link email template)**: No brand design system spec provided. Using Resend with a minimal plain-text/HTML email matching site style. If a design system lands later, the template in `lib/auth.ts` can be updated without schema changes.
