import Link from "next/link";
import { AXIS_BG_CLASS, AXIS_LABEL } from "@/lib/status";
import { selectTodayRows, rankAndFilter, type OTDRow } from "@/lib/on-this-day";

export type { OTDRow };

function fmtYear(d: Date): string {
  return String(d.getUTCFullYear());
}

export default async function OnThisDay({ rows: rowsProp }: { rows?: OTDRow[] } = {}) {
  const now = new Date();
  const monthDay = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const rawRows = rowsProp ?? (await selectTodayRows());
  const sorted = rankAndFilter(rawRows);

  if (!sorted.length) return null;

  return (
    <section className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-4 flex items-baseline gap-3">
        <p className="text-[11px] font-mono uppercase tracking-widest text-amber-400">
          On this day · {monthDay}
        </p>
        <p className="text-[11px] text-gray-600">
          transitions recorded in prior years on {monthDay}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {sorted.map((item) => {
          const slug = item.externalId?.startsWith("trajectory:")
            ? item.externalId.replace(/^trajectory:/, "")
            : null;
          const href = slug
            ? `/settling-curve?t=${encodeURIComponent(slug)}`
            : `/claims/${item.claimId}`;
          const toBg = AXIS_BG_CLASS[item.toAxis] ?? "bg-gray-800 text-gray-400";
          const toLabel = AXIS_LABEL[item.toAxis] ?? item.toAxis;
          const text = item.claimText.length >= 120
            ? item.claimText.slice(0, 117) + "…"
            : item.claimText;

          return (
            <Link
              key={item.claimId}
              href={href}
              className="flex items-start gap-3 group hover:bg-gray-900/40 rounded px-2 py-1.5 -mx-2 transition-colors"
            >
              <span
                className={`mt-0.5 shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border border-transparent ${toBg}`}
              >
                {toLabel}
              </span>
              <span className="text-[12px] text-gray-400 leading-snug group-hover:text-gray-200 transition-colors flex-1">
                {text}
              </span>
              <span className="ml-auto shrink-0 text-[10px] font-mono text-gray-600 whitespace-nowrap">
                {fmtYear(item.occurredAt)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
