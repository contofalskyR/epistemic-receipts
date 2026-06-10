import { Suspense } from "react";
import LegislationClient from "./LegislationClient";
import LegislationStats from "./LegislationStats";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Legislation — Epistemic Receipts",
  description: "Global legislation tracker — bills and laws across 52 countries spanning Americas, Europe, Asia-Pacific, and Africa. Live status for US Congress, Canadian Parliament, and New Zealand Parliament; bulk records for the rest.",
};

export default function LegislationPage() {
  return (
    <div className="space-y-0">
      <Suspense fallback={<p className="text-sm text-gray-500">Loading bills…</p>}>
        <LegislationClient />
      </Suspense>
      <Suspense fallback={null}>
        <LegislationStats />
      </Suspense>
    </div>
  );
}
