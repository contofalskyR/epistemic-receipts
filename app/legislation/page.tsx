import { Suspense } from "react";
import LegislationClient from "./LegislationClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Legislation — Epistemic Receipts",
  description: "Live tracker for bills in the 119th Congress — status, sponsor, latest action.",
};

export default function LegislationPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading bills…</p>}>
      <LegislationClient />
    </Suspense>
  );
}
