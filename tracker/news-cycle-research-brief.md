# Research brief — the long-term news cycle: sources, landscape, allies

You are a research agent investigating how to build and position a
**dropped-story tracker**: a tool that follows news stories as falsifiable
open questions over months/years and flags the ones that went quiet while
still unresolved ("orphaned"). Use web search heavily. Two mandatory
checkpoints: (1) after your initial landscape scan, STOP and re-rank what
deserves deep dives before spending searches; (2) before writing the final
report, run an adversarial self-review — attack your own conclusions, check
what you failed to search for, revise. Write the finished report to
`tracker/news-cycle-research-report.md`.

## Context (ground truth — do not relitigate)

The engine is already designed and tested (see briefings/11-journalism-angle.md
and tracker/ in this repo): threads = falsifiable questions with explicit
resolution criteria; four statuses (OPEN / STALLED / RESOLVED / ORPHANED)
computed by deterministic code from LLM-extracted semantics; GDELT as the
coverage source; launch domain US immigration; indie scale (solo founder +
AI agents, near-zero budget); it ships as phase 2 of epistemic-receipts.vercel.app,
a reference database of how knowledge changes status over time.

Settled decisions you must NOT reopen: no scraping paywalled outlets; the
metric is attention-decay, never "omission/censorship"; the LLM never outputs
a status; not a mass-market consumer app; newsletter is a human-gated funnel,
never the paid product; the tool flags gaps, it does not do original
reporting.

What IS open — and what this research decides: which data sources beyond
GDELT, which existing players to learn from or ally with, and whether the
audience is reached by building or by partnering.

## Research questions

1. **Data sources for long-horizon tracking.** Assess, with current (2026)
   pricing, rate limits, terms, and known reliability issues: GDELT DOC 2.0
   (artList + timelinevol — the planned backbone; find documented gaps or
   bias critiques) and GDELT Events/GKG; Media Cloud (alive? API access
   today?); commercial news APIs (NewsAPI-class — usable under ToS for this?);
   and, critically, **domain ground-truth feeds that prove a story is "still
   developing" independent of coverage** — for US immigration specifically:
   CourtListener/RECAP docket alerts (litigation triggers), Federal Register
   and regulations.gov APIs (rulemaking), congress.gov API (bill status),
   EOIR/USCIS/CBP data releases, State Dept visa bulletins. Recommend the
   minimal stack: one coverage feed + one-or-two activity feeds per domain.
2. **Who already works the long cycle.** Map the landscape and what each
   proves about demand: slow journalism (Tortoise, Delayed Gratification);
   standing trackers (CFR Global Conflict Tracker, ICG CrisisWatch, Marshall
   Project & ProPublica tracking projects, election/litigation trackers like
   Law Dork or Vladeck's One First); "whatever happened to…" formats in
   podcasts/columns; Wikipedia current-events maintenance. Also the academic
   frame: the issue-attention cycle (Downs 1972) and any recent empirical
   work on news attention decay — note anything that could double as a
   citation for a cognitive-psych PhD angle on media attention.
3. **Immigration-niche newsletters & outlets** (the launch domain): find the
   ones that track policy/litigation status — e.g. Documented, Border/Lines,
   Migrant Insider, AILA member updates, law-firm client alerts. For each:
   audience size if findable, business model, and whether they'd plausibly
   be a PARTNER (running "powered-by" orphan data) rather than a competitor.
   Key strategic question: is the funnel better built as our own newsletter
   or as a data feature inside an existing one?
4. **Outreach targets in product-land.** Particle (AI news app — what do
   their story threads/follow-up features actually do in 2026? gaps?),
   Ground News, Otherweb, SmartNews; plus the postmortems (Artifact, Circa,
   Watchup) for what killed follow-up features before. For each live player:
   realistic indie posture — partner, data-licensing pitch, ignore, or learn.
   Draft the two-sentence outreach angle where one exists.
5. **Who pays for tracking today.** POLITICO Pro, Bloomberg Government,
   FiscalNote, LexisNexis/Westlaw alerting: what they cost, what they alert
   on, and confirm/refute the core thesis that they alert on ACTIVITY but
   never on SILENCE (the orphan gap). Then the down-market buyer: would
   immigration attorneys, advocacy nonprofits, or newsroom desks pay
   ~$49/month for orphan alerts — find any evidence of willingness to pay at
   that tier (existing sub prices for niche policy newsletters are a proxy).
6. **Newsletter mechanics for the funnel** (light): current best practice
   for a small automated-but-human-gated digest in 2026 — platform choice
   (Substack vs Buttondown vs Ghost for API-drafted content), realistic
   growth expectations for niche policy newsletters, and 2–3 examples of
   data-product newsletters that converted readers into tool users.

## Method requirements

- Cite every load-bearing claim with a URL; label inference as inference.
- Prefer 2025–2026 sources; the news-tools landscape moves fast.
- Adversarial pass: steelman "the orphan signal is noise" — find cases where
  quiet stories were quiet for good reason, and what that implies for
  thresholds.
- Deliverable: markdown report — executive summary (≤1 page), the
  recommended data stack, landscape map with partner-vs-competitor calls,
  ranked outreach list with angles, buyer evidence, funnel recommendation
  (own newsletter vs partner embed), and a top-8 action list with effort
  estimates for a solo founder. Write for a smart non-journalist.
