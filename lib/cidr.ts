// Pure JS CIDR matching — no Node.js imports, safe in Edge runtime.
// Supports IPv4 (e.g. 192.168.1.0/24) and IPv6 (e.g. 2001:db8::/32).

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = parseInt(p, 10);
    if (isNaN(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function expandIPv6(ip: string): bigint | null {
  try {
    let full = ip;
    if (full.includes("::")) {
      const [left, right] = full.split("::");
      const leftGroups = left ? left.split(":") : [];
      const rightGroups = right ? right.split(":") : [];
      const missing = 8 - leftGroups.length - rightGroups.length;
      const middle = Array(missing).fill("0");
      full = [...leftGroups, ...middle, ...rightGroups].join(":");
    }
    const groups = full.split(":");
    if (groups.length !== 8) return null;
    let n = 0n;
    for (const g of groups) {
      const v = parseInt(g || "0", 16);
      if (isNaN(v) || v < 0 || v > 65535) return null;
      n = (n << 16n) | BigInt(v);
    }
    return n;
  } catch {
    return null;
  }
}

type ParsedCidr =
  | { version: 4; network: number; prefix: number }
  | { version: 6; network: bigint; prefix: number };

export function parseCidr(cidr: string): ParsedCidr | null {
  const slash = cidr.lastIndexOf("/");
  if (slash === -1) return null;
  const ip = cidr.slice(0, slash);
  const prefix = parseInt(cidr.slice(slash + 1), 10);

  if (ip.includes(":")) {
    if (isNaN(prefix) || prefix < 0 || prefix > 128) return null;
    const network = expandIPv6(ip);
    if (network === null) return null;
    return { version: 6, network: prefix === 0 ? 0n : network & ~((1n << BigInt(128 - prefix)) - 1n), prefix };
  } else {
    if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;
    const addr = ipv4ToInt(ip);
    if (addr === null) return null;
    const mask = prefix === 32 ? 0xffffffff : ~((1 << (32 - prefix)) - 1) >>> 0;
    return { version: 4, network: (addr & mask) >>> 0, prefix };
  }
}

export function cidrContains(cidr: string, ip: string): boolean {
  const parsed = parseCidr(cidr);
  if (!parsed) return false;

  if (ip.includes(":")) {
    if (parsed.version !== 6) return false;
    const addr = expandIPv6(ip);
    if (addr === null) return false;
    const prefix = parsed.prefix;
    if (prefix === 0) return true;
    const bits = 128 - prefix;
    return (addr >> BigInt(bits)) === (parsed.network >> BigInt(bits));
  } else {
    if (parsed.version !== 4) return false;
    const addr = ipv4ToInt(ip);
    if (addr === null) return false;
    if (parsed.prefix === 0) return true;
    const shift = 32 - parsed.prefix;
    return (addr >>> shift) === (parsed.network >>> shift);
  }
}

export function validateCidr(cidr: string, confirmFlag = false): string | null {
  const parsed = parseCidr(cidr);
  if (!parsed) return "Invalid CIDR notation";

  if (parsed.version === 4) {
    if (parsed.prefix === 0) return "Cannot use 0.0.0.0/0 (entire internet)";
    if (parsed.prefix < 16 && !confirmFlag)
      return `Prefix /${parsed.prefix} covers more than /16. Set confirmFlag to proceed.`;
  } else {
    if (parsed.prefix === 0) return "Cannot use ::/0 (entire internet)";
    if (parsed.prefix < 32 && !confirmFlag)
      return `Prefix /${parsed.prefix} covers more than /32. Set confirmFlag to proceed.`;
  }
  return null;
}
