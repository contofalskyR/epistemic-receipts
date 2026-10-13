import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Topics — Epistemic Receipts",
  description:
    "The full topic index of the claim graph — browse sourced claims by subject across every domain.",
};

// Metadata-only layout: topics/page.tsx is a client component ("use client"),
// which cannot export metadata itself. It applies to the /topics index only;
// app/topics/[slug]/page.tsx sets each topic's own (lib/topic-meta.ts).
export default function TopicsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
