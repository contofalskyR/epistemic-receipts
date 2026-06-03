# HARD_FACT Pipeline Roadmap

**Live DB (2026-06-03):** ~1.04M+ claims · 160+ pipelines · 116,267 LegislativeVotes · 2,361 polities · 9 HistoricalEvents · 88 perpetual loops running

Future pipelines ranked by volume + editorial value. Add to this list as new candidates emerge. Cross off as pipelines ship.

## UX Features

| Feature | Status | Notes |
|---------|--------|-------|
| Search | ✅ Shipped | `/search` |
| Globe + time slider | ✅ Shipped 2026-05-30 | 1789–2026, historical borders, play/pause |
| Bookmarks | ✅ Shipped 2026-05-31 | Anonymous UUID key, SHA-256 hashed server-side, no PII |
| Citation graph / related papers | ✅ Shipped 2026-05-31 | `ClaimRelation` table, OpenAlex enrichment, relations panel on claim detail page ("Later Work", "Related Papers", "References") |
| Globe fixes + Connections page | ✅ Shipped 2026-05-31 | Clickable claims in timeline mode, slower play speed (~1s/step), `/globe/connections` page with country-to-country arcs |
| **EU Parliament votes deep-dive** | 🔄 In progress (Opus agent) | Expand EU votes 1,900 → ~50k+ via europarl.europa.eu API (1979–present), MEP/group breakdown (EPP, S&D, Renew…), add EU Parliament tab to `/analysis/votes` |
| **/legislation — global 52-country** | ✅ Shipped 2026-06-03 | Regional browser (Americas/Europe/Asia-Pacific/Africa), country grid with claim counts, 49 perpetual loops (24h), graceful empty states. Canada/NZ status chips. |
| **/legislation — bill granularity** | ✅ Shipped 2026-06-03 | Bill ID chips (RA no., law no., act no.), law type badges (LOI/PL/Money Bill), status where available (India: Assented), year-only date display. |
| **Globe — typed density layers** | 📋 Queued | Category-based overlays instead of all-facts heatmap. Toggle by type: pharma labs, drug discovery, human rights orgs, legislation, science, etc. Geography + type of fact, not just claim count. |
| "What's new" feed | ⏳ On hold | After bookmarks |

---

---

## Shipped

- [x] Pipeline 1 — FDA Drug Approvals (`openfda_v1`, 233 records)
- [x] Pipeline 2 — SCOTUS Rulings (`courtlistener_scotus_v1`, 300 records)
- [x] Pipeline 3 — GenBank DNA Sequences (`genbank_v1`, 99 records)
- [x] Pipeline 4 — (internal — see git log)
- [x] Pipeline 5 — USPTO Patents (`uspto_v1`, 239 records; hardcoded curated list)
- [x] Pipeline 6 — Astronomy (`nasa_exoplanet_v1` 6,277 + `iau_v1` 5 + `iau_constellations_v1` 1 + `solar_system_v1` 28)
- [x] Pipeline 7 — FDA Adverse Event Reporting System (`faers_normalized_drugs_v1`, 999 records)
- [x] **P9 SEC EDGAR** — `sec_edgar_v1`, 379 curated filings (Enron, Lehman, Boeing 737 MAX, etc.). Shipped 2026-05-20.
- [x] **P10 Nobel Prizes** — `nobel_v1`, 1,378 laureate records (1901–2024). Shipped 2026-05-20.
- [x] **P11 ICD-11** — `icd11_v1`, 1,374 WHO disease classifications. Shipped 2026-05-20.
- [x] **P12 USGS Earthquakes** — `usgs_eq_v1`, 4,696 M6.5+ events since 1900. Shipped 2026-05-20.
- [x] **P13 CrossRef Retractions** — `crossref_retractions_v1`, 26,624 records + `retraction_watch_v1`, 110. Shipped 2026-05-20.
- [x] **P14 Federal Register** — `fr_rules_v1`, 1,920 significant final rules. Shipped 2026-05-20.
- [x] **P27 New Zealand** — all variants shipped: `nz_legislation_v1` 1,039 + `nz_repealed_acts_v1` 4,372 + `nz_bills_v1` 1,868 + `nz_local_acts_v1` 611 = **7,890 total**. Shipped 2026-05-20.
- [x] **P53 Korea (KLRI)** — `korea_legislation_v1`, 2,114 laws. Shipped 2026-05-20.
- [x] **P54 Israel (Knesset)** — `israel_knesset_v1`, 2,009 primary laws. Shipped 2026-05-20.
- [x] **P56 European Parliament** — `eu_parliament_v1`, 4,331 acts. Shipped 2026-05-20.
- [x] **P57 Scotland** — `scotland_legislation_v1`, 408 acts. Shipped 2026-05-20.
- [x] **P58 Wales (Senedd)** — `wales_senedd_v1`, 100 acts. Shipped 2026-05-20.
- [x] **P61 WTO Disputes** — `wto_disputes_v1`, 645 cases (DS1–DS644). Shipped 2026-05-20.
- [x] **P62 ICJ Judgments** — `icj_judgments_v1`, 800 decisions (1946–2023). Shipped 2026-05-20.
- [x] **P65 Malaysia** — `malaysia_legislation_v1`, 881 acts. Shipped 2026-05-20.
- [x] **P76 Estonia** — `estonia_legislation_v1`, 5,870 acts. Shipped 2026-05-20.
- [x] **P77 Malta** — `malta_legislation_v1`, 563 laws. Shipped 2026-05-20.
- [x] **P78 Georgia** — `georgia_legislation_v1`, 301 laws. Shipped 2026-05-20.
- [x] **P79 Jamaica** — `jamaica_legislation_v1`, 528 acts. Shipped 2026-05-20.
- [x] **P80 Sri Lanka** — `srilanka_legislation_v1`, 1,704 acts. Shipped 2026-05-20.
- [x] **P81 Peru** — `peru_legislation_v1`, 5,202 laws. Shipped 2026-05-20.
- [x] **P85 UAE** — `uae_legislation_v1`, 177 federal laws. Shipped 2026-05-20.
- [x] **P86 WIPO Lex** — `wipo_lex_v1`, 8,100 IP laws (190+ countries). Shipped 2026-05-20.
- [x] **P87 PacLII** — `paclii_legislation_v1`, 1,583 acts (Pacific Islands via Wayback Machine). Solomon Islands + Vanuatu CDX timed out (0 acts). Shipped 2026-05-20.
- [x] **P89 Trinidad & Tobago** — `tt_legislation_v1`, 368 acts. Shipped 2026-05-20.
- [x] **P90 Brunei** — `brunei_legislation_v1`, 288 acts. Shipped 2026-05-20.

