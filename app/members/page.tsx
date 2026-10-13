import { Suspense } from "react";
import MembersClient from "./MembersClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Members — Epistemic Receipts",
  description: "Search US House and Senate members by name and open their recorded roll-call votes.",
};

export default function MembersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading members…</p>}>
      <MembersClient />
    </Suspense>
  );
}
