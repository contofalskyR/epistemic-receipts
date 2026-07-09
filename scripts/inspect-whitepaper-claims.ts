/**
 * inspect-whitepaper-claims.ts — READ-ONLY dump of the two whitepaper-cited
 * claims ahead of curation (PUBLISH-CHECKLIST P0; briefings/10-HANDOFF §remains).
 *
 *   cmqwoxe6l07dy8o0y6xrs8xnv — Surgeon General 1964 (paper reference [1])
 *   cmqoappnu03yxsadpa90nu942 — Müller 1939 tobacco case-control study ([2])
 *
 * Also lists sibling smoking/tobacco claims already in the corpus so the new
 * curves don't duplicate an existing trajectory (DUPLICATE-TRAJECTORIES watch).
 *
 * Usage: npx dotenv-cli -e .env.local -- npx tsx scripts/inspect-whitepaper-claims.ts
 * Writes nothing.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
// House rule (see audit-chain-integrity.ts --direct): explicit beats inherited.
// dotenv never overrides an already-set shell var — a stale/empty DATABASE_URL
// in the environment shadows .env.local and Prisma reports it "not found".
// Read-only script → the direct (non-pooled) connection is always safe.
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGETS = [
  { id: "cmqwoxe6l07dy8o0y6xrs8xnv", label: "paper ref [1] — Surgeon General 1964" },
  { id: "cmqoappnu03yxsadpa90nu942", label: "paper ref [2] — Müller 1939" },
];

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

async function dumpClaim(id: string, label: string) {
  console.log(`\n${"=".repeat(78)}\n${label}\nclaims/${id}\n${"=".repeat(78)}`);

  const claim = await prisma.claim.findUnique({
    where: { id },
    select: {
      id: true, externalId: true, text: true, claimType: true,
      epistemicAxis: true, epistemicStatus: true, currentStatus: true,
      verificationStatus: true, humanReviewed: true, reviewConfidence: true,
      reviewedAt: true, reviewedBy: true, claimEmergedAt: true,
      claimEmergedPrecision: true, ingestedBy: true, autoApproved: true,
      deleted: true, metadata: true, createdAt: true,
    },
  });
  if (!claim) { console.log("!! CLAIM NOT FOUND"); return; }

  console.log(`text            : ${claim.text}`);
  console.log(`externalId      : ${claim.externalId}`);
  console.log(`claimType       : ${claim.claimType}   epistemicAxis: ${claim.epistemicAxis}   epistemicStatus: ${claim.epistemicStatus}`);
  console.log(`currentStatus   : ${claim.currentStatus}   verificationStatus: ${claim.verificationStatus}`);
  console.log(`humanReviewed   : ${claim.humanReviewed} (confidence=${claim.reviewConfidence}, at=${day(claim.reviewedAt)}, by=${claim.reviewedBy})`);
  console.log(`claimEmergedAt  : ${day(claim.claimEmergedAt)} (${claim.claimEmergedPrecision})`);
  console.log(`ingestedBy      : ${claim.ingestedBy}   autoApproved: ${claim.autoApproved}   deleted: ${claim.deleted}   createdAt: ${day(claim.createdAt)}`);
  console.log(`metadata        : ${JSON.stringify(claim.metadata)}`);

  const hist = await prisma.claimStatusHistory.findMany({
    where: { claimId: id },
    orderBy: [{ seq: "asc" }, { occurredAt: "asc" }, { createdAt: "asc" }],
    include: { markerSource: { select: { externalId: true, name: true, url: true, publishedAt: true, methodologyType: true } } },
  });
  console.log(`\n-- statusHistory (${hist.length} rows) --`);
  for (const h of hist) {
    console.log(`  seq=${h.seq}  ${h.fromAxis ?? "∅"} → ${h.toAxis}  @ ${day(h.occurredAt)} (${h.datePrecision})  [${h.community}]`);
    console.log(`      reason : ${h.reason}`);
    console.log(`      marker : ${h.markerSource ? `${h.markerSource.externalId} | ${h.markerSource.name} | ${h.markerSource.url} | pub=${day(h.markerSource.publishedAt)} | ${h.markerSource.methodologyType}` : "NONE"}`);
  }

  const edges = await prisma.edge.findMany({
    where: { claimId: id, deleted: false },
    include: { source: { select: { externalId: true, name: true, url: true, publishedAt: true, methodologyType: true, humanReviewed: true } } },
  });
  console.log(`\n-- edges (${edges.length}, non-deleted) --`);
  for (const e of edges) {
    console.log(`  ${e.type}/${e.evidenceType}  ingestedBy=${e.ingestedBy}  humanReviewed=${e.humanReviewed}  edgeId=${e.id}`);
    console.log(`      source : ${e.source.externalId} | ${e.source.name} | ${e.source.url} | pub=${day(e.source.publishedAt)} | ${e.source.methodologyType} | reviewed=${e.source.humanReviewed}`);
  }

  const thresholds = await prisma.thresholdEvent.findMany({ where: { claimId: id } });
  console.log(`\n-- thresholdEvents (${thresholds.length}) --`);
  for (const t of thresholds) console.log(`  ${JSON.stringify(t)}`);
}

async function siblings() {
  console.log(`\n${"=".repeat(78)}\nSIBLING SCAN — existing smoking/tobacco claims (dedup guard)\n${"=".repeat(78)}`);
  const sibs = await prisma.claim.findMany({
    where: {
      deleted: false,
      id: { notIn: TARGETS.map((t) => t.id) },
      OR: [
        { text: { contains: "smoking", mode: "insensitive" } },
        { text: { contains: "tobacco", mode: "insensitive" } },
        { text: { contains: "lung cancer", mode: "insensitive" } },
        { externalId: { contains: "smoking" } },
        { externalId: { contains: "tobacco" } },
        { externalId: { contains: "surgeon-general" } },
        { externalId: { contains: "muller" } },
      ],
    },
    select: {
      id: true, externalId: true, text: true, humanReviewed: true,
      ingestedBy: true, _count: { select: { statusHistory: true } },
    },
    take: 60,
  });
  console.log(`found ${sibs.length} (showing ≤60; transitions in parens)`);
  for (const s of sibs) {
    const t = s.text.length > 110 ? s.text.slice(0, 110) + "…" : s.text;
    console.log(`  (${s._count.statusHistory}) ${s.id}  ${s.externalId ?? "—"}  reviewed=${s.humanReviewed}  via=${s.ingestedBy}\n      ${t}`);
  }
}

async function main() {
  for (const t of TARGETS) await dumpClaim(t.id, t.label);
  await siblings();
  console.log("\nDone (read-only — nothing written).");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
