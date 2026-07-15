# Launch Runbook — taking Epistemic Receipts public (2026-07-14)

**What this is.** The execution plan over `PUBLISH-CHECKLIST.md`'s two-project strategy, updated for everything that changed since it was written (B3–B6, the 2026-07-09 security assessment, the AA-1 finding that the whitepaper claims were hand-curated 2026-07-09). Every step is labeled:

- **[OWNER]** — only Robert can do it (consoles, credentials, judgment calls, DB writes)
- **[AGENT]** — dispatchable to OpenClaw as a brief, standing rails apply
- **[OWNER→AGENT]** — owner decides, agent executes

**Critical path (everything else hangs off these six):**
security gate (L0) → content P0s (L1) → `er_readonly` role + Vercel project B (L2) → verify B on its vercel.app URL (L2) → domain on B + `SITE_PASSWORD` on A (L3) → post-flip verification, then publicity (L4–L5).

**Rollback at any point:** the flip is environment, not code — detach the domain / unset `NEXT_PUBLIC_EDITION` / unset `SITE_PASSWORD` and you are back to today.

---

## L0 — Security gate (before any publicity; the repo is already public)

The 2026-07-09 assessment found the repo publicly readable with live findings. Status as re-verified against the tree on 2026-07-14: the two fail-open cron routes are **fixed** (fail-closed, verified), `scripts/notify-telegram.sh` **no longer contains a hardcoded token** (verified). The rest must be confirmed, not assumed.

