# Upstream licence review (for Robert's decision)

Source: `docs/paper/upstream-licences.csv` (one row per pipeline, with the page each statement came from; checked 2026-10-24). Every pipeline whose status is not `open` is listed below. The dataset licence is CC BY 4.0 (owner decision 2026-10-24). *Scientific Data* requires CC0 / CC BY "in most cases" and allows -SA or -NC "only where applied to secondary data that has been generated from primary datasets from third parties where those original licence terms need to be retained"; it does not allow inputs under -ND to be compiled at all (`journal-requirements.md`).

How each option is implemented: `scripts/paper/export.ts --exclude-pipelines a,b,…` drops a pipeline and everything attached to it; otherwise each claim carries `upstreamLicence` and `upstreamLicenceStatus`, and `pipelines` repeats them per pipeline.

Not legal advice: what the export ships is our own claim text plus upstream identifiers, dates, metadata fields and links, not the upstream documents. Whether a provider's terms reach that is a legal question; this list records only what each provider says.

## Totals

| Status | Pipelines | Claims |
|---|---:|---:|
| open | 57 | 1,056,170 |
| restricted | 10 | 45,832 |
| nc | 16 | 24,798 |
| sa | 2 | 19,896 |
| unclear | 18 | 249,956 |
| not_checked | 84 | 360,947 |
| **total** | 187 | 1,757,599 |

The four you named: **SIPRI** `nc` (non-commercial fair use, >10 % needs permission) · **V-Dem** `sa` (CC BY-SA 4.0) · **Nobel** `open` (CC0, with conditions not to alter the data) · **UCDP** `open` (CC BY 4.0).

## restricted (10 pipelines, 45,832 claims)

