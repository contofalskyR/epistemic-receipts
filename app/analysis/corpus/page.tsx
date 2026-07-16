import type { Metadata } from "next";
import CorpusCharts from "./CorpusCharts";

export const metadata: Metadata = {
  title: "Corpus Analysis — Epistemic Receipts",
  description:
    "Epistemic baseline analysis: status distribution, community breakdown, yearly emergence, and pipeline volume across the full knowledge corpus.",
};

export default function CorpusPage() {
  return <CorpusCharts />;
}
