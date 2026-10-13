// Who verified a source link. Edge.humanReviewed means a person reviewed it;
// Edge.autoApproved means automated checks passed — a pipeline's quality gates
// at ingest, or (claude_sourcing_v1) a fetched page carrying the quoted
// passage. The two are separate signals (AGENTS.md); a person's review
// outranks the machine label.

export const MACHINE_VERIFIED_LABEL = "machine-verified";
export const MACHINE_VERIFIED_TITLE = "Added and checked by automated rules; no person has reviewed this link.";

export function isMachineVerified(edge: { autoApproved: boolean; humanReviewed: boolean }): boolean {
  return edge.autoApproved && !edge.humanReviewed;
}

/** The transition-sourcing pipeline (scripts/lib/transition-sourcing.ts PIPELINE_TAG). */
export const MACHINE_SOURCED_TAG = "claude_sourcing_v1";

/** Source links carry the label only when the transition-sourcing pass added
 *  them (owner, 2026-10-12): bulk imports also set autoApproved from their own
 *  quality gates, and labelling 89% of all links said nothing. */
export function isMachineVerifiedSource(edge: { ingestedBy: string; autoApproved: boolean; humanReviewed: boolean }): boolean {
  return edge.ingestedBy === MACHINE_SOURCED_TAG && isMachineVerified(edge);
}
