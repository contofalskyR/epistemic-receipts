# Pre-publication gap audit — 2026-07-24

**Method:** verified against `origin/main` (tip `4e7f0de`, fetched 07-24 18:13), the
GitHub Actions run pages, and the live lab site. Nothing here is taken from the
handoff on trust. Whitepaper-gap items deliberately out of scope per owner.

**Verdict:** the handoff's two open gates are real and accurate, but they are not
the whole list. Four things will break *at the moment you flip the public switch*,
and none of them appear in `PUBLICATION-RUNBOOK-2026-07-22.md`. Two of them make
gate 3 fail by construction — you'd discover them an hour into the audit.

---

## A. Will break at the flip — not in the runbook

### A1. `/methodology` 404s on the public edition — and it's where gate 4's output lands

`lib/publicEdition.ts` gates pages deny-by-default against `PUBLIC_ROUTES`.
`/methodology` is **not in that array**. `isPublicRoute("/methodology")` returns
false → middleware rewrites to 404.

Consequences, both bad:

1. **Gate 4 publishes into a 404.** `app/methodology/page.tsx:512` is the only
   render site for B15's "Measured accuracy" block (rate, Wilson CI, per-stratum
   table, quotable sentence), keyed off `findings/b15-error-audit/published-rate.json`
   (`page.tsx:46`). You spend 3–4 hours of irreplaceable owner judgment producing a
   measured error rate, and on the site you're actually publishing, the page it
   renders on does not exist.
2. **Dead footer link on every public page.** `app/layout.tsx:39` links
   `/methodology` from the global footer. Also linked from `HomeHero.tsx:70`,
   `HomepageSections.tsx:440`, `/about`, `/canon`, `/patterns`, `/datasets`,
   `/datasets/[tag]`, `/datasets/snapshots`, `/communities` — 10 files.

The Nav is safe (it filters `GROUPS` against `PUBLIC_ROUTES` by construction).
Hardcoded `<Link>`/`<a>` in page bodies and the layout are not filtered — that's
the hole.

**Fix:** add `"/methodology"` to `PUBLIC_ROUTES`. One line. Do it *before* gate 4,
not after, or the audit's output has nowhere to go.

### A2. Same bug, three more routes

Full diff of `app/*/page.tsx` against the allowlist. Not allowlisted:

| Route | Correctly denied? | Linked from |
|---|---|---|
| `/account`, `/login`, `/review`, `/edges`, `/alerts` | yes — lab/admin | — |
| **`/methodology`** | **no — see A1** | 10 files incl. global footer |
| **`/communities`** | probably not | 4 files: `settling-curve/SettlingCurve.tsx:1861`, `split-ledger/page.tsx:318`, `methodology/page.tsx:528` — **and `app/sitemap.ts:40` advertises it to crawlers** |
| **`/pricing`** | decide | 4 files (`account`, `alerts`, `collections`, `org/[orgId]/litigation`) |
| `/collections` | decide | 1 (self-referential breadcrumb) |

`/communities` is the second real one: a sitemap that tells Google about a URL
which returns 404 is a crawl-quality own-goal on a site whose whole pitch is rigour.

**Fix:** decide each, then make the invariant enforceable — a test asserting every
internal `href` in `app/**` and every `app/sitemap.ts` entry satisfies
`isPublicRoute()`. Otherwise this recurs on the next route you ship.

### A3. Public-edition feedback is guaranteed broken — gate 3's automatic no-go

`docs/runbooks/er_scoped_writes.sql` grants `INSERT/UPDATE/DELETE` on exactly
`Profile`, `Bookmark`, `Follow`, and `SELECT` everywhere else.

`app/api/feedback/route.ts:78` calls `prisma.feedback.create(...)`. The role has
no INSERT on `Feedback` → `permission denied`. There is no try/catch around the
call, so the route throws and returns 500.

B8-3 grades exactly this: *"submit the feedback form on B once — record WORKS /
DEGRADES / BREAKS. (BREAKS = looks successful but nothing persisted → automatic
no-go item.)"* It will not return WORKS. Gate 3 is currently unpassable.

Same class, one more: `/api/subscribe/topic` and `/api/subscribe/claim` upsert
`TopicSubscription` / `ClaimSubscription`, which the SQL **explicitly
`REVOKE ALL`s** (they hold email addresses — the public edition must never read
them; that revoke is correct and should stay). But both routes are in
`PUBLIC_WRITE_PATHS` (`middleware.ts:97`), so they stay reachable on the public
site and will 500 rather than being cleanly absent.

