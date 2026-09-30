# Duplicate curated trajectories — 2026-07-06

Generated from a live read of `/api/trajectories?source=curated` (5,557 curated
trajectories) with token-set (Jaccard > 0.55) near-duplicate grouping. This is
the same logic in `scripts/find-duplicate-trajectories.ts`, which is the
authoritative, re-runnable source (it reads the DB directly).

## Scale

- **265 near-duplicate groups** covering **581 trajectories**
- **316 would be deprecated** (keep one canonical per group)
- Root cause: the seed/agentic trajectory generator emitted the same event under
  several slugs and slightly reworded claim text — e.g. `barnard-first-heart-transplant-1967`,
  `barnard-first-human-heart-transplant-1967`, and `first-human-heart-transplant-barnard-1967`
  are one transplant; the Jan-2023 AAP childhood-obesity guideline appears 4×.

This is why `/settling-curve`'s default "Modern" view reads as a wall of
near-identical American Academy of Pediatrics entries (AUDIT-PRELAUNCH §6) — the
duplicates are real rows, not a rendering bug.

## The fix is a data decision (yours)

Per the repo house rule (`AGENTS.md`: editorial curation is human work, and
records are retired via `verificationStatus`, never hard-deleted), I did **not**
mutate the database. Instead:

`scripts/find-duplicate-trajectories.ts`
- **List (read-only):** `npx tsx scripts/find-duplicate-trajectories.ts`
  Prints every group with a `[KEEP]`/`[drop]` recommendation.
- **Apply (writes):** `npx tsx scripts/find-duplicate-trajectories.ts --deprecate`
  Flags each non-kept member `verificationStatus=DEPRECATED` (reversible; hidden
  from default views; preserved for the audit trail).

**The `[KEEP]` pick is a heuristic** — most transitions, then shortest slug.
Eyeball the list first; it isn't always right. Example: the Pap-smear group keeps
`papanicolaou-traut-vaginal-smear-1941` (span 1941–1943) over siblings spanning
1941–1960. Where the heuristic picks wrong, add the slug you want to
`KEEP_OVERRIDES` at the top of the script and re-run.

## Largest groups (representative — full list via the script)

Five-member groups:

- **gemtuzumab / Mylotarg withdrawal** — keep `gemtuzumab-mylotarg-first-adc-withdrawal-2010`; drop 4 (`…-ozogamicin-mylotarg-withdrawal-2000/2010`, `…-accelerated-approval-reversal-2000`, `…-aml-accelerated-approval-reversal-2000`)
- **Pap smear (Papanicolaou) 1941** — keep 1; drop `pap-smear-cervical-cancer-screening-1941`, `…-cervical-cancer-1941`, `…-cervical-cytology-1941`, `…-cervical-screening-1941` ⚠ review keep-pick
- **sacubitril/valsartan PARADIGM-HF 2014** — keep `paradigm-hf-sacubitril-valsartan-2014`; drop 4 `sacubitril-valsartan-…` variants
- **AAP childhood obesity guideline 2023** — keep `aap-childhood-obesity-cpg-2023`; drop `…-treatment-guideline-2023`, `…-clinical-practice-guideline-2023`, `…-guideline-watchful-waiting-reversal-2023`

Four-member groups include: Dudley/Moir ergometrine 1935 · EHT black-hole image
2019 (Sgr A*/M87) · FDA Opana ER withdrawal 2017 · Harrington/Purdue-Sackler 2024
· HERS HRT 1998 · third-generation oral contraceptives VTE 1995.

Three-member groups include: Barnard first heart transplant 1967 · Becket
assassination 1170 · Prusiner prion hypothesis 1982 · rosiglitazone/Avandia CV
risk 2007 · gefitinib/Iressa 2005 · Halley's comet apparitions · Hipparchus lunar
distance 190 BCE · DCCT 1993 · and ~240 two-member pairs.

Run the script for the complete, current enumeration.
