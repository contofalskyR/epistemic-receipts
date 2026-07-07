import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/entitlements";
import { exportMatteAsJSONL, exportMatterAsCSV, exportMatterAsPDFStub } from "@/lib/litigation/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Exports can take time; allow up to 5 minutes
export const maxDuration = 300;

type Params = { params: Promise<{ matterId: string }> };

// POST /api/litigation/matters/[matterId]/export — trigger export
export async function POST(req: NextRequest, { params }: Params) {
  const { matterId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const matter = await prisma.litigationMatter.findUnique({
    where: { id: matterId },
    include: { org: { select: { id: true, tier: true } } },
  });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId: matter.orgId } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });

  const entitled = can(
    { org: { id: matter.orgId, tier: matter.org.tier as "free" | "pro" | "team" | "enterprise" } },
    "litigation",
  );
  if (!entitled) {
    return NextResponse.json(
      { error: "Litigation workbench requires a Team or Enterprise plan" },
      { status: 403 },
    );
  }

  const body: unknown = await req.json().catch(() => null);
  const format = (body && typeof body === "object" && "format" in body)
    ? (body as Record<string, unknown>).format
    : "JSONL";

  if (!["JSONL", "CSV", "PDF"].includes(format as string)) {
    return NextResponse.json({ error: "format must be JSONL, CSV, or PDF" }, { status: 400 });
  }

  if (format === "PDF") {
    const stub = await exportMatterAsPDFStub();
    return NextResponse.json(stub);
  }

  const matterExportRecord = await prisma.matterExport.create({
    data: {
      matterId,
      format: format as "JSONL" | "CSV",
      r2Key: "",
      sha256: "",
      exportedById: session.user.id,
    },
  });

  try {
    const result =
      format === "JSONL"
        ? await exportMatteAsJSONL(matterId, matterExportRecord.id)
        : await exportMatterAsCSV(matterId, matterExportRecord.id);

    const updated = await prisma.matterExport.update({
      where: { id: matterExportRecord.id },
      data: { r2Key: result.r2Key, sha256: result.sha256 },
    });

    return NextResponse.json({ exportId: updated.id, r2Key: result.r2Key, sha256: result.sha256 }, { status: 201 });
  } catch (err) {
    // Clean up the pending record on failure
    await prisma.matterExport.delete({ where: { id: matterExportRecord.id } }).catch(() => {});
    console.error("[litigation/export] Export failed:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
