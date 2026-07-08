# 11 — Journalism angle: dropped-story tracker

Handoff briefing for Fable 5. You know the codebase; you were not in the conversation. Dense on purpose.

---

## 1. CONTEXT

The user started from an observation: the news cycle is present-biased to the point of amnesia — a story breaks, saturates for days, then disappears while the underlying situation keeps developing and no one follows up. The initial question was "are there apps that follow up on news stories?" It narrowed fast to a concrete want: track a topic (their example: immigration) across specific outlets and see *how stories evolve and what their current status is* — not another feed. From there it moved through build-vs-buy, then product design, then business viability, then concrete deliverables.

The through-line is a **status board for news threads — the inverse of a feed** — whose signature capability is detecting **orphaned** stories: still unresolved, but coverage has died. The "journalism angle" in this briefing's title is the crux we landed on: the product cannot do original reporting (it is strictly downstream of journalists' work), so its role is *infrastructure for people who track threads* (analysts, advocates, reporters), plus an optional newsletter that resurfaces dropped stories as a funnel. We surveyed the field (Ground News, Particle, slow-journalism outlets like Delayed Gratification/Tortoise, GDELT, Media Cloud, CFR Global Conflict Tracker, ICG CrisisWatch, Project Censored) and confirmed the gap: everything answers "what's new / what happened"; nothing ships a *general-purpose, automated* "what stopped happening / what's neglected" board. We then built the engine for it. This briefing hands off that engine plus the plan to surface it in the product.

## 2. DECISIONS

- **Build the tracker tool, not a summary product or a paid newsletter.** Summarizing is commodity (Ground News is AI overviews now); the defensible capability is persistent tracking + orphan detection, which requires state and time-comparison, not a prompt anyone can run.
- **The unit is a "thread" = one falsifiable question with finality-worded resolution criteria.** Vague topics yield vague statuses; a question with explicit resolve-yes/resolve-no/moot criteria is what makes status computable and auditable.
- **Storylines are trees; resolution can branch into successor questions.** A question can genuinely resolve while the story continues (e.g. a rule takes effect → "will it survive its court challenge?"); a flat card would either close prematurely or never close.
- **Four statuses — OPEN / STALLED / RESOLVED / ORPHANED — and ORPHANED is the product.** Everything else exists to make the orphan label trustworthy; the orphan alert ("still live, nobody's covering it") is the one thing no competitor ships.
- **Architectural split: the LLM does only semantic judgment; deterministic code computes status.** A holistic LLM status call is unauditable and cries wolf; the split keeps the logic debuggable and the guardrails enforceable. This is the single most important invariant — do not collapse it.
- **Cry-wolf guardrails baked in.** A known pending trigger (date optional) short-circuits ORPHANED; ORPHANED requires positive evidence; the cautious default is STALLED; only *merits* events resolve, and only at finality; coverage volume never equals materiality. These came from a real TPS example that a naive rule marks "abandoned" when it is actually in active appellate litigation — a false "nobody's covering this" is the product's worst possible error.
- **Data source is GDELT, plus an activity feed, plus a bias dataset.** GDELT is free, global, 15-minute cadence, back to 1979, and separates coded events from coverage; it removes any need to crawl news sites. A separate activity feed (GDELT Events/GKG, or ACLED/CrisisWatch) supplies the "still live" signal; a media-bias dataset supplies Ground-News-style left/right coloring.
- **The metric is a "dropped-story score" = coverage-decay × still-live activity — never an "omission score."** "Omission" presupposes a ground truth for reality you can't obtain, and using coverage as that baseline is circular; attention-decay is measurable and defensible, and a "the media is hiding X" number is unprovable, harmful, and conspiracy-adjacent.
- **Business shape: the tool is the moat (paid); a small auto-drafted newsletter is the funnel (free, human-glanced, never auto-sent, never the paid product).** Paid automated summarizing competes with every bot; the newsletter's only job is to demonstrate the orphan detection and pull users to the tool.
- **Positioning: go embarrassingly narrow — one domain (recommend US immigration), one professional buyer type.** The mass-market news-consumer app is a graveyard (Circa, Breaking News, Watchup, Artifact all folded) because follow-up gets none of breaking news' traffic; the viable buyers are people who can't afford to lose threads and already pay (POLITICO Pro averages ~$36k–$85k/yr with ~90% renewal). Realistic ceiling is an indie business / strong side income, not a venture outcome.

## 3. THE PROPOSAL

