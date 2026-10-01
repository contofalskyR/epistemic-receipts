import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isPublicRoute } from "@/lib/publicEdition";
import { isKnownRoute } from "@/lib/routeManifest";

// Front door phase 4 (STATUS.md, 2026-09-30): link integrity, in CI.
//
// Two invariants over app/, components/ and lib/:
//
//   1. No anonymous page links into the Lab. "Anonymous page" = every file a
//      public route renders: the page, the layout/template/error/not-found
//      files on its path, and the transitive closure of their local imports —
//      app/components/Nav.tsx via app/layout.tsx, components/*, lib/* data
//      such as lib/discovery-rail.ts. The phase 2 test judged an app/ file by
//      the directory it sat in, so a component or lib constant used by a
//      public page was never checked, and template hrefs were skipped.
//
//   2. Every internal href, on any page, points at a page that exists
//      (lib/route-manifest.json, generated from app/**/page.tsx), an API route
//      that exists (app/api/**/route.ts), or a file in public/. Phase 3
//      deleted ~40 pages; a stale link is a real 404 now, not a login redirect.
//
// Template hrefs are judged by shape: each `${…}` becomes one placeholder
// segment, so `/claims/${id}` is judged as /claims/_ (a public pattern) and
// `/members/${id}` as /members/_ (Lab). A fully dynamic first segment
// (`/${slug}`) has no checkable target and counts as Lab on an anonymous page.

const ROOT = path.resolve(__dirname, "../..");
const APP = path.join(ROOT, "app");
const SCAN_DIRS = ["app", "components", "lib"];

/** Lab hrefs on the anonymous surface that an anonymous visitor never sees.
 *  Region-scoped: hrefs in `file` between `from` and the first `to` after it
 *  are exempt from invariant 1 only — they must still exist. Adding a row is
 *  a decision: write the reason. */
const ADMIN_ONLY_REGIONS: { file: string; from: string; to: string; reason: string }[] = [
  {
    file: "app/components/Nav.tsx",
    from: "const LAB_SECTIONS",
    to: "\n];",
    reason: "⚗ Lab dropdown — rendered only after GET /api/login confirms the admin session, and self-filtered through isPublicRoute",
  },
];

// ─── Files ───────────────────────────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");

/** Commented-out code is not a link. Line numbers are preserved so a report
 *  points at the real line. */
