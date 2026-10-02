import { describe, it, expect } from "vitest";
import { assertDisposableDatabase } from "../seed";

// tests/seed.ts deletes every Claim, Source, Edge and ClaimStatusHistory row in
// whatever DATABASE_URL names; `npm run test:integration` against a .env.local
// pointing at production would wipe it (front door phase 6). The guard only
// lets a database named *_test through — CI's is epistemic_test. Arguments are
// explicit: CI sets DATABASE_URL for the whole job, unit tests included.

const CI = "postgresql://postgres:postgres@localhost:5432/epistemic_test";

describe("assertDisposableDatabase (tests/seed.ts)", () => {
  it("allows CI's throwaway database", () => {
    expect(() => assertDisposableDatabase(CI, undefined)).not.toThrow();
    expect(() => assertDisposableDatabase(`${CI}?sslmode=disable`, undefined)).not.toThrow();
  });

  it.each([
    "postgresql://user:pass@host:5432/epistemic?sslmode=require",
    "postgresql://user:pass@host/prod?x=_test", // _test only in the query
    "postgresql://user:pass_test@host/prod", // _test only in the password
    "postgresql://user:pass@host/epistemic_test_restore", // contains, does not end with, _test
    "",
    "not a url",
  ])("refuses %s", (url) => {
    expect(() => assertDisposableDatabase(url, undefined)).toThrow(/refusing database/);
  });

  it("refuses a missing URL", () => {
    expect(() => assertDisposableDatabase(undefined, undefined)).toThrow(/refusing database/);
  });

  it("ALLOW_DESTRUCTIVE_SEED overrides only when exactly '1'", () => {
    expect(() => assertDisposableDatabase("postgresql://user:pass@host/prod", "1")).not.toThrow();
    expect(() => assertDisposableDatabase("postgresql://user:pass@host/prod", "true")).toThrow(/refusing database/);
  });

  it("names the database, never the credentials or host", () => {
    let message = "";
    try {
      assertDisposableDatabase("postgresql://user:s3cret@dbhost.example/epistemic", undefined);
    } catch (e) {
      message = String(e);
    }
    expect(message).toMatch(/"epistemic"/);
    expect(message).not.toMatch(/s3cret|dbhost/);
  });
});
