/**
 * exoplanet-retractions.ts — Tier-1 transition-event pipeline.
 *
 * Event feed: NASA Exoplanet Archive "Targets Excluded from the Archive"
 * (exoplanetarchive.ipac.caltech.edu/docs/removed_targets.html) — planets
 * removed after a published refutation, or dispositioned False Positive Planet
 * (FPP) after July 2022, each entry citing the refuting paper (ADS link).
 *
 * Section → arc mapping:
 *   "Planets with Published Refutations" → REVERSED (removed on refutation)
 *   "False Positive Planets"             → REVERSED (FPP disposition)
 *   "Object Mass > 30 Jupiter Masses"    → REVERSED (reclassified substellar;
 *                                           exclude with --skip-mass-reclass)
 *   "Reinstated Targets"                 → residue (confirmed→refuted→re-confirmed
 *                                           needs BOTH dates; astronomy loop / curation)
 *   not-peer-reviewed / unconfirmed / notes → skipped (never confirmed = no claim)
 *
 * Join: nasa_exoplanet_v1 claims are keyed `exoplanet_<name>` but the ingester
 * only pulls CURRENTLY-confirmed planets (ps default_flag=1), so most refuted
 * planets have no claim yet. Two paths:
 *   - claim exists (terminal RECORDED): append RECORDED→REVERSED @ refutation
 *     year, community EXPERT_LITERATURE — the planet that stopped existing.
 *   - claim missing: with --create-missing (default ON) create the claim with a
 *     null→REVERSED baseline @ refutation date — exactly the crossref-retraction
 *     wave-2 entry shape — plus an AGAINST edge to the refuting paper, and list
 *     it in the residue file so the astronomy loop can prepend the original
 *     announcement (null→RECORDED) with a verified discovery source.
 *
 * Dates are bibcode/citation years (YEAR precision — the honest grain of the
 * feed). PREFLIGHT/DRY-RUN BY DEFAULT; writes only with --execute. Idempotent
 * (deterministic ids, externalId upserts, unique constraint). Row writes go
 * through lib/transition-contract.emitTransition (URL-verified).
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/exoplanet-retractions.ts
 *   ... --limit 10 | --execute | --skip-mass-reclass | --no-create-missing
 *
 * After --execute:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts \
 *     --pipeline event:exoplanet_retractions_v1
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { parseHTML } from "linkedom";
import * as fs from "fs";
import * as path from "path";
import {
  emitTransition,
  verifyUrl,
  BROWSERISH_HEADERS,
  type TransitionSpec,
} from "../../lib/transition-contract";

const prisma = new PrismaClient();

const FEED_URL = "https://exoplanetarchive.ipac.caltech.edu/docs/removed_targets.html";
const EVENT_PIPELINE = "event:exoplanet_retractions_v1";

const EXECUTE = process.argv.includes("--execute");
const SKIP_MASS = process.argv.includes("--skip-mass-reclass");
const CREATE_MISSING = !process.argv.includes("--no-create-missing");
function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
const LIMIT = argValue("--limit") ? parseInt(argValue("--limit")!, 10) : null;
const RESIDUE_PATH = path.join(__dirname, "../../logs/exoplanet-retractions-residue.jsonl");
// Offline fallback, same convention as scotus-overrulings: --feed-file <saved html>
const FEED_FILE = argValue("--feed-file");

// Same sanitizer as scripts/ingest-astronomy.ts — keys must line up.
function safeExoId(name: string): string {
  return name.replace(/[^A-Za-z0-9_\-.]/g, "_");
}

// ── Feed parsing ──────────────────────────────────────────────────────────────

type Cohort = "refuted" | "false_positive" | "mass_reclass" | "reinstated";

interface RemovedPlanet {
  name: string;
  cohort: Cohort;
  refYear: number;
  refUrl: string;
  refLabel: string; // e.g. "Robertson et al. 2014"
}

const SECTION_MAP: [RegExp, Cohort | "skip"][] = [
  [/published refutations/i, "refuted"],
  [/false positive planets/i, "false_positive"],
  [/30 jupiter masses/i, "mass_reclass"],
  [/reinstated/i, "reinstated"],
  [/do not appear in peer-reviewed/i, "skip"],
  [/unconfirmed candidates/i, "skip"],
  [/targets of note/i, "skip"],
];

/** "HW Vir b & c" → [HW Vir b, HW Vir c]; "K2-78 b, K2-82 b" → both; etc. */
function expandPlanetNames(raw: string): string[] {
  const cleaned = raw
    .replace(/\(.*?\)/g, " ")          // parentheticals (citations, a.k.a.)
    .replace(/\ba\.k\.a\..*$/i, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;]+$/, "");
  if (!cleaned) return [];

  const frags = cleaned.split(/,|;|\s&\s|\band\b/).map((f) => f.trim()).filter(Boolean);
  const out: string[] = [];
  for (const frag of frags) {
    if (/^[b-h]$/.test(frag) && out.length > 0) {
      // Bare planet letter — sibling of the previous entry's host star.
      const prev = out[out.length - 1];
      out.push(prev.replace(/\s[b-h]$/, ` ${frag}`));
    } else if (/\s[b-h]$/.test(frag) || /\.\d+$/.test(frag)) {
      out.push(frag);
    }
    // Fragments without a planet designation (stray words) are dropped.
  }
  return out;
}

