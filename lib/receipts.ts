// One transition = one receipt page (/receipts/[id]).

/** Link to a transition's receipt. Colons stay raw: WHATWG keeps ':' unescaped
 *  in paths, and middleware 308-redirects an encoded alias (%3A) to this
 *  spelling, so an encoded link would always cost a redirect. */
export function receiptHref(id: string): string {
  return "/receipts/" + encodeURIComponent(id).replace(/%3A/gi, ":");
}
