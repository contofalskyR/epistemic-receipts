/**
 * B8-2 — Public-edition route sweep (read-only, exhaustive).
 *
 * Usage:  npx tsx scripts/b8-route-sweep.ts https://<project-B>.vercel.app
 *
 * For every PUBLIC_ROUTES entry: fetch and assert 200 + a content marker
 * (non-empty <title>, no Next error page), not just status. For the curated
 * deny-list (labs, admin, review, edges, edit, account, org, pricing,
 * collections, orphan taxonomies): assert 404. Known permanent redirects
 * (/bookmarks, /alerts → /following) assert the redirect. Deep paths per
 * prefix family are auto-discovered from the sitemap where possible.
 *
 * Output: a full pass/fail markdown table on stdout (paste into the B8
 * report). Exit code 1 if anything fails. Zero writes anywhere.
 */

import { PUBLIC_ROUTES } from "../lib/publicEdition";

const DENY_LIST = [
  "/labs",
  "/admin",
  "/review",
  "/edges",
  "/account",
  "/org",
  "/pricing",
  "/collections",
  "/globe/lab",
  // orphan taxonomies (never launched)
  "/arts",
  "/criminology",
  "/materials-science",
  "/political-economy",
  "/religious-studies",
];

const REDIRECTS: Record<string, string> = {
  "/bookmarks": "/following",
  "/alerts": "/following",
};

type Result = { path: string; expected: string; got: string; pass: boolean; note?: string };

async function get(url: string, redirect: "manual" | "follow" = "manual"): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20_000);
  try {
    return await fetch(url, { redirect, signal: ctl.signal, headers: { "user-agent": "b8-route-sweep" } });
  } finally {
    clearTimeout(t);
  }
}

function looksRendered(html: string): { ok: boolean; note?: string } {
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  if (!title) return { ok: false, note: "no <title>" };
  if (/Application error|Internal Server Error/i.test(html)) return { ok: false, note: "error page body" };
  return { ok: true, note: title.slice(0, 60) };
}

async function discoverDeepPaths(base: string): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  const wanted: [string, RegExp][] = [
    ["claim", /\/claims\/([a-z0-9]+)(?:\/|$)/i],
    ["trajectory", /\/settling-curve\/([a-z0-9-]+)(?:\/|$)/i],
    ["story", /\/stories\/([a-z0-9-]+)(?:\/|$)/i],
    ["topic", /\/topics\/([a-z0-9-]+)(?:\/|$)/i],
  ];
  try {
    const idx = await (await get(`${base}/sitemap.xml`, "follow")).text();
    const chunkUrls = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).slice(0, 12);
    const pages = chunkUrls.some((u) => u.includes("sitemap")) ? chunkUrls : [`${base}/sitemap.xml`];
    for (const chunk of pages) {
      if (Object.keys(found).length === wanted.length) break;
      let body = "";
      try {
        body = await (await get(chunk, "follow")).text();
      } catch {
        continue;
      }
      const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]);
      for (const [key, re] of wanted) {
        if (!found[key]) {
          const loc = locs.find((u) => re.test(u));
          if (loc) found[key] = new URL(loc).pathname;
        }
      }
    }
  } catch {
    /* sitemap unreachable — deep checks fall back to skipped */
  }
  return found;
}

