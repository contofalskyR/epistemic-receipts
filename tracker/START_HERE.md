# START HERE — what this project is
### Orientation for a Claude agent picking this up cold

You've been handed a small, mostly-complete package for a product: some working code, a build brief, and content samples. **This note is the orientation** — the *what and why*, so everything else makes sense and so you can exercise good judgment where the brief runs out. Read this first (~60 seconds), then `AGENT_HANDOFF.md` for the build plan, then the code.

---

## What it is, in one line

A tool that tracks ongoing news stories as **open questions** and flags the ones that went **quiet while still unresolved** — the stories the news cycle forgot.

## Where it came from (the insight that matters)

The news cycle is amnesiac. A story breaks, dominates for a week, then vanishes — even as the underlying situation keeps developing and nobody follows up. Working example: after the U.S. captured Venezuela's president in January 2026, mainstream coverage collapsed while the most consequential phase — who controls the country's oil revenue — unfolded in near-silence.

Every existing product answers **"what happened today?"** This one answers **"what *stopped* happening?"** That inversion is the whole reason it exists — and it's why an "AI-summarizes-the-news" bot can't replace it: a summary of today's feed can never surface a story that *isn't in* today's feed. Finding a dropped story requires **memory of what was live before** plus a measurement of then-vs-now coverage. Persistent state, not a prompt.

## The core model (learn this)

- A **thread** = one falsifiable question with explicit, finality-worded resolution criteria (e.g. *"Will the $100k H-1B fee be struck down with appeals exhausted?"*).
- Each thread has a **status**: **OPEN** (moving now) · **STALLED** (quiet, but waiting on a known next step) · **RESOLVED** (settled) · **ORPHANED** (still unresolved, coverage died, no pending trigger).
- **ORPHANED is the entire point.** Everything else exists to make that one label trustworthy.

## The architectural principle you must NOT break

The **LLM does only semantic judgment** — label each article, decide if it's material, decide if the question is resolved *at finality*, detect any pending trigger. **Deterministic code computes the status.** Never let the model output a status holistically: it becomes unauditable and it "cries wolf" (flags stories that are quietly in active litigation as orphaned). This split is what makes the tool trustworthy, and it is already built and tested — keep it.

## The business shape (so you don't over-build the wrong half)

The **tool is the moat; a small auto-drafted newsletter is the funnel** — a free lead magnet, never the paid product. The summarizing is commodity (Ground News, a hundred bots); don't sell it. Sell the *tracking*, the *alerts*, and the *board*.

## The hard-won DON'Ts (each cost real thought — don't relearn them)

- **Don't scrape NYT/WSJ or build a crawler.** Use GDELT (free, global coverage data). Paywalls + terms-of-service make scraping a legal and maintenance dead end.
- **Don't frame the metric as "omission" or "what they're hiding."** It's attention-decay: *"coverage faded while the situation kept developing."* The honest version is also the only defensible one — a tool that asserts concealment is both unprovable and harmful.
- **Don't make ORPHANED a default.** It requires positive evidence.
- **Don't send the newsletter untouched.** AI drafts → human glances ~10 min → send. A confidently wrong "nobody's covering this" under the brand destroys the credibility the whole thing runs on.

## What's already built and tested

1. **`dropped_story_classifier.py`** — the engine: the LLM prompt + the deterministic state machine + four hand-labeled immigration threads that double as a *passing regression suite*. This is the hard part, and it works. **Do not rebuild it.**
2. **`newsletter_generator.py`** — the funnel: picks the issue (an orphan leads), drafts it from provided facts only, and emits a fact-check checklist.
3. **`AGENT_HANDOFF.md`** — the build brief: phased plan, acceptance criteria, and the full DON'T list.

*(Also in the folder: a sample newsletter issue and landing-page copy. Those are content examples, not needed to build.)*

## Honest limits (so you're calibrated)

- It can **flag** an orphan but often can't **fill** it — if nobody's reporting, there's nothing to summarize. You surface the gap; a human closes it.
- The method (GDELT + this logic) **isn't proprietary**, so the edge is execution and owning one niche, not a data moat.
- Realistic ceiling: an indie tool / modest business for a specific audience (journalists, policy / advocacy / risk analysts) — **not a mass-market app.**

## Your first move

Read `AGENT_HANDOFF.md`. Then run `python dropped_story_classifier.py` and confirm four `PASS`. Build outward from there. The thinking is done — keep the guardrails intact, and ship one domain well.
