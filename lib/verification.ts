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