### Also in DB (shipped, no P# assigned)
- `clinicaltrials_v1`: 1,053 US clinical trials
- `nih_reporter_v1`: 1,362 NIH grants
- `pubchem_v1`: 355 compounds (partial — more available)
- `nato_official_texts_v1`: 459 texts. Shipped 2026-05-23.
- `nationalrat_v1`: 3,868 records (Austria Nationalrat). Shipped 2026-05-23.
- `south_africa_legislation_v1`: 557 acts
- `singapore_legislation_v1`: 507 acts
- `mexico_legislation_v1`: 308 laws
- `taiwan_legislation_v1`: 1,015 laws
- `iceland_legislation_v1`: 1,068 laws
- `portugal_legislation_v1`: 1,292 laws
- `bangladesh_legislation_v1`: 1,610 laws
- `finland_legislation_v1`: 1,651 laws
- `canada_bills_v1`: 1,067 bills
- `tweedekamer_v1`: 1,530 (Netherlands)
- `nist_constants_v1`: 355 physical constants (NIST CODATA)
- `nist_webbook_v1`: 20 compounds
- `congress_votes_v1`: 505 roll call votes
- `omim_v1`: 1,512 phenotype entries (partial — resuming 2026-05-22)
- `echr_judgments_v1`: 10,296 ECHR judgments (hudoc.echr.coe.int). Shipped 2026-05-23.
- `un_ga_resolutions_v1`: 598 UN General Assembly resolutions. Shipped 2026-05-23.
- `who_gho_v1`: 1,001 WHO Global Health Observatory stats (life expectancy, child mortality, PM2.5, obesity, alcohol — best year per country, 5 indicators). Shipped 2026-05-23.
- `openfda_labels_v1`: 52,354 FDA drug labels. Shipped 2026-05-23 (partial — full corpus ~258k, architectural gate applied).

### Medical/Science Pipelines — New 2026-05-21 (scripts built by agents)
Scripts exist for all; architectural review pending before full production runs.
- `chebi_v1`: IN PROGRESS (target ~62,000 chemical compounds, EBI)
- `rxnorm_v1`: IN PROGRESS (target ~14,632 drug ingredients, NLM)
- `omim_v1`: PARTIAL (target ~15,000 phenotypes, OMIM — see In Progress)
- `openfda_labels_v1`: 0 — BLOCKED pending CONSULTANT.md decisions (258k drug labels, FDA)
- `ingest-faers-current-drugs.ts` → `faers_normalized_drugs_v1`: 999 (see P7)

## NARA Expansion Track — 2026-05-28

Full roadmap in **`NARA-ROADMAP.md`** (committed 2026-05-28). 73 RGs across 5 tiers. Erase rows there as each RG finishes.

**API key:** `KSHVEuDXNd27xXkByehli5Eak8TvnKJi99Kiz7DK` | **Limit:** 10k calls/month
**Script:** `scripts/ingest-nara-catalog.ts` — `--rg <N>` flag; `--full` for uncapped pagination

| RG | Collection | Status |
|----|-----------|--------|
| RG 263 | CIA | ✅ ingested |
| RG 128 | Church Committee / Joint Committees | ✅ ingested |
| RG 59 | State Department (76k records) | ⏳ running |
| RG 330 | Office of SecDef (307k records) | ⏳ running |
| RG 65 | FBI (COINTELPRO, surveillance) | ⚙️ configured |
| RG 226 | OSS (WWII CIA precursor) | ⚙️ configured |
| RG 218 | Joint Chiefs of Staff | ⚙️ configured |
| RG 84 | Foreign Service cables | ⚙️ configured |
| RG 326 | AEC / Manhattan Project | 📋 Tier 1 next |
| RG 238 | Nuremberg trials | 📋 Tier 1 next |
| RG 220 | Presidential Commissions (Warren, Kerner, Pike) | 📋 Tier 1 next |
| RG 457 | NSA / SIGINT | 📋 Tier 1 next |
| RG 107 | Secretary of War, WWII | 📋 Tier 1 next |
| + 58 more | See NARA-ROADMAP.md Tiers 2–5 | 📋 queued |

---

## Archives & Declassified Documents Track — 2026-05-23

New pipeline category added: `domain: "archives"`. Topics page updated with "Archives & Declassified Documents" section.

| P# | Pipeline | Script | Status | Notes |
|----|----------|--------|--------|-------|
| P110 | Wilson Center Digital Archive | `ingest-wilson-center.ts` | ⏳ DNS blocked | Domain updated to `archives`. Retry when DNS resolves. |
| P115 | UK National Archives | `ingest-uk-national-archives.ts` | ⏳ In progress | CAB, FCO, PREM, HO, DEFE series. No key needed. |
| P116 | Miller Center Presidential Speeches | `ingest-miller-center.ts` | 🔄 Full run in progress | ~600 US presidential speeches. Dry-run passed. |
| P117 | JFK Assassination Records (NARA) | `ingest-jfk-records.ts` | ⛔ BLOCKED — NARA API key required. Returns HTML without key. Script built + validated (mock). | Ship immediately once NARA key arrives. |
| P118 | CIA FOIA Reading Room | `ingest-cia-foia.ts` | ⛔ BLOCKED | Wayback CDX stalled. CIA Reading Room blocks all automated access. Script built but no viable path. |
| P119 | IPN — Polish Institute of National Remembrance | `ingest-ipn.ts` | 🔄 Full run in progress (50k cap) | 2.98M total records; capped at 50k for now. |
| P120 | JACAR (Japan Center for Asian Historical Records) | `ingest-jacar.ts` | 🔄 Full run in progress | B+C series 1931–1945. Shipped 2026-05-23. |
| P121 | Taiwan ROC National Archives | `ingest-taiwan-archives.ts` | ✅ Shipped 2026-05-23 | 3,935 records. archives.gov.tw. |
| P122 | Romania CNSAS (Securitate files) | `ingest-romania-cnsas.ts` | ✅ Shipped 2026-05-23 | 1,980 records. Institutional records (CC member lists, org charts) via Wayback CDX on cnsas.ro. |
| P123 | Czech ABS (StB files) | `ingest-czech-abs.ts` | ✅ Shipped 2026-05-23 | 104 records. abscr.cz structured database. |
| P124 | Bundesarchiv-BStU (Stasi) | `ingest-stasi.ts` | ⛔ BLOCKED | Script built, full run returned only 2 records. BStU site (stasi-mediathek.de) is TYPO3 CMS with noindex/nofollow, no API. No journalism bulk datasets found (Der Spiegel, Die Zeit, GitHub all checked). Formal research application to Bundesarchiv required — out of scope. |
| P128 | Commonwealth War Graves Commission | `ingest-cwgc.ts` | ❌ DROPPED | Failed reference-tier test — 1.7M individual casualty rows won't be directly cited by case studies. Script built but Azure WAF requires subscription key. Not worth pursuing. |
| P125 | FRUS — Foreign Relations of the United States | `ingest-frus.ts` | ✅ Shipped 2026-05-23 | 551 records. history.state.gov — WWI/WWII/Cold War US diplomacy. |
| P126 | Europeana WWI Collection | `ingest-europeana-wwi.ts` | ✅ Shipped 2026-05-23 | 10,000 records. WWI items across European archives (heavily Romanian). Language badge for non-EN claims: tabled, pending implementation. |
| P127 | Library of Congress Collections | `ingest-loc-collections.ts` | 🔄 Running via GitHub Actions | Both Mac Mini and Air IPs Cloudflare-banned. Workflow committed to repo; running from fresh GH runner. Script + workflow at .github/workflows/ingest-loc.yml. |

**Blocked on NARA key:**
- P117 JFK Records + full NARA bulk catalog — key requested 2026-05-23 via Catalog_API@nara.gov. Expected reply Tue/Wed. Key unlocks: P117 JFK + CIA, State Dept, DoD, Church Committee bulk.

