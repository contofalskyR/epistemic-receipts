import type { Metadata } from "next";
import { Suspense } from "react";
import LawSettlerClient from "./LawSettlerClient";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Law Settler Curve — Epistemic Receipts",
  description:
    "How legal doctrine settles, shatters, and reverses — traced through landmark Supreme Court decisions from Plessy to Dobbs.",
};

type LawTrajectory = {
  id: string;
  claimId: string;
  claim: string;
  currentAxis: string | null;
  firstYear: number | null;
  lastYear: number | null;
  milestones: { year: number; axis: string; community: string }[];
};

export default async function LawSettlerPage() {
  const claims = await prisma.claim.findMany({
    where: { ingestedBy: "law-settler", deleted: false },
    select: {
      id: true,
      externalId: true,
      text: true,
      statusHistory: {
        orderBy: [{ seq: "asc" }, { occurredAt: "asc" }, { createdAt: "asc" }],
        select: { seq: true, toAxis: true, occurredAt: true, community: true },
      },
    },
  });

  const trajectories: LawTrajectory[] = claims.map((c) => {
    // seq-first sort: coarse-precision dates (YEAR → Jan 1) can produce wrong order when sorted by date alone
    const sorted = [...c.statusHistory].sort(
      (a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity) || a.occurredAt.getTime() - b.occurredAt.getTime()
    );
    const milestones = sorted.map((s) => ({
      year: s.occurredAt.getUTCFullYear(),
      axis: s.toAxis,
      community: s.community,
    }));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return {
      id: c.externalId?.replace(/^trajectory:/, "") ?? c.id,
      claimId: c.id,
      claim: c.text,
      currentAxis: last?.toAxis ?? null,
      firstYear: first ? first.occurredAt.getUTCFullYear() : null,
      lastYear: last ? last.occurredAt.getUTCFullYear() : null,
      milestones,
    };
  });

  // Stable sort: reversed first, then by year ascending
  trajectories.sort((a, b) => {
    const aR = a.currentAxis === "REVERSED" ? 0 : 1;
    const bR = b.currentAxis === "REVERSED" ? 0 : 1;
    if (aR !== bR) return aR - bR;
    return (a.firstYear ?? 9999) - (b.firstYear ?? 9999);
  });

  return (
    <Suspense fallback={null}>
      <LawSettlerClient trajectories={trajectories} />
    </Suspense>
  );
}
