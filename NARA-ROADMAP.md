# NARA Ingestion Roadmap — Epistemic Receipts

Track every NARA Record Group (RG) worth ingesting. Erase checkboxes as each run completes.

**API key:** `KSHVEuDXNd27xXkByehli5Eak8TvnKJi99Kiz7DK` (Key 1 — register 2–3 more at Catalog_API@nara.gov)
**Rate limit:** 10,000 calls/month per key × 100 records/call = up to 1M records/month per key
**Strategy:** Plain page-based pagination + cursor resume. Date-range slicing does NOT work (NARA ignores date filters for large RGs — see HISTORY.md). Use `--max-pages 100` to cap per run, `--resume` to continue next month.
**Script:** `scripts/ingest-nara-catalog.ts` — flag is `--record-group <N>` (NOT `--rg`); `--full` to write DB
**Example run:** `ALLOW_EDITS=true npx ts-node -r dotenv/config scripts/ingest-nara-catalog.ts --record-group 59 --full --max-pages 100 dotenv_config_path=.env.local`
**Resume:** replace `--full` with `--resume` on subsequent months
**Pipeline prefix:** `nara_rg<N>_v1`
**Dead ends documented:** `HISTORY.md` — searchAfter, decade-slice, adaptive-slice all tried and abandoned

---

## Status Legend
- ✅ Ingested
- ⏳ Running now
- ⚙️ Configured in script, not yet run
- 📋 Queued — needs script config added
- ⛔ Blocked

---

## Currently Ingesting / Configured

| RG | Collection | Status | Records (est.) |
|----|-----------|--------|----------------|
| RG 263 | CIA — clandestine ops, Cold War intel, covert programs | ✅ ingested | ~5k |
| RG 128 | Joint Committees / Church Committee — domestic surveillance, COINTELPRO | ✅ ingested | ~67 enriched |
| RG 59 | State Department — diplomatic cables, foreign policy (1789–present) | ⏳ running | ~76k |
| RG 330 | Office of the Secretary of Defense — policy, weapons, Cold War | ⏳ running | ~307k |
| RG 65 | FBI — COINTELPRO, political surveillance, organized crime | ⚙️ configured | ~50k est. |
| RG 226 | OSS — WWII CIA precursor, espionage, resistance networks | ⚙️ configured | ~30k est. |
| RG 218 | Joint Chiefs of Staff — war plans, strategic policy | ⚙️ configured | ~20k est. |
| RG 84 | Foreign Service posts — embassy cables, consular records | ⚙️ configured | ~40k est. |

---

## Tier 1 — Highest OSINT Value (do next)

| RG | Collection | Priority reason |
|----|-----------|----------------|
| RG 326 | Atomic Energy Commission / Manhattan Project | Nuclear weapons, secrecy, testing decisions |
| RG 238 | Nuremberg war crimes trials | Trial transcripts, evidence, depositions — primary sourced |
| RG 220 | Presidential Commissions | Warren Commission (JFK), Kerner Commission, Pike Committee |
| RG 457 | NSA / SIGINT — declassified Cold War signals intelligence | Rare primary signals data |
| RG 107 | Secretary of War, WWII | Japanese internment, war policy, race |

---

## Tier 2 — Broad Government Coverage

| RG | Collection |
|----|-----------|
| RG 46 | US Senate records |
| RG 233 | US House of Representatives records |
| RG 60 | Department of Justice |
| RG 56 | Treasury Department |
| RG 174 | Department of Labor |
| RG 228 | Committee on Fair Employment Practice (WWII civil rights) |
| RG 453 | US Commission on Civil Rights |
| RG 381 | Community Services Administration |
| RG 165 | War Department General Staff |
| RG 208 | Office of War Information (WWII propaganda) |
| RG 179 | War Production Board |
| RG 211 | War Manpower Commission |
| RG 215 | Office of Economic Stabilization |
| RG 188 | Office of Price Administration |
| RG 256 | American Commission to Negotiate Peace (post-WWI) |
| RG 353 | Interdepartmental and intradepartmental policy committees |

---

## Tier 3 — Military Extensions

| RG | Collection |
|----|-----------|
| RG 319 | Army Intelligence (G-2) / Army Staff |
| RG 338 | US Army Commands |
| RG 341 | HQ USAF |
| RG 342 | USAF commands, installations |
| RG 38 | Chief of Naval Operations |
| RG 80 | Secretary of the Navy |
| RG 313 | Naval Operating Forces |
| RG 92 | Quartermaster General |
| RG 337 | HQ Army Ground Forces |
| RG 549 | US Army Europe (post-WWII occupation) |

---

## Tier 4 — Specialized Domains

| RG | Collection |
|----|-----------|
| RG 90 | Public Health Service |
| RG 88 | FDA |
| RG 443 | NIH |
| RG 255 | NASA |
| RG 412 | EPA |
| RG 307 | National Science Foundation |
| RG 173 | FCC |
| RG 197 | Civil Aeronautics Board |
| RG 237 | FAA |
| RG 30 | Federal Highway Administration |
| RG 398 | NTSB |
| RG 82 | Federal Reserve Board |
| RG 101 | Comptroller of the Currency |
| RG 234 | Reconstruction Finance Corporation |
| RG 265 | Export-Import Bank |
| RG 240 | Commodity Exchange Authority |
| RG 429 | Office of Science and Technology Policy |
| RG 51 | Office of Management and Budget |
| RG 207 | HUD |
| RG 434 | Department of Energy |

---

## Tier 5 — Low Priority (admin-heavy / low claim density)

| RG | Collection | Note |
|----|-----------|------|
| RG 85 | Immigration and Naturalization Service | |
| RG 566 | US Citizenship and Immigration Services | |
| RG 49 | Bureau of Land Management | |
| RG 57 | US Geological Survey | |
| RG 95 | Forest Service | |
| RG 115 | Bureau of Reclamation | |
| RG 16 | Department of Agriculture | |
| RG 136 | Agricultural Marketing Service | |
| RG 75 | Bureau of Indian Affairs | Millions of records, mostly admin land records — background-tier |
| RG 21 | Federal District Courts | |
| RG 267 | Supreme Court | |
| RG 118 | US Attorneys | |
| RG 204 | Office of the Pardon Attorney | |
| RG 472 | NSC records | |
| RG 43 | International conferences & treaties | |
| RG 31 | Federal Housing Finance Agency | |

---

## API Key Management

To stay under the 10k/month limit while running large RGs (59 = 76k, 330 = 307k):
1. Register 2–3 additional NARA catalog API keys at [catalog.archives.gov/api](https://catalog.archives.gov/api)
2. Rotate keys in `.env.local` between runs (`NARA_API_KEY_2`, `NARA_API_KEY_3`)
3. Each key = 10k calls; 3 keys = 30k/month → can handle ~300k records at 10 records/call

## Completed Runs Log

| Date | RG | Records | Notes |
|------|----|---------|-------|
| 2026-05-28 | RG 263 (CIA) | ~5k | First run |
| 2026-05-28 | RG 128 (Church Committee) | ~67 enriched | Church Committee COINTELPRO records |
| 2026-05-28 | RG 59 (State Dept) | in progress | Full run, 76k est. |
| 2026-05-28 | RG 330 (OSD) | in progress | Full run, 307k est. |
