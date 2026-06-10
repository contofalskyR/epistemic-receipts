# Decision Brief — Collapse 4 Status Fields → `epistemicAxis`

**Status:** ⏸ BLOCKED on two decisions from Robert (4-way vs 5-way; drop `verificationStatus` or keep). Everything the autonomous worker can do safely is done; only the supervised refactor + irreversible drop remain.
**Prepared:** 2026-06-09 by autonomous worker.
**Predecessor:** [`epistemic-status-diagnostic-2026-06-08.md`](./epistemic-status-diagnostic-2026-06-08.md) — pre-migration audit.

---

## TL;DR

`epistemicAxis` is live and now **100%-populated** (the last 1,965 null rows were backfilled to SETTLED this session). The remaining work is to **retire the three legacy fields** — `currentStatus`, `verificationStatus`, `epistemicStatus` — and make `epistemicAxis` the single source of truth.

Before writing the irreversible migration, one product decision is required: **should the surviving axis be 4-way or 5-way?** The current data makes this a live question because two of the five proposed values are essentially empty.

This session did **not** drop any columns and did **not** edit the 210 query sites — that work is gated on the decision below.

---

## 1. The four fields today

Live distribution (non-deleted claims, **1,615,396 total**, queried 2026-06-09):

| Field | Values present (count) | Role |
|---|---|---|
| `currentStatus` *(deprecated)* | HARD_FACT 1,596,880 · DISPUTED 16,504 · VERIFIED 2,011 · NEVER_RESOLVES 1 | Original 4-way label; superseded by axis |
| `verificationStatus` | VERIFIED 1,250,971 · PROVISIONAL 219,001 · null 132,318 · DISPUTED 11,319 · HARD_FACT 943 · DEPRECATED 844 | Pipeline quality gate; partly cross-contaminated (`HARD_FACT` is a misfiled `currentStatus` value from the Pakistan Code pipeline) |
| `epistemicStatus` | null 1,423,425 · approved 131,928 · retracted 26,679 · registered_trial 10,957 · settled_judgment 10,295 · confirmed 9,225 · established 2,886 · contested_dissent 1 | Fine-grained per-pipeline signal; null for 88% of claims |
| **`epistemicAxis`** *(target)* | **SETTLED 1,423,255 · RECORDED 165,460 · CONTESTED 26,680 · UNRESOLVABLE 1 · OPEN 0** | The consolidated axis |

> `DEPRECATED` (844 rows, `verificationStatus`) is a distinct concept from the axis — it marks retired-pipeline records (e.g. uspto_v1). It must be preserved as a separate signal (see §4, open question) and **must not** be folded into the axis.

---

## 2. The decision — 4-way vs 5-way

The 5-way axis as currently designed:

| Axis value | Meaning | Rows |
|---|---|---|
| RECORDED | Entered into an official record; not (yet) adjudicated true | 165,460 |
| SETTLED | Established / confirmed true | 1,423,255 |
| CONTESTED | Disputed, retracted, or dissented | 26,680 |
| OPEN | Unresolved **but resolvable** — actively in progress | **0** |
| UNRESOLVABLE | A question that **never** resolves (e.g. JFK lone-gunman) | **1** |

**Option A — Keep 5-way** (`RECORDED | SETTLED | CONTESTED | OPEN | UNRESOLVABLE`)
- Preserves the epistemically meaningful OPEN-vs-UNRESOLVABLE distinction. This is the project's whole premise — an "open" registered clinical trial is categorically different from an "unresolvable" historical dispute.
- Matches the current schema comment and the existing `backfill-epistemic-axis.ts`.
- Cost: two sparse buckets (0 and 1 rows). Sparse-but-correct; both fill naturally as clinical-trial and history pipelines mature.

**Option B — Collapse to 4-way** (`RECORDED | SETTLED | CONTESTED | OPEN`)
- Fold UNRESOLVABLE into OPEN (or drop it). Simpler vocabulary; mirrors the old 4-value `currentStatus`.
- Cost: loses a meaningful epistemic category. UNRESOLVABLE questions become permanently "OPEN," which misrepresents them — an unresolvable question is not awaiting resolution. Requires re-mapping the 1 UNRESOLVABLE row and editing the backfill + UI vocabulary.

**Recommendation: Option A (keep 5-way).** The sparseness is a maturity artifact, not a design flaw; the categories are not redundant. Losing UNRESOLVABLE is lossy in exactly the dimension this product exists to capture.

---

## 3. Migration scope (decision-independent — same either way except the value vocabulary)

Legacy fields are referenced widely:

