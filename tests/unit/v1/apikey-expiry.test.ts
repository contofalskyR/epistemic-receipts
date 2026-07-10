/**
 * SECURITY-ASSESSMENT-2026-07-09 finding #8: verifyApiKey must enforce
 * expiresAt. Previously only revokedAt was checked, so an expired key stayed
 * valid indefinitely. An expired key must now fail closed (401) and consume
 * no rate-limit quota or usage accounting.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// lib/v1/auth.ts imports "./rateLimit" — same module id as this alias.
vi.mock("@/lib/v1/rateLimit", () => ({
  checkRateLimit: vi.fn(),
  incrementUsage: vi.fn(),
}));

vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/v1/rateLimit";
import { verifyApiKey, isAuthError } from "@/lib/v1/auth";

const mockFindUnique = prisma.apiKey.findUnique as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

const HOUR = 60 * 60 * 1000;

function reqWithKey(key = "er_live_test_key_abc123"): NextRequest {
  return new NextRequest("http://localhost/api/v1/claims", {
    headers: { authorization: `Bearer ${key}` },
  });
}

function apiKeyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "key-1",
    orgName: "Test Org",
    contactEmail: "test@example.com",
    keyHash: "irrelevant-mocked",
    tier: "free",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    revokedAt: null,
    lastUsedAt: null,
    expiresAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 59, limit: 60 });
});

describe("verifyApiKey — expiresAt enforcement", () => {
  it("rejects an expired key with 401 and a clear detail", async () => {
    const expiresAt = new Date(Date.now() - HOUR);
    mockFindUnique.mockResolvedValue(apiKeyRow({ expiresAt }));

    const result = await verifyApiKey(reqWithKey(), "claims");
    expect(isAuthError(result)).toBe(true);
    if (!isAuthError(result)) throw new Error("expected AuthError");
    expect(result.status).toBe(401);
    expect(result.body.detail).toMatch(/expired/i);
    expect(result.body.detail).toContain(expiresAt.toISOString());
  });

  it("an expired key consumes no rate-limit quota and records no usage", async () => {
    mockFindUnique.mockResolvedValue(apiKeyRow({ expiresAt: new Date(Date.now() - HOUR) }));

    const result = await verifyApiKey(reqWithKey(), "claims");
    expect(isAuthError(result)).toBe(true);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(prisma.apiKey.update).not.toHaveBeenCalled(); // no lastUsedAt touch
  });

  it("accepts a key whose expiresAt is in the future", async () => {
    mockFindUnique.mockResolvedValue(apiKeyRow({ expiresAt: new Date(Date.now() + HOUR) }));

    const result = await verifyApiKey(reqWithKey(), "claims");
    expect(isAuthError(result)).toBe(false);
    if (isAuthError(result)) throw new Error("expected AuthResult");
    expect(result.keyId).toBe("key-1");
    expect(result.tier).toBe("free");
  });

  it("accepts a key with no expiresAt (non-expiring keys keep working)", async () => {
    mockFindUnique.mockResolvedValue(apiKeyRow({ expiresAt: null }));

    const result = await verifyApiKey(reqWithKey(), "claims");
    expect(isAuthError(result)).toBe(false);
  });

  it("a key both revoked and expired reports revocation (revokedAt checked first)", async () => {
    mockFindUnique.mockResolvedValue(
      apiKeyRow({
        revokedAt: new Date(Date.now() - 2 * HOUR),
        expiresAt: new Date(Date.now() - HOUR),
      }),
    );

    const result = await verifyApiKey(reqWithKey(), "claims");
    expect(isAuthError(result)).toBe(true);
    if (!isAuthError(result)) throw new Error("expected AuthError");
    expect(result.status).toBe(401);
    expect(result.body.detail).toMatch(/revoked/i);
  });

  it("still rejects unknown keys with 401", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await verifyApiKey(reqWithKey(), "claims");
    expect(isAuthError(result)).toBe(true);
    if (!isAuthError(result)) throw new Error("expected AuthError");
    expect(result.status).toBe(401);
  });
});
