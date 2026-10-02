import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/app/components/Nav";
import FeedbackButton from "@/app/components/FeedbackButton";
import LinkViewerProvider from "@/app/components/LinkViewerProvider";
import { SITE_URL } from "@/lib/site";
import { corpusCountCompact } from "@/lib/corpus";
import { defaultSocialMetadata } from "@/lib/og";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  // The corpus figure is derived (lib/corpus.ts, cached hourly), never typed:
  // the previous hand-written "1.7M+" here disagreed with the nav's "1.76M"
  // and the homepage's 1.62M at the same time.
  const claims = await corpusCountCompact();
  const description =
    `A live record of epistemic status across science, law, and history — ${claims} sourced claims from legislation, court decisions, scientific papers, and declassified archives.`;
  return {
    // Resolves relative OG image / canonical URLs in per-page generateMetadata.
    // NOTE: no title template — ~35 pages already hard-code the "— Epistemic
    // Receipts" suffix; a template here would double it.
    metadataBase: new URL(SITE_URL),
    title: "Epistemic Receipts",
    description,
    // Default link-preview card (lib/og.ts): the image and nothing else. A
    // page without its own block inherits this one whole, and Next fills the
    // og and twitter title/description from the page itself — a title or url
    // set here would label every such page as the homepage. Pages with their
    // own card set an image-bearing block, through the socialMetadata helper or
    // by hand (claims/[id], settling-curve, settling-curve/[id], receipts/[id];
    // og-metadata.test.ts enforces the image). receipts/[id] has no twitter
    // block and relies on Next copying its og:image, so the twitter default
    // here carries no image.
    ...defaultSocialMetadata(),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const claimsCompact = await corpusCountCompact();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full bg-gray-950`}>
      <body className="min-h-full text-gray-100 antialiased">
        <LinkViewerProvider>
          <Nav claimsCompact={claimsCompact} />
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
