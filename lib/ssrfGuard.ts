import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF guard for server-side URL fetching (reader proxy, link previews, etc.).
 *
 * The prior string-prefix blocklist (`host.startsWith("127.")` etc.) missed
 * several ways to reach internal targets:
 *   - 169.254.169.254 / metadata.google.internal (cloud metadata endpoints)
 *   - 172.16.0.0/12 (private range not covered by the 10./192.168. checks)
 *   - decimal / hex / octal IP encodings that resolve to loopback
 *   - IPv6-mapped IPv4 ([::ffff:127.0.0.1]) and IPv6 ULA (fc00::/7)
 *   - DNS names that resolve to any of the above (DNS rebinding / *.nip.io)
 *
 * This guard resolves the hostname to its actual IP(s) and rejects the request
 * if ANY resolved address falls in a blocked range. Callers must run on the
 * Node.js runtime (node:dns is unavailable on the Edge runtime).
 *
 * NOTE: This checks the address at validation time. A determined attacker can
 * still rebind DNS between this lookup and the fetch (TOCTOU). For full
 * protection, pair this with fetching by resolved IP + SNI/Host header, or an
 * egress proxy/allowlist. This guard closes the common cases; the residual
 * TOCTOU window is documented as an accepted risk unless the endpoint is
 * exposed to untrusted callers at scale.
 */

function ipv4ToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let long = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    long = long * 256 + n;
  }
  return long >>> 0;
}

function isBlockedIPv4(ip: string): boolean {
  const long = ipv4ToLong(ip);
  if (long === null) return true; // unparseable → treat as blocked

  const inRange = (cidrBase: string, bits: number) => {
    const base = ipv4ToLong(cidrBase);
    if (base === null) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (long & mask) === (base & mask);
  };

  return (
    inRange("0.0.0.0", 8) ||        // "this" network
    inRange("10.0.0.0", 8) ||       // private
    inRange("100.64.0.0", 10) ||    // carrier-grade NAT
    inRange("127.0.0.0", 8) ||      // loopback
    inRange("169.254.0.0", 16) ||   // link-local (incl. 169.254.169.254 metadata)
    inRange("172.16.0.0", 12) ||    // private
    inRange("192.0.0.0", 24) ||     // IETF protocol assignments
    inRange("192.168.0.0", 16) ||   // private
    inRange("198.18.0.0", 15) ||    // benchmarking
    inRange("224.0.0.0", 4) ||      // multicast
    inRange("240.0.0.0", 4)         // reserved
  );
}

function normalizeIPv6(ip: string): string {
  return ip.toLowerCase().replace(/^\[|\]$/g, "");
}

function isBlockedIPv6(ip: string): boolean {
  const addr = normalizeIPv6(ip);

  // IPv4-mapped (::ffff:127.0.0.1) and IPv4-compatible → check embedded v4
  const mapped = addr.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);

  return (
    addr === "::1" ||               // loopback
    addr === "::" ||                // unspecified
    addr.startsWith("fe80:") ||     // link-local
    addr.startsWith("fc") ||        // unique local (fc00::/7)
    addr.startsWith("fd") ||        // unique local (fc00::/7)
    addr.startsWith("ff")           // multicast
  );
}

function isBlockedAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedIPv4(ip);
  if (kind === 6) return isBlockedIPv6(ip);
  return true; // not a valid IP literal → block
}

export type SsrfCheckResult =
  | { ok: true; url: URL }
  | { ok: false; status: number; error: string };

/**
 * Validate a user-supplied URL for server-side fetching.
 * Resolves the hostname and rejects any request targeting a private,
 * loopback, link-local, or otherwise-internal address.
 */
export async function assertSafeFetchUrl(raw: string): Promise<SsrfCheckResult> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, status: 400, error: "invalid url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, status: 400, error: "invalid protocol" };
  }

  const host = url.hostname.toLowerCase();

  // Fast-path denies for well-known internal names (before DNS)
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    return { ok: false, status: 403, error: "blocked host" };
  }

  // If the host is already an IP literal, check it directly.
  const literalKind = isIP(host);
  if (literalKind !== 0) {
    if (isBlockedAddress(host)) {
      return { ok: false, status: 403, error: "blocked host" };
    }
    return { ok: true, url };
  }

  // Otherwise resolve DNS and block if ANY resolved address is internal.
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    return { ok: false, status: 502, error: "dns resolution failed" };
  }

  if (addresses.length === 0) {
    return { ok: false, status: 502, error: "dns resolution failed" };
  }

  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      return { ok: false, status: 403, error: "blocked host" };
    }
  }

  return { ok: true, url };
}
