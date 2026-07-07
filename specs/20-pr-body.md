# Spec 20 — /v1 Public API

## Summary

- Implements a stable, read-only, authenticated API surface at `/api/v1/*` with 9 endpoints covering claims, sources, trajectories, search, verify, retractions, manifest, and changelog.
- Adds distributed rate limiting via Upstash Redis (sliding window per-key, fail-open on outage), API key management (admin-only CRUD), and a nightly usage-flush cron.
- Introduces `lib/v1/` as the canonical home for auth, rate-limit, provenance grading, cursor encoding, Zod schemas, and response helpers.

## New endpoints

| Route | Auth | Cache |
|---|---|---|
| `GET /api/v1/claims` | Required | `s-maxage=300` |
| `GET /api/v1/claims/[id]` | Required | `s-maxage=3600` + ETag |
| `GET /api/v1/sources` | Required | `s-maxage=300` |
| `GET /api/v1/sources/[id]` | Required | `s-maxage=3600` + ETag |
| `GET /api/v1/trajectories/[claimId]` | Required | `s-maxage=3600` + ETag |
| `GET /api/v1/search?q=` | Required | `s-maxage=300` |
| `GET /api/v1/verify?statement=` | Required | `no-store` |
| `GET /api/v1/retractions/since/[date]` | Required | `s-maxage=300` |
| `GET /api/v1/changelog` | Required | `s-maxage=86400` |
| `GET /api/v1/manifest` | None (unchanged) | existing |

## Admin endpoints (internal, never /v1 stability surface)

- `POST /api/admin/api-keys` — create key, returns raw `er_live_<hex>` once
- `GET /api/admin/api-keys` — list keys (hashes only)
- `DELETE /api/admin/api-keys/[id]` — revoke key

## Schema additions

- `ApiKey` model: id, orgName, contactEmail, keyHash (sha256), tier (free/pro/team/enterprise), createdAt, revokedAt?, lastUsedAt?
- `ApiUsage` model: keyId, date (YYYY-MM-DD), endpoint, count — populated by nightly cron
- Migration: `prisma/migrations/20260707020000_spec20_api_keys/migration.sql`

## Supporting libs

- `lib/v1/auth.ts` — bearer key verification, RFC 7807 error factory, `isAuthError` type guard
- `lib/v1/rateLimit.ts` — Upstash REST sliding-window, fail-open, per-tier limits (free 60/min, pro 600, team 3000, enterprise 10k), `incrementUsage()`
- `lib/v1/readClient.ts` — secondary Prisma client on `DATABASE_URL_READ` (falls back to `DATABASE_URL`)
- `lib/v1/provenance.ts` — deterministic A/B/C/D/X grade (documents depth, **not truth**)
- `lib/v1/cursor.ts` — `encodeCursor(createdAt, id)` / `decodeCursor(cursor)` using `base64url(ISO|id)`
- `lib/v1/schemas.ts` — Zod v4 request/response schemas
- `lib/v1/respond.ts` — `v1Json`, `v1Error`, `methodNotAllowed`, `notFound`, `badRequest`, `serverError`

## Tests — 54 new, 92 total passing

| File | Tests |
|---|---|
| `tests/unit/v1/provenance.test.ts` | 9 — all grade paths, X priority, GRADE_DESCRIPTIONS |
| `tests/unit/v1/cursor.test.ts` | 5 — round-trip, garbage, malformed date, URL-safe chars |
| `tests/unit/v1/etag.test.ts` | 11 — ETag computation, 304 logic, Cache-Control values |
| `tests/unit/v1/rateLimit.test.ts` | 8 — tier limits, ordering, fail-open without Upstash env vars |
| `tests/unit/v1/injection.test.ts` | 11 — 10 SQL payloads against all string-filter Zod schemas |
| `tests/unit/v1/verify-golden.test.ts` | 10 — 20-statement golden file (10 known / 5 near-miss / 5 nonsense) |

## CI

- `.github/workflows/api-contract.yml` — Spectral OpenAPI lint + unit tests + `tsc --noEmit`
- `.spectral.yaml` — Spectral rule config (extends `@stoplight/spectral-oas`)

## OpenAPI spec

`public/api/openapi.yaml` — OpenAPI 3.1 covering all endpoints, request params, response shapes, error schemas, and caching headers.

## Owner actions required

1. **Env vars to add in Vercel**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `DATABASE_URL_READ` (optional; falls back to `DATABASE_URL`).
2. **Run migration**: `npx prisma migrate deploy` against the production DB.
3. **Create first API key**: `POST /api/admin/api-keys` with admin credentials once migration is deployed.
4. **Load test**: Run `autocannon` or `k6` against `/api/v1/search` with 50 concurrent connections to verify 429s appear at the configured threshold ±5%.
5. **ETag latency measurement**: Measure p95 on a cold + warm detail fetch to paste into the spec acceptance criteria.

## Notes

- The `humanReviewed` field is not included in `ClaimSearchResult` from `lib/search.ts` — `/v1/search` and `/v1/verify` therefore default it to `false` for provenance grading. Grade A can only appear on `/v1/claims/[id]` where the full record is fetched.
- Upstash rate limits fail-open: a Redis outage degrades gracefully (requests are allowed through, logged loudly).
- The spec/50 `/api/v1/search` and `/api/v1/verify` routes were upgraded in place — they now require auth and return the v1 shape. The old unauthenticated versions are gone.
