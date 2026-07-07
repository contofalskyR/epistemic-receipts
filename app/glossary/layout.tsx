import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Glossary — Epistemic Receipts",
  description:
    "Definitions for every concept, entity, and status used in the Epistemic Receipts knowledge graph — epistemic axes, claim relations, verification statuses, and pipeline terms.",
};

// Metadata-only layout: glossary/page.tsx is a client component ("use client"),
// which cannot export metadata itself.
export default function GlossaryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