function stripComments(src: string): string {
  const newlinesOnly = (m: string) => m.replace(/[^\n]/g, "");
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, newlinesOnly)
    .replace(/\/\*[\s\S]*?\*\//g, newlinesOnly)
    .replace(/(^|[^:\\"'`])\/\/.*$/gm, "$1");
}

const read = (() => {
  const cache = new Map<string, string>();
  return (file: string): string => {
    let s = cache.get(file);
    if (s === undefined) {
      s = stripComments(fs.readFileSync(file, "utf8"));
      cache.set(file, s);
    }
    return s;
  };
})();

/** The route a file under app/ renders, as a path isPublicRoute can judge:
 *  app/foo/bar/page.tsx -> /foo/bar, app/claims/[id]/page.tsx -> /claims/_id. */
function owningRoute(file: string): string {
  const segs = path
    .relative(APP, file)
    .split(path.sep)
    .slice(0, -1)
    .filter((s) => !s.startsWith("(") && !s.startsWith("_"))
    .map((s) => s.replace(/^\[\.{0,3}(\w+)\]$/, "_$1"));
  return segs.length ? "/" + segs.join("/") : "/";
}

// ─── Import graph ────────────────────────────────────────────────────────────

const IMPORT_RE =
  /(?:^|[^\w$.])(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']|\b(?:import|require)\(\s*["']([^"']+)["']\s*\)/g;

/** Resolve one import specifier to a .ts/.tsx file in the repo, or null. */
function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null; // a package
  const candidates = [base, `${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")];
  for (const c of candidates) {
    if (/\.(tsx|ts)$/.test(c) && fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null; // .json/.css/.svg — no hrefs live there
}

function localImports(file: string): string[] {
  const out: string[] = [];
  for (const m of read(file).matchAll(IMPORT_RE)) {
    const target = resolveImport(file, m[1] ?? m[2]);
    if (target) out.push(target);
  }
  return out;
}

const SPECIAL_FILES = ["layout.tsx", "template.tsx", "error.tsx", "global-error.tsx", "not-found.tsx", "loading.tsx"];

/** Everything a public route renders: the public page.tsx files, the special
 *  files on their paths, the root not-found/error pages, and the transitive
 *  closure of local imports. Each file maps to the file that first reached it. */
function anonymousSurface(): Map<string, string> {
  const roots = new Set<string>();
  for (const page of walk(APP).filter((f) => path.basename(f) === "page.tsx")) {
    if (!isPublicRoute(owningRoute(page))) continue;
    roots.add(page);
    let dir = path.dirname(page);
    for (;;) {
      for (const s of SPECIAL_FILES) {
        const f = path.join(dir, s);
        if (fs.existsSync(f)) roots.add(f);
      }
      if (dir === APP) break;
      dir = path.dirname(dir);
    }
  }
  for (const s of ["not-found.tsx", "global-error.tsx", "error.tsx"]) {
    const f = path.join(APP, s);
    if (fs.existsSync(f)) roots.add(f);
  }

  const via = new Map<string, string>();
  const queue = [...roots];
  for (const r of roots) via.set(r, "(public page)");
  while (queue.length) {
    const file = queue.shift()!;
    for (const dep of localImports(file)) {
      if (via.has(dep)) continue;
      via.set(dep, file);
      queue.push(dep);
    }
  }
  return via;
}

// ─── Href extraction ─────────────────────────────────────────────────────────
//
// An href is a string or template literal that starts with "/" inside the value
// of an `href=`/`href:` (JSX attribute or object property) or the argument list
// of a client-side navigation call. Template literals keep a "\0" placeholder
// where each `${…}` was.

const ANCHOR_RE =
  /\bhref\s*(?:=(?!=)|:)|\brouter\.(?:push|replace)\s*\(|\b(?:permanentRedirect|redirect)\s*\(|\blocation\.(?:href\s*=(?!=)|assign\s*\(|replace\s*\()|\bwindow\.open\s*\(/g;

const PLACEHOLDER = "\0";

function readString(src: string, i: number): { text: string; end: number } {
  const q = src[i];
  let out = "";
  for (i++; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") {
      out += src[i + 1] ?? "";
      i++;
    } else if (c === q) break;
    else out += c;
  }
  return { text: out, end: i };
}

function readTemplate(src: string, i: number): { text: string; end: number } {
  let out = "";
  for (i++; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") {
      out += src[i + 1] ?? "";
      i++;
    } else if (c === "`") break;
    else if (c === "$" && src[i + 1] === "{") {
      let depth = 0;
      for (i += 2; i < src.length; i++) {
        const d = src[i];
        if (d === '"' || d === "'") i = readString(src, i).end;
        else if (d === "`") i = readTemplate(src, i).end;
        else if (d === "{") depth++;
        else if (d === "}") {
          if (depth === 0) break;
          depth--;
        }
      }
      out += PLACEHOLDER;
    } else out += c;
  }
  return { text: out, end: i };
}

type Href = { literal: string; line: number };

/** Every "/…" literal in the value expression that starts at `start`: a `{…}`
 *  JSX expression or `(…)` argument list (balanced), one quoted literal, or a
 *  bare expression up to the next `,` `;` `}` `)` or newline at depth 0. */
function collectHrefs(src: string, start: number): Href[] {
  let i = start;
  while (i < src.length && /[ \t]/.test(src[i])) i++;
  const opener = src[i];
  const block = opener === "{" || opener === "(";
  const closer = opener === "{" ? "}" : ")";
  if (block) i++;
  const out: Href[] = [];
  const push = (text: string, at: number) => {
    if (text.startsWith("/") && !text.startsWith("//")) {
      out.push({ literal: text, line: src.slice(0, at).split("\n").length });
    }
  };
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const s = readString(src, i);
      push(s.text, i);
      i = s.end;
      if (!block && depth === 0 && opener === c) break; // href="…" — just the literal
    } else if (c === "`") {
      const t = readTemplate(src, i);
      push(t.text, i);
      i = t.end;
      if (!block && depth === 0 && opener === "`") break;
    } else if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") {
      if (depth === 0) {
        if (!block || c === closer) break;
      } else depth--;
    } else if (!block && depth === 0 && (c === "," || c === ";" || c === "\n")) break;
  }
  return out;
}

function hrefsIn(file: string): Href[] {
  const src = read(file);
  const out: Href[] = [];
  for (const m of src.matchAll(ANCHOR_RE)) {
    const start = m[0].endsWith("(") ? m.index! + m[0].length - 1 : m.index! + m[0].length;
    out.push(...collectHrefs(src, start));
  }
  return out;
}

/** The path a literal points at, with each placeholder as one "_" segment.
 *  A textual `${…}` (an href inside HTML built in a template string) is a
 *  placeholder too. A trailing placeholder glued to a segment —
 *  `/opinions${qs ? "?" + qs : ""}` — is an optional query string, not a
 *  segment, and is dropped. */
function judgedPath(literal: string): string {
  const p = literal
    .split(/[?#]/)[0]
    .replace(/\$\{[^}]*\}/g, PLACEHOLDER)
    .replace(new RegExp(`([^/])${PLACEHOLDER}$`), "$1")
    .split(PLACEHOLDER)
    .join("_");
  return p.length > 1 ? p.replace(/\/+$/, "") : p || "/";
}

// ─── Targets that exist ──────────────────────────────────────────────────────

// Every route.ts under app/api as a segment list; "_" is a dynamic segment, "*" a catch-all.
const API_ROUTES: string[][] = walk(path.join(APP, "api"))
  .filter((f) => /^route\.tsx?$/.test(path.basename(f)))
  .map((f) =>
    path
      .relative(APP, path.dirname(f))
      .split(path.sep)
      .map((s) => (/^\[\.\.\./.test(s) ? "*" : /^\[.+\]$/.test(s) ? "_" : s)),
  );

function apiRouteExists(p: string): boolean {
  const segs = p.split("/").filter(Boolean);
  return API_ROUTES.some((route) =>
    route.every((s, i) => (s === "*" ? i < segs.length : s === "_" ? segs[i] !== undefined : s === segs[i])) &&
    (route.includes("*") || route.length === segs.length),
  );
}

const SITEMAP_RE = /^\/sitemap(?:-index)?\.xml$|^\/sitemap\/[^/]+\.xml$/;

function targetExists(p: string): boolean {
  if (p.startsWith("/api/")) return apiRouteExists(p) || fs.existsSync(path.join(ROOT, "public", p));
  if (/\.[a-z0-9]{1,5}$/i.test(p)) return SITEMAP_RE.test(p) || fs.existsSync(path.join(ROOT, "public", p));
  return isKnownRoute(p);
}

const isPagePath = (p: string) => !p.startsWith("/api/") && !/\.[a-z0-9]{1,5}$/i.test(p);

// ─── The two invariants ──────────────────────────────────────────────────────

function exemptLines(file: string): { lines: Set<number>; missing: string[] } {
  const lines = new Set<number>();
  const missing: string[] = [];
  for (const r of ADMIN_ONLY_REGIONS) {
    if (rel(file) !== r.file) continue;
    const src = read(file);
    const from = src.indexOf(r.from);
    const to = from < 0 ? -1 : src.indexOf(r.to, from);
    if (from < 0 || to < 0) {
      missing.push(`${r.file}: region "${r.from}" … "${r.to.trim()}" not found — update ADMIN_ONLY_REGIONS`);
      continue;
    }
    const first = src.slice(0, from).split("\n").length;
    const last = src.slice(0, to).split("\n").length;
    for (let l = first; l <= last; l++) lines.add(l);
  }
  return { lines, missing };
}

describe("link integrity: no anonymous page links into the Lab", () => {
  const surface = anonymousSurface();
  const files = [...surface.keys()];

  it("covers the public pages, the root layout, Nav, components/ and lib/", () => {
    const names = new Set(files.map(rel));
    expect(names.has("app/page.tsx")).toBe(true);
    expect(names.has("app/layout.tsx")).toBe(true);
    expect(names.has("app/components/Nav.tsx")).toBe(true);
    expect(names.has("app/claims/[id]/page.tsx")).toBe(true);
    expect(names.has("lib/discovery-rail.ts")).toBe(true);
    expect(files.filter((f) => rel(f).startsWith("components/")).length).toBeGreaterThan(0);
    expect(files.length).toBeGreaterThan(60);
  });

  const offenders: string[] = [];
  const brokenRegions: string[] = [];
  for (const file of files) {
    const { lines, missing } = exemptLines(file);
    brokenRegions.push(...missing);
    for (const h of hrefsIn(file)) {
      const p = judgedPath(h.literal);
      if (!isPagePath(p) || isPublicRoute(p) || lines.has(h.line)) continue;
      const shown = h.literal.split(PLACEHOLDER).join("${…}");
      const why = p.includes("/_") ? ` (judged as ${p})` : "";
      offenders.push(`${rel(file)}:${h.line} -> ${shown}${why}  [reached via ${rel(surface.get(file)!)}]`);
    }
  }

  it("finds every ADMIN_ONLY_REGIONS marker (a moved block must move its exemption)", () => {
    expect(brokenRegions).toEqual([]);
  });

  it("has no href from the anonymous surface to a Lab route", () => {
    expect(offenders).toEqual([]);
  });

  it("judges template hrefs by shape", () => {
    expect(isPublicRoute(judgedPath(`/claims/${PLACEHOLDER}`))).toBe(true);
    expect(isPublicRoute(judgedPath(`/search?q=${PLACEHOLDER}`))).toBe(true);
    expect(isPublicRoute(judgedPath(`/settling-curve?t=${PLACEHOLDER}#x`))).toBe(true);
    expect(isPublicRoute(judgedPath(`/members/${PLACEHOLDER}`))).toBe(false);
    expect(isPublicRoute(judgedPath(`/claims/${PLACEHOLDER}/edit`))).toBe(false);
    expect(isPublicRoute(judgedPath(`/${PLACEHOLDER}`))).toBe(false);
    expect(judgedPath(`/opinions${PLACEHOLDER}`)).toBe("/opinions");
    expect(judgedPath(`/claims/${PLACEHOLDER}`)).toBe("/claims/_");
  });

  it("reads the href shapes the codebase uses", () => {
    const src = [
      `<Link href="/a">`,
      `<a href={'/b'}>`,
      "<Link href={`/c/${id}`}>",
      "<Link href={`/d?${q ? `x=${q}` : ''}`}>",
      `<Link href={open ? "/e" : "/f"}>`,
      `const L = [{ href: "/g", label: "G" }, { href: '/h' }];`,
      "router.push(`/i/${slug}?page=${n}`, { scroll: false });",
      `redirect("/j?from=/admin");`,
      `location.href = "/k";`,
      `if (l.href === "/not-a-link") {}`,
      `<a href="https://example.org/x">`,
      `<a href="//cdn.example.org/y">`,
    ].join("\n");
    const found = [...src.matchAll(ANCHOR_RE)].flatMap((m) =>
      collectHrefs(src, m[0].endsWith("(") ? m.index! + m[0].length - 1 : m.index! + m[0].length),
    );
    expect(found.map((h) => judgedPath(h.literal))).toEqual(["/a", "/b", "/c/_", "/d", "/e", "/f", "/g", "/h", "/i/_", "/j", "/k"]);
    expect(found.map((h) => h.line)).toEqual([1, 2, 3, 4, 5, 5, 6, 6, 7, 8, 9]);
  });
});

describe("link integrity: every internal href points at something that exists", () => {
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));

  it("scans the whole tree", () => {
    expect(files.length).toBeGreaterThan(200);
  });

  const dead: string[] = [];
  for (const file of files) {
    for (const h of hrefsIn(file)) {
      const p = judgedPath(h.literal);
      if (p.split("/")[1] === "_") continue; // `/${slug}` — no checkable target; Lab-only by invariant 1
      if (targetExists(p)) continue;
      dead.push(`${rel(file)}:${h.line} -> ${h.literal.split(PLACEHOLDER).join("${…}")}`);
    }
  }

  it("has no href to a page, API route or public/ file that does not exist", () => {
    expect(dead).toEqual([]);
  });

  it("knows the API routes as segment lists", () => {
    expect(apiRouteExists("/api/login")).toBe(true);
    expect(apiRouteExists("/api/claims/_/cite")).toBe(true);
    expect(apiRouteExists("/api/no-such-route")).toBe(false);
    expect(apiRouteExists("/api/claims")).toBe(true);
    expect(apiRouteExists("/api/claims/_/_/_")).toBe(false);
  });
});

describe("link integrity: next.config.ts redirects land on pages that exist", () => {
  const src = stripComments(fs.readFileSync(path.join(ROOT, "next.config.ts"), "utf8"));
  const destinations = [...src.matchAll(/destination:\s*["'](\/[^"']*)["']/g)].map((m) => m[1]);

  it("finds the redirect table", () => {
    expect(destinations.length).toBeGreaterThan(2);
  });

  it.each(destinations)("%s exists", (d) => {
    expect(targetExists(d)).toBe(true);
  });
});
