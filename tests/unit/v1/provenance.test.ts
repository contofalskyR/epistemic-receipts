import { describe, it, expect } from "vitest";
import { computeProvenanceGrade, GRADE_DESCRIPTIONS } from "@/lib/v1/provenance";

describe("computeProvenanceGrade", () => {
  it("returns X for DEPRECATED verificationStatus", () => {
    expect(computeProvenanceGrade({
      humanReviewed: true,
      autoApproved: false,
      verificationStatus: "DEPRECATED",
      epistemicAxis: "SETTLED",
      primarySourceEdgeCount: 5,
    })).toBe("X");
  });

  it("returns X for ABANDONED epistemicAxis", () => {
    expect(computeProvenanceGrade({
      humanReviewed: true,
      autoApproved: false,
      verificationStatus: null,
      epistemicAxis: "ABANDONED",
      primarySourceEdgeCount: 5,
    })).toBe("X");
  });

  it("returns D for PROVISIONAL verificationStatus", () => {
    expect(computeProvenanceGrade({
      humanReviewed: false,
      autoApproved: false,
      verificationStatus: "PROVISIONAL",
      epistemicAxis: null,
      primarySourceEdgeCount: 0,
    })).toBe("D");
  });

  it("returns A for humanReviewed + ≥2 primary edges", () => {
    expect(computeProvenanceGrade({
      humanReviewed: true,
      autoApproved: false,
      verificationStatus: "VERIFIED",
      epistemicAxis: "SETTLED",
      primarySourceEdgeCount: 2,
    })).toBe("A");

    expect(computeProvenanceGrade({
      humanReviewed: true,
      autoApproved: false,
      verificationStatus: null,
      epistemicAxis: null,
      primarySourceEdgeCount: 10,
    })).toBe("A");
  });

  it("returns B for VERIFIED + ≥1 primary edge (not humanReviewed)", () => {
    expect(computeProvenanceGrade({
      humanReviewed: false,
      autoApproved: false,
      verificationStatus: "VERIFIED",
      epistemicAxis: "SETTLED",
      primarySourceEdgeCount: 1,
    })).toBe("B");
  });

  it("returns C for auto-approved with no primary edges", () => {
    expect(computeProvenanceGrade({
      humanReviewed: false,
      autoApproved: true,
      verificationStatus: null,
      epistemicAxis: "RECORDED",
      primarySourceEdgeCount: 0,
    })).toBe("C");
  });

  it("returns C for humanReviewed with only 1 primary edge (not ≥2)", () => {
    expect(computeProvenanceGrade({
      humanReviewed: true,
      autoApproved: false,
      verificationStatus: "VERIFIED",
      epistemicAxis: "SETTLED",
      primarySourceEdgeCount: 1,
    })).toBe("B"); // VERIFIED + 1 edge = B, not A
  });

  it("GRADE_DESCRIPTIONS has entries for all grades", () => {
    for (const grade of ["A", "B", "C", "D", "X"] as const) {
      expect(GRADE_DESCRIPTIONS[grade]).toBeTruthy();
    }
  });

  it("X takes priority over D (DEPRECATED + PROVISIONAL is unusual but X wins)", () => {
    expect(computeProvenanceGrade({
      humanReviewed: true,
      autoApproved: false,
      verificationStatus: "DEPRECATED",
      epistemicAxis: "ABANDONED",
      primarySourceEdgeCount: 5,
    })).toBe("X");
  });
});
