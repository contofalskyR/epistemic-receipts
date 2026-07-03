import { NextRequest, NextResponse } from "next/server";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

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

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "invalid protocol" }, { status: 400 });
  }

  // Block private/internal IPs
  const host = parsed.hostname;
  if (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local")
  ) {
    return NextResponse.json({ error: "blocked host" }, { status: 403 });
  }

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
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
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
