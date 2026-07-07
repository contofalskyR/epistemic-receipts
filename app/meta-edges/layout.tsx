import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Suppression & Amplification — Epistemic Receipts",
  description:
    "Documented actions taken on evidence itself — actors suppressing, amplifying, labeling, or demoting source-claim links. Every entry names the actor, the target evidence, the date, and the documentation.",
};

// Metadata-only layout: meta-edges/page.tsx is a client component ("use client"),
// which cannot export metadata itself.
export default function MetaEdgesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
