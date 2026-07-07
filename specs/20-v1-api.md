# Spec 20 — /v1 Public API

Phase 2 · Depends on: 00, 11 · Model: **Opus 4.8** · Scope: ~1–2 weeks of agent sessions

## Objective
A stable, read-only, keyed, metered, documented API surface — separate contract from the site's internal `/api/*` routes. Flagship endpoints: `retractions/since` and `verify`.

## Design (decided)
- Routes live under `app/api/v1/*` so the existing deny-by-default middleware covers them (all GET; any non-GET 401s by design).
- Stability contract: `/v1` shapes never break; additive changes only; deprecations announced in a `/v1/changelog` endpoint + docs page.
- **Auth:** `ApiKey` model — `{ id, orgName, contactEmail, keyHash (sha256), tier: 'free'|'pro'|'team'|'enterprise', createdAt, revokedAt?, lastUsedAt }`. Raw key shown once at creation (`er_live_` prefix + 32 random bytes, base58). Admin-only creation endpoint + `/admin` UI section. Free tier requires a key too (attribution enforcement + abuse control) — keyless requests get 401 with a helpful JSON body pointing to signup.
- **Rate limiting & metering must be distributed** — in-memory counters are wrong on Vercel. Use Upstash Redis (REST): sliding-window per key (free 60 req/min / 10k/day; pro 600/min; team 3000/min; enterprise custom) + a daily usage hash `usage:{keyId}:{yyyymmdd}` per endpoint. Nightly cron flushes usage hashes → Postgres `ApiUsage` rows (keyId, date, endpoint, count) for billing (Spec 21) and deletes flushed hashes. Fail-open on Redis outage for reads (availability > enforcement for a read-only API), log loudly.
- **Read isolation:** all /v1 handlers use a second Prisma client on `DATABASE_URL_READ` (Neon read replica; falls back to primary if unset). Never the primary client.
- **Caching:** `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` on detail endpoints; ETag from `updatedAt`; list endpoints s-maxage=300. Claim detail responses are effectively immutable — lean on Vercel CDN.
- Pagination: opaque cursor = base64(`createdAt|id`), `limit` ≤ 200. No offset pagination anywhere.
- Errors: RFC 7807 JSON (`type`, `title`, `status`, `detail`).

## Endpoints
| Route | Returns |
|---|---|
| `GET /v1/claims` | filter: `pipeline`, `epistemicAxis`, `claimType`, `verificationStatus`, `emergedAfter/Before`, `topic`; cursor-paginated |
| `GET /v1/claims/{id}` | claim + provenance block (pipeline, verification fields) + edges (with sources) + statusHistory + relations + topics |
| `GET /v1/sources/{id}` · `GET /v1/sources` | source + credibility events + relationships |
| `GET /v1/trajectories/{claimId}` | ordered ClaimStatusHistory + marker sources + snapshots |
| `GET /v1/search?q=` | hybrid tsvector (+ vector when Spec 50 lands) over claims; same shape as claims list + rank |
| `GET /v1/retractions/since/{date}` | retraction claims (crossref_retractions_v1 + retraction_watch_v1) with `createdAt > date` OR retraction-date metadata > date — check which field carries retraction date in those pipelines and document; include DOI, original paper metadata, CONTRADICTS edge targets |
| `GET /v1/verify?statement=` | statement (≤ 500 chars) → top-10 nearest claims: tsvector rank now, hybrid after Spec 50; each with provenance grade (see below), epistemicAxis, receipts summary (edge counts FOR/AGAINST/CONTRADICTS), statusHistory summary, link |
| `GET /v1/manifest` | already built in Spec 11 — move under the same auth-optional policy (manifest stays keyless) |
| `GET /v1/changelog` | static JSON of API changes |

**Provenance grade** (deterministic, documented in response + methodology page): A = humanReviewed with ≥2 primary sources · B = verified pipeline + ≥1 primary source edge · C = autoApproved bulk, no edges · D = PROVISIONAL · X = DEPRECATED (always disclosed, never hidden). No truth scoring — this grades *documentation depth*, and the docs must say exactly that.

## Docs
OpenAPI 3.1 spec generated from zod schemas (define request/response schemas in `lib/v1/schemas.ts`, single source of truth for validation + spec). Docs page `/docs/api` (Scalar or Stoplight embed) + quickstart with curl examples.

## Out of scope
Billing (Spec 21). Write endpoints of any kind. `/ask`-style synthesis. GraphQL.

## Acceptance criteria
- Zero non-GET methods succeed under `/api/v1` even with a valid API key (admin creds ≠ API key; keys never grant writes).
- Rate limit provably enforced across concurrent serverless instances: load test (autocannon/k6, 2 regions or 50 concurrent) shows 429s at the configured threshold ±5%, and Redis counters match request totals.
- `verify` endpoint: 20-statement golden file (write it: 10 statements matching known claims incl. 2 case studies, 5 near-misses, 5 nonsense) — expected top-1 claim id asserted for the 10 matches; nonsense returns results with low rank, never errors.
- ETag/304 behavior verified with curl. p95 < 300ms on cached detail reads, < 800ms uncached search (measure, paste numbers).
- OpenAPI spec validates (spectral lint) and every documented endpoint exists with the documented shape (contract test in CI iterating the spec).
- SQL injection attempt corpus (10 payloads) against every string filter returns clean 200/400s — no 500s, no data anomalies (extend CI suite).
- Usage flush cron reconciles: Redis totals vs ApiUsage rows for a test day match exactly.

## Verification
Paste: load-test output with 429 counts · golden-file test run · contract-test run · latency numbers · injection-suite run.
