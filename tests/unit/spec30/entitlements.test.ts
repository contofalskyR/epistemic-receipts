import { describe, it, expect } from "vitest";
import { can } from "@/lib/entitlements";

describe("can() — user context", () => {
  it("free user: alerts.max is 3", () => {
    expect(can({ user: { id: "u1", tier: "free" } }, "alerts.max")).toBe(3);
  });

  it("pro user: alerts.max is 10", () => {
    expect(can({ user: { id: "u1", tier: "pro" } }, "alerts.max")).toBe(10);
  });

  it("team user: alerts.max is 25", () => {
    expect(can({ user: { id: "u1", tier: "team" } }, "alerts.max")).toBe(25);
  });

  it("enterprise user: alerts.max is 50", () => {
    expect(can({ user: { id: "u1", tier: "enterprise" } }, "alerts.max")).toBe(50);
  });

  it("free user: export.bulk is false", () => {
    expect(can({ user: { id: "u1", tier: "free" } }, "export.bulk")).toBe(false);
  });

  it("pro user: export.bulk is true", () => {
    expect(can({ user: { id: "u1", tier: "pro" } }, "export.bulk")).toBe(true);
  });

  it("free user: export.citations is false", () => {
    expect(can({ user: { id: "u1", tier: "free" } }, "export.citations")).toBe(false);
  });

  it("team user: export.citations is true", () => {
    expect(can({ user: { id: "u1", tier: "team" } }, "export.citations")).toBe(true);
  });
});

describe("can() — org context", () => {
  it("org admin gets api.keys", () => {
    expect(can({ org: { id: "o1", tier: "enterprise" }, isOrgAdmin: true }, "api.keys")).toBe(true);
  });

  it("org member (non-admin) does not get api.keys", () => {
    expect(can({ org: { id: "o1", tier: "team" } }, "api.keys")).toBe(false);
  });

  it("org admin gets api.keys regardless of tier", () => {
    expect(can({ org: { id: "o1", tier: "free" }, isOrgAdmin: true }, "api.keys")).toBe(true);
  });

  it("explicit non-admin flag denies api.keys regardless of tier", () => {
    expect(can({ org: { id: "o1", tier: "enterprise" }, isOrgAdmin: false }, "api.keys")).toBe(false);
  });

  it("org context wins over user tier for alerts.max", () => {
    const ctx = {
      user: { id: "u1", tier: "free" as const },
      org: { id: "o1", tier: "enterprise" as const },
    };
    expect(can(ctx, "alerts.max")).toBe(50);
  });

  it("org context wins over user tier for collections.max", () => {
    const ctx = {
      user: { id: "u1", tier: "free" as const },
      org: { id: "o1", tier: "enterprise" as const },
    };
    expect(can(ctx, "collections.max")).toBe(Infinity);
  });

  it("enterprise org: collections.max is Infinity", () => {
    expect(can({ org: { id: "o1", tier: "enterprise" } }, "collections.max")).toBe(Infinity);
  });

  it("org context: collections.max is org-level (Infinity) regardless of org tier", () => {
    expect(can({ org: { id: "o1", tier: "free" } }, "collections.max")).toBe(Infinity);
  });
});
