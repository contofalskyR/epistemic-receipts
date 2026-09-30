# Epistemic Receipts — White Paper vs. Live Site Gap Audit

**Date:** 2026-07-03
**Scope:** Compares the live site (epistemic-receipts.vercel.app) against the claims and stated vision of the white paper (`Robert Contofalsky.md`, dated 07/01/2026). Focus is "what am I missing" — gaps between the argument the paper makes and what the site actually delivers.

---

## The one-sentence version

The paper's stated endgame — *"other tools querying it… an AI assistant or search engine that cites a claim's current status… an infrastructure layer other systems check against"* — is **architecturally blocked by how the site is built today**: the core pages are client-rendered with no per-page metadata, there is no sitemap, and `/api/` is closed. A crawler or LLM that visits a claim URL sees an empty shell. Everything else below is secondary to this.

---

## 1. Vision-blocking: the site is not machine-readable (highest priority)

The paper's most ambitious claim is that Epistemic Receipts becomes *infrastructure other systems query*. The current build makes that impossible without re-architecture:

- **Core pages are client-only.** 44 of 93 page routes are `"use client"`, and only **2 pages in the entire app** (`settling-curve`, `statistics/explorer/[slug]`) implement `generateMetadata`. The claim page — the "receipt," which the About page calls *"the product"* — is a client component. A server-side fetch of `/claims/cmqwoxe6l07dy8o0y6xrs8xnv` returns only the string *"Pulling the receipt…"*. Google, Bing, and AI crawlers get nothing.
- **No sitemap.** `/sitemap.xml` returns empty and there is no `sitemap.ts` in the app. 1.6M claims and the curated trajectories are undiscoverable by search engines.
- **robots.txt is a whitelist of top-level paths only** (`/`, `/claims`, `/topics`, `/sources`, `/search`…) and disallows `/api/`. There is no `Sitemap:` directive. Even the allowed paths have no deep URLs to crawl.
- **Every share is a generic card.** `layout.tsx` sets one static title ("Epistemic Receipts") and one description ("1M+ verified facts…") for the whole site. Because claim/trajectory pages have no `generateMetadata`, sharing any specific receipt on X or LinkedIn — using the **Share buttons that sit right on the claim page** — produces the same generic preview, not the claim. The paper's "one click away, let it be checked" ethos dies at the sharing layer.

**Why it matters:** this is the gap between the paper's thesis and the artifact. Fixing SSR + per-page metadata + a sitemap is the single change that unlocks sharing, SEO, *and* the "queryable infrastructure" future the paper spends its last section on.

---

## 2. Integrity gaps that undercut the credibility pitch

The entire differentiator is honesty and verifiability. These items are small individually but corrosive to that specific promise:

- **The "5,000+ trajectories" figure is a hardcoded string, not a count.** It lives literally in `HomeHero.tsx` line 437. The browsable curated trajectories (Settling Curve → Individual) number in the *dozens* (Ancient 2, Early Modern 1, WWI/WWII 3, Cold War 5, Modern 19…). The "5,474" that appears elsewhere is **retraction survival-pairs**, a different quantity. The paper itself is scrupulous — *"a few thousand claims out of 1.6 million"* — so an unverifiable marketing number on the homepage is off-brand and a soft target for a skeptic. Make it a live count or change the copy.
- **The flagship claims the paper *itself cites* aren't curated to the paper's own standard.** The Surgeon General / smoking claim is reference **[1]** in the paper, with an E-R link. On the live page it is tagged **UNREVIEWED**, labeled *"unreviewed since emergence,"* and both its sources are scored **50/100**. A reader who follows the paper's own footnote lands on a receipt that visibly contradicts "human-curated." Curate the handful of claims the paper links before anything else.
- **Scope contradiction.** Both the About page and the paper promise editorial discipline — *"no sports, no celebrity news, no pure financial claims."* Yet `/sports`, `/financial`, `/finance`, `/congress-trades`, and `/stock-act` are **live routes in the nav** (Analyze ▾ and Lab ▾), and `/sports/page.tsx` is a real, populated component. Either the copy is stale or scope crept. For a project whose whole pitch is "we defend scope by what we don't ingest," this needs to be reconciled explicitly.
- **Unexplained evidence score.** Claim pages show "Score 50/100" per source with no legend, tooltip, or link explaining what the number means or how it's derived. For an auditability-first product, an unexplained score is worse than no score.
- **Paper ↔ site drift on the canonical example.** The paper's semaglutide conclusion says *"five receipts"* (1996 / 2001 / 2010 / 2017 / 2021). The live trajectory shows **six** transitions (it adds a 2015 discovery-paper marker). The signature example should match the paper exactly.

