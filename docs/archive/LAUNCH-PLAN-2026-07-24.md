# Launch Plan — Epistemic Receipts

**Written 2026-07-24.** This is the single source of truth for getting to launch.

**Supersedes:**
- `PUBLICATION-RUNBOOK-2026-07-22.md` — correct but incomplete: it omits the flip
  itself, and it treats gate 3 as unblocked when it is not (see §1).
- `PREPUBLICATION-GAPS-2026-07-24.md` — the audit that produced this plan. Four of
  its findings are fixed and shipped; the rest are folded in below.
- The *Public Edition* and *Sequencing* sections of `PUBLISH-CHECKLIST.md`. Its
  **P0/P1/P2 lists remain live** — §Verification is still the definition of done,
  and B8-6 runs it verbatim.

Where those documents disagree with this one, this one wins. Where they disagree
with the *code*, the code wins — that has already bitten once (§7).

---

## 0. Where things actually stand

Gates 1 (CI) and 2 (prod DB) are done. `origin/main` = `a64970c`, CI green on
#170 and #171. Live homepage renders 1,619,751 claims / 1,822,157 transitions,
median 8 years to settle, 10.2% later reversed.

Shipped 2026-07-24 (`3197621`, `a64970c`), all previously launch-blocking:

- `/methodology` and `/communities` were missing from `PUBLIC_ROUTES` — both would
  have 404'd on the public edition. `/methodology` is footer-linked from every page
  and is the sole render site for B15's measured error rate, so gate 4 would have
  published into a 404.
- `app/sitemap.ts` now filters through the same `isPublicRoute()` the middleware
  uses, so the sitemap can no longer advertise a URL the edition 404s.
- `er_scoped_writes` had no INSERT on `Feedback`, so public-edition feedback would
  have 500'd on every submission — an automatic no-go under B8-3.
- `.gitignore`'s `*-verification.md` had silently kept the entire gate-3 spec out
  of the repo since 07-14. Brief now committed; `briefs/2026-07-14-b8-report.md`
  skeleton created.
- `PUBLISH-CHECKLIST.md` reconciled with the code (§7).
- `tests/unit/public-edition-routes.test.ts` guards the whole class.

---

## 1. The dependency nobody had connected

**Curating the two marquee claims is a hard blocker on gate 3.**

B8-6 says: *run PUBLISH-CHECKLIST §Verification verbatim.* Item 1 of §Verification
requires that the Surgeon General 1964 claim (`claims/cmqwoxe6l07dy8o0y6xrs8xnv`)
and the Müller 1939 claim (`claims/cmqoappnu03yxsadpa90nu942`) each render **a curve
with ≥2 dated, sourced transitions and no UNREVIEWED badge.**

Both currently render UNREVIEWED with no settling-curve transitions at all.

So gate 3 cannot return GO until they are curated. This has been sitting as an
unchecked P0 in PUBLISH-CHECKLIST while the runbook described gate 3 as
tooling-ready. It is also, independently, the most damaging thing on the site: the
flagship instance of the flagship concept is empty, and both Substack drafts
footnote those exact URLs.

**Second sequencing fact: B15 has no dependencies at all.** Worksheets, review CLI,
and compute script are all on main. It is also the longest task. Running it after
gate 3 rather than alongside is the single biggest determinant of whether launch is
four days or two weeks away.

```
 Phase 0 ──▶ Phase 1 ──▶ Phase 2 ──▶ Track A (gate 3) ──▶ Phase 4 (flip)
                    └───────────────▶ Track B (gate 4) ──┘
```

---

## 2. Phase 0 — Unblock (do first, ~20 minutes)

Everything downstream is wasted effort if the first item comes back bad.

**0.1 — Dispatch the nightly integrity check.** Owner only.
GitHub → Actions → *Nightly Integrity Check* → Run workflow (cron is off;
`workflow_dispatch` is retained). Its 2026-07-22 run failed in ~55s and nobody has
read a log. The failure is either a stale `DATABASE_URL` secret or a real
data-integrity finding.

- Stale secret → fix it, re-enable the nightly cron before launch.
- Real finding → **stop.** That is a data incident on a corpus you are about to
  publish accuracy claims about. Handle it per AGENTS incident conventions first.

**0.2 — Settle run #20's provenance.** Owner only.
`a64970c` salvaged five enrichment scripts from promoter run #20 (2026-07-15) that
had never been pushed. Determine whether those 3 transitions were actually written
to prod on 07-15:

- Already promoted → nothing to do; you closed a receipts gap where the DB held
  transitions whose provenance scripts weren't in the repo.
- Never executed → running them is an owner-gated DB write under
  `specs/OPENCLAW-DATA-DOCTRINE.md`. Not casual.

---

## 3. Phase 1 — Decisions that gate later work (~30 minutes)

**1.1 — Derive the real corpus numbers.** Owner only (no sandbox or device VM can
reach Neon). The 1.62M/1.76M figures date from 2026-07-06 and the corpus has grown.
Get current counts for: total non-DEPRECATED claims, of which never-classified
(`verificationStatus IS NULL`), and total transitions. Everything in 1.2 and the
copy fix depends on real numbers, and the house rule is *derive it, never
hand-write it*.

