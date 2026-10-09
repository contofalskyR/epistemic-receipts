/**
 * promote-transition-sources.ts — copy ACCEPTED claude_sourcing_v1 candidates
 * into Source + Edge. Run by hand, after review. Without --confirm it only
 * prints what it would write.
 *
 *   npx tsx scripts/promote-transition-sources.ts             # plan, no writes
 *   npx tsx scripts/promote-transition-sources.ts --confirm   # write, one transaction
 *
 * Per accepted, unpromoted candidate:
 *   Source — reused when a non-deleted Source already has exactly this URL,
 *            else created (methodologyType 'primary', ingestedBy 'claude_sourcing_v1',
 *            humanReviewed: the owner accepted it in review).
 *   Edge   — CITES from that Source to the claim (the human-curated
 *            connection type, AGENTS.md "Editorial-not-algorithmic"), unless a
 *            non-deleted edge between the two already exists. No EdgeRevision:
 *            CITES edges carry no score.
 *   The candidate gets promotedAt / promotedSourceId / promotedEdgeId, so a
 *   rerun promotes nothing twice.
 * ClaimStatusHistory is not touched (owner decision 2026-10-08): the
 * transition's marker source stays as it is.
 */
import { config as loadEnv } from "dotenv";
import { PIPELINE_TAG, cuid, makePool, sourceName } from "./lib/transition-sourcing";

loadEnv({ path: ".env.local", quiet: true });

const CONFIRM = process.argv.includes("--confirm");

type Row = {
  id: string;
  claimId: string;
  url: string;
  title: string | null;
  publisher: string | null;
  publishedAt: Date | null;
  reviewedAt: Date | null;
};

async function main() {
  const pool = makePool(2);
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const rows = (
      await db.query<Row>(
        `SELECT id, "claimId", url, title, publisher, "publishedAt", "reviewedAt"
         FROM "TransitionSourceCandidate"
         WHERE status = 'accepted' AND "promotedAt" IS NULL AND url IS NOT NULL
         ORDER BY "reviewedAt", id
         FOR UPDATE`,
      )
    ).rows;
    const urls = [...new Set(rows.map((r) => r.url))];
    const existing = new Map<string, string>();
    if (urls.length) {
      const s = await db.query<{ url: string; id: string }>(
        `SELECT DISTINCT ON (url) url, id FROM "Source" WHERE url = ANY($1) AND deleted = false ORDER BY url, "createdAt"`,
        [urls],
      );
      for (const x of s.rows) existing.set(x.url, x.id);
    }
    console.log(`accepted, not yet promoted: ${rows.length} · distinct URLs ${urls.length} · already a Source ${existing.size}`);

    if (!CONFIRM) {
      await db.query("ROLLBACK");
      console.log("No writes. Re-run with --confirm to promote these rows into Source + Edge in one transaction.");
      process.exitCode = rows.length ? 2 : 0;
      return;
    }

    const n = { sourcesCreated: 0, sourcesReused: 0, edgesCreated: 0, edgesExisting: 0 };
    const created = new Map<string, string>(); // url → Source id made in this run
    for (const r of rows) {
      let sourceId = existing.get(r.url) ?? created.get(r.url);
      if (sourceId) n.sourcesReused++;
      else {
        sourceId = cuid();
        await db.query(
          `INSERT INTO "Source" (id, name, url, "publishedAt", "methodologyType", "ingestedBy", "humanReviewed", "reviewedAt", "autoApproved")
           VALUES ($1, $2, $3, $4, 'primary', $5, true, $6, false)`,
          [sourceId, sourceName(r), r.url, r.publishedAt, PIPELINE_TAG, r.reviewedAt],
        );
        created.set(r.url, sourceId);
        n.sourcesCreated++;
      }
      const e = await db.query<{ id: string }>(
        `SELECT id FROM "Edge" WHERE "claimId" = $1 AND "sourceId" = $2 AND deleted = false ORDER BY "createdAt" LIMIT 1`,
        [r.claimId, sourceId],
      );
      let edgeId = e.rows[0]?.id;
      if (edgeId) n.edgesExisting++;
      else {
        edgeId = cuid();
        await db.query(
          `INSERT INTO "Edge" (id, "sourceId", "claimId", type, "evidenceType", "ingestedBy", "humanReviewed", "reviewedAt", "autoApproved")
           VALUES ($1, $2, $3, 'CITES', 'EVIDENTIARY', $4, true, $5, false)`,
          [edgeId, sourceId, r.claimId, PIPELINE_TAG, r.reviewedAt],
        );
        n.edgesCreated++;
      }
      await db.query(
        `UPDATE "TransitionSourceCandidate" SET "promotedAt" = now(), "promotedSourceId" = $2, "promotedEdgeId" = $3 WHERE id = $1`,
        [r.id, sourceId, edgeId],
      );
    }
    await db.query("COMMIT");
    console.log(
      `committed: ${rows.length} promoted · Source created ${n.sourcesCreated}, reused ${n.sourcesReused} · ` +
        `Edge created ${n.edgesCreated}, already present ${n.edgesExisting}`,
    );

    // Counts from the database, not the loop (AGENTS.md "Verify ingester counters").
    const v = await db.query(
      `SELECT (SELECT count(*)::int FROM "Source" WHERE "ingestedBy" = $1) AS sources,
              (SELECT count(*)::int FROM "Edge" WHERE "ingestedBy" = $1) AS edges,
              (SELECT count(*)::int FROM "TransitionSourceCandidate" WHERE "promotedAt" IS NOT NULL) AS promoted`,
      [PIPELINE_TAG],
    );
    console.log(`database: Source(${PIPELINE_TAG}) ${v.rows[0].sources} · Edge(${PIPELINE_TAG}) ${v.rows[0].edges} · promoted candidates ${v.rows[0].promoted}`);
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    db.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
