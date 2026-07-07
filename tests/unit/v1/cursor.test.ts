import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor } from "@/lib/v1/cursor";

describe("cursor encode/decode", () => {
  it("round-trips a date + id", () => {
    const date = new Date("2024-03-15T10:00:00.000Z");
    const id = "clm_abc123";
    const encoded = encodeCursor(date, id);
    const decoded = decodeCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(id);
    expect(decoded!.createdAt.toISOString()).toBe(date.toISOString());
  });

  it("returns null for garbage input", () => {
    expect(decodeCursor("notbase64!!!")).toBeNull();
    expect(decodeCursor("dGVzdA==")).toBeNull(); // "test" — no pipe
    expect(decodeCursor("")).toBeNull();
  });

  it("returns null for malformed date", () => {
    // base64url of "notadate|someid"
    const bad = Buffer.from("notadate|someid").toString("base64url");
    expect(decodeCursor(bad)).toBeNull();
  });

  it("produces URL-safe base64 (no +/= chars)", () => {
    const cursor = encodeCursor(new Date(), "test-id-123");
    expect(cursor).not.toMatch(/[+/=]/);
  });

  it("handles cuids and long alphanumeric ids", () => {
    const date = new Date("2025-01-01T00:00:00.000Z");
    // Prisma cuids look like "clm_xyz123abc456"
    const id = "clm_xyz123abc456def789";
    const encoded = encodeCursor(date, id);
    const decoded = decodeCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(id);
  });
});