**1.2 — Corpus count basis: DECIDED — 1.76M** (never-classified claims join the
headline). Note this reverses a deliberate in-code choice at `app/page.tsx:50-53`,
so the flip must move as a set or the domain tiles disagree with /pipelines again.
Delegable — see §8.

**1.3 — B15 sample size: 520 or 300.** Owner only, and **must be decided before the
first row** — trimming mid-run biases the sample, per your own brief. 300 costs
~2.5h instead of ~4h and widens the CI to roughly ±1.6pts, which the report states
honestly.

**1.4 — Scope cut.** Owner call, delegable to propose. **Do this before gate 3** —
B8-2 sweeps every public route, so trimming afterwards makes the sweep stale.
Candidates, all flagged by your own triage: `/globe/lab` ("charming, off-mission,
orphaned" — already in `DENY_EXACT`), `/sports` sections A–E (the 197-entry catalog;
section F is defensible), and `/foreign-legislation` vs `/legislation` (fold or
rename). 87 public routes is a lot of front doors for a site that answers one
question. `/pricing` and `/docs` stay dark by decision of 2026-07-24.

---

## 4. Phase 2 — Content prerequisite (blocks gate 3)

**2.1 — Curate the two marquee claims.** Build real settling curves: ≥2 dated,
sourced transitions each, reviewed, no UNREVIEWED badge. See §1. Editorial work,
owner-directed; I can prepare candidate transitions with sources for your approval,
but the curation call and any DB write are yours.

While you are there: PUBLISH-CHECKLIST's §Verification item 1 used to say "H.
pylori" — that was wrong and is now corrected in the document. Reference [2] is
Müller 1939 (tobacco case-control), not H. pylori. Re-verify both Substack drafts'
footnotes point where you intend.

---

## 5. Phase 3 — The two tracks, run in parallel

### Track B — Gate 4 (B15). Start tonight. Longest item.

Owner only, by your own circularity rule: the CLI records keystrokes and must never
suggest a verdict.

```bash
npx tsx scripts/b15-review.ts --stratum legislation   # 127 rows
npx tsx scripts/b15-review.ts --stratum openalex      # 95 + 10
npx tsx scripts/b15-review.ts                         # everything still pending
```

520 rows across 12 worksheets, currently **0 filled**. Manifest: cutoff
`2026-07-16T18:16:44Z`, seed `1814377032`, population 1,821,329, actual n 520.
One keypress per row: `c` correct · `d` wrong date · `x` wrong axis · `s` source
mismatch · `i` identity mismatch · `u` unverifiable · `p` disputed (adjudicate
last) · `o` open source · `n` note · Enter skip · `q` quit. Always resumable.

When nothing is pending:

```bash
npx tsx scripts/b15-compute-rate.ts --dry-run
npx tsx scripts/b15-compute-rate.ts
git add findings/b15-error-audit && git commit -m "B15: measured error rate" && git push
```

`published-rate.json` is withheld on partial runs by design. Next deploy lights up
/methodology → "Measured accuracy" automatically — which now actually resolves on
the public edition, as of `3197621`.

### Track A — Gate 3 (B8). Half a day, after Phases 0–2.

**A1. Create the DB role.** Owner only, prod write.

```bash
cp docs/runbooks/er_scoped_writes.sql /tmp/scoped.sql
openssl rand -base64 24          # role password — keep it handy, never commit
# edit /tmp/scoped.sql: replace <set-in-window> with that password
npx prisma db execute --file /tmp/scoped.sql --schema prisma/schema.prisma
rm /tmp/scoped.sql
```

Never run the file verbatim — the placeholder must be replaced in a temp copy.
The file now includes the `Feedback` INSERT grant; without it B8-3 fails by
construction.

**A2. Vercel project B.** Import the same repo as a second project, production
branch `main`.

- `NEXT_PUBLIC_EDITION` = `public` — **the literal string `public`.** The code
  checks `EDITION === "public"`. Setting `1` does not error; it silently leaves
  `IS_PUBLIC_EDITION` false, the page gate never activates, and you deploy the
  entire lab surface on a public domain.
- `DATABASE_URL` = the `er_scoped_writes` connection string.
- Do **not** set `CRON_SECRET`, `ADMIN_TOKEN`, or `ALLOW_EDITS`.

**A3.** Fill `PROJECT_B_URL` in
`briefs/2026-07-14-build-brief-8-public-edition-verification.md` (now in the repo).

**A4. Sweep.** `npx tsx scripts/b8-route-sweep.ts https://<project-B>.vercel.app`
Paste the table into `briefs/2026-07-14-b8-report.md` (skeleton already there).

**A5. Manual phases,** 15–20 min: B8-1 edition/role proof · B8-3 write-path sweep
(feedback should now persist; subscribe should return a clean 404, not a 500) ·
B8-6 §Verification verbatim · B8-7 rate-limit spot check.