async function main() {
  const base = process.argv[2]?.replace(/\/+$/, "");
  if (!base || !/^https?:\/\//.test(base)) {
    console.error("Usage: npx tsx scripts/b8-route-sweep.ts https://<project-B-host>");
    process.exit(2);
  }

  const results: Result[] = [];
  const check = async (p: string, expected: string, fn: () => Promise<{ got: string; pass: boolean; note?: string }>) => {
    try {
      const r = await fn();
      results.push({ path: p, expected, ...r });
    } catch (e) {
      results.push({ path: p, expected, got: `fetch failed: ${(e as Error).message}`, pass: false });
    }
  };

  // 1. Allowlist sweep — every PUBLIC_ROUTES entry must 200 and render.
  for (const route of PUBLIC_ROUTES) {
    if (route === "/embed") continue; // prefix-only; exercised via deep path below
    await check(route, "200 + rendered", async () => {
      const res = await get(`${base}${route}`, "follow");
      const html = await res.text();
      const rendered = looksRendered(html);
      return { got: `${res.status}${rendered.note ? " · " + rendered.note : ""}`, pass: res.status === 200 && rendered.ok };
    });
  }

  // 2. Known permanent redirects.
  for (const [from, to] of Object.entries(REDIRECTS)) {
    await check(from, `301/308 → ${to}`, async () => {
      const res = await get(`${base}${from}`);
      const loc = res.headers.get("location") ?? "";
      const pass = (res.status === 301 || res.status === 308) && loc.includes(to);
      return { got: `${res.status} → ${loc || "(none)"}`, pass };
    });
  }

  // 3. Deny-list sweep — must 404 (not 200, not 500, not redirect-to-login).
  for (const route of DENY_LIST) {
    await check(route, "404", async () => {
      const res = await get(`${base}${route}`);
      return { got: String(res.status), pass: res.status === 404 };
    });
  }

  // 4. Deep paths per prefix family (auto-discovered from sitemap).
  const deep = await discoverDeepPaths(base);
  const deepChecks: [string, string | undefined][] = [
    ["claim page", deep.claim],
    ["trajectory page", deep.trajectory],
    ["story page", deep.story],
    ["topic page", deep.topic],
  ];
  for (const [label, p] of deepChecks) {
    if (!p) {
      results.push({ path: `(deep: ${label})`, expected: "200", got: "SKIPPED — not found in sitemap", pass: false, note: "supply manually" });
      continue;
    }
    await check(p, "200 + rendered", async () => {
      const res = await get(`${base}${p}`, "follow");
      const rendered = looksRendered(await res.text());
      return { got: `${res.status}${rendered.note ? " · " + rendered.note : ""}`, pass: res.status === 200 && rendered.ok };
    });
  }
  await check("/docs/api", "200 + rendered", async () => {
    const res = await get(`${base}/docs/api`, "follow");
    const rendered = looksRendered(await res.text());
    return { got: `${res.status}`, pass: res.status === 200 && rendered.ok };
  });
  if (deep.claim) {
    const claimId = deep.claim.split("/").pop();
    await check(`/api/badge/claim/${claimId}.svg`, "200 svg", async () => {
      const res = await get(`${base}/api/badge/claim/${claimId}.svg`, "follow");
      const ct = res.headers.get("content-type") ?? "";
      return { got: `${res.status} · ${ct}`, pass: res.status === 200 && ct.includes("svg") };
    });
  }
  if (deep.trajectory) {
    const slug = deep.trajectory.split("/").pop();
    await check(`/embed/trajectory/${slug}`, "200 + rendered", async () => {
      const res = await get(`${base}/embed/trajectory/${slug}`, "follow");
      const rendered = looksRendered(await res.text());
      return { got: `${res.status}`, pass: res.status === 200 && rendered.ok };
    });
  }

  // 5. Header spot-checks on the homepage (B8-7 sanity, not the full pass).
  await check("/ (headers)", "HSTS + rate-limit headers present", async () => {
    const res = await get(`${base}/`, "follow");
    const hsts = res.headers.get("strict-transport-security") ? "HSTS" : "no-HSTS";
    const rl = [...res.headers.keys()].some((k) => k.toLowerCase().includes("ratelimit")) ? "RL" : "no-RL-headers";
    return { got: `${hsts} · ${rl}`, pass: hsts === "HSTS" };
  });

  // Report
  const failed = results.filter((r) => !r.pass);
  console.log(`\n## B8 route sweep — ${base}\n`);
  console.log(`| Path | Expected | Got | Result |`);
  console.log(`|---|---|---|---|`);
  for (const r of results) {
    console.log(`| ${r.path} | ${r.expected} | ${r.got.replace(/\|/g, "\\|")} | ${r.pass ? "PASS" : "**FAIL**"} |`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    console.log(`\nFailures:\n` + failed.map((r) => `- ${r.path}: expected ${r.expected}, got ${r.got}`).join("\n"));
    process.exit(1);
  }
}

main();
