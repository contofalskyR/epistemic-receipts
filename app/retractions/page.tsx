import Link from "next/link";
import { SITE_URL } from "@/lib/site";

export const metadata = {
  title: "Retraction Feed API — Epistemic Receipts",
  description:
    "Public JSON and RSS feeds of retracted scientific papers and disputed claims. For researchers, monitoring services, and automated pipelines.",
};

const EXAMPLE_JSON = `{
  "data": [
    {
      "id": "cmq3r9obp8bidsavcz77y68qj",
      "title": "Hydroxychloroquine or chloroquine for COVID-19: systematic review and meta-analysis",
      "description": "Retraction: Hydroxychloroquine or chloroquine for COVID-19 ...",
      "sourceUrl": "https://api.crossref.org/works/10.1016/j.ijantimicag.2020.106240",
      "epistemicAxis": "CONTESTED",
      "verificationStatus": null,
      "source": "crossref_retractions_v1",
      "journal": "International Journal of Antimicrobial Agents",
      "publisher": "Elsevier BV",
      "doi": "10.1016/j.ijantimicag.2020.106240",
      "createdAt": "2024-03-15T10:22:00.000Z",
      "updatedAt": "2024-03-15T10:22:00.000Z",
      "retractionDate": "2024-03-10T00:00:00.000Z",
      "topics": [
        { "id": "cm1234", "name": "Pharmacology", "slug": "pharmacology" }
      ]
    }
  ],
  "meta": {
    "total": 26624,
    "page": 1,
    "limit": 25,
    "pages": 1065,
    "generated_at": "2026-06-08T12:00:00.000Z"
  }
}`;

