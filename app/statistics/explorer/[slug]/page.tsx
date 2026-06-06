import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { STAT_METHOD_BY_SLUG } from "@/lib/statMethods";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const PAGE_SIZE = 25;
const MAX_OFFSET = 5000;

type ClaimRow = {
  id: string;
  text: string;
  currentStatus: string;
  verificationStatus: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

type CountRow = { n: bigint };

const STATUS_STYLE: Record<string, string> = {
  HARD_FACT: "bg-green-900 text-green-300",
  NEVER_RESOLVES: "bg-gray-700 text-gray-400",
  DISPUTED: "bg-yellow-900 text-yellow-300",
};
const VS_STYLE: Record<string, string> = {
  VERIFIED: "bg-blue-950 text-blue-400 border border-blue-800/50",
  PROVISIONAL: "bg-gray-800/60 text-gray-500 border border-gray-700/50",
  DISPUTED: "bg-red-950 text-red-400 border border-red-800/50",
  DEPRECATED: "bg-gray-900 text-gray-600 border border-gray-800",
};

function truncate(text: string, n = 320): string {
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + "…";
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const method = STAT_METHOD_BY_SLUG[slug];
  if (!method) return { title: "Method not found — Epistemic Receipts" };
  return {
    title: `${method.label} — claims · Epistemic Receipts`,
    description: `${method.description} — paginated list of OpenAlex-sourced claims tagged with ${method.label}.`,
  };
}

export default async function MethodPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ offset?: string }>;
}) {
  const { slug } = await params;
  const { offset: offsetRaw } = await searchParams;
  const method = STAT_METHOD_BY_SLUG[slug];
  if (!method) notFound();

  const offset = Math.max(
    0,
    Math.min(MAX_OFFSET, Number.parseInt(offsetRaw ?? "0", 10) || 0),
  );

  // Use raw SQL for the `?` JSONB contains-key operator. Parameterize the slug
  // through Prisma.sql so it can't break out of the literal.
  const claims = await prisma.$queryRaw<ClaimRow[]>(Prisma.sql`
    SELECT id, text, "currentStatus", "verificationStatus", metadata, "createdAt"
    FROM "Claim"
    WHERE "ingestedBy" = 'openalex_v1'
      AND deleted = false
      AND metadata->'statMethods' ? ${slug}
    ORDER BY "createdAt" DESC
    LIMIT ${PAGE_SIZE}
    OFFSET ${offset}
  `);

  const countRows = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS n FROM "Claim"
    WHERE "ingestedBy" = 'openalex_v1'
      AND deleted = false
      AND metadata->'statMethods' ? ${slug}
  `);
  const total = countRows[0]?.n ? Number(countRows[0].n) : 0;

  const hasPrev = offset > 0;
  const hasNext = offset + claims.length < total;
  const prevOffset = Math.max(0, offset - PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE;

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-800 pb-5">
        <p className="text-xs font-mono text-gray-500 mb-2">
          <Link href="/statistics" className="hover:text-gray-300">
            statistics
          </Link>
          <span> / </span>
          <Link href="/statistics/explorer" className="hover:text-gray-300">
            explorer
          </Link>
          <span> / </span>
          <span className="text-gray-300">{method.slug}</span>
        </p>
        <h1 className="text-2xl font-semibold text-white">{method.label}</h1>
        <p className="mt-2 text-sm text-gray-400 leading-relaxed">{method.description}</p>
        <p className="mt-3 text-xs font-mono text-gray-600">
          {total.toLocaleString()} OpenAlex {total === 1 ? "claim" : "claims"} tagged · showing{" "}
          {claims.length === 0 ? 0 : offset + 1}–{offset + claims.length}
        </p>
      </div>

      {claims.length === 0 ? (
        <p className="text-sm text-gray-500 py-8">
          No claims tagged with this method yet. Run a fuller enrichment via{" "}
          <code className="font-mono text-gray-400">
            scripts/enrich-stat-methods.ts --commit
          </code>{" "}
          (the 5,000-claim seed only covers a slice of the OpenAlex catalog).
        </p>
      ) : (
        <ul className="space-y-3">
          {claims.map(c => {
            const meta = (c.metadata ?? {}) as Record<string, unknown>;
            const title = typeof meta.title === "string" ? meta.title : null;
            const venue = typeof meta.venue === "string" ? meta.venue : null;
            const otherMethods = Array.isArray(meta.statMethods)
              ? (meta.statMethods as unknown[]).filter(
                  (s): s is string => typeof s === "string" && s !== slug,
                )
              : [];
            const statusStyle =
              STATUS_STYLE[c.currentStatus] ?? "bg-gray-800 text-gray-400";
            const vsStyle =
              c.verificationStatus && VS_STYLE[c.verificationStatus]
                ? VS_STYLE[c.verificationStatus]
                : null;
            return (
              <li
                key={c.id}
                className="rounded border border-gray-800 hover:border-gray-700 bg-gray-900/40 px-4 py-3 transition-colors"
              >
                <Link href={`/claims/${c.id}`} className="block group">
                  {title && (
                    <p className="text-sm font-semibold text-white group-hover:text-blue-200 leading-snug">
                      {title}
                    </p>
                  )}
                  <p
                    className={`text-xs leading-relaxed ${
                      title ? "mt-1 text-gray-400" : "text-gray-300"
                    }`}
                  >
                    {truncate(c.text)}
                  </p>
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono">
                  <span className={`px-1.5 py-0.5 rounded ${statusStyle}`}>
                    {c.currentStatus}
                  </span>
                  {vsStyle && (
                    <span className={`px-1.5 py-0.5 rounded ${vsStyle}`}>
                      {c.verificationStatus}
                    </span>
                  )}
                  {venue && (
                    <span className="px-1.5 py-0.5 rounded bg-gray-800/60 text-gray-400">
                      {venue}
                    </span>
                  )}
                  {otherMethods.slice(0, 4).map(s => {
                    const other = STAT_METHOD_BY_SLUG[s];
                    return (
                      <Link
                        key={s}
                        href={`/statistics/explorer/${s}`}
                        className="px-1.5 py-0.5 rounded bg-blue-950/50 text-blue-300 hover:bg-blue-900/60 transition-colors"
                      >
                        {other?.label ?? s}
                      </Link>
                    );
                  })}
                  {otherMethods.length > 4 && (
                    <span className="text-gray-500">+{otherMethods.length - 4}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between border-t border-gray-800 pt-4 text-xs font-mono">
          {hasPrev ? (
            <Link
              href={`/statistics/explorer/${slug}?offset=${prevOffset}`}
              className="text-blue-300 hover:text-blue-200"
            >
              ← previous {PAGE_SIZE}
            </Link>
          ) : (
            <span className="text-gray-700">← previous</span>
          )}
          <span className="text-gray-600">
            page {Math.floor(offset / PAGE_SIZE) + 1} of{" "}
            {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </span>
          {hasNext && nextOffset <= MAX_OFFSET ? (
            <Link
              href={`/statistics/explorer/${slug}?offset=${nextOffset}`}
              className="text-blue-300 hover:text-blue-200"
            >
              next {PAGE_SIZE} →
            </Link>
          ) : (
            <span className="text-gray-700">next →</span>
          )}
        </div>
      )}

      <p className="text-xs text-gray-600 mt-8">
        <Link href="/statistics/explorer" className="hover:text-gray-400">
          ← back to all methods
        </Link>{" "}
        ·{" "}
        <Link href={`/search?q=${encodeURIComponent(method.label)}`} className="hover:text-gray-400">
          free-text search for &ldquo;{method.label}&rdquo;
        </Link>
      </p>
    </div>
  );
}
