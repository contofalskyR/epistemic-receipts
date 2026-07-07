// ── Display-text sanitation for ingested content ─────────────────────────────
// Some pipelines store text that isn't display-clean:
//   • OpenAlex abstracts carry literal HTML tags — "<i>Context. <i/>…" rendered
//     verbatim in search results (AUDIT-PRELAUNCH-2026-07-06 §11).
//   • CrossRef retraction titles arrive entity-encoded — "Science &amp; Justice"
//     double-escapes on retraction cards.
// These helpers clean at DISPLAY time only; stored data is never mutated
// (provenance stays byte-exact with the source).

/** Strip HTML tags (incl. malformed ones like "<i/>") from ingested text. */
export function stripHtmlTags(s: string): string {
  return s.replace(/<\/?[a-zA-Z][^<>]*\/?>/g, "");
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

/** Decode common HTML entities (named + numeric). Safe under React: the
 *  decoded string is rendered as text, so decoding cannot introduce markup. */
export function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
}

/** Full display cleanup: strip real markup tags FIRST, then decode entities,
 *  then collapse whitespace. Order matters — decoding first would turn an
 *  entity-encoded "&lt;test&gt;" into "<test>" and the tag-strip would then
 *  eat it. Stripping first removes only genuine tags and preserves
 *  entity-encoded angle brackets as literal text. (React escapes the result,
 *  so decoding can never introduce live markup.) */
export function cleanDisplayText(s: string): string {
  return decodeHtmlEntities(stripHtmlTags(s)).replace(/\s+/g, " ").trim();
}
