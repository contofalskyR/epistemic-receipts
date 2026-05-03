export type EmergedPrecision = "DAY" | "MONTH" | "QUARTER" | "YEAR";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function formatEmerged(emergedAt: string, precision: EmergedPrecision): string {
  const d = new Date(emergedAt);
  switch (precision) {
    case "YEAR":    return `${d.getUTCFullYear()}`;
    case "QUARTER": return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
    case "MONTH":   return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    case "DAY":     return d.toISOString().split("T")[0];
  }
}

export function formatAge(emergedAt: string, precision: EmergedPrecision): string {
  const days = Math.floor((Date.now() - new Date(emergedAt).getTime()) / 86_400_000);
  const tilde = precision === "DAY" ? "" : "~";
  const years = (days / 365).toFixed(1);
  const daysStr = days.toLocaleString();
  return days < 365
    ? `${tilde}${daysStr} days old`
    : `${tilde}${daysStr} days old (${tilde}${years} yrs)`;
}
