import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SettlingCurveMini from "./SettlingCurveMini";

/**
 * DomainCurveRail — a server-rendered strip of the richest settling curves for
 * a set of pipelines, linking into the universal curve explorer
 * (/settling-curve?t=<id>). Part of the curve-first domain rollout
 * (briefings/07): domain pages lead with trajectories, not tables.
 *
 * Pipelines are passed explicitly (editorial choice per page) rather than via
 * a domain-classifier, so each page states exactly which corpora feed its rail.
 * The query is deliberately narrow — filter to the given pipelines and to
 * claims with a chained transition (fromAxis != null ⇒ multi-step) — so it
 * stays cheap enough to run per request. Renders nothing when empty.
 */

type RailItem = {
  id: string;
  href: string;
  text: string;
  transitionCount: number;
  firstYear: number | null;
  lastYear: number | null;
  hasReversal: boolean;
  milestones: { year: number; axis: string }[];
};

export default async function DomainCurveRail({
  title,
  subtitle,
  pipelines,
  limit = 6,
}: {
  title: string;
  subtitle?: string;
  pipelines: string[];
  limit?: number;
}) {
  let items: RailItem[] = [];
  try {
    const claims = await prisma.claim.findMany({
      where: {
        ingestedBy: { in: pipelines },
        deleted: false,
        OR: [{ verificationStatus: null }, { verificationStatus: { not: "DEPRECATED" } }],
        statusHistory: { some: { fromAxis: { not: null } } },
      },
      select: {
        id: true,
        text: true,
        externalId: true,
        statusHistory: {
          orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
          select: { toAxis: true, occurredAt: true },
        },
      },
      orderBy: { statusHistory: { _count: "desc" } },
      take: limit,
    });

    items = claims.map((c) => {
      const years = c.statusHistory.map((s) => s.occurredAt.getUTCFullYear());
      const slug = c.externalId?.startsWith("trajectory:")
        ? c.externalId.replace(/^trajectory:/, "")
        : c.id;
      return {
        id: c.id,
        href: `/settling-curve?t=${encodeURIComponent(slug)}`,
        text: c.text.length > 120 ? c.text.slice(0, 117) + "…" : c.text,
        transitionCount: c.statusHistory.length,
        firstYear: years.length ? Math.min(...years) : null,
        lastYear: years.length ? Math.max(...years) : null,
        hasReversal: c.statusHistory.some((s) => s.toAxis === "REVERSED"),
        milestones: c.statusHistory.map((s) => ({
          year: s.occurredAt.getUTCFullYear(),
          axis: s.toAxis,
        })),
      };
    });
  } catch {
    // A rail is decoration — never break the page it sits on.
    return null;
  }

  if (items.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 pt-12 pb-4">
      <header className="mb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
        <Link
          href="/settling-curve"
          className="text-xs font-mono text-amber-400/80 hover:text-amber-300 transition-colors shrink-0"
        >
          Open the curve explorer →
        </Link>
      </header>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <Link
            key={it.id}
            href={it.href}
            className="block rounded-lg p-4 bg-gray-900/80 border border-gray-800 hover:border-gray-600 transition-colors group"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-mono text-[10px] text-gray-500">
                {it.firstYear ?? ""}
                {it.lastYear != null && it.lastYear !== it.firstYear ? ` → ${it.lastYear}` : ""}
              </span>
              {it.hasReversal && (
                <span className="font-mono text-[10px] text-rose-400">↩ reversed</span>
              )}
            </div>
            <p className="text-[13px] text-gray-200 leading-snug mb-3" style={{ minHeight: 36 }}>
              {it.text}
            </p>
            <SettlingCurveMini
              milestones={it.milestones}
              ariaLabel={`Settling curve: ${it.text}`}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[10px] text-gray-500">
                {it.transitionCount} transitions
              </span>
              <span className="font-mono text-[11px] text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                trace it →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
