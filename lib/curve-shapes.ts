/**
 * curve-shapes.ts — classifier over the ordered toAxis sequence of every
 * multi-step claim (≥2 transitions).
 *
 * Direction semantics (derived from the 7-axis vocabulary in lib/status.ts):
 *   - "Settled direction" axes: SETTLED, HARD_FACT
 *   - "Contested/open direction" axes: CONTESTED, OPEN, RECORDED, UNRESOLVABLE
 *   - "Terminal negative" axes: REVERSED, ABANDONED
 *
 * A "direction change" is a move from any settled-direction axis to a
 * contested/open/terminal axis, or vice versa — not every transition is a
 * direction change (e.g. RECORDED → CONTESTED is both open, so no change).
 *
 * Shapes (mutually exclusive, collectively exhaustive for multi-step claims):
 *   monotone-settle    — reaches SETTLED, no direction change after the first settled step
 *   contested-then-settled — passes through CONTESTED or OPEN, ends SETTLED
 *   settle-then-reverse — ends REVERSED after a prior SETTLED step
 *   flip-flop          — ≥2 direction changes (oscillates between settled and contested)
 *   abandoned          — ends ABANDONED
 *   other              — anything else (e.g. ends OPEN, UNRESOLVABLE, or RECORDED)
 *
 * The six shape counts must sum to the multi-step corpus count. The "other"
 * bucket is explicitly published (never hidden) so the invariant is verifiable.
 */

export type CurveShape =
  | "monotone-settle"
  | "contested-then-settled"
  | "settle-then-reverse"
  | "flip-flop"
  | "abandoned"
  | "other";

export const CURVE_SHAPE_LABELS: Record<CurveShape, string> = {
  "monotone-settle": "Monotone settle",
  "contested-then-settled": "Contested, then settled",
  "settle-then-reverse": "Settled, then reversed",
  "flip-flop": "Flip-flop",
  "abandoned": "Abandoned",
  "other": "Other",
};

export const CURVE_SHAPE_DESCRIPTIONS: Record<CurveShape, string> = {
  "monotone-settle":
    "Reached SETTLED without any change of direction after the first settled step — a straight epistemic climb.",
  "contested-then-settled":
    "Passed through CONTESTED or OPEN before landing at SETTLED — evidence was disputed, then resolved.",
  "settle-then-reverse":
    "Reached SETTLED at some point, then later reversed — a prior consensus undone.",
  "flip-flop":
    "Changed direction two or more times — oscillating between settled and contested states.",
  "abandoned":
    "Ended at ABANDONED — no longer actively tracked or pursued.",
  "other":
    "Everything else: ends OPEN, UNRESOLVABLE, RECORDED, or follows a pattern not captured above. This bucket is published so the partition is complete.",
};

const SETTLED_AXES = new Set(["SETTLED", "HARD_FACT"]);

// CONTESTED or OPEN explicitly mean active disputing — used to distinguish
// contested-then-settled from monotone-settle (RECORDED is the entry state,
// not an active disputed state; a RECORDED→SETTLED arc is still monotone).
const ACTIVELY_CONTESTED_AXES = new Set(["CONTESTED", "OPEN"]);

function isSettled(axis: string): boolean {
  return SETTLED_AXES.has(axis);
}

/**
 * Classify an ordered sequence of toAxis values (≥2 elements).
 * Input must already be sorted seq-first (see ORDERING-SEMANTICS-2026-07-08.md).
 */
export function classifyCurveShape(axes: string[]): CurveShape {
  if (axes.length < 2) {
    throw new Error("classifyCurveShape requires ≥2 transitions");
  }

  const last = axes[axes.length - 1];
  const hasSettled = axes.some(isSettled);

  // abandoned: ends ABANDONED (takes priority over settle-then-reverse)
  if (last === "ABANDONED") return "abandoned";

  // settle-then-reverse: reached SETTLED at some point, then ended REVERSED
  if (last === "REVERSED" && hasSettled) return "settle-then-reverse";

  // Count direction changes: a change is a move between the settled group
  // and the not-settled group (or vice versa).
  let directionChanges = 0;
  for (let i = 1; i < axes.length; i++) {
    if (isSettled(axes[i - 1]) !== isSettled(axes[i])) {
      directionChanges++;
    }
  }

  // flip-flop: ≥2 direction changes (e.g. SETTLED→CONTESTED→SETTLED)
  if (directionChanges >= 2) return "flip-flop";

  // contested-then-settled: ends SETTLED and passed through CONTESTED or OPEN.
  // RECORDED is an entry state, not an active dispute — RECORDED→SETTLED is monotone.
  if (isSettled(last) && axes.slice(0, -1).some((a) => ACTIVELY_CONTESTED_AXES.has(a))) {
    return "contested-then-settled";
  }

  // monotone-settle: ends SETTLED without passing through CONTESTED/OPEN
  if (isSettled(last)) return "monotone-settle";

  // other: everything else
  return "other";
}
