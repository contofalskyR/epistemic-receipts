# HARD_FACT Pipeline Roadmap

Future pipelines ranked by volume + editorial value. Add to this list as new candidates emerge. Cross off as pipelines ship.

---

## Shipped

- [x] Pipeline 1 — FDA Drug Approvals (openFDA)
- [x] Pipeline 2 — SCOTUS Rulings (Congress.gov/Justia)
- [x] Pipeline 3 — GenBank DNA Sequences (NCBI E-utilities)
- [x] Pipeline 4 — (internal — see git log)
- [x] Pipeline 5 — USPTO Patents (hardcoded curated list; audit in progress)
- [x] Pipeline 6 — Astronomy (NASA TAP exoplanets + IAU resolutions + solar system bodies)
- [x] Pipeline 7 – FDA Adverse Event Reporting System (FAERS)

---

## Tier 1 — High volume, clean APIs, strong editorial fit

- [x] **SEC EDGAR** — Pipeline 9 (`sec_edgar_v1`). Curated historically significant filings: Enron, WorldCom/MCI, Lehman Brothers, Boeing (737 MAX), General Electric. 379 filings (8-Ks, 10-Ks, 10-Qs), all CIKs verified against live EDGAR API. Dry-run complete 2026-05-16. Awaiting production run approval.

- [ ] **WHO ICTRP / EU Clinical Trials Register** — non-US clinical trials, complementing ClinicalTrials.gov. API exists. Volume: tens of thousands of trials. Catches trials missed by US registry — global pharma history, hydroxychloroquine/ivermectin international coverage, non-US vaccine development.

- [ ] **Congress.gov / GovTrack** — every bill, vote, sponsor, cosponsor, committee action. API live. HARD_FACT: "Senator X voted Y on bill Z on date W." Volume: massive — every roll call vote since 1990s. Voting records on public health legislation, tobacco regulation, climate, confirmation votes. Pairs with SCOTUS for legislative-judicial axis.

- [x] **Federal Register** — Pipeline 14 (`fr_rules_v1`). Significant final rules (EO 12866) from EPA, FDA, OSHA, CMS, DEA, FTC, FCC since 1994. ~1,921 records. No auth required. Dry-run complete 2026-05-17. Awaiting production run approval.

---

## Tier 2 — Medium volume, strong editorial value

- [ ] **CDC WONDER / NCHS** — US mortality data, cause of death, demographics. Queryable. Volume: decades of records. Smoking lung cancer mortality, opioid epidemic, COVID, suicide rates. Anchors public health claims in actual numbers.

- [ ] **NIH PubMed / NLM** — every indexed biomedical paper since 1946. E-utilities API. Volume: ~35M records (scope down to specific PMIDs + targeted queries: lab leak literature, GLP-1 mechanism, smoking-cancer epidemiology). Probably 500–2,000 records when scoped.

- [ ] **WIPO PatentScope** — international patents (PCT applications). Free API. Catches non-US pharma and biotech patents. Caveat: must be API-only sourcing per AGENTS.md verifiable-sourcing principle. No model recall after USPTO.

- [ ] **OpenSecrets / FEC** — campaign finance, lobbying disclosures. API live. Volume: massive. Tobacco industry lobbying, pharma PACs, climate denial funding. Anchors institutional-influence claims.

- [x] **USGS Earthquake Hazards Program** — Pipeline 12 (`usgs_eq_v1`). M6.5+ earthquakes since 1900, ~4,700 events. No auth required. Script written 2026-05-16. Dry-run pending.

---

## Tier 3 — Historical/foundational substrate

- [ ] **Wikidata** — structured data on millions of entities. SPARQL endpoint. Use as cross-reference layer for entities other pipelines already created (linking Source records to Wikidata Q-numbers), not as primary ingestion source. Quality variance too high to grandfather as HARD_FACT.

- [x] **ICD-11 codes (WHO)** — Pipeline 11 (`icd11_v1`). WHO ICD-11 MMS linearization, 2024-01 release. Blocks + categories across all 26 chapters. Script written 2026-05-16. Requires ICD API credentials (free registration). Dry-run pending.

- [ ] **OECD / World Bank statistical APIs** — country-level economic and social indicators. Comparative public health (smoking rates by country, drug pricing internationally), economic context for policy claims.

---

## Tier 4 — Small but editorially loaded

- [x] **Nobel Prize records** — Pipeline 10 (`nobel_v1`). 1,026 laureate records (1901–2024), all 6 categories. Nobel Foundation API. Dry-run complete 2026-05-16. Awaiting production run approval.

- [x] **Retraction Watch / CrossRef Retractions** — Pipeline 13 (`crossref_retractions_v1`). Publisher-reported retractions via CrossRef API (~26,500 records). Note: Retraction Watch dedicated API (api.retractionwatch.com) was unreachable; CrossRef is the primary DOI authority and equally verifiable. No auth required. Script written 2026-05-16. Dry-run pending.

---

## Anti-recommendations

- **Wikidata as primary source** — quality variance forces audit cycles. Use only as cross-reference layer (linking Source records to Wikidata Q-numbers). Never ingest Wikidata claims as HARD_FACT.

---

## Suggested next pipeline order

1. SEC EDGAR — biggest untapped mine, decades of records
2. PubMed — anchor for every science case study
3. FAERS — strengthens existing pharma case studies
4. Congress.gov + Federal Register — completes the federal record
5. CDC WONDER — public health numbers
6. Nobel + Retraction Watch — small wins, editorially loaded

---

## Notes

- API-only sourcing rule applies to all future pipelines — see AGENTS.md hard-fact-pipeline-rules. No model-recalled identifiers.
- Tier ordering weights: API availability × update frequency × relevance to existing case studies × SourceRelationship leverage (does it link entities already in the graph?).
- Some entries have contested edges (e.g. FAERS adverse events are reports, not confirmed causation — flag at ingestion time, not assumed clean).
- SEC EDGAR + Congress.gov together form the corporate-influence-on-legislation axis — highest combined editorial value in Tier 1.
