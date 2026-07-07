/**
 * /datasets/snapshots — Versioned Snapshot Exports listing
 * Server component, ISR revalidate every 24 h (86400 s).
 *
 * Source of truth: data/snapshots-registry.json (updated by CI after each export).
 * We read this static file at build/revalidation time — no R2 credentials needed
 * in Vercel. The workflow pushes an updated registry commit after each successful
 * export; the next revalidation window picks it up.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

export const revalidate = 86400;

export const metadata = {
  title: "Dataset Snapshots — Epistemic Receipts",
  description:
    "Immutable, checksummed, versioned dumps of the Epistemic Receipts claim graph, available for download in JSONL and Parquet formats.",
};

interface SnapshotEntry {
  id: string;
  createdAt: string;
  prismaMigrationId: string;
  manifestUrl: string;
  changelogUrl: string;
  sampleDownloadUrl: string;
  totalRows: number;
  tables: Record<string, { rows: number }>;
}

interface Registry {
  snapshots: SnapshotEntry[];
}

function loadRegistry(): Registry {
  try {
    const filePath = path.join(process.cwd(), "data", "snapshots-registry.json");
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as Registry;
  } catch {
    return { snapshots: [] };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export default function SnapshotsPage() {
  const registry = loadRegistry();
  const snapshots = [...registry.snapshots].sort((a, b) =>
    b.id.localeCompare(a.id),
  );

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Dataset Snapshots</h1>
      <p className="text-gray-500 mb-8 text-sm">
        Immutable, checksummed exports of the Epistemic Receipts claim graph.
        Each snapshot includes JSONL + Parquet files for{" "}
        <strong>22 tables</strong>, a signed manifest, and a changelog vs. the
        prior release. Full snapshots are available on request; the sample slice
        (≥100 claims, referentially complete) is publicly downloadable.
      </p>

      <div className="mb-10 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>License:</strong> CC BY 4.0 ·{" "}
        <strong>Methodology:</strong>{" "}
        <a
          href="/methodology"
          className="underline hover:no-underline"
        >
          epistemic-receipts.com/methodology
        </a>{" "}
        · PII excluded per{" "}
        <a href="/datasets/snapshots/readme" className="underline hover:no-underline">
          snapshot README
        </a>
      </div>

      {snapshots.length === 0 ? (
        <div className="rounded border border-gray-200 bg-gray-50 px-6 py-10 text-center text-gray-500">
          <p className="font-medium">No snapshots published yet.</p>
          <p className="mt-1 text-sm">
            The first quarterly export will appear here after the initial run.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {snapshots.map((snap) => (
            <div
              key={snap.id}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold font-mono">{snap.id}</h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Published {formatDate(snap.createdAt)} ·{" "}
                    <span className="font-mono text-xs text-gray-400">
                      schema: {snap.prismaMigrationId.substring(0, 40)}
                    </span>
                  </p>
                </div>
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 shrink-0">
                  {formatNumber(snap.totalRows)} rows
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <a
                  href={snap.manifestUrl}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-50"
                >
                  manifest.json
                </a>
                <a
                  href={snap.changelogUrl}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-50"
                >
                  CHANGELOG.md
                </a>
                <a
                  href={snap.sampleDownloadUrl}
                  className="inline-flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-blue-700 hover:bg-blue-100"
                >
                  Download sample slice
                </a>
              </div>

              {Object.keys(snap.tables).length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-800">
                    Table row counts ({Object.keys(snap.tables).length} tables)
                  </summary>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                    {Object.entries(snap.tables).map(([tbl, info]) => (
                      <div key={tbl} className="flex justify-between border-b border-gray-100 py-0.5">
                        <span className="font-mono text-gray-600">{tbl}</span>
                        <span className="text-gray-500">{formatNumber(info.rows)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 rounded border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
        <h3 className="font-semibold text-gray-800 mb-2">Getting full access</h3>
        <p>
          Full snapshot downloads (all 22 tables) are available via signed URL on
          request. Contact{" "}
          <a
            href="mailto:data@epistemic-receipts.com"
            className="underline hover:no-underline"
          >
            data@epistemic-receipts.com
          </a>{" "}
          with your intended use case. Entitlement gating will be automated in a
          future release.
        </p>
        <p className="mt-2">
          To verify a snapshot you already have, run:
        </p>
        <pre className="mt-1 rounded bg-gray-100 p-2 font-mono text-xs overflow-x-auto">
          npx tsx scripts/verify-snapshot.ts --local-dir /path/to/snapshot
        </pre>
      </div>
    </main>
  );
}
