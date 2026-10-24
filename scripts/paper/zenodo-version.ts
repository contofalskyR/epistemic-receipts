/**
 * zenodo-version.ts — prepare (and, only on --execute, create) version 2.0.0 of
 * Zenodo concept record 10.5281/zenodo.23049991 from a finished export.
 *
 *   npx tsx scripts/paper/zenodo-version.ts --export ~/er-export/2026-10-28
 *       Dry run, NO network: prints the metadata diff (current record, saved in
 *       docs/paper/zenodo/record-23049992-2026-10-24.json, vs
 *       docs/paper/zenodo/proposed-metadata.json + description.html filled from the
 *       export's MANIFEST.json) and the exact file list with sizes.
 *
 *   ZENODO_TOKEN=… npx tsx scripts/paper/zenodo-version.ts --export <dir> --execute
 *       Creates the new-version DRAFT (POST actions/newversion on 23049992), deletes
 *       the files the draft inherits from v1.0.0 (the database dump), uploads every
 *       export file through the bucket API, and writes the metadata. It does NOT
 *       publish: review the draft on zenodo.org, then rerun with --publish
 *       (POST actions/publish; permanent). Only after the owner's yes.
 *
 * Endpoints per https://developers.zenodo.org/ (checked 2026-10-24): newversion,
 * GET deposition, GET/DELETE files, PUT {links.bucket}/{name}, PUT deposition,
 * POST actions/publish. Limits: 50 GB per record, 100 files.
 * The token is read from the environment (ZENODO_TOKEN, e.g. from .env.local) and
 * never printed.
 */
import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import * as path from "path";

loadEnv({ path: ".env.local", quiet: true });

const argv = process.argv.slice(2);
const opt = (k: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : undefined);
const EXPORT = opt("export");
const EXECUTE = argv.includes("--execute");
const PUBLISH = argv.includes("--publish");
const DRAFT_ID = opt("draft");
const RECORD_ID = "23049992"; // latest published version (v1.0.0) of concept 23049991
const API = "https://zenodo.org/api";
const CURRENT = "docs/paper/zenodo/record-23049992-2026-10-24.json";
const PROPOSED = "docs/paper/zenodo/proposed-metadata.json";

type Manifest = { files: { path: string; bytes: number; sha256: string; rows: number; table: string; format: string }[]; sample: number | null };

function proposedMetadata(manifest: Manifest | null, claims: { total: number; t1: number; t2: number } | null) {
  const p = JSON.parse(fs.readFileSync(PROPOSED, "utf8"));
  const tpl = fs.readFileSync(p.description_template, "utf8");
  const fmt = (n?: number) => (n === undefined ? "{{?}}" : n.toLocaleString("en-US"));
  const description = tpl
    .replace("{{claims}}", fmt(claims?.total))
    .replace("{{t1}}", fmt(claims?.t1))
    .replace("{{t2}}", fmt(claims?.t2))
    .replace(/\n/g, "");
  delete p.description_template;
  return { ...p, description, ...(manifest?.sample ? { title: `[SAMPLE — do not publish] ${p.title}` } : {}) };
}