**Blocked / No viable path currently:**
- P118 CIA FOIA — blocks all automation; Wayback CDX insufficient
- P124 Stasi (Bundesarchiv-BStU) — no API, no journalism datasets, formal application required
- China national archive (no open archive)
- Ukraine SBU (access complicated by war)
- Lithuania (Cloudflare blocking confirmed)

---

## In Progress / Pending (as of 2026-05-23)

- ✅ **UK vote enrichment** — `enrich-vote-counts.ts --full --country uk` — complete. 11,777 sources processed.
- ✅ **US Congress votes ingest** — `ingest-congress-votes.ts --full` — complete (113–119).
- ⏳ **US member-level vote enrichment** — `scripts/enrich-member-votes.ts`. Congress.gov API 404 bug under investigation. Fix pending; will run `--full` after fix confirmed.
- ⏳ **Wilson Center Digital Archive** (P110) — script built (`ingest-wilson-center.ts`), dry-run blocked by DNS failure on `digitalarchive.wilsoncenter.org`. Retry when network resolves.
- ⏳ **ProPublica Congress Votes** (P111) — script built (`ingest-propublica-congress.ts`), requires free `PROPUBLICA_API_KEY` from propublica.org/datastore. Get key → add to `.env.local` → run.

## 2026-05-22 Pipeline Batch — Status as of 2026-05-22 evening

| P# | Pipeline | Approach | Est. Records | Status | DB Count |
|----|----------|----------|-------------|--------|----------|
| — | **MeSH** | SPARQL (NLM) | ~30k total (9,995 ingested so far, capped) | ✅ Partial — second pass needed for remaining ~20k | 9,995 |
| P70 | **Slovakia** | TBD | TBD | ✅ Full run complete | 4,048 |
| P68 | **Hungary** | TBD | TBD | ⚠️ Partial (170 records) — full re-run needed | 170 |
| P91 | **Slovenia** | PISRS XML sitemaps | 4,822–15,374 | ⚠️ Partial (10 records) — full re-run needed | 10 |
| P88 | **Costa Rica** | CDX/Wayback (pgrweb.go.cr) | ~8,508 | 🔄 Full run in progress (2026-05-22 ~15:00 EDT) | ~0 |
| P66 | **Czech Republic** | TBD | TBD | ⚠️ Partial (5 records) — full re-run needed | 5 |
| P69 | **Romania** | TBD | TBD | ⚠️ Partial (5 records) — full re-run needed | 5 |
| P104 | **Latvia** | likumi.lv CDX | ~2,000 | ⚠️ Partial (5 records) — full re-run needed | 5 |
| P105 | **Lithuania** | e-seimas.lrs.lt | ~3,000 | ❌ BLOCKED — JSF ViewState + Cloudflare confirmed again 2026-05-22. Agent killed. | 0 |

### 🔧 Needs patching / full re-run (2026-05-22 batch)
These pipelines passed dry-run but full runs were partial or didn't complete. Scripts exist — just need a clean full run when time allows:
- **Hungary** (`hungary_legislation_v1`) — 170 in DB, target TBD. Re-run script.
- **Slovenia** (`slovenia_legislation_v1`) — 10 in DB, target 4,800+. Re-run script.
- **Czech Republic** (`czech_legislation_v1`) — 5 in DB, target TBD. Re-run script.
- **Romania** (`romania_legislation_v1`) — 5 in DB, target TBD. Re-run script.
- **Latvia** (`latvia_legislation_v1`) — 5 in DB, target ~2,000. Re-run script.
- **Costa Rica** (`costarica_legislation_v1`) — full run started 2026-05-22 ~15:00, confirm completion.
- **MeSH** — second pass needed for remaining ~20k after first 9,995.

### Scheduled for 2am cron 2026-05-22 (no API key required — agent-verified ✅)
- [ ] **Nuclear Tests** (`nuclear_tests_v1`) — `ingest-nuclear-tests.ts` — 202 records. US(62) USSR(39) China(34) France(27) UK(26) DPRK(6) India(6) Pakistan(2). All sourced to Wikipedia. No token needed.
- [ ] **Periodic Table** (`periodic_table_v1`) — `ingest-periodic-table.ts` — 118 elements. Bowserinator/IUPAC JSON. No token needed.
- [ ] **WHO Essential Medicines** (`who_essential_medicines_v1`) — `ingest-who-essential-medicines.ts` — 147 drugs from EML 23rd ed. (2023). No token needed.

---

## Tier 1 — High volume, clean APIs, strong editorial fit

- [x] **SEC EDGAR** — Pipeline 9 (`sec_edgar_v1`). Curated historically significant filings: Enron, WorldCom/MCI, Lehman Brothers, Boeing (737 MAX), General Electric. 379 filings (8-Ks, 10-Ks, 10-Qs). **Shipped 2026-05-20.**

- [ ] **WHO ICTRP / EU Clinical Trials Register** — non-US clinical trials, complementing ClinicalTrials.gov. API exists. Volume: tens of thousands of trials. Catches trials missed by US registry — global pharma history, hydroxychloroquine/ivermectin international coverage, non-US vaccine development.

- [ ] **Congress.gov / GovTrack** — every bill, vote, sponsor, cosponsor, committee action. API live. HARD_FACT: "Senator X voted Y on bill Z on date W." Volume: massive — every roll call vote since 1990s. Voting records on public health legislation, tobacco regulation, climate, confirmation votes. Pairs with SCOTUS for legislative-judicial axis.

- [x] **Federal Register** — Pipeline 14 (`fr_rules_v1`). Significant final rules (EO 12866) from EPA, FDA, OSHA, CMS, DEA, FTC, FCC since 1994. 1,920 records. **Shipped 2026-05-20.**

---

## Tier 2 — Medium volume, strong editorial value

- [ ] **CDC WONDER / NCHS** — US mortality data, cause of death, demographics. Queryable. Volume: decades of records. Smoking lung cancer mortality, opioid epidemic, COVID, suicide rates. Anchors public health claims in actual numbers.

- [ ] **NIH PubMed / NLM** — every indexed biomedical paper since 1946. E-utilities API. Volume: ~35M records (scope down to specific PMIDs + targeted queries: lab leak literature, GLP-1 mechanism, smoking-cancer epidemiology). Probably 500–2,000 records when scoped.

- [ ] **WIPO PatentScope** — international patents (PCT applications). Free API. Catches non-US pharma and biotech patents. Caveat: must be API-only sourcing per AGENTS.md verifiable-sourcing principle. No model recall after USPTO.

- [ ] **OpenSecrets / FEC** — campaign finance, lobbying disclosures. API live. Volume: massive. Tobacco industry lobbying, pharma PACs, climate denial funding. Anchors institutional-influence claims.

- [x] **USGS Earthquake Hazards Program** — Pipeline 12 (`usgs_eq_v1`). M6.5+ earthquakes since 1900. 4,696 events (17 M8.5+, 1,590 M7.0–8.4, 3,089 M6.5–6.9). **Shipped 2026-05-20.**

---

## Tier 3 — Historical/foundational substrate

