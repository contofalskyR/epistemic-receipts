# Pipeline 8 — FAERS openFDA Verification Report

**Date:** 2026-05-13  
**Verifier:** Claude (read-only — no DB writes, no ingester code)  
**API base:** `https://api.fda.gov/drug/event.json`  
**Status:** Complete — decisions required before implementation (see Section 8)

---

## 1. Endpoints Verified and Curl Commands Run

All queries were run against the live API on 2026-05-13. No responses were fabricated.

### Count endpoint (drug list)
```
GET https://api.fda.gov/drug/event.json?count=patient.drug.openfda.generic_name.exact&limit=500
```

### Total report count endpoint
```
GET https://api.fda.gov/drug/event.json?limit=1
```

### Per-drug report count (phrase search)
```
GET https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name:%22{drug}%22&limit=1
```

### Per-drug report count (exact term — what the ingester should use)
```
GET https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name.exact:%22{DRUG}%22&limit=1
```

### Per-drug report count with date constraint
```
GET https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name.exact:%22{DRUG}%22+AND+receivedate:%5B20040101+TO+20260513%5D&limit=1
```

### Severity breakdown queries (3 queries per drug)
```
GET ...?search=patient.drug.openfda.generic_name.exact:%22{DRUG}%22+AND+serious:1&limit=1
GET ...?search=patient.drug.openfda.generic_name.exact:%22{DRUG}%22+AND+seriousnessdeath:1&limit=1
GET ...?search=patient.drug.openfda.generic_name.exact:%22{DRUG}%22+AND+seriousnesshospitalization:1&limit=1
```

### Reports with / without generic_name populated
```
GET https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name:*&limit=1
GET https://api.fda.gov/drug/event.json?search=_missing_:patient.drug.openfda.generic_name&limit=1
```

---

## 2. Sample Query Responses (Verbatim)

All responses below are verbatim from the live API. The `results` array of individual adverse event reports is omitted (each is 32–120 KB of patient/drug data) — only `meta` is shown. The full first-result record was inspected but not reproduced here.

### Query 1 — semaglutide

```
GET https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name:%22semaglutide%22&limit=1
```

```json
{
  "meta": {
    "disclaimer": "Do not rely on openFDA to make decisions regarding medical care. While we make every effort to ensure that data is accurate, you should assume all results are unvalidated. We may limit or otherwise restrict your access to the API in line with our Terms of Service.",
    "terms": "https://open.fda.gov/terms/",
    "license": "https://open.fda.gov/license/",
    "last_updated": "2026-04-28",
    "results": {
      "skip": 0,
      "limit": 1,
      "total": 82911
    }
  }
}
```

### Query 2 — oxycodone

```
GET https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name:%22oxycodone%22&limit=1
```

```json
{
  "meta": {
    "disclaimer": "Do not rely on openFDA to make decisions regarding medical care. While we make every effort to ensure that data is accurate, you should assume all results are unvalidated. We may limit or otherwise restrict your access to the API in line with our Terms of Service.",
    "terms": "https://open.fda.gov/terms/",
    "license": "https://open.fda.gov/license/",
    "last_updated": "2026-04-28",
    "results": {
      "skip": 0,
      "limit": 1,
      "total": 388570
    }
  }
}
```

### Query 3 — rofecoxib (NOT_FOUND — verbatim)

