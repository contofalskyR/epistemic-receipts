/**
 * Integration tests for Spec 00 critical paths.
 * Runs against a real postgres (pgvector/pgvector:pg16) container.
 * Run with: npm run test:integration
 */

// Must be before any imports that use server-only
import { vi } from "vitest";
vi.mock("server-only", () => ({}));

import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
import { seedTestData, type SeedResult } from "./seed";

// Standard PrismaClient — no Neon adapter in tests
const testPrisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

// Inject test client before route handlers are imported
vi.mock("@/lib/prisma", () => ({ prisma: testPrisma }));

// After mocks are registered, import modules under test
import { isReadOnly } from "@/lib/isReadOnly";
import { isAdminRequest } from "@/lib/adminAuth";
import { middleware } from "../middleware";

let seed: SeedResult;

beforeAll(async () => {
  await testPrisma.$connect();
  seed = await seedTestData(testPrisma);
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

// ─── isReadOnly ───────────────────────────────────────────────────────────────

describe("isReadOnly()", () => {
  it("returns false when NODE_ENV is not production", () => {
    const orig = process.env.NODE_ENV;
    // NODE_ENV is "test" in this suite, so isReadOnly() is false
    expect(isReadOnly()).toBe(false);
    void orig; // suppress unused var
  });

  it("returns true in production without ALLOW_EDITS", () => {
    const origEnv = process.env.NODE_ENV;
    const origAllow = process.env.ALLOW_EDITS;
    // @ts-expect-error — overwriting readonly
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_EDITS;
    expect(isReadOnly()).toBe(true);
    // @ts-expect-error
    process.env.NODE_ENV = origEnv;
    if (origAllow !== undefined) process.env.ALLOW_EDITS = origAllow;
  });

  it("returns false in production when ALLOW_EDITS=true", () => {
    const origEnv = process.env.NODE_ENV;
    const origAllow = process.env.ALLOW_EDITS;
    // @ts-expect-error
    process.env.NODE_ENV = "production";
    process.env.ALLOW_EDITS = "true";
    expect(isReadOnly()).toBe(false);
    // @ts-expect-error
    process.env.NODE_ENV = origEnv;
    if (origAllow !== undefined) process.env.ALLOW_EDITS = origAllow;
    else delete process.env.ALLOW_EDITS;
  });
});

// ─── Admin auth (lib/adminAuth.ts) ───────────────────────────────────────────

describe("isAdminRequest()", () => {
  const TEST_TOKEN = "supersecrettesttoken";

  beforeAll(() => {
    process.env.ADMIN_TOKEN = TEST_TOKEN;
  });

  it("returns false with no credentials", () => {
    const req = new Request("http://localhost/api/test", { method: "POST" });
    expect(isAdminRequest(req)).toBe(false);
  });

  it("returns true with correct Bearer token", () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    expect(isAdminRequest(req)).toBe(true);
  });

  it("returns false with wrong Bearer token", () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { Authorization: "Bearer wrongtoken" },
    });
    expect(isAdminRequest(req)).toBe(false);
  });
});

// ─── Middleware auth ──────────────────────────────────────────────────────────

describe("Middleware auth (write gate)", () => {
  const TEST_TOKEN = "ci-test-admin-token-not-secret";

  beforeAll(() => {
    process.env.ADMIN_TOKEN = TEST_TOKEN;
    // @ts-expect-error
    process.env.NODE_ENV = "production"; // auth is enforced only outside dev
    delete process.env.SITE_PASSWORD;
  });

  afterAll(() => {
    // @ts-expect-error
    process.env.NODE_ENV = "test";
  });

  it("POST to /api/claims without credentials → 401", async () => {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/claims", { method: "POST" });
    const res = await middleware(req);
    expect(res.status).toBe(401);
  });

  it("POST to /api/feedback (PUBLIC_WRITE_PATHS) without credentials → not 401", async () => {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/feedback", { method: "POST" });
    const res = await middleware(req);
    // Should not be 401 — feedback is in PUBLIC_WRITE_PATHS
    expect(res.status).not.toBe(401);
  });

  it("POST to /api/login (PUBLIC_WRITE_PATHS) without credentials → not 401", async () => {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/login", { method: "POST" });
    const res = await middleware(req);
    expect(res.status).not.toBe(401);
  });

  it("GET to /api/review without admin credentials → 401", async () => {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/review", { method: "GET" });
    const res = await middleware(req);
    expect(res.status).toBe(401);
  });

  it("GET to /api/review with admin Bearer token → not 401", async () => {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/review", {
      method: "GET",
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    const res = await middleware(req);
    expect(res.status).not.toBe(401);
  });
});

// ─── Search API ───────────────────────────────────────────────────────────────

describe("Search API", () => {
  it("returns seeded claim for a search term", async () => {
    const { GET } = await import("../app/api/search/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/search?q=quantum+entanglement");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    const claimIds = body.claims.map((c: { id: string }) => c.id);
    expect(claimIds).toContain(seed.claimIds[0]); // claim1 = "Quantum entanglement..."
  });

  it("ILIKE injection attempt returns empty, not error", async () => {
    const { GET } = await import("../app/api/search/route");
    const { NextRequest } = await import("next/server");

    const injection = "%' OR 1=1 --";
    const req = new NextRequest(
      `http://localhost/api/search?q=${encodeURIComponent(injection)}`,
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    // Should return no claims (injection doesn't work — params are bound)
    expect(Array.isArray(body.claims)).toBe(true);
    expect(body.claims.length).toBe(0);
  });
});

// ─── Claim detail ─────────────────────────────────────────────────────────────

describe("Claim detail API", () => {
  it("returns edges + sources + statusHistory for a seeded claim", async () => {
    const { getClaimDetail } = await import("@/lib/claim-detail");

    const detail = await getClaimDetail(seed.detailClaimId);

    expect(detail).not.toBeNull();
    expect(detail!.id).toBe(seed.detailClaimId);

    // Has edges
    expect(detail!.edges.length).toBeGreaterThan(0);
    // Edges have source info
    expect(detail!.edges[0].source).toBeDefined();
    expect(detail!.edges[0].source.name).toBeTruthy();

    // Has statusHistory
    expect(detail!.statusHistory.length).toBeGreaterThan(0);
    // StatusHistory has correct shape
    const firstStatus = detail!.statusHistory[0];
    expect(firstStatus.toAxis).toBeTruthy();
    expect(firstStatus.community).toBeTruthy();
    expect(firstStatus.occurredAt).toBeTruthy();
  });
});
