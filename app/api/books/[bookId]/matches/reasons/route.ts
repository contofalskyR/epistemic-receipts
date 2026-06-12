import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/isReadOnly";
import { requireAdminOrDev } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

type Entry = { matchId: string; reason: string };

function parseBody(raw: unknown): Entry[] | null {
  if (!raw || typeof raw !== "object") return null;
  const reasons = (raw as { reasons?: unknown }).reasons;
  if (!Array.isArray(reasons)) return null;
  const out: Entry[] = [];
  for (const item of reasons) {
    if (!item || typeof item !== "object") return null;
    const matchId = (item as { matchId?: unknown }).matchId;
    const reason = (item as { reason?: unknown }).reason;
    if (typeof matchId !== "string" || typeof reason !== "string") return null;
    out.push({ matchId, reason });
  }
  return out;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  if (isReadOnly()) {
    return NextResponse.json(
      { error: "Editing disabled in production" },
      { status: 403 },
    );
  }
  const denied = requireAdminOrDev(req);
  if (denied) return denied;

  const { bookId } = await params;

  const body = await req.json().catch(() => null);
  const entries = parseBody(body);
  if (!entries) {
    return NextResponse.json(
      { error: "Body must be {reasons:[{matchId,reason}]}" },
      { status: 400 },
    );
  }

  if (entries.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const ids = entries.map((e) => e.matchId);

  // Security: only accept matchIds whose BookClaim's BookChunk belongs to this book.
  const owned = await prisma.bookClaimMatch.findMany({
    where: {
      id: { in: ids },
      bookClaim: { chunk: { bookId } },
    },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((m) => m.id));

  const validEntries = entries.filter((e) => ownedIds.has(e.matchId));
  if (validEntries.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const updated = await prisma.$transaction(
    async (tx) => {
      let count = 0;
      for (const e of validEntries) {
        await tx.bookClaimMatch.update({
          where: { id: e.matchId },
          data: { reason: e.reason.slice(0, 500) },
        });
        count++;
      }
      return count;
    },
    { timeout: 30000 },
  );

  return NextResponse.json({ updated });
}
