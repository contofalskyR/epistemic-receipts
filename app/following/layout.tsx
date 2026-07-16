import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Following — Epistemic Receipts",
  description:
    "Everything you follow — claims, trajectories, topics — with their current epistemic status and time since last move. No account needed.",
  robots: { index: false },
};

// Metadata-only layout: following/page.tsx is a client component ("use client"),
// which cannot export metadata itself.
export default function FollowingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
