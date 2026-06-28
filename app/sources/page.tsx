import SourcesClient from "./SourcesClient";
import { loadSourcesSummary } from "@/app/api/sources-summary/route";

export const revalidate = 600;

export const metadata = {
  title: "Sources — Epistemic Receipts",
  description:
    "Every API, archive, and primary-record database behind the claim graph — with ingestion methodology, coverage notes, and verification links.",
};

export default async function SourcesPage() {
  const data = await loadSourcesSummary().catch(() => null);
  return <SourcesClient initialData={data} />;
}
