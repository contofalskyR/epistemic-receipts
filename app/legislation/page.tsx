import { Suspense } from "react";
import LegislationClient from "./LegislationClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Legislation — Epistemic Receipts",
  description: "Multi-country legislation tracker — US Congress (119th), Canadian Parliament, and New Zealand Parliament. Live bill status, sourced from official APIs.",
};

export default function LegislationPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading bills…</p>}>
      <LegislationClient />
    </Suspense>
  );
}
