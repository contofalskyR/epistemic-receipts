/**
 * validate-export.ts — check a finished export (scripts/paper/export.ts) against
 * itself and against the census in docs/paper/numbers.md. No database access.
 *
 *   npx tsx scripts/paper/validate-export.ts ~/er-export/2026-10-28
 *
 * Checks: MANIFEST checksums; CSV and Parquet hold the same row count per table;
 * referential integrity (history → claims, edges → claims/sources, relations →
 * claims, history.sourceId → sources); no email-like string left in exported text;
 * trajectory figures (T1, T2), row kinds and placeholder rows, printed beside the
 * census values (numbers.md §3.3–3.4) so drift between census and export is visible.
 * Exits 1 if a hard check fails (checksum, row count, integrity, email).
 */
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { pipeline } from "stream/promises";
import { DuckDBInstance } from "@duckdb/node-api";

const dir = path.resolve((process.argv[2] ?? "").replace(/^~(?=\/)/, process.env.HOME ?? "~"));
if (!process.argv[2] || !fs.existsSync(path.join(dir, "MANIFEST.json"))) throw new Error("usage: validate-export.ts <export dir>");

// Census values (docs/paper/numbers.md, 2026-10-24) for comparison only.
const CENSUS = { claims: 1757599, t1: 15777, t2: 34488, first: 1579633, same_day_relabel: 205182, retraction_repeal_entry: 18722, row_sourced: 17952, placeholder: 6754 };
const EMAIL = "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}";

async function main() {
  const m = JSON.parse(fs.readFileSync(path.join(dir, "MANIFEST.json"), "utf8"));
  const c = await (await DuckDBInstance.create(":memory:")).connect();
  const one = async (sql: string) => Number((await c.runAndReadAll(sql)).getRows()[0][0]);
  const pq = (t: string) => `read_parquet('${path.join(dir, `${t}.parquet`).replace(/'/g, "''")}')`;
  const failures: string[] = [];
  const check = (ok: boolean, msg: string) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failures.push(msg); };

  console.log(`# Export validation: ${dir}\nsnapshot ${m.snapshot.at} · git ${m.git.commit.slice(0, 7)} · sample ${m.sample ?? "none"}\n`);

  console.log("## Checksums and row counts");
  for (const f of m.files as { path: string; sha256: string; rows: number; table: string; format: string }[]) {
    const h = createHash("sha256");
    await pipeline(fs.createReadStream(path.join(dir, f.path)), h);
    check(h.digest("hex") === f.sha256, `sha256 ${f.path}`);
  }
  for (const t of [...new Set((m.files as { table: string }[]).map((f) => f.table).filter(Boolean))]) {
    const p = await one(`SELECT count(*) FROM ${pq(t)}`);
    const csv = await one(`SELECT count(*) FROM read_csv('${path.join(dir, `${t}.csv.gz`)}', header = true, delim = ',', quote = '"', escape = '"', all_varchar = true, max_line_size = 100000000)`);
    check(p === csv, `${t}: parquet ${p.toLocaleString("en-US")} rows = csv.gz ${csv.toLocaleString("en-US")} rows`);
  }

  console.log("\n## Referential integrity");
  const orphans = async (label: string, sql: string) => { const n = await one(sql); check(n === 0, `${label}: ${n} orphans`); };
  await orphans("status_history.claimId → claims", `SELECT count(*) FROM ${pq("status_history")} h ANTI JOIN ${pq("claims")} c ON c.id = h.claimId`);
  await orphans("status_history.sourceId → sources", `SELECT count(*) FROM ${pq("status_history")} h ANTI JOIN ${pq("sources")} s ON s.id = h.sourceId WHERE h.sourceId IS NOT NULL`);
  await orphans("edges.claimId → claims", `SELECT count(*) FROM ${pq("edges")} e ANTI JOIN ${pq("claims")} c ON c.id = e.claimId`);
  await orphans("edges.sourceId → sources", `SELECT count(*) FROM ${pq("edges")} e ANTI JOIN ${pq("sources")} s ON s.id = e.sourceId`);
  for (const t of ["claim_relations", "claim_relations_context"]) {
    await orphans(`${t} ends → claims`, `SELECT count(*) FROM ${pq(t)} r WHERE r.fromClaimId NOT IN (SELECT id FROM ${pq("claims")}) OR r.toClaimId NOT IN (SELECT id FROM ${pq("claims")})`);
  }
  const unused = await one(`SELECT count(*) FROM ${pq("sources")} s WHERE s.id NOT IN (SELECT sourceId FROM ${pq("edges")}) AND s.id NOT IN (SELECT sourceId FROM ${pq("status_history")} WHERE sourceId IS NOT NULL)`);
  check(unused === 0, `sources not referenced by an edge or history row: ${unused}`);

  console.log("\n## Personal data");
  for (const [t, col] of [["claims", "text"], ["claims", "metadata"], ["status_history", "reason"], ["sources", "name"], ["claim_relations", "followUpContext"], ["claim_relations_context", "followUpContext"]]) {
    const n = await one(`SELECT count(*) FROM ${pq(t)} WHERE regexp_matches(${col}, '${EMAIL}')`);
    check(n === 0, `${t}.${col}: ${n} email-like strings`);
  }

  console.log("\n## Figures vs census (informational; differences = data written between census and snapshot)");
  const row = (label: string, v: number, census: number) => console.log(`- ${label}: ${v.toLocaleString("en-US")} (census ${census.toLocaleString("en-US")}${v === census ? "" : `, Δ ${(v - census).toLocaleString("en-US")}`})`);
  row("claims", await one(`SELECT count(*) FROM ${pq("claims")}`), CENSUS.claims);
  row("T2 claims (documented change)", await one(`SELECT count(*) FROM ${pq("claims")} WHERE trajectoryT2`), CENSUS.t2);
  row("T1 claims (independent dated source)", await one(`SELECT count(*) FROM ${pq("claims")} WHERE trajectoryT1`), CENSUS.t1);
  for (const k of ["first", "same_day_relabel", "retraction_repeal_entry", "row_sourced"] as const) {
    row(`rowKind ${k}`, await one(`SELECT count(*) FROM ${pq("status_history")} WHERE rowKind = '${k}'`), CENSUS[k]);
  }
  row("placeholderDate rows", await one(`SELECT count(*) FROM ${pq("status_history")} WHERE placeholderDate`), CENSUS.placeholder);
  const linkKinds = (await c.runAndReadAll(`SELECT linkKind, count(*) FROM (SELECT linkKind FROM ${pq("claim_relations")} UNION ALL SELECT linkKind FROM ${pq("claim_relations_context")}) GROUP BY 1 ORDER BY 2 DESC`)).getRows();
  console.log(`- linkKind: ${linkKinds.map(([k, n]) => `${k} ${Number(n).toLocaleString("en-US")}`).join(" · ")}`);
  const lic = (await c.runAndReadAll(`SELECT coalesce(upstreamLicenceStatus, '(none)'), count(*) FROM ${pq("claims")} GROUP BY 1 ORDER BY 2 DESC`)).getRows();
  console.log(`- claims by upstreamLicenceStatus: ${lic.map(([k, n]) => `${k} ${Number(n).toLocaleString("en-US")}`).join(" · ")}`);

  console.log(failures.length ? `\n${failures.length} check(s) FAILED` : "\nall hard checks passed");
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