Add a **thread-tracker section** to the site, backed by the two engine modules already produced (`dropped_story_classifier.py`, `newsletter_generator.py` — integrate them; do not rebuild the classifier). Ship one domain (immigration) end to end.

**Pages / views.**
- **Board (core view).** A grid of tracked threads as cards. Each card shows: the question (as title); a status badge with color (🟢 OPEN, 🔴 STALLED, ⚪ RESOLVED, 🟠 ORPHANED); last-material date; dropped-story score; a one-line "where it stands"; and the bias spread of recent coverage. Filter by status and domain; sort by dropped-story score (surfacing orphans first). Non-technical users must be able to glance at this and immediately see which threads are orphaned.
- **Thread detail.** Question + resolution criteria; the full material-event timeline (date + what-moved, each typed merits/procedural/substantive); current status + the human-readable `reason` string from the classifier; pending trigger if any; successor threads if any; and a coverage-vs-activity chart (the two curves whose divergence is the score).
- **Thread creation form.** Fields: `question`; `resolution_criteria` (resolved_yes / resolved_no / moot); domain/tags; `known_pending_trigger` (exists / description / date); `importance` (0–1). MVP is human-authored — this is the 80%-of-quality lever; add LLM-assisted proposal later.
- **Orphan alerts / digest.** Threads that transitioned into ORPHANED, framed as "still unresolved, nobody followed up," feeding an email/notification. This is the feature that delivers the core value; make it prominent.
- **Newsletter draft (funnel, optional).** The auto-drafted "Still Developing" issue plus its fact-check checklist, gated behind a human "approve & send." Never auto-send.

