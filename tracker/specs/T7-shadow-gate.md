# T7 — Shadow run & the public gate (operating phase, not a build session)

**Duration:** 2–4 weeks calendar. **Depends on:** T1–T6 live, 15–20 threads
authored. **This phase decides whether the product ships publicly. It cannot
be compressed by more engineering.**

## The routine

- The loop polls daily (T5). Robert reviews ~weekly, 15 minutes: open
  `/threads`, scan status changes (the history table on each detail page
  makes this fast), and judge every ORPHANED and `needs-human-review` flag:
  REAL (the press truly dropped a live unresolved question) or FALSE (a
  guard should have caught it).
- Every FALSE flag gets a one-line entry in `tracker/shadow-log.md` (date,
  thread, why it was false, which guard/threshold to adjust) — then a small
  T3-iteration session encodes the fix and adds it as a test fixture. The
  guards grow a fixture per mistake, exactly like the corpus grew audit
  checks.
- Anything the guards flag `quiet-resolution`: Robert confirms manually and
  marks RESOLVED (with the confirming source URL as a ThreadKeyFact).

## The gate (all three, then public)

1. **Zero unexplained false ORPHANEDs across the final 2 consecutive weeks.**
   (False positives early are expected and productive; the gate is about the
   trailing window after fixes.)
2. **At least one TRUE orphan found** — otherwise there's nothing to launch
   with (and per briefing 12's tip-first funnel, the first true orphan is
   the outreach asset: one exclusive tip, one reporter at Documented or
   similar, ONE email).
3. **Extraction sanity:** spot-check 10 random ThreadStatusHistory rows'
   llmEvidence against the underlying articles — event typing (merits vs
   procedural) right in ≥8/10. Below that, tune the domain few-shots (allowed
   post-shadow: adding LABELED_EXAMPLES; never editing the prompt's rules).

## On pass (one celebratory session)

- Remove `/threads` from ADMIN_PATHS; promote to Discover nav ("Open
  Questions"); publish the methodology addendum citing Downs 1972 + Soufan
  2026 and defining the orphaned-story construct (briefing 12 amendment 4 —
  and Robert's PhD white space).
- Send the tip email (funnel step 1). Stand up Buttondown (draft-default
  API) as the retention layer.
- Only then: consider the graduation feature (RESOLVED threads minting
  corpus claims via emitTransition) and the dropped-story score — both
  post-public, both optional.

## On fail

If week 4 still produces unexplained false orphans: pause, write up what the
guards can't catch, and take the domain question back to Robert — the report
(§7) warned immigration is the hardest domain; switching domain #1 is a
config change (T3 was built domain-generic), not a rebuild. Failing the gate
costs a month and teaches the thresholds; shipping a wolf-crier costs the
brand. House rule shape: skip + count, never guess.
