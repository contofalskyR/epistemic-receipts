import { Suspense } from "react";
import GlobeLabClient from "../GlobeLabClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Globe Lab — Epistemic Receipts",
  description: "Experimental deep-time globe with logarithmic slider spanning 4.5 billion years",
};

export default function GlobeLabPage() {
  return (
    <div>
      <div className="mb-3">
        <h1 className="text-xl font-semibold text-white">
          Globe Lab
          <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-900/50 border border-purple-700/50 rounded text-purple-300">
            experimental
          </span>
        </h1>
        <p className="text-sm text-gray-400">
          Deep-time explorer. Scrub from Earth&apos;s formation to the present day.
        </p>
      </div>
      <div style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)" }}>
        <Suspense
          fallback={
            <div
              className="flex items-center justify-center bg-gray-950"
              style={{ height: "90vh" }}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                <p className="text-gray-400 text-sm">Loading globe…</p>
              </div>
            </div>
          }
        >
          <GlobeLabClient />
        </Suspense>
      </div>
    </div>
  );
}
