# Visual UI audit — findings (2026-07-16, live-site pass)

Method: rendered-pixel review of epistemic-receipts.vercel.app via browser at 1440×900 and 390×844. Templates covered: homepage, /settling-curve (explorer), /settling-curve/coverage, /reversals, /split-ledger, /open-questions, /analysis/ideology, /members + /members/[id], /stories/h-pylori, /feed, /search?q=pluto, /patterns (404), plus mobile passes on homepage, member, split-ledger. Format matches Brief #13's merge spec: `severity | route | finding | proposed fix | effort`. This file is the "visual pass" section the B13 findings doc reserves.

**Ops note (not a finding):** the audit ran against the vercel.app URL, which is publicly open **with the ⚗ Lab nav group visible** — i.e., this deployment is not running as the public edition and has no SITE_PASSWORD. If the runbook's flip already happened on a custom domain, fine; if not, this is the L2/L3 state showing.

---

## P0 — renders wrong or missing information

| Route | Finding | Proposed fix | Effort |
|---|---|---|---|
| /patterns | **404 in production** despite being in PUBLIC_ROUTES and reported built (B6-3). Any link to it (explorer, methodology, start-here) dead-ends. | Verify the page actually merged/deployed; if the route exists on main, diagnose the build; if not, land it or pull it from PUBLIC_ROUTES until it exists. | S–M |
| /members/[id] | **Chamber breakdown treats one chamber as two**: "House — 139 (28.5%)" and "House of Representatives — 348 (71.5%)" side by side. Raw Voteview chamber strings grouped without normalization. Reads as wrong data on every House member's page. | Normalize chamber labels at render (map both to "House"); recompute shares. | S |

## P1 — broken, misleading, or embarrassing

| Route | Finding | Proposed fix | Effort |
|---|---|---|---|
| /settling-curve | Cold load shows **9 empty skeleton cards for ~10s**, with a stray "LOADING TRAJECTORIES…" string also visible above the grid (two loading affordances). This is the homepage CTA's landing page. | Server-render the first grid (ISR) or cache the API; remove the stray loading text. | M |
| /search | Results take **~5–9s** on a cold query. | Profile the path (semantic leg cold-start vs tsvector); consider streaming tsvector results first. | M |
| /members/[id] | **Stat tiles don't reconcile visibly**: Yea 180 + Nay 279 = 459 vs Total 487; unity denominator 458. The missing ~28 (present/paired/announced) is unexplained — on a site whose brand is partitions-that-sum. | Add a fourth tile or footnote: "28 present/other," and a one-line unity-denominator note. | S |
| /feed | **"0 new claims since your last visit (7 days ago)"** — either every pipeline has been paused for a week or the counter query is broken. Verify which; if pipelines are paused, say so honestly in the empty state. | Verify query against DB; fix or re-copy. | S |
| /feed (OnThisDay) | **Non-English leak**: "LEGE nr. 127 din 16 iulie 1999" (Romanian). `lib/non-english-pipelines.ts` catalogs 8 tags; romania/hungary/czech/italy/chile/argentina legislation aren't in it. | Extend the catalog (or filter by a language field where present) and apply to every OnThisDay/feed surface. | S |
| / (homepage) vs /feed | **Two OnThisDay implementations disagree** for the same date, and the homepage variant surfaces only RECORDED academic-paper entries (low signal) while SETTLED items exist for the day. | One query module; ranking prefers non-RECORDED transitions and threshold events over recorded-paper noise. | S–M |
| / (carousel) | **Duplicate text per slide** (desktop + mobile): full claim text as card body, same text repeated as truncated grey caption under the mini curve. The old 6dfd1b7 fix has regressed or a second variant shipped. | Remove the caption duplication. | S |
| /settling-curve/coverage | **Raw pipeline tags on a public page**: `argentina_legislation_v1`, `openalex_journals_v1`, `czech_legislation_v1`, `ofac_sdn_v1`, `italy_legislation_v1`, `chile_legislation_v1`, `romania_legislation_v1`, `congress_bills_tracker_v1` in "Top sources by coverage" — the PUBLISH-CHECKLIST P0 rule is zero raw tags for anonymous visitors. Newer pipelines never got registry display names. | Add the ~8 missing entries to the pipeline registry/label map used by this page (and grep other surfaces using the same lookup). | S |
| any bad URL | **Default unstyled Next 404** — white page, no site chrome, no way back. Jarring against an all-dark site. | Custom `not-found.tsx`: dark, branded, links to /start-here and search. | S |

