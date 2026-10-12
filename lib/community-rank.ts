import { compactCount } from "@/lib/format";

// /communities: which community is largest and smallest, derived from the
// page's own live counts (the notes used to type "~1.1M" and rankings that
// had stopped being true).

export type CommunityCount = { claims: number; transitions: number };

const LABEL: Record<string, string> = {
  EXPERT_LITERATURE: "Expert literature",
  INSTITUTIONAL: "Institutional",
  JUDICIAL: "Judicial",
  PUBLIC: "Public record",
  MARKET: "Market",
};

function extremes(counts: Map<string, CommunityCount>, key: keyof CommunityCount): string | null {
  const rows = [...counts].sort((a, b) => b[1][key] - a[1][key]);
  if (rows.length < 2) return null;
  const [big, small] = [rows[0], rows[rows.length - 1]];
  const name = (k: string) => LABEL[k] ?? k;
  return `largest ${name(big[0])} (${compactCount(big[1][key])}), smallest ${name(small[0])} (${compactCount(small[1][key])})`;
}

/** "By claims: largest Institutional (1.16M), smallest Market (94). By transitions: …" */
export function communityRankLine(counts: Map<string, CommunityCount>): string | null {
  const byClaims = extremes(counts, "claims");
  const byTransitions = extremes(counts, "transitions");
  if (!byClaims || !byTransitions) return null;
  return `By claims: ${byClaims}. By transitions: ${byTransitions}.`;
}
