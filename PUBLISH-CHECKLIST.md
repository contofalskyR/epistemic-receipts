# Publish Checklist — Live-Site Audit 2026-07-06

**Scope:** what to publish, what to hide, and what to fix first — from a route-by-route browse of production (epistemic-receipts.vercel.app) on 2026-07-06, cross-checked against `AUDIT-WHITEPAPER-GAP-2026-07-03.md`, `docs/lab-pages-triage-2026-07-03.md`, and the nav (`app/components/Nav.tsx`).

House rule applies to every item here: fixes must not fabricate data; where a number is wrong, derive it — never hand-write it.

---

## P0 — Contradictions & leaks (fix before ANY publicity)

These are the items a skeptic screenshots. Order matters; all are small.

- [x] **About-page scope rewrite.** "No sports, no pure financial claims" contradicted live routes (/sports, /finance, /financial, /congress-trades, /stock-act). Rewritten 2026-07-06: accountability finance is in scope because it documents how power works; taxonomies are navigation aids, not ingested claims. (`app/about/page.tsx`)
- [ ] **Curate the white-paper-cited claims.** Reference [1] (Surgeon General 1964, `claims/cmqwoxe6l07dy8o0y6xrs8xnv`) renders UNREVIEWED, "Dormant · no revisions," "unreviewed since emergence," two sources at unexplained 50/100, and **no settling-curve transitions** — for the paper's marquee smoking example. Same treatment for reference [2] (`claims/cmqoappnu03yxsadpa90nu942` — NB: this claim is the Müller 1939 tobacco case-control study, NOT H. pylori as previously noted here; re-verify the whitepaper footnotes point where intended — AUDIT-PRELAUNCH-2026-07-06 §5). Both papers' and both Substack drafts' footnotes land on these URLs. Build the curves, review the claims, source the scores.
- [x] **Reconcile the three public corpus totals — resolved by labeling 2026-07-06.** Root cause found: the gap (137,875 claims) is rows with `verificationStatus = NULL` — the raw SQL on /sources counts them (`IS DISTINCT FROM`), while Prisma's `not: "DEPRECATED"` on the homepage//pipelines silently excludes NULLs. /sources now discloses the split ("includes N claims awaiting verification-status classification; homepage counts the classified M only"), and the math closes exactly. **Owner decision still open:** should never-classified claims join the headline count (site says 1.62M; the corpus is 1.76M)? If yes, fix the Prisma filters to `OR: [{verificationStatus: null}, {verificationStatus: {not: "DEPRECATED"}}]` and update hand-written "1.6M" strings in Nav/copy.
- [ ] **Gate `/claims/[id]/edit`.** Publicly routable; renders "Editing is disabled in this deployment." Internal surface — require admin session like `/review` (which gates correctly).
- [ ] **Hide `/edges` (or admin-gate until designed).** Raw edge firehose, "Editing is disabled…" leak, unexplained `—/100` and `70/100` scores, no framing.
- [ ] **Hide `/labs/claim-diff` until populated.** Currently empty and publicly prints "Run `scripts/enrich-transition-claims.ts` to populate" — an internal runbook on a public URL.
- [ ] **Move `/pipelines` "Unregistered Tags" behind admin.** 130+ raw internal tags are public: zero-count `enrich:*` debug tags, `book-analysis:<cuid>`, seed tags — while the actual biggest pipelines (nara_catalog 308k, voteview 113k, openalex 212k) sit in "unregistered." Register the majors in the pipeline registry; hide the raw dump. Same for the smaller "Uncategorized: 11 tags" block on `/sources`.
- [ ] **Strip "Editing is disabled in this deployment" from every public render.** Confirmed on /edges, /meta-edges, /claims/[id]/edit. Grep for the string; it should render only for authenticated admins.
- [ ] **Evidence-score legend.** 50/100, 70/100, `—/100` appear on claims and edges with no explanation anywhere. Tooltip + one glossary entry. (Also flagged in gap audit §2.)

