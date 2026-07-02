import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

type Extracted = { category: string; claim: string };
type Diff = {
  kept: { category: string; prev: string; next: string }[];
  changed: { category: string; prev: string; next: string }[];
  dropped: { category: string; claim: string }[];
  added: { category: string; claim: string }[];
};

// Very simple similarity: token overlap (Jaccard) on lowercased word tokens.
// Threshold 0.55 → "kept"; below → "changed".
function similar(a: string, b: string): boolean {
  const tok = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
  const A = tok(a);
  const B = tok(b);
  if (A.size === 0 || B.size === 0) return a.trim() === b.trim();
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return inter / union >= 0.55;
}

function computeDiff(prev: Extracted[], next: Extracted[]): Diff {
  const diff: Diff = { kept: [], changed: [], dropped: [], added: [] };
  const nextByCat = new Map<string, Extracted[]>();
  for (const n of next) {
    const list = nextByCat.get(n.category) ?? [];
    list.push(n);
    nextByCat.set(n.category, list);
  }
  const matchedNext = new Set<Extracted>();

  for (const p of prev) {
    const candidates = nextByCat.get(p.category) ?? [];
    const unmatched = candidates.filter((c) => !matchedNext.has(c));
    if (unmatched.length === 0) {
      diff.dropped.push({ category: p.category, claim: p.claim });
      continue;
    }
    // Find best-match candidate by similarity.
    let best: Extracted | null = null;
    let bestSim = false;
    for (const c of unmatched) {
      if (similar(p.claim, c.claim)) {
        best = c;
        bestSim = true;
        break;
      }
    }
    if (!best) best = unmatched[0];
    matchedNext.add(best);
    if (bestSim) {
      diff.kept.push({ category: p.category, prev: p.claim, next: best.claim });
    } else {
      diff.changed.push({
        category: p.category,
        prev: p.claim,
        next: best.claim,
      });
    }
  }

  for (const n of next) {
    if (!matchedNext.has(n)) {
      diff.added.push({ category: n.category, claim: n.claim });
    }
  }

  return diff;
}

function normalizeExtracted(raw: unknown): Extracted[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r): r is Extracted =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as { category?: unknown }).category === "string" &&
        typeof (r as { claim?: unknown }).claim === "string",
    )
    .map((r) => ({ category: r.category, claim: r.claim }));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ trajectoryId: string }> },
) {
  const { trajectoryId } = await params;

  // Resolve either by curated slug (trajectory:<slug>) or raw Claim id.
  const claim = await prisma.claim.findFirst({
    where: {
      deleted: false,
      OR: [{ externalId: `trajectory:${trajectoryId}` }, { id: trajectoryId }],
    },
    select: {
      id: true,
      text: true,
      externalId: true,
      statusHistory: {
        orderBy: { occurredAt: "asc" },
        select: {
          id: true,
          fromAxis: true,
          toAxis: true,
          community: true,
          occurredAt: true,
          datePrecision: true,
          reason: true,
          markerSource: { select: { name: true, url: true } },
          claimsSnapshot: {
            select: { extractedClaims: true, createdAt: true },
          },
        },
      },
    },
  });

  if (!claim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const transitions = claim.statusHistory.map((s, i, arr) => {
    const snapshot = s.claimsSnapshot
      ? normalizeExtracted(s.claimsSnapshot.extractedClaims)
      : null;
    const prev = i > 0 ? arr[i - 1] : null;
    const prevSnap = prev?.claimsSnapshot
      ? normalizeExtracted(prev.claimsSnapshot.extractedClaims)
      : null;
    const diff =
      prevSnap && snapshot ? computeDiff(prevSnap, snapshot) : null;
    return {
      id: s.id,
      fromAxis: s.fromAxis,
      toAxis: s.toAxis,
      community: s.community,
      occurredAt: s.occurredAt.toISOString().slice(0, 10),
      datePrecision: s.datePrecision,
      reason: s.reason,
      source: s.markerSource
        ? { name: s.markerSource.name, url: s.markerSource.url }
        : null,
      snapshot,
      diff,
    };
  });

  return NextResponse.json({
    id: trajectoryId,
    claimId: claim.id,
    claim: claim.text,
    transitions,
  });
}
