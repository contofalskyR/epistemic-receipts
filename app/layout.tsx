import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/app/components/Nav";
import FeedbackButton from "@/app/components/FeedbackButton";
import LinkViewerProvider from "@/app/components/LinkViewerProvider";
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  // Resolves relative OG image / canonical URLs in per-page generateMetadata.
  // NOTE: no title template — ~35 pages already hard-code the "— Epistemic
  // Receipts" suffix; a template here would double it.
  metadataBase: new URL(SITE_URL),
  title: "Epistemic Receipts",
  // "1.6M+" matches the Nav/search copy convention; the old "1M+ verified
  // facts" default disagreed with the homepage's derived 1.62M figure.
  description:
    "A live record of epistemic status across science, law, and history — 1.6M+ sourced claims from legislation, court decisions, scientific papers, and declassified archives.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full bg-gray-950`}>
      <body className="min-h-full text-gray-100 antialiased">
        <LinkViewerProvider>
          <Nav />
          <main className="px-6 py-8">{children}</main>
          <FeedbackButton />
          <footer className="border-t border-gray-800/50 px-6 py-4 text-center text-xs text-gray-500 space-y-1">
            <div>
              <span>Epistemic Receipts — {new Date().getFullYear()} · </span>
              <a href="/corrections" className="hover:text-gray-300 transition-colors underline-offset-2 hover:underline">
                Corrections
              </a>
              {" · "}
              <a href="/methodology" className="hover:text-gray-300 transition-colors underline-offset-2 hover:underline">
                Methodology
              </a>
              {" · "}
              <a href="/license" className="hover:text-gray-300 transition-colors underline-offset-2 hover:underline">
                License
              </a>
              {" · "}
              <a href="/terms" className="hover:text-gray-300 transition-colors underline-offset-2 hover:underline">
                Terms
              </a>
              {" · "}
              <a href="/privacy" className="hover:text-gray-300 transition-colors underline-offset-2 hover:underline">
                Privacy
              </a>
            </div>
            <div className="text-gray-600">
              Conceptualized by{" "}
              {/* NB: only the www host serves this site — the apex domain doesn't resolve. */}
              <a href="https://www.robertcontofalsky.com/" target="_blank" rel="noreferrer" className="hover:text-gray-300 transition-colors">
                Robert Contofalsky
              </a>
              {" · "}Designed by{" "}
              <a href="https://openclaw.ai" target="_blank" rel="noreferrer" className="hover:text-gray-300 transition-colors">
                OpenClaw
              </a>
            </div>
          </footer>
        </LinkViewerProvider>
      </body>
    </html>
  );
}
