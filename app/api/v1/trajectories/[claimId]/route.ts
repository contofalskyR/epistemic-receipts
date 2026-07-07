import { NextRequest } from "next/server";
import { readPrisma } from "@/lib/v1/readClient";
import { verifyApiKey, isAuthError } from "@/lib/v1/auth";
import { v1Json, v1Error, methodNotAllowed, notFound } from "@/lib/v1/respond";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ claimId: string }> },
) {
  const auth = await verifyApiKey(req, "trajectories");
  if (isAuthError(auth)) return v1Error(auth.body, auth.headers);

  const { claimId } = await params;

  const claim = await readPrisma.claim.findUnique({
    where: { id: claimId, deleted: false },
    select: {
      id: true,
      text: true,
      updatedAt: true,
      statusHistory: {
        orderBy: { occurredAt: "asc" },
        include: {
          markerSource: {
            select: { id: true, name: true, url: true, methodologyType: true },
          },
        },
      },
    },
  });

  if (!claim) return notFound(`Claim ${claimId} not found.`);

  const etag = claim.updatedAt.getTime().toString(16);
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch === `"${etag}"`) {
    return new Response(null, { status: 304 });
  }

  const body = {
    claimId: claim.id,
    claimText: claim.text,
    statusHistory: claim.statusHistory.map(h => ({
      id: h.id,
      fromAxis: h.fromAxis,
      toAxis: h.toAxis,
      community: h.community,
      reason: h.reason,
      occurredAt: h.occurredAt.toISOString(),
      datePrecision: h.datePrecision,
      markerSourceId: h.sourceId,
      markerSource: h.markerSource
        ? {
            id: h.markerSource.id,
            name: h.markerSource.name,
            url: h.markerSource.url,
            methodologyType: h.markerSource.methodologyType,
          }
        : null,
    })),
  };

  return v1Json(body, { cache: "detail", etag });
}

export function POST() { return methodNotAllowed(); }
export function PUT() { return methodNotAllowed(); }
export function PATCH() { return methodNotAllowed(); }
export function DELETE() { return methodNotAllowed(); }
