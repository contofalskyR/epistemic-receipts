import type { Metadata } from "next";
import SettlingRateCharts from "./SettlingRateCharts";
import { countCurated } from "@/lib/trajectory-list";
import { socialMetadata } from "@/lib/og";

// Public since the 6b follow-ups (owner 2026-10-12); linked from the explorer's
// More-views row and the homepage Fig. 1 caption, no nav slot.
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const n = await countCurated();
  const title = `The Macro Settling Curve: ${n.toLocaleString("en-US")} curated trajectories — Epistemic Receipts`;
  const description = "How fast knowledge settles: the survival curve, settling velocity by decade (click a decade to open its trajectories), and when the settling frontier accelerated.";
  return {
    title,
    description,
    alternates: { canonical: "/analysis/settling-rate" },
    ...socialMetadata({ title, description, url: "/analysis/settling-rate" }),
  };
}

export default function SettlingRatePage() {
  return <SettlingRateCharts />;
}
