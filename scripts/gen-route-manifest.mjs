#!/usr/bin/env node
// Builds lib/route-manifest.json from app/**/page.tsx — the list of page routes
// that actually exist — so middleware.ts can answer "does this path exist?"
// without knowing anything about the app tree: unknown paths fall through to
// Next's real 404, only real Lab pages get the login gate (front door phase 3).
//
// Runs as part of `npm run build`; the output is committed so `next dev`,
// tests and the Edge bundle always have it. tests/unit/route-manifest.test.ts
// fails when the committed file is stale.
import { readdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const APP = join(ROOT, "app");
const OUT = join(ROOT, "lib", "route-manifest.json");

/** Turn an app-dir segment into a regex fragment. Route groups vanish. */
function segmentToRegex(seg) {
  if (/^\(.*\)$/.test(seg)) return null; // (group)
  if (/^\[\[\.\.\..+\]\]$/.test(seg)) return "(?:/.+)?"; // [[...slug]] optional catch-all
  if (/^\[\.\.\..+\]$/.test(seg)) return "/.+"; // [...slug]
  if (/^\[.+\]$/.test(seg)) return "/[^/]+"; // [id]
  return "/" + seg.replace(/[.*+?^${}()|\\]/g, "\\$&");
}

export function buildManifest(appDir = APP) {
  const routes = new Set();
  const patterns = new Set();
  const walk = (dir, segs) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "api" && segs.length === 0) continue; // /api/* has its own gates
        if (e.name.startsWith("_")) continue; // private folders
        walk(p, [...segs, e.name]);
      } else if (/^page\.(tsx|ts|jsx|js|mdx)$/.test(e.name)) {
        const parts = segs.map(segmentToRegex).filter((s) => s !== null);
        const isDynamic = parts.some((s) => s.includes("[^/]") || s.includes(".+"));
        if (isDynamic) patterns.add("^" + (parts.join("") || "/") + "$");
        else routes.add(parts.length ? parts.join("").replace(/\\([.*+?^${}()|\\])/g, "$1") : "/");
      }
    }
  };
  walk(appDir, []);
  return {
    generatedFrom: relative(ROOT, appDir).replace(/\\/g, "/") + "/**/page.tsx",
    routes: [...routes].sort(),
    patterns: [...patterns].sort(),
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const manifest = buildManifest();
  const json = JSON.stringify(manifest, null, 2) + "\n";
  let previous = null;
  try { previous = readFileSync(OUT, "utf8"); } catch { /* first run */ }
  writeFileSync(OUT, json);
  const changed = previous !== json;
  console.log(
    `[route-manifest] ${manifest.routes.length} static routes, ${manifest.patterns.length} dynamic patterns → lib/route-manifest.json${changed ? " (updated)" : " (unchanged)"}`,
  );
  statSync(OUT);
}
