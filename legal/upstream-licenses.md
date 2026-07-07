> **DRAFT — not yet reviewed by counsel. All rows marked UNKNOWN or RESTRICTED must be verified before those pipelines' data is included in any snapshot export or commercial redistribution.**

# Epistemic Receipts — Upstream Licence Audit Table

*Last updated: July 2026. Source: AGENTS.md active pipeline registry + science/medicine pipeline notes + ROADMAP.md shipped list. `lib/pipelines/registry.ts` did not exist at time of writing (Spec 11 in progress).*

*Where terms are uncertain: UNKNOWN. Never assume permissive.*

---

## Pipeline Registry — 50 pipelines

| Pipeline tag | Data source | Upstream licence | Redistribution allowed? | Attribution required? | Notes | Source URL |
|---|---|---|---|---|---|---|
| `crossref_retractions_v1` | CrossRef API (retraction metadata) | CrossRef metadata is available under CC0/open terms per CrossRef's Plus programme | Yes | Yes (scientific courtesy) | CrossRef metadata is CC0; individual publisher copyright in paper content does not flow to metadata. Verify current CrossRef API ToS. | https://www.crossref.org/documentation/retrieve-metadata/rest-api/ |
| `nasa_exoplanet_v1` | NASA Exoplanet Archive (Caltech/NASA) | US Government work — public domain | Yes | Yes (scientific acknowledgement requested by NASA) | No copyright in US Government works. | https://exoplanetarchive.ipac.caltech.edu/docs/acknowledge.html |
| `usgs_eq_v1` | USGS Earthquake Hazards Programme | US Government work — public domain | Yes | Yes (USGS requests acknowledgement) | No copyright in US Government works. | https://earthquake.usgs.gov/earthquakes/feed/v1.0/terms.php |
| `un_sc_resolutions_v1` | UN Security Council (un.org) | UN Terms of Use — non-commercial reproduction permitted; commercial use requires UN permission | CONDITIONAL — non-commercial only without written permission | Yes | UN terms allow free non-commercial reproduction. Commercial redistribution requires prior written consent from UN DPI. | https://www.un.org/en/about-us/terms-of-use |
| `fr_rules_v1` | Federal Register (Office of the Federal Register, US GPO) | US Government work — public domain | Yes | No | Federal Register data is explicitly in the public domain. API terms confirm this. | https://www.federalregister.gov/reader-aids/developer-resources/rest-api |
| `nobel_v1` | Nobel Prize Foundation API (nobelprize.org) | Nobel Foundation Terms of Use — generally permissive for data use | Yes with attribution | Yes | Nobel Foundation requests attribution. Verify current API ToS before commercial redistribution. | https://www.nobelprize.org/about/terms-of-use-for-api-nobelprize-org/ |
| `nih_reporter_v1` | NIH RePORTER (NIH, US Government) | US Government work — public domain | Yes | Yes (scientific courtesy) | NIH data is a US Government work. | https://api.reporter.nih.gov/ |
| `clinicaltrials_v1` | ClinicalTrials.gov (NLM/NIH, US Government) | US Government work — public domain | Yes | Yes (scientific courtesy requested) | ClinicalTrials.gov ToS confirm public domain status. | https://clinicaltrials.gov/about-site/terms-conditions |
| `faers_normalized_drugs_v1` | openFDA / FDA Adverse Event Reporting System (US Government) | US Government work — public domain | Yes | Yes (FDA requests acknowledgement) | openFDA explicitly states data is in public domain. | https://open.fda.gov/apis/ |
| `sec_edgar_v1` | SEC EDGAR (US SEC, US Government) | US Government work — public domain | Yes | Yes | EDGAR data is public record and US Government work. | https://efts.sec.gov/LATEST/search-index/about-api |
| `congress_v1` | Congress.gov / congress.gov API (Library of Congress, US Government) | US Government work — public domain | Yes | Yes (LC requests acknowledgement) | Congress.gov API terms confirm public domain. | https://api.congress.gov/ |
| `pubchem_v1` | PubChem (NCBI/NIH, US Government) | US Government work — public domain | Yes | Yes (NCBI requests acknowledgement) | PubChem explicitly states data is in the public domain. | https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest |
| `courtlistener_scotus_v1` | CourtListener / Free Law Project — SCOTUS opinions | SCOTUS opinions: US Government work (public domain). CourtListener metadata and citations: CC BY-SA 4.0 | Yes | Yes — CC BY-SA 4.0 (share-alike applies to derivative works) | Court opinions are US Government works; CourtListener's added metadata (citations, clusters) is CC BY-SA. Share-alike means derivatives must also be CC BY-SA. | https://free.law/terms/ |
| `courtlistener_circuits_v1` | CourtListener / Free Law Project — federal circuit courts | Same as above (court opinions public domain; metadata CC BY-SA 4.0) | Yes | Yes — CC BY-SA 4.0 (share-alike applies) | Same as scotus row. | https://free.law/terms/ |
| `doj_fara_v1` | DOJ FARA database (efile.fara.gov, US Government) | US Government work — public domain | Yes | Yes | FARA filings are public records, US Government works. | https://efile.fara.gov/ |
| `openfec_v1` | OpenFEC / Federal Election Commission (US Government) | US Government work — public domain | Yes | Yes | FEC data is a US Government work and public record. | https://api.open.fec.gov/developers/ |
| `openfec_ie_v1` | OpenFEC / Federal Election Commission (US Government) | US Government work — public domain | Yes | Yes | Same as openfec_v1. | https://api.open.fec.gov/developers/ |
| `openfda_v1` | openFDA (US FDA, US Government) | US Government work — public domain | Yes | Yes (FDA requests acknowledgement) | Same as faers row. | https://open.fda.gov/apis/ |
| `genbank_v1` | GenBank (NCBI/NIH, US Government) | US Government work — public domain | Yes | Yes (NCBI requests acknowledgement) | NCBI policies confirm data is in public domain. Sequence data submitted by researchers is also deposited without copyright restrictions per GenBank submission terms. | https://www.ncbi.nlm.nih.gov/home/about/policies/ |
| `iau_constellations_v1` | International Astronomical Union (IAU) | UNKNOWN | UNKNOWN | UNKNOWN | IAU publishes constellation boundary data but formal licence terms are unclear. Must verify at iau.org before snapshot inclusion. | https://www.iau.org/ |
| `iau_v1` | International Astronomical Union (IAU) | UNKNOWN | UNKNOWN | UNKNOWN | Same as iau_constellations_v1. | https://www.iau.org/ |
| `retraction_watch_v1` | Retraction Watch / Center for Scientific Integrity | UNKNOWN — potentially proprietary and restricted | UNKNOWN | UNKNOWN | Retraction Watch database is proprietary. The 55 records may have been manually curated. Formal licence terms unclear. Must verify at retractionwatch.com before any redistribution. | https://retractionwatch.com/retraction-watch-database-user-guide/ |
| `solar_system_v1` | UNKNOWN — source not documented in AGENTS.md | UNKNOWN | UNKNOWN | UNKNOWN | Source not identified. Must be investigated before snapshot inclusion. |  |
| `icd11_v1` | WHO ICD-11 (World Health Organization) | **CC BY-ND 3.0 IGO** — No Derivatives | **RESTRICTED** — ND clause prohibits redistribution of derivative works; transformation into Claim model may constitute a derivative | Yes (WHO attribution required) | **⚠ MUST RESOLVE.** The No Derivatives clause is significant: transforming ICD-11 content into our data model likely creates a derivative work, which cannot be redistributed under CC BY-ND without a separate licence from WHO. | https://www.who.int/about/policies/publishing/copyright |
| `nato_official_texts_v1` | NATO official publications (nato.int) | NATO Terms of Use — non-commercial, private, and educational use permitted; commercial use requires written permission | CONDITIONAL — non-commercial without permission | Yes | NATO's ToS allows non-commercial reproduction with attribution. Commercial redistribution requires prior written NATO consent. Script exists but has never been run. | https://www.nato.int/cps/en/natohq/topic_51832.htm |
| `riksdag_v1` | Swedish Riksdag (riksdag.se open data) | CC0 (Swedish government open data) | Yes | No (CC0 — no attribution required; courtesy attribution recommended) | riksdag.se publishes parliamentary data as CC0 open data. | https://data.riksdagen.se/ |
| `tweedekamer_v1` | Dutch Tweede Kamer (opendata.tweedekamer.nl OData) | Open Government Data — CC0 | Yes | No (CC0) | Dutch parliament publishes data as open government data. | https://opendata.tweedekamer.nl/ |
| `bundestag_v1` | German Bundestag DIP API (dip.bundestag.de) | UNKNOWN — DIP API terms not confirmed | UNKNOWN | UNKNOWN | The Bundestag DIP API provides public legislative data but explicit licence terms for the API data have not been confirmed. Verify before snapshot inclusion. | https://dip.bundestag.de/über-dip/hilfe/api |
| `nationalrat_v1` | Austrian Nationalrat (parlament.gv.at) | Austrian Open Government Data — CC BY 4.0 or CC0 | Yes (verify specific terms) | Yes (if CC BY) | Austria participates in the EU's open data directive. Verify exact licence on the specific data endpoint used. | https://www.parlament.gv.at/verstehen/open-data/ |
| `oireachtas_v1` | Irish Oireachtas (api.oireachtas.ie) | CC BY 4.0 | Yes | Yes | Oireachtas API documentation states CC BY 4.0. | https://api.oireachtas.ie/ |
| `canada_bills_v1` | Parliament of Canada LEGISinfo API | Open Government Licence — Canada (OGL-C) v2.0 | Yes | Yes | OGL-C v2.0 permits reproduction and distribution with attribution. | https://www.parl.ca/legisinfo/en/about/open-data |
| `uk_legislation_v1` | legislation.gov.uk (The National Archives, UK Government) | Open Government Licence v3.0 (OGL v3) | Yes | Yes | OGL v3 is very permissive. Attribution to "legislation.gov.uk" required. | https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ |
| `rxnorm_v1` | NLM RxNorm (NIH/NLM, US Government) | CONDITIONAL — core NLM content is public domain; RxNorm bundles some content from commercial terminologies (e.g., FDA, AMA, etc.) that requires UMLS Licence acceptance | CONDITIONAL — requires UMLS Licence acceptance for some source content | Yes | **Must verify:** some sources within RxNorm (e.g., SNOMED CT, AMA MedLine/Drug codes) require UMLS Metathesaurus Licence. Redistribution without UMLS Licence acceptance by downstream users is not permitted for those sources. | https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html |
| `chebi_v1` | ChEBI / EMBL-EBI (European Bioinformatics Institute) | CC BY 4.0 | Yes | Yes | ChEBI clearly states CC BY 4.0. | https://www.ebi.ac.uk/chebi/aboutChebiForwardButton.do |
| `omim_v1` | OMIM (Online Mendelian Inheritance in Man — Johns Hopkins University) | **OMIM proprietary licence** — redistribution prohibited | **NO** | Yes | **⚠ MUST RESOLVE.** OMIM is copyrighted by Johns Hopkins University and may not be redistributed or used in commercial applications without prior written permission. 1,512 records currently in database. Snapshot inclusion blocked until redistribution rights are confirmed or OMIM data is removed. | https://www.omim.org/help/agreement |
| `openfda_labels_v1` | openFDA drug labels (US FDA, US Government) | US Government work — public domain | Yes | Yes (FDA requests acknowledgement) | Same as openfda_v1. BLOCKED pending other decisions per AGENTS.md. | https://open.fda.gov/apis/ |
| `nuclear_tests_v1` | Wikipedia (curated from Wikipedia nuclear test pages, per AGENTS.md) | CC BY-SA 4.0 (Wikipedia content licence) | Yes | Yes — CC BY-SA 4.0 (share-alike) | Wikipedia content is CC BY-SA 4.0. Share-alike requires derivatives to also be CC BY-SA. Attribution to Wikipedia required. | https://creativecommons.org/licenses/by-sa/4.0/ |
| `periodic_table_v1` | Bowserinator/Periodic-Table-JSON (GitHub) + IUPAC | MIT licence (for the JSON file) | Yes | Yes (MIT: include licence notice) | The GitHub repo uses MIT licence. IUPAC atomic weights data is incorporated — IUPAC generally considers this data public. | https://github.com/Bowserinator/Periodic-Table-JSON |
| `who_essential_medicines_v1` | WHO Essential Medicines List (World Health Organization) | **CC BY-NC-SA 3.0 IGO** — Non-Commercial, Share-Alike | **CONDITIONAL** — non-commercial only without permission; commercial redistribution prohibited without WHO licence | Yes | **⚠ MUST RESOLVE for commercial use.** NC (Non-Commercial) clause means this data cannot be included in commercial snapshots or commercial redistribution without a separate WHO licence. Share-alike also applies to derivatives. | https://www.who.int/about/policies/publishing/copyright |
| `volcanic_eruptions_v1` | NOAA NGDC (primary) + Smithsonian Global Volcanism Program (fallback) | NOAA: US Government work (public domain); GVP: UNKNOWN | CONDITIONAL — NOAA data yes; GVP terms UNKNOWN | Yes | **Partial UNKNOWN.** NOAA component is clear (public domain). GVP terms must be verified. If GVP data is used, verify terms at volcano.si.edu before snapshot inclusion. | https://www.ngdc.noaa.gov/hazard/volcano.shtml · https://volcano.si.edu/ |
| `space_missions_v1` | GCAT — Jonathan McDowell's General Catalog of Artificial Space Objects | UNKNOWN — no formal licence found | UNKNOWN | UNKNOWN | McDowell publishes GCAT freely on his personal website but no formal open data licence is documented. Must verify before snapshot inclusion. | https://planet4589.org/space/gcat/ |
| `fred_v1` | St. Louis Fed FRED (Federal Reserve Economic Data) | Mixed — Federal Reserve data is public domain; third-party series within FRED may have individual licences | CONDITIONAL — varies by series | Varies by series | **Must verify per series.** FRED's ToS: Federal Reserve data is public domain. Third-party series (e.g., OECD, World Bank within FRED) have their own licence terms. The 6 series in this pipeline (UNRATE, GDP, CPIAUCSL, FEDFUNDS, M2SL, CSUSHPINSA) are all BLS/BEA/Federal Reserve — likely public domain. Verify each. | https://fred.stlouisfed.org/legal/ |
| `nz_legislation_v1` | New Zealand Parliamentary Counsel Office (legislation.govt.nz) | Crown Copyright — re-use permitted under NZGOAL / CC BY 4.0 | Yes | Yes | New Zealand legislation is published under Creative Commons Attribution 4.0. | https://www.legislation.govt.nz/about/termsofuse.aspx |
| `nz_repealed_acts_v1` | New Zealand Parliamentary Counsel Office | Crown Copyright — CC BY 4.0 (same as nz_legislation_v1) | Yes | Yes | Same as nz_legislation_v1. | https://www.legislation.govt.nz/about/termsofuse.aspx |
| `nz_bills_v1` | New Zealand Parliamentary Counsel Office | Crown Copyright — CC BY 4.0 | Yes | Yes | Same as nz_legislation_v1. | https://www.legislation.govt.nz/about/termsofuse.aspx |
| `nz_local_acts_v1` | New Zealand Parliamentary Counsel Office | Crown Copyright — CC BY 4.0 | Yes | Yes | Same as nz_legislation_v1. | https://www.legislation.govt.nz/about/termsofuse.aspx |
| `vdem_v1` | V-Dem Institute (Varieties of Democracy) | CC BY 4.0 | Yes | Yes | V-Dem explicitly publishes dataset under CC BY 4.0. | https://www.v-dem.net/data/the-v-dem-dataset/ |
| `who_gho_v1` | WHO Global Health Observatory | **CC BY-NC-SA 3.0 IGO** — Non-Commercial, Share-Alike | **CONDITIONAL** — non-commercial only without permission | Yes | **⚠ MUST RESOLVE for commercial use.** Same NC restriction as who_essential_medicines_v1. | https://www.who.int/about/policies/publishing/copyright |
| `congress_stock_act_v1` | STOCK Act financial disclosures (US House / US Senate) | US Government work — public records | Yes | Yes | STOCK Act filings are public records mandated by law, US Government works. | https://disclosures.house.gov/ |
| `stasi_v1` | Bundesarchiv (German Federal Archives) | UNKNOWN/RESTRICTED — Bundesarchiv gate noted in AGENTS.md | UNKNOWN | UNKNOWN | **⚠ MUST RESOLVE.** AGENTS.md notes this pipeline is "Already blocked (Bundesarchiv gate)" — only 2 records currently in DB. Bundesarchiv materials have specific copyright and access terms. Do not include in snapshots until resolved. | https://www.bundesarchiv.de/ |
| `uspto_v1` *(RETIRED)* | USPTO (US Patent and Trademark Office, US Government) | US Government work — public domain | Yes | Yes | **RETIRED 2026-05-12** — 182 records deprecated due to data quality failures (fabricated metadata). Public domain status of USPTO data is not in question; retirement is for quality, not licence reasons. | https://developer.uspto.gov/ |

