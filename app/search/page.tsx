import { Suspense } from "react";
import SearchClient from "./SearchClient";
import { corpusCountCompact } from "@/lib/corpus";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search — Epistemic Receipts",
  description: "Full-text search across claims and sources.",
};

export default async function SearchPage() {
  // Derived corpus figure for the lede ("1.76M+"), cached hourly in lib/corpus.ts.
  const claimsCompact = await corpusCountCompact();
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading search…</p>}>
      <SearchClient claimsCompact={claimsCompact} />
    </Suspense>
  );
}
