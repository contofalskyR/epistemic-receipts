import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback — Epistemic Receipts",
  description:
    "Thoughts, bugs, or questions about Epistemic Receipts — goes straight to the maintainer.",
};

// Metadata-only layout: feedback/page.tsx is a client component ("use client"),
// which cannot export metadata itself.
export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