---

## Coverage summary

- **Total pipeline tags enumerated:** 50 (from AGENTS.md active registry + science/medicine notes + ROADMAP.md shipped list, as of July 2026)
- **Clear permission (public domain or open licence):** 32
- **Conditional (non-commercial restriction, share-alike, or partial unknown):** 9 — `un_sc_resolutions_v1`, `courtlistener_scotus_v1`, `courtlistener_circuits_v1`, `nato_official_texts_v1`, `rxnorm_v1`, `nuclear_tests_v1`, `who_essential_medicines_v1`, `volcanic_eruptions_v1`, `fred_v1`
- **UNKNOWN (must verify before snapshot inclusion):** 7 — `iau_constellations_v1`, `iau_v1`, `retraction_watch_v1`, `solar_system_v1`, `bundestag_v1`, `space_missions_v1`, `stasi_v1`
- **RESTRICTED (redistribution prohibited or blocked):** 2 — `icd11_v1` (CC BY-ND), `omim_v1` (proprietary)
- **Retired:** 1 — `uspto_v1`

*Note: Pipelines in the scripts directory that are not yet active in the DB (future planned pipelines from ROADMAP.md) are not included here. Each new pipeline must have a row added to this table before its data is included in any snapshot export.*

---

## ⚠ Must resolve before snapshot inclusion