async function loadFeedHtml(): Promise<string> {
  if (FEED_FILE) {
    console.log(`Reading feed from file: ${FEED_FILE}`);
    return fs.readFileSync(FEED_FILE, "utf8");
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(FEED_URL, { headers: BROWSERISH_HEADERS, signal: ctl.signal });
    if (!res.ok)
      throw new Error(
        `NASA removed-targets page returned ${res.status} — save it in your browser and re-run with --feed-file <path>.`,
      );
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFeed(): Promise<RemovedPlanet[]> {
  const { document } = parseHTML(await loadFeedHtml());

  const planets: RemovedPlanet[] = [];
  let cohort: Cohort | "skip" | null = null;

  for (const el of Array.from(document.querySelectorAll("h2, li"))) {
    if (el.tagName === "H2") {
      const heading = el.textContent ?? "";
      cohort = SECTION_MAP.find(([re]) => re.test(heading))?.[1] ?? null;
      continue;
    }
    if (!cohort || cohort === "skip") continue;
    // Only top-level entries; nested li (sub-planets of a paper) inherit handling
    // via their own text — skip li that contain a ul to avoid double counting.
    if (el.querySelector("ul")) continue;

    const text = el.textContent ?? "";
    const anchors = Array.from(el.querySelectorAll("a"));
    const refAnchor = anchors.find((a) => /adsabs|iopscience|doi\.org/.test(a.getAttribute("href") ?? ""));
    const refUrl = refAnchor?.getAttribute("href") ?? null;

    // Year: bibcode in the ADS URL ("/abs/2014Sci...") or a 4-digit year in the citation text.
    let refYear: number | null = null;
    const bib = refUrl ? /\/abs\/(\d{4})/.exec(refUrl) : null;
    if (bib) refYear = Number(bib[1]);
    if (!refYear) {
      const paren = /\(([^)]*?(\d{4})[^)]*?)\)\s*$/.exec(text.trim());
      if (paren) refYear = Number(paren[2]);
    }
    if (!refUrl || !refYear || refYear < 1990 || refYear > 2100) continue; // no verifiable dated refutation → not curvable

    const refLabel =
      (refAnchor?.textContent ?? "").replace(/\s+/g, " ").trim() || `published refutation, ${refYear}`;

    // Names: text before the first citation parenthesis.
    const nameSegment = text.split(/\(\s*(?:19|20)\d{2}|\(\s*[A-Z][a-zé]+/)[0] ?? text;
    for (const name of expandPlanetNames(nameSegment)) {
      if (!planets.some((p) => p.name === name)) {
        planets.push({ name, cohort: cohort as Cohort, refYear, refUrl, refLabel });
      }
    }
  }
  return planets;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `\n=== Exoplanet retractions pipeline — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (no writes)"}` +
    `${LIMIT ? `, limit ${LIMIT}` : ""}${SKIP_MASS ? ", mass-reclass excluded" : ""}` +
    `${CREATE_MISSING ? "" : ", no claim creation"} ===\n`,
  );

  if (!FEED_FILE) {
    const feedCheck = await verifyUrl(FEED_URL);
    if (!feedCheck.ok) throw new Error(`feed unreachable (${feedCheck.status ?? feedCheck.note})`);
  }

  let planets = await fetchFeed();
  console.log(`Parsed ${planets.length} removed/reinstated planets from the feed.`);
  const byCohort = planets.reduce<Record<string, number>>((acc, p) => {
    acc[p.cohort] = (acc[p.cohort] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Cohorts:`, byCohort, `\n`);

  if (SKIP_MASS) planets = planets.filter((p) => p.cohort !== "mass_reclass");
  if (LIMIT) planets = planets.slice(0, LIMIT);

  const residue: object[] = [];
  const counts = { planned: 0, inserted: 0, exists: 0, skipped: 0, created: 0, residue: 0 };

  for (const p of planets) {
    if (p.cohort === "reinstated") {
      residue.push({ kind: "reinstated-needs-both-dates", ...p });
      counts.residue++;
      continue;
    }

    const externalId = `exoplanet_${safeExoId(p.name)}`;
    const existing = await prisma.claim.findUnique({
      where: { externalId },
      select: {
        id: true, deleted: true,
        statusHistory: { orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 1, select: { toAxis: true } },
      },
    });

    const reasonCore =
      p.cohort === "mass_reclass"
        ? `Reclassified as a substellar companion (mass above the ~30 Jupiter-mass planetary threshold) by ${p.refLabel} and removed from the NASA Exoplanet Archive's confirmed-planet tables.`
        : p.cohort === "false_positive"
          ? `Dispositioned as a False Positive Planet by the NASA Exoplanet Archive on the basis of the published refutation ${p.refLabel}, and removed from the Planetary Systems tables.`
          : `Refuted in the published literature (${p.refLabel}) and removed from the NASA Exoplanet Archive.`;

    const source = {
      externalId: `src:exoplanet-refutation-${safeExoId(p.name)}`,
      name: `${p.refLabel} — refutation of ${p.name} (NASA Exoplanet Archive, Targets Excluded)`,
      url: p.refUrl,
      publishedAt: String(p.refYear),
      methodologyType: "primary" as const,
      ingestedBy: EVENT_PIPELINE,
    };

    if (existing && !existing.deleted) {
      // Confirmed planet still in the corpus — append the reversal.
      const terminal = existing.statusHistory[0]?.toAxis ?? null;
      if (terminal !== "RECORDED") {
        residue.push({ kind: "terminal-axis-not-recorded", terminal, ...p });
        counts.residue++;
        console.log(`  ~ residue (terminal ${terminal}): ${p.name}`);
        continue;
      }
      const spec: TransitionSpec = {
        claimId: existing.id,
        fromAxis: "RECORDED",
        toAxis: "REVERSED",
        community: "EXPERT_LITERATURE",
        occurredAt: String(p.refYear),
        reason: `${reasonCore} Dated to the refuting paper's publication year.`,
        source,
      };
      const result = await emitTransition(prisma, spec, { execute: EXECUTE });
      counts[result.action === "planned" ? "planned" : result.action]++;
      console.log(`  ${result.action.padEnd(8)} RECORDED→REVERSED @ ${p.refYear}  ${p.name} [existing claim]`);
      for (const v of result.violations) console.log(`        ! ${v}`);
      continue;
    }

    // No claim — crossref-retraction shape: create claim + null→REVERSED baseline.
    if (!CREATE_MISSING) {
      residue.push({ kind: "no-claim", ...p });
      counts.residue++;
      continue;
    }

    const claimText =
      `Exoplanet ${p.name} was reported as a confirmed planet in the peer-reviewed literature; ` +
      `it was subsequently ${p.cohort === "mass_reclass" ? "reclassified as a substellar object" : "refuted as a false positive"} ` +
      `(${p.refLabel}) and removed from the NASA Exoplanet Archive's confirmed-planet tables.`;

    if (!EXECUTE) {
      counts.created++;
      counts.planned++;
      console.log(`  would-create + null→REVERSED @ ${p.refYear}  ${p.name} [${p.cohort}]`);
      residue.push({ kind: "needs-announcement-prepend", externalId, ...p });
      counts.residue++;
      continue;
    }

    const urlCheck = await verifyUrl(p.refUrl);
    if (!urlCheck.ok) {
      residue.push({ kind: "refutation-url-failed", status: urlCheck.status, ...p });
      counts.residue++;
      console.log(`  ✗ url failed (${urlCheck.status ?? urlCheck.note}): ${p.name}`);
      continue;
    }

    const created = await prisma.$transaction(async (tx) => {
      const src = await tx.source.upsert({
        where: { externalId: source.externalId },
        create: {
          externalId: source.externalId,
          name: source.name,
          url: source.url,
          publishedAt: new Date(Date.UTC(p.refYear, 0, 1)),
          methodologyType: source.methodologyType,
          ingestedBy: EVENT_PIPELINE,
        },
        update: {},
        select: { id: true },
      });
      const claim = await tx.claim.upsert({
        where: { externalId },
        create: {
          text: claimText,
          claimType: "EMPIRICAL",
          claimEmergedAt: new Date(Date.UTC(p.refYear, 0, 1)),
          claimEmergedPrecision: "YEAR",
          ingestedBy: EVENT_PIPELINE,
          externalId,
          autoApproved: true,
          humanReviewed: false,
          metadata: { dataset: EVENT_PIPELINE, cohort: p.cohort, refUrl: p.refUrl, refYear: p.refYear },
        },
        update: {},
        select: { id: true },
      });
      await tx.edge.createMany({
        data: [{
          sourceId: src.id,
          claimId: claim.id,
          type: "AGAINST",
          evidenceType: "EVIDENTIARY",
          ingestedBy: EVENT_PIPELINE,
          autoApproved: true,
        }],
        skipDuplicates: true,
      });
      return claim;
    });
    counts.created++;

    const result = await emitTransition(
      prisma,
      {
        claimId: created.id,
        fromAxis: null,
        toAxis: "REVERSED",
        community: "EXPERT_LITERATURE",
        occurredAt: String(p.refYear),
        reason:
          `${reasonCore} Entry row mirrors the retraction-curve convention (baseline at the refutation date); ` +
          `the original announcement transition is owed a verified discovery source — see residue file.`,
        source,
      },
      { execute: true, allowEntryRow: true },
    );
    counts[result.action === "planned" ? "planned" : result.action]++;
    console.log(`  ${result.action.padEnd(8)} created + null→REVERSED @ ${p.refYear}  ${p.name} [${p.cohort}]`);
    for (const v of result.violations) console.log(`        ! ${v}`);
    residue.push({ kind: "needs-announcement-prepend", externalId, ...p });
    counts.residue++;
  }

  fs.mkdirSync(path.dirname(RESIDUE_PATH), { recursive: true });
  fs.writeFileSync(RESIDUE_PATH, residue.map((r) => JSON.stringify(r)).join("\n") + (residue.length ? "\n" : ""));

  console.log(`\n── Summary ──`);
  console.log(counts);
  console.log(`Residue (${residue.length}) → ${RESIDUE_PATH} — announcement prepends & reinstated arcs for the astronomy loop.`);
  if (!EXECUTE) console.log(`\nPreflight only. Review, then re-run with --execute.`);
  else
    console.log(
      `\nVerify: npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --pipeline ${EVENT_PIPELINE}`,
    );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
