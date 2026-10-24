# Before submission (open items)

Kept current at each phase. Owner = Robert; agent items need the owner's yes where marked.

## Blocking the final export (Phase 3)
- [ ] PR #45 (SCOTUS cron paused) merged and deployed: owner. Check the day after: 0 new `courtlistener_scotus_v1` claims after 12:40 UTC.
- [ ] Zenodo v1.0.0 dump inspected on the OCI server (`external-facts.md`, risk flag): owner. If personal-data tables have rows, ask Zenodo support to remove the v1.0.0 file.
- [ ] Final export + `scripts/paper/validate-export.ts`, final file list shown: agent, after both above. Paper figures are taken from that MANIFEST/validation.
- [ ] Zenodo new version (draft, then publish): agent, only after the owner's yes on the file list.
- [ ] Re-enable the SCOTUS cron after the export (re-add the `vercel.json` entry): owner decides when.

## Licences (`licence-review.md`)
Five pipelines above 10,000 claims stay in with a per-row status until resolved:
- [ ] `voteview_v1` (113,319): send `voteview-email.md` (owner); record the reply in `upstream-licences.csv`.
- [ ] `jacar_v1` (44,600): JACAR catalogue-metadata reuse terms.
- [ ] `argentina_legislation_v1` (25,824): InfoLEG terms, or the Argentine copyright-law position on official texts.
- [ ] `chile_legislation_v1` (15,889): current BCN / LeyChile terms (a 2007 CC BY-NC-SA announcement exists).
- [ ] `romania_legislation_v1` (13,878): Law 8/1996 official-texts exclusion from a primary text, or legislatie.just.ro terms.
- [ ] Ask SIPRI for permission (LATER.md); `sipri_milex_v1` stays excluded until then.
- [ ] Cyprus (`cyprus_legislation_v1`, 12,682): excluded until a primary source on CyLaw's terms says otherwise.

## Journal
- [ ] Send the presubmission enquiry (`enquiry.md`): owner.
- [ ] Phase 4: human annotation study (≥ 300 of 800 items curated, stratified by axis).
- [ ] Phase 5: methods facts, skeleton, figures, checklist; open the paper PR (owner's yes).

## Site and data (LATER.md §6; each a DB write with its own yes)
- [ ] Redact the 134 claim texts with email addresses on the site, not only in the export (owner: before submission).
- [ ] `/corrections` entries for the three unlisted batches: done in the paper branch, ship with the paper PR.
- [ ] Optional before submission: placeholder dates (6,754 rows), script-set `humanReviewed` (790 claims).
