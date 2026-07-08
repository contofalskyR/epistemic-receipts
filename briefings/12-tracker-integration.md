# Briefing 12 — Dropped-story tracker: integration verdict + phase-2 build plan

*Written 2026-07-08 by the Fable 5 Cowork session that closed briefings 10's
threads, after reviewing the tracker handoff (briefings/11-journalism-angle.md
+ tracker/). Audience: the future Fable 5 session that BUILDS this. The main
agent on claude.ai cannot build — this is builder-to-builder. Robert approved
the adopt-as-phase-2 verdict below on 2026-07-08.*

## Verdict (accepted by Robert)

ADOPT, as the engine of phase two — built AFTER the reference-site launch
executes on the existing plan (marketing/launch-research-report.md). Do not
insert before launch: it is a second product (live monitoring, polls,
recurring LLM spend, proposed paid tier) and its worst error — a confidently
wrong "nobody's covering this" — would detonate on the site's core asset,
credibility. Sequencing: launch → weeks 3–6 post-launch build MVP admin-gated
→ 2–4 week SHADOW RUN on real GDELT pulls → only then public.

Why adopt at all: the two projects share a soul. A thread (falsifiable
question + resolution criteria + computed status over time) is a settling
curve pointed at the present. Their prime invariant — LLM does ONLY semantic
judgment, deterministic code computes status — is the house promoter/contract
split. "ORPHANED requires positive evidence; uncertainty resolves to STALLED"
is the refusal-ledger discipline. Strategically it supplies the recurring
pull the launch research said the site lacks: a board that changes daily,
orphan alerts, and the "Still Developing" digest. Combined site story:
**"we track how knowledge settles — including the questions the news dropped
before they settled."** Reversals = what stopped being true; orphans = what
stopped being watched. One digest can carry both.

## THE NON-NEGOTIABLE BOUNDARY (do not relitigate)

Threads get their OWN tables — Thread / ThreadEvent / ThreadStatusHistory
(their spec already says this). Thread statuses NEVER become
ClaimStatusHistory rows. The transition contract requires every row to carry
a dated marker document; ORPHANED and STALLED are computed from ABSENCE — no
document says "orphaned." Forcing them into the corpus corrupts the
contract's soul, exactly like fabricating a date.

The one sanctioned join: when a thread RESOLVES via a merits event, that IS a
real dated documented transition — graduate it into the corpus through
emitTransition (marker = the ruling/enactment article), claim minted or
matched at that moment. Tracker beside the corpus; resolutions minted into
it. Both systems keep their invariants.

## Build plan (post-launch, in order)

1. **Schema** (~1 session): additive migration for Thread (question,
   resolution_criteria json, known_pending_trigger json, importance, domain,
   storyline/parent ids), ThreadEvent, ThreadStatusHistory (status, reason,
   computed_at, llm_evidence json), KeyFact. Same lockstep rule as the seq
   migration (schema + hand-authored SQL in one commit; drift gate passes
   untouched).
2. **Port the engine** (~1 session): move
   tracker/dropped_story_classifier.ts logic into lib/thread-classifier.ts.
   The SYSTEM_PROMPT and computeStatus must survive VERBATIM — the guardrails
   live there. Fill the two TODOs: (a) Anthropic call — server-side client,
   ANTHROPIC_API_KEY to .env.local + loop machine env, model per their
   default (claude-sonnet-4-6; bump for hard threads); (b) GDELT DOC 2.0
   fetch (artList + timelinevol). Wire evalExamples() into CI next to the
   existing checks — all four cases must pass on every change, forever.
3. **Polling loop** (~half session): loop machine, launchd, house pattern
   (loop #8). NOT Vercel functions (timeout + cost). Each poll: fetch →
   classify → computeStatus → append ThreadStatusHistory. Status is
   recomputed every poll, never sticky. Telegram ping on ORPHANED entry
   (fires once; clears on coverage return).
4. **UI** (~2–3 sessions): /threads board (cards: question, status badge,
   last-material date, one-line where-it-stands; orphans sort first),
   /threads/[id] detail (criteria, material-event timeline, status + reason
   string, pending trigger, successor threads, coverage-vs-activity chart
   later), thread CREATION admin-gated (middleware ADMIN_PATHS) — threads are
   hand-authored for MVP, that's the quality lever per their briefing.
   Distinct visual vocabulary from FactStatus badges — two status systems on
   one site must not be conflatable. Frame the section as "Open Questions."
5. **Shadow run** (2–4 weeks, no build): 15–20 hand-authored US-immigration
   threads (their four labeled examples seed it). Robert eyeballs weekly.
   Gate to public: zero false ORPHANEDs observed. The four CI tests verify
   the state machine, NOT extraction quality — only the shadow run verifies
   that.
6. **Public + digest** (after gate): board public; "Still Developing"
   newsletter via tracker/newsletter_generator.py logic, merged with the
   reversals digest. HARD RULE, permanent: human reviews every issue against
   the fact-check checklist before send. Never auto-send.
7. **Deferred**: dropped-story score (their briefing flags the still-live
   activity signal as the unsolved core — MVP ships statuses without the
   score; the orphan rule needs only dates), pricing/paid tier (Robert's
   call, later), LLM-assisted thread authoring.

## Open questions from briefing 11 — answered where decidable

- Launch domain: **US immigration** (their rec; test threads exist). ✔
- Newsletter: **merge with reversals digest**, human-gated. ✔
- Thresholds: keep defaults (14/21/42d) for MVP; revisit per-domain after the
  shadow run produces data. ✔
- Activity feed for still-live signal: OPEN — decide during step 7, not MVP.
- Pricing: OPEN — Robert's call, post-shadow.
- Thread individuation/branching: manual for MVP. ✔
- Hosting/poll frequency: loop machine, daily per thread to start (cost ≈
  threads × 1 Sonnet call/day — trivial at 20 threads). ✔

## Respect their DO-NOT-REDO list

briefings/11-journalism-angle.md §5 stands in full (no scraping, no omission
framing, no LLM-decided status, no mass-market scope, no auto-send, no
original-reporting pretension). Read it before building. tracker/START_HERE.md
is the 60-second orientation; tracker/*.py are reference implementations;
the two sample .md files are voice/tone references for the digest and landing
copy — lift, don't rewrite.
