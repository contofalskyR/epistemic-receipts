import type { Metadata } from "next";
import SettlingCurve from "./SettlingCurve";
import { FEATURED_TRAJECTORIES } from "@/lib/featured-trajectories";
import { getCuratedTrajectories } from "@/lib/trajectory-list";

// Not ISR: generateMetadata reads ?t= (share card), which makes the route
// dynamic. The data is cached instead — see SettlingCurvePage below.
export const dynamic = "force-dynamic";

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
  // The curated grid renders server-side from the hourly cache
  // (lib/trajectory-list.ts) — this page is dynamic because generateMetadata
  // reads ?t= for the share card, so a route-level `revalidate` never applied
  // and every visit used to run the 1.4 s curated query (Phase 5). The client
  // still refreshes the full list (curated + auto) from /api/trajectories.
  const initialList = await getCuratedTrajectories();
  return <SettlingCurve initialList={initialList as Parameters<typeof SettlingCurve>[0]["initialList"]} />;
}
