# Publication Runbook — what's left (2026-07-22)

> **SUPERSEDED 2026-07-24 by `LAUNCH-PLAN-2026-07-24.md`.** Kept for history.
> Two things below are wrong: step 3 is described as unblocked, but B8-6 cannot
> pass until the two marquee claims are curated (§1 of the launch plan), and this
> document ends at "publication-ready" without the flip itself — domain,
> `NEXT_PUBLIC_EDITION=lab` on the lab project, then `SITE_PASSWORD`. Use the
> launch plan.

Correct: **steps 1 and 2 are done.** CI is green on main (run #166+), all 54
migrations are applied in prod. Optional 10-second confirmation of step 2:
click **Follow** on any live claim page, reload — if it sticks, done.

What remains is **3 and 4**. Everything below is copy-paste.

---

## Step 3 — B8: the go/no-go audit (~1 hour, one sitting)

This produces the publication verdict, by your own runbook's design.

**3a. Project B (public edition) on Vercel** — skip if it already exists:
Vercel → Add New Project → import `epistemic-receipts` again (second project,
same repo). Environment variables:

- `NEXT_PUBLIC_EDITION` = `public`
- `DATABASE_URL` = the `er_scoped_writes` connection string — created now:

```bash
cp docs/runbooks/er_scoped_writes.sql /tmp/scoped.sql
openssl rand -base64 24        # this is the role password — keep it handy
# edit /tmp/scoped.sql: replace <set-in-window> with that password
npx prisma db execute --file /tmp/scoped.sql --schema prisma/schema.prisma
rm /tmp/scoped.sql
```

Then build the connection string: take your normal Neon URL and swap
user/password for `er_scoped_writes` / the new password. Set it on project B
only. Do NOT set `CRON_SECRET`, `ADMIN_TOKEN`, or `ALLOW_EDITS` on B.
Deploy B from main.

**3b. Fill the blank in the brief** — open
`briefs/2026-07-14-build-brief-8-public-edition-verification.md`, put B's
`https://<something>.vercel.app` URL into the `PROJECT_B_URL` line.

**3c. Automated sweep** (the bulk of B8-2/4/5/7):

```bash
npx tsx scripts/b8-route-sweep.ts https://<project-B>.vercel.app
```

Pass = every public route renders, every lab/admin route 404s, redirects,
badge, embed, HSTS. Paste the printed table into
`briefs/2026-07-14-b8-report.md`.

**3d. Manual phases** (15–20 min, from the brief):
- B8-1: B has no password gate; no ⚗ Lab in the nav; `/admin` 404s.
- B8-3: submit the feedback form on B once — record WORKS / DEGRADES / BREAKS.
  (BREAKS = looks successful but nothing persisted → automatic no-go item.)
- B8-6: run PUBLISH-CHECKLIST §Verification verbatim, paste results.
- B8-7: ~30 quick requests to one endpoint → confirm a 429 appears and clears.

**3e. Write the verdict** at the bottom of the report:
`GO / NO-GO: ____. Blockers: [list or none].`
Anything red → bring it to me, same-day fix.

---

## Step 4 — B15: the measured error rate (~3–4 h of your judgment, split over days)

The one thing only you can do — verdicts are yours alone (circularity rule).

**4a. Optional, decide BEFORE starting:** shrink n from 520 → 300 (your
brief's owner knob; CI widens to ~±1.6pts and the report says so honestly).
If you want this, tell me and I'll emit a trimmed worksheet set — don't
skip rows ad hoc mid-run, that biases the sample.

**4b. Work the worksheets with the CLI** — one stratum per sitting:

```bash
npx tsx scripts/b15-review.ts --stratum legislation
npx tsx scripts/b15-review.ts --stratum openalex
npx tsx scripts/b15-review.ts            # everything still pending
```

One keypress per row: `c` correct · `d` wrong date · `x` wrong axis ·
`s` source mismatch · `i` identity mismatch · `u` unverifiable ·
`p` disputed (adjudicate last) · `o` open source URL · `n` note ·
Enter skip · `q` quit (always saved, always resumable).

**4c. Compute + publish** when nothing is pending:

```bash
npx tsx scripts/b15-compute-rate.ts --dry-run   # preview
npx tsx scripts/b15-compute-rate.ts             # writes report + published-rate.json
git add findings/b15-error-audit && git commit -m "B15: measured error rate" && git push
```

The next deploy lights up /methodology → "Measured accuracy" automatically:
rate, Wilson CI, per-stratum table, UNVERIFIABLE rate, quotable sentence.

**4d. After publication only:** corrections pass on the confirmed-wrong rows
(normal flow), and I can run the independent agent cross-check that flags
disagreements with your verdicts for a second look.

---

## Dessert (optional, anytime)

- **C-3 import** (~10 min): `npx tsx scripts/import-promoter-review-status.ts`
  → check dry-run counts → rerun with `--execute` → /canon's 388 single-step
  rows honestly split into reviewed vs never-reviewed.
- **Branch hygiene**: `bash scripts/cleanup-stale-branches.sh`
- **Branch protection**: GitHub → Settings → Branches → require the
  `quality` check on main, so red can never merge again.
- **Curate saccharin + leaded-gasoline trajectories** so their homepage
  cards can land on curves instead of search.

After 3 and 4: publication-ready, by the standard you wrote for yourself.
