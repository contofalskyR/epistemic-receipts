import type { Metadata } from "next";
import SettlingRateCharts from "./SettlingRateCharts";

export const metadata: Metadata = {
  title: "Settling Rate — Epistemic Receipts",
  description:
    "Macro settling curve across 4,600+ epistemic trajectories: how fast knowledge settles, by decade, and when the settling frontier accelerated.",
};

export default function SettlingRatePage() {
  return <SettlingRateCharts />;
}
