import { describe, it, expect } from "vitest";
import { can } from "@/lib/entitlements";

describe("can() — litigation feature", () => {
  it("free user: litigation is false", () => {
    expect(can({ user: { id: "u1", tier: "free" } }, "litigation")).toBe(false);
  });

  it("pro user: litigation is false", () => {
    expect(can({ user: { id: "u1", tier: "pro" } }, "litigation")).toBe(false);
  });

  it("team user: litigation is true", () => {
    expect(can({ user: { id: "u1", tier: "team" } }, "litigation")).toBe(true);
  });

  it("enterprise user: litigation is true", () => {
    expect(can({ user: { id: "u1", tier: "enterprise" } }, "litigation")).toBe(true);
  });

  it("null context: litigation is false", () => {
    expect(can(null, "litigation")).toBe(false);
  });

  it("empty context: litigation defaults to false (free tier)", () => {
    expect(can({}, "litigation")).toBe(false);
  });

  it("org with team tier: litigation is true", () => {
    expect(can({ org: { id: "o1", tier: "team" } }, "litigation")).toBe(true);
  });

  it("org with enterprise tier: litigation is true", () => {
    expect(can({ org: { id: "o1", tier: "enterprise" } }, "litigation")).toBe(true);
  });

  it("org with free tier: litigation is true (org always gets full feature set)", () => {
    // Org context always returns config.values.org which is true for litigation
    expect(can({ org: { id: "o1", tier: "free" } }, "litigation")).toBe(true);
  });

  it("org with pro tier: litigation is true (org gets org-tier value)", () => {
    expect(can({ org: { id: "o1", tier: "pro" } }, "litigation")).toBe(true);
  });
});
