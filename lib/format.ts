/** Compact human count for derived stats — "1.76M", "412k", "9,340".
 *  House rule (epistemic-receipts-marketing.md): numbers on marketing surfaces
 *  are always derived from the database, never hand-written. */
export function compactCount(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const s = m >= 10 ? m.toFixed(1) : m.toFixed(2);
    return s.replace(/\.?0+$/, "") + "M";
  }
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  return n.toLocaleString("en-US");
}