- **`currentStatus`** — 210 references across ~55 files (`app/`, `lib/`, `components/`, `scripts/`)
- **`verificationStatus`** — 35 references
- **`epistemicStatus`** — 8 references

This is a large, irreversible refactor (drops 3 columns + their 4 indexes; rewrites every filter/display site). It is **not** appropriate to execute in an unattended autonomous run. Proposed staged plan once cardinality is chosen:

1. **Read-path swap (reversible):** rewrite all query sites to read/filter on `epistemicAxis`. Columns still present — fully revertible. Ship + soak.
2. **Drop-column migration (irreversible):** once the read-path swap is verified in production, a follow-up migration drops `currentStatus`, `verificationStatus`, `epistemicStatus` and their indexes (`@@index([currentStatus])`, `@@index([verificationStatus])`).

Draft drop migration (do **not** apply until step 1 ships and decision is confirmed):

```sql
-- 20260610000000_collapse_status_fields/migration.sql  (DRAFT — unapplied)
ALTER TABLE "Claim" DROP COLUMN "currentStatus";
ALTER TABLE "Claim" DROP COLUMN "verificationStatus";   -- see §4: preserve DEPRECATED first
ALTER TABLE "Claim" DROP COLUMN "epistemicStatus";
-- indexes on dropped columns are removed automatically by Postgres
```

If Option B (4-way) is chosen, additionally:
```sql
UPDATE "Claim" SET "epistemicAxis" = 'OPEN' WHERE "epistemicAxis" = 'UNRESOLVABLE';
```
and remove `UNRESOLVABLE` from the schema comment + UI filter vocabularies.

---

## 4. Open sub-question for Robert (blocks the `verificationStatus` drop only)

`verificationStatus` carries **two** signals that the axis does not:
- `DEPRECATED` (844) — retired-pipeline records, surfaced via the "Show deprecated" UI toggle.
- `PROVISIONAL` (219,001) — auto-ingested, gates passed but not human-reviewed.

Before dropping `verificationStatus`, these must land somewhere. Options: keep a slim `verificationStatus` (don't fully collapse it), or migrate `DEPRECATED`/`PROVISIONAL` onto existing booleans (`autoApproved`, a new `deprecated` flag). Per AGENTS.md ("humanReviewed and autoApproved must reflect reality"), do **not** overload the axis to carry these. **Recommendation:** keep `verificationStatus` for now; collapse only `currentStatus` + `epistemicStatus` into the axis. That makes the task "collapse 3 fields → axis," not 4.

---

## 5. Done this session (decision-independent, safe)

- ✅ Backfilled the last **1,965** null-axis rows → all SETTLED (legislation pipelines: russia/brazil/hungary/romania/etc., all `currentStatus=HARD_FACT`, no `epistemicStatus`). `epistemicAxis` is now 0-null.
- ✅ Mapped full migration scope (210 / 35 / 8 references).
- ✅ This brief.

## 6. Awaiting Robert

1. **4-way or 5-way?** (recommend 5-way — §2)
2. **Drop `verificationStatus` too, or keep it for DEPRECATED/PROVISIONAL?** (recommend keep — §4)

Once answered, the read-path swap (step 1) can proceed in a supervised session; the column drop (step 2) follows after soak.

---

## 7. Re-surface log

- **2026-06-09 (autonomous worker):** Picked this task off the queue, re-surfaced both gating
  questions to Robert. No decision returned (unattended run, no human in the loop). Took **no**
  irreversible action — columns intact, 210 query sites untouched, drop migration still a draft.
  Task remains **⏸ BLOCKED**; it stays first in the queue until Robert answers. Per §3 and AGENTS.md,
  neither the read-path swap nor the column drop is appropriate for an unattended run, so this worker
  cannot advance it further without the decision.

- **2026-06-09 20:52 EDT (autonomous worker, 2nd pass):** Re-surfaced both gating questions
  interactively (`AskUserQuestion`); no human present, no answer returned. The worker has now
  exhausted everything it can do safely without Robert: analysis complete, `epistemicAxis` 0-null,
  scope mapped, drop migration drafted-but-unapplied. **No irreversible action taken** — all 3
  (or 4) legacy columns intact, 210/35/8 query sites untouched, draft migration unapplied. To stop
  this blocked task from starving the autonomous queue every 5 hours, the worker's portion is being
  marked complete in `TASK_QUEUE.md` (kept with the ⏸ marker and explicit "column drop stays
  unexecuted" text so the audit trail remains accurate). **The schema migration itself is NOT done
  and remains gated on Robert's two answers (§6) + a supervised read-path swap (§3 step 1).**