async function claimCounts(dir: string) {
  const { DuckDBInstance } = await import("@duckdb/node-api");
  const c = await (await DuckDBInstance.create(":memory:")).connect();
  const f = path.join(dir, "claims.parquet").replace(/'/g, "''");
  const r = (await c.runAndReadAll(
    `SELECT count(*), count(*) FILTER (WHERE trajectoryT1), count(*) FILTER (WHERE trajectoryT2) FROM read_parquet('${f}')`,
  )).getRows()[0];
  return { total: Number(r[0]), t1: Number(r[1]), t2: Number(r[2]) };
}

function diff(current: Record<string, unknown>, proposed: Record<string, unknown>) {
  const keys = [...new Set([...Object.keys(current), ...Object.keys(proposed)])].filter((k) => !["doi", "prereserve_doi", "relations", "publication_date", "resource_type", "access_right_category"].includes(k));
  const show = (v: unknown) => (v === undefined ? "(absent)" : typeof v === "string" ? v : JSON.stringify(v));
  for (const k of keys.sort()) {
    const a = show(current[k]), b = show(proposed[k]);
    if (a === b) continue;
    console.log(`\n### ${k}\n- current:  ${a.length > 600 ? a.slice(0, 600) + " …" : a}\n- proposed: ${b.length > 600 ? b.slice(0, 600) + " …" : b}`);
  }
}

async function zenodo(method: string, url: string, body?: unknown, raw?: fs.ReadStream, size?: number) {
  const token = process.env.ZENODO_TOKEN;
  if (!token) throw new Error("ZENODO_TOKEN missing");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (raw) { headers["Content-Type"] = "application/octet-stream"; headers["Content-Length"] = String(size); }
  const res = await fetch(url, {
    method, headers,
    body: body !== undefined ? JSON.stringify(body) : (raw as unknown as BodyInit | undefined),
    ...(raw ? { duplex: "half" } : {}),
  } as RequestInit);
  if (!res.ok) throw new Error(`${method} ${url.replace(API, "")} → ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

async function main() {
  if (!EXPORT && !PUBLISH) throw new Error("--export <dir> is required");
  const current = JSON.parse(fs.readFileSync(CURRENT, "utf8"));

  if (PUBLISH) {
    if (!DRAFT_ID) throw new Error("--publish needs --draft <id> (printed by --execute)");
    const r = await zenodo("POST", `${API}/deposit/depositions/${DRAFT_ID}/actions/publish`);
    console.log(`published: ${r.doi} ${r.links?.html ?? ""}`);
    return;
  }

  const dir = path.resolve(EXPORT!.replace(/^~(?=\/)/, process.env.HOME ?? "~"));
  const manifest: Manifest = JSON.parse(fs.readFileSync(path.join(dir, "MANIFEST.json"), "utf8"));
  const proposed = proposedMetadata(manifest, await claimCounts(dir));
  const uploads = [...manifest.files.map((f) => f.path), "MANIFEST.json"].filter((p, i, a) => a.indexOf(p) === i);

  console.log(`# Zenodo new version — dry run${EXECUTE ? " (then EXECUTE)" : ""}`);
  console.log(`\nConcept DOI ${current.conceptdoi}; new version of record ${RECORD_ID} (${current.metadata.version}).`);
  if (manifest.sample) console.log(`\n**WARNING: ${dir} is a SAMPLE export (sample=${manifest.sample}). Do not upload it.**`);
  console.log(`\n## Metadata diff (current → proposed)`);
  diff(current.metadata, proposed);
  console.log(`\n## Files`);
  console.log(`\nRemoved from the new version (inherited from ${current.metadata.version}):`);
  for (const f of current.files ?? []) console.log(`- ${f.key}  ${(f.size / 1e9).toFixed(2)} GB  ${f.checksum}`);
  console.log(`\nUploaded:`);
  let total = 0;
  for (const p of uploads) {
    const bytes = fs.statSync(path.join(dir, p)).size;
    total += bytes;
    const m = manifest.files.find((f) => f.path === p);
    console.log(`- ${p.padEnd(34)} ${(bytes / 1e6).toFixed(1).padStart(10)} MB${m?.rows ? `  ${m.rows.toLocaleString("en-US")} rows` : ""}${m ? `  sha256:${m.sha256.slice(0, 16)}…` : ""}`);
  }
  console.log(`\n${uploads.length} files, ${(total / 1e9).toFixed(2)} GB (Zenodo limit: 100 files, 50 GB).`);
  if (!EXECUTE) { console.log(`\nDry run only: nothing was sent to Zenodo.`); return; }
  if (manifest.sample) throw new Error("refusing to upload a sample export");

  // Execute: draft only, never publish here.
  const nv = await zenodo("POST", `${API}/deposit/depositions/${RECORD_ID}/actions/newversion`);
  const draftUrl: string = nv.links.latest_draft;
  const draft = await zenodo("GET", draftUrl);
  console.log(`\ndraft ${draft.id}: ${draft.links.html}`);
  for (const f of (await zenodo("GET", `${draftUrl}/files`)) as { id: string; filename: string }[]) {
    await zenodo("DELETE", `${draftUrl}/files/${f.id}`);
    console.log(`  removed inherited ${f.filename}`);
  }
  for (const p of uploads) {
    const file = path.join(dir, p);
    await zenodo("PUT", `${draft.links.bucket}/${encodeURIComponent(p)}`, undefined, fs.createReadStream(file), fs.statSync(file).size);
    console.log(`  uploaded ${p}`);
  }
  await zenodo("PUT", draftUrl, { metadata: proposed });
  console.log(`\nDraft ready, NOT published: ${draft.links.html}\nPublish after review: npx tsx scripts/paper/zenodo-version.ts --publish --draft ${draft.id}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
