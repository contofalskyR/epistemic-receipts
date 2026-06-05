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
          <Link href="/edges" className="text-gray-400 hover:text-white transition-colors">Edges</Link>
          <Link href="/meta-edges" className="text-gray-400 hover:text-white transition-colors">Meta-edges</Link>
          <Link href="/timeline" className="text-gray-400 hover:text-white transition-colors">Timeline</Link>
          <Link href="/topics" className="text-gray-400 hover:text-white transition-colors">Topics</Link>
          <Link href="/fields" className="text-gray-400 hover:text-white transition-colors">Fields</Link>
          <Link href="/mathematics" className="text-gray-400 hover:text-white transition-colors">Mathematics</Link>
          <Link href="/chemistry" className="text-gray-400 hover:text-white transition-colors">Chemistry</Link>
          <Link href="/physics" className="text-gray-400 hover:text-white transition-colors">Physics</Link>
          <Link href="/computer-science" className="text-gray-400 hover:text-white transition-colors">Computer Science</Link>
          <Link href="/biology" className="text-gray-400 hover:text-white transition-colors">Biology</Link>
          <Link href="/astronomy" className="text-gray-400 hover:text-white transition-colors">Astronomy</Link>
          <Link href="/geology" className="text-gray-400 hover:text-white transition-colors">Geology</Link>
          <Link href="/engineering" className="text-gray-400 hover:text-white transition-colors">Engineering</Link>
          <Link href="/linguistics" className="text-gray-400 hover:text-white transition-colors">Linguistics</Link>
          <Link href="/psychology" className="text-gray-400 hover:text-white transition-colors">Psychology</Link>
          <Link href="/medicine" className="text-gray-400 hover:text-white transition-colors">Medicine</Link>
          <Link href="/statistics" className="text-gray-400 hover:text-white transition-colors">Statistics</Link>
          <Link href="/review" className="text-gray-400 hover:text-white transition-colors">Review</Link>
          <Link href="/pipelines" className="text-gray-400 hover:text-white transition-colors">Pipelines</Link>
          <Link href="/datasets" className="text-gray-400 hover:text-white transition-colors">Datasets</Link>
          <Link href="/globe" className="text-gray-400 hover:text-white transition-colors">Globe</Link>
          <Link href="/votes" className="text-gray-400 hover:text-white transition-colors">Votes</Link>
          <Link href="/legislation" className="text-gray-400 hover:text-white transition-colors">Legislation</Link>
          <Link href="/analysis/votes" className="text-gray-400 hover:text-white transition-colors">Analysis</Link>
          <Link href="/analysis/topics" className="text-gray-400 hover:text-white transition-colors">Topic Trends</Link>
          <Link href="/analysis/representation" className="text-gray-400 hover:text-white transition-colors">Representation</Link>
          <Link href="/historical-events" className="text-gray-400 hover:text-white transition-colors">Events</Link>
          <Link href="/reader" className="text-gray-400 hover:text-white transition-colors">Reader</Link>
          <Link href="/books" className="text-gray-400 hover:text-white transition-colors">Books</Link>
          <Link href="/stats" className="text-gray-400 hover:text-white transition-colors">Stats</Link>
          <Link href="/stats/media-coverage" className="text-gray-400 hover:text-white transition-colors">Media Coverage</Link>
          <Link href="/bookmarks" className="text-gray-400 hover:text-white transition-colors">Bookmarks</Link>
          <Link href="/financial" className="text-gray-400 hover:text-white transition-colors">Financial</Link>
          <Link href="/finance" className="text-gray-400 hover:text-white transition-colors">Finance</Link>
          <Link href="/economics" className="text-gray-400 hover:text-white transition-colors">Economics</Link>
          <Link href="/governance" className="text-gray-400 hover:text-white transition-colors">Governance</Link>
          <Link href="/law" className="text-gray-400 hover:text-white transition-colors">Law</Link>
          <Link href="/ip-law" className="text-gray-400 hover:text-white transition-colors">IP Law</Link>
          <Link href="/tax-law" className="text-gray-400 hover:text-white transition-colors">Tax Law</Link>
          <Link href="/ideologies" className="text-gray-400 hover:text-white transition-colors">Ideologies</Link>
          <Link href="/philosophy" className="text-gray-400 hover:text-white transition-colors">Philosophy</Link>

          <Link href="/about" className="text-gray-400 hover:text-white transition-colors">About</Link>
          <Link href="/glossary" className="text-gray-400 hover:text-white transition-colors">Glossary</Link>
          <Link href="/feedback" className="text-gray-400 hover:text-white transition-colors">Feedback</Link>
        </nav>
        <main className="max-w-3xl mx-auto px-6 py-8">{children}</main>
        <footer className="border-t border-gray-800/50 px-6 py-3 text-center text-xs text-gray-500">
          last updated June 4, 2026 — computer science taxonomy added
        </footer>
      </body>
    </html>
  );
}
