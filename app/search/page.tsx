import { Suspense } from "react";
import SearchClient from "./SearchClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search — Epistemic Receipts",
  description: "Full-text search across claims and sources.",
};

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading search…</p>}>
      <SearchClient />
    </Suspense>
  );
}