## P1 — Promote the assets, graduate the Lab (before Show HN / paper circulation)

- [ ] **/corrections into the main nav.** The public audit log is the most persuasive page on the site and is footer-only. Headline it. (Gap audit §5 agrees.)
- [ ] **Promote /meta-edges as a named feature.** The suppression records — TIRC "doubt is our product," the Fahy brief omission in Korematsu, the SSCP counter-labeling of the Lancet statement — are the strongest editorial content on the site, currently unlinked from the nav and wearing internal copy. Name it (e.g. "Suppression & Amplification"), frame it, link it from Discover.
- [ ] **Briefing 04 (SSR, per-page metadata, sitemap) + Briefing 05 (live counters, cited-claim curation).** Already specced; they remain the vision-blocking items. Everything above makes the pages worth crawling; 04 makes them crawlable.
- [ ] **Lab graduations** (per `docs/lab-pages-triage-2026-07-03.md`): /retraction-wall, /legislation, /analysis/votes, /drug-arc, /books are at or near production quality — move out of the amber ⚗ group as fixes land.
- [ ] **Decide /sports Sections A–E.** Section F (sport science) is defensible under the rewritten scope; the 197-entry sports catalog is the weakest-fit content on the site. Either cut A–E or keep the page honest as a pure navigation taxonomy (the rewritten About supports the latter — but then the nav copy should say "Sport Science" rather than "Sports" if trimmed).
- [ ] **/globe/lab (deep-time paleogeography):** unlist or cut. Charming, off-mission, orphaned.
- [ ] **/foreign-legislation vs /legislation:** fold or rename (triage doc); two sibling pages with overlapping data and different UIs confuse scope.

## P2 — Polish (post-launch acceptable)

- [ ] /claims default ordering: diversify page 1 (currently a wall of near-identical NARA captions).
- [ ] Retraction count differs by surface (26,595 / 26,624 / 26,679 across AGENTS.md, pipelines, homepage domain tile) — derive from one query.
- [ ] HTML-entity double-escaping on retraction cards (`Science &amp; Justice`).
- [ ] /topics taxonomy data fixes (Pakistan under Academic Literature → Law; owner DB mutation, see triage).
- [ ] /analysis/votes deep fix: precompute `buildVoteAnalysis()`.
- [ ] Globe wide-viewport layout void; chip wrapping.

## Verification (definition of done for P0)

1. Fetch the tobacco and H. pylori claim URLs — each shows a curve with ≥2 dated, sourced transitions and no UNREVIEWED badge.
2. Grep production HTML for "Editing is disabled" as anonymous visitor → zero hits.
3. `/edges`, `/labs/claim-diff`, `/claims/*/edit`, `/admin/*`, `/review` → 404 or login for anonymous.
4. Homepage, /pipelines, /sources show the same claim total (or labeled variants).
5. /pipelines and /sources show zero raw `enrich:*` / cuid tags to anonymous visitors.

---

# Public Edition — the "fork" strategy

**Goal:** a clean, publishable site without freezing development or maintaining two codebases.

**Recommendation: do NOT git-fork.** At this repo's velocity (1,800+ commits in two months) a forked repo or long-lived `public` branch rots within weeks and every fix lands twice. Instead: **one repo, one branch, two Vercel projects, one env flag.**

## Architecture

```
same GitHub repo (main)
├── Vercel project A: epistemic-receipts        ← the lab (today's site)
│     env: SITE_PASSWORD=<set>                  ← goes private again
└── Vercel project B: epistemic-receipts-public ← the publishable site
      env: PUBLIC_EDITION=1                     ← route allowlist active
      env: DATABASE_URL=<read-only role>        ← defense in depth
      custom domain: epistemicreceipts.org (or similar)
```

Both projects deploy from `main`. The public edition differs only by environment, mirroring the existing `SITE_PASSWORD` / `ALLOW_EDITS` pattern — configuration, not code divergence.

## Implementation

