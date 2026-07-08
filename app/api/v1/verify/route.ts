/**
 * GET /v1/verify?statement=
 *
 * Given a statement (≤500 chars), find the top-10 nearest documented claims.
 * Returns provenance grade, epistemicAxis, edge receipt counts, statusHistory
 * summary, and a direct link.
 *
 * IMPORTANT: This surfaces SIMILAR documented claims — NOT a truth verdict.
 * The grade reflects documentation depth, not whether the statement is true.
 *
 * Auth required.
 */
import { NextRequest } from "next/server";
import { searchClaims } from "@/lib/search";
import { readPrisma } from "@/lib/v1/readClient";
import { verifyApiKey, isAuthError } from "@/lib/v1/auth";
import { computeProvenanceGrade, GRADE_DESCRIPTIONS } from "@/lib/v1/provenance";
import { v1Json, v1Error, methodNotAllowed, badRequest } from "@/lib/v1/respond";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifyApiKey(req, "verify");
  if (isAuthError(auth)) return v1Error(auth.body, auth.headers);

  const url = req.nextUrl;
  const statement = (url.searchParams.get("statement") ?? "").trim();

  if (statement.length < 10) return badRequest("Statement must be at least 10 characters.");
  if (statement.length > 500) return badRequest("Statement must be at most 500 characters.");

  const limit = Math.min(
    10,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "10", 10) || 10),
  );

  const results = await searchClaims(statement, "vector", {}, limit, 0).catch(() =>
    searchClaims(statement, "hybrid", {}, limit, 0),
  );

  if (results.length === 0) {
    return v1Json(
      {
        statement,
        disclaimer:
          "Results are semantically similar documented claims. epistemicAxis reflects the claim's documented status — not a verdict on your statement.",
        data: [],
      },
      { cache: "dynamic" },
    );
  }

  const ids = results.map(r => r.id);

  // Fetch edge counts (FOR/AGAINST/CONTRADICTS) + statusHistory counts
  const [edgeCounts, primaryEdgeCounts, historyItems] = await Promise.all([
    readPrisma.edge.groupBy({
      by: ["claimId", "type"],
      where: { claimId: { in: ids }, deleted: false },
      _count: { _all: true },
    }),
    readPrisma.edge.groupBy({
      by: ["claimId"],
      where: { claimId: { in: ids }, deleted: false, source: { methodologyType: "primary" } },
      _count: { _all: true },
    }),
    readPrisma.claimStatusHistory.findMany({
      where: { claimId: { in: ids } },
      select: { claimId: true, toAxis: true, occurredAt: true },
      // DESC with nulls last so stamped chain order wins but unbackfilled
      // legacy rows still sort by date instead of jumping to the front.
      orderBy: [
        { seq: { sort: "desc", nulls: "last" } },
        { occurredAt: "desc" },
        { createdAt: "desc" },
      ],
    }),
  ]);

  const primaryMap = new Map(primaryEdgeCounts.map(e => [e.claimId, e._count._all]));

  type EdgeTypeCount = { claimId: string; type: string; _count: { _all: number } };
  const receiptsMap = new Map<string, { for: number; against: number; contradicts: number }>();
  for (const e of edgeCounts as EdgeTypeCount[]) {
    const cur = receiptsMap.get(e.claimId) ?? { for: 0, against: 0, contradicts: 0 };
    if (e.type === "FOR") cur.for += e._count._all;
    else if (e.type === "AGAINST") cur.against += e._count._all;
    else if (e.type === "RETRACTS" || e.type === "CONTRADICTS") cur.contradicts += e._count._all;
    receiptsMap.set(e.claimId, cur);
  }

  const historyMap = new Map<string, { latestAxis: string; totalTransitions: number }>();
  for (const h of historyItems) {
    if (!historyMap.has(h.claimId)) {
      historyMap.set(h.claimId, { latestAxis: h.toAxis, totalTransitions: 0 });
    }
    historyMap.get(h.claimId)!.totalTransitions++;
  }

  const siteBase = process.env.NEXT_PUBLIC_SITE_URL ?? "https://epistemic-receipts.app";

  const data = results.map(r => {
    const primaryCount = primaryMap.get(r.id) ?? 0;
    const grade = computeProvenanceGrade({
      humanReviewed: false, // not in search result type; would need a separate DB fetch
      autoApproved: false,
      verificationStatus: r.verificationStatus ?? null,
      epistemicAxis: r.epistemicAxis ?? null,
      primarySourceEdgeCount: primaryCount,
    });
    return {
      claim: {
        id: r.id,
        text: r.text,
        claimType: r.claimType,
        epistemicAxis: r.epistemicAxis,
        verificationStatus: r.verificationStatus,
        ingestedBy: r.ingestedBy,
        humanReviewed: false,
        createdAt: r.createdAt,
        updatedAt: null,
        provenanceGrade: grade,
        provenanceDescription: GRADE_DESCRIPTIONS[grade],
        link: `${siteBase}/claims/${r.id}`,
      },
      rank: Number(r.rank.toFixed(6)),
      receipts: receiptsMap.get(r.id) ?? { for: 0, against: 0, contradicts: 0 },
      statusHistorySummary: historyMap.get(r.id) ?? { latestAxis: null, totalTransitions: 0 },
    };
  });

  return v1Json(
    {
      statement,
      disclaimer:
        "Results are semantically similar documented claims. epistemicAxis reflects the claim's documented status — not a verdict on your statement.",
      data,
    },
    { cache: "dynamic" },
  );
}

export function POST() { return methodNotAllowed(); }
export function PUT() { return methodNotAllowed(); }
export function PATCH() { return methodNotAllowed(); }
export function DELETE() { return methodNotAllowed(); }
