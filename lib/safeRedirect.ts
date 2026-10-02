// Where /login sends the browser after a successful sign-in: the `from` path
// the Lab gate put in the URL (middleware.ts), but only if it stays on this
// origin. A leading "/" is not enough — the URL parser turns "\" into "/" and
// drops tabs and newlines, so "/\evil.example/" and "/<TAB>/evil.example" are
// protocol-relative once parsed (front door phase 6, 2026-10-01).

/** Post-login destination: a path on `origin`, otherwise "/". */
export function safeRedirectPath(from: string | null | undefined, origin: string): string {
  if (!from || !from.startsWith("/")) return "/";
  try {
    const base = new URL(origin).origin;
    const u = new URL(from, base);
    if (u.origin !== base) return "/";
    const dest = u.pathname + u.search + u.hash;
    // The browser re-parses `dest` against the /login URL, and dot segments can
    // normalise to a protocol-relative path ("/.//evil.example" → "//evil.example"):
    // keep it only if it resolves back to this very URL.
    return new URL(dest, base).href === u.href ? dest : "/";
  } catch {
    return "/";
  }
}