- [x] **Wikidata Political Context enrichment** — shipped 2026-05-21. Backfills `PoliticalContext` (head of government at enactment) for 20,177 sources across 11 legislation pipelines. **Updated 2026-05-22:** US enrichment bug fixed (Wikidata SPARQL had no P580 qualifiers for historical presidential terms — replaced with hardcoded presidential term list for Q30; deleted + re-ran 12,280 hollow US rows). App integration shipped 2026-05-22: claim detail page shows HoG + party badge on each source edge; timeline tooltip includes HoG. Topic page now has party filter chips (🔵 Conservative / 🔴 Labour / etc.) with backend filtering via `edges.some.source.politicalContext.hogParty`. UK Parliament beta: 4,908/11,777 sources matched (42%), covering Chamberlain → Starmer.
- [ ] **Wikidata cross-reference layer** — link existing Source records to Wikidata Q-numbers. Not primary ingestion — quality variance too high for HARD_FACT. Use SPARQL for entity linking only.

- [x] **ICD-11 codes (WHO)** — Pipeline 11 (`icd11_v1`). WHO ICD-11 MMS linearization, 2024-01 release. 1,374 blocks + categories across all 26 chapters. **Shipped 2026-05-20.**

- [ ] **OECD / World Bank statistical APIs** — country-level economic and social indicators. Comparative public health (smoking rates by country, drug pricing internationally), economic context for policy claims.

---

## Tier 4 — Small but editorially loaded

- [x] **Nobel Prize records** — Pipeline 10 (`nobel_v1`). 1,378 laureate records (1901–2024), all 6 categories. **Shipped 2026-05-20.**

- [x] **Retraction Watch / CrossRef Retractions** — Pipeline 13 (`crossref_retractions_v1`, 26,624 + `retraction_watch_v1`, 110). Publisher-reported retractions via CrossRef API. **Shipped 2026-05-20.**

---

## Medium-impact features — Shipped 2026-05-23

- [x] **Full-text search** (`/search`) — ILIKE across claims + sources, filter by type, linked in nav.
- [x] **Topic pages** (`/topics`, `/topics/[slug]`) — party breakdown, timeline, vote patterns per topic.
- [x] **Parliamentary majority enrichment** — `enrich-parliamentary-majority.ts` built. Schema extended: `governingParty`, `majorityType`, `coalitionPartners`, `seatCount` on PoliticalContext. Dry-run: 219,965 rows across 49 countries eligible. Run `--full` to populate.

---

## Long-horizon features

- **Legislative vote data — Layer 1: Aggregate counts per source** ✅ Infrastructure shipped 2026-05-22
  `LegislativeVote` model fully wired: `byPartyJson` field added + migrated, `legislativeVotes` included in claims API, vote breakdown UI (Aye/No bar) in expanded EdgeRow on claim detail page. `scripts/enrich-vote-counts.ts` supports UK/US/Canada/EU/DE/IL.
  - **UK:** `enrich-vote-counts.ts --full --country uk` running as of 2026-05-22 ~18:17 EDT (11,777 sources, est. 1–3 hours). LV rows growing in real-time.
  - **US:** `ingest-congress-votes.ts --full` running as of 2026-05-22 ~19:50 EDT (Congress 113–119, all enacted bills). Once complete → run `enrich-vote-counts.ts --full --country us`.
  - **Canada, EU:** pending.
  - **Contested bills feature (planned):** After enrichment completes, build a contested vs. unanimous breakdown table — rank topics/bills by party disagreement score (e.g. |Aye% - No%| per party). Enables case studies showing "what do legislators actually fight about." Requires Layer 1 data fully populated across at least US + UK.

  **Voting statistics to compute (future):**
  - **Passage margin tiers:** `yea/(yea+nay)` → buckets: <55% bare majority, 55–70% moderate, 70–85% strong, 85%+ near-unanimous. Surface bills at constitutional minimums (simple majority for passage, 3/5 = 60% for cloture, 2/3 = 67% for veto overrides).
  - **Polarization trend:** average passage margin by Congress (113→119). Does it trend tighter over time? The slope is the polarization story.
  - **Chamber divergence:** compare House vs. Senate margins on the same bill. House parties vote in lockstep more; Senate is looser. Flag bills where one chamber squeaked and the other was lopsided.
  - **Cloture as a predictor:** when cloture barely passes (<65%), does final passage also squeak? Or do senators fall in line? Compare cloture margin vs. passage margin on paired votes.
  - **Zombie bills flag:** bills with more than one `voteType = 'passage'` row — failed, then revoted. Worth surfacing as a category ("rejected and reintroduced").
  - **By policy area:** once bill subjects/topic tags are available (Congress.gov subjects field), rank which policy areas have tightest margins. Requires additional enrichment step.
  - **Note on re-vote behavior:** the ingest DOES capture multiple votes on the same bill — each roll call has a unique roll number, so fail→revote shows as two separate `LegislativeVote` rows linked to the same Source. Only `passage` and `cloture` vote types are captured; intermediate amendment votes and procedural motions between those are filtered. So the "zombie" count is knowable from existing data with no schema changes.

- **Legislative vote data — Zeitgeist contrast: votes vs. media coverage**
  Cross-reference what legislators voted on (and how they voted) against what the press was covering at the same time. The hypothesis: newsrooms spotlight certain bills while ignoring others, even when the votes are close or consequential. Data approach: match `LegislativeVote` dates against a news article corpus (NYT, Guardian, etc.) for the same time window; score each bill by media mentions; rank bills by "contested but underreported" vs. "unanimous but over-covered." Opens a category of case studies — "what were legislators doing while the media looked away?" Requires a news ingest pipeline (NYT API is already keyed; Guardian API is free) as a complementary data source. Can also flip the lens: given a news story, find the legislation being passed simultaneously and ask whether the vote outcome aligned with public pressure or ignored it.

  **Implementation sketch (2026-05-22):**
  - Step 1: Pull NYT articles via Article Search API (key in TOOLS.md) for a date range. Store as Sources tagged `nyt_v1` with headline + section + date.
  - Step 2: For each `LegislativeVote` with a `voteDate`, query articles published within ±7 days. Count mentions of the bill title or keywords.
  - Step 3: Score the gap — "underreported contested" = small `|yesCount - noCount|` + low mention count; "over-covered unanimous" = near-100% passage + many articles.
  - Step 4: Surface as a ranked table — "10 most contested bills with zero news coverage" — or a scatter plot (x = vote margin, y = media attention).
  - Hardest part: title matching — bill names in voting records don't always match press shorthand. Fuzzy match or keyword extraction needed. Congress.gov bill subjects field helps.
  - Prototype path: start with the 505 US votes already in DB + NYT API. Could be built in a weekend.

- **Legislative vote data — Layer 2: Member-level votes + `Person` entities**
  Who specifically voted how on each bill. Significant schema work — new `Person` model (MP/Senator, wikidataId) + `Vote` junction → `Person` → `Source`. Prerequisite: Layer 1 fully populated.

  **EU Parliament: SHIPPED 2026-05-22** — `MemberVote` model added (no `Person` model needed; MEP identity stored as `memberId` + `memberName`). Enrichment script: `scripts/enrich-eu-member-votes.ts`. 1,348,631 rows across 1,900 EU Parliament LegislativeVotes. Full run: `enriched=1900 skipped=0 failed=0`. UI: claim detail page MEP table shows flag emoji (ISO 3166-1 alpha-3 → hardcoded lookup), colored party badge (EPP/SD/RENEW/ECR/GUE_NGL/GREEN_EFA/PFE/NI), and clickable HowTheyVote.eu profile link. Abstain votes styled in yellow.

  **US Congress: PENDING** — `scripts/enrich-member-votes.ts` exists. All 505 `congress_votes_v1` records returning 404 from Congress.gov API v3. Opus agent investigating correct URL format. After fix: run `--full`; UI already wired (bioguide.congress.gov profile links via `mepProfileUrl()`).

  **UK / Canada / Germany / Israel:** Not yet implemented for member-level.

