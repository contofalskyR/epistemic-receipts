import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AXIS_COLOR, AXIS_LABEL } from "@/lib/status";
import { SITE_URL } from "@/lib/site";

// Receipt pages are crawl-conservative v1: canonical → parent claim, noindex.
// Indexing individual receipts is a later owner decision (see brief B3-4).
export const revalidate = 86400;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

function fmtPrecise(iso: string, precision: string | null): string {
  const d = new Date(iso);
  if (precision === "YEAR") return String(d.getUTCFullYear());
  if (precision === "QUARTER") {
    const q = Math.floor(d.getUTCMonth() / 3) + 1;
    return `Q${q} ${d.getUTCFullYear()}`;
  }
  if (precision === "MONTH") {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

async function loadReceipt(id: string) {
  const csh = await prisma.claimStatusHistory.findUnique({
    where: { id },
    select: {
      id: true,
      seq: true,
      fromAxis: true,
      toAxis: true,
      community: true,
      occurredAt: true,
      datePrecision: true,
      reason: true,
      claim: {
        select: {
          id: true,
          text: true,
          deleted: true,
          verificationStatus: true,
          _count: { select: { statusHistory: true } },
        },
      },
      markerSource: {
        select: { id: true, name: true, url: true },
      },
    },
  });

  if (!csh) return null;
  if (csh.claim.deleted) return null;
  if (csh.claim.verificationStatus === "DEPRECATED") return null;

  return csh;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const csh = await loadReceipt(id);
  if (!csh) {
    return { title: "Receipt not found — Epistemic Receipts", robots: { index: false } };
  }

  const fromTo = csh.fromAxis
    ? `${csh.fromAxis} → ${csh.toAxis}`
    : csh.toAxis;
  const year = new Date(csh.occurredAt).getUTCFullYear();
  const canonicalClaimUrl = `${SITE_URL}/claims/${csh.claim.id}`;
  const anchorId = csh.seq != null ? `t-${csh.seq}` : "";
  const canonical = anchorId
    ? `${canonicalClaimUrl}#${anchorId}`
    : canonicalClaimUrl;

  return {
    title: `Receipt: ${fromTo} (${year}) — Epistemic Receipts`,
    description: `${csh.claim.text.slice(0, 160)}`,
    robots: { index: false },
    alternates: { canonical },
    openGraph: {
      title: `Receipt: ${fromTo} (${year})`,
      description: csh.claim.text.slice(0, 200),
      url: `${SITE_URL}/receipts/${id}`,
      siteName: "Epistemic Receipts",
      type: "article",
      images: [{ url: `${SITE_URL}/api/og/receipt?id=${encodeURIComponent(id)}`, width: 1200, height: 630 }],
    },
  };
}

export default async function ReceiptPage({ params }: Props) {
  const { id } = await params;
  const csh = await loadReceipt(id);
  if (!csh) notFound();

  const claimUrl = `/claims/${csh.claim.id}`;
  const anchorId = csh.seq != null ? `t-${csh.seq}` : null;
  const claimWithAnchor = anchorId ? `${claimUrl}#${anchorId}` : claimUrl;
  const totalTransitions = csh.claim._count.statusHistory;
  const dateStr = fmtPrecise(csh.occurredAt.toISOString(), csh.datePrecision);
  const fromColor = csh.fromAxis ? (AXIS_COLOR[csh.fromAxis] ?? "#94a3b8") : null;
  const toColor = AXIS_COLOR[csh.toAxis] ?? "#94a3b8";
  const toLabel = AXIS_LABEL[csh.toAxis] ?? csh.toAxis;
  const fromLabel = csh.fromAxis ? (AXIS_LABEL[csh.fromAxis] ?? csh.fromAxis) : null;
  const communityLabel = csh.community.replace(/_/g, " ").toLowerCase();

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      {/* Breadcrumb */}
      <Link href={claimWithAnchor} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
        ← back to claim
      </Link>

      {/* Receipt card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-6 space-y-5">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1">
            Epistemic Receipt
            {csh.seq != null && (
              <span className="ml-2 text-gray-700">
                · step {csh.seq} of {totalTransitions}
              </span>
            )}
          </p>
          <p className="text-white text-base font-medium leading-snug">{csh.claim.text}</p>
        </div>

        {/* Transition arrow */}
        <div className="flex items-center gap-3">
          {fromLabel ? (
            <>
              <span
                className="text-sm font-mono px-2 py-1 rounded"
                style={{ color: fromColor ?? "#94a3b8", background: `${fromColor ?? "#94a3b8"}20` }}
              >
                {fromLabel}
              </span>
              <span className="text-gray-600 text-lg">→</span>
            </>
          ) : (
            <span className="text-xs font-mono text-gray-600 bg-gray-800/50 px-2 py-1 rounded">
              initial
            </span>
          )}
          <span
            className="text-sm font-mono px-2 py-1 rounded font-semibold"
            style={{ color: toColor, background: `${toColor}20` }}
          >
            {toLabel}
          </span>
        </div>

        {/* Metadata */}
        <dl className="space-y-2">
          <div className="flex gap-4 text-sm">
            <dt className="text-gray-500 w-28 shrink-0">Date</dt>
            <dd className="text-gray-200">{dateStr}</dd>
          </div>
          <div className="flex gap-4 text-sm">
            <dt className="text-gray-500 w-28 shrink-0">Community</dt>
            <dd className="text-gray-200 capitalize">{communityLabel}</dd>
          </div>
          {csh.reason && (
            <div className="flex gap-4 text-sm">
              <dt className="text-gray-500 w-28 shrink-0">Reason</dt>
              <dd className="text-gray-300 leading-relaxed">{csh.reason}</dd>
            </div>
          )}
          {csh.markerSource && (
            <div className="flex gap-4 text-sm">
              <dt className="text-gray-500 w-28 shrink-0">Source</dt>
              <dd>
                {csh.markerSource.url ? (
                  <a
                    href={csh.markerSource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 hover:underline"
                  >
                    {csh.markerSource.name}
                  </a>
                ) : (
                  <span className="text-gray-400">{csh.markerSource.name}</span>
                )}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <p className="text-xs text-gray-600">
        This page is a permanent link to one transition in a claim&apos;s epistemic
        history. The full trajectory is on the{" "}
        <Link href={claimWithAnchor} className="text-gray-400 hover:text-gray-200 underline">
          claim page
        </Link>.
      </p>

      {/* JSON-LD — minimal receipt schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            "@id": `${SITE_URL}/receipts/${id}`,
            name: `${fromLabel ?? "Initial"} → ${toLabel}`,
            startDate: csh.occurredAt.toISOString().slice(0, csh.datePrecision === "YEAR" ? 4 : 10),
            description: csh.claim.text,
            about: { "@type": "Thing", "@id": `${SITE_URL}/claims/${csh.claim.id}` },
          }),
        }}
      />
    </div>
  );
}
