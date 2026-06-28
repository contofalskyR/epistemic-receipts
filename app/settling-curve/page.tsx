import type { Metadata } from "next";
import SettlingCurve from "./SettlingCurve";
import { FEATURED_TRAJECTORIES } from "@/lib/featured-trajectories";

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

export default function SettlingCurvePage() {
  return <SettlingCurve />;
}
