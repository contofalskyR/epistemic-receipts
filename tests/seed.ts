/**
 * Seed minimal fixtures for integration tests.
 * 5 claims, 3 sources, edges, one ClaimStatusHistory chain.
 * Returns IDs so tests can reference them.
 */
import { PrismaClient } from "@prisma/client";

export type SeedResult = {
  claimIds: string[];
  sourceIds: string[];
  edgeIds: string[];
  detailClaimId: string;
  sameDayMultiStepClaimId: string;
};

export async function seedTestData(prisma: PrismaClient): Promise<SeedResult> {
  // Clear related tables first (order matters due to FK constraints)
  await prisma.claimStatusHistory.deleteMany({});
  await prisma.claimTopic.deleteMany({});
  await prisma.bookmark.deleteMany({});
  await prisma.edgeRevision.deleteMany({});
  await prisma.metaEdge.deleteMany({});
  await prisma.edge.deleteMany({});
  await prisma.claim.deleteMany({});
  await prisma.source.deleteMany({});

  // 3 sources
  const src1 = await prisma.source.create({
    data: {
      name: "Nature Journal",
      url: "https://nature.com",
      methodologyType: "primary",
      ingestedBy: "test_pipeline_v1",
      autoApproved: true,
    },
  });
  const src2 = await prisma.source.create({
    data: {
      name: "Science Mag",
      url: "https://science.org",
      methodologyType: "primary",
      ingestedBy: "test_pipeline_v1",
      autoApproved: true,
    },
  });
  const src3 = await prisma.source.create({
    data: {
      name: "PubMed Study",
      url: "https://pubmed.ncbi.nlm.nih.gov/12345",
      methodologyType: "derivative",
      ingestedBy: "test_pipeline_v1",
      autoApproved: true,
    },
  });

  // 5 claims
  const claim1 = await prisma.claim.create({
    data: {
      text: "Quantum entanglement enables faster-than-light communication",
      ingestedBy: "test_pipeline_v1",
      epistemicAxis: "CONTESTED",
      claimType: "EMPIRICAL",
      autoApproved: true,
    },
  });
  const claim2 = await prisma.claim.create({
    data: {
      text: "Water boils at 100 degrees Celsius at sea level",
      ingestedBy: "test_pipeline_v1",
      epistemicAxis: "SETTLED",
      claimType: "EMPIRICAL",
      autoApproved: true,
    },
  });
  const claim3 = await prisma.claim.create({
    data: {
      text: "The Earth orbits the Sun in approximately 365.25 days",
      ingestedBy: "test_pipeline_v1",
      epistemicAxis: "SETTLED",
      claimType: "EMPIRICAL",
      autoApproved: true,
    },
  });
  const claim4 = await prisma.claim.create({
    data: {
      text: "Aspirin reduces fever by inhibiting prostaglandin synthesis",
      ingestedBy: "test_pipeline_v1",
      epistemicAxis: "SETTLED",
      claimType: "EMPIRICAL",
      autoApproved: true,
    },
  });
  // The detail claim (has full edges + statusHistory)
  const claim5 = await prisma.claim.create({
    data: {
      text: "CRISPR-Cas9 gene editing can correct sickle cell disease mutations",
      ingestedBy: "test_pipeline_v1",
      epistemicAxis: "RECORDED",
      claimType: "EMPIRICAL",
      autoApproved: true,
    },
  });

  // A claim promoted RECORDED→SETTLED on the same calendar date as its entry —
  // the bulk-promote-corpus.ts shape. Two transitions, one distinct date: this
  // must count toward "settling curves" but not toward "curves with movement
  // over time" (lib/curve-counts.ts).
  const claim6 = await prisma.claim.create({
    data: {
      text: "A certified roll-call vote, recorded and settled the same day",
      ingestedBy: "test_pipeline_v1",
      epistemicAxis: "SETTLED",
      claimType: "EMPIRICAL",
      autoApproved: true,
    },
  });

  // Edges (src → claim)
  const edge1 = await prisma.edge.create({
    data: {
      sourceId: src1.id,
      claimId: claim5.id,
      type: "FOR",
      evidenceType: "EVIDENTIARY",
      ingestedBy: "test_pipeline_v1",
      autoApproved: true,
    },
  });
  const edge2 = await prisma.edge.create({
    data: {
      sourceId: src2.id,
      claimId: claim5.id,
      type: "FOR",
      evidenceType: "EVIDENTIARY",
      ingestedBy: "test_pipeline_v1",
      autoApproved: true,
    },
  });
  // Edge for claim1 too (search result)
  await prisma.edge.create({
    data: {
      sourceId: src3.id,
      claimId: claim1.id,
      type: "AGAINST",
      evidenceType: "EVIDENTIARY",
      ingestedBy: "test_pipeline_v1",
      autoApproved: true,
    },
  });

  // ClaimStatusHistory chain for claim5 (two transitions)
  await prisma.claimStatusHistory.create({
    data: {
      claimId: claim5.id,
      fromAxis: null,
      toAxis: "RECORDED",
      community: "EXPERT_LITERATURE",
      occurredAt: new Date("2020-01-01"),
      datePrecision: "YEAR",
      sourceId: src1.id,
    },
  });
  await prisma.claimStatusHistory.create({
    data: {
      claimId: claim5.id,
      fromAxis: "RECORDED",
      toAxis: "SETTLED",
      community: "EXPERT_LITERATURE",
      occurredAt: new Date("2023-06-01"),
      datePrecision: "MONTH",
      sourceId: src2.id,
    },
  });

  await prisma.claimStatusHistory.create({
    data: {
      claimId: claim6.id,
      fromAxis: null,
      toAxis: "RECORDED",
      community: "INSTITUTIONAL",
      occurredAt: new Date("2023-01-05"),
      datePrecision: "DAY",
    },
  });
  await prisma.claimStatusHistory.create({
    data: {
      claimId: claim6.id,
      fromAxis: "RECORDED",
      toAxis: "SETTLED",
      community: "INSTITUTIONAL",
      occurredAt: new Date("2023-01-05"),
      datePrecision: "DAY",
    },
  });

  return {
    claimIds: [claim1.id, claim2.id, claim3.id, claim4.id, claim5.id, claim6.id],
    sourceIds: [src1.id, src2.id, src3.id],
    edgeIds: [edge1.id, edge2.id],
    detailClaimId: claim5.id,
    sameDayMultiStepClaimId: claim6.id,
  };
}