**Fix — pick one, it's an owner call:**
- (a) grant `INSERT` on `Feedback` to `er_scoped_writes` (feedback has no read-back
  requirement, so this leaks nothing), and short-circuit the subscribe routes with
  a clean 404/"not available on this edition" when `IS_PUBLIC_EDITION`; or
- (b) proxy feedback + subscribe to the lab deployment, per the option
  PUBLISH-CHECKLIST §Database already contemplates.

Either way, hide the subscribe UI on the public edition — a form that 500s is worse
than a form that isn't there.

### A4. Gate 3's spec is gitignored and exists on exactly one machine

`briefs/2026-07-14-build-brief-8-public-edition-verification.md` is **not in the
repo and never has been.** `git log --all` for that path is empty.

Cause: `.gitignore:73` — `*-verification.md`, a pipeline-artifact pattern that
silently swallows it. `git check-ignore -v` confirms.

So the document defining B8-1 … B8-7, the `PROJECT_B_URL` line the runbook tells
you to fill in, and the go/no-go criteria themselves live only as an untracked file
on your Mac. It is not on GitHub, not in any bundle, not in any branch. A fresh
clone does not have it. The handoff and the runbook both instruct the next agent to
open it; that agent will not find it.

The pattern will swallow every future `*-verification.md` brief the same way.

**Fix:** narrow the ignore (`scripts/*-verification.md`, or whatever the original
artifact actually was), `git add -f` the brief, push. Two minutes, and it's the
single highest-value-per-second item on this list.

---

## B. The two known gates — actual status

### Gate 3 (B8) — not started, and currently blocked by A3 + A4
- Project B on Vercel: not created (no `PROJECT_B_URL` anywhere in the repo).
- `er_scoped_writes` role: not created (handoff §1 correct).
- `scripts/b8-route-sweep.ts`: present on main ✅.
- `briefs/2026-07-14-b8-report.md`: **does not exist on any branch** — the runbook
  says "paste the printed table into" it. You have to create it.
- The brief itself: see A4.

### Gate 4 (B15) — not started; tooling genuinely ready
- 520 rows across 12 worksheets, all present on main ✅.
- **Verdicts filled: 0 of 520.** Every `**Verdict:**` line is still the
  `_(fill in: …)_` placeholder. Checked all 12 files individually.
- `published-rate.json`: absent → `/methodology`'s Measured accuracy block is dark.
  Confirmed live: the page renders, no accuracy section.
- `scripts/b15-review.ts`, `b15-compute-rate.ts`: on main ✅.
- **Decision still owed before you start:** runbook 4a, n=520 vs n=300. It has to be
  made first — trimming mid-run biases the sample, as your own brief says.

Reports `b16-report` / `b17-report` were never created on any branch either
(handoff §5.6 correct).

---

## C. The runbook stops one step short of publishing

`PUBLICATION-RUNBOOK-2026-07-22.md` ends "After 3 and 4: publication-ready." But
per `lib/publicEdition.ts` (header) and PUBLISH-CHECKLIST §Sequencing, the flip
itself is three more ops steps that nobody has written down or scheduled:

1. Attach the custom domain to project B.
2. Set `NEXT_PUBLIC_EDITION=lab` on project A (the lab). **This is the step that
   makes `app/robots.ts` serve `Disallow: /` for the lab.** Until it's set, the lab
   is `unset` edition → robots says `allow: "/"` → search engines index the lab.
3. Set `SITE_PASSWORD` on project A.

Skip 2 and 3 and `epistemic-receipts.vercel.app` stays anonymously reachable and
crawlable next to the public domain, with `/admin`, `/review`, `/edges`, `/labs/*`
protected only by the admin gate rather than absent. The whole point of the
two-project split is that the lab surface *doesn't exist* publicly.

Also unscheduled: the runbook itself (`PUBLICATION-RUNBOOK-2026-07-22.md`) is
untracked — same one-machine failure mode as A4, just without the gitignore.

---

## D. Stale docs that will misdirect the audit

B8-6 instructs: *"run PUBLISH-CHECKLIST §Verification verbatim."* That document has
drifted from the code:

