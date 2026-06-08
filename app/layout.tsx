import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/app/components/Nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Epistemic Receipts",
  description:
    "1M+ verified facts from legislation, court decisions, scientific papers, and declassified archives.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full bg-gray-950`}>
      <body className="min-h-full text-gray-100 antialiased">
        <Nav />
        <main className="px-6 py-8">{children}</main>
        <footer className="border-t border-gray-800/50 px-6 py-3 text-center text-xs text-gray-500">
          Epistemic Receipts — {new Date().getFullYear()} · last updated June 7, 2026
        </footer>
      </body>
    </html>
  );
}
