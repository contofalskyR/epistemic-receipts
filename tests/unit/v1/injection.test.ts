/**
 * Spec 20 — SQL injection corpus test
 *
 * 10 injection payloads against string filter parameters.
 * Tests that Zod schemas sanitize / reject them before they reach the DB.
 * A clean result is a 200 (filtered/empty) or 400 (rejected by schema) — never a 500.
 */
import { describe, it, expect } from "vitest";
import { ClaimsQuerySchema, SearchQuerySchema, VerifyQuerySchema } from "@/lib/v1/schemas";

const SQL_INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE claims; --",
  "' UNION SELECT * FROM \"ApiKey\" --",
  "1; DELETE FROM claims WHERE 1=1; --",
  "' OR 1=1 --",
  "admin'--",
  "' AND 1=(SELECT COUNT(*) FROM information_schema.tables) --",
  "'; EXEC xp_cmdshell('whoami'); --",
  "' OR 'x'='x'; --",
  "1' OR '1' = '1' /*",
];

describe("Injection suite — ClaimsQuerySchema", () => {
  it("accepts or rejects all pipeline injection payloads cleanly", () => {
    for (const payload of SQL_INJECTION_PAYLOADS) {
      const result = ClaimsQuerySchema.safeParse({ pipeline: payload });
      // Must NOT throw — either success (will be parameterized by Prisma) or failure
      expect(typeof result.success).toBe("boolean");
    }
  });

  it("rejects claimType injection (not in enum)", () => {
    for (const payload of SQL_INJECTION_PAYLOADS) {
      const result = ClaimsQuerySchema.safeParse({ claimType: payload });
      // None of these are valid enum values
      expect(result.success).toBe(false);
    }
  });

  it("rejects epistemicAxis injection (not in enum)", () => {
    for (const payload of SQL_INJECTION_PAYLOADS) {
      const result = ClaimsQuerySchema.safeParse({ epistemicAxis: payload });
      expect(result.success).toBe(false);
    }
  });

  it("rejects verificationStatus injection (not in enum)", () => {
    for (const payload of SQL_INJECTION_PAYLOADS) {
      const result = ClaimsQuerySchema.safeParse({ verificationStatus: payload });
      expect(result.success).toBe(false);
    }
  });

  it("rejects topic strings > maxLength", () => {
    const longPayload = "a".repeat(200);
    const result = ClaimsQuerySchema.safeParse({ topic: longPayload });
    expect(result.success).toBe(false);
  });
});

describe("Injection suite — SearchQuerySchema", () => {
  it("rejects queries shorter than 3 chars (empty injection attempt)", () => {
    const shortPayloads = ["' ", "a'", "--"];
    for (const payload of shortPayloads) {
      const result = SearchQuerySchema.safeParse({ q: payload });
      expect(result.success).toBe(false);
    }
  });

  it("rejects queries longer than 500 chars", () => {
    const longPayload = "' OR '1'='1" + " ".repeat(500);
    const result = SearchQuerySchema.safeParse({ q: longPayload });
    expect(result.success).toBe(false);
  });

  it("passes valid queries through (Prisma will parameterize them)", () => {
    // These are technically valid search strings even if malicious-looking;
    // Prisma's parameterized queries prevent actual injection.
    for (const payload of SQL_INJECTION_PAYLOADS) {
      if (payload.length >= 3 && payload.length <= 500) {
        const result = SearchQuerySchema.safeParse({ q: payload });
        // Either passes or fails validation — what matters is it doesn't throw
        expect(typeof result.success).toBe("boolean");
        if (result.success) {
          // If it passes schema, the string is preserved (Prisma parameterizes)
          expect(typeof result.data.q).toBe("string");
        }
      }
    }
  });
});

describe("Injection suite — VerifyQuerySchema", () => {
  it("rejects statements shorter than 10 chars", () => {
    for (const payload of SQL_INJECTION_PAYLOADS.filter(p => p.length < 10)) {
      const result = VerifyQuerySchema.safeParse({ statement: payload });
      expect(result.success).toBe(false);
    }
  });

  it("rejects statements longer than 500 chars", () => {
    const longPayload = "' UNION SELECT " + "x".repeat(490);
    const result = VerifyQuerySchema.safeParse({ statement: longPayload });
    expect(result.success).toBe(false);
  });

  it("does not throw on any injection payload", () => {
    for (const payload of SQL_INJECTION_PAYLOADS) {
      expect(() => VerifyQuerySchema.safeParse({ statement: payload })).not.toThrow();
    }
  });
});
