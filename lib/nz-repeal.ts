/**
 * lib/nz-repeal.ts — repeal-statement extraction for nz_repealed_acts_v1.
 *
 * Extracted verbatim from scripts/event-pipelines/nz-repealed-prepend.ts so the
 * read-only probes (scripts/probe-nz-api*.ts) can exercise the EXACT production
 * regex without importing the pipeline script (whose top-level main() would run).
 * The pipeline imports from here — one copy, no drift.
 */

const NZ_MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** "1 April 1988" → "1988-04-01" */
export function parseNzDate(s: string): string | null {
  const m = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(s);
  if (!m) return null;
  const month = NZ_MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
}

/** Tag-strip + whitespace-squash — the text extractRepeal matches against. */
export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

/** Extract "Repealed, on 1 April 1988, by section 2 of the …" from an act page. */
export function extractRepeal(
  html: string,
): { repealedAt: string; repealedBy: string | null } | null {
  const text = stripTags(html);
  // by-clause may contain "section 92(1)"-style parens; terminate on a period
  // or the trailing act citation " (1992 No 76)" — not on any "(".
  // "the close of" variant: some notes read "repealed, on the close of
  // 31 December 2013, by …" — the stated date is the honest DAY.
  const m =
    /[Rr]epealed\s*,?\s+on\s+(?:the\s+close\s+of\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})(?:\s*,?\s+by\s+([^.]{3,220}?))?(?:\.|\s\(\d{4}\s)/.exec(
      text,
    );
  if (!m) return null;
  const repealedAt = parseNzDate(m[1]);
  if (!repealedAt) return null;
  return { repealedAt, repealedBy: m[2]?.trim() ?? null };
}