The following pipelines have upstream terms that prohibit or materially restrict redistribution. **Do not include their data in snapshot exports until the relevant issue is resolved.**

| Pipeline tag | Blocker | Resolution path |
|---|---|---|
| `omim_v1` | OMIM proprietary licence explicitly prohibits redistribution. ~1,512 records in DB. | Either (a) remove OMIM data from all snapshots, or (b) obtain a redistribution licence from OMIM. Contact: omim.org/help/contact |
| `icd11_v1` | CC BY-ND 3.0 IGO — No Derivatives. Transformation into our Claim model may constitute a derivative work, which is not redistributable under ND. | Either (a) exclude from snapshots, or (b) obtain a specific licence from WHO. Script exists but never run; consider not running until resolved. |
| `stasi_v1` | AGENTS.md notes "Already blocked (Bundesarchiv gate)." Bundesarchiv terms unknown. | Verify Bundesarchiv redistribution terms. Only 2 records in DB. |
| `who_essential_medicines_v1` | CC BY-NC-SA 3.0 IGO — Non-Commercial restriction. Data cannot be in commercial snapshots. | Exclude from commercial snapshots; include in community snapshots only; OR obtain a commercial licence from WHO. |
| `who_gho_v1` | CC BY-NC-SA 3.0 IGO — same NC restriction as above. | Same resolution path as who_essential_medicines_v1. |
| `retraction_watch_v1` | Licence terms unknown; database likely proprietary. | Verify terms with Retraction Watch/Center for Scientific Integrity. Only 55 records. |
| `solar_system_v1` | Source not documented; upstream terms unknown. | Identify and document the data source. Verify licence. |
| `iau_constellations_v1` / `iau_v1` | IAU formal licence terms not confirmed. | Verify with IAU directly or confirm the specific dataset used and its licence. |
| `space_missions_v1` | GCAT has no formal open-data licence. | Contact Jonathan McDowell or verify that informal public release constitutes permissive use. |
| `bundestag_v1` | DIP API licence terms not confirmed in writing. | Verify Bundestag DIP API ToS explicitly permits redistribution. |
| `rxnorm_v1` | Some RxNorm source content requires UMLS Licence acceptance by downstream users. | Either (a) exclude UMLS-licensed source content from redistribution, or (b) require downstream users to accept UMLS Licence. |
| `un_sc_resolutions_v1` | UN ToS requires written permission for commercial redistribution. | For commercial snapshots, obtain permission from UN DPI; or exclude from commercial tier. |
| `nato_official_texts_v1` | NATO ToS requires written permission for commercial redistribution. Script never run. | Do not run full ingest until redistribution decision is made; or exclude from commercial snapshots. |

---

*All URL citations were confirmed reachable as of the date of this draft. Terms change; re-verify before each commercial agreement.*
