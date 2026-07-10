import { NextRequest, NextResponse } from "next/server";
import { Readability } from "@mozilla/readability";
// linkedom replaces jsdom (2026-07-06): jsdom's dynamic requires crashed the
// deployed Vercel function at module load — the route returned the platform's
// HTML 500 page, so LinkViewer never got a JSON verdict and every source
// preview fell through to "PREVIEW UNAVAILABLE". linkedom is a lightweight
// DOM that bundles cleanly in serverless and is a standard pairing with
// Readability.
import { parseHTML } from "linkedom";
import { assertSafeFetchUrl } from "@/lib/ssrfGuard";

// node:dns (used by the SSRF guard) requires the Node.js runtime.
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB cap on fetched HTML
const FETCH_TIMEOUT = 8_000;

/**
 * Can this response be rendered inside an iframe on OUR origin?
 * Browsers hide this from client-side JS (a frame blocked by
 * X-Frame-Options/CSP is indistinguishable from a loaded cross-origin
 * frame), so the server has to read the headers and tell the client.
 *
 * Per spec, CSP frame-ancestors takes precedence over X-Frame-Options.
 * Absence of both means embedding is allowed.
 */
function frameEmbeddable(
  headers: Headers,
  ourOrigin: string,
  targetOrigin: string
): boolean {
  const our = ourOrigin.toLowerCase();
  const ourHost = new URL(ourOrigin).hostname.toLowerCase();

  // Split on "," too: multiple CSP headers arrive comma-joined via Headers.get,
  // and source lists never contain commas.
  const csp = headers.get("content-security-policy") || "";
  const fa = csp
    .split(/[;,]/)
    .map((d) => d.trim().toLowerCase())
    .find((d) => d.startsWith("frame-ancestors"));

  if (fa) {
    const sources = fa.split(/\s+/).slice(1);
    if (sources.length === 0 || sources.includes("'none'")) return false;
    return sources.some((s) => {
      if (s === "*") return true;
      if (s === "https:" || s === "http:") return our.startsWith(s);
      if (s === "'self'") return targetOrigin.toLowerCase() === our;
      // host-source, e.g. https://example.com, *.example.com, example.com
      const bare = s.replace(/^[a-z+.-]+:\/\//, "").replace(/[/:].*$/, "");
      if (bare.startsWith("*.")) return ourHost.endsWith(bare.slice(1));
      return bare === ourHost;
    });
  }

  const xfo = (headers.get("x-frame-options") || "").trim().toUpperCase();
  if (xfo.includes("DENY")) return false;
  if (xfo.includes("SAMEORIGIN")) return targetOrigin.toLowerCase() === our;
  // Unrecognized values (ALLOW-FROM, ALLOWALL) are ignored by modern browsers.
  return true;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "missing url param" }, { status: 400 });
  }

  // SSRF guard: validates protocol AND resolves DNS, rejecting any host that
  // maps to a private/loopback/link-local/metadata address (incl. decimal-IP,
  // IPv6-mapped, and DNS-rebinding style bypasses the old prefix check missed).
  const safe = await assertSafeFetchUrl(url);
  if (!safe.ok) {
    return NextResponse.json({ error: safe.error }, { status: safe.status });
  }
  const parsed = safe.url;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EpistemicReceipts/1.0; +https://epistemic-receipts.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timer);

    // Best effort even on upstream errors: bot-walled sites (403 to us)
    // usually send the same framing headers on their error pages.
    const embeddable = frameEmbeddable(
      res.headers,
      req.nextUrl.origin,
      parsed.origin
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `upstream ${res.status}`, embeddable },
        { status: 502 }
      );
    }

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("xhtml")) {
      return NextResponse.json(
        { error: "not html", contentType: ct, embeddable },
        { status: 422 }
      );
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: "too large", embeddable },
        { status: 413 }
      );
    }

    const html = new TextDecoder().decode(buf);
    const { document } = parseHTML(html);

    // jsdom resolved relative URLs via its { url } option; linkedom doesn't,
    // so absolutize src/href/srcset against the target page before extraction —
    // otherwise images and links in reader view resolve against OUR origin.
    const absolutize = (el: Element, attr: string) => {
      const v = el.getAttribute(attr);
      if (!v || /^(https?:|data:|mailto:|tel:|#|javascript:)/i.test(v)) return;
      try {
        el.setAttribute(attr, new URL(v, url).toString());
      } catch {
        /* leave malformed values untouched */
      }
    };
    for (const el of document.querySelectorAll("[src]")) absolutize(el as Element, "src");
    for (const el of document.querySelectorAll("[href]")) absolutize(el as Element, "href");
    for (const el of document.querySelectorAll("[srcset]")) {
      const v = (el as Element).getAttribute("srcset");
      if (!v) continue;
      const rewritten = v
        .split(",")
        .map((part) => {
          const bits = part.trim().split(/\s+/);
          const u = bits.shift();
          if (!u) return part.trim();
          if (/^(https?:|data:)/i.test(u)) return part.trim();
          try {
            return [new URL(u, url).toString(), ...bits].join(" ");
          } catch {
            return part.trim();
          }
        })
        .join(", ");
      (el as Element).setAttribute("srcset", rewritten);
    }

    const reader = new Readability(document as unknown as Document);
    const article = reader.parse();

    if (!article || !article.content) {
      return NextResponse.json(
        { error: "extraction failed", embeddable },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        embeddable,
        title: article.title || null,
        byline: article.byline || null,
        siteName: article.siteName || null,
        excerpt: article.excerpt || null,
        content: article.content,
        textContent: article.textContent?.slice(0, 500) || null,
        length: article.length || 0,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    if (msg.includes("abort")) {
      return NextResponse.json(
        { error: "timeout", embeddable: null },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: msg, embeddable: null }, { status: 502 });
  }
}
