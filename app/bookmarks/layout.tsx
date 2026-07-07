import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bookmarks — Epistemic Receipts",
  description:
    "Your saved claims — stored in your browser, no account needed.",
};

// Metadata-only layout: bookmarks/page.tsx is a client component ("use client"),
// which cannot export metadata itself.
export default function BookmarksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
