import { describe, expect, it } from "vitest";
import { classifyStudy, type CtgovStudy } from "@/tracker/ctgov_adapter";

const AS_OF = "2026-07-09";

function study(over: Partial<CtgovStudy["protocolSection"]["statusModule"]>, hasResults = false, nct = "NCT00000001"): CtgovStudy {
  return {
    hasResults,
    protocolSection: {
      identificationModule: { nctId: nct, briefTitle: "Test trial" },
      statusModule: { overallStatus: "COMPLETED", ...over },
    },
  };
}

describe("ctgov adapter -> status engine", () => {
  it("recruiting trial with recent update -> OPEN", () => {
    const r = classifyStudy(
      study({ overallStatus: "RECRUITING", lastUpdatePostDateStruct: { date: "2026-07-01" }, primaryCompletionDateStruct: { date: "2027-03-01" } }),
      AS_OF,
    );
    expect(r.status).toBe("OPEN");
  });

  it("active trial, quiet registry, but in-progress = pending trigger -> STALLED, never ORPHANED", () => {
    const r = classifyStudy(
      study({ overallStatus: "ACTIVE_NOT_RECRUITING", lastUpdatePostDateStruct: { date: "2025-11-01" }, primaryCompletionDateStruct: { date: "2026-12-01" } }),
      AS_OF,
    );
    expect(r.status).toBe("STALLED");
    expect(r.reason).toContain("pending trigger");
  });

  it("results posted -> RESOLVED", () => {
    const r = classifyStudy(
      study({ overallStatus: "COMPLETED", resultsFirstPostDateStruct: { date: "2026-05-10" }, lastUpdatePostDateStruct: { date: "2026-05-10" } }, true),
      AS_OF,
    );
    expect(r.status).toBe("RESOLVED");
  });

  it("terminated trial -> RESOLVED (moot)", () => {
    const r = classifyStudy(
      study({ overallStatus: "TERMINATED", whyStopped: "Slow accrual", lastUpdatePostDateStruct: { date: "2026-06-20" } }),
      AS_OF,
    );
    expect(r.status).toBe("RESOLVED");
    expect(r.reason.toLowerCase()).toContain("moot");
  });

  it("completed 6 months ago, no results -> STALLED (inside reporting grace window)", () => {
    const r = classifyStudy(
      study({ overallStatus: "COMPLETED", completionDateStruct: { date: "2026-01-15" }, lastUpdatePostDateStruct: { date: "2026-01-15" } }),
      AS_OF,
    );
    expect(r.status).toBe("STALLED");
  });

  it("completed 18 months ago, no results, registry silent -> ORPHANED (the product)", () => {
    const r = classifyStudy(
      study({ overallStatus: "COMPLETED", completionDateStruct: { date: "2025-01-10" }, lastUpdatePostDateStruct: { date: "2025-01-10" } }),
      AS_OF,
    );
    expect(r.status).toBe("ORPHANED");
  });

  it("month-precision CT.gov dates (YYYY-MM) do not crash the mapping", () => {
    const r = classifyStudy(
      study({ overallStatus: "COMPLETED", completionDateStruct: { date: "2025-01" }, lastUpdatePostDateStruct: { date: "2025-01" } }),
      AS_OF,
    );
    expect(["ORPHANED", "STALLED"]).toContain(r.status);
  });
});