- **`PUBLISH-CHECKLIST.md:65` and `:86` say `PUBLIC_EDITION=1` /
  `NEXT_PUBLIC_EDITION === "1"`. The code checks `=== "public"`
  (`lib/publicEdition.ts`).** The runbook has it right; the checklist does not.
  Setting `1` doesn't error — it silently leaves `IS_PUBLIC_EDITION` false, so the
  page gate never activates and project B deploys **the complete lab surface on a
  public domain**. One character between "publishable" and "leaked the lab."
- `:77` and `lib/publicEdition.ts`'s own header still say **read-only** Neon role.
  The actual decision (B12 Q2, 2026-07-16) is `er_scoped_writes`. Contradictory
  instructions at the exact step where you're pasting a connection string.
- `§Verification` item 1 references "the tobacco and H. pylori claim URLs" — the
  same document's P0 note already corrects that to Müller 1939, not H. pylori.
- `§Verification` item 4 (one claim total across homepage//pipelines//sources) has
  an **owner decision still open** at `:15`: do never-classified claims (137,875)
  join the headline count? Site says 1.62M, corpus is 1.76M. B8-6 cannot pass
  verbatim until you answer that.

**Fix:** 20-minute pass over PUBLISH-CHECKLIST before starting B8, or B8-6 audits
you against a stale spec.

The one still-unchecked P0 item is "curate the white-paper-cited claims." Setting
the whitepaper aside as instructed, the residue is real and independent of it: two
marquee claims (Surgeon General 1964, `cmqwoxe6l07dy8o0y6xrs8xnv`; Müller 1939,
`cmqoappnu03yxsadpa90nu942`) render UNREVIEWED with no settling-curve transitions.
Both Substack drafts footnote those URLs. If either draft ships, that's the first
link a skeptic clicks.

---

## E. Lower priority, correctly ranked in the handoff

- **Nightly integrity check, ~55s failure, never diagnosed.** The handoff ranks this
  #2; I'd raise it. It is the only open item that could invalidate the corpus, and
  the workflow's own comment concedes it's either a stale `DATABASE_URL` secret or a
  real finding. One `workflow_dispatch` run answers it. Do it before gate 4 — a data
  incident discovered *after* you publish a measured error rate is a much worse day.
- **Branch protection on main** requiring `quality`. Handoff #9. Pre-publication
  this is hygiene; post-publication a red merge is a live-site incident. Cheap.
- **Your Mac is on the wrong branch.** Checkout is `loop/votes-b11-2026-07-15`;
  local `main` is 142 behind / 1 ahead, carrying an unpushed promoter commit
  (`7145fac`, run #20). The handoff assumed you'd be on main. Since openalex-promoter
  commits to whatever is checked out, promoter runs are stranding again — same
  mechanism that stranded runs #74–78. `git checkout main && git pull` before
  anything else.
- **10 stale `*.bundle` files** in the repo root, all delivered and pushed. Delete.
- Sourcemaps job `continue-on-error: true` for missing Sentry secrets (`ci.yml:163`)
  — add the secrets or delete the job; it muddies run pages.
- `actions/checkout` / `setup-node` pins on deprecated Node 20.
- 247 eslint warnings; `scripts/cleanup-stale-branches.sh` (17 local branches).

**Correct in the handoff, verified:** CI green on main (#166/167/168 success, #169
in progress). `1156ba8` and the handoff commit are both on origin/main — the last
bundle did get pushed. All B15/B16/B17 briefs, B8/B15/B17 scripts, and B15
worksheets are on main.

---

## Suggested order

1. **Un-ignore and push the B8 brief** (A4). Two minutes. Everything downstream
   depends on a document that currently exists once.
2. `git checkout main && git pull`; push `7145fac`; delete the bundles (E).
3. **Add `/methodology` to `PUBLIC_ROUTES`; decide `/communities`, `/pricing`,
   `/collections`** (A1, A2). One commit.
4. **Decide the feedback/subscribe question** (A3) and apply it — otherwise gate 3
   cannot pass.
5. **Dispatch the integrity check** (E). One log. If it's a real finding, everything
   below waits.
6. **Reconcile PUBLISH-CHECKLIST with the code** (D), including the 1.62M/1.76M
   headline decision.
7. Then gate 3, then gate 4 — with 4a (n=520 vs 300) decided before the first row.
8. Then the flip sequence in C, written into the runbook as steps 5–7.

Items 1–4 are roughly one sitting and remove two guaranteed gate-3 failures.
