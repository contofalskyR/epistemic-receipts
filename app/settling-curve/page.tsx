import type { Metadata } from "next";
import SettlingCurve from "./SettlingCurve";
import { FEATURED_TRAJECTORIES } from "@/lib/featured-trajectories";
import { prisma } from "@/lib/prisma";

// ISR: revalidate the curated trajectory list hourly so cold load shows real cards, not skeletons.
export const revalidate = 3600;

type Props = {
  searchParams: Promise<{ t?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const t = params.t;

  if (!t) {
    return {
      title: "Settling Curve — Epistemic Receipts",
      description:
        "Trace how scientific confidence in a claim builds — or unravels — across expert literature, institutions, courts, and public consensus.",
    };
  }

  const featured = FEATURED_TRAJECTORIES.find((ft) => ft.id === t);
  const title = featured
    ? `${featured.hook} — Epistemic Receipts`
    : "Settling Curve — Epistemic Receipts";

  const ogImageUrl = `/api/og/trajectory?id=${t}`;

  return {
    title,
    description:
      "Trace how scientific confidence in a claim builds — or unravels — across expert literature, institutions, courts, and public consensus.",
    // Canonical points to the permalink page so crawlers index the SSR version.
    alternates: { canonical: `/settling-curve/${t}` },
    openGraph: {
      title,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [ogImageUrl],
    },
  };
}

export default async function SettlingCurvePage() {
  // Fetch curated trajectories at ISR time so the initial grid renders real cards
  // without a client fetch round-trip. The client component still fetches the full
  // list (curated + auto) in the background for filter support.
  const curated = await prisma.claim.findMany({
    where: {
      deleted: false,
      OR: [{ verificationStatus: null }, { verificationStatus: { not: "DEPRECATED" } }],
      externalId: { startsWith: "trajectory:" },
    },
    select: {
      externalId: true,
      text: true,
      claimEmergedAt: true,
      ingestedBy: true,
      statusHistory: {
        orderBy: [{ seq: "asc" }, { occurredAt: "asc" }, { createdAt: "asc" }],
        select: { community: true, toAxis: true, occurredAt: true },
      },
    },
  });

  const initialList = curated.map((c) => {
    const sorted = c.statusHistory;
    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    return {
      id: c.externalId!.replace(/^trajectory:/, ""),
      claim: c.text.length > 160 ? c.text.slice(0, 157) + "…" : c.text,
      communities: [...new Set(sorted.map((s) => s.community))],
      transitionCount: sorted.length,
      hasReversal: sorted.some((s) => s.toAxis === "REVERSED"),
      hasAbandonment: sorted.some((s) => s.toAxis === "ABANDONED"),
      currentAxis: (last?.toAxis ?? null) as string | null,
      firstYear: first ? first.occurredAt.getUTCFullYear() : null,
      lastYear: last ? last.occurredAt.getUTCFullYear() : null,
      milestones: sorted.map((s) => ({
        year: s.occurredAt.getUTCFullYear(),
        axis: s.toAxis,
      })),
    };
  });

  return <SettlingCurve initialList={initialList} />;
}