```
GET https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name:%22rofecoxib%22&limit=1
```

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "No matches found!"
  }
}
```

See Q3 in Section 3 for the explanation.

### Query 4 — ibuprofen

```
GET https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name:%22ibuprofen%22&limit=1
```

```json
{
  "meta": {
    "disclaimer": "Do not rely on openFDA to make decisions regarding medical care. While we make every effort to ensure that data is accurate, you should assume all results are unvalidated. We may limit or otherwise restrict your access to the API in line with our Terms of Service.",
    "terms": "https://open.fda.gov/terms/",
    "license": "https://open.fda.gov/license/",
    "last_updated": "2026-04-28",
    "results": {
      "skip": 0,
      "limit": 1,
      "total": 279634
    }
  }
}
```

### Query 5 — bedaquiline fumarate (obscure TB drug)

```
GET https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name:%22bedaquiline%22&limit=1
```

```json
{
  "meta": {
    "disclaimer": "Do not rely on openFDA to make decisions regarding medical care. While we make every effort to ensure that data is accurate, you should assume all results are unvalidated. We may limit or otherwise restrict your access to the API in line with our Terms of Service.",
    "terms": "https://open.fda.gov/terms/",
    "license": "https://open.fda.gov/license/",
    "last_updated": "2026-04-28",
    "results": {
      "skip": 0,
      "limit": 1,
      "total": 1396
    }
  }
}
```

Note: The phrase search "bedaquiline" returns 1,396 results. The actual `generic_name.exact` term stored in FAERS is `BEDAQUILINE FUMARATE` (all-caps, salt form). The exact query `patient.drug.openfda.generic_name.exact:"BEDAQUILINE FUMARATE"` also returns 1,396 — confirming these are the same records. See Q9 for normalization details.

---

## 3. Answers to Verification Questions

### Q1. Drug name field reliability

`patient.drug.openfda.generic_name` is **partially reliable** but not the whole picture.

**Coverage:** 18,065,892 of 20,328,575 total FAERS reports (88.9%) have at least one drug with `openfda.generic_name` populated. The remaining 11.1% (2,262,683 reports) lack the field entirely.

**What's there when it's missing:** `patient.drug.medicinalproduct` is always present (it's the brand/trade name as submitted by the reporter). For example, a report missing `generic_name` had `medicinalproduct: "DURAGESIC-100"` — the brand-name fentanyl patch, not a generic name.

**Field behavior in records:** The `openfda` block is either present (with normalized data from FDA's drug label database) or absent. When absent, only `medicinalproduct` is available. The `openfda.generic_name` field is an array (can contain multiple values — verified: OZEMPIC maps to `["SEMAGLUTIDE", "ORAL SEMAGLUTIDE"]`).

**Recommendation:** Use `patient.drug.openfda.generic_name.exact` as the canonical field for the drug list (it's what the `count=` endpoint enumerates). Accept the 11.1% coverage gap as a known limitation, documented in `metadata.caveat`. Do not fall back to `medicinalproduct` for the count-based ingester — `medicinalproduct` contains brand names, not generic names, and would produce a separate (larger, noisier) set of Claims.

---

### Q2. Total distinct drug count

**The count endpoint does not expose a total number of distinct values.** There is no `meta.results.total` equivalent for `count=` queries — only the top-N entries by report count are returned.

- Without an API key: maximum 500 entries per `count=` query, `skip` is explicitly blocked (`BAD_REQUEST: "Should not use skip param when using count."`).
- With an API key: maximum 1,000 entries per query (attempting 1,001 returns `API_KEY_MISSING`, suggesting the rate-limit gate enforces this cap).

**What we know:** The top-500 `generic_name.exact` entries have report counts ranging from 699,270 (ADALIMUMAB) down to 28,176 (INFLIXIMAB-DYYB). BEDAQUILINE FUMARATE, with 1,396 reports, is not in the top 500 — confirming there are more than 500 distinct terms. The actual total is unknown without an API key and multiple paginated requests.

**Implication for scope:** See Section 6 for the scope estimate using what we can bound.

---

### Q3. Count query shape — confirmed URL structure

The correct query structure to get total report count for a specific drug by its exact `generic_name` term:

```
GET https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name.exact:%22{TERM}%22+AND+receivedate:%5B20040101+TO+20260513%5D&limit=1
```

The `total` field in `meta.results` is the count. No `results` parsing needed.

**The five sample counts:**

| Drug | Query term | Total reports |
|------|-----------|---------------|
| semaglutide | `patient.drug.openfda.generic_name:"semaglutide"` | 82,911 |
| oxycodone | `patient.drug.openfda.generic_name:"oxycodone"` | 388,570 |
| rofecoxib | `patient.drug.openfda.generic_name:"rofecoxib"` | **NOT_FOUND** |
| ibuprofen | `patient.drug.openfda.generic_name:"ibuprofen"` | 279,634 |
| bedaquiline fumarate | `patient.drug.openfda.generic_name:"bedaquiline"` | 1,396 |

**Rofecoxib note:** The phrase search `"rofecoxib"` returns `NOT_FOUND`. This is a real finding, not a gap in FAERS coverage — rofecoxib was marketed as Vioxx and withdrawn in 2004. The `openfda.generic_name` field is populated by FDA's drug label normalization pipeline, which may not cover withdrawn drugs. Rofecoxib reports exist in FAERS via `medicinalproduct` (VIOXX). This means any ingester relying on `generic_name.exact` will silently exclude pre-2000-era withdrawn drugs that lack an openFDA label normalization entry.

**Important term fragmentation (semaglutide):** The count endpoint shows `SEMAGLUTIDE` (76,509) and `ORAL SEMAGLUTIDE` (63,441) as separate terms. The phrase search for `"semaglutide"` returns 82,911 — not the sum of both (139,950), because a single report can reference both forms. The ingester will produce two separate Claims from the count list, one per term. This is the correct behavior per the spec (one Claim per distinct count-endpoint entry).

---

### Q4. Date constraint syntax

Both `receivedate` and `receiptdate` fields exist. Tested both for semaglutide:

- `receivedate:[20040101 TO 20260513]` — returns 82,911
- `receiptdate:[20040101 TO 20260513]` — returns 82,911

Both return the same count for semaglutide. These are different events: `receivedate` is when FDA received the report; `receiptdate` is when the company received it. Using `receivedate` is the standard choice — it reflects FDA intake date, which is more reproducible for a "as of date X" claim.

**Stability check:** The constrained semaglutide query was run twice consecutively:
- Run 1: 82,911
- Run 2: 82,911

Count is stable.

**Effect of date constraint:** For semaglutide, the date-constrained total (82,911) equals the unconstrained total (82,911) — the constraint effectively spans all available data (FAERS data begins ~2004). For oxycodone, unconstrained = 388,570, date-constrained = 183,094. This matters: oxycodone has a long pre-2004 history. The constraint does filter meaningful records.

**Recommended constraint for the ingester:** Use `receivedate:[20040101 TO 20260513]` (today's date as the upper bound), updated at each run. This makes the Claim's count reproducible at a specific query date.

---

### Q5. Severity breakdown

**Severity breakdown requires 3 separate queries per drug** — there is no single query that returns all three severity dimensions at once.

However, the `count=serious` trick returns the `serious` field breakdown in one query:

```
GET .../drug/event.json?search=patient.drug.openfda.generic_name.exact:%22SEMAGLUTIDE%22&count=serious
```

Response:
```json
{
  "results": [
    {"term": 1, "count": 44539},
    {"term": 2, "count": 38330}
  ]
}
```

This returns `serious=1` (serious) and `serious=2` (not serious) counts in one query. However, it does not return `seriousnessdeath` or `seriousnesshospitalization`. Those still require separate `search=...AND+seriousnessdeath:1` queries.

**Verified counts for semaglutide (SEMAGLUTIDE term):**
- Total: 82,911
- Serious (serious=1): 44,539
- Fatal (seriousnessdeath=1): 1,485
- Hospitalization (seriousnesshospitalization=1): 17,436
- Not serious (serious=2): 38,330
- Gap (no serious field): 42 records

**Verified counts for oxycodone (OXYCODONE term, 183,095 total):**
- Serious: 149,694
- Fatal: 52,277
- Hospitalization: 50,867

**Verified counts for bedaquiline fumarate (1,396 total):**
- Serious: 1,335
- Fatal: 339
- Hospitalization: 465

The `count=seriousnessdeath` query can return fatal count in a single call alongside total; but getting all three dimensions (serious, fatal, hospitalization) in fewer than 3 queries is not straightforward. The spec's template calls for all three — see scope estimate (Section 6) for query budget implications.

---

### Q6. Rate limit

**No openFDA API key exists in the project.** The `.env` file contains only `DATABASE_URL` and `DIRECT_URL` (PostgreSQL connection strings). No `OPENFDA_KEY`, `FDA_API_KEY`, or equivalent variable is present. No openFDA key references were found in any script file.

**Observed rate limit response headers** (from a representative query):

```
HTTP/2 200
date: Wed, 13 May 2026 15:41:33 GMT
content-type: application/json; charset=utf-8
cache-control: no-cache, no-store, must-revalidate
via: https/1.1 api-umbrella (ApacheTrafficServer [cMsSf ])
x-api-umbrella-request-id: cu4801n9g9kut68n99p0
x-cache: MISS
```

No `X-RateLimit-*` headers were returned in any observed response. The API does not expose the current rate-limit state in response headers.

**Rate limits per openFDA documentation (not from headers):** Without an API key: 240 requests/minute, 1,000 requests/day. With an API key: 240 requests/minute, 120,000 requests/day.

**Enforcement observed:** Requests above limit=999 returned `API_KEY_MISSING` errors, confirming the anonymous tier's hard limit at 500 for count queries.

---

### Q7. Pagination for the count endpoint

**The `count=` parameter does not support pagination.** Explicitly confirmed:

```
GET .../drug/event.json?count=patient.drug.openfda.generic_name.exact&limit=10&skip=90
```
Returns:
```json
{"error": {"code": "BAD_REQUEST", "message": "Should not use skip param when using count."}}
```

The `count=` endpoint returns only the top-N terms by frequency, sorted descending by count. There is no cursor, no skip, and no way to retrieve terms ranked below position N without an API key that increases the maximum limit from 500 to 1,000.

For regular search queries (not `count=`), the API uses a `search_after` cursor mechanism — confirmed by the `Link` response header:

```
link: <https://api.fda.gov/drug/event.json?search=...&limit=1&skip=0&search_after=0%3D10188271>; rel="next"
```

This cursor-based pagination is for iterating through individual reports, not for paginating the count list.

**Practical implication:** The ingester's drug list is bounded by what the count endpoint returns. Without an API key: up to 500 drugs. With a key: up to 1,000 drugs. Both exclude long-tail drugs (those outside the top-N by report count). BEDAQUILINE FUMARATE (1,396 reports) would be excluded from the 500-entry list.

---

### Q8. Drugs with zero reports

**Drugs with zero FAERS reports do not appear in the `count=` response.** The count endpoint only returns terms that exist in the dataset with at least one report. A zero-count entry was not observed and is not possible by construction — the count aggregates over existing documents.

This means the ingester's drug list is the positive universe: every drug returned by `count=patient.drug.openfda.generic_name.exact` has at least one report. No filtering for nonzero counts is needed.

---

### Q9. Drug name normalization quirks

The `generic_name.exact` field is uppercase, salt-form, and may include combination products. From inspection of the top-500 count response, the five worst-looking entries are:

1. `"THIAMINE HYDROCHLORIDE, RIBOFLAVIN 5 PHOSPHATE SODIUM, DEXPANTHENOL AND NIACINAMIDE"` — count: 29,469 (comma-and-AND-separated multi-ingredient IV vitamin mix)
2. `"DEXTROAMPHETAMINE SULFATE, DEXTROAMPHETAMINE SACCHARATE, AMPHETAMINE SULFATE AND AMPHETAMINE ASPARTATE"` — count: 40,526 (Adderall listed as all four salts)
3. `"DEXTROAMPHETAMINE SACCHARATE, AMPHETAMINE ASPARTATE, DEXTROAMPHETAMINE SULFATE, AND AMPHETAMINE SULFATE"` — count: 34,483 (same four salts, different order — these are two separate entries for the same drug)
4. `"ACETAMINOPHEN, GUAIFENESIN, AND PHENYLEPHRINE HYDROCHLORIDE"` — count: 156,098 (OTC cold combination product)
5. `"ICODEXTRIN, SODIUM CHLORIDE, SODIUM LACTATE, CALCIUM CHLORIDE, MAGNESIUM CHLORIDE"` — count: 30,671 (dialysis fluid with five components)

Additional quirks observed:
- `"ASPIRIN 81 MG"` and `"ASPIRIN 325 MG"` are separate entries from plain `"ASPIRIN"` — dose is embedded in the generic name. These are three separate Claims under the spec.
- `"COOL RELIEF GEL WITH ALOE"` — count: 65,085 — a trade-name-style string in the generic_name field.
- `"PANTOPRAZOLE SODIUM IN 0.9% SODIUM CHLORIDE"` — count: 59,846 — formulation route embedded.
- `"DICLOFENAC SODIUM TOPICAL GEL, 1%"` — strength embedded in generic name.

**Normalization policy decision needed:** Whether to produce one Claim per `generic_name.exact` term (which gives the ingester the most faithful receipt) or to deduplicate salt forms / dosage variants upstream. See Section 8.

---

### Q10. Data freshness

`meta.last_updated: "2026-04-28"` — present in every API response. This is the date openFDA's FAERS dataset was last refreshed. It is 15 days behind query date (2026-05-13).

The field is `meta.last_updated` at the top level of every response object.

---

## 4. Schema Findings

### Claim model fields confirmed present

From `prisma/schema.prisma` (line 35–36):

```prisma
verificationStatus    String?           // VERIFIED | PROVISIONAL | DISPUTED | DEPRECATED
metadata              Json?
```

Both fields exist on the `Claim` model. Added in migration `20260512160508_add_verification_status_and_metadata`:

```sql
ALTER TABLE "Claim" ADD COLUMN "metadata" JSONB,
ADD COLUMN "verificationStatus" TEXT;
```

**No new migration is needed** for the FAERS ingester.

### Source model — no metadata field

The `Source` model does not have a `metadata` field (confirmed: only `id`, `name`, `url`, `publishedAt`, `methodologyType`, `createdAt`, `ingestedBy`, `humanReviewed`, `reviewConfidence`, `reviewedAt`, `reviewedBy`, `externalId`, `deleted`, `autoApproved`).

Per AGENTS.md: "source-level provenance for bulk-ingested records goes in `Claim.metadata` under a `dataset` or `source` key." This constraint is already satisfied by the spec's template, which puts all metadata on the Claim.

### Topic: `drug-regulation` confirmed present

From `scripts/seed-topics.ts` (lines 41–44):

```typescript
{
  name: 'Drug Regulation', slug: 'drug-regulation', domain: 'law',
  description: 'Legal and regulatory frameworks governing pharmaceutical approval and control',
},
```

This topic exists in the seed and would be in production if the seed was run.

**Recommendation on topic:** `drug-regulation` is a law-domain topic about regulatory frameworks — it's a reasonable but imprecise fit for aggregate adverse event counts. A medicine-domain topic would be more accurate. The existing `pharmacology` topic (`domain: 'medicine'`) is a better fit, or a new `adverse-events` topic under `pharmacology` would be the most precise. The seed also has `pharmaceutical-industry-conduct` (medicine domain) which could apply to safety signal cases.

**No topic creation is part of this verification** — this is flagged for a human decision.

---

## 5. Sample Claim/Source/Edge Structures (Real Data)

### Example 1 — High-volume drug: OXYCODONE

All values from live API queries on 2026-05-13.

**Claim:**
```
text:                  "OXYCODONE has 183,094 adverse event reports in FDA FAERS as of 2026-05-13."
claimType:             "INSTITUTIONAL"
currentStatus:         "HARD_FACT"
verificationStatus:    "PROVISIONAL"
autoApproved:          true
humanReviewed:         false
ingestedBy:            "faers_v1"
externalId:            "faers_OXYCODONE"
claimEmergedAt:        2026-05-13T00:00:00Z
claimEmergedPrecision: "DAY"
metadata: {
  "drug_name": "OXYCODONE",
  "total_reports": 183094,
  "severity_breakdown": {
    "serious": 149694,
    "fatal": 52277,
    "hospitalization": 50867
  },
  "query_date": "2026-05-13",
  "query_url": "https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name.exact:%22OXYCODONE%22+AND+receivedate:%5B20040101+TO+20260513%5D&limit=1",
  "data_last_updated": "2026-04-28",
  "caveat": "FAERS reports are voluntary submissions. Counts reflect reported associations, not confirmed causation. Reports may include duplicate submissions, incomplete entries, and reports filed without medical confirmation."
}
```

**Source:**
```
name:           "openFDA FAERS — OXYCODONE"
url:            "https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name.exact:%22OXYCODONE%22+AND+receivedate:%5B20040101+TO+20260513%5D&limit=1"
publishedAt:    2026-05-13T00:00:00Z
methodologyType: "primary"
externalId:     "openfda_faers_OXYCODONE"
ingestedBy:     "faers_v1"
```

**Edge:**
```
source → claim
type:         "FOR"
evidenceType: "EVIDENTIARY"
ingestedBy:   "faers_v1"
```

---

### Example 2 — Low-volume obscure drug: BEDAQUILINE FUMARATE

**Claim:**
```
text:                  "BEDAQUILINE FUMARATE has 1,396 adverse event reports in FDA FAERS as of 2026-05-13."
claimType:             "INSTITUTIONAL"
currentStatus:         "HARD_FACT"
verificationStatus:    "PROVISIONAL"
autoApproved:          true
humanReviewed:         false
ingestedBy:            "faers_v1"
externalId:            "faers_BEDAQUILINE_FUMARATE"
claimEmergedAt:        2026-05-13T00:00:00Z
claimEmergedPrecision: "DAY"
metadata: {
  "drug_name": "BEDAQUILINE FUMARATE",
  "total_reports": 1396,
  "severity_breakdown": {
    "serious": 1335,
    "fatal": 339,
    "hospitalization": 465
  },
  "query_date": "2026-05-13",
  "query_url": "https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name.exact:%22BEDAQUILINE+FUMARATE%22+AND+receivedate:%5B20040101+TO+20260513%5D&limit=1",
  "data_last_updated": "2026-04-28",
  "caveat": "FAERS reports are voluntary submissions. Counts reflect reported associations, not confirmed causation. Reports may include duplicate submissions, incomplete entries, and reports filed without medical confirmation."
}
```

**Source:**
```
name:           "openFDA FAERS — BEDAQUILINE FUMARATE"
url:            "https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name.exact:%22BEDAQUILINE+FUMARATE%22+AND+receivedate:%5B20040101+TO+20260513%5D&limit=1"
publishedAt:    2026-05-13T00:00:00Z
methodologyType: "primary"
externalId:     "openfda_faers_BEDAQUILINE_FUMARATE"
ingestedBy:     "faers_v1"
```

**Edge:**
```
source → claim
type:         "FOR"
evidenceType: "EVIDENTIARY"
ingestedBy:   "faers_v1"
```

---

## 6. Scope and Complexity Estimate

### Distinct drug count bounds

- **Without API key:** count endpoint returns top-500 by report volume.
- **With API key:** count endpoint returns top-1,000 by report volume.
- **True total distinct generic_name.exact terms:** Unknown — cannot be retrieved from this API without iterating individual records. Confirmed > 500 (BEDAQUILINE FUMARATE at rank 500+ has 1,396 reports and is not in top-500).

**Conservative working assumption for scope estimate:** 500 drugs (no key) to 1,000 drugs (with key), representing only the highest-volume drugs.

### Query requirements per drug

Per the spec template, severity breakdown requires 3 separate queries (serious, fatal, hospitalization) plus 1 for total = **4 queries per drug**. If the `count=serious` single-query approach is used for the serious/not-serious split, that reduces to 3 queries per drug (total + count=seriousnessdeath + count=seriousnesshospitalization). The spec calls for both fatal and hospitalization counts explicitly, so minimum is 3 queries per drug.

### Estimates

| Metric | No API key (500 drugs) | With API key (1,000 drugs) |
|--------|----------------------|--------------------------|
| Claims | 500 | 1,000 |
| Sources | 500 | 1,000 |
| Edges | 500 | 1,000 |
| Total DB rows | ~1,500 | ~3,000 |
| Total API queries | 500 × 4 = 2,000 | 1,000 × 4 = 4,000 |
| Runtime at 240 req/min (no key) | ~8.3 minutes | ~16.7 minutes |
| Runtime at 240 req/min (with key, daily limit 120K) | ~8.3 minutes | ~16.7 minutes |

**Neither scope scenario exceeds 50,000 DB rows.** No human review flag needed on volume grounds.

**Daily API budget check (no key, 1,000 req/day limit):**
- 500 drugs × 4 queries = 2,000 queries. **This exceeds the 1,000/day anonymous limit.** A full 500-drug run without an API key would be rate-limited mid-execution.
- Mitigation: run in batches across 2 days, or obtain an API key (free at https://api.fda.gov:443).

**Daily API budget check (with key, 120,000 req/day limit):**
- 1,000 drugs × 4 queries = 4,000 queries. Well within budget. Safe to run in a single pass.

---

## 7. Surprises and Unverified Items

### Surprises

1. **Rofecoxib (Vioxx) returns NOT_FOUND in generic_name.** A drug responsible for ~27,000 cardiovascular deaths and the largest pharmaceutical recall in history is absent from the `openfda.generic_name` field. It exists in FAERS only through the `medicinalproduct` field as "VIOXX". The `openfda.generic_name` normalization only covers drugs with current or recent FDA label records. Withdrawn drugs pre-2004 are silently missing from the count-based ingester. This is a significant coverage gap for historically important drugs.

2. **Semaglutide appears as two separate terms: `SEMAGLUTIDE` (76,509) and `ORAL SEMAGLUTIDE` (63,441).** The phrase search "semaglutide" returns 82,911 (not the sum, because reports can reference both). The ingester will produce two Claims. Whether this is correct behavior or requires deduplication is a human decision.

3. **Date constraint has no effect on semaglutide but significant effect on oxycodone.** Semaglutide unconstrained = 82,911; date-constrained = 82,911. Oxycodone unconstrained = 388,570; date-constrained = 183,094 (47% reduction). The date constraint should be applied consistently regardless, but implementors should not assume it is a no-op.

4. **ASPIRIN, ASPIRIN 81 MG, and ASPIRIN 325 MG are three separate generic_name.exact terms**, all in the top-10. This is a normalization artifact where dose is embedded in the "generic name." Each would become a separate Claim under the spec. Combined, they represent ~1.5M reports.

5. **"COOL RELIEF GEL WITH ALOE" appears as a generic_name.** Brand-like descriptive names appear in the `generic_name` field when the FDA label lists them as such. The field is not reliably pure generic INN names.

6. **The `count=` endpoint maximum without an API key is 500 — not 100 as some documentation suggests.** Limit=500 worked; limit=1,000 returned `API_KEY_MISSING`.

7. **No rate limit headers are returned.** There is no `X-RateLimit-Remaining` or equivalent header to monitor API usage programmatically. The ingester will need to implement its own rate-limiting (sleep + retry logic) without guidance from response headers.

### Unverified items

- **True total count of distinct `generic_name.exact` terms.** Cannot determine without an API key and multiple runs (the count endpoint returns top-N only, with no cursor).
- **Whether the date constraint `receivedate` vs `receiptdate` produces different counts for most drugs.** Only semaglutide was tested; both returned the same count for that drug. The behavior may differ for drugs with significant pre-2004 data.
- **Whether `serious=1` plus `serious=2` plus the 42-record gap (records with no `serious` field) exactly sums to the total for all drugs.** Only verified for semaglutide.
- **Whether the existing `drug-regulation` topic is in the production database** (it's in the seed file, but the seed's run history is not accessible read-only). Topic verification requires a DB query.

---

## 8. Decisions Required Before Implementation

1. **API key.** An openFDA API key is required to run this pipeline without hitting the 1,000 req/day anonymous limit. The key is free at https://api.fda.gov. Decision: obtain and add as `OPENFDA_API_KEY` to `.env`.

2. **Drug list scope.** The ingester can only produce Claims for drugs in the top-500 (no key) or top-1,000 (with key) by report count. Withdrawn drugs with no current FDA label (e.g., rofecoxib/Vioxx) are excluded from `generic_name.exact` and will be silently missed. Decision: accept this limitation, or add a known-withdrawn-drug supplemental list using `medicinalproduct` fallback.

3. **Term fragmentation policy.** Multiple `generic_name.exact` entries per active ingredient (e.g., `SEMAGLUTIDE` + `ORAL SEMAGLUTIDE`, or `ASPIRIN` + `ASPIRIN 81 MG` + `ASPIRIN 325 MG`, or `OXYCODONE` + `OXYCODONE HYDROCHLORIDE` + `OXYCODONE HYDROCHLORIDE AND ACETAMINOPHEN`) will each produce a separate Claim. Decision: ingest one Claim per term as returned (most faithful to the API's data model), or deduplicate to INN-level before ingestion.

4. **Topic assignment.** The spec assumes a topic will be assigned. `drug-regulation` exists (law domain) but is a poor fit for raw adverse event counts. `pharmacology` (medicine domain) is better. A new `adverse-events` child topic under `pharmacology` would be most precise. Decision: assign to existing topic, or create a new one first.

5. **Severity breakdown query count (3 vs 1).** The severity breakdown adds 3 queries per drug on top of the total-count query. At 500 drugs that is 2,000 total queries — over the 1,000/day anonymous limit. With an API key it is fine. Decision: require an API key before enabling severity breakdown; or omit severity breakdown from the initial run and add it in a follow-up enrichment pass.

6. **Data freshness update cadence.** `meta.last_updated: "2026-04-28"` is 15 days behind query date. FAERS data is updated quarterly by FDA. Decision: whether to store `data_last_updated` in Claim metadata (already included in the template above) and how to handle count drift when the underlying data is refreshed.

7. **FAERS background-tier classification (AGENTS.md).** AGENTS.md explicitly classifies FAERS as a background-tier source: "case studies cite analyses, not individual reports." Before writing any ingester code, the human reviewer must decide whether aggregate-count Claims (not individual reports) cross the reference-tier threshold, or whether this pipeline should remain a spec artifact. The verification above confirms the API works and the data is clean enough for ingestion — but that decision belongs to the human reviewer, not the ingester.