**A6. Verdict** at the bottom of the report: `GO / NO-GO`. Anything red comes to me
same-day.

---

## 6. Phase 4 — The flip (~30 min, and it is not in the old runbook)

The runbook ended at "publication-ready" and omitted these entirely. Order matters.

1. Attach the custom domain to project B.
2. Set `NEXT_PUBLIC_EDITION=lab` on project A. **This is what makes `app/robots.ts`
   serve `Disallow: /` for the lab.** Until it is set, the lab is `unset` edition,
   robots says `allow: "/"`, and search engines index your lab.
3. Set `SITE_PASSWORD` on project A.
4. Re-run the subset of B8-4 and B8-5 that referenced the vercel.app host — OG
   metadata, embeds, badges, sitemap URLs all change when the domain does.

Skip 2 and 3 and `epistemic-receipts.vercel.app` stays anonymously reachable and
crawlable beside the public domain, with `/admin`, `/review`, `/edges` and
`/labs/*` protected only by the admin gate rather than absent. The entire point of
the two-project split is that the lab surface does not exist publicly.

---

## 7. Known contradictions in the superseded documents

Recorded because you will be reading these under time pressure.

- **`PUBLISH-CHECKLIST.md` said `PUBLIC_EDITION=1`; the code checks `"public"`.**
  Fixed 2026-07-24. This is the one that could have leaked the lab.
- **"Read-only Neon role"** appears in both PUBLISH-CHECKLIST and the header of
  `lib/publicEdition.ts`. The actual decision (B12 Q2, 2026-07-16) is
  `er_scoped_writes`. Checklist fixed; the code comment is still stale.
- **§Verification item 4** (one claim total across homepage//pipelines//sources) is
  blocked on 1.1/1.2 above. B8-6 cannot pass verbatim until the count basis lands.
- The **white-paper gap audit is deprecated** per owner and is out of scope. The
  residue that still matters is §1 — the marquee claims — which is a site-quality
  problem independent of the paper.

---

## 8. Delegable — hand these to me

- The 1.76M count change: flip the four NULL-exclusive sites onto the NULL-inclusive
  predicate, factored into one shared definition in `lib/` instead of nine
  copy-pasted repetitions, plus rounding the hand-written strings to "1.7M+".
- A CI check that fails when any file under `briefs/`, `findings/` or `specs/` is
  gitignored. Closes the class that hid the gate-3 spec.
- A scope-cut proposal for §1.4 for you to approve rather than author.
- `b16-report` / `b17-report` (loop convention: every brief reports).
- Sourcemaps job (`ci.yml:163` `continue-on-error` for missing Sentry secrets — add
  them or delete the job) and the Node 20 action pins.
- Candidate transitions with sources for the two marquee claims, for your approval.
- 247 eslint warnings; `scripts/cleanup-stale-branches.sh`.

---

## 9. After launch — what "building" means

**Put the error rate on the homepage.** Once B15 publishes, you can state a
hand-graded accuracy figure with a Wilson interval. Almost no comparable project
can. Buried in a /methodology section it does nothing; beside the 10.2% reversal
rate it is the number that converts skeptics. It is the strongest thing you have
and it is currently invisible.

**Make corrections countable.** A receipts site compounds credibility when
corrections are public, dated and *counted*. You have `/corrections` and the flag
form; what is missing is "N corrections issued since launch" as a visible, growing
number. That is the flywheel — it makes the project trustworthy over time rather
than at a moment.

**Invest in the curated surface, not another pipeline.** Most visitors will ever see
one to three claims, not 1.6M. The 11 curated trajectories and 8 narratives are the
actual product. This is also why §1 is worth doing properly rather than minimally.

**Two standing risks.**

1. *Integrity monitoring is off.* Running a public site on 1.76M records with the
   nightly check disabled is a bad steady state. Re-enable the cron once 0.1
   explains the failure.
2. *Work that exists on one machine.* This session found three separate pockets —
   the gate-3 spec, run #20's five provenance scripts, and the A/B harness plus its
   verdict. Two were invisible to `git status` because `.gitignore` swallowed them.
   For a project whose entire value is the accumulated record, that is existential.
   Mitigations: the CI check in §8, branch protection on main (PRs #16–20 merged
   red, which is how the six-day CI outage started), and pushing branches even when
   unfinished.

---

## 10. Realistic timeline

Assuming 0.1 comes back clean:

| | |
|---|---|
| Phases 0–1 | under an hour |
| Marquee claims (§4) | a few hours |
| Gate 3 (Track A) | half a day |
| Gate 4 (Track B) | ~4h at n=520, ~2.5h at n=300 — the long pole |
| Flip (§6) | 30 minutes |

**Four days** if you take n=300 and run the tracks in parallel.
**About a week** at a steadier pace with n=520.
**Two weeks or more** if 0.1 surfaces a real data-integrity finding.

The spread is almost entirely that one un-dispatched workflow. Run it first.
