import { NextResponse } from "next/server";

// TODO(spec/20 — V1 API): expand this manifest with full API metadata,
// versioning, capability discovery, and rate-limit info. This minimal
// version was created by spec/13 (licensing) to establish the license field.

export async function GET() {
  return NextResponse.json(
    {
      name: "Epistemic Receipts",
      version: "1",
      license: "ER-Community-1.0",
      licenseUrl: "https://epistemic-receipts.vercel.app/license",
      dataTypes: ["claims", "sources", "edges", "meta-edges", "trajectories"],
      docs: "https://epistemic-receipts.vercel.app/license#attribution",
    },
    {
      headers: {
        "X-License": "ER-Community-1.0",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
