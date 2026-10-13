# Runbook: Orgs, Accounts, and Entitlements (Spec 30)

## Overview

Organisations are admin-provisioned. There is no self-serve sign-up flow. Users sign in via magic-link (email OTP). The admin panel (`/admin`) uses a separate token system and is not affected by these changes.

---

## Provisioning an Org

Run directly against the database (psql or Prisma Studio):

```sql
INSERT INTO "Org" (id, name, slug, tier, seats)
VALUES (gen_random_uuid(), 'Acme Corp', 'acme', 'team', 25);
```

Then add an owner membership:

```sql
INSERT INTO "Membership" ("userId", "orgId", role)
VALUES ('<user-cuid>', '<org-cuid>', 'owner');
```

The owner can then invite additional members via `/api/org/<orgId>/members`.

---

## Tiers

| Tier       | Alerts | Collections | Export citations | Bulk export | API keys |
|------------|--------|-------------|-----------------|-------------|----------|
| free       | 3      | 10          | ✗               | ✗           | ✗        |
| pro        | 10     | 50          | ✗               | ✓           | ✗        |
| team       | 25     | 200         | ✓               | ✓           | ✗        |
| enterprise | 50     | ∞           | ✓               | ✓           | ✓        |

Org admins always have `api.keys` access regardless of tier (for managing existing keys).

To upgrade a tier:

```sql
UPDATE "Org" SET tier = 'enterprise' WHERE slug = 'acme';
```

---

## IP-Range Access

IP ranges allow requests from a CIDR block to be automatically associated with an org, without sign-in.

- Ranges are cached in-memory per isolate with a 5-minute TTL.
- The middleware injects `x-org-id` and `x-org-tier` headers on matches.
- Minimum prefix: /16 for IPv4, /32 for IPv6, unless `confirmFlag` is set.
- To reload immediately: deploy (forces new isolates).

Add a range:

```
POST /api/org/<orgId>/ip-ranges
{ "cidr": "10.0.0.0/24", "label": "Office VPN" }
```

Remove a range:

```
DELETE /api/org/<orgId>/ip-ranges
{ "id": "<rangeId>" }
```

---

## Magic-Link Auth

Users sign in at `/auth/signin`. A magic link is emailed via Resend. Links expire in 15 minutes and are single-use (VerificationToken row deleted on use).

Session tokens: database-backed, httpOnly cookie, sameSite=lax.

To invalidate all sessions for a user:

```sql
DELETE FROM "Session" WHERE "userId" = '<user-cuid>';
```

---

## Profile Claim Flow

Anonymous profiles (created before sign-in) can be linked to a user account. Users are prompted on first login if they have unclaimed profiles.

- `POST /api/user/claim-profile` — links profile to authenticated user (consent-only)
- `DELETE /api/user/claim-profile` — unlinks profile (leaves it anonymous)

A profile already claimed by another user returns `409 Conflict`.

---

## Seat Limits

Inviting a member checks `org.seats` against current member count. Increasing seats:

```sql
UPDATE "Org" SET seats = 50 WHERE slug = 'acme';
```

---

## WorkOS SSO (Stub)

`ssoConnectionId` is reserved for future WorkOS integration. It is stored but has no effect. Do not attempt SAML/OIDC flows — the integration is not implemented.

---

## Entitlements

All feature-gating goes through `lib/entitlements.ts`:

```typescript
import { can } from "@/lib/entitlements";
if (!can({ user: { tier: "pro" } }, "export.bulk")) {
  return NextResponse.json({ error: "Upgrade required" }, { status: 403 });
}
```

Never write inline tier checks. If a new feature needs gating, add it to the `TIER_TABLE` in `lib/entitlements.ts`.

---

## Usage Tracking

Use `incrementOrgUsage(orgId, metric)` from `lib/orgUsage.ts`. Org context (orgId, tier) is available from `getOrgContextFromHeaders()` when the request matched an IP range.

View usage: `/org/<orgId>/usage` or `GET /api/org/<orgId>/usage?format=csv&since=YYYY-MM-DD&until=YYYY-MM-DD`

---

## Incident: Org-Level Access Revocation

1. Remove the user's membership: `DELETE FROM "Membership" WHERE "userId" = '...' AND "orgId" = '...'`
2. Invalidate their sessions: `DELETE FROM "Session" WHERE "userId" = '...'`
3. If an IP range is compromised: remove via API or `DELETE FROM "OrgIpRange" WHERE id = '...'` — new isolates will not have the range (5-min TTL until cache expires).

---

## Related

- `lib/entitlements.ts` — feature gating
- `lib/cidr.ts` — CIDR matching
- `lib/auth.ts` — Auth.js v5 config
- `lib/orgAuth.ts` — `requireOrgRole()` helper
- `lib/orgUsage.ts` — usage increment helper
- `middleware.ts` — IP range check + org header injection
- `specs/30-design-note.md` — design decisions and open questions
