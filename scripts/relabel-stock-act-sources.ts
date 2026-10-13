/**
 * relabel-stock-act-sources.ts — Phase 7 Q9 (owner decision 2026-10-12/13).
 *
 * The 921 congress_stock_act_v1 trades came from Quiver Quantitative's
 * congressional-trading API (scripts/ingest-congress-stock-act.ts), not from
 * the House / Senate filings, yet each trade's Source is typed "primary" and
 * points at the member's bioguide page. Relabel each one as secondary with
 * Quiver credited:
 *   Source.methodologyType  primary → derivative
 *   Source.name             "<old name>, via Quiver Quantitative"
 *   Source.url              Quiver's page for that member
 *                           (quiverquant.com/congresstrading/politician/<name>-<bioguide>),
 *                           checked live; Quiver's congressional-trading page
 *                           when the member page does not check out or there is
 *                           no bioguide id
 * and record the old values in the claim's metadata.corrections. The set does
 * not grow (owner). Each Source here is used by exactly one STOCK Act claim.
 *
 *   npx tsx scripts/relabel-stock-act-sources.ts             # plan + URL check → logs/q9-quiver-urls.json
 *   npx tsx scripts/relabel-stock-act-sources.ts --execute   # write (needs the owner's yes)
 *
 * Reads use DATABASE_URL_RO (app_ro); only --execute opens DATABASE_URL. URL
 * checks are cached in logs/q9-quiver-urls.json (one request per second, a
 * browser user agent, 200 + a Quiver "Trading Activity" title required). One
 * transaction; each update requires the Source to still hold its old values.
 */
import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import { Pool } from "pg";

loadEnv({ path: ".env.local", quiet: true });

const EXECUTE = process.argv.includes("--execute");
const BATCH_ID = "p7-q9-stock-act-relabel-2026-10";
const SCRIPT = "scripts/relabel-stock-act-sources.ts";
const CACHE = "logs/q9-quiver-urls.json";
const QUIVER_LIST = "https://www.quiverquant.com/congresstrading/";
const SUFFIX = ", via Quiver Quantitative";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

type Row = {
  claimId: string;
  sourceId: string;
  name: string;
  url: string | null;
  methodologyType: string;
  member: string | null;
  bioguide: string | null;
  otherClaims: number;
};

function pool(url: string, readOnly: boolean): Pool {
  return new Pool({
    connectionString: url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, ""),
    ssl: { rejectUnauthorized: false },
    max: 1,
    ...(readOnly ? { options: "-c default_transaction_read_only=on" } : {}),
  });
}