**Status 2026-07-06: code scaffolding SHIPPED.** `lib/publicEdition.ts` (allowlist + edition flags), the middleware deny-by-default page gate, the Nav filter (Lab group hidden on public edition), and edition-aware `app/robots.ts` (replacing static `public/robots.txt`) are all in the tree. Behavior is unchanged until `NEXT_PUBLIC_EDITION` is set — remaining steps are Vercel/ops only:

- [ ] Create the second Vercel project (same repo, `main`), set `NEXT_PUBLIC_EDITION=public`.
- [ ] Create a read-only Neon role; use its connection string as the public project's `DATABASE_URL`; omit `ALLOW_EDITS` and `ADMIN_TOKEN`.
- [ ] Attach the custom domain to the public project.
- [ ] On the lab project: set `NEXT_PUBLIC_EDITION=lab`, then `SITE_PASSWORD` once the public domain is live.

Original design notes below.

1. **`lib/publicEdition.ts`** — single source of truth, shared by middleware and Nav:

```ts
export const IS_PUBLIC_EDITION = process.env.NEXT_PUBLIC_EDITION === "1";

// Deny-by-default page allowlist for the public edition (prefix match).
export const PUBLIC_ROUTES = [
  "/", "/about", "/corrections", "/settling-curve", "/search",
  "/trajectories", "/fields", "/prereq-graph", "/retraction-explorer",
  "/opinions", "/law-settler", "/congress-trades", "/members", "/votes",
  "/sources", "/pipelines", "/glossary", "/feed", "/claims", "/topics",
  "/historical-events", "/meta-edges", "/globe", "/bookmarks", "/feedback",
  // domain taxonomies
  "/statistics", "/finance", "/psychology", /* …rest of the fields set */
];
```

2. **`middleware.ts`** — add a page-route gate beside the existing API gate: if `IS_PUBLIC_EDITION` and the path isn't allowlisted (and isn't a static asset), rewrite to the 404. This is the same deny-by-default posture the API already has, applied to pages. Lab/experimental/admin surfaces don't exist on the public domain, regardless of what ships in the bundle.

3. **`Nav.tsx`** — filter `GROUPS` against `PUBLIC_ROUTES` when `IS_PUBLIC_EDITION`; the ⚗ Lab group disappears entirely on the public edition and stays on the lab site.

4. **Database:** create a Neon role with `SELECT`-only grants and use its connection string in project B. Public edition physically cannot write, independent of `ALLOW_EDITS`/`ADMIN_TOKEN` (omit both from project B's env anyway). Public write paths that must still work (feedback, search-miss, subscribe) can keep a scoped-writes role or an API route that proxies via the lab deployment — decide per feature; default is read-only.

5. **Crawlability split:** `robots.txt` and `sitemap.ts` (briefing 04) serve real content only when `IS_PUBLIC_EDITION`; the lab project serves `Disallow: /`. Search engines and AI crawlers only ever meet the curated surface. OG metadata likewise.

6. **Flip the switch:** set `SITE_PASSWORD` on project A. The lab returns to private; the public domain is the only anonymous surface.

## Why this beats a real fork

- Every commit to `main` ships to both sites; nothing lands twice.
- The publish/hide decision becomes **data** (`PUBLIC_ROUTES`) — auditable, reviewable in one diff, and consistent between middleware and nav by construction.
- Rollback is an env-var change, not a merge.
- It reuses the security model's existing philosophy (deny-by-default, env-gated behavior) rather than inventing a second one.

## Sequencing

1. P0 items above (they fix content both editions share).
2. `lib/publicEdition.ts` + middleware + Nav filter → deploy project B behind its vercel.app URL.
3. Verify §Verification against project B.
4. Briefing 04 (SSR/sitemap/OG) targeting project B's domain.
5. Custom domain on B → set `SITE_PASSWORD` on A.
6. Then publicity: white paper → Show HN → journalist pitches (per `epistemic-receipts-marketing.md` sequencing).
