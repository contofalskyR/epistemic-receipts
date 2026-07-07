# Pre-Launch Audit — 2026-07-06 (independent pass)

> **RESOLUTION STATUS (code fixes applied same day).** Blockers 1–4 and 6, plus
> items 8–14, are fixed in the working tree (tsc clean, lint clean on touched
> files, pure-logic unit-tested). **Still requires you:** ① deploy + purge caches
> (item 7 / whitepaper URLs); ② curate the two whitepaper-cited claims (blocker 5
> — content, not code); ③ decide + run the duplicate-trajectory cleanup
> (`DUPLICATE-TRAJECTORIES-2026-07-06.md`); ④ set `NEXT_PUBLIC_EDITION` and the
> public-edition ops (item 15). ⑤ `git rm --cached` the three tracked junk files.
> The claim-page timeline fix also corrected a data-read bug: the timeline now
> renders `statusHistory` transitions, so the "Dormant/no revisions" vs OG
> "latest transition" contradiction is gone for every claim, not just the cited two.


**Scope:** full route map (101 pages) cross-checked against every internal href in the codebase, plus live verification of production (epistemic-receipts.vercel.app) as an anonymous visitor. Cross-referenced against `PUBLISH-CHECKLIST.md`. Deployed = `79949c5` (HEAD, confirmed).

---

## Launch blockers (new — not on the existing checklist)

### 1. /case-studies is EMPTY in production
Renders "No case studies found." — yet the homepage features it as one of the five "What you can do here" entry points, and `sitemap.ts` lists it at priority 0.9.

**Root cause (app/case-studies/page.tsx):** the query requires `ingestedBy: "manual"` AND `externalId startsWith "trajectory:"`. Per /sources, trajectory claims live under `seed:human-history-trajectories` (3,465), `seed:medicine-trajectories` (1,782), etc. — only 23 claims have tag `manual`, and evidently none with a `trajectory:` externalId. The AND of the two filters matches zero rows.

**Fix:** drop the `ingestedBy` filter (externalId prefix is already the discriminator) or use `ingestedBy: { in: ["manual", "seed:…"] }`. Then purge the ISR cache (revalidate = 86400 — it will serve the empty page for up to a day after the fix deploys).

### 2. robots.txt advertises a sitemap URL that 404s
Live `/robots.txt` says `Sitemap: https://epistemic-receipts.vercel.app/sitemap.xml` → **404**. With `generateSitemaps()`, Next 16 serves only `/sitemap/[id].xml` (confirmed working: `/sitemap/static.xml` returns a full XML). There is no auto-generated index at `/sitemap.xml`.

**Fix:** either list the actual chunk URLs in `robots.ts` (`/sitemap/static.xml`, `/sitemap/topics.xml`, `/sitemap/claims-0.xml`, …) or add a small route handler at `/sitemap.xml` that emits a `<sitemapindex>` pointing at the chunks. Until then, Search Console will report a dead sitemap.

### 3. Dead footer link on every page: robertcontofalsky.com
The domain serves an error page (does not resolve). It's in the site-wide footer ("Conceptualized by Robert Contofalsky") — a broken credit link on literally every page. Fix the domain or point it somewhere live (LinkedIn, etc.). (openclaw.ai works fine.)

### 4. Broken internal link: /political-science (404)
No `app/political-science/` route exists, but it's linked from two public pages:
- `app/security-studies/page.tsx:398` — `<Link href="/political-science">`
- `app/communication/page.tsx` — same pattern

Also referenced in prose in `app/security-studies/data2.ts` ("see /political-science for framing"). This was the only hard-broken static internal link in the entire codebase (all other nav/footer/body links map to real routes). Either build the taxonomy page or re-point to an existing route.

### 5. Whitepaper-cited claims: still open, plus a new self-contradiction
Confirms checklist P0 — the two cited claims render **UNREVIEWED**, "Dormant · no revisions," sources at 50/100 defaults. But it's worse than the checklist records:

- **Metadata contradicts the page.** For `claims/cmqoappnu03yxsadpa90nu942`, the OG/meta description says "Settled · **latest transition RECORDED → SETTLED (1950)**" (statusHistory has rows) while the rendered timeline says "**Dormant · no revisions**" and "unreviewed since emergence." The timeline component and `statusHistory` disagree — one of them is reading the wrong table. A skeptic pasting the link into Slack sees the contradiction in one screenshot.
- **Timeline math bug:** same page shows "~87.6 yrs old · emerged 1939" in the header and "**13.6 yrs** · unreviewed since emergence" in the timeline (13.6 yrs ≈ counting from the 2012 source, not emergence). Two "Claim emerged" entries render (Jan 1939 + Dec 2012).
- **Checklist labeling error:** PUBLISH-CHECKLIST.md calls `cmqoappnu03yxsadpa90nu942` "H. pylori" — it's actually the Müller 1939 tobacco study. Verify the whitepaper's footnote URLs point where you think they do before circulating.

