import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AXIS_BG_CLASS, AXIS_LABEL } from "@/lib/status";
import { NON_ENGLISH_PIPELINES } from "@/lib/non-english-pipelines";

const MAX_ITEMS = 8;

type OTDRow = {
  claimId: string;
  claimText: string;
  externalId: string | null;
  ingestedBy: string | null;
  fromAxis: string | null;
  toAxis: string;
  occurredAt: Date;
  isMultiStep: boolean;
};

function fmtYear(d: Date): string {
  return String(d.getUTCFullYear());
}

function rankScore(row: OTDRow): number {
  if (row.externalId?.startsWith("trajectory:")) return 0;
  if (row.isMultiStep) return 1;
  return 2;
}

export default async function OnThisDay() {
  const now = new Date();
  const mm = now.getUTCMonth() + 1;
  const dd = now.getUTCDate();

  // month-day string for display e.g. "July 13"
  const monthDay = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const nonEnglish = Array.from(NON_ENGLISH_PIPELINES);

  const rows = await prisma.$queryRaw<OTDRow[]>(
    Prisma.sql`
      SELECT
        c.id AS "claimId",
        LEFT(c.text, 120) AS "claimText",
        c."externalId",
        c."ingestedBy",
        csh."fromAxis",
        csh."toAxis",
        csh."occurredAt",
        EXISTS (
          SELECT 1 FROM "ClaimStatusHistory" csh2
          WHERE csh2."claimId" = c.id AND csh2."fromAxis" IS NOT NULL
        ) AS "isMultiStep"
      FROM "ClaimStatusHistory" csh
      JOIN "Claim" c ON c.id = csh."claimId"
      WHERE csh."datePrecision" = 'DAY'
        AND EXTRACT(MONTH FROM csh."occurredAt") = ${mm}
        AND EXTRACT(DAY   FROM csh."occurredAt") = ${dd}
        AND c.deleted = false
        AND (c."verificationStatus" IS NULL OR c."verificationStatus" != 'DEPRECATED')
        AND (c."ingestedBy" IS NULL OR c."ingestedBy" != ALL(${nonEnglish}::text[]))
      LIMIT ${MAX_ITEMS * 6}
    `
  );

  if (!rows.length) return null;

  // Rank and deduplicate by claimId (keep first occurrence per claim)
  const seen = new Set<string>();
  const sorted = rows
    .sort((a, b) => rankScore(a) - rankScore(b) || a.occurredAt.getTime() - b.occurredAt.getTime())
    .filter((r) => {
      if (seen.has(r.claimId)) return false;
      seen.add(r.claimId);
      return true;
    })
    .slice(0, MAX_ITEMS);

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
