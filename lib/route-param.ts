// Next 16 hands a page component its dynamic param URL-encoded
// (shared/lib/router/utils/get-dynamic-param.js getParamValue →
// encodeURIComponent), while generateMetadata gets the decoded value. An id
// containing ':' (22,513 ClaimStatusHistory ids, e.g. csh:trajectory:x:1)
// therefore matched in metadata and 404'd in the page.
// tests/unit/route-param.test.ts pins that behaviour, so an upgrade that drops
// the asymmetry shows up there.

/** Decode a page component's dynamic param. Use only in page components —
 *  metadata params are already decoded, and decoding twice would corrupt an id
 *  containing '%'. A malformed escape is returned unchanged. */
export function pageParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
