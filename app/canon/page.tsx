import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import SettlingCurveMini, { type MiniMilestone } from "@/app/components/SettlingCurveMini";
import PageHero from "@/app/components/PageHero";
import { cleanDisplayText } from "@/lib/text";
import { AXIS_BG_CLASS } from "@/lib/status";

// ISR hourly per B17-2. The census behind the header runs as one aggregate
// query; row loading is paginated at 50 with server-side filters (scale-safe
// regardless of how far the citation backfill reaches).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "The Canon — most-cited papers, audited — Epistemic Receipts",
  description:
    "Every paper in the corpus above 5,000 citations, ranked by citation count, each with its audit state: a sourced settling curve, a reviewed-no-event verdict, or no verified settling event yet.",
};

const PAGE_SIZE = 50;
const CITED_INT = Prisma.sql`CASE WHEN (c.metadata->>'cited_by_count') ~ '^[0-9]+$' THEN (c.metadata->>'cited_by_count')::int ELSE 0 END`;

type CanonRow = {
  id: string;
  text: string;
  year: number | null;
  cited: number;
  doi: string | null;
  review: { reviewedAt?: string; result?: string; model?: string; skipReason?: string } | null;
  steps: number;
  last_axis: string | null;
};

type Filter = "all" | "curved" | "reversed" | "single";

function fmtCitations(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("en-US");
}

function filterFragment(filter: Filter) {
  switch (filter) {
    case "curved":
      return Prisma.sql`AND h.steps >= 2`;
    case "reversed":
      return Prisma.sql`AND h.last_axis = 'REVERSED'`;
    case "single":
      return Prisma.sql`AND h.steps < 2`;
    default:
      return Prisma.empty;
  }
}

