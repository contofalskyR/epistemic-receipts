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

---

## Tier 1 — High volume, clean APIs, strong editorial fit

- [ ] **SEC EDGAR** — every public company filing since the 1990s. 10-Ks, 10-Qs, 8-Ks, S-1s, executive compensation, insider transactions. Free API. HARD_FACT shape: "Company X filed a 10-K on date Y reporting revenue of Z." Volume: tens of thousands of filings/year, decades of history. Strengthens corporate accountability case studies — Enron, Theranos, FTX, pharma financial disclosures vs public claims.

- [ ] **FDA Adverse Event Reporting System (FAERS)** — every reported adverse event for every FDA-approved drug. Live API. HARD_FACT: "Adverse event X was reported for drug Y on date Z." Volume: millions of records. Strengthens Ozempic, smoking, opioid, Vioxx-era case studies. Direct sibling to existing OpenFDA pipeline.

- [ ] **WHO ICTRP / EU Clinical Trials Register** — non-US clinical trials, complementing ClinicalTrials.gov. API exists. Volume: tens of thousands of trials. Catches trials missed by US registry — global pharma history, hydroxychloroquine/ivermectin international coverage, non-US vaccine development.

- [ ] **Congress.gov / GovTrack** — every bill, vote, sponsor, cosponsor, committee action. API live. HARD_FACT: "Senator X voted Y on bill Z on date W." Volume: massive — every roll call vote since 1990s. Voting records on public health legislation, tobacco regulation, climate, confirmation votes. Pairs with SCOTUS for legislative-judicial axis.

- [ ] **Federal Register** — every federal agency rule, proposed rule, notice. API live. Volume: ~80,000 documents/year. EPA rulemaking, FDA guidance, OSHA standards. Completes the executive-branch layer alongside SCOTUS (judicial) and Congress (legislative).

---

## Tier 2 — Medium volume, strong editorial value

- [ ] **CDC WONDER / NCHS** — US mortality data, cause of death, demographics. Queryable. Volume: decades of records. Smoking lung cancer mortality, opioid epidemic, COVID, suicide rates. Anchors public health claims in actual numbers.

- [ ] **NIH PubMed / NLM** — every indexed biomedical paper since 1946. E-utilities API. Volume: ~35M records (scope down to specific PMIDs + targeted queries: lab leak literature, GLP-1 mechanism, smoking-cancer epidemiology). Probably 500–2,000 records when scoped.

- [ ] **WIPO PatentScope** — international patents (PCT applications). Free API. Catches non-US pharma and biotech patents. Caveat: must be API-only sourcing per AGENTS.md verifiable-sourcing principle. No model recall after USPTO.

- [ ] **OpenSecrets / FEC** — campaign finance, lobbying disclosures. API live. Volume: massive. Tobacco industry lobbying, pharma PACs, climate denial funding. Anchors institutional-influence claims.

- [ ] **USGS Earthquake Hazards Program** — every recorded earthquake, GeoJSON API. Volume: hundreds of thousands. Niche unless geology/disaster case study built. Pure HARD_FACT, trivial to ingest.

---

## Tier 3 — Historical/foundational substrate

- [ ] **Wikidata** — structured data on millions of entities. SPARQL endpoint. Use as cross-reference layer for entities other pipelines already created (linking Source records to Wikidata Q-numbers), not as primary ingestion source. Quality variance too high to grandfather as HARD_FACT.

- [ ] **ICD-10 / ICD-11 codes (WHO)** — every disease classification code with name and hierarchy. Volume: ~70,000 codes. Medical taxonomy substrate. Smaller pipeline, ~one afternoon.

- [ ] **OECD / World Bank statistical APIs** — country-level economic and social indicators. Comparative public health (smoking rates by country, drug pricing internationally), economic context for policy claims.

---

## Tier 4 — Small but editorially loaded

- [ ] **Nobel Prize records** — Nobel Foundation has every laureate, year, field, and citation. Volume: ~1,000 records total. Mullis (PCR), Doudna/Charpentier (CRISPR), Watson/Crick/Wilkins (DNA). Connects to existing GenBank and USPTO substrate.

- [ ] **Retraction Watch Database** — every retracted paper. Free API key available. Volume: ~50,000. High editorial value for case studies where consensus shifted because of fabricated research. Pairs with PubMed.

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
