import { Suspense } from "react";
import VotesClient from "./VotesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Votes — Epistemic Receipts",
  description: "Search every US House and Senate roll call vote since 1789, from Voteview, each linked to its claim.",
};

export default function VotesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading votes…</p>}>
      <VotesClient />
    </Suspense>
  );
}