export function quiverMemberUrl(member: string, bioguide: string): string {
  return `https://www.quiverquant.com/congresstrading/politician/${encodeURIComponent(member)}-${bioguide}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One page check; a 429 waits out Retry-After (default 60 s) and tries again, up to 3 times. */
async function checkUrl(url: string): Promise<{ ok: boolean; status: number | null; title: string | null }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await checkOnce(url);
    if (r.status !== 429 && r.status !== null) return r;
    const wait = r.status === 429 ? Math.min(300, Number(r.retryAfter) || 60) : 30;
    console.log(`  ${r.status ?? "timeout"} on ${url} — waiting ${wait}s`);
    await sleep(wait * 1000);
  }
  return { ok: false, status: null, title: null };
}

async function checkOnce(url: string): Promise<{ ok: boolean; status: number | null; title: string | null; retryAfter?: string | null }> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(30000) });
    const html = res.ok ? await res.text() : "";
    const title = /<title>([^<]*)/i.exec(html)?.[1]?.trim() ?? null;
    return { ok: res.status === 200 && !!title && /Trading Activity \| Quiver Quantitative/.test(title), status: res.status, title, retryAfter: res.headers.get("retry-after") };
  } catch {
    return { ok: false, status: null, title: null };
  }
}

async function main() {
  const rwUrl = process.env.DATABASE_URL;
  if (!rwUrl) throw new Error("DATABASE_URL is not set (expected in .env.local)");
  const ro = pool(process.env.DATABASE_URL_RO ?? rwUrl, true);
  console.log(`reads: ${process.env.DATABASE_URL_RO ? "app_ro (DATABASE_URL_RO)" : "DATABASE_URL, read-only session"}`);
  try {
    const rows = (
      await ro.query<Row>(
        `SELECT c.id AS "claimId", s.id AS "sourceId", s.name, s.url, s."methodologyType",
                c.metadata->>'member_name' AS member, c.metadata->>'bioguide_id' AS bioguide,
                (SELECT count(*)::int FROM "Edge" e2 WHERE e2."sourceId" = s.id AND e2."claimId" <> c.id) AS "otherClaims"
         FROM "Claim" c
         JOIN "Edge" e ON e."claimId" = c.id AND NOT e.deleted
         JOIN "Source" s ON s.id = e."sourceId"
         WHERE c."ingestedBy" = 'congress_stock_act_v1' AND NOT c.deleted
         ORDER BY c.id`,
      )
    ).rows;

    // Live check of each distinct member URL (cached).
    const cache: Record<string, { ok: boolean; status: number | null; title: string | null; checked: string }> =
      fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
    const urls = [...new Set(rows.filter((r) => r.member && r.bioguide).map((r) => quiverMemberUrl(r.member!, r.bioguide!)))];
    let fetched = 0;
    // Only definite answers are cached; rate limits and timeouts are retried on the next run.
    for (const u of urls) {
      if (cache[u] && cache[u].status !== 429 && cache[u].status !== null) continue;
      const r = await checkUrl(u);
      fetched++;
      if (r.status !== null && r.status !== 429) {
        cache[u] = { ok: r.ok, status: r.status, title: r.title, checked: new Date().toISOString() };
        fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
      } else delete cache[u];
      await sleep(20000); // Quiver rate-limits at about one request a second
    }
    console.log(`Quiver member pages: ${urls.length} distinct · checked now ${fetched} · ok ${urls.filter((u) => cache[u]?.ok).length} · unanswered ${urls.filter((u) => !cache[u]).length}`);
    for (const u of urls.filter((u) => cache[u] && !cache[u].ok)) console.log(`  not ok (${cache[u].status}, "${cache[u].title}"): ${u}`);

    type Plan = Row & { newName: string; newUrl: string; urlKind: "member page" | "Quiver list (no bioguide id)" | "Quiver list (member page failed)" };
    const plans: Plan[] = [];
    const skips = new Map<string, number>();
    const skip = (k: string) => skips.set(k, (skips.get(k) ?? 0) + 1);
    for (const r of rows) {
      if (r.otherClaims > 0) { skip("Source shared with another claim"); continue; }
      if (r.methodologyType === "derivative" && r.name.endsWith(SUFFIX)) { skip("already relabelled"); continue; }
      if (r.methodologyType !== "primary") { skip(`methodologyType ${r.methodologyType}`); continue; }
      const member = r.member && r.bioguide ? quiverMemberUrl(r.member, r.bioguide) : null;
      const urlKind: Plan["urlKind"] = !member ? "Quiver list (no bioguide id)" : cache[member]?.ok ? "member page" : "Quiver list (member page failed)";
      if (EXECUTE && member && !cache[member]) throw new Error(`${member} was never answered — rerun the dry run first`);
      plans.push({ ...r, newName: `${r.name}${SUFFIX}`, newUrl: urlKind === "member page" ? member! : QUIVER_LIST, urlKind });
    }
    console.log(`STOCK Act claims: ${rows.length} · to relabel: ${plans.length}`);
    for (const [k, n] of skips) console.log(`  skipped ${n}: ${k}`);
    const kinds = new Map<string, number>();
    for (const p of plans) kinds.set(p.urlKind, (kinds.get(p.urlKind) ?? 0) + 1);
    for (const [k, n] of kinds) console.log(`  url → ${k}: ${n}`);
    console.log("\nsample:");
    for (const p of plans.filter((_, i) => i % Math.max(1, Math.floor(plans.length / 6)) === 0).slice(0, 6))
      console.log(`- ${p.claimId}\n    before: [${p.methodologyType}] ${p.name} — ${p.url ?? "(no url)"}\n    after:  [derivative] ${p.newName} — ${p.newUrl}`);

    if (!EXECUTE) {
      console.log("\nNo writes. --execute applies the relabel, after the owner's yes.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const rw = pool(rwUrl, false);
    const db = await rw.connect();
    try {
      await db.query("BEGIN");
      for (const p of plans) {
        const s = await db.query(
          `UPDATE "Source" SET name = $2, url = $3, "methodologyType" = 'derivative'
           WHERE id = $1 AND name = $4 AND url IS NOT DISTINCT FROM $5 AND "methodologyType" = 'primary'`,
          [p.sourceId, p.newName, p.newUrl, p.name, p.url],
        );
        if (s.rowCount !== 1) throw new Error(`${p.sourceId}: expected 1 source, got ${s.rowCount} — rolled back`);
        const corr = {
          batch: BATCH_ID, date: today, field: "Source", sourceId: p.sourceId,
          reason: "the trade data came from Quiver Quantitative's congressional-trading API, not the filings: relabelled secondary, Quiver credited",
          before: { name: p.name, url: p.url, methodologyType: p.methodologyType },
          after: { name: p.newName, url: p.newUrl, methodologyType: "derivative" },
          by: SCRIPT,
        };
        const c = await db.query(
          `UPDATE "Claim" SET metadata = metadata || jsonb_build_object('corrections', coalesce(metadata->'corrections', '[]'::jsonb) || jsonb_build_array($2::jsonb)), "updatedAt" = now()
           WHERE id = $1 AND "ingestedBy" = 'congress_stock_act_v1'`,
          [p.claimId, JSON.stringify(corr)],
        );
        if (c.rowCount !== 1) throw new Error(`${p.claimId}: expected 1 claim, got ${c.rowCount} — rolled back`);
      }
      await db.query("COMMIT");
    } catch (e) {
      await db.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      db.release();
      await rw.end();
    }
    const n = (
      await ro.query<{ derivative: number; primary: number; credited: number }>(
        `SELECT count(*) FILTER (WHERE s."methodologyType" = 'derivative')::int AS derivative,
                count(*) FILTER (WHERE s."methodologyType" = 'primary')::int AS primary,
                count(*) FILTER (WHERE s.name LIKE '%' || $1)::int AS credited
         FROM "Claim" c JOIN "Edge" e ON e."claimId" = c.id AND NOT e.deleted JOIN "Source" s ON s.id = e."sourceId"
         WHERE c."ingestedBy" = 'congress_stock_act_v1' AND NOT c.deleted`,
        [SUFFIX],
      )
    ).rows[0];
    console.log(`database: STOCK Act sources derivative ${n.derivative}, primary ${n.primary}, credited to Quiver ${n.credited}`);
  } finally {
    await ro.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
