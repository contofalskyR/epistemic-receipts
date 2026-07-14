/**
 * lib/curve-shapes.ts — pure classifier over the ordered toAxis sequence of
 * every multi-step claim (≥2 transitions).
 *
 * Direction semantics (derived from axis vocabulary in lib/status.ts):
 *   The epistemic axis forms a forward spectrum of confidence:
 *     RECORDED(1) → OPEN(2) → CONTESTED(3) → SETTLED(4)
 *   REVERSED, ABANDONED, and UNRESOLVABLE are terminal failure modes that
 *   exit the spectrum (ordinal 0).
 *
 *   A "direction change" is a reversal within the ordinal sequence:
 *     - Within the forward group: an ordinal decrease followed by an increase
 *       (or increase followed by decrease).
 *     - A terminal axis (REVERSED/ABANDONED/UNRESOLVABLE) always counts as
 *       one direction change from whatever preceded it (exiting the spectrum).
 *
 *   CONTESTED is on the forward path from RECORDED to SETTLED — it is NOT
 *   a backward step.  RECORDED → CONTESTED → SETTLED has 0 direction changes.
 *   SETTLED → CONTESTED → SETTLED has 2 direction changes (flip-flop).
 *
 * Shape taxonomy (mutually exclusive, collectively exhaustive over multi-step):
 *   monotone-settle      — reaches SETTLED, no CONTESTED in sequence
 *   contested-then-settled — passes through CONTESTED at any point, ends SETTLED
 *   settle-then-reverse  — ends REVERSED, and SETTLED appears earlier
 *   flip-flop            — ≥2 direction-group changes in the toAxis sequence
 *   abandoned            — ends ABANDONED
 *   other                — anything else (ends UNRESOLVABLE, ends RECORDED, etc.)
 *
 * Evaluation order matters: flip-flop is checked before settle-then-reverse so
 * a sequence that is both SETTLED→REVERSED→SETTLED→... is classified flip-flop.
 */

export type CurveShape =
  | "monotone-settle"
  | "contested-then-settled"
  | "settle-then-reverse"
  | "flip-flop"
  | "abandoned"
  | "other";

// Ordinal position on the forward spectrum. Terminal axes get 0.
const AXIS_ORDINAL: Record<string, number> = {
  RECORDED: 1,
  OPEN: 2,
  CONTESTED: 3,
  SETTLED: 4,
  REVERSED: 0,
  ABANDONED: 0,
  UNRESOLVABLE: 0,
};

function isTerminal(axis: string): boolean {
  return axis === "REVERSED" || axis === "ABANDONED" || axis === "UNRESOLVABLE";
}

function countDirectionChanges(toAxes: string[]): number {
  if (toAxes.length < 2) return 0;
  let changes = 0;
  let lastDirection: "up" | "down" | null = null;

  for (let i = 1; i < toAxes.length; i++) {
    const prev = toAxes[i - 1];
    const curr = toAxes[i];

    if (isTerminal(curr)) {
      // Terminal always counts as one change (exit from spectrum)
      changes++;
      lastDirection = null; // terminal is endpoint, no further direction
      break;
    }

    if (isTerminal(prev)) {
      // After a terminal we can't continue — this shouldn't happen in practice
      // but guard anyway
      break;
    }

    const prevOrd = AXIS_ORDINAL[prev] ?? 1;
    const currOrd = AXIS_ORDINAL[curr] ?? 1;
    const dir: "up" | "down" | null = currOrd > prevOrd ? "up" : currOrd < prevOrd ? "down" : null;
    if (dir === null) continue; // same ordinal (e.g. RECORDED → RECORDED)

    if (lastDirection !== null && dir !== lastDirection) changes++;
    lastDirection = dir;
  }

  return changes;
}

/**
 * Classify a multi-step claim's shape from its ordered toAxis sequence.
 * Caller must supply ≥2 axes; single-step claims are excluded from the corpus.
 */
export function classifyShape(toAxes: string[]): CurveShape {
  if (toAxes.length < 2) return "other";

  const last = toAxes[toAxes.length - 1];
  const hasSettled = toAxes.includes("SETTLED");
  const hasContested = toAxes.includes("CONTESTED");

  // flip-flop: ≥2 direction-group changes (checked first — supersedes other shapes)
  if (countDirectionChanges(toAxes) >= 2) return "flip-flop";

  // abandoned: ends ABANDONED
  if (last === "ABANDONED") return "abandoned";

  // settle-then-reverse: ends REVERSED and SETTLED appeared earlier
  if (last === "REVERSED" && hasSettled) return "settle-then-reverse";

  // contested-then-settled: ends SETTLED and CONTESTED appeared at any point
  if (last === "SETTLED" && hasContested) return "contested-then-settled";

  // monotone-settle: ends SETTLED with no CONTESTED
  if (last === "SETTLED" && !hasContested) return "monotone-settle";

  return "other";
}

export const SHAPE_LABELS: Record<CurveShape, string> = {
  "monotone-settle": "Monotone settle",
  "contested-then-settled": "Contested → settled",
  "settle-then-reverse": "Settle → reverse",
  "flip-flop": "Flip-flop",
  "abandoned": "Abandoned",
  "other": "Other",
};

export const SHAPE_DESCRIPTIONS: Record<CurveShape, string> = {
  "monotone-settle":
    "Reached SETTLED with no detour through CONTESTED — a claim that moved forward without documented dispute.",
  "contested-then-settled":
    "Passed through CONTESTED before reaching SETTLED — consensus arrived after recorded dispute.",
  "settle-then-reverse":
    "Reached SETTLED, then reversed — a claim the ratifying community formally withdrew after accepting it.",
  "flip-flop":
    "Two or more direction changes in its axis history — a claim that moved forward, backward, and forward (or the reverse) multiple times.",
  "abandoned":
    "Ended ABANDONED — the claim was dropped without reaching either SETTLED or REVERSED.",
  "other":
    "Does not fit the above patterns — typically ends at RECORDED, OPEN, or UNRESOLVABLE without reaching a resolution state.",
};
