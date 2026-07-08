/**
 * backfill-mesh-dates.ts — dates for the ~10k curve-less mesh_v1 claims, from
 * the same NLM SPARQL endpoint the ingester used (id.nlm.nih.gov/mesh/sparql).
 *
 * MeSH RDF carries meshv:dateEstablished (when the term entered the vocabulary
 * — the claim's honest emergence) and meshv:dateCreated (record creation;
 * fallback). Batched VALUES queries, 100 descriptors per POST — the full sweep
 * is ~100 requests (~1 min), so no resume-stamp is needed; misses stay NULL
 * and simply re-query on a re-run.
 *
 * PRECISION HEURISTIC (documented, deliberate): NLM dates ending in -01-01 are
 * overwhelmingly the annual-release convention rather than a true January 1st,
 * so they are stored as YEAR; any other value is a real DAY. Same spirit as
 * the schema's truncated-timestamp convention.
 *
 * SAMPLE MODE BY DEFAULT (200 descriptors): reports coverage + raw predicate
 * bindings, so a schema drift at NLM fails loudly before anything writes.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-mesh-dates.ts --direct            # sample
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-mesh-dates.ts --execute --direct  # full (~1 min)
 *
 * After: ingest-auto-trajectories.ts --pipeline mesh_v1 --dry-run, then real, then re-census.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { parseWestern, type ParsedDate } from "../lib/date-parsers";

if (process.argv.includes("--direct")) {
  if (!process.env.DIRECT_URL) {
    console.error("--direct passed but DIRECT_URL is not set");
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

const SPARQL_ENDPOINT = "https://id.nlm.nih.gov/mesh/sparql";
const PIPELINE = "mesh_v1";
const BATCH = 100;
const DELAY_MS = 400; // ingest-mesh.ts politeness convention

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
const EXECUTE = process.argv.includes("--execute");
const SAMPLE = argValue("--sample") ? parseInt(argValue("--sample")!, 10) : 200;
const LIMIT = argValue("--limit") ? parseInt(argValue("--limit")!, 10) : null;

interface Binding { d: string; established?: string; created?: string }

async function sparqlDates(descriptorIds: string[]): Promise<Map<string, Binding>> {
  const values = descriptorIds.map((id) => `<http://id.nlm.nih.gov/mesh/${id}>`).join(" ");
  const query = `
PREFIX meshv: <http://id.nlm.nih.gov/mesh/vocab#>
SELECT ?d ?established ?created WHERE {
  VALUES ?d { ${values} }
  OPTIONAL { ?d meshv:dateEstablished ?established }
  OPTIONAL { ?d meshv:dateCreated ?created }
}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(SPARQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
          "User-Agent": "epistemic-receipts/1.0 (mesh date backfill)",
        },
        body: new URLSearchParams({ query, format: "JSON" }).toString(),
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`SPARQL ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as {
        results?: { bindings?: Array<Record<string, { value?: string }>> };
      };
      const out = new Map<string, Binding>();
      for (const b of data.results?.bindings ?? []) {
        const uri = b.d?.value ?? "";
        const id = uri.split("/").pop() ?? "";
        if (!id) continue;
        const prev = out.get(id) ?? { d: id };
        if (b.established?.value) prev.established = b.established.value;
        if (b.created?.value) prev.created = b.created.value;
        out.set(id, prev);
      }
      return out;
    } catch (e) {
      if (attempt === 1) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return new Map();
}

/** -01-01 → YEAR (NLM annual-release convention); anything else keeps parsed precision. */
function toParsed(raw: string): ParsedDate | null {
  const p = parseWestern(raw);
  if (!p) return null;
  if (/-01-01/.test(raw.slice(0, 10)) && p.precision === "DAY")
    return { date: p.date, precision: "YEAR" };
  return p;
}

