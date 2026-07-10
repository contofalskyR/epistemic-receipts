/**
 * effective-axis.ts — DB-side terminal-axis computation for query filters.
 *
 * Claim.epistemicAxis is a 5-value column (RECORDED/SETTLED/CONTESTED/OPEN/
 * UNRESOLVABLE) that structurally cannot represent REVERSED or ABANDONED —
 * those exist only as ClaimStatusHistory.toAxis. So a claim whose settling
 * curve has reversed still carries a stale stored axis (typically CONTESTED),
 * and filtering on the raw column mis-sorts it. These helpers let a filter key
 * off the claim's EFFECTIVE axis: the terminal transition axis when it is
 * REVERSED/ABANDONED, else the stored axis. This is the SQL mirror of
 * resolveDisplayAxis() (lib/transition-contract.ts).
 *
 * "Terminal" = the latest ClaimStatusHistory row in the house canonical order
 * (seq DESC NULLS LAST, occurredAt DESC, createdAt DESC) — the same order
 * scripts/audit-chain-integrity.ts uses. A per-claim LEFT JOIN LATERAL keeps it
 * index-friendly (ClaimStatusHistory(claimId) + a tiny top-1 sort) instead of a
 * full-corpus window scan.
 *
 * SECURITY: the identifier args (claimAlias/alias) and axisParam are code
 * constants / bind-parameter placeholders ("$3"), NEVER user input. The axis
 * VALUE is always passed as a bound parameter by the caller. Do not interpolate
 * a user value into these strings.
 */

export const REVERSAL_AXES = ["REVERSED", "ABANDONED"] as const;

/**
 * LEFT JOIN LATERAL exposing the claim's terminal transition axis as
 * `<alias>.term` (NULL when the claim has no transitions). Place after the
 * claim table in the FROM clause; requires the claim table aliased as
 * `claimAlias`.
 */
export function terminalAxisLateralJoin(claimAlias = "c", alias = "term"): string {
  return `LEFT JOIN LATERAL (
      SELECT h."toAxis" AS term
        FROM "ClaimStatusHistory" h
       WHERE h."claimId" = ${claimAlias}."id"
       ORDER BY h."seq" DESC NULLS LAST, h."occurredAt" DESC, h."createdAt" DESC
       LIMIT 1
    ) ${alias} ON true`;
}

/**
 * WHERE condition matching claims whose EFFECTIVE axis equals the value bound at
 * `axisParam` (e.g. "$3"). Requires terminalAxisLateralJoin() to have exposed
 * `${alias}.term`.
 *
 *   - axis ∈ {REVERSED, ABANDONED}: terminal axis equals it.
 *   - axis ∉ that set: stored epistemicAxis equals it AND the terminal axis is
 *     not a reversal (so a stored-CONTESTED-but-reversed claim is excluded).
 */
export function effectiveAxisCondition(
  axisParam: string,
  claimAlias = "c",
  alias = "term",
): string {
  return `(
      (${axisParam} IN ('REVERSED', 'ABANDONED') AND ${alias}.term = ${axisParam})
      OR (${axisParam} NOT IN ('REVERSED', 'ABANDONED')
          AND ${claimAlias}."epistemicAxis" = ${axisParam}
          AND (${alias}.term IS NULL OR ${alias}.term NOT IN ('REVERSED', 'ABANDONED')))
    )`;
}
