# T2 — Engine port + CI guard

**Size:** ~1 session. **Depends on:** T1. **Blocks:** T3, T5.

## Objective

Move the tested classifier core into the codebase and make its four labeled
examples a permanent CI gate. The hard part is already built — this session
is wiring, not design.

## Steps

1. **Port** `tracker/dropped_story_classifier.ts` → `lib/thread-classifier.ts`.
   `SYSTEM_PROMPT`, `computeStatus`, the thresholds, the types, and
   `LABELED_EXAMPLES`/`evalExamples` move VERBATIM (reformat imports/exports
   to house conventions only). Leave the original file in tracker/ untouched
   as the reference copy.
2. **Fill TODO 1 — the Anthropic call.** `classifyThread(thread, articles)`:
   use the official SDK (`@anthropic-ai/sdk`; add to package.json if absent —
   Robert runs the npm install). Env: `ANTHROPIC_API_KEY` via .env.local
   (never committed; also needed on the loop machine later). Model: the
   engine's `MODEL` constant (claude-sonnet-4-6) — do not silently upgrade.
   Request: SYSTEM_PROMPT as system, user message = JSON of {question,
   resolution_criteria, known_pending_trigger, as_of_date, articles}. Parse
   response as strict JSON → `LlmOutput`; on parse failure or missing fields,
   return a skip result (never guess, never retry-loop more than once) and
   count it — house rule.
3. **Fill TODO 2 — GDELT fetch.** `fetchGdeltArticles(query)`: DOC 2.0
   `artList` (format=json, maxrecords=250, sort=datedesc) → `Article[]`
   (id=url, date, outlet=domain, title, snippet). Add
   `fetchGdeltTimeline(query)` → timelinevol JSON (T4/T5 store it). BOTH:
   ≥5s spacing between GDELT calls (module-level throttle), 30s timeout,
   on 429 back off 60s and retry ONCE, then skip+count. User-Agent:
   "epistemic-receipts-tracker/1.0".
4. **CI gate.** `scripts/test-thread-classifier.ts`: runs `evalExamples()`
   plus two new unit cases — (a) malformed-JSON LLM response → skip result,
   (b) same-date tie behavior sanity. Exit 1 on any failure. Wire into
   `.github/workflows/ci.yml` in the quality job next to the existing checks
   (pure logic, no network, no DB — keep it that way: the LLM/GDELT calls
   must be injectable/mocked, so structure classifyThread to accept a client
   param like the contract's Db pattern).

## Acceptance criteria (paste output)

- `npx tsx scripts/test-thread-classifier.ts` → 4 canonical PASS + 2 new PASS.
- `npx tsc -p tsconfig.json --noEmit` and scripts config → 0 new errors.
- Diff shows SYSTEM_PROMPT and computeStatus byte-identical to the reference
  copy (`diff <(sed -n '/SYSTEM_PROMPT/,/^`;$/p' ...)` or equivalent spot
  check — paste it).
- One live smoke call (Robert runs, tee to logs/): classify the H-1B fee
  example thread against a real GDELT fetch → any status computes without
  crash. Result quality doesn't gate T2 (that's shadow's job); non-crashing
  and well-formed evidence does.

## Do not

- Change thresholds, prompt wording, or rule order — T3 layers on top,
  never edits underneath.
- Let the LLM output a status. If you feel the urge, re-read briefing 11 §5.
- Poll GDELT anywhere but through the throttled module functions.
