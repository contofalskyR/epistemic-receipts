/**
 * check-candidate-dup.ts — pre-insert duplicate guard for curated trajectories.
 *
 * Root-cause fix for DUPLICATE-TRAJECTORIES-2026-07-06: the settling-curve
 * loops' "read the seed file and check" instruction is file-scoped and
 * honor-system, so era-rotating runs re-discovered famous events under new
 * slugs (265 near-dup groups / 581 trajectories). This script gives the loops
 * a mechanical gate against the WHOLE curated set in the live DB.
 *
 * Two signals, best available wins:
 *   1. pgvector cosine over ClaimEmbedding (text-embedding-3-small) — needs
 *      OPENAI_API_KEY; embeddings for recent seeds may lag until the
 *      embed-incremental cron has run (a fresh-window Jaccard covers the gap).
 *   2. Token-set Jaccard against curated claim texts fetched live — the same
 *      logic family as find-duplicate-trajectories.ts; always available.
 *
 * Verdict per candidate: DUPLICATE (≥ threshold on either signal) or OK.
 * Exit codes: 0 all OK · 2 at least one DUPLICATE · 3 error.
 * The loops treat exit 2 as "SKIP that candidate" (see loop-settling-curve*.sh).
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/check-candidate-dup.ts \
 *     --text "In March 1918 Meitner and Hahn announced protactinium…" \
 *     [--text "…"] [--json] [--cos-threshold 0.86] [--jaccard-threshold 0.55]
 *   … --file candidates.json      (JSON array of strings or {slug?, text})
 *
 * Read-only against Claim/ClaimEmbedding. Never writes.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
function argValues(flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag && process.argv[i + 1]) out.push(process.argv[i + 1]);
  }
  return out;
}

const COS_THRESHOLD = parseFloat(argValue("--cos-threshold") ?? "0.86");
const JACCARD_THRESHOLD = parseFloat(argValue("--jaccard-threshold") ?? "0.55");
const AS_JSON = process.argv.includes("--json");
const TOP_K = 5;

interface Candidate {
  slug?: string;
  text: string;
}

function loadCandidates(): Candidate[] {
  const out: Candidate[] = argValues("--text").map((t) => ({ text: t }));
  const file = argValue("--file");
  if (file) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (!Array.isArray(raw)) throw new Error(`--file ${file}: expected a JSON array`);
    for (const item of raw) {
      if (typeof item === "string") out.push({ text: item });
      else if (item && typeof (item as Candidate).text === "string") out.push(item as Candidate);
    }
  }
  // Bare positional args are candidates too — people forget --text.
  const flagsWithValue = new Set(["--text", "--file", "--cos-threshold", "--jaccard-threshold"]);
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (flagsWithValue.has(argv[i])) { i++; continue; }
    if (argv[i].startsWith("--")) continue;
    out.push({ text: argv[i] });
  }
  return out.filter((c) => c.text.trim().length > 0);
}

// ── Signal 2: token-set Jaccard (find-duplicate-trajectories' logic family) ──

const STOP = new Set(
  "the a an of in on at to for and or by with was were is are be been from as that this it its their his her".split(" "),
);
function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// ── Signal 1: pgvector cosine ─────────────────────────────────────────────────

interface VecMatch {
  externalId: string | null;
  claimId: string;
  text: string;
  similarity: number;
}

async function cosineMatches(embedding: number[]): Promise<VecMatch[]> {
  const vec = `[${embedding.join(",")}]`;
  // Curated scope: trajectory: slugs + curated-editorial prefixes.
  const rows = await prisma.$queryRawUnsafe<
    { externalId: string | null; claimId: string; text: string; similarity: number }[]
  >(
    `SELECT c."externalId", c."id" AS "claimId", c."text",
            1 - (ce."embedding" <=> $1::vector) AS "similarity"
       FROM "ClaimEmbedding" ce
       JOIN "Claim" c ON c."id" = ce."claimId"
      WHERE c."deleted" = false
        AND ce."embedding" IS NOT NULL
        AND (c."externalId" LIKE 'trajectory:%' OR c."ingestedBy" LIKE 'seed%' OR c."ingestedBy" LIKE 'law-settler%')
      ORDER BY ce."embedding" <=> $1::vector
      LIMIT ${TOP_K}`,
    vec,
  );
  return rows.map((r) => ({ ...r, similarity: Number(r.similarity) }));
}

async function main() {
  const candidates = loadCandidates();
  if (candidates.length === 0) {
    console.error("No candidates. Pass --text \"…\" (repeatable) or --file <json>.");
    process.exitCode = 3;
    return;
  }

  // Embeddings are optional — Jaccard alone still gates.
  let embedFn: ((texts: string[]) => Promise<number[][]>) | null = null;
  if (process.env.OPENAI_API_KEY) {
    const { embedMany3Small } = await import("../lib/embeddings");
    embedFn = embedMany3Small;
  }

  // Curated texts for the Jaccard pass (≈5–6k rows — fine in memory).
  const curated = await prisma.claim.findMany({
    where: {
      deleted: false,
      OR: [
        { externalId: { startsWith: "trajectory:" } },
        { ingestedBy: { startsWith: "seed" } },
        { ingestedBy: { startsWith: "law-settler" } },
      ],
    },
    select: { id: true, externalId: true, text: true },
  });
  const curatedTokens = curated.map((c) => ({ c, toks: tokens(c.text) }));

  const embeddings = embedFn ? await embedFn(candidates.map((c) => c.text)) : null;

  interface Report {
    slug?: string;
    text: string;
    verdict: "DUPLICATE" | "OK";
    matches: { externalId: string | null; claimId: string; signal: string; score: number; text: string }[];
  }
  const reports: Report[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const matches: Report["matches"] = [];

    if (embeddings) {
      for (const m of await cosineMatches(embeddings[i])) {
        if (m.similarity >= COS_THRESHOLD)
          matches.push({
            externalId: m.externalId, claimId: m.claimId,
            signal: "cosine", score: m.similarity, text: m.text,
          });
      }
    }

    const candToks = tokens(cand.text);
    let bestJ = 0;
    let bestJRow: (typeof curatedTokens)[number] | null = null;
    for (const row of curatedTokens) {
      const j = jaccard(candToks, row.toks);
      if (j > bestJ) { bestJ = j; bestJRow = row; }
    }
    if (bestJ >= JACCARD_THRESHOLD && bestJRow) {
      if (!matches.some((m) => m.claimId === bestJRow!.c.id))
        matches.push({
          externalId: bestJRow.c.externalId, claimId: bestJRow.c.id,
          signal: "jaccard", score: bestJ, text: bestJRow.c.text,
        });
    }

    matches.sort((a, b) => b.score - a.score);
    reports.push({
      slug: cand.slug,
      text: cand.text,
      verdict: matches.length > 0 ? "DUPLICATE" : "OK",
      matches,
    });
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ embeddingsUsed: !!embeddings, reports }, null, 2));
  } else {
    console.log(
      `\n=== Candidate duplicate check — ${candidates.length} candidate(s), ` +
      `signals: ${embeddings ? "cosine+jaccard" : "jaccard only (no OPENAI_API_KEY)"} ===\n`,
    );
    for (const r of reports) {
      console.log(`${r.verdict === "DUPLICATE" ? "✗ DUPLICATE" : "✓ OK       "} ${r.slug ?? r.text.slice(0, 90)}`);
      for (const m of r.matches.slice(0, 3))
        console.log(
          `      ↳ ${m.signal} ${m.score.toFixed(3)}  ${m.externalId ?? m.claimId}  ${m.text.slice(0, 90)}`,
        );
    }
    console.log("");
  }

  process.exitCode = reports.some((r) => r.verdict === "DUPLICATE") ? 2 : 0;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 3;
  })
  .finally(() => prisma.$disconnect());
