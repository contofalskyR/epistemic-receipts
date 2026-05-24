import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Epistemic Receipts",
  description: "A receipt system for how consensus gets made",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full bg-gray-950`}>
      <body className="min-h-full text-gray-100 antialiased">
        <nav className="border-b border-gray-800 px-6 py-3 flex gap-6 text-sm">
          <Link href="/" className="font-semibold text-white">Epistemic Receipts</Link>
          <Link href="/search" className="text-gray-400 hover:text-white transition-colors">Search</Link>
          <Link href="/claims" className="text-gray-400 hover:text-white transition-colors">Claims</Link>
          <Link href="/sources" className="text-gray-400 hover:text-white transition-colors">Sources</Link>
          <Link href="/edges" className="text-gray-400 hover:text-white transition-colors">Edges</Link>
          <Link href="/meta-edges" className="text-gray-400 hover:text-white transition-colors">Meta-edges</Link>
          <Link href="/timeline" className="text-gray-400 hover:text-white transition-colors">Timeline</Link>
          <Link href="/topics" className="text-gray-400 hover:text-white transition-colors">Topics</Link>
          <Link href="/review" className="text-gray-400 hover:text-white transition-colors">Review</Link>
          <Link href="/pipelines" className="text-gray-400 hover:text-white transition-colors">Pipelines</Link>
          <Link href="/datasets" className="text-gray-400 hover:text-white transition-colors">Datasets</Link>
          <Link href="/analysis/votes" className="text-gray-400 hover:text-white transition-colors">Analysis</Link>
          <Link href="/stats" className="text-gray-400 hover:text-white transition-colors">Stats</Link>
          <Link href="/forthcoming" className="text-gray-400 hover:text-white transition-colors ml-auto">Forthcoming</Link>
          <Link href="/about" className="text-gray-400 hover:text-white transition-colors">About</Link>
          <Link href="/glossary" className="text-gray-400 hover:text-white transition-colors">Glossary</Link>
          <Link href="/feedback" className="text-gray-400 hover:text-white transition-colors">Feedback</Link>
        </nav>
        <main className="max-w-3xl mx-auto px-6 py-8">{children}</main>
        <footer className="border-t border-gray-800/50 px-6 py-3 text-center text-xs text-gray-500">
          last updated May 23, 2026
        </footer>
      </body>
    </html>
  );
}