1. **[OWNER] Confirm the Telegram token was actually rotated** (BotFather), not just removed from the tree — it lived in public git history; treat as compromised until rotated. Also skim the bot's activity for abuse. *(Launch-blocking.)*
2. **[OWNER] GitHub settings:** check `main` branch protection + whether the gitleaks Actions run failed on the original leak (assessment finding #16). Turn on required status checks if absent. *(Launch-blocking — publicity multiplies push traffic and eyes.)*
3. **[OWNER→AGENT] Decide the tracked-planning-docs question (finding #7):** CONSULTANT.md (606KB of internal state incl. chat IDs), ROADMAP.md, SCALING.md, briefs/, briefings/ are all tracked in a public repo. History is already public — this is a go-forward call: keep them public as radical transparency, or `git rm --cached` + gitignore the operational set. Either is defensible; make it deliberately. *(Launch-blocking as a decision, not necessarily as a removal.)*
4. **[AGENT] Security remediation brief (Brief #7 candidate)** — verify current status of each remaining finding and fix the mechanical ones: `git rm --cached` the three tracked junk files (`.bak` + two `.log.attempt*` — confirmed still tracked today); `npm audit` re-run and non-breaking fixes (finding #6: 25 vulns incl. `protobufjs` RCE-class via `@xenova/transformers` — evaluate the legacy MiniLM path's removal since spec-50 embeddings supersede it); enforce `expiresAt` in `verifyApiKey` (#8); CSP `connect-src` allowlist (#9); workflow script-injection `env:` fix + SHA-pin actions (#10, #11); local gitleaks pre-push hook (#16). Stripe portal/checkout auth (#5) can alternatively be parked by confirming those routes stay admin-gated until billing ships. *(Blocking: the audit-fix and junk-file items; the rest strongly advised pre-publicity.)*

## L1 — Content P0s (both editions share these; from PUBLISH-CHECKLIST)

1. **[AGENT] Whitepaper-cited claims — verify and close out.** Both claims (`cmqwoxe6l07dy8o0y6xrs8xnv`, `cmqoappnu03yxsadpa90nu942`) were hand-curated 2026-07-09 (per MATERIAL-LOG AA-1: 2 transitions each, humanReviewed by robert). Agent verifies the live pages render curves with dated, sourced transitions and no UNREVIEWED badge, ticks the checklist, and reconciles `seed-smoking-cancer.ts`'s stale Step-7 block against DB reality (retire or update the script — AA-1's own stop-note). *(Launch-blocking: these URLs are in the whitepaper and both Substack drafts.)*
2. **[OWNER→AGENT] The headline-count decision** (PUBLISH-CHECKLIST open item): should never-classified claims join the public total (1.76M) or does the site keep the classified 1.62M? One decision, then the agent aligns the Prisma filters and every hand-written "1.6M" string. *(Launch-blocking — it's the first number a journalist checks.)*
3. **[OWNER] Duplicate trajectories DB write:** 265 groups / 316 removable, script ready (`find-duplicate-trajectories.ts --deprecate` + `KEEP_OVERRIDES`). This is a production DB write — full doctrine: review keep-picks, dry-run diff, explicit yes, execute, audit. Route it through the material loop. *(Strongly advised pre-launch — duplicate showpieces read as sloppiness on exactly the pages visitors land on.)*
4. **[OWNER→AGENT] Editorial trims** (P1 in the checklist, cheap): /sports sections A–E cut-or-keep, `/globe/lab` unlist, `/foreign-legislation` vs `/legislation` fold. *(Not blocking; do if time allows — they're scope-credibility items.)*
5. **[OWNER] Legal sign-offs** (BUILD-STATUS owner actions): lawyer review of `legal/` before the ToS/privacy/license pages are cited publicly; the three placeholder emails; the `omim_v1`/`icd11_v1` licensing holds affect snapshots, not the site launch. Methodology page read-through (`// NEEDS OWNER READ-THROUGH` markers). *(Lawyer review + methodology sign-off: launch-blocking. The rest rides with the snapshot/API track.)*

## L2 — Stand up the public edition (project B)

1. **[OWNER] Create the `er_readonly` Neon role** (SELECT-only; SQL pattern in `docs/runbooks/snapshots.md`). This one credential does double duty: project B's `DATABASE_URL`, and the data-doctrine §5 mechanical enforcement for loop workers. *(Launch-blocking.)*
2. **[OWNER] Vercel → New Project** from the same repo, production branch `main`: `NEXT_PUBLIC_EDITION=public` (build-time inlined — set it **before** first deploy), `DATABASE_URL` = the read-only role, `CRON_SECRET` set (crons now fail closed — unset would 401 them, which is correct but decide which crons project B even needs; likely none, keep `vercel.json` crons on A only — verify Vercel doesn't double-schedule), Telegram env vars **only if** the feedback/flag forms should notify from B, **no** `ALLOW_EDITS`, **no** `ADMIN_TOKEN`, **no** `SITE_PASSWORD`. Set the site-origin env the OG/embed URL helper reads so snippets and OG cards emit the right host. *(Launch-blocking.)*
3. **[AGENT] Public-edition verification brief against B's vercel.app URL** — the highest-value agent task in this runbook:
   - Every `PUBLIC_ROUTES` entry (including B6-2's additions) renders; every non-listed route (labs, admin, review, edges, edit) 404s; Nav shows no Lab group.
   - **Write-path sweep with the read-only role:** feedback, flag-a-receipt, bookmarks, alerts, search-miss, collections — each either works by design (decide which, per PUBLISH-CHECKLIST's "decide per feature") or degrades gracefully with no 500s and no dead forms. This is the step most likely to surface surprises; budget for findings.
   - robots.txt allows crawling on B (and still disallows on A); sitemap index + chunks serve on B with B's host in URLs; OG images render with absolute B URLs; JSON-LD intact.
   - Embeds + badges on B's host; `EmbedButton` snippets emit B's origin; `/embed/*` framing headers present.
   - PUBLISH-CHECKLIST §Verification P0 definition-of-done, run in full against B.
   - Rate limiting and Sentry live on B (separate project = separate env — confirm DSN/env set or deliberately absent).
4. **[OWNER] Read the verification report; fix-or-accept each finding** (fixes go to main — both editions inherit them).

## L3 — Domain + the flip

1. **[OWNER] Attach the custom domain to project B** (buy it first if needed — the checklist suggests epistemicreceipts.org-style). Update the site-origin env on B to the domain; redeploy; spot-check OG/embed/badge URLs now emit the domain.
2. **[OWNER] Flip project A to private lab:** `NEXT_PUBLIC_EDITION=lab`, then `SITE_PASSWORD` set. Order matters: do this only after B is verified live on the domain — the lab going dark first would leave zero public surface and break anyone's existing embeds pointed at vercel.app.
3. **[AGENT] Post-flip smoke, both projects:** A redirects everything to /login except the carve-outs you *want* on the lab (`/embed`/`/api/badge` remain public on A by the B5 carve-out — decide whether embeds should now canonicalize to the domain instead; likely yes: point `EmbedButton`/docs snippets at B, leave A's carve-out as legacy-compatible); B serves the domain cleanly; no mixed-host URLs in rendered HTML on either.

## L4 — Indexing + observation window (first week)

1. **[OWNER] Search Console:** verify the domain property, submit the sitemap index. **[AGENT]** can prepare the DNS TXT instructions and confirm sitemap fetchability.
2. **[AGENT] Crawl-health check after 48–72h:** fetch-as-Google behavior on a claim page, a trajectory, a story; confirm noindex surfaces (receipts, embeds) stay out; log 404s from Vercel analytics if enabled.
3. **[OWNER] Watch Neon load** as crawlers arrive (the pooler + 35 hot-path indexes held at 842k-claim scale; 1.76M + crawl traffic is new territory — the ISR revalidate values are the throttle if needed).
4. **[AGENT] Baseline snapshot for the record:** page-count, corpus totals, per-surface spot-checks into a dated `briefs/launch-baseline-<date>.md` — the "day one" receipt for the site about receipts.

## L5 — Publicity (owner-paced; per `epistemic-receipts-marketing.md`)

1. **[AGENT] Repoint every artifact at the domain:** whitepaper footnote URLs, both Substack drafts (and embed a live curve + badge in each — the distribution primitives exist now), README, `/docs/api` examples.
2. **[OWNER] Sequence per the marketing doc:** whitepaper circulation → Show HN (the settling-curve explorer is the demo) → journalist pitches. One channel at a time; the flywheel doc's "one rule" applies — promise-free framing, receipts do the talking.
3. **[AGENT] Standing "moved this week" material** (already queued in MATERIAL-QUEUE as a findings item) becomes the recurring content engine post-launch.

---

## Launch-blocking summary (the short list)

| # | Item | Who |
|---|---|---|
| 1 | Telegram token rotation confirmed + branch protection | OWNER |
| 2 | Tracked-docs decision (public repo posture) | OWNER (→AGENT) |
| 3 | Security remediation brief (junk files, npm audit, CSP, workflows) | AGENT |
| 4 | Whitepaper claims verified live + checklist closed | AGENT |
| 5 | Headline-count decision + alignment | OWNER→AGENT |
| 6 | Lawyer review of legal/ + methodology sign-off | OWNER |
| 7 | `er_readonly` role + Vercel project B env | OWNER |
| 8 | Public-edition verification brief on B (incl. write-path sweep) | AGENT |
| 9 | Domain on B → then SITE_PASSWORD on A | OWNER |

Everything not in this table improves launch; nothing else gates it. The duplicate-trajectories write (L1-3) is the one judgment call I'd pull forward anyway — it's the difference between a skeptic finding one showpiece twice and not.
