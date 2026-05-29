import { Suspense } from "react";
import VotesClient from "./VotesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Votes — Epistemic Receipts",
  description: "Searchable browser for 113,000+ congressional roll call votes (1789–present) from Voteview.",
};

export default function VotesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading votes…</p>}>
      <VotesClient />
    </Suspense>
  );
}
