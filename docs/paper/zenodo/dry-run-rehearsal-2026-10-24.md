# Zenodo new version — dry run

Concept DOI 10.5281/zenodo.23049991; new version of record 23049992 (1.0.0).

## Metadata diff (current → proposed)

### custom
- current:  {"code:codeRepository":"https://github.com/contofalskyR/epistemic-receipts","code:programmingLanguage":[{"id":"typescript","title":{"en":"TypeScript"}}],"code:developmentStatus":{"id":"active","title":{"en":"Active"}}}
- proposed: (absent)

### description
- current:  <p>Epistemic Receipts is a knowledge graph of 1,758,105 claims drawn from 50+ primary sources, with each claim linked to the authoritative record it came from and tagged with an evidentiary status: SETTLED, CONTESTED, RECORDED, or OPEN. Claims are cross-referenced across datasets (e.g. a clinical trial linked to its published paper and its FDA approval), yielding 2.7M claim&ndash;topic links and 4.8M relations in total.</p>
<p>Sources include: NARA declassified records, OpenAlex, Congress.gov (bills, votes, members), WHO GHO, FDA openFDA, UN Security Council and General Assembly resolutions, U …
- proposed: <p><strong>Epistemic Receipts</strong> is a corpus of 1,757,599 claims generated from public institutional records (legislatures, courts, regulators, archives, scholarly indexes), each linked to the document it came from and labelled with an epistemic status (RECORDED, SETTLED, CONTESTED, OPEN, UNRESOLVABLE, REVERSED, ABANDONED).</p><p>It has two layers. The <em>record layer</em> is every claim with its source link and its status as assigned at ingest. The <em>trajectory layer</em> is the 34,488 claims with a documented status change, 15,777 of which carry an independent dated source for the c …

### keywords
- current:  ["provenance","claims","open data","epistemic status","epistemology","PostgreSQL","knowledge graph"]
- proposed: ["provenance","claims","epistemic status","status transitions","retractions","legislation","court opinions","institutional records","knowledge graph","open data","Parquet"]

### license
- current:  {"id":"cc-by-4.0"}
- proposed: cc-by-4.0

### notes
- current:  (absent)
- proposed: Version 2.0.0 replaces the version 1.0.0 database dump with an open-format export (Parquet and gzipped CSV) of the corpus tables only.

### related_identifiers
- current:  (absent)
- proposed: [{"identifier":"https://github.com/contofalskyR/epistemic-receipts","relation":"isSupplementedBy","resource_type":"software"},{"identifier":"https://epistemic-receipts.vercel.app/methodology","relation":"isDocumentedBy","resource_type":"other"}]

### title
- current:  Epistemic Receipts: a cross-referenced claim graph from 50+ primary sources
- proposed: Epistemic Receipts: a cross-domain corpus of source-linked claims with dated epistemic-status transitions

### upload_type
- current:  (absent)
- proposed: dataset

### version
- current:  1.0.0
- proposed: 2.0.0

## Files

Removed from the new version (inherited from 1.0.0):
- epistemic_receipts_backup.dump  12.06 GB  md5:8a33f93aefd150aa01160c119e01a94a

Uploaded:
- claims.csv.gz                           211.8 MB  1,757,599 rows  sha256:6120d8d727d47bd9…
- claims.parquet                          185.4 MB  1,757,599 rows  sha256:b5349ef18546dfe5…
- status_history.csv.gz                    47.8 MB  1,821,600 rows  sha256:0752a99fca891752…
- status_history.parquet                   45.5 MB  1,821,600 rows  sha256:1b9afb57d13d4503…
- sources.csv.gz                           75.5 MB  1,658,927 rows  sha256:7e103ac66c57c7a0…
- sources.parquet                          65.4 MB  1,658,927 rows  sha256:543ab8f339d8050c…
- edges.csv.gz                             73.7 MB  1,719,781 rows  sha256:b6aef609215b9394…
- edges.parquet                            69.6 MB  1,719,781 rows  sha256:841096f09eb46462…
- claim_relations.csv.gz                   37.3 MB  1,085,347 rows  sha256:58b57b0320b21019…
- claim_relations.parquet                  29.9 MB  1,085,347 rows  sha256:3a96191f7fbef5a0…
- claim_relations_context.csv.gz           70.3 MB  3,745,802 rows  sha256:f49c8e1cade66162…
- claim_relations_context.parquet          46.3 MB  3,745,802 rows  sha256:658233241bc061c0…
- pipelines.csv.gz                          0.0 MB  187 rows  sha256:09f06c177cbbc4f2…
- pipelines.parquet                         0.0 MB  187 rows  sha256:b65c7cfb8096fdac…
- DATA_DICTIONARY.md                        0.0 MB  sha256:90ad5c764fbd739a…
- README_DATA.md                            0.0 MB  sha256:ca6dd335798e60ef…
- MANIFEST.json                             0.0 MB

17 files, 0.96 GB (Zenodo limit: 100 files, 50 GB).

Dry run only: nothing was sent to Zenodo.
