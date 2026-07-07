/**
 * Ownership enforcement tests for spec/31.
 * These test the auth guards on collection + alert routes by mocking
 * the auth() call and prisma. They verify that cross-user access is rejected.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock auth and prisma before importing routes
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    collection: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    collectionItem: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    topicSubscription: {
      findFirst: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as ReturnType<typeof vi.fn>;

describe("Collections — ownership enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/collections returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/collections/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET /api/collections/[id] returns 404 for another user's collection", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-A" } });
    (prisma.collection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { GET } = await import("@/app/api/collections/[id]/route");
    const req = new NextRequest("http://localhost/api/collections/other-col");
    const res = await GET(req, { params: Promise.resolve({ id: "other-col" }) });
    expect(res.status).toBe(404);

    // Verify the query included ownerId = user-A
    expect(prisma.collection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerId: "user-A" }),
      }),
    );
  });

  it("DELETE /api/collections/[id] returns 404 for another user's collection", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-A" } });
    (prisma.collection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/collections/[id]/route");
    const req = new NextRequest("http://localhost/api/collections/other-col");
    const res = await DELETE(req, { params: Promise.resolve({ id: "other-col" }) });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/collections/[id]/items/[claimId] returns 404 cross-user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-A" } });
    // findFirst for collection returns null (not owned by user-A)
    (prisma.collection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/collections/[id]/items/[claimId]/route");
    const req = new NextRequest("http://localhost/api/collections/col1/items/claim1");
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "col1", claimId: "claim1" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("Alerts — ownership enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/alerts returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/alerts/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("DELETE /api/alerts/[id] returns 404 for another user's alert", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-A" } });
    (prisma.topicSubscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/alerts/[id]/route");
    const req = new NextRequest("http://localhost/api/alerts/alert1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "alert1" }) });
    expect(res.status).toBe(404);

    // Verify userId filter was applied
    expect(prisma.topicSubscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-A" }),
      }),
    );
  });
});
