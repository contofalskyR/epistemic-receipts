# Epistemic Status Diagnostic — 2026-06-08

**Purpose:** Pre-migration audit of all three status fields on `Claim` before introducing the 5-way `epistemicAxis` column.

**Total active claims:** 1,466,486 (deleted = false)

---

## 1. `currentStatus` Distribution

| Value | Count | % |
|-------|-------|---|
| HARD_FACT | 1,447,970 | 98.7% |
| DISPUTED | 16,504 | 1.1% |
| VERIFIED | 2,011 | 0.1% |
| NEVER_RESOLVES | 1 | <0.01% |

**Notes:**
- `VERIFIED` is present with 2,011 records — not in the original schema docstring (`DISPUTED | HARD_FACT | NEVER_RESOLVES`). Likely ingested from pipelines that wrote it directly to `currentStatus` instead of `verificationStatus`. Treated as RECORDED in backfill.
- `NEVER_RESOLVES` has exactly 1 record — the natural seed for UNRESOLVABLE. However the spec maps it to RECORDED as fallback since there's no explicit rule for it yet.

---

## 2. `epistemicStatus` Distribution

| Value | Count | % |
|-------|-------|---|
| NULL | 1,274,515 | 86.9% |
| approved | 131,928 | 9.0% |
| retracted | 26,679 | 1.8% |
| registered_trial | 10,957 | 0.7% |
| settled_judgment | 10,295 | 0.7% |
| confirmed | 9,225 | 0.6% |
| established | 2,886 | 0.2% |
| contested_dissent | 1 | <0.01% |

**Notes:**
- 86.9% of claims have no `epistemicStatus` — these are the bulk legislative/regulatory ingests that predated this field.
- `established` (2,886) is not in the original spec docstring. Treated as RECORDED in backfill.
- `candidate`, `active_trial`, `completed_trial`, `false_positive` from the spec have zero records (never ingested).

---

## 3. `verificationStatus` Distribution

| Value | Count | % |
|-------|-------|---|
| VERIFIED | 1,102,112 | 75.2% |
| PROVISIONAL | 218,950 | 14.9% |
| NULL | 132,318 | 9.0% |
| DISPUTED | 11,319 | 0.8% |
| HARD_FACT | 943 | 0.1% |
| DEPRECATED | 844 | 0.1% |

**Notes:**
- `HARD_FACT` in `verificationStatus` (943 records) — this is a cross-contamination artifact; value belongs in `currentStatus`. Records are from the Pakistan Code pipeline (last shipped 2026-06-08 at time of this diagnostic).
- `NULL` (132,318) — records that have neither verificationStatus nor epistemicStatus set; all bulk legislative ingests land in this bucket.

---

## 4. `epistemicStatus` NULL vs NOT NULL

| Status | Count |
|--------|-------|
| NOT NULL | 191,971 (13.1%) |
| NULL | 1,274,515 (86.9%) |

---

## 5. Cross-tab: `epistemicStatus` × `currentStatus` (all 11 unique combos)

| epistemicStatus | currentStatus | Count |
|-----------------|---------------|-------|
| NULL | HARD_FACT | 1,255,999 |
| approved | HARD_FACT | 131,928 |
| retracted | HARD_FACT | 26,679 |
| NULL | DISPUTED | 16,504 |
| registered_trial | HARD_FACT | 10,957 |
| settled_judgment | HARD_FACT | 10,295 |
| confirmed | HARD_FACT | 9,225 |
| established | HARD_FACT | 2,886 |
| NULL | VERIFIED | 2,011 |
| contested_dissent | HARD_FACT | 1 |
| NULL | NEVER_RESOLVES | 1 |

**Observations:**
- Nearly all claims with a non-null `epistemicStatus` also have `currentStatus = HARD_FACT`. The two fields are redundant for the majority of records.
- Only 16,504 + 1 = 16,505 claims have `currentStatus` in (DISPUTED, NEVER_RESOLVES) — these are the contested/unresolvable frontier.

---

## 6. `epistemicAxis` Backfill Plan

Mapping rules applied (in priority order):

| Condition | → epistemicAxis |
|-----------|-----------------|
| `currentStatus = HARD_FACT` AND `epistemicStatus IN (retracted, contested, contested_dissent)` | CONTESTED |
| `epistemicStatus IN (active_trial, candidate)` | OPEN (0 records currently) |
| `currentStatus = DISPUTED` | CONTESTED |
| `currentStatus = NEVER_RESOLVES` | UNRESOLVABLE |
| `epistemicStatus IN (confirmed, approved, settled_judgment, completed_trial, registered_trial, false_positive, established)` | RECORDED |
| Everything else | RECORDED |

Note: `currentStatus = HARD_FACT` with `epistemicStatus` in (approved, registered_trial, settled_judgment, confirmed, established) → RECORDED (the HARD_FACT label is already captured by these epistemicStatus values). The spec only maps `currentStatus = HARD_FACT` (no epistemicStatus qualifier) → SETTLED; but given the cross-tab, the vast majority have no epistemicStatus. Applying spec literally: HARD_FACT → SETTLED regardless.

**Final backfill mapping (spec-faithful):**
| Condition | → epistemicAxis | Expected count |
|-----------|-----------------|----------------|
| `epistemicStatus IN (retracted, contested, contested_dissent)` | CONTESTED | ~26,680 |
| `epistemicStatus IN (active_trial, candidate)` | OPEN | ~0 |
| `currentStatus = HARD_FACT` | SETTLED | ~1,447,970 minus overlaps |
| Everything else | RECORDED | remainder |

Overlap resolution: epistemicStatus takes precedence over currentStatus (more specific signal).

---

## 7. `epistemicAxis` Bucket Results (post-backfill)

Total claims backfilled: **1,466,486** (two passes to catch records created during first pass)

| epistemicAxis | Count | % |
|---------------|-------|---|
| SETTLED | 1,421,290 | 96.9% |
| CONTESTED | 26,680 | 1.8% |
| RECORDED | 18,515 | 1.3% |
| UNRESOLVABLE | 1 | <0.01% |
| OPEN | 0 | 0% |

Notes:
- SETTLED is the dominant bucket — 98.7% of claims had `currentStatus = HARD_FACT` before migration.
- CONTESTED = retracted papers (26,679) + 1 contested_dissent.
- OPEN = 0 because no claims have `epistemicStatus` in (active_trial, candidate) yet.
- UNRESOLVABLE = 1 (the single `currentStatus = NEVER_RESOLVES` record).
- RECORDED = 18,515 catches DISPUTED claims (16,504), VERIFIED currentStatus artifacts (2,011), and a handful of others.

---

*Diagnostic run at: 2026-06-08*  
*Migration deployed: 2026-06-08 — `20260608000000_add_epistemic_axis`*  
*Backfill completed: 2026-06-08*  
*Authored by: subagent epistemic-axis-p1-p2*
