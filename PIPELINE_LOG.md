# Pipeline Log

Running notes on each ingestion pipeline: what it ingests, what ran, what was fixed.

---

## 2026-05-05

### Pipeline 5 — USPTO Patents

Built `scripts/ingest-uspto-patents.ts`. Three hardcoded buckets: pharma (29 patents), tobacco (36), foundational (44). Total DB records: 97 unique sources after dedup (12 patents appeared in both pharma and foundational; one bucket won per editorial judgment).

Each patent produces: a grant Claim + optional expiry child Claim + Source + FOR Edge + EdgeRevision (score 90) + `assignee_of` and `inventor_of` SourceRelationships + topic tags.

GATT expiry logic: pre-June 8 1995 = `max(filing+20, grant+17)`; post = `filing+20`.

**Issue discovered**: multiple fabricated patent numbers in the initial hardcoded list. US5219962 (listed as insulin) and US5292689 (listed as antibody) confirmed wrong via Google Patents — they point to unrelated patents. US6090383 flagged as suspect (Köhler-Milstein hybridoma work was deliberately never patented by MRC — famous historical fact). Audit harness built: 97-row markdown table with Google Patents URLs for manual spot-check.

**Principle added to AGENTS.md**: curated lists in HARD_FACT pipelines must trace to a verifiable fetchable URL. Model memory is not a verifiable source.

**Pending**: Robert is manually auditing the 97 Google Patents URLs. Cleanup script to delete confirmed fabrications from DB will run after audit is complete.

---

### Pipeline 6 — Astronomy

Built `scripts/ingest-astronomy.ts`. Three buckets:

**Exoplanets** — live NASA TAP API (`exoplanetarchive.ipac.caltech.edu/TAP/sync`). Query: confirmed exoplanets with known discovery year from the `ps` table. ~6,277 records as of run date. Bulk-inserted in 500-record batches using `createMany` + `skipDuplicates`. Each record: Source + Claim + Edge + EdgeRevision (score 95) + topic tags. Run completed; full count to be verified against DB.

**Solar System** — 28 hardcoded bodies: 8 planets, 5 IAU dwarf planets, Luna, 4 Galilean moons, Titan + Enceladus + Iapetus + Mimas, Triton, Charon, Vesta + Pallas + Juno + Hygiea. All bodies ingested as HARD_FACT / EMPIRICAL with `claimEmergedAt` = discovery year where applicable.

**IAU Resolutions** — 5 entries: Resolution B5 (planet definition), B6 (dwarf planet / Pluto reclassification), press release iau0603, IAU founding 1919, IAU nomenclature conventions. All ingested as HARD_FACT / INSTITUTIONAL. IAU.org returns 403 to automated fetchers (anti-bot) but URLs are real canonical pages, browser-accessible. Documented in script.

**URL audit** — all 33 hardcoded source URLs verified. Found and fixed 6 broken URLs (404):

| Body | Was | Fixed to |
|---|---|---|
| Enceladus | `/solar-system/moons/enceladus/` | `/saturn/moons/enceladus/` |
| Mimas | `/solar-system/moons/mimas/` | `/saturn/moons/mimas/` |
| Charon | `/solar-system/moons/charon/` | `/dwarf-planets/pluto/moons/charon/` |
| Pallas | `/solar-system/asteroids/2-pallas/` (no NASA page) | JPL SBDB browser |
| Juno | `/solar-system/asteroids/3-juno/` (no NASA page) | JPL SBDB browser |
| Hygiea | `/solar-system/asteroids/10-hygiea/` (no NASA page) | JPL SBDB browser |

JPL SBDB data confirmed via REST API (`ssd-api.jpl.nasa.gov/sbdb.api`) before updating. DB patched live via `scripts/patch-astronomy-source-urls.ts`.

Topics created: `astronomy`, `exoplanets` (child), `planetary-science` (child).

---
