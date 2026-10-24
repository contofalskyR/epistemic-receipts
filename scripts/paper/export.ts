/**
 * export.ts — the open-format release of the corpus for the Scientific Data
 * Data Descriptor (docs/handoffs/scientific-data-paper.md, Phase 3).
 *
 *   npx tsx scripts/paper/export.ts --out ~/er-export/2026-10-28          # full export
 *   npx tsx scripts/paper/export.ts --out /tmp/er-sample --sample 2000      # a quick format check
 *
 * Reads through app_ro only (DATABASE_URL_RO). One psql session runs every
 * \copy inside a single REPEATABLE READ READ ONLY transaction, so all files come
 * from one snapshot (recorded in MANIFEST.json). Nothing is written to the DB.
 *
 * Files (each as .csv.gz and .parquet, zstd):
 *   claims                     Claim, deleted = false
 *   status_history             ClaimStatusHistory rows of exported claims, + rowKind, placeholderDate, trajectoryChange
 *   sources                    Sources referenced by an exported edge or history row
 *   edges                      Edge, not deleted, both ends exported
 *   claim_relations            ClaimRelation, both ends exported, linkKind upstream_record | identifier_match
 *   claim_relations_context    ClaimRelation, both ends exported, linkKind name_or_text_match | time_window
 *                              (machine-derived context links, not part of the core graph)
 *   pipelines                  one row per ingestedBy: domain, claim count, upstream (lib/pipelines/registry.ts),
 *                              upstream licence status (docs/paper/upstream-licences.csv, when present)
 * plus MANIFEST.json, DATA_DICTIONARY.md (docs/paper/data-dictionary.md) and
 * README_DATA.md (docs/paper/README_DATA.md).
 *
 * Personal data: only the seven files above are exported; every other table is
 * listed in MANIFEST.excludedTables with the columns that look personal (email,
 * name, ip, token, password, session, key, hash, address, phone). Email addresses
 * inside exported text (claim text, metadata, history reasons, source names,
 * relation context) are replaced by "[email removed]"; the counts are in
 * MANIFEST.redactions (docs/paper/sql/15_pii_scan.sql lists them).
 *
 * Derived columns follow docs/paper/numbers.md: placeholder date = occurredAt on
 * 1970-01-01 or after the snapshot time; placeholder rows are dropped before the
 * ordering that decides trajectoryChange (t1 = row-sourced axis change dated after
 * the previous real-dated row; t2_only = a retraction/repeal change documented by
 * the claim's own URL-bearing Edge). Claims carry trajectoryT1 / trajectoryT2.
 *
 * Options: --out <dir> (required), --sample <n> (LIMIT n per file, for testing;
 * flags a sample in the manifest), --exclude-pipelines a,b (drop those pipelines'
 * claims and everything attached to them), --keep-csv (keep uncompressed CSV).
 */
import { config as loadEnv } from "dotenv";
import { execSync, spawnSync } from "child_process";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";
import { DuckDBInstance } from "@duckdb/node-api";
import { PIPELINES } from "../../lib/pipelines/registry";

loadEnv({ path: ".env.local", quiet: true });

