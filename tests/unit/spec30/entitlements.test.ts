import { describe, it, expect } from "vitest";
import { can } from "@/lib/entitlements";

describe("can() — user context", () => {
  it("free user: alerts.max is 3", () => {
    expect(can({ user: { tier: "free" } }, "alerts.max")).toBe(3);
  });

  it("pro user: alerts.max is 10", () => {
    expect(can({ user: { tier: "pro" } }, "alerts.max")).toBe(10);
  });

  it("team user: alerts.max is 25", () => {
    expect(can({ user: { tier: "team" } }, "alerts.max")).toBe(25);
  });

  it("enterprise user: alerts.max is 50", () => {
    expect(can({ user: { tier: "enterprise" } }, "alerts.max")).toBe(50);
  });

  it("free user: export.bulk is false", () => {
    expect(can({ user: { tier: "free" } }, "export.bulk")).toBe(false);
  });

  it("pro user: export.bulk is true", () => {
    expect(can({ user: { tier: "pro" } }, "export.bulk")).toBe(true);
  });

  it("free user: export.citations is false", () => {
    expect(can({ user: { tier: "free" } }, "export.citations")).toBe(false);
  });

  it("team user: export.citations is true", () => {
    expect(can({ user: { tier: "team" } }, "export.citations")).toBe(true);
  });
});

describe("can() — org context", () => {
  it("enterprise org: api.keys is true", () => {
    expect(can({ org: { id: "o1", tier: "enterprise", role: "member" } }, "api.keys")).toBe(true);
  });

  it("team org: api.keys is false for members", () => {
    expect(can({ org: { id: "o1", tier: "team", role: "member" } }, "api.keys")).toBe(false);
  });

  it("org admin always gets api.keys regardless of tier", () => {
    expect(can({ org: { id: "o1", tier: "free", role: "admin" } }, "api.keys")).toBe(true);
  });

  it("org owner always gets api.keys regardless of tier", () => {
    expect(can({ org: { id: "o1", tier: "free", role: "owner" } }, "api.keys")).toBe(true);
  });

  it("org tier wins over user tier for alerts.max", () => {
    const ctx = {
      user: { tier: "free" as const },
      org: { id: "o1", tier: "enterprise" as const, role: "member" as const },
    };
    expect(can(ctx, "alerts.max")).toBe(50);
  });

  it("org tier wins over user tier for collections.max", () => {
    const ctx = {
      user: { tier: "free" as const },
      org: { id: "o1", tier: "enterprise" as const, role: "member" as const },
    };
    expect(can(ctx, "collections.max")).toBe(Infinity);
  });

  it("enterprise org: collections.max is Infinity", () => {
    expect(can({ org: { id: "o1", tier: "enterprise", role: "member" } }, "collections.max")).toBe(Infinity);
  });

  it("free org: collections.max is 10", () => {
    expect(can({ org: { id: "o1", tier: "free", role: "member" } }, "collections.max")).toBe(10);
  });
});