- **Legislative vote data — Layer 3: Person pages (`/people/[id]`)**
  Individual MP/Senator profiles — all their votes, party history, legislation they sponsored, cross-referenced with the knowledge graph. Becomes its own section of the site. Prerequisite: Layer 2 done.

- **Legal force status on legislation** — laws that are no longer in force should remain as HARD_FACT (the fact that they existed and were enacted is still true) but carry a `status: repealed | expired | superseded` label and an `endOfValidity` date. EUR-Lex already exposes this explicitly (e.g. "No longer in force, Date of end of validity: 06/01/1987"). Should apply to EEC/EU legislation, US Federal Register rules, and any other law pipeline. Requires a `legalStatus` field on the Claim or Source schema. Lets users query "what was the law at time X" without conflating historical facts with current law.

- **Interactive globe — geotracked claims** ✅ **Globe Phase 3 SHIPPED 2026-05-30** — Click any country on the globe → sidebar shows paginated claim list for that jurisdiction via `PolityClaim` junction table (347,884 links across 205 polities). New API route `/api/globe/country-claims?country=XX&limit=20&offset=0`. Sidebar shows claim text, pipeline tag, verification badge, link to `/claims/[id]`, and "Load more" pagination. Previously shipped: time slider (1789–2026), heatmap/origins toggle, country search, historical borders. Pairs with the geographic fact distribution feature below.

- **Historical Event Graph (Phase 3)** ✅ **SHIPPED 2026-05-30** — `HistoricalEventVote` + `HistoricalEventPolity` junction tables live. 52,034 vote links + 25 polity links across 9 events. 2 API routes + 2 pages at `/historical-events`. Detail page: timeline, party/chamber breakdowns, paginated votes, polities, claims. Deployed to prod.

- **Polity table + claim/vote linking** ✅ **SHIPPED 2026-05-30** — `PolityVote` + `PolityClaim` junction tables (migration `20260530190000`). 462,251 links — 114,367 `PolityVote` + 347,884 `PolityClaim`. 205 of 2,361 polities matched by ISO alpha-2/3 + year range. Enables queries like "What did fascist governments vote on?" / "Claims under Soviet rule." Historical polities without ISO codes reserved for future curation. Deployed to prod.

- **Geographic fact distribution** — tag claims and case studies with the geography of their source institution (e.g. US university, Russian state outlet, EU regulatory body) and eventually of the subject matter itself. Goal: surface which facts are geographically clustered vs. universal. Phase 1: source-institution geo-tagging. Phase 2: map disputed claims by accepting/rejecting geography — e.g. Stalin's culpability for mass death is accepted as settled in the West but contested or minimized in certain post-Soviet contexts; similarly, some climate or pharma facts vary by jurisdiction. Phase 3: enable queries like "which facts about X are accepted in geography A but disputed in geography B." Requires entity tagging infrastructure and a geo dimension on Claim/Source records.

---

## Future Legislative Pipelines (Post-P52)

Extend the legislative queue after Russia. Ordered by API quality + editorial value.

### Tier A — Strong APIs, English available

