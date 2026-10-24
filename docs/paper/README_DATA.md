# Epistemic Receipts — data release

A cross-domain corpus of source-linked claims with dated epistemic-status transitions, generated from public
institutional records (legislatures, courts, regulators, archives, scholarly indexes). Code:
https://github.com/contofalskyR/epistemic-receipts · Browse: https://epistemic-receipts.vercel.app

Row counts, checksums, the database snapshot and the exact git commit of this release are in `MANIFEST.json`.
Column definitions are in `DATA_DICTIONARY.md`.

## Two layers

1. **Record layer** — every claim (`claims`), generated from one upstream record and linked to the document it
   came from (`edges` → `sources`). Each claim has an `epistemicAxis` label (RECORDED, SETTLED, CONTESTED, OPEN,
   UNRESOLVABLE, REVERSED, ABANDONED). For most claims this is the status assigned when the record was ingested.
   It is not a judgement made later.
2. **Trajectory layer** — claims whose status **changed** at a documented date. In `status_history` a claim's first
   row is its ingest status, never a change. Later rows marked `trajectoryChange = 't1'` are changes with an
   independent dated source on the row. `'t2_only'` marks retraction or repeal changes documented by the claim's own
   source link. Claims carry `trajectoryT1` / `trajectoryT2`; always report the two numbers together.

Rows that are **not** changes and should not be counted as transitions:

- `rowKind = 'same_day_relabel'`: a bulk second label (RECORDED → SETTLED) written with the same date as the first
  row. It is a schema event in the record layer.
- `placeholderDate = true`: rows whose date is a placeholder (1970-01-01, or later than the snapshot). These are
  ignored when deciding `trajectoryChange`.

A subset of claims (`curatedTrajectory = true`) are **curated trajectories drafted with a large language model and
linked to sources** in the project's seed scripts. Only rows whose `reviewedBy` names a person were reviewed by a
person. The `humanReviewed` flag was also set by some scripts; use `reviewedBy`.

## Files

Each table ships as `<name>.parquet` (zstd) and `<name>.csv.gz` (UTF-8, header row, RFC 4180 quoting; empty
unquoted field = null, `""` = empty string; timestamps ISO 8601 UTC).

| File | One row is | Joins |
|---|---|---|
| `claims` | a claim | `id` |
| `status_history` | a dated status of a claim | `claimId` → claims.id; `sourceId` → sources.id |
| `sources` | a cited document (only those referenced by an edge or a history row) | `id` |
| `edges` | a claim → source link | `claimId`, `sourceId` |
| `claim_relations` | a claim → claim link taken from an upstream record or an exact identifier match (`linkKind` = upstream_record, identifier_match) | `fromClaimId`, `toClaimId` |
| `claim_relations_context` | a **machine-derived context link** (name/text match or country × year window; `linkKind` = name_or_text_match, time_window). Not part of the core graph; `heuristic` names the rule | `fromClaimId`, `toClaimId` |
| `pipelines` | an ingest pipeline: domain, claim count, upstream source and licence status | `pipeline` = claims.ingestedBy |

`claims.metadata` and `claim_relations*.followUpContext` are JSON strings with pipeline-specific keys. Email addresses inside exported text were replaced with `[email removed]`
(counts in `MANIFEST.json`). No table holding user accounts, sessions, keys, feedback or any other non-corpus data
is included; the excluded tables are listed in `MANIFEST.json`.

## Loading

**DuckDB**

```sql
CREATE VIEW claims  AS SELECT * FROM 'claims.parquet';
CREATE VIEW history AS SELECT * FROM 'status_history.parquet';
-- trajectory layer, both numbers
SELECT count(*) FILTER (WHERE trajectoryT2) AS documented_change,
       count(*) FILTER (WHERE trajectoryT1) AS with_independent_dated_source
FROM claims;
-- one claim's history in order
SELECT seq, fromAxis, toAxis, occurredAt, rowKind, trajectoryChange FROM history
WHERE claimId = 'cmq5l0zit5oyfsal83wd26glu' ORDER BY seq;
```

**Python (pandas / pyarrow)**

```python
import pandas as pd
claims  = pd.read_parquet("claims.parquet")
history = pd.read_parquet("status_history.parquet")
changes = history[history["trajectoryChange"].notna()]          # real dated changes only
t1 = claims["trajectoryT1"].sum(); t2 = claims["trajectoryT2"].sum()
# CSV instead: pd.read_csv("claims.csv.gz", keep_default_na=False, na_values=[""])  # see quoting note above
```

**R (arrow)**

```r
library(arrow); library(dplyr)
claims  <- read_parquet("claims.parquet")
history <- read_parquet("status_history.parquet")
history |> filter(!is.na(trajectoryChange)) |> count(toAxis)
```

Order a claim's history by `seq`, then `occurredAt`, then `createdAt`; `seq` is null on a few legacy rows.

## Caveats

- `epistemicAxis` and `verificationStatus` are set by pipeline code. `verificationStatus` is a pipeline quality-gate
  label, not a review outcome.
- `claimEmergedAt` is null where the upstream record has no usable date; those claims have no history row.
- Some source URLs refuse automated clients (HTTP 403/429) though they open in a browser; a few are gone.
- The corpus covers some jurisdictions and institutions far more than others; `pipelines` gives counts per source.
- Records of public officials, sanctioned parties and registrants appear as they do in the public source records.

## Licence

Creative Commons Attribution 4.0 International (CC BY 4.0) for the dataset as a whole. Where a pipeline's upstream
terms add a condition, each claim says so: `upstreamLicenceStatus` = `nc` (records inherit a non-commercial condition),
`sa` (records inherit a share-alike condition), or `unclear` / `not_checked` (upstream terms not established); the
terms and their source are in `pipelines`. Upstream data remain subject to their providers' terms.

Not included: pipelines whose upstream terms do not allow redistribution in a compiled dataset (WHO GHO, ICD-11 and
the Essential Medicines List; FRED; OMIM; the UN resolution and treaty collections; Quiver congressional-trading
data) and SIPRI military expenditure (permission needed above 10 % of the data set). They are listed, with the terms
that exclude them, in `MANIFEST.json` → `excludedPipelines`.

## Citation

Contofalsky, R. *Epistemic Receipts* (version <VERSION>). Zenodo. https://doi.org/<VERSION DOI>
— all versions: https://doi.org/10.5281/zenodo.23049991

Paper: <to be added on publication>
