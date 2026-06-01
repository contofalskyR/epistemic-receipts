import { Suspense } from "react";
import ConnectionsClient from "./ConnectionsClient";

export const revalidate = 600;

export const metadata = {
  title: "Connected Events — Epistemic Receipts",
  description: "Claims involving multiple countries simultaneously, visualized as arcs.",
};

export default function ConnectionsPage() {
  return (
    <div>
      <div className="mb-3">
        <h1 className="text-xl font-semibold text-white">Connected Events</h1>
        <p className="text-sm text-gray-400">
          Claims involving multiple countries simultaneously. Arcs link country pairs that
          share at least one underlying claim via the polity-claim graph.
          <span className="ml-2 text-gray-500">·</span>{" "}
          <a href="/globe" className="text-amber-400 hover:text-amber-300">← Back to globe</a>
        </p>
      </div>
      <div style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)" }}>
        <Suspense
          fallback={
            <div className="flex items-center justify-center bg-gray-950" style={{ height: "90vh" }}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                <p className="text-gray-400 text-sm">Loading connections…</p>
              </div>
            </div>
          }
        >
          <ConnectionsClient />
        </Suspense>
      </div>
    </div>
  );
}
