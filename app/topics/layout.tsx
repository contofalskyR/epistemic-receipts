import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Topics — Epistemic Receipts",
  description:
    "The full topic index of the claim graph — browse sourced claims by subject across every domain.",
};

// Metadata-only layout: topics/page.tsx is a client component ("use client"),
// which cannot export metadata itself. Applies to the /topics index; the
// /topics/[slug] pages carry their own metadata.
export default function TopicsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