async function main() {
  const mode = EXECUTE ? `EXECUTE${LIMIT ? ` (limit ${LIMIT})` : ""}` : `SAMPLE (${SAMPLE}, no writes)`;
  console.log(`\n=== MeSH date backfill — ${mode} ===\n`);

  const counts = { scanned: 0, queried: 0, dated: 0, noDate: 0, badId: 0, updated: 0 };
  const bySource: Record<string, number> = {};
  const examples: string[] = [];
  const cap = EXECUTE ? LIMIT ?? Infinity : SAMPLE;
  let cursor: string | null = null;

  outer: for (;;) {
    const claims: { id: string; externalId: string | null }[] = await prisma.claim.findMany({
      where: {
        deleted: false,
        ingestedBy: PIPELINE,
        claimEmergedAt: null,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: { id: true, externalId: true },
      orderBy: { id: "asc" },
      take: BATCH,
    });
    if (claims.length === 0) break;
    cursor = claims[claims.length - 1].id;

    const withIds = claims
      .map((c) => ({ claimId: c.id, mesh: c.externalId?.replace(/^mesh_/, "") ?? "" }))
      .filter((c) => {
        if (/^[DCM]\d{6,9}$/.test(c.mesh)) return true;
        counts.badId++;
        return false;
      });
    counts.scanned += claims.length;

    if (withIds.length > 0) {
      const bindings = await sparqlDates(withIds.map((c) => c.mesh));
      counts.queried += withIds.length;
      await new Promise((r) => setTimeout(r, DELAY_MS));

      const batch: { id: string; date: Date; precision: string }[] = [];
      for (const c of withIds) {
        const b = bindings.get(c.mesh);
        const raw = b?.established ?? b?.created;
        const parsed = raw ? toParsed(raw) : null;
        if (!parsed) {
          counts.noDate++;
          continue;
        }
        counts.dated++;
        const src = b?.established ? "dateEstablished" : "dateCreated";
        bySource[src] = (bySource[src] ?? 0) + 1;
        if (examples.length < 8)
          examples.push(`${c.mesh}: ${src}=${raw} → ${parsed.date.toISOString().slice(0, 10)} (${parsed.precision})`);
        batch.push({ id: c.claimId, date: parsed.date, precision: parsed.precision });
      }

      if (EXECUTE && batch.length > 0) {
        const n = await prisma.$executeRawUnsafe(
          `UPDATE "Claim" c
              SET "claimEmergedAt" = v.d, "claimEmergedPrecision" = v.p
             FROM (SELECT unnest($1::text[]) AS id, unnest($2::timestamptz[]) AS d, unnest($3::text[]) AS p) v
            WHERE c."id" = v.id AND c."claimEmergedAt" IS NULL`,
          batch.map((r) => r.id),
          batch.map((r) => r.date),
          batch.map((r) => r.precision),
        );
        counts.updated += Number(n);
      }
    }

    if (counts.scanned % 2000 === 0)
      console.log(`  … ${counts.scanned.toLocaleString()} scanned, ${counts.dated.toLocaleString()} dated`);
    if (counts.queried >= 200 && counts.dated === 0)
      throw new Error("First 200 lookups found zero dates — NLM predicate drift? Aborting before writing anything.");
    if (counts.scanned >= cap) break outer;
  }

  console.log(`\n── Summary ──`);
  console.log(counts);
  if (counts.queried > 0)
    console.log(`Coverage: ${counts.dated}/${counts.queried} (${Math.round((counts.dated / counts.queried) * 100)}%) · fields:`, bySource);
  for (const e of examples) console.log(`  ${e}`);

  if (!EXECUTE) {
    console.log(`\nSample only. If coverage justifies it:\n  npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-mesh-dates.ts --execute --direct`);
  } else {
    const rows = await prisma.$queryRawUnsafe<[{ n: bigint }]>(
      `SELECT COUNT(*) AS n FROM "Claim" c
        WHERE c."deleted" = false AND c."ingestedBy" = $1 AND c."claimEmergedAt" IS NULL`,
      PIPELINE,
    );
    console.log(`\nDB verification: ${Number(rows[0].n).toLocaleString()} mesh claims still dateless.`);
    console.log(`Next: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-auto-trajectories.ts --pipeline ${PIPELINE} --dry-run`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