export default function RetractionsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-16">
      {/* Header */}
      <div className="space-y-3">
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">
          API Documentation
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-snug">
          Retraction Feed API
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
          A public JSON and RSS feed of retracted scientific papers and disputed claims from
          our knowledge graph. Updated continuously as new retractions are indexed from CrossRef
          and Retraction Watch.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          For researchers, journal monitoring services, automated pipelines, and anyone
          building on top of open science infrastructure.
        </p>
      </div>

      {/* Subscribe buttons */}
      <div className="flex flex-wrap gap-3">
        <a
          href={`${SITE_URL}/api/retractions/rss`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-orange-700/60 bg-orange-950/30 px-4 py-2 text-sm text-orange-300 hover:bg-orange-950/60 transition-colors font-mono"
        >
          RSS Feed ↗
        </a>
        <a
          href={`${SITE_URL}/api/retractions/feed`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-900/40 px-4 py-2 text-sm text-gray-300 hover:bg-gray-900/80 transition-colors font-mono"
        >
          JSON Feed ↗
        </a>
        <Link
          href="/retraction-wall"
          className="inline-flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900/40 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-900/80 transition-colors"
        >
          View Retraction Wall
        </Link>
      </div>

      {/* What's in the feed */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">What this feed contains</h2>
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4 text-sm text-gray-400 space-y-2 leading-relaxed">
          <p>
            Every record is a claim from our knowledge graph that meets one of two conditions:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2 text-gray-500">
            <li>
              <span className="font-mono text-gray-400">epistemicAxis = CONTESTED</span> from the{" "}
              <span className="font-mono text-gray-400">crossref_retractions_v1</span> pipeline
              (CrossRef / Retraction Watch publisher-reported retractions)
            </li>
            <li>
              <span className="font-mono text-gray-400">verificationStatus = DISPUTED</span> from
              any pipeline
            </li>
          </ul>
          <p>
            Each item includes the paper title, journal, publisher, DOI, retraction date,
            epistemic status, and any topic tags. A direct link to the claim detail page
            (with full edge history) is included in every record.
          </p>
        </div>
      </section>

      {/* Endpoints */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white">Endpoints</h2>

        <div className="rounded-lg border border-gray-800 bg-gray-900/40 divide-y divide-gray-800">
          {/* JSON */}
          <div className="px-5 py-4 space-y-2">
            <div className="flex items-center gap-3">
              <span className="rounded bg-blue-900/50 border border-blue-700/50 px-2 py-0.5 text-xs font-mono text-blue-300">
                GET
              </span>
              <code className="text-sm text-gray-200 font-mono">
                /api/retractions/feed
              </code>
            </div>
            <p className="text-xs text-gray-500">
              JSON feed of retracted and disputed claims. Returns{" "}
              <code className="font-mono text-gray-400">{"{ data: Claim[], meta: { total, page, limit, pages, generated_at } }"}</code>
            </p>

            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-mono text-gray-600 uppercase tracking-wider">Query parameters</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-xs">
                {[
                  ["?field=", "Topic slug substring filter (e.g. pharmacology, biology)"],
                  ["?journal=", "Journal name substring filter (case-insensitive)"],
                  ["?since=", "ISO 8601 date — only retractions on or after this date"],
                  ["?limit=", "Results per page (1–100, default 25)"],
                  ["?page=", "Page number (default 1)"],
                ].map(([param, desc]) => (
                  <div key={param} className="col-span-1 sm:col-span-3 grid grid-cols-3 gap-2">
                    <code className="col-span-1 font-mono text-gray-400">{param}</code>
                    <span className="col-span-2 text-gray-500">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RSS */}
          <div className="px-5 py-4 space-y-2">
            <div className="flex items-center gap-3">
              <span className="rounded bg-orange-900/50 border border-orange-700/50 px-2 py-0.5 text-xs font-mono text-orange-300">
                GET
              </span>
              <code className="text-sm text-gray-200 font-mono">
                /api/retractions/rss
              </code>
            </div>
            <p className="text-xs text-gray-500">
              RSS 2.0 feed of the 50 most recent retractions. Content-Type:{" "}
              <code className="font-mono text-gray-400">application/rss+xml</code>.
              Works in any feed reader (Feedly, NetNewsWire, Inoreader, etc.).
            </p>
          </div>
        </div>
      </section>

      {/* Rate limits */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Rate limits</h2>
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4 text-sm text-gray-400 leading-relaxed space-y-1">
          <p>
            Current limit: <span className="font-mono text-gray-200">100 results per request</span>.
            Rate-limit hint headers are included in every response:
          </p>
          <pre className="mt-2 text-xs font-mono text-gray-500">
{`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 75`}
          </pre>
          <p className="mt-3 text-gray-500">
            Full API access and higher rate limits available for research institutions and
            monitoring services —{" "}
            <a
              href="mailto:contact@epistemic-receipts.vercel.app"
              className="text-gray-400 hover:text-white underline-offset-2 hover:underline"
            >
              contact us
            </a>
            .
          </p>
        </div>
      </section>

      {/* Example curl */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Example: fetch recent retractions</h2>
        <div className="rounded-lg border border-gray-800 bg-gray-950/60 overflow-x-auto">
          <pre className="px-5 py-4 text-xs font-mono text-gray-300 whitespace-pre">
{`# Most recent 25 retractions
curl "${SITE_URL}/api/retractions/feed"

# Retractions in pharmacology since 2024
curl "${SITE_URL}/api/retractions/feed?field=pharmacology&since=2024-01-01"

# Subscribe in your RSS reader
open "${SITE_URL}/api/retractions/rss"`}
          </pre>
        </div>
      </section>

      {/* Example response */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Example JSON response</h2>
        <div className="rounded-lg border border-gray-800 bg-gray-950/60 overflow-x-auto">
          <pre className="px-5 py-4 text-xs font-mono text-gray-300 leading-relaxed whitespace-pre">
            {EXAMPLE_JSON}
          </pre>
        </div>
      </section>

      {/* Footer note */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4 text-xs text-gray-500 leading-relaxed">
        <p>
          <span className="text-gray-400 font-medium">Data provenance.</span>{" "}
          Retraction data is sourced from CrossRef&apos;s publisher-reported retraction stream,
          which integrates Retraction Watch submissions. Individual claim pages include full
          edge history, including{" "}
          <span className="font-mono text-gray-400">CONTRADICTS</span> links to papers
          that cite the retracted work.
        </p>
        <p className="mt-2">
          See also:{" "}
          <Link href="/retraction-wall" className="text-gray-400 hover:text-white underline-offset-2 hover:underline">
            Retraction Wall
          </Link>{" "}
          (visual feed) ·{" "}
          <Link href="/corrections" className="text-gray-400 hover:text-white underline-offset-2 hover:underline">
            Corrections
          </Link>{" "}
          (our own data-quality log).
        </p>
      </div>
    </div>
  );
}