export default async function CanonPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter: Filter = (["all", "curved", "reversed", "single"] as const).includes(sp.filter as Filter)
    ? (sp.filter as Filter)
    : "all";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  // ── Census aggregates (the header's denominators — one round trip) ────────
  const [agg] = await prisma.$queryRaw<
    {
      total: number;
      curved: number;
      reversed: number;
      reviewed: number;
      openalex_total: number;
      no_count: number;
    }[]
  >`
    WITH pop AS (
      SELECT c.id,
             c.metadata ? 'promoterReview' AS reviewed,
             h.steps, h.last_axis
      FROM "Claim" c
      JOIN LATERAL (
        SELECT COUNT(*)::int AS steps,
               (array_agg(h."toAxis" ORDER BY h.seq NULLS LAST, h."occurredAt", h."createdAt"))[COUNT(*)::int] AS last_axis
        FROM "ClaimStatusHistory" h WHERE h."claimId" = c.id
      ) h ON true
      WHERE c."ingestedBy" = 'openalex_v1'
        AND c.deleted = false
        AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
        AND ${CITED_INT} >= 5000
    )
    SELECT
      (SELECT COUNT(*)::int FROM pop) AS total,
      (SELECT COUNT(*)::int FROM pop WHERE steps >= 2) AS curved,
      (SELECT COUNT(*)::int FROM pop WHERE last_axis = 'REVERSED') AS reversed,
      (SELECT COUNT(*)::int FROM pop WHERE reviewed) AS reviewed,
      (SELECT COUNT(*)::int FROM "Claim" c
        WHERE c."ingestedBy" = 'openalex_v1' AND c.deleted = false
          AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED') AS openalex_total,
      (SELECT COUNT(*)::int FROM "Claim" c
        WHERE c."ingestedBy" = 'openalex_v1' AND c.deleted = false
          AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
          AND NOT ((c.metadata->>'cited_by_count') ~ '^[0-9]+$')) AS no_count
  `;

  const frag = filterFragment(filter);
  const [{ filtered }] = await prisma.$queryRaw<{ filtered: number }[]>`
    SELECT COUNT(*)::int AS filtered
    FROM "Claim" c
    JOIN LATERAL (
      SELECT COUNT(*)::int AS steps,
             (array_agg(h."toAxis" ORDER BY h.seq NULLS LAST, h."occurredAt", h."createdAt"))[COUNT(*)::int] AS last_axis
      FROM "ClaimStatusHistory" h WHERE h."claimId" = c.id
    ) h ON true
    WHERE c."ingestedBy" = 'openalex_v1'
      AND c.deleted = false
      AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
      AND ${CITED_INT} >= 5000
      ${frag}
  `;

  const pageCount = Math.max(1, Math.ceil(filtered / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const offset = (safePage - 1) * PAGE_SIZE;

  const rows = await prisma.$queryRaw<CanonRow[]>`
    SELECT c.id, c.text,
           EXTRACT(YEAR FROM c."claimEmergedAt")::int AS year,
           ${CITED_INT} AS cited,
           c.metadata->>'doi' AS doi,
           c.metadata->'promoterReview' AS review,
           h.steps, h.last_axis
    FROM "Claim" c
    JOIN LATERAL (
      SELECT COUNT(*)::int AS steps,
             (array_agg(h."toAxis" ORDER BY h.seq NULLS LAST, h."occurredAt", h."createdAt"))[COUNT(*)::int] AS last_axis
      FROM "ClaimStatusHistory" h WHERE h."claimId" = c.id
    ) h ON true
    WHERE c."ingestedBy" = 'openalex_v1'
      AND c.deleted = false
      AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
      AND ${CITED_INT} >= 5000
      ${frag}
    ORDER BY 4 DESC, c."claimEmergedAt" ASC NULLS LAST, c.id
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  // Milestones for the minis — only the multi-step rows on this page.
  const curvedIds = rows.filter((r) => r.steps >= 2).map((r) => r.id);
  const milestonesByClaim = new Map<string, MiniMilestone[]>();
  if (curvedIds.length > 0) {
    const ms = await prisma.$queryRaw<{ claimId: string; year: number; axis: string; reason: string | null }[]>`
      SELECT h."claimId",
             EXTRACT(YEAR FROM h."occurredAt")::int AS year,
             h."toAxis" AS axis,
             h.reason
      FROM "ClaimStatusHistory" h
      WHERE h."claimId" IN (${Prisma.join(curvedIds)})
      ORDER BY h."claimId", h.seq NULLS LAST, h."occurredAt", h."createdAt"
    `;
    for (const m of ms) {
      const list = milestonesByClaim.get(m.claimId) ?? [];
      list.push({ year: m.year, axis: m.axis, reason: m.reason });
      milestonesByClaim.set(m.claimId, list);
    }
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: agg.total },
    { key: "curved", label: "Curved", count: agg.curved },
    { key: "reversed", label: "Reversed", count: agg.reversed },
    { key: "single", label: "Single-step", count: agg.total - agg.curved },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 px-6 py-10">
      <PageHero
        eyebrow="Discover · The Canon"
        title="Most-cited papers, audited"
        lede="Every paper in the corpus above 5,000 citations, ranked. Citations rank visibility, not merit — a place on this list says the literature looked at a paper, not that the paper is right. Each row carries its audit state: a sourced settling curve, a reviewed-no-event verdict, or no verified settling event yet."
        stats={[
          {
            label: "Papers ≥ 5,000 citations",
            value: agg.total.toLocaleString("en-US"),
            explain: "openalex_v1 claims whose OpenAlex cited_by_count is at least 5,000 at the last backfill.",
            cite: { href: "/datasets", label: "pipeline data card" },
          },
          {
            label: "Carry settling curves",
            value: agg.curved.toLocaleString("en-US"),
            sub: `${agg.reversed.toLocaleString("en-US")} reversed`,
            explain: "Papers with two or more dated, sourced status transitions (multi-step trajectories).",
            tone: "green",
          },
          ...(agg.reviewed > 0
            ? [
                {
                  label: "Reviewed, no event found",
                  value: agg.reviewed.toLocaleString("en-US"),
                  explain:
                    "Papers the research loop reviewed without finding a dated, citable adjudicating event — an honest verdict, recorded as a receipt.",
                  tone: "default" as const,
                },
              ]
            : []),
        ]}
      />

      <p className="text-xs text-gray-600 leading-relaxed max-w-3xl">
        The loop only writes transitions it can source: the absence of a curve is the absence of a{" "}
        <em>verified adjudicating document</em>, not a verdict about the paper.
        {agg.no_count > 0 && (
          <>
            {" "}
            Fine print on the ranking: {agg.no_count.toLocaleString("en-US")} of{" "}
            {agg.openalex_total.toLocaleString("en-US")} papers in the corpus carry no citation count yet, so this
            list cannot see them.
          </>
        )}{" "}
        Shapes of settling across the whole corpus live at{" "}
        <Link href="/patterns" className="underline hover:text-gray-300">
          /patterns
        </Link>
        ; method notes at{" "}
        <Link href="/methodology" className="underline hover:text-gray-300">
          /methodology
        </Link>
        .
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/canon" : `/canon?filter=${f.key}`}
            className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-colors ${
              filter === f.key
                ? "border-amber-500/60 text-amber-300 bg-amber-500/10"
                : "border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700"
            }`}
          >
            {f.label} ({f.count.toLocaleString("en-US")})
          </Link>
        ))}
      </div>

      {/* Rows */}
      <ol className="space-y-3" start={offset + 1}>
        {rows.map((r, i) => {
          const rank = offset + i + 1;
          const title = cleanDisplayText(r.text);
          const reviewed = r.review?.reviewedAt ? r.review : null;
          return (
            <li
              key={r.id}
              className="rounded-lg border border-gray-800 bg-gray-900/60 hover:border-gray-700 transition-colors"
            >
              <Link href={`/claims/${r.id}`} className="block px-4 py-3">
                <div className="flex items-baseline gap-3">
                  <span className="text-[10px] font-mono text-gray-600 w-8 shrink-0 text-right">{rank}.</span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm text-gray-200 leading-snug line-clamp-2">{title}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-gray-500">
                      <span>{r.year ?? "—"}</span>
                      <span className="text-gray-400">{fmtCitations(r.cited)} citations</span>
                      {r.steps >= 2 && r.last_axis ? (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${
                            AXIS_BG_CLASS[r.last_axis] ?? "bg-gray-800 text-gray-400"
                          }`}
                        >
                          {r.last_axis}
                        </span>
                      ) : reviewed ? (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-gray-800/80 text-gray-500"
                          title={reviewed.model ? `Reviewed by ${reviewed.model}` : undefined}
                        >
                          Reviewed {String(reviewed.reviewedAt).slice(0, 10)} · no settling event found
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-gray-800/50 text-gray-600">
                          no verified settling event
                        </span>
                      )}
                      {r.doi && <span className="text-gray-700 truncate max-w-[16rem]">doi:{r.doi}</span>}
                    </div>
                    {r.steps >= 2 && milestonesByClaim.has(r.id) && (
                      <div className="max-w-md pt-1">
                        <SettlingCurveMini
                          milestones={milestonesByClaim.get(r.id)!}
                          animate={false}
                          ariaLabel={`Settling curve for ${title.slice(0, 80)}`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
      {rows.length === 0 && (
        <p className="text-sm text-gray-600">No papers match this filter — the census header shows the denominators.</p>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
          {safePage > 1 && (
            <Link
              className="underline hover:text-gray-300"
              href={`/canon?${filter !== "all" ? `filter=${filter}&` : ""}page=${safePage - 1}`}
            >
              ← prev
            </Link>
          )}
          <span>
            page {safePage} / {pageCount} · {filtered.toLocaleString("en-US")} papers
          </span>
          {safePage < pageCount && (
            <Link
              className="underline hover:text-gray-300"
              href={`/canon?${filter !== "all" ? `filter=${filter}&` : ""}page=${safePage + 1}`}
            >
              next →
            </Link>
          )}
        </div>
      )}

      <p className="text-[10px] text-gray-600 border-t border-gray-800 pt-3">
        Citation counts via OpenAlex at last backfill · curves come from the research loop and pipeline joins (the
        retraction join predates the loop — attribution per row on its claim page) · reviewed-no-event verdicts are
        recorded receipts of the corpus promoter&apos;s audit, imported under the owner-gated contract.
      </p>
    </div>
  );
}
