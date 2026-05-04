"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { isReadOnly } from "@/lib/isReadOnly";

type ThresholdPreview = { triggeredBy: string; createdAt: string };

type ReviewClaim = {
  id: string;
  text: string;
  currentStatus: string;
  claimType: string;
  ingestedBy: string;
  createdAt: string;
  sourceCount: number;
  _count: { edges: number; thresholdEvents: number };
  thresholdEvents: ThresholdPreview[];
};

type PageData = { claims: ReviewClaim[]; total: number; page: number; pages: number };

const STATUS_STYLE: Record<string, string> = {
  HARD_FACT:      "bg-green-900 text-green-300",
  NEVER_RESOLVES: "bg-gray-700 text-gray-400",
  DISPUTED:       "bg-yellow-900 text-yellow-300",
};

const INGESTED_STYLE: Record<string, string> = {
  openfda_v1: "bg-blue-900 text-blue-300",
  manual:     "bg-gray-800 text-gray-400",
};

function ingestedLabel(v: string) {
  if (v === "openfda_v1") return "openFDA v1";
  return v;
}

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const filter = searchParams.get("ingestedBy") ?? "all";

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (filter !== "all") params.set("ingestedBy", filter);
    fetch(`/api/review/claims?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);

  function setPage(p: number) {
    const params = new URLSearchParams({ page: String(p) });
    if (filter !== "all") params.set("ingestedBy", filter);
    router.push(`/review?${params}`);
  }

  function setFilter(f: string) {
    const params = new URLSearchParams({ page: "1" });
    if (f !== "all") params.set("ingestedBy", f);
    router.push(`/review?${params}`);
  }

  async function act(id: string, action: "approve" | "reject") {
    setActing(id);
    const res = await fetch(`/api/review/claims/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      load();
    } else {
      const { error } = await res.json();
      alert(`Failed: ${error}`);
    }
    setActing(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Review Queue</h1>
        {data && (
          <span className="text-sm text-gray-500">{data.total} unreviewed</span>
        )}
      </div>

      {isReadOnly() && (
        <p className="text-sm text-gray-500 italic mb-4">Editing is disabled in this deployment. Approve and Reject are read-only.</p>
      )}

      {/* Filter */}
      <div className="mb-5">
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-gray-500"
        >
          <option value="all">All sources</option>
          <option value="openfda_v1">openfda_v1</option>
          <option value="manual">manual</option>
        </select>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      {!loading && data && data.claims.length === 0 && (
        <p className="text-gray-500 text-sm">Nothing to review.</p>
      )}

      {!loading && data && data.claims.length > 0 && (
        <div className="space-y-4">
          {data.claims.map(claim => {
            const te = claim.thresholdEvents[0];
            const isActing = acting === claim.id;
            const readOnly = isReadOnly();

            return (
              <div
                key={claim.id}
                className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-4 space-y-3"
              >
                {/* Claim text */}
                <Link href={`/claims/${claim.id}`} className="block">
                  <p className="text-sm text-gray-200 hover:text-white transition-colors leading-snug">
                    {claim.text}
                  </p>
                </Link>

                {/* Badges + counts */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[claim.currentStatus] ?? STATUS_STYLE.DISPUTED}`}>
                    {claim.currentStatus}
                  </span>
                  <span className="px-2 py-0.5 rounded-full font-medium bg-gray-800 text-gray-400">
                    {claim.claimType}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${INGESTED_STYLE[claim.ingestedBy] ?? "bg-gray-800 text-gray-500"}`}>
                    {ingestedLabel(claim.ingestedBy)}
                  </span>
                  <span className="text-gray-600">
                    {claim.sourceCount} {claim.sourceCount === 1 ? "source" : "sources"}
                  </span>
                  <span className="text-gray-600">
                    {claim._count.edges} {claim._count.edges === 1 ? "edge" : "edges"}
                  </span>
                </div>

                {/* Threshold event preview */}
                {te && (
                  <p className="text-xs text-gray-500">
                    {te.triggeredBy} · {new Date(te.createdAt).toLocaleDateString()}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => act(claim.id, "approve")}
                    disabled={isActing || readOnly}
                    className="text-xs px-3 py-1.5 rounded bg-green-900 text-green-300 hover:bg-green-800 disabled:opacity-40 transition-colors"
                  >
                    {isActing ? "…" : "Approve"}
                  </button>
                  <Link
                    href={`/claims/${claim.id}/edit?from=review`}
                    className="text-xs px-3 py-1.5 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm("Reject and soft-delete this claim and its sources/edges?")) {
                        act(claim.id, "reject");
                      }
                    }}
                    disabled={isActing || readOnly}
                    className="text-xs px-3 py-1.5 rounded bg-red-950 text-red-400 hover:bg-red-900 disabled:opacity-40 transition-colors"
                  >
                    {isActing ? "…" : "Reject"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center gap-3 mt-6 text-sm">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="text-gray-500">Page {data.page} of {data.pages}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= data.pages}
            className="px-3 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<p className="text-gray-500 text-sm">Loading…</p>}>
      <ReviewContent />
    </Suspense>
  );
}
