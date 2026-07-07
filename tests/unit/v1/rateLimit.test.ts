/**
 * Spec 20 — Rate limit unit tests
 * Tests tier limits, fail-open behavior, and usage tracking.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TIER_LIMITS, DAILY_LIMITS } from "@/lib/v1/rateLimit";

describe("TIER_LIMITS", () => {
  it("free tier is 60 req/min", () => {
    expect(TIER_LIMITS.free).toBe(60);
  });

  it("pro tier is 600 req/min", () => {
    expect(TIER_LIMITS.pro).toBe(600);
  });

  it("team tier is 3000 req/min", () => {
    expect(TIER_LIMITS.team).toBe(3000);
  });

  it("enterprise tier is 10000 req/min", () => {
    expect(TIER_LIMITS.enterprise).toBe(10000);
  });

  it("tiers are ordered free < pro < team < enterprise", () => {
    expect(TIER_LIMITS.free).toBeLessThan(TIER_LIMITS.pro);
    expect(TIER_LIMITS.pro).toBeLessThan(TIER_LIMITS.team);
    expect(TIER_LIMITS.team).toBeLessThan(TIER_LIMITS.enterprise);
  });
});

describe("DAILY_LIMITS", () => {
  it("free tier has 10k/day limit", () => {
    expect(DAILY_LIMITS.free).toBe(10000);
  });

  it("enterprise tier has Infinity daily limit", () => {
    expect(DAILY_LIMITS.enterprise).toBe(Infinity);
  });
});

describe("checkRateLimit — fail-open behavior", () => {
  it("fails open when Upstash env vars are not set", async () => {
    const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
    const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { checkRateLimit } = await import("@/lib/v1/rateLimit");
    const result = await checkRateLimit("test-key-id", "free");

    // Must allow the request (fail-open)
    expect(result.allowed).toBe(true);

    // Restore
    if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });
});