## P2 — polish

| Route | Finding | Proposed fix | Effort |
|---|---|---|---|
| /members, /members/[id] | "PELOSI, Nancy" raw Voteview name order everywhere. | Render-transform to "Nancy Pelosi" (data untouched). | S |
| /members | Page is empty until a query is typed — no default content. | Default browse: landmark-vote members or recent-Congress leaders. | S–M |
| /split-ledger | Tier-1 cards lead with raw FDA label boilerplate ("acetazolamide (ACETAZOLAMIDE): INDICATIONS AND USAGE For adjunctive…"). | Presentation split: drug name as card title, label excerpt as body (render-side only). | S–M |
| /settling-curve/coverage | Residue entries' MATERIAL-LOG date references are near-invisible (contrast); mixed compact/exact tile formats (1.1M vs 80). | Bump the provenance text one contrast step; codify compact-above-10k rule. | S |
| explorer/search/carousel cards | Mini-curve x-axis year labels ~6px, illegible. | Min 9–10px or drop to start/end years only. | S |
| /analysis/ideology | "Update" submit button instead of auto-apply on select; tiny low-contrast axis labels ("-1 Liberal / +1 Conservative"). | Auto-update on change; bump axis label size/contrast. | S |
| /open-questions | Right-edge CONTESTED badges very low contrast; some claim text leads with "Abstract " (OpenAlex artifact). | Badge contrast bump; strip leading "Abstract" in `cleanDisplayText` (render-side). | S |
| /reversals | FieldGuideBanner CTA reads "see the trajectory →" with no named target. | Name it: "see the trajectory: Roe → Dobbs →". | S |
| /stories/* | Dek + body copy sit at a dim grey that tires over long reads. | One step up on body-copy contrast for story template. | S |
| / (carousel) | 13 near-invisible pagination dots (tiny tap targets on mobile); confirm pause-on-hover and prefers-reduced-motion (code-side check in B13-5). | Fewer slides surfaced or a "3/13" counter; honor reduced-motion. | S |
| / | "COMING — V2" teaser card — promise-adjacent copy on a promise-free site; deliberate? | Owner call: keep, or reframe as "In the lab." | S |
| / | Discovery-card rail clips 4th card at viewport edge with no scroll affordance. | Edge-fade + partial-peek or arrows. | S |
| / (mobile) | Page opens on "Featured trajectories" — Fig-1 survival hero apparently absent on mobile. Confirm intended (§3.4 of the homepage plan implies a mobile-first curve, not none). | Verify intent; if hidden, consider compact Fig-1. | S–M |

## What's working (don't regress in the fix pass)

Denominator discipline on every new surface (450/450 scores, 447/458 aligned, Fig-1's "5,557 dated trajectories"); the Known Residues ledger live and linked to /corrections; split-ledger's three-line honesty box and tier framing; ideology page sourcing + dim explanations; search leading with settling-curve hits; member vote rows with TIED/PASSED/FAILED badges and real tallies; story two-arc layout with citation-bearing receipt cards; mobile layouts (member, split-ledger, home) all coherent. The site reads like one system — the findings above are edges, not structure.

## Merge note for B13

Items here marked render-side (chamber normalization, name order, label-boilerplate split, "Abstract" strip) are presentation fixes and stay inside B13's hard rule — the underlying data is never edited. The /patterns 404 and feed-counter items need code/deploy investigation before any fix. Suggested Brief #14 batching: (1) the two P0s + 404 page, (2) perf pair (explorer + search), (3) OnThisDay unification + non-English catalog, (4) the P2 sweep.
