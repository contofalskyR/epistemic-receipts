import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AXIS_BG_CLASS, AXIS_LABEL } from "@/lib/status";

// How far back to look for "recent" transitions
const WINDOW_DAYS = 30;

type MoveItem = {
  claimId: string;
  slug: string | null;
  text: string;
  fromAxis: string | null;
  toAxis: string;
  occurredAt: Date;
  datePrecision: string | null;
};

function formatPreciseDate(d: Date, precision: string | null): string {
  if (precision === "DAY") {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  if (precision === "MONTH") {
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return String(d.getUTCFullYear());
}

export default async function DomainRecentMoves({
  trajectoryIds,
  limit = 5,
}: {
  trajectoryIds: readonly string[];
  limit?: number;
}) {
  if (!trajectoryIds.length) return null;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - WINDOW_DAYS);

  let items: MoveItem[] = [];
  try {
    const externalIds = trajectoryIds.map((id) => `trajectory:${id}`);
    const rows = await prisma.claimStatusHistory.findMany({
      where: {
        occurredAt: { gte: since },
        claim: {
          externalId: { in: externalIds },
          deleted: false,
          OR: [{ verificationStatus: null }, { verificationStatus: { not: "DEPRECATED" } }],
        },
      },
      select: {
        claimId: true,
        fromAxis: true,
        toAxis: true,
        occurredAt: true,
        datePrecision: true,
        claim: { select: { text: true, externalId: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });

    items = rows.map((r) => ({
      claimId: r.claimId,
      slug: r.claim.externalId?.startsWith("trajectory:")
        ? r.claim.externalId.replace(/^trajectory:/, "")
        : null,
      text: r.claim.text.length > 100 ? r.claim.text.slice(0, 97) + "…" : r.claim.text,
      fromAxis: r.fromAxis,
      toAxis: r.toAxis,
      occurredAt: r.occurredAt,
      datePrecision: r.datePrecision,
    }));
  } catch {
    return null;
  }

  if (items.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 pt-6 pb-2">
      <p className="text-[11px] font-mono uppercase tracking-widest text-gray-600 mb-3">
        Moved this month
      </p>
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const href = item.slug
            ? `/settling-curve?t=${encodeURIComponent(item.slug)}`
            : `/claims/${item.claimId}`;
          const toBg = AXIS_BG_CLASS[item.toAxis] ?? "bg-gray-800 text-gray-400";
          const toLabel = AXIS_LABEL[item.toAxis] ?? item.toAxis;
          return (
            <Link
              key={`${item.claimId}-${item.occurredAt.toISOString()}`}
              href={href}
              className="flex items-start gap-3 group hover:bg-gray-900/40 rounded px-2 py-1.5 -mx-2 transition-colors"
            >
              <span
                className={`mt-0.5 shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border border-transparent ${toBg}`}
              >
                {toLabel}
              </span>
              <span className="text-[12px] text-gray-400 leading-snug group-hover:text-gray-200 transition-colors">
                {item.text}
              </span>
              <span className="ml-auto shrink-0 text-[10px] font-mono text-gray-600 whitespace-nowrap">
                {formatPreciseDate(item.occurredAt, item.datePrecision)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
