# Build Brief #7 — Security remediation + launch close-outs (site lane, read-only)

**To:** RobClaw / the Claude Code worker it dispatches on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-14)
**Lane:** site/hardening. **Zero database writes.** This brief executes the agent-side items of the launch runbook's L0/L1 (`briefs/2026-07-14-launch-runbook.md`), working from the findings in `SECURITY-ASSESSMENT-2026-07-09.md`.

**Standing rails:** branch `loop/site-b7-2026-07-14`, one commit per phase (`B7-n:`), push + PR, owner merges. No INSERT/UPDATE/DELETE, no `--execute`, no `ALLOW_EDITS`, no schema changes, no nav items, no MATERIAL-QUEUE edits. Never `next build` on the VPS. Blocked beats invented. **Scope authorization specific to this brief:** you may edit `.github/workflows/*.yml`, `package.json`/lockfile, and `next.config.ts`'s `connect-src` directive — each ONLY as scoped in its phase below. The CSP `script-src 'unsafe-inline'` rule, the middleware, and auth logic remain untouchable.

---

## 0. Gate + orientation

1. **Gate:** B6 merged to main. `git fetch && git checkout main && git reset --hard origin/main`.
2. Read: `SECURITY-ASSESSMENT-2026-07-09.md` in full (it is finding-numbered; this brief references those numbers), the launch runbook L0/L1, CONSULTANT.md 2026-07 entries.
3. **Verify-then-fix discipline:** five days passed since the assessment; some findings are already fixed (the two fail-open crons and the hardcoded Telegram token were confirmed remediated 2026-07-14). For every finding this brief touches, first confirm its current state on main and record VERIFIED-FIXED / STILL-OPEN in the report before changing anything.

## Phases

### B7-1 — Legal routes into the publish gate (5 minutes, do first)

`lib/publicEdition.ts` `PUBLIC_ROUTES`: add `"/terms"`, `"/privacy"`, `"/license"`. Found in independent review of the B6-2 diff: all three are footer-linked in `app/layout.tsx` but absent from the allowlist — dead ToS/privacy links on the public edition. Isolated commit, same owner-reviewable spirit as B6-2.

### B7-2 — Tracked junk + repo hygiene (findings #12, part of #16)

- `git rm --cached app/opinions/OpinionsClient.tsx.bak .pipeline-openfda-labels-full.log.attempt1 .pipeline-openfda-labels-full.log.attempt2` (all three confirmed still tracked 2026-07-14; already gitignored).
- Add a local gitleaks pre-push hook (gitleaks has a native git-hook mode) + a one-line setup note in AGENTS.md's security section so future clones install it. CI gitleaks stays as-is.

### B7-3 — Dependency audit (findings #2, #6)

- Re-run `npm audit` (both with and without `--omit=dev`); paste numbers into the report.
- Apply `npm audit fix` non-breaking fixes only; `npx tsc --noEmit` + `npx vitest run` after.
- The `@xenova/transformers`/`protobufjs` RCE-class chain: **investigate before touching.** Determine whether the legacy MiniLM path (`lib/embeddings.ts` → `/api/search/semantic`) is live in production or superseded by the spec-50 OpenAI path (whose backfill is a pending owner action — it may NOT be active yet). If the legacy path is dead code → remove package + path, one commit. If it is the only working semantic search → do not remove; document the reachability analysis (does the ONNX loader ever touch attacker-controlled bytes?) and FLAG for the owner with both options costed. Do not break search to win an audit point.
- Check for patched `@sentry/nextjs` (transitive `uuid`); upgrade if the changelog shows no breaking config changes.

### B7-4 — API-key + auth hygiene (findings #8, #13, #5-parking)

- `lib/v1/auth.ts` `verifyApiKey`: enforce `expiresAt` (expired key → invalid), and set a default `expiresAt` on creation in `app/api/admin/api-keys/route.ts` (propose the default in the PR; 1 year unless the owner says otherwise). Unit-test both.
- De-duplicate the local `isAdmin()` in `app/api/admin/api-keys/*` → import the canonical `requireAdminOrDev`/`isAdminRequest` from `lib/adminAuth.ts`.
- Stripe portal/checkout (#5): **do not add auth logic in this brief.** Verify and record that both routes still require the global `ADMIN_TOKEN` today (i.e., effectively disabled for the public); FLAG that real org-membership auth is a prerequisite of the billing track (spec 21), not of launch.

### B7-5 — CSP `connect-src` allowlist (finding #9)

Inventory every client-side `fetch`/beacon target actually used (grep client components + Sentry/Upstash config; same-origin calls dominate). Replace `connect-src 'self' https:` with `'self'` + the explicit origins found. Touch ONLY `connect-src`. Acceptance: zero CSP violations in the browser console across homepage, a claim page, search (including semantic if live), globe, /feed, and a Sentry test event still delivers. If the inventory can't be made confidently complete, FLAG with the candidate list instead of shipping a breakage.

### B7-6 — Workflow hardening (findings #10, #11)

- The 6 workflows interpolating event data directly into `run:` blocks (`notify-telegram.yml` + 5 `workflow_dispatch` ones listed in the assessment): route untrusted strings through `env:` and reference as `"$VAR"`.
- Pin all 27 `uses:` lines to commit SHAs (comment each with the human-readable tag). Priority: `gitleaks/gitleaks-action` first.
- CI must stay green — workflows are load-bearing; test what's testable via a scratch branch run where possible.

### B7-7 — Whitepaper-claims close-out (runbook L1-1; content verification, no DB writes)

- Fetch both cited claim pages live (`cmqwoxe6l07dy8o0y6xrs8xnv`, `cmqoappnu03yxsadpa90nu942`): confirm each renders ≥2 dated, sourced transitions, no UNREVIEWED badge, and the page no longer contradicts its OG text. (They were hand-curated 2026-07-09 per MATERIAL-LOG — this verifies it stuck.)
- Tick the corresponding P0 checkbox in `PUBLISH-CHECKLIST.md` with a dated note.
- Reconcile `scripts/seed-smoking-cancer.ts`'s stale Step-7 block against DB reality per AA-1's stop-note: comment it out with a dated explanation or delete it — the script must no longer propose transitions that conflict with the live curated rows. (Code change only; the DB is already correct.)

## Out of scope — the parallel OWNER track (list verbatim in your report so nothing silently drops)

Telegram token rotation confirmation + bot-activity check; GitHub branch protection + the finding-#16 Actions-history check; the tracked-planning-docs decision (#7); the headline-count decision (1.62M vs 1.76M); duplicate-trajectories `--deprecate` run (owner-gated DB write); lawyer review of `legal/` + methodology sign-off; `er_readonly` Neon role; Vercel project B. None of these are yours; all of them gate launch.

## Verification

Per phase: `npx tsc --noEmit`, ESLint on touched files, `npx vitest run` (including new auth tests), CI green on the branch, Vercel preview green. B7-5 additionally: the browser-console CSP sweep. B7-3: post-fix `npm audit` numbers pasted.

## Report

`briefs/2026-07-14-b7-report.md`: per finding — VERIFIED-FIXED / FIXED-HERE (commit) / FLAGGED (why + options); the audit numbers before/after; the Stripe and transformers investigations in full; the owner-track list; anything new discovered while in the security-sensitive files (report, don't chase).

## STOP conditions

Any change that would alter auth behavior beyond the scoped items; CSP breakage you can't confidently enumerate away; a dependency fix that breaks tests; anything wanting to touch middleware, `script-src`, or secrets; two consecutive failures on one criterion. Blocked beats invented.
