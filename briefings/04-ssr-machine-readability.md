# Briefing 04 — Make the Receipts Machine-Readable (SSR + metadata + sitemap)

## Why this is the priority

From `AUDIT-WHITEPAPER-GAP-2026-07-03.md` (read it in full first — this briefing implements its §1): the white paper's endgame is *infrastructure other systems query*, but a server-side fetch of a claim page returns only "Pulling the receipt…". 44 of 93 page routes are `"use client"`; only 2 pages implement `generateMetadata`; there is no sitemap; robots.txt disallows `/api/` and lists no Sitemap directive; every social share renders one generic site-wide card. Meanwhile the corpus now has ~350k multi-step settling curves (waves 1–2 + retraction curves + openalex promoter output) that no crawler, search engine, or LLM can see.

## Ground rules before coding

- **Next.js version warning (AGENTS.md):** this repo runs Next ^16.2.6 — APIs and conventions may differ from training data. Read the relevant guides in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
- **Security model (AGENTS.md):** all of this is public GET. Do not add write endpoints, do not weaken middleware, headers, or the robots `/api/` disallow. `generateMetadata`/server components fetch via Prisma directly, not via `/api/`.
- **DB load:** claim pages number ~1.76M. Everything server-rendered must be cached/ISR'd — pick revalidation windows deliberately (receipts change when transitions land; daily revalidate is fine, on-demand revalidation from ingest scripts is a stretch goal, not required).

## Tasks (audit's recommended order)

### 1. Server-render the claim page ("the receipt is the product")

Convert `/claims/[id]` so the first response contains the actual receipt: claim text, current axis, the settling curve (transitions with dates, communities, reasons), sources. Client interactivity can stay in child client components — the goal is meaningful HTML + metadata, not a full de-clientization. Add `generateMetadata`: title = claim text (truncated sensibly), description = current status + latest transition, OpenGraph + Twitter card. An OG image route already exists for trajectories (`app/api/og/trajectory/route.tsx`) — reuse the pattern for claims or parameterize it.

### 2. Server-render the trajectory/settling-curve pages

Same treatment for `/settling-curve` detail views and any trajectory permalink page. `/settling-curve` and `/statistics/explorer/[slug]` already implement `generateMetadata` — match their conventions.

### 3. Sitemap

`app/sitemap.ts` with a sitemap **index**: 50k URLs per file is the protocol cap. Prioritize: curated trajectories, case studies, topics, sources, then claim pages in chunks (consider starting with multi-step claims only — ~350k, the pages worth crawling — before deciding whether all 1.76M belong in the sitemap at all; document the choice). Add the `Sitemap:` directive to robots.txt. Verify `/sitemap.xml` serves the index and a sample chunk.

### 4. Share cards that carry the claim

With per-page `generateMetadata` + OG images, the Share buttons on claim pages stop producing the generic site card. Verify with an OG debugger (opengraph.xyz or the X/LinkedIn validators) against a deployed preview.

### 5. Structured data (stretch, cheap)

JSON-LD `ClaimReview`-adjacent markup on claim pages (or `ScholarlyArticle` for openalex claims). Don't force a vocabulary that doesn't fit — a `Dataset`/`CreativeWork` with dated status assertions is honest; fake `ClaimReview` ratings are not.

### 6. Crawlable "Start here" index (audit §3)

A server-rendered case-study index page listing the ~12 fully-built case studies (Korematsu, semaglutide, tobacco, Pluto, lab leak…), linked from the homepage. This is the entry point crawlers and humans both lack.

## Constraints

- Do not regress the client UX — the interactive curve visualization stays client-side; it hydrates on top of server HTML.
- Metadata must never leak admin/review surfaces; `/admin`, `/review` stay out of the sitemap and keep noindex behavior.
- Build must pass `prisma generate && next build` (Vercel path) — watch serverless bundle size when importing Prisma into many pages; use shared data helpers.

## Verification

- `curl -s https://<preview>/claims/<id> | grep -c '<claim text fragment>'` ≥ 1 — the receipt is in the HTML.
- `curl -s .../sitemap.xml` returns the index; a chunk validates (xmllint).
- Lighthouse SEO pass on claim + trajectory pages.
- OG validator shows per-claim cards.
- Page p95 latency on a cold claim page is acceptable (<1s server time with caching warm; measure, record numbers in the PR).