---

## 3. Product gaps vs. the thesis

Things the paper argues for that the site doesn't yet do:

- **Cross-domain linking (paper's Future Work #3): absent.** Claims sit in siloed categories with no typed relation between, e.g., a court ruling and the scientific claim it leans on. This is the feature that would most distinguish the project from a citation manager — and it's not there yet.
- **Quiet-reversal tracking (Future Work #2): not started.** The Retraction Explorer only covers *formal* CrossRef retractions. The paper correctly names the harder, more valuable case — a finding that "just stops being cited" or is contradicted by a later meta-analysis — and nothing models it yet.
- **The case-study layer is thin and undersignposted.** The paper admits the curated layer is the point and is small. But a first-time visitor has no crawlable "Start here — the ~12 fully-built case studies" index. The best content (Korematsu, semaglutide, tobacco, Pluto, lab leak) is scattered and, per §1, invisible to search. Build a canonical, server-rendered case-study index.
- **No public/documented data access.** Beyond per-trajectory CSV/BibTeX/RIS export, there is no read-only API or bulk export, despite the endgame being programmatic queries. `/api/` is disallowed in robots and returns nothing to anonymous server fetches.

---

## 4. Polish / smaller bugs

- **HTML-entity double-escaping.** Retraction cards render `Science &amp; Justice` and `Trends in Food Science &amp; T…` — literal `&amp;` on screen. Visible on `/retraction-explorer`.
- **Retraction count differs by surface:** paper says ~26,600; `AGENTS.md` registry says 26,595; the live page says 26,624. Pick one source of truth and derive the rest.
- **Two white papers may be drifting.** The repo contains `WHITEPAPER.md` (Jun 11) alongside the newer uploaded paper (Jul 1). Worth confirming which is canonical before either is published.

---

## 5. What's already strong (keep / promote)

- **`/corrections` — "Public audit log" — is excellent and buried.** It logs pipeline retirements and data-quality events, and *honestly documents the USPTO fabricated-metadata incident and its retirement*. This literally practices the paper's thesis. It's currently only reachable from a footer link — it should be a headline feature; it's the most persuasive page on the site for the target-skeptic.
- **The Settling Curve visualization and the per-claim timeline are genuinely good** and on-message (dated transitions across Expert Literature → Institutions).
- **Scholarly export (BibTeX/RIS/CSV)** respects the "oldest habit in scholarship" lineage the paper's closing section invokes.

---

## Recommended order of operations

1. **Server-render claim + trajectory pages with `generateMetadata` + OpenGraph.** Unlocks sharing, SEO, and the queryable-infrastructure vision in one move. (§1)
2. **Ship a real `sitemap.ts`** (claims, trajectories, topics, sources) and add `Sitemap:` to robots.txt. (§1)
3. **Curate the specific claims the paper cites** (tobacco [1], H. pylori [2]) so its own footnotes don't land on UNREVIEWED receipts. (§2)
4. **Reconcile "5,000+"** — make it a live count or restate it. (§2)
5. **Resolve the sports/finance scope contradiction** — delist those routes or update the About/paper copy. (§2)
6. **Add an evidence-score legend** wherever a score appears. (§2)
7. **Build a crawlable "Start here" case-study index** and, when ready, a minimal read-only public API. (§3)

---

*Method note: findings drawn from reading the full white paper, browsing the live site (homepage, settling curve + overview, a cited claim page, search, retraction explorer, corrections), and inspecting the repository (`app/`, `AGENTS.md`, nav, metadata usage). Counts and render-mode claims verified against source.*
