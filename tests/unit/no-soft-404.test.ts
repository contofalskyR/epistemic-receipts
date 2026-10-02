import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Front door phase 6, item 1 (STATUS.md, 2026-10-01): real 404s.
//
// A loading.{tsx,ts,jsx,js} in a page's segment or in any segment above it
// wraps the page in <Suspense> (LoadingBoundary in
// node_modules/next/dist/client/components/layout-router.js). Next can then
// send the 200 shell before the page finishes, so a notFound() thrown inside it
// no longer sets the status: the response is a soft 404, and ISR caches it
// ("Status Codes" in
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md).
// Phase 5's root app/loading.tsx did that to every page; phase 6 deleted it.
//
// Invariant: no loading.* at or above any file under app/ that calls
// next/navigation's notFound(). A skeleton for a page that can 404 belongs in
// an in-page <Suspense> below the notFound() call, never in a loading.* file.

const ROOT = path.resolve(__dirname, "../..");
const APP = path.join(ROOT, "app");
const LOADING_FILES = ["loading.tsx", "loading.ts", "loading.jsx", "loading.js"];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");

/** Commented-out code is not a call (same rule as link-integrity.test.ts). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\"'`])\/\/.*$/gm, "$1");
}

const NAMED_IMPORT_RE = /\bimport\s*\{([^}]*)\}\s*from\s*["']next\/navigation["']/g;
const NAMESPACE_IMPORT_RE = /\bimport\s*\*\s*as\s+([\w$]+)\s+from\s*["']next\/navigation["']/g;

/** True if the source imports next/navigation's notFound (plain, aliased or
 *  through a namespace import) and calls it. A local `notFound` state variable
 *  (app/topics/[slug], app/fields/[slug] today) has no such import. */
function callsNotFound(src: string): boolean {
  const code = stripComments(src);
  const callees: string[] = [];
  for (const m of code.matchAll(NAMED_IMPORT_RE)) {
    for (const spec of m[1].split(",")) {
      const s = spec.trim().match(/^notFound(?:\s+as\s+([\w$]+))?$/);
      if (s) callees.push(s[1] ?? "notFound");
    }
  }
  for (const m of code.matchAll(NAMESPACE_IMPORT_RE)) callees.push(`${m[1]}.notFound`);
  return callees.some((name) =>
    new RegExp(`(?<![\\w$.])${name.replace(/[.$]/g, "\\$&")}\\s*\\(`).test(code),
  );
}

/** loading.* files in the file's own directory and every directory above it,
 *  up to and including app/. */
function loadingFilesAbove(file: string): string[] {
  const found: string[] = [];
  let dir = path.dirname(file);
  for (;;) {
    for (const name of LOADING_FILES) {
      const f = path.join(dir, name);
      if (fs.existsSync(f)) found.push(rel(f));
    }
    if (dir === APP) break;
    const up = path.dirname(dir);
    if (up === dir || !up.startsWith(APP)) throw new Error(`${rel(file)} is not under app/`);
    dir = up;
  }
  return found;
}

const NOT_FOUND_FILES = walk(APP)
  .filter((f) => callsNotFound(fs.readFileSync(f, "utf8")))
  .sort();

describe("no soft 404s: no loading.* above a file that calls notFound()", () => {
  it("finds the public pages that call notFound()", () => {
    expect(NOT_FOUND_FILES.map(rel)).toEqual(
      expect.arrayContaining([
        "app/claims/[id]/page.tsx",
        "app/settling-curve/[id]/page.tsx",
        "app/datasets/[tag]/page.tsx",
        "app/embed/trajectory/[slug]/page.tsx",
      ]),
    );
  });

  it("recognises the import shapes and ignores a notFound state variable", () => {
    expect(callsNotFound(`import { notFound } from "next/navigation";\nif (!x) notFound();`)).toBe(true);
    expect(callsNotFound(`import { notFound } from "next/navigation";\nif (!x) return notFound();`)).toBe(true);
    expect(callsNotFound(`import {\n  redirect,\n  notFound as nf,\n} from 'next/navigation'\nnf()`)).toBe(true);
    expect(callsNotFound(`import * as nav from "next/navigation";\nnav.notFound();`)).toBe(true);
    expect(callsNotFound(`const [notFound, setNotFound] = useState(false);\nif (notFound) setNotFound(true);`)).toBe(false);
    expect(callsNotFound(`import { notFound } from "next/navigation";\n// notFound();`)).toBe(false);
    expect(callsNotFound(`import { notFound } from "next/navigation";`)).toBe(false);
  });

  it.each(NOT_FOUND_FILES.map((f) => [rel(f), f]))("%s has no loading.* on its path", (_name, file) => {
    expect(loadingFilesAbove(file)).toEqual([]);
  });
});
