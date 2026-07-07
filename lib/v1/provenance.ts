/**
 * Deterministic provenance grade logic for v1 API.
 *
 * Grades documentation depth — NOT truth.
 *
 * A = humanReviewed with ≥2 primary-source edges
 * B = verified pipeline + ≥1 primary-source edge
 * C = autoApproved bulk, no primary-source edges
 * D = PROVISIONAL (verificationStatus = "PROVISIONAL")
 * X = DEPRECATED (verificationStatus = "DEPRECATED" or epistemicAxis = "ABANDONED")
 */

export type ProvenanceGrade = "A" | "B" | "C" | "D" | "X";

export interface ProvenanceInput {
  humanReviewed: boolean;
  autoApproved: boolean;
  verificationStatus: string | null;
  epistemicAxis: string | null;
  primarySourceEdgeCount: number;
}

export function computeProvenanceGrade(input: ProvenanceInput): ProvenanceGrade {
  const { humanReviewed, verificationStatus, epistemicAxis, primarySourceEdgeCount } = input;

  if (verificationStatus === "DEPRECATED" || epistemicAxis === "ABANDONED") return "X";
  if (verificationStatus === "PROVISIONAL") return "D";
  if (humanReviewed && primarySourceEdgeCount >= 2) return "A";
  if (verificationStatus === "VERIFIED" && primarySourceEdgeCount >= 1) return "B";
  return "C";
}

export const GRADE_DESCRIPTIONS: Record<ProvenanceGrade, string> = {
  A: "Human-reviewed with ≥2 primary-source edges. Highest documentation depth.",
  B: "Verified pipeline with ≥1 primary-source edge. Strong documentation.",
  C: "Auto-approved or bulk-ingested; no primary-source edges. Minimal documentation.",
  D: "Provisional — documentation incomplete or under review.",
  X: "Deprecated or abandoned — included for traceability only.",
};