| P# | Country / Body | API | Notes |
|----|----------------|-----|-------|
| 53 | ~~Korea (KLRI)~~ | klri.re.kr | **Shipped 2026-05-20 — 2,114 laws** |
| 54 | ~~Israel (Knesset)~~ | — | **Shipped 2026-05-20 — 2,009 laws** |
| 55 | Laws.Africa batch (9 countries) | api.laws.africa/v3/ | **BLOCKED — awaiting research access approval from Laws.Africa. Email sent.** Kenya, Ghana, Nigeria, Uganda, Zimbabwe, Zambia, Namibia, Lesotho |
| 56 | European Parliament | europarl.europa.eu/PortalPage/opensearch | Separate from EU Legislation (P16) |
| 57 | ~~Scotland~~ | — | **Shipped 2026-05-20 — 408 acts** |
| 58 | Wales (Senedd) | senedd.wales | Devolved legislation |
| 59 | Indonesia | peraturan.go.id/eng | 58k+ regulations, English interface |
| 60 | ~~ECHR (Council of Europe)~~ | hudoc.echr.coe.int | **Shipped 2026-05-23 — 10,296 judgments (`echr_judgments_v1`)** |
| 61 | ~~WTO Dispute Settlement~~ | — | **Shipped 2026-05-20 — 645 cases** |
| 62 | ~~ICJ (Int'l Court of Justice)~~ | — | **Shipped 2026-05-20 — 800 decisions** |
| 65 | ~~Malaysia~~ | — | **Shipped 2026-05-20 — 881 acts** |
| 76 | ~~Estonia~~ | — | **Shipped 2026-05-20 — 5,870 acts** |
| 77 | ~~Malta~~ | — | **Shipped 2026-05-20 — 563 laws** |
| 78 | ~~Georgia~~ | — | **Shipped 2026-05-20 — 301 laws** |
| 79 | ~~Jamaica~~ | — | **Shipped 2026-05-20 — 528 acts** |
| 80 | ~~Sri Lanka~~ | — | **Shipped 2026-05-20 — 1,704 acts** |
| 81 | ~~Peru~~ | — | **Shipped 2026-05-20 — 5,202 laws** |

### Tier B — Good data, lower-priority

| P# | Country / Body | API | Notes |
|----|----------------|-----|-------|
| 66 | Czech Republic | psp.cz | HTML only, N-Lex connected; **blocked — no JSON API** |
| 67 | Ukraine | zakon.rada.gov.ua | 292k+ docs, English abstracts; **blocked — 403 non-UA IPs** |
| 68 | Hungary | njt.hu | ELI URIs; **blocked — API endpoint 404** |
| 69 | Romania | legislatie.just.ro | N-Lex connected; **blocked — connection timeout** |
| 70 | Slovakia | slov-lex.sk | ELI-implemented, modern portal; **blocked — HTML only** |
| 71 | Vietnam | vbpl.vn/en | English portal exists; **blocked — connection timeout** |
| 72 | Pakistan | pakistancode.gov.pk | Pakistan Code has ~900+ consolidated acts in English — **better path than na.gov.pk (which was blocked). New candidate.** |
| 73 | Thailand | krisdika.go.th | English translations of major laws, official Council of State source |
| 74 | ~~UN General Assembly~~ | unbisnet.un.org | **Shipped 2026-05-23 — 598 resolutions (`un_ga_resolutions_v1`)** |
| 75 | ICC (Int'l Criminal Court) | icc-cpi.int | Indictments + judgments |
| 82 | ~~Uruguay~~ | impo.com.uy | **Running 2026-05-20 — ~4,300 laws, nohup active** |
| 83 | AfricanLII expansion | africanlii.org + per-country | 12 additional countries beyond P55 Laws.Africa 9: Malawi, Mauritius, Seychelles, Sierra Leone, Rwanda, Tanzania, Botswana, Liberia, eSwatini, Mozambique, Ethiopia, Zanzibar — check Laws.Africa REST API first, fall back to LII HTML |
| 84 | Turkey | mevzuat.gov.tr | Large corpus ~5–10k laws; unofficial API pattern via mevzuat-mcp reverse-engineering |
| 85 | ~~UAE~~ | — | **Shipped 2026-05-20 — 177 federal laws** |
| 86 | WIPO Lex (IP laws) | wipo.int/wipolex/en | 190+ countries' IP-specific legislation, free, no auth, good metadata |
| 87 | ~~PacLII — Pacific Islands~~ | paclii.org | **Running 2026-05-20 — ~800/1,254 fetched, nohup active. Solomon Islands + Vanuatu CDX timed out.** |
| 88 | Costa Rica | pgrweb.go.cr/scij | Best-structured Central American portal; ~3,000–5,000 leyes; Spanish |
| 89 | Trinidad & Tobago | rgd.legalaffairs.gov.tt/laws2 | English, chapter-numbered consolidated laws, ~400+ acts |
| 90 | Brunei | agc.gov.bn | English + Malay, official AGC, ~200+ acts |
| 91 | Slovenia | pisrs.si | ELI-compliant, N-Lex connected, ~2,000–3,000 acts; Slovenian |
| 92 | Luxembourg | legilux.public.lu | ELI-native portal, ~3,000+ acts; French primary |
| 93 | Cyprus | cylaw.org | English translations of many laws, ~1,000+ acts |
| 94 | UN Treaty Collection | treaties.un.org | ~560+ multilateral treaties, OData structured metadata |
| 95 | Inter-American Court of Human Rights | corteidh.or.cr | ~500+ judgments + advisory opinions; Spanish primary |

### Tier C — Translation pipeline required

| P# | Country / Body | Source | Notes |
|----|----------------|--------|-------|
| 96 | Serbia | pravno-informacioni-sistem.rs | ~5,000+ acts; Serbian |
| 97 | Western Balkans batch | pravo.gov.mk, qbz.gov.al, sluzbenilist.me, sluzbenilist.ba, gzk.rks-gov.net | North Macedonia, Albania, Montenegro, BiH, Kosovo — 1,000–3,000 acts each |
| 98 | Kazakhstan | adilet.zan.kz | ~10,000+ acts; Russian/Kazakh |
| 99 | Central Asia batch | arlis.am, e-qanun.az, lex.uz, cbd.minjust.gov.kg | Armenia, Azerbaijan, Uzbekistan, Kyrgyzstan — 2,000–5,000 each |
| 100 | Bolivia / Ecuador / Paraguay | gacetaoficialdebolivia.gob.bo, bacn.gov.py | Spanish primary; moderate coverage |
| 101 | Central America batch | asamblea.gob.pa, asamblea.gob.gt, etc. | Panama, Dominican Republic, Guatemala, Honduras, El Salvador, Nicaragua — Spanish |
| 102 | Caribbean batch | laws.bahamas.gov.bs, lawcourtscaribbean.org, etc. | Barbados, Bahamas, Belize, Guyana, OECS states — English, PDF-heavy |
| 103 | African Court on Human and Peoples' Rights | african-court.org | ~300+ judgments; English, French, Arabic, Portuguese |
| 104 | Latvia | likumi.lv/en | Official, ELI-connected, ~2,000 acts; Latvian |
| 105 | Lithuania | e-seimas.lrs.lt | N-Lex connected, ~3,000+ acts; Lithuanian |
| 106 | Bulgaria | dv.parliament.bg / lex.bg | Official gazette + aggregator, ~2–3k acts; Bulgarian |
| 107 | Croatia | zakon.hr / narodne-novine.nn.hr | N-Lex connected, ~2–3k acts; Croatian |

---

## Anti-recommendations

- **Wikidata as primary source** — quality variance forces audit cycles. Use only as cross-reference layer (linking Source records to Wikidata Q-numbers). Never ingest Wikidata claims as HARD_FACT.

---

## Master Pipeline Queue

**DB totals at last audit (2026-05-20): 306,646 sources / 305,593 claims**
**DB totals at 2026-05-21 ~12:30 EDT (verified): ~336,900+ claims across 90+ pipelines. RxNorm + ChEBI still writing.**
**DB totals at 2026-05-23 ~17:30 EDT (verified): ~400k+ claims. Added today: NATO 459, Austria Nationalrat 3,868, ECHR 10,296, UN GA 598, WHO GHO 1,001, OpenFDA Labels 52,354.**

### Shipped Today — 2026-05-23
| Tag | Pipeline | Records |
|-----|----------|---------|
| `nato_official_texts_v1` | NATO Official Texts (P17) | 459 |
| `nationalrat_v1` | Austria Nationalrat (P22) | 3,868 |
| `echr_judgments_v1` | ECHR Judgments (P60/P114) | 10,296 |
| `un_ga_resolutions_v1` | UN General Assembly (P74/P113) | 598 |
| `who_gho_v1` | WHO Global Health Observatory (P112) | 1,001 |
| `openfda_labels_v1` | OpenFDA Drug Labels | 52,354 |

### Currently Running (2026-05-21)
| P# | Pipeline | Status |
|----|----------|--------|
| — | RxNorm | 10,270/14,632 — ~20 min remaining |
| — | ChEBI | 15,950/62,000 — running all afternoon |
| — | OMIM | Paused (rate limit). Cron restart at 02:15 EDT 2026-05-22 |

### Completed Tonight (2026-05-20 → 21)
| P# | Pipeline | Notes |
|----|----------|-------|
| 82 | Uruguay | Completed ~21:07 EDT |
| 73 | Thailand | Completed ~22:44–23:08 EDT batch |
| 74 | UN General Assembly | Completed ~22:44–23:08 EDT batch |
| 75 | ICC | Completed ~22:44–23:08 EDT batch |
| 83 | AfricanLII | Completed before 23:42 EDT |
| 88 | Costa Rica | Completed ~22:44–23:08 EDT batch |
| 93 | Cyprus | Completed ~22:44–23:08 EDT batch |
| 94 | UN Treaties | Completed ~22:44–23:08 EDT batch |
| 99 | Central Asia | Completed ~22:44–23:08 EDT batch |
| 101 | Central America | Completed ~22:44–23:08 EDT batch |
| 102 | Caribbean | Completed ~22:44–23:08 EDT batch |
| 103 | African Court | Completed ~22:44–23:08 EDT batch |
| 107 | Croatia | Completed ~22:44–23:08 EDT batch |
| 90 | Indonesia | Completed ~22:44–23:08 EDT batch |
| — | Congress Votes | Completed before 23:42 EDT |
| — | Wikidata Political Context enrichment | Completed 23:51 EDT — 20,177 sources tagged, 219,965 PoliticalContext rows total |

### Ready to Run (scripts exist, dry-run verified, 0 in DB)
| Tag | Script | Est. count | Notes |
|-----|--------|-----------|-------|
| `periodic_table_v1` | `ingest-periodic-table.ts` | 118 | All elements from Bowserinator/IUPAC JSON. No API key needed. **Agent-verified ✅ — scheduled 2am 2026-05-22.** |
| `nuclear_tests_v1` | `ingest-nuclear-tests.ts` | 202 | Curated tests: US(62) USSR(39) China(34) France(27) UK(26) DPRK(6) India(6) Pakistan(2). All sourced to Wikipedia. Yields null where classified. No API key needed. **Agent-verified ✅ — scheduled 2am 2026-05-22.** |
| `who_essential_medicines_v1` | `ingest-who-essential-medicines.ts` | 147 | WHO EML 23rd ed (2023), hardcoded with ATC codes. No API key needed. **Agent-verified ✅ — scheduled 2am 2026-05-22.** |
| `volcanic_eruptions_v1` | `ingest-volcanic-eruptions.ts` | ~745 | NOAA NGDC Significant Volcanic Eruptions API. Year ≥ 1500, significant flag. GVP fallback wired. No API key needed. |
| `space_missions_v1` | `ingest-space-missions.ts` | 7,313 | GCAT TSV orbital launches (OrbPay > 0). Sputnik 1957 → 2020s. No API key needed. |
| `fred_v1` | `ingest-fred.ts` | ~4,000–5,000 | FRED observations: UNRATE, GDP, CPIAUCSL, FEDFUNDS, M2SL, CSUSHPINSA. **Needs FRED_API_KEY** (free at fred.stlouisfed.org/docs/api/api_key.html). |

### Needs New Script (no script yet)
| P# | Pipeline | Source | Notes |
|----|----------|--------|-------|
| 84 | Turkey | mevzuat.gov.tr | ~5–10k laws; **geo-blocked from this network** |
| 98 | Kazakhstan | adilet.zan.kz | ~10,000 acts; Russian/Kazakh |
| 100 | Bolivia / Ecuador / Paraguay | gacetaoficialdebolivia.gob.bo, bacn.gov.py | Spanish |

---

## Non-Legislative Hard-Fact Pipelines (Science, Medicine, History)

Domains beyond legislation — same reference-tier standard applies. Individual records must be directly citable in case studies.

### Tier 1 — Highest editorial value, clean APIs

| # | Dataset | Source | Est. records | Notes |
|---|---------|--------|-------------|-------|
| S1 | **Nuclear tests** ✅ | CTBTO / DOE declassified | 202 curated | Script: `ingest-nuclear-tests.ts` (`nuclear_tests_v1`). US(62) USSR(39) China(34) France(27) UK(26) DPRK(6) India(6) Pakistan(2). All sourced to Wikipedia. **Ready to run.** |
| S2 | **FRED economic indicators** ✅ | Federal Reserve (St. Louis) | ~4–5k obs | Script: `ingest-fred.ts` (`fred_v1`). Series: UNRATE, GDP, CPIAUCSL, FEDFUNDS, M2SL, CSUSHPINSA. **Needs FRED_API_KEY** (free at fred.stlouisfed.org). |
| S3 | **Periodic table elements** ✅ | NIST / IUPAC (Bowserinator JSON) | 118 | Script: `ingest-periodic-table.ts` (`periodic_table_v1`). No key needed. **Ready to run.** |
| S4 | **Space missions (GCAT)** ✅ | Jonathan McDowell (planet4589.org) | 7,313 orbital | Script: `ingest-space-missions.ts` (`space_missions_v1`). GCAT TSV, OrbPay > 0 filter. **Ready to run.** |
| S5 | **Major volcanic eruptions** ✅ | NOAA NGDC + GVP fallback | ~745 significant | Script: `ingest-volcanic-eruptions.ts` (`volcanic_eruptions_v1`). Year ≥ 1500, significant flag. **Ready to run.** |
| S6 | **IUCN Red List** | iucnredlist.org API | ~44,000 threatened species | No script yet. Needs IUCN API token (free registration). |

### Tier 2 — Strong value, slightly more complex

| # | Dataset | Source | Est. records | Notes |
|---|---------|--------|-------------|-------|
| S7 | **Particle Data Group (PDG)** | pdg.lbl.gov | ~600 particles | No script yet. Masses, lifetimes, discovery year, decay modes. Machine-readable tables at pdg.lbl.gov/2024/tables/. |
| S8 | **EM-DAT disasters** | emdat.be (CRED) | ~25,000 since 1900 | No script yet. Requires academic registration (free). Every major disaster: deaths, affected, economic damage. |
| S9 | **WHO Essential Medicines List** ✅ | who.int | 147 (EML 23rd ed.) | Script: `ingest-who-essential-medicines.ts` (`who_essential_medicines_v1`). Hardcoded from 2023 EML. No key needed. **Ready to run.** |
| S10 | **Olympic results (IOC)** | olympics.com / Olympedia | ~150,000 results | No script yet. Olympedia has structured format. |
| S11 | **Earth impact craters** | Earth Impact Database (UNB) | ~200 confirmed | No script yet. Small dataset, very clean. |
| S12 | **World Bank Open Data** | data.worldbank.org | Thousands of indicators | No script yet. Free API, no auth. |
| S13 | **SIPRI arms transfers** | sipri.org | Thousands of deals | No script yet. Free data downloads. |

### Tier 3 — Valuable but gated or complex

| # | Dataset | Source | Notes |
|---|---------|--------|-------|
| S14 | **DrugBank** | drugbank.com | Academic license required. Structured pharmacology, interactions, mechanisms. Complements RxNorm/ChEBI. Apply at drugbank.com/releases/latest#open-data. |
| S15 | **PharmGKB** | pharmgkb.org | Drug-gene interaction database. Free academic download. Complements OMIM + RxNorm. |
| S16 | **CDC WONDER** | wonder.cdc.gov | Mortality by cause of death, demographics, year. Queryable API. Opioid epidemic, smoking, suicide, COVID death rates. Background-tier risk for individual death records; aggregate queries are reference-tier. |
| S17 | **Exoplanet Archive (expanded)** | exoplanetarchive.ipac.caltech.edu | Already have nasa_exoplanet_v1 (6,277). Could expand with confirmed planet properties, discovery methods. |
| S18 | **Gene Ontology (GO)** | geneontology.org | ~45,000 terms linking genes to biological processes. Background-tier for most case studies unless specifically about gene function nomenclature. |

### Blocked — JS/SPA (stub scripts exist, need Playwright or alt API)
| P# | Pipeline | Script | Blocker |
|----|----------|--------|---------|
| 91 | Slovenia | ingest-slovenia-legislation.ts (stub) | pisrs.si API internal-only (USE_BACKEND_ENDPOINT_LOCAL=true); EUR-Lex SPARQL fallback returned 0 results. Fully blocked. |
| 92 | Luxembourg | ingest-luxembourg-legislation.ts (stub) | legilux.public.lu is Angular SPA; Elasticsearch proxy 404; Casemates SPARQL returns SPA HTML. Fully blocked. |
| 95 | IACHR | ingest-iachr.ts (stub) | corteidh.or.cr ColdFusion URLs 404; new portal requires JS rendering; no REST API |
| 104 | Latvia | ingest-latvia-legislation.ts (stub) | likumi.lv is React SPA; curl returns 1 result; no public API. Wayback CDX enumeration documented as alt path |
| 105 | Lithuania | ingest-lithuania-legislation.ts (stub) | e-seimas.lrs.lt requires JSF ViewState session tokens; e-tar.lt behind Cloudflare. **Re-confirmed blocked 2026-05-22.** |
| 106 | Bulgaria | ingest-bulgaria-legislation.ts (stub) | parliament.bg is Vue.js SPA with no accessible API; lex.bg behind Cloudflare |
| 96 | Serbia | ingest-serbia-legislation.ts (stub) | pravno-informacioni-sistem.rs is Vue.js SPA; 1,424 UUIDs found via CDX but all API endpoints return SPA shell unauthenticated; skupstina.rs DNS failure. Needs Playwright or paid API. |

### Blocked Externally (need VPN or API key)
| P# | Pipeline | Blocker |
|----|----------|---------|
| 52 | Russia | geo-blocked; needs Russian IP |
| 55 | Laws.Africa (9 African countries) | awaiting research access email |
| 67 | Ukraine | 403 non-UA IPs |
| 72 | Pakistan | TCP-timeout from this network |
| 42 | South Korea (full API) | needs IP-registered Open API key at open.law.go.kr |

### Non-Legislative Pipelines (next up)
| P# | Pipeline | Status | Notes |
|----|----------|--------|-------|
| — | Congress.gov votes | script exists | Voting records — pairs with congress_v1 already in DB |
| — | PubMed | pending | Anchor for science case studies |
| — | CDC WONDER | pending | Public health numbers |

---

## UI Features — Shipped / Tabled

| Feature | Status | Notes |
|---------|--------|-------|
| Performance fix — 35 DB indexes + 7 bounded API routes | ✅ Shipped 2026-05-26 | At 842k claims, site went down. CREATE INDEX CONCURRENTLY on all hot-path columns. API routes (edges, sources, timeline, threshold-events, meta-edges, homepage, domains) hardened with take/select. |
| CSP fix — `'unsafe-inline'` in script-src | ✅ Shipped 2026-05-26 | Next.js App Router RSC streaming requires inline scripts. Without it, React never hydrates — forms stay disabled, useEffect never fires. **Do not remove.** |
| `/stats` page — Phase 1 | ✅ Shipped 2026-05-23 | Polarization by legislature, top contested + unanimous votes. |
| `/stats` page — Phase 2: Topic breakdown, pass/fail, cross-country | ✅ Shipped 2026-05-24 | Topics by legislature, pass rate by topic, cross-country topic comparison. `result` + `topics` populated on all 2,948 votes. |
| `/stats` page — US Congress Deep Dive | ✅ Shipped 2026-05-24 | Close calls (<5% margin, 84 votes), House vs Senate breakdown, margin distribution, most contested topics. `getCongressStats()` in `lib/stats-queries.ts`. |
| `/stats` page — Party Line vs Bipartisan (US Congress) | ✅ Shipped 2026-05-30 | 505/505 `congress_v1` votes already have `byPartyJson` — full coverage confirmed. No backfill needed. |
| Polity linking | ✅ Shipped 2026-05-30 | 462,251 links created — 114,367 `PolityVote` + 347,884 `PolityClaim`. Junction tables `PolityVote` + `PolityClaim` (migration `20260530190000`). 205 of 2,361 polities matched by ISO alpha-2/3 + year range; historical polities without ISO reserved for future curation. Deployed to prod. |
| Historical Event Graph Phase 3 | ✅ Shipped 2026-05-30 | `HistoricalEventVote` + `HistoricalEventPolity` junction tables (migration 20260530180000). Linker script `scripts/link-historical-events.ts`. 2 API routes + 2 pages at `/historical-events`. Live DB: 52,034 vote links + 25 polity links across all 9 events (Cold War 28,399 · Vietnam 11,019 · COINTELPRO 6,556 · Church Committee 2,584 · WWII 1,422 · Korea 1,038 · CMC 348 · JFK 348 · Bay of Pigs 320). Timeline, party/chamber breakdowns, 50-per-page paginated votes, polities, claims. Deployed to prod. |
| Globe — time slider | ✅ Shipped 2026-05-30 | `/globe` now has a 1789–2026 year slider (play/pause + reset to Now) at bottom-center. Density refetches from `/api/globe/density-temporal?before=` (heatmap) and `/api/globe/origins?yearTo=` (origins), debounced 200ms. Country borders swap to nearest snapshot from `public/geo/historical` (parchment palette; click disabled below ~2010). Heatmap/Origins toggle, country search and sidebar still work. Deployed to prod. |
| Globe Phase 3 — country click claim list | ✅ Shipped 2026-05-30 | Click any country → sidebar shows paginated claim list via `PolityClaim` (347,884 links). New API `/api/globe/country-claims?country=XX&limit=20&offset=0` queries `Polity.countryCode` (alpha-3) then `PolityClaim` junction to `Claim`. UI: flag + country name + total count, filter input, claim cards with status badge + verification badge + pipeline tag, "Load more" pagination, link to `/claims/[id]`. Deployed to prod. |
| `/analysis/topics` — Topic Trends overhaul | ✅ Shipped 2026-05-30 | **Bug fixes:** (1) JS divergence chart bars now use pixel heights (160px container) — percentage heights on flex children were resolving to 0. (2) Decade heatmap column headers now show full year (`1780s` not `80s`). **New features:** Era color-band backgrounds on divergence chart bars + era legend row; era header row above heatmap decade columns; topic chips + table badges clickable → slide-in vote drawer (`/api/analysis/topic-trends/votes?topic=&era=&limit=&offset=`) with pagination; era rows in summary table clickable to update selectedEra with visual highlight. |
| CCES Representation Gap (full) | ✅ Shipped 2026-05-30 | `/analysis/representation` end-to-end. Schema: new `ConstituentOpinion` table (migration 20260530170000) with 24,615 (state, year, topic) rows ingested from Harvard Dataverse CES cumulative file (doi:10.7910/DVN/II2DB6, V11, 702k respondents, 2006–2024). Pipeline: `scripts/_cces_extract.py` (pyreadstat → JSON aggregates with liberal/conservative/dem/uninsured/union/evangelical pcts mapped across 26 LegislativeVote topic slugs) → `scripts/ingest-cces.ts` (200-row upsert tx, ALLOW_EDITS guarded, `cces_v1` tag). Analysis layer `lib/representationGap.ts` joins to 104k congress_v1/voteview_v1 MemberVote rows, computing gap = \|delegationYeaPct − constituentSupportPct\| plus party-split demGap/repGap. Topic-level stats with CCES-proxy column, decade trend, and Dem-vs-Rep party breakdown. |
| Language badge on claim cards | 🔜 Tabled | RO/EN/DE pill badge. Needs language field on ingest or Europeana dc:language backfill. |

## Notes

- API-only sourcing rule applies to all future pipelines — see AGENTS.md hard-fact-pipeline-rules. No model-recalled identifiers.
- Tier ordering weights: API availability × update frequency × relevance to existing case studies × SourceRelationship leverage (does it link entities already in the graph?).
- Some entries have contested edges (e.g. FAERS adverse events are reports, not confirmed causation — flag at ingestion time, not assumed clean).
- SEC EDGAR + Congress.gov together form the corporate-influence-on-legislation axis — highest combined editorial value in Tier 1.