**Features.**
- Per-thread scheduled poll: fetch GDELT articles (`artList`) + the coverage timeline (`timelinevol`), run the classifier, and append a **status_history** row every poll — status is recomputed each time and never sticky (an orphaned thread that gets new coverage must flip back to OPEN; a resolved-then-appealed one must reopen).
- Dropped-story score = coverage-decay (from `timelinevol`, indexed to each thread's own peak) × still-live activity (from the activity feed).
- Orphan alerting: fire once on entry to ORPHANED; clear on return of material/coverage.
- Newsletter auto-draft via `newsletter_generator.draft_issue`, human-glance gated.

**Copy (already written; reuse).** Landing/hero line: "The fight didn't end. The coverage did." The four status definitions; the incumbent-pricing contrast ("POLITICO Pro averages $36k–$85k a year; we start at [$X]"); transparent pricing tiers (placeholders: ~$49/mo solo, ~$399/mo team). Newsletter house style: "STILL DEVELOPING" masthead + one-line standfirst + lead essay (what everyone remembers → what quietly happened since → the honest attention-cycle point) + status board + reply/subscribe sign-off. These live in the two content files in outputs; lift verbatim.

**Data requirements.**
- GDELT DOC 2.0: `mode=timelinevol` (coverage curve, JSON) and `mode=artList` (articles → `{id, date, outlet, title, snippet}`). `fetch_gdelt_articles()` already implements the latter.
- Activity feed: GDELT Events/GKG, or ACLED / ICG CrisisWatch — the "still live" signal, needed *independent* of whether anyone is covering it.
- Media-bias dataset: AllSides / Media-Bias-Fact-Check-style outlet→lean map, joined on domain.
- Anthropic API (LLM extraction; classifier defaults to `claude-sonnet-4-6`, bump to an Opus model for hard threads). Requires `ANTHROPIC_API_KEY` with billing.
- Store: `threads` (id, question, resolution_criteria, known_pending_trigger, importance, storyline_id, parent_thread_id, timestamps), `events`, `status_history`, `key_facts`.

**Engine interfaces (build against these; they are tested).**
- `dropped_story_classifier.py`: `SYSTEM_PROMPT` (LLM extraction → strict JSON: `events[]` with `event_type∈{merits,procedural,substantive,noise}` + `is_material`; `resolution.outcome∈{yes,no,moot,not_yet}`; `pending_trigger{exists,description,date?}`; `last_material_date`; `last_coverage_date`; `notes_for_humans`). `compute_status(llm_output, as_of_date) → {status, reason}` is the deterministic state machine (thresholds ACTIVE=14d, SILENCE=21d, ORPHAN=42d; rule order: RESOLVED if outcome∈{yes,no,moot} → OPEN if material≤14d → **STALLED if pending_trigger.exists** (the guardrail) → STALLED if coverage≤21d → ORPHANED if material≥42d and coverage>21d → else STALLED). `classify_thread(thread, articles, client) → {status, reason, evidence}`. `LABELED_EXAMPLES` are four immigration threads (F-1 SEVIS→RESOLVED, H-1B $100k fee→STALLED, green-card re-exam→ORPHANED, protected-status→STALLED) that double as few-shot guidance and a regression suite; **wire `eval_examples()` into CI — all four must pass on every change.**
- `newsletter_generator.py`: `select_issue_content(threads, as_of_date) → {lead, status_board}` (deterministic; orphan leads); `draft_issue(...) → {markdown, fact_check, selected}` (LLM writes from provided facts only, unsupported claims become `[VERIFY]` markers); `fact_check_list(selected) → [str]` (the human-glance checklist); `NEWSLETTER_SYSTEM` carries the house style + anti-fabrication rules.

## 4. OPEN QUESTIONS

1. Which launch domain ships first? (Recommended: US immigration — every existing test thread is already there.)
2. Which activity feed backs the "still live" signal for that domain — GDELT Events/GKG, ACLED, or CrisisWatch — and how should it be reconciled against coverage to define "still developing" independent of coverage? (This is the unsolved core; see §5's note that it's currently under-built.)
3. How are threads individuated — where does one question end and the next begin, and when should threads merge or branch into the storyline tree? Manual only for MVP, or LLM-assisted from the start?
4. Keep the default thresholds (ACTIVE 14d / SILENCE 21d / ORPHAN 42d) or tune per domain? (Litigation is slow; breaking news is fast.)
5. Confirm pricing numbers (landing copy has placeholders: ~$49/mo solo, ~$399/mo team).
6. Run the newsletter funnel at all, or ship tool-only first?
7. Where does it host, at what poll frequency? (API cost ≈ #threads × frequency.)
8. Confirm scope is an indie build, not venture-scale, so the agent doesn't over-engineer for a market that isn't there.

## 5. DO NOT REDO

- **Do not build an "AI summarizes the news" product or a paid auto-newsletter.** Commodity; competes with Ground News's overviews. Structurally, a summary of today's feed can never surface a story that dropped *out* of today's feed — the whole point requires memory, which a summary lacks.
- **Do not scrape NYT/WSJ or build a crawler.** NYT's API is metadata-only and non-commercial; WSJ has no free API; scraping violates ToS, breaks constantly, and is legally exposed. GDELT replaces all of it.
- **Do not frame the metric as "omission," "censorship," or "what they're hiding."** It presupposes an unobtainable ground truth, is circular (coverage as reality), unprovable, and harmful. It is attention-decay — the "dropped-story score."
- **Do not let the LLM output a holistic status.** Unauditable and cries wolf on active-litigation threads. Keep the semantics-vs-mechanism split; the state machine stays deterministic code.
- **Do not make ORPHANED a default.** It requires positive evidence (open question + no pending trigger + material silence past 42d + coverage itself gone quiet). Uncertainty resolves to STALLED.
- **Do not treat procedural events (stays, hearings, motions) or coverage volume as resolution or materiality.** Only merits events resolve, and only at finality; a merits ruling that is appealable — or that conflicts with another — is `not_yet`, not resolved (this is why the H-1B fee example is STALLED despite two merits rulings).
- **Do not target the mass-market news consumer.** Graveyard (Circa, Breaking News, Watchup, Artifact). Go narrow: one domain, one professional buyer.
- **Do not scope to "the whole world."** It collapses back into a feed. Scope to one domain / watchlist.
- **Do not auto-send the newsletter untouched.** AI drafts → human ~10-minute glance against the fact-check checklist → send. A confidently wrong "nobody's covering this" under the brand is the one unrecoverable error.
- **Do not try to have the tool do original reporting or "fill" an orphan.** It flags the gap; a human fills it. The product is infrastructure downstream of journalism, not a newsroom — this is the journalism-angle boundary, and pretending otherwise is the trap.
- **Do not expect a data moat.** GDELT + this method is replicable; the edge is execution and owning one niche's attention, not proprietary data.

---

*Accompanying files in outputs: `dropped_story_classifier.py` (engine + tested guardrails), `newsletter_generator.py` (funnel), `AGENT_HANDOFF.md` (phased build plan + acceptance criteria), `START_HERE.md` (orientation), plus content samples `still_developing_issue_01.md` and `dropped_story_tracker_landing.md`.*
