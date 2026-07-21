# Build Brief #16 — The Ideology Instrument (audit trail + pedagogy on /analysis/ideology)

**To:** RobClaw / Fable on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-17)
**Lane:** site. **Zero DB writes** except I-4's owner-reviewed editorial copy (seeded via the normal contract if stored, or shipped as code constants — worker proposes which in the design note).

**The vision (owner's words, engineered):** the ideology scatter becomes clickable — click a member, a panel slides in from the right (scatter compresses left), showing that member's page inline: placement, party-unity, their votes. Scrolling their votes becomes both an **audit trail** (every vote a dated receipt) and a **pedagogical instrument** (how voting maps to the ideological dimensions) — built delicately, because a vote never cleanly reveals ideology vs. party discipline. The nuance layer is fable-authored, human-reviewed.

**The honesty mechanism (this is what makes the vision shippable):** never label a vote with an ideology. Two measurements carry the pedagogy instead:
1. **Cutting-line fit** — Voteview's per-rollcall spatial data (the B11 census confirmed `ingest-voteview.ts` captures vote-level cutting-line midpoints). A vote with strong dim-1 fit "divided the chamber along the economic axis" — that's a property of the roll call, not a claim about a member's beliefs.
2. **Defections** — member vote vs. their party's majority on that rollcall, computable today from MemberVote + byPartyJson. Defections are where individual position is visible *despite* party discipline — the only vote-level signal that legitimately escapes the confound.

Language rules that follow: "divided along the economic axis," "voted against the party majority," "placement estimated from voting patterns" — never "voted conservative," never "because they believe," never an ism attached to a vote. DW-NOMINATE's own caveat (estimated from patterns; dim-1 ≈ party in modern congresses) renders visibly in the panel, not in a footnote nobody opens.

---

## 0. Orientation

Sync main; newest handoff; standing rails (worktree, branch `loop/site-b16-<date>`, owner merges, no schema changes without gate). Read: `app/analysis/ideology/` as shipped, `app/members/[memberId]/` (LandmarkAnalytics), `app/ideologies/` (the ~200-ism taxonomy + lineage graph), `data/landmark-rollcalls.json`, what `ingest-voteview.ts` actually stored per rollcall (cutting-line fields — census first, the brief's premise depends on it).

## Phases

### B16-1 — Quick wins (ship directly, no design gate)

1. **Bidirectional taxonomy linking:** `/analysis/ideology` gains a "What do these axes mean?" block linking the relevant `/ideologies` concepts (liberalism, conservatism, the left-right spectrum entry, party discipline if present) + `/methodology`. Each linked `/ideologies` page gains a small "See it measured: Congressional Ideology →" cross-link. The taxonomy finally earns its keep against live data.
2. **Kill the Update button** — auto-apply on select (B13's P2, still open).
3. **Scatter dots → member pages** — plain navigation click-through as the interim behavior until the panel ships (tooltip already exists; add the click).

### B16-2 — Census + design note (STOP for owner review)

1. **Data census (read-only):** what cutting-line/fit fields exist per voteview rollcall in the DB, their coverage; defection computability across congress_votes_v1 (full) + landmark subset (1,500) — report exact denominators. If cutting-line data is absent or thin, the design note says so and the fit-indicator feature downgrades to defections-only — honestly, not silently.
2. **Design note (≤1 page):** panel interaction (click dot → right slide-in, scatter compresses; ESC/close restores; `?member=<bioguide>` URL state so views are shareable/deep-linkable); panel contents (placement vs party median, unity % with denominator, notable votes, defection list); per-vote row anatomy (outcome badges + axis-fit indicator where data supports + taxonomy concept links); mobile behavior (panel becomes full-screen sheet); performance (panel data via the existing member queries, no new heavy endpoints). Owner reviews before code.

### B16-3 — The instrument (after note approval)

Build the panel per the approved note. Defection computation is a pure query (member vote ≠ party majority on that rollcall, majority from byPartyJson or MemberVote aggregate — state which per pipeline). Every stat prints its denominator per house rule ("across the N roll-calls with member-level records"). Axis-fit indicator renders only where the census found real cutting-line data — D-4 silence otherwise.

### B16-4 — The nuance layer (fable-authored, human-gated)

The pedagogical copy: a short "Ideology or party?" explainer block in the panel (the confound, stated plainly, with the defection list as the honest exception); per-axis concept notes bridging to `/ideologies` entries; the DW-NOMINATE caveat line. Written by the worker (fable), **reviewed word-by-word by the owner before merge** — this is editorial content under the editorial-not-algorithmic rule. Hard rules: no ism ever attaches to a vote or member beyond the DW-NOMINATE placement itself; every claim in the copy is either a citation (Lewis et al.) or a definition; the copy teaches the *limits* of the mapping as prominently as the mapping.

### B16-5 — Verification

tsc/ESLint/vitest green; panel round-trip (click → panel → votes → taxonomy link → back) on desktop + mobile viewport; URL state deep-link renders directly; 3 defection rows spot-checked against raw MemberVote + byPartyJson by independent query; denominators visible in DOM; the nuance copy diff attached to the report for owner sign-off; Vercel preview green.

## Report

`briefs/b16-report.md`: census results (cutting-line coverage — the make-or-break number), design-note decisions, defection stats summary (how common? interesting in itself), the nuance copy as shipped, spot-checks, residuals.

## STOP conditions

Design note unapproved; cutting-line census contradicting the premise (report, downgrade, don't fake); any copy attaching an ideology label to a vote/member; nuance copy merged without explicit owner sign-off; any write outside the editorial gate; two consecutive failures on one criterion. Blocked beats invented.