| Pipeline | Claims | What the terms say | Source | Proposal |
|---|---:|---|---|---|
| `who_gho_v1` | 33,714 | WHO dataset terms: use for public health purposes; alteration beyond minimal styling needs permission; WHO may terminate (ICD-11 and EML may have their own licences (not checked)) | [link](https://www.who.int/about/policies/publishing/data-policy/terms-and-conditions) | **Exclude** (recommended), or ask the provider |
| `fred_v1` | 4,349 | FRED terms: API content may not be stored, archived or compiled into a database; third-party copyrighted series need owner permission (includes CSUSHPINSA (S&P CoreLogic Case-Shiller)) | [link](https://fred.stlouisfed.org/legal/) | **Exclude** (recommended), or ask the provider |
| `un_sc_resolutions_v1` | 2,798 | UN site terms: personal non-commercial use, no redistribution, no compilations or derivative works (claims carry facts (symbol, date, outcome) and links; UN document-specific terms not checked) | [link](https://www.un.org/en/about-us/terms-of-use) | Either: include with per-row licence (claims hold resolution symbol, date and outcome — facts — plus links; the claim text is ours), or exclude. **Recommend include**; ask the UN Dag Hammarskjöld Library if unsure |
| `omim_v1` | 1,512 | OMIM: personal, educational or research use; redistribution needs a Johns Hopkins licence (omim.org returned 403; terms from copies quoted in third-party licence files) | [link](https://omim.org/help/agreement) | **Exclude** (recommended), or ask the provider |
| `icd11_v1` | 1,374 | WHO dataset terms: use for public health purposes; alteration beyond minimal styling needs permission; WHO may terminate (ICD-11 and EML may have their own licences (not checked)) | [link](https://www.who.int/about/policies/publishing/data-policy/terms-and-conditions) | **Exclude** pending a check of the ICD-11 licence |
| `congress_stock_act_v1` | 921 | Quiver Quantitative ToS: personal, non-commercial use; no reproduction or distribution | [link](https://www.quiverquant.com/termsofservice/) | **Exclude** (recommended), or ask the provider |
| `un_ga_resolutions_v1` | 501 | UN site terms: personal non-commercial use, no redistribution, no compilations or derivative works (claims carry facts (symbol, date, outcome) and links; UN document-specific terms not checked) | [link](https://www.un.org/en/about-us/terms-of-use) | As `un_sc_resolutions_v1` |
| `un_treaties_v1` | 419 | UN site terms: personal non-commercial use, no redistribution, no compilations or derivative works (claims carry facts (symbol, date, outcome) and links; UN document-specific terms not checked) | [link](https://www.un.org/en/about-us/terms-of-use) | As `un_sc_resolutions_v1` |
| `who_essential_medicines_v1` | 147 | WHO dataset terms: use for public health purposes; alteration beyond minimal styling needs permission; WHO may terminate (ICD-11 and EML may have their own licences (not checked)) | [link](https://www.who.int/about/policies/publishing/data-policy/terms-and-conditions) | **Exclude** pending a check of the EML licence |
| `un_ga_v1` | 97 | UN site terms: personal non-commercial use, no redistribution, no compilations or derivative works (claims carry facts (symbol, date, outcome) and links; UN document-specific terms not checked) | [link](https://www.un.org/en/about-us/terms-of-use) | As `un_sc_resolutions_v1` |

## nc (16 pipelines, 24,798 claims)

| Pipeline | Claims | What the terms say | Source | Proposal |
|---|---:|---|---|---|
| `echr_judgments_v1` | 9,984 | ECHR site: reproduction free of charge for private, information or education use; commercial use needs written permission | [link](https://www.echr.coe.int/copyright-and-disclaimer) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |
| `sipri_milex_v1` | 8,435 | SIPRI terms: non-commercial fair use; reproducing more than 10% of a data set needs permission (8,435 + sipri_v1 claims likely exceed 10% of the data set) | [link](https://www.sipri.org/about/terms-and-conditions) | **Exclude**, or request SIPRI permission: the terms require permission to reproduce more than 10 % of a data set, whatever the purpose |
| `zambia_legislation_v1` | 1,119 | CC BY-NC 4.0 (AfricanLII; some collections more permissive, per landing page) (country pipelines from scripts/ingest-africa-lii.ts) | [link](https://africanlii.org/en/terms-of-use/) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |
| `africanlii_v1` | 962 | CC BY-NC 4.0 (AfricanLII; some collections more permissive, per landing page) (country pipelines from scripts/ingest-africa-lii.ts) | [link](https://africanlii.org/en/terms-of-use/) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |
| `uganda_legislation_v1` | 576 | CC BY-NC 4.0 (AfricanLII; some collections more permissive, per landing page) (country pipelines from scripts/ingest-africa-lii.ts) | [link](https://africanlii.org/en/terms-of-use/) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |
| `zimbabwe_legislation_v1` | 513 | CC BY-NC 4.0 (AfricanLII; some collections more permissive, per landing page) (country pipelines from scripts/ingest-africa-lii.ts) | [link](https://africanlii.org/en/terms-of-use/) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |
| `mauritius_legislation_v1` | 442 | CC BY-NC 4.0 (AfricanLII; some collections more permissive, per landing page) (country pipelines from scripts/ingest-africa-lii.ts) | [link](https://africanlii.org/en/terms-of-use/) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |
| `rwanda_legislation_v1` | 438 | CC BY-NC 4.0 (AfricanLII; some collections more permissive, per landing page) (country pipelines from scripts/ingest-africa-lii.ts) | [link](https://africanlii.org/en/terms-of-use/) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |
| `tanzania_legislation_v1` | 434 | CC BY-NC 4.0 (AfricanLII; some collections more permissive, per landing page) (country pipelines from scripts/ingest-africa-lii.ts) | [link](https://africanlii.org/en/terms-of-use/) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |
| `ghana_legislation_v1` | 413 | CC BY-NC 4.0 (AfricanLII; some collections more permissive, per landing page) (country pipelines from scripts/ingest-africa-lii.ts) | [link](https://africanlii.org/en/terms-of-use/) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |
| `namibia_legislation_v1` | 336 | CC BY-NC 4.0 (AfricanLII; some collections more permissive, per landing page) (country pipelines from scripts/ingest-africa-lii.ts) | [link](https://africanlii.org/en/terms-of-use/) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |
| `malawi_legislation_v1` | 335 | CC BY-NC 4.0 (AfricanLII; some collections more permissive, per landing page) (country pipelines from scripts/ingest-africa-lii.ts) | [link](https://africanlii.org/en/terms-of-use/) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |
| `eswatini_legislation_v1` | 326 | CC BY-NC 4.0 (AfricanLII; some collections more permissive, per landing page) (country pipelines from scripts/ingest-africa-lii.ts) | [link](https://africanlii.org/en/terms-of-use/) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |
| `echr_v1` | 312 | ECHR site: reproduction free of charge for private, information or education use; commercial use needs written permission | [link](https://www.echr.coe.int/copyright-and-disclaimer) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |
| `lesotho_legislation_v1` | 90 | CC BY-NC 4.0 (AfricanLII; some collections more permissive, per landing page) (country pipelines from scripts/ingest-africa-lii.ts) | [link](https://africanlii.org/en/terms-of-use/) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |
| `sierra_leone_legislation_v1` | 83 | CC BY-NC 4.0 (AfricanLII; some collections more permissive, per landing page) (country pipelines from scripts/ingest-africa-lii.ts) | [link](https://africanlii.org/en/terms-of-use/) | Include with per-row licence (CC BY-NC inherited; the journal allows -NC only when inherited from third-party primary data) |

## sa (2 pipelines, 19,896 claims)

| Pipeline | Claims | What the terms say | Source | Proposal |
|---|---:|---|---|---|
| `vdem_v1` | 19,777 | CC BY-SA 4.0 | [link](https://www.v-dem.net/data/the-v-dem-dataset/) | Include with per-row licence (CC BY-SA inherited; allowed by the journal on the same terms) |
| `periodic_table_v1` | 119 | CC BY-SA 3.0 (Bowserinator/Periodic-Table-JSON LICENSE.md) | [link](https://github.com/Bowserinator/Periodic-Table-JSON) | Include with per-row licence (CC BY-SA inherited; allowed by the journal on the same terms) |

## unclear (18 pipelines, 249,956 claims)

| Pipeline | Claims | What the terms say | Source | Proposal |
|---|---:|---|---|---|
| `voteview_v1` | 113,319 | No licence stated on voteview.com/about or the data help page | [link](https://voteview.com/about) | Include with per-row status `unclear`; resolve the large ones before submission |
| `jacar_v1` | 44,600 | JACAR: secondary use of NAJ / Diplomatic Archives images permitted; metadata reuse not addressed; site "All rights reserved" | [link](https://www.jacar.archives.go.jp/aj/www/doc/en) | Include with per-row status `unclear`; resolve the large ones before submission |
| `crossref_retractions_v1` | 26,624 | Retraction Watch data "publicly available" via Crossref; no licence stated on the documentation page | [link](https://www.crossref.org/documentation/retrieve-metadata/retraction-watch/) | Include with per-row status `unclear`; resolve the large ones before submission |
| `italy_legislation_v1` | 16,934 | Italian public data open by default, CC BY 4.0 per AgID guidelines (2015 Open Knowledge entry); Normattiva portal terms not read | [link](https://2015.index.okfn.org/place/italy/legislation) | Include with per-row status `unclear`; resolve the large ones before submission |
| `rxnorm_v1` | 14,632 | NLM-created RxNorm names/RXCUIs public domain; full dataset includes proprietary sources under UMLS licence (confirm only NLM-created (SAB=RXNORM) names are used) | [link](https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html) | Include with per-row status `unclear`; resolve the large ones before submission |
| `riksdag_v1` | 9,989 | CC0 (stated in a 2025/26 Riksdag motion; Riksdag terms page not found) (secondary source only) | [link](https://data.riksdagen.se/) | Include with per-row status `unclear`; resolve the large ones before submission |
| `wipo_lex_v1` | 9,641 | WIPO terms: CC licences for WIPO publications; legal texts in WIPO Lex not addressed | [link](https://www.wipo.int/en/web/terms-of-use) | Include with per-row status `unclear`; resolve the large ones before submission |
| `bundestag_v1` | 6,343 | DIP: data provided free of charge; no reuse licence named in the parts read (section 4 of the terms not read) | [link](https://dip.bundestag.de/documents/nutzungsbedingungen_dip.pdf) | Include with per-row status `unclear`; resolve the large ones before submission |
| `fec_finance_v1` | 3,500 | Public domain (US Government work, 17 U.S.C. §105) (US Government work, but FEC data carries a statutory sale-or-use restriction on individual contributor information; not verified which fields apply) | [link](https://www.law.cornell.edu/uscode/text/17/105) | Include if no individual-contributor fields are carried (check the statute first) |
| `canada_bills_v1` | 1,067 | Parliament of Canada: Speaker's permission covers proceedings, not commercial use; bill metadata coverage unclear (secondary source (Open Knowledge index); parl.ca terms page returned 403/404) | [link](https://2015.index.okfn.org/place/canada/legislation) | Include with per-row status `unclear`; resolve the large ones before submission |
| `miller_center_v1` | 1,059 | Site "© Rector and Visitors of the University of Virginia"; speech transcripts licence not stated | [link](https://millercenter.org/the-presidency/presidential-speeches) | Include with per-row status `unclear`; resolve the large ones before submission |
| `fec_finance_pac_v1` | 700 | Public domain (US Government work, 17 U.S.C. §105) (US Government work, but FEC data carries a statutory sale-or-use restriction on individual contributor information; not verified which fields apply) | [link](https://www.law.cornell.edu/uscode/text/17/105) | Include with per-row status `unclear`; resolve the large ones before submission |
| `openfec_v1` | 600 | Public domain (US Government work, 17 U.S.C. §105) (US Government work, but FEC data carries a statutory sale-or-use restriction on individual contributor information; not verified which fields apply) | [link](https://www.law.cornell.edu/uscode/text/17/105) | Include with per-row status `unclear`; resolve the large ones before submission |
| `openfec_ie_v1` | 600 | Public domain (US Government work, 17 U.S.C. §105) (US Government work, but FEC data carries a statutory sale-or-use restriction on individual contributor information; not verified which fields apply) | [link](https://www.law.cornell.edu/uscode/text/17/105) | Include with per-row status `unclear`; resolve the large ones before submission |
| `nuclear_tests_v1` | 202 | Curated list sourced to Wikipedia pages (CC BY-SA text); claims carry facts and links | [link](https://en.wikipedia.org/wiki/Wikipedia:Copyrights) | Include with per-row status `unclear`; resolve the large ones before submission |
| `event:exoplanet_retractions_v1` | 75 | Retraction Watch data "publicly available" via Crossref; no licence stated on the documentation page | [link](https://www.crossref.org/documentation/retrieve-metadata/retraction-watch/) | Include with per-row status `unclear`; resolve the large ones before submission |
| `retraction_watch_v1` | 55 | Retraction Watch data "publicly available" via Crossref; no licence stated on the documentation page | [link](https://www.crossref.org/documentation/retrieve-metadata/retraction-watch/) | Include with per-row status `unclear`; resolve the large ones before submission |
| `book-analysis:cmppvaz700000sal1cnyfutdx` | 16 | LLM-extracted claims from a book (copyrighted work) (short claims extracted from an in-copyright book; check quotation length) | — | **Exclude** (16 claims extracted from an in-copyright book) |

## not_checked (84 pipelines, 360,947 claims)

No terms page was looked up. Largest first; recommendation for all: Include with per-row status `not_checked`; check the large ones before submission.

| Pipeline | Claims | Upstream |
|---|---:|---|
| `hungary_legislation_v1` | 69,441 | Hungarian National Assembly |
| `argentina_legislation_v1` | 25,824 | Argentina — InfoLEG |
| `czech_legislation_v1` | 24,173 | Czech Parliament |
| `chile_legislation_v1` | 15,889 | Chile — BCN |
| `romania_legislation_v1` | 13,878 | Romanian Government |
| `brazil_legislation_v1` | 12,818 | Brazil — Planalto |
| `cyprus_legislation_v1` | 12,682 | Cyprus — CyLaw |
| `russia_legislation_v1` | 12,015 | Russia — pravo.gov.ru |
| `philippines_legislation_v1` | 11,703 | Philippines — Official Gazette |
| `luxembourg_legislation_v1` | 10,006 | Luxembourg — Legilux |
| `costa_rica_legislation_v1` | 8,483 | Costa Rica — SCIJ |
| `colombia_legislation_v1` | 8,159 | Colombia — Secretaría Jurídica |
| `belgium_legislation_v1` | 7,870 | Belgium — Official Gazette |
| `poland_legislation_v1` | 6,461 | Poland — ISAP |
| `nasa_exoplanet_v1` | 6,277 | NASA Exoplanet Archive |
| `estonia_legislation_v1` | 5,870 | Riigi Teataja |
| `peru_legislation_v1` | 5,202 | Congreso de la República del Perú |
| `uk_national_archives_v1` | 5,000 | UK National Archives |
| `thailand_legislation_v1` | 4,938 | Thailand — Office of the Council of State |
| `australia_legislation_v1` | 4,740 | Australia — Federal Register of Legislation |
| `denmark_legislation_v1` | 4,550 | Denmark — Retsinformation |
| `nz_repealed_acts_v1` | 4,372 | New Zealand Parliamentary Counsel Office |
| `eu_parliament_v1` | 4,331 | European Parliament |
| `uruguay_legislation_v1` | 4,297 | Parlamento del Uruguay |
| `western_balkans_v1` | 4,062 | Western Balkans legislation |
| `slovakia_legislation_v1` | 4,050 | Slovak Parliament |
| `taiwan_archives_v1` | 3,935 | Archives Administration, Executive Yuan (Taiwan) |
| `romania_cnsas_v1` | 3,927 | CNSAS (Romania National Council for Studying Securitate Archives) |
| `nationalrat_v1` | 3,868 | Parlament.gv.at |
| `india_legislation_v1` | 3,540 | India — India Code |
| `france_legislation_v1` | 3,046 | France — Légifrance |
| `parlament_at_v1` | 3,004 | Austria — Parlament (auxiliary) |
| `kenya_legislation_v1` | 2,984 | Kenya — Kenya Law |
| `norway_legislation_v1` | 2,612 | Stortinget |
| `switzerland_legislation_v1` | 2,413 | Switzerland — Fedlex |
| `korea_legislation_v1` | 2,114 | Korea Legislation Research Institute |
| `japan_legislation_v1` | 2,080 | National Diet Library / e-Gov |
| `spain_legislation_v1` | 2,045 | Spain — BOE |
| `israel_knesset_v1` | 2,009 | Knesset of Israel |
| `nz_bills_v1` | 1,879 | New Zealand Parliamentary Counsel Office |
| `srilanka_legislation_v1` | 1,704 | Parliament of Sri Lanka |
| `finland_legislation_v1` | 1,683 | Finnish Parliament |
| `bangladesh_legislation_v1` | 1,664 | Bangladesh National Parliament |
| `paclii_legislation_v1` | 1,583 | PacLII (Pacific Islands Legal Information Institute) |
| `portugal_legislation_v1` | 1,292 | Assembleia da República |
| `iceland_legislation_v1` | 1,069 | Althingi |
| `nz_legislation_v1` | 1,041 | New Zealand Parliamentary Counsel Office |
| `central_america_v1` | 1,017 | Central America legislation |
| `taiwan_legislation_v1` | 1,016 | Legislative Yuan (Taiwan) |
| `pakistan_code_v1` | 943 | Pakistan Code (Federal Acts) |
| `malaysia_legislation_v1` | 883 | Malaysian Attorney General's Chambers |
| `icj_judgments_v1` | 800 | International Court of Justice |
| `caribbean_v1` | 675 | Caribbean legislation |
| `wto_disputes_v1` | 645 | World Trade Organization |
| `nz_local_acts_v1` | 611 | New Zealand Parliamentary Counsel Office |
| `south_africa_legislation_v1` | 578 | South African Parliament |
| `latvia_legislation_v1` | 567 | Likumi.lv |
| `malta_legislation_v1` | 565 | Malta Government |
| `jamaica_legislation_v1` | 528 | Parliament of Jamaica |
| `singapore_legislation_v1` | 508 | Singapore Attorney-General's Chambers |
| `icsid_v1` | 500 | ICSID arbitration cases |
| `nato_official_texts_v1` | 459 | NATO |
| `scotland_legislation_v1` | 408 | legislation.gov.uk |
| `central_asia_v1` | 369 | Central Asia legislation |
| `tt_legislation_v1` | 368 | Parliament of Trinidad and Tobago |
| `pubchem_v1` | 355 | PubChem / NCBI |
| `nist_constants_v1` | 355 | NIST / CODATA |
| `mexico_legislation_v1` | 309 | Mexico — Cámara de Diputados |
| `georgia_legislation_v1` | 301 | Parliament of Georgia |
| `african_court_v1` | 300 | African Court on Human Rights |
| `brunei_legislation_v1` | 288 | Attorney General's Chambers of Brunei Darussalam |
| `pdg_particles_v1` | 226 | Particle Data Group |
| `impact_craters_v1` | 214 | Earth Impact Database |
| `uae_legislation_v1` | 177 | UAE Government |
| `czech_abs_v1` | 104 | Security Services Archive (ABS), Czech Republic |
| `iau_constellations_v1` | 88 | International Astronomical Union |
| `icc_judgments_v1` | 74 | ICC judgments |
| `icc_cases_v1` | 35 | ICC cases |
| `croatia_legislation_v1` | 33 | Croatia — Narodne novine |
| `solar_system_v1` | 28 | NASA / IAU |
| `nist_webbook_v1` | 20 | NIST Chemistry WebBook |
| `slovenia_legislation_v1` | 10 | PISRS (Pravno-informacijski sistem) |
| `iau_v1` | 5 | International Astronomical Union |
| `stasi_v1` | 2 | Bundesarchiv / Stasi-Mediathek |

## Recommended next checks (largest unresolved first)

1. `voteview_v1` (113,319) — ask the Voteview maintainers for a licence statement.
2. `hungary_legislation_v1` (69,441), `argentina_legislation_v1`, `czech_legislation_v1`, `chile_legislation_v1`, `romania_legislation_v1` and the other national legislation corpora — find each portal's reuse terms, or the copyright-act provision that excludes official texts, and cite it.
3. `jacar_v1` (44,600) — JACAR metadata reuse terms.
4. `crossref_retractions_v1` (26,624) — Crossref's licence statement for Retraction Watch data and REST API metadata.
5. `rxnorm_v1` (14,632) — confirm only NLM-created names are carried.