### 6. Flagship /settling-curve defaults to visible duplicates
The default "Modern" section is a wall of ~14 near-identical American Academy of Pediatrics trajectories — including the **same January 2023 childhood-obesity guideline four times** as four separately-worded claims. This is the page the homepage hero sends people to. Dedupe or hand-pick the default curated set before publicity.

---

## Verified fixed (checklist P0s confirmed live)

- /edges, /labs/*, /claims/*/edit, /review, /admin → redirect to /login as anonymous ✓
- /pipelines raw tag dump gone; labeled aggregate ("157 additional ingester tags…") ✓
- Corpus totals reconcile with disclosure: homepage 1,619,751 = /sources "classified" count; /pipelines 1,619,729 + 22 manual ✓
- Evidence-score legend on claim pages + glossary entry ✓
- /meta-edges: framed, named "Suppression & Amplification," in Discover nav, no editing-copy leak ✓
- About-page scope rewrite live (browser-verified) ✓
- Claim pages: SSR content, per-claim title/description, OG image (api/og/claim returns 200, 1200×630) ✓
- /search works (tested "pluto": 64 claims / 53 sources) ✓ ; /feed, /glossary, /corrections render ✓

## Should fix before publicity (non-blocking but visible)

7. **Stale CDN/ISR copies still circulating.** A no-JS fetch of the tobacco claim returned the OLD pre-SSR shell ("Pulling the receipt…", generic title, no OG tags); a fetch of /about returned the OLD "no sports" scope text. Browser gets current HTML; cached edge copies persist up to 24h (`revalidate = 86400`). Social scrapers and crawlers behave like the no-JS fetch. **After the final pre-launch deploy, purge/revalidate** — especially the whitepaper-cited claim URLs — before sharing links anywhere.
8. **Same-page retraction count mismatch (homepage):** stats bar says 26,624 RETRACTED PAPERS; the Retractions domain tile says 26,679. (Checklist P2 flags this across surfaces — it's actually on one page.)
9. **Homepage domain tiles look broken:** "Neuroscience — 318,775 claims" (the entire OpenAlex corpus labeled as neuroscience) next to "Biology & Physiology — 99 claims." First-time visitors will read this as a bug.
10. **React hydration error #418** (console, claim pages) — text-content mismatch, likely a locale/date or `new Date()` render. Causes client re-render; find via non-minified build.
11. **Escaping bugs in search results:** literal `<i>Context. <i/>` tags visible in the Pluto search results (OpenAlex abstracts), plus the known `Science &amp; Justice` double-escape on retraction cards.
12. **Generic metadata on most static pages.** Only claims/[id], settling-curve, statistics/explorer/[slug], and case-studies have per-page metadata. /about, /glossary, /feed, /sources, /pipelines, /corrections, /meta-edges etc. all serve title "Epistemic Receipts" + the site-wide default description. Cheap win: add `export const metadata` to the ~20 public pages.
13. **Default meta description says "1M+ verified facts"** while the homepage says 1.62M claims. Update `app/layout.tsx`.
14. **One raw cuid still public on /sources:** `book-analysis:cmppvaz700000sal1cnyfutdx` under Editorial/Curated.
15. **Indexing strategy is currently backwards for the two-project plan.** Today the lab (.vercel.app) robots.txt ALLOWS crawling. If the public domain plan proceeds, everything indexed now under .vercel.app becomes duplicate content to clean up later. Set `NEXT_PUBLIC_EDITION=lab` (or decide to launch on .vercel.app) *before* publicity, not after.

## Public-edition ops (from your checklist, still pending)

- [ ] Second Vercel project with `NEXT_PUBLIC_EDITION=public`
- [ ] Read-only Neon role as public `DATABASE_URL`; omit `ALLOW_EDITS`/`ADMIN_TOKEN`
- [ ] Custom domain on public project
- [ ] `NEXT_PUBLIC_EDITION=lab` + `SITE_PASSWORD` on this project

## Repo hygiene (not launch-blocking)

`app/opinions/OpinionsClient.tsx.bak`, `.pipeline-openfda-*.log.attempt*`, `tsconfig*.tsbuildinfo`, `.DS_Store` files are committed. If the GitHub repo is (or becomes) public, note that CONSULTANT.md (606KB), ROADMAP.md, memory/, briefings/ and all audit docs ship with it.

---

## Suggested order of operations

1. Fix /case-studies query + /political-science link + robots sitemap URL + footer domain (all < 1 hr total)
2. Curate the two whitepaper-cited claims; fix the timeline component's statusHistory read + the "13.6 yrs" math
3. Dedupe the settling-curve default set
4. Per-page metadata pass; retraction-count single query; domain-tile labels
5. Public-edition ops → purge caches → verify §Verification in PUBLISH-CHECKLIST.md → publicity
