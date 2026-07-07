import { describe, it, expect } from "vitest";
import { parseCidr, cidrContains, validateCidr } from "@/lib/cidr";

describe("parseCidr", () => {
  it("parses a valid IPv4 CIDR", () => {
    const result = parseCidr("192.168.1.0/24");
    expect(result).not.toBeNull();
    expect(result?.prefix).toBe(24);
  });

  it("parses a valid IPv6 CIDR", () => {
    const result = parseCidr("2001:db8::/32");
    expect(result).not.toBeNull();
    expect(result?.prefix).toBe(32);
  });

  it("returns null for invalid input", () => {
    expect(parseCidr("not-a-cidr")).toBeNull();
    expect(parseCidr("300.0.0.0/24")).toBeNull();
    expect(parseCidr("192.168.1.0/33")).toBeNull();
  });

  it("returns null for missing prefix", () => {
    expect(parseCidr("192.168.1.0")).toBeNull();
  });
});

describe("cidrContains", () => {
  it("matches IP in range", () => {
    expect(cidrContains("10.0.0.0/24", "10.0.0.1")).toBe(true);
    expect(cidrContains("10.0.0.0/24", "10.0.0.254")).toBe(true);
  });

  it("rejects IP outside range", () => {
    expect(cidrContains("10.0.0.0/24", "10.0.1.0")).toBe(false);
    expect(cidrContains("10.0.0.0/24", "192.168.0.1")).toBe(false);
  });

  it("matches exact host /32", () => {
    expect(cidrContains("203.0.113.42/32", "203.0.113.42")).toBe(true);
    expect(cidrContains("203.0.113.42/32", "203.0.113.43")).toBe(false);
  });

  it("matches IPv6 in range", () => {
    expect(cidrContains("2001:db8::/32", "2001:db8::1")).toBe(true);
    expect(cidrContains("2001:db8::/32", "2001:db9::1")).toBe(false);
  });

  it("returns false for unknown/invalid IP", () => {
    expect(cidrContains("10.0.0.0/24", "unknown")).toBe(false);
    expect(cidrContains("10.0.0.0/24", "")).toBe(false);
  });

  it("returns false for mismatched address families", () => {
    expect(cidrContains("10.0.0.0/24", "::1")).toBe(false);
    expect(cidrContains("2001:db8::/32", "10.0.0.1")).toBe(false);
  });

  it("matches network address itself", () => {
    expect(cidrContains("10.0.0.0/24", "10.0.0.0")).toBe(true);
  });

  it("handles /16 boundary correctly", () => {
    expect(cidrContains("172.16.0.0/16", "172.16.255.255")).toBe(true);
    expect(cidrContains("172.16.0.0/16", "172.17.0.0")).toBe(false);
  });
});

describe("validateCidr", () => {
  it("accepts standard /24 without confirmFlag", () => {
    expect(validateCidr("10.0.0.0/24")).toBeNull();
  });

  it("accepts /16 (minimum allowed without confirm)", () => {
    expect(validateCidr("10.0.0.0/16")).toBeNull();
  });

  it("rejects prefix shorter than /16 without confirmFlag", () => {
    const err = validateCidr("10.0.0.0/15");
    expect(err).not.toBeNull();
    expect(err).toMatch(/broad/i);
  });

  it("accepts prefix shorter than /16 with confirmFlag", () => {
    expect(validateCidr("10.0.0.0/15", true)).toBeNull();
  });

  it("rejects /0", () => {
    expect(validateCidr("0.0.0.0/0", true)).not.toBeNull();
  });

  it("rejects invalid CIDR strings", () => {
    expect(validateCidr("not-cidr")).not.toBeNull();
  });

  it("accepts /32 minimum IPv6 without confirm", () => {
    expect(validateCidr("2001:db8::/32")).toBeNull();
  });

  it("rejects IPv6 shorter than /32 without confirm", () => {
    expect(validateCidr("2001::/16")).not.toBeNull();
  });
});
