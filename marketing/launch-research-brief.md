# Launch-research brief — Epistemic Receipts

You are a launch-strategy research agent. Your job: figure out who would use
this product, where they live, how to reach them, and in what order — with
evidence, not vibes. You have web search; use it heavily. Two mandatory
checkpoints: (1) after your initial landscape scan, STOP and explicitly
re-rank which audiences and channels deserve deep dives before spending
searches on them; (2) before writing the final report, run an adversarial
self-review — attack your own ranking, check what you failed to search for,
and revise. Write the finished report to `marketing/launch-research-report.md`.

## The product (context — take as ground truth, verified 2026-07-08)

**Epistemic Receipts** (epistemic-receipts.vercel.app) is a public,
free-to-read reference database of how knowledge changes. Core object: the
**settling curve** — a claim's dated, sourced trajectory across epistemic
status (RECORDED → SETTLED → CONTESTED → REVERSED…), where every transition
cites a primary document ("the receipt").

Scale: 1,757,761 claims from 185 sources across 8 categories (US federal
records incl. NARA's declassified catalog and congressional roll-calls to
1789; science & medicine incl. 318k OpenAlex papers and 26.6k retractions;
86 national statute registries; courts; pharma; archives; international
orgs). 1,571,180 claims carry settling curves (1.8M transition rows). The
remaining 186,581 form a public "refusal ledger" — claims whose dates exist
in no retrievable source get no curve rather than an invented one; the two
numbers sum to the corpus exactly. Distinctive assets: reversal arcs (Roe→
Dobbs, Chevron→Loper Bright, 442 repealed New Zealand statutes, 75 retracted
exoplanets); "Suppression & Amplification" records (documented actions on
evidence — the tobacco industry's "doubt is our product" memo, the withheld
brief in Korematsu); a public corrections page that documents the project's
OWN data failures (a fabricated-patent pipeline, retired and written up); a
working flag-a-receipt form; CSV/BibTeX/RIS exports; a public API and an
**MCP server** (AI assistants can query claim status with receipts).

Honest weaknesses (do not soften these): only 5,596 claims are hand-curated
into rich narratives — the rest is bulk reference scaffolding; the founder is
solo (non-developer, works via AI agents), no budget beyond API costs, no
existing audience, currently on a vercel.app subdomain, and the daily-user
question is genuinely unanswered. There is a whitepaper draft and two Substack
drafts. Assume no video-production capability unless a channel's ROI justifies
learning it (flag this as an assumption to validate).

## Research questions (in order)

1. **Audiences.** For each candidate segment, find evidence of real demand:
   what they currently use, where they congregate (specific subreddits,
   Discords, listservs, newsletters, conferences), and what would make them
   adopt or reject this. Segments to evaluate and RANK: data journalists &
   fact-checkers; meta-science / scientometrics researchers; law librarians &
   legal-tech; educators (epistemology, media literacy, history of science);
   OSINT / verification community; AI & LLM builders needing grounded
   knowledge-status data (note the MCP server); Wikipedia/Wikidata editors;
   the rationalist/skeptic essay-reading public. Add segments I've missed.
2. **Comparables.** How did analogous reference projects get their first
   1,000 users and survive: Our World in Data, Retraction Watch,
   CourtListener/Free Law Project, OpenAlex, Wikidata, Connected Papers,
   Metaculus, Ground News, Elicit. What monetization/sustainability actually
   worked for them (grants — Sloan, Knight, Mellon, NSF; API tiers;
   institutional subscriptions; donations)? Equally important: find 2–3
   comparable projects that FAILED or stalled and why.
3. **Channels.** For a solo founder, assess concretely, with recent (2025–26)
   examples of reference/data projects that launched well or badly on each:
   Show HN (current norms, title patterns, timing, what makes data-project
   launches land); Substack (essay-led launch; which existing newsletters
   cover epistemics/meta-science and accept guest posts or would plausibly
   link); YouTube (does the video-essay ecosystem — channels covering "how we
   know what we know" — offer collaboration potential that beats making
   videos oneself?); X/Bluesky academic communities; Reddit (which subs, what
   norms); Product Hunt (fit for a non-SaaS reference site?); academic routes
   (preprint venues for the whitepaper, metascience conferences); librarian
   and journalist tool directories (GIJN, journalist toolboxes, ACRL);
   AI-facing distribution (MCP server registries/directories, awesome-lists).
4. **Positioning.** Test framings against what each audience responds to:
   "the settling curve" (own vocabulary), "receipts for facts," "Wikipedia
   for how knowledge changes," "an epistemic provenance layer for AI."
   Recommend a one-liner per top audience and one master one-liner.
5. **Launch sequence.** A concrete 30/60/90-day plan for one person + AI
   agents: pre-launch hygiene worth doing (custom domain? analytics choice?
   uptime expectations?), the ordered channel sequence, effort estimates,
   success metrics per step, and explicit kill/pivot signals if a channel
   underperforms.
6. **Sustainability (light).** Which 2–3 funding paths fit this project's
   shape and stage, with named programs and their actual requirements and
   deadlines where findable.

## Method requirements (non-negotiable — match the product's own ethos)

- Cite every load-bearing claim with a URL. Distinguish *found evidence* from
  *your inference* — label inferences as such.
- Adversarial pass before concluding: steelman "nobody will use this" —
  who rejected comparable tools and why; what the graveyard of dead
  fact-checking/knowledge-graph projects teaches.
- No flattery. If a channel is a bad fit, say so and save the founder the
  weeks.
- Deliverable: a single markdown report — executive summary (≤1 page), ranked
  audiences with evidence, channel-by-channel verdicts, positioning
  recommendation, the 30/60/90 plan, funding paths, and a top-10 prioritized
  action list with effort estimates. Write it for a smart non-marketer.