const argv = process.argv.slice(2);
const opt = (k: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : undefined);
const OUT = opt("out");
const SAMPLE = opt("sample") ? Number(opt("sample")) : null;
const EXCLUDE = (opt("exclude-pipelines") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const KEEP_CSV = argv.includes("--keep-csv");
if (!OUT) throw new Error("--out <dir> is required");

const EMAIL_RE = "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}";
const REDACTED = "[email removed]";
const LIMIT = SAMPLE ? ` LIMIT ${SAMPLE}` : "";
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const exclList = EXCLUDE.length ? EXCLUDE.map(q).join(",") : "''";

// ── Pipeline → domain (docs/paper/domain-map.csv) as a VALUES list ─────────────
const domainRows = fs.readFileSync("docs/paper/domain-map.csv", "utf8").trim().split("\n").slice(1).map((l) => l.split(","));
const DOMAIN_VALUES = `(VALUES ${domainRows.map(([p, d]) => `(${q(p)},${q(d)})`).join(",")})`;

// ── Optional per-pipeline upstream licence table ───────────────────────────────
const LICENCE_CSV = "docs/paper/upstream-licences.csv";
type Licence = { pipeline: string; licence: string; status: string; licence_url: string };
const licences: Licence[] = fs.existsSync(LICENCE_CSV) ? parseCsv(fs.readFileSync(LICENCE_CSV, "utf8")) as unknown as Licence[] : [];
const LICENCE_VALUES = `(VALUES ${licences.length ? licences.map((l) => `(${q(l.pipeline)},${q(l.licence)},${q(l.status)})`).join(",") : "('', '', '')"})`;

// ── Shared SQL fragments ───────────────────────────────────────────────────────
const LIVE_CLAIMS = `SELECT id FROM "Claim" WHERE NOT deleted AND "ingestedBy" NOT IN (${exclList})`;
const PLACEHOLDER = (a: string) => `(${a}."occurredAt"::date = DATE '1970-01-01' OR ${a}."occurredAt" > snap.t)`;
const RETRACTION_REPEAL = `('crossref_retractions_v1','nz_repealed_acts_v1','retraction_watch_v1')`;
const WAVE1 = `('voteview_v1','congress_votes_v1','uk_commons_v1','openparliament_ca_v1','howtheyvote_eu_v1','eu_parliament_v1','tweedekamer_v1','openfda_labels_v1','canada_bills_v1')`;
const URL_RE = `'^https?://[a-z0-9.-]+\\.[a-z]{2,}'`;
const iso = (col: string) => `to_char(${col}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const redact = (expr: string) => `regexp_replace(${expr}, '${EMAIL_RE}', '${REDACTED}', 'g')`;

// History rows with every derived column, for exported claims. Used by
// status_history and (aggregated) by claims.
const HISTORY_CTE = `
  snap AS (SELECT now() AS t),
  live AS (${LIVE_CLAIMS}),
  urlclaims AS (
    SELECT DISTINCT e."claimId" FROM "Edge" e JOIN "Source" s ON s.id = e."sourceId"
    WHERE NOT e.deleted AND NOT s.deleted AND s.url ~* ${URL_RE}),
  raw AS (
    SELECT h.*, c."ingestedBy",
           row_number() OVER w AS rn, lag(h."toAxis") OVER w AS prev_to, lag(h."occurredAt") OVER w AS prev_at,
           (s.id IS NOT NULL AND NOT s.deleted) AS sourced, ${PLACEHOLDER("h")} AS placeholder
    FROM "ClaimStatusHistory" h JOIN "Claim" c ON c.id = h."claimId" JOIN live ON live.id = h."claimId"
    LEFT JOIN "Source" s ON s.id = h."sourceId", snap
    WINDOW w AS (PARTITION BY h."claimId" ORDER BY h.seq ASC NULLS LAST, h."occurredAt", h."createdAt")),
  clean AS (
    SELECT raw.id,
           lag(raw."toAxis") OVER w AS c_prev_to, lag(raw."occurredAt") OVER w AS c_prev_at, row_number() OVER w AS c_rn
    FROM raw WHERE NOT raw.placeholder
    WINDOW w AS (PARTITION BY raw."claimId" ORDER BY raw.seq ASC NULLS LAST, raw."occurredAt", raw."createdAt")),
  hist AS (
    SELECT raw.*,
      CASE WHEN raw.rn = 1 THEN 'first'
           WHEN raw.sourced THEN 'row_sourced'
           WHEN raw."ingestedBy" IN ${WAVE1} AND raw.prev_to = 'RECORDED' AND raw."toAxis" = 'SETTLED' THEN 'same_day_relabel'
           WHEN raw."ingestedBy" IN ${RETRACTION_REPEAL} THEN 'retraction_repeal_entry'
           ELSE 'other' END AS row_kind,
      CASE WHEN raw.placeholder OR cl.c_rn = 1 OR raw."toAxis" IS NOT DISTINCT FROM cl.c_prev_to OR NOT (raw."occurredAt" > cl.c_prev_at) THEN NULL
           WHEN raw.sourced THEN 't1'
           WHEN raw."ingestedBy" IN ${RETRACTION_REPEAL} AND u."claimId" IS NOT NULL THEN 't2_only'
           ELSE NULL END AS trajectory_change
    FROM raw LEFT JOIN clean cl ON cl.id = raw.id LEFT JOIN urlclaims u ON u."claimId" = raw."claimId")`;

// Relation kind from followUpContext (docs/paper/sql/14_relation_heuristics.sql).
const LINK_KIND = `CASE
    WHEN r."relationType" IN ('CITES','RELATED') AND r."followUpContext" IS NULL THEN 'upstream_record'
    WHEN r."followUpContext"->>'method' LIKE 'exact %' THEN 'identifier_match'
    WHEN r."followUpContext"->>'heuristic' IN ('doi_match','doi_exact_match','nct_id_match','nih_reporter_publications+pubmed_doi','openalex_awards_funder_award_id') THEN 'identifier_match'
    WHEN r."followUpContext"->>'heuristic' ~ '(year|window|in_force)' THEN 'time_window'
    ELSE 'name_or_text_match' END`;

const RELATIONS = (core: boolean) => `
  WITH live AS (${LIVE_CLAIMS}), k AS (
    SELECT r.*, ${LINK_KIND} AS link_kind FROM "ClaimRelation" r
    JOIN live a ON a.id = r."fromClaimId" JOIN live b ON b.id = r."toClaimId")
  SELECT id, "fromClaimId", "toClaimId", "relationType", link_kind AS "linkKind",
         "followUpContext"->>'heuristic' AS heuristic, year,
         ${redact(`"followUpContext"::text`)} AS "followUpContext", ${iso(`"createdAt"`)} AS "createdAt"
  FROM k WHERE link_kind ${core ? "IN" : "NOT IN"} ('upstream_record','identifier_match')
  ORDER BY id${LIMIT}`;

type FileSpec = { name: string; sql: string; types: Record<string, string> };

const FILES: FileSpec[] = [
  {
    name: "claims",
    sql: `
      WITH ${HISTORY_CTE},
      traj AS (SELECT "claimId", bool_or(trajectory_change = 't1') AS t1, bool_or(trajectory_change IS NOT NULL) AS t2 FROM hist GROUP BY 1),
      dm(pipeline, domain) AS ${DOMAIN_VALUES},
      lic(pipeline, licence, status) AS ${LICENCE_VALUES}
      SELECT c.id, ${redact("c.text")} AS text, c."epistemicAxis", ${iso(`c."claimEmergedAt"`)} AS "claimEmergedAt",
             c."claimEmergedPrecision", (c."claimEmergedAt"::date = DATE '1970-01-01' OR c."claimEmergedAt" > snap.t) AS "claimEmergedPlaceholder",
             c."ingestedBy", coalesce(dm.domain, 'UNMAPPED') AS domain, c."externalId",
             coalesce(c."externalId" LIKE 'trajectory:%', false) AS "curatedTrajectory",
             coalesce(traj.t1, false) AS "trajectoryT1", coalesce(traj.t2, false) AS "trajectoryT2",
             lic.licence AS "upstreamLicence", lic.status AS "upstreamLicenceStatus",
             c."verificationStatus", c."claimType", ${redact("c.metadata::text")} AS metadata,
             c."parentClaimId", c."openAlexId", c."autoApproved", c."humanReviewed", c."reviewedBy",
             ${iso(`c."reviewedAt"`)} AS "reviewedAt", c."reviewConfidence"::text AS "reviewConfidence",
             c."currentStatus" AS "legacy_currentStatus", c."epistemicStatus" AS "legacy_epistemicStatus",
             ${iso(`c."createdAt"`)} AS "createdAt", ${iso(`c."updatedAt"`)} AS "updatedAt"
      FROM "Claim" c JOIN live ON live.id = c.id CROSS JOIN snap
      LEFT JOIN traj ON traj."claimId" = c.id LEFT JOIN dm ON dm.pipeline = c."ingestedBy"
      LEFT JOIN lic ON lic.pipeline = c."ingestedBy"
      ORDER BY c.id${LIMIT}`,
    types: {
      id: "VARCHAR", text: "VARCHAR", epistemicAxis: "VARCHAR", claimEmergedAt: "TIMESTAMP", claimEmergedPrecision: "VARCHAR",
      claimEmergedPlaceholder: "BOOLEAN", ingestedBy: "VARCHAR", domain: "VARCHAR", externalId: "VARCHAR",
      curatedTrajectory: "BOOLEAN", trajectoryT1: "BOOLEAN", trajectoryT2: "BOOLEAN",
      upstreamLicence: "VARCHAR", upstreamLicenceStatus: "VARCHAR", verificationStatus: "VARCHAR",
      claimType: "VARCHAR", metadata: "VARCHAR", parentClaimId: "VARCHAR", openAlexId: "VARCHAR", autoApproved: "BOOLEAN",
      humanReviewed: "BOOLEAN", reviewedBy: "VARCHAR", reviewedAt: "TIMESTAMP", reviewConfidence: "VARCHAR",
      legacy_currentStatus: "VARCHAR", legacy_epistemicStatus: "VARCHAR", createdAt: "TIMESTAMP", updatedAt: "TIMESTAMP",
    },
  },
  {
    name: "status_history",
    sql: `
      WITH ${HISTORY_CTE}
      SELECT id, "claimId", seq, "fromAxis", "toAxis", ${iso(`"occurredAt"`)} AS "occurredAt", "datePrecision",
             community::text AS community, ${redact("reason")} AS reason, "sourceId", ${iso(`"createdAt"`)} AS "createdAt",
             row_kind AS "rowKind", placeholder AS "placeholderDate", trajectory_change AS "trajectoryChange"
      FROM hist ORDER BY "claimId", rn${LIMIT}`,
    types: {
      id: "VARCHAR", claimId: "VARCHAR", seq: "INTEGER", fromAxis: "VARCHAR", toAxis: "VARCHAR", occurredAt: "TIMESTAMP",
      datePrecision: "VARCHAR", community: "VARCHAR", reason: "VARCHAR", sourceId: "VARCHAR", createdAt: "TIMESTAMP",
      rowKind: "VARCHAR", placeholderDate: "BOOLEAN", trajectoryChange: "VARCHAR",
    },
  },
  {
    name: "sources",
    sql: `
      WITH live AS (${LIVE_CLAIMS}), used AS (
        SELECT e."sourceId" AS id FROM "Edge" e JOIN live ON live.id = e."claimId" WHERE NOT e.deleted
        UNION
        SELECT h."sourceId" FROM "ClaimStatusHistory" h JOIN live ON live.id = h."claimId" WHERE h."sourceId" IS NOT NULL)
      SELECT s.id, ${redact("s.name")} AS name, s.url, ${iso(`s."publishedAt"`)} AS "publishedAt", s."methodologyType",
             s."ingestedBy", s."externalId", s."autoApproved", s."humanReviewed", s."reviewedBy",
             ${iso(`s."reviewedAt"`)} AS "reviewedAt", s."reviewConfidence"::text AS "reviewConfidence", ${iso(`s."createdAt"`)} AS "createdAt"
      FROM "Source" s JOIN used USING (id) WHERE NOT s.deleted
      ORDER BY s.id${LIMIT}`,
    types: {
      id: "VARCHAR", name: "VARCHAR", url: "VARCHAR", publishedAt: "TIMESTAMP", methodologyType: "VARCHAR", ingestedBy: "VARCHAR",
      externalId: "VARCHAR", autoApproved: "BOOLEAN", humanReviewed: "BOOLEAN", reviewedBy: "VARCHAR", reviewedAt: "TIMESTAMP",
      reviewConfidence: "VARCHAR", createdAt: "TIMESTAMP",
    },
  },
  {
    name: "edges",
    sql: `
      WITH live AS (${LIVE_CLAIMS})
      SELECT e.id, e."claimId", e."sourceId", e.type, e."evidenceType", e."ingestedBy", e."autoApproved", e."humanReviewed",
             e."reviewedBy", ${iso(`e."reviewedAt"`)} AS "reviewedAt", e."reviewConfidence"::text AS "reviewConfidence",
             ${iso(`e."createdAt"`)} AS "createdAt"
      FROM "Edge" e JOIN live ON live.id = e."claimId" JOIN "Source" s ON s.id = e."sourceId"
      WHERE NOT e.deleted AND NOT s.deleted
      ORDER BY e.id${LIMIT}`,
    types: {
      id: "VARCHAR", claimId: "VARCHAR", sourceId: "VARCHAR", type: "VARCHAR", evidenceType: "VARCHAR", ingestedBy: "VARCHAR",
      autoApproved: "BOOLEAN", humanReviewed: "BOOLEAN", reviewedBy: "VARCHAR", reviewedAt: "TIMESTAMP", reviewConfidence: "VARCHAR",
      createdAt: "TIMESTAMP",
    },
  },
  ...[true, false].map((core) => ({
    name: core ? "claim_relations" : "claim_relations_context",
    sql: RELATIONS(core),
    types: {
      id: "VARCHAR", fromClaimId: "VARCHAR", toClaimId: "VARCHAR", relationType: "VARCHAR", linkKind: "VARCHAR",
      heuristic: "VARCHAR", year: "INTEGER", followUpContext: "VARCHAR", createdAt: "TIMESTAMP",
    },
  })),
  {
    name: "pipelines",
    sql: `
      WITH dm(pipeline, domain) AS ${DOMAIN_VALUES},
      reg(pipeline, upstream_name, upstream_url) AS (VALUES ${PIPELINES.map((p) => `(${q(p.tag)},${q(p.upstreamName)},${q(p.upstreamUrl ?? "")})`).join(",")}),
      lic(pipeline, licence, status, licence_url) AS (VALUES ${licences.length ? licences.map((l) => `(${q(l.pipeline)},${q(l.licence)},${q(l.status)},${q(l.licence_url)})`).join(",") : "('', '', '', '')"})
      SELECT c."ingestedBy" AS pipeline, coalesce(dm.domain, 'UNMAPPED') AS domain, count(*) AS claims,
             reg.upstream_name AS "upstreamName", nullif(reg.upstream_url, '') AS "upstreamUrl",
             lic.licence AS "upstreamLicence", lic.status AS "upstreamLicenceStatus", nullif(lic.licence_url, '') AS "upstreamLicenceUrl"
      FROM "Claim" c LEFT JOIN dm ON dm.pipeline = c."ingestedBy" LEFT JOIN reg ON reg.pipeline = c."ingestedBy"
      LEFT JOIN lic ON lic.pipeline = c."ingestedBy"
      WHERE NOT c.deleted AND c."ingestedBy" NOT IN (${exclList})
      GROUP BY 1, 2, 4, 5, 6, 7, 8 ORDER BY 3 DESC`,
    types: {
      pipeline: "VARCHAR", domain: "VARCHAR", claims: "BIGINT", upstreamName: "VARCHAR", upstreamUrl: "VARCHAR",
      upstreamLicence: "VARCHAR", upstreamLicenceStatus: "VARCHAR", upstreamLicenceUrl: "VARCHAR",
    },
  },
];

// Tables dropped by the front-door Phase 3 migration on 2026-09-30 (STATUS.md "Current state").
// Not in the live DB, so not in this export; listed because the Zenodo v1.0.0 dump predates the drop.
const DROPPED_2026_09_30 = [
  "User", "ApiKey", "ApiUsage", "Session", "Account", "VerificationToken", "Follow",
  "Collection*", "*Subscription", "Org*", "Litigation*",
];
const PERSONAL_COL = /(email|name|^ip|ipaddress|token|password|session|key|hash|address|phone|body)/i;

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') inQ = false; else cell += ch; }
    else if (ch === '"') inQ = true;
    else if (ch === ",") { cur.push(cell); cell = ""; }
    else if (ch === "\n") { cur.push(cell); rows.push(cur); cur = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

function dbUrl(): string {
  const url = process.env.DATABASE_URL_RO;
  if (!url) throw new Error("DATABASE_URL_RO missing from .env.local");
  return `${url.split("?")[0]}?sslmode=require`;
}

function psql(script: string): string {
  const res = spawnSync("psql", [dbUrl(), "-X", "-q", "-v", "ON_ERROR_STOP=1", "-P", "pager=off", "-A", "-t", "-f", "-"], {
    input: script,
    encoding: "utf8",
    maxBuffer: 1 << 28,
    env: { ...process.env, PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=0" },
  });
  if (res.status !== 0) throw new Error(`psql failed: ${(res.stderr || "").split("\n").slice(0, 5).join(" | ")}`);
  return res.stdout;
}

const oneLine = (sql: string) => sql.replace(/\s+/g, " ").trim();

async function sha256(file: string): Promise<string> {
  const h = createHash("sha256");
  await pipeline(fs.createReadStream(file), h);
  return h.digest("hex");
}

async function main() {
  const out = path.resolve(OUT!.replace(/^~(?=\/)/, process.env.HOME ?? "~"));
  fs.mkdirSync(out, { recursive: true });
  const csvPath = (n: string) => path.join(out, `${n}.csv`);
  const gitSha = execSync("git rev-parse HEAD").toString().trim();
  // The export's own inputs: scripts/paper, docs/paper (domain map, licences, dictionary, README), the registry.
  const gitDirty = execSync("git status --porcelain -- scripts/paper docs/paper lib/pipelines/registry.ts").toString().trim() !== "";

  // 1. One read-only snapshot: metadata, scans, then every \copy.
  console.error(`exporting to ${out}${SAMPLE ? ` (sample ${SAMPLE})` : ""}${EXCLUDE.length ? `, excluding ${EXCLUDE.join(", ")}` : ""}`);
  const marker = "@@";
  const script = [
    "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;",
    `SELECT '${marker}snapshot|' || ${iso("now()")} || '|' || pg_current_snapshot()::text || '|' || current_setting('server_version');`,
    `SELECT '${marker}tables|' || string_agg(t.table_name || ':' || coalesce(cols.c, ''), ';' ORDER BY t.table_name) FROM information_schema.tables t
       LEFT JOIN (SELECT table_name, string_agg(column_name, ',' ORDER BY ordinal_position) AS c FROM information_schema.columns WHERE table_schema = 'public' GROUP BY 1) cols USING (table_name)
       WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';`.replace(/\n\s*/g, " "),
    // Email redaction counts (rows touched per exported column).
    oneLine(`SELECT '${marker}redactions|' || json_build_object(
       'claims.text', (SELECT count(*) FROM "Claim" WHERE NOT deleted AND text ~ '${EMAIL_RE}'),
       'claims.metadata', (SELECT count(*) FROM "Claim" WHERE NOT deleted AND metadata::text ~ '${EMAIL_RE}'),
       'status_history.reason', (SELECT count(*) FROM "ClaimStatusHistory" h JOIN "Claim" c ON c.id = h."claimId" WHERE NOT c.deleted AND h.reason ~ '${EMAIL_RE}'),
       'sources.name', (SELECT count(*) FROM "Source" WHERE NOT deleted AND name ~ '${EMAIL_RE}'),
       'relations.followUpContext', (SELECT count(*) FROM "ClaimRelation" WHERE "followUpContext"::text ~ '${EMAIL_RE}'))::text;`),
    ...FILES.map((f) => `\\copy (${oneLine(f.sql)}) TO ${q(csvPath(f.name))} WITH (FORMAT csv, HEADER true)\n\\echo ${marker}copied|${f.name}`),
    "COMMIT;",
  ].join("\n");
  const t0 = Date.now();
  const log = psql(script);
  console.error(`snapshot copied in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const lines = log.split("\n").filter((l) => l.startsWith(marker)).map((l) => l.slice(marker.length).split("|"));
  const [, snapAt, snapId, pgVersion] = lines.find((l) => l[0] === "snapshot")!;
  const tableCols = new Map(
    lines.find((l) => l[0] === "tables")![1].split(";").map((x) => { const [t, c] = x.split(":"); return [t, (c ?? "").split(",").filter(Boolean)]; }),
  );
  const redactions = JSON.parse(lines.find((l) => l[0] === "redactions")![1]);

  // 2. Parquet (DuckDB, explicit types), gzip the CSVs, hash everything.
  const duck = await (await DuckDBInstance.create(":memory:")).connect();
  const files: { path: string; table: string; format: string; rows: number; bytes: number; sha256: string }[] = [];
  for (const f of FILES) {
    const csv = csvPath(f.name);
    const cols = Object.entries(f.types).map(([k, v]) => `'${k}': '${v}'`).join(", ");
    const parquet = path.join(out, `${f.name}.parquet`);
    await duck.run(
      `COPY (SELECT * FROM read_csv(${q(csv)}, header = true, columns = {${cols}}, timestampformat = '%Y-%m-%dT%H:%M:%S.%gZ', allow_quoted_nulls = false, max_line_size = 100000000))
       TO ${q(parquet)} (FORMAT parquet, COMPRESSION zstd)`,
    );
    const rows = Number((await duck.runAndReadAll(`SELECT count(*) FROM read_parquet(${q(parquet)})`)).getRows()[0][0]);
    const gz = `${csv}.gz`;
    await pipeline(fs.createReadStream(csv), createGzip({ level: 9 }), fs.createWriteStream(gz));
    if (!KEEP_CSV) fs.unlinkSync(csv);
    for (const [p, format] of [[gz, "csv.gz"], [parquet, "parquet"]] as const) {
      files.push({ path: path.basename(p), table: f.name, format, rows, bytes: fs.statSync(p).size, sha256: await sha256(p) });
    }
    console.error(`  ${f.name}: ${rows.toLocaleString("en-US")} rows`);
  }

  // 3. Docs into the archive.
  for (const [src, dst] of [["docs/paper/data-dictionary.md", "DATA_DICTIONARY.md"], ["docs/paper/README_DATA.md", "README_DATA.md"]]) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(out, dst));
      const p = path.join(out, dst);
      files.push({ path: dst, table: "", format: "md", rows: 0, bytes: fs.statSync(p).size, sha256: await sha256(p) });
    }
  }

  // 4. Manifest.
  const exported = new Set(["Claim", "ClaimStatusHistory", "Source", "Edge", "ClaimRelation"]);
  const manifest = {
    dataset: "Epistemic Receipts",
    exportedAt: new Date().toISOString(),
    snapshot: { at: snapAt, postgresSnapshot: snapId, postgresVersion: pgVersion, isolation: "REPEATABLE READ READ ONLY", role: "app_ro" },
    git: { commit: gitSha, uncommittedExportInputs: gitDirty },
    sample: SAMPLE,
    excludedPipelines: EXCLUDE,
    rules: {
      claims: "Claim.deleted = false",
      status_history: "rows of exported claims; placeholderDate = occurredAt on 1970-01-01 or after snapshot.at",
      sources: "referenced by an exported edge or by a history row of an exported claim",
      edges: "Edge.deleted = false, claim exported, source not deleted",
      claim_relations: "both claims exported; linkKind upstream_record | identifier_match",
      claim_relations_context: "both claims exported; linkKind name_or_text_match | time_window — machine-derived context, not core graph",
    },
    files,
    redactions: { replacement: REDACTED, pattern: EMAIL_RE, rowsTouched: redactions },
    excludedTables: [...tableCols.keys()].filter((t) => !exported.has(t)).sort().map((t) => ({
      table: t,
      personalLookingColumns: tableCols.get(t)!.filter((c) => PERSONAL_COL.test(c)),
    })),
    droppedBeforeExport: { date: "2026-09-30", tables: DROPPED_2026_09_30, note: "dropped from the live database; never in this export" },
    excludedColumns: { Claim: ["searchVector (generated)", "deleted (always false)"], Edge: ["deleted (always false)"], Source: ["deleted (always false)"] },
  };
  fs.writeFileSync(path.join(out, "MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n");

  // 5. Sizes.
  const total = files.reduce((s, f) => s + f.bytes, 0);
  console.log(`\n${out}`);
  for (const f of files) console.log(`${f.path.padEnd(34)} ${(f.bytes / 1e6).toFixed(1).padStart(10)} MB  ${f.rows ? f.rows.toLocaleString("en-US").padStart(11) + " rows" : ""}`);
  console.log(`${"MANIFEST.json".padEnd(34)} ${(fs.statSync(path.join(out, "MANIFEST.json")).size / 1e6).toFixed(3).padStart(10)} MB`);
  console.log(`total ${(total / 1e9).toFixed(2)} GB`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
