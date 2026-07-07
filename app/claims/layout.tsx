import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claims — Epistemic Receipts",
  description:
    "Browse the raw claim graph — every sourced claim with its evidence trail, filterable by pipeline and status.",
};

// Metadata-only layout: claims/page.tsx is a client component ("use client"),
// which cannot export metadata itself. The /claims/[id] detail pages override
// this with their own generateMetadata.
export default function ClaimsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
