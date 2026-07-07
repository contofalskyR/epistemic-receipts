# Runbook: Litigation Workbench

## Overview

The Litigation Workbench lets org members track evidentiary claims, their provenance chains, and status changes for use in litigation or regulatory proceedings. It is available to **Team and Enterprise** orgs.

---

## Creating a matter

### Via the UI

1. Navigate to `/org/<orgId>/litigation`
2. Click **New matter**
3. Enter a name, and optionally a jurisdiction, case number, and description
4. Click **Create**

### Via the API

```
POST /api/litigation/matters
Content-Type: application/json
Cookie: <session cookie>

{
  "orgId": "org_xxxxx",
  "name": "Smith v. ACME Corp",
  "jurisdiction": "S.D.N.Y.",
  "caseNumber": "24-cv-01234"
}
```

Returns the created `LitigationMatter` (status 201).

---

## Listing matters

```
GET /api/litigation/matters?orgId=org_xxxxx
```

Returns an array of `LitigationMatter` ordered by `createdAt` desc.

---

## Viewing a matter

```
GET /api/litigation/matters/<matterId>
```

Returns the matter plus a `claims` array, each item including claim text, epistemic axis, and provenance summary.

---

## Adding a claim to a matter

### Via the UI

1. Open the matter detail page at `/org/<orgId>/litigation/<matterId>`
2. Click **Add claim**
3. Paste the claim ID (visible on any claim detail page), select a relevance tag, and add optional notes
4. Click **Add claim**

### Via the API

```
POST /api/litigation/matters/<matterId>/claims
Content-Type: application/json
Cookie: <session cookie>

{
  "claimId": "clx_xxxxxxx",
  "relevanceTag": "key-fact",
  "notes": "Central to plaintiff's damages argument"
}
```

Valid `relevanceTag` values: `key-fact`, `rebuttal`, `background`, `supporting`, `disputed` (or any string).

---

## Removing a claim from a matter

```
DELETE /api/litigation/matters/<matterId>/claims/<claimId>
Cookie: <session cookie>
```

Returns `{ "ok": true }`.

---

## Running an export

### Via the UI

On the matter detail page, click **Export JSONL** or **Export CSV**. The export runs server-side, uploads to R2, and returns an export ID when complete.

### Via the API

```
POST /api/litigation/matters/<matterId>/export
Content-Type: application/json
Cookie: <session cookie>

{ "format": "JSONL" }
```

Valid formats: `JSONL`, `CSV`, `PDF` (PDF is a stub — returns `{ "status": "not_implemented" }`).

Response (201):
```json
{
  "exportId": "exp_xxxxx",
  "r2Key": "litigation/<matterId>/<exportId>.jsonl.gz",
  "sha256": "<hex digest>"
}
```

---

## Retrieving an export from R2

Exports are stored at:
```
R2_BUCKET / litigation / <matterId> / <exportId>.{jsonl|csv}.gz
```

Use a signed URL generated from the R2 client:

```typescript
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const url = await getSignedUrl(
  s3,
  new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: r2Key }),
  { expiresIn: 300 },
);
```

---

## Export format reference

### JSONL

One JSON object per line. Fields:

| Field | Type | Description |
|-------|------|-------------|
| `claimId` | string | Epistemic Receipts claim ID |
| `claimText` | string | Full claim text |
| `epistemicAxis` | string\|null | Current axis: RECORDED/SETTLED/CONTESTED/OPEN/UNRESOLVABLE |
| `epistemicStatus` | string\|null | Fine-grained status |
| `claimEmergedAt` | ISO 8601\|null | When the claim first emerged |
| `statusHistory` | array | All recorded status transitions, oldest first |
| `sources` | array | All non-deleted edges with their source metadata |
| `addedToMatter` | ISO 8601 | When this claim was added to the matter |
| `relevanceTag` | string\|null | User-assigned relevance tag |
| `notes` | string\|null | User notes |

### CSV

Flattened, one row per claim. Columns: `claimId`, `claimText`, `epistemicAxis`, `epistemicStatus`, `claimEmergedAt`, `statusHistoryCount`, `latestAxis`, `sourceCount`, `addedToMatter`, `relevanceTag`, `notes`.

Both formats are gzip-compressed. Verify integrity with:
```sh
echo "<sha256>  export.jsonl.gz" | sha256sum -c
```

---

## Entitlements

- Requires org tier **team** or **enterprise** (config in `lib/entitlements.ts`)
- Individual users with `tier: "team"` or `tier: "enterprise"` also qualify
- Gate enforced in all `/api/litigation/` routes and the UI

---

## Schema

| Table | Purpose |
|-------|---------|
| `LitigationMatter` | Top-level container; scoped to an org |
| `MatterClaim` | Join table: which claims belong to a matter |
| `MatterExport` | Audit log of every export, with R2 key + SHA-256 |

Migration: `prisma/migrations/20260707060000_spec40_litigation_workbench/migration.sql`
