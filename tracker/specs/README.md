# Tracker build specs — execution protocol

Six execution-ready specs (T1–T6) + the shadow gate (T7). Each is sized for
ONE Fable 5 Cowork session working with Robert (he pastes commands, you write
everything — see AGENTS.md working relationship + briefings/10-HANDOFF.md).

## Session-start ritual (every spec, no exceptions)

1. Read `AGENTS.md`, `briefings/11-journalism-angle.md` (esp. §5 DO NOT REDO),
   `briefings/12-tracker-integration.md` (the plan + amendments), then your
   spec. The research report (`tracker/news-cycle-research-report.md`) is the
   evidence base — consult, don't re-research.
2. Check `git log --oneline -5` for which specs already landed (commit
   messages carry the spec id).
3. Preflight-by-default on anything that writes; typecheck before handing
   Robert any command; tee all script output to `logs/`.

## Dependency order

```
T1 (schema) ──► T2 (engine) ──► T3 (guards) ──► T5 (loop) ──► T7 (shadow gate)
      │                                            ▲
      ├────────► T4 (feeds) ───────────────────────┘
      └────────► T6 (UI) — anytime after T1; needs T5 before it shows live data
```

One spec per session. Do not start a spec whose dependencies haven't landed.
Commit per spec: `tracker T<n>: <summary>`. Mark a spec done ONLY when every
acceptance criterion has verification output pasted into the session.

## Invariants that outrank every spec

- Thread statuses NEVER become ClaimStatusHistory rows. The one sanctioned
  join: a RESOLVED thread graduates into the corpus via emitTransition
  (marker = the deciding document) — and that graduation is POST-shadow work,
  not in these specs.
- `SYSTEM_PROMPT` and `computeStatus` from the engine survive VERBATIM. The
  four labeled examples must pass in CI forever.
- The LLM never outputs a status. Deterministic code (computeStatus + T3
  guards) decides; the LLM only extracts semantics.
- No public ORPHANED flag before T7's gate passes. No auto-sent newsletter,
  ever.
- GDELT supplies coverage curves, never facts. Polls run on the loop machine,
  never Vercel (429s + shared egress IPs; report addendum).
