# Hard Facts Domains

Exhaustive list of knowledge domains that produce pure, institutional HARD_FACTs —
facts that don't expire, don't require interpretation, and serve as the reference
substrate for contested claims.

---

## Physics & Mathematics

- Physical constants (speed of light, Planck's constant, gravitational constant, Boltzmann, Avogadro, fine-structure constant, etc.)
- Fundamental particles — Standard Model: mass, charge, spin of each particle
- Laws of thermodynamics
- Mathematical constants (π, e, √2, φ, etc.)
- Proven mathematical theorems (Pythagorean, Fermat's Last Theorem, Gödel's incompleteness, etc.)
- SI unit definitions (redefined in 2019 — there's a before/after)
- NIST measurement standards and calibration values
- Spectroscopic data (atomic absorption/emission spectra)
- Crystallographic data (crystal structures — ICSD database)

---

## Chemistry

- Periodic table — all elements: atomic number, symbol, atomic mass, electron configuration, discovery date, discoverer
- Chemical compounds — molecular formula, CAS number, IUPAC name (PubChem, ChemSpider)
- Protein structures (Protein Data Bank — PDB entries are timestamped, attributed)
- Boiling/melting/flash points of substances (NIST Chemistry WebBook)
- Chemical reaction stoichiometry
- NIST Standard Reference Data
- Hazardous materials classifications (GHS, UN hazmat codes)

---

## Biology & Life Sciences

- Taxonomic classifications — all known species with binomial nomenclature (NCBI Taxonomy, Catalogue of Life)
- Gene sequences — GenBank DNA/RNA sequences (nucleotide sequences are facts; interpretation is not)
- Viral and bacterial genome sequences
- Phylogenetic tree of life (established clades)
- ICD-10/11 disease classifications (WHO)
- Human genome — reference sequence (GRCh38)
- Protein sequences (UniProt)
- Fossil record — species, location, dating method, date range (Paleobiology Database)

---

## Medicine & Pharmaceuticals

- FDA drug approvals — already ingesting (approval date, indication, sponsor)
- EMA drug approvals (European parallel)
- Drug molecular structures (PubChem / ChemSpider)
- ClinicalTrials.gov registrations — trial ID, registered date, intervention, primary endpoint, result date
- FDA Safety Communications — black box warnings, market withdrawals, safety signal dates
- WHO Essential Medicines List (with revision dates)
- Pharmacopeia entries — USP, British Pharmacopoeia (official drug standards)
- Drug interaction classifications (formal, not opinion-based ones)
- Vaccine approval dates and jurisdictions
- ICD procedure codes (medical procedures as institutional facts)

---

## Astronomy & Space

- Catalogued stars — HD catalog, Hipparcos, Gaia DR3 (position, magnitude, distance)
- Solar system — planetary mass, radius, orbital period, moons (IAU data)
- IAU classifications and reclassifications (Pluto 2006 — already a case study)
- Asteroid and comet catalog (NASA CNEOS, MPC)
- Exoplanet discoveries (NASA Exoplanet Archive — discovery date, method, parameters)
- Messier/NGC/IC deep-sky object catalog
- Eclipse dates and paths (computed, verifiable)
- Supernova observations (IAU circulars)
- Space mission launches and outcomes (NASA, ESA mission registry)

---

## Earth & Geography

- Country borders (officially recognized; disputed borders are claims, not facts)
- Capital cities (official, with date of designation)
- Mountain heights (surveyed — USGS, national surveys)
- River lengths and drainage basins
- Ocean depths (hydrographic surveys)
- Earthquake records (USGS ANSS catalog — magnitude, location, depth, date)
- Volcanic eruptions (Smithsonian Global Volcanism Program)
- Hurricane/cyclone records (NOAA HURDAT2)
- Sea level measurements (NOAA tide gauge network)
- Census populations (official government census data with year)
- Time zones (IANA tz database — official designations)

---

## Legal & Institutional

- SCOTUS rulings — already ingesting
- Federal Register regulations (CFR citations with effective dates)
- USPTO patent grants (patent number, assignee, filing date, grant date, claims)
- EPO patent grants (European parallel)
- UN treaty database — treaties, signatories, ratification dates
- Congressional legislation — bill number, passage date, enrolled text
- Constitutional amendments — all jurisdictions, with ratification dates
- International Court of Justice rulings
- WTO dispute settlement rulings
- Geneva Convention ratifications (country, date)

---

## Economics & Statistics

- GDP, GNI (World Bank, IMF — official national accounts)
- CPI / inflation rates (official government statistics bureaus — BLS, Eurostat, ONS)
- Unemployment rates (official, seasonally adjusted)
- Central bank interest rate decisions (Fed, ECB, BOE — with dates)
- Currency exchange rates (official central bank reference rates)
- Trade statistics (WTO, UN Comtrade)
- National debt figures (Treasury, official government)
- Olympic records — results, dates, athletes, locations (official IOC)
- Nobel Prize awards — who, field, year, stated reason (Nobel Foundation)

---

## Technology & Standards

- RFC specifications (Internet protocols — IETF, with publication date)
- IEEE/ISO/ANSI standards (with publication date and version)
- IANA protocol registries (port numbers, MIME types, TLDs)
- CVE vulnerability disclosures (NIST NVD — ID, disclosure date, CVSS score)
- Software version release dates (official release notes)
- DNS root zone file (TLD list — IANA)

---

## Historical Events (Dateable & Documented)

- Wars — official declarations and armistice/treaty dates
- Government formations — election results with official certification dates
- Heads of state — inaugurations, resignations, deaths in office
- Natural disaster records (cross-reference with USGS/NOAA above)
- Famines — official declarations, mortality estimates from official inquiries
- International organization founding dates (UN, WHO, NATO, etc.)
- Space race milestones — Sputnik, Apollo 11, etc. (NASA mission records)

---

## Notes for Opus session

- Not all of these have clean structured APIs — some require scraping or licensed access
- Priority ordering should weight: API availability, update frequency, relevance to case studies, SourceRelationship leverage
- The most unique value is when two domains intersect on the same claim (e.g. ClinicalTrials.gov + NIH Reporter + openFDA all touching the same drug — that's coordination-network territory)
- Some "facts" in this list have contested edges (e.g. country borders, some census methodology) — those should be flagged at ingestion time, not assumed clean
