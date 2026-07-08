# What's left — Robert's checklist (2026-07-08)

Every command runs from the project folder. Each one saves its own log, so any
Claude session can read the results — just say which step you ran.

## Now

- [ ] Commit + push today's work (if not already done):
```
git add -A && git commit -m "seq ordering semantics (Option B): migration + prepend-aware contract + backfill + C2 audit + consumer swaps; NZ phase-1 repointed to keyed www fetches; handoff refreshed" && git push
```

## When the seq backfill finishes (~20 min — logs/seq-backfill-run.log prints "Summary")

- [ ] Run the integrity audit. The new C2 line must be 0:
```
npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --direct 2>&1 | tee logs/audit-post-seq.log
```

## When NARA finishes (imminent — logs/nara-bulk-run.log prints its final summary)

- [ ] Harvest dry-run (look for a sane "would create" count):
```
npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-auto-trajectories.ts --pipeline nara_catalog_v1 --dry-run 2>&1 | tee logs/nara-harvest-dryrun.log
```
- [ ] Harvest for real:
```
npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-auto-trajectories.ts --pipeline nara_catalog_v1 2>&1 | tee logs/nara-harvest.log
```
- [ ] Stamp the new rows with seq (fast, resumable — needed after every harvest):
```
npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-transition-seq.ts --direct --execute 2>&1 | tee logs/seq-backfill-rerun.log
```
- [ ] Re-census to get the final residue number:
```
npx dotenv-cli -e .env.local -- npx tsx scripts/census-dateless-claims.ts --direct --json 2>&1 | tee logs/census-post-nara.log
```
- [ ] Give Claude the residue number → Claude swaps the one methodology sentence.

## When NZ phase-1 finishes (~2 h — logs/nz-phase1-run.log prints "Phase 1 summary")

- [ ] Phase-2 preflight (no writes):
```
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/nz-repealed-prepend.ts --phase apply 2>&1 | tee logs/nz-phase2-preflight.log
```
- [ ] Pilot on 25 claims:
```
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/nz-repealed-prepend.ts --phase apply --limit 25 --execute --allow-entry-amend 2>&1 | tee logs/nz-phase2-pilot.log
```
- [ ] Eyeball ~5 pilot curves on /settling-curve with Claude: each should show
      SETTLED (enactment year) → REVERSED (exact repeal date).
- [ ] Full apply:
```
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/nz-repealed-prepend.ts --phase apply --execute --allow-entry-amend 2>&1 | tee logs/nz-phase2-apply.log
```
- [ ] Audit the pipeline:
```
npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --pipeline nz_repealed_acts_v1 2>&1 | tee logs/audit-nz-phase2.log
```

## After those (with Claude, in order)

- [ ] Rechain fix: pause the loops on the loop machine first, then:
```
npx dotenv-cli -e .env.local -- npx tsx scripts/fix-audit-findings.ts --fix rechain --execute --allow-row-delete --direct 2>&1 | tee logs/rechain-run.log
```
      then re-audit, then resume the loops.
- [ ] Loop machine: `git pull`, install loop-event-pipelines.sh under launchd,
      unload the archived enricher plist, set EVENT_LOOP_INCLUDE_NZ=1 (only
      after the NZ pilot looked good).
- [ ] Your two editorial calls: pick KEEPs in the duplicate-trajectories list;
      triage curation queues (incl. the 3 seq orphan-break claims in
      logs/seq-backfill-residue.jsonl).
- [ ] Claude builds the stragglers: /corrections real form, dead footer link,
      methodology residue number, optional YEAR-dot display convention.
- [ ] Prod smoke tour, then launch.
