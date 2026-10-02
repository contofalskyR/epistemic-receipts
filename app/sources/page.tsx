import SourcesClient from "./SourcesClient";
import { loadSourcesSummary } from "@/app/api/sources-summary/route";

export const revalidate = 600;

export const metadata = {
  title: "Sources — Epistemic Receipts",
  description:
    "Every API, archive, and primary-record database behind the claim graph — with ingestion methodology, coverage notes, and verification links.",
};

export default async function SourcesPage() {
  // No catch (front door phase 6): a swallowed DB error used to render a
  // permanent "Loading…" that ISR then cached. Now a failure fails the build
  // loudly, and a failed revalidation keeps serving the last good page.
  const data = await loadSourcesSummary();
  return <SourcesClient initialData={data} />;
}
