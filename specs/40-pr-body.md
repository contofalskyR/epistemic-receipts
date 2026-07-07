# spec/40: Litigation Workbench

## Summary

- Adds `LitigationMatter`, `MatterClaim`, `MatterExport` Prisma models with full FK constraints, cascade deletes, and compound indexes
- Adds `'litigation'` entitlement (team+ users, all org contexts) to `lib/entitlements.ts`
- API routes under `/api/litigation/matters` for matter CRUD, claim management, and export triggering
- UI pages under `/org/[orgId]/litigation/` (matter list, matter detail, add-claim form)
- Streaming JSONL/CSV export to R2 with gzip + SHA-256 verification; PDF stub returns `{ status: 'not_implemented' }`
- 27 unit tests (entitlements × 10, export serializers × 17); migration at `20260707060000_spec40_litigation_workbench`

## What was built

### Schema (`prisma/schema.prisma`)

Three new models:
- **`LitigationMatter`**: org-scoped container (name, jurisdiction, caseNumber, status ACTIVE/CLOSED/ARCHIVED)
- **`MatterClaim`**: join table linking matters to claims with `addedBy`, `relevanceTag`, `notes`
- **`MatterExport`**: append-only export log recording R2 key + SHA-256 + format + exporter

Back-references added to `User` (`matterClaimsAdded`, `matterExports`) and `Org` (`litigationMatters`), and `Claim` (`matterClaims`).

### Entitlements (`lib/entitlements.ts`)

Added `"litigation"` to `Feature` type with config:
```
{ free: false, pro: false, team: true, enterprise: true, org: true }
```
Team+ individual users qualify; all org contexts get `true` (the org-level default).

### API routes (`app/api/litigation/`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/litigation/matters` | Create matter (requires `can(ctx, 'litigation')`) |
| GET | `/api/litigation/matters?orgId=` | List org matters |
| GET | `/api/litigation/matters/[matterId]` | Matter detail + claims |
| POST | `/api/litigation/matters/[matterId]/claims` | Add claim to matter |
| DELETE | `/api/litigation/matters/[matterId]/claims/[claimId]` | Remove claim |
| POST | `/api/litigation/matters/[matterId]/export` | Trigger JSONL/CSV/PDF export |

All routes: auth via `auth()` from `lib/auth.ts`, org membership check, `can(ctx, 'litigation')` gate.

### Export (`lib/litigation/export.ts`)

- Streaming cursor (batch 500) via `prisma.matterClaim.findMany` with `cursor`/`skip`
- JSONL: one object per claim with `{ claim, statusHistory, sources, trajectory, addedToMatter, relevanceTag, notes }`
- CSV: 11 flattened columns, header row, double-quote escaping
- Both: piped through `zlib.createGzip()`, uploaded via `@aws-sdk/lib-storage` Upload to `litigation/{matterId}/{exportId}.{ext}.gz`
- SHA-256 computed on the gzipped bytes and stored in `MatterExport.sha256`
- PDF: stub returning `{ status: 'not_implemented', message: 'PDF export coming soon' }`

### UI pages (`app/org/[orgId]/litigation/`)

- `page.tsx`: matter list with status badges, jurisdiction, case number; upgrade prompt for non-entitled orgs
- `[matterId]/page.tsx`: matter detail with claim list (epistemic axis badges, relevance tags, provenance notes), `MatterExportButton` client component
- `[matterId]/MatterExportButton.tsx`: client component with JSONL/CSV export buttons + loading/result state
- `[matterId]/new-claim/page.tsx`: client form to add a claim by ID with relevance tag + notes

### Tests (`tests/unit/spec40/`)

- `entitlements.test.ts`: 10 tests — all tier combinations for `can(ctx, 'litigation')` including org context
- `export.test.ts`: 17 tests — JSONL round-trip, field presence, null handling, CSV column counts, escape handling, axis extraction

### Runbook (`docs/runbooks/litigation.md`)

Covers: create matter (UI + API), list matters, add/remove claims, run export, retrieve from R2, format reference, entitlement tier docs.

## Test plan

- [ ] `npx vitest run --config vitest.config.ts tests/unit/spec40/` → 27 tests pass
- [ ] `npx tsc --noEmit` → no errors in new files (pre-existing spec/31 errors exempt per HANDOFF-OPENCLAW.md)
- [ ] Manual: create matter, add 2+ claims, trigger JSONL export, verify R2 key + SHA-256 in `MatterExport` table
- [ ] Manual: attempt to access with free-tier org → should see upgrade prompt
- [ ] Manual: PDF export returns `{ status: 'not_implemented' }`

## Open questions

1. **PDF export**: Spec says "stub is fine" — needs docx implementation in a follow-up (spec described `.docx` via `docx` npm package in the spec/40 source document).
2. **Presigned download URL**: The export API returns the R2 key; a separate endpoint to generate a signed download URL should be added (similar to `/v1/snapshots/[id]/download/route.ts`).
3. **Collection schema gap**: `spec/31` merged into `spec/40` but the schema merge conflict resolved without `Collection`/`CollectionItem` models — those are in the migration but not in `schema.prisma` HEAD of spec/40. This is a pre-existing issue; spec/40 code doesn't depend on Collection.
4. **Anachronism audit** (from spec/40.md): The temporal correctness of as-of views (the deeper feature described in the spec document) is NOT implemented here — this PR implements the matter/claim management layer (the "container" for evidence). The full as-of engine (`lib/asof.ts`, temporal queries) is a separate, larger body of work.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
