# External facts (fetched 2026-10-24, none from memory)

## NLM Dataset Catalog ID 0003343544 — **resolves to this dataset**

- Record page: https://datasetcatalog.nlm.nih.gov/dataset?q=0003343544
  (HTML title: "Epistemic Receipts: a cross-referenced claim graph from 50+ primary sources - Zenodo | NLM Dataset
  Catalog"). Linked-data id in the page: `http://id.nlm.nih.gov/datmm/dataset/0003343544`.
- How the URL form was established: the catalog's search-results page links records as `/dataset?q=<id>`
  (e.g. `/dataset?q=0002198886`, which renders "Stable isotope data of rivers over the Qinghai-Tibet Plateau").
  `/dataset/<id>` and `/dataset?id=<id>` return "Not Found" for every id, so they are not the record form.
- Identifier in the record: `https://doi.org/10.5281/zenodo.23049992` (the Zenodo **version** DOI, not the concept DOI).
- The record repeats the Zenodo description: "a knowledge graph of 1,758,105 claims drawn from 50+ primary sources …
  tagged with an evidentiary status: SETTLED, CONTESTED, RECORDED, or OPEN … 2.7M claim–topic links and 4.8M relations
  … FILE epistemic_receipts_backup.dump — PostgreSQL 17 custom-format dump (pg_dump -Fc), 12.06 GB compressed …".
  The catalog harvests from Zenodo, so it should pick up a new version's description; whether it re-harvests, and how
  fast, is unknown.

## Zenodo record 23049992

Source: https://zenodo.org/api/records/23049992 (public API, no token), page https://zenodo.org/records/23049992.

| Field | Value |
|---|---|
| Version DOI / concept DOI | 10.5281/zenodo.23049992 / 10.5281/zenodo.23049991 (concept record 23049991) |
| Title | Epistemic Receipts: a cross-referenced claim graph from 50+ primary sources |
| Published | 2026-09-30 (created 2026-09-30T02:39:11Z) |
| Version | 1.0.0 |
| Resource type | Dataset |
| **Licence** | **cc-by-4.0** |
| Access | open |
| Creators | Contofalsky, Robert |
| Keywords | provenance, claims, open data, epistemic status, epistemology, PostgreSQL, knowledge graph |
| Related identifiers | none |
| **Files** | **1: `epistemic_receipts_backup.dump`, 12,061,415,256 bytes (12.06 GB), md5:8a33f93aefd150aa01160c119e01a94a** |
| Usage (at fetch) | 16 views, 2 downloads |

### Risk flag: the public file is a whole-database dump

- `epistemic_receipts_backup.dump` is the name STATUS.md gives the dump the production DB was restored from
  (2026-10-01). Zenodo published it at 02:39 UTC on 2026-09-30, before the front-door Phase 3 migration dropped
  20 tables that day (`User`, `ApiKey`, `ApiUsage`, `Session`, `Account`, `VerificationToken`, `Follow`,
  `Collection*`, `*Subscription`, `Org*`, `Litigation*`; STATUS.md Current state). If it is the same file, it holds
  those tables as they were, whatever rows they had.
- It certainly holds `Feedback`: that table still exists, has 15 rows (2026-05-04 → 2026-07-10), and **1 of them
  includes an email address** (read-only count, 2026-10-24). It also holds every operational table (`ClaimEmbedding`
  vectors, `AlertSent`, `TransitionSourceCandidate` with model traces and costs, …), not only the data the paper
  describes.
- Not verified: whether the Zenodo file is byte-identical to the restore dump, and which of those tables had rows.
  Both can be checked on the OCI server without downloading anything:
  `md5sum /var/lib/pgsql/dump/epistemic_receipts_backup.dump` (compare with 8a33f93a…) and
  `pg_restore -l /var/lib/pgsql/dump/epistemic_receipts_backup.dump | grep 'TABLE DATA'`.
- Why it matters for the paper: (a) personal data in a public CC-BY archive (the journal's data policy, and privacy
  law); (b) Phase 3 adds a new version, but **a new Zenodo version does not remove v1.0.0's file**, which stays
  downloadable under its version DOI. Removing a published file takes a request to Zenodo support. Robert decides.

## Rutgers and Springer Nature open access

- Rutgers University Libraries, "Open Access Publishing Details":
  https://www.libraries.rutgers.edu/research-support/open-access-publishing-opportunities-rutgers-researchers/open-access-publishing-details
  — Springer Nature: **"100% discount (full APC paid only for hybrid titles)"**; corresponding-author eligibility; the
  covered list is a downloadable spreadsheet under "Publishing open access in a hybrid journal". The page does not
  mention Nature Portfolio, BMC or *Scientific Data*. No last-updated date shown ("© 2026").
- *Scientific Data* is fully open access ("Authors who publish in Scientific Data are required to pay an article
  processing charge", https://www.nature.com/sdata/open-access), so it is **not a hybrid title** and, per the Rutgers
  page, **not covered**. Expect to pay US$2,690 unless a waiver or other funding applies. Confirm with the Rutgers
  scholarly-communication librarian; the page links an "Ask a Librarian" route:
  https://askalibrarian.rutgers.edu/faq/374689
