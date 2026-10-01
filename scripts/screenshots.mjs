#!/usr/bin/env node
// README screenshots, captured with Playwright against a local production
// build (STATUS.md Phase 5):
//
//   CIRCLE_NODE_TOTAL=2 npm run build && npm start &
//   node scripts/screenshots.mjs            # → docs/screenshots/*.png
//
// BASE_URL overrides the target (default http://localhost:3000). Needs the
// `playwright` devDependency and `npx playwright install chromium`.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs", "screenshots");
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Real records, chosen 2026-09-30: a curated trajectory with three dated
// transitions, and a receipt with six evidence links and a status history.
const SHOTS = [
  { file: "homepage.png", path: "/", label: "Homepage — the settling curve, live corpus count, ticker" },
  { file: "settling-curve.png", path: "/settling-curve?t=continental-drift", label: "The settling-curve explorer — continental drift, 1915 → 1963" },
  { file: "claim-receipt.png", path: "/claims/cmqgbqs0p00hdsalw5dmch588", label: "A claim receipt — Wegener 1912, six sources, three transitions" },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
});

for (const shot of SHOTS) {
  const url = BASE + shot.path;
  const res = await page.goto(url, { waitUntil: "networkidle" });
  if (!res || !res.ok()) throw new Error(`${url} → HTTP ${res?.status()}`);
  // Hero curves animate in on load; let them finish, then freeze.
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, shot.file), animations: "disabled" });
  console.log(`[screenshots] ${shot.file} ← ${url}`);
}

await browser.close();
