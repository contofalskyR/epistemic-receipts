import SourcesClient from "./SourcesClient";

export const revalidate = 600;

export const metadata = {
  title: "Sources — Epistemic Receipts",
  description:
    "Every API, archive, and primary-record database behind the claim graph — with ingestion methodology, coverage notes, and verification links.",
};

async function getData() {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  try {
    const res = await fetch(`${base}/api/sources-summary`, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function SourcesPage() {
  const data = await getData();
  return <SourcesClient initialData={data} />;
}
