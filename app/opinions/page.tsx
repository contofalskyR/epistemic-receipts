import { Suspense } from "react";
import OpinionsClient from "./OpinionsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Court Opinions — Epistemic Receipts",
  description:
    "Browse 2,000+ U.S. court opinions from CourtListener — SCOTUS, federal circuits, state supreme courts — with links to related legislation.",
};

export default function OpinionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500 p-6">Loading opinions…</p>}>
      <OpinionsClient />
    </Suspense>
  );
}
