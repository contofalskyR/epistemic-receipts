/**
 * Auth matrix tests — verifies access rules for org API routes.
 * These are unit tests that mock auth/prisma; they document the
 * expected access matrix without needing a live DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next-auth to return controlled sessions
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    membership: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    org: {
      findUnique: vi.fn(),
    },
    orgIpRange: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    orgUsageDaily: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/orgAuth";
import { NextResponse } from "next/server";

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockMembership = prisma.membership.findUnique as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireOrgRole — unauthenticated", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await requireOrgRole("org1", "member");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 401 when session has no user.id", async () => {
    mockAuth.mockResolvedValue({ user: {} });
    const result = await requireOrgRole("org1", "member");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });
});

describe("requireOrgRole — no membership", () => {
  it("returns 403 when user has no membership in org", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockMembership.mockResolvedValue(null);
    const result = await requireOrgRole("org1", "member");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });
});

describe("requireOrgRole — role hierarchy", () => {
  it("member can access member-only routes", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockMembership.mockResolvedValue({ userId: "u1", orgId: "org1", role: "member" });
    const result = await requireOrgRole("org1", "member");
    expect(result).not.toBeInstanceOf(NextResponse);
    expect((result as { role: string }).role).toBe("member");
  });

  it("member cannot access admin-only routes", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockMembership.mockResolvedValue({ userId: "u1", orgId: "org1", role: "member" });
    const result = await requireOrgRole("org1", "admin");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("admin can access admin-only routes", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockMembership.mockResolvedValue({ userId: "u1", orgId: "org1", role: "admin" });
    const result = await requireOrgRole("org1", "admin");
    expect(result).not.toBeInstanceOf(NextResponse);
    expect((result as { role: string }).role).toBe("admin");
  });

  it("admin cannot access owner-only routes", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockMembership.mockResolvedValue({ userId: "u1", orgId: "org1", role: "admin" });
    const result = await requireOrgRole("org1", "owner");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("owner can access owner-only routes", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockMembership.mockResolvedValue({ userId: "u1", orgId: "org1", role: "owner" });
    const result = await requireOrgRole("org1", "owner");
    expect(result).not.toBeInstanceOf(NextResponse);
    expect((result as { role: string }).role).toBe("owner");
  });

  it("owner can access admin routes", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockMembership.mockResolvedValue({ userId: "u1", orgId: "org1", role: "owner" });
    const result = await requireOrgRole("org1", "admin");
    expect(result).not.toBeInstanceOf(NextResponse);
  });
});

describe("requireOrgRole — wrong org", () => {
  it("membership in different org does not grant access", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    // findUnique with composite key userId_orgId — returns null for wrong org
    mockMembership.mockResolvedValue(null);
    const result = await requireOrgRole("org2", "member");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });
});
