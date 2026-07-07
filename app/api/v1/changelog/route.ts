import { NextResponse } from "next/server";
import { methodNotAllowed } from "@/lib/v1/respond";

export const dynamic = "force-static";

const CHANGELOG = [
  {
    version: "1.0.0",
    date: "2026-07-07",
    changes: [
      "Initial /v1 API release.",
      "Endpoints: /claims, /claims/{id}, /sources, /sources/{id}, /trajectories/{claimId}, /search, /verify, /retractions/since/{date}, /manifest, /changelog.",
      "Auth: ApiKey (Bearer er_live_*). Free tier: 60 req/min, 10k/day.",
      "Pagination: opaque cursor (base64url createdAt|id).",
      "Provenance grades A–X on all claim shapes.",
      "Errors: RFC 7807 application/problem+json.",
    ],
  },
];

export async function GET() {
  return NextResponse.json(
    { data: CHANGELOG },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}

export function POST() { return methodNotAllowed(); }
export function PUT() { return methodNotAllowed(); }
export function PATCH() { return methodNotAllowed(); }
export function DELETE() { return methodNotAllowed(); }
