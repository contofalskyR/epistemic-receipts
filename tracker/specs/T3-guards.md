# T3 — Step-0 guards: quiet-resolution pre-filters + venue-aware dormancy

**Size:** ~2 sessions (+iteration during shadow). **Depends on:** T1, T2.
**Blocks:** T5. **This spec gates every public ORPHANED flag — it exists
because of the research report's §7 adversarial pass; read that section
before writing a line.**

## Objective

A deterministic layer BETWEEN computeStatus and the stored status that
prevents the known false-positive patterns in the launch domain (immigration)
without touching the core engine. Core rule: guards may only make the result
MORE conservative (ORPHANED→STALLED/RESOLVED-equivalent), never less.

## Design

`lib/thread-guards.ts`:

```ts
applyDomainGuards(input: {
  thread: Thread;                 // venue, domain, activityRefs
  llm: LlmOutput;                 // T2's extraction
  computed: StatusResult;         // computeStatus output
  activity: { feed: string; eventDate: Date }[];  // T4 signals (may be empty pre-T4)
  coverage: { peakDate: Date | null };            // from cached timelinevol
  asOf: Date;
}): { status: Status; reason: string; guardsApplied: string[] }
```

Pure function, no I/O, fully unit-testable. Rules in order:

1. **Pass-through:** if computed.status ≠ ORPHANED, guards only annotate
   (exception: rule 5 quiet-resolution can promote STALLED→RESOLVED-note).
2. **Grace period:** ORPHANED requires asOf ≥ peakDate + 35d (when peakDate
   known). Earlier → STALLED "within post-peak grace period".
3. **Venue dormancy floors** (thread.venue): federal_court → material silence
   floor 270d before ORPHANED eligible; eoir → NEVER auto-ORPHANED (flag
   `needs-human-review` in guardsApplied instead, status STALLED); agency →
   180d; congress → eligible only after the Congress in question adjourns
   sine die (approximate: 730d floor for MVP, note the refinement); none →
   engine defaults stand.
4. **Order-type detection:** if any recent llm event's what_moved matches
   stay/abeyance/administrative-closure patterns (regex list, tested), treat
   as pending trigger → STALLED. (Extends the engine's guardrail using data
   it already extracts — the prompt stays untouched.)
5. **Quiet-resolution pre-filters** (domain=us-immigration): TPS
   auto-extension logic (no determination by 60d pre-expiry ⇒ extended —
   needs the expiry date in thread.activityRefs) and
   direct-final-rule-effective patterns → status STALLED with reason
   "resolved-by-default pattern; confirm and mark RESOLVED manually" +
   `quiet-resolution` flag. (Guards never assert RESOLVED on their own —
   a human confirms; the flag routes it to review.)
6. **Two-feed corroboration:** ORPHANED requires BOTH coverage silence
   (engine already checks) AND activity-feed silence (no ThreadActivitySignal
   within SILENCE_WINDOW). Any recent activity signal → STALLED "activity
   feed shows movement without coverage" — which is itself interesting and
   surfaces in UI later.

## Test fixtures (all must pass; these ARE the acceptance criteria)

Encode report §7's patterns as cases in `scripts/test-thread-guards.ts`
(wired into CI beside T2's):

- Administrative-closure event text → never ORPHANED.
- Stay-order pending → STALLED via rule 4.
- TPS 60-day-silence pattern → quiet-resolution flag, not ORPHANED.
- Federal-court thread, 100d docket silence, coverage dead → STALLED (floor).
- Congress thread, Gang-of-Eight shape (passed one chamber, no scheduled
  vote, coverage dead, >floor) → ORPHANED fires ✓ (the true positive that
  keeps the product honest).
- Activity signal 10d ago + coverage dead 60d → STALLED via rule 6.
- venue=none, no signals, beyond all windows → engine's ORPHANED stands
  (guards don't strangle the default path).
- The four canonical engine examples run THROUGH guards with venue=none →
  identical statuses (guards are invisible where they have no evidence).

## Do not

- Edit computeStatus or the prompt.
- Let guards produce RESOLVED directly — they flag; humans confirm.
- Hardcode immigration rules outside the domain check — the guard layer is
  per-domain data + generic machinery, so domain #2 is a config, not a fork.
