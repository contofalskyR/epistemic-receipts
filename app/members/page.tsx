import { Suspense } from "react";
import MembersClient from "./MembersClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Members — Epistemic Receipts",
  description: "Search 12,000+ House and Senate members across US congressional history.",
};

export default function MembersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading members…</p>}>
      <MembersClient />
    </Suspense>
  );
}
