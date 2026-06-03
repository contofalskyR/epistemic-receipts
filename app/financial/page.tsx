import { Suspense } from "react";
import FinancialClient from "./FinancialClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Financial — Epistemic Receipts",
  description: "Financial disclosures and market data: SEC Form 4 insider trading, Congressional STOCK Act trades, corporate earnings filings, and FRED macroeconomic indicators.",
};

export default function FinancialPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading financial data…</p>}>
      <FinancialClient />
    </Suspense>
  );
}
